import type { AgentModelStopReason, PusslaAgentAction } from "@/lib/ai/types";
import { parseLocalAgentPlan } from "@/lib/ai/pusslaAgent";
import { filterUnknownActions } from "@/lib/ai/agent/actionRegistry";
import { isDestructiveAction } from "@/lib/ai/agent/actionContracts";
import { expandPlanWithActionGraph } from "@/lib/ai/agent/actionGraph";
import { buildHierarchicalPlan } from "@/lib/ai/agent/hierarchicalPlanner";
import { compileIntentPlan } from "@/lib/ai/agent/intentCompiler";
import { filterInvalidOperatorActions } from "@/lib/ai/agent/operatorContracts";
import { hasNoGapIntent, normalizeSv } from "@/lib/ai/agent/languageLexicon";
import { buildCanonicalPlannerSnapshot, buildCanonicalTimelineState } from "@/lib/ai/agent/worldState";
import { coalesceSupervisionMeetingAdds } from "@/lib/ai/agent/supervisionActionCoalesce";

type PlanSource = "compiler" | "hierarchical" | "local" | "llm";

interface CandidatePlan {
  source: PlanSource;
  actions: PusslaAgentAction[];
  confidence: "low" | "medium" | "high";
  goalSummary?: string;
}

export interface PlannerEngineInput {
  userText: string;
  snapshot?: unknown;
  planningMode?: "hybrid" | "shadow" | "enforce";
  llmActions?: PusslaAgentAction[];
  llmGoalSummary?: string;
  llmClarifyingQuestion?: string | null;
  llmStopReason?: AgentModelStopReason;
}

export interface PlannerEngineResult {
  goalSummary: string;
  actions: PusslaAgentAction[];
  confidence: "low" | "medium" | "high";
  source: PlanSource | "none";
  clarifyingQuestion?: string;
  notes: string[];
}

function isComplexPrompt(text: string): boolean {
  return /\b(och|sedan|darefter|forst|forst|steg|hela|alla|samtliga)\b/i.test(text);
}

function hasPrintIntent(text: string): boolean {
  const norm = normalizeSv(text);
  return /(skriv ut|print|skriv ut ansokan|skriv ut ansökan)/.test(norm);
}

function hasGapFillIntent(text: string): boolean {
  return hasNoGapIntent(text);
}

function scoreCandidate(c: CandidatePlan, userText: string): number {
  const complexityBonus = isComplexPrompt(userText) ? 2 : 0;
  const sourceScore =
    c.source === "compiler" ? 12 : c.source === "hierarchical" ? 10 : c.source === "local" ? 8 : 6;
  const confidenceScore = c.confidence === "high" ? 5 : c.confidence === "medium" ? 3 : 1;
  const actionBreadth = Math.min(6, c.actions.length);
  return sourceScore + confidenceScore + actionBreadth + complexityBonus;
}

function extractPlacementUpdateFieldsFromActions(actions: PusslaAgentAction[]): Record<string, unknown> {
  const update = actions.find((a) => a.type === "update_selected_placement");
  if (!update || update.type !== "update_selected_placement") return {};
  return { ...(update.fields as Record<string, unknown>) };
}

function hasPlacementFieldEditIntent(norm: string): boolean {
  return /\b(handledare|huvudhandledare|handledarens|handledares|huvudhandledares|huvudhandledarens|specialitet|tjanstestalle|beskrivning|anteckning|delmal|delmalen|bt\s*delmal|bt-delmal)\b/.test(
    norm
  );
}

function placementFieldUpdatesMissingInChosen(
  chosenFields: Record<string, unknown>,
  localFields: Record<string, unknown>
): boolean {
  for (const [k, v] of Object.entries(localFields)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !String(v).trim()) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    const cv = chosenFields[k];
    if (cv === undefined) return true;
    if (typeof cv === "string" && !String(cv).trim()) return true;
    if (Array.isArray(cv) && cv.length === 0) return true;
  }
  return false;
}

function isClassicPlacementSelectUpdateSave(actions: PusslaAgentAction[]): boolean {
  return (
    actions.length === 3 &&
    actions[0]?.type === "select_placement" &&
    actions[1]?.type === "update_selected_placement" &&
    actions[2]?.type === "save_selected_placement"
  );
}

function hasExplicitDestructiveIntent(text: string): boolean {
  const norm = normalizeSv(text);
  return /(ta bort|radera|delete|konvertera|ersatt|ersatta|byt ut|rens[a]?)/.test(norm);
}

function applySafetyFilter(
  actions: PusslaAgentAction[],
  userText: string
): { actions: PusslaAgentAction[]; removedDestructive: number } {
  if (actions.length === 0) return { actions, removedDestructive: 0 };
  if (hasExplicitDestructiveIntent(userText)) return { actions, removedDestructive: 0 };

  const kept: PusslaAgentAction[] = [];
  let removedDestructive = 0;
  for (const action of actions) {
    if (isDestructiveAction(action)) {
      removedDestructive += 1;
      continue;
    }
    kept.push(action);
  }
  return { actions: kept, removedDestructive };
}

function resolvePlanningMode(inputMode?: PlannerEngineInput["planningMode"]): "hybrid" | "shadow" | "enforce" {
  if (inputMode) return inputMode;
  const envMode = String(process.env.AI_COMPILER_PRIMARY_MODE || "").toLowerCase().trim();
  if (envMode === "shadow" || envMode === "enforce") return envMode;
  return "hybrid";
}

export function deriveExecutionPlan(input: PlannerEngineInput): PlannerEngineResult {
  const userText = String(input.userText || "").trim();
  const planningMode = resolvePlanningMode(input.planningMode);
  const notes: string[] = [];
  const printIntent = hasPrintIntent(userText);
  const candidates: CandidatePlan[] = [];
  const adaptedSnapshot = input.snapshot ? buildCanonicalPlannerSnapshot(input.snapshot) : undefined;
  const timelineState = buildCanonicalTimelineState(input.snapshot);
  notes.push(`planning_mode:${planningMode}`);
  notes.push(`world_state:placements=${timelineState.placements.length}`);
  notes.push(`world_state:courses=${timelineState.courses.length}`);
  notes.push(`world_state:gaps=${timelineState.gaps.length}`);

  const compiled = compileIntentPlan({ userText, snapshot: adaptedSnapshot });
  if (compiled?.clarifyingQuestion) {
    notes.push(...compiled.notes);
    return {
      goalSummary: compiled.goalSummary || userText.slice(0, 140),
      actions: [],
      confidence: compiled.confidence,
      source: "compiler",
      clarifyingQuestion: compiled.clarifyingQuestion,
      notes,
    };
  }
  if (compiled && compiled.actions.length > 0) {
    candidates.push({
      source: "compiler",
      actions: compiled.actions,
      confidence: compiled.confidence,
      goalSummary: compiled.goalSummary,
    });
    notes.push(...compiled.notes);
  }

  const hierarchical = buildHierarchicalPlan({ userText, snapshot: adaptedSnapshot });
  if (planningMode === "shadow" && compiled && hierarchical && hierarchical.actions.length > 0) {
    const compilerSig = compiled.actions.map((a) => a.type).join(",");
    const fallbackSig = hierarchical.actions.map((a) => a.type).join(",");
    if (compilerSig !== fallbackSig) notes.push("shadow_plan_diff:compiler_vs_hierarchical");
  }
  if (planningMode === "enforce" && (!compiled || compiled.actions.length === 0)) {
    return {
      goalSummary: compiled?.goalSummary || userText.slice(0, 140),
      actions: [],
      confidence: compiled?.confidence || "medium",
      source: "compiler",
      clarifyingQuestion:
        compiled?.clarifyingQuestion ||
        "Jag kunde inte kompilera ett säkert, exekverbart plansteg från målet. Förtydliga önskat resultat och scope.",
      notes: [...notes, "compiler_primary_enforced"],
    };
  }
  if (hierarchical?.clarifyingQuestion) {
    notes.push("hierarchical_requires_clarification");
    const hasActionableCompilerPlan = Boolean(compiled && compiled.actions.length > 0);
    if (hasGapFillIntent(userText) && !hasActionableCompilerPlan) {
      return {
        goalSummary: hierarchical.goalSummary || userText.slice(0, 140),
        actions: [],
        confidence: "medium",
        source: "hierarchical",
        clarifyingQuestion: hierarchical.clarifyingQuestion,
        notes,
      };
    }
  }
  if (hierarchical && hierarchical.actions.length > 0) {
    candidates.push({
      source: "hierarchical",
      actions: hierarchical.actions,
      confidence: hierarchical.confidence,
      goalSummary: hierarchical.goalSummary,
    });
  }

  const local = parseLocalAgentPlan(userText);
  if (local.length > 0) {
    candidates.push({
      source: "local",
      actions: local,
      confidence: local.length >= 2 ? "high" : "medium",
      goalSummary: userText.slice(0, 140),
    });
  }

  if (input.llmActions && input.llmActions.length > 0) {
    const { known } = filterUnknownActions(input.llmActions);
    if (known.length > 0) {
      candidates.push({
        source: "llm",
        actions: known,
        confidence: known.length >= 2 ? "high" : "medium",
        goalSummary: input.llmGoalSummary || userText.slice(0, 140),
      });
    }
  }

  const chosen = [...candidates].sort((a, b) => scoreCandidate(b, userText) - scoreCandidate(a, userText))[0];
  if (!chosen) {
    const cq = hierarchical?.clarifyingQuestion || input.llmClarifyingQuestion || undefined;
    return {
      goalSummary: input.llmGoalSummary || userText.slice(0, 140),
      actions: [],
      confidence: "low",
      source: "none",
      clarifyingQuestion: cq || undefined,
      notes,
    };
  }

  // Prefer deterministic local select→update→save när LLM-plan tappar fält (handledare, specialitet, tjänsteställe, beskrivning, delmål).
  const normUser = normalizeSv(userText);
  const localFields = extractPlacementUpdateFieldsFromActions(local);
  const chosenFields = extractPlacementUpdateFieldsFromActions(chosen.actions);
  const wantsPlacementFields = hasPlacementFieldEditIntent(normUser);
  const shouldPreferLocalPlacementPatch =
    wantsPlacementFields &&
    isClassicPlacementSelectUpdateSave(local) &&
    Object.keys(localFields).length > 0 &&
    placementFieldUpdatesMissingInChosen(chosenFields, localFields);

  const chosenActionsSource = shouldPreferLocalPlacementPatch ? local : chosen.actions;
  if (shouldPreferLocalPlacementPatch) {
    notes.push("placement_field_update_prefers_local");
  }

  if (
    input.llmStopReason === "unsafe" &&
    chosen.source === "llm"
  ) {
    return {
      goalSummary: chosen.goalSummary || userText.slice(0, 140),
      actions: [],
      confidence: "medium",
      source: "llm",
      clarifyingQuestion:
        input.llmClarifyingQuestion ||
        "Jag stoppar detta av säkerhetsskäl. Om du vill fortsätta, förtydliga målet med en säkrare och mer avgränsad instruktion.",
      notes: [...notes, "llm_unsafe_blocked"],
    };
  }

  const refined = expandPlanWithActionGraph(chosenActionsSource, userText);
  if (refined.unresolved.length > 0) {
    const needsCourse = refined.unresolved.includes("course_selection_missing");
    const needsPlacement = refined.unresolved.includes("placement_selection_missing");
    const asks =
      needsCourse && needsPlacement
        ? "Vilken kurs eller placering menar du att jag ska valja innan jag fortsatter?"
        : needsCourse
          ? "Vilken kurs ska jag valja innan jag fortsatter?"
          : "Vilken placering ska jag valja innan jag fortsatter?";
    return {
      goalSummary: chosen.goalSummary || userText.slice(0, 140),
      actions: [],
      confidence: "medium",
      source: chosen.source,
      clarifyingQuestion: asks,
      notes: [...notes, ...refined.unresolved],
    };
  }

  const coalescedSupervision = coalesceSupervisionMeetingAdds(refined.actions);
  if (coalescedSupervision.truncatedDates > 0) {
    notes.push(`supervision_dates_capped:${coalescedSupervision.truncatedDates}`);
  }
  if (refined.actions.length !== coalescedSupervision.actions.length) {
    notes.push("supervision_adds_coalesced");
  }

  const safety = applySafetyFilter(coalescedSupervision.actions, userText);
  if (safety.removedDestructive > 0) {
    notes.push(`destructive_filtered:${safety.removedDestructive}`);
  }
  const opValidation = filterInvalidOperatorActions(safety.actions, adaptedSnapshot);
  if (opValidation.dropped.length > 0) {
    notes.push(`operator_contract_filtered:${opValidation.dropped.length}`);
  }
  if (opValidation.metadata.length > 0) {
    const totalCost = opValidation.metadata.reduce((sum, m) => sum + m.cost, 0);
    notes.push(`operator_contract_total_cost:${totalCost}`);
  }
  const executableActions = opValidation.validActions;
  if (printIntent) {
    const hasPrintAction = executableActions.some(
      (a) => a.type === "open_window" && a.window === "bt_ansokan"
    );
    if (!hasPrintAction) {
      notes.push("print_intent_without_print_action");
    } else {
      notes.push("print_intent_opened_certificate_window");
    }
  }
  if (executableActions.length === 0 && safety.removedDestructive > 0) {
    return {
      goalSummary: chosen.goalSummary || userText.slice(0, 140),
      actions: [],
      confidence: "medium",
      source: chosen.source,
      clarifyingQuestion:
        "Din instruktion ser inte ut att uttryckligen be om en destruktiv ändring. Vill du att jag tar bort eller konverterar objekt?",
      notes,
    };
  }
  if (executableActions.length === 0 && opValidation.dropped.length > 0) {
    return {
      goalSummary: chosen.goalSummary || userText.slice(0, 140),
      actions: [],
      confidence: "medium",
      source: chosen.source,
      clarifyingQuestion: opValidation.dropped[0].reason,
      notes,
    };
  }

  if (
    (input.llmStopReason === "unsupported" || input.llmStopReason === "unsafe") &&
    chosen.source !== "llm"
  ) {
    notes.push(`llm_stop_overridden_by_${chosen.source}`);
  }

  return {
    goalSummary: chosen.goalSummary || userText.slice(0, 140),
    actions: executableActions,
    confidence: chosen.confidence,
    source: chosen.source,
    notes,
  };
}


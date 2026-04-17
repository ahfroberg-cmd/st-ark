import { deriveExecutionPlan } from "@/lib/ai/agent/plannerEngine";
import type { AgentTelemetryEvent } from "@/lib/ai/agent/telemetry";
import { buildPlanNoteMessages } from "@/lib/ai/assistantCore/hybridRunner";
import { derivePlanFromParsedResponse } from "@/lib/ai/assistantCore/planDerivationPipeline";
import { interpretLlmReply } from "@/lib/ai/assistantCore/responseInterpreter";
import { decideTurnStart } from "@/lib/ai/assistantCore/orchestrateTurn";
import {
  buildPlanSelectedEventPayload,
  splitDerivedNoteMessages,
} from "@/lib/ai/assistantCore/turnEffects";
import type { AiMessage, ParsedAgentResponse } from "@/lib/ai/types";
import type { PusslaAgentAction } from "@/lib/ai/types";

export type HybridAppendRole = "user" | "assistant" | "system";

export interface RunHybridTurnUi {
  enterPlanning: (goalSummaryPreview: string) => void;
  setGoalSummaryFromLlm: (goalSummary: string) => void;
  enterIdle: () => void;
  resetAfterMissingApiKey: () => void;
}

export interface RunHybridTurnInput {
  userText: string;
  snapshot: unknown;
  hasApiKey: boolean;
  ui: RunHybridTurnUi;
  append: (role: HybridAppendRole, text: string) => void;
  logEvent: (event: AgentTelemetryEvent) => void;
  buildAiMessages: () => AiMessage[];
  sendLlm: (messages: AiMessage[]) => Promise<{ text: string }>;
  parseModelResponse: (rawText: string) => ParsedAgentResponse;
  simplifyText: (input: string) => string;
  runGatedPlan: (
    actions: PusslaAgentAction[],
    goalSummary: string,
    source?: string
  ) => Promise<boolean>;
}

/**
 * Orkestrerar en hybrid-turn: pre-derived plan, ev. LLM-anrop, derive, gated exekvering.
 * Side effects sker via callbacks så UI-lagret kan hållas tunt.
 */
export async function runHybridTurn(input: RunHybridTurnInput): Promise<void> {
  const { userText, snapshot, hasApiKey, ui, append, logEvent } = input;

  ui.enterPlanning(userText.slice(0, 120));

  const preDerived = deriveExecutionPlan({
    userText,
    snapshot,
  });

  if (preDerived.clarifyingQuestion) {
    append("assistant", preDerived.clarifyingQuestion);
    logEvent({ kind: "needs_user", question: preDerived.clarifyingQuestion });
    ui.enterIdle();
    return;
  }

  const turnStart = decideTurnStart({
    preDerived,
    hasApiKey,
  });

  if (turnStart.route === "run_prederived_now") {
    turnStart.noteMessages.forEach((m) => append("assistant", m));
    if (turnStart.shouldLogPlanSelected) {
      logEvent(buildPlanSelectedEventPayload(preDerived));
    }
    await input.runGatedPlan(
      preDerived.actions,
      preDerived.goalSummary || userText.slice(0, 120),
      preDerived.source
    );
    return;
  }

  if (turnStart.route !== "continue_with_llm") {
    if (turnStart.route === "run_prederived_without_llm") {
      logEvent(buildPlanSelectedEventPayload(preDerived));
      await input.runGatedPlan(
        preDerived.actions,
        preDerived.goalSummary || userText.slice(0, 120),
        preDerived.source
      );
      return;
    }
    append(
      "assistant",
      turnStart.missingApiKeyMessage ||
        "Assistenten är inte aktiverad. Gå till Meny > AI-assistent för att slå på den."
    );
    ui.resetAfterMissingApiKey();
    return;
  }

  const llm = await input.sendLlm(input.buildAiMessages());
  const parsed = input.parseModelResponse(llm.text);
  let showedReply = false;

  const gs = (parsed.goalSummary || "").trim();
  if (gs) {
    ui.setGoalSummaryFromLlm(gs);
  }

  const planPipeline = derivePlanFromParsedResponse({
    userText,
    snapshot,
    parsed,
  });
  const sr = planPipeline.stopReason;
  const llmPlan = planPipeline.llmPlan;

  if (planPipeline.droppedUnknownCount > 0) {
    append(
      "system",
      `Modellen föreslog ${planPipeline.droppedUnknownCount} okänd(a) åtgärd(er) — de körs inte. Använd endast registrerade actions.`
    );
    logEvent({
      kind: "plan_ready",
      stepCount: llmPlan.length,
      droppedUnknown: planPipeline.droppedUnknownCount,
    });
  }

  const derived = planPipeline.derived;
  const derivedMessages = splitDerivedNoteMessages(buildPlanNoteMessages(derived.notes));
  derivedMessages.systemMessages.forEach((m) => append("system", m));

  if (derived.clarifyingQuestion) {
    append("assistant", input.simplifyText(derived.clarifyingQuestion));
    logEvent({ kind: "needs_user", question: derived.clarifyingQuestion });
    ui.enterIdle();
    return;
  }

  if (derived.actions.length > 0) {
    derivedMessages.assistantMessages.forEach((m) => append("assistant", m));
    logEvent(buildPlanSelectedEventPayload(derived));
    await input.runGatedPlan(
      derived.actions,
      derived.goalSummary || gs || userText.slice(0, 120),
      derived.source
    );
    return;
  }

  const interpreted = interpretLlmReply({
    stopReason: sr,
    parsedReply: parsed.reply,
    llmPlanLength: llmPlan.length,
    simplifyText: input.simplifyText,
  });

  if (interpreted.blockedByStopReason) {
    if (interpreted.assistantReply) append("assistant", interpreted.assistantReply);
    logEvent({ kind: "blocked", reason: `stop_reason=${sr}` });
    ui.enterIdle();
    return;
  }

  if (interpreted.assistantReply) append("assistant", interpreted.assistantReply);
  if (interpreted.systemReply) append("system", interpreted.systemReply);
  showedReply = interpreted.showedReply;

  if (!showedReply) {
    append(
      "assistant",
      "Jag kunde inte tolka instruktionen till en säker åtgärd. Skriv gärna målet i ett steg, till exempel: \"Lägg in en av varje SR-kurs jämnt över hela ST\"."
    );
  }
  ui.enterIdle();
}

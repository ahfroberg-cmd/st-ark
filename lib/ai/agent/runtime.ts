import type { AgentActionResult, PusslaAgentAction } from "@/lib/ai/types";
import {
  executePlanWithRetries,
  type RunPlanResult,
} from "@/lib/ai/agent/orchestrator";
import {
  shouldConfirmActionByMode,
  shouldVerifyActionOutcome,
  type AgentConfirmMode,
} from "@/lib/ai/agent/actionContracts";
import { classifyActionOutcome } from "@/lib/ai/agent/outcomeClassifier";
import { verifyWriteActionOutcome } from "@/lib/ai/agent/snapshotVerify";

export interface AgentRuntimeInput {
  initialActions: PusslaAgentAction[];
  maxAttempts: number;
  skipPrimaryPlan?: boolean;
  runPlan: (actions: PusslaAgentAction[]) => Promise<RunPlanResult>;
  onAttemptStart?: (attemptIndex: number, maxAttempts: number, plan: PusslaAgentAction[]) => void;
  onAttemptFailed?: (attemptIndex: number, result: RunPlanResult) => void;
}

export interface AgentRuntimeResult extends RunPlanResult {
  attemptsUsed: number;
  replanCount: number;
  lastFailureReason?: string;
}

export type RuntimeActionResult = {
  status: "ok" | "confirm" | "failed";
  verdict?: "applied" | "noop" | "blocked" | "retryable" | "failed" | "confirm";
  message?: string;
  blocked?: boolean;
  outcomeClass?: "success" | "noop" | "retryable_overlap" | "retryable_transient" | "fatal";
};

export interface RunAgentActionInput {
  action: PusslaAgentAction;
  userQuestion?: string;
  forceExecute?: boolean;
  confirmMode: AgentConfirmMode;
  friendlyActionLabel: (action: PusslaAgentAction) => string;
  executeAction: (action: PusslaAgentAction) => Promise<AgentActionResult>;
  captureSnapshot: () => unknown;
  appendSystem: (text: string) => void;
  appendAssistantAfterAction: (
    action: PusslaAgentAction,
    result: AgentActionResult,
    userQuestion?: string
  ) => Promise<void>;
  onAwaitingConfirm: (action: PusslaAgentAction) => void;
  onBlocked: (reason: string) => void;
  rememberCurrentSnapshot: () => void;
  onRecordStepAndCheckGuardrail?: (
    action: PusslaAgentAction,
    ok: boolean
  ) => { blocked: boolean; reason?: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function looksLikeSuccessMessage(message: string): boolean {
  const m = String(message || "").toLowerCase();
  if (!m.trim()) return false;
  if (/(misslyck|kunde inte|fel|ogiltig)/.test(m)) return false;
  return /(skapad|skapades|sparad|sparades|uppdaterad|uppdaterades|raderad|borttagen|synk|klar)/.test(
    m
  );
}

function findNextActivityStart(snapshot: unknown, fromDate: string): string | null {
  const rows = Array.isArray((snapshot as any)?.activities) ? (snapshot as any).activities : [];
  let next: string | null = null;
  for (const row of rows) {
    const start =
      typeof row?.exactStartISO === "string"
        ? row.exactStartISO.slice(0, 10)
        : typeof row?.startDate === "string"
          ? row.startDate.slice(0, 10)
          : null;
    if (!start || start <= fromDate) continue;
    if (!next || start < next) next = start;
  }
  return next;
}

function buildRecoveredPlacementAction(
  action: PusslaAgentAction,
  beforeSnapshot: unknown
): PusslaAgentAction | null {
  if (
    action.type !== "create_typed_placement_from_range" &&
    action.type !== "create_placement_from_range"
  ) {
    return null;
  }
  const startDate = action.startDate;
  const nextStart = findNextActivityStart(beforeSnapshot, startDate);
  if (!nextStart) return null;
  const adjustedEnd = addDaysIso(nextStart, -1);
  if (adjustedEnd < startDate) return null;
  return {
    ...action,
    endDate: adjustedEnd,
  };
}

export async function runAgentAction(input: RunAgentActionInput): Promise<RuntimeActionResult> {
  const {
    action,
    userQuestion,
    forceExecute = false,
    confirmMode,
    friendlyActionLabel,
    executeAction,
    captureSnapshot,
    appendSystem,
    appendAssistantAfterAction,
    onAwaitingConfirm,
    onBlocked,
    rememberCurrentSnapshot,
    onRecordStepAndCheckGuardrail,
  } = input;

  const shouldConfirm = shouldConfirmActionByMode(action, confirmMode);
  if (shouldConfirm && !forceExecute) {
    onAwaitingConfirm(action);
    return { status: "confirm", verdict: "confirm" };
  }

  appendSystem(`Kör: ${friendlyActionLabel(action)}`);
  const verifyThisAction = shouldVerifyActionOutcome(action);
  const beforeSnapshot = verifyThisAction ? captureSnapshot() : null;

  const rawRes = await executeAction(action);
  let res: AgentActionResult = { ...rawRes, actionType: action.type };
  let outcomeClass = classifyActionOutcome(action, res);
  if (!res.ok && outcomeClass === "noop") {
    res = {
      ...res,
      ok: true,
      message: `${res.message}\nIngen träff för denna månad, går vidare till nästa steg.`,
    };
    outcomeClass = "noop";
  }
  if (!res.ok && outcomeClass === "retryable_transient") {
    await sleep(220);
    const retryRes = await executeAction(action);
    if (retryRes.ok) {
      res = {
        ...retryRes,
        actionType: action.type,
        message: `${retryRes.message}\nÅterhämtning: nytt försök efter tillfälligt fel lyckades.`,
      };
      outcomeClass = "success";
    } else {
      res = { ...retryRes, actionType: action.type };
      outcomeClass = classifyActionOutcome(action, res);
    }
  }
  if (!res.ok && outcomeClass === "retryable_overlap" && beforeSnapshot) {
    const recoveredAction = buildRecoveredPlacementAction(action, beforeSnapshot);
    if (recoveredAction) {
      const retryRes = await executeAction(recoveredAction);
      if (retryRes.ok) {
        res = {
          ...retryRes,
          actionType: recoveredAction.type,
          message: `${retryRes.message}\nÅterhämtning: justerade slutdatum för att undvika överlapp.`,
        };
        outcomeClass = "success";
      }
    }
  }
  if (verifyThisAction && res.ok) {
    let afterSnapshot = captureSnapshot();
    let verification = verifyWriteActionOutcome(action, beforeSnapshot, afterSnapshot, res.message);
    if (!verification.verified && verification.reason === "no_observed_change") {
      const waits = [60, 140, 260];
      for (const waitMs of waits) {
        await sleep(waitMs);
        afterSnapshot = captureSnapshot();
        verification = verifyWriteActionOutcome(action, beforeSnapshot, afterSnapshot, res.message);
        if (verification.verified) break;
      }
      if (!verification.verified && looksLikeSuccessMessage(res.message)) {
        verification = {
          verified: true,
          changed: false,
          changedCount: 0,
          reason: "message_confirmed",
        };
      }
    }
    res = {
      ...res,
      verified: verification.verified,
      changed: verification.changed,
      changedCount: verification.changedCount,
      code: verification.verified ? "verified" : "unverified",
      meta: {
        ...(res.meta || {}),
        verification,
      },
    };
    if (!verification.verified) {
      res = {
        ...res,
        ok: false,
        message: `${res.message}\nVerifiering: åtgärden gav ingen bekräftad effekt (${verification.reason}).`,
      };
      outcomeClass = "fatal";
    }
  }

  await appendAssistantAfterAction(action, res, userQuestion);
  if (onRecordStepAndCheckGuardrail) {
    const guard = onRecordStepAndCheckGuardrail(action, res.ok);
    if (guard.blocked) {
      const reason = guard.reason || "Stoppad av guardrail.";
      onBlocked(reason);
      rememberCurrentSnapshot();
      return {
        status: "failed",
        verdict: "blocked",
        message: reason,
        blocked: true,
        outcomeClass: "fatal",
      };
    }
  }

  if (!res.ok) {
    appendSystem(`Misslyckades: ${friendlyActionLabel(action)}`);
    rememberCurrentSnapshot();
    const retryable =
      outcomeClass === "retryable_overlap" || outcomeClass === "retryable_transient";
    return {
      status: "failed",
      verdict: retryable ? "retryable" : "failed",
      message: res.message,
      outcomeClass,
    };
  }
  appendSystem(`Lyckades: ${friendlyActionLabel(action)}`);
  rememberCurrentSnapshot();
  return {
    status: "ok",
    verdict: outcomeClass === "noop" ? "noop" : "applied",
    outcomeClass: outcomeClass === "noop" ? "noop" : "success",
  };
}

export interface RunAgentPlanInput {
  actions: PusslaAgentAction[];
  userQuestion?: string;
  runAction: (action: PusslaAgentAction, userQuestion?: string) => Promise<RuntimeActionResult>;
  onStepStart: (index: number, total: number, action: PusslaAgentAction) => void;
  onStepEnd: (index: number, ok: boolean, outcome: RuntimeActionResult) => void;
  onNeedsConfirm: (index: number, remainingActions: PusslaAgentAction[]) => void;
  onPlanFailed: (remainingActions: PusslaAgentAction[]) => void;
  onPlanComplete: () => void;
}

export async function runAgentPlan(input: RunAgentPlanInput): Promise<RunPlanResult> {
  const {
    actions,
    userQuestion,
    runAction,
    onStepStart,
    onStepEnd,
    onNeedsConfirm,
    onPlanFailed,
    onPlanComplete,
  } = input;

  const queue = [...actions];
  const localReplanned = new Set<string>();
  let i = 0;
  while (i < queue.length) {
    const action = queue[i];
    onStepStart(i, queue.length, action);
    const outcome = await runAction(action, userQuestion);
    onStepEnd(i, outcome.status === "ok", outcome);
    if (outcome.blocked) {
      return { status: "failed", message: outcome.message, remainingActions: queue.slice(i + 1) };
    }
    if (outcome.status === "confirm") {
      onNeedsConfirm(i, queue.slice(i + 1));
      return { status: "confirm" };
    }
    if (outcome.status === "failed") {
      const key = JSON.stringify(action);
      const canLocalReplan =
        outcome.verdict === "retryable" &&
        !localReplanned.has(key) &&
        i < queue.length - 1;
      if (canLocalReplan) {
        // Local replan: postpone one retryable step and continue with others.
        localReplanned.add(key);
        queue.push(action);
        i += 1;
        continue;
      }
      const remaining = queue.slice(i + 1);
      onPlanFailed(remaining);
      return { status: "failed", message: outcome.message, remainingActions: remaining };
    }
    i += 1;
  }
  onPlanComplete();
  return { status: "ok" };
}

export async function runAgentRuntime(input: AgentRuntimeInput): Promise<AgentRuntimeResult> {
  let attemptsUsed = 0;
  let replanCount = 0;
  let lastFailureReason = "";

  const result = await executePlanWithRetries({
    initialActions: input.initialActions,
    maxAttempts: input.maxAttempts,
    skipPrimaryPlan: input.skipPrimaryPlan,
    runPlan: input.runPlan,
    onAttemptStart: (attempt, max, plan) => {
      attemptsUsed = Math.max(attemptsUsed, attempt + 1);
      input.onAttemptStart?.(attempt, max, plan);
    },
    onAttemptFailed: (attempt, failedResult) => {
      replanCount += 1;
      lastFailureReason = String(failedResult.message || "attempt_failed");
      input.onAttemptFailed?.(attempt, failedResult);
    },
  });

  return {
    ...result,
    attemptsUsed,
    replanCount,
    lastFailureReason: lastFailureReason || undefined,
  };
}


import type { PusslaAgentAction } from "@/lib/ai/types";
import type { AgentSessionMemoryState, AgentStepRecord } from "@/lib/ai/agent/types";
import { AGENT_DEFAULTS } from "@/lib/ai/agent/types";
import { safeStableStringify } from "@/lib/ai/agent/snapshotVerify";

export function fingerprintAction(action: PusslaAgentAction): string {
  return safeStableStringify(action);
}

export function createAgentSessionMemory(goalSummary: string, userInstruction: string): AgentSessionMemoryState {
  return {
    goalSummary: goalSummary || "",
    userInstruction,
    steps: [],
    consecutiveFailures: 0,
  };
}

export function recordAgentStep(
  mem: AgentSessionMemoryState,
  action: PusslaAgentAction,
  ok: boolean
): AgentStepRecord {
  const rec: AgentStepRecord = {
    index: mem.steps.length,
    fingerprint: fingerprintAction(action),
    actionType: action.type,
    ok,
    at: new Date().toISOString(),
  };
  mem.steps.push(rec);
  if (ok) {
    mem.consecutiveFailures = 0;
  } else {
    mem.consecutiveFailures += 1;
  }
  return rec;
}

export function countFingerprintFailures(mem: AgentSessionMemoryState, fingerprint: string): number {
  return mem.steps.filter((s) => !s.ok && s.fingerprint === fingerprint).length;
}

export function evaluateSessionGuardrails(
  mem: AgentSessionMemoryState,
  lastFingerprint: string
): { blocked: false } | { blocked: true; reason: string } {
  if (mem.steps.length >= AGENT_DEFAULTS.maxTotalStepsPerInstruction) {
    return {
      blocked: true,
      reason: `Stopp: för många steg i följd (${AGENT_DEFAULTS.maxTotalStepsPerInstruction}).`,
    };
  }
  if (mem.consecutiveFailures >= AGENT_DEFAULTS.maxConsecutiveFailures) {
    return {
      blocked: true,
      reason: `Stopp: ${AGENT_DEFAULTS.maxConsecutiveFailures} misslyckade steg i rad.`,
    };
  }
  const fpFails = countFingerprintFailures(mem, lastFingerprint);
  if (fpFails >= AGENT_DEFAULTS.maxSameFingerprintFailures) {
    return {
      blocked: true,
      reason: "Stopp: samma åtgärd misslyckades upprepade gånger.",
    };
  }
  return { blocked: false };
}

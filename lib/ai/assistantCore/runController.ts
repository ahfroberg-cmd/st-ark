import type { PusslaAgentAction } from "@/lib/ai/types";
import { buildTaskProfile, gatePlanActions } from "@/lib/ai/assistantCore/runPolicy";

export interface RunControllerDecision {
  allowedActions: PusslaAgentAction[];
  droppedActions: PusslaAgentAction[];
  blockedReason: string | null;
  profile: {
    taskType: "read_query" | "mixed" | "write_request";
    mode: "read_only" | "write_enabled";
    maxToolCalls: number;
  };
}

export function buildBlockedPlanMessages(decision: RunControllerDecision): {
  assistantMessage: string;
  systemMessage?: string;
} | null {
  if (!decision.blockedReason) return null;
  if (decision.droppedActions.length > 0) {
    return {
      assistantMessage: decision.blockedReason,
      systemMessage: `Stoppade ${decision.droppedActions.length} skrivande steg i read-only-läge.`,
    };
  }
  return { assistantMessage: decision.blockedReason };
}

export function evaluatePlanForExecution(params: {
  userText: string;
  actions: PusslaAgentAction[];
  forceReadOnly: boolean;
}): RunControllerDecision {
  const profile = buildTaskProfile({
    userText: params.userText,
    actions: params.actions,
    forceReadOnly: params.forceReadOnly,
  });
  const gated = gatePlanActions({
    actions: params.actions,
    mode: profile.mode,
    maxToolCalls: profile.maxToolCalls,
  });
  return {
    allowedActions: gated.allowed,
    droppedActions: gated.dropped,
    blockedReason: gated.blockedReason,
    profile,
  };
}

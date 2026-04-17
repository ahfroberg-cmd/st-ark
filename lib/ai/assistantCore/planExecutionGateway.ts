import type { PusslaAgentAction } from "@/lib/ai/types";
import {
  buildBlockedPlanMessages,
  evaluatePlanForExecution,
} from "@/lib/ai/assistantCore/runController";

export interface PlanExecutionGatewayResult {
  ok: boolean;
  allowedActions: PusslaAgentAction[];
  assistantMessage?: string;
  systemMessage?: string;
}

export function buildPlanExecutionDecision(params: {
  userText: string;
  actions: PusslaAgentAction[];
  forceReadOnly: boolean;
}): PlanExecutionGatewayResult {
  const decision = evaluatePlanForExecution({
    userText: params.userText,
    actions: params.actions,
    forceReadOnly: params.forceReadOnly,
  });
  const blocked = buildBlockedPlanMessages(decision);
  if (blocked) {
    return {
      ok: false,
      allowedActions: [],
      assistantMessage: blocked.assistantMessage,
      systemMessage: blocked.systemMessage,
    };
  }
  return { ok: true, allowedActions: decision.allowedActions };
}

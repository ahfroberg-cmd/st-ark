import type { PusslaAgentAction } from "@/lib/ai/types";
import { buildPlanExecutionDecision } from "@/lib/ai/assistantCore/planExecutionGateway";

export type GatedPlanExecutionResult =
  | { ok: true }
  | {
      ok: false;
      assistantMessage: string;
      systemMessage?: string;
    };

/**
 * Kör plan endast om den passerar assistantCore-policy (read-only, max steg, m.m.).
 * Själva mutationen/exekveringen sker via callback så UI-lagret kan anropa runtime.
 */
export async function runGatedPlanIfAllowed(params: {
  userText: string;
  forceReadOnly: boolean;
  actions: PusslaAgentAction[];
  executeAllowed: (actions: PusslaAgentAction[]) => Promise<void>;
}): Promise<GatedPlanExecutionResult> {
  const decision = buildPlanExecutionDecision({
    userText: params.userText,
    actions: params.actions,
    forceReadOnly: params.forceReadOnly,
  });
  if (!decision.ok) {
    return {
      ok: false,
      assistantMessage:
        decision.assistantMessage || "Planen stoppades av körpolicyn.",
      systemMessage: decision.systemMessage,
    };
  }
  await params.executeAllowed(decision.allowedActions);
  return { ok: true };
}

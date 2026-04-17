import type { PusslaAgentAction } from "@/lib/ai/types";
import { getActionRisk } from "@/lib/ai/actionPolicy";
import { getActionMeta } from "@/lib/ai/agent/actionRegistry";

export type AgentConfirmMode = "never" | "destructive" | "all";

export function isDestructiveAction(action: PusslaAgentAction): boolean {
  return Boolean(getActionMeta(action)?.destructive);
}

export function needsSelectionHint(
  action: PusslaAgentAction
): "placement" | "course" | "either" | undefined {
  return getActionMeta(action)?.needsSelectionHint;
}

export function shouldVerifyActionOutcome(action: PusslaAgentAction): boolean {
  const capability = getActionMeta(action)?.capability;
  return capability === "mutate" || capability === "macro";
}

export function shouldConfirmActionByMode(
  action: PusslaAgentAction,
  confirmMode: AgentConfirmMode
): boolean {
  if (confirmMode === "never") return false;
  if (confirmMode === "destructive") return isDestructiveAction(action);
  if (confirmMode === "all") {
    const capability = getActionMeta(action)?.capability;
    return capability === "mutate" || capability === "macro";
  }
  return getActionRisk(action) === "confirm";
}


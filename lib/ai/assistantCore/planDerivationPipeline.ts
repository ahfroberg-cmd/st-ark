import { filterUnknownActions } from "@/lib/ai/agent/actionRegistry";
import { deriveExecutionPlan, type PlannerEngineResult } from "@/lib/ai/agent/plannerEngine";
import type {
  AgentModelStopReason,
  ParsedAgentResponse,
  PusslaAgentAction,
} from "@/lib/ai/types";

export interface PlanDerivationResult {
  goalSummary: string;
  stopReason: AgentModelStopReason;
  llmPlan: PusslaAgentAction[];
  droppedUnknownCount: number;
  derived: PlannerEngineResult;
}

export function derivePlanFromParsedResponse(params: {
  userText: string;
  snapshot: unknown;
  parsed: ParsedAgentResponse;
}): PlanDerivationResult {
  const gs = String(params.parsed.goalSummary || "").trim();
  const sr = params.parsed.stopReason || "none";
  const rawPlan: PusslaAgentAction[] = params.parsed.actions?.length
    ? params.parsed.actions
    : params.parsed.action
      ? [params.parsed.action]
      : [];
  const { known: llmPlan, dropped: droppedUnknown } = filterUnknownActions(rawPlan);
  const derived = deriveExecutionPlan({
    userText: params.userText,
    snapshot: params.snapshot,
    llmActions: llmPlan,
    llmGoalSummary: gs,
    llmClarifyingQuestion: params.parsed.clarifyingQuestion,
    llmStopReason: sr,
  });
  return {
    goalSummary: gs,
    stopReason: sr,
    llmPlan,
    droppedUnknownCount: droppedUnknown.length,
    derived,
  };
}

import type { PlannerEngineResult } from "@/lib/ai/agent/plannerEngine";
import {
  buildPlanNoteMessages,
  decidePreDerivedRoute,
  type PreDerivedRoute,
} from "@/lib/ai/assistantCore/hybridRunner";

export interface TurnStartDecision {
  route: PreDerivedRoute;
  noteMessages: string[];
  shouldLogPlanSelected: boolean;
  missingApiKeyMessage?: string;
}

export function decideTurnStart(params: {
  preDerived: PlannerEngineResult;
  hasApiKey: boolean;
}): TurnStartDecision {
  const route = decidePreDerivedRoute({
    preDerived: params.preDerived,
    hasApiKey: params.hasApiKey,
  });
  const noteMessages = buildPlanNoteMessages(params.preDerived.notes);
  if (route === "stop_missing_api_key") {
    return {
      route,
      noteMessages: [],
      shouldLogPlanSelected: false,
      missingApiKeyMessage:
        "Assistenten är inte aktiverad. Gå till Meny > AI-assistent för att slå på den.",
    };
  }
  return {
    route,
    noteMessages,
    shouldLogPlanSelected:
      route === "run_prederived_now" || route === "run_prederived_without_llm",
  };
}

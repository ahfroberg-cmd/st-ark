import type { PlannerEngineResult } from "@/lib/ai/agent/plannerEngine";

export type PreDerivedRoute =
  | "run_prederived_now"
  | "run_prederived_without_llm"
  | "continue_with_llm"
  | "stop_missing_api_key";

export function decidePreDerivedRoute(params: {
  preDerived: PlannerEngineResult;
  hasApiKey: boolean;
}): PreDerivedRoute {
  const { preDerived, hasApiKey } = params;
  if (preDerived.actions.length > 0 && preDerived.confidence === "high") {
    return "run_prederived_now";
  }
  if (!hasApiKey) {
    if (preDerived.actions.length > 0) return "run_prederived_without_llm";
    return "stop_missing_api_key";
  }
  return "continue_with_llm";
}

export function buildPlanNoteMessages(notes: string[]): string[] {
  const out: string[] = [];
  if (notes.includes("print_intent_opened_certificate_window")) {
    out.push(
      "Jag öppnar BT-intygsvyn. Utskrift behöver sedan bekräftas/manuellt startas i webbläsaren."
    );
  } else if (notes.includes("print_intent_without_print_action")) {
    out.push(
      "Jag kan förbereda och öppna rätt vy för intyg, men själva utskriften behöver startas manuellt i webbläsaren."
    );
  }
  if (notes.includes("llm_stop_overridden_by_hierarchical")) {
    out.push("LLM-planen stoppades, men den lokala planeringsmotorn hittade en genomförbar action-kedja.");
  } else if (notes.includes("llm_stop_overridden_by_local")) {
    out.push("LLM-planen stoppades, men den lokala action-parsern hittade en genomförbar plan.");
  }
  return out;
}

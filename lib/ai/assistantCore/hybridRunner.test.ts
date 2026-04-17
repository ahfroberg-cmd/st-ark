import { describe, expect, it } from "vitest";
import {
  buildPlanNoteMessages,
  decidePreDerivedRoute,
} from "@/lib/ai/assistantCore/hybridRunner";
import type { PlannerEngineResult } from "@/lib/ai/agent/plannerEngine";

function basePreDerived(): PlannerEngineResult {
  return {
    goalSummary: "x",
    actions: [],
    confidence: "medium",
    source: "none",
    notes: [],
  };
}

describe("assistantCore hybridRunner", () => {
  it("runs high-confidence pre-derived immediately", () => {
    const pre = basePreDerived();
    pre.actions = [{ type: "open_window", window: "iup" }];
    pre.confidence = "high";
    expect(decidePreDerivedRoute({ preDerived: pre, hasApiKey: false })).toBe(
      "run_prederived_now"
    );
  });

  it("stops when no api key and no actions", () => {
    const pre = basePreDerived();
    expect(decidePreDerivedRoute({ preDerived: pre, hasApiKey: false })).toBe(
      "stop_missing_api_key"
    );
  });

  it("builds note messages from planner notes", () => {
    const messages = buildPlanNoteMessages([
      "print_intent_opened_certificate_window",
      "llm_stop_overridden_by_local",
    ]);
    expect(messages.length).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { decideTurnStart } from "@/lib/ai/assistantCore/orchestrateTurn";
import type { PlannerEngineResult } from "@/lib/ai/agent/plannerEngine";

function mk(overrides?: Partial<PlannerEngineResult>): PlannerEngineResult {
  return {
    goalSummary: "x",
    actions: [],
    confidence: "medium",
    source: "none",
    notes: [],
    ...overrides,
  };
}

describe("assistantCore orchestrateTurn", () => {
  it("routes to pre-derived now and keeps notes", () => {
    const d = decideTurnStart({
      preDerived: mk({
        actions: [{ type: "open_window", window: "iup" }],
        confidence: "high",
        notes: ["print_intent_opened_certificate_window"],
      }),
      hasApiKey: false,
    });
    expect(d.route).toBe("run_prederived_now");
    expect(d.noteMessages.length).toBeGreaterThan(0);
    expect(d.shouldLogPlanSelected).toBe(true);
  });

  it("provides missing api key message", () => {
    const d = decideTurnStart({
      preDerived: mk(),
      hasApiKey: false,
    });
    expect(d.route).toBe("stop_missing_api_key");
    expect(d.missingApiKeyMessage).toMatch(/inte aktiverad/i);
  });
});

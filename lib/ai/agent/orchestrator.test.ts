import { describe, expect, it } from "vitest";
import { buildPlanCandidates, executePlanWithRetries } from "@/lib/ai/agent/orchestrator";

describe("buildPlanCandidates", () => {
  it("returns at least one candidate for multi-step plans", () => {
    const plans = buildPlanCandidates([
      { type: "open_window", window: "iup" },
      { type: "set_iup_tab", tab: "delmal" },
      { type: "summarize_goal_catalog" },
    ]);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    expect(plans[0].length).toBe(3);
  });
});

describe("executePlanWithRetries", () => {
  it("retries with remaining actions when first attempt fails", async () => {
    let calls = 0;
    const result = await executePlanWithRetries({
      initialActions: [
        { type: "open_window", window: "iup" },
        { type: "set_iup_tab", tab: "delmal" },
      ],
      maxAttempts: 3,
      runPlan: async (plan) => {
        calls += 1;
        if (calls === 1) {
          return {
            status: "failed",
            remainingActions: plan.slice(1),
          };
        }
        return { status: "ok" };
      },
    });
    expect(result.status).toBe("ok");
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});


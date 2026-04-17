import { describe, expect, it } from "vitest";
import {
  ADVANCED_AGENT_SCENARIOS,
  APP_ACTIVITY_PROMPT_SCENARIOS,
  ADVANCED_TIMELINE_SCENARIOS,
  runActivityPromptBattery,
  evaluateTimelineReleaseGate,
  runAgentCapabilityBenchmark,
} from "@/lib/ai/agent/evalHarness";

describe("runAgentCapabilityBenchmark", () => {
  it("evaluates all advanced scenarios with non-trivial score", () => {
    const summary = runAgentCapabilityBenchmark(ADVANCED_AGENT_SCENARIOS);
    expect(summary.total).toBe(10);
    expect(summary.maxScore).toBeGreaterThan(0);
    expect(summary.ratio).toBeGreaterThan(0.45);
  });

  it("returns per-scenario details", () => {
    const summary = runAgentCapabilityBenchmark([
      {
        id: "simple",
        prompt: "Synka delmål på alla kurser",
        expectsAllTypes: ["sync_course_milestones"],
      },
    ]);
    expect(summary.results).toHaveLength(1);
    expect(summary.results[0].id).toBe("simple");
    expect(Array.isArray(summary.results[0].planTypes)).toBe(true);
  });

  it("runs timeline release gate scenarios", () => {
    const summary = runAgentCapabilityBenchmark(ADVANCED_TIMELINE_SCENARIOS);
    expect(summary.total).toBeGreaterThanOrEqual(6);
    expect(summary.maxScore).toBeGreaterThan(0);
  });

  it("computes pass/fail for timeline release gate", () => {
    const gate = evaluateTimelineReleaseGate({
      scenarios: [
        {
          id: "g1",
          prompt: "Synka delmål på alla kurser",
          expectsAllTypes: ["sync_course_milestones"],
        },
      ],
      minRatio: 0.5,
      minPassedRatio: 0.5,
    });
    expect(gate.passed).toBe(true);
    expect(gate.totalScenarios).toBe(1);
  });

  it("runs broad app activity prompt battery", () => {
    const battery = runActivityPromptBattery(APP_ACTIVITY_PROMPT_SCENARIOS);
    expect(battery.summary.total).toBeGreaterThanOrEqual(20);
    expect(battery.summary.maxScore).toBeGreaterThan(0);
    expect(battery.summary.ratio).toBeGreaterThan(0.7);
    expect(Array.isArray(battery.weakScenarioIds)).toBe(true);
  });
});


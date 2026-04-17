import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPLAY_SCENARIOS,
  evaluateReplayGate,
  runReplayPack,
} from "@/lib/ai/agent/replayPack";

describe("replayPack", () => {
  it("runs default replay scenarios", () => {
    const result = runReplayPack(DEFAULT_REPLAY_SCENARIOS);
    expect(result.total).toBeGreaterThanOrEqual(5);
    expect(result.ratio).toBeGreaterThan(0.8);
  });

  it("evaluates replay gate", () => {
    const gate = evaluateReplayGate({
      scenarios: [
        {
          id: "simple-context",
          prompt: "visa aktiv kontext",
          expectedAllTypes: ["get_active_context"],
          minActions: 1,
        },
      ],
      minRatio: 0.8,
    });
    expect(gate.passed).toBe(true);
    expect(gate.failedCaseIds).toEqual([]);
  });
});

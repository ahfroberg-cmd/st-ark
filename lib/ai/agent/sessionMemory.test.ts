import { describe, expect, it } from "vitest";
import {
  createAgentSessionMemory,
  evaluateSessionGuardrails,
  fingerprintAction,
  recordAgentStep,
} from "@/lib/ai/agent/sessionMemory";
import { AGENT_DEFAULTS } from "@/lib/ai/agent/types";

describe("sessionMemory", () => {
  it("blocks after max consecutive failures", () => {
    const mem = createAgentSessionMemory("", "x");
    const acts = [
      { type: "navigate_lane" as const, lane: "placement" as const },
      { type: "open_window" as const, window: "profile" as const },
      { type: "close_window" as const, window: "profile" as const },
    ];
    for (let i = 0; i < AGENT_DEFAULTS.maxConsecutiveFailures; i += 1) {
      const act = acts[i % acts.length];
      const fp = fingerprintAction(act);
      recordAgentStep(mem, act, false);
      const g = evaluateSessionGuardrails(mem, fp);
      if (i < AGENT_DEFAULTS.maxConsecutiveFailures - 1) {
        expect(g).toEqual({ blocked: false });
      } else {
        expect(g.blocked).toBe(true);
        if (g.blocked) expect(g.reason).toMatch(/misslyckade steg i rad/);
      }
    }
  });

  it("blocks after repeated same fingerprint failures", () => {
    const mem = createAgentSessionMemory("", "x");
    const act = { type: "open_window" as const, window: "profile" as const };
    const fp = fingerprintAction(act);
    recordAgentStep(mem, act, false);
    expect(evaluateSessionGuardrails(mem, fp)).toEqual({ blocked: false });
    recordAgentStep(mem, act, false);
    const g = evaluateSessionGuardrails(mem, fp);
    expect(g.blocked).toBe(true);
  });

  it("resets consecutive failures on success", () => {
    const mem = createAgentSessionMemory("", "x");
    const bad = { type: "navigate_lane" as const, lane: "placement" as const };
    const good = { type: "open_window" as const, window: "profile" as const };
    recordAgentStep(mem, bad, false);
    recordAgentStep(mem, bad, false);
    expect(mem.consecutiveFailures).toBe(2);
    recordAgentStep(mem, good, true);
    expect(mem.consecutiveFailures).toBe(0);
  });

  it("blocks when total steps reach limit", () => {
    const mem = createAgentSessionMemory("", "x");
    const act = { type: "close_window" as const, window: "profile" as const };
    const fp = fingerprintAction(act);
    for (let i = 0; i < AGENT_DEFAULTS.maxTotalStepsPerInstruction - 1; i += 1) {
      recordAgentStep(mem, act, true);
    }
    expect(evaluateSessionGuardrails(mem, fp)).toEqual({ blocked: false });
    recordAgentStep(mem, act, true);
    expect(mem.steps.length).toBe(AGENT_DEFAULTS.maxTotalStepsPerInstruction);
    expect(evaluateSessionGuardrails(mem, fp).blocked).toBe(true);
  });
});

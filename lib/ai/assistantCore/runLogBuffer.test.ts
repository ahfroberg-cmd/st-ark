import { describe, expect, it, beforeEach } from "vitest";
import {
  appendAgentRunLogEntry,
  clearAgentRunLog,
  getAgentRunLog,
} from "@/lib/ai/assistantCore/runLogBuffer";

describe("assistantCore runLogBuffer", () => {
  beforeEach(() => {
    clearAgentRunLog();
  });

  it("stores entries with runId", () => {
    appendAgentRunLogEntry("run_a", { kind: "blocked", reason: "x" });
    const log = getAgentRunLog();
    expect(log.length).toBe(1);
    expect(log[0]?.runId).toBe("run_a");
    expect(log[0]?.event.kind).toBe("blocked");
  });

  it("clear removes buffer", () => {
    appendAgentRunLogEntry("run_b", { kind: "run_end", status: "ok" });
    clearAgentRunLog();
    expect(getAgentRunLog()).toHaveLength(0);
  });
});

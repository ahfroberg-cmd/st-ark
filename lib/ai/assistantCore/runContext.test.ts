import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createAgentRunId, withAgentRunId } from "@/lib/ai/assistantCore/runContext";
import * as telemetry from "@/lib/ai/agent/telemetry";

describe("assistantCore runContext", () => {
  beforeEach(() => {
    vi.spyOn(telemetry, "logAgentEvent").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createAgentRunId returns non-empty id", () => {
    const a = createAgentRunId();
    const b = createAgentRunId();
    expect(a.length).toBeGreaterThan(4);
    expect(a).not.toBe(b);
  });

  it("withAgentRunId attaches runId to events", () => {
    const log = withAgentRunId("run_test");
    log({ kind: "blocked", reason: "x" });
    expect(telemetry.logAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "blocked", reason: "x", runId: "run_test" })
    );
  });
});

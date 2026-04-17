type AgentTelemetryPayload =
  | { kind: "run_start"; instructionPreview: string; goalSummary?: string }
  | { kind: "plan_ready"; stepCount: number; droppedUnknown?: number }
  | {
      kind: "plan_selected";
      source: "none" | "compiler" | "hierarchical" | "local" | "llm";
      confidence: "low" | "medium" | "high";
      stepCount: number;
      notes?: string[];
    }
  | { kind: "step_start"; index: number; total: number; actionType: string }
  | { kind: "step_end"; index: number; ok: boolean; verified?: boolean }
  | { kind: "replan"; attempt: number; reason: string }
  | { kind: "blocked"; reason: string }
  | { kind: "needs_user"; question: string }
  | { kind: "run_end"; status: "ok" | "failed" | "confirm_wait" | "aborted" };

/** runId fylls i av klient-orkestratorn for att korrelera loggar for en anvandar-turn. */
export type AgentTelemetryEvent = AgentTelemetryPayload & { runId?: string };

const PREFIX = "[stark-agent]";

export function logAgentEvent(event: AgentTelemetryEvent, devOnly = true): void {
  if (devOnly && typeof process !== "undefined" && process.env.NODE_ENV === "production") {
    return;
  }
  try {
    // eslint-disable-next-line no-console
    console.info(PREFIX, event);
  } catch {
    /* ignore */
  }
}

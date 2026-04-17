import type { AgentTelemetryEvent } from "@/lib/ai/agent/telemetry";
import { logAgentEvent } from "@/lib/ai/agent/telemetry";

export function createAgentRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `run_${crypto.randomUUID()}`;
  }
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function withAgentRunId(runId: string) {
  return (event: AgentTelemetryEvent) => logAgentEvent({ ...event, runId });
}

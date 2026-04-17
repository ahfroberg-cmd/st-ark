import type { PusslaAgentAction } from "@/lib/ai/types";

export type AgentStopReason = "none" | "needs_user" | "unsupported" | "unsafe" | "blocked";

export interface AgentStepRecord {
  index: number;
  fingerprint: string;
  actionType: string;
  ok: boolean;
  at: string;
}

export interface AgentSessionMemoryState {
  goalSummary: string;
  userInstruction: string;
  steps: AgentStepRecord[];
  consecutiveFailures: number;
}

export const AGENT_DEFAULTS = {
  maxPlanReorderAttempts: 4,
  maxSameFingerprintFailures: 2,
  maxConsecutiveFailures: 3,
  maxTotalStepsPerInstruction: 40,
} as const;

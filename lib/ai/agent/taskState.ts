import type { PusslaAgentAction } from "@/lib/ai/types";
import type { RuntimeActionResult } from "@/lib/ai/agent/runtime";

export type AgentTaskItemStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

export interface AgentTaskItem {
  index: number;
  label: string;
  status: AgentTaskItemStatus;
  note?: string;
}

export interface AgentTaskState {
  items: AgentTaskItem[];
  completed: number;
  failed: number;
  inProgressIndex: number | null;
}

export function createAgentTaskState(
  actions: PusslaAgentAction[],
  labeler: (action: PusslaAgentAction) => string
): AgentTaskState {
  const items = actions.map((a, idx) => ({
    index: idx,
    label: labeler(a),
    status: "pending" as const,
  }));
  return { items, completed: 0, failed: 0, inProgressIndex: null };
}

export function markTaskInProgress(state: AgentTaskState, index: number): AgentTaskState {
  const items = state.items.map((it, i) =>
    i === index
      ? { ...it, status: "in_progress" as const }
      : it.status === "in_progress"
        ? { ...it, status: "pending" as const }
        : it
  );
  return { ...state, items, inProgressIndex: index };
}

export function markTaskOutcome(
  state: AgentTaskState,
  index: number,
  outcome: RuntimeActionResult
): AgentTaskState {
  const current = state.items[index];
  if (!current) return state;

  let status: AgentTaskItemStatus = "failed";
  if (outcome.status === "ok") {
    status = outcome.outcomeClass === "noop" ? "skipped" : "completed";
  } else if (outcome.status === "confirm") {
    status = "in_progress";
  }

  const items = state.items.map((it, i) => (i === index ? { ...it, status, note: outcome.message } : it));
  const completed = items.filter((x) => x.status === "completed" || x.status === "skipped").length;
  const failed = items.filter((x) => x.status === "failed").length;
  return {
    ...state,
    items,
    completed,
    failed,
    inProgressIndex: status === "in_progress" ? index : null,
  };
}

export function summarizeTaskState(state: AgentTaskState): string {
  const total = state.items.length;
  if (total === 0) return "";
  const pending = state.items.filter((x) => x.status === "pending" || x.status === "in_progress").length;
  if (state.failed > 0) return `Delmål: ${state.completed}/${total} klara, ${state.failed} fel`;
  if (pending === 0) return `Delmål: ${total}/${total} klara`;
  return `Delmål: ${state.completed}/${total} klara, ${pending} kvar`;
}


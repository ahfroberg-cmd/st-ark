import type { PusslaAgentAction } from "@/lib/ai/types";

export type AssistantExecutionMode = "read_only" | "write_enabled";
export type AssistantTaskType = "read_query" | "mixed" | "write_request";

export interface AssistantTaskProfile {
  taskType: AssistantTaskType;
  mode: AssistantExecutionMode;
  maxToolCalls: number;
}

const READ_ONLY_ACTIONS = new Set<PusslaAgentAction["type"]>([
  "navigate_lane",
  "open_window",
  "close_window",
  "set_iup_tab",
  "select_placement",
  "select_course",
  "summarize_goal_catalog",
  "summarize_app_sections",
  "summarize_role_views",
  "summarize_colleague_placements",
  "summarize_colleague_courses",
  "get_active_context",
  "list_timeline_entities",
  "list_internal_gaps",
  "verify_last_action_effect",
  "preview_action_diff",
  "select_collection",
]);

export function isAssistantCoreReadOnlyEnabled(): boolean {
  return String(process.env.NEXT_PUBLIC_AI_ASSISTANT_READONLY_V1 || "").trim() === "1";
}

export function classifyTaskType(params: {
  userText: string;
  actions: PusslaAgentAction[];
}): AssistantTaskType {
  const norm = String(params.userText || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const hasWriteVerb = /\b(spara|uppdatera|andra|ändra|lagg till|lägg till|ta bort|radera|synka)\b/.test(
    norm
  );
  const hasWriteAction = params.actions.some((a) => !READ_ONLY_ACTIONS.has(a.type));
  if (hasWriteVerb || hasWriteAction) return "write_request";
  if (params.actions.length >= 3) return "mixed";
  return "read_query";
}

export function buildTaskProfile(params: {
  userText: string;
  actions: PusslaAgentAction[];
  forceReadOnly: boolean;
}): AssistantTaskProfile {
  const taskType = classifyTaskType({
    userText: params.userText,
    actions: params.actions,
  });
  if (params.forceReadOnly) {
    return { taskType, mode: "read_only", maxToolCalls: 4 };
  }
  if (taskType === "read_query") return { taskType, mode: "write_enabled", maxToolCalls: 6 };
  if (taskType === "mixed") return { taskType, mode: "write_enabled", maxToolCalls: 10 };
  return { taskType, mode: "write_enabled", maxToolCalls: 12 };
}

export function gatePlanActions(params: {
  actions: PusslaAgentAction[];
  mode: AssistantExecutionMode;
  maxToolCalls: number;
}): {
  allowed: PusslaAgentAction[];
  dropped: PusslaAgentAction[];
  blockedReason: string | null;
} {
  const { actions, mode, maxToolCalls } = params;
  if (!Array.isArray(actions) || actions.length === 0) {
    return { allowed: [], dropped: [], blockedReason: null };
  }

  if (!Number.isFinite(maxToolCalls) || maxToolCalls < 1) {
    return {
      allowed: [],
      dropped: [],
      blockedReason: "Ogiltig körpolicy: maxToolCalls måste vara minst 1.",
    };
  }

  if (actions.length > maxToolCalls) {
    return {
      allowed: [],
      dropped: [],
      blockedReason: `Planen kräver ${actions.length} steg men tillåtet max är ${maxToolCalls}.`,
    };
  }

  if (mode === "write_enabled") {
    return { allowed: actions, dropped: [], blockedReason: null };
  }

  const allowed: PusslaAgentAction[] = [];
  const dropped: PusslaAgentAction[] = [];
  for (const action of actions) {
    if (READ_ONLY_ACTIONS.has(action.type)) {
      allowed.push(action);
    } else {
      dropped.push(action);
    }
  }

  if (dropped.length > 0) {
    return {
      allowed: [],
      dropped,
      blockedReason:
        "Read-only-läge är aktivt. Skrivande åtgärder stoppades och kräver separat bekräftad write-körning.",
    };
  }

  return { allowed, dropped, blockedReason: null };
}

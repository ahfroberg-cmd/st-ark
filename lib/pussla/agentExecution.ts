import type { AgentActionResult, PusslaAgentAction } from "@/lib/ai/types";
import {
  executePusslaAgentAction,
  type PusslaActionAdapter,
} from "@/lib/ai/pusslaActionExecutor";

const NON_MUTATION_ACTIONS = new Set<PusslaAgentAction["type"]>([
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

function isMutationForUndo(action: PusslaAgentAction): boolean {
  return !NON_MUTATION_ACTIONS.has(action.type);
}

export async function executeAgentActionWithTracking(params: {
  adapter: PusslaActionAdapter;
  action: PusslaAgentAction;
  captureSnapshot: () => any;
  undoStackRef: { current: any[] };
  lastEffectRef: { current: any };
  maxUndoDepth?: number;
}): Promise<AgentActionResult> {
  const before = params.captureSnapshot();
  const res = await executePusslaAgentAction(params.adapter, params.action);
  const after = params.captureSnapshot();

  if (res.ok && isMutationForUndo(params.action) && params.action.type !== "undo_last_agent_mutation") {
    const stack = params.undoStackRef.current;
    stack.push(before);
    const maxDepth = params.maxUndoDepth ?? 20;
    if (stack.length > maxDepth) stack.shift();
  }

  params.lastEffectRef.current = {
    atISO: new Date().toISOString(),
    ok: Boolean(res.ok),
    message: String(res.message || ""),
    before,
    after,
  };

  return res;
}

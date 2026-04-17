import type { PusslaAgentAction } from "@/lib/ai/types";

type ActionTier = "read" | "macro" | "middle" | "micro";

function planPriority(action: PusslaAgentAction): number {
  if (action.type === "shift_placement_from_end") return 1;
  if (action.type === "extend_last_placement") return 2;
  if (
    action.type === "create_placement_from_range" ||
    action.type === "create_typed_placement_from_range" ||
    action.type === "create_course_from_range" ||
    action.type === "create_typed_course_from_range" ||
    action.type === "convert_course_to_utbildningsmoment" ||
    action.type === "plan_st_from_sr_templates"
  ) {
    return 3;
  }
  if (action.type === "save_selected_placement" || action.type === "save_selected_course") {
    return 4;
  }
  return 5;
}

function actionTier(action: PusslaAgentAction): ActionTier {
  if (
    action.type === "summarize_goal_catalog" ||
    action.type === "summarize_app_sections" ||
    action.type === "summarize_role_views" ||
    action.type === "summarize_colleague_placements" ||
    action.type === "summarize_colleague_courses"
  ) {
    return "read";
  }
  if (
    action.type === "plan_st_from_sr_templates" ||
    action.type === "plan_courses_cover_course_milestones" ||
    action.type === "plan_timeline_distribution" ||
    action.type === "shift_all_courses" ||
    action.type === "sync_course_milestones"
  ) {
    return "macro";
  }
  if (
    action.type === "create_placement_from_range" ||
    action.type === "create_typed_placement_from_range" ||
    action.type === "create_course_from_range" ||
    action.type === "create_typed_course_from_range" ||
    action.type === "delete_placement_by_month_year" ||
    action.type === "delete_course_by_month_year" ||
    action.type === "convert_course_to_utbildningsmoment" ||
    action.type === "extend_last_placement" ||
    action.type === "shift_placement_from_end" ||
    action.type === "navigate_lane"
  ) {
    return "middle";
  }
  return "micro";
}

function orderByTiers(actions: PusslaAgentAction[], order: ActionTier[]): PusslaAgentAction[] {
  const buckets = new Map<ActionTier, PusslaAgentAction[]>();
  for (const t of order) buckets.set(t, []);
  for (const action of actions) {
    const tier = actionTier(action);
    const list = buckets.get(tier);
    if (list) list.push(action);
  }
  return order.flatMap((t) => buckets.get(t) || []);
}

export function buildPlanCandidates(actions: PusslaAgentAction[]): PusslaAgentAction[][] {
  if (actions.length <= 1) return [actions];
  const first = actions;
  const hierarchicalPrimary = orderByTiers(actions, ["read", "macro", "middle", "micro"]);
  const hierarchicalMicroFirst = orderByTiers(actions, ["read", "micro", "middle", "macro"]);
  const hierarchicalMiddleBridge = orderByTiers(actions, ["read", "middle", "micro", "macro"]);
  const byPriority = [...actions].sort((a, b) => planPriority(a) - planPriority(b));
  const reversed = [...actions].reverse();

  const uniq: PusslaAgentAction[][] = [];
  const seen = new Set<string>();
  [
    first,
    hierarchicalPrimary,
    hierarchicalMicroFirst,
    hierarchicalMiddleBridge,
    byPriority,
    reversed,
  ].forEach((plan) => {
    const key = JSON.stringify(plan);
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push(plan);
    }
  });
  return uniq;
}

export interface RunPlanResult {
  status: "ok" | "confirm" | "failed";
  message?: string;
  remainingActions?: PusslaAgentAction[];
}

export interface ExecuteWithRetriesInput {
  initialActions: PusslaAgentAction[];
  maxAttempts: number;
  skipPrimaryPlan?: boolean;
  runPlan: (actions: PusslaAgentAction[]) => Promise<RunPlanResult>;
  onAttemptStart?: (attemptIndex: number, maxAttempts: number, plan: PusslaAgentAction[]) => void;
  onAttemptFailed?: (attemptIndex: number, result: RunPlanResult) => void;
}

export async function executePlanWithRetries(
  input: ExecuteWithRetriesInput
): Promise<RunPlanResult> {
  const plans = buildPlanCandidates(input.initialActions);
  const queue = input.skipPrimaryPlan && plans.length > 1 ? plans.slice(1) : plans;
  const seen = new Set(queue.map((p) => JSON.stringify(p)));
  let attempt = 0;

  while (queue.length > 0 && attempt < input.maxAttempts) {
    const plan = queue.shift()!;
    input.onAttemptStart?.(attempt, input.maxAttempts, plan);

    const result = await input.runPlan(plan);
    if (result.status === "ok" || result.status === "confirm") {
      return result;
    }

    input.onAttemptFailed?.(attempt, result);
    const remaining = Array.isArray(result.remainingActions) ? result.remainingActions : [];
    if (remaining.length > 0) {
      const remPlans = buildPlanCandidates(remaining);
      for (const rp of remPlans) {
        const key = JSON.stringify(rp);
        if (!seen.has(key)) {
          seen.add(key);
          queue.push(rp);
        }
      }
    }
    attempt += 1;
  }

  return { status: "failed", message: "max_attempts_reached" };
}


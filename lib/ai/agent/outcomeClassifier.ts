import type { AgentActionResult, PusslaAgentAction } from "@/lib/ai/types";

export type OutcomeClass =
  | "success"
  | "noop"
  | "retryable_overlap"
  | "retryable_transient"
  | "fatal";

export function classifyActionOutcome(
  action: PusslaAgentAction,
  result: AgentActionResult
): OutcomeClass {
  if (result.ok) return "success";
  const msg = String(result.message || "").toLowerCase();
  if (
    (action.type === "delete_course_by_month_year" && /hittade ingen kurs|ingen kurs/.test(msg)) ||
    (action.type === "delete_placement_by_month_year" &&
      /hittade ingen placering|ingen placering/.test(msg))
  ) {
    return "noop";
  }
  if (
    (action.type === "extend_last_placement" || action.type === "shift_placement_from_end") &&
    /redan intill nasta placering|redan intill nästa placering|redan intill nasta block|redan intill nästa block|blev inte langre|blev inte längre|ingen andring|ingen ändring/.test(
      msg
    )
  ) {
    return "noop";
  }
  if (
    action.type === "transform_all_placements_duration" &&
    /inga placeringar andrades|inga placeringar ändrades/.test(msg)
  ) {
    return "noop";
  }
  if (/overlapp|överlapp/.test(msg)) return "retryable_overlap";
  if (/timeout|network|nätverk|tillfäll|temporar|temporär/.test(msg)) return "retryable_transient";
  return "fatal";
}


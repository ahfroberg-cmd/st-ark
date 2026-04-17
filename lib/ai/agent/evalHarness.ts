import type { PusslaAgentAction } from "@/lib/ai/types";
import { deriveExecutionPlan } from "@/lib/ai/agent/plannerEngine";

export interface AgentEvalScenario {
  id: string;
  prompt: string;
  snapshot?: unknown;
  expectsAllTypes?: PusslaAgentAction["type"][];
  expectsAnyTypes?: PusslaAgentAction["type"][];
  forbiddenTypes?: PusslaAgentAction["type"][];
  minActions?: number;
}

export interface AgentEvalResult {
  id: string;
  prompt: string;
  score: number;
  maxScore: number;
  passed: boolean;
  planTypes: string[];
  missing: string[];
  notes: string[];
}

export interface AgentEvalSummary {
  totalScore: number;
  maxScore: number;
  ratio: number;
  passed: number;
  total: number;
  results: AgentEvalResult[];
}

export interface AgentReleaseGateResult {
  passed: boolean;
  ratio: number;
  passedScenarios: number;
  totalScenarios: number;
  minRatio: number;
  minPassedRatio: number;
  failedScenarioIds: string[];
}

export interface AgentPromptBatteryResult {
  summary: AgentEvalSummary;
  weakScenarioIds: string[];
  weakByMissingTag: Array<{ tag: string; count: number }>;
}

const DEFAULT_SNAPSHOT = {
  btWindow: { startDate: "2026-01-01", endDate: "2026-12-31" },
  activities: [
    { phase: "BT", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-28T00:00:00Z" },
    { phase: "BT", exactStartISO: "2026-07-01T00:00:00Z", exactEndISO: "2026-07-31T00:00:00Z" },
    { phase: "BT", exactStartISO: "2026-12-01T00:00:00Z", exactEndISO: "2026-12-31T00:00:00Z" },
  ],
  courses: [
    { startDate: "2021-02-10" },
    { startDate: "2021-11-01" },
    { startDate: "2022-01-05" },
  ],
};

export const ADVANCED_AGENT_SCENARIOS: AgentEvalScenario[] = [
  {
    id: "bt-even-placements-sr-cert",
    prompt:
      "Lägg till fyra kliniska placeringar jämnt fördelade över min BT: vårdcentral, medicin, psykiatri och kirurgi. Lägg in förslag från studierektor och öppna BT-intyg.",
    snapshot: DEFAULT_SNAPSHOT,
    expectsAllTypes: ["create_typed_placement_from_range", "plan_st_from_sr_templates", "open_window"],
    expectsAnyTypes: ["open_window"],
    minActions: 5,
  },
  {
    id: "delete-courses-year",
    prompt: "Ta bort alla kurser för 2021",
    snapshot: DEFAULT_SNAPSHOT,
    expectsAllTypes: ["delete_course_by_month_year"],
    forbiddenTypes: ["delete_selected_course"],
    minActions: 2,
  },
  {
    id: "shift-all-placements",
    prompt: "Flytta fram alla placeringar en månad",
    snapshot: DEFAULT_SNAPSHOT,
    expectsAllTypes: ["shift_placement_from_end"],
    minActions: 2,
  },
  {
    id: "shift-all-courses",
    prompt: "Flytta alla kurser bakåt två månader",
    snapshot: DEFAULT_SNAPSHOT,
    expectsAllTypes: ["shift_all_courses"],
    minActions: 1,
  },
  {
    id: "sync-course-milestones",
    prompt: "Synka delmål på alla kurser",
    snapshot: DEFAULT_SNAPSHOT,
    expectsAllTypes: ["sync_course_milestones"],
    minActions: 1,
  },
  {
    id: "app-overview",
    prompt: "Gå igenom hela appen med sektioner och rollvyer",
    snapshot: DEFAULT_SNAPSHOT,
    expectsAllTypes: ["summarize_app_sections", "summarize_role_views"],
    minActions: 2,
  },
  {
    id: "iup-goals",
    prompt: "Öppna IUP och gå till delmål, sammanfatta målbilden",
    snapshot: DEFAULT_SNAPSHOT,
    expectsAllTypes: ["open_window", "set_iup_tab", "summarize_goal_catalog"],
    minActions: 3,
  },
  {
    id: "course-relabel",
    prompt: 'Ändra den senaste kursen "Journal club" till "Suicidologi" och spara',
    snapshot: DEFAULT_SNAPSHOT,
    expectsAllTypes: ["select_course", "update_selected_course", "save_selected_course"],
    minActions: 3,
  },
  {
    id: "safe-mode-no-destructive",
    prompt: "Visa planen och vad som saknas",
    snapshot: DEFAULT_SNAPSHOT,
    forbiddenTypes: ["delete_selected_course", "delete_selected_placement", "delete_course_by_month_year"],
    expectsAnyTypes: ["summarize_app_sections", "summarize_role_views", "summarize_goal_catalog"],
  },
  {
    id: "colleague-placements",
    prompt: "Sammanfatta kollegors beskrivningar av psykosplaceringen på 10 rader",
    snapshot: DEFAULT_SNAPSHOT,
    expectsAllTypes: ["summarize_colleague_placements"],
    minActions: 1,
  },
];

export const ADVANCED_TIMELINE_SCENARIOS: AgentEvalScenario[] = [
  {
    id: "timeline-fill-gaps",
    prompt: "Lägg in placeringar i luckorna, alla ska vara psykos slutenvård",
    snapshot: {
      activities: [
        { id: "p1", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-15T00:00:00Z" },
        { id: "p2", exactStartISO: "2026-03-01T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
      ],
    },
    expectsAllTypes: ["create_typed_placement_from_range"],
    minActions: 1,
  },
  {
    id: "timeline-repair-gaps",
    prompt: "Justera alla glapp genom att förlänga placeringar innan glappet",
    snapshot: {
      activities: [
        { id: "p1", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-15T00:00:00Z" },
        { id: "p2", exactStartISO: "2026-03-01T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
      ],
    },
    expectsAllTypes: ["extend_last_placement"],
    minActions: 1,
  },
  {
    id: "timeline-scale-duration",
    prompt: "Halvera alla placeringars längd",
    snapshot: DEFAULT_SNAPSHOT,
    expectsAllTypes: ["transform_all_placements_duration"],
    minActions: 1,
  },
  {
    id: "timeline-shift-all",
    prompt: "Flytta fram alla placeringar en månad",
    snapshot: DEFAULT_SNAPSHOT,
    expectsAllTypes: ["shift_placement_from_end"],
    minActions: 2,
  },
  {
    id: "timeline-ordinal-no-gap",
    prompt: "Förläng nästsista placeringen så att glappet fylls",
    snapshot: {
      activities: [
        { id: "p1", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-28T00:00:00Z" },
        { id: "p2", exactStartISO: "2026-03-15T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
        { id: "p3", exactStartISO: "2026-06-01T00:00:00Z", exactEndISO: "2026-07-31T00:00:00Z" },
      ],
    },
    expectsAllTypes: ["extend_last_placement"],
    minActions: 1,
  },
  {
    id: "timeline-cursor-delete-courses",
    prompt: "efter Beroendelära: ta bort varannan kurs",
    snapshot: {
      courses: [
        { id: "c1", title: "A", startDate: "2026-01-01" },
        { id: "c2", title: "Beroendelära", startDate: "2026-02-01" },
        { id: "c3", title: "C", startDate: "2026-03-01" },
        { id: "c4", title: "D", startDate: "2026-04-01" },
      ],
    },
    expectsAllTypes: ["select_collection", "apply_operator_to_collection"],
    minActions: 2,
  },
];

export const APP_ACTIVITY_PROMPT_SCENARIOS: AgentEvalScenario[] = [
  { id: "ctx-active", prompt: "visa aktiv kontext", expectsAllTypes: ["get_active_context"], minActions: 1 },
  { id: "ctx-gaps", prompt: "lista glapp i tidslinjen", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["list_internal_gaps"], minActions: 1 },
  { id: "ctx-entities-placements", prompt: "lista placeringar i tidslinjen", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["list_timeline_entities"], minActions: 1 },
  { id: "ctx-verify-last", prompt: "verifiera senaste ändringens effekt", expectsAllTypes: ["verify_last_action_effect"], minActions: 1 },
  { id: "nav-iup", prompt: "öppna iup och gå till delmål", expectsAllTypes: ["open_window", "set_iup_tab"], minActions: 2 },
  { id: "plan-fill-gaps", prompt: "lägg in placeringar i luckorna, alla ska vara psykos slutenvård", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["create_typed_placement_from_range"], minActions: 1 },
  { id: "plan-repair-gaps", prompt: "justera glappen mellan alla placeringar genom att förlänga innan luckan", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["extend_last_placement"], minActions: 1 },
  { id: "plan-scale", prompt: "halvera alla placeringars längd", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["transform_all_placements_duration"], minActions: 1 },
  { id: "plan-shift-courses", prompt: "flytta alla kurser bakåt två månader", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["shift_all_courses"], minActions: 1 },
  { id: "cursor-delete-courses", prompt: "efter Beroendelära: ta bort varannan kurs", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["select_collection", "apply_operator_to_collection"], minActions: 2 },
  { id: "cursor-delete-placements", prompt: "ta bort varannan placering", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["select_collection", "apply_operator_to_collection"], minActions: 2 },
  { id: "delete-all-courses", prompt: "ta bort alla kurser", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["select_collection", "apply_operator_to_collection"], minActions: 2 },
  { id: "delete-all-placements", prompt: "ta bort alla placeringar", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["select_collection", "apply_operator_to_collection"], minActions: 2 },
  { id: "delete-courses-in-year", prompt: "ta bort alla kurser i 2021", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["select_collection", "apply_operator_to_collection"], minActions: 2 },
  { id: "preview-delete-course", prompt: "förhandsvisa diff om du tar bort vald kurs", expectsAllTypes: ["preview_action_diff"], minActions: 1 },
  { id: "undo-agent", prompt: "ångra senaste agentändring", expectsAllTypes: ["undo_last_agent_mutation"], minActions: 1 },
  { id: "course-sync", prompt: "synka delmål på alla kurser", snapshot: DEFAULT_SNAPSHOT, expectsAllTypes: ["sync_course_milestones"], minActions: 1 },
  { id: "goal-overview", prompt: "gå igenom alla delmål och infosidor", expectsAllTypes: ["summarize_goal_catalog"], minActions: 1 },
  { id: "role-overview", prompt: "gå igenom studierektor och huvudhandledare-vyerna", expectsAllTypes: ["summarize_role_views"], minActions: 1 },
  { id: "app-overview", prompt: "gå igenom hela appen", expectsAllTypes: ["summarize_app_sections"], minActions: 1 },
  { id: "sr-master-plan", prompt: "planera en st med studierektorsmallar, kurser och placeringar", expectsAllTypes: ["plan_st_from_sr_templates"], minActions: 1 },
  { id: "course-milestone-plan", prompt: "planera metis-kurser som täcker alla kursdelmål", expectsAllTypes: ["plan_courses_cover_course_milestones"], minActions: 1 },
  { id: "safe-no-delete-without-intent", prompt: "visa planen och vad som saknas", forbiddenTypes: ["delete_selected_course", "delete_selected_placement", "apply_operator_to_collection"] },
];

function scoreScenario(s: AgentEvalScenario): AgentEvalResult {
  const derived = deriveExecutionPlan({
    userText: s.prompt,
    snapshot: s.snapshot,
  });
  const actions = derived.actions || [];
  const types = actions.map((a) => a.type);

  let score = 0;
  let max = 0;
  const missing: string[] = [];

  if (s.expectsAllTypes?.length) {
    max += s.expectsAllTypes.length;
    for (const t of s.expectsAllTypes) {
      if (types.includes(t)) score += 1;
      else missing.push(`missing:${t}`);
    }
  }
  if (s.expectsAnyTypes?.length) {
    max += 1;
    if (s.expectsAnyTypes.some((t) => types.includes(t))) score += 1;
    else missing.push(`missing:any(${s.expectsAnyTypes.join("|")})`);
  }
  if (typeof s.minActions === "number") {
    max += 1;
    if (actions.length >= s.minActions) score += 1;
    else missing.push(`too_few_actions:${actions.length}<${s.minActions}`);
  }
  if (s.forbiddenTypes?.length) {
    max += s.forbiddenTypes.length;
    for (const t of s.forbiddenTypes) {
      if (!types.includes(t)) score += 1;
      else missing.push(`forbidden:${t}`);
    }
  }

  const passed = score === max;
  return {
    id: s.id,
    prompt: s.prompt,
    score,
    maxScore: max,
    passed,
    planTypes: types,
    missing,
    notes: derived.notes || [],
  };
}

export function runAgentCapabilityBenchmark(
  scenarios: AgentEvalScenario[] = ADVANCED_AGENT_SCENARIOS
): AgentEvalSummary {
  const results = scenarios.map(scoreScenario);
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const maxScore = results.reduce((sum, r) => sum + r.maxScore, 0);
  const passed = results.filter((r) => r.passed).length;
  return {
    totalScore,
    maxScore,
    ratio: maxScore > 0 ? totalScore / maxScore : 0,
    passed,
    total: results.length,
    results,
  };
}

export function evaluateTimelineReleaseGate(options?: {
  scenarios?: AgentEvalScenario[];
  minRatio?: number;
  minPassedRatio?: number;
}): AgentReleaseGateResult {
  const scenarios = options?.scenarios || ADVANCED_TIMELINE_SCENARIOS;
  const minRatio = options?.minRatio ?? 0.9;
  const minPassedRatio = options?.minPassedRatio ?? 0.85;
  const summary = runAgentCapabilityBenchmark(scenarios);
  const passedRatio = summary.total > 0 ? summary.passed / summary.total : 0;
  const failedScenarioIds = summary.results.filter((r) => !r.passed).map((r) => r.id);
  return {
    passed: summary.ratio >= minRatio && passedRatio >= minPassedRatio,
    ratio: summary.ratio,
    passedScenarios: summary.passed,
    totalScenarios: summary.total,
    minRatio,
    minPassedRatio,
    failedScenarioIds,
  };
}

export function runActivityPromptBattery(
  scenarios: AgentEvalScenario[] = APP_ACTIVITY_PROMPT_SCENARIOS
): AgentPromptBatteryResult {
  const summary = runAgentCapabilityBenchmark(scenarios);
  const weakScenarioIds = summary.results.filter((r) => !r.passed).map((r) => r.id);
  const tagCounts: Record<string, number> = {};
  for (const r of summary.results) {
    if (r.passed) continue;
    for (const miss of r.missing) {
      const tag = miss.split(":")[0] || "unknown";
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const weakByMissingTag = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  return { summary, weakScenarioIds, weakByMissingTag };
}


import type { PusslaAgentAction } from "@/lib/ai/types";
import { deriveExecutionPlan } from "@/lib/ai/agent/plannerEngine";

export interface ReplayScenario {
  id: string;
  prompt: string;
  snapshot?: unknown;
  expectedAnyTypes?: PusslaAgentAction["type"][];
  expectedAllTypes?: PusslaAgentAction["type"][];
  forbiddenTypes?: PusslaAgentAction["type"][];
  minActions?: number;
}

export interface ReplayCaseResult {
  id: string;
  passed: boolean;
  score: number;
  maxScore: number;
  planTypes: PusslaAgentAction["type"][];
  missing: string[];
  notes: string[];
}

export interface ReplayRunResult {
  ratio: number;
  passed: number;
  total: number;
  cases: ReplayCaseResult[];
}

export interface ReplayGateResult {
  passed: boolean;
  ratio: number;
  minRatio: number;
  failedCaseIds: string[];
}

export const DEFAULT_REPLAY_SCENARIOS: ReplayScenario[] = [
  {
    id: "replay-nastsista-gap",
    prompt: "förläng den nästsista placeringen så att den fyller glappet framåt",
    snapshot: {
      activities: [
        { id: "p1", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-28T00:00:00Z" },
        { id: "p2", exactStartISO: "2026-03-15T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
        { id: "p3", exactStartISO: "2026-06-01T00:00:00Z", exactEndISO: "2026-07-31T00:00:00Z" },
      ],
    },
    expectedAllTypes: ["extend_last_placement"],
    minActions: 1,
  },
  {
    id: "replay-half-duration",
    prompt: "halvera alla placeringars längd, ta bort andra halvan",
    snapshot: {
      activities: [
        { id: "p1", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-03-31T00:00:00Z" },
        { id: "p2", exactStartISO: "2026-04-01T00:00:00Z", exactEndISO: "2026-06-30T00:00:00Z" },
      ],
    },
    expectedAllTypes: ["transform_all_placements_duration"],
    minActions: 1,
  },
  {
    id: "replay-fill-gaps-typed",
    prompt: "lägg in placeringar i luckorna: alla ska vara psykos slutenvård",
    snapshot: {
      activities: [
        { id: "p1", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-15T00:00:00Z" },
        { id: "p2", exactStartISO: "2026-03-01T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
      ],
    },
    expectedAllTypes: ["create_typed_placement_from_range"],
    minActions: 1,
  },
  {
    id: "replay-delete-every-other-after-anchor",
    prompt: "efter Beroendelära: ta bort varannan kurs",
    snapshot: {
      courses: [
        { id: "c1", title: "A", startDate: "2026-01-01" },
        { id: "c2", title: "Beroendelära", startDate: "2026-02-01" },
        { id: "c3", title: "C", startDate: "2026-03-01" },
        { id: "c4", title: "D", startDate: "2026-04-01" },
      ],
    },
    expectedAllTypes: ["select_collection", "apply_operator_to_collection"],
    minActions: 2,
  },
  {
    id: "replay-preview-delete",
    prompt: "förhandsvisa diff om du tar bort vald kurs",
    expectedAllTypes: ["preview_action_diff"],
    forbiddenTypes: ["delete_selected_course"],
    minActions: 1,
  },
];

function scoreReplayCase(s: ReplayScenario): ReplayCaseResult {
  const plan = deriveExecutionPlan({
    userText: s.prompt,
    snapshot: s.snapshot,
  });
  const types = plan.actions.map((a) => a.type);
  let score = 0;
  let max = 0;
  const missing: string[] = [];

  if (s.expectedAllTypes?.length) {
    max += s.expectedAllTypes.length;
    for (const t of s.expectedAllTypes) {
      if (types.includes(t)) score += 1;
      else missing.push(`missing:${t}`);
    }
  }
  if (s.expectedAnyTypes?.length) {
    max += 1;
    if (s.expectedAnyTypes.some((t) => types.includes(t))) score += 1;
    else missing.push(`missing:any(${s.expectedAnyTypes.join("|")})`);
  }
  if (s.forbiddenTypes?.length) {
    max += s.forbiddenTypes.length;
    for (const t of s.forbiddenTypes) {
      if (!types.includes(t)) score += 1;
      else missing.push(`forbidden:${t}`);
    }
  }
  if (typeof s.minActions === "number") {
    max += 1;
    if (plan.actions.length >= s.minActions) score += 1;
    else missing.push(`too_few_actions:${plan.actions.length}<${s.minActions}`);
  }

  return {
    id: s.id,
    passed: score === max,
    score,
    maxScore: max,
    planTypes: types,
    missing,
    notes: plan.notes,
  };
}

export function runReplayPack(
  scenarios: ReplayScenario[] = DEFAULT_REPLAY_SCENARIOS
): ReplayRunResult {
  const cases = scenarios.map(scoreReplayCase);
  const totalScore = cases.reduce((sum, c) => sum + c.score, 0);
  const totalMax = cases.reduce((sum, c) => sum + c.maxScore, 0);
  const passed = cases.filter((c) => c.passed).length;
  return {
    ratio: totalMax > 0 ? totalScore / totalMax : 0,
    passed,
    total: cases.length,
    cases,
  };
}

export function evaluateReplayGate(options?: {
  scenarios?: ReplayScenario[];
  minRatio?: number;
}): ReplayGateResult {
  const minRatio = options?.minRatio ?? 0.9;
  const run = runReplayPack(options?.scenarios || DEFAULT_REPLAY_SCENARIOS);
  return {
    passed: run.ratio >= minRatio,
    ratio: run.ratio,
    minRatio,
    failedCaseIds: run.cases.filter((c) => !c.passed).map((c) => c.id),
  };
}

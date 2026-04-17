import type { PusslaAgentAction } from "@/lib/ai/types";
import type { ConstraintIR, IntentIR, LoweredPlanIR, TaskGraphIR, TaskNodeIR } from "@/lib/ai/agent/plannerIr";

interface TimelinePlacement {
  id: string;
  startDate: string;
  endDate: string;
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function collectTimelinePlacements(snapshot: unknown): TimelinePlacement[] {
  const rows = Array.isArray((snapshot as any)?.activities) ? (snapshot as any).activities : [];
  const out: TimelinePlacement[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const startDate = toIsoDate(row?.exactStartISO) || toIsoDate(row?.startDate);
    const endDate = toIsoDate(row?.exactEndISO) || toIsoDate(row?.endDate);
    if (!startDate || !endDate) continue;
    const idRaw = typeof row?.id === "string" ? row.id : "";
    out.push({ id: idRaw || `placement:${i}:${startDate}:${endDate}`, startDate, endDate });
  }
  return out;
}

function buildTimelineGapConstraints(snapshot: unknown): ConstraintIR[] {
  const placements = collectTimelinePlacements(snapshot).sort((a, b) =>
    a.startDate === b.startDate
      ? a.endDate.localeCompare(b.endDate)
      : a.startDate.localeCompare(b.startDate)
  );
  const constraints: ConstraintIR[] = [];
  for (let i = 0; i < placements.length - 1; i += 1) {
    const a = placements[i];
    const b = placements[i + 1];
    const gapStart = addDaysIso(a.endDate, 1);
    const gapEnd = addDaysIso(b.startDate, -1);
    if (gapStart <= gapEnd) {
      constraints.push({
        id: `gap:${i}`,
        kind: "timeline_gap",
        payload: { beforeId: a.id, startDate: gapStart, endDate: gapEnd },
      });
    }
  }
  return constraints;
}

function positionFromEndById(snapshot: unknown): Map<string, number> {
  const placements = collectTimelinePlacements(snapshot).sort((a, b) =>
    a.endDate === b.endDate ? b.startDate.localeCompare(a.startDate) : b.endDate.localeCompare(a.endDate)
  );
  const map = new Map<string, number>();
  placements.forEach((p, idx) => map.set(p.id, idx + 1));
  return map;
}

export function buildTaskGraphFromIntent(intent: IntentIR, snapshot: unknown): TaskGraphIR {
  const constraints: ConstraintIR[] = [];
  const nodes: TaskNodeIR[] = [{ id: "goal", kind: "goal", label: intent.operation }];

  if (intent.domain === "timeline" && /gap/.test(intent.operation)) {
    constraints.push(...buildTimelineGapConstraints(snapshot));
    nodes.push({ id: "subgoal:resolve-gaps", kind: "subgoal", label: "Resolve timeline gaps" });
  }
  if (intent.domain === "timeline" && intent.operation === "timeline.scale_duration") {
    nodes.push({ id: "subgoal:scale", kind: "subgoal", label: "Scale durations for all placements" });
  }
  if (intent.domain === "courses") {
    nodes.push({ id: "subgoal:courses", kind: "subgoal", label: "Course planning pipeline" });
  }
  if (intent.domain === "iup") {
    nodes.push({ id: "subgoal:iup", kind: "subgoal", label: "IUP navigation pipeline" });
  }

  return {
    goalSummary: String(intent.params.goalSummary || intent.operation),
    intent,
    constraints,
    nodes,
    notes: [`task_graph:${intent.domain}`],
  };
}

export function lowerTaskGraphToActions(graph: TaskGraphIR, snapshot: unknown): LoweredPlanIR {
  const intent = graph.intent;
  const params = intent.params || {};
  const confidence = intent.confidence || "medium";

  if (intent.domain === "timeline" && intent.operation === "timeline.fill_gaps_with_placements") {
    const label = String(params.label || "Klinisk tjänstgöring");
    const gaps = graph.constraints.filter((c) => c.kind === "timeline_gap");
    if (gaps.length === 0) {
      return {
        goalSummary: graph.goalSummary,
        actions: [],
        confidence: "medium",
        clarifyingQuestion: "Jag hittar inga interna luckor mellan befintliga placeringar just nu.",
        notes: [...graph.notes, "lower:no_gaps"],
      };
    }
    const actions: PusslaAgentAction[] = gaps.map((g) => {
      const p = g.payload as any;
      return {
        type: "create_typed_placement_from_range",
        placementType: "Klinisk tjänstgöring",
        title: label,
        startDate: p.startDate,
        endDate: p.endDate,
      };
    });
    return { goalSummary: graph.goalSummary, actions, confidence, notes: [...graph.notes, "lower:fill_gaps"] };
  }

  if (intent.domain === "timeline" && intent.operation === "timeline.repair_gaps_by_extending_preceding") {
    const gaps = graph.constraints.filter((c) => c.kind === "timeline_gap");
    if (gaps.length === 0) {
      return {
        goalSummary: graph.goalSummary,
        actions: [],
        confidence: "medium",
        clarifyingQuestion: "Jag hittar inga interna luckor mellan befintliga placeringar just nu.",
        notes: [...graph.notes, "lower:no_gaps"],
      };
    }
    const posById = positionFromEndById(snapshot);
    const actions: PusslaAgentAction[] = [];
    for (const gap of gaps) {
      const p = gap.payload as any;
      const pos = posById.get(String(p.beforeId || ""));
      if (!pos) continue;
      actions.push({
        type: "extend_last_placement",
        positionFromEnd: pos,
        endDate: String(p.endDate),
      });
    }
    return { goalSummary: graph.goalSummary, actions, confidence, notes: [...graph.notes, "lower:repair_gaps"] };
  }

  if (intent.domain === "timeline" && intent.operation === "timeline.scale_duration") {
    const factor = Number(params.factor || 0.5);
    const anchor = params.anchor === "end" ? "end" : "start";
    return {
      goalSummary: graph.goalSummary,
      actions: [{ type: "transform_all_placements_duration", factor, anchor }],
      confidence,
      notes: [...graph.notes, "lower:scale_duration"],
    };
  }

  if (intent.domain === "courses" && intent.operation === "courses.cover_distribute_sync") {
    const targetCount = Number(params.targetCount || 0) || undefined;
    const cadence = (params.cadence as any) || null;
    const itemsPerCadence = Number(params.itemsPerCadence || 0) || undefined;
    const actions: PusslaAgentAction[] = [
      {
        type: "plan_courses_cover_course_milestones",
        ...(targetCount ? { targetCount } : {}),
      },
    ];
    if (cadence) {
      actions.push({
        type: "plan_timeline_distribution",
        target: "courses",
        cadence,
        itemsPerCadence: Math.max(1, Math.min(12, itemsPerCadence || 2)),
      });
    }
    actions.push({ type: "sync_course_milestones" });
    return { goalSummary: graph.goalSummary, actions, confidence, notes: [...graph.notes, "lower:courses"] };
  }

  if (intent.domain === "iup" && intent.operation === "iup.open_tab_summary") {
    const tab = (params.tab as any) || "delmal";
    const includeSummary = Boolean(params.includeSummary);
    const actions: PusslaAgentAction[] = [
      { type: "open_window", window: "iup" },
      { type: "set_iup_tab", tab },
    ];
    if (includeSummary && tab === "delmal") actions.push({ type: "summarize_goal_catalog" });
    return { goalSummary: graph.goalSummary, actions, confidence, notes: [...graph.notes, "lower:iup"] };
  }

  return {
    goalSummary: graph.goalSummary,
    actions: [],
    confidence: "low",
    clarifyingQuestion: "Jag kunde inte översätta målet till en exekverbar plan ännu.",
    notes: [...graph.notes, "lower:unsupported"],
  };
}

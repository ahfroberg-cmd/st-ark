type RowLike = Record<string, any>;

type PlacementMapHelpers = {
  effectiveStartYear: number;
  dateToISO: (date: Date) => string;
  dateToSlot: (startYear: number, iso: string, edge: "start" | "end") => number;
  nextHue: (index: number) => number;
  inferPhaseByBT: (startISO?: string, endISO?: string) => "BT" | "ST";
};

export function mapLockedPlacementsToActivities(rows: RowLike[], helpers: PlacementMapHelpers): RowLike[] {
  const { effectiveStartYear, dateToISO, dateToSlot, nextHue, inferPhaseByBT } = helpers;
  return (rows || [])
    .filter((p) => p?.showOnTimeline !== false)
    .map((p, i) => {
      const startISO: string =
        typeof p.startDate === "string" ? p.startDate : p.startDate instanceof Date ? dateToISO(p.startDate) : "";
      const endISO: string =
        typeof p.endDate === "string" ? p.endDate : p.endDate instanceof Date ? dateToISO(p.endDate) : "";

      let start = startISO ? dateToSlot(effectiveStartYear, startISO, "start") : 0;
      let endBoundary = endISO ? dateToSlot(effectiveStartYear, endISO, "end") : start;
      if (!Number.isFinite(start)) start = 0;
      if (!Number.isFinite(endBoundary)) endBoundary = start;

      let len = Math.max(1, endBoundary - start);
      if (!Number.isFinite(len) || len <= 0) len = 1;

      const phaseFromDb = p?.phase as "BT" | "ST" | undefined;
      const phase = phaseFromDb || inferPhaseByBT(startISO || undefined, endISO || undefined);

      return {
        id: `pl_${p.id}`,
        type: p.type || "Klinisk tjänstgöring",
        label: p.clinic || undefined,
        startSlot: start,
        lengthSlots: len,
        hue: nextHue(i),
        linkedPlacementId: p.id,
        exactStartISO: startISO || undefined,
        exactEndISO: endISO || undefined,
        attendance: typeof p.attendance === "number" ? p.attendance : 100,
        supervisor: p.supervisor || "",
        supervisorSpeciality: p.supervisorSpeciality || "",
        supervisorSite: p.supervisorSite || "",
        note: p.note || "",
        leaveSubtype: p.leaveSubtype || "",
        phase,
        btAssessment: p?.btAssessment || "",
        btMilestones: p?.btMilestones || [],
        stMilestones: p?.stMilestones || [],
        stGoalIds: p?.stGoalIds || [],
        milestones: p?.milestones || p?.stMilestones || p?.stGoalIds || [],
        fulfillsStGoals: !!p?.fulfillsStGoals,
        intygGroup: (() => {
          const v = p?.intygGroup ?? p?.intyg_group;
          return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;
        })(),
        intygGroupConfig: p?.intygGroupConfig ?? p?.intyg_group_config ?? null,
      };
    });
}

export function mapLockedCoursesToTimeline(
  rows: RowLike[],
  phaseForCourseDates: (startISO: string) => "BT" | "ST"
): RowLike[] {
  return (rows || [])
    .filter((c) => c?.showOnTimeline !== false)
    .map((c) => {
      const startISO: string = c.startDate || c.certificateDate || c.endDate || "";
      const phaseFromDb = c?.phase as "BT" | "ST" | undefined;
      const phase: "BT" | "ST" = phaseFromDb || phaseForCourseDates(startISO);

      return {
        id: `cr_${c.id}`,
        title: c.title || "",
        certificateDate: c.certificateDate || "",
        kind: c.kind || "Kurs",
        linkedCourseId: c.id,
        city: c.city || "",
        courseLeaderName: c.courseLeaderName || "",
        startDate: c.startDate || "",
        endDate: c.endDate || "",
        note: c.note || "",
        phase,
        btAssessment: c?.btAssessment || "",
        btMilestones: c?.btMilestones || [],
        fulfillsStGoals: !!c?.fulfillsStGoals,
        milestones: c?.milestones || [],
        showAsInterval: typeof c?.showAsInterval === "boolean" ? !!c.showAsInterval : undefined,
        courseTitle: c?.courseTitle || undefined,
      };
    });
}

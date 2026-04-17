type RowLike = Record<string, any>;

type MergeActivitiesOptions = {
  lockedActivities: RowLike[];
  draftActivities: RowLike[];
  profile: RowLike;
  stStartISO: string | null | undefined;
  effectiveStartYear: number;
  isValidISO: (iso: string) => boolean;
  dateToSlot: (startYear: number, iso: string, edge: "start" | "end") => number;
  slotToYearMonthHalf: (startYear: number, slot: number) => { year: number; month0: number; half: number };
  mondayNearestTo: (year: number, month0: number, day: number) => Date;
  dateToISO: (date: Date) => string;
};

export function inferPlacementPhaseByProfileBt(
  profile: RowLike,
  stStartISO: string | null | undefined,
  startISO?: string
): "BT" | "ST" {
  const goals = String(profile?.goalsVersion || "").trim();
  if (goals !== "2021") return "ST";

  const bt = profile?.btStartDate || null;
  const st = stStartISO || profile?.stStartDate || null;
  if (!(bt && st && startISO)) return "ST";

  const sMs = new Date(startISO + "T00:00:00").getTime();
  const btMs = new Date(bt + "T00:00:00").getTime();
  const stMs = new Date(st + "T00:00:00").getTime();
  if (!Number.isFinite(sMs) || !Number.isFinite(btMs) || !Number.isFinite(stMs)) return "ST";
  return sMs >= btMs && sMs < stMs ? "BT" : "ST";
}

export function mergeLockedActivitiesWithDraft(options: MergeActivitiesOptions): RowLike[] {
  const {
    lockedActivities,
    draftActivities,
    profile,
    stStartISO,
    effectiveStartYear,
    isValidISO,
    dateToSlot,
    slotToYearMonthHalf,
    mondayNearestTo,
    dateToISO,
  } = options;

  const withPhaseActs = (lockedActivities || []).map((a: any) => {
    const s = slotToYearMonthHalf(effectiveStartYear, a.startSlot);
    const startD = mondayNearestTo(s.year, s.month0, s.half === 0 ? 1 : 15);
    const startISO = dateToISO(startD);
    return { ...a, phase: inferPlacementPhaseByProfileBt(profile, stStartISO, startISO) };
  });

  return withPhaseActs.map((a: any) => {
    const match = (draftActivities || []).find((d: any) =>
      d?.linkedPlacementId ? d.linkedPlacementId === a?.linkedPlacementId : d?.id === a?.id
    );
    if (!match) return a;
    const m: any = match;
    const isPersistedPlacement = !!a?.linkedPlacementId;

    const nextExactStartISO = isPersistedPlacement
      ? a?.exactStartISO
      : typeof m.exactStartISO === "string"
        ? m.exactStartISO
        : a?.exactStartISO;
    const nextExactEndISO = isPersistedPlacement
      ? a?.exactEndISO
      : typeof m.exactEndISO === "string"
        ? m.exactEndISO
        : a?.exactEndISO;

    let nextStartSlot = isPersistedPlacement ? a?.startSlot : typeof m.startSlot === "number" ? m.startSlot : a?.startSlot;
    let nextLengthSlots = isPersistedPlacement
      ? a?.lengthSlots
      : typeof m.lengthSlots === "number"
        ? m.lengthSlots
        : a?.lengthSlots;

    if (isValidISO(nextExactStartISO) && isValidISO(nextExactEndISO)) {
      const s = dateToSlot(effectiveStartYear, nextExactStartISO, "start");
      const e = dateToSlot(effectiveStartYear, nextExactEndISO, "end");
      if (Number.isFinite(s) && Number.isFinite(e)) {
        nextStartSlot = s;
        nextLengthSlots = Math.max(1, e - s + 1);
      }
    }

    return {
      ...a,
      type: isPersistedPlacement ? a.type : m.type ?? a.type,
      label: isPersistedPlacement ? a.label : m.label ?? a.label,
      startSlot: nextStartSlot,
      lengthSlots: nextLengthSlots,
      attendance: !isPersistedPlacement && typeof m.attendance === "number" ? m.attendance : a?.attendance,
      hue: !isPersistedPlacement && typeof m.hue === "number" ? m.hue : a?.hue,
      phase: isPersistedPlacement ? a?.phase : m.phase || a?.phase,
      exactStartISO: nextExactStartISO || a?.exactStartISO,
      exactEndISO: nextExactEndISO || a?.exactEndISO,
      supervisor: isPersistedPlacement ? a?.supervisor : m.supervisor ?? a?.supervisor,
      supervisorSpeciality: isPersistedPlacement ? a?.supervisorSpeciality : m.supervisorSpeciality ?? a?.supervisorSpeciality,
      supervisorSite: isPersistedPlacement ? a?.supervisorSite : m.supervisorSite ?? a?.supervisorSite,
      note: isPersistedPlacement ? a?.note : m.note ?? a?.note,
      leaveSubtype: isPersistedPlacement ? a?.leaveSubtype : m.leaveSubtype ?? a?.leaveSubtype,
      btAssessment: isPersistedPlacement ? a?.btAssessment : m.btAssessment ?? a?.btAssessment,
      btMilestones: !isPersistedPlacement && Array.isArray(m.btMilestones) ? m.btMilestones : a?.btMilestones,
      stMilestones: !isPersistedPlacement && Array.isArray(m.stMilestones) ? m.stMilestones : a?.stMilestones,
      stGoalIds: !isPersistedPlacement && Array.isArray(m.stGoalIds) ? m.stGoalIds : a?.stGoalIds,
      milestones: !isPersistedPlacement && Array.isArray(m.milestones) ? m.milestones : a?.milestones,
      fulfillsStGoals:
        !isPersistedPlacement && typeof m.fulfillsStGoals === "boolean" ? m.fulfillsStGoals : a?.fulfillsStGoals,
    };
  });
}

export function mergeLockedCoursesWithDraft(lockedCourses: RowLike[], draftCourses: RowLike[]): RowLike[] {
  return (lockedCourses || []).map((c: any) => {
    const match = (draftCourses || []).find((d: any) =>
      d?.linkedCourseId ? d.linkedCourseId === c?.linkedCourseId : d?.id === c?.id
    );
    if (!match) return c;
    const m: any = match;
    return {
      ...c,
      title: m.title ?? c.title,
      certificateDate: m.certificateDate ?? c.certificateDate,
      kind: m.kind ?? c.kind,
      startDate: m.startDate ?? c.startDate,
      endDate: m.endDate ?? c.endDate,
      city: m.city ?? c.city,
      courseLeaderName: m.courseLeaderName ?? c.courseLeaderName,
      note: m.note ?? c.note,
      phase: m.phase || c.phase,
      btAssessment: m.btAssessment ?? c.btAssessment,
      btMilestones: Array.isArray(m.btMilestones) ? m.btMilestones : c.btMilestones,
      milestones: Array.isArray(m.milestones) ? m.milestones : c.milestones,
      fulfillsStGoals: typeof m.fulfillsStGoals === "boolean" ? m.fulfillsStGoals : c.fulfillsStGoals,
    };
  });
}

export function pickDraftOnlyActivities(draftActivities: RowLike[], mergedActivities: RowLike[]): RowLike[] {
  return (draftActivities || []).filter((d: any) => {
    const hasLinked = d?.linkedPlacementId
      ? (mergedActivities || []).some((a: any) => a?.linkedPlacementId === d.linkedPlacementId)
      : (mergedActivities || []).some((a: any) => a?.id === d?.id);
    return !hasLinked;
  });
}

export function pickDraftOnlyCourses(draftCourses: RowLike[], mergedCourses: RowLike[]): RowLike[] {
  return (draftCourses || []).filter((d: any) => {
    const hasLinked = d?.linkedCourseId
      ? (mergedCourses || []).some((c: any) => c?.linkedCourseId === d.linkedCourseId)
      : (mergedCourses || []).some((c: any) => c?.id === d?.id);
    return !hasLinked;
  });
}

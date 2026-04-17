type RowLike = Record<string, any>;
type RecordLike = Record<string, any>;

export function buildPlacementSupabaseRecord(record: RecordLike, userId: string): RowLike {
  return {
    user_id: userId,
    type: record.type || "",
    clinic: record.clinic || "",
    title: record.title || "",
    start_date: record.startDate || null,
    end_date: record.endDate || null,
    attendance: record.attendance ?? 100,
    supervisor: record.supervisor || "",
    supervisor_specialty: record.supervisorSpeciality || "",
    supervisor_site: record.supervisorSite || "",
    note: record.note || "",
    bt_assessment: record.btAssessment || "",
    bt_milestones: record.btMilestones || [],
    milestones: record.milestones || [],
    fulfills_st_goals: !!record.fulfillsStGoals,
    intyg_group: record.intygGroup,
    intyg_group_config: record.intygGroupConfig ?? null,
    phase: record.phase || "ST",
    show_on_timeline: record.showOnTimeline !== false,
    updated_at: new Date().toISOString(),
  };
}

export function buildCourseSupabaseRecord(record: RecordLike, userId: string): RowLike {
  return {
    user_id: userId,
    title: record.title || "",
    kind: record.kind || "Kurs",
    city: record.city || "",
    course_leader_name: record.courseLeaderName || "",
    start_date: record.startDate || null,
    end_date: record.endDate || null,
    certificate_date: record.certificateDate || null,
    note: record.note || "",
    course_title: record.courseTitle || null,
    bt_assessment: record.btAssessment || "",
    bt_milestones: record.btMilestones || [],
    milestones: record.milestones || [],
    fulfills_st_goals: !!record.fulfillsStGoals,
    phase: record.phase || "ST",
    show_as_interval: !!record.showAsInterval,
    show_on_timeline: record.showOnTimeline !== false,
    updated_at: new Date().toISOString(),
  };
}

export function mapPlacementRowForList(savedPlacement: RowLike): RowLike {
  const ig = savedPlacement.intyg_group ?? savedPlacement.intygGroup;
  return {
    id: savedPlacement.id,
    type: savedPlacement.type || "",
    clinic: savedPlacement.clinic || "",
    title: savedPlacement.title || "",
    startDate: savedPlacement.start_date || "",
    endDate: savedPlacement.end_date || "",
    attendance: savedPlacement.attendance ?? 100,
    supervisor: savedPlacement.supervisor || "",
    supervisorSpeciality: savedPlacement.supervisor_specialty || "",
    supervisorSite: savedPlacement.supervisor_site || "",
    note: savedPlacement.note || "",
    btAssessment: savedPlacement.bt_assessment || "",
    btMilestones: savedPlacement.bt_milestones || [],
    milestones: savedPlacement.milestones || [],
    fulfillsStGoals: !!savedPlacement.fulfills_st_goals,
    phase: savedPlacement.phase,
    showOnTimeline: savedPlacement.show_on_timeline !== false,
    intygGroup: Number.isFinite(Number(ig)) && Number(ig) > 0 ? Number(ig) : null,
    intygGroupConfig: savedPlacement.intyg_group_config ?? savedPlacement.intygGroupConfig ?? null,
  };
}

export function mapPlacementRowForDb(savedPlacement: RowLike): RowLike {
  const ig = savedPlacement.intyg_group ?? savedPlacement.intygGroup;
  return {
    ...savedPlacement,
    intygGroup: Number.isFinite(Number(ig)) && Number(ig) > 0 ? Number(ig) : null,
    intygGroupConfig: savedPlacement.intyg_group_config ?? savedPlacement.intygGroupConfig ?? null,
    leaveSubtype: savedPlacement.leave_subtype || "",
    startDate: savedPlacement.start_date,
    endDate: savedPlacement.end_date,
    btMilestones: savedPlacement.bt_milestones || [],
    milestones: savedPlacement.milestones || [],
  };
}

export function mapCourseRowForList(savedCourse: RowLike): RowLike {
  return {
    id: savedCourse.id,
    title: savedCourse.title || "",
    kind: savedCourse.kind || "Kurs",
    city: savedCourse.city || "",
    courseLeaderName: savedCourse.course_leader_name || "",
    startDate: savedCourse.start_date || "",
    endDate: savedCourse.end_date || "",
    certificateDate: savedCourse.certificate_date || "",
    note: savedCourse.note || "",
    courseTitle: savedCourse.course_title || undefined,
    btAssessment: savedCourse.bt_assessment || "",
    btMilestones: savedCourse.bt_milestones || [],
    milestones: savedCourse.milestones || [],
    fulfillsStGoals: !!savedCourse.fulfills_st_goals,
    phase: savedCourse.phase,
    showAsInterval: !!savedCourse.show_as_interval,
    showOnTimeline: savedCourse.show_on_timeline !== false,
  };
}

export function mapCourseRowForDb(savedCourse: RowLike): RowLike {
  return {
    ...savedCourse,
    startDate: savedCourse.start_date,
    endDate: savedCourse.end_date,
    certificateDate: savedCourse.certificate_date,
    btMilestones: savedCourse.bt_milestones || [],
    milestones: savedCourse.milestones || [],
  };
}

export function mapAchievementRow(savedAchievement: RowLike): RowLike {
  return {
    id: savedAchievement.id,
    placementId: savedAchievement.placement_id || undefined,
    courseId: savedAchievement.course_id || undefined,
    milestoneId: savedAchievement.milestone_id || "",
    goalId: savedAchievement.goal_id || undefined,
    code: savedAchievement.code || undefined,
    milestone: savedAchievement.milestone || undefined,
    date: savedAchievement.date || "",
  };
}

export function upsertById<T extends { id: string }>(prev: T[], item: T): T[] {
  const idx = prev.findIndex((x) => x.id === item.id);
  if (idx < 0) return [...prev, item];
  const next = [...prev];
  next[idx] = item;
  return next;
}

export interface SupervisorStudent {
  id: string;
  name: string;
  personnummer: string;
  specialty: string;
  goalsVersion: "2015" | "2021";
  importedAt: string;
  lastUpdated: string;
  profile: any;
  placements: any[];
  courses: any[];
  achievements: any[];
  timeline?: any[];
  iupMilestonePlans?: any[];
  iupSettings?: any;
  /** True om studierektor flyttat personen till tidigare ST-läkare (clinic_memberships.former_st_lakare). */
  formerStLakare?: boolean;
  /** Rad-id i clinic_memberships för uppdatering av former_st_lakare. */
  clinicMembershipId?: string;
}

export function mapPlacementRow(pl: any) {
  return {
    id: pl.id,
    type: pl.type || "",
    clinic: pl.clinic || "",
    title: pl.title || "",
    startDate: pl.start_date || "",
    endDate: pl.end_date || "",
    attendance: pl.attendance ?? 100,
    supervisor: pl.supervisor || "",
    supervisorSpeciality: pl.supervisor_specialty || "",
    supervisorSite: pl.supervisor_site || "",
    note: pl.note || "",
    btAssessment: pl.bt_assessment || "",
    btMilestones: pl.bt_milestones || [],
    milestones: pl.milestones || [],
    fulfillsStGoals: !!pl.fulfills_st_goals,
    phase: pl.phase,
    showOnTimeline: pl.show_on_timeline !== false,
    user_id: pl.user_id,
  };
}

export function mapCourseRow(c: any) {
  return {
    id: c.id,
    title: c.title || "",
    kind: c.kind || "Kurs",
    city: c.city || "",
    courseLeaderName: c.course_leader_name || "",
    startDate: c.start_date || "",
    endDate: c.end_date || "",
    certificateDate: c.certificate_date || "",
    note: c.note || "",
    courseTitle: c.course_title || undefined,
    btAssessment: c.bt_assessment || "",
    btMilestones: c.bt_milestones || [],
    milestones: c.milestones || [],
    fulfillsStGoals: !!c.fulfills_st_goals,
    phase: c.phase,
    showAsInterval: !!c.show_as_interval,
    showOnTimeline: c.show_on_timeline !== false,
    user_id: c.user_id,
  };
}

export function mapAchievementRow(a: any) {
  return {
    id: a.id,
    placementId: a.placement_id || undefined,
    courseId: a.course_id || undefined,
    milestoneId: a.milestone_id || "",
    goalId: a.goal_id || undefined,
    code: a.code || undefined,
    milestone: a.milestone || undefined,
    date: a.date || a.achieved_date || "",
    user_id: a.user_id,
  };
}

export function mapMilestonePlanRow(mp: any) {
  return {
    id: mp.id,
    milestoneId: mp.milestone_id || "",
    planText: mp.plan_text || "",
    text: mp.plan_text || "",
    updatedAt: mp.updated_at || "",
    user_id: mp.user_id,
  };
}

export function mapProfileRowForStudent(p: any) {
  return {
    ...p,
    goalsVersion: p.goals_version || "2021",
    btStartDate: p.bt_start_date || "",
    btEndDate: p.bt_end_date || "",
    stStartDate: p.st_start_date || "",
    stEndDate: p.st_end_date || p.st_end_iso || "",
    stEndISO: p.st_end_iso || p.st_end_date || "",
    stTotalMonths: p.st_total_months ?? 66,
    personalNumber: p.personal_number || "",
    address: p.address || "",
    postalCode: p.postal_code || "",
    city: p.city || "",
    email: p.email || "",
    mobile: p.mobile || "",
    phoneHome: p.phone_home || "",
    phoneWork: p.phone_work || "",
    btMode: p.bt_mode || "fristående",
    stEndAttendance: p.st_end_attendance ?? 100,
  };
}

export function extractTimelineFromVersionData(versionData: any): any[] {
  if (!versionData) return [];
  if (Array.isArray(versionData)) return versionData;
  if (versionData.timeline) {
    return Array.isArray(versionData.timeline) ? versionData.timeline : [versionData.timeline];
  }
  return [];
}

export function buildSupervisorStudent(params: {
  profileRow: any;
  placements: any[];
  courses: any[];
  achievements: any[];
  milestonePlans: any[];
  iupSettings: any;
  timelineVersionData?: any;
}): SupervisorStudent {
  const {
    profileRow,
    placements,
    courses,
    achievements,
    milestonePlans,
    iupSettings,
    timelineVersionData,
  } = params;
  const p = profileRow || {};
  return {
    id: p.id,
    name: p.name || "Okänd",
    personnummer: p.personal_number || "",
    specialty: p.specialty || "Ej angiven",
    goalsVersion: p.goals_version === "2015" ? "2015" : "2021",
    importedAt: p.created_at || new Date().toISOString(),
    lastUpdated: p.updated_at || p.created_at || new Date().toISOString(),
    profile: mapProfileRowForStudent(p),
    placements: (placements || []).map(mapPlacementRow),
    courses: (courses || []).map(mapCourseRow),
    achievements: (achievements || []).map(mapAchievementRow),
    timeline: extractTimelineFromVersionData(timelineVersionData),
    iupMilestonePlans: (milestonePlans || []).map(mapMilestonePlanRow),
    iupSettings: iupSettings || null,
  };
}

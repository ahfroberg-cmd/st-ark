export async function persistTimelineToDbZone(input: {
  activities: any[];
  courses: any[];
  isValidISO: (value: string) => boolean;
  computeMondayDates: (activity: any) => { startISO: string; endISO: string };
  isLeave: (type: string) => boolean;
  isZeroAttendanceType: (type: string) => boolean;
  setActivities: (updater: (prev: any[]) => any[]) => void;
  setCourses: (updater: (prev: any[]) => any[]) => void;
  setAchievements: (rows: any[]) => void;
  setDbAchievements: (rows: any[]) => void;
  authUserId: string | undefined;
  getSessionUser: () => Promise<any>;
  setAuthUser: (user: any) => void;
  deleteAchievementsByUserAndPlacement: (userId: string, placementId: string) => Promise<any>;
  deleteAchievementsByUserAndCourse: (userId: string, courseId: string) => Promise<any>;
  insertAchievementRows: (rows: any[]) => Promise<any>;
  listAchievementsByUserId: (userId: string) => Promise<{ data: any[] | null; error: any }>;
  mapAchievementRow: (row: any) => any;
}): Promise<void> {
  const affectedPlacementIds = new Set<string>();
  const affectedCourseIds = new Set<string>();

  for (const activity of input.activities) {
    const rawStart = (activity as any)?.exactStartISO || "";
    const rawEnd = (activity as any)?.exactEndISO || "";

    let startISO = rawStart && input.isValidISO(rawStart) ? rawStart : "";
    let endISO = rawEnd && input.isValidISO(rawEnd) ? rawEnd : "";

    if (!startISO || !endISO) {
      const fallback = input.computeMondayDates(activity);
      if (!startISO) startISO = fallback.startISO;
      if (!endISO) endISO = fallback.endISO;
    }

    const isLeaveType = input.isLeave(activity.type);

    const record: any = {
      type: activity.type,
      clinic:
        !isLeaveType &&
        activity.type !== "Vetenskapligt arbete" &&
        activity.type !== "Förbättringsarbete"
          ? activity.label || ""
          : "",
      title:
        activity.type === "Annan ledighet"
          ? activity.leaveSubtype || ""
          : activity.label || (isLeaveType ? activity.type : ""),
      leaveSubtype: activity.type === "Annan ledighet" ? activity.leaveSubtype || "" : "",
      startDate: startISO,
      endDate: endISO,
      attendance: input.isZeroAttendanceType(activity.type) ? 0 : activity.attendance ?? 100,
      supervisor: activity.supervisor || "",
      supervisorSpeciality: activity.supervisorSpeciality || "",
      supervisorSite: activity.supervisorSite || "",
      note: activity.note || "",
      showOnTimeline: true,
      phase: (activity as any)?.phase || "ST",
      btAssessment: (activity as any)?.btAssessment || "",
      btMilestones: ((activity as any)?.btMilestones || []) as string[],
      milestones: ((activity as any)?.milestones || []) as string[],
      fulfillsStGoals: !!(activity as any)?.fulfillsStGoals,
    };
    void record;

    let id = activity.linkedPlacementId;
    if (!id) {
      const newId =
        (globalThis as any).crypto?.randomUUID?.() ??
        `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      id = newId;
      input.setActivities((prev) =>
        prev.map((item) => (item.id === activity.id ? { ...item, linkedPlacementId: newId } : item))
      );
    }

    if (id) affectedPlacementIds.add(id);
  }

  for (const course of input.courses) {
    const start = course.startDate || course.endDate || course.certificateDate || "";
    const end = course.endDate || course.startDate || course.certificateDate || "";
    const cert = course.certificateDate || course.endDate || course.startDate || "";

    const record: any = {
      title: course.title || "",
      certificateDate: course.certificateDate || "",
      kind: course.kind || "Kurs",
      showOnTimeline: true,
      city: course.city || "",
      courseLeaderName: course.courseLeaderName || "",
      startDate: course.startDate || "",
      endDate: course.endDate || "",
      note: course.note || "",
      courseTitle: (course as any)?.courseTitle || undefined,
      phase: course.phase,
      btMilestones: ((course as any)?.btMilestones || []) as string[],
      fulfillsStGoals: !!(course as any)?.fulfillsStGoals,
      milestones: ((course as any)?.milestones || []) as string[],
      btAssessment: (course as any)?.btAssessment || "",
      ...(typeof (course as any)?.showAsInterval === "boolean"
        ? { showAsInterval: !!(course as any).showAsInterval }
        : {}),
    };
    void start;
    void end;
    void cert;
    void record;

    let id = course.linkedCourseId;
    if (!id) {
      const newId =
        (globalThis as any).crypto?.randomUUID?.() ??
        `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      id = newId;
      input.setCourses((prev) =>
        prev.map((item) => (item.id === course.id ? { ...item, linkedCourseId: newId } : item))
      );
    }

    if (id) affectedCourseIds.add(id);
  }

  const toAdd: Array<{
    id: string;
    placementId?: string;
    courseId?: string;
    milestoneId: string;
    date: string;
  }> = [];

  for (const activity of input.activities) {
    const milestones: string[] = ((activity as any).milestones || []) as string[];
    if (!milestones?.length || !activity.linkedPlacementId) continue;
    const { endISO } = input.computeMondayDates(activity);
    for (const milestoneId of milestones) {
      toAdd.push({
        id:
          (globalThis as any).crypto?.randomUUID?.() ??
          `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
        placementId: activity.linkedPlacementId,
        milestoneId,
        date: endISO || "",
      });
    }
  }

  for (const course of input.courses) {
    const milestones: string[] = ((course as any).milestones || []) as string[];
    if (!milestones?.length || !course.linkedCourseId) continue;
    const date = course.certificateDate || course.endDate || course.startDate || "";
    for (const milestoneId of milestones) {
      toAdd.push({
        id:
          (globalThis as any).crypto?.randomUUID?.() ??
          `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
        courseId: course.linkedCourseId,
        milestoneId,
        date,
      });
    }
  }

  try {
    const localAchievements: any[] = [];
    const normalizedLocalAchievements = Array.isArray(localAchievements)
      ? localAchievements
      : [];
    input.setAchievements(normalizedLocalAchievements);
    input.setDbAchievements(normalizedLocalAchievements);

    let achUserId = input.authUserId;
    if (!achUserId) {
      const user = await input.getSessionUser();
      achUserId = user?.id;
      if (achUserId) input.setAuthUser(user);
    }

    if (achUserId) {
      try {
        for (const placementId of affectedPlacementIds) {
          await input.deleteAchievementsByUserAndPlacement(achUserId, placementId);
        }
        for (const courseId of affectedCourseIds) {
          await input.deleteAchievementsByUserAndCourse(achUserId, courseId);
        }
        if (toAdd.length) {
          await input.insertAchievementRows(
            toAdd.map((row) => ({
              id: row.id,
              user_id: achUserId,
              placement_id: row.placementId || null,
              course_id: row.courseId || null,
              milestone_id: row.milestoneId,
              date: row.date,
            }))
          );
        }

        const { data: remoteAchievements, error } = await input.listAchievementsByUserId(
          achUserId
        );
        if (!error && Array.isArray(remoteAchievements)) {
          const normalizedRemoteAchievements = remoteAchievements.map((row: any) =>
            input.mapAchievementRow(row)
          );
          input.setAchievements(normalizedRemoteAchievements);
          input.setDbAchievements(normalizedRemoteAchievements);
        }
      } catch {
        // ignore sync errors
      }
    }
  } catch {
    input.setAchievements([]);
  }
}

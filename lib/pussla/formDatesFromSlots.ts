type CourseLike = {
  id: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  phase?: "BT" | "ST";
};

type ActivityLike = {
  id: string;
  startSlot: number;
  lengthSlots: number;
  phase?: "BT" | "ST";
  exactStartISO?: string;
  exactEndISO?: string;
};

export function applyCourseDatesFromSlots<T extends CourseLike>(input: {
  courses: T[];
  selectedCourseId: string;
  startSlot: number;
  lengthSlots: number;
  computePhaseByEndSlot: (startSlot: number, lengthSlots: number) => "BT" | "ST";
  computeMondayDates: (activityLike: {
    id: string;
    type: string;
    label: string;
    startSlot: number;
    lengthSlots: number;
    phase: "BT" | "ST";
    restPercent: number;
    isLocked: boolean;
  }) => { startISO: string; endISO: string };
}): T[] {
  const {
    courses,
    selectedCourseId,
    startSlot,
    lengthSlots,
    computePhaseByEndSlot,
    computeMondayDates,
  } = input;

  return courses.map((course) => {
    if (course.id !== selectedCourseId) return course;
    const nextLength = Math.max(1, lengthSlots);
    const phase = course.phase || computePhaseByEndSlot(startSlot, nextLength);
    const { startISO, endISO } = computeMondayDates({
      id: course.id,
      type: "Kurs",
      label: course.title || "Kurs",
      startSlot,
      lengthSlots: nextLength,
      phase,
      restPercent: 0,
      isLocked: false,
    });
    return {
      ...course,
      phase,
      startDate: startISO || course.startDate,
      endDate: endISO || course.endDate,
    };
  });
}

export function applyActivityDatesFromSlots<T extends ActivityLike>(input: {
  activities: T[];
  activityId: string;
  startSlot: number;
  lengthSlots: number;
  computePhaseByEndSlot: (startSlot: number, lengthSlots: number) => "BT" | "ST";
  computeMondayDates: (activity: T) => { startISO: string; endISO: string };
}): T[] {
  const {
    activities,
    activityId,
    startSlot,
    lengthSlots,
    computePhaseByEndSlot,
    computeMondayDates,
  } = input;

  return activities.map((activity) => {
    if (activity.id !== activityId) return activity;
    const nextLength = Math.max(1, lengthSlots);
    const phase = activity.phase || computePhaseByEndSlot(startSlot, nextLength);
    const moved = {
      ...activity,
      startSlot,
      lengthSlots: nextLength,
      phase,
    };
    const { startISO, endISO } = computeMondayDates(moved);
    return {
      ...moved,
      exactStartISO: startISO,
      exactEndISO: endISO,
    };
  });
}

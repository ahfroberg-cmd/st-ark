type ActivityLike = {
  id: string;
  label?: string;
  type?: string;
  startSlot?: number;
  lengthSlots?: number;
  exactStartISO?: string;
  exactEndISO?: string;
  attendance?: number;
  supervisor?: string;
  supervisorSpeciality?: string;
  supervisorSite?: string;
  milestones?: string[];
  btMilestones?: string[];
  note?: string;
};

type CourseLike = {
  id: string;
  title?: string;
  certificateDate?: string;
  kind?: string;
  startDate?: string;
  endDate?: string;
  milestones?: string[];
  btMilestones?: string[];
  showAsInterval?: boolean;
  note?: string;
};

export function buildVersionName(reason: string, now: Date): string {
  const dateStr = now.toISOString().slice(0, 16).replace("T", " ");
  return `Auto före ändring (${reason}) ${dateStr}`;
}

export function buildTimelineVersionData(
  activities: ActivityLike[],
  courses: CourseLike[]
): {
  activities: ActivityLike[];
  courses: CourseLike[];
} {
  return {
    activities: activities.map((activity) => ({
      id: activity.id,
      label: activity.label,
      type: activity.type,
      startSlot: activity.startSlot,
      lengthSlots: activity.lengthSlots,
      exactStartISO: activity.exactStartISO,
      exactEndISO: activity.exactEndISO,
      attendance: activity.attendance,
      supervisor: activity.supervisor,
      supervisorSpeciality: activity.supervisorSpeciality,
      supervisorSite: activity.supervisorSite,
      milestones: activity.milestones,
      btMilestones: activity.btMilestones,
      note: activity.note,
    })),
    courses: courses.map((course) => ({
      id: course.id,
      title: course.title,
      certificateDate: course.certificateDate,
      kind: course.kind,
      startDate: course.startDate,
      endDate: course.endDate,
      milestones: course.milestones,
      btMilestones: course.btMilestones,
      showAsInterval: course.showAsInterval,
      note: course.note,
    })),
  };
}

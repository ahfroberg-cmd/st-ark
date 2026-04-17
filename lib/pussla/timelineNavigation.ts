type ActivityLike = {
  type?: string;
  label?: string;
};

type CourseLike = {
  title?: string;
  certificateDate?: string;
};

export function buildPlacementRegistrationPath(input: {
  activity: ActivityLike;
  startISO: string;
  endISO: string;
}): string {
  const { activity, startISO, endISO } = input;
  const query = new URLSearchParams({
    fromTimeline: "1",
    timeline: "1",
    type: activity.type || "",
    clinic: activity.label || activity.type || "",
    start: startISO,
    end: endISO,
  });
  return `/placeringar?${query.toString()}`;
}

export function buildCourseRegistrationPath(input: {
  course: CourseLike;
  displayTitle: string;
}): string {
  const { course, displayTitle } = input;
  const query = new URLSearchParams({
    fromTimeline: "1",
    timeline: "1",
    title: displayTitle,
    certificateDate: course.certificateDate || "",
  });
  return `/kurser?${query.toString()}`;
}

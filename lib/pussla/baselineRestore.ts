type WithId = { id: string };

export function applyPlacementBaseline<T extends WithId>(input: {
  activities: T[];
  selectedPlacementId: string;
  baselinePlacement: Partial<T>;
}): T[] {
  const { activities, selectedPlacementId, baselinePlacement } = input;
  return activities.map((activity) =>
    activity.id === selectedPlacementId ? ({ ...activity, ...baselinePlacement } as T) : activity
  );
}

export function applyCourseBaseline<T extends WithId>(input: {
  courses: T[];
  selectedCourseId: string;
  baselineCourse: Partial<T>;
}): T[] {
  const { courses, selectedCourseId, baselineCourse } = input;
  return courses.map((course) =>
    course.id === selectedCourseId ? ({ ...course, ...baselineCourse } as T) : course
  );
}

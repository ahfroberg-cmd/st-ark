type CourseLike = {
  id: string;
  startDate?: string;
  endDate?: string;
  certificateDate?: string;
  phase?: "BT" | "ST";
  showAsInterval?: unknown;
};

type BuildDraggedCourseInput<T extends CourseLike> = {
  course: T;
  iso: string;
  mode: "move" | "start" | "end";
  phaseForCourseDates: (startISO: string) => "BT" | "ST";
  dateToISO: (date: Date) => string;
};

export function buildDraggedCourse<T extends CourseLike>(
  input: BuildDraggedCourseInput<T>
): T {
  const { course, iso, mode, phaseForCourseDates, dateToISO } = input;
  const isInterval = !!course.showAsInterval;

  if (isInterval) {
    if (mode === "end") {
      const newStart = course.startDate || iso;
      let newEnd = iso;
      if (newEnd < newStart) newEnd = newStart;
      return { ...course, startDate: newStart, endDate: newEnd };
    }

    let newStart = iso;
    let newEnd = course.endDate || course.certificateDate || iso;
    if (mode === "move" && course.startDate && course.endDate) {
      const spanDays = Math.max(
        0,
        Math.round(
          (new Date(course.endDate + "T00:00:00").getTime() -
            new Date(course.startDate + "T00:00:00").getTime()) /
            86400000
        )
      );
      const shiftedEnd = new Date(new Date(iso).getTime() + spanDays * 86400000);
      newEnd = dateToISO(shiftedEnd);
    }
    if (newEnd < newStart) newEnd = newStart;
    const phase = phaseForCourseDates(newStart);
    return { ...course, startDate: newStart, endDate: newEnd, phase };
  }

  const phase = phaseForCourseDates(iso);
  return { ...course, startDate: iso, endDate: iso, phase };
}

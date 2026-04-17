import { buildYearBoundarySlots, filterCoursesForYear } from "@/lib/pussla/timelineRenderModel";
import { daysInYear } from "@/lib/pussla/timelineDateMath";

type DragCourseRef = { id: string; year: number } | null;

type CourseLike = {
  id: string;
  year?: number;
  startDate?: string | null;
  endDate?: string | null;
};

type BuildTimelineYearRowModelInput<TCourse extends CourseLike> = {
  rowIndex: number;
  startYear: number;
  totalYearsNeeded: number;
  totalSlots: number;
  baseSlots: number;
  stStartISO?: string | null;
  stEndISO?: string | null;
  goalsVersion?: string;
  btStartISO?: string | null;
  courses: TCourse[];
  dragCourse: DragCourseRef;
  isValidISO: (dateISO: string) => boolean;
  dateToSlot: (startYear: number, iso: string, mode: "start" | "end") => number;
  isoToDateSafe: (iso: string) => Date;
};

export function buildTimelineYearRowModel<TCourse extends CourseLike>(
  input: BuildTimelineYearRowModelInput<TCourse>
) {
  const {
    rowIndex,
    startYear,
    totalYearsNeeded,
    totalSlots,
    baseSlots,
    stStartISO,
    stEndISO,
    goalsVersion,
    btStartISO,
    courses,
    dragCourse,
    isValidISO,
    dateToSlot,
    isoToDateSafe,
  } = input;

  const year = startYear + rowIndex;
  const rowStartSlot = (year - startYear) * 24;
  const rowEndSlot = rowStartSlot + 24;
  const totalDays = daysInYear(year);
  const bottomYear = startYear + totalYearsNeeded - 1;

  const { snappedStartBoundarySlot, endBoundarySlot, visibleStartSlot } = buildYearBoundarySlots({
    startYear,
    rowStartSlot,
    totalSlots,
    baseSlots,
    stStartISO,
    stEndISO,
    goalsVersion,
    btStartISO,
    isValidISO,
    dateToSlot,
  });

  const coursesThisYear = filterCoursesForYear({
    courses,
    year,
    dragCourse,
    isValidISO,
    isoToDateSafe,
  });

  return {
    year,
    rowStartSlot,
    rowEndSlot,
    totalDays,
    bottomYear,
    snappedStartBoundarySlot,
    endBoundarySlot,
    visibleStartSlot,
    coursesThisYear,
  };
}

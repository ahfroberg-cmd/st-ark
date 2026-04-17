"use client";

export function buildYearBoundarySlots(params: {
  startYear: number;
  rowStartSlot: number;
  totalSlots: number;
  baseSlots: number;
  stStartISO?: string | null;
  stEndISO?: string | null;
  goalsVersion?: string;
  btStartISO?: string | null;
  isValidISO: (iso: string) => boolean;
  dateToSlot: (startYear: number, iso: string, mode: "start" | "end") => number;
}) {
  const {
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
  } = params;

  const hasRowValidStStartISO = typeof stStartISO === "string" && isValidISO(stStartISO);
  const hasRowValidStEndISO = typeof stEndISO === "string" && isValidISO(stEndISO);
  const rawStStartSlot = hasRowValidStStartISO ? dateToSlot(startYear, stStartISO as string, "start") : 0;
  const snappedStartBoundarySlot = rawStStartSlot;
  const startBoundaryCol = snappedStartBoundarySlot - rowStartSlot;

  let endBoundarySlot = hasRowValidStEndISO
    ? dateToSlot(startYear, stEndISO as string, "end")
    : hasRowValidStStartISO
      ? dateToSlot(startYear, stStartISO as string, "start") + baseSlots
      : totalSlots;
  if (!Number.isFinite(endBoundarySlot)) endBoundarySlot = totalSlots;
  const endBoundaryCol = endBoundarySlot - rowStartSlot;

  const is2021Profile = String(goalsVersion || "").trim() === "2021";
  const rawBtStartSlot = is2021Profile && btStartISO && isValidISO(btStartISO) ? dateToSlot(startYear, btStartISO, "start") : null;
  const snappedBtStartSlot = rawBtStartSlot != null ? rawBtStartSlot : null;
  const visibleStartSlot = is2021Profile && snappedBtStartSlot != null ? snappedBtStartSlot : snappedStartBoundarySlot;

  return {
    snappedStartBoundarySlot,
    startBoundaryCol,
    endBoundarySlot,
    endBoundaryCol,
    visibleStartSlot,
  };
}

export function filterCoursesForYear(params: {
  courses: any[];
  year: number;
  dragCourse: { id: string; year: number } | null;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
}) {
  const { courses, year, dragCourse, isValidISO, isoToDateSafe } = params;
  return courses.filter((c) => {
    const showAsInterval = (c as any).showAsInterval;
    const yearStartISO = `${year}-01-01`;
    const yearEndISO = `${year}-12-31`;

    if (showAsInterval) {
      const sISO = c.startDate || c.certificateDate || "";
      const eISO = c.endDate || c.certificateDate || "";
      if (!isValidISO(sISO) || !isValidISO(eISO)) return false;
      const s = isoToDateSafe(sISO);
      const e = isoToDateSafe(eISO);
      const y0 = isoToDateSafe(yearStartISO);
      const y1 = isoToDateSafe(yearEndISO);
      return !(+e < +y0 || +s > +y1);
    }

    const endISO = c.endDate || c.certificateDate || "";
    if (!isValidISO(endISO)) return false;
    const endYear = isoToDateSafe(endISO).getFullYear();
    if (endYear === year) return true;

    const dragging = dragCourse && dragCourse.id === c.id;
    const draggingOnThisRow = dragging && dragCourse.year === year;
    return !!draggingOnThisRow;
  });
}

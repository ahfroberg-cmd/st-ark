type ComputeCourseDragDateInput = {
  clientX: number;
  clientY: number;
  rowLeft: number;
  rowTop: number;
  rowWidth: number;
  rowHeight: number;
  daysInYear: number;
  year: number;
  startYear: number;
  totalYearsNeeded: number;
  daysInYearForYear: (year: number) => number;
  dateToISO: (date: Date) => string;
  hysteresisPx?: number;
};

export function computeCourseDragDate(input: ComputeCourseDragDateInput): {
  iso: string;
  nextYear: number;
  nextDaysInYear: number;
  nextRowTop: number;
} {
  const {
    clientX,
    clientY,
    rowLeft,
    rowTop,
    rowWidth,
    rowHeight,
    daysInYear,
    year,
    startYear,
    totalYearsNeeded,
    daysInYearForYear,
    dateToISO,
    hysteresisPx = 8,
  } = input;

  const x = clientX - rowLeft;
  const col = Math.floor((x / rowWidth) * daysInYear);
  let dayIndex = Math.max(0, Math.min(daysInYear - 1, col));

  const firstYear = startYear;
  const lastYear = startYear + totalYearsNeeded - 1;

  const y = clientY - rowTop;
  let rowDelta = 0;
  if (y < -hysteresisPx) rowDelta = -1;
  else if (y > rowHeight + hysteresisPx) rowDelta = 1;

  let targetYear = year;
  let targetDays = daysInYear;
  let targetRowTop = rowTop;

  if (rowDelta !== 0) {
    const nextYear = Math.max(firstYear, Math.min(lastYear, year + rowDelta));
    const nextDays = daysInYearForYear(nextYear);
    dayIndex = Math.max(0, Math.min(nextDays - 1, dayIndex));
    targetYear = nextYear;
    targetDays = nextDays;
    targetRowTop = rowTop + rowDelta * rowHeight;
  }

  const nextDate = new Date(targetYear, 0, 1);
  nextDate.setDate(1 + dayIndex);

  return {
    iso: dateToISO(nextDate),
    nextYear: targetYear,
    nextDaysInYear: targetDays,
    nextRowTop: targetRowTop,
  };
}

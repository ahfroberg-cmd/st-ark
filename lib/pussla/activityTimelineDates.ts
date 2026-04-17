type ActivityLike = {
  startSlot: number;
  lengthSlots: number;
  exactStartISO?: string;
  exactEndISO?: string;
};

type DateDeps = {
  startYear: number;
  slotToYearMonthHalf: (startYear: number, slot: number) => { year: number; month0: number; half: 0 | 1 };
  mondayNearestTo: (year: number, month0: number, day: number) => Date;
  sundayBeforeAnchor: (year: number, month0: number, day: number) => Date;
  dateToISO: (date: Date) => string;
};

export function computeMondayDatesForActivity(activity: ActivityLike, deps: DateDeps) {
  const { startYear, slotToYearMonthHalf, mondayNearestTo, sundayBeforeAnchor, dateToISO } = deps;
  const s = slotToYearMonthHalf(startYear, activity.startSlot);
  const eSlot = activity.startSlot + activity.lengthSlots - 1;
  const e = slotToYearMonthHalf(startYear, eSlot);

  const startD = mondayNearestTo(s.year, s.month0, s.half === 0 ? 1 : 15);
  const endBoundaryDay = e.half === 0 ? 15 : 1;
  const endBoundaryMonthRaw = e.month0 + (e.half === 1 ? 1 : 0);
  const endBoundaryYear = e.year + (endBoundaryMonthRaw > 11 ? 1 : 0);
  const endBoundaryMonthNorm = (endBoundaryMonthRaw + 12) % 12;
  const endD = sundayBeforeAnchor(endBoundaryYear, endBoundaryMonthNorm, endBoundaryDay);

  return { startISO: dateToISO(startD), endISO: dateToISO(endD) };
}

export function resolveLengthSlotsForExactEndDate(
  startSlot: number,
  desiredEndISO: string,
  deps: {
    isValidISO: (iso: string) => boolean;
    dateToSlot: (startYear: number, iso: string, mode: "start" | "end") => number;
    startYear: number;
    computeDates: (activity: ActivityLike) => { startISO: string; endISO: string };
  }
): { lengthSlots: number; grid: { startISO: string; endISO: string } } {
  const { isValidISO, dateToSlot, startYear, computeDates } = deps;

  if (!isValidISO(desiredEndISO)) {
    const e = dateToSlot(startYear, desiredEndISO, "end");
    const safeE = Math.max(startSlot, e);
    const len = Math.max(1, safeE - startSlot + 1);
    return { lengthSlots: len, grid: computeDates({ startSlot, lengthSlots: len }) };
  }

  const targetMs = new Date(`${desiredEndISO}T12:00:00`).getTime();
  let bestLen = 1;
  let bestDiff = Number.POSITIVE_INFINITY;
  let bestGrid = computeDates({ startSlot, lengthSlots: 1 });
  const maxLen = 800;

  for (let len = 1; len <= maxLen; len++) {
    const grid = computeDates({ startSlot, lengthSlots: len });
    if (grid.endISO === desiredEndISO) return { lengthSlots: len, grid };
    const diff = Math.abs(new Date(`${grid.endISO}T12:00:00`).getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestLen = len;
      bestGrid = grid;
    }
  }

  return { lengthSlots: bestLen, grid: bestGrid };
}

export function displayDatesForActivity(
  activity: ActivityLike,
  deps: {
    isValidISO: (iso: string) => boolean;
    computeDates: (activity: ActivityLike) => { startISO: string; endISO: string };
  }
) {
  const { isValidISO, computeDates } = deps;
  const fallback = computeDates(activity);
  return {
    startISO: isValidISO(activity.exactStartISO || "") ? (activity.exactStartISO as string) : fallback.startISO,
    endISO: isValidISO(activity.exactEndISO || "") ? (activity.exactEndISO as string) : fallback.endISO,
  };
}

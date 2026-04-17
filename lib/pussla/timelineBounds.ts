type RowLike = Record<string, any>;

type BoundsOptions = {
  activities: RowLike[];
  courses: RowLike[];
  effectiveStartYear: number;
  totalYearsNeeded: number;
  lsAbove: number;
  lsBelow: number;
  maxExtraYears: number;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  slotToYearMonthHalf: (startYear: number, slot: number) => { year: number };
};

export function computeTimelineYearBounds(options: BoundsOptions): { nextAbove: number; nextBelow: number } {
  const {
    activities,
    courses,
    effectiveStartYear,
    totalYearsNeeded,
    lsAbove,
    lsBelow,
    maxExtraYears,
    isValidISO,
    isoToDateSafe,
    slotToYearMonthHalf,
  } = options;

  let minYear = Number.POSITIVE_INFINITY;
  let maxYear = Number.NEGATIVE_INFINITY;
  const YEAR_MIN = 1900;
  const YEAR_MAX = 2200;

  const pushYear = (y: any) => {
    const yy = Number(y);
    if (!Number.isFinite(yy)) return;
    if (yy < YEAR_MIN || yy > YEAR_MAX) return;
    minYear = Math.min(minYear, yy);
    maxYear = Math.max(maxYear, yy);
  };

  for (const a of activities || []) {
    const exS = a?.exactStartISO;
    const exE = a?.exactEndISO;
    if (typeof exS === "string" && isValidISO(exS)) pushYear(isoToDateSafe(exS).getFullYear());
    if (typeof exE === "string" && isValidISO(exE)) pushYear(isoToDateSafe(exE).getFullYear());

    if (typeof a?.startSlot === "number" && typeof a?.lengthSlots === "number") {
      const sY = slotToYearMonthHalf(effectiveStartYear, a.startSlot).year;
      const eSlot = a.startSlot + Math.max(1, a.lengthSlots) - 1;
      const eY = slotToYearMonthHalf(effectiveStartYear, eSlot).year;
      pushYear(sY);
      pushYear(eY);
    }
  }

  for (const c of courses || []) {
    const sISO = String(c?.startDate || c?.certificateDate || "");
    const eISO = String(c?.endDate || c?.certificateDate || "");
    const y1 = isValidISO(sISO) ? isoToDateSafe(sISO).getFullYear() : null;
    const y2 = isValidISO(eISO) ? isoToDateSafe(eISO).getFullYear() : null;
    if (y1 != null) pushYear(y1);
    if (y2 != null) pushYear(y2);
  }

  const neededAbove = Number.isFinite(minYear) ? Math.max(0, effectiveStartYear - minYear) : 0;
  const neededBelow = Number.isFinite(maxYear)
    ? Math.max(0, maxYear - (effectiveStartYear + totalYearsNeeded - 1))
    : 0;
  const clampedAbove = Math.min(maxExtraYears, neededAbove);
  const clampedBelow = Math.min(maxExtraYears, neededBelow);
  const nextAbove = Math.min(maxExtraYears, Math.max(lsAbove, clampedAbove));
  const nextBelow = Math.min(maxExtraYears, Math.max(lsBelow, clampedBelow));
  return { nextAbove, nextBelow };
}

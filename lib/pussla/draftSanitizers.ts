type RowLike = Record<string, any>;

type SanitizerOptions = {
  draftActivities: RowLike[];
  draftCourses: RowLike[];
  startYear: number;
  slotsPerYear: () => number;
  slotToYearMonthHalf: (startYear: number, slot: number) => { year: number };
  isValidISO: (iso: string) => boolean;
};

export function sanitizeTimelineDrafts(options: SanitizerOptions): {
  activities: RowLike[];
  courses: RowLike[];
} {
  const { draftActivities, draftCourses, startYear, slotsPerYear, slotToYearMonthHalf, isValidISO } = options;
  try {
    const YEAR_MIN = 1900;
    const YEAR_MAX = 2200;
    const maxSlotAbs = slotsPerYear() * 200;

    const activities = (draftActivities || []).filter((a: any) => {
      const s = a?.startSlot;
      const l = a?.lengthSlots;
      if (!Number.isFinite(s) || !Number.isFinite(l)) return false;
      if (Math.abs(s) > maxSlotAbs) return false;
      if (Math.abs(l) > maxSlotAbs) return false;
      const endSlot = (s as number) + Math.max(1, l as number) - 1;
      const y0 = slotToYearMonthHalf(startYear, s as number).year;
      const y1 = slotToYearMonthHalf(startYear, endSlot).year;
      if (!Number.isFinite(y0) || !Number.isFinite(y1)) return false;
      if (y0 < YEAR_MIN || y0 > YEAR_MAX) return false;
      if (y1 < YEAR_MIN || y1 > YEAR_MAX) return false;
      return true;
    });

    const courses = (draftCourses || []).filter((c: any) => {
      if (!c) return false;
      const sISO = String(c?.startDate || c?.certificateDate || "");
      const eISO = String(c?.endDate || c?.certificateDate || "");
      if (sISO && !isValidISO(sISO)) return false;
      if (eISO && !isValidISO(eISO)) return false;
      return true;
    });

    return { activities, courses };
  } catch {
    return { activities: [], courses: [] };
  }
}

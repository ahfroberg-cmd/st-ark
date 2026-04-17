export type ActivityWithDateRange = {
  id: string;
  exactStartISO?: string;
  exactEndISO?: string;
  startSlot: number;
  lengthSlots: number;
  phase?: "BT" | "ST";
  [key: string]: unknown;
};

type ResolveLengthSlotsForExactEnd = (
  startSlot: number,
  desiredEndISO: string
) => { lengthSlots: number; grid: { startISO: string; endISO: string } };

type PhaseForSlots = (startSlot: number, lengthSlots: number) => "BT" | "ST";

export function applyActivityDateRangeUpdate<T extends ActivityWithDateRange>({
  activities,
  activityId,
  startSlot,
  desiredEndISO,
  resolveLengthSlotsForExactEnd,
  phaseForSlots,
}: {
  activities: T[];
  activityId: string;
  startSlot: number;
  desiredEndISO: string;
  resolveLengthSlotsForExactEnd: ResolveLengthSlotsForExactEnd;
  phaseForSlots: PhaseForSlots;
}): T[] {
  const { lengthSlots, grid } = resolveLengthSlotsForExactEnd(startSlot, desiredEndISO);

  return activities.map((a) => {
    if (a.id !== activityId) return a;
    return {
      ...a,
      exactStartISO: grid.startISO,
      exactEndISO: grid.endISO,
      startSlot,
      lengthSlots,
      phase: (a as any).phase ? (a as any).phase : phaseForSlots(startSlot, lengthSlots),
    };
  });
}

export function getActivityStartISO({
  activity,
  startYear,
  isValidISO,
  slotToYearMonthHalf,
  mondayNearestTo,
  dateToISO,
}: {
  activity: ActivityWithDateRange;
  startYear: number;
  isValidISO: (iso: string) => boolean;
  slotToYearMonthHalf: (startYear: number, slot: number) => { year: number; month0: number; half: 0 | 1 };
  mondayNearestTo: (year: number, month0: number, day: number) => Date;
  dateToISO: (d: Date) => string;
}): string {
  const exact = String(activity?.exactStartISO || "");
  if (isValidISO(exact)) return exact;

  const s = slotToYearMonthHalf(startYear, activity.startSlot);
  return dateToISO(mondayNearestTo(s.year, s.month0, s.half === 0 ? 1 : 15));
}

export function getActivityEndISO({
  activity,
  startYear,
  isValidISO,
  slotToYearMonthHalf,
  sundayBeforeAnchor,
  dateToISO,
}: {
  activity: ActivityWithDateRange;
  startYear: number;
  isValidISO: (iso: string) => boolean;
  slotToYearMonthHalf: (startYear: number, slot: number) => { year: number; month0: number; half: 0 | 1 };
  sundayBeforeAnchor: (year: number, month0: number, day: number) => Date;
  dateToISO: (d: Date) => string;
}): string {
  const exact = String(activity?.exactEndISO || "");
  if (isValidISO(exact)) return exact;

  const eSlot = activity.startSlot + activity.lengthSlots - 1;
  const e = slotToYearMonthHalf(startYear, eSlot);
  const d = sundayBeforeAnchor(
    e.year + (e.half === 1 && e.month0 === 11 ? 1 : e.month0 + (e.half === 1 ? 1 : 0) > 11 ? 1 : 0),
    (e.month0 + (e.half === 1 ? 1 : 0) + 12) % 12,
    e.half === 0 ? 15 : 1
  );
  return dateToISO(d);
}

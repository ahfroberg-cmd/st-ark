type ActivityLike = {
  type: string;
  startSlot: number;
  lengthSlots: number;
  attendance?: number;
};

type PlannedItem = {
  startSlot: number;
  lengthSlots: number;
  attendanceFrac: number;
};

type ComputeProjectedStEndISOInput = {
  activities: ActivityLike[];
  startYear: number;
  totalPlanMonths: number;
  restAttendance: number;
  baseISO: string | null;
  displayDatesForActivity: (activity: ActivityLike) => { startISO: string; endISO: string };
  isZeroAttendanceType: (type: string) => boolean;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  dateToISO: (date: Date) => string;
  dateToSlot: (startYear: number, iso: string, mode: "start" | "end") => number;
  slotToYearMonthHalf: (
    startYear: number,
    slot: number
  ) => { year: number; month0: number; half: 0 | 1 };
  sundayBeforeAnchor: (year: number, month0: number, day: number) => Date;
};

export function computeProjectedStEndISO(
  input: ComputeProjectedStEndISOInput
): { shouldUpdate: boolean; stEndISO: string | null } {
  const {
    activities,
    startYear,
    totalPlanMonths,
    restAttendance,
    baseISO,
    displayDatesForActivity,
    isZeroAttendanceType,
    isValidISO,
    isoToDateSafe,
    dateToISO,
    dateToSlot,
    slotToYearMonthHalf,
    sundayBeforeAnchor,
  } = input;

  const effectiveBaseISO = (() => {
    if (baseISO && isValidISO(baseISO)) return baseISO;
    let earliest: string | null = null;
    for (const a of activities) {
      const { startISO } = displayDatesForActivity(a);
      if (!isValidISO(startISO)) continue;
      if (!earliest || startISO < earliest) earliest = startISO;
    }
    return earliest;
  })();
  if (!effectiveBaseISO) return { shouldUpdate: false, stEndISO: null };
  void restAttendance;

  const totalRequiredFteSlots = Math.max(0, totalPlanMonths) * 2;
  const plannedItems: PlannedItem[] = activities
    .map((a) => ({
      startSlot: Number(a.startSlot || 0),
      lengthSlots: Math.max(0, Number(a.lengthSlots || 0)),
      attendanceFrac: isZeroAttendanceType(a.type)
        ? 0
        : Math.max(0, Math.min(1, Number(a.attendance ?? 100) / 100)),
    }))
    .filter((a) => a.lengthSlots > 0)
    .sort((x, y) => x.startSlot - y.startSlot);

  const slotAttendance = new Map<number, number>();
  for (const item of plannedItems) {
    for (let offset = 0; offset < item.lengthSlots; offset += 1) {
      const slot = item.startSlot + offset;
      const prev = slotAttendance.get(slot);
      // Overlap ska i praktiken inte ske, men summera defensivt och klipp till 100%.
      const next = Math.max(0, Math.min(1, (prev ?? 0) + item.attendanceFrac));
      slotAttendance.set(slot, next);
    }
  }

  const startSlot = dateToSlot(startYear, effectiveBaseISO, "start");
  let consumedFteSlots = 0;
  let finishSlot = startSlot;
  const maxProbeSlots = Math.max(2000, totalRequiredFteSlots * 4 + 48);
  for (let offset = 0; offset < maxProbeSlots; offset += 1) {
    const slot = startSlot + offset;
    const attendanceFrac = slotAttendance.get(slot) ?? 1;
    consumedFteSlots += attendanceFrac;
    if (consumedFteSlots >= totalRequiredFteSlots) {
      finishSlot = slot;
      break;
    }
  }

  const e = slotToYearMonthHalf(startYear, finishSlot);
  const endBoundaryDay = e.half === 0 ? 15 : 1;
  const endBoundaryMonthRaw = e.month0 + (e.half === 1 ? 1 : 0);
  const endBoundaryYear = e.year + (endBoundaryMonthRaw > 11 ? 1 : 0);
  const endBoundaryMonthNorm = (endBoundaryMonthRaw + 12) % 12;
  const endD = sundayBeforeAnchor(endBoundaryYear, endBoundaryMonthNorm, endBoundaryDay);

  return { shouldUpdate: true, stEndISO: dateToISO(endD) };
}

type ActivityLike = {
  id: string;
  type: string;
  label: string;
  startSlot: number;
  lengthSlots: number;
  hue: number;
  phase: "BT" | "ST";
  attendance: number;
  supervisor: string;
  supervisorSpeciality: string;
  supervisorSite: string;
  note: string;
  leaveSubtype: string;
  exactStartISO: string;
  exactEndISO: string;
};

type BuildPlacementFromDateRangeInput = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  placementType: string;
  startYear: number;
  hue: number;
  dateToSlot: (startYear: number, dateISO: string, mode: "start" | "end") => number;
  computePhaseByEndSlot: (startSlot: number, lengthSlots: number) => "BT" | "ST";
};

type BuildActivityAtSlotInput = {
  id: string;
  slot: number;
  startYear: number;
  hue: number;
  goalsVersion?: string;
  btStartISO?: string | null;
  stStartISO?: string | null;
  btEndManualISO?: string | null;
  slotToYearMonthHalf: (
    startYear: number,
    slot: number
  ) => { year: number; month0: number; half: 0 | 1 };
  mondayNearestTo: (year: number, month0: number, day: number) => Date;
  sundayNearestTo: (year: number, month0: number, day: number) => Date;
  dateToISO: (date: Date) => string;
  isoToDateSafe: (iso: string) => Date;
  isValidISO: (iso: string) => boolean;
  addMonths: (date: Date, months: number) => Date;
};

export function buildActivityAtSlot(input: BuildActivityAtSlotInput): ActivityLike {
  const {
    id,
    slot,
    startYear,
    hue,
    goalsVersion,
    btStartISO,
    stStartISO,
    btEndManualISO,
    slotToYearMonthHalf,
    mondayNearestTo,
    sundayNearestTo,
    dateToISO,
    isoToDateSafe,
    isValidISO,
    addMonths,
  } = input;

  const lengthSlots = 1;
  const s = slotToYearMonthHalf(startYear, slot);
  const eSlot = slot + lengthSlots - 1;
  const e = slotToYearMonthHalf(startYear, eSlot);
  const exactStartISO = dateToISO(mondayNearestTo(s.year, s.month0, s.half === 0 ? 1 : 15));
  const endBoundaryDay = e.half === 0 ? 15 : 1;
  const endBoundaryMonthRaw = e.month0 + (e.half === 1 ? 1 : 0);
  const endBoundaryYear = e.year + (endBoundaryMonthRaw > 11 ? 1 : 0);
  const endBoundaryMonthNorm = (endBoundaryMonthRaw + 12) % 12;
  const exactEndISO = dateToISO(
    sundayNearestTo(endBoundaryYear, endBoundaryMonthNorm, endBoundaryDay)
  );

  const is2021Profile = String(goalsVersion || "").trim() === "2021";
  let effectiveBtEnd: string | null = stStartISO || null;
  if (!effectiveBtEnd && btEndManualISO && isValidISO(btEndManualISO)) effectiveBtEnd = btEndManualISO;
  if (!effectiveBtEnd && btStartISO && isValidISO(btStartISO)) {
    try {
      const btDate = isoToDateSafe(btStartISO);
      effectiveBtEnd = dateToISO(addMonths(btDate, 24));
    } catch {
      effectiveBtEnd = null;
    }
  }

  let phase: "BT" | "ST" = "ST";
  if (is2021Profile && btStartISO && effectiveBtEnd) {
    const sMs = new Date(exactStartISO + "T00:00:00").getTime();
    const bts = new Date(btStartISO + "T00:00:00").getTime();
    const ets = new Date(effectiveBtEnd + "T00:00:00").getTime();
    const inBtWindow =
      Number.isFinite(sMs) && Number.isFinite(bts) && Number.isFinite(ets) && sMs >= bts && sMs < ets;
    phase = inBtWindow ? "BT" : "ST";
  }

  return {
    id,
    type: "Klinisk tjänstgöring",
    label: "",
    startSlot: slot,
    lengthSlots,
    hue,
    phase,
    attendance: 100,
    supervisor: "",
    supervisorSpeciality: "",
    supervisorSite: "",
    note: "",
    leaveSubtype: "",
    exactStartISO,
    exactEndISO,
  };
}

type ResolveMovedPlacementPhaseInput = {
  existingPhase?: "BT" | "ST";
  goalsVersion?: string;
  btStartISO?: string | null;
  btEndISO?: string | null;
  startYear: number;
  startSlot: number;
  slotToYearMonthHalf: (
    startYear: number,
    slot: number
  ) => { year: number; month0: number; half: 0 | 1 };
  mondayNearestTo: (year: number, month0: number, day: number) => Date;
  dateToISO: (date: Date) => string;
};

export function resolveMovedPlacementPhase(
  input: ResolveMovedPlacementPhaseInput
): "BT" | "ST" {
  const {
    existingPhase,
    goalsVersion,
    btStartISO,
    btEndISO,
    startYear,
    startSlot,
    slotToYearMonthHalf,
    mondayNearestTo,
    dateToISO,
  } = input;
  if (existingPhase) return existingPhase;

  const goals2021 = String(goalsVersion || "").trim() === "2021";
  if (!(goals2021 && btStartISO && btEndISO)) return "ST";

  const s = slotToYearMonthHalf(startYear, startSlot);
  const startD = mondayNearestTo(s.year, s.month0, s.half === 0 ? 1 : 15);
  const startISO = dateToISO(startD);
  const sMs = new Date(startISO + "T00:00:00").getTime();
  const bts = new Date(btStartISO + "T00:00:00").getTime();
  const bte = new Date(btEndISO + "T00:00:00").getTime();
  if (!Number.isFinite(sMs) || !Number.isFinite(bts) || !Number.isFinite(bte)) return "ST";
  return sMs >= bts && sMs < bte ? "BT" : "ST";
}

export function buildPlacementFromDateRange(input: BuildPlacementFromDateRangeInput): {
  placement: ActivityLike;
  normalizedEnd: string;
} | {
  error: string;
} {
  const {
    id,
    title,
    startDate,
    endDate,
    placementType,
    startYear,
    hue,
    dateToSlot,
    computePhaseByEndSlot,
  } = input;

  const normalizedEnd = endDate < startDate ? startDate : endDate;
  const start = dateToSlot(startYear, startDate, "start");
  const end = dateToSlot(startYear, normalizedEnd, "end");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return { error: "Kunde inte mappa datum till tidslinjen." };
  }

  const lengthSlots = Math.max(1, end - start + 1);
  return {
    placement: {
      id,
      type: placementType,
      label: title || placementType,
      startSlot: start,
      lengthSlots,
      hue,
      phase: computePhaseByEndSlot(start, lengthSlots),
      attendance: 100,
      supervisor: "",
      supervisorSpeciality: "",
      supervisorSite: "",
      note: "",
      leaveSubtype: "",
      exactStartISO: startDate,
      exactEndISO: normalizedEnd,
    },
    normalizedEnd,
  };
}

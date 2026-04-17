type SlotToYearMonthHalf = (
  startYear: number,
  slot: number
) => { year: number; month0: number; half: 0 | 1 };

type PlacementPhaseDeps = {
  startYear: number;
  startSlot: number;
  btStartISO: string;
  btEndISO: string;
  slotToYearMonthHalf: SlotToYearMonthHalf;
  mondayNearestTo: (year: number, month0: number, day: number) => Date;
  dateToISO: (date: Date) => string;
};

export function computePlacementPhaseFromBtWindow(deps: PlacementPhaseDeps): "BT" | "ST" {
  const {
    startYear,
    startSlot,
    btStartISO,
    btEndISO,
    slotToYearMonthHalf,
    mondayNearestTo,
    dateToISO,
  } = deps;

  const s = slotToYearMonthHalf(startYear, startSlot);
  const startD = mondayNearestTo(s.year, s.month0, s.half === 0 ? 1 : 15);
  const startISO = dateToISO(startD);
  const sMs = new Date(startISO + "T00:00:00").getTime();
  const btStartMs = new Date(btStartISO + "T00:00:00").getTime();
  const btEndMs = new Date(btEndISO + "T00:00:00").getTime();
  if (!Number.isFinite(sMs) || !Number.isFinite(btStartMs) || !Number.isFinite(btEndMs)) return "ST";
  return sMs >= btStartMs && sMs < btEndMs ? "BT" : "ST";
}

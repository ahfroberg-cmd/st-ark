type ProfileLike = {
  goalsVersion?: string | null;
  btStartDate?: string | null;
  btEndDate?: string | null;
};

type BtWindow = {
  btStartISO: string;
  btEndISO: string;
};

type BtWindowHelpers = {
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  dateToISO: (date: Date) => string;
  addMonths: (date: Date, months: number) => Date;
};

export function getEffectiveBtWindow(profile: ProfileLike, helpers: BtWindowHelpers): BtWindow | null {
  const { isValidISO, isoToDateSafe, dateToISO, addMonths } = helpers;
  const is2021 = String(profile?.goalsVersion || "").trim() === "2021";
  const btStartISO = profile?.btStartDate || null;
  if (!is2021 || !btStartISO || !isValidISO(btStartISO)) return null;

  const btEndManual = profile?.btEndDate || null;
  let btEndISO: string | null = null;
  if (btEndManual && isValidISO(btEndManual)) {
    btEndISO = btEndManual;
  } else {
    try {
      btEndISO = dateToISO(addMonths(isoToDateSafe(btStartISO), 24));
    } catch {
      btEndISO = null;
    }
  }
  if (!btEndISO || !isValidISO(btEndISO)) return null;
  return { btStartISO, btEndISO };
}

export function isIsoInBtWindow(
  iso: string | null | undefined,
  btWindow: BtWindow | null,
  isValidISO: (iso: string) => boolean
): boolean {
  if (!iso || !btWindow || !isValidISO(iso)) return false;
  return iso >= btWindow.btStartISO && iso <= btWindow.btEndISO;
}

export function isPlacementInBtWindow(
  placement: { startSlot?: number; lengthSlots?: number },
  btWindow: BtWindow | null,
  startYear: number,
  dateToSlot: (startYear: number, iso: string, edge: "start" | "end") => number
): boolean {
  if (!btWindow) return false;
  const btStartGlobal = dateToSlot(startYear, btWindow.btStartISO, "start");
  const btEndSlot = dateToSlot(startYear, btWindow.btEndISO, "end");
  const btEndGlobal = Number.isFinite(btEndSlot) ? btEndSlot : null;
  if (!Number.isFinite(btStartGlobal) || btEndGlobal == null) return false;

  const start = Number(placement.startSlot || 0);
  const endExclusive = start + Number(placement.lengthSlots || 0);
  return start >= btStartGlobal && endExclusive <= btEndGlobal;
}

import { getEffectiveBtWindow, isPlacementInBtWindow } from "@/lib/pussla/btPhase";

type ProfileLike = {
  goalsVersion?: string | null;
  btStartDate?: string | null;
  btEndDate?: string | null;
};

type PlacementLike = {
  type?: string;
  label?: string;
  startSlot: number;
  lengthSlots: number;
};

type TemplateLike = {
  title: string;
};

type Helpers = {
  normalizeGoalsVersion: (v: unknown) => "2015" | "2021";
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  dateToISO: (date: Date) => string;
  addMonths: (date: Date, months: number) => Date;
  dateToSlot: (startYear: number, iso: string, edge: "start" | "end") => number;
};

const THREE_COL_TYPES = new Set(["Forskning", "Tjänstledighet", "Föräldraledighet", "Sjukskriven"]);

function isCorePlacementType(type: string): boolean {
  return (
    type === "Klinisk tjänstgöring" ||
    type === "Vetenskapligt arbete" ||
    type === "Förbättringsarbete" ||
    type === "Auskultation"
  );
}

export function getPlacementDetailGridClass(
  selectedPlacement: PlacementLike | null,
  profile: ProfileLike,
  startYear: number,
  helpers: Helpers
): string {
  if (!selectedPlacement) return "md:grid-cols-5";

  const { normalizeGoalsVersion, isValidISO, isoToDateSafe, dateToISO, addMonths, dateToSlot } = helpers;
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
  const goals2015 = gv === "2015";
  const goals2021 = gv === "2021";
  const t = selectedPlacement.type || "";

  if (THREE_COL_TYPES.has(t)) return "md:grid-cols-3";
  if (t === "Annan ledighet") return "md:grid-cols-4";

  if (isCorePlacementType(t)) {
    if (goals2015) return "md:grid-cols-5";
    if (goals2021) {
      const btWindow = getEffectiveBtWindow(profile, {
        isValidISO,
        isoToDateSafe,
        dateToISO,
        addMonths,
      });
      if (!btWindow) return "md:grid-cols-5";
      return isPlacementInBtWindow(selectedPlacement, btWindow, startYear, dateToSlot)
        ? "md:grid-cols-6"
        : "md:grid-cols-5";
    }
  }

  const btStartISO = (profile as any)?.btStartDate || null;
  if (goals2015) return "md:grid-cols-5";
  if (!goals2021) return "md:grid-cols-4";
  if (!btStartISO) return "md:grid-cols-5";

  const btWindow = getEffectiveBtWindow(profile, {
    isValidISO,
    isoToDateSafe,
    dateToISO,
    addMonths,
  });
  if (!btWindow) return "md:grid-cols-5";

  let btEndSlot: number;
  try {
    btEndSlot = dateToSlot(startYear, btWindow.btEndISO, "end");
  } catch {
    return "md:grid-cols-5";
  }

  const actMidSlot = selectedPlacement.startSlot + Math.floor(selectedPlacement.lengthSlots / 2);
  return actMidSlot >= btEndSlot ? "md:grid-cols-4" : "md:grid-cols-5";
}

export function getPlacementDetailGridStyle(
  selectedPlacement: PlacementLike | null,
  profile: ProfileLike,
  startYear: number,
  srPlacementTemplates: TemplateLike[],
  helpers: Helpers
): { gridTemplateColumns: string } | undefined {
  if (!selectedPlacement) return undefined;

  const { normalizeGoalsVersion, isValidISO, isoToDateSafe, dateToISO, addMonths, dateToSlot } = helpers;
  const t = selectedPlacement.type || "";

  if (t === "Annan ledighet") return { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" };
  if (THREE_COL_TYPES.has(t)) return { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" };
  if (!isCorePlacementType(t)) return undefined;

  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
  const isPlacType = t === "Klinisk tjänstgöring" || t === "Auskultation";
  const curLbl = selectedPlacement.label || "";
  const hasTmpls = isPlacType && srPlacementTemplates.length > 0;
  const isTmplMatch = hasTmpls && srPlacementTemplates.some((tm) => tm.title === curLbl);
  const annanCol = hasTmpls && !isTmplMatch && curLbl !== "" ? 1 : 0;

  if (gv === "2015") {
    return { gridTemplateColumns: `repeat(${5 + annanCol}, minmax(0, 1fr))` };
  }

  if (gv === "2021") {
    const btWindow = getEffectiveBtWindow(profile, {
      isValidISO,
      isoToDateSafe,
      dateToISO,
      addMonths,
    });
    if (!btWindow) {
      return { gridTemplateColumns: `repeat(${5 + annanCol}, minmax(0, 1fr))` };
    }
    const inBtWindow = isPlacementInBtWindow(selectedPlacement, btWindow, startYear, dateToSlot);
    return {
      gridTemplateColumns: `repeat(${(inBtWindow ? 6 : 5) + annanCol}, minmax(0, 1fr))`,
    };
  }

  return undefined;
}

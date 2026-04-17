type PlacementLike = {
  id: string;
  startSlot: number;
  lengthSlots: number;
  note?: string;
};

type CourseLike = {
  kind?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  certificateDate?: string;
  note?: string;
  addToPlacementTargetId?: string | null;
};

type ResolveOptions = {
  courses: CourseLike[];
  displayTitle: string;
  placement: PlacementLike;
  startYear: number;
  isValidISO: (iso: string) => boolean;
  dateToSlot: (startYear: number, iso: string, edge: "start" | "end") => number;
  getCourseDisplayTitle: (course: CourseLike) => string;
};

function sharesSelectedPlacement(
  course: CourseLike,
  placement: PlacementLike,
  startYear: number,
  isValidISO: (iso: string) => boolean,
  dateToSlot: (startYear: number, iso: string, edge: "start" | "end") => number
): boolean {
  const raw = course?.addToPlacementTargetId;
  const hasExplicit = raw != null && String(raw).trim() !== "" && String(raw) !== "__ongoing__";
  if (hasExplicit) return String(raw) === String(placement.id);

  const pStart = Number(placement.startSlot || 0);
  const pEndEx = pStart + Number(placement.lengthSlots || 0);
  for (const isoRaw of [course.startDate, course.endDate, course.certificateDate]) {
    if (!isoRaw || !isValidISO(String(isoRaw))) continue;
    const slot = dateToSlot(startYear, String(isoRaw), "start");
    if (!Number.isFinite(slot)) continue;
    if (slot >= pStart && slot < pEndEx) return true;
  }
  return false;
}

export function resolveMatchingUtbildningsmoment(options: ResolveOptions): {
  count: number;
  uniqueDescriptions: string[];
} {
  const { courses, displayTitle, placement, startYear, isValidISO, dateToSlot, getCourseDisplayTitle } = options;
  const matched = courses
    .filter((c) => c.kind === "Utbildningsmoment" && getCourseDisplayTitle(c) === displayTitle)
    .filter((c) => sharesSelectedPlacement(c, placement, startYear, isValidISO, dateToSlot));

  const uniqueDescriptions = Array.from(
    new Set(
      matched
        .map((c) => String(c.note || "").trim())
        .filter(Boolean)
    )
  );
  return { count: matched.length, uniqueDescriptions };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildUpdatedPlacementNote(currentNote: string, displayTitle: string, count: number, uniqueDescriptions: string[]): string {
  const descText = uniqueDescriptions.length === 0 ? "" : uniqueDescriptions.join("; ");
  const base = count > 1 ? `Genomfört ${count} ${displayTitle}` : `Genomfört ${displayTitle}`;
  const noteText = descText ? `${base}: ${descText}` : base;

  const escapedTitle = escapeRegExp(displayTitle);
  const sameMomentLine = new RegExp(
    `^\\s*Genomfört\\s+(?:\\d+\\s+)?${escapedTitle}(?:\\s*:\\s*.*)?\\s*$`,
    "i"
  );
  const remainingLines = String(currentNote || "")
    .split("\n")
    .filter((line) => !sameMomentLine.test(line.trim()));
  const rebuilt = remainingLines.join("\n").trim();
  return rebuilt ? `${rebuilt}\n\n${noteText}` : noteText;
}

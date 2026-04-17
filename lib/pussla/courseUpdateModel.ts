import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";

type CourseLike = {
  id: string;
  title?: string;
  kind?: string;
  showAsInterval?: boolean;
  certificateDate?: string;
  startDate?: string;
  endDate?: string;
  phase?: "BT" | "ST";
  [key: string]: any;
};

type BuildUpdatedCourseInput = {
  current: CourseLike;
  update: Partial<CourseLike>;
  goalsVersion: string | null | undefined;
  btStartISO: string | null;
  btEndISO: string | null;
  fallbackISO: string;
  isValidISO: (iso: string) => boolean;
  normalizeISODateOnlyGlobal: (v: any) => string | null;
};

export function buildUpdatedCourseModel(input: BuildUpdatedCourseInput): CourseLike {
  const {
    current,
    update,
    goalsVersion,
    btStartISO,
    btEndISO,
    fallbackISO,
    isValidISO,
    normalizeISODateOnlyGlobal,
  } = input;

  const next: CourseLike = { ...current, ...update };
  const titleKind = `${next.title || ""} ${next.kind || ""}`.toLowerCase();
  const isPsy = /(^|\s)psykoterapi/.test(titleKind);

  let showAsInterval = typeof next.showAsInterval === "boolean" ? next.showAsInterval : undefined;
  if (showAsInterval == null && isPsy) showAsInterval = true;
  next.showAsInterval = showAsInterval;

  if (showAsInterval) {
    const fallback = next.certificateDate && isValidISO(next.certificateDate) ? next.certificateDate : fallbackISO;
    if (!next.startDate || !isValidISO(next.startDate)) next.startDate = fallback;
    if (!next.endDate || !isValidISO(next.endDate)) next.endDate = fallback;
  }

  const is2021Profile = normalizeGoalsVersion(goalsVersion) === "2021";
  const existingPhase = next.phase;
  const startISOraw = next.startDate || next.certificateDate || next.endDate || undefined;
  const startISO =
    normalizeISODateOnlyGlobal(startISOraw) || (startISOraw && isValidISO(startISOraw) ? startISOraw : null);

  if (!existingPhase && is2021Profile && btStartISO && btEndISO && startISO) {
    const sMs = Date.parse(startISO + "T00:00:00");
    const btStartMs = Date.parse(btStartISO + "T00:00:00");
    const btEndMs = Date.parse(btEndISO + "T00:00:00");
    if (Number.isFinite(sMs) && Number.isFinite(btStartMs) && Number.isFinite(btEndMs)) {
      next.phase = sMs >= btStartMs && sMs < btEndMs ? "BT" : "ST";
    }
  }

  return next;
}

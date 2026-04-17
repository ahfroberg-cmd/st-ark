export interface ResolvedPlacement {
  label: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ResolvedCourse {
  title: string;
  startDate: string | null;
  endDate: string | null;
  certificateDate: string | null;
}

export interface ResolvedEntityIndex {
  placements: ResolvedPlacement[];
  courses: ResolvedCourse[];
}

interface PlacementWithPosition {
  positionFromEnd: number;
  label: string;
  startDate: string | null;
  endDate: string | null;
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return null;
}

function toComparableTime(iso: string | null): number {
  if (!iso) return Number.NEGATIVE_INFINITY;
  return Date.parse(`${iso}T00:00:00Z`);
}

function normalizeSv(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitQueryTokens(query: string): string[] {
  const STOP = new Set([
    "sista",
    "senaste",
    "nast",
    "nastsista",
    "tredje",
    "fjarde",
    "placering",
    "placeringen",
    "placeringar",
    "forlang",
    "forlangd",
    "forlanga",
    "forlanga",
    "utan",
    "glapp",
    "fram",
    "framat",
    "sa",
    "att",
    "det",
    "blir",
    "inte",
    "den",
    "de",
    "som",
    "heter",
    "av",
    "till",
    "med",
    "en",
    "ett",
    "manad",
    "manader",
  ]);
  return normalizeSv(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function sortedPlacementsByEnd(snapshot: unknown): PlacementWithPosition[] {
  const placements = buildResolvedEntityIndex(snapshot).placements;
  const sorted = [...placements].sort((a, b) => {
    const ta = Math.max(toComparableTime(a.endDate), toComparableTime(a.startDate));
    const tb = Math.max(toComparableTime(b.endDate), toComparableTime(b.startDate));
    return tb - ta;
  });
  return sorted.map((p, idx) => ({
    positionFromEnd: idx + 1,
    label: p.label,
    startDate: p.startDate,
    endDate: p.endDate,
  }));
}

export function buildResolvedEntityIndex(snapshot: unknown): ResolvedEntityIndex {
  const activities = Array.isArray((snapshot as any)?.activities) ? (snapshot as any).activities : [];
  const courses = Array.isArray((snapshot as any)?.courses) ? (snapshot as any).courses : [];

  const placements: ResolvedPlacement[] = activities.map((a: any) => ({
    label: String(a?.label || "Placering"),
    startDate: toIsoDate(a?.exactStartISO) || toIsoDate(a?.startDate),
    endDate: toIsoDate(a?.exactEndISO) || toIsoDate(a?.endDate),
  }));

  const resolvedCourses: ResolvedCourse[] = courses.map((c: any) => ({
    title: String(c?.title || "").trim() || "Kurs",
    startDate: toIsoDate(c?.startDate),
    endDate: toIsoDate(c?.endDate),
    certificateDate: toIsoDate(c?.certificateDate),
  }));

  return { placements, courses: resolvedCourses };
}

export function resolvePlacementCount(snapshot: unknown): number {
  const direct = buildResolvedEntityIndex(snapshot).placements.length;
  if (direct > 0) return direct;
  const timelinePlacements = Array.isArray((snapshot as any)?.timeline?.placements)
    ? (snapshot as any).timeline.placements.length
    : 0;
  if (timelinePlacements > 0) return timelinePlacements;
  return 0;
}

export function resolveLatestCourseTitle(snapshot: unknown): string | null {
  const courses = buildResolvedEntityIndex(snapshot).courses;
  if (courses.length === 0) return null;
  const sorted = [...courses].sort((a, b) => {
    const ta = Math.max(
      toComparableTime(a.endDate),
      toComparableTime(a.startDate),
      toComparableTime(a.certificateDate)
    );
    const tb = Math.max(
      toComparableTime(b.endDate),
      toComparableTime(b.startDate),
      toComparableTime(b.certificateDate)
    );
    return tb - ta;
  });
  return sorted[0]?.title || null;
}

export function resolvePlacementPositionFromEndByLabel(
  snapshot: unknown,
  labelQuery: string,
  matchFromEnd: number = 1
): number | null {
  const placements = sortedPlacementsByEnd(snapshot);
  if (placements.length === 0) return null;
  const tokens = splitQueryTokens(labelQuery);
  if (tokens.length === 0) return null;
  const matches = placements.filter((p) => {
    const label = normalizeSv(p.label);
    return tokens.every((token) => label.includes(token));
  });
  if (matches.length === 0) return null;
  const wanted = Math.max(1, Number(matchFromEnd || 1));
  return matches[wanted - 1]?.positionFromEnd ?? null;
}

export function resolveNextPlacementStartDateByPositionFromEnd(
  snapshot: unknown,
  positionFromEnd: number
): string | null {
  const placements = sortedPlacementsByEnd(snapshot);
  const pos = Math.max(1, Number(positionFromEnd || 1));
  const target = placements[pos - 1];
  if (!target || !target.endDate) return null;
  const targetEnd = target.endDate;
  const future = placements
    .filter((p) => p.startDate && p.startDate > targetEnd)
    .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  return future[0]?.startDate || null;
}


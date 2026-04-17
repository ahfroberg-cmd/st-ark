export interface WorldStateIndex {
  courseStartMonthsByYear: Record<number, number[]>;
  btWindow?: { startDate: string; endDate: string };
  btOccupiedRanges: Array<{ startDate: string; endDate: string }>;
}

export interface CanonicalTimelinePlacement {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface CanonicalTimelineCourse {
  id: string;
  title: string;
  startDate: string;
}

export interface CanonicalTimelineGap {
  beforePlacementId: string;
  afterPlacementId: string;
  startDate: string;
  endDate: string;
}

export interface CanonicalTimelineState {
  placements: CanonicalTimelinePlacement[];
  courses: CanonicalTimelineCourse[];
  gaps: CanonicalTimelineGap[];
}

function parseIsoYearMonth(value: unknown): { year: number; month: number } | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function sortPlacements(
  placements: CanonicalTimelinePlacement[]
): CanonicalTimelinePlacement[] {
  return [...placements].sort((a, b) =>
    a.startDate === b.startDate
      ? a.endDate.localeCompare(b.endDate)
      : a.startDate.localeCompare(b.startDate)
  );
}

export function buildCanonicalTimelineState(snapshot: unknown): CanonicalTimelineState {
  const activityRows = Array.isArray((snapshot as any)?.activities) ? (snapshot as any).activities : [];
  const courseRows = Array.isArray((snapshot as any)?.courses) ? (snapshot as any).courses : [];

  const placements: CanonicalTimelinePlacement[] = [];
  for (let i = 0; i < activityRows.length; i += 1) {
    const row = activityRows[i];
    const startDate = toIsoDate(row?.exactStartISO) || toIsoDate(row?.startDate);
    const endDate = toIsoDate(row?.exactEndISO) || toIsoDate(row?.endDate);
    if (!startDate || !endDate) continue;
    placements.push({
      id: String(row?.id || `placement:${i}:${startDate}:${endDate}`),
      label: String(row?.label || row?.title || "Placering"),
      startDate,
      endDate,
    });
  }

  const courses: CanonicalTimelineCourse[] = [];
  for (let i = 0; i < courseRows.length; i += 1) {
    const row = courseRows[i];
    const startDate =
      toIsoDate(row?.startDate) || toIsoDate(row?.certificateDate) || toIsoDate(row?.start);
    if (!startDate) continue;
    courses.push({
      id: String(row?.id || `course:${i}:${startDate}`),
      title: String(row?.title || row?.name || `Kurs ${i + 1}`),
      startDate,
    });
  }

  const sorted = sortPlacements(placements);
  const gaps: CanonicalTimelineGap[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gapStart = addDaysIso(a.endDate, 1);
    const gapEnd = addDaysIso(b.startDate, -1);
    if (gapStart <= gapEnd) {
      gaps.push({
        beforePlacementId: a.id,
        afterPlacementId: b.id,
        startDate: gapStart,
        endDate: gapEnd,
      });
    }
  }
  return { placements: sorted, courses: [...courses].sort((a, b) => a.startDate.localeCompare(b.startDate)), gaps };
}

export function buildCanonicalPlannerSnapshot(snapshot: unknown): unknown {
  const canonical = buildCanonicalTimelineState(snapshot);
  return {
    ...(snapshot as any),
    activities: canonical.placements.map((p) => ({
      id: p.id,
      label: p.label,
      exactStartISO: `${p.startDate}T00:00:00Z`,
      exactEndISO: `${p.endDate}T00:00:00Z`,
    })),
    courses: canonical.courses.map((c) => ({
      id: c.id,
      title: c.title,
      startDate: c.startDate,
    })),
  };
}

export function buildWorldStateIndex(snapshot: unknown): WorldStateIndex {
  const courseStartMonthsByYear: Record<number, Set<number>> = {};
  const courses = Array.isArray((snapshot as any)?.courses) ? (snapshot as any).courses : [];
  const activities = Array.isArray((snapshot as any)?.activities) ? (snapshot as any).activities : [];

  for (const c of courses) {
    const parsed =
      parseIsoYearMonth(c?.startDate) ||
      parseIsoYearMonth(c?.certificateDate) ||
      parseIsoYearMonth(c?.start);
    if (!parsed) continue;
    if (!courseStartMonthsByYear[parsed.year]) courseStartMonthsByYear[parsed.year] = new Set();
    courseStartMonthsByYear[parsed.year].add(parsed.month);
  }

  const normalized: Record<number, number[]> = {};
  for (const [yearRaw, monthSet] of Object.entries(courseStartMonthsByYear)) {
    const year = Number(yearRaw);
    normalized[year] = [...monthSet].sort((a, b) => a - b);
  }

  let btStart: string | null =
    typeof (snapshot as any)?.btWindow?.startDate === "string"
      ? (snapshot as any).btWindow.startDate.slice(0, 10)
      : null;
  let btEnd: string | null =
    typeof (snapshot as any)?.btWindow?.endDate === "string"
      ? (snapshot as any).btWindow.endDate.slice(0, 10)
      : null;
  const btOccupiedRanges: Array<{ startDate: string; endDate: string }> = [];
  for (const a of activities) {
    if (String(a?.phase || "").toUpperCase() !== "BT") continue;
    const start = parseIsoYearMonth(a?.exactStartISO || a?.startDate);
    const end = parseIsoYearMonth(a?.exactEndISO || a?.endDate);
    const startIso =
      typeof a?.exactStartISO === "string"
        ? a.exactStartISO.slice(0, 10)
        : typeof a?.startDate === "string"
          ? a.startDate.slice(0, 10)
          : null;
    const endIso =
      typeof a?.exactEndISO === "string"
        ? a.exactEndISO.slice(0, 10)
        : typeof a?.endDate === "string"
          ? a.endDate.slice(0, 10)
          : null;
    if (!startIso || !endIso || !start || !end) continue;
    if (!btStart || startIso < btStart) btStart = startIso;
    if (!btEnd || endIso > btEnd) btEnd = endIso;
    btOccupiedRanges.push({ startDate: startIso, endDate: endIso });
  }

  return {
    courseStartMonthsByYear: normalized,
    btWindow: btStart && btEnd ? { startDate: btStart, endDate: btEnd } : undefined,
    btOccupiedRanges,
  };
}


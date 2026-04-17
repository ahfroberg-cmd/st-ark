/** Ren domänlogik för IUP-handledarsamtal (synk med tidslinje-sessioner). */

export function addDaysToIsoDate(dateISO: string, days: number): string {
  const base = String(dateISO || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
  const d = new Date(`${base}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return base;
  d.setUTCDate(d.getUTCDate() + Math.trunc(days));
  return d.toISOString().slice(0, 10);
}

export function supervisionTimelineFromMeetings(meetings: unknown[]): {
  id: string;
  dateISO: string;
  title: string;
}[] {
  if (!Array.isArray(meetings)) return [];
  return meetings
    .filter(
      (m): m is Record<string, unknown> =>
        Boolean(m) && typeof m === "object" && typeof (m as any).id === "string" && (m as any).id
    )
    .filter((m) => typeof m.dateISO === "string" && String(m.dateISO).trim())
    .map((m) => ({
      id: String(m.id),
      dateISO: String(m.dateISO),
      title:
        typeof m.focus === "string"
          ? m.focus
          : typeof (m as any).title === "string"
            ? String((m as any).title)
            : "",
    }));
}

export function shiftMeetingsByDays<T extends { dateISO?: string }>(
  meetings: T[],
  days: number
): T[] {
  return meetings.map((m) => {
    const cur = String(m?.dateISO || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cur)) return { ...m };
    return { ...m, dateISO: addDaysToIsoDate(cur, days) };
  });
}

export function removeMeetingsOnDates<T extends { dateISO?: string }>(
  meetings: T[],
  dateISOs: string[]
): { next: T[]; removed: number } {
  const keys = new Set(
    dateISOs.map((d) => String(d || "").slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  );
  if (keys.size === 0) return { next: [...meetings], removed: 0 };
  const next = meetings.filter((m) => !keys.has(String(m?.dateISO || "").slice(0, 10)));
  return { next, removed: meetings.length - next.length };
}

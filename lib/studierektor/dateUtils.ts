export function uid() {
  return Math.random().toString(36).slice(2, 11);
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("sv-SE");
  } catch {
    return "-";
  }
}

export function isZeroAttendancePlacementType(v: any): boolean {
  const t = String(v ?? "")
    .trim()
    .toLowerCase();
  return t.includes("ledighet") || t.includes("forald") || t.includes("föräld") || t.includes("sjuk");
}

export function fteDaysBetween(startISO: string, endISO: string, attendancePct: number): number {
  if (!startISO || !endISO) return 0;
  try {
    const s = new Date(`${startISO.slice(0, 10)}T00:00:00`);
    const e = new Date(`${endISO.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    if (e.getTime() < s.getTime()) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((e.getTime() - s.getTime()) / msPerDay) + 1;
    const att = Number.isFinite(attendancePct) ? Math.max(0, Math.min(100, attendancePct)) : 100;
    return days * (att / 100);
  } catch {
    return 0;
  }
}

export function isValidISODate(s: string | undefined | null): s is string {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return !isNaN(d.getTime());
}

export function toISODate(y: number, m1: number, d: number) {
  const yy = String(y).padStart(4, "0");
  const mm = String(m1).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function normalizeToISODate(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") {
    const s: any = String(v).trim();
    if (!s) return null;
    if (isValidISODate(s)) return s;
    if (s.length >= 10 && isValidISODate(s.slice(0, 10))) return s.slice(0, 10);
    const m1 = s.match(/^\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*$/);
    if (m1) {
      const d = Number(m1[1]);
      const m = Number(m1[2]);
      const y = Number(m1[3]);
      if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return toISODate(y, m, d);
    }
    const m2 = s.match(/^\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*$/);
    if (m2) {
      const y = Number(m2[1]);
      const m = Number(m2[2]);
      const d = Number(m2[3]);
      if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return toISODate(y, m, d);
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return toISODate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    }
    return null;
  }
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return toISODate(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  if (typeof v === "number") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return null;
}

export function dateToSlotSnapped(
  startYear: number,
  dISO: string,
  mode: "start" | "end" = "start",
): number {
  if (!isValidISODate(dISO)) return Number.POSITIVE_INFINITY;
  const d = new Date(dISO + "T00:00:00");
  let y = d.getFullYear();
  let m0 = d.getMonth();
  const day = d.getDate();

  // Samma gränser som i planera-st:
  // 1-7 => H1, 8-22 => H2, 23-EOM => nästa månads H1
  if (day <= 7) {
    return (y - startYear) * 24 + m0 * 2 + 0;
  }
  if (day <= 22) {
    return (y - startYear) * 24 + m0 * 2 + 1;
  }
  m0 += 1;
  if (m0 >= 12) {
    m0 = 0;
    y += 1;
  }
  void mode;
  return (y - startYear) * 24 + m0 * 2 + 0;
}

export function dateToMarkerSlot(startYear: number, dISO: string): number {
  // Markörer följer samma 7/22-snapp som övriga tidslinjen.
  return dateToSlotSnapped(startYear, dISO, "end");
}

"use client";

export function normalizeCourseTitleForAgent(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function courseTouchesMonthYearForAgent(
  c: { startDate?: string; endDate?: string; certificateDate?: string },
  month: number,
  year: number,
  isValidISO: (iso: string) => boolean
): boolean {
  const candidates = [c.startDate, c.endDate, c.certificateDate].filter(Boolean);
  for (const iso of candidates) {
    const s = String(iso);
    if (!isValidISO(s)) continue;
    const d = new Date(`${s}T00:00:00`);
    if (d.getFullYear() === year && d.getMonth() + 1 === month) return true;
  }
  return false;
}

export function courseTitleMatchesAgent(
  c: { title?: string; courseTitle?: string },
  query: string
): boolean {
  const q = normalizeCourseTitleForAgent(query);
  if (!q) return false;
  const title = normalizeCourseTitleForAgent(c.title || "");
  const alt = normalizeCourseTitleForAgent(c.courseTitle || "");
  return title.includes(q) || q.includes(title) || (!!alt && (alt.includes(q) || q.includes(alt)));
}

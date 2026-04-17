"use client";

export function getPlacementStartISOForAgent(
  a: { exactStartISO?: string },
  isValidISO: (iso: string) => boolean,
  computeMondayDates: (a: any) => { startISO: string; endISO: string }
): string {
  const exact = String(a.exactStartISO || "");
  if (isValidISO(exact)) return exact;
  const fallback = computeMondayDates(a).startISO;
  return isValidISO(fallback) ? fallback : "";
}

export function getPlacementEndISOForAgent(
  a: { exactEndISO?: string },
  isValidISO: (iso: string) => boolean,
  computeMondayDates: (a: any) => { startISO: string; endISO: string }
): string {
  const exact = String(a.exactEndISO || "");
  if (isValidISO(exact)) return exact;
  const fallback = computeMondayDates(a).endISO;
  return isValidISO(fallback) ? fallback : "";
}

export function getCourseStartISOForAgent(
  c: { startDate?: string; endDate?: string },
  isValidISO: (iso: string) => boolean
): string {
  const s = String(c.startDate || "");
  if (isValidISO(s)) return s;
  const e = String(c.endDate || "");
  return isValidISO(e) ? e : "";
}

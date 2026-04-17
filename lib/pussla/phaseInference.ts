"use client";

import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";

function addMonthsSafe(d: Date, months: number) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const whole = Math.trunc(months);
  const frac = months - whole;
  const base = new Date(y, m + whole, day);
  if (frac !== 0) {
    const next = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());
    const diffMs = +next - +base;
    base.setTime(+base + diffMs * frac);
  }
  return base;
}

export function inferPhaseByBTRuntime(params: {
  startISO?: string;
  endISO?: string;
  profile?: any;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  dateToISO: (date: Date) => string;
}): "BT" | "ST" {
  const { startISO, endISO, profile, isValidISO, isoToDateSafe, dateToISO } = params;
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
  if (gv !== "2021") return "ST";

  const btStartISO: string | null = (profile as any)?.btStartDate || null;
  if (!btStartISO || !isValidISO(btStartISO)) return "ST";

  const btEndManual: string | null = (profile as any)?.btEndDate || null;
  let btEndISO: string | null = null;

  if (btEndManual && isValidISO(btEndManual)) {
    btEndISO = btEndManual;
  } else {
    try {
      const btDate = isoToDateSafe(btStartISO);
      const autoEnd = addMonthsSafe(btDate, 24);
      btEndISO = dateToISO(autoEnd);
    } catch {
      return "ST";
    }
  }

  if (!btEndISO || !isValidISO(btEndISO)) return "ST";

  const btStartMs = Date.parse(`${btStartISO}T00:00:00`);
  const btEndMs = Date.parse(`${btEndISO}T00:00:00`);
  const refISO = endISO || startISO;
  if (!refISO || !isValidISO(refISO)) return "ST";
  const endMs = Date.parse(`${refISO}T00:00:00`);

  if (!Number.isFinite(btStartMs) || !Number.isFinite(btEndMs) || !Number.isFinite(endMs)) return "ST";
  return endMs >= btStartMs && endMs < btEndMs ? "BT" : "ST";
}

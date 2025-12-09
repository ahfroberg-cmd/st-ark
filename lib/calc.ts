// lib/calc.ts
import { differenceInCalendarDays, parseISO, startOfMonth, endOfMonth, addMonths } from "date-fns";
import type { Placement } from "./types";

// FTE-dagar för en placering: kalenderdagar * (närvaro/100)
export function fteDaysForPlacement(p: Placement): number {
  const s = parseISO(p.startDate);
  const e = parseISO(p.endDate);
  const days = differenceInCalendarDays(e, s) + 1;
  const fte = p.attendance / 100;
  return Math.max(0, Math.round(days * fte));
}

export function totalDays(placements: Placement[]): number {
  return placements.reduce((sum, p) => sum + fteDaysForPlacement(p), 0);
}

// (Gammal enkel metod – kan tas bort om du vill)
export function daysToMonths30(d: number): number {
  return d / 30;
}

// Kalenderkorrekt månadsfraktion för EN placering.
export function fteMonthsForPlacementCalendar(p: Placement): number {
  const s = parseISO(p.startDate);
  const e = parseISO(p.endDate);
  if (e < s) return 0;

  const attend = p.attendance / 100;
  let total = 0;
  let cursor = startOfMonth(s);

  while (cursor <= e) {
    const mStart = startOfMonth(cursor);
    const mEnd = endOfMonth(cursor);

    const overlapStart = s > mStart ? s : mStart;
    const overlapEnd = e < mEnd ? e : mEnd;

    if (overlapEnd >= overlapStart) {
      const overlapDays = differenceInCalendarDays(overlapEnd, overlapStart) + 1;
      const daysInMonth = differenceInCalendarDays(mEnd, mStart) + 1;
      total += (overlapDays / daysInMonth) * attend;
    }
    cursor = addMonths(cursor, 1);
  }
  return total;
}

// Kalenderkorrekt summa månader för flera placeringar.
export function totalMonthsCalendar(placements: Placement[]): number {
  return placements.reduce((sum, p) => sum + fteMonthsForPlacementCalendar(p), 0);
}

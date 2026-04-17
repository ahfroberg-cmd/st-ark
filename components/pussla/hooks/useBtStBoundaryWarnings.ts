"use client";

import { useEffect } from "react";

export function useBtStBoundaryWarnings(params: {
  activities: any[];
  courses: any[];
  profile: any;
  stStartISO: string | null;
  startYear: number;
  computeEducationalGaps: (activities: any[]) => Array<{ id: string }>;
  normalizeGoalsVersion: (value: unknown) => string;
  isoToDateSafe: (value: string) => Date;
  dateToISO: (value: Date) => string;
  addMonths: (value: Date, months: number) => Date;
  slotToYearMonthHalf: (startYear: number, slot: number) => { year: number; month0: number; half: number };
  mondayNearestTo: (year: number, month0: number, day: number) => Date;
  sundayNearestTo: (year: number, month0: number, day: number) => Date;
  setDismissedGaps: (updater: (prev: string[]) => string[]) => void;
  setBtstWarnActIds: (ids: Set<string>) => void;
  setBtstWarnCourseIds: (ids: Set<string>) => void;
}) {
  useEffect(() => {
    const currentGapIds = params.computeEducationalGaps(params.activities).map((g) => g.id);
    params.setDismissedGaps((prev) => prev.filter((id) => currentGapIds.includes(id)));

    try {
      const gv = params.normalizeGoalsVersion((params.profile as any)?.goalsVersion);
      if (gv !== "2021") {
        params.setBtstWarnActIds(new Set());
        params.setBtstWarnCourseIds(new Set());
        return;
      }

      const isIso = (s?: string | null): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
      const toMs = (s: string): number => Date.parse(s + "T00:00:00");
      const getIntervalMs = (sISO?: string | null, eISO?: string | null): [number, number] | null => {
        if (!isIso(sISO) && !isIso(eISO)) return null;
        const s = isIso(sISO) ? toMs(sISO) : Number.NaN;
        const e = isIso(eISO) ? toMs(eISO) : Number.NaN;
        const a = Number.isFinite(s) ? s : e;
        const b = Number.isFinite(e) ? e : s;
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        const a0 = Math.min(a, b);
        const a1 = Math.max(a, b) + 86400000;
        return [a0, a1];
      };

      const profAny: any = params.profile || {};
      const btISO = profAny?.btStartDate as string | undefined;
      const btEndManual = profAny?.btEndDate as string | undefined;

      let boundaryISO: string | null = null;
      if (btISO && isIso(btISO)) {
        if (btEndManual && isIso(btEndManual)) {
          boundaryISO = btEndManual;
        } else {
          try {
            const btDate = params.isoToDateSafe(btISO);
            boundaryISO = params.dateToISO(params.addMonths(btDate, 24));
          } catch {
            boundaryISO = null;
          }
        }
      } else {
        boundaryISO =
          (typeof params.stStartISO === "string" && params.stStartISO) ? params.stStartISO :
          (typeof profAny?.stStartDate === "string" && profAny.stStartDate) ? profAny.stStartDate :
          null;
      }

      if (!boundaryISO) {
        params.setBtstWarnActIds(new Set());
        params.setBtstWarnCourseIds(new Set());
        return;
      }
      const boundaryMs = toMs(boundaryISO);
      if (!Number.isFinite(boundaryMs)) {
        params.setBtstWarnActIds(new Set());
        params.setBtstWarnCourseIds(new Set());
        return;
      }

      const intervalFromActivity = (a: any): [number, number] | null => {
        if (isIso(a.exactStartISO) || isIso(a.exactEndISO) || isIso(a.startDate) || isIso(a.endDate)) {
          return getIntervalMs(a.exactStartISO ?? a.startDate, a.exactEndISO ?? a.endDate);
        }
        if (typeof a.startSlot !== "number" || typeof a.lengthSlots !== "number") return null;
        const s = params.slotToYearMonthHalf(params.startYear, a.startSlot);
        const eSlot = a.startSlot + Math.max(1, a.lengthSlots) - 1;
        const e = params.slotToYearMonthHalf(params.startYear, eSlot);
        const startD = params.mondayNearestTo(s.year, s.month0, s.half === 0 ? 1 : 15);
        const endBoundaryDay = e.half === 0 ? 15 : 1;
        const endBoundaryMonthRaw = e.month0 + (e.half === 1 ? 1 : 0);
        const endBoundaryYear = e.year + (endBoundaryMonthRaw > 11 ? 1 : 0);
        const endBoundaryMonthNorm = (endBoundaryMonthRaw + 12) % 12;
        const endD = params.sundayNearestTo(endBoundaryYear, endBoundaryMonthNorm, endBoundaryDay);
        return [+startD, +endD + 86400000];
      };

      const actIds: string[] = [];
      for (const a of Array.isArray(params.activities) ? params.activities : []) {
        const pair = intervalFromActivity(a);
        if (!pair) continue;
        const [a0, a1] = pair;
        if (a0 < boundaryMs && a1 - 86400000 > boundaryMs) actIds.push(a.id);
      }

      const courseIds: string[] = [];
      for (const c of Array.isArray(params.courses) ? params.courses : []) {
        const pair =
          getIntervalMs((c as any).startDate, (c as any).endDate) ??
          getIntervalMs((c as any).certificateDate, (c as any).certificateDate);
        if (!pair) continue;
        const [a0, a1] = pair;
        if (a0 < boundaryMs && a1 - 86400000 > boundaryMs) courseIds.push((c as any).id);
      }

      params.setBtstWarnActIds(new Set(actIds));
      params.setBtstWarnCourseIds(new Set(courseIds));
    } catch {
      params.setBtstWarnActIds(new Set());
      params.setBtstWarnCourseIds(new Set());
    }
  }, [
    params.activities,
    params.courses,
    params.profile,
    params.stStartISO,
    params.startYear,
    params.computeEducationalGaps,
    params.normalizeGoalsVersion,
    params.isoToDateSafe,
    params.dateToISO,
    params.addMonths,
    params.slotToYearMonthHalf,
    params.mondayNearestTo,
    params.sundayNearestTo,
    params.setDismissedGaps,
    params.setBtstWarnActIds,
    params.setBtstWarnCourseIds,
  ]);
}

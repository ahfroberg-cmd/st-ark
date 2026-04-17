"use client";

import { useMemo } from "react";
import { fteDays } from "@/lib/dateutils";
import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";
import { pickTrainingStartAnchorISO } from "@/lib/pussla/startAnchors";

export function usePusslaTimeProgressCore(params: {
  activities: any[];
  profile: any;
  stStartISO: string | null;
  stEndISO: string | null;
  workedWindowEndISO: string;
  isValidISO: (value: string) => boolean;
  isPlacementZeroAttendance: (placement: any) => boolean;
  displayDatesForActivity: (activity: any) => { startISO: string; endISO: string };
  clampRangeToWindow: (
    startISO: string,
    endISO: string,
    windowStartISO: string,
    windowEndISO: string
  ) => { startISO: string; endISO: string } | null;
  pickPercent: (placement: any) => number;
}) {
  const workedCombinedFteDays = useMemo(() => {
    const gv = normalizeGoalsVersion((params.profile as any)?.goalsVersion);
    const workedEnd = params.workedWindowEndISO;

    if (gv !== "2021") {
      const stStart = params.stStartISO;
      if (!stStart) return 0;

      return params.activities.reduce((acc, p: any) => {
        if (params.isPlacementZeroAttendance(p)) return acc;
        const d = params.displayDatesForActivity(p);
        const start = d.startISO || p.startDate || p.startISO || p.start || "";
        const end = d.endISO || p.endDate || p.endISO || p.end || workedEnd;
        const clipped = params.clampRangeToWindow(start, end, stStart, workedEnd);
        if (!clipped) return acc;
        const percent = params.pickPercent(p);
        const days = fteDays(clipped.startISO, clipped.endISO, percent);
        return acc + days;
      }, 0);
    }

    const btStart = pickTrainingStartAnchorISO({
      goalsVersion: "2021",
      btStartDate: (params.profile as any)?.btStartDate,
      stStartDate: params.stStartISO || (params.profile as any)?.stStartDate,
      isValidISO: params.isValidISO,
    });
    if (!btStart) return 0;

    return params.activities.reduce((acc, p: any) => {
      if (params.isPlacementZeroAttendance(p)) return acc;
      const d = params.displayDatesForActivity(p);
      const start = d.startISO || p.startDate || p.startISO || p.start || "";
      const end = d.endISO || p.endDate || p.endISO || p.end || workedEnd;
      const clipped = params.clampRangeToWindow(start, end, btStart, workedEnd);
      if (!clipped) return acc;
      const percent = params.pickPercent(p);
      const days = fteDays(clipped.startISO, clipped.endISO, percent);
      return acc + days;
    }, 0);
  }, [params]);

  const totalCombinedDays = useMemo(() => {
    const gv = normalizeGoalsVersion((params.profile as any)?.goalsVersion);

    if (gv !== "2021") {
      const stStart = params.stStartISO;
      if (!stStart || !params.stEndISO) return 0;
      return fteDays(stStart, params.stEndISO, 100);
    }

    const btStart = (params.profile as any)?.btStartDate;
    if (!btStart || !params.stEndISO) return 0;
    return fteDays(btStart, params.stEndISO, 100);
  }, [params]);

  const progressPct = useMemo(() => {
    if (!totalCombinedDays || totalCombinedDays <= 0) return 0;
    const raw = (workedCombinedFteDays / totalCombinedDays) * 100;
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, raw));
  }, [workedCombinedFteDays, totalCombinedDays]);

  return {
    workedCombinedFteDays,
    totalCombinedDays,
    progressPct,
  };
}

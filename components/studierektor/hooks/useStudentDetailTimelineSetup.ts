"use client";

import { useCallback, useMemo } from "react";
import {
  fteDaysBetween,
  isValidISODate,
  isZeroAttendancePlacementType,
  normalizeToISODate,
} from "@/lib/studierektor/dateUtils";

export function useStudentDetailTimelineSetup({
  placements,
  courses,
  profile,
  goalsVersion,
  plannedTotalMonths,
  addMonthsISO,
  dateToSlotSnapped,
}: {
  placements: any[];
  courses: any[];
  profile: any;
  goalsVersion: string;
  plannedTotalMonths: (profile: any, goalsVersion: "2015" | "2021") => number;
  addMonthsISO: (iso: string, months: number) => string;
  dateToSlotSnapped: (startYear: number, isoDate: string, mode?: "start" | "end") => number;
}) {
  const allActivities = useMemo(
    () =>
      [...placements, ...courses].sort((a, b) => {
        const dateA = new Date(a.startDate || a.certificateDate || "").getTime();
        const dateB = new Date(b.startDate || b.certificateDate || "").getTime();
        return dateA - dateB;
      }),
    [placements, courses]
  );

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          allActivities
            .map((a) => {
              const d = new Date(a.startDate || a.certificateDate || "");
              return d.getFullYear();
            })
            .filter((y) => !isNaN(y))
        )
      ).sort(),
    [allActivities]
  );

  const minYear = years[0] || new Date().getFullYear();
  const maxYear = years[years.length - 1] || new Date().getFullYear();

  const profileBtStartISO = normalizeToISODate(profile?.btStartDate);
  const profileStStartISO = normalizeToISODate(profile?.stStartDate);
  const profileStartISO = goalsVersion === "2021" ? profileBtStartISO || profileStStartISO : profileStStartISO;
  const startYearForSlots = profileStartISO ? new Date(profileStartISO + "T00:00:00").getFullYear() : minYear;

  const visibleStartSlot = profileStartISO ? dateToSlotSnapped(startYearForSlots, profileStartISO, "start") : null;

  const profileEndISO = useMemo(() => {
    const raw = (profile?.stEndDate || profile?.stEndISO || "") as string;
    const normalized = normalizeToISODate(raw);
    if (normalized) return normalized;
    const base = profileStStartISO || profileStartISO;
    const months = plannedTotalMonths(profile, goalsVersion as "2015" | "2021");
    return base ? addMonthsISO(base, months) : null;
  }, [profile, profileStStartISO, profileStartISO, plannedTotalMonths, goalsVersion, addMonthsISO]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const btEndISO = useMemo(() => {
    if (goalsVersion !== "2021") return null;
    if (!profileBtStartISO) return null;
    const manual = normalizeToISODate(profile?.btEndDate);
    const btEnd = manual || addMonthsISO(profileBtStartISO, 24);
    return isValidISODate(btEnd) ? btEnd : null;
  }, [goalsVersion, profileBtStartISO, profile, addMonthsISO]);

  const isPlacementBTPhase = useMemo(() => {
    if (goalsVersion !== "2021") return (_p: any) => false;
    if (!profileBtStartISO || !btEndISO) return (_p: any) => false;

    const btStartMs = new Date(profileBtStartISO + "T00:00:00").getTime();
    const btEndMs = new Date(btEndISO + "T00:00:00").getTime();

    return (p: any) => {
      if (p?.phase === "BT") return true;
      if (p?.phase === "ST") return false;
      const ref = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
      if (!ref) return false;
      const refMs = new Date(ref + "T00:00:00").getTime();
      if (!Number.isFinite(refMs) || !Number.isFinite(btStartMs) || !Number.isFinite(btEndMs)) return false;
      return refMs >= btStartMs && refMs < btEndMs;
    };
  }, [goalsVersion, profileBtStartISO, btEndISO]);

  const pickPercent = useCallback((p: any): number => {
    const v = Number(p?.attendance ?? p?.percent ?? p?.sysselsättning ?? 100);
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 100;
  }, []);

  const workedCombinedFteDays = useMemo(() => {
    if (!placements || placements.length === 0) return 0;
    const today = todayISO;

    if (goalsVersion !== "2021") {
      const stStart = profileStStartISO;
      if (!stStart) return 0;

      return (placements as any[]).reduce((acc, p) => {
        if (isZeroAttendancePlacementType(p?.type)) return acc;
        const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
        if (!start) return acc;
        const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || today) || today;
        const end = endRaw > today ? today : endRaw;
        const days = fteDaysBetween(start, end, pickPercent(p));
        return acc + days;
      }, 0);
    }

    const btStart = profileBtStartISO;
    if (!btStart) return 0;

    const btStartMs = new Date(btStart + "T00:00:00").getTime();

    return (placements as any[]).reduce((acc, p) => {
      if (isZeroAttendancePlacementType(p?.type)) return acc;
      const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
      if (!start) return acc;
      const startMs = new Date(start + "T00:00:00").getTime();
      if (!Number.isFinite(startMs) || startMs < btStartMs) return acc;
      const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || today) || today;
      const end = endRaw > today ? today : endRaw;
      const days = fteDaysBetween(start, end, pickPercent(p));
      return acc + days;
    }, 0);
  }, [placements, goalsVersion, profileStStartISO, profileBtStartISO, todayISO, pickPercent]);

  const endBoundarySlot =
    profileEndISO != null
      ? dateToSlotSnapped(startYearForSlots, profileEndISO, "end")
      : visibleStartSlot != null
        ? visibleStartSlot + 120
        : null;

  const btStartSlot = profileBtStartISO ? dateToSlotSnapped(startYearForSlots, profileBtStartISO, "start") : null;
  const btEndSlot = (() => {
    if (goalsVersion !== "2021") return null;
    if (!profileBtStartISO) return null;
    const manual = normalizeToISODate(profile?.btEndDate);
    const btEnd = manual || addMonthsISO(profileBtStartISO, 24);
    return isValidISODate(btEnd) ? dateToSlotSnapped(startYearForSlots, btEnd, "end") : null;
  })();
  const stStartSlot = profileStStartISO ? dateToSlotSnapped(startYearForSlots, profileStStartISO, "start") : null;
  const stEndSlot = profileEndISO ? dateToSlotSnapped(startYearForSlots, profileEndISO, "end") : null;

  const timelineEndYear =
    endBoundarySlot == null || !Number.isFinite(endBoundarySlot)
      ? maxYear
      : startYearForSlots + Math.floor(Math.max(0, endBoundarySlot - 1) / 24);

  const timelineYears = useMemo(() => {
    const out: number[] = [];
    for (let y = startYearForSlots; y <= timelineEndYear; y++) out.push(y);
    return out;
  }, [startYearForSlots, timelineEndYear]);

  return {
    allActivities,
    years,
    minYear,
    maxYear,
    profileBtStartISO,
    profileStStartISO,
    profileStartISO,
    startYearForSlots,
    visibleStartSlot,
    profileEndISO,
    todayISO,
    btEndISO,
    isPlacementBTPhase,
    pickPercent,
    workedCombinedFteDays,
    endBoundarySlot,
    btStartSlot,
    btEndSlot,
    stStartSlot,
    stEndSlot,
    timelineYears,
  };
}

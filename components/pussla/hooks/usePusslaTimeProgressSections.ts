"use client";

import { useMemo } from "react";
import { fteDays } from "@/lib/dateutils";
import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";

export function usePusslaTimeProgressSections(params: {
  profile: any;
  btEndISO: string | null;
  stStartISO: string | null;
  stEndISO: string | null;
  activities: any[];
  workedWindowEndISO: string;
  isZeroAttendanceType: (type: any) => boolean;
  displayDatesForActivity: (activity: any) => { startISO: string; endISO: string };
  clampRangeToWindow: (
    startISO: string,
    endISO: string,
    windowStartISO: string,
    windowEndISO: string
  ) => { startISO: string; endISO: string } | null;
}) {
  const timeDetails = useMemo(() => {
    const gv = normalizeGoalsVersion((params.profile as any)?.goalsVersion);
    const btStart = (params.profile as any)?.btStartDate;
    const btEnd = params.btEndISO;
    const workedEnd = params.workedWindowEndISO;
    const stStart = params.stStartISO || (gv === "2021" ? btEnd : null);

    if (gv === "2021" && btStart && btEnd && params.stEndISO) {
      let btDays = 0;
      let stDays = 0;

      for (const a of params.activities as any[]) {
        if (params.isZeroAttendanceType(a.type)) continue;

        const d = params.displayDatesForActivity(a);
        const percent = Number(a.attendance ?? 100);
        const stClip = params.clampRangeToWindow(d.startISO, d.endISO, btStart, workedEnd);
        if (!stClip) continue;
        const stDaysForActivity = fteDays(stClip.startISO, stClip.endISO, percent);
        stDays += stDaysForActivity;

        if (String(a.phase || "") === "BT") {
          const btWorkedEnd = btEnd < workedEnd ? btEnd : workedEnd;
          const btClip = params.clampRangeToWindow(d.startISO, d.endISO, btStart, btWorkedEnd);
          if (btClip) {
            btDays += fteDays(btClip.startISO, btClip.endISO, percent);
          }
        }
      }

      const totalBtDays = fteDays(btStart, btEnd, 100);
      const totalStDays = fteDays(btStart, params.stEndISO, 100);

      return {
        bt: { worked: btDays, total: totalBtDays },
        st: { worked: stDays, total: totalStDays },
      };
    }

    let stDays = 0;

    if (!stStart || !params.stEndISO) {
      return {
        bt: { worked: 0, total: 0 },
        st: { worked: 0, total: 0 },
      };
    }

    for (const a of params.activities as any[]) {
      if (params.isZeroAttendanceType(a.type)) continue;
      const d = params.displayDatesForActivity(a);
      const clipped = params.clampRangeToWindow(d.startISO, d.endISO, stStart, workedEnd);
      if (!clipped) continue;
      const percent = Number(a.attendance ?? 100);
      const days = fteDays(clipped.startISO, clipped.endISO, percent);
      stDays += days;
    }

    const totalStDays = fteDays(stStart, params.stEndISO, 100);

    return {
      bt: { worked: 0, total: 0 },
      st: { worked: stDays, total: totalStDays },
    };
  }, [params]);

  const timeByActivity = useMemo(() => {
    const gv = normalizeGoalsVersion((params.profile as any)?.goalsVersion);
    const btStart = (params.profile as any)?.btStartDate;
    const workedEnd = params.workedWindowEndISO;
    const stStart = params.stStartISO || (gv === "2021" ? params.btEndISO : null);

    const result: {
      bt: Array<{
        id: string;
        label: string;
        days: number;
        attendance: number;
        hue: number;
        startDate: string;
        endDate: string;
      }>;
      st: Array<{
        id: string;
        label: string;
        days: number;
        attendance: number;
        hue: number;
        startDate: string;
        endDate: string;
      }>;
    } = { bt: [], st: [] };

    const getHueForPlacement = (placementId: string): number => {
      const act = params.activities.find((a: any) => a.linkedPlacementId === placementId || a.id === placementId);
      if (typeof act?.hue === "number") return act.hue;
      const hash = String(placementId || "")
        .split("")
        .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0);
      return hash % 360;
    };

    let totalBtDays = 0;

    for (const a of params.activities as any[]) {
      if (params.isZeroAttendanceType(a.type)) continue;
      const d = params.displayDatesForActivity(a);

      const windowStart = gv === "2021" ? btStart : stStart;
      if (!windowStart) continue;
      const clipped = params.clampRangeToWindow(d.startISO, d.endISO, windowStart, workedEnd);
      if (!clipped) continue;

      const percent = Number(a.attendance ?? 100);
      const days = fteDays(clipped.startISO, clipped.endISO, percent);
      if (days <= 0) continue;

      const label = a.label || a.clinic || a.title || a.type || "Aktivitet";
      const hue = getHueForPlacement(a.id);

      const item = {
        id: a.id,
        label,
        days,
        attendance: percent,
        hue,
        startDate: clipped.startISO,
        endDate: clipped.endISO,
      };

      if (gv === "2021" && btStart) {
        void stStart;
        if (String(a.phase || "") === "BT") {
          result.bt.push(item);
          totalBtDays += days;
        } else {
          result.st.push(item);
        }
      } else {
        result.st.push(item);
      }
    }

    if (gv === "2021" && totalBtDays > 0) {
      result.st.unshift({
        id: "bt-aggregated",
        label: "BT (Bastjänstgöring)",
        days: totalBtDays,
        attendance: 100,
        hue: 200,
        startDate: btStart || "",
        endDate: params.btEndISO || "",
      });
    }

    result.bt.sort((a, b) => a.startDate.localeCompare(b.startDate));
    result.st.sort((a, b) => a.startDate.localeCompare(b.startDate));

    return result;
  }, [params]);

  return {
    timeDetails,
    timeByActivity,
  };
}

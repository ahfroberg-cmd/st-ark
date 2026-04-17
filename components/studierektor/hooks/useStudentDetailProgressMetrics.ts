"use client";

import { useMemo } from "react";
import { COMMON_AB_MILESTONES } from "@/lib/goals-common";
import { milestoneRequires } from "@/lib/milestoneRequirements";
import {
  fteDaysBetween,
  isZeroAttendancePlacementType,
  normalizeToISODate,
} from "@/lib/studierektor/dateUtils";
import type { GoalsCatalog } from "@/lib/goals";

export function useStudentDetailProgressMetrics({
  placements,
  courses,
  achievements,
  goalsCatalog,
  goalsVersion,
  profileBtStartISO,
  profileStStartISO,
  profileEndISO,
  btEndISO,
  todayISO,
  pickPercent,
  isPlacementBTPhase,
  placementHueById,
}: {
  placements: any[];
  courses: any[];
  achievements: any[];
  goalsCatalog: GoalsCatalog | null;
  goalsVersion: string;
  profileBtStartISO: string | null;
  profileStStartISO: string | null;
  profileEndISO: string | null;
  btEndISO: string | null;
  todayISO: string;
  pickPercent: (p: any) => number;
  isPlacementBTPhase: (p: any) => boolean;
  placementHueById: Map<string, number>;
}) {
  const totalCombinedDays = useMemo(() => {
    if (!profileEndISO) return 0;
    if (goalsVersion !== "2021") {
      const stStart = profileStStartISO;
      if (!stStart) return 0;
      return fteDaysBetween(stStart, profileEndISO, 100);
    }
    const btStart = profileBtStartISO;
    if (!btStart) return 0;
    return fteDaysBetween(btStart, profileEndISO, 100);
  }, [goalsVersion, profileBtStartISO, profileStStartISO, profileEndISO]);

  const progressPct = useMemo(() => {
    if (!totalCombinedDays || totalCombinedDays <= 0) return 0;
    const baseStartISO = goalsVersion === "2021" ? profileBtStartISO : profileStStartISO;
    if (!baseStartISO || !profileEndISO) return 0;
    const workedEnd = profileEndISO < todayISO ? profileEndISO : todayISO;
    const workedDays = fteDaysBetween(baseStartISO, workedEnd, 100);
    const raw = (workedDays / totalCombinedDays) * 100;
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, raw));
  }, [todayISO, goalsVersion, profileBtStartISO, profileStStartISO, profileEndISO, totalCombinedDays]);

  const timeDetails = useMemo(() => {
    if (!profileEndISO) {
      return {
        bt: { worked: 0, total: 0 },
        st: { worked: 0, total: 0 },
      };
    }

    if (goalsVersion === "2021" && profileBtStartISO && btEndISO) {
      const totalBtDays = fteDaysBetween(profileBtStartISO, btEndISO, 100);
      const totalStDays = fteDaysBetween(profileBtStartISO, profileEndISO, 100);

      let btDays = 0;
      let stDays = 0;

      const btStartMs = new Date(profileBtStartISO + "T00:00:00").getTime();
      for (const p of placements as any[]) {
        if (isZeroAttendancePlacementType(p?.type)) continue;
        const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
        if (!start) continue;
        const startMs = new Date(start + "T00:00:00").getTime();
        if (!Number.isFinite(startMs) || startMs < btStartMs) continue;

        const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || todayISO) || todayISO;
        const end = endRaw > todayISO ? todayISO : endRaw;
        const days = fteDaysBetween(start, end, pickPercent(p));

        stDays += days;
        if (isPlacementBTPhase(p)) btDays += days;
      }

      return {
        bt: { worked: btDays, total: totalBtDays },
        st: { worked: stDays, total: totalStDays },
      };
    }

    const stStart = profileStStartISO;
    if (!stStart) {
      return {
        bt: { worked: 0, total: 0 },
        st: { worked: 0, total: 0 },
      };
    }

    let stDays = 0;
    for (const p of placements as any[]) {
      if (isZeroAttendancePlacementType(p?.type)) continue;
      const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
      if (!start) continue;
      const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || todayISO) || todayISO;
      const end = endRaw > todayISO ? todayISO : endRaw;
      const days = fteDaysBetween(start, end, pickPercent(p));
      stDays += days;
    }

    const totalStDays = fteDaysBetween(stStart, profileEndISO, 100);
    return {
      bt: { worked: 0, total: 0 },
      st: { worked: stDays, total: totalStDays },
    };
  }, [profileEndISO, goalsVersion, profileBtStartISO, btEndISO, placements, todayISO, pickPercent, isPlacementBTPhase, profileStStartISO]);

  const timeByActivity = useMemo(() => {
    const result: {
      bt: Array<{ id: string; label: string; days: number; attendance: number; hue: number; startDate: string; endDate: string }>;
      st: Array<{ id: string; label: string; days: number; attendance: number; hue: number; startDate: string; endDate: string }>;
    } = { bt: [], st: [] };

    const today = todayISO;

    for (const p of placements as any[]) {
      if (isZeroAttendancePlacementType(p?.type)) continue;
      const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
      if (!start) continue;
      const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || today) || today;
      const end = endRaw > today ? today : endRaw;
      const percent = pickPercent(p);
      const days = fteDaysBetween(start, end, percent);
      if (days <= 0) continue;

      const label = p?.clinic || p?.title || p?.type || "Aktivitet";
      const idStr = String(p?.id ?? "");
      const fallbackHue = ((idStr.split("").reduce((acc, ch) => (acc + ch.charCodeAt(0)) % 360, 0) * 37) % 360);
      const hue = placementHueById.get(idStr) ?? (p as any)?.hue ?? fallbackHue;

      const item = {
        id: String(p?.id ?? ""),
        label,
        days,
        attendance: percent,
        hue,
        startDate: start,
        endDate: end,
      };

      if (goalsVersion === "2021" && profileBtStartISO) {
        const btStartMs = new Date(profileBtStartISO + "T00:00:00").getTime();
        const startMs = new Date(start + "T00:00:00").getTime();
        if (!Number.isFinite(startMs) || startMs < btStartMs) continue;
        result.st.push(item);
        if (isPlacementBTPhase(p)) result.bt.push(item);
      } else {
        result.st.push(item);
      }
    }

    result.bt.sort((a, b) => a.startDate.localeCompare(b.startDate));
    result.st.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return result;
  }, [placements, todayISO, pickPercent, goalsVersion, profileBtStartISO, isPlacementBTPhase, placementHueById]);

  const milestoneDetails = useMemo(() => {
    const today = todayISO;
    const is2021 = goalsVersion === "2021";

    const normalizeBtCode = (x: unknown) => {
      const s = String(x ?? "").trim();
      const m = s.match(/^BT[\s\-_]*([0-9]+)/i);
      return m ? "BT" + m[1] : null;
    };

    const normalizeStId = (x: unknown): string | null => {
      const s = String(x ?? "").trim();
      if (!s) return null;
      return s.split("-")[0].toUpperCase().replace(/\s|_/g, "");
    };

    const addWithAliases = (set: Set<string>, id: string) => {
      const code = id.toUpperCase().replace(/\s|_/g, "");
      set.add(code);
      const m1 = code.match(/^ST([ABC])(\d+)$/i);
      if (m1) set.add(`${m1[1].toUpperCase()}${m1[2]}`);
      const m2 = code.match(/^([ABC])(\d+)$/i);
      if (m2) set.add(`ST${m2[1].toUpperCase()}${m2[2]}`);
    };

    const stFromPlacements = new Set<string>();
    const stFromCourses = new Set<string>();

    for (const a of achievements as any[]) {
      const cand = [a.milestoneId, a.goalId, a.id, a.code, a.milestone].filter(Boolean);
      for (const c of cand) {
        const id = normalizeStId(c);
        if (!id || normalizeBtCode(id)) continue;
        if (!(/^ST[ABC]\d+$/i.test(id) || /^[ABC]\d+$/i.test(id))) continue;
        if (a.placementId) {
          const pl = (placements as any[]).find((p) => String(p?.id) === String(a.placementId));
          const end = normalizeToISODate(pl?.endDate || pl?.endISO || pl?.end || "");
          if (end && end < today) addWithAliases(stFromPlacements, id);
        }
        if (a.courseId) {
          const cr = (courses as any[]).find((x) => String(x?.id) === String(a.courseId));
          const date = normalizeToISODate(cr?.certificateDate || cr?.endDate || "");
          if (date && date < today) addWithAliases(stFromCourses, id);
        }
      }
    }

    for (const p of placements as any[]) {
      const end = normalizeToISODate(p?.endDate || p?.endISO || p?.end || "");
      if (!end || end >= today) continue;
      const arrs = [p?.milestones, p?.goals, p?.goalIds, p?.milestoneIds];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          const id = normalizeStId(v);
          if (id && !normalizeBtCode(id)) addWithAliases(stFromPlacements, id);
        }
      }
    }

    for (const c of courses as any[]) {
      const date = normalizeToISODate(c?.certificateDate || c?.endDate || "");
      if (!date || date >= today) continue;
      const arrs = [c?.milestones, c?.goals, c?.goalIds, c?.milestoneIds];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          const id = normalizeStId(v);
          if (id && !normalizeBtCode(id)) addWithAliases(stFromCourses, id);
        }
      }
    }

    let totalStKlin = 0;
    let totalStKurs = 0;
    let fulfilledStKlin = 0;
    let fulfilledStKurs = 0;

    if (goalsCatalog && Array.isArray((goalsCatalog as any).milestones)) {
      const allMilestones = (goalsCatalog as any).milestones as any[];
      const stMilestonesForCount: any[] = allMilestones.filter((m: any) => {
        const code = normalizeStId((m as any).code ?? (m as any).id ?? "");
        if (!code) return false;
        return /^ST[ABC]\d+$/i.test(code) || /^[ABC]\d+$/i.test(code);
      });

      const existingKeys = new Set(
        stMilestonesForCount
          .map((m: any) => normalizeStId((m as any).code ?? (m as any).id ?? ""))
          .filter(Boolean) as string[]
      );

      const commonCandidates = Object.values(COMMON_AB_MILESTONES) as any[];
      for (const cm of commonCandidates) {
        const code = normalizeStId((cm as any).code ?? (cm as any).id ?? "");
        if (!code) continue;
        const ok = is2021 ? /^ST[AB]\d+$/i.test(code) : /^[AB]\d+$/i.test(code);
        if (!ok) continue;
        if (!existingKeys.has(code)) {
          existingKeys.add(code);
          stMilestonesForCount.push(cm);
        }
      }

      const hasAnyAlias = (set: Set<string>, code: string): boolean => {
        const k = code.toUpperCase().replace(/\s|_/g, "");
        if (set.has(k)) return true;
        const m1 = k.match(/^ST([ABC])(\d+)$/i);
        if (m1 && set.has(`${m1[1].toUpperCase()}${m1[2]}`)) return true;
        const m2 = k.match(/^([ABC])(\d+)$/i);
        if (m2 && set.has(`ST${m2[1].toUpperCase()}${m2[2]}`)) return true;
        return false;
      };

      for (const m of stMilestonesForCount) {
        const code = normalizeStId((m as any).code ?? (m as any).id ?? "");
        if (!code) continue;
        const req = milestoneRequires(m);
        const hasKlinReq = !!(req.klin || req.arb);
        const hasKursReq = !!req.kurs;
        const isFulfilledByPlacement = hasAnyAlias(stFromPlacements, code);
        const isFulfilledByCourse = hasAnyAlias(stFromCourses, code);
        if (hasKlinReq) {
          totalStKlin++;
          if (isFulfilledByPlacement) fulfilledStKlin++;
        }
        if (hasKursReq) {
          totalStKurs++;
          if (isFulfilledByCourse) fulfilledStKurs++;
        }
      }
    }

    const hasCalculatedTotals = totalStKlin > 0 || totalStKurs > 0;
    const totalStParts = hasCalculatedTotals ? totalStKlin + totalStKurs : is2021 ? 46 : 50;
    const fulfilledStParts = hasCalculatedTotals ? fulfilledStKlin + fulfilledStKurs : stFromPlacements.size + stFromCourses.size;
    const totalStMilestones = hasCalculatedTotals ? Math.max(totalStKlin, totalStKurs) : is2021 ? 23 : 50;
    const stFulfilledMilestones = hasCalculatedTotals ? (fulfilledStKlin + fulfilledStKurs) / 2 : fulfilledStParts;

    return {
      bt: { fulfilled: 0, total: is2021 ? 18 : 0 },
      st: {
        fulfilled: fulfilledStParts,
        total: totalStParts,
        fulfilledMilestones: stFulfilledMilestones,
        totalMilestones: totalStMilestones,
      },
    };
  }, [todayISO, goalsVersion, achievements, placements, courses, goalsCatalog]);

  const milestoneProgressPct = useMemo(() => {
    const total = Number((milestoneDetails as any)?.st?.total ?? 0);
    const fulfilled = Number((milestoneDetails as any)?.st?.fulfilled ?? 0);
    if (!total || total <= 0) return 0;
    const raw = (fulfilled / total) * 100;
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, raw));
  }, [milestoneDetails]);

  return {
    progressPct,
    timeDetails,
    timeByActivity,
    milestoneDetails,
    milestoneProgressPct,
  };
}

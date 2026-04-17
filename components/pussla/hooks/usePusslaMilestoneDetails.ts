"use client";

import { useMemo } from "react";
import { COMMON_AB_MILESTONES } from "@/lib/goals-common";
import { milestoneRequires } from "@/lib/milestoneRequirements";
import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";

export function usePusslaMilestoneDetails(params: {
  profile: any;
  dbAchievements: any[];
  dbPlacements: any[];
  dbCourses: any[];
  goalsCatalog: any;
  todayISO: () => string;
}) {
  return useMemo(() => {
    const gv = normalizeGoalsVersion((params.profile as any)?.goalsVersion);
    const is2021 = gv === "2021";
    const today = params.todayISO();

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

    const btFulfilled = new Set<string>();
    if (is2021) {
      for (const a of params.dbAchievements) {
        const cand = [a.goalId, a.milestoneId, a.id, (a as any).code, (a as any).milestone].filter(Boolean);
        for (const c of cand) {
          const code = normalizeBtCode(c);
          if (code) btFulfilled.add(code);
        }
      }

      for (const p of params.dbPlacements as any[]) {
        const end = p.endDate || p.endISO || p.end || "";
        if (!end || end >= today) continue;
        const arrs = [p?.btMilestones, p?.btGoals, p?.milestones, p?.goals, p?.goalIds, p?.milestoneIds];
        for (const arr of arrs) {
          if (!arr) continue;
          for (const v of arr as any[]) {
            const code = normalizeBtCode(v);
            if (code) btFulfilled.add(code);
          }
        }
      }

      for (const c of params.dbCourses as any[]) {
        const cert = c.certificateDate || "";
        const end = c.endDate || "";
        const date = cert || end;
        if (!date || date >= today) continue;
        const arrs = [c?.btMilestones, c?.btGoals, c?.milestones, c?.goals, c?.goalIds, c?.milestoneIds];
        for (const arr of arrs) {
          if (!arr) continue;
          for (const v of arr as any[]) {
            const code = normalizeBtCode(v);
            if (code) btFulfilled.add(code);
          }
        }
      }
    }

    const stFulfilled = new Set<string>();
    const stMilestoneIdsFromPlacements = new Set<string>();
    const stMilestoneIdsFromCourses = new Set<string>();

    const addWithAliases = (set: Set<string>, id: string) => {
      set.add(id);
      const m1 = id.match(/^ST([ABC])(\d+)$/i);
      if (m1) set.add(`${m1[1].toUpperCase()}${m1[2]}`);
      const m2 = id.match(/^([ABC])(\d+)$/i);
      if (m2) set.add(`ST${m2[1].toUpperCase()}${m2[2]}`);
    };

    for (const a of params.dbAchievements as any[]) {
      const cand = [a.milestoneId, a.goalId, a.id, a.code, a.milestone].filter(Boolean);
      for (const c of cand) {
        const id = normalizeStId(c);
        if (!id || normalizeBtCode(id)) continue;
        const looksLikeStMilestone = /^ST[ABC]\d+$/i.test(id) || /^[ABC]\d+$/i.test(id);
        if (!looksLikeStMilestone) continue;

        if (a.placementId) {
          const pl = (params.dbPlacements as any[])?.find((p) => p.id === a.placementId);
          const end = pl?.endDate || pl?.endISO || pl?.end || "";
          if (end && end < today) {
            addWithAliases(stMilestoneIdsFromPlacements, id);
          }
        } else if (a.courseId) {
          const co = (params.dbCourses as any[])?.find((c2) => c2.id === a.courseId);
          const cert = co?.certificateDate || "";
          const end = co?.endDate || "";
          const date = cert || end;
          if (date && date < today) {
            addWithAliases(stMilestoneIdsFromCourses, id);
          }
        }
      }
    }

    for (const p of params.dbPlacements as any[]) {
      const end = p.endDate || p.endISO || p.end || "";
      if (!end || end >= today) continue;
      const arrs = [p?.milestones, p?.goals, p?.goalIds, p?.milestoneIds];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          const id = normalizeStId(v);
          if (id && !normalizeBtCode(id)) {
            addWithAliases(stMilestoneIdsFromPlacements, id);
          }
        }
      }
    }

    for (const c of params.dbCourses as any[]) {
      const cert = c.certificateDate || "";
      const end = c.endDate || "";
      const date = cert || end;
      if (!date || date >= today) continue;
      const arrs = [c?.milestones, c?.goals, c?.goalIds, c?.milestoneIds];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          const id = normalizeStId(v);
          if (id && !normalizeBtCode(id)) {
            addWithAliases(stMilestoneIdsFromCourses, id);
          }
        }
      }
    }

    const allStMilestoneIds = new Set<string>();
    for (const id of stMilestoneIdsFromPlacements) allStMilestoneIds.add(id);
    for (const id of stMilestoneIdsFromCourses) allStMilestoneIds.add(id);

    if (is2021 && params.goalsCatalog && Array.isArray((params.goalsCatalog as any).milestones)) {
      const allSt = (params.goalsCatalog as any).milestones as any[];
      const hasStc = allSt.some((m: any) => /^STc\d+$/i.test(String((m as any).code ?? (m as any).id ?? "")));

      if (hasStc) {
        const stMilestones = allSt.filter((m: any) => {
          const code = String((m as any).code ?? (m as any).id ?? "").toUpperCase();
          return /^ST[ABC]\d+$/i.test(code);
        });

        const existingKeys = new Set(
          stMilestones.map((m: any) =>
            String((m as any).code ?? (m as any).id ?? "")
              .toUpperCase()
              .replace(/\s+/g, "")
          )
        );

        Object.values(COMMON_AB_MILESTONES).forEach((cm: any) => {
          const codeRaw = String(cm.code ?? cm.id ?? "");
          if (/^ST[AB]\d+$/i.test(codeRaw)) {
            const codeKey = codeRaw.toUpperCase().replace(/\s+/g, "");
            if (!existingKeys.has(codeKey)) {
              stMilestones.push(cm);
            }
          }
        });

        for (const m of stMilestones) {
          const code = String((m as any).code ?? (m as any).id ?? "").toUpperCase().replace(/\s+/g, "");
          const hasPlacement = stMilestoneIdsFromPlacements.has(code);
          const hasCourse = stMilestoneIdsFromCourses.has(code);

          if (hasPlacement) stFulfilled.add(`${code}-klin`);
          if (hasCourse) stFulfilled.add(`${code}-kurs`);
        }
      } else {
        for (const id of allStMilestoneIds) stFulfilled.add(id);
      }
    } else {
      for (const id of allStMilestoneIds) stFulfilled.add(id);
    }

    let totalStKlin = 0;
    let totalStKurs = 0;
    let fulfilledStKlin = 0;
    let fulfilledStKurs = 0;

    if (params.goalsCatalog && Array.isArray((params.goalsCatalog as any).milestones)) {
      const allMilestones = (params.goalsCatalog as any).milestones as any[];
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
        if (set.has(code)) return true;
        const m1 = code.match(/^ST([ABC])(\d+)$/i);
        if (m1 && set.has(`${m1[1].toUpperCase()}${m1[2]}`)) return true;
        const m2 = code.match(/^([ABC])(\d+)$/i);
        if (m2 && set.has(`ST${m2[1].toUpperCase()}${m2[2]}`)) return true;
        return false;
      };

      for (const m of stMilestonesForCount) {
        const code = normalizeStId((m as any).code ?? (m as any).id ?? "");
        if (!code) continue;

        const req = milestoneRequires(m);
        const hasKlinReq = !!(req.klin || req.arb);
        const hasKursReq = !!req.kurs;

        const isFulfilledByPlacement = hasAnyAlias(stMilestoneIdsFromPlacements, code);
        const isFulfilledByCourse = hasAnyAlias(stMilestoneIdsFromCourses, code);

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
    const fulfilledStParts = hasCalculatedTotals ? fulfilledStKlin + fulfilledStKurs : stFulfilled.size;
    const totalStMilestones = hasCalculatedTotals ? Math.max(totalStKlin, totalStKurs) : is2021 ? 23 : 50;
    const stFulfilledMilestones = hasCalculatedTotals ? (fulfilledStKlin + fulfilledStKurs) / 2 : stFulfilled.size;

    return {
      bt: { fulfilled: btFulfilled.size, total: is2021 ? 18 : 0 },
      st: {
        fulfilled: fulfilledStParts,
        total: totalStParts,
        fulfilledMilestones: stFulfilledMilestones,
        totalMilestones: totalStMilestones,
      },
    };
  }, [params]);
}

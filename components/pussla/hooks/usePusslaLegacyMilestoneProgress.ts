"use client";

import { useMemo } from "react";
import { COMMON_AB_MILESTONES } from "@/lib/goals-common";
import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";

export function usePusslaLegacyMilestoneProgress(params: {
  profile: any;
  dbAchievements: any[];
  dbPlacements: any[];
  dbCourses: any[];
  goalsCatalog: any;
  todayISO: () => string;
}) {
  const totalMilestones = useMemo(() => {
    const gv = normalizeGoalsVersion((params.profile as any)?.goalsVersion);
    if (gv === "2021") return 64;
    return 50;
  }, [params.profile]);

  const fulfilledMilestones = useMemo(() => {
    const fulfilled = new Set<string>();
    const gv = normalizeGoalsVersion((params.profile as any)?.goalsVersion);
    const is2021 = gv === "2021";

    const normalizeBtCode = (x: unknown) => {
      const s = String(x ?? "").trim();
      const m = s.match(/^BT[\s\-_]*([0-9]+)/i);
      return m ? "BT" + m[1] : null;
    };

    const normalizeStId = (x: unknown): string | null => {
      const s = String(x ?? "").trim();
      if (!s) return null;
      return s.toUpperCase().replace(/\s+/g, "");
    };

    const today = params.todayISO();

    if (is2021) {
      for (const a of params.dbAchievements) {
        const cand = [a.goalId, a.milestoneId, a.id, (a as any).code, (a as any).milestone].filter(Boolean);
        for (const c of cand) {
          const code = normalizeBtCode(c);
          if (code) fulfilled.add(code);
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
            if (code) fulfilled.add(code);
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
            if (code) fulfilled.add(code);
          }
        }
      }
    }

    {
      const stMilestoneIdsFromPlacements = new Set<string>();
      const stMilestoneIdsFromCourses = new Set<string>();
      const stMilestoneIdsFromAchievements = new Set<string>();

      for (const a of params.dbAchievements) {
        const id = normalizeStId(a.milestoneId);
        if (id && !normalizeBtCode(id)) {
          stMilestoneIdsFromAchievements.add(id);
        }
      }

      for (const p of params.dbPlacements as any[]) {
        const end = p.endDate || p.endISO || p.end || "";
        if (!end || end >= today) continue;
        const arr = p?.milestones || p?.goals || p?.goalIds || p?.milestoneIds || [];
        for (const v of arr as any[]) {
          const id = normalizeStId(v);
          if (id && !normalizeBtCode(id)) {
            stMilestoneIdsFromPlacements.add(id);
          }
        }
      }

      for (const c of params.dbCourses as any[]) {
        const cert = c.certificateDate || "";
        const end = c.endDate || "";
        const date = cert || end;
        if (!date || date >= today) continue;
        const arr = c?.milestones || c?.goals || c?.goalIds || c?.milestoneIds || [];
        for (const v of arr as any[]) {
          const id = normalizeStId(v);
          if (id && !normalizeBtCode(id)) {
            stMilestoneIdsFromCourses.add(id);
          }
        }
      }

      const allStMilestoneIds = new Set<string>();
      for (const id of stMilestoneIdsFromAchievements) allStMilestoneIds.add(id);
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
            const hasPlacement = stMilestoneIdsFromPlacements.has(code) || stMilestoneIdsFromAchievements.has(code);
            const hasCourse = stMilestoneIdsFromCourses.has(code) || stMilestoneIdsFromAchievements.has(code);

            if (hasPlacement) fulfilled.add(`${code}-klin`);
            if (hasCourse) fulfilled.add(`${code}-kurs`);
          }
        } else {
          for (const id of allStMilestoneIds) fulfilled.add(id);
        }
      } else {
        for (const id of allStMilestoneIds) fulfilled.add(id);
      }
    }

    return fulfilled.size;
  }, [params.profile, params.dbAchievements, params.dbPlacements, params.dbCourses, params.goalsCatalog, params.todayISO]);

  return {
    totalMilestones,
    fulfilledMilestones,
  };
}

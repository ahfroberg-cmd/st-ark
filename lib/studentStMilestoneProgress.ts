// Copyright (c) 2024 ST-ARK
// ST-delmålsgrad (%) i linje med StudentDetailModal / tidslinjen.

import { milestoneRequires } from "@/lib/milestoneRequirements";
import { COMMON_AB_MILESTONES } from "@/lib/goals-common";
import type { GoalsCatalog } from "@/lib/goals";
import type { SupervisorStudent } from "@/lib/mappers/studentData";

function isValidISODateString(s: string): boolean {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return !isNaN(d.getTime());
}

function toISODate(y: number, m1: number, d: number) {
  const yy = String(y).padStart(4, "0");
  const mm = String(m1).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function normalizeToISODate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return toISODate(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  const s = String(v).trim();
  if (!s) return null;
  if (isValidISODateString(s)) return s;
  if (s.length >= 10 && isValidISODateString(s.slice(0, 10))) return s.slice(0, 10);
  const m1 = s.match(/^\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*$/);
  if (m1) {
    const d = Number(m1[1]);
    const m = Number(m1[2]);
    const y = Number(m1[3]);
    if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return toISODate(y, m, d);
  }
  const m2 = s.match(/^\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*$/);
  if (m2) {
    const y = Number(m2[1]);
    const m = Number(m2[2]);
    const d = Number(m2[3]);
    if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return toISODate(y, m, d);
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return toISODate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }
  return null;
}

function normalizeBtCode(x: unknown) {
  const s = String(x ?? "").trim();
  const m = s.match(/^BT[\s\-_]*([0-9]+)/i);
  return m ? "BT" + m[1] : null;
}

function normalizeStId(x: unknown): string | null {
  const s = String(x ?? "").trim();
  if (!s) return null;
  return s.split("-")[0].toUpperCase().replace(/\s|_/g, "");
}

function addWithAliases(set: Set<string>, id: string) {
  const code = id.toUpperCase().replace(/\s|_/g, "");
  set.add(code);
  const m1 = code.match(/^ST([ABC])(\d+)$/i);
  if (m1) set.add(`${m1[1].toUpperCase()}${m1[2]}`);
  const m2 = code.match(/^([ABC])(\d+)$/i);
  if (m2) set.add(`ST${m2[1].toUpperCase()}${m2[2]}`);
}

/**
 * Andel genomförda ST-delmål (viktad klin+kurs) i linje med detaljvyn i tidslinjen.
 * Kräver goalsCatalog; annars 0.
 */
export function computeStMilestoneProgressPct(student: SupervisorStudent, goalsCatalog: GoalsCatalog | null): number {
  const todayISO = new Date().toISOString().slice(0, 10);
  const goalsVersion = student.goalsVersion;
  const is2021 = goalsVersion === "2021";
  const placements = student.placements || [];
  const courses = student.courses || [];
  const achievements = student.achievements || [];

  const stFromPlacements = new Set<string>();
  const stFromCourses = new Set<string>();

  for (const a of achievements as any[]) {
    const cand = [a.milestoneId, a.goalId, a.id, a.code, a.milestone].filter(Boolean);
    for (const c of cand) {
      const id = normalizeStId(c);
      if (!id || normalizeBtCode(id)) continue;
      if (!(/^ST[ABC]\d+$/i.test(id) || /^[ABC]\d+$/i.test(id))) continue;
      if (a.placementId) {
        const pl = placements.find((p) => String(p?.id) === String(a.placementId));
        const end = normalizeToISODate(pl?.endDate || pl?.endISO || pl?.end || "");
        if (end && end < todayISO) addWithAliases(stFromPlacements, id);
      }
      if (a.courseId) {
        const cr = courses.find((x) => String(x?.id) === String(a.courseId));
        const date = normalizeToISODate(cr?.certificateDate || cr?.endDate || "");
        if (date && date < todayISO) addWithAliases(stFromCourses, id);
      }
    }
  }

  for (const p of placements as any[]) {
    const end = normalizeToISODate(p?.endDate || p?.endISO || p?.end || "");
    if (!end || end >= todayISO) continue;
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
    if (!date || date >= todayISO) continue;
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
  const fulfilledStParts = hasCalculatedTotals
    ? fulfilledStKlin + fulfilledStKurs
    : stFromPlacements.size + stFromCourses.size;

  if (!totalStParts || totalStParts <= 0) return 0;
  const raw = (fulfilledStParts / totalStParts) * 100;
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

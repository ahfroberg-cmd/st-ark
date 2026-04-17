// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

import type { SupervisorStudent } from "@/lib/mappers/studentData";
import {
  fteDaysBetween,
  isValidISODate,
  normalizeToISODate,
} from "@/lib/studierektor/dateUtils";
import { monthsLeftFromEndISO } from "@/lib/studierektor/warningRules";
import type { WarningRule } from "@/lib/studierektor/warningRuleTypes";

export function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function plannedTotalMonths(profile: any, goalsVersion: "2015" | "2021"): number {
  const fromProfile = Number(profile?.stTotalMonths);
  if (Number.isFinite(fromProfile) && fromProfile > 0) return fromProfile;
  return goalsVersion === "2021" ? 66 : 60;
}

export function calculateMonths(
  startDate: string,
  endDate: string,
  attendance: number = 100
): number {
  if (!startDate || !endDate) return 0;
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.round(months * (attendance / 100) * 10) / 10;
  } catch {
    return 0;
  }
}

export function calculateProgress(student: SupervisorStudent): number {
  const todayISO = new Date().toISOString().slice(0, 10);

  const profile: any = student.profile || {};
  const goalsVersion = student.goalsVersion;
  const profileBtStartISO = normalizeToISODate(profile?.btStartDate);
  const profileStStartISO = normalizeToISODate(profile?.stStartDate);

  const baseStartISO =
    goalsVersion === "2021" ? (profileBtStartISO || null) : (profileStStartISO || null);
  if (!baseStartISO) return 0;

  const profileEndISO = (() => {
    const raw = (profile?.stEndDate || profile?.stEndISO || "") as string;
    const normalized = normalizeToISODate(raw);
    if (normalized) return normalized;
    const base = profileStStartISO || (goalsVersion === "2021" ? profileBtStartISO : null);
    const months = plannedTotalMonths(profile, goalsVersion);
    return base ? addMonthsISO(base, months) : null;
  })();

  if (!profileEndISO || !isValidISODate(profileEndISO)) return 0;

  const workedEnd = profileEndISO < todayISO ? profileEndISO : todayISO;
  const workedDays = fteDaysBetween(baseStartISO, workedEnd, 100);
  const totalDays = fteDaysBetween(baseStartISO, profileEndISO, 100);
  if (!totalDays || totalDays <= 0) return 0;
  const pct = (workedDays / totalDays) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function mainSupervisorLabel(student: SupervisorStudent): string {
  const p: any = student.profile || {};
  return (
    p.mainSupervisor ||
    p.primarySupervisor ||
    p.huvudhandledare ||
    p.huvudHandledare ||
    p.supervisor ||
    p.handledare ||
    "-"
  );
}

export function placementLabel(pl: any): string {
  return String(pl?.clinic || pl?.label || pl?.title || pl?.type || "-");
}

export function getStudentPhaseLabel(student: SupervisorStudent): "BT" | "ST" {
  if (student.goalsVersion !== "2021") return "ST";
  const profile: any = student.profile || {};
  const btStartISO = normalizeToISODate(profile?.btStartDate);
  const btEndISO =
    normalizeToISODate(profile?.btEndDate) || (btStartISO ? addMonthsISO(btStartISO, 24) : null);
  const todayISO = new Date().toISOString().slice(0, 10);
  if (btStartISO && btEndISO && todayISO >= btStartISO && todayISO <= btEndISO) {
    return "BT";
  }
  return "ST";
}

export function getOngoingPlacement(student: SupervisorStudent): any | null {
  const today = new Date();
  const placements = student.placements || [];
  const ongoing = placements
    .map((p: any) => {
      const s = p?.startDate ? new Date(String(p.startDate)) : null;
      const e = p?.endDate ? new Date(String(p.endDate)) : null;
      return { p, s, e };
    })
    .filter(({ s, e }) => s && !Number.isNaN(s.getTime()) && e && !Number.isNaN(e.getTime()))
    .filter(({ s, e }) => (s as Date) <= today && today <= (e as Date))
    .sort((a, b) => (a.s as Date).getTime() - (b.s as Date).getTime());
  return ongoing.length ? ongoing[ongoing.length - 1].p : null;
}

export function getNextPlacement(student: SupervisorStudent): any | null {
  const today = new Date();
  const placements = student.placements || [];
  const upcoming = placements
    .map((p: any) => {
      const s = p?.startDate ? new Date(String(p.startDate)) : null;
      return { p, s };
    })
    .filter(({ s }) => s && !Number.isNaN((s as Date).getTime()))
    .filter(({ s }) => (s as Date) > today)
    .sort((a, b) => (a.s as Date).getTime() - (b.s as Date).getTime());
  return upcoming.length ? upcoming[0].p : null;
}

export function getStudentStartISO(student: SupervisorStudent): string | null {
  const profile: any = student.profile || {};
  const bt = normalizeToISODate(profile?.btStartDate);
  const st = normalizeToISODate(profile?.stStartDate);
  const start = student.goalsVersion === "2021" ? (bt || st) : st;
  return start || null;
}

export function getStudentPlannedEndISO(student: SupervisorStudent): string | null {
  const profile: any = student.profile || {};
  const raw = (profile?.stEndDate || profile?.stEndISO || "") as string;
  const normalized = normalizeToISODate(raw);
  if (normalized) return normalized;
  const stStart = normalizeToISODate(profile?.stStartDate);
  const base = stStart || getStudentStartISO(student);
  const months = plannedTotalMonths(profile, student.goalsVersion);
  return base ? addMonthsISO(base, months) : null;
}

function idHashU32(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

export function spreadStudentColors(students: SupervisorStudent[]): Map<string, string> {
  const items = (students || [])
    .map((s) => ({ id: String(s.id || ""), h: idHashU32(String(s.id || "")) }))
    .filter((x) => !!x.id)
    .sort((a, b) => a.h - b.h);

  const n = items.length;
  const step = n > 0 ? 360 / n : 360;
  const offset = 12;
  const out = new Map<string, string>();

  for (let i = 0; i < n; i++) {
    const hue = (offset + i * step) % 360;
    out.set(items[i].id, `hsl(${hue} 70% 45%)`);
  }
  return out;
}

export function evaluateRulePassForRow(
  row: {
    endISO: string;
    student: SupervisorStudent;
    delmalPct: number;
    klinProgressPct: number;
    kursProgressPct: number;
    arbeteProgressPct: number;
    mandatoryPct: number;
  },
  rule: WarningRule
): { applicable: boolean; pass: boolean } {
  if (!rule.enabled) return { applicable: false, pass: true };
  const endISO = row.endISO || getStudentPlannedEndISO(row.student) || "";
  const monthsLeft = monthsLeftFromEndISO(endISO);
  const threshold = Number(rule.params.monthsLeftThreshold ?? 6);
  const inWindow = monthsLeft != null && monthsLeft <= threshold;
  if (!inWindow) return { applicable: false, pass: true };
  const minProgress = Number(rule.params.minProgressPercent ?? 70);
  if (rule.type === "milestone_overall") {
    return { applicable: true, pass: row.delmalPct >= minProgress };
  }
  if (rule.type === "milestone_activity") {
    const kind = rule.params.activityKind || "placering";
    const current =
      kind === "kurs" ? row.kursProgressPct : kind === "arbete" ? row.arbeteProgressPct : row.klinProgressPct;
    return { applicable: true, pass: current >= minProgress };
  }
  if (rule.type === "mandatory_placement") {
    return { applicable: true, pass: row.mandatoryPct >= 100 };
  }
  return { applicable: false, pass: true };
}

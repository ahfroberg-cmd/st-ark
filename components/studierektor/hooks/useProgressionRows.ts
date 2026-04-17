"use client";

import { useMemo } from "react";
import type { SupervisorStudent } from "@/lib/mappers/studentData";

interface PlacementTemplateOption {
  title: string;
  suggestedMinMonths?: number;
  alternatives: string[];
}

export interface ProgressionRow {
  student: SupervisorStudent;
  endISO: string;
  progressMeta: {
    status: "ok" | "risk" | "late";
    statusLabel: string;
    statusClass: string;
    riskReasons: string[];
    timeText: string;
  };
  delmalPct: number;
  mandatoryPct: number;
  mandatoryCoursePct: number | null;
  mandatoryCourseDone: number;
  mandatoryCourseTotal: number;
  klinProgressPct: number;
  kursProgressPct: number;
  arbeteProgressPct: number;
  meetingStats: {
    total: number;
    completedTotal: number;
    lastYearCompleted: number;
    lastYearWithPlanned: number;
    avgPerYearCompleted: number;
    avgPerYearWithPlanned: number;
  };
  assessmentStats: {
    total: number;
    completedTotal: number;
    lastYearCompleted: number;
    lastYearWithPlanned: number;
    avgPerYearCompleted: number;
    avgPerYearWithPlanned: number;
  };
  courseStats: {
    total: number;
    completedTotal: number;
    lastYearCompleted: number;
    lastYearWithPlanned: number;
    avgPerYearCompleted: number;
    avgPerYearWithPlanned: number;
  };
}

export function useProgressionRows({
  students,
  getStudentPlannedEndISO,
  computeProgressTimelineStatus,
  calculateProgress,
  normalizeToISODate,
  isValidISODate,
  placementTemplateOptions,
}: {
  students: SupervisorStudent[];
  getStudentPlannedEndISO: (student: SupervisorStudent) => string | null;
  computeProgressTimelineStatus: (
    student: SupervisorStudent | null,
    endISOInput: string
  ) => {
    status: "ok" | "risk" | "late";
    statusLabel: string;
    statusClass: string;
    riskReasons: string[];
    timeText: string;
  };
  calculateProgress: (student: SupervisorStudent) => number;
  normalizeToISODate: (value: string) => string | null;
  isValidISODate: (value: string) => boolean;
  placementTemplateOptions: PlacementTemplateOption[];
}) {
  return useMemo<ProgressionRow[]>(() => {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoISO = oneYearAgo.toISOString().slice(0, 10);
    const oneYearAhead = new Date(today);
    oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
    const oneYearAheadISO = oneYearAhead.toISOString().slice(0, 10);

    const getValidDateList = (items: any[], keys: string[]): string[] => {
      const out: string[] = [];
      for (const item of items || []) {
        for (const key of keys) {
          const iso = normalizeToISODate((item as any)?.[key]);
          if (iso) {
            out.push(iso);
            break;
          }
        }
      }
      return out;
    };

    const summarizeActivity = (dates: string[], stStartISO: string | null) => {
      const total = dates.length;
      const completedDates = dates.filter((d) => d <= todayISO);
      const completedTotal = completedDates.length;
      const lastYearCompleted = completedDates.filter((d) => d >= oneYearAgoISO).length;
      const plannedNextYear = dates.filter((d) => d > todayISO && d <= oneYearAheadISO).length;
      if (!stStartISO || !isValidISODate(stStartISO)) {
        return {
          total,
          completedTotal,
          lastYearCompleted,
          lastYearWithPlanned: lastYearCompleted + plannedNextYear,
          avgPerYearCompleted: Number(completedTotal.toFixed(1)),
          avgPerYearWithPlanned: Number(total.toFixed(1)),
        };
      }
      const elapsedMonths = Math.max(
        0.25,
        (new Date(`${todayISO}T00:00:00`).getTime() - new Date(`${stStartISO}T00:00:00`).getTime()) /
          (1000 * 60 * 60 * 24 * 30.4375)
      );
      const denom = Math.max(0.25, elapsedMonths / 12);
      const avgPerYearCompleted = completedTotal / denom;
      const avgPerYearWithPlanned = total / denom;
      return {
        total,
        completedTotal,
        lastYearCompleted,
        lastYearWithPlanned: lastYearCompleted + plannedNextYear,
        avgPerYearCompleted,
        avgPerYearWithPlanned,
      };
    };

    return students
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "sv"))
      .map((student) => {
        const endISO = getStudentPlannedEndISO(student) || "";
        const progressMeta = computeProgressTimelineStatus(student, endISO);
        const delmalPct = calculateProgress(student);
        const profile: any = student.profile || {};
        const stStartISO = normalizeToISODate(profile?.stStartDate || profile?.st_start_date || "");
        const iupRow = (student as any)?.iupSettings || {};
        const meetings = Array.isArray(iupRow?.meetings) ? iupRow.meetings : [];
        const assessments = Array.isArray(iupRow?.assessments) ? iupRow.assessments : [];
        const courses = Array.isArray((student as any)?.courses) ? ((student as any).courses as any[]) : [];

        const meetingStats = summarizeActivity(getValidDateList(meetings, ["dateISO", "date", "iso"]), stStartISO);
        const assessmentStats = summarizeActivity(getValidDateList(assessments, ["dateISO", "date", "iso"]), stStartISO);
        const courseStats = summarizeActivity(
          getValidDateList(courses, [
            "endDate",
            "end_date",
            "startDate",
            "start_date",
            "certificateDate",
            "certificate_date",
          ]),
          stStartISO
        );

        const mandatoryTemplates = placementTemplateOptions.filter((t) => Number(t.suggestedMinMonths || 0) > 0);
        const placements = Array.isArray((student as any)?.placements) ? ((student as any).placements as any[]) : [];
        const placementMonthsByTemplateTitle = new Map<string, number>();
        const addPlacementMonths = (title: string, months: number) => {
          const key = String(title || "").trim().toLowerCase();
          if (!key || !Number.isFinite(months) || months <= 0) return;
          placementMonthsByTemplateTitle.set(key, (placementMonthsByTemplateTitle.get(key) || 0) + months);
        };
        for (const p of placements) {
          const s = normalizeToISODate(p?.startDate || "");
          const e = normalizeToISODate(p?.endDate || p?.startDate || "");
          if (!s || !e) continue;
          const spanDays =
            Math.max(
              1,
              Math.round(
                (new Date(`${e}T00:00:00`).getTime() - new Date(`${s}T00:00:00`).getTime()) /
                  (1000 * 60 * 60 * 24)
              ) + 1
            );
          const months = spanDays / 30.4375;
          const label = String(p?.clinic || p?.title || "").trim().toLowerCase();
          if (!label) continue;
          for (const t of mandatoryTemplates) {
            const templateKey = String(t.title || "").trim().toLowerCase();
            if (templateKey && label.includes(templateKey)) addPlacementMonths(templateKey, months);
          }
        }
        const neighbors = new Map<string, Set<string>>();
        const minMonthsByTemplate = new Map<string, number>();
        for (const t of mandatoryTemplates) {
          const key = String(t.title || "").trim().toLowerCase();
          const minMonths = Number(t.suggestedMinMonths || 0);
          if (!key || !Number.isFinite(minMonths) || minMonths <= 0) continue;
          minMonthsByTemplate.set(key, minMonths);
          if (!neighbors.has(key)) neighbors.set(key, new Set<string>());
          for (const alt of t.alternatives || []) {
            const altKey = String(alt || "").trim().toLowerCase();
            if (!altKey) continue;
            if (!neighbors.has(altKey)) neighbors.set(altKey, new Set<string>());
            neighbors.get(key)?.add(altKey);
            neighbors.get(altKey)?.add(key);
          }
        }
        const visited = new Set<string>();
        let mandatoryTotalMonths = 0;
        let mandatoryCompletedMonths = 0;
        for (const key of minMonthsByTemplate.keys()) {
          if (visited.has(key)) continue;
          const queue = [key];
          visited.add(key);
          const group: string[] = [];
          while (queue.length) {
            const current = queue.shift() as string;
            group.push(current);
            for (const n of neighbors.get(current) || []) {
              if (!minMonthsByTemplate.has(n) || visited.has(n)) continue;
              visited.add(n);
              queue.push(n);
            }
          }
          const requiredMonths = group.reduce(
            (acc, titleKey) => Math.max(acc, Number(minMonthsByTemplate.get(titleKey) || 0)),
            0
          );
          const completedMonths = group.reduce(
            (acc, titleKey) => acc + Number(placementMonthsByTemplateTitle.get(titleKey) || 0),
            0
          );
          mandatoryTotalMonths += requiredMonths;
          mandatoryCompletedMonths += Math.min(requiredMonths, completedMonths);
        }
        const mandatoryPct =
          mandatoryTotalMonths > 0
            ? Math.max(0, Math.min(100, Math.round((mandatoryCompletedMonths / mandatoryTotalMonths) * 100)))
            : 0;
        const allPlacements = Array.isArray((student as any)?.placements) ? ((student as any).placements as any[]) : [];
        const workPlacements = allPlacements.filter((p) => String(p?.type || "").toLowerCase().includes("arbete"));
        const klinPlacements = allPlacements.filter((p) => !String(p?.type || "").toLowerCase().includes("arbete"));
        const completedPct = (arr: any[]) => {
          if (!arr.length) return 0;
          const done = arr.filter((x: any) => (x?.milestones || []).length > 0 || x?.fulfillsStGoals).length;
          return Math.max(0, Math.min(100, Math.round((done / arr.length) * 100)));
        };
        const klinProgressPct = completedPct(klinPlacements);
        const kursProgressPct = completedPct(courses);
        const arbeteProgressPct = completedPct(workPlacements);

        const requiredCourses = courses.filter((c: any) => {
          const reqLevel = String(c?.requirementLevel || c?.templateRequirementLevel || "").toLowerCase();
          return Boolean(
            c?.mandatory ||
              c?.isMandatory ||
              c?.required ||
              c?.isRequired ||
              c?.obligatory ||
              c?.obligatorisk ||
              reqLevel === "obligatorisk"
          );
        });
        const completedRequiredCourses = requiredCourses.filter((c: any) => {
          const status = String(c?.status || "").toLowerCase();
          if (status === "done" || status === "completed" || status === "avklarad") return true;
          const cert = normalizeToISODate(c?.certificateDate || c?.certificate_date || "");
          if (cert && cert <= todayISO) return true;
          const end = normalizeToISODate(c?.endDate || c?.end_date || c?.startDate || c?.start_date || "");
          return !!(end && end <= todayISO);
        });
        const mandatoryCoursePct =
          requiredCourses.length > 0
            ? Math.max(0, Math.min(100, Math.round((completedRequiredCourses.length / requiredCourses.length) * 100)))
            : null;

        return {
          student,
          endISO,
          progressMeta,
          delmalPct,
          mandatoryPct,
          mandatoryCoursePct,
          mandatoryCourseDone: completedRequiredCourses.length,
          mandatoryCourseTotal: requiredCourses.length,
          klinProgressPct,
          kursProgressPct,
          arbeteProgressPct,
          meetingStats,
          assessmentStats,
          courseStats,
        };
      });
  }, [
    students,
    getStudentPlannedEndISO,
    computeProgressTimelineStatus,
    calculateProgress,
    normalizeToISODate,
    isValidISODate,
    placementTemplateOptions,
  ]);
}

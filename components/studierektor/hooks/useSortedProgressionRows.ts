"use client";

import { useMemo } from "react";
import { getProgressionMetricValue, type ProgressionPeriodMode, type ProgressionScopeMode } from "@/lib/studierektor/progression";
import type { ProgressionTableSortKey } from "@/components/studierektor/ProgressionMotSluttidTable";
import type { ProgressionRow } from "@/components/studierektor/hooks/useProgressionRows";

export function useSortedProgressionRows({
  progressionRows,
  progressionTableSort,
  progressionPeriodMode,
  progressionScopeMode,
}: {
  progressionRows: ProgressionRow[];
  progressionTableSort: { key: ProgressionTableSortKey; dir: "asc" | "desc" };
  progressionPeriodMode: ProgressionPeriodMode;
  progressionScopeMode: ProgressionScopeMode;
}) {
  return useMemo(() => {
    const rows = [...progressionRows];
    const mult = progressionTableSort.dir === "asc" ? 1 : -1;
    const cmp = (a: ProgressionRow, b: ProgressionRow): number => {
      switch (progressionTableSort.key) {
        case "name":
          return mult * String(a.student.name || "").localeCompare(String(b.student.name || ""), "sv");
        case "progression":
          return mult * (a.delmalPct - b.delmalPct);
        case "meetings":
          return (
            mult *
            (getProgressionMetricValue(a.meetingStats, progressionPeriodMode, progressionScopeMode) -
              getProgressionMetricValue(b.meetingStats, progressionPeriodMode, progressionScopeMode))
          );
        case "assessments":
          return (
            mult *
            (getProgressionMetricValue(a.assessmentStats, progressionPeriodMode, progressionScopeMode) -
              getProgressionMetricValue(b.assessmentStats, progressionPeriodMode, progressionScopeMode))
          );
        case "courses":
          return (
            mult *
            (getProgressionMetricValue(a.courseStats, progressionPeriodMode, progressionScopeMode) -
              getProgressionMetricValue(b.courseStats, progressionPeriodMode, progressionScopeMode))
          );
        case "mandatoryPct":
          return mult * (a.mandatoryPct - b.mandatoryPct);
        case "delmalPct":
          return mult * (a.delmalPct - b.delmalPct);
        default:
          return 0;
      }
    };
    rows.sort((a, b) => {
      const primary = cmp(a, b);
      if (primary !== 0) return primary;
      return String(a.student.name || "").localeCompare(String(b.student.name || ""), "sv");
    });
    return rows;
  }, [progressionRows, progressionTableSort, progressionPeriodMode, progressionScopeMode]);
}

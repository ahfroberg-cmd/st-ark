"use client";

import { useMemo } from "react";
import { meanFinite, medianFinite } from "@/lib/studierektor/warningRules";
import { computeStMilestoneProgressPct } from "@/lib/studentStMilestoneProgress";
import type { GoalsCatalog } from "@/lib/goals";
import type { WarningRule } from "@/lib/studierektor/warningRuleTypes";
import type { SupervisorStudent } from "@/lib/mappers/studentData";
import type { ProgressionRow } from "@/components/studierektor/hooks/useProgressionRows";

export function useWholeGroupProgressionStats({
  progressionRows,
  warningRules,
  groupGoalsCatalogs,
  evaluateRulePassForRow,
}: {
  progressionRows: ProgressionRow[];
  warningRules: WarningRule[];
  groupGoalsCatalogs: Map<string, GoalsCatalog>;
  evaluateRulePassForRow: (
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
  ) => { applicable: boolean; pass: boolean };
}) {
  return useMemo(() => {
    const rows = progressionRows;
    const n = rows.length;
    const catalogFor = (st: SupervisorStudent) => {
      const gv = String(st.goalsVersion || "2015");
      const sp = String(st.specialty || "").trim() || "Psykiatri";
      return groupGoalsCatalogs.get(`${gv}|${sp}`) || null;
    };
    const timePcts = rows.map((r) => r.delmalPct);
    const milestonePcts = rows.map((r) => computeStMilestoneProgressPct(r.student, catalogFor(r.student)));
    const combinedPerStudent = rows.map((_, i) => (timePcts[i] + milestonePcts[i]) / 2);
    const meetPerYear = rows.map((r) => r.meetingStats.avgPerYearCompleted);
    const assessPerYear = rows.map((r) => r.assessmentStats.avgPerYearCompleted);
    const meetLastYear = rows.map((r) => r.meetingStats.lastYearCompleted);
    const assessLastYear = rows.map((r) => r.assessmentStats.lastYearCompleted);
    const statusCount = { ok: 0, risk: 0, late: 0 };
    for (const r of rows) {
      const s = r.progressMeta.status;
      if (s === "ok") statusCount.ok++;
      else if (s === "risk") statusCount.risk++;
      else if (s === "late") statusCount.late++;
    }
    const ruleStats = warningRules.map((rule) => {
      let applicable = 0;
      let pass = 0;
      for (const row of rows) {
        const o = evaluateRulePassForRow(row, rule);
        if (o.applicable) {
          applicable++;
          if (o.pass) pass++;
        }
      }
      return { rule, applicable, pass };
    });
    return {
      n,
      timeProgress: { mean: meanFinite(timePcts), median: medianFinite(timePcts) },
      milestoneProgress: { mean: meanFinite(milestonePcts), median: medianFinite(milestonePcts) },
      totalCombined: { mean: meanFinite(combinedPerStudent), median: medianFinite(combinedPerStudent) },
      meetPerYear: { mean: meanFinite(meetPerYear), median: medianFinite(meetPerYear) },
      assessPerYear: { mean: meanFinite(assessPerYear), median: medianFinite(assessPerYear) },
      meetLastYear: { mean: meanFinite(meetLastYear), median: medianFinite(meetLastYear) },
      assessLastYear: { mean: meanFinite(assessLastYear), median: medianFinite(assessLastYear) },
      statusCount,
      ruleStats,
    };
  }, [evaluateRulePassForRow, groupGoalsCatalogs, progressionRows, warningRules]);
}

export type ProgressionPeriodMode = "total" | "last_year" | "avg_year";
export type ProgressionScopeMode = "completed" | "with_planned";

export type ProgressionActivityStats = {
  total: number;
  completedTotal: number;
  lastYearCompleted: number;
  lastYearWithPlanned: number;
  avgPerYearCompleted: number;
  avgPerYearWithPlanned: number;
};

export function getProgressionMetricValue(
  stats: ProgressionActivityStats,
  periodMode: ProgressionPeriodMode,
  scopeMode: ProgressionScopeMode
): number {
  if (periodMode === "total") {
    return scopeMode === "with_planned" ? stats.total : stats.completedTotal;
  }
  if (periodMode === "last_year") {
    return scopeMode === "with_planned" ? stats.lastYearWithPlanned : stats.lastYearCompleted;
  }
  return scopeMode === "with_planned" ? stats.avgPerYearWithPlanned : stats.avgPerYearCompleted;
}

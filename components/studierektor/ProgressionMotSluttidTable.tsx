"use client";

import {
  getProgressionMetricValue,
  type ProgressionActivityStats,
  type ProgressionPeriodMode,
  type ProgressionScopeMode,
} from "@/lib/studierektor/progression";

export type ProgressionTableSortKey =
  | "name"
  | "progression"
  | "meetings"
  | "assessments"
  | "courses"
  | "mandatoryPct"
  | "delmalPct";

type ProgressionRow = {
  student: { id: string | number; name: string };
  progressMeta: { status: "ok" | "risk" | "late"; timeText: string };
  meetingStats: ProgressionActivityStats;
  assessmentStats: ProgressionActivityStats;
  courseStats: ProgressionActivityStats;
  mandatoryPct: number;
  delmalPct: number;
};

export default function ProgressionMotSluttidTable({
  rows,
  progressionPeriodMode,
  progressionScopeMode,
  progressionTableSort,
  onToggleSort,
  onOpenDetail,
}: {
  rows: ProgressionRow[];
  progressionPeriodMode: ProgressionPeriodMode;
  progressionScopeMode: ProgressionScopeMode;
  progressionTableSort: { key: ProgressionTableSortKey; dir: "asc" | "desc" };
  onToggleSort: (key: ProgressionTableSortKey) => void;
  onOpenDetail: (studentId: string) => void;
}) {
  const periodLabel =
    progressionPeriodMode === "total"
      ? "Totalt"
      : progressionPeriodMode === "last_year"
        ? "Sista året (rullande 12 mån)"
        : "Snitt per år (sedan ST-start)";
  const metricLabel = `${periodLabel} • ${progressionScopeMode === "with_planned" ? "Med planerat" : "Genomfört"}`;
  const getMetricValue = (stats: ProgressionActivityStats) =>
    getProgressionMetricValue(stats, progressionPeriodMode, progressionScopeMode);

  const sortTh = (label: string, sortKey: ProgressionTableSortKey) => (
    <th scope="col" className="px-2.5 py-1 text-xs font-semibold text-slate-900">
      <button
        type="button"
        className="inline-flex w-full min-w-0 items-center gap-1 rounded px-0.5 py-0.5 text-left font-semibold text-slate-900 hover:bg-slate-100"
        onClick={() => onToggleSort(sortKey)}
        aria-sort={
          progressionTableSort.key === sortKey
            ? progressionTableSort.dir === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
      >
        <span className="min-w-0 flex-1">{label}</span>
        {progressionTableSort.key === sortKey ? (
          <span className="shrink-0 text-slate-500" aria-hidden>
            {progressionTableSort.dir === "asc" ? "▲" : "▼"}
          </span>
        ) : null}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[720px] table-fixed text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-left">
          <tr>
            {sortTh("ST-läkare", "name")}
            {sortTh("Progression", "progression")}
            {sortTh("Handl. samtal", "meetings")}
            {sortTh("Progr. bed.", "assessments")}
            {sortTh("Kurser", "courses")}
            {sortTh("% obl. plac.", "mandatoryPct")}
            {sortTh("% delmål", "delmalPct")}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => {
            const statusLabel =
              row.progressMeta.status === "ok"
                ? "I fas"
                : row.progressMeta.status === "risk"
                  ? "Risk för förlängning"
                  : "Behöver förlänga";
            const barColorClass =
              row.progressMeta.status === "ok"
                ? "bg-emerald-500"
                : row.progressMeta.status === "risk"
                  ? "bg-amber-500"
                  : "bg-red-500";
            const meetingsValue = getMetricValue(row.meetingStats);
            const assessmentsValue = getMetricValue(row.assessmentStats);
            const coursesValue = getMetricValue(row.courseStats);
            const formatValue = (value: number) =>
              progressionPeriodMode === "avg_year" ? value.toFixed(1) : String(Math.round(value));

            return (
              <tr
                key={String(row.student.id)}
                role="button"
                tabIndex={0}
                className="cursor-pointer bg-white transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500"
                aria-label={`Öppna progressionsdetaljer för ${row.student.name}`}
                onClick={() => onOpenDetail(String(row.student.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenDetail(String(row.student.id));
                  }
                }}
              >
                <td className="px-2.5 py-1.5 align-middle text-xs font-semibold text-slate-900">{row.student.name}</td>
                <td className="px-2.5 py-1.5 align-middle">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 rounded-full bg-slate-200" title={`${statusLabel} • ${row.progressMeta.timeText}`}>
                        <div
                          className={`h-2 rounded-full ${barColorClass}`}
                          style={{ width: `${Math.max(2, Math.min(100, row.delmalPct))}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">{row.progressMeta.timeText}</div>
                  </div>
                </td>
                <td className="px-2.5 py-1.5 align-middle text-xs text-slate-800" title={metricLabel}>
                  {formatValue(meetingsValue)}
                </td>
                <td className="px-2.5 py-1.5 align-middle text-xs text-slate-800" title={metricLabel}>
                  {formatValue(assessmentsValue)}
                </td>
                <td className="px-2.5 py-1.5 align-middle text-xs text-slate-800" title={metricLabel}>
                  {formatValue(coursesValue)}
                </td>
                <td className="px-2.5 py-1.5 align-middle text-xs text-slate-800">{row.mandatoryPct}%</td>
                <td className="px-2.5 py-1.5 align-middle text-xs text-slate-800">{row.delmalPct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

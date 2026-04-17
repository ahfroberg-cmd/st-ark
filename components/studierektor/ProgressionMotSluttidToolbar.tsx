"use client";

import type { ProgressionPeriodMode, ProgressionScopeMode } from "@/lib/studierektor/progression";

export default function ProgressionMotSluttidToolbar({
  onOpenWholeGroup,
  progressionPeriodMode,
  setProgressionPeriodMode,
  progressionScopeMode,
  setProgressionScopeMode,
}: {
  onOpenWholeGroup: () => void;
  progressionPeriodMode: ProgressionPeriodMode;
  setProgressionPeriodMode: (mode: ProgressionPeriodMode) => void;
  progressionScopeMode: ProgressionScopeMode;
  setProgressionScopeMode: (mode: ProgressionScopeMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={onOpenWholeGroup}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
      >
        Hela gruppen
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-300 p-1">
          <button
            type="button"
            onClick={() => setProgressionPeriodMode("total")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              progressionPeriodMode === "total" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Totalt
          </button>
          <button
            type="button"
            onClick={() => setProgressionPeriodMode("last_year")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              progressionPeriodMode === "last_year" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Sista året
          </button>
          <button
            type="button"
            onClick={() => setProgressionPeriodMode("avg_year")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              progressionPeriodMode === "avg_year" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Snitt/år
          </button>
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 p-1">
          <button
            type="button"
            onClick={() => setProgressionScopeMode("completed")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              progressionScopeMode === "completed" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Genomfört
          </button>
          <button
            type="button"
            onClick={() => setProgressionScopeMode("with_planned")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              progressionScopeMode === "with_planned" ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Med planerat
          </button>
        </div>
      </div>
    </div>
  );
}

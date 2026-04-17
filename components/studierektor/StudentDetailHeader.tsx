"use client";

import type { SupervisorStudent } from "@/lib/mappers/studentData";

export default function StudentDetailHeader({
  student,
  formerStLakare,
  showFlyttaTillTidigare,
  formerActionBusy,
  onClose,
  onFlyttaTillTidigare,
  onReactivateFormer,
}: {
  student: SupervisorStudent;
  formerStLakare: boolean;
  showFlyttaTillTidigare: boolean;
  formerActionBusy: boolean;
  onClose: () => void;
  onFlyttaTillTidigare?: () => void | Promise<void>;
  onReactivateFormer?: () => void | Promise<void>;
}) {
  return (
    <div className="border-b border-slate-200 px-6 pt-5 pb-0">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{student.name}</h2>
          <p className="text-sm text-slate-600">
            Målversion {student.goalsVersion}
            {formerStLakare ? (
              <span className="ml-2 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                Tidigare ST-läkare
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {formerStLakare && onReactivateFormer ? (
            <button
              type="button"
              onClick={() => void onReactivateFormer()}
              disabled={formerActionBusy}
              className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {formerActionBusy ? "Arbetar…" : "Återaktivera som ST-läkare"}
            </button>
          ) : null}
          {showFlyttaTillTidigare && onFlyttaTillTidigare ? (
            <button
              type="button"
              onClick={() => void onFlyttaTillTidigare()}
              disabled={formerActionBusy}
              className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {formerActionBusy ? "Arbetar…" : "Flytta till tidigare ST-läkare"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

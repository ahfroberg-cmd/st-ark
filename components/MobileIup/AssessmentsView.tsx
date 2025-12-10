// components/MobileIup/AssessmentsView.tsx
"use client";

import React from "react";
import type { IupAssessment } from "@/components/IupModal";
import type { Profile } from "@/lib/types";

type Props = {
  assessments: IupAssessment[];
  editingId: string | null;
  instruments: string[];
  profile: Profile | null;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onUpdate: (assessment: IupAssessment) => void;
  onRemove: (id: string) => void;
  onCloseEdit: () => void;
  onOpenInstruments: () => void;
};

function isFutureDate(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d > today;
}

export default function AssessmentsView({
  assessments,
  editingId,
  instruments,
  profile,
  onAdd,
  onEdit,
  onRemove,
  onOpenInstruments,
}: Props) {
  const isGoals2021 = String(profile?.goalsVersion || "").trim() === "2021";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Progressionsbedömningar</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenInstruments}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:translate-y-px"
          >
            Instrument
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-5 py-3 text-base font-semibold text-white hover:bg-sky-700 active:translate-y-px"
          >
            + Ny bedömning
          </button>
        </div>
      </div>

      {assessments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-base text-slate-500">
          Inga progressionsbedömningar registrerade ännu.
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => {
            const planned = isFutureDate(a.dateISO);
            return (
              <div
                key={a.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-slate-900">
                        {a.instrument || "Progressionsbedömning"}
                      </h3>
                      {isGoals2021 && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {a.phase}
                        </span>
                      )}
                      {planned && (
                        <span className="shrink-0 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                          Planerat
                        </span>
                      )}
                    </div>
                    <div className="mb-3 space-y-1 text-sm text-slate-600">
                      <div>{a.dateISO || "Datum saknas"}</div>
                      {a.level && <div>Klinisk tjänstgöring: {a.level}</div>}
                    </div>
                    {a.summary && (
                      <p className="mb-3 text-base text-slate-700 line-clamp-2">
                        {a.summary}
                      </p>
                    )}
                    {(a.strengths || a.development) && (
                      <div className="space-y-1 text-sm text-slate-600">
                        {a.strengths && (
                          <p className="line-clamp-1">
                            <span className="font-medium">Styrkor:</span> {a.strengths}
                          </p>
                        )}
                        {a.development && (
                          <p className="line-clamp-1">
                            <span className="font-medium">Utveckling:</span> {a.development}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(a.id)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:translate-y-px"
                    >
                      Redigera
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(a.id)}
                      className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 active:translate-y-px"
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


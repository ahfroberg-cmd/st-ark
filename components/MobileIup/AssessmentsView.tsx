// components/MobileIup/AssessmentsView.tsx
"use client";

import React, { useState, useEffect } from "react";
import type { IupAssessment } from "@/components/IupModal";
import type { Profile } from "@/lib/types";
import { db } from "@/lib/db";

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
  const [placements, setPlacements] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const pls = await db.placements.toArray();
        setPlacements(pls || []);
      } catch {
        setPlacements([]);
      }
    })();
  }, []);

  const getPlacementType = (assessment: IupAssessment): string | null => {
    if (!assessment.level || !assessment.dateISO) return null;
    const matching = placements.find((p: any) => {
      const clinicMatch = (p.clinic || p.title || "").trim() === assessment.level.trim();
      const dateMatch = p.startDate <= assessment.dateISO && p.endDate >= assessment.dateISO;
      return clinicMatch && dateMatch;
    });
    return matching?.type || matching?.kind || matching?.category || null;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenInstruments}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 active:translate-y-px"
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

      {assessments.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-base text-slate-500">
          Inga progressionsbedömningar registrerade ännu.
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => {
            const planned = isFutureDate(a.dateISO);
            const placementType = getPlacementType(a);
            const isSpecialType = placementType && 
              (placementType.includes("Vetenskapligt arbete") || 
               placementType.includes("Förbättringsarbete") ||
               placementType.includes("Tjänstledighet") ||
               placementType.includes("Föräldraledighet") ||
               placementType.includes("Annan ledighet") ||
               placementType.includes("Sjukskriven"));
            const displayLevel = isSpecialType ? placementType : (a.level || "");
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onEdit(a.id)}
                className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-left hover:bg-slate-50 active:bg-slate-100"
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
                      {displayLevel && <div>{displayLevel}</div>}
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(a.id);
                    }}
                    className="rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 active:translate-y-px shrink-0"
                  >
                    Ta bort
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


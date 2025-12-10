// components/MobileIup/AssessmentEditModal.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import type { IupAssessment, IupAssessmentPhase } from "@/components/IupModal";
import type { Profile } from "@/lib/types";

type Props = {
  open: boolean;
  assessment: IupAssessment | null;
  instruments: string[];
  profile: Profile | null;
  onSave: (assessment: IupAssessment) => void;
  onClose: () => void;
};

function isoToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function cloneAssessment(a: IupAssessment): IupAssessment {
  return { ...a };
}

export default function AssessmentEditModal({
  open,
  assessment,
  instruments,
  profile,
  onSave,
  onClose,
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<IupAssessment | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open || !assessment) return;
    setDraft(cloneAssessment(assessment));
    setDirty(false);
  }, [open, assessment]);

  // Förifyll klinisk tjänstgöring utifrån placeringar om fältet är tomt
  useEffect(() => {
    if (!open) return;
    if (!draft || !draft.dateISO) return;
    if ((draft.level ?? "").trim() !== "") return;

    let cancelled = false;

    (async () => {
      try {
        const allPlacements = await db.placements.toArray();
        const date = draft.dateISO;
        const match = allPlacements.find(
          (p: any) => p.startDate <= date && p.endDate >= date
        );
        if (!cancelled && match && (!draft.level || draft.level.trim() === "")) {
          setDraft((prev) =>
            prev
              ? {
                  ...prev,
                  level: match.clinic,
                }
              : prev
          );
        }
      } catch (e) {
        console.error(
          "Kunde inte föreslå klinisk tjänstgöring för progressionsbedömning:",
          e
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, draft?.dateISO]);

  const handleRequestClose = useCallback(() => {
    if (dirty) {
      const ok = window.confirm(
        "Du har osparade ändringar i denna progressionsbedömning. Vill du stänga utan att spara?"
      );
      if (!ok) return;
    }
    onClose();
  }, [dirty, onClose]);

  const handleSave = useCallback(() => {
    if (!draft) return;
    onSave(draft);
    setDirty(false);
    onClose();
  }, [draft, onSave, onClose]);

  const updateDraft = (patch: Partial<IupAssessment>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setDirty(true);
      return next;
    });
  };

  if (!open || !assessment || !draft) return null;

  const isGoals2021 = String(profile?.goalsVersion || "").trim() === "2021";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-emerald-50 px-5 py-4">
          <h2 className="text-xl font-extrabold text-emerald-900">Progressionsbedömning</h2>
          <button
            type="button"
            onClick={handleRequestClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px shrink-0"
            title="Stäng"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <CalendarDatePicker
                value={draft.dateISO || isoToday()}
                onChange={(iso) => updateDraft({ dateISO: iso })}
                label="Datum för bedömningen"
                weekStartsOn={1}
              />
            </div>

            {isGoals2021 ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-900">Fas</label>
                  <select
                    value={draft.phase}
                    onChange={(e) =>
                      updateDraft({ phase: e.target.value as IupAssessmentPhase })
                    }
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                  >
                    <option value="BT">BT</option>
                    <option value="ST">ST</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-900">
                    Klinisk tjänstgöring
                  </label>
                  <input
                    type="text"
                    value={draft.level}
                    onChange={(e) => updateDraft({ level: e.target.value })}
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">
                  Klinisk tjänstgöring
                </label>
                <input
                  type="text"
                  value={draft.level}
                  onChange={(e) => updateDraft({ level: e.target.value })}
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-900">
                Bedömningsinstrument
              </label>
              <select
                value={draft.instrument}
                onChange={(e) => updateDraft({ instrument: e.target.value })}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              >
                <option value="">Välj bedömningsinstrument…</option>
                {instruments.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-900">
                Övergripande bedömning
              </label>
              <textarea
                rows={4}
                value={draft.summary}
                onChange={(e) => updateDraft({ summary: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">
                  Styrkor
                </label>
                <textarea
                  rows={5}
                  value={draft.strengths}
                  onChange={(e) => updateDraft({ strengths: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">
                  Utvecklingsområden
                </label>
                <textarea
                  rows={5}
                  value={draft.development}
                  onChange={(e) => updateDraft({ development: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty}
            className="inline-flex items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Spara
          </button>
        </footer>
      </div>
    </div>
  );
}


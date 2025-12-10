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
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-extrabold">Progressionsbedömning</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!dirty}
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-5 py-3 text-base font-semibold text-white hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
            >
              Spara
            </button>
            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px"
            >
              Stäng
            </button>
          </div>
        </header>

        <section className="max-h-[80vh] overflow-auto p-5 space-y-5">
          <div>
            <CalendarDatePicker
              value={draft.dateISO || isoToday()}
              onChange={(iso) => updateDraft({ dateISO: iso })}
              label="Datum för bedömningen"
              weekStartsOn={1}
            />
          </div>

          {isGoals2021 ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-base font-semibold text-slate-800">Fas</label>
                <select
                  value={draft.phase}
                  onChange={(e) =>
                    updateDraft({ phase: e.target.value as IupAssessmentPhase })
                  }
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                >
                  <option value="BT">BT</option>
                  <option value="ST">ST</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-base font-semibold text-slate-800">
                  Klinisk tjänstgöring
                </label>
                <input
                  type="text"
                  value={draft.level}
                  onChange={(e) => updateDraft({ level: e.target.value })}
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-base font-semibold text-slate-800">
                Klinisk tjänstgöring
              </label>
              <input
                type="text"
                value={draft.level}
                onChange={(e) => updateDraft({ level: e.target.value })}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-base font-semibold text-slate-800">
              Bedömningsinstrument
            </label>
            <select
              value={draft.instrument}
              onChange={(e) => updateDraft({ instrument: e.target.value })}
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
            >
              <option value="">Välj bedömningsinstrument…</option>
              {instruments.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-base font-semibold text-slate-800">
              Övergripande bedömning
            </label>
            <textarea
              rows={4}
              value={draft.summary}
              onChange={(e) => updateDraft({ summary: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-2 block text-base font-semibold text-slate-800">
                Styrkor
              </label>
              <textarea
                rows={5}
                value={draft.strengths}
                onChange={(e) => updateDraft({ strengths: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
            <div>
              <label className="mb-2 block text-base font-semibold text-slate-800">
                Utvecklingsområden
              </label>
              <textarea
                rows={5}
                value={draft.development}
                onChange={(e) => updateDraft({ development: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


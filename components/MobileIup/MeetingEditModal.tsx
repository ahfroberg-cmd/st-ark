// components/MobileIup/MeetingEditModal.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import type { IupMeeting } from "@/components/IupModal";

type Props = {
  open: boolean;
  meeting: IupMeeting | null;
  onSave: (meeting: IupMeeting) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
};

function isoToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isoFourWeeksFrom(baseIso?: string | null): string {
  let d: Date;
  if (baseIso && /^\d{4}-\d{2}-\d{2}$/.test(baseIso)) {
    const [y, m, day] = baseIso.split("-").map((v) => parseInt(v, 10));
    d = new Date(y, m - 1, day);
  } else {
    d = new Date();
  }
  d.setDate(d.getDate() + 28);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isFutureDate(iso?: string): boolean {
  if (!iso) return false;
  const today = isoToday();
  return iso > today;
}

function cloneMeeting(m: IupMeeting): IupMeeting {
  return { ...m };
}

export default function MeetingEditModal({ open, meeting, onSave, onDelete, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<IupMeeting | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open || !meeting) return;
    setDraft(cloneMeeting(meeting));
    setDirty(false);
  }, [open, meeting]);

  const handleRequestClose = useCallback(() => {
    if (dirty) {
      const ok = window.confirm(
        "Du har osparade ändringar i detta handledarsamtal. Vill du stänga utan att spara?"
      );
      if (!ok) return;
    }
    onClose();
  }, [dirty, onClose]);

  const handleSave = useCallback(() => {
    if (!draft) return;
    onSave(draft);
    setDirty(false);
    // Don't close on save
  }, [draft, onSave]);

  const updateDraft = (patch: Partial<IupMeeting>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setDirty(true);
      return next;
    });
  };

  const hasNextPlanned = !!draft?.nextDateISO;

  if (!open || !meeting) return null;
  if (!draft) {
    // Initialize draft if not set
    const initialDraft = cloneMeeting(meeting);
    setDraft(initialDraft);
    return null;
  }

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
          <h2 className="text-xl font-extrabold text-emerald-900">Handledarsamtal</h2>
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
                label="Datum för handledarsamtalet"
                weekStartsOn={1}
              />
              {isFutureDate(draft.dateISO) && (
                <p className="mt-2 text-sm italic text-sky-700">Planerat</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-900">
                Rubrik / fokus
              </label>
              <input
                type="text"
                value={draft.focus}
                onChange={(e) => updateDraft({ focus: e.target.value })}
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">
                  Sammanfattning
                </label>
                <textarea
                  rows={5}
                  value={draft.summary}
                  onChange={(e) => updateDraft({ summary: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">
                  Överenskomna åtgärder
                </label>
                <textarea
                  rows={5}
                  value={draft.actions}
                  onChange={(e) => updateDraft({ actions: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="inline-flex items-center gap-3 text-xs font-medium text-slate-900">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={hasNextPlanned}
                  onChange={(e) => {
                    const enable = e.target.checked;
                    if (enable) {
                      const baseIso = draft.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(draft.dateISO)
                        ? draft.dateISO
                        : isoToday();
                      updateDraft({
                        nextDateISO:
                          draft.nextDateISO && isFutureDate(draft.nextDateISO)
                            ? draft.nextDateISO
                            : isoFourWeeksFrom(baseIso),
                      });
                    } else {
                      updateDraft({ nextDateISO: "" });
                    }
                  }}
                />
                <span>Nästa planerade handledarsamtal</span>
              </label>
              <div className={hasNextPlanned ? "mt-3" : "mt-3 opacity-60 pointer-events-none"}>
                <CalendarDatePicker
                  value={
                    draft.nextDateISO ||
                    isoFourWeeksFrom(draft.dateISO || isoToday())
                  }
                  onChange={(iso) => updateDraft({ nextDateISO: iso })}
                  weekStartsOn={1}
                />
                {isFutureDate(draft.nextDateISO || undefined) && (
                  <p className="mt-2 text-sm italic text-sky-700">Planerat</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          {onDelete && draft && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Vill du ta bort detta handledarsamtal?")) {
                  onDelete(draft.id);
                }
              }}
              className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 active:translate-y-px"
            >
              Ta bort
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty}
            className="inline-flex items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
          >
            Spara
          </button>
        </footer>
      </div>
    </div>
  );
}


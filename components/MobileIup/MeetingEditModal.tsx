// components/MobileIup/MeetingEditModal.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import type { IupMeeting } from "@/components/IupModal";

type Props = {
  open: boolean;
  meeting: IupMeeting | null;
  onSave: (meeting: IupMeeting) => void;
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

export default function MeetingEditModal({ open, meeting, onSave, onClose }: Props) {
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
    onClose();
  }, [draft, onSave, onClose]);

  const updateDraft = (patch: Partial<IupMeeting>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setDirty(true);
      return next;
    });
  };

  const hasNextPlanned = !!draft?.nextDateISO;

  if (!open || !meeting || !draft) return null;

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
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-extrabold">Handledarsamtal</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!dirty}
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
            >
              Spara
            </button>
            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px"
            >
              Stäng
            </button>
          </div>
        </header>

        <section className="max-h-[80vh] overflow-auto p-4 space-y-4">
          <div>
            <CalendarDatePicker
              value={draft.dateISO || isoToday()}
              onChange={(iso) => updateDraft({ dateISO: iso })}
              label="Datum för handledarsamtalet"
              weekStartsOn={1}
            />
            {isFutureDate(draft.dateISO) && (
              <p className="mt-1 text-xs italic text-sky-700">Planerat</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-800">
              Rubrik / fokus
            </label>
            <input
              type="text"
              value={draft.focus}
              onChange={(e) => updateDraft({ focus: e.target.value })}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                Sammanfattning
              </label>
              <textarea
                rows={4}
                value={draft.summary}
                onChange={(e) => updateDraft({ summary: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                Överenskomna åtgärder
              </label>
              <textarea
                rows={4}
                value={draft.actions}
                onChange={(e) => updateDraft({ actions: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
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
            <div className={hasNextPlanned ? "mt-2" : "mt-2 opacity-60 pointer-events-none"}>
              <CalendarDatePicker
                value={
                  draft.nextDateISO ||
                  isoFourWeeksFrom(draft.dateISO || isoToday())
                }
                onChange={(iso) => updateDraft({ nextDateISO: iso })}
                weekStartsOn={1}
              />
              {isFutureDate(draft.nextDateISO || undefined) && (
                <p className="mt-1 text-xs italic text-sky-700">Planerat</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


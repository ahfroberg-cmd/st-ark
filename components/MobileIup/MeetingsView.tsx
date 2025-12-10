// components/MobileIup/MeetingsView.tsx
"use client";

import React from "react";
import type { IupMeeting } from "@/components/IupModal";

type Props = {
  meetings: IupMeeting[];
  editingId: string | null;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onUpdate: (meeting: IupMeeting) => void;
  onRemove: (id: string) => void;
  onCloseEdit: () => void;
};

function isFutureDate(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d > today;
}

export default function MeetingsView({
  meetings,
  editingId,
  onAdd,
  onEdit,
  onRemove,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Handledarsamtal</h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:translate-y-px"
        >
          + Nytt samtal
        </button>
      </div>

      {meetings.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Inga handledarsamtal registrerade ännu.
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => {
            const planned = isFutureDate(m.dateISO);
            return (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {m.focus || "Handledarsamtal"}
                      </h3>
                      {planned && (
                        <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                          Planerat
                        </span>
                      )}
                    </div>
                    <div className="mb-2 text-xs text-slate-600">
                      {m.dateISO || "Datum saknas"}
                    </div>
                    {m.summary && (
                      <p className="mb-2 text-sm text-slate-700 line-clamp-2">
                        {m.summary}
                      </p>
                    )}
                    {m.actions && (
                      <p className="text-sm text-slate-600 line-clamp-2">
                        <span className="font-medium">Åtgärder:</span> {m.actions}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEdit(m.id)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:translate-y-px"
                    >
                      Redigera
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(m.id)}
                      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 active:translate-y-px"
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


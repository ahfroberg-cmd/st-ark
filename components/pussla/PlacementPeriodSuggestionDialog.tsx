"use client";

import React from "react";

export type PlacementPeriodSuggestionDialogState = {
  activityId: string;
  templateTitle: string;
  suggestedMonths: number;
  startISO: string;
  proposedEndISO: string;
  cappedByNextStartISO?: string;
};

type Props = {
  dialog: PlacementPeriodSuggestionDialogState | null;
  onClose: () => void;
  onApply: () => void;
};

export default function PlacementPeriodSuggestionDialog({ dialog, onClose, onApply }: Props) {
  if (!dialog) return null;

  return (
    <div
      className="fixed inset-0 z-[11100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Föreslagen tjänstgöringsperiod minimum</h2>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-800">
            Föreslagen tjänstgöringsperiod minimum:{" "}
            <span className="font-semibold">{dialog.suggestedMonths}</span> månader.
          </p>
          {dialog.cappedByNextStartISO ? (
            <p className="text-xs text-amber-800">
              Perioden anpassas för att inte överlappa nästa tjänstgöring och slutar före{" "}
              {dialog.cappedByNextStartISO}.
            </p>
          ) : null}
          <div className="text-xs text-slate-600">
            Start: {dialog.startISO} · Slut: {dialog.proposedEndISO}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Välj egen
            </button>
            <button
              type="button"
              onClick={onApply}
              className="inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Lägg in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

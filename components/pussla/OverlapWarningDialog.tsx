"use client";

import React from "react";

type Props = {
  warning: string | null;
  canApplySuggestion: boolean;
  onClose: () => void;
  onApplySuggestion: () => void;
};

export default function OverlapWarningDialog({
  warning,
  canApplySuggestion,
  onClose,
  onApplySuggestion,
}: Props) {
  if (!warning) return null;

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Varning</h2>
        </div>
        <div className="p-5">
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            <div className="whitespace-pre-line">{warning}</div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={onApplySuggestion}
              disabled={!canApplySuggestion}
              className={
                canApplySuggestion
                  ? "inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:translate-y-px"
                  : "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed"
              }
            >
              Välj närmaste datum
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

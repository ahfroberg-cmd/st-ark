"use client";

import type { PusslaSearchHit } from "@/lib/pussla/searchWorkspace";

type SearchModalProps = {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  hits: PusslaSearchHit[];
  onRunHit: (hit: PusslaSearchHit) => void;
  onClose: () => void;
};

export default function SearchModal({
  open,
  query,
  onQueryChange,
  hits,
  onRunHit,
  onClose,
}: SearchModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-black px-6 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">Sök</h2>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
            >
              Stäng
            </button>
          </div>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Sök sidor, aktiviteter och kurser…"
            className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="max-h-[60vh] overflow-auto p-4">
          {!String(query || "").trim() ? (
            <p className="text-sm text-slate-500">Skriv för att söka.</p>
          ) : hits.length === 0 ? (
            <p className="text-sm text-slate-500">Inga träffar.</p>
          ) : (
            <div className="space-y-2">
              {hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => onRunHit(hit)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                >
                  <div className="text-sm font-medium text-slate-900">{hit.label}</div>
                  <div className="text-xs text-slate-500">{hit.kind}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

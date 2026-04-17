"use client";

import React from "react";

type GroupedRows = {
  required: string[];
  recommended: string[];
};

type ColleagueRow = {
  description: string;
  colleagueName: string;
  startDate?: string | null;
  endDate?: string | null;
};

type Props = {
  open: boolean;
  tab: "studierektor" | "kollegor";
  onTabChange: (tab: "studierektor" | "kollegor") => void;
  onClose: () => void;
  groupedRows: GroupedRows;
  colleagueRows: ColleagueRow[];
  onSelectStudierektorRow: (text: string) => void;
  onSelectColleagueDescription: (text: string) => void;
  formatDate: (dateISO?: string | null) => string;
};

export default function PlacementNoteSuggestionsPopup({
  open,
  tab,
  onTabChange,
  onClose,
  groupedRows,
  colleagueRows,
  onSelectStudierektorRow,
  onSelectColleagueDescription,
  formatDate,
}: Props) {
  if (!open) return null;

  return (
    <div className="relative">
      <div
        data-forslag-popup="true"
        className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
      >
        <div className="border-b border-slate-200 relative">
          <div className="flex">
            <button
              type="button"
              className={`flex-1 px-3 py-2 text-xs font-semibold ${
                tab === "studierektor"
                  ? "bg-slate-50 border-b-2 border-blue-500 text-slate-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
              onClick={() => onTabChange("studierektor")}
            >
              Studierektor
            </button>
            <button
              type="button"
              className={`flex-1 px-3 py-2 text-xs font-semibold ${
                tab === "kollegor"
                  ? "bg-slate-50 border-b-2 border-blue-500 text-slate-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
              onClick={() => onTabChange("kollegor")}
            >
              ST-kollegor
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Stäng"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {tab === "studierektor" ? (
          <>
            <div className="px-3 py-2 border-b text-xs font-semibold text-slate-500">Klicka för att lägga till</div>
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
              {groupedRows.required.length > 0 && (
                <li className="px-3 py-2 text-xs font-semibold text-slate-500">Obligatoriska moment</li>
              )}
              {groupedRows.required.map((row, i) => (
                <li key={`required-${i}`}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => onSelectStudierektorRow(row)}
                  >
                    {row}
                  </button>
                </li>
              ))}
              {groupedRows.recommended.length > 0 && (
                <li className="px-3 py-2 text-xs font-semibold text-slate-500">Rekommenderade moment</li>
              )}
              {groupedRows.recommended.map((row, i) => (
                <li key={`recommended-${i}`}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => onSelectStudierektorRow(row)}
                  >
                    {row}
                  </button>
                </li>
              ))}
              {groupedRows.required.length === 0 && groupedRows.recommended.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-400">Inga förslag från studierektor</li>
              )}
            </ul>
          </>
        ) : (
          <>
            <div className="px-3 py-2 border-b text-xs font-semibold text-slate-500">Beskrivningar från ST-kollegor</div>
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
              {colleagueRows.map((row, i) => {
                const description = row.description;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                      onClick={() => onSelectColleagueDescription(description)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">{row.colleagueName}</span>
                          <span>
                            {row.startDate ? formatDate(row.startDate) : "—"}
                            {row.endDate ? ` – ${formatDate(row.endDate)}` : ""}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap text-sm text-slate-800">{description}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
              {colleagueRows.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-400">Inga beskrivningar från kollegor för denna placering</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import type { Dispatch, SetStateAction } from "react";

type InfoToast = { title: string; message: string } | null;

type Props = {
  infoToast: InfoToast;
  setInfoToast: Dispatch<SetStateAction<InfoToast>>;
  clinicName: string;
  onGoHomeClick: () => void;
  onOpenDashboard: () => void;
  onOpenOverallTimeline: () => void;
  onOpenNetwork: () => void;
  onOpenUppfoljning: () => void;
  onOpenMeny: () => void;
  harOlästaUppdateringar: boolean;
};

export function StudierektorPageChrome({
  infoToast,
  setInfoToast,
  clinicName,
  onGoHomeClick,
  onOpenDashboard,
  onOpenOverallTimeline,
  onOpenNetwork,
  onOpenUppfoljning,
  onOpenMeny,
  harOlästaUppdateringar,
}: Props) {
  return (
    <>
      {infoToast && (
        <div className="fixed right-4 top-4 z-[80] w-[min(420px,calc(100vw-2rem))] rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{infoToast.title}</p>
              <p className="mt-1 text-sm text-slate-700">{infoToast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setInfoToast(null)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50"
            >
              Stäng
            </button>
          </div>
        </div>
      )}

      <header className="border-b border-black bg-white px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onGoHomeClick}
              className="select-none caret-transparent text-4xl font-extrabold tracking-tight cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:outline-none focus:ring-0"
            >
              <span className="text-sky-700">ST</span>
              <span className="text-emerald-700">ARK</span>
            </button>
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 select-none">
              Studierektor{clinicName ? ` · ${clinicName}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenDashboard}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={onOpenOverallTimeline}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
            >
              Progression
            </button>
            <button
              type="button"
              onClick={onOpenNetwork}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
            >
              Nätverk
            </button>
            <button
              type="button"
              onClick={onOpenUppfoljning}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
              title={
                harOlästaUppdateringar ? "Nya uppdateringar sedan du senast bekräftade" : undefined
              }
            >
              {harOlästaUppdateringar ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              ) : null}
              Uppdateringar
            </button>
            <button
              type="button"
              onClick={onOpenMeny}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 active:translate-y-px"
            >
              Meny
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

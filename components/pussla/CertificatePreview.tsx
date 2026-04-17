"use client";

import React from "react";

export default function CertificatePreview({
  open,
  url,
  onClose,
}: {
  open: boolean;
  url: string | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Förhandsvisning av intyg</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          {url ? (
            <iframe src={url} className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500">Genererar ...</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <a
            href={url ?? "#"}
            download
            className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50"
            onClick={(e) => {
              if (!url) e.preventDefault();
            }}
          >
            Ladda ned PDF
          </a>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-200 active:translate-y-px"
            title="Stäng förhandsvisningen"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

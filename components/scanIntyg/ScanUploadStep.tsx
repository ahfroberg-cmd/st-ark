"use client";

import React from "react";

type Props = {
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSelectFile: (file: File | null) => void;
  setDocumentPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  previewUrl: string | null;
  fileName: string;
  hasFile: boolean;
  removeFile: () => void;
  handleScan: () => Promise<void>;
  canScan: boolean;
  busy: boolean;
  setGdprModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function ScanUploadStep({
  cameraInputRef,
  fileInputRef,
  onSelectFile,
  setDocumentPickerOpen,
  previewUrl,
  fileName,
  hasFile,
  removeFile,
  handleScan,
  canScan,
  busy,
  setGdprModalOpen,
}: Props) {
  return (
    <div className="space-y-4">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px md:hidden"
          data-info="Öppnar kameran för att fotografera ett intyg direkt med din enhet. Endast synlig på mobila enheter."
        >
          Fota intyg
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
          data-info="Öppnar en filväljare där du kan välja en bildfil av ett intyg från din enhet. Bilden skickas sedan till OCR-tjänsten för textigenkänning."
        >
          Ladda upp bild
        </button>
        <button
          type="button"
          onClick={() => setDocumentPickerOpen(true)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
          data-info="Öppnar en lista med redan uppladdade dokument i appen så att du kan välja ett dokument och skanna med OCR."
        >
          Välj bland dokument
        </button>

        {previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-sky-700 underline hover:text-sky-800"
          >
            {fileName}
          </a>
        ) : (
          <span className="text-sm text-slate-600">Ingen fil vald</span>
        )}

        {hasFile && (
          <button
            type="button"
            onClick={removeFile}
            title="Ta bort"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:translate-y-px"
          >
            🗑️
          </button>
        )}

        <div className="ml-auto">
          <button
            type="button"
            onClick={() => void handleScan()}
            disabled={!canScan}
            className="inline-flex items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            data-info="Skickar den valda bilden till OCR-tjänsten (ocr.space) för textigenkänning. Efter skanning fylls formuläret automatiskt i med information från intyget som du kan granska och justera."
          >
            {busy ? "Skannar…" : "Skanna"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="m-0">
          Bilden skickas till OCR-tjänsten{" "}
          <a
            href="https://ocr.space"
            target="_blank"
            rel="noreferrer"
            className="text-sky-700 underline hover:text-sky-800"
          >
            ocr.space
          </a>{" "}
          för textigenkänning.{" "}
          <button type="button" onClick={() => setGdprModalOpen(true)} className="text-slate-700 inline">
            <span className="text-sky-700 underline hover:text-sky-800 cursor-pointer">Läs mer</span> om GDPR vid
            användning av tredje parts uppgifter
          </button>
        </p>
      </div>
    </div>
  );
}

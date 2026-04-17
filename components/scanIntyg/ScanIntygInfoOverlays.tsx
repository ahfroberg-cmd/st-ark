"use client";

import React from "react";

type Props = {
  tipsOpen: boolean;
  onCloseTips: () => void;
  gdprModalOpen: boolean;
  onCloseGdpr: () => void;
};

export function ScanIntygInfoOverlays({
  tipsOpen,
  onCloseTips,
  gdprModalOpen,
  onCloseGdpr,
}: Props) {
  return (
    <>
      {tipsOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={onCloseTips}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="m-0 text-lg font-semibold text-slate-900">Tips för bästa resultat</h3>
              <button
                type="button"
                onClick={onCloseTips}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
              >
                Stäng
              </button>
            </header>
            <div className="p-6">
              <div className="text-sm text-slate-900">
                <ul className="list-disc list-inside space-y-2">
                  <li>Allra bäst resultat får du vid skanning av dokumentet</li>
                  <li>Om du fotograferar: håll kameran rakt ovanför dokumentet, undvik vinkling</li>
                  <li>Se till att hela dokumentet syns i bilden och beskär så att endast dokumentet syns</li>
                  <li>Fotografera i gott ljus, helst dagsljus eller stark belysning och undvik skuggor och reflektioner</li>
                  <li>Fokusera tydligt – texten ska vara skarp och läsbar</li>
                  <li>Titta igenom resultatet noggrant, det finns risk för fel</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {gdprModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={onCloseGdpr}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="m-0 text-lg font-semibold text-slate-900">GDPR – Tredje parts personuppgifter</h3>
              <button
                type="button"
                onClick={onCloseGdpr}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
              >
                Stäng
              </button>
            </header>
            <div className="p-6">
              <div className="text-xs text-slate-900 space-y-3">
                <p>
                  Intygen kan innehålla personuppgifter om andra personer, till exempel handledare eller kursledare
                  (namn, specialitet, tjänsteställe).
                </p>
                <p>
                  När du skickar dokumentet till OCR-tjänsten för textigenkänning överförs även dessa personuppgifter
                  till{" "}
                  <a
                    href="https://ocr.space"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 underline hover:text-sky-800"
                  >
                    ocr.space
                  </a>
                  .
                </p>
                <p>
                  Enligt GDPR är du ansvarig för att du har rätt att behandla personuppgifter om andra personer. Genom
                  att använda OCR-funktionen bekräftar du att du har rätt att skicka dokumentet som innehåller dessa
                  uppgifter.
                </p>
                <p>
                  OCR.space raderar alla dokument direkt efter bearbetning och lagrar inga personuppgifter.{" "}
                  <a
                    href="https://ocr.space/privacypolicy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 underline hover:text-sky-800"
                  >
                    Läs mer om hur OCR.space hanterar uppgifter
                  </a>
                  .
                </p>
                <p className="mt-4 pt-3 border-t border-slate-200">
                  <a
                    href="https://www.imy.se/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 underline hover:text-sky-800"
                  >
                    Läs mer om GDPR på Integritetsskyddsmyndighetens webbplats
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

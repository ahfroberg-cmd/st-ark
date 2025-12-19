//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
"use client";

import React, { useState, useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  goalsVersion?: "2015" | "2021" | null;
};

export default function WelcomeModal({ open, onClose, goalsVersion }: Props) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Detektera om det är Mac
      const platform = navigator.platform.toLowerCase();
      const userAgent = navigator.userAgent.toLowerCase();
      setIsMac(platform.includes("mac") || userAgent.includes("mac"));
    }
  }, []);

  if (!open) return null;

  const handleOk = () => {
    // Spara i localStorage att användaren har sett välkomstmeddelandet
    if (typeof window !== "undefined") {
      localStorage.setItem("st-ark-welcome-seen", "true");
    }
    onClose();
  };

  const shortcutKey = isMac ? "Cmd" : "Ctrl";
  
  // Bestäm text baserat på goalsVersion
  const descriptionText = goalsVersion === "2015"
    ? "ST-ARK är ett verktyg för att planera och dokumentera din specialiseringstjänstgöring. Här kan du hantera aktiviteter, kurser, handledarsamtal, progressionsbedömningar, delmål och skapa intyg och ansökningar."
    : "ST-ARK är ett verktyg för att planera och dokumentera din bas- och specialiseringstjänstgöring. Här kan du hantera aktiviteter, kurser, handledarsamtal, progressionsbedömningar, delmål och skapa intyg och ansökningar.";

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-3"
      onClick={(e) => {
        // Stäng när man klickar på bakgrunden
        if (e.target === e.currentTarget) {
          handleOk();
        }
      }}
    >
      <div 
        className="w-full max-w-[520px] rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="m-0 text-xl font-extrabold text-slate-900">
            Välkommen till ST-ARK!
          </h2>
        </div>

        <div className="px-6 py-5">
          <div className="space-y-4 text-slate-700">
            <p className="text-[15px] leading-relaxed">
              {descriptionText}
            </p>

            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-sky-900">
                Informationsvy
              </h3>
              <p className="text-[14px] leading-relaxed text-sky-800">
                Tryck på <kbd className="rounded border border-sky-300 bg-white px-1.5 py-0.5 text-xs font-mono">{shortcutKey} + I</kbd> för att aktivera informationsvyn. 
                I informationsvyn kan du klicka på valfritt element för att se information om dess funktion. 
                Detta hjälper dig att lära känna verktyget och förstå vad varje knapp och funktion gör.
              </p>
            </div>

            <p className="text-[14px] leading-relaxed text-slate-600">
              Klicka på "Okej" för att börja använda ST-ARK. Du kan när som helst öppna informationsvyn 
              genom att trycka på <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-mono">{shortcutKey} + I</kbd>.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={handleOk}
            className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
          >
            Okej
          </button>
        </div>
      </div>
    </div>
  );
}

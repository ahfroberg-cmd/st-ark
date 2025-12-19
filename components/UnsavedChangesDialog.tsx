// components/UnsavedChangesDialog.tsx
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

import React, { useEffect, useRef } from "react";
import { registerModal, unregisterModal } from "@/lib/modalEscHandler";

interface UnsavedChangesDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  onCancel: () => void;
  onDiscard: () => void;
  onSaveAndClose?: () => void;
}

export default function UnsavedChangesDialog({
  open,
  title = "Osparade ändringar",
  message = "Det finns osparade ändringar. Vill du stänga utan att spara?",
  onCancel,
  onDiscard,
  onSaveAndClose,
}: UnsavedChangesDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Kortkommandon: ESC = Avbryt, Cmd/Ctrl+Enter = Spara och stäng, Delete eller Cmd/Ctrl+Backspace = Stäng utan att spara
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Stoppa alla event om dialogen är öppen
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onCancel();
        return false;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && onSaveAndClose) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onSaveAndClose();
        return false;
      }
      // Delete (Windows/Linux) eller Cmd/Ctrl+Backspace (Mac)
      if (e.key === "Delete" || ((e.metaKey || e.ctrlKey) && e.key === "Backspace")) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onDiscard();
        return false;
      }
    };
    // Använd capture-fas med hög prioritet för att fånga eventen först
    // Lägg till listener tidigt så den körs före andra listeners
    window.addEventListener("keydown", onKey, { capture: true, passive: false });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onCancel, onSaveAndClose, onDiscard]);

  // Registrera dialogen för global ESC-hantering
  useEffect(() => {
    if (!open || !overlayRef.current) return;
    const element = overlayRef.current;
    registerModal(element, onCancel);
    return () => {
      unregisterModal(element);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-[300] grid place-items-center bg-black/60 p-4"
      onKeyDown={(e) => {
        // Fånga event även på overlay-nivå som backup
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onCancel();
        } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && onSaveAndClose) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onSaveAndClose();
        } else if (e.key === "Delete" || ((e.metaKey || e.ctrlKey) && e.key === "Backspace")) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onDiscard();
        }
      }}
      tabIndex={-1}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
        onKeyDown={(e) => {
          // Ytterligare backup-hantering på dialog-rutan själv
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            onCancel();
          } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && onSaveAndClose) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            onSaveAndClose();
          } else if (e.key === "Delete" || ((e.metaKey || e.ctrlKey) && e.key === "Backspace")) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            onDiscard();
          }
        }}
        tabIndex={-1}
      >
        {/* Header med border-b */}
        <header className="border-b px-6 py-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold m-0">
            {title}
          </h3>
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            data-info="Avbryter stängningen och återgår till redigeringen. Alla osparade ändringar behålls."
          >
            Avbryt
          </button>
        </header>
        
        {/* Innehåll */}
        <div className="p-6">
          <p className="text-slate-700 mb-6">
            {message}
          </p>
          
          {/* Knappar */}
          <div className="flex items-center justify-end gap-3">
            {onSaveAndClose && (
              <button
                onClick={onSaveAndClose}
                className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
                data-info="Spara och stäng"
              >
                Spara och stäng
              </button>
            )}
            <button
              onClick={onDiscard}
              className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:border-slate-700 hover:bg-slate-700 active:translate-y-px"
              data-info="Stäng utan att spara"
            >
              Stäng utan att spara
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


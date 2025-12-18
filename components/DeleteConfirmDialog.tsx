// components/DeleteConfirmDialog.tsx
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

interface DeleteConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

export default function DeleteConfirmDialog({
  open,
  title = "Ta bort",
  message = "Är du säker på att du vill ta bort detta?",
  onCancel,
  onConfirm,
  confirmLabel = "Ta bort",
}: DeleteConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Kortkommandon: ESC = Avbryt, Enter = Ta bort
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
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onConfirm();
        return false;
      }
    };
    // Använd capture-fas med hög prioritet för att fånga eventen först
    // Lägg till listener tidigt så den körs före andra listeners
    window.addEventListener("keydown", onKey, { capture: true, passive: false });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onCancel, onConfirm]);

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
        } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onConfirm();
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
          } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            onConfirm();
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
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
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
            <button
              onClick={onConfirm}
              className="inline-flex items-center justify-center rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:border-red-700 hover:bg-red-700 active:translate-y-px"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from "react";
import { registerModal, unregisterModal } from "@/lib/modalEscHandler";

interface LogoutConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function LogoutConfirmDialog({
  open,
  onCancel,
  onConfirm,
}: LogoutConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
        return false;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
        return false;
      }
    };
    window.addEventListener("keydown", onKey, { capture: true, passive: false });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onCancel, onConfirm]);

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
      tabIndex={-1}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <header className="border-b px-6 py-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold m-0">Logga ut</h3>
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          >
            Avbryt
          </button>
        </header>
        
        <div className="p-6">
          <p className="text-slate-700 mb-6">
            Är du säker på att du vill logga ut?
          </p>
          
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onConfirm}
              className="inline-flex items-center justify-center rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:border-red-700 hover:bg-red-700 active:translate-y-px"
            >
              Logga ut
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// components/MobileIup/PlanningPopup.tsx
"use client";

import React, { useRef, useState } from "react";
import type { IupPlanning, ExtraPlanningSection } from "@/components/IupModal";
import PlanningView from "./PlanningView";

type Props = {
  open: boolean;
  planning: IupPlanning;
  setPlanning: (planning: IupPlanning) => void;
  planningExtra: ExtraPlanningSection[];
  setPlanningExtra: (sections: ExtraPlanningSection[]) => void;
  setDirty: (dirty: boolean) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  dirty: boolean;
};

export default function PlanningPopup({
  open,
  planning,
  setPlanning,
  planningExtra,
  setPlanningExtra,
  setDirty,
  onClose,
  onSave,
  dirty,
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleRequestClose = () => {
    if (dirty) {
      const ok = window.confirm("Du har osparade ändringar. Vill du stänga utan att spara?");
      if (!ok) return;
    }
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
    } catch (e) {
      console.error("Kunde inte spara planering:", e);
      alert("Kunde inte spara planering.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-sky-50 px-5 py-4">
          <h2 className="text-xl font-extrabold text-sky-900">Planering</h2>
          <button
            type="button"
            onClick={handleRequestClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-px"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <PlanningView
            planning={planning}
            setPlanning={setPlanning}
            planningExtra={planningExtra}
            setPlanningExtra={setPlanningExtra}
            setDirty={setDirty}
          />
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Sparar..." : "Spara"}
          </button>
        </footer>
      </div>
    </div>
  );
}


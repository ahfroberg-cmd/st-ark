// components/MobileIup/PlanningPopup.tsx
"use client";

import React, { useRef } from "react";
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
};

export default function PlanningPopup({
  open,
  planning,
  setPlanning,
  planningExtra,
  setPlanningExtra,
  setDirty,
  onClose,
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-sky-50 px-5 py-4">
          <h2 className="text-xl font-extrabold text-sky-900">Planering</h2>
          <button
            type="button"
            onClick={onClose}
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
      </div>
    </div>
  );
}


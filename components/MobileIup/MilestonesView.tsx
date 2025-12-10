// components/MobileIup/MilestonesView.tsx
"use client";

import React, { useState } from "react";
import MilestoneOverviewPanel from "@/components/MilestoneOverviewModal";

export default function MilestonesView() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<"bt" | "st">("st");

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">Delmål</h2>
      
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="mb-4 text-sm text-slate-600">
          Här kan du se alla delmål och vilka kliniska placeringar och kurser som uppfyller dem.
        </p>
        
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setInitialTab("bt");
              setModalOpen(true);
            }}
            className="rounded-xl border-2 border-sky-600 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 hover:bg-sky-100 active:translate-y-px"
          >
            BT-delmål
          </button>
          <button
            type="button"
            onClick={() => {
              setInitialTab("st");
              setModalOpen(true);
            }}
            className="rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 active:translate-y-px"
          >
            ST-delmål
          </button>
        </div>
      </div>

      <MilestoneOverviewPanel
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}


// components/MobileIup/MilestonesView.tsx
"use client";

import React, { useState } from "react";
import MilestoneOverviewPanel from "@/components/MilestoneOverviewModal";

export default function MilestonesView() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<"bt" | "st">("st");

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-900">Delmål</h2>
      
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="mb-5 text-base text-slate-600">
          Här kan du se alla delmål och vilka kliniska placeringar och kurser som uppfyller dem.
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              setInitialTab("bt");
              setModalOpen(true);
            }}
            className="rounded-xl border-2 border-sky-600 bg-sky-50 px-5 py-4 text-base font-semibold text-sky-900 hover:bg-sky-100 active:translate-y-px"
          >
            BT-delmål
          </button>
          <button
            type="button"
            onClick={() => {
              setInitialTab("st");
              setModalOpen(true);
            }}
            className="rounded-xl border-2 border-emerald-600 bg-emerald-50 px-5 py-4 text-base font-semibold text-emerald-900 hover:bg-emerald-100 active:translate-y-px"
          >
            ST-delmål
          </button>
        </div>
      </div>

      <MilestoneOverviewPanel
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialTab={initialTab}
      />
    </div>
  );
}


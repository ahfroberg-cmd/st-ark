// components/MobileIup/MilestonesPopup.tsx
"use client";

import React, { useRef, useState } from "react";
import MilestoneOverviewPanel from "@/components/MilestoneOverviewModal";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenModal: () => void;
};

export default function MilestonesPopup({ open, onClose, onOpenModal }: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<"bt" | "st">("st");

  React.useEffect(() => {
    if (open || milestoneModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, milestoneModalOpen]);

  if (!open) return null;

  return (
    <>
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
          <header className="flex items-center justify-between border-b border-slate-200 bg-emerald-50 px-5 py-4">
            <h2 className="text-xl font-extrabold text-emerald-900">Delmål</h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-5">
              <p className="text-base text-slate-900">
                Här kan du se alla delmål och vilka kliniska placeringar och kurser som uppfyller dem.
              </p>
              
              <div className="grid grid-cols-1 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setInitialTab("bt");
                    setMilestoneModalOpen(true);
                  }}
                  className="w-full rounded-xl border-2 border-sky-600 bg-sky-50 px-5 py-5 text-left text-base font-semibold text-sky-900 hover:bg-sky-100 active:translate-y-px"
                >
                  BT-delmål
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInitialTab("st");
                    setMilestoneModalOpen(true);
                  }}
                  className="w-full rounded-xl border-2 border-emerald-600 bg-emerald-50 px-5 py-5 text-left text-base font-semibold text-emerald-900 hover:bg-emerald-100 active:translate-y-px"
                >
                  ST-delmål
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {milestoneModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMilestoneModalOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-[980px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <MilestoneOverviewPanel
              open={milestoneModalOpen}
              initialTab={initialTab}
              onClose={() => {
                setMilestoneModalOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}


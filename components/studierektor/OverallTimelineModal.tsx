"use client";

import type { ReactNode, RefObject } from "react";

export default function OverallTimelineModal({
  open,
  onClose,
  overallTimelineModalRef,
  overallTimelinePrimaryTab,
  setOverallTimelinePrimaryTab,
  timelineTabView,
  progressionSubtabProgressionView,
  progressionSubtabSettingsView,
}: {
  open: boolean;
  onClose: () => void;
  overallTimelineModalRef: RefObject<HTMLDivElement | null>;
  overallTimelinePrimaryTab: "overview" | "progression" | "settings";
  setOverallTimelinePrimaryTab: (tab: "overview" | "progression" | "settings") => void;
  timelineTabView: ReactNode;
  progressionSubtabProgressionView: ReactNode;
  progressionSubtabSettingsView: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={overallTimelineModalRef}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        style={{ overscrollBehavior: "contain" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black bg-white px-6 py-4">
          <div className="text-base font-bold text-slate-900">Progression</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
          >
            Stäng
          </button>
        </div>

        <div className="border-b border-black">
          <nav className="flex items-center gap-2 bg-slate-50 px-6 pt-2">
            <div className="flex gap-1">
              {([
                { id: "overview", label: "Tidslinje" },
                { id: "progression", label: "Progression" },
                { id: "settings", label: "Inställningar" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOverallTimelinePrimaryTab(tab.id)}
                  className={`rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:outline-none ${
                    overallTimelinePrimaryTab === tab.id
                      ? "bg-white text-slate-900 border-x border-t border-slate-200 -mb-px"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="space-y-5">
            {overallTimelinePrimaryTab === "overview"
              ? timelineTabView
              : overallTimelinePrimaryTab === "progression"
                ? progressionSubtabProgressionView
                : progressionSubtabSettingsView}
          </div>
        </div>
      </div>
    </div>
  );
}

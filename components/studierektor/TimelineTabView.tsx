"use client";

import type { ReactNode } from "react";
import type { TimelineSubtab } from "@/lib/studierektor/timelineTypes";

export default function TimelineTabView({
  timelineSubtab,
  setTimelineSubtab,
  overviewView,
  slutdatumView,
}: {
  timelineSubtab: TimelineSubtab;
  setTimelineSubtab: (next: TimelineSubtab) => void;
  overviewView: ReactNode;
  slutdatumView: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200">
        <nav className="flex items-center gap-1">
          {([
            { id: "months", label: "Tidslinje" },
            { id: "slutdatum", label: "Slutdatum" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTimelineSubtab(tab.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                timelineSubtab === tab.id
                  ? "border-x border-t border-slate-200 bg-white text-slate-900 -mb-px"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      {timelineSubtab === "months" ? overviewView : slutdatumView}
    </div>
  );
}

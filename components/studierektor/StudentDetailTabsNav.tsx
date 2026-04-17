"use client";

import type { StudentDetailMainTab } from "@/components/studierektor/studentDetailTypes";

export default function StudentDetailTabsNav({
  mainTab,
  setMainTab,
  formerStLakare,
}: {
  mainTab: StudentDetailMainTab;
  setMainTab: (tab: StudentDetailMainTab) => void;
  formerStLakare: boolean;
}) {
  return (
    <div className="border-b border-black">
      <nav className="flex gap-1 bg-slate-50 px-6 pt-2">
        {(
          [
            { id: "utbildningsmoment", label: "Utbildningsmoment" },
            { id: "delmal", label: "Delmål" },
            { id: "planering", label: "Planering" },
            { id: "handledartraffar", label: "Handledarträffar" },
            { id: "kommunikation", label: "Kommunikation" },
            { id: "kontaktuppgifter", label: "Kontaktuppgifter" },
          ] as const
        )
          .filter((t) => (formerStLakare ? t.id !== "kommunikation" : true))
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMainTab(t.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:outline-none ${
                mainTab === t.id
                  ? "bg-white text-slate-900 border-x border-t border-slate-200 -mb-px"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
      </nav>
    </div>
  );
}

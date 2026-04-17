"use client";

type Props = {
  iupPlanning: any;
  iupPlanningExtra: any[];
  placements: any[];
  planeringSubTab: "overgripande" | "enskild";
  setPlaneringSubTab: (tab: "overgripande" | "enskild") => void;
  selectedPlanPlacReadIdx: number | null;
  setSelectedPlanPlacReadIdx: (idx: number) => void;
};

export default function StudentPlaneringReadonly({
  iupPlanning,
  iupPlanningExtra,
  placements,
  planeringSubTab,
  setPlaneringSubTab,
  selectedPlanPlacReadIdx,
  setSelectedPlanPlacReadIdx,
}: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Planering (från IUP)</h3>

      <div className="flex gap-0 border-b border-slate-200 -mt-1 mb-1">
        {(
          [
            ["overgripande", "Övergripande"],
            ["enskild", "Enskild placering"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => setPlaneringSubTab(v)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              planeringSubTab === v
                ? "border-sky-600 text-sky-700"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {planeringSubTab === "overgripande" && (
        <>
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">
              Övergripande mål med utbildningen
            </label>
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
              {iupPlanning.overallGoals || "—"}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["clinicalService", "Kliniska tjänstgöringar"],
                ["courses", "Kurser"],
                ["supervisionMeetings", "Handledarsamtal"],
                ["theoreticalStudies", "Teoretiska studier"],
                ["practicalMoments", "Praktiska moment"],
                ["researchWork", "Vetenskapligt arbete"],
                ["journalClub", "Journal club"],
                ["congresses", "Kongresser"],
                ["qualityWork", "Kvalitetsarbete"],
                ["patientSafety", "Patientsäkerhetsarbete"],
                ["leadership", "Ledarskap"],
                ["supervisingStudents", "Handledning av studenter/underläkare"],
                ["teaching", "Undervisning"],
                ["formativeAssessments", "Formativa bedömningar"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-slate-800 mb-1">{label}</label>
                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap min-h-[2.5rem]">
                  {iupPlanning[key] || "—"}
                </div>
              </div>
            ))}

            {iupPlanningExtra.map((sec: any) => (
              <div key={sec.id}>
                <label className="block text-sm font-semibold text-slate-800 mb-1">{sec.title}</label>
                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap min-h-[2.5rem]">
                  {sec.content || "—"}
                </div>
              </div>
            ))}
          </div>

          {(() => {
            const keys = Object.keys(iupPlanning).filter((k) => k !== "placementNotes");
            const hasOvergripande =
              String(iupPlanning.overallGoals || "").trim() ||
              keys.some((k) => k !== "overallGoals" && String((iupPlanning as any)[k] || "").trim()) ||
              iupPlanningExtra.some((s: any) => String(s.content || "").trim());
            if (hasOvergripande) return null;
            return (
              <div className="text-sm text-slate-500">Ingen övergripande planering har registrerats i IUP ännu.</div>
            );
          })()}
        </>
      )}

      {planeringSubTab === "enskild" &&
        (() => {
          const raw = iupPlanning.placementNotes;
          const placementNotes: Record<string, string> =
            raw && typeof raw === "object" && !Array.isArray(raw)
              ? (raw as Record<string, string>)
              : {};
          const sortedPl = [...placements].sort((a: any, b: any) =>
            String(a.startDate || "").localeCompare(String(b.startDate || ""))
          );
          const today = new Date().toISOString().slice(0, 10);
          const defaultIdx = (() => {
            const i = sortedPl.findIndex(
              (p: any) =>
                (p.startDate || "") <= today && (p.endDate || "9999") >= today
            );
            return i >= 0 ? i : Math.max(0, sortedPl.length - 1);
          })();
          const idx = Math.min(
            selectedPlanPlacReadIdx ?? defaultIdx,
            Math.max(0, sortedPl.length - 1)
          );
          const selP: any = sortedPl.length > 0 ? sortedPl[idx] : null;
          const byId = new Map(sortedPl.map((p: any) => [String(p.id ?? ""), p]));
          const orphanIds = Object.keys(placementNotes).filter(
            (id) => !byId.has(id) && String(placementNotes[id] || "").trim()
          );
          const noteText = selP
            ? String(placementNotes[String(selP.id)] || "").trim()
            : "";

          return (
            <div className="space-y-4">
              {sortedPl.length === 0 ? (
                <p className="text-sm text-slate-400">Inga placeringar registrerade ännu.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => setSelectedPlanPlacReadIdx(idx - 1)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-40 hover:bg-slate-50"
                    >
                      ←
                    </button>
                    <div className="flex-1 overflow-x-auto">
                      <div className="flex gap-1.5 pb-1">
                        {sortedPl.map((p: any, i: number) => {
                          const label = p.clinic || p.title || "Placering";
                          const start = String(p.startDate || "").slice(0, 10);
                          const end = String(p.endDate || "").slice(0, 10);
                          const isActive = start <= today && end >= today;
                          return (
                            <button
                              key={p.id || i}
                              type="button"
                              onClick={() => setSelectedPlanPlacReadIdx(i)}
                              className={`flex-shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                                i === idx
                                  ? "border-sky-500 bg-sky-50 text-sky-800"
                                  : isActive
                                    ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {label}
                              {isActive && <span className="ml-1 text-[10px]">(pågående)</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={idx >= sortedPl.length - 1}
                      onClick={() => setSelectedPlanPlacReadIdx(idx + 1)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-40 hover:bg-slate-50"
                    >
                      →
                    </button>
                  </div>

                  {selP && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {selP.clinic || selP.title || "Placering"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {String(selP.startDate || "").slice(0, 10)} –{" "}
                          {String(selP.endDate || "").slice(0, 10)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          Anteckningar för denna placering
                        </label>
                        <div className="w-full min-h-[5rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                          {noteText || "—"}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {orphanIds.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <p className="text-xs font-semibold text-slate-600">Anteckning utan matchande placering</p>
                  {orphanIds.map((id) => (
                    <div
                      key={`orphan-${id}`}
                      className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2"
                    >
                      <p className="text-xs text-slate-500 mb-1 font-mono break-all">{id}</p>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap">
                        {String(placementNotes[id] || "").trim()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
    </div>
  );
}

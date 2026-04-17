"use client";

import React from "react";

type Props = {
  selCourse: any;
  selectedCourse: any;
  setCourses: React.Dispatch<React.SetStateAction<any[]>>;
  getCourseDisplayTitle: (course: any) => string;
  srUtbildningsmomentTemplates: any[];
  srCourseTemplates: any[];
  hemklinikSuggestions: any[];
  forslagPopupFor: "placement" | "course" | "utbildningsmoment" | null;
  setForslagPopupFor: (v: "placement" | "course" | "utbildningsmoment" | null) => void;
  forslagTab: "studierektor" | "kollegor";
  setForslagTab: (v: "studierektor" | "kollegor") => void;
};

export default function CourseDescriptionSection({
  selCourse,
  selectedCourse,
  setCourses,
  getCourseDisplayTitle,
  srUtbildningsmomentTemplates,
  srCourseTemplates,
  hemklinikSuggestions,
  forslagPopupFor,
  setForslagPopupFor,
  forslagTab,
  setForslagTab,
}: Props) {
  return (
    <div>
      {selectedCourse?.phase === "BT" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-slate-700">Beskrivning</label>
            <textarea
              value={String((selCourse as any)?.note || "")}
              onChange={(e) => {
                const v = e.target.value;
                setCourses((prev) => prev.map((c) => (c.id === selCourse.id ? { ...c, note: v } : c)));
              }}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700">Hur det kontrollerats att sökanden uppnått delmål (för intyg Delmål i BT)</label>
            <textarea
              value={String((selCourse as any)?.btAssessment || "")}
              onChange={(e) => {
                const v = e.target.value;
                setCourses((prev) => prev.map((c) => (c.id === selCourse.id ? { ...(c as any), btAssessment: v } : c)));
              }}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
            />
          </div>
        </div>
      ) : (
        <>
          {(() => {
            const isUtbMoment = selCourse.kind === "Utbildningsmoment";
            const popupKey: "course" | "utbildningsmoment" = isUtbMoment ? "utbildningsmoment" : "course";
            const displayTitle = isUtbMoment ? getCourseDisplayTitle(selCourse) : selCourse.title;
            const srDescRows: string[] = isUtbMoment
              ? (() => {
                  const tmpl = srUtbildningsmomentTemplates.find((t) => t.title === selCourse.title);
                  return tmpl?.suggested_rows?.length ? tmpl.suggested_rows : srUtbildningsmomentTemplates.flatMap((t) => t.suggested_rows || []);
                })()
              : (() => {
                  const tmpl = srCourseTemplates.find((t) => t.title === selCourse.title);
                  return tmpl?.suggested_rows?.length ? tmpl.suggested_rows : srCourseTemplates.flatMap((t) => t.suggested_rows || []);
                })();
            const colleagueSuggRows = isUtbMoment
              ? hemklinikSuggestions.filter(
                  (s) =>
                    (s.activity_type === "utbildningsmoment" || (s.activity_type === "course" && s.activity_data?.kind === "Utbildningsmoment")) &&
                    (s.activity_data?.title === selCourse.title ||
                      s.activity_data?.title === displayTitle ||
                      s.activity_data?.courseTitle === displayTitle)
                )
              : hemklinikSuggestions.filter(
                  (s) => s.activity_type === "course" && s.activity_data?.title === selCourse.title && s.activity_data?.kind !== "Utbildningsmoment"
                );
            const hasSuggestions = srDescRows.length > 0 || colleagueSuggRows.length > 0;
            return (
              <>
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-sm text-slate-700">Beskrivning (dubbelklicka i rutan för förslag)</label>
                  {hasSuggestions && forslagPopupFor === popupKey && (
                    <div className="relative">
                      <div data-forslag-popup="true" className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                        <div className="border-b border-slate-200 relative">
                          <div className="flex">
                            <button
                              type="button"
                              className={`flex-1 px-3 py-2 text-xs font-semibold ${
                                forslagTab === "studierektor" ? "bg-slate-50 border-b-2 border-blue-500 text-slate-700" : "text-slate-500 hover:bg-slate-50"
                              }`}
                              onClick={() => setForslagTab("studierektor")}
                            >
                              Studierektor
                            </button>
                            <button
                              type="button"
                              className={`flex-1 px-3 py-2 text-xs font-semibold ${
                                forslagTab === "kollegor" ? "bg-slate-50 border-b-2 border-blue-500 text-slate-700" : "text-slate-500 hover:bg-slate-50"
                              }`}
                              onClick={() => setForslagTab("kollegor")}
                            >
                              ST-kollegor
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setForslagPopupFor(null)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                            aria-label="Stäng"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {forslagTab === "studierektor" ? (
                          <>
                            <div className="px-3 py-2 border-b text-xs font-semibold text-slate-500">Klicka för att lägga till</div>
                            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                              {srDescRows.length > 0 ? (
                                srDescRows.map((row, i) => (
                                  <li key={i}>
                                    <button
                                      type="button"
                                      className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                                      onClick={() => {
                                        const current = String((selCourse as any)?.note || "");
                                        const next = current ? `${current}\n${row}` : row;
                                        setCourses((prev) => prev.map((c) => (c.id === selCourse.id ? { ...c, note: next } : c)));
                                      }}
                                    >
                                      {row}
                                    </button>
                                  </li>
                                ))
                              ) : (
                                <li className="px-3 py-2 text-sm text-slate-400">Inga förslag från studierektor</li>
                              )}
                            </ul>
                          </>
                        ) : (
                          <>
                            <div className="px-3 py-2 border-b text-xs font-semibold text-slate-500">Beskrivningar från ST-kollegor</div>
                            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                              {colleagueSuggRows.length > 0 ? (
                                colleagueSuggRows.map((s, i) => {
                                  const description = s.activity_data?.note || s.activity_data?.description || "";
                                  if (!description) return null;
                                  return (
                                    <li key={i}>
                                      <button
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                                        onClick={() => {
                                          const current = String((selCourse as any)?.note || "");
                                          const next = current ? `${current}\n${description}` : description;
                                          setCourses((prev) => prev.map((c) => (c.id === selCourse.id ? { ...c, note: next } : c)));
                                        }}
                                      >
                                        {description}
                                      </button>
                                    </li>
                                  );
                                })
                              ) : (
                                <li className="px-3 py-2 text-sm text-slate-400">
                                  {isUtbMoment ? "Inga beskrivningar från kollegor för detta utbildningsmoment" : "Inga beskrivningar från kollegor för denna kurs"}
                                </li>
                              )}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <textarea
                  data-note-editor="true"
                  value={String((selCourse as any)?.note || "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCourses((prev) => prev.map((c) => (c.id === selCourse.id ? { ...c, note: v } : c)));
                  }}
                  onDoubleClick={() => {
                    if (hasSuggestions) setForslagPopupFor(forslagPopupFor === popupKey ? null : popupKey);
                  }}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
                />
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}

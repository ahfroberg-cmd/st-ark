"use client";

import React, { useState } from "react";
import UtbildningsmomentTable from "@/components/pussla/UtbildningsmomentTable";

type Props = {
  courses: any[];
  selectedCourseId: string | null;
  btstWarnCourseIds: Set<string>;
  profile: any;
  getCourseDisplayTitle: (course: any) => string;
  switchActivity: (placementId: string | null, courseId: string | null) => boolean;
  setCertMenu: (next: any) => void;
  openPreviewForBtGoals: (activity: any) => void | Promise<void>;
  setCourseForModal: (course: any) => void;
  setCourseModalOpen: (open: boolean) => void;
};

export default function CoursesAndMomentsPanel(props: Props) {
  const {
    courses,
    selectedCourseId,
    btstWarnCourseIds,
    profile,
    getCourseDisplayTitle,
    switchActivity,
    setCertMenu,
    openPreviewForBtGoals,
    setCourseForModal,
    setCourseModalOpen,
  } = props;

  const nonMomentCourses = courses
    .filter((c) => c.kind !== "Utbildningsmoment")
    .slice()
    .sort((a, b) => {
      const da = a.endDate || a.certificateDate || a.startDate || "";
      const db = b.endDate || b.certificateDate || b.startDate || "";
      return da.localeCompare(db);
    });

  const utbMoment = courses.filter((c) => c.kind === "Utbildningsmoment");
  const groups = utbMoment.reduce((acc: Record<string, typeof courses>, c) => {
    const key = getCourseDisplayTitle(c) || "(Namnlost)";
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});
  const groupList = Object.entries(groups)
    .map(([displayTitle, items]) => {
      const sorted = [...items].sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
      return { title: displayTitle, items: sorted };
    })
    .sort((a, b) => a.title.localeCompare(b.title, "sv"));

  const [coursesOpen, setCoursesOpen] = useState(true);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setCoursesOpen((v) => !v)}
          className="flex w-full items-center justify-between border-b border-sky-200 bg-sky-50 px-3 py-2 text-left hover:bg-sky-100"
        >
          <div className="font-semibold text-sky-800">Kurser</div>
          <span className="text-sky-700">{coursesOpen ? "▾" : "▸"}</span>
        </button>

        {coursesOpen && <div className="max-h-[40vh] overflow-auto">
          <table className="w-full text-sm select-none">
            <thead className="sticky top-0 bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Kursnamn</th>
                <th className="px-3 py-2 text-left">Intygsdatum</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>

            <tbody className="cursor-default">
              {nonMomentCourses.map((c) => {
                const isSelected = selectedCourseId === c.id;
                return (
                  <tr
                    key={c.id}
                    className={`border-t ${
                      isSelected
                        ? "bg-slate-200 hover:bg-slate-300 text-slate-900 shadow-[inset_0_0_0_1px_rgba(100,116,139,1)]"
                        : "hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      switchActivity(null, c.id);
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      switchActivity(null, c.id);
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setCertMenu({
                        open: true,
                        x: Math.round(e.clientX),
                        y: Math.round(rect.top + rect.height / 2),
                        kind: "course",
                        placement: null,
                        course: c,
                      });
                    }}
                  >
                    <td className="px-3 py-1.5 align-middle leading-5" data-info={c.title || "—"}>
                      <span className="inline-flex items-center">
                        <span>{c.title || "—"}</span>
                        {c.phase === "BT" && (
                          <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-black bg-white text-[10px] leading-4 text-slate-900">
                            BT
                          </span>
                        )}
                        {btstWarnCourseIds.has(c.id) && (
                          <span
                            className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border text-[10px] leading-4 border-red-300 bg-red-50 text-red-900"
                            title="Detta intervall passerar gränsen BT → ST"
                          >
                            ⚠︎ BT→ST
                          </span>
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-1.5 align-middle leading-5 whitespace-nowrap" data-info={c.endDate || "—"}>
                      {c.endDate || "—"}
                    </td>

                    <td className="px-3 py-1.5 text-right align-middle leading-5 whitespace-nowrap">
                      {c.phase === "BT" ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            className={`inline-flex h-7 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
                              isSelected
                                ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
                                : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const dummyActivity: any = {
                                id: c.id,
                                type: "Klinisk tjänstgöring",
                                label: getCourseDisplayTitle(c),
                                startSlot: 0,
                                lengthSlots: 1,
                                hue: 0,
                                phase: "BT",
                                restPercent: 0,
                                isLocked: false,
                                supervisor: (c as any).supervisor || "",
                                supervisorSpeciality: (c as any).supervisorSpeciality || "",
                                supervisorSite: (c as any).supervisorSite || "",
                                note: c.note || "",
                                ...(c as any)?.btAssessment ? { btAssessment: (c as any).btAssessment as string } : {},
                                ...(c as any)?.btMilestones ? { btMilestones: (c as any).btMilestones as string[] } : {},
                              };
                              void openPreviewForBtGoals(dummyActivity);
                            }}
                            data-info="BT-intyg"
                          >
                            BT-intyg
                          </button>

                          {(c as any)?.fulfillsStGoals && (
                            <button
                              className={`inline-flex h-7 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
                                isSelected
                                  ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
                                  : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!profile) {
                                  alert("Profil saknas – kan inte skapa intyget.");
                                  return;
                                }
                                switchActivity(null, c.id);
                                setCourseForModal(c);
                                setCourseModalOpen(true);
                              }}
                              data-info="ST-intyg"
                            >
                              ST-intyg
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          className={`inline-flex h-7 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
                            isSelected
                              ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
                              : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!profile) {
                              alert("Profil saknas – kan inte skapa intyget.");
                              return;
                            }
                            switchActivity(null, c.id);
                            setCourseForModal(c);
                            setCourseModalOpen(true);
                          }}
                          data-info="Intyg"
                        >
                          Intyg
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {nonMomentCourses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-slate-500">
                    Inga kurser.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>}
      </div>

      <UtbildningsmomentTable
        groups={groupList}
        selectedCourseId={selectedCourseId}
        onSelectCourse={(courseId) => switchActivity(null, courseId)}
      />
    </div>
  );
}

"use client";

import React from "react";

type Props = {
  activities: any[];
  selectedPlacementId: string | null;
  displayDatesForActivity: (a: any) => { startISO: string; endISO: string };
  isZeroAttendanceType: (type: any) => boolean;
  switchActivity: (placementId: string | null, courseId: string | null) => boolean;
  setCertMenu: (next: any) => void;
  openPreviewForBtGoals: (activity: any) => void;
  profile: any;
  courses: any[];
  getCourseDisplayTitle: (course: any) => string;
  setSta3Placements: (items: any[]) => void;
  setSta3Courses: (items: any[]) => void;
  setSta3ResearchTitle: (v: string) => void;
  setSta3SupervisorName: (v: string) => void;
  setSta3SupervisorSpec: (v: string) => void;
  setSta3SupervisorSite: (v: string) => void;
  setSta3Open: (open: boolean) => void;
  openPreviewForPlacement: (activity: any) => void;
  isLeave: (type: any) => boolean;
  btstWarnActIds: Set<string>;
};

export default function ActivitiesTable({
  activities,
  selectedPlacementId,
  displayDatesForActivity,
  isZeroAttendanceType,
  switchActivity,
  setCertMenu,
  openPreviewForBtGoals,
  profile,
  courses,
  getCourseDisplayTitle,
  setSta3Placements,
  setSta3Courses,
  setSta3ResearchTitle,
  setSta3SupervisorName,
  setSta3SupervisorSpec,
  setSta3SupervisorSite,
  setSta3Open,
  openPreviewForPlacement,
  isLeave,
  btstWarnActIds,
}: Props) {
  return (
    <div className="max-h-[40vh] overflow-auto">
      <table className="w-full text-sm select-none">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left">Moment</th>
            <th className="px-3 py-2 text-center">Start</th>
            <th className="px-3 py-2 text-center">Slut</th>
            <th className="px-3 py-2 text-left">Handledare</th>
            <th className="px-12 py-2 text-center w-14">Syss.%</th>
            <th className="px-2 py-2 text-center w-24 whitespace-nowrap">Mån (motsv heltid)</th>
            <th className="px-3 py-2 text-center whitespace-nowrap">Intygsgrupp</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>

        <tbody className="cursor-default">
          {activities
            .slice()
            .sort((a, b) => a.startSlot - b.startSlot || (a.startSlot + a.lengthSlots) - (b.startSlot + b.lengthSlots))
            .map((a) => {
              const { startISO, endISO } = displayDatesForActivity(a);
              const isSelected = selectedPlacementId === a.id;
              const title = (() => {
                if (a.type === "Klinisk tjänstgöring" || a.type === "Auskultation") return a.label || a.type;
                if (a.type === "Annan ledighet") return a.leaveSubtype || a.type;
                if (a.type === "Vetenskapligt arbete" || a.type === "Förbättringsarbete") return a.type;
                return a.label || a.type;
              })();
              const attendance = isZeroAttendanceType(a.type) ? 0 : (a.attendance ?? 100);
              const fteMonths = a.lengthSlots * 0.5 * (attendance / 100);

              return (
                <tr
                  key={a.id}
                  className={`border-t ${isSelected ? "bg-slate-200 hover:bg-slate-300 text-slate-900 ring-1 ring-slate-300" : "hover:bg-slate-50"}`}
                  onClick={() => {
                    switchActivity(a.id, null);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    switchActivity(a.id, null);
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setCertMenu({
                      open: true,
                      x: Math.round(e.clientX),
                      y: Math.round(rect.top + rect.height / 2),
                      kind: "placement",
                      placement: a,
                      course: null,
                    });
                  }}
                >
                  <td className="px-3 py-1.5 align-middle leading-5" data-info={title}>
                    {(() => {
                      const baseStyle: React.CSSProperties =
                        a.type === "Forskning"
                          ? { backgroundColor: "#ffffff", border: "1px solid hsl(220 14% 82%)" }
                          : isLeave(a.type)
                            ? {
                                background:
                                  "repeating-linear-gradient(135deg, hsl(220 16% 98%),...(220 16% 98%) 6px, hsl(220 14% 86%) 6px, hsl(220 14% 86%) 8px)",
                                border: "1px solid hsl(220 12% 75%)",
                              }
                            : { backgroundColor: `hsl(${a.hue} 28% 88%)`, border: `1px solid hsl(${a.hue} 30% 72%)` };
                      return (
                        <span title={title} className="inline-flex items-center">
                          <span className="inline-block rounded-md px-2 py-0.5 text-[12px] leading-5 text-slate-900" style={baseStyle}>
                            {title}
                          </span>
                          {a.phase === "BT" && (
                            <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-black bg-white text-[10px] leading-4 text-slate-900">
                              BT
                            </span>
                          )}
                          {btstWarnActIds.has(a.id) && (
                            <span
                              className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border text-[10px] leading-4 border-red-300 bg-red-50 text-red-900"
                              title="Detta intervall passerar gränsen BT → ST"
                            >
                              ⚠︎ BT→ST
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </td>

                  <td className="px-3 py-1.5 text-center align-middle leading-5 whitespace-nowrap" data-info={startISO}>
                    {startISO}
                  </td>
                  <td className="px-3 py-1.5 text-center align-middle leading-5 whitespace-nowrap" data-info={endISO}>
                    {endISO}
                  </td>
                  <td className="px-3 py-1.5 align-middle leading-5">{(a as any).supervisor || "—"}</td>
                  <td className="px-3 py-1.5 text-center align-middle leading-5 whitespace-nowrap" data-info={isZeroAttendanceType(a.type) ? "—" : String(a.attendance ?? 100)}>
                    {isZeroAttendanceType(a.type) ? "—" : a.attendance ?? 100}
                  </td>
                  <td className="px-3 py-1.5 text-center align-middle leading-5 whitespace-nowrap" data-info={isZeroAttendanceType(a.type) ? "—" : fteMonths.toFixed(1)}>
                    {isZeroAttendanceType(a.type) ? "—" : fteMonths.toFixed(1)}
                  </td>
                  <td className="px-3 py-1.5 text-center align-middle leading-5 whitespace-nowrap text-slate-800">
                    {(() => {
                      const g = Number((a as any).intygGroup || 0);
                      if (!Number.isFinite(g) || g <= 0) return "Ingen";
                      const cfg = (a as any).intygGroupConfig as { title?: string } | null | undefined;
                      const t = cfg?.title && String(cfg.title).trim();
                      return t ? `${g}: ${t}` : String(g);
                    })()}
                  </td>

                  <td className="px-3 py-1.5 text-right align-middle leading-5 whitespace-nowrap">
                    {a.phase === "BT" ? (
                      <div className="inline-flex items-center gap-2">
                        {a.type === "Klinisk tjänstgöring" && (
                          <button
                            className={`inline-flex h-7 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
                              isSelected
                                ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
                                : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              switchActivity(a.id, null);
                              openPreviewForBtGoals(a);
                            }}
                            title="Delmål i bastjänstgöringen"
                            data-info="BT-intyg"
                          >
                            BT-intyg
                          </button>
                        )}
                        {(a as any)?.fulfillsStGoals && (
                          <button
                            className={`inline-flex h-7 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
                              isSelected
                                ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
                                : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              switchActivity(a.id, null);
                              if (!profile) {
                                alert("Profil saknas – kan inte skapa intyget.");
                                return;
                              }
                              openPreviewForPlacement(a);
                            }}
                            title="Intyg för klinisk tjänstgöring i ST"
                            data-info="ST-intyg"
                          >
                            ST-intyg
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        className={`inline-flex h-7 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
                          isSelected
                            ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
                            : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
                        }`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          switchActivity(a.id, null);
                          if (!profile) {
                            alert("Profil saknas – kan inte skapa intyget.");
                            return;
                          }

                          const v = String(profile?.goalsVersion || "");
                          if (a.type === "Vetenskapligt arbete" && v.includes("2021")) {
                            const isSta3 = (m: any) => {
                              const id = String(m ?? "")
                                .trim()
                                .split(/\s|–|-|:|\u2013/)[0]
                                .toLowerCase();
                              return id === "a3" || id === "sta3";
                            };

                            const placementItems = activities
                              .filter((x: any) => x.type === "Klinisk tjänstgöring" && Array.isArray((x as any).milestones) && (x as any).milestones.some(isSta3))
                              .map((x: any) => {
                                const { startISO, endISO } = displayDatesForActivity(x);
                                const title = x.label || x.type;
                                return {
                                  id: (x as any).linkedPlacementId || x.id,
                                  title,
                                  period: `${startISO}${endISO ? ` – ${endISO}` : ""}`,
                                };
                              });

                            const courseItems = courses
                              .filter((c: any) => Array.isArray((c as any).milestones) && (c as any).milestones.some(isSta3))
                              .map((c: any) => ({
                                id: (c as any).linkedCourseId || c.id,
                                title: getCourseDisplayTitle(c),
                                period: [c.city, ((c as any).certificateDate || c.endDate || c.startDate || "") as string].filter(Boolean).join(" · "),
                              }));

                            setSta3Placements(placementItems);
                            setSta3Courses(courseItems);
                            setSta3ResearchTitle(a.label || a.note || "");
                            setSta3SupervisorName(a.supervisor || "");
                            setSta3SupervisorSpec(a.supervisorSpeciality || "");
                            setSta3SupervisorSite(a.supervisorSite || (profile as any)?.homeClinic || "");
                            setSta3Open(true);
                            return;
                          }

                          openPreviewForPlacement(a);
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
          {activities.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-3 text-slate-500">
                Inga aktiviteter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

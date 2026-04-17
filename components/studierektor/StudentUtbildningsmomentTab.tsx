"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/studierektor/dateUtils";
import type { StudentDetailUmTab } from "@/components/studierektor/studentDetailTypes";
import {
  buildAssessmentSelectedActivity,
  buildSupervisionSelectedActivity,
} from "@/lib/studierektor/sessionSelection";

function calculateMonths(startDate: string, endDate: string, attendance: number = 100): number {
  if (!startDate || !endDate) return 0;
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.round(months * (attendance / 100) * 10) / 10;
  } catch {
    return 0;
  }
}

export default function StudentUtbildningsmomentTab({
  umTab,
  setUmTab,
  placements,
  courses,
  selectedActivity,
  setSelectedActivity,
  placementHueById,
  iupMeetings,
  supervisorMeetings,
  iupAssessments,
  progressAssessments,
  progressPct,
  milestoneProgressPct,
  setProgressDetailOpen,
  studierektorTimelineView,
}: {
  umTab: StudentDetailUmTab;
  setUmTab: (tab: StudentDetailUmTab) => void;
  placements: any[];
  courses: any[];
  selectedActivity: any;
  setSelectedActivity: (activity: any) => void;
  placementHueById: Map<string, number>;
  iupMeetings: any[];
  supervisorMeetings: any[];
  iupAssessments: any[];
  progressAssessments: any[];
  progressPct: number;
  milestoneProgressPct: number;
  setProgressDetailOpen: (kind: "time" | "milestones") => void;
  studierektorTimelineView: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b pb-2">
        <nav className="flex gap-2">
          {([
            { id: "lista", label: "Lista" },
            { id: "tidslinje", label: "Tidslinje" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setUmTab(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                umTab === tab.id ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {umTab === "lista" ? (
        <>
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="font-semibold">Klinisk tjänstgöring, arbeten, ledighet</div>
            </div>
            <div className="max-h-[40vh] overflow-auto">
              <table className="w-full text-sm select-none">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Moment</th>
                    <th className="px-3 py-2 text-center">Start</th>
                    <th className="px-3 py-2 text-center">Slut</th>
                    <th className="px-3 py-2 text-center w-14">Syss.%</th>
                    <th className="px-2 py-2 text-center w-24 whitespace-nowrap">Mån</th>
                  </tr>
                </thead>
                <tbody className="cursor-default">
                  {[...placements]
                    .sort((a: any, b: any) => new Date(a.startDate || "").getTime() - new Date(b.startDate || "").getTime())
                    .map((p: any, i: number) => {
                      const months = calculateMonths(p.startDate, p.endDate, p.attendance);
                      const isSelected = selectedActivity?.id === p.id;
                      const hue = placementHueById.get(String(p?.id ?? "")) ?? (p as any)?.hue ?? (210 + i * 30) % 360;
                      return (
                        <tr
                          key={p.id || i}
                          className={`border-t ${isSelected ? "bg-slate-200 hover:bg-slate-300 text-slate-900 ring-1 ring-slate-300" : "hover:bg-slate-50"}`}
                          onClick={() => setSelectedActivity(p)}
                        >
                          <td className="px-3 py-1.5">
                            <span className="inline-flex items-center">
                              <span
                                className="inline-flex items-center rounded-md px-2 py-0.5 text-[12px] leading-5"
                                style={{
                                  backgroundColor: `hsl(${hue} 28% 88%)`,
                                  border: `1px solid hsl(${hue} 30% 72%)`,
                                }}
                              >
                                <span className="text-slate-900">{p.clinic || p.label || p.type || "Placering"}</span>
                              </span>
                              {p.phase === "BT" && (
                                <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-black bg-white text-[10px] leading-4 text-slate-900">
                                  BT
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-center">{formatDate(p.startDate)}</td>
                          <td className="px-3 py-1.5 text-center">{formatDate(p.endDate)}</td>
                          <td className="px-3 py-1.5 text-center">{p.attendance ?? 100}</td>
                          <td className="px-2 py-1.5 text-center">{months.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  {placements.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-slate-500">
                        Inga aktiviteter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="font-semibold">Kurser</div>
              </div>
              <div className="max-h-[40vh] overflow-auto">
                <table className="w-full text-sm select-none">
                  <thead className="sticky top-0 bg-slate-50 text-left">
                    <tr>
                      <th className="px-3 py-2">Kursnamn</th>
                      <th className="px-3 py-2 text-left">Intygsdatum</th>
                    </tr>
                  </thead>
                  <tbody className="cursor-default">
                    {[...courses.filter((c: any) => c.kind !== "Utbildningsmoment")]
                      .sort((a: any, b: any) => (a.endDate || a.certificateDate || "").localeCompare(b.endDate || b.certificateDate || ""))
                      .map((c: any, i: number) => {
                        const isSelected = selectedActivity?.id === c.id;
                        return (
                          <tr
                            key={c.id || i}
                            className={`border-t ${isSelected ? "bg-slate-200 hover:bg-slate-300 text-slate-900 shadow-[inset_0_0_0_1px_rgba(100,116,139,1)]" : "hover:bg-slate-50"}`}
                            onClick={() => setSelectedActivity(c)}
                          >
                            <td className="px-3 py-1.5">
                              <span className="inline-flex items-center">
                                <span>{c.title || c.name || "—"}</span>
                                {c.phase === "BT" && (
                                  <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-black bg-white text-[10px] leading-4 text-slate-900">
                                    BT
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">{c.endDate || c.certificateDate || "—"}</td>
                          </tr>
                        );
                      })}
                    {courses.filter((c: any) => c.kind !== "Utbildningsmoment").length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-3 py-3 text-slate-500">
                          Inga kurser.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="font-semibold">Utbildningsmoment</div>
              </div>
              <div className="max-h-[30vh] overflow-auto">
                <table className="w-full text-sm select-none">
                  <thead className="sticky top-0 bg-slate-50 text-left">
                    <tr>
                      <th className="px-3 py-2">Titel</th>
                      <th className="px-3 py-2 text-left">Datum</th>
                      <th className="px-3 py-2 text-center">Antal</th>
                    </tr>
                  </thead>
                  <tbody className="cursor-default">
                    {[...courses.filter((c: any) => c.kind === "Utbildningsmoment")]
                      .sort((a: any, b: any) => (a.startDate || a.endDate || "").localeCompare(b.startDate || b.endDate || ""))
                      .map((c: any, i: number) => {
                        const isSelected = selectedActivity?.id === c.id;
                        const sameTitleCount = (courses || [])
                          .filter((x: any) => x.kind === "Utbildningsmoment")
                          .filter((x: any) => {
                            const a = x.title === "Annan" ? x.courseTitle || x.title : x.title || x.name || "";
                            const b = c.title === "Annan" ? c.courseTitle || c.title : c.title || c.name || "";
                            return String(a).trim() === String(b).trim();
                          }).length;
                        return (
                          <tr
                            key={c.id || i}
                            className={`border-t ${isSelected ? "bg-slate-200 hover:bg-slate-300 text-slate-900 shadow-[inset_0_0_0_1px_rgba(100,116,139,1)]" : "hover:bg-slate-50"}`}
                            onClick={() => setSelectedActivity(c)}
                          >
                            <td className="px-3 py-1.5">
                              <span className="inline-flex items-center">
                                <span>{c.title === "Annan" ? c.courseTitle || c.title : c.title || c.name || "—"}</span>
                                {c.phase === "BT" && (
                                  <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-black bg-white text-[10px] leading-4 text-slate-900">
                                    BT
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">{c.startDate || c.endDate || "—"}</td>
                            <td className="px-3 py-1.5 text-center">{sameTitleCount || 1}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="font-semibold">Handledarträffar</div>
              </div>
              <div className="max-h-[30vh] overflow-auto">
                <table className="w-full text-sm select-none">
                  <thead className="sticky top-0 bg-slate-50 text-left">
                    <tr>
                      <th className="px-3 py-2">Datum</th>
                      <th className="px-3 py-2">Fokus</th>
                      <th className="px-3 py-2">Diskuterat</th>
                    </tr>
                  </thead>
                  <tbody className="cursor-default">
                    {(iupMeetings.length > 0 ? iupMeetings : supervisorMeetings)
                      .slice()
                      .sort((a: any, b: any) => (a.dateISO || a.date || "").localeCompare(b.dateISO || b.date || ""))
                      .map((m: any, i: number) => (
                        <tr
                          key={m.id || i}
                          className={`border-t cursor-pointer ${
                            selectedActivity?.__type === "supervision" && selectedActivity?.id === (m.id || i)
                              ? "bg-slate-200 hover:bg-slate-300 text-slate-900 ring-1 ring-slate-300"
                              : "hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setSelectedActivity(buildSupervisionSelectedActivity(m, m.id || i));
                          }}
                        >
                          <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(m.dateISO || m.date)}</td>
                          <td className="px-3 py-1.5">{m.focus || "—"}</td>
                          <td className="px-3 py-1.5 truncate max-w-[200px]">{m.discussed || m.note || m.notes || "—"}</td>
                        </tr>
                      ))}
                    {iupMeetings.length === 0 && supervisorMeetings.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-slate-500">
                          Inga handledarträffar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="font-semibold">Progressionsbedömningar</div>
              </div>
              <div className="max-h-[30vh] overflow-auto">
                <table className="w-full text-sm select-none">
                  <thead className="sticky top-0 bg-slate-50 text-left">
                    <tr>
                      <th className="px-3 py-2">Datum</th>
                      <th className="px-3 py-2">Instrument</th>
                      <th className="px-3 py-2">Nivå</th>
                    </tr>
                  </thead>
                  <tbody className="cursor-default">
                    {(iupAssessments.length > 0 ? iupAssessments : progressAssessments)
                      .slice()
                      .sort((a: any, b: any) => (a.dateISO || a.date || "").localeCompare(b.dateISO || b.date || ""))
                      .map((a: any, i: number) => (
                        <tr
                          key={a.id || i}
                          className={`border-t cursor-pointer ${
                            selectedActivity?.__type === "assessment" && selectedActivity?.id === (a.id || i)
                              ? "bg-slate-200 hover:bg-slate-300 text-slate-900 ring-1 ring-slate-300"
                              : "hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setSelectedActivity(buildAssessmentSelectedActivity(a, a.id || i));
                          }}
                        >
                          <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(a.dateISO || a.date)}</td>
                          <td className="px-3 py-1.5">{a.instrument || "—"}</td>
                          <td className="px-3 py-1.5">{a.level || a.assessment || a.bedömning || "—"}</td>
                        </tr>
                      ))}
                    {iupAssessments.length === 0 && progressAssessments.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-slate-500">
                          Inga progressionsbedömningar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <button
                  type="button"
                  className="font-semibold text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0 text-left"
                  onClick={() => setProgressDetailOpen("time")}
                >
                  Genomförd tid
                </button>
                <button
                  type="button"
                  className="font-semibold text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0"
                  onClick={() => setProgressDetailOpen("time")}
                >
                  {progressPct.toFixed(0)} %
                </button>
              </div>
              <div className="p-3">
                <div className="h-4 w-full rounded-full bg-slate-200 cursor-pointer" onClick={() => setProgressDetailOpen("time")}>
                  <div className="h-4 rounded-full transition-[width] duration-300 bg-emerald-500/80" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <button
                  type="button"
                  className="font-semibold text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0 text-left"
                  onClick={() => setProgressDetailOpen("milestones")}
                >
                  Delmålsuppfyllnad
                </button>
                <button
                  type="button"
                  className="font-semibold text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0"
                  onClick={() => setProgressDetailOpen("milestones")}
                >
                  {milestoneProgressPct.toFixed(0)} %
                </button>
              </div>
              <div className="p-3">
                <div className="h-4 w-full rounded-full bg-slate-200 cursor-pointer" onClick={() => setProgressDetailOpen("milestones")}>
                  <div
                    className="h-4 rounded-full transition-[width] duration-300 bg-emerald-500/80"
                    style={{ width: `${milestoneProgressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        studierektorTimelineView
      )}
    </div>
  );
}

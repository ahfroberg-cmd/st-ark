// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { validateJsonFile, safeJsonParse } from "@/lib/validation";
import dynamic from "next/dynamic";

const AboutModal = dynamic(() => import("@/components/AboutModal"), { ssr: false });

interface SupervisorStudent {
  id: string;
  name: string;
  personnummer: string;
  specialty: string;
  goalsVersion: "2015" | "2021";
  importedAt: string;
  lastUpdated: string;
  profile: any;
  placements: any[];
  courses: any[];
  achievements: any[];
}

 const MONTH_NAMES = [
   "Jan",
   "Feb",
   "Mar",
   "Apr",
   "Maj",
   "Jun",
   "Jul",
   "Aug",
   "Sep",
   "Okt",
   "Nov",
   "Dec",
 ];

 const OUTSIDE_BG_CELL =
   "bg-[repeating-linear-gradient(135deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_8px)]";
 const INSIDE_BG_CELL = "bg-white";
 const OUTSIDE_BG_LANE =
   "bg-[repeating-linear-gradient(135deg,#eef2f7,#eef2f7_6px,#e6ebf2_6px,#e6ebf2_8px)]";
 const INSIDE_BG_LANE = "bg-slate-100";

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("sv-SE");
  } catch {
    return "-";
  }
}

 function isValidISODate(s: string | undefined | null): s is string {
   if (!s) return false;
   if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
   const d = new Date(s + "T00:00:00");
   return !isNaN(d.getTime());
 }

 function toISODate(y: number, m1: number, d: number) {
   const yy = String(y).padStart(4, "0");
   const mm = String(m1).padStart(2, "0");
   const dd = String(d).padStart(2, "0");
   return `${yy}-${mm}-${dd}`;
 }

 function normalizeToISODate(v: unknown): string | null {
   if (!v) return null;
   if (typeof v === "string") {
     const s: any = String(v).trim();
     if (!s) return null;
     // YYYY-MM-DD
     if (isValidISODate(s)) return s;
     // YYYY-MM-DDTHH:mm...
     if (s.length >= 10 && isValidISODate(s.slice(0, 10))) return s.slice(0, 10);
     // DD/MM/YYYY or DD-MM-YYYY
     const m1 = s.match(/^\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*$/);
     if (m1) {
       const d = Number(m1[1]);
       const m = Number(m1[2]);
       const y = Number(m1[3]);
       if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return toISODate(y, m, d);
     }
     // YYYY/MM/DD
     const m2 = s.match(/^\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*$/);
     if (m2) {
       const y = Number(m2[1]);
       const m = Number(m2[2]);
       const d = Number(m2[3]);
       if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return toISODate(y, m, d);
     }
     // Fallback: Date.parse
     const parsed = new Date(s);
     if (!isNaN(parsed.getTime())) {
       return toISODate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
     }
     return null;
   }
   if (v instanceof Date) {
     if (isNaN(v.getTime())) return null;
     return toISODate(v.getFullYear(), v.getMonth() + 1, v.getDate());
   }
   if (typeof v === "number") {
     const d = new Date(v);
     if (!isNaN(d.getTime())) return toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate());
   }
   return null;
 }

 function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

 function daysInYear(y: number) {
   const start = new Date(y, 0, 1);
   const end = new Date(y + 1, 0, 1);
   return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
 }

 function dayOfYear(d: Date) {
   const start = new Date(d.getFullYear(), 0, 1);
   return Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
 }

 function dateToSlotSnapped(startYear: number, dISO: string, mode: "start" | "end" = "start"): number {
   if (!isValidISODate(dISO)) return Number.POSITIVE_INFINITY;
   const d = new Date(dISO + "T00:00:00");
   let y = d.getFullYear();
   let m0 = d.getMonth();
   const day = d.getDate();

   // Samma gränser som i planera-st:
   // 1–7 => H1, 8–22 => H2, 23–EOM => nästa månads H1
   if (day <= 7) {
     return (y - startYear) * 24 + m0 * 2 + 0;
   }
   if (day <= 22) {
     return (y - startYear) * 24 + m0 * 2 + 1;
   }
   m0 += 1;
   if (m0 >= 12) {
     m0 = 0;
     y += 1;
   }
   return (y - startYear) * 24 + m0 * 2 + 0;
 }

 function clamp(n: number, min: number, max: number) {
   return Math.max(min, Math.min(max, n));
 }

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

function ActivityDetailPopup({
  activity,
  onClose,
  goalsVersion,
}: {
  activity: any;
  onClose: () => void;
  goalsVersion: string;
}) {
  const isSession = activity?.__type === "supervision" || activity?.__type === "assessment";

  if (isSession) {
    const isSupervision = activity?.__type === "supervision";
    const headerHue = isSupervision ? 155 : 38;
    const title =
      activity?.title ||
      activity?.name ||
      (isSupervision ? "Handledarsamtal" : "Progressionsbedömning");
    const dateISO = activity?.dateISO || activity?.date || activity?.iso;
    const note = activity?.note || activity?.notes || activity?.summary || activity?.assessment;

    const extraEntries = Object.entries(activity || {}).filter(([k, v]) => {
      if (v == null || v === "") return false;
      return ![
        "__type",
        "id",
        "_id",
        "dateISO",
        "date",
        "iso",
        "title",
        "name",
        "note",
        "notes",
        "summary",
        "assessment",
        "kind",
        "type",
      ].includes(k);
    });

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div
          className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="border-b px-5 py-4"
            style={{
              backgroundColor: `hsl(${headerHue} 30% 95%)`,
              borderColor: `hsl(${headerHue} 30% 80%)`,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-600">
                  {isSupervision ? "Handledarsamtal" : "Progressionsbedömning"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
              >
                Stäng
              </button>
            </div>
          </div>

          <div className="max-h-[calc(80vh-80px)] overflow-y-auto p-5 space-y-4">
            <div>
              <p className="text-sm text-slate-500">Datum</p>
              <p className="font-medium text-slate-900">{formatDate(dateISO)}</p>
            </div>

            {note && (
              <div>
                <p className="text-sm text-slate-500">Anteckning</p>
                <p className="text-slate-900 whitespace-pre-wrap">{String(note)}</p>
              </div>
            )}

            {extraEntries.length > 0 && (
              <div>
                <p className="text-sm text-slate-500">Övrigt</p>
                <div className="mt-2 space-y-2">
                  {extraEntries.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-2 gap-4">
                      <p className="text-sm text-slate-600 break-words">{k}</p>
                      <p className="text-sm text-slate-900 break-words">
                        {typeof v === "string" || typeof v === "number" || typeof v === "boolean"
                          ? String(v)
                          : JSON.stringify(v)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const milestones = activity.milestones || activity.stMilestones || [];
  const btMilestones = activity.btMilestones || [];
  const hueRaw = Number(activity?.hue);
  const hue = Number.isFinite(hueRaw) ? ((hueRaw % 360) + 360) % 360 : 210;
  
  // Beräkna månader om möjligt
  const months = activity.startDate && activity.endDate 
    ? calculateMonths(activity.startDate, activity.endDate, activity.attendance ?? 100)
    : null;

  // Avgör om det är en kurs eller placering
  const isCourse = !!(activity.title || activity.name || activity.kind || activity.certificateDate);

  const chipLabel = (m: unknown) =>
    String(m)
      .trim()
      .split(/\s|–|-|:|\u2013/)[0]
      .toLowerCase();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div 
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header med färgad bakgrund */}
        <div 
          className="border-b px-5 py-4"
          style={{ 
            backgroundColor: `hsl(${hue} 30% 95%)`,
            borderColor: `hsl(${hue} 30% 80%)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {activity.clinic || activity.label || activity.title || activity.name || "Aktivitet"}
              </h3>
              <p className="text-sm text-slate-600">
                {activity.type || activity.kind || (isCourse ? "Kurs" : "Klinisk tjänstgöring")}
                {activity.phase && <span className="ml-2 font-medium">• {activity.phase}</span>}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
            >
              Stäng
            </button>
          </div>
        </div>
        
        <div className="max-h-[calc(80vh-80px)] overflow-y-auto p-5 space-y-4">
          {/* Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Start</p>
              <p className="font-medium text-slate-900">{formatDate(activity.startDate)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{isCourse ? "Intygsdatum" : "Slut"}</p>
              <p className="font-medium text-slate-900">
                {formatDate(activity.certificateDate || activity.endDate)}
              </p>
            </div>
          </div>

          {/* Sysselsättningsgrad & Månader (bara för placeringar) */}
          {!isCourse && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Sysselsättningsgrad</p>
                <p className="font-medium text-slate-900">{activity.attendance ?? 100}%</p>
              </div>
              {months !== null && (
                <div>
                  <p className="text-sm text-slate-500">Tjänstgöringstid</p>
                  <p className="font-medium text-slate-900">{months.toFixed(1)} mån</p>
                </div>
              )}
            </div>
          )}

          {/* Handledare */}
          {activity.supervisor && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Handledare</p>
                <p className="font-medium text-slate-900">{activity.supervisor}</p>
              </div>
              {activity.supervisorSpeciality && (
                <div>
                  <p className="text-sm text-slate-500">Specialitet</p>
                  <p className="font-medium text-slate-900">{activity.supervisorSpeciality}</p>
                </div>
              )}
            </div>
          )}

          {/* Verksamhetschef */}
          {activity.operationsManager && (
            <div>
              <p className="text-sm text-slate-500">Verksamhetschef</p>
              <p className="font-medium text-slate-900">{activity.operationsManager}</p>
            </div>
          )}

          {/* Studierektor */}
          {activity.studyDirector && (
            <div>
              <p className="text-sm text-slate-500">Studierektor</p>
              <p className="font-medium text-slate-900">{activity.studyDirector}</p>
            </div>
          )}

          {/* BT-delmål */}
          {goalsVersion === "2021" && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">BT-delmål</p>
              <div className="flex items-center gap-1 flex-wrap">
                {btMilestones.length > 0 ? (
                  (btMilestones as any[]).map((m: any) => (
                    <button
                      key={`bt-${String(m)}`}
                      type="button"
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
                    >
                      {chipLabel(m)}
                    </button>
                  ))
                ) : (
                  <span className="text-slate-400 text-sm">—</span>
                )}
              </div>
            </div>
          )}

          {/* ST-delmål */}
          {milestones.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">ST-delmål</p>
              <div className="flex items-center gap-1 flex-wrap">
                {(milestones as any[]).map((m: any) => (
                  <button
                    key={`st-${String(m)}`}
                    type="button"
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
                  >
                    {chipLabel(m)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Anordnare (för kurser) */}
          {activity.organizer && (
            <div>
              <p className="text-sm text-slate-500">Anordnare</p>
              <p className="font-medium text-slate-900">{activity.organizer}</p>
            </div>
          )}

          {/* Kursledare (för kurser) */}
          {activity.courseLeader && (
            <div>
              <p className="text-sm text-slate-500">Kursledare</p>
              <p className="font-medium text-slate-900">{activity.courseLeader}</p>
            </div>
          )}

          {/* Anteckningar */}
          {(activity.note || activity.notes) && (
            <div>
              <p className="text-sm text-slate-500">Anteckningar</p>
              <p className="text-slate-900 whitespace-pre-wrap">{activity.note || activity.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentDetailModal({
  student,
  onClose,
}: {
  student: SupervisorStudent;
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<"lista" | "tidslinje">("lista");
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [hoveredSupervisionId, setHoveredSupervisionId] = useState<string | null>(null);
  const [hoveredAssessmentId, setHoveredAssessmentId] = useState<string | null>(null);
  const laneRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [laneWidthByYear, setLaneWidthByYear] = useState<Record<number, number>>({});
  const chipWidthsRef = useRef<Record<string, number>>({});
  const [, forceRerender] = useState(0);
  
  const placements = student.placements || [];
  const courses = student.courses || [];
  const profile = student.profile || {};
  const goalsVersion = student.goalsVersion;
  
  // Handledarträffar och progressionsbedömningar från profilen
  const supervisorMeetings =
    profile.supervisorMeetings ||
    profile.handledartraffar ||
    profile.meetings ||
    profile.iup?.meetings ||
    profile.iup?.supervisionSessions ||
    [];
  const progressAssessments =
    profile.progressAssessments ||
    profile.progressionsbedömningar ||
    profile.assessments ||
    profile.iup?.assessments ||
    profile.iup?.assessmentSessions ||
    [];

  const supervisionSessions = supervisorMeetings
    .map((m: any, i: number) => ({
      id: String(m.id || m._id || `meeting-${i}`),
      dateISO: normalizeToISODate(m.date || m.dateISO || m.iso) || "",
      title: String(m.title || m.subject || m.topic || ""),
      note: m.note || m.notes || m.summary || "",
      __type: "supervision" as const,
    }))
    .filter((s: any) => isValidISODate(s.dateISO));

  const assessmentSessions = progressAssessments
    .map((a: any, i: number) => ({
      id: String(a.id || a._id || `assessment-${i}`),
      dateISO: normalizeToISODate(a.date || a.dateISO || a.iso) || "",
      title: String(a.title || a.instrument || a.level || a.assessment || ""),
      note: a.note || a.notes || a.summary || a.assessment || "",
      __type: "assessment" as const,
    }))
    .filter((s: any) => isValidISODate(s.dateISO));
  
  const totalMonths = placements.reduce((sum: number, p: any) => 
    sum + calculateMonths(p.startDate, p.endDate, p.attendance), 0);
  const targetMonths = 60;
  const progress = Math.min(100, Math.round((totalMonths / targetMonths) * 100));

  // Beräkna tidslinje-data
  const allActivities = [...placements, ...courses].sort((a, b) => {
    const dateA = new Date(a.startDate || a.certificateDate || "").getTime();
    const dateB = new Date(b.startDate || b.certificateDate || "").getTime();
    return dateA - dateB;
  });

  const years = Array.from(new Set(allActivities.map(a => {
    const d = new Date(a.startDate || a.certificateDate || "");
    return d.getFullYear();
  }).filter(y => !isNaN(y)))).sort();

  const minYear = years[0] || new Date().getFullYear();
  const maxYear = years[years.length - 1] || new Date().getFullYear();

  const timelineYears: number[] = [];
  
  const profileBtStartISO = isValidISODate(profile?.btStartDate) ? profile.btStartDate : null;
  const profileStStartISO = isValidISODate(profile?.stStartDate) ? profile.stStartDate : null;
  const profileStartISO = goalsVersion === "2021" ? (profileBtStartISO || profileStStartISO) : profileStStartISO;
  const startYearForSlots = profileStartISO ? new Date(profileStartISO + "T00:00:00").getFullYear() : minYear;

  const visibleStartSlot = profileStartISO ? dateToSlotSnapped(startYearForSlots, profileStartISO, "start") : null;

  const profileEndISO = (() => {
    const raw = (profile?.stEndDate || profile?.stEndISO || "") as string;
    if (isValidISODate(raw)) return raw;
    // Om saknas: beräkna 5 år (60 månader) från ST-start (eller profilStart om ST-start saknas)
    const base = profileStStartISO || profileStartISO;
    return base ? addMonthsISO(base, 60) : null;
  })();

  const endBoundarySlot = profileEndISO
    ? dateToSlotSnapped(startYearForSlots, profileEndISO, "end")
    : (visibleStartSlot != null ? visibleStartSlot + 120 : null);

  const btStartSlot = profileBtStartISO ? dateToSlotSnapped(startYearForSlots, profileBtStartISO, "start") : null;
  const stStartSlot = profileStStartISO ? dateToSlotSnapped(startYearForSlots, profileStStartISO, "start") : null;
  const stEndSlot = profileEndISO ? dateToSlotSnapped(startYearForSlots, profileEndISO, "end") : null;

  const timelineStartYear = startYearForSlots;
  const timelineEndYear = (() => {
    if (endBoundarySlot == null || !Number.isFinite(endBoundarySlot)) return maxYear;
    // endBoundarySlot är en "kant"; för att inkludera rätt slutår tar vi slot-1
    const lastSlot = Math.max(0, endBoundarySlot - 1);
    return startYearForSlots + Math.floor(lastSlot / 24);
  })();

  for (let y = timelineStartYear; y <= timelineEndYear; y++) timelineYears.push(y);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{student.name}</h2>
            <p className="text-sm text-slate-600">
              {student.specialty} • Målversion {student.goalsVersion}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Vy-väljare */}
            <div className="flex rounded-lg border border-slate-300 bg-slate-100 p-0.5">
              <button
                onClick={() => setViewMode("lista")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === "lista" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Lista
              </button>
              <button
                onClick={() => setViewMode("tidslinje")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === "tidslinje" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tidslinje
              </button>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600">Genomförd tid</p>
              <p className="text-lg font-bold text-emerald-600">
                {Math.round(totalMonths * 10) / 10} / {targetMonths} mån ({progress}%)
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
            >
              Stäng
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-80px)] overflow-y-auto p-6">
          {viewMode === "lista" ? (
            <div className="space-y-6">
              {/* Klinisk tjänstgöring - tabellformat som planera-st */}
              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Klinisk tjänstgöring ({placements.length})
                </h3>
                {placements.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Placering</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-700">Start</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-700">Slut</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-700">%</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-700">Mån</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Handledare</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {placements.map((p: any, i: number) => {
                          const hue = p.hue ?? (210 + i * 30) % 360;
                          const months = calculateMonths(p.startDate, p.endDate, p.attendance);
                          return (
                            <tr 
                              key={p.id || i} 
                              className="hover:bg-slate-50 cursor-pointer"
                              onClick={() => setSelectedActivity(p)}
                            >
                              <td className="px-3 py-2">
                                <span 
                                  className="inline-block rounded-md px-2 py-0.5 text-xs text-slate-900"
                                  style={{
                                    backgroundColor: `hsl(${hue} 28% 88%)`,
                                    border: `1px solid hsl(${hue} 30% 72%)`,
                                  }}
                                >
                                  {p.clinic || p.label || "-"}
                                </span>
                                {p.phase === "BT" && (
                                  <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-slate-900 bg-white text-[10px] text-slate-900">
                                    BT
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center text-slate-600">{formatDate(p.startDate)}</td>
                              <td className="px-3 py-2 text-center text-slate-600">{formatDate(p.endDate)}</td>
                              <td className="px-3 py-2 text-center text-slate-600">{p.attendance ?? 100}</td>
                              <td className="px-3 py-2 text-center text-slate-600">{months.toFixed(1)}</td>
                              <td className="px-3 py-2 text-slate-600">{p.supervisor || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Inga placeringar registrerade.</p>
                )}
              </div>

              {/* Kurser - tabellformat */}
              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Kurser ({courses.length})
                </h3>
                {courses.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Kurs</th>
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Typ</th>
                          <th className="px-3 py-2 text-center font-semibold text-slate-700">Intygsdatum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {courses.map((c: any, i: number) => {
                          const hue = c.hue ?? (120 + i * 25) % 360;
                          return (
                            <tr 
                              key={c.id || i} 
                              className="hover:bg-slate-50 cursor-pointer"
                              onClick={() => setSelectedActivity(c)}
                            >
                              <td className="px-3 py-2">
                                <span 
                                  className="inline-block rounded-md px-2 py-0.5 text-xs text-slate-900"
                                  style={{
                                    backgroundColor: `hsl(${hue} 28% 88%)`,
                                    border: `1px solid hsl(${hue} 30% 72%)`,
                                  }}
                                >
                                  {c.title || c.name || "-"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{c.kind || c.type || "-"}</td>
                              <td className="px-3 py-2 text-center text-slate-600">
                                {formatDate(c.certificateDate || c.endDate)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Inga kurser registrerade.</p>
                )}
              </div>

              {/* Handledarträffar & Progressionsbedömningar i 2-kolumner */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Handledarträffar */}
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                    Handledarträffar ({supervisorMeetings.length})
                  </h3>
                  {supervisorMeetings.length > 0 ? (
                    <div className="space-y-2">
                      {supervisorMeetings.map((m: any, i: number) => (
                        <div key={m.id || i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="font-medium text-slate-900">{formatDate(m.date)}</p>
                          <p className="text-sm text-slate-600">{m.note || m.notes || m.summary || "-"}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Inga handledarträffar registrerade.</p>
                  )}
                </div>

                {/* Progressionsbedömningar */}
                <div>
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                    Progressionsbedömningar ({progressAssessments.length})
                  </h3>
                  {progressAssessments.length > 0 ? (
                    <div className="space-y-2">
                      {progressAssessments.map((a: any, i: number) => (
                        <div key={a.id || i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="font-medium text-slate-900">{formatDate(a.date)}</p>
                          <p className="text-sm text-slate-600">
                            {a.assessment || a.bedömning || a.note || "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Inga progressionsbedömningar registrerade.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Tidslinjevy - exakt planera-st grid (2 lanes, 24 halvmånader) */
            <div className="space-y-0">
              {/* Sticky månadsrad */}
              <div className="grid grid-cols-[80px_1fr] items-end sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-slate-200">
                <div className="pr-2" />
                <div className="relative">
                  <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] text-xs text-slate-700">
                    {MONTH_NAMES.map((m, idx) => (
                      <div
                        key={m}
                        className={`col-span-2 text-center font-medium pb-1 ${idx === 0 ? "border-l border-slate-300" : ""} ${idx === MONTH_NAMES.length - 1 ? "border-r border-slate-300" : ""}`}
                      >
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {years.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Inga aktiviteter med datum att visa.</p>
              ) : (
                timelineYears.map((year, yearIdx) => {
                  const rowStart = new Date(year, 0, 1);
                  const rowEnd = new Date(year, 11, 31, 23, 59, 59);

                  // Placeringar som överlappar året
                  const yearPlacements = placements
                    .map((p: any, i: number) => ({
                      ...p,
                      __hue: p.hue ?? (210 + i * 30) % 360,
                      __type: "placement",
                    }))
                    .filter((p: any) => {
                      const s = new Date(p.startDate || "");
                      const e = new Date(p.endDate || "");
                      if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
                      return !(e < rowStart || s > rowEnd);
                    });

                  // Kurser som hör till året (som i planera-st: normalt år = slutdatum/intygsdatum)
                  const yearCourses = courses
                    .map((c: any, i: number) => ({
                      ...c,
                      __hue: c.hue ?? (120 + i * 25) % 360,
                      __type: "course",
                    }))
                    .filter((c: any) => {
                      const endISO = c.endDate || c.certificateDate || "";
                      const d = new Date(endISO);
                      if (isNaN(d.getTime())) return false;
                      return d.getFullYear() === year;
                    });

                  const isFirst = yearIdx === 0;
                  const isLast = yearIdx === years.length - 1;

                  return (
                    <div key={year} className="grid grid-cols-[80px_1fr] items-stretch">
                      {/* År */}
                      <div className="pr-2 py-1 text-right font-semibold select-none flex items-center justify-end">
                        <span>{year}</span>
                      </div>

                      {/* Års-kort */}
                      <div
                        className="st-row relative isolate bg-white"
                        style={{
                          height: "2.6rem",
                          backgroundImage:
                            "linear-gradient(to right, rgba(148,163,184,.35) 1px, transparent 1px)",
                          backgroundSize: "calc(100% / 24) 100%",
                          backgroundRepeat: "repeat-x",
                          backgroundPosition: "0 0",
                          borderTopLeftRadius: isFirst ? "2px" : "0px",
                          borderTopRightRadius: isFirst ? "2px" : "0px",
                          borderBottomLeftRadius: isLast ? "2px" : "0px",
                          borderBottomRightRadius: isLast ? "2px" : "0px",
                          overflow: "visible",
                        }}
                      >
                        {/* Månadslinjer */}
                        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 10 }}>
                          {Array.from({ length: 13 }, (_, monthIdx) => {
                            const leftPercent = (monthIdx / 12) * 100;
                            return (
                              <div
                                key={`month-line-${monthIdx}`}
                                style={{
                                  position: "absolute",
                                  left: `${leftPercent}%`,
                                  top: 0,
                                  bottom: "3px",
                                  width: "2px",
                                  backgroundColor: "rgba(100,116,139,.85)",
                                }}
                              />
                            );
                          })}
                        </div>

                        <div
                          className="grid grid-cols-[repeat(24,minmax(0,1fr))]"
                          style={{ gridTemplateRows: "1.75rem 0.75rem" }}
                        >
                          {/* Rad 1: celler */}
                          {Array.from({ length: 24 }, (_, i) => {
                            const globalSlot = (year - startYearForSlots) * 24 + i;
                            const outside =
                              (visibleStartSlot != null && globalSlot < visibleStartSlot) ||
                              (endBoundarySlot != null && globalSlot >= endBoundarySlot);
                            const monthIndex = Math.floor(i / 2);
                            const insideCls = monthIndex % 2 ? "bg-slate-50" : INSIDE_BG_CELL;
                            const isFirstCol = i === 0;
                            const isLastCol = i === 23;
                            const isFirstHalfOfMonth = i % 2 === 0;
                            return (
                              <div
                                key={`cell1-${i}`}
                                className={[
                                  "relative z-0 h-7 border-t border-slate-300",
                                  isFirstCol ? "border-l border-slate-300" : "",
                                  isLastCol ? "border-r border-slate-300" : "",
                                  !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
                                  outside ? OUTSIDE_BG_CELL : insideCls,
                                ].join(" ")}
                                style={{ gridRowStart: 1 }}
                              />
                            );
                          })}

                          {/* Rad 2: kurs-lane celler */}
                          {Array.from({ length: 24 }, (_, i) => {
                            const globalSlot = (year - startYearForSlots) * 24 + i;
                            const outside =
                              (visibleStartSlot != null && globalSlot < visibleStartSlot) ||
                              (endBoundarySlot != null && globalSlot >= endBoundarySlot);
                            const monthIndex = Math.floor(i / 2);
                            const isFirstCol = i === 0;
                            const isLastCol = i === 23;
                            const isFirstHalfOfMonth = i % 2 === 0;
                            return (
                              <div
                                key={`lane-${i}`}
                                className={[
                                  "h-3 w-full transition",
                                  outside ? OUTSIDE_BG_LANE : (monthIndex % 2 ? "bg-slate-200" : INSIDE_BG_LANE),
                                  "border-y border-slate-300",
                                  isFirstCol ? "border-l border-slate-300" : "",
                                  isLastCol ? "border-r border-slate-300" : "",
                                  !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
                                ].join(" ")}
                                style={{ gridRowStart: 2 }}
                              />
                            );
                          })}
                        </div>

                        {/* Overlay: aktiviteter + kurser */}
                        <div
                          className="pointer-events-none absolute inset-0 z-[60] grid grid-cols-[repeat(24,minmax(0,1fr))] rounded-[2px]"
                          style={{ gridTemplateRows: "1.9rem 0.75rem", overflow: "visible" }}
                        >
                          {/* Placeringar */}
                          <div className="contents z-40">
                            {yearPlacements.map((p: any, idx: number) => {
                              const startISO = String(p.startDate || "");
                              const endISO = String(p.endDate || "");
                              if (!isValidISODate(startISO) || !isValidISODate(endISO)) return null;
                              const startSlot = dateToSlotSnapped(startYearForSlots, startISO, "start");
                              const endSlot = dateToSlotSnapped(startYearForSlots, endISO, "end");
                              if (!Number.isFinite(startSlot) || !Number.isFinite(endSlot)) return null;

                              const rowStartSlot = (year - startYearForSlots) * 24;
                              const rowEndSlot = rowStartSlot + 24;
                              const s0 = Math.max(startSlot, rowStartSlot);
                              const s1 = Math.min(endSlot, rowEndSlot);
                              if (s1 <= s0) return null;
                              const startCol = s0 - rowStartSlot;
                              const span = s1 - s0;

                              const label = p.label || p.clinic || p.type || "Placering";

                              return (
                                <div
                                  key={(p.id || idx) + "@" + year}
                                  className={[
                                    "relative pointer-events-auto h-7 select-none rounded-lg px-2 text-[11px] shadow border transition overflow-hidden",
                                    "cursor-pointer hover:shadow-lg hover:-translate-y-[1px]",
                                    "z-[65] border-slate-200",
                                  ].join(" ")}
                                  style={{
                                    gridRowStart: 1,
                                    gridColumnStart: startCol + 1,
                                    gridColumnEnd: startCol + 1 + span,
                                    transform: "translateX(1.5px)",
                                    marginRight: "-1px",
                                    backgroundColor: `hsl(${p.__hue} 28% 88%)`,
                                    border: `1.5px solid hsl(${p.__hue} 35% 50%)`,
                                  }}
                                  title={label}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedActivity(p);
                                  }}
                                >
                                  <span className="block w-full truncate text-slate-900">{label}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Kurser i lane */}
                          <div
                            ref={(el) => {
                              laneRefs.current[year] = el;
                              if (el) {
                                const w = el.clientWidth || el.offsetWidth || 0;
                                if (laneWidthByYear[year] !== w) {
                                  setLaneWidthByYear((prev) => ({ ...prev, [year]: w }));
                                }
                              }
                            }}
                            className="relative pointer-events-none z-[120]"
                            style={{ gridRowStart: 2, gridColumn: "1 / -1", height: "0.75rem", overflow: "visible" }}
                          >
                            {/* Handledarsamtal (trianglar) */}
                            {supervisionSessions
                              .filter((s: any) => {
                                const d = new Date(s.dateISO + "T00:00:00");
                                return !isNaN(d.getTime()) && d.getFullYear() === year;
                              })
                              .map((s: any) => {
                                const d = new Date(s.dateISO + "T00:00:00");
                                const total = Math.max(1, daysInYear(year) - 1);
                                const pct = clamp((dayOfYear(d) / total) * 100, 0, 100);
                                const isHovered = hoveredSupervisionId === s.id;
                                return (
                                  <button
                                    key={s.id + "@" + year}
                                    type="button"
                                    className="pointer-events-auto absolute"
                                    style={{
                                      left: `${pct}%`,
                                      bottom: "2.4rem",
                                      transform: isHovered ? "translate(-50%, -1px)" : "translate(-50%, 0)",
                                    }}
                                    onMouseEnter={() => setHoveredSupervisionId(s.id)}
                                    onMouseLeave={() =>
                                      setHoveredSupervisionId((prev) => (prev === s.id ? null : prev))
                                    }
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedActivity({
                                        ...s,
                                        kind: "Handledarsamtal",
                                        type: "Handledarsamtal",
                                      });
                                    }}
                                    title={s.title && String(s.title).trim() ? `${s.title} (${s.dateISO})` : s.dateISO}
                                  >
                                    <span
                                      aria-hidden="true"
                                      style={{
                                        position: "relative",
                                        display: "block",
                                        width: 0,
                                        height: 0,
                                      }}
                                    >
                                      <span
                                        style={{
                                          position: "absolute",
                                          left: "50%",
                                          transform: "translateX(-50%)",
                                          width: 0,
                                          height: 0,
                                          borderLeft: "7px solid transparent",
                                          borderRight: "7px solid transparent",
                                          borderBottom: "11px solid #064e3b",
                                        }}
                                      />
                                      <span
                                        style={{
                                          position: "absolute",
                                          left: "50%",
                                          transform: "translateX(-50%) translateY(1px)",
                                          width: 0,
                                          height: 0,
                                          borderLeft: "6px solid transparent",
                                          borderRight: "6px solid transparent",
                                          borderBottom: isHovered
                                            ? "9px solid #34d399"
                                            : "9px solid #059669",
                                        }}
                                      />
                                    </span>
                                  </button>
                                );
                              })}

                            {/* Progressionsbedömningar (stjärnor) */}
                            {assessmentSessions
                              .filter((a: any) => {
                                const d = new Date(a.dateISO + "T00:00:00");
                                return !isNaN(d.getTime()) && d.getFullYear() === year;
                              })
                              .map((a: any) => {
                                const d = new Date(a.dateISO + "T00:00:00");
                                const total = Math.max(1, daysInYear(year) - 1);
                                const pct = clamp((dayOfYear(d) / total) * 100, 0, 100);
                                const isHovered = hoveredAssessmentId === a.id;
                                const baseColor = "#f59e0b";
                                const hoverColor = "#facc15";
                                const strokeColor = "#d97706";
                                return (
                                  <button
                                    key={a.id + "@assess@" + year}
                                    type="button"
                                    className="pointer-events-auto absolute"
                                    style={{
                                      left: `${pct}%`,
                                      bottom: "1.6rem",
                                      transform: isHovered
                                        ? "translate(-50%, -1px) scale(1.05)"
                                        : "translate(-50%, 0) scale(1)",
                                    }}
                                    onMouseEnter={() => setHoveredAssessmentId(a.id)}
                                    onMouseLeave={() =>
                                      setHoveredAssessmentId((prev) => (prev === a.id ? null : prev))
                                    }
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedActivity({
                                        ...a,
                                        kind: "Progressionsbedömning",
                                        type: "Progressionsbedömning",
                                      });
                                    }}
                                    title={a.title && String(a.title).trim() ? `${a.title} (${a.dateISO})` : a.dateISO}
                                  >
                                    <svg
                                      aria-hidden="true"
                                      width={16}
                                      height={16}
                                      viewBox="0 0 24 24"
                                      style={{ display: "block" }}
                                    >
                                      <path
                                        d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
                                        fill={isHovered ? hoverColor : baseColor}
                                        stroke={strokeColor}
                                        strokeWidth={1.3}
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                );
                              })}

                            {yearCourses.map((c: any, idx: number) => {
                              const endISO = c.endDate || c.certificateDate || "";
                              if (!isValidISODate(endISO)) return null;
                              const courseSlot = dateToSlotSnapped(startYearForSlots, endISO, "end");
                              if (!Number.isFinite(courseSlot)) return null;
                              const rowStartSlot = (year - startYearForSlots) * 24;
                              const col = courseSlot - rowStartSlot;
                              if (col < 0 || col >= 24) return null;
                              const title = c.title || c.name || "Kurs";

                              const laneW = laneWidthByYear[year] || 0;
                              const trueCenterPx = ((col + 0.5) / 24) * laneW;
                              const measured = chipWidthsRef.current[String(c.id)] || 0;
                              const half = Math.max(1, measured / 2);
                              const clampedCenterPx = laneW > 0
                                ? clamp(trueCenterPx, half, Math.max(half, laneW - half))
                                : trueCenterPx;
                              const sel = !!(selectedActivity && (selectedActivity.id || selectedActivity._id) === (c.id || c._id));

                              return (
                                <div
                                  key={(c.id || idx) + "@" + year}
                                  ref={(el) => {
                                    if (el) {
                                      const w = el.offsetWidth || 0;
                                      const idKey = String(c.id);
                                      if (w && chipWidthsRef.current[idKey] !== w) {
                                        chipWidthsRef.current[idKey] = w;
                                        forceRerender((n) => n + 1);
                                      }
                                    }
                                  }}
                                  className={`absolute z-[70] top-1/2 -translate-y-1/2 pointer-events-auto select-none rounded-full px-2 h-5 flex items-center text-[10.5px] border cursor-pointer shadow-sm transition-transform transition-colors ${
                                    sel
                                      ? "text-white bg-sky-600 border-sky-800 hover:bg-sky-500 hover:border-sky-700 hover:shadow-md"
                                      : "text-white bg-sky-700 border-sky-900 hover:bg-sky-600 hover:border-sky-800 hover:shadow-md"
                                  }`}
                                  style={{
                                    left: `${clampedCenterPx}px`,
                                    transform: "translate(-50%, -50%)",
                                  }}
                                  title={title}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedActivity(c);
                                  }}
                                >
                                  <span className="max-w-[24ch] truncate">{title}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Plan-markörer: BT-start (grön), ST-start (gul), ST-slut (röd) */}
                        <div className="pointer-events-none absolute inset-0 z-[250]">
                          {(() => {
                            const rowStartSlot = (year - startYearForSlots) * 24;
                            const rowEndSlot = rowStartSlot + 24;
                            const markers: Array<{ slot: number | null; color: string }> = [
                              { slot: btStartSlot, color: "#059669" },
                              { slot: stStartSlot, color: "#f59e0b" },
                              { slot: stEndSlot, color: "#ef4444" },
                            ];
                            return markers.map((m, idx) => {
                              if (m.slot == null || !Number.isFinite(m.slot)) return null;
                              if (m.slot < rowStartSlot || m.slot > rowEndSlot) return null;
                              const pct = ((m.slot - rowStartSlot) / 24) * 100;
                              if (pct < 0 || pct > 100) return null;
                              return (
                                <div
                                  key={`boundary-${idx}-${year}`}
                                  style={{
                                    position: "absolute",
                                    left: `${pct}%`,
                                    top: 0,
                                    bottom: 0,
                                    width: "2px",
                                    backgroundColor: m.color,
                                  }}
                                />
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Legend */}
              <div className="mt-4 border-t border-slate-200 pt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-700">
                <div className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-[2px]" style={{ backgroundColor: "#059669" }} />
                  <span>BT-start</span>
                </div>
                <div className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-[2px]" style={{ backgroundColor: "#f59e0b" }} />
                  <span>ST-start</span>
                </div>
                <div className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-[2px]" style={{ backgroundColor: "#ef4444" }} />
                  <span>ST-slut</span>
                </div>
                <div className="inline-flex items-center gap-2">
                  <span aria-hidden="true" style={{ position: "relative", display: "block", width: 0, height: 0 }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 0,
                        height: 0,
                        borderLeft: "7px solid transparent",
                        borderRight: "7px solid transparent",
                        borderBottom: "11px solid #064e3b",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%) translateY(1px)",
                        width: 0,
                        height: 0,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderBottom: "9px solid #059669",
                      }}
                    />
                  </span>
                  <span>Handledarsamtal</span>
                </div>
                <div className="inline-flex items-center gap-2">
                  <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" style={{ display: "block" }}>
                    <path
                      d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
                      fill="#f59e0b"
                      stroke="#d97706"
                      strokeWidth={1.3}
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Progressionsbedömning</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Aktivitets-detalj-popup */}
      {selectedActivity && (
        <ActivityDetailPopup
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          goalsVersion={goalsVersion}
        />
      )}
    </div>
  );
}

function calculateProgress(student: SupervisorStudent): number {
  const placements = student.placements || [];
  const totalMonths = placements.reduce((sum, p) => {
    if (!p.startDate || !p.endDate) return sum;
    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
    const attendance = typeof p.attendance === "number" ? p.attendance / 100 : 1;
    return sum + months * attendance;
  }, 0);
  
  const targetMonths = student.goalsVersion === "2021" ? 60 : 60;
  return Math.min(100, Math.round((totalMonths / targetMonths) * 100));
}

export default function StudierektorPage() {
  const router = useRouter();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SupervisorStudent | null>(null);
  const [infoToast, setInfoToast] = useState<{ title: string; message: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [nameChangePrompt, setNameChangePrompt] = useState<{
    existingName: string;
    newName: string;
    personnummer: string;
    pendingData: any;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!infoToast) return;
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    toastTimerRef.current = window.setTimeout(() => {
      setInfoToast(null);
      toastTimerRef.current = null;
    }, 8000);

    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [infoToast]);

  const students = useLiveQuery(
    () => db.supervisorStudents.toArray() as Promise<SupervisorStudent[]>,
    [],
    []
  );

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setImporting(true);
    const errors: string[] = [];
    
    try {
      for (const file of Array.from(files)) {
        try {
          const fileValidation = validateJsonFile(file);
          if (!fileValidation.valid) {
            errors.push(`${file.name}: ${fileValidation.error}`);
            continue;
          }

          const txt = await file.text();
          const parseResult = safeJsonParse(txt);
          if (!parseResult.success || !parseResult.data) {
            errors.push(`${file.name}: ${parseResult.error || "Kunde inte tolka JSON"}`);
            continue;
          }

          const data = parseResult.data;
          const profile = data.profile ?? data?.Profile ?? data?.prof ?? null;
          const placements = data.placements ?? data?.Placements ?? [];
          const courses = data.courses ?? data?.Courses ?? [];
          const achievements = data.achievements ?? data?.Achievements ?? [];

          if (!profile) {
            errors.push(`${file.name}: Ingen profil hittades i filen`);
            continue;
          }

          const name = profile.name || profile.fullName || "Okänd";
          const personnummer = profile.personnummer || profile.personalNumber || profile.pnr || "";
          const specialty = profile.specialty || profile.speciality || "Ej angiven";
          const goalsVersion = profile.goalsVersion === "2015" ? "2015" : "2021";

          // Kolla om personnummer redan finns
          const existingByPnr = personnummer 
            ? (students || []).find((s: SupervisorStudent) => s.personnummer === personnummer)
            : null;

          if (existingByPnr && existingByPnr.name !== name) {
            // Samma personnummer men annat namn - fråga om namnbyte
            setNameChangePrompt({
              existingName: existingByPnr.name,
              newName: name,
              personnummer,
              pendingData: {
                id: existingByPnr.id,
                personnummer,
                specialty,
                goalsVersion,
                importedAt: existingByPnr.importedAt,
                lastUpdated: new Date().toISOString(),
                profile,
                placements,
                courses,
                achievements,
              }
            });
            continue;
          }

          const studentData: SupervisorStudent = {
            id: existingByPnr?.id || uid(),
            name,
            personnummer,
            specialty,
            goalsVersion,
            importedAt: existingByPnr?.importedAt || new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            profile,
            placements,
            courses,
            achievements,
          };

          await db.supervisorStudents.put(studentData);

          if (existingByPnr) {
            setInfoToast({
              title: "Fil ersatte befintlig",
              message: `Personnummer ${personnummer} fanns redan. Data uppdaterades från \"${file.name}\".`,
            });
          }
        } catch (err) {
          errors.push(`${file.name}: ${err instanceof Error ? err.message : "Okänt fel"}`);
        }
      }

      if (errors.length > 0) {
        alert(`Några filer kunde inte importeras:\n\n${errors.join("\n")}`);
      }
    } finally {
      setImporting(false);
    }
  }, [students]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const deleteStudent = async (id: string) => {
    if (!confirm("Är du säker på att du vill ta bort denna ST-läkare?")) return;
    await db.supervisorStudents.delete(id);
  };

  const handleNameChange = async (useName: "existing" | "new") => {
    if (!nameChangePrompt) return;
    const { pendingData, existingName, newName } = nameChangePrompt;
    const finalName = useName === "existing" ? existingName : newName;
    await db.supervisorStudents.put({ ...pendingData, name: finalName });
    setInfoToast({
      title: "Fil ersatte befintlig",
      message: `Personnummer ${nameChangePrompt.personnummer} fanns redan. Data uppdaterades och namn sattes till \"${finalName}\".`,
    });
    setNameChangePrompt(null);
  };

  const saveList = async () => {
    const allStudents = await db.supervisorStudents.toArray();
    const exportData = {
      exportedAt: new Date().toISOString(),
      students: allStudents,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studierektor-lista-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadList = async (file: File) => {
    try {
      const txt = await file.text();
      const data = JSON.parse(txt);
      if (data.students && Array.isArray(data.students)) {
        for (const student of data.students) {
          await db.supervisorStudents.put(student);
        }
      }
    } catch (err) {
      alert("Kunde inte läsa sparfilen.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {infoToast && (
        <div className="fixed right-4 top-4 z-[80] w-[min(420px,calc(100vw-2rem))] rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{infoToast.title}</p>
              <p className="mt-1 text-sm text-slate-700">{infoToast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setInfoToast(null)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50"
            >
              Stäng
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="select-none caret-transparent text-2xl font-extrabold tracking-tight"
            >
              <span className="text-sky-700">ST</span>
              <span className="text-emerald-700">ARK</span>
            </button>
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              Studierektor / Huvudhandledare
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveList}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-sky-700 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 active:translate-y-px"
              title="Spara listan som JSON-fil"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-2-2Zm0 2v3H7V5h10ZM7 10h10v9H7v-9Z"/>
              </svg>
              Spara
            </button>
            <button
              onClick={() => router.push("/")}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
            >
              Tillbaka
            </button>
            <button
              onClick={() => setAboutOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
            >
              Om
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Mina ST-läkare</h1>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`mb-6 rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragOver
              ? "border-sky-500 bg-sky-50"
              : "border-slate-300 bg-white hover:border-slate-400"
          }`}
        >
          <p className="text-slate-600">
            Dra och släpp JSON-filer här, eller{" "}
            <button
              onClick={() => fileRef.current?.click()}
              className="font-semibold text-sky-600 hover:text-sky-700"
            >
              klicka för att välja filer
            </button>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Du kan ladda upp flera filer samtidigt
          </p>
        </div>

        {/* Student list */}
        {students && students.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Namn
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Målversion
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Senast uppdaterad
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                    Åtgärder
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {students.map((student: SupervisorStudent) => {
                  const progress = calculateProgress(student);
                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {student.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {student.goalsVersion}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-slate-200">
                            <div
                              className="h-2 rounded-full bg-emerald-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-600">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(student.lastUpdated).toLocaleDateString("sv-SE")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStudent(student.id);
                          }}
                          className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                        >
                          Ta bort
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-600">
              Inga ST-läkare har lagts till ännu. Ladda upp JSON-filer för att komma igång.
            </p>
          </div>
        )}
      </main>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        multiple
        className="hidden"
        onChange={onFileChange}
      />

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {/* Student-detalj-popup */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {/* Namnbyte-dialog */}
      {nameChangePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Namnbyte upptäckt</h3>
            <p className="mb-4 text-slate-600">
              Personnummer <strong>{nameChangePrompt.personnummer}</strong> finns redan i listan med namnet{" "}
              <strong>{nameChangePrompt.existingName}</strong>, men den nya filen har namnet{" "}
              <strong>{nameChangePrompt.newName}</strong>.
            </p>
            <p className="mb-6 text-slate-600">Vilket namn ska användas?</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleNameChange("existing")}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                {nameChangePrompt.existingName}
              </button>
              <button
                onClick={() => handleNameChange("new")}
                className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                {nameChangePrompt.newName}
              </button>
            </div>
            <button
              onClick={() => setNameChangePrompt(null)}
              className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

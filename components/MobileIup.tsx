// components/MobileIup.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import MilestoneOverviewPanel from "@/components/MilestoneOverviewModal";
import type { Profile } from "@/lib/types";
import type { IupMeeting, IupAssessment, IupPlanning, ExtraPlanningSection } from "@/components/IupModal";

const DEFAULT_INSTRUMENTS = [
  "Medsittning/Sit-in",
  "Mini-CEX",
  "360 grader",
  "Case-based discussion (CBD)",
];

type TabKey = "planering" | "handledarsamtal" | "progressionsbedömningar" | "delmål";

export default function MobileIup() {
  const [tab, setTab] = useState<TabKey>("planering");
  const [meetings, setMeetings] = useState<IupMeeting[]>([]);
  const [assessments, setAssessments] = useState<IupAssessment[]>([]);
  const [planning, setPlanning] = useState<IupPlanning>(defaultPlanning());
  const [planningExtra, setPlanningExtra] = useState<ExtraPlanningSection[]>([]);
  const [instruments, setInstruments] = useState<string[]>(DEFAULT_INSTRUMENTS);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // Editing states
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [instrumentsModalOpen, setInstrumentsModalOpen] = useState(false);

  // Load data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const p = await db.profile.get("default");
        if (!cancelled) setProfile(p ?? null);

        const row = (await (db as any).timeline?.get?.("iup")) as any;
        if (cancelled) return;

        const loadedMeetings = Array.isArray(row?.meetings) ? row.meetings.map(cloneMeeting) : [];
        const loadedAssessments = Array.isArray(row?.assessments) ? row.assessments.map(cloneAssessment) : [];
        const loadedPlanning = row?.planning ? { ...defaultPlanning(), ...row.planning } : defaultPlanning();
        const loadedPlanningExtra: ExtraPlanningSection[] = Array.isArray(row?.planningExtra)
          ? row.planningExtra.map((s: any) => ({ id: s.id, title: s.title, content: s.content ?? "" }))
          : [];
        const loadedInstruments = row?.instruments && Array.isArray(row.instruments) && row.instruments.length > 0
          ? [...row.instruments]
          : DEFAULT_INSTRUMENTS;

        if (!cancelled) {
          setMeetings(loadedMeetings);
          setAssessments(loadedAssessments);
          setPlanning(loadedPlanning);
          setPlanningExtra(loadedPlanningExtra);
          setInstruments(loadedInstruments);
          setDirty(false);
        }
      } catch (e) {
        console.error("Kunde inte ladda IUP-data:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Save to DB
  const saveAllToDb = useCallback(async () => {
    try {
      const anyDb = db as any;
      if (anyDb.timeline) {
        await anyDb.timeline.put({
          id: "iup",
          meetings,
          assessments,
          planning,
          planningExtra,
          instruments,
        });
      }
      setDirty(false);
    } catch (e) {
      console.error("Kunde inte spara IUP-data:", e);
      throw e;
    }
  }, [meetings, assessments, planning, planningExtra, instruments]);

  // Meeting handlers
  const addMeeting = useCallback(() => {
    const newId = String(Date.now());
    const newMeeting: IupMeeting = {
      id: newId,
      dateISO: "",
      focus: "",
      summary: "",
      actions: "",
    };
    setMeetings((prev) => [...prev, newMeeting]);
    setEditingMeetingId(newId);
    setDirty(true);
  }, []);

  const updateMeeting = useCallback((updated: IupMeeting) => {
    setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setEditingMeetingId(null);
    setDirty(true);
  }, []);

  const removeMeeting = useCallback((id: string) => {
    if (!confirm("Vill du ta bort detta handledarsamtal?")) return;
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    if (editingMeetingId === id) setEditingMeetingId(null);
    setDirty(true);
  }, [editingMeetingId]);

  // Assessment handlers
  const addAssessment = useCallback(() => {
    const newId = String(Date.now());
    const newAssessment: IupAssessment = {
      id: newId,
      dateISO: "",
      phase: "ST",
      level: "",
      instrument: "",
      summary: "",
      strengths: "",
      development: "",
    };
    setAssessments((prev) => [...prev, newAssessment]);
    setEditingAssessmentId(newId);
    setDirty(true);
  }, []);

  const updateAssessment = useCallback((updated: IupAssessment) => {
    setAssessments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setEditingAssessmentId(null);
    setDirty(true);
  }, []);

  const removeAssessment = useCallback((id: string) => {
    if (!confirm("Vill du ta bort denna progressionsbedömning?")) return;
    setAssessments((prev) => prev.filter((a) => a.id !== id));
    if (editingAssessmentId === id) setEditingAssessmentId(null);
    setDirty(true);
  }, [editingAssessmentId]);

  // Auto-save on dirty
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      saveAllToDb().catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [dirty, saveAllToDb]);

  const sortedMeetings = useMemo(() => {
    return [...meetings].sort((a, b) => {
      if (!a.dateISO) return 1;
      if (!b.dateISO) return -1;
      return b.dateISO.localeCompare(a.dateISO);
    });
  }, [meetings]);

  const sortedAssessments = useMemo(() => {
    return [...assessments].sort((a, b) => {
      if (!a.dateISO) return 1;
      if (!b.dateISO) return -1;
      return b.dateISO.localeCompare(a.dateISO);
    });
  }, [assessments]);

  return (
    <div className="space-y-5">
      {/* Tab navigation */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setTab("planering")}
          className={`rounded-xl border-2 px-4 py-4 text-base font-semibold transition ${
            tab === "planering"
              ? "border-sky-600 bg-sky-50 text-sky-900"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          Planering
        </button>
        <button
          type="button"
          onClick={() => setTab("handledarsamtal")}
          className={`rounded-xl border-2 px-4 py-4 text-base font-semibold transition ${
            tab === "handledarsamtal"
              ? "border-sky-600 bg-sky-50 text-sky-900"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          Handledarsamtal
        </button>
        <button
          type="button"
          onClick={() => setTab("progressionsbedömningar")}
          className={`rounded-xl border-2 px-4 py-4 text-base font-semibold transition ${
            tab === "progressionsbedömningar"
              ? "border-sky-600 bg-sky-50 text-sky-900"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          Progressionsbedömningar
        </button>
        <button
          type="button"
          onClick={() => setTab("delmål")}
          className={`rounded-xl border-2 px-4 py-4 text-base font-semibold transition ${
            tab === "delmål"
              ? "border-sky-600 bg-sky-50 text-sky-900"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          Delmål
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Laddar...
        </div>
      ) : tab === "planering" ? (
        <PlanningView
          planning={planning}
          setPlanning={setPlanning}
          planningExtra={planningExtra}
          setPlanningExtra={setPlanningExtra}
          setDirty={setDirty}
        />
      ) : tab === "handledarsamtal" ? (
        <MeetingsView
          meetings={sortedMeetings}
          editingId={editingMeetingId}
          onAdd={addMeeting}
          onEdit={setEditingMeetingId}
          onUpdate={updateMeeting}
          onRemove={removeMeeting}
          onCloseEdit={() => setEditingMeetingId(null)}
        />
      ) : tab === "progressionsbedömningar" ? (
        <AssessmentsView
          assessments={sortedAssessments}
          editingId={editingAssessmentId}
          instruments={instruments}
          profile={profile}
          onAdd={addAssessment}
          onEdit={setEditingAssessmentId}
          onUpdate={updateAssessment}
          onRemove={removeAssessment}
          onCloseEdit={() => setEditingAssessmentId(null)}
          onOpenInstruments={() => setInstrumentsModalOpen(true)}
        />
      ) : (
        <MilestonesView />
      )}

      {/* Modals */}
      {editingMeetingId && (
        <MeetingEditModal
          open={true}
          meeting={meetings.find((m) => m.id === editingMeetingId) || null}
          onSave={updateMeeting}
          onClose={() => setEditingMeetingId(null)}
        />
      )}

      {editingAssessmentId && (
        <AssessmentEditModal
          open={true}
          assessment={assessments.find((a) => a.id === editingAssessmentId) || null}
          instruments={instruments}
          profile={profile}
          onSave={updateAssessment}
          onClose={() => setEditingAssessmentId(null)}
        />
      )}

      {instrumentsModalOpen && (
        <InstrumentsModal
          open={true}
          instruments={instruments}
          onSave={(newInstruments) => {
            setInstruments(newInstruments);
            setInstrumentsModalOpen(false);
            setDirty(true);
          }}
          onClose={() => setInstrumentsModalOpen(false)}
        />
      )}

    </div>
  );
}

// Helper functions
function defaultPlanning(): IupPlanning {
  return {
    overallGoals: "",
    clinicalService: "",
    courses: "",
    supervisionMeetings: "",
    theoreticalStudies: "",
    researchWork: "",
    journalClub: "",
    congresses: "",
    qualityWork: "",
    patientSafety: "",
    leadership: "",
    supervisingStudents: "",
    teaching: "",
    formativeAssessments: "",
  };
}

function cloneMeeting(m: IupMeeting): IupMeeting {
  return {
    id: m.id,
    dateISO: m.dateISO,
    focus: m.focus,
    summary: m.summary,
    actions: m.actions,
    nextDateISO: m.nextDateISO,
  };
}

function cloneAssessment(a: IupAssessment): IupAssessment {
  return {
    id: a.id,
    dateISO: a.dateISO,
    phase: a.phase,
    level: a.level,
    instrument: a.instrument,
    summary: a.summary,
    strengths: a.strengths,
    development: a.development,
  };
}

// Import sub-components
import PlanningView from "./MobileIup/PlanningView";
import MeetingsView from "./MobileIup/MeetingsView";
import AssessmentsView from "./MobileIup/AssessmentsView";
import MilestonesView from "./MobileIup/MilestonesView";
import MeetingEditModal from "./MobileIup/MeetingEditModal";
import AssessmentEditModal from "./MobileIup/AssessmentEditModal";
import InstrumentsModal from "./MobileIup/InstrumentsModal";


// components/MobileIup.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import type { Profile } from "@/lib/types";
import type { IupMeeting, IupAssessment, IupPlanning, ExtraPlanningSection } from "@/components/IupModal";

const DEFAULT_INSTRUMENTS = [
  "Medsittning/Sit-in",
  "Mini-CEX",
  "360 grader",
  "Case-based discussion (CBD)",
];

type TabKey = "planering" | "handledarsamtal" | "progressionsbedömningar";

export default function MobileIup() {
  const [openTab, setOpenTab] = useState<TabKey | null>(null);
  const [meetings, setMeetings] = useState<IupMeeting[]>([]);
  const [assessments, setAssessments] = useState<IupAssessment[]>([]);
  const [planning, setPlanning] = useState<IupPlanning>(defaultPlanning());
  const [planningExtra, setPlanningExtra] = useState<ExtraPlanningSection[]>([]);
  const [instruments, setInstruments] = useState<string[]>(DEFAULT_INSTRUMENTS);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showMeetingsOnTimeline, setShowMeetingsOnTimeline] = useState<boolean>(true);
  const [showAssessmentsOnTimeline, setShowAssessmentsOnTimeline] = useState<boolean>(true);
  const [planningHidden, setPlanningHidden] = useState<Set<string>>(new Set());
  
  // Editing states
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [instrumentsModalOpen, setInstrumentsModalOpen] = useState(false);
  const [btMilestonesModalOpen, setBtMilestonesModalOpen] = useState(false);
  const [stMilestonesModalOpen, setStMilestonesModalOpen] = useState(false);
  const [milestonesPopupOpen, setMilestonesPopupOpen] = useState(false);

  // Prevent body scroll when milestones popup is open
  useEffect(() => {
    if (milestonesPopupOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [milestonesPopupOpen]);

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
        const loadedShowMeetings = typeof row?.showMeetingsOnTimeline === "boolean" ? row.showMeetingsOnTimeline : true;
        const loadedShowAssessments = typeof row?.showAssessmentsOnTimeline === "boolean" ? row.showAssessmentsOnTimeline : true;
        const loadedPlanningHidden = Array.isArray(row?.planningHidden) 
          ? new Set<string>(row.planningHidden)
          : row?.planningHidden instanceof Set
          ? row.planningHidden
          : new Set<string>();

        if (!cancelled) {
          setMeetings(loadedMeetings);
          setAssessments(loadedAssessments);
          setPlanning(loadedPlanning);
          setPlanningExtra(loadedPlanningExtra);
          setInstruments(loadedInstruments);
          setShowMeetingsOnTimeline(loadedShowMeetings);
          setShowAssessmentsOnTimeline(loadedShowAssessments);
          setPlanningHidden(loadedPlanningHidden);
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
          showMeetingsOnTimeline,
          showAssessmentsOnTimeline,
          planningHidden: Array.from(planningHidden),
        });
      }
      setDirty(false);
    } catch (e) {
      console.error("Kunde inte spara IUP-data:", e);
      throw e;
    }
  }, [meetings, assessments, planning, planningExtra, instruments, showMeetingsOnTimeline, showAssessmentsOnTimeline, planningHidden]);

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
    // Don't add to list yet - only open modal
    setEditingMeetingId(newId);
  }, []);

  const updateMeeting = useCallback((updated: IupMeeting) => {
    // Check if this is a new meeting (not in list yet)
    const existing = meetings.find((m) => m.id === updated.id);
    let nextMeetings: IupMeeting[];
    
    if (existing) {
      // Update existing
      nextMeetings = meetings.map((m) => (m.id === updated.id ? updated : m));
    } else {
      // Add new meeting to list
      nextMeetings = [...meetings, updated];
    }

    // Create new meeting for nextDateISO if it exists and is in the future
    const nextDate = updated.nextDateISO;
    if (nextDate && nextDate > new Date().toISOString().slice(0, 10)) {
      const alreadyExists = nextMeetings.some((m) => m.dateISO === nextDate);
      if (!alreadyExists) {
        nextMeetings.push({
          id: String(Date.now() + 1),
          dateISO: nextDate,
          focus: "",
          summary: "",
          actions: "",
          nextDateISO: "",
        });
      }
    }

    setMeetings(nextMeetings);
    setEditingMeetingId(null);
    setDirty(true);
  }, [meetings]);

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
    // Don't add to list yet - only open modal
    setEditingAssessmentId(newId);
  }, []);

  const updateAssessment = useCallback((updated: IupAssessment) => {
    // Check if this is a new assessment (not in list yet)
    const existing = assessments.find((a) => a.id === updated.id);
    if (existing) {
      // Update existing
      setAssessments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } else {
      // Add new assessment to list
      setAssessments((prev) => [...prev, updated]);
    }
    setEditingAssessmentId(null);
    setDirty(true);
  }, [assessments]);

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

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-base text-slate-500">
        Laddar...
      </div>
    );
  }

  return (
    <>
      {/* IUP-ruta med knappar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Individuell utbildningsplan (IUP)</h2>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setOpenTab("planering")}
            className="w-full rounded-xl border-2 border-sky-600 bg-sky-50 px-5 py-4 text-left text-base font-semibold text-sky-900 hover:bg-sky-100 active:translate-y-px"
          >
            Planering
          </button>
          <button
            type="button"
            onClick={() => setOpenTab("handledarsamtal")}
            className="w-full rounded-xl border-2 border-sky-600 bg-sky-50 px-5 py-4 text-left text-base font-semibold text-sky-900 hover:bg-sky-100 active:translate-y-px"
          >
            Handledarsamtal
          </button>
          <button
            type="button"
            onClick={() => setOpenTab("progressionsbedömningar")}
            className="w-full rounded-xl border-2 border-sky-600 bg-sky-50 px-5 py-4 text-left text-base font-semibold text-sky-900 hover:bg-sky-100 active:translate-y-px"
          >
            Progressionsbedömningar
          </button>
          {profile?.goalsVersion === "2021" ? (
            <button
              type="button"
              onClick={() => setMilestonesPopupOpen(true)}
              className="w-full rounded-xl border-2 border-emerald-600 bg-emerald-50 px-5 py-4 text-left text-base font-semibold text-emerald-900 hover:bg-emerald-100 active:translate-y-px"
            >
              Delmål
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStMilestonesModalOpen(true)}
              className="w-full rounded-xl border-2 border-emerald-600 bg-emerald-50 px-5 py-4 text-left text-base font-semibold text-emerald-900 hover:bg-emerald-100 active:translate-y-px"
            >
              Delmål
            </button>
          )}
        </div>
      </div>

      {/* Popups */}
      {openTab === "planering" && (
        <PlanningPopup
          open={true}
          planning={planning}
          setPlanning={setPlanning}
          planningExtra={planningExtra}
          setPlanningExtra={setPlanningExtra}
          setDirty={setDirty}
          onClose={() => setOpenTab(null)}
        />
      )}

      {openTab === "handledarsamtal" && (
        <MeetingsPopup
          open={true}
          meetings={sortedMeetings}
          editingId={editingMeetingId}
          onAdd={addMeeting}
          onEdit={setEditingMeetingId}
          onUpdate={updateMeeting}
          onRemove={removeMeeting}
          onClose={() => setOpenTab(null)}
        />
      )}

      {openTab === "progressionsbedömningar" && (
        <AssessmentsPopup
          open={true}
          assessments={sortedAssessments}
          editingId={editingAssessmentId}
          instruments={instruments}
          profile={profile}
          onAdd={addAssessment}
          onEdit={setEditingAssessmentId}
          onUpdate={updateAssessment}
          onRemove={removeAssessment}
          onClose={() => setOpenTab(null)}
          onOpenInstruments={() => setInstrumentsModalOpen(true)}
        />
      )}


      {/* Modals */}
      {editingMeetingId && (
        <MeetingEditModal
          open={true}
          meeting={meetings.find((m) => m.id === editingMeetingId) || {
            id: editingMeetingId,
            dateISO: "",
            focus: "",
            summary: "",
            actions: "",
          }}
          onSave={updateMeeting}
          onClose={() => setEditingMeetingId(null)}
        />
      )}

      {editingAssessmentId && (
        <AssessmentEditModal
          open={true}
          assessment={assessments.find((a) => a.id === editingAssessmentId) || {
            id: editingAssessmentId,
            dateISO: "",
            phase: "ST",
            level: "",
            instrument: "",
            summary: "",
            strengths: "",
            development: "",
          }}
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

      {/* Milestones popup för 2021 - visar BT och ST knappar */}
      {milestonesPopupOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMilestonesPopupOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-slate-200 bg-emerald-50 px-5 py-4">
              <h2 className="text-xl font-extrabold text-emerald-900">Delmål</h2>
              <button
                type="button"
                onClick={() => setMilestonesPopupOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-5">
                <p className="text-base text-slate-900">
                  Här kan du se alla delmål och vilka kliniska placeringar och kurser som uppfyller dem.
                </p>
                
                <div className="grid grid-cols-1 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMilestonesPopupOpen(false);
                      setBtMilestonesModalOpen(true);
                    }}
                    className="w-full rounded-xl border-2 border-sky-600 bg-sky-50 px-5 py-5 text-left text-base font-semibold text-sky-900 hover:bg-sky-100 active:translate-y-px"
                  >
                    BT-delmål
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMilestonesPopupOpen(false);
                      setStMilestonesModalOpen(true);
                    }}
                    className="w-full rounded-xl border-2 border-emerald-600 bg-emerald-50 px-5 py-5 text-left text-base font-semibold text-emerald-900 hover:bg-emerald-100 active:translate-y-px"
                  >
                    ST-delmål
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BT-delmål modal - öppnas direkt från knappen, ingen mellanfil */}
      <BtMilestonesModal
        open={btMilestonesModalOpen}
        onClose={() => setBtMilestonesModalOpen(false)}
      />

      {/* ST-delmål modal - öppnas direkt från knappen, ingen mellanfil */}
      <StMilestonesModal
        open={stMilestonesModalOpen}
        onClose={() => setStMilestonesModalOpen(false)}
        goalsVersion={profile?.goalsVersion}
      />
    </>
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
import PlanningPopup from "./MobileIup/PlanningPopup";
import MeetingsPopup from "./MobileIup/MeetingsPopup";
import AssessmentsPopup from "./MobileIup/AssessmentsPopup";
import BtMilestonesModal from "./MobileIup/BtMilestonesModal";
import StMilestonesModal from "./MobileIup/StMilestonesModal";
import MeetingEditModal from "./MobileIup/MeetingEditModal";
import AssessmentEditModal from "./MobileIup/AssessmentEditModal";
import InstrumentsModal from "./MobileIup/InstrumentsModal";


// components/IupModal.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { db } from "@/lib/db";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import { MilestoneOverviewPanel } from "@/components/MilestoneOverviewModal";
import { ReportPanel } from "@/components/ReportPrintModal";
import type { Achievement, Course, Placement, Profile } from "@/lib/types";
import { registerModal, unregisterModal } from "@/lib/modalEscHandler";
import { addMonths, toISO, parseISO } from "@/lib/dateutils";
import { displayMilestoneCode } from "@/lib/milestoneDisplay";








export type IupMeeting = {
  id: string;
  dateISO: string; // Datum för handledarsamtalet
  focus: string; // Kort fokus / rubrik
  summary: string; // Kort sammanfattning
  actions: string; // Överenskomna åtgärder
  nextDateISO?: string; // Nästa planerade samtal
};

export type IupAssessmentPhase = "BT" | "ST";

export type IupAssessment = {
  id: string;
  dateISO: string; // Datum för progressionsbedömning
  phase: IupAssessmentPhase; // BT eller ST
  level: string; // Klinisk tjänstgöring (t.ex. mottagning/avdelning)
  instrument: string; // T.ex. "Medsittning/Sit-in", "Mini-CEX"
  summary: string; // Övergripande bedömning
  strengths: string; // Styrkor
  development: string; // Utvecklingsområden
};

export type IupSpecialistCollegium = {
  id: string;
  dateISO: string;
  feedback: string;
  planningForward: string;
};

export type IupDirectorMeeting = {
  id: string;
  dateISO: string;
  focus: string;
  planningForward?: Record<string, string>;
  personalDevelopment?: string;
  extraAssignments?: string;
};


export type IupPlanning = {
  overallGoals: string; // Övergripande mål med utbildningen
  clinicalService: string; // Kliniska tjänstgöringar
  courses: string; // Kurser
  supervisionMeetings: string; // Handledarsamtal
  theoreticalStudies: string; // Teoretiska studier
  researchWork: string; // Vetenskapligt arbete
  journalClub: string; // Journal club
  congresses: string; // Kongresser
  qualityWork: string; // Kvalitetsarbete
  patientSafety: string; // Patientsäkerhetsarbete
  leadership: string; // Ledarskap
  supervisingStudents: string; // Handledning av studenter/underläkare
  teaching: string; // Undervisning
  formativeAssessments: string; // Formativa bedömningar
};


export type ExtraPlanningSection = {
  id: string;
  title: string;
  content: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialTab?: "handledning" | "progression" | "planering" | "delmal" | "rapport";
  initialMeetingId?: string | null;
  initialAssessmentId?: string | null;
  initialDirectorMeetingId?: string | null;
  initialSpecialistCollegiumId?: string | null;
  onMeetingsChange?: (
    sessions: { id: string; dateISO: string; title?: string }[]
  ) => void;
  onAssessmentsChange?: (
    sessions: { id: string; dateISO: string; title?: string }[]
  ) => void;
  onDirectorMeetingsChange?: (
    sessions: { id: string; dateISO: string; title?: string }[]
  ) => void;
  onSpecialistCollegiumsChange?: (
    sessions: { id: string; dateISO: string; title?: string }[]
  ) => void;
  showMeetingsOnTimeline?: boolean;
  showAssessmentsOnTimeline?: boolean;
  showDirectorMeetingsOnTimeline?: boolean;
  showSpecialistCollegiumsOnTimeline?: boolean;
  onTimelineVisibilityChange?: (value: {
    showMeetingsOnTimeline?: boolean;
    showAssessmentsOnTimeline?: boolean;
    showDirectorMeetingsOnTimeline?: boolean;
    showSpecialistCollegiumsOnTimeline?: boolean;
  }) => void;
};

type DirectorMeetingModalProps = {
  open: boolean;
  meeting: IupDirectorMeeting | null;
  allMeetings: IupDirectorMeeting[];
  supervisionMeetings: IupMeeting[];
  assessments: IupAssessment[];
  planning: IupPlanning;
  placements: Placement[];
  courses: Course[];
  achievements: Achievement[];
  onSave: (value: IupDirectorMeeting) => void;
  onClose: () => void;
};

function DirectorMeetingModal({
  open,
  meeting,
  allMeetings,
  supervisionMeetings,
  assessments,
  planning,
  placements,
  courses,
  achievements,
  onSave,
  onClose,
}: DirectorMeetingModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<IupDirectorMeeting | null>(null);
  const [dirty, setDirty] = useState(false);
  const [openForwardSections, setOpenForwardSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open || !meeting) {
      setDraft(null);
      setDirty(false);
      setOpenForwardSections({});
      return;
    }

    setDraft({
      ...meeting,
      planningForward: meeting.planningForward ?? {},
      personalDevelopment: meeting.personalDevelopment ?? "",
      extraAssignments: meeting.extraAssignments ?? "",
    });
    setDirty(false);
  }, [open, meeting]);

  useEffect(() => {
    if (!open || !overlayRef.current) return;
    const el = overlayRef.current;
    registerModal(el, onClose);
    return () => unregisterModal(el);
  }, [open, onClose]);

  const updateDraft = (patch: Partial<IupDirectorMeeting>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setDirty(true);
      return next;
    });
  };

  const updateForward = (key: string, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next: IupDirectorMeeting = {
        ...prev,
        planningForward: {
          ...(prev.planningForward ?? {}),
          [key]: value,
        },
      };
      setDirty(true);
      return next;
    });
  };

  const handleSave = () => {
    if (!draft) return;
    onSave(draft);
    setDirty(false);
  };

  if (!open || !meeting || !draft) return null;

  const currentDate = parseISO(draft.dateISO) ?? new Date(NaN);
  const currentIso = draft.dateISO;

  const prevDirectorMeetingIso = (() => {
    const sorted = [...(Array.isArray(allMeetings) ? allMeetings : [])]
      .filter((m) => m && m.id !== meeting.id && typeof m.dateISO === "string" && m.dateISO)
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    const prev = sorted
      .filter((m) => m.dateISO < currentIso)
      .slice(-1)[0];
    return prev?.dateISO ?? null;
  })();

  const isAfterPrev = (iso: string | undefined | null): boolean => {
    if (!iso) return false;
    if (prevDirectorMeetingIso) return iso > prevDirectorMeetingIso && iso <= currentIso;
    return iso <= currentIso;
  };

  const overlapsPeriod = (startIso?: string | null, endIso?: string | null): boolean => {
    const start = typeof startIso === "string" ? startIso.slice(0, 10) : "";
    const end = typeof endIso === "string" ? endIso.slice(0, 10) : "";
    if (!start && !end) return false;
    const s = start || end;
    const e = end || start;
    if (prevDirectorMeetingIso) {
      // inkludera överlapp med start/end
      return e >= prevDirectorMeetingIso && s <= currentIso;
    }
    return s <= currentIso;
  };

  const milestoneCodesForPlacement = (placementId: string): string[] => {
    const set = new Set<string>();
    (Array.isArray(achievements) ? achievements : []).forEach((a: any) => {
      if (String((a as any)?.placementId ?? "") !== placementId) return;
      const raw = (a as any).milestoneId ?? (a as any).goalId ?? (a as any).code ?? "";
      const code = String(raw ?? "").trim();
      if (code) set.add(displayMilestoneCode(code));
    });
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b));
  };

  const milestoneCodesForCourse = (courseId: string): string[] => {
    const set = new Set<string>();
    (Array.isArray(achievements) ? achievements : []).forEach((a: any) => {
      if (String((a as any)?.courseId ?? "") !== courseId) return;
      const raw = (a as any).milestoneId ?? (a as any).goalId ?? (a as any).code ?? "";
      const code = String(raw ?? "").trim();
      if (code) set.add(displayMilestoneCode(code));
    });
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b));
  };

  const placementAtIso = (iso: string): Placement | null => {
    const d = parseISO(iso);
    if (!d) return null;
    const t = d.getTime();
    const arr = Array.isArray(placements) ? placements : [];
    const match = arr.find((p: any) => {
      const s = parseISO((p as any)?.startDate ?? (p as any)?.startISO ?? "");
      const e = parseISO((p as any)?.endDate ?? (p as any)?.endISO ?? "");
      const st = s ? s.getTime() : NaN;
      const et = e ? e.getTime() : NaN;
      if (!isFinite(st) && !isFinite(et)) return false;
      if (isFinite(st) && t < st) return false;
      if (isFinite(et) && t > et) return false;
      return true;
    });
    return (match as any) ?? null;
  };

  const placementsSince = (Array.isArray(placements) ? placements : [])
    .filter((p: any) => overlapsPeriod((p as any)?.startDate, (p as any)?.endDate))
    .sort((a: any, b: any) => String((a as any).startDate ?? "").localeCompare(String((b as any).startDate ?? "")));

  const coursesSince = (Array.isArray(courses) ? courses : [])
    .filter((c: any) => overlapsPeriod((c as any)?.startDate ?? (c as any)?.certificateDate, (c as any)?.endDate ?? (c as any)?.certificateDate))
    .sort((a: any, b: any) => {
      const da = String((a as any).startDate ?? (a as any).certificateDate ?? "");
      const db = String((b as any).startDate ?? (b as any).certificateDate ?? "");
      return da.localeCompare(db);
    });

  const assessmentsSince = (Array.isArray(assessments) ? assessments : [])
    .filter((a) => isAfterPrev(a.dateISO))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  const supervisionSince = (Array.isArray(supervisionMeetings) ? supervisionMeetings : [])
    .filter((m) => isAfterPrev(m.dateISO))
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  const forwardSections = [
    { key: "overallGoals", title: "Övergripande mål med utbildningen" },
    { key: "clinicalService", title: "Kliniska tjänstgöringar" },
    { key: "courses", title: "Kurser" },
    { key: "supervisionMeetings", title: "Handledarsamtal" },
    { key: "theoreticalStudies", title: "Teoretiska studier" },
    { key: "researchWork", title: "Vetenskapligt arbete" },
    { key: "journalClub", title: "Journal club" },
    { key: "congresses", title: "Kongresser" },
    { key: "qualityWork", title: "Kvalitetsarbete" },
    { key: "patientSafety", title: "Patientsäkerhetsarbete" },
    { key: "leadership", title: "Ledarskap" },
    { key: "supervisingStudents", title: "Handledning av studenter/underläkare" },
    { key: "teaching", title: "Undervisning" },
    { key: "formativeAssessments", title: "Formativa bedömningar" },
    ...(Array.isArray((draft as any)?.planningForwardExtra)
      ? []
      : []),
  ];

  const extraForwardSections = Array.isArray((meeting as any)?.planningExtra)
    ? []
    : [];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] grid place-items-center bg-black/40 p-3"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-[720px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-lg font-extrabold">Möte med studierektor</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty}
              className="inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 hover:border-sky-800 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
            >
              Spara
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
            >
              Stäng
            </button>
          </div>
        </header>

        <section className="max-h-[75vh] overflow-y-auto p-4 space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
            <div>
              <CalendarDatePicker
                value={draft.dateISO || isoToday()}
                onChange={(iso) => updateDraft({ dateISO: iso })}
                label="Datum"
                weekStartsOn={1}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">Rubrik/Fokus</label>
              <input
                type="text"
                value={draft.focus}
                onChange={(e) => updateDraft({ focus: e.target.value })}
                className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
          </div>

          <div>
            <h3 className="text-base font-extrabold text-slate-900">Genomförda utbildningsaktiviteter</h3>
            <p className="mt-1 text-sm text-slate-600">
              {prevDirectorMeetingIso
                ? `Sedan senaste studierektorsmötet (${prevDirectorMeetingIso}) – inklusive aktiviteter som överlappar perioden.`
                : "Alla aktiviteter fram till valt datum."}
            </p>

            <div className="mt-3 space-y-4">
              <div>
                <div className="text-sm font-bold text-slate-800">Placeringar</div>
                {placementsSince.length === 0 ? (
                  <div className="mt-1 text-sm text-slate-500">Inga placeringar i perioden.</div>
                ) : (
                  <div className="mt-2 rounded-xl border bg-white overflow-hidden">
                    <div className="max-h-[32vh] overflow-auto">
                      <table className="w-full text-sm select-none">
                        <thead className="sticky top-0 bg-slate-50 text-left">
                          <tr>
                            <th className="px-3 py-2">Placering</th>
                            <th className="px-3 py-2">Period</th>
                            <th className="px-3 py-2 text-right">Delmål</th>
                          </tr>
                        </thead>
                        <tbody className="cursor-default">
                          {placementsSince.map((p: any) => {
                            const id = String(p.id ?? "");
                            const title = String(p.title ?? p.site ?? "Placering");
                            const start = String(p.startDate ?? "").slice(0, 10);
                            const end = String(p.endDate ?? "").slice(0, 10);
                            const period = start || end ? `${start}${start && end ? " – " : ""}${end}` : "—";
                            const codes = id ? milestoneCodesForPlacement(id) : [];

                            return (
                              <tr key={id || title + period} className="border-t hover:bg-slate-50">
                                <td className="px-3 py-1.5 font-semibold text-slate-900" data-info={title}>
                                  {title}
                                </td>
                                <td className="px-3 py-1.5 text-slate-700" data-info={period}>
                                  {period}
                                </td>
                                <td className="px-3 py-1.5">
                                  <div className="flex flex-wrap justify-end gap-1">
                                    {codes.length === 0 ? (
                                      <span className="text-slate-400">—</span>
                                    ) : (
                                      codes.map((c) => (
                                        <span
                                          key={c}
                                          className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                                        >
                                          {c}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-bold text-slate-800">Kurser</div>
                {coursesSince.length === 0 ? (
                  <div className="mt-1 text-sm text-slate-500">Inga kurser i perioden.</div>
                ) : (
                  <div className="mt-2 rounded-xl border bg-white overflow-hidden">
                    <div className="max-h-[32vh] overflow-auto">
                      <table className="w-full text-sm select-none">
                        <thead className="sticky top-0 bg-slate-50 text-left">
                          <tr>
                            <th className="px-3 py-2">Kurs</th>
                            <th className="px-3 py-2">Datum</th>
                            <th className="px-3 py-2 text-right">Delmål</th>
                          </tr>
                        </thead>
                        <tbody className="cursor-default">
                          {coursesSince.map((c: any) => {
                            const id = String(c.id ?? "");
                            const title = String(c.title ?? c.courseName ?? "Kurs");
                            const start = String(c.startDate ?? c.certificateDate ?? "").slice(0, 10);
                            const end = String(c.endDate ?? c.certificateDate ?? "").slice(0, 10);
                            const period = start || end ? `${start}${start && end ? " – " : ""}${end}` : "—";
                            const codes = id ? milestoneCodesForCourse(id) : [];

                            return (
                              <tr key={id || title + period} className="border-t hover:bg-slate-50">
                                <td className="px-3 py-1.5 font-semibold text-slate-900" data-info={title}>
                                  {title}
                                </td>
                                <td className="px-3 py-1.5 text-slate-700" data-info={period}>
                                  {period}
                                </td>
                                <td className="px-3 py-1.5">
                                  <div className="flex flex-wrap justify-end gap-1">
                                    {codes.length === 0 ? (
                                      <span className="text-slate-400">—</span>
                                    ) : (
                                      codes.map((code) => (
                                        <span
                                          key={code}
                                          className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                                        >
                                          {code}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-base font-extrabold text-slate-900">Genomförda progressionsbedömningar</h3>
            {assessmentsSince.length === 0 ? (
              <div className="mt-1 text-sm text-slate-500">Inga progressionsbedömningar i perioden.</div>
            ) : (
              <div className="mt-2 rounded-xl border bg-white overflow-hidden">
                <div className="max-h-[32vh] overflow-auto">
                  <table className="w-full text-sm select-none">
                    <thead className="sticky top-0 bg-slate-50 text-left">
                      <tr>
                        <th className="px-3 py-2">Bedömning</th>
                        <th className="px-3 py-2">Datum</th>
                        <th className="px-3 py-2 text-right">Placering</th>
                      </tr>
                    </thead>
                    <tbody className="cursor-default">
                      {assessmentsSince.map((a) => {
                        const place = placementAtIso(a.dateISO);
                        const placeLabel = place
                          ? String((place as any).title ?? (place as any).site ?? "")
                          : "";
                        const title =
                          (a.level && a.level.trim())
                            ? a.level
                            : (a.instrument && a.instrument.trim())
                            ? a.instrument
                            : "Progressionsbedömning";

                        return (
                          <tr key={a.id} className="border-t hover:bg-slate-50">
                            <td className="px-3 py-1.5 font-semibold text-slate-900" data-info={title}>
                              {title}
                            </td>
                            <td className="px-3 py-1.5 text-slate-700" data-info={a.dateISO}>
                              {a.dateISO}
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-700" data-info={placeLabel}>
                              {placeLabel || <span className="text-slate-400">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-base font-extrabold text-slate-900">Genomförda handledarsamtal</h3>
            {supervisionSince.length === 0 ? (
              <div className="mt-1 text-sm text-slate-500">Inga handledarsamtal i perioden.</div>
            ) : (
              <div className="mt-2 rounded-xl border bg-white overflow-hidden">
                <div className="max-h-[32vh] overflow-auto">
                  <table className="w-full text-sm select-none">
                    <thead className="sticky top-0 bg-slate-50 text-left">
                      <tr>
                        <th className="px-3 py-2">Handledarsamtal</th>
                        <th className="px-3 py-2">Datum</th>
                      </tr>
                    </thead>
                    <tbody className="cursor-default">
                      {supervisionSince.map((m) => (
                        <tr key={m.id} className="border-t hover:bg-slate-50">
                          <td
                            className="px-3 py-1.5 font-semibold text-slate-900"
                            data-info={m.focus || "Handledarsamtal"}
                          >
                            {m.focus || "Handledarsamtal"}
                          </td>
                          <td className="px-3 py-1.5 text-slate-700" data-info={m.dateISO}>
                            {m.dateISO}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-base font-extrabold text-slate-900">Planering framåt</h3>
            <div className="mt-3 space-y-2">
              {forwardSections.map((sec) => {
                const isOpen = !!openForwardSections[sec.key];
                const content = String((draft.planningForward ?? {})[sec.key] ?? "");
                const iupPlanningText = String((planning as any)?.[sec.key] ?? "");
                const hasCurrentComment = !!content.trim();

                const history = [...(Array.isArray(allMeetings) ? allMeetings : [])]
                  .filter((m) => m && m.id !== meeting.id)
                  .filter((m) => typeof m.dateISO === "string" && m.dateISO < currentIso)
                  .map((m) => {
                    const txt = String((m.planningForward ?? {})[sec.key] ?? "");
                    return {
                      dateISO: m.dateISO,
                      text: txt,
                    };
                  })
                  .filter((x) => x.text.trim())
                  .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

                return (
                  <div key={sec.key} className="rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50 ${
                        hasCurrentComment ? "bg-emerald-50" : ""
                      }`}
                      onClick={() =>
                        setOpenForwardSections((prev) => ({
                          ...prev,
                          [sec.key]: !prev[sec.key],
                        }))
                      }
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800">{sec.title}</div>
                        {isOpen && iupPlanningText.trim() ? (
                          <div className="mt-0.5 text-xs text-slate-600 whitespace-pre-line">
                            {iupPlanningText}
                          </div>
                        ) : null}

                        {isOpen && history.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {history.map((h) => (
                              <div key={`${sec.key}-${h.dateISO}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                                <div className="text-[11px] font-semibold text-slate-700">{h.dateISO}</div>
                                <div className="mt-0.5 text-xs text-slate-700 whitespace-pre-line">{h.text}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-slate-500">{isOpen ? "▾" : "▸"}</div>
                    </button>
                    {isOpen ? (
                      <div className="px-3 pb-3">
                        <div className="mb-1 text-xs font-semibold text-slate-700">Uppföljning/kommentar</div>
                        <textarea
                          value={content}
                          onChange={(e) => updateForward(sec.key, e.target.value)}
                          className="min-h-[90px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-base font-extrabold text-slate-900">Personlig utveckling</h3>
            <textarea
              value={draft.personalDevelopment ?? ""}
              onChange={(e) => updateDraft({ personalDevelopment: e.target.value })}
              className="mt-2 min-h-[110px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
            />
          </div>

          <div>
            <h3 className="text-base font-extrabold text-slate-900">Extra uppdrag</h3>
            <textarea
              value={draft.extraAssignments ?? ""}
              onChange={(e) => updateDraft({ extraAssignments: e.target.value })}
              className="mt-2 min-h-[110px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
            />
          </div>
        </section>
      </div>
    </div>
  );
}





const DEFAULT_INSTRUMENTS = [
  "Medsittning/Sit-in",
  "Mini-CEX",
  "360 grader",
  "Case-based discussion (CBD)",
];

type IupSettingsRow = {
  id: "iup";
  meetings?: IupMeeting[];
  assessments?: IupAssessment[];
  directorMeetings?: IupDirectorMeeting[];
  specialistCollegiums?: IupSpecialistCollegium[];
  planning?: IupPlanning;
  planningExtra?: ExtraPlanningSection[];
  instruments?: string[];
  showMeetingsOnTimeline?: boolean;
  showAssessmentsOnTimeline?: boolean;
  showDirectorMeetingsOnTimeline?: boolean;
  showSpecialistCollegiumsOnTimeline?: boolean;
  planningHidden?: string[];
};



type GoalReportRow = {
  milestoneCode: string;
  methodsText: string;
  activities: string[];
};

function shortMilestoneCode(code: string | undefined | null): string {
  if (!code) return "";
  const s = String(code);
  const idx = s.indexOf("-");
  return idx > 0 ? s.slice(0, idx) : s;
}

function isoToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isoFourWeeksFrom(baseIso?: string | null): string {
  let d: Date;

  if (baseIso && /^\d{4}-\d{2}-\d{2}$/.test(baseIso)) {
    const [y, m, day] = baseIso.split("-").map((v) => parseInt(v, 10));
    d = new Date(y, m - 1, day);
  } else {
    d = new Date();
  }

  d.setDate(d.getDate() + 28); // 4 veckor = 28 dagar

  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}



function isFutureDate(iso: string | undefined | null): boolean {
  if (!iso) return false;
  const today = isoToday();
  return iso > today;
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
    instrument: a.instrument || "",
    summary: a.summary,
    strengths: a.strengths,
    development: a.development,
  };
}

// Hjälpfunktion för att bestämma fas baserat på datum och profil
function determineAssessmentPhase(dateISO: string | null | undefined, prof: Profile | null): IupAssessmentPhase {
  if (!dateISO || !prof) {
    return "ST";
  }

  const isGoals2021 = String(prof.goalsVersion || "").trim() === "2021";
  if (!isGoals2021) {
    return "ST";
  }

  const btStartISO = (prof as any)?.btStartDate;
  if (!btStartISO) {
    return "ST";
  }

  // ST-start används som nedre gräns för när vi vill defaulta till BT i bedömningen.
  // Fallback till BT-start om ST-start saknas.
  const stStartISO = (prof as any)?.stStartDate || btStartISO;

  // Beräkna BT-slutdatum
  const btEndManual = (prof as any)?.btEndDate;
  let btEndISO: string;
  if (btEndManual && /^\d{4}-\d{2}-\d{2}$/.test(btEndManual)) {
    btEndISO = btEndManual;
  } else {
    try {
      const btStartDate = parseISO(btStartISO);
      if (!btStartDate) {
        return "ST";
      }
      const btEndDate = addMonths(btStartDate, 24);
      btEndISO = toISO(btEndDate);
    } catch {
      return "ST";
    }
  }

  // Jämför datum
  if (dateISO >= stStartISO && dateISO <= btEndISO) {
    // Mellan ST-start och BT-slut: förinställ BT
    return "BT";
  } else {
    // Efter BT-slut eller före BT-start: sätt ST automatiskt
    return "ST";
  }
}


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



/** ====== Under-modal: Handledarsamtal ====== */
type MeetingModalProps = {
  open: boolean;
  meeting: IupMeeting | null;
  onSave: (value: IupMeeting) => void;
  onClose: () => void;
};

function MeetingModal({ open, meeting, onSave, onClose }: MeetingModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<IupMeeting | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (!open || !meeting) {
      setShowCloseConfirm(false);
      return;
    }
    setDraft(cloneMeeting(meeting));
    setDirty(false);
  }, [open, meeting]);

  const handleRequestClose = useCallback(() => {
    if (dirty) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  const handleSave = useCallback(() => {
    if (!draft) return;
    onSave(draft);
    setDirty(false);
    // Spara utan att stänga - användaren kan stänga via Stäng-knappen eller ESC
  }, [draft, onSave]);

  const handleConfirmClose = useCallback(() => {
    setShowCloseConfirm(false);
    onClose();
  }, [onClose]);

  const handleSaveAndClose = useCallback(() => {
    handleSave();
    setShowCloseConfirm(false);
    onClose();
  }, [handleSave, onClose]);

  const handleCancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  // Registrera modalen för global ESC-hantering
  useEffect(() => {
    if (!open || !overlayRef.current || !draft) return;
    // Använd requestAnimationFrame för att säkerställa att DOM-elementet är helt renderat
    const rafId = requestAnimationFrame(() => {
      if (overlayRef.current) {
        registerModal(overlayRef.current, handleRequestClose);
      }
    });
    return () => {
      cancelAnimationFrame(rafId);
      if (overlayRef.current) {
        unregisterModal(overlayRef.current);
      }
    };
  }, [open, handleRequestClose, draft]);

  // Cmd/Ctrl+Enter för att spara
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Om bekräftelsedialogen är öppen, låt den hantera keyboard events
      if (showCloseConfirm) {
        return;
      }
      // Kontrollera om delete-dialogen är öppen genom att kolla om eventet redan stoppats
      if (e.defaultPrevented) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true, passive: false });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, dirty, handleSave, showCloseConfirm]);

     const updateDraft = (patch: Partial<IupMeeting>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setDirty(true);
      return next;
    });
  };

  const hasNextPlanned = !!draft?.nextDateISO;

  if (!open || !meeting || !draft) return null;

  return (
    <>
      <UnsavedChangesDialog
        open={showCloseConfirm}
        title="Osparade ändringar"
        message="Du har osparade ändringar i detta handledarsamtal. Vill du stänga utan att spara?"
        onCancel={handleCancelClose}
        onDiscard={handleConfirmClose}
        onSaveAndClose={handleSaveAndClose}
      />
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[130] grid place-items-center bg-black/40 p-3"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="w-full max-w-[820px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-base font-extrabold">Handledarsamtal</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!dirty}
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 hover:border-sky-800 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
              title="Spara ändringar"
            >
              Spara
            </button>
            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
            >
              Stäng
            </button>
          </div>
        </header>

        {/* Body */}
        <section className="max-h-[75vh] p-4 space-y-4" data-info="Fyll i information om handledarsamtalet: datum, rubrik/fokus, sammanfattning av diskussionen, överenskomna åtgärder och eventuellt nästa planerade samtal.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
            <div>
              <CalendarDatePicker
                value={draft.dateISO || isoToday()}
                onChange={(iso) => updateDraft({ dateISO: iso })}
                label="Datum för handledarsamtalet"
                weekStartsOn={1}
              />
              {isFutureDate(draft.dateISO) && (
                <p className="mt-0.5 text-xs italic text-sky-700">Planerat</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">
                Rubrik / fokus
              </label>
              <input
                type="text"
                value={draft.focus}
                onChange={(e) => updateDraft({ focus: e.target.value })}
                className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-700">
                Sammanfattning
              </label>
              <textarea
                rows={4}
                value={draft.summary}
                onChange={(e) => updateDraft({ summary: e.target.value })}
                className="min-h-[96px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">
                Överenskomna åtgärder
              </label>
              <textarea
                rows={4}
                value={draft.actions}
                onChange={(e) => updateDraft({ actions: e.target.value })}
                className="min-h-[96px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                
              />
            </div>
          </div>

                    <div className="max-w-md">
            <label className="mb-1 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-slate-300"
                checked={hasNextPlanned}
                onChange={(e) => {
                  const enable = e.target.checked;
                  if (enable) {
                    // Återaktivera – föreslå datum (befintligt framtida datum,
                    // annars 4 veckor från datum för handledarsamtalet)
                    const baseIso =
                      draft.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(draft.dateISO)
                        ? draft.dateISO
                        : isoToday();

                    updateDraft({
                      nextDateISO:
                        draft.nextDateISO && isFutureDate(draft.nextDateISO)
                          ? draft.nextDateISO
                          : isoFourWeeksFrom(baseIso),
                    });
                  } else {
                    // Inget planerat -> töm datum i datamodellen
                    // (förslaget visas ändå som grått fält via default-värdet nedan)
                    updateDraft({ nextDateISO: "" });
                  }
                }}
              />
              <span>Nästa planerade handledarsamtal</span>
            </label>
            <div
              className={
                hasNextPlanned ? "" : "opacity-60 pointer-events-none"
              }
            >
              <CalendarDatePicker
                value={
                  draft.nextDateISO ||
                  isoFourWeeksFrom(draft.dateISO || isoToday())
                }
                onChange={(iso) => updateDraft({ nextDateISO: iso })}
                label=""
                weekStartsOn={1}
              />

              {isFutureDate(draft.nextDateISO || undefined) && (
                <p className="mt-0.5 text-xs italic text-sky-700">Planerat</p>
              )}
            </div>
          </div>




        </section>
      </div>
    </div>
    </>
  );
}

/** ====== Under-modal: Progressionsbedömning ====== */
type AssessmentModalProps = {
  open: boolean;
  assessment: IupAssessment | null;
  instruments: string[];
  onSave: (value: IupAssessment) => void;
  onClose: () => void;
  profile: Profile | null;
};


function AssessmentModal({
  open,
  assessment,
  instruments,
  onSave,
  onClose,
  profile,
}: AssessmentModalProps) {



  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<IupAssessment | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Funktion för att bestämma fas baserat på datum och profil
  const determinePhase = useCallback((dateISO: string | null | undefined, prof: Profile | null): { phase: IupAssessmentPhase; showDropdown: boolean } => {
    const phase = determineAssessmentPhase(dateISO, prof);
    if (!dateISO || !prof) {
      return { phase, showDropdown: false };
    }

    const isGoals2021 = String(prof.goalsVersion || "").trim() === "2021";
    if (!isGoals2021) {
      return { phase, showDropdown: false };
    }

    const btStartISO = (prof as any)?.btStartDate;
    if (!btStartISO) {
      return { phase, showDropdown: false };
    }

    // ST-start som nedre gräns (fallback BT-start)
    const stStartISO = (prof as any)?.stStartDate || btStartISO;

    // Beräkna BT-slutdatum
    const btEndManual = (prof as any)?.btEndDate;
    let btEndISO: string;
    if (btEndManual && /^\d{4}-\d{2}-\d{2}$/.test(btEndManual)) {
      btEndISO = btEndManual;
    } else {
      try {
        const btStartDate = parseISO(btStartISO);
        if (!btStartDate) {
          return { phase, showDropdown: false };
        }
        const btEndDate = addMonths(btStartDate, 24);
        btEndISO = toISO(btEndDate);
      } catch {
        return { phase, showDropdown: false };
      }
    }

    // Jämför datum
    // Mellan ST-start och BT-slut: BT (dropdown synlig). Efter BT-slut: ST och dropdown göms.
    if (dateISO >= stStartISO && dateISO <= btEndISO) {
      return { phase: "BT", showDropdown: true };
    }
    return { phase: "ST", showDropdown: false };
  }, []);

  useEffect(() => {
    if (!open || !assessment) {
      setShowCloseConfirm(false);
      return;
    }
    const cloned = cloneAssessment(assessment);
    // Bestäm fas automatiskt baserat på datum
    const phaseInfo = determinePhase(cloned.dateISO, profile);
    cloned.phase = phaseInfo.phase;
    setDraft(cloned);
    setDirty(false);
  }, [open, assessment, determinePhase, profile]);

  // Uppdatera klinisk tjänstgöring och fas automatiskt baserat på valt datum
  useEffect(() => {
    if (!open) return;
    if (!draft || !draft.dateISO) return;

    let cancelled = false;

    (async () => {
      try {
        // Uppdatera fas baserat på datum
        const phaseInfo = determinePhase(draft.dateISO, profile);
        if (!cancelled) {
          setDraft((prev) =>
            prev
              ? {
                  ...prev,
                  phase: phaseInfo.phase,
                }
              : prev
          );
        }

        const allPlacements = await db.placements.toArray();
        const date = draft.dateISO;
        // Hitta placering som är aktiv under valt datum
        const match = allPlacements.find(
          (p: any) => p.startDate <= date && p.endDate >= date
        );
        if (!cancelled && match) {
          // Använd clinic eller title som fallback
          const placementName = match.clinic || (match as any).title || "";
          if (placementName) {
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    level: placementName,
                  }
                : prev
            );
          }
        }
      } catch (e) {
        console.error(
          "Kunde inte uppdatera klinisk tjänstgöring för progressionsbedömning:",
          e
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, draft?.dateISO, determinePhase, profile]);

  const handleRequestClose = useCallback(() => {
    if (dirty) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  const handleSave = useCallback(() => {
    if (!draft) return;
    onSave(draft);
    setDirty(false);
    // Spara utan att stänga - användaren kan stänga via Stäng-knappen eller ESC
  }, [draft, onSave]);

  const handleConfirmClose = useCallback(() => {
    setShowCloseConfirm(false);
    onClose();
  }, [onClose]);

  const handleSaveAndClose = useCallback(() => {
    handleSave();
    setShowCloseConfirm(false);
    onClose();
  }, [handleSave, onClose]);

  const handleCancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  // Registrera modalen för global ESC-hantering
  useEffect(() => {
    if (!open || !overlayRef.current || !draft) return;
    // Använd requestAnimationFrame för att säkerställa att DOM-elementet är helt renderat
    const rafId = requestAnimationFrame(() => {
      if (overlayRef.current) {
        registerModal(overlayRef.current, handleRequestClose);
      }
    });
    return () => {
      cancelAnimationFrame(rafId);
      if (overlayRef.current) {
        unregisterModal(overlayRef.current);
      }
    };
  }, [open, handleRequestClose, draft]);

  // Cmd/Ctrl+Enter för att spara (ESC hanteras nu av global ESC-handler)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Om bekräftelsedialogen är öppen, låt den hantera keyboard events
      if (showCloseConfirm) {
        return;
      }
      // Kontrollera om delete-dialogen är öppen genom att kolla om eventet redan stoppats
      if (e.defaultPrevented) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleSave();
      }
      // ESC hanteras nu av global ESC-handler som hittar det översta fönstret
    };
    window.addEventListener("keydown", onKey, { capture: true, passive: false });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, dirty, handleSave, showCloseConfirm]);

  const updateDraft = (patch: Partial<IupAssessment>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setDirty(true);
      return next;
    });
  };

  if (!open || !assessment || !draft) return null;

  const isGoals2021 =
    String(profile?.goalsVersion || "").trim() === "2021";

  // Bestäm om dropdown ska visas
  const phaseInfo = determinePhase(draft.dateISO, profile);
  const showPhaseDropdown = isGoals2021 && phaseInfo.showDropdown;

  return (
    <>
      <UnsavedChangesDialog
        open={showCloseConfirm}
        title="Osparade ändringar"
        message="Du har osparade ändringar i denna progressionsbedömning. Vill du stänga utan att spara?"
        onCancel={handleCancelClose}
        onDiscard={handleConfirmClose}
        onSaveAndClose={handleSaveAndClose}
      />
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[130] grid place-items-center bg-black/40 p-3"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="w-full max-w-[820px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-base font-extrabold">
            Progressionsbedömning
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!dirty}
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 hover:border-sky-800 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
              title="Spara ändringar"
            >
              Spara
            </button>
            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
            >
              Stäng
            </button>
          </div>
        </header>

                {/* Body */}
        <section className="max-h-[75vh] p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
            <div>
              <CalendarDatePicker
                value={draft.dateISO || isoToday()}
                onChange={(iso) => updateDraft({ dateISO: iso })}
                label="Datum för bedömningen"
                weekStartsOn={1}
              />
            </div>
            {isGoals2021 ? (
              <div className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Fas</label>
                  {showPhaseDropdown ? (
                    <select
                      value={draft.phase}
                      onChange={(e) =>
                        updateDraft({ phase: e.target.value as IupAssessmentPhase })
                      }
                      className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                    >
                      <option value="BT">BT</option>
                      <option value="ST">ST</option>
                    </select>
                  ) : (
                    <div className="h-[40px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 flex items-center text-[14px] text-slate-600">
                      {draft.phase}
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">
                    Klinisk tjänstgöring
                  </label>
                  <input
                    type="text"
                    value={draft.level}
                    onChange={(e) => updateDraft({ level: e.target.value })}
                    className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                    
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Klinisk tjänstgöring
                </label>
                <input
                  type="text"
                  value={draft.level}
                  onChange={(e) => updateDraft({ level: e.target.value })}
                  className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                  
                />
              </div>
            )}
          </div>

          <div className="mt-2">

            <label className="mb-1 block text-sm text-slate-700">
              Bedömningsinstrument
            </label>
            <select
              value={draft.instrument}
              onChange={(e) => updateDraft({ instrument: e.target.value })}
              className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
            >
              <option value="">Välj bedömningsinstrument…</option>
              {instruments.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-700">
              Övergripande bedömning
            </label>

            <textarea
              rows={3}
              value={draft.summary}
              onChange={(e) => updateDraft({ summary: e.target.value })}
              className="min-h-[80px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-700">
                Styrkor
              </label>
              <textarea
                rows={4}
                value={draft.strengths}
                onChange={(e) => updateDraft({ strengths: e.target.value })}
                className="min-h-[96px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">
                Utvecklingsområden
              </label>
              <textarea
                rows={4}
                value={draft.development}
                onChange={(e) =>
                  updateDraft({ development: e.target.value })
                }
                className="min-h-[96px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                
              />
            </div>
          </div>
        </section>
      </div>
    </div>
    </>
  );
}

type SpecialistCollegiumModalProps = {
  open: boolean;
  collegium: IupSpecialistCollegium | null;
  allCollegiums: IupSpecialistCollegium[];
  onSave: (value: IupSpecialistCollegium) => void;
  onClose: () => void;
};

function SpecialistCollegiumModal({
  open,
  collegium,
  allCollegiums,
  onSave,
  onClose,
}: SpecialistCollegiumModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<IupSpecialistCollegium | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open || !collegium) {
      setDraft(null);
      setDirty(false);
      return;
    }
    setDraft({
      id: collegium.id,
      dateISO: collegium.dateISO,
      feedback: collegium.feedback ?? "",
      planningForward: collegium.planningForward ?? "",
    });
    setDirty(false);
  }, [open, collegium]);

  useEffect(() => {
    if (!open || !overlayRef.current) return;
    const el = overlayRef.current;
    registerModal(el, onClose);
    return () => unregisterModal(el);
  }, [open, onClose]);

  const updateDraft = (patch: Partial<IupSpecialistCollegium>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      setDirty(true);
      return next;
    });
  };

  const prev = useMemo(() => {
    if (!draft) return null;
    const sorted = [...(Array.isArray(allCollegiums) ? allCollegiums : [])]
      .filter((x) => x && x.id !== draft.id)
      .filter((x) => x.dateISO && x.dateISO < draft.dateISO)
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    return sorted.slice(-1)[0] ?? null;
  }, [allCollegiums, draft]);

  const handleSave = () => {
    if (!draft) return;
    onSave(draft);
    setDirty(false);
  };

  if (!open || !draft) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[130] grid place-items-center bg-black/40 p-3"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-[820px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-base font-extrabold">Specialistkollegium</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty}
              className="inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 hover:border-sky-800 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
            >
              Spara
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
            >
              Stäng
            </button>
          </div>
        </header>

        <section className="max-h-[75vh] overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <div>
              <CalendarDatePicker
                value={draft.dateISO || isoToday()}
                onChange={(iso) => updateDraft({ dateISO: iso })}
                label="Datum"
                weekStartsOn={1}
              />
            </div>
          </div>

          {prev ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-900">Förra specialistkollegium</div>
              <div className="mt-0.5 text-xs font-semibold text-slate-700">{prev.dateISO}</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-700">Återkoppling</div>
                  <div className="mt-1 text-xs text-slate-700 whitespace-pre-line">{prev.feedback || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-700">Planering</div>
                  <div className="mt-1 text-xs text-slate-700 whitespace-pre-line">{prev.planningForward || "—"}</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">Återkoppling</label>
              <textarea
                value={draft.feedback}
                onChange={(e) => updateDraft({ feedback: e.target.value })}
                className="min-h-[160px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">Planering framåt</label>
              <textarea
                value={draft.planningForward}
                onChange={(e) => updateDraft({ planningForward: e.target.value })}
                className="min-h-[160px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

type InstrumentsModalProps = {
  open: boolean;
  instruments: string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
};

function InstrumentsModal({
  open,
  instruments,
  onChange,
  onClose,
}: InstrumentsModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmConfig, setDeleteConfirmConfig] = useState<{
    name: string;
  } | null>(null);

  const handleRequestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // ESC för att stänga instrument-dialogen
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleRequestClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, handleRequestClose]);

  const handleAdd = useCallback(() => {
    const name = input.trim();
    if (!name) return;
    if (instruments.includes(name)) {
      setInput("");
      return;
    }
    onChange([...instruments, name]);
    setInput("");
  }, [input, instruments, onChange]);

  const handleRemove = useCallback(
    (name: string) => {
      setDeleteConfirmConfig({ name });
      setShowDeleteConfirm(true);
    },
    []
  );

  const confirmRemove = useCallback(() => {
    if (!deleteConfirmConfig) return;
    onChange(instruments.filter((i) => i !== deleteConfirmConfig.name));
    setShowDeleteConfirm(false);
    setDeleteConfirmConfig(null);
  }, [deleteConfirmConfig, instruments, onChange]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[135] grid place-items-center bg-black/40 p-3"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-base font-extrabold">
            Bedömningsinstrument
          </h2>
          <button
            type="button"
            onClick={handleRequestClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          >
            Stäng
          </button>
        </header>

        <div className="space-y-3 px-4 py-3">
          <div>
            <label className="mb-1 block text-sm text-slate-700">
              Lägg till bedömningsinstrument
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="h-[40px] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                
              />
              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 hover:border-sky-800 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
              >
                Lägg till
              </button>
            </div>
          </div>

          <div className="max-h-[260px] overflow-auto rounded-xl border border-slate-200 bg-white">
            {instruments.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500">
                Inga bedömningsinstrument tillagda ännu.
              </div>
            ) : (
              instruments.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0"
                >
                  <span className="text-sm text-slate-800">{name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(name)}
                    className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 hover:border-rose-300 active:translate-y-px"
                    data-info="Tar bort detta bedömningsinstrument från listan. Det kommer inte längre att vara tillgängligt vid skapande av nya progressionsbedömningar."
                  >
                    Ta bort
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* === Ta bort-bekräftelsedialog === */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        title="Ta bort"
        message={
          deleteConfirmConfig
            ? `Vill du ta bort bedömningsinstrumentet "${deleteConfirmConfig.name}"?`
            : "Är du säker på att du vill ta bort detta?"
        }
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteConfirmConfig(null);
        }}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

/** ====== Huvudmodal: IUP ====== */

type NewPlanningSectionModalProps = {
  open: boolean;
  onSave: (title: string) => void;
  onClose: () => void;
};

function NewPlanningSectionModal({
  open,
  onSave,
  onClose,
}: NewPlanningSectionModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState("");

  const handleRequestClose = useCallback(() => {
    onClose();
    setTitle("");
  }, [onClose]);

  const handleSave = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setTitle("");
  }, [title, onSave]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[135] grid place-items-center bg-black/40 p-3"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-base font-extrabold">Ny planeringsrubrik</h2>
          <button
            type="button"
            onClick={handleRequestClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          >
            Stäng
          </button>
        </header>
        <div className="space-y-3 px-4 py-3" data-info="Skapa en anpassad planeringsrubrik med egen titel och innehåll. Denna rubrik kommer att visas i planeringsfliken tillsammans med de fördefinierade rubrikerna.">
          <div>
            <label className="mb-1 block text-sm text-slate-700">
              Rubrik
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleRequestClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
              data-info="Avbryter skapandet av den nya planeringsrubriken och stänger dialogen."
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim()}
              className="inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 hover:border-sky-800 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
              data-info="Lägger till den nya planeringsrubriken med angiven titel och innehåll i planeringsfliken. Knappen är endast aktiv när en titel har angivits."
            >
              Lägg till
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IupModal({
  open,
  onClose,
  initialTab,
  initialMeetingId,
  initialAssessmentId,
  initialDirectorMeetingId,
  initialSpecialistCollegiumId,
  onMeetingsChange,
  onAssessmentsChange,
  onDirectorMeetingsChange,
  onSpecialistCollegiumsChange,
  showMeetingsOnTimeline: propShowMeetingsOnTimeline,
  showAssessmentsOnTimeline: propShowAssessmentsOnTimeline,
  showDirectorMeetingsOnTimeline: propShowDirectorMeetingsOnTimeline,
  showSpecialistCollegiumsOnTimeline: propShowSpecialistCollegiumsOnTimeline,
  onTimelineVisibilityChange,
}: Props) {




  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [meetings, setMeetings] = useState<IupMeeting[]>([]);
  const [assessments, setAssessments] = useState<IupAssessment[]>([]);
  const [directorMeetings, setDirectorMeetings] = useState<IupDirectorMeeting[]>([]);
  const [specialistCollegiums, setSpecialistCollegiums] = useState<IupSpecialistCollegium[]>([]);
  const [planning, setPlanning] = useState<IupPlanning>(defaultPlanning);
  const [planningExtra, setPlanningExtra] = useState<ExtraPlanningSection[]>([]);
  const [instruments, setInstruments] = useState<string[]>(DEFAULT_INSTRUMENTS);
  const [hiddenPlanningKeys, setHiddenPlanningKeys] = useState<string[]>([]);

  const [placements, setPlacements] = useState<Placement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Delete confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmConfig, setDeleteConfirmConfig] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [tab, setTab] = useState<
    "handledning" | "progression" | "planering" | "delmal" | "rapport"
  >("handledning");

  // Profilinfo för rapportförhandsvisningar
  const [profile, setProfile] = useState<Profile | null>(null);
  const isGoals2021 =
    String(profile?.goalsVersion || "").trim() === "2021";

  // Intern undermeny i Rapport-fliken

  const [reportTab, setReportTab] = useState<
    "plan_hand" | "moment" | "delmal"
  >("plan_hand");

  // Rader för rapporten "Delmål"
  const [goalReportRows, setGoalReportRows] = useState<GoalReportRow[]>([]);

  // Synlighet för sektioner i "Planering och handledning"
  const [showPlanOverview, setShowPlanOverview] = useState(true);
  const [showPlanMeetings, setShowPlanMeetings] = useState(true);
  const [showPlanAssessments, setShowPlanAssessments] = useState(true);

  // Filter i rapporten för handledarsamtal (genomförda/planerade)
  const [planMeetingsFilter, setPlanMeetingsFilter] = useState<{
    done: boolean;
    planned: boolean;
  }>({
    done: true,
    planned: true,
  });

  // Filter i rapporten för progressionsbedömningar (genomförda/planerade)
  const [planAssessmentsFilter, setPlanAssessmentsFilter] = useState<{
    done: boolean;
    planned: boolean;
  }>({
    done: true,
    planned: true,
  });

  // Kryssrutor för visning på tidslinjen
  const [showMeetingsOnTimeline, setShowMeetingsOnTimeline] = useState(true);
  const [showAssessmentsOnTimeline, setShowAssessmentsOnTimeline] =
    useState(true);
  const [showDirectorMeetingsOnTimeline, setShowDirectorMeetingsOnTimeline] = useState(true);
  const [showSpecialistCollegiumsOnTimeline, setShowSpecialistCollegiumsOnTimeline] = useState(true);

  // Kryssrutor för Utbildningsmoment (Genomförda / Pågående / Planerade)
  const [reportStatusFilter, setReportStatusFilter] = useState<{
    done: boolean;
    ongoing: boolean;
    planned: boolean;
  }>({
    done: true,
    ongoing: true,
    planned: true,
  });



  // Kryssrutor för Delmålsrapport – kolumnvisning
  const [showGoalMethods, setShowGoalMethods] = useState(true);
  const [showGoalActivities, setShowGoalActivities] = useState(true);

  // Kryssrutor för Planering & handledning – kolumnvisning
  const [showMeetingFocus, setShowMeetingFocus] = useState(true);
  const [showMeetingSummary, setShowMeetingSummary] = useState(true);
  const [showMeetingActions, setShowMeetingActions] = useState(true);

    const [showAssessPhase, setShowAssessPhase] = useState(true);
  const [showAssessLevel, setShowAssessLevel] = useState(true);
  const [showAssessInstrument, setShowAssessInstrument] = useState(true);
  const [showAssessSummary, setShowAssessSummary] = useState(true);

  const [instrumentsModalOpen, setInstrumentsModalOpen] = useState(false);
  const [newSectionModalOpen, setNewSectionModalOpen] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);



  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);

  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(
    null
  );

  const [editingDirectorMeetingId, setEditingDirectorMeetingId] = useState<string | null>(null);

  const [editingSpecialistCollegiumId, setEditingSpecialistCollegiumId] = useState<string | null>(null);

  // Förhandsvisning – Planering och handledning
  const [planHandPreviewOpen, setPlanHandPreviewOpen] = useState(false);
  const planHandPreviewContentRef = useRef<HTMLDivElement | null>(null);


  // Förhandsvisning – Delmål
  const [goalPreviewOpen, setGoalPreviewOpen] = useState(false);
  const goalPreviewContentRef = useRef<HTMLDivElement | null>(null);


      // Central spar-funktion – används både av huvud-Spara och vid ändringar

  const saveAllToDb = useCallback(
    async (
      nextMeetings: IupMeeting[],
      nextAssessments: IupAssessment[],
      nextDirectorMeetings: IupDirectorMeeting[],
      nextSpecialistCollegiums: IupSpecialistCollegium[],
      nextPlanning: IupPlanning,
      nextPlanningExtra: ExtraPlanningSection[]
    ): Promise<boolean> => {
      try {
        const row: IupSettingsRow = {
          id: "iup",
          meetings: nextMeetings,
          assessments: nextAssessments,
          directorMeetings: nextDirectorMeetings,
          specialistCollegiums: nextSpecialistCollegiums,
          planning: nextPlanning,
          planningExtra: nextPlanningExtra,
          instruments,
          showMeetingsOnTimeline,
          showAssessmentsOnTimeline,
          showDirectorMeetingsOnTimeline,
          showSpecialistCollegiumsOnTimeline,
          planningHidden: hiddenPlanningKeys,
        };

        await (db as any).timeline?.put?.(row);
        setDirty(false);

        if (onMeetingsChange) {
          const sessions = nextMeetings
            .filter(
              (m) =>
                m &&
                typeof m.id === "string" &&
                m.id &&
                typeof m.dateISO === "string" &&
                m.dateISO
            )
            .map((m) => ({
              id: m.id,
              dateISO: m.dateISO,
              title: m.focus,
            }));
          onMeetingsChange(sessions);
        }

        if (onAssessmentsChange) {
          const sessions = nextAssessments
            .filter(
              (a) =>
                a &&
                typeof a.id === "string" &&
                a.id &&
                typeof a.dateISO === "string" &&
                a.dateISO
            )
            .map((a) => ({
              id: a.id,
              dateISO: a.dateISO,
              title:
                typeof a.level === "string" && a.level.trim()
                  ? a.level
                  : typeof a.instrument === "string"
                  ? a.instrument
                  : "",
            }));
          onAssessmentsChange(sessions);
        }

        if (onDirectorMeetingsChange) {
          const sessions = nextDirectorMeetings
            .filter(
              (m) =>
                m &&
                typeof m.id === "string" &&
                m.id &&
                typeof m.dateISO === "string" &&
                m.dateISO
            )
            .map((m) => ({
              id: m.id,
              dateISO: m.dateISO,
              title: m.focus,
            }));
          onDirectorMeetingsChange(sessions);
        }

        if (onSpecialistCollegiumsChange) {
          const sessions = nextSpecialistCollegiums
            .filter(
              (m) =>
                m &&
                typeof m.id === "string" &&
                m.id &&
                typeof m.dateISO === "string" &&
                m.dateISO
            )
            .map((m) => ({
              id: m.id,
              dateISO: m.dateISO,
              title: "Specialistkollegium",
            }));
          onSpecialistCollegiumsChange(sessions);
        }

        return true;
      } catch (e) {
        console.error("Kunde inte spara IUP till DB:", e);
        window.alert(
          "Kunde inte spara IUP till databasen. Kontrollera uppkopplingen och försök igen."
        );
        return false;
      }
    },
    [
      instruments,
      onMeetingsChange,
      onAssessmentsChange,
      onDirectorMeetingsChange,
      onSpecialistCollegiumsChange,
      showMeetingsOnTimeline,
      showAssessmentsOnTimeline,
      showDirectorMeetingsOnTimeline,
      showSpecialistCollegiumsOnTimeline,
    ]
  );






  // Läser in IUP-data från DB.timeline("iup") när modalen öppnas

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setDirty(false);

    // Startläge när modalen öppnas
    setTab(initialTab ?? "handledning");
    setEditingMeetingId(initialMeetingId ?? null);
    setEditingAssessmentId(initialAssessmentId ?? null);
    setEditingDirectorMeetingId(initialDirectorMeetingId ?? null);
    setEditingSpecialistCollegiumId(initialSpecialistCollegiumId ?? null);
    setShowCloseConfirm(false);


        (async () => {
      try {
        const row = (await (db as any).timeline?.get?.(
          "iup"
        )) as IupSettingsRow | undefined;

        if (cancelled) return;

        const loadedMeetings = Array.isArray(row?.meetings)
          ? row!.meetings!.map(cloneMeeting)
          : [];
        const loadedAssessments = Array.isArray(row?.assessments)
          ? row!.assessments!.map(cloneAssessment)
          : [];
        const loadedDirectorMeetings = Array.isArray((row as any)?.directorMeetings)
          ? ((row as any).directorMeetings as IupDirectorMeeting[]).map((m) => ({
              id: String((m as any)?.id || `d_${Math.random().toString(36).slice(2, 10)}`),
              dateISO: String((m as any)?.dateISO || ""),
              focus: String((m as any)?.focus || ""),
              planningForward:
                (m as any)?.planningForward && typeof (m as any).planningForward === "object"
                  ? ((m as any).planningForward as Record<string, string>)
                  : {},
              personalDevelopment: String((m as any)?.personalDevelopment || ""),
              extraAssignments: String((m as any)?.extraAssignments || ""),
            }))
          : [];

        const loadedSpecialistCollegiums: IupSpecialistCollegium[] = Array.isArray(
          (row as any)?.specialistCollegiums
        )
          ? ((row as any).specialistCollegiums as any[]).map((m: any, i: number) => ({
              id: String(m?.id || `sc_${i}_${Math.random().toString(36).slice(2, 10)}`),
              dateISO: String(m?.dateISO || ""),
              feedback: String(m?.feedback || ""),
              planningForward: String(m?.planningForward || ""),
            }))
          : [];
        const loadedPlanning = row?.planning
          ? { ...defaultPlanning(), ...row.planning }
          : defaultPlanning();
        const loadedPlanningExtra: ExtraPlanningSection[] = Array.isArray(
          (row as any)?.planningExtra
        )
          ? ((row as any).planningExtra as ExtraPlanningSection[]).map((s) => ({
              id: s.id,
              title: s.title,
              content: s.content ?? "",
            }))
          : [];
        const loadedInstruments =
          row?.instruments &&
          Array.isArray(row.instruments) &&
          row.instruments.length > 0
            ? [...row.instruments]
            : DEFAULT_INSTRUMENTS;

        const loadedHiddenPlanningKeys: string[] = Array.isArray(
          (row as any)?.planningHidden
        )
          ? [...((row as any).planningHidden as string[])]
          : [];

        const loadedShowMeetingsOnTimeline =
          typeof (row as any)?.showMeetingsOnTimeline === "boolean"
            ? (row as any).showMeetingsOnTimeline
            : propShowMeetingsOnTimeline ?? true;

        const loadedShowAssessmentsOnTimeline =
          typeof (row as any)?.showAssessmentsOnTimeline === "boolean"
            ? (row as any).showAssessmentsOnTimeline
            : propShowAssessmentsOnTimeline ?? true;

        const loadedShowDirectorMeetingsOnTimeline =
          typeof (row as any)?.showDirectorMeetingsOnTimeline === "boolean"
            ? (row as any).showDirectorMeetingsOnTimeline
            : propShowDirectorMeetingsOnTimeline ?? true;

        const loadedShowSpecialistCollegiumsOnTimeline =
          typeof (row as any)?.showSpecialistCollegiumsOnTimeline === "boolean"
            ? (row as any).showSpecialistCollegiumsOnTimeline
            : propShowSpecialistCollegiumsOnTimeline ?? true;

        setMeetings(loadedMeetings);
        setAssessments(loadedAssessments);
        setDirectorMeetings(loadedDirectorMeetings);
        setSpecialistCollegiums(loadedSpecialistCollegiums);
        setPlanning(loadedPlanning);
        setPlanningExtra(loadedPlanningExtra);
        setInstruments(loadedInstruments);
        setHiddenPlanningKeys(loadedHiddenPlanningKeys);
        setShowMeetingsOnTimeline(loadedShowMeetingsOnTimeline);
        setShowAssessmentsOnTimeline(loadedShowAssessmentsOnTimeline);
        setShowDirectorMeetingsOnTimeline(loadedShowDirectorMeetingsOnTimeline);
        setShowSpecialistCollegiumsOnTimeline(loadedShowSpecialistCollegiumsOnTimeline);

        if (onTimelineVisibilityChange) {
          onTimelineVisibilityChange({
            showMeetingsOnTimeline: loadedShowMeetingsOnTimeline,
            showAssessmentsOnTimeline: loadedShowAssessmentsOnTimeline,
            showDirectorMeetingsOnTimeline: loadedShowDirectorMeetingsOnTimeline,
            showSpecialistCollegiumsOnTimeline: loadedShowSpecialistCollegiumsOnTimeline,
          });
        }

        if (onMeetingsChange) {
          const sessions = loadedMeetings
            .filter(
              (m) =>
                m &&
                typeof m.id === "string" &&
                m.id &&
                typeof m.dateISO === "string" &&
                m.dateISO
            )
            .map((m) => ({
              id: m.id,
              dateISO: m.dateISO,
              title: m.focus,
            }));
          onMeetingsChange(sessions);
        }

        if (onAssessmentsChange) {
          const sessions = loadedAssessments
            .filter(
              (a) =>
                a &&
                typeof a.id === "string" &&
                a.id &&
                typeof a.dateISO === "string" &&
                a.dateISO
            )
            .map((a) => ({
              id: a.id,
              dateISO: a.dateISO,
              title:
                typeof a.level === "string" && a.level.trim()
                  ? a.level
                  : typeof a.instrument === "string"
                  ? a.instrument
                  : "",
            }));
          onAssessmentsChange(sessions);
        }

        if (onSpecialistCollegiumsChange) {
          const sessions = loadedSpecialistCollegiums
            .filter(
              (m) =>
                m &&
                typeof m.id === "string" &&
                m.id &&
                typeof m.dateISO === "string" &&
                m.dateISO
            )
            .map((m) => ({
              id: m.id,
              dateISO: m.dateISO,
              title: "Specialistkollegium",
            }));
          onSpecialistCollegiumsChange(sessions);
        }
      } catch (e) {
        console.error("Kunde inte läsa IUP från DB:", e);
        if (!cancelled) {
          setMeetings([]);
          setAssessments([]);
          setSpecialistCollegiums([]);
          setPlanning(defaultPlanning());
          setInstruments(DEFAULT_INSTRUMENTS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialTab, initialMeetingId, initialAssessmentId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const anyDb = db as any;
        const [placementsRaw, coursesRaw, achievementsRaw] = await Promise.all([
          (anyDb.placements?.toArray?.() as Promise<any[] | undefined>) ?? [],
          (anyDb.courses?.toArray?.() as Promise<any[] | undefined>) ?? [],
          (anyDb.achievements?.toArray?.() as Promise<any[] | undefined>) ?? [],
        ]);

        if (cancelled) return;

        setPlacements(Array.isArray(placementsRaw) ? (placementsRaw as any) : []);
        setCourses(Array.isArray(coursesRaw) ? (coursesRaw as any) : []);
        setAchievements(Array.isArray(achievementsRaw) ? (achievementsRaw as any) : []);
      } catch (e) {
        console.error("Kunde inte läsa utbildningsaktiviteter för studierektorsmöte:", e);
        if (!cancelled) {
          setPlacements([]);
          setCourses([]);
          setAchievements([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);





  // Ladda profilinfo för rapportförhandsvisningar (samma logik som i PrepareBtModal)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const p = await db.profile.get("default");
        if (!cancelled) {
          setProfile(p ?? null);
        }
      } catch (e) {
        console.error("Kunde inte läsa profil för IUP-rapport:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialTab, initialMeetingId, initialAssessmentId]);



      // Bygg delmålsrapport: gruppera utbildningsaktiviteter per delmål
  useEffect(() => {
    if (!open || tab !== "rapport") return;

    let cancelled = false;

    (async () => {
      try {
        const anyDb = db as any;

        const [placementsRaw, coursesRaw, achievementsRaw] = await Promise.all([
          (anyDb.placements?.toArray?.() as Promise<any[] | undefined>) ?? [],
          (anyDb.courses?.toArray?.() as Promise<any[] | undefined>) ?? [],
          (anyDb.achievements?.toArray?.() as Promise<any[] | undefined>) ?? [],
        ]);

        if (cancelled) return;

        const norm = (v: any) =>
          String(v ?? "")
            .trim()
            .toUpperCase()
            .replace(/\s|_|-/g, "");

        // Läs in planer per delmål från IUP-delmålsplaner
        let planMap: Record<string, string> = {};
        try {
          const table =
            anyDb.iupMilestonePlans ??
            anyDb.milestonePlans ??
            (typeof anyDb.table === "function"
              ? anyDb.table("iupMilestonePlans")
              : null);

          if (table && typeof table.toArray === "function") {
            const planRows = await table.toArray();
            const map: Record<string, string> = {};

            for (const row of planRows as any[]) {
              const rawId =
                (row as any).milestoneId ??
                (row as any).id ??
                (row as any).code ??
                "";
              const text =
                (row as any).planText ??
                (row as any).text ??
                "";

              const baseText = String(text ?? "").trim();
              if (!rawId || !baseText) continue;

              const key = norm(rawId);
              if (!key) continue;

              // Basnyckel
              map[key] = baseText;

              // Alias STa1 <-> A1, STb3 <-> B3 osv, så att både A1 och STa1 träffar samma plan
              const m1 = key.match(/^ST([ABC])(\d+)$/);
              if (m1) {
                map[`${m1[1]}${m1[2]}`] = baseText;
              }
              const m2 = key.match(/^([ABC])(\d+)$/);
              if (m2) {
                map[`ST${m2[1]}${m2[2]}`] = baseText;
              }
            }

            planMap = map;
          } else {
            planMap = {};
          }
        } catch {
          planMap = {};
        }

        type AccMap = Record<string, { activities: string[] }>;
        const acc: AccMap = {};

        const addActivity = (code: string, label: string) => {
          const key = String(code ?? "").trim();
          if (!key) return;
          if (!acc[key]) acc[key] = { activities: [] };
          if (!acc[key].activities.includes(label)) {
            acc[key].activities.push(label);
          }
        };

        const fmtDate = (iso: any): string => {
          if (typeof iso !== "string") return "";
          const v = iso.slice(0, 10);
          return v || "";
        };

        const fmtPeriod = (start: any, end: any): string => {
          const s = fmtDate(start);
          const e = fmtDate(end);
          if (!s && !e) return "";
          if (s && e) {
            if (s === e) return s;
            return `${s} – ${e}`;
          }
          return s || e;
        };

        const placementsArr = Array.isArray(placementsRaw) ? placementsRaw : [];
        const coursesArr = Array.isArray(coursesRaw) ? coursesRaw : [];
        const achievementsArr = Array.isArray(achievementsRaw)
          ? achievementsRaw
          : [];

        const placementMap = new Map<string, any>();
        const courseMap = new Map<string, any>();

        placementsArr.forEach((pl: any) => {
          const id = String(pl.id ?? "");
          if (id) placementMap.set(id, pl);
        });

        coursesArr.forEach((c: any) => {
          const id = String(c.id ?? "");
          if (id) courseMap.set(id, c);
        });

        const placementsWithAch = new Set<string>();
        const coursesWithAch = new Set<string>();

        // 1) Aktiviteter via achievements (primär källa)
        achievementsArr.forEach((a: any) => {
          const rawCode =
            (a as any).milestoneId ??
            (a as any).goalId ??
            (a as any).code ??
            "";
          const code = String(rawCode ?? "").trim();
          if (!code) return;

          if (a.placementId) {
            const plId = String(a.placementId ?? "");
            const pl = placementMap.get(plId);
            if (!pl) return;

            const label = pl.title || pl.site || "Klinisk tjänstgöring";
            const period = fmtPeriod(pl.startDate, pl.endDate);
            const labelWithPeriod = period ? `${label} (${period})` : label;

            addActivity(code, labelWithPeriod);
            if (plId) placementsWithAch.add(plId);
          }

          if (a.courseId) {
            const cId = String(a.courseId ?? "");
            const c = courseMap.get(cId);
            if (!c) return;

            const label = c.title || c.courseName || "Kurs/utbildning";
            const period = fmtPeriod(c.startDate, c.endDate);
            const labelWithPeriod = period ? `${label} (${period})` : label;

            addActivity(code, labelWithPeriod);
            if (cId) coursesWithAch.add(cId);
          }
        });

        // 2) Fallback: direktläs från placeringar utan achievements
        placementsArr.forEach((pl: any) => {
          const plId = String(pl.id ?? "");
          if (plId && placementsWithAch.has(plId)) return;

          const label = pl.title || pl.site || "Klinisk tjänstgöring";
          const period = fmtPeriod(pl.startDate, pl.endDate);
          const labelWithPeriod = period ? `${label} (${period})` : label;

          const rawMilestones = Array.isArray(pl.milestones)
            ? pl.milestones
            : Array.isArray(pl.goalIds)
            ? pl.goalIds
            : [];

          rawMilestones.forEach((v: any) => {
            const code = typeof v === "string" ? v : String(v ?? "");
            addActivity(code, labelWithPeriod);
          });
        });

        // 3) Fallback: direktläs från kurser utan achievements
        coursesArr.forEach((c: any) => {
          const cId = String(c.id ?? "");
          if (cId && coursesWithAch.has(cId)) return;

          const label = c.title || c.courseName || "Kurs/utbildning";
          const period = fmtPeriod(c.startDate, c.endDate);
          const labelWithPeriod = period ? `${label} (${period})` : label;

          const rawMilestones = Array.isArray(c.milestones)
            ? c.milestones
            : Array.isArray(c.goalIds)
            ? c.goalIds
            : [];

          rawMilestones.forEach((v: any) => {
            const code = typeof v === "string" ? v : String(v ?? "");
            addActivity(code, labelWithPeriod);
          });
        });

        const rows: GoalReportRow[] = Object.entries(acc)
          .sort((a, b) => a[0].localeCompare(b[0], "sv"))
          .map(([milestoneCode, value]) => {
            const key = norm(milestoneCode);
            const methodsText = planMap[key] ?? "";
            return {
              milestoneCode,
              methodsText,
              activities: value.activities.sort((a, b) =>
                a.localeCompare(b, "sv")
              ),
            };
          });

        setGoalReportRows(rows);
      } catch (e) {
        console.error(
          "Kunde inte läsa utbildningsaktiviteter för delmålsrapport:",
          e
        );
        if (!cancelled) {
          setGoalReportRows([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, tab]);




  const handleSave = useCallback(async () => {
    await saveAllToDb(
      meetings,
      assessments,
      directorMeetings,
      specialistCollegiums,
      planning,
      planningExtra
    );
    setDirty(false);
  }, [
    saveAllToDb,
    meetings,
    assessments,
    directorMeetings,
    specialistCollegiums,
    planning,
    planningExtra,
  ]);

  const handleRequestClose = useCallback(() => {
    if (dirty) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  // Registrera modalen för global ESC-hantering
  // VIKTIGT: Registrera INTE huvudmodalen när en undermodal är öppen
  useEffect(() => {
    if (!open || !overlayRef.current) return;
    // Om en undermodal är öppen, registrera inte huvudmodalen
    if (
      editingMeetingId !== null ||
      editingAssessmentId !== null ||
      editingDirectorMeetingId !== null ||
      editingSpecialistCollegiumId !== null ||
      instrumentsModalOpen
    ) {
      return;
    }
    registerModal(overlayRef.current, handleRequestClose);
    return () => {
      if (overlayRef.current) {
        unregisterModal(overlayRef.current);
      }
    };
  }, [
    open,
    handleRequestClose,
    editingMeetingId,
    editingAssessmentId,
    editingDirectorMeetingId,
    editingSpecialistCollegiumId,
    instrumentsModalOpen,
  ]);

  const handleConfirmClose = useCallback(() => {
    setShowCloseConfirm(false);
    onClose();
  }, [onClose]);

  const handleSaveAndClose = useCallback(async () => {
    await handleSave();
    setShowCloseConfirm(false);
    onClose();
  }, [handleSave, onClose]);

  const handleCancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  // Cmd/Ctrl+Enter för att spara (ESC hanteras nu av global ESC-handler)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Om bekräftelsedialogen är öppen, låt den hantera ALLA keyboard events
      if (showCloseConfirm || showDeleteConfirm) {
        // UnsavedChangesDialog och DeleteConfirmDialog hanterar keyboard events och stoppar propagation
        return;
      }
      
      // Cmd/Ctrl+Enter för att spara
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void handleSave();
        return;
      }
      
      // ESC hanteras nu av global ESC-handler som hittar det översta fönstret
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true, passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [open, dirty, handleSave, showCloseConfirm, showDeleteConfirm]);




   const sortedMeetings = useMemo(
    () => [...meetings].sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    [meetings]
  );
  const sortedAssessments = useMemo(
    () =>
      [...assessments].sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    [assessments]
  );

  const sortedDirectorMeetings = useMemo(
    () => [...directorMeetings].sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
    [directorMeetings]
  );

  const planningReportEntries = useMemo(
    () => {
      const base: { id: string; title: string; content: string }[] = [
        {
          id: "overallGoals",
          title: "Övergripande mål med utbildningen",
          content: planning.overallGoals,
        },
        {
          id: "clinicalService",
          title: "Kliniska tjänstgöringar",
          content: planning.clinicalService,
        },
        {
          id: "courses",
          title: "Kurser",
          content: planning.courses,
        },
        {
          id: "supervisionMeetings",
          title: "Handledarsamtal (övergripande plan)",
          content: planning.supervisionMeetings,
        },
        {
          id: "theoreticalStudies",
          title: "Teoretiska studier",
          content: planning.theoreticalStudies,
        },
        {
          id: "researchWork",
          title: "Vetenskapligt arbete",
          content: planning.researchWork,
        },
        {
          id: "journalClub",
          title: "Journal club",
          content: planning.journalClub,
        },
        {
          id: "congresses",
          title: "Kongresser",
          content: planning.congresses,
        },
        {
          id: "qualityWork",
          title: "Kvalitetsarbete",
          content: planning.qualityWork,
        },
        {
          id: "patientSafety",
          title: "Patientsäkerhetsarbete",
          content: planning.patientSafety,
        },
        {
          id: "leadership",
          title: "Ledarskap",
          content: planning.leadership,
        },
        {
          id: "supervisingStudents",
          title: "Handledning av studenter/underläkare",
          content: planning.supervisingStudents,
        },
        {
          id: "teaching",
          title: "Undervisning",
          content: planning.teaching,
        },
        {
          id: "formativeAssessments",
          title: "Formativa bedömningar",
          content: planning.formativeAssessments,
        },
      ];

      const extra: { id: string; title: string; content: string }[] =
        planningExtra.map((sec) => ({
          id: sec.id,
          title: sec.title || "Övrig planeringspunkt",
          content: sec.content,
        }));

      return [...base, ...extra].filter(
        (row) => row.content && row.content.trim().length > 0
      );
    },
    [planning, planningExtra]
  );

  const addMeeting = () => {

    const id = `m_${Math.random().toString(36).slice(2, 10)}`;
    const todayIso = isoToday();
    const m: IupMeeting = {
      id,
      dateISO: todayIso,
      focus: "",
      summary: "",
      actions: "",
      nextDateISO: isoFourWeeksFrom(todayIso),
    };
    setMeetings((prev) => [...prev, m]);
    setDirty(true);
    setEditingMeetingId(id); // öppna popup direkt
  };


  const upsertMeeting = (value: IupMeeting) => {
    // Bygg nästa lista baserat på aktuell state
    const next = [...meetings];

    // Uppdatera eller lägg in det aktuella handledningstillfället
    const idx = next.findIndex((m) => m.id === value.id);
    if (idx === -1) {
      next.push(value);
    } else {
      next[idx] = value;
    }

    // Skapa ev. nytt "nästa handledningstillfälle" om:
    // - det finns ett datum för nextDateISO
    // - datumet ligger framåt i tiden
    // - det inte redan finns ett handledningstillfälle med det datumet
    const nextDate = value.nextDateISO;
    if (nextDate && isFutureDate(nextDate)) {
      const alreadyExists = next.some((m) => m.dateISO === nextDate);
      if (!alreadyExists) {
        next.push({
          id: `m_${Math.random().toString(36).slice(2, 10)}`,
          dateISO: nextDate,
          focus: "",
          summary: "",
          actions: "",
          nextDateISO: "",
        });
      }
    }

    setMeetings(next);
    setDirty(true);
  };





  const removeMeeting = (id: string) => {
    setDeleteConfirmConfig({
      message: "Vill du ta bort detta handledarsamtal?",
      onConfirm: () => {
        const next = meetings.filter((m) => m.id !== id);
        setMeetings(next);
        setDirty(true);
        if (editingMeetingId === id) {
          setEditingMeetingId(null);
        }
        setShowDeleteConfirm(false);
        setDeleteConfirmConfig(null);
      },
    });
    setShowDeleteConfirm(true);
  };

  const addSpecialistCollegium = () => {
    const id = `sc_${Math.random().toString(36).slice(2, 10)}`;
    const todayIso = isoToday();
    const m: IupSpecialistCollegium = {
      id,
      dateISO: todayIso,
      feedback: "",
      planningForward: "",
    };
    setSpecialistCollegiums((prev) => [...prev, m]);
    setDirty(true);
    setEditingSpecialistCollegiumId(id);
  };

  const upsertSpecialistCollegium = (value: IupSpecialistCollegium) => {
    const next = [...specialistCollegiums];
    const idx = next.findIndex((m) => m.id === value.id);
    if (idx === -1) next.push(value);
    else next[idx] = value;
    setSpecialistCollegiums(next);
    setDirty(true);
  };

  const removeSpecialistCollegium = (id: string) => {
    setDeleteConfirmConfig({
      message: "Vill du ta bort detta specialistkollegium?",
      onConfirm: () => {
        const next = specialistCollegiums.filter((m) => m.id !== id);
        setSpecialistCollegiums(next);
        setDirty(true);
        if (editingSpecialistCollegiumId === id) {
          setEditingSpecialistCollegiumId(null);
        }
        setShowDeleteConfirm(false);
        setDeleteConfirmConfig(null);
      },
    });
    setShowDeleteConfirm(true);
  };



  const addAssessment = () => {
    const id = `a_${Math.random().toString(36).slice(2, 10)}`;
    const todayISO = isoToday();
    const phase = determineAssessmentPhase(todayISO, profile);
    const a: IupAssessment = {
      id,
      dateISO: todayISO,
      phase,
      level: "",
      instrument: instruments[0] ?? "",
      summary: "",
      strengths: "",
      development: "",
    };
    setAssessments((prev) => [...prev, a]);
    setDirty(true);
    setEditingAssessmentId(id); // öppna popup direkt
  };


  const upsertAssessment = (value: IupAssessment) => {
    const next = [...assessments];
    const idx = next.findIndex((a) => a.id === value.id);
    if (idx === -1) {
      next.push(value);
    } else {
      next[idx] = value;
    }

    setAssessments(next);
    setDirty(true);
  };


  const removeAssessment = (id: string) => {
    setDeleteConfirmConfig({
      message: "Vill du ta bort denna progressionsbedömning?",
      onConfirm: () => {
        const next = assessments.filter((a) => a.id !== id);
        setAssessments(next);
        setDirty(true);
        if (editingAssessmentId === id) {
          setEditingAssessmentId(null);
        }
        setShowDeleteConfirm(false);
        setDeleteConfirmConfig(null);
      },
    });
    setShowDeleteConfirm(true);
  };



  const currentMeeting =
    editingMeetingId != null
      ? meetings.find((m) => m.id === editingMeetingId) || null
      : null;
  const currentAssessment =
    editingAssessmentId != null
      ? assessments.find((a) => a.id === editingAssessmentId) || null
      : null;

  const currentSpecialistCollegium =
    editingSpecialistCollegiumId != null
      ? specialistCollegiums.find((m) => m.id === editingSpecialistCollegiumId) || null
      : null;

  const addDirectorMeeting = () => {
    const id = `d_${Math.random().toString(36).slice(2, 10)}`;
    const todayIso = isoToday();
    const latestIso = [...directorMeetings]
      .map((m) => (m && typeof m.dateISO === "string" ? m.dateISO : ""))
      .filter((iso) => typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso))
      .sort((a, b) => a.localeCompare(b))
      .at(-1);

    const baseDate = latestIso ? parseISO(latestIso) : null;
    const defaultIso = baseDate ? toISO(addMonths(baseDate, 6)) : todayIso;
    const m: IupDirectorMeeting = {
      id,
      dateISO: defaultIso,
      focus: "",
    };
    setDirectorMeetings((prev) => [...prev, m]);
    setDirty(true);
    setEditingDirectorMeetingId(id);
  };

  const upsertDirectorMeeting = (value: IupDirectorMeeting) => {
    const next = [...directorMeetings];
    const idx = next.findIndex((m) => m.id === value.id);
    if (idx === -1) next.push(value);
    else next[idx] = value;
    setDirectorMeetings(next);
    setDirty(true);
  };

  const removeDirectorMeeting = (id: string) => {
    setDeleteConfirmConfig({
      message: "Vill du ta bort detta möte med studierektor?",
      onConfirm: () => {
        const next = directorMeetings.filter((m) => m.id !== id);
        setDirectorMeetings(next);
        setDirty(true);
        if (editingDirectorMeetingId === id) setEditingDirectorMeetingId(null);
        setShowDeleteConfirm(false);
        setDeleteConfirmConfig(null);
      },
    });
    setShowDeleteConfirm(true);
  };

  const currentDirectorMeeting =
    editingDirectorMeetingId != null
      ? directorMeetings.find((m) => m.id === editingDirectorMeetingId) || null
      : null;

  const updatePlanning = (patch: Partial<IupPlanning>) => {
    const next = { ...planning, ...patch };
    setPlanning(next);
    setDirty(true);
  };

  const addPlanningSection = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const id = `ps_${Math.random().toString(36).slice(2, 10)}`;
    const next = [...planningExtra, { id, title: trimmed, content: "" }];
    setPlanningExtra(next);
    setDirty(true);
  };

  const updatePlanningSectionContent = (id: string, content: string) => {
    setPlanningExtra((prev) =>
      prev.map((sec) => (sec.id === id ? { ...sec, content } : sec))
    );
    setDirty(true);
  };

  const removePlanningSection = (id: string) => {
    const next = planningExtra.filter((sec) => sec.id !== id);
    setPlanningExtra(next);
    setDirty(true);
  };

  const removeBasePlanningSection = (key: keyof IupPlanning) => {
    const nextHidden = Array.from(
      new Set<string>([...hiddenPlanningKeys, key as string])
    );
    setHiddenPlanningKeys(nextHidden);

    setPlanning((prev) => {
      const patch: Partial<IupPlanning> = { [key]: "" } as Partial<IupPlanning>;
      return { ...prev, ...patch };
    });

    setDirty(true);
  };


  if (!open) return null;


  return (
    <>
      <UnsavedChangesDialog
        open={showCloseConfirm}
        onCancel={handleCancelClose}
        onDiscard={handleConfirmClose}
        onSaveAndClose={handleSaveAndClose}
      />
      {/* Huvudmodal */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-3"
        onClick={(e) => {
          if (e.target === overlayRef.current) {
            handleRequestClose();
          }
        }}
      >
        <div
          className="w-full max-w-[980px] overflow-hidden rounded-2xl bg-white shadow-2xl"
          data-modal-panel
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="m-0 text-lg font-extrabold">
              Individuell utbildningsplan (IUP)
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!dirty}
                onClick={handleSave}
                className="inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 hover:border-sky-800 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
                title="Spara ändringar i IUP"
                data-info="Sparar alla ändringar i IUP till databasen. Knappen är endast aktiv när det finns osparade ändringar."
              >
                Spara
              </button>
              <button
                type="button"
                onClick={handleRequestClose}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
                title="Stäng – varnar om osparade ändringar"
                data-info="Stäng"
              >
                Stäng
              </button>
            </div>
          </header>

          {/* Tabs */}
          <nav className="flex gap-1 border-b bg-slate-50 px-2 pt-2">
            {[
              { id: "planering", label: "Planering", info: "Här kan du dokumentera din övergripande planering för ST-utbildningen. Du kan skapa anpassade planeringsrubriker och dokumentera mål, kliniska tjänstgöringar, kurser, handledning och andra utbildningsaktiviteter. Planeringen används för att strukturera din utbildning och kan inkluderas i rapporter." },
              { id: "handledning", label: "Handledning", info: "Här kan du registrera handledarsamtal (huvudhandledare) och möten med studierektor. Du kan välja om dessa ska visas på tidslinjen. I tidslinjen kan du klicka på gröna trianglar för att öppna handledningstillfällen." },
              { id: "progression", label: "Progression", info: "Här kan du registrera progressionsbedömningar. Progressionsbedömningar är strukturerade bedömningar av din utveckling med olika bedömningsinstrument. Du kan välja om dessa ska visas på tidslinjen. I tidslinjen kan du klicka på gula stjärnor för att öppna progressionsbedömningar." },
              { id: "delmal", label: "Delmål", info: "Här kan du se en översikt över alla delmål (ST-delmål och BT-delmål) och planera hur de ska uppfyllas. Du kan se vilka aktiviteter och kurser som är kopplade till varje delmål, planera framtida aktiviteter och spåra din framsteg mot att uppfylla alla delmål." },
              { id: "rapport", label: "Rapport", info: "Här kan du generera och förhandsgranska rapporter baserade på din IUP-data. Rapporterna kan inkludera planering, handledarsamtal, progressionsbedömningar, utbildningsmoment och delmål. Rapporterna kan användas för att dokumentera din utbildning och framsteg." },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setTab(
                    t.id as "handledning" | "progression" | "planering" | "delmal" | "rapport"
                  )
                }
                className={`rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:outline-none ${
                  tab === t.id
                    ? "bg-white text-slate-900 border-x border-t border-slate-200 -mb-px"
                    : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                }`}
                data-info={t.info}
              >
                {t.label}
              </button>
            ))}
          </nav>


          {/* Body */}
          <section className="max-h-[75vh] overflow-auto overscroll-contain touch-pan-y p-4">
            {tab === "handledning" && (
              <div className="grid gap-4 md:grid-cols-2" data-info="Här kan du registrera handledarsamtal och möten med studierektor. Klicka på ett befintligt tillfälle för att redigera det, eller skapa ett nytt. Du kan också välja om de ska visas på tidslinjen.">
                {/* Vänster: lista med handledarsamtal */}
                <div className="flex flex-col">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="m-0 text-sm font-semibold text-slate-800">
                      Handledarsamtal
                    </h3>
                    <button
                      type="button"
                      onClick={addMeeting}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                      data-info="Skapar ett nytt handledningstillfälle (handledarsamtal) som du kan registrera med datum, fokus, sammanfattning och överenskomna åtgärder."
                    >
                      + Skapa handledningstillfälle
                    </button>
                  </div>
                                <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-300"
                        checked={showMeetingsOnTimeline}
                        onChange={(e) => {
                          const value = e.target.checked;
                          setShowMeetingsOnTimeline(value);
                          setDirty(true);
                          if (onTimelineVisibilityChange) {
                            onTimelineVisibilityChange({
                              showMeetingsOnTimeline: value,
                            });
                          }
                        }}
                      />
                      <span className="inline-flex items-center gap-1">
                        <span>Visa på tidslinjen</span>
                        <span className="inline-flex items-center gap-[2px]">
                          <span>(</span>
                          <span
                            aria-hidden="true"
                            style={{
                              display: "inline-block",
                              width: 0,
                              height: 0,
                              borderLeft: "5px solid transparent",
                              borderRight: "5px solid transparent",
                              borderBottom: "8px solid #059669",
                            }}
                          />
                          <span>)</span>
                        </span>
                      </span>
                    </label>
                  </div>





                  <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white select-none">
                    {loading ? (
                      <div className="px-3 py-4 text-xs text-slate-500">
                        Läser in handledarsamtal…
                      </div>
                    ) : sortedMeetings.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-slate-500">
                        Inga handledarsamtal registrerade ännu.
                      </div>
                    ) : (
                      sortedMeetings.map((m) => {
                        const isEditing = m.id === editingMeetingId;
                        const planned = isFutureDate(m.dateISO);
                        return (
                          <div
                            key={m.id}
                            className={`cursor-default border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 last:border-b-0 ${
                              isEditing ? "bg-slate-100" : ""
                            }`}
                            onClick={() => setEditingMeetingId(m.id)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-semibold text-slate-900">
                                  {m.focus || "Handledarsamtal"}
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                  <span>{m.dateISO || "Datum saknas"}</span>
                                  {planned && (
                                    <span className="italic text-sky-700">
                                      Planerat
                                    </span>
                                  )}
                                </div>
                      
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeMeeting(m.id);
                                  }}
                                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 active:translate-y-px"
                                  data-info="Tar bort detta handledarsamtal permanent från databasen. Du kommer att få en bekräftelse innan borttagningen genomförs."
                                >
                                  Ta bort
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Höger: möten med studierektor */}
                <div className="flex flex-col">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="m-0 text-sm font-semibold text-slate-800">Möte med studierektor</h3>
                    <button
                      type="button"
                      onClick={addDirectorMeeting}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                    >
                      + Skapa mötestillfälle
                    </button>
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-300"
                        checked={showDirectorMeetingsOnTimeline}
                        onChange={(e) => {
                          const value = e.target.checked;
                          setShowDirectorMeetingsOnTimeline(value);
                          setDirty(true);
                          if (onTimelineVisibilityChange) {
                            onTimelineVisibilityChange({
                              showDirectorMeetingsOnTimeline: value,
                            });
                          }
                        }}
                      />
                      <span className="inline-flex items-center gap-1">
                        <span>Visa på tidslinjen</span>
                        <span className="inline-flex items-center gap-[2px]">
                          <span>(</span>
                          <span
                            aria-hidden="true"
                            style={{
                              display: "inline-block",
                              width: 0,
                              height: 0,
                              borderLeft: "5px solid transparent",
                              borderRight: "5px solid transparent",
                              borderBottom: "8px solid #ea580c",
                            }}
                          />
                          <span>)</span>
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white select-none">
                    {loading ? (
                      <div className="px-3 py-4 text-xs text-slate-500">Läser in studierektorsmöten…</div>
                    ) : sortedDirectorMeetings.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-slate-500">Inga studierektorsmöten registrerade ännu.</div>
                    ) : (
                      sortedDirectorMeetings.map((m) => {
                        const isEditing = m.id === editingDirectorMeetingId;
                        const planned = isFutureDate(m.dateISO);
                        return (
                          <div
                            key={m.id}
                            className={`cursor-default border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 last:border-b-0 ${
                              isEditing ? "bg-slate-100" : ""
                            }`}
                            onClick={() => setEditingDirectorMeetingId(m.id)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-semibold text-slate-900">{m.focus || "Studierektorsmöte"}</div>
                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                  <span>{m.dateISO || "Datum saknas"}</span>
                                  {planned && <span className="italic text-sky-700">Planerat</span>}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeDirectorMeeting(m.id);
                                  }}
                                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 active:translate-y-px"
                                >
                                  Ta bort
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "progression" && (
              <div className="grid gap-4 md:grid-cols-2" data-info="Här kan du registrera progressionsbedömningar och specialistkollegium.">
                {/* Vänster: progressionsbedömningar */}
                <div className="flex flex-col">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="m-0 text-sm font-semibold text-slate-800">Progressionsbedömningar</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInstrumentsModalOpen(true)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                      >
                        Instrument
                      </button>
                      <button
                        type="button"
                        onClick={addAssessment}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                      >
                        + Ny bedömning
                      </button>
                    </div>
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-300"
                        checked={showAssessmentsOnTimeline}
                        onChange={(e) => {
                          const value = e.target.checked;
                          setShowAssessmentsOnTimeline(value);
                          setDirty(true);
                          if (onTimelineVisibilityChange) {
                            onTimelineVisibilityChange({
                              showAssessmentsOnTimeline: value,
                            });
                          }
                        }}
                      />
                      <span className="inline-flex items-center gap-1">
                        <span>Visa på tidslinjen</span>
                        <span className="inline-flex items-center gap-[2px]">
                          <span>(</span>
                          <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" style={{ display: "block" }}>
                            <path
                              d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
                              fill="#f59e0b"
                              stroke="#d97706"
                              strokeWidth={1.3}
                              strokeLinejoin="round"
                            />
                          </svg>
                          <span>)</span>
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white select-none">
                    {loading ? (
                      <div className="px-3 py-4 text-xs text-slate-500">Läser in progressionsbedömningar…</div>
                    ) : sortedAssessments.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-slate-500">Inga progressionsbedömningar registrerade ännu.</div>
                    ) : (
                      sortedAssessments.map((a) => {
                        const isEditing = a.id === editingAssessmentId;
                        const planned = isFutureDate(a.dateISO);
                        return (
                          <div
                            key={a.id}
                            className={`cursor-default border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 last:border-b-0 ${
                              isEditing ? "bg-slate-100" : ""
                            }`}
                            onClick={() => setEditingAssessmentId(a.id)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {String(profile?.goalsVersion || "").trim() === "2021" && (
                                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                      {a.phase === "BT" ? "BT" : "ST"}
                                    </span>
                                  )}
                                  <span className="truncate font-semibold text-slate-900">{a.instrument || "Progressionsbedömning"}</span>
                                </div>

                                <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500">
                                  <span className="whitespace-nowrap">
                                    {a.dateISO || "Datum saknas"}
                                    {planned && <span className="ml-1 italic text-sky-700">Planerat</span>}
                                  </span>
                                  <span className="ml-2 truncate text-right">{a.level || "Klinisk tjänstgöring ej angiven"}</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeAssessment(a.id);
                                  }}
                                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 active:translate-y-px"
                                >
                                  Ta bort
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Höger: specialistkollegium */}
                <div className="flex flex-col">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="m-0 text-sm font-semibold text-slate-800">Specialistkollegium</h3>
                    <button
                      type="button"
                      onClick={addSpecialistCollegium}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                    >
                      + Nytt kollegium
                    </button>
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-300"
                        checked={showSpecialistCollegiumsOnTimeline}
                        onChange={(e) => {
                          const value = e.target.checked;
                          setShowSpecialistCollegiumsOnTimeline(value);
                          setDirty(true);
                          if (onTimelineVisibilityChange) {
                            onTimelineVisibilityChange({
                              showSpecialistCollegiumsOnTimeline: value,
                            });
                          }
                        }}
                      />
                      <span className="inline-flex items-center gap-1">
                        <span>Visa på tidslinjen</span>
                        <span className="text-slate-400">(</span>
                        <svg
                          aria-hidden="true"
                          width={12}
                          height={12}
                          viewBox="0 0 24 24"
                          style={{ display: "block" }}
                        >
                          <path
                            d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
                            fill="#38bdf8"
                            stroke="#0284c7"
                            strokeWidth={1.3}
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="text-slate-400">)</span>
                      </span>
                    </label>
                  </div>

                  <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
                    {loading ? (
                      <div className="px-3 py-4 text-xs text-slate-500">Läser in specialistkollegium…</div>
                    ) : specialistCollegiums.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-slate-500">Inga specialistkollegium registrerade ännu.</div>
                    ) : (
                      [...specialistCollegiums]
                        .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
                        .map((m) => {
                          const isEditing = m.id === editingSpecialistCollegiumId;
                          const planned = isFutureDate(m.dateISO);
                          return (
                            <div
                              key={m.id}
                              className={`cursor-default border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50 last:border-b-0 ${
                                isEditing ? "bg-slate-100" : ""
                              }`}
                              onClick={() => setEditingSpecialistCollegiumId(m.id)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-semibold text-slate-900">{m.dateISO || "Datum saknas"}</div>
                                  {planned ? (
                                    <div className="mt-0.5 text-[11px] italic text-sky-700">Planerat</div>
                                  ) : null}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeSpecialistCollegium(m.id);
                                    }}
                                    className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 active:translate-y-px"
                                  >
                                    Ta bort
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            )}

                                    {tab === "planering" && (
              <div className="space-y-4" data-info="Fyll i din planering för ST-utbildningen. Här kan du dokumentera övergripande mål, kliniska tjänstgöringar, kurser, handledning, teoretiska studier, vetenskapligt arbete och andra utbildningsaktiviteter. Du kan också lägga till egna rubriker.">

                {/* Övergripande mål */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800">
                    Övergripande mål med utbildningen
                  </label>
                  <textarea
                    rows={4}
                    value={planning.overallGoals}
                    onChange={(e) =>
                      updatePlanning({ overallGoals: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                  />
                </div>

                {/* Rubriker + knapp för att lägga till fler */}
                <div className="flex items-center justify-between">
                  <h3 className="m-0 text-sm font-semibold text-slate-800">
                    Övriga planeringsrubriker
                  </h3>
                  <button
                    type="button"
                    onClick={() => setNewSectionModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                    data-info="Öppnar en dialog där du kan lägga till en anpassad planeringsrubrik med egen titel och innehåll."
                  >
                    + Lägg till rubrik
                  </button>
                </div>

                {/* Alla övriga fält i två kolumner */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Fördefinierade kortare textfält */}
                  {(
                    [
                      ["clinicalService", "Kliniska tjänstgöringar"],
                      ["courses", "Kurser"],
                      ["supervisionMeetings", "Handledarsamtal"],
                      ["theoreticalStudies", "Teoretiska studier"],
                      ["researchWork", "Vetenskapligt arbete"],
                      ["journalClub", "Journal club"],
                      ["congresses", "Kongresser"],
                      ["qualityWork", "Kvalitetsarbete"],
                      ["patientSafety", "Patientsäkerhetsarbete"],
                      ["leadership", "Ledarskap"],
                      [
                        "supervisingStudents",
                        "Handledning av studenter/underläkare",
                      ],
                      ["teaching", "Undervisning"],
                      ["formativeAssessments", "Formativa bedömningar"],
                    ] as [keyof IupPlanning, string][]
                  )
                    .filter(([key]) => !hiddenPlanningKeys.includes(key as string))
                    .map(([key, label]) => (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="block text-sm font-semibold text-slate-800">
                            {label}
                          </label>
                          <button
                            type="button"
                            onClick={() => removeBasePlanningSection(key)}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 active:translate-y-px"
                          >
                            Ta bort
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={planning[key]}
                          onChange={(e) =>
                            updatePlanning({ [key]: e.target.value } as Partial<IupPlanning>)
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                        />
                      </div>
                    ))}


                  {/* Dynamiskt tillagda rubriker */}
                  {planningExtra.map((sec) => (
                    <div key={sec.id}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="block text-sm font-semibold text-slate-800">
                          {sec.title}
                        </label>
                        <button
                          type="button"
                          onClick={() => removePlanningSection(sec.id)}
                          className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 active:translate-y-px"
                          data-info="Tar bort denna anpassade planeringsrubrik permanent från databasen."
                        >
                          Ta bort
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={sec.content}
                        onChange={(e) =>
                          updatePlanningSectionContent(sec.id, e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}




            {tab === "delmal" && (
              <div className="max-w-[980px]">
                <MilestoneOverviewPanel
                  open={open}
                  onClose={handleRequestClose}
                  initialTab="st"
                  hideHeader
                  embedded
                  onDirtyChange={(dirty: boolean) => {
                    if (dirty) {
                      setDirty(true);
                    }
                  }}
                />
              </div>
            )}

            {tab === "rapport" && (
              <div className="max-w-[980px] space-y-4">
                {/* Lokalt fliksystem för rapporten */}
                <div className="flex gap-2 border-b pb-2">
                                    {[
                    { id: "plan_hand", label: "Planering och handledning", info: "Växlar till rapportfliken för planering och handledning där du kan se och förhandsgranska rapporter baserade på din IUP-planering och handledarsamtal. Rapporten inkluderar din övergripande planering, handledarsamtal och progressionsbedömningar." },
                    { id: "moment", label: "Utbildningsmoment", info: "Växlar till rapportfliken för utbildningsmoment där du kan se och förhandsgranska rapporter baserade på dina registrerade utbildningsaktiviteter. Rapporten visar alla kliniska tjänstgöringar, kurser och andra aktiviteter som är kopplade till din utbildning." },
                    { id: "delmal", label: "Delmål", info: "Växlar till rapportfliken för delmål där du kan se och förhandsgranska rapporter baserade på dina delmål och planerade aktiviteter. Rapporten visar vilka delmål som är uppfyllda, påbörjade eller planerade, samt vilka aktiviteter som är kopplade till varje delmål." },
                  ].map((rt) => (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() =>
                        setReportTab(
                          rt.id as "plan_hand" | "moment" | "delmal"
                        )
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        reportTab === rt.id
                          ? "bg-sky-600 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                      data-info={rt.info}
                    >
                      {rt.label}
                    </button>
                  ))}
                </div>

                {/* Planering och handledning – sammanslagen vy */}
                {reportTab === "plan_hand" && (
                  <div
                    data-info="Rapportfliken för planering och handledning visar rapporter baserade på din IUP-planering och handledarsamtal. Här kan du se din övergripande planering, handledarsamtal och progressionsbedömningar. Du kan välja vilka delar som ska inkluderas i rapporten genom att kryssa i rutorna för respektive sektion och kolumner."
                  >

                    <div className="mb-4 flex items-center justify-between gap-2">
                      <h3 className="m-0 text-sm font-semibold text-slate-800">
                        Planering och handledning
                      </h3>
                      <button
                        type="button"
                        onClick={() => setPlanHandPreviewOpen(true)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                        data-info="Förhandsgranska. Öppnar en förhandsvisning av rapporten för planering och handledning som visar din övergripande planering, handledarsamtal och progressionsbedömningar. Du kan skriva ut eller spara rapporten som PDF."
            >
                        Förhandsgranska
                      </button>
                    </div>

                    <div className="space-y-6">
                      {/* Övergripande planering */}
                      <div
                        data-info="Visar din övergripande planering för ST-utbildningen. Här kan du se alla planeringsrubriker som du har fyllt i under fliken 'Planering' i IUP. Du kan välja om planeringen ska inkluderas i rapporten genom att kryssa i rutan 'Visa i rapport'."
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h4 
                            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                            data-info="Visar din övergripande planering för ST-utbildningen. Här kan du se alla planeringsrubriker som du har fyllt i under fliken 'Planering' i IUP. Du kan välja om planeringen ska inkluderas i rapporten genom att kryssa i rutan 'Visa i rapport'."
                          >
                            Övergripande planering
                          </h4>
                          <label className="flex items-center gap-1 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-slate-300"
                              checked={showPlanOverview}
                              onChange={(e) =>
                                setShowPlanOverview(e.target.checked)
                              }
                              data-info="Kryssa i denna ruta för att inkludera övergripande planering i rapporten. När rutan är ikryssad kommer din planering att visas i rapporten för planering och handledning."
                            />
                            <span data-info="Kryssa i denna ruta för att inkludera övergripande planering i rapporten. När rutan är ikryssad kommer din planering att visas i rapporten för planering och handledning.">Visa i rapport</span>
                          </label>
                        </div>
                                               {showPlanOverview &&
                          (planningReportEntries.length === 0 ? (
                            <p className="text-xs text-slate-500">
                              Ingen planering registrerad ännu.
                            </p>
                          ) : (
                            (() => {
                              type Row = {
                                id: string;
                                title: string;
                                content: string;
                              };

                              // Balansera två kolumner efter ungefärlig textmängd
                              const cols: Row[][] = [[], []];
                              const sums = [0, 0];

                              planningReportEntries.forEach((row) => {
                                const weight =
                                  (row.title?.length || 0) +
                                  (row.content?.length || 0);
                                const colIndex =
                                  sums[0] <= sums[1] ? 0 : 1;
                                cols[colIndex].push(row);
                                sums[colIndex] += weight;
                              });

                              const nonEmptyCols = cols.filter(
                                (col) => col.length > 0
                              );

                              return (
                                <div className="grid gap-4 md:grid-cols-2">
                                  {nonEmptyCols.map((col, colIdx) => (
                                    <div
                                      key={colIdx}
                                      className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                                    >
                                      <table className="min-w-full border-collapse text-xs">
                                        <tbody>
                                          {col.map((row) => (
                                            <tr
                                              key={row.id}
                                              className="border-b border-slate-200 last:border-b-0"
                                            >
                                              <td className="w-56 border border-slate-200 bg-slate-50 px-3 py-2 align-top font-semibold text-slate-800">
                                                {row.title}
                                              </td>
                                              <td className="border border-slate-200 bg-white px-3 py-2 align-top whitespace-pre-line text-slate-800">
                                                {row.content || "—"}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()
                          ))}


                      </div>

                                            {/* Handledarsamtal */}
                      <div
                        data-info="Visar alla handledarsamtal som du har registrerat. Du kan välja vilka handledarsamtal som ska inkluderas i rapporten genom att kryssa i rutorna för 'Genomförda' och/eller 'Planerade'. Du kan också välja vilka kolumner som ska visas i rapporten (Fokus, Sammanfattning, Åtgärder / nästa steg)."
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h4 
                            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                            data-info="Visar alla handledarsamtal som du har registrerat. Du kan välja vilka handledarsamtal som ska inkluderas i rapporten genom att kryssa i rutorna för 'Genomförda' och/eller 'Planerade'. Du kan också välja vilka kolumner som ska visas i rapporten (Fokus, Sammanfattning, Åtgärder / nästa steg)."
                          >
                            Handledarsamtal
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span>Visa i rapport:</span>
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-slate-300"
                                checked={planMeetingsFilter.done}
                                onChange={(e) =>
                                  setPlanMeetingsFilter((prev) => ({
                                    ...prev,
                                    done: e.target.checked,
                                  }))
                                }
                                data-info="Kryssa i denna ruta för att inkludera genomförda handledarsamtal i rapporten. Genomförda handledarsamtal är samtal med ett datum som ligger i det förflutna."
                              />
                              <span data-info="Kryssa i denna ruta för att inkludera genomförda handledarsamtal i rapporten. Genomförda handledarsamtal är samtal med ett datum som ligger i det förflutna.">Genomförda</span>
                            </label>
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-slate-300"
                                checked={planMeetingsFilter.planned}
                                onChange={(e) =>
                                  setPlanMeetingsFilter((prev) => ({
                                    ...prev,
                                    planned: e.target.checked,
                                  }))
                                }
                                data-info="Kryssa i denna ruta för att inkludera planerade handledarsamtal i rapporten. Planerade handledarsamtal är samtal med ett datum i framtiden."
                              />
                              <span data-info="Kryssa i denna ruta för att inkludera planerade handledarsamtal i rapporten. Planerade handledarsamtal är samtal med ett datum i framtiden.">Planerade</span>
                            </label>
                          </div>
                        </div>
                        {showPlanMeetings &&
                          (() => {
                            const filteredMeetings = sortedMeetings.filter((m) => {
                              const isPlanned = isFutureDate(m.dateISO);
                              if (isPlanned && !planMeetingsFilter.planned) return false;
                              if (!isPlanned && !planMeetingsFilter.done) return false;
                              return true;
                            });

                            if (filteredMeetings.length === 0) {
                              return (
                                <p className="text-xs text-slate-500">
                                  Inga handledarsamtal att visa med nuvarande filter.
                                </p>
                              );
                            }

                            return (
                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="min-w-full border-collapse text-[11px]">
                                  <thead>
                                    <tr className="bg-slate-50">
                                      <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                        Datum
                                      </th>
                                      <th
                                        className={`border border-slate-200 px-3 py-2 text-left font-semibold ${
                                          showMeetingFocus ? "text-slate-700" : "text-slate-400"
                                        }`}
                                      >
                                        <label className="inline-flex items-center gap-1">
                                          <input
                                            type="checkbox"
                                            className="h-3 w-3 rounded border-slate-300"
                                            checked={showMeetingFocus}
                                            onChange={(e) =>
                                              setShowMeetingFocus(e.target.checked)
                                            }
                                            data-info="Kryssa i denna ruta för att inkludera kolumnen 'Fokus' i rapporten för handledarsamtal. Fokus-kolumnen visar rubriken eller huvudämnet för varje handledarsamtal."
                                          />
                                          <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Fokus' i rapporten för handledarsamtal. Fokus-kolumnen visar rubriken eller huvudämnet för varje handledarsamtal.">Fokus</span>
                                        </label>
                                      </th>
                                      <th
                                        className={`border border-slate-200 px-3 py-2 text-left font-semibold ${
                                          showMeetingSummary ? "text-slate-700" : "text-slate-400"
                                        }`}
                                      >
                                        <label className="inline-flex items-center gap-1">
                                          <input
                                            type="checkbox"
                                            className="h-3 w-3 rounded border-slate-300"
                                            checked={showMeetingSummary}
                                            onChange={(e) =>
                                              setShowMeetingSummary(e.target.checked)
                                            }
                                            data-info="Kryssa i denna ruta för att inkludera kolumnen 'Sammanfattning' i rapporten för handledarsamtal. Sammanfattning-kolumnen visar en sammanfattning av diskussionen under handledarsamtalet."
                                          />
                                          <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Sammanfattning' i rapporten för handledarsamtal. Sammanfattning-kolumnen visar en sammanfattning av diskussionen under handledarsamtalet.">Sammanfattning</span>
                                        </label>
                                      </th>
                                      <th
                                        className={`border border-slate-200 px-3 py-2 text-left font-semibold ${
                                          showMeetingActions ? "text-slate-700" : "text-slate-400"
                                        }`}
                                      >
                                        <label className="inline-flex items-center gap-1">
                                          <input
                                            type="checkbox"
                                            className="h-3 w-3 rounded border-slate-300"
                                            checked={showMeetingActions}
                                            onChange={(e) =>
                                              setShowMeetingActions(e.target.checked)
                                            }
                                            data-info="Kryssa i denna ruta för att inkludera kolumnen 'Åtgärder / nästa steg' i rapporten för handledarsamtal. Denna kolumn visar överenskomna åtgärder och nästa steg från handledarsamtalet."
                                          />
                                          <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Åtgärder / nästa steg' i rapporten för handledarsamtal. Denna kolumn visar överenskomna åtgärder och nästa steg från handledarsamtalet.">Åtgärder / nästa steg</span>
                                        </label>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredMeetings.map((m) => {
                                      const isPlanned = isFutureDate(m.dateISO);
                                      const isDone = !isPlanned;

                                      return (
                                        <tr
                                          key={m.id}
                                          className="align-top"
                                        >

                                          <td className="border border-slate-200 px-3 py-2 whitespace-nowrap text-[11px] text-slate-800">
                                            {m.dateISO || "—"}
                                          </td>
                                          <td
                                            className={`border border-slate-200 px-3 py-2 align-top text-[11px] font-semibold ${
                                              showMeetingFocus ? "text-slate-800" : "text-slate-400"
                                            }`}
                                          >
                                            {m.focus || "—"}
                                          </td>
                                          <td
                                            className={`border border-slate-200 px-3 py-2 align-top whitespace-pre-line text-[11px] ${
                                              showMeetingSummary
                                                ? "text-slate-800"
                                                : "text-slate-400"
                                            }`}
                                          >
                                            {m.summary || "—"}
                                          </td>
                                          <td
                                            className={`border border-slate-200 px-3 py-2 align-top whitespace-pre-line text-[11px] ${
                                              showMeetingActions
                                                ? "text-slate-800"
                                                : "text-slate-400"
                                            }`}
                                          >
                                            {m.actions || "—"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}
                      </div>



                                            {/* Progressionsbedömningar */}
                      <div
                        data-info="Visar alla progressionsbedömningar som du har registrerat. Du kan välja vilka progressionsbedömningar som ska inkluderas i rapporten genom att kryssa i rutorna för 'Genomförda' och/eller 'Planerade'. Du kan också välja vilka kolumner som ska visas i rapporten (Fas, Klinisk tjänstgöring, Instrument, Sammanfattning)."
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h4 
                            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                            data-info="Visar alla progressionsbedömningar som du har registrerat. Du kan välja vilka progressionsbedömningar som ska inkluderas i rapporten genom att kryssa i rutorna för 'Genomförda' och/eller 'Planerade'. Du kan också välja vilka kolumner som ska visas i rapporten (Fas, Klinisk tjänstgöring, Instrument, Sammanfattning)."
                          >
                            Progressionsbedömningar
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span>Visa i rapport:</span>
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-slate-300"
                                checked={planAssessmentsFilter.done}
                                onChange={(e) =>
                                  setPlanAssessmentsFilter((prev) => ({
                                    ...prev,
                                    done: e.target.checked,
                                  }))
                                }
                                data-info="Kryssa i denna ruta för att inkludera genomförda progressionsbedömningar i rapporten. Genomförda progressionsbedömningar är bedömningar med ett datum som ligger i det förflutna."
                              />
                              <span data-info="Kryssa i denna ruta för att inkludera genomförda progressionsbedömningar i rapporten. Genomförda progressionsbedömningar är bedömningar med ett datum som ligger i det förflutna.">Genomförda</span>
                            </label>
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-slate-300"
                                checked={planAssessmentsFilter.planned}
                                onChange={(e) =>
                                  setPlanAssessmentsFilter((prev) => ({
                                    ...prev,
                                    planned: e.target.checked,
                                  }))
                                }
                                data-info="Kryssa i denna ruta för att inkludera planerade progressionsbedömningar i rapporten. Planerade progressionsbedömningar är bedömningar med ett datum i framtiden."
                              />
                              <span data-info="Kryssa i denna ruta för att inkludera planerade progressionsbedömningar i rapporten. Planerade progressionsbedömningar är bedömningar med ett datum i framtiden.">Planerade</span>
                            </label>
                          </div>
                        </div>
                        {showPlanAssessments &&
                          (() => {
                            const filteredAssessments = sortedAssessments.filter((a) => {
                              const isPlanned = isFutureDate(a.dateISO);
                              if (isPlanned && !planAssessmentsFilter.planned) return false;
                              if (!isPlanned && !planAssessmentsFilter.done) return false;
                              return true;
                            });

                            if (filteredAssessments.length === 0) {
                              return (
                                <p className="text-xs text-slate-500">
                                  Inga progressionsbedömningar att visa med nuvarande filter.
                                </p>
                              );
                            }

                            return (
                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="min-w-full border-collapse text-[11px]">
                                  <thead>
                                    <tr className="bg-slate-50">
                                      <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                        Datum
                                      </th>
                                      {isGoals2021 && (
                                        <th
                                          className={`border border-slate-200 px-3 py-2 text-left font-semibold ${
                                            showAssessPhase ? "text-slate-700" : "text-slate-400"
                                          }`}
                                        >
                                          <label className="inline-flex items-center gap-1">
                                            <input
                                              type="checkbox"
                                              className="h-3 w-3 rounded border-slate-300"
                                              checked={showAssessPhase}
                                              onChange={(e) =>
                                                setShowAssessPhase(e.target.checked)
                                              }
                                              data-info="Kryssa i denna ruta för att inkludera kolumnen 'Fas' i rapporten för progressionsbedömningar. Fas-kolumnen visar om bedömningen är kopplad till BT (bastjänstgöring) eller ST (specialiseringstjänstgöring)."
                                            />
                                            <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Fas' i rapporten för progressionsbedömningar. Fas-kolumnen visar om bedömningen är kopplad till BT (bastjänstgöring) eller ST (specialiseringstjänstgöring).">Fas</span>
                                          </label>
                                        </th>
                                      )}

                                      <th
                                        className={`border border-slate-200 px-3 py-2 text-left font-semibold ${
                                          showAssessLevel ? "text-slate-700" : "text-slate-400"
                                        }`}
                                      >
                                        <label className="inline-flex items-center gap-1">
                                          <input
                                            type="checkbox"
                                            className="h-3 w-3 rounded border-slate-300"
                                            checked={showAssessLevel}
                                            onChange={(e) =>
                                              setShowAssessLevel(e.target.checked)
                                            }
                                            data-info="Kryssa i denna ruta för att inkludera kolumnen 'Klinisk tjänstgöring' i rapporten för progressionsbedömningar. Denna kolumn visar vilken klinisk tjänstgöring som bedömningen är kopplad till."
                                          />
                                          <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Klinisk tjänstgöring' i rapporten för progressionsbedömningar. Denna kolumn visar vilken klinisk tjänstgöring som bedömningen är kopplad till.">Klinisk tjänstgöring</span>
                                        </label>
                                      </th>
                                      <th
                                        className={`border border-slate-200 px-3 py-2 text-left font-semibold ${
                                          showAssessInstrument ? "text-slate-700" : "text-slate-400"
                                        }`}
                                      >
                                        <label className="inline-flex items-center gap-1">
                                          <input
                                            type="checkbox"
                                            className="h-3 w-3 rounded border-slate-300"
                                            checked={showAssessInstrument}
                                            onChange={(e) =>
                                              setShowAssessInstrument(e.target.checked)
                                            }
                                            data-info="Kryssa i denna ruta för att inkludera kolumnen 'Instrument' i rapporten för progressionsbedömningar. Instrument-kolumnen visar vilket bedömningsinstrument som användes vid bedömningen."
                                          />
                                          <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Instrument' i rapporten för progressionsbedömningar. Instrument-kolumnen visar vilket bedömningsinstrument som användes vid bedömningen.">Instrument</span>
                                        </label>
                                      </th>
                                      <th
                                        className={`border border-slate-200 px-3 py-2 text-left font-semibold ${
                                          showAssessSummary ? "text-slate-700" : "text-slate-400"
                                        }`}
                                      >
                                        <label className="inline-flex items-center gap-1">
                                          <input
                                            type="checkbox"
                                            className="h-3 w-3 rounded border-slate-300"
                                            checked={showAssessSummary}
                                            onChange={(e) =>
                                              setShowAssessSummary(e.target.checked)
                                            }
                                            data-info="Kryssa i denna ruta för att inkludera kolumnen 'Sammanfattning' i rapporten för progressionsbedömningar. Sammanfattning-kolumnen visar en sammanfattning av bedömningen och resultaten."
                                          />
                                          <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Sammanfattning' i rapporten för progressionsbedömningar. Sammanfattning-kolumnen visar en sammanfattning av bedömningen och resultaten.">Sammanfattning</span>
                                        </label>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredAssessments.map((a) => {
                                      const isPlanned = isFutureDate(a.dateISO);
                                      const isDone = !isPlanned;

                                      return (
                                        <tr
                                          key={a.id}
                                          className="align-top"
                                        >

                                          <td className="border border-slate-200 px-3 py-2 whitespace-nowrap text-[11px] text-slate-800">
                                            {a.dateISO || "—"}
                                          </td>
                                          {isGoals2021 && (
                                            <td
                                              className={`border border-slate-200 px-3 py-2 align-top text-[11px] ${
                                                showAssessPhase ? "text-slate-800" : "text-slate-400"
                                              }`}
                                            >
                                              {a.phase || "—"}
                                            </td>
                                          )}

                                          <td
                                            className={`border border-slate-200 px-3 py-2 align-top text-[11px] ${
                                              showAssessLevel ? "text-slate-800" : "text-slate-400"
                                            }`}
                                          >
                                            {a.level || "—"}
                                          </td>
                                          <td
                                            className={`border border-slate-200 px-3 py-2 align-top text-[11px] ${
                                              showAssessInstrument
                                                ? "text-slate-800"
                                                : "text-slate-400"
                                            }`}
                                          >
                                            {a.instrument || "—"}
                                          </td>
                                          <td
                                            className={`border border-slate-200 px-3 py-2 align-top whitespace-pre-line text-[11px] ${
                                              showAssessSummary
                                                ? "text-slate-800"
                                                : "text-slate-400"
                                            }`}
                                          >
                                            {a.summary || "—"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}
                      </div>


                    </div>
                  </div>
                )}


                {/* Utbildningsmoment – befintlig rapportpanel + statusfilter ovanför */}
                {reportTab === "moment" && (
                  <div 
                    className="space-y-3"
                    data-info="Rapportfliken för utbildningsmoment visar rapporter baserade på dina registrerade utbildningsaktiviteter. Här kan du se alla kliniska tjänstgöringar, kurser och andra aktiviteter som är kopplade till din utbildning. Du kan välja vilka aktiviteter som ska visas baserat på status (genomförda, pågående, planerade) och vilka kolumner som ska inkluderas (handledare, delmål, beskrivning)."
                  >
                    

                    {/* Själva rapportlistan för utbildningsmoment */}
                    <ReportPanel />
                  </div>
                )}


                                {/* Delmål – rapport med tabell */}
                {reportTab === "delmal" && (
                  <div 
                    className="space-y-3"
                    data-info="Rapportfliken för delmål visar rapporter baserade på dina delmål och planerade aktiviteter. Här kan du se vilka delmål som är uppfyllda, påbörjade eller planerade, samt vilka aktiviteter som är kopplade till varje delmål. Du kan välja vilka kolumner som ska inkluderas i rapporten (metoder och bedömningsinstrument, aktiviteter som uppfyller delmål)."
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="m-0 text-sm font-semibold text-slate-900">
                        Delmål och utbildningsaktiviteter
                      </h3>
                      <button
                        type="button"
                        onClick={() => setGoalPreviewOpen(true)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                        data-info="Förhandsgranska. Öppnar en förhandsvisning av rapporten för delmål och utbildningsaktiviteter som visar vilka delmål som är uppfyllda, påbörjade eller planerade, samt vilka aktiviteter och kurser som är kopplade till varje delmål. Du kan skriva ut eller spara rapporten som PDF."
                      >
                        Förhandsgranska
                      </button>
                    </div>

                    {goalReportRows.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Inga delmål har ännu kopplats till utbildningsaktiviteter.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <table className="min-w-full border-collapse text-[11px]">
                            <thead>
                              <tr className="bg-slate-50">
                                <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                  Delmål
                                </th>
                                <th
                                  className={`border border-slate-200 px-3 py-2 text-left font-semibold ${
                                    showGoalMethods ? "text-slate-700" : "text-slate-400"
                                  }`}
                                >
                                  <label className="inline-flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      className="h-3 w-3 rounded border-slate-300"
                                      checked={showGoalMethods}
                                      onChange={(e) =>
                                        setShowGoalMethods(e.target.checked)
                                      }
                                      data-info="Kryssa i denna ruta för att inkludera kolumnen 'Metoder och bedömningsinstrument' i rapporten för delmål. Denna kolumn visar vilka metoder och bedömningsinstrument som planeras eller används för att uppfylla varje delmål."
                                    />
                                    <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Metoder och bedömningsinstrument' i rapporten för delmål. Denna kolumn visar vilka metoder och bedömningsinstrument som planeras eller används för att uppfylla varje delmål.">Metoder och bedömningsinstrument</span>
                                  </label>
                                </th>
                                <th
                                  className={`border border-slate-200 px-3 py-2 text-left font-semibold ${
                                    showGoalActivities ? "text-slate-700" : "text-slate-400"
                                  }`}
                                >
                                  <label className="inline-flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      className="h-3 w-3 rounded border-slate-300"
                                      checked={showGoalActivities}
                                      onChange={(e) =>
                                        setShowGoalActivities(e.target.checked)
                                      }
                                      data-info="Kryssa i denna ruta för att inkludera kolumnen 'Aktiviteter som uppfyller delmål' i rapporten för delmål. Denna kolumn visar vilka aktiviteter (kliniska tjänstgöringar, kurser eller andra utbildningsmoment) som är kopplade till varje delmål och som hjälper till att uppfylla det."
                                    />
                                    <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Aktiviteter som uppfyller delmål' i rapporten för delmål. Denna kolumn visar vilka aktiviteter (kliniska tjänstgöringar, kurser eller andra utbildningsmoment) som är kopplade till varje delmål och som hjälper till att uppfylla det.">Aktiviteter som uppfyller delmål</span>
                                  </label>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {goalReportRows.map((row) => {
                                const code = shortMilestoneCode(row.milestoneCode);
                                const displayCode = isGoals2021
                                  ? (code
                                      ? displayMilestoneCode(code, (profile as any)?.goalsVersion)
                                      : "—")
                                  : (code ? code.toLowerCase() : "—");
                                return (
                                <tr key={row.milestoneCode} className="align-top">
                                  <td className="border border-slate-200 px-3 py-2 align-top whitespace-nowrap text-[11px] text-slate-800">
                                    {displayCode}
                                  </td>
                                                                    <td
                                    className={`border border-slate-200 px-3 py-2 align-top whitespace-pre-line text-[11px] ${
                                      showGoalMethods ? "text-slate-800" : "text-slate-400"
                                    }`}
                                  >
    {row.methodsText || "—"}
                                  </td>

                                  <td
                                    className={`border border-slate-200 px-3 py-2 align-top whitespace-pre-line text-[11px] ${
                                      showGoalActivities ? "text-slate-800" : "text-slate-400"
                                    }`}
                                  >
                                    {row.activities.join("\n")}
                                  </td>
                                </tr>
                              );
                              })}
                            </tbody>

                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                )}



              </div>
            )}

          </section>
        </div>
      </div>

                       {/* Förhandsvisning – Planering och handledning */}
      {planHandPreviewOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="flex max-h-[95vh] w-full max-w-5xl flex-col rounded-2xl bg-slate-50 shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Förhandsgranska – IUP: planering och handledning
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      typeof window === "undefined" ||
                      typeof document === "undefined"
                    ) {
                      return;
                    }
                    const root = planHandPreviewContentRef.current;
                    if (!root) return;

                    const body = document.body;

                    // Spara ursprunglig placering
                    const originalParent = root.parentElement;
                    const originalNextSibling = root.nextSibling;

                    // Flytta rapportinnehållet direkt under <body> inför utskrift
                    body.appendChild(root);
                    body.classList.add("print-report-preview");

                    const cleanup = () => {
                      // Flytta tillbaka rapporten till ursprunglig plats
                      if (originalParent) {
                        if (originalNextSibling) {
                          originalParent.insertBefore(root, originalNextSibling);
                        } else {
                          originalParent.appendChild(root);
                        }
                      }

                      body.classList.remove("print-report-preview");
                      window.removeEventListener("afterprint", cleanup);
                    };

                    window.addEventListener("afterprint", cleanup);

                    window.print();
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                >
                  Skriv ut rapport
                </button>

                <button
                  type="button"
                  onClick={() => setPlanHandPreviewOpen(false)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                >
                  Stäng
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-4 py-4">
              <div className="flex justify-center">
                <div
                  ref={planHandPreviewContentRef}
                  id="report-preview-print-root"
                  className="w-full max-w-4xl rounded-xl bg-white px-8 py-8 shadow-sm"
                >
                  {/* Header med ST-info – samma stil som Utbildningsmoment */}
                  <header className="mb-6 border-b border-slate-200 pb-4">
                    <h1 className="text-xl font-bold text-slate-900">
                      IUP – Planering och handledning
                    </h1>
                    <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-800 sm:grid-cols-2">
                      <div>
                        <div>
                          <span className="font-semibold">Namn: </span>
                          {(profile as any)?.name || "—"}
                        </div>
                        <div>
                          <span className="font-semibold">
                            Huvudhandledare:{" "}
                          </span>
                          {(profile as any)?.supervisor ||
                            (profile as any)?.mainSupervisor ||
                            "—"}
                        </div>
                      </div>
                      <div>
                        <div>
                          <span className="font-semibold">Specialitet: </span>
                          {(profile as any)?.specialty ||
                            (profile as any)?.speciality ||
                            "—"}
                        </div>
                        <div>
                          <span className="font-semibold">Målversion: </span>
                          {String((profile as any)?.goalsVersion ?? "") || "—"}
                        </div>
                      </div>
                    </div>
                  </header>


                  {/* Övergripande planering */}
                  {showPlanOverview && (
                    <section className="mb-6">
                      <h2 className="mb-2 text-sm font-semibold text-slate-900">
                        Övergripande planering
                      </h2>
                                            {planningReportEntries.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          Ingen planering registrerad ännu.
                        </p>
                      ) : (
                        (() => {
                          type Row = {
                            id: string;
                            title: string;
                            content: string;
                          };

                          const cols: Row[][] = [[], []];
                          const sums = [0, 0];

                          planningReportEntries.forEach((row) => {
                            const weight =
                              (row.title?.length || 0) +
                              (row.content?.length || 0);
                            const colIndex =
                              sums[0] <= sums[1] ? 0 : 1;
                            cols[colIndex].push(row);
                            sums[colIndex] += weight;
                          });

                          const nonEmptyCols = cols.filter(
                            (col) => col.length > 0
                          );

                          return (
                            <div className="grid gap-4 md:grid-cols-2">
                              {nonEmptyCols.map((col, colIdx) => (
                                <div
                                  key={colIdx}
                                  className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                                >
                                  <table className="min-w-full border-collapse text-xs">
                                    <tbody>
                                      {col.map((row) => (
                                        <tr
                                          key={row.id}
                                          className="border-b border-slate-200 last:border-b-0"
                                        >
                                          <td className="w-56 border border-slate-200 bg-slate-50 px-3 py-2 align-top font-semibold text-slate-800">
                                            {row.title}
                                          </td>
                                          <td className="border border-slate-200 bg-white px-3 py-2 align-top whitespace-pre-line text-slate-800">
                                            {row.content || "—"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          );
                        })()
                      )}

                    </section>
                  )}


                                    {/* Handledarsamtal */}
                  {showPlanMeetings &&
                    (planMeetingsFilter.done || planMeetingsFilter.planned) && (
                      <section className="mb-6">

                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-slate-900">
                          Handledarsamtal
                        </h2>
                      </div>

                      {(() => {
                        const filteredMeetings = sortedMeetings.filter((m) => {
                          const isPlanned = isFutureDate(m.dateISO || undefined);
                          const isDone = !isPlanned;

                          if (isDone && !planMeetingsFilter.done) return false;
                          if (isPlanned && !planMeetingsFilter.planned) return false;
                          return true;
                        });

                        if (filteredMeetings.length === 0) {
                          return (
                            <p className="text-xs text-slate-500">
                              Inga handledarsamtal att visa med nuvarande filter.
                            </p>
                          );
                        }

                        return (
                          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                            <table className="min-w-full border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-slate-50">
                                  <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                    Datum
                                  </th>
                                  {showMeetingFocus && (
                                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                      Fokus
                                    </th>
                                  )}
                                  {showMeetingSummary && (
                                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                      Sammanfattning
                                    </th>
                                  )}
                                  {showMeetingActions && (
                                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                      Åtgärder / nästa steg
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredMeetings.map((m) => (
                                  <tr key={m.id} className="align-top">
                                    <td className="border border-slate-200 px-3 py-2 whitespace-nowrap text-[11px] text-slate-800">
                                      {m.dateISO || "—"}
                                    </td>
                                    {showMeetingFocus && (
                                      <td className="border border-slate-200 px-3 py-2 align-top text-[11px] font-semibold text-slate-800">
                                        {m.focus || "—"}
                                      </td>
                                    )}
                                    {showMeetingSummary && (
                                      <td className="border border-slate-200 px-3 py-2 align-top whitespace-pre-line text-[11px] text-slate-800">
                                        {m.summary || "—"}
                                      </td>
                                    )}
                                    {showMeetingActions && (
                                      <td className="border border-slate-200 px-3 py-2 align-top whitespace-pre-line text-[11px] text-slate-800">
                                        {m.actions || "—"}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </section>
                  )}



                                                      {/* Progressionsbedömningar */}
                  {showPlanAssessments &&
                    (planAssessmentsFilter.done || planAssessmentsFilter.planned) && (
                      <section className="mb-6">

                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-slate-900">
                          Progressionsbedömningar
                        </h2>
                      </div>

                      {(() => {
                        const filteredAssessments = sortedAssessments.filter((a) => {
                          const isPlanned = isFutureDate(a.dateISO || undefined);
                          const isDone = !isPlanned;

                          if (isDone && !planAssessmentsFilter.done) return false;
                          if (isPlanned && !planAssessmentsFilter.planned) return false;
                          return true;
                        });

                        if (filteredAssessments.length === 0) {
                          return (
                            <p className="text-xs text-slate-500">
                              Inga progressionsbedömningar att visa med nuvarande filter.
                            </p>
                          );
                        }

                        return (
                          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                            <table className="min-w-full border-collapse text-[11px]">
                              <thead>
                                <tr className="bg-slate-50">
                                  <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                    Datum
                                  </th>
                                  {isGoals2021 && showAssessPhase && (
                                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                      Fas
                                    </th>
                                  )}

                                  {showAssessLevel && (
                                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                      Klinisk tjänstgöring
                                    </th>
                                  )}
                                  {showAssessInstrument && (
                                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                      Instrument
                                    </th>
                                  )}
                                  {showAssessSummary && (
                                    <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                      Sammanfattning
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredAssessments.map((a) => (
                                  <tr key={a.id} className="align-top">
                                    <td className="border border-slate-200 px-3 py-2 whitespace-nowrap text-[11px] text-slate-800">
                                      {a.dateISO || "—"}
                                    </td>
                                    {isGoals2021 && showAssessPhase && (
                                      <td className="border border-slate-200 px-3 py-2 align-top text-[11px] text-slate-800">
                                        {a.phase || "—"}
                                      </td>
                                    )}

                                    {showAssessLevel && (
                                      <td className="border border-slate-200 px-3 py-2 align-top text-[11px] text-slate-800">
                                        {a.level || "—"}
                                      </td>
                                    )}
                                    {showAssessInstrument && (
                                      <td className="border border-slate-200 px-3 py-2 align-top text-[11px] text-slate-800">
                                        {a.instrument || "—"}
                                      </td>
                                    )}
                                    {showAssessSummary && (
                                      <td className="border border-slate-200 px-3 py-2 align-top whitespace-pre-line text-[11px] text-slate-800">
                                        {a.summary || "—"}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </section>
                  )}


                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Förhandsvisning – Delmål */}
      {goalPreviewOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="flex max-h-[95vh] w-full max-w-5xl flex-col rounded-2xl bg-slate-50 shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Förhandsgranska – IUP: delmål och utbildningsaktiviteter
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      typeof window === "undefined" ||
                      typeof document === "undefined"
                    ) {
                      return;
                    }
                    const root = goalPreviewContentRef.current;
                    if (!root) return;

                    const body = document.body;

                    // Spara ursprunglig placering
                    const originalParent = root.parentElement;
                    const originalNextSibling = root.nextSibling;

                    // Flytta rapportinnehållet direkt under <body> inför utskrift
                    body.appendChild(root);
                    body.classList.add("print-report-preview");

                    const cleanup = () => {
                      // Flytta tillbaka rapporten till ursprunglig plats
                      if (originalParent) {
                        if (originalNextSibling) {
                          originalParent.insertBefore(root, originalNextSibling);
                        } else {
                          originalParent.appendChild(root);
                        }
                      }

                      body.classList.remove("print-report-preview");
                      window.removeEventListener("afterprint", cleanup);
                    };

                    window.addEventListener("afterprint", cleanup);

                    window.print();
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                >
                  Skriv ut rapport
                </button>

                <button
                  type="button"
                  onClick={() => setGoalPreviewOpen(false)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                >
                  Stäng
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-4 py-4">
              <div className="flex justify-center">
                <div
                  ref={goalPreviewContentRef}
                  id="report-preview-print-root"
                  className="w-full max-w-4xl rounded-xl bg-white px-8 py-8 shadow-sm"
                >
                  {/* Header med ST-info – samma stil som Utbildningsmoment */}
                  <header className="mb-6 border-b border-slate-200 pb-4">
                    <h1 className="text-xl font-bold text-slate-900">
                      IUP – Delmål och utbildningsaktiviteter
                    </h1>
                    <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-800 sm:grid-cols-2">
                      <div>
                        <div>
                          <span className="font-semibold">Namn: </span>
                          {(profile as any)?.name || "—"}
                        </div>
                        <div>
                          <span className="font-semibold">
                            Huvudhandledare:{" "}
                          </span>
                          {(profile as any)?.supervisor ||
                            (profile as any)?.mainSupervisor ||
                            "—"}
                        </div>
                      </div>
                      <div>
                        <div>
                          <span className="font-semibold">Specialitet: </span>
                          {(profile as any)?.specialty ||
                            (profile as any)?.speciality ||
                            "—"}
                        </div>
                        <div>
                          <span className="font-semibold">Målversion: </span>
                          {String((profile as any)?.goalsVersion ?? "") || "—"}
                        </div>
                      </div>
                    </div>
                  </header>


                                   {/* Delmål och aktiviteter */}
                  {goalReportRows.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Inga delmål har ännu kopplats till utbildningsaktiviteter.
                    </p>
                  ) : (
                    <section>
                      <h2 className="mb-2 text-sm font-semibold text-slate-900">
                        Delmål och utbildningsaktiviteter
                      </h2>
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <table className="min-w-full border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                Delmål
                              </th>
                              {showGoalMethods && (
                                <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                  Metoder och bedömningsinstrument
                                </th>
                              )}
                              {showGoalActivities && (
                                <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                                  Aktiviteter som uppfyller delmål
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {goalReportRows.map((row) => {
                              const code = shortMilestoneCode(row.milestoneCode);
                              const displayCode = isGoals2021
                                ? (code
                                    ? displayMilestoneCode(code, (profile as any)?.goalsVersion)
                                    : "—")
                                : (code ? code.toLowerCase() : "—");
                              return (
                              <tr key={row.milestoneCode} className="align-top">
                                <td className="border border-slate-200 px-3 py-2 align-top whitespace-nowrap text-[11px] text-slate-800">
                                  {displayCode}
                                </td>
                                {showGoalMethods && (
                                  <td className="border border-slate-200 px-3 py-2 align-top text-[11px] text-slate-800">
                                    {row.methodsText || "—"}
                                  </td>
                                )}
                                {showGoalActivities && (
                                  <td className="border border-slate-200 px-3 py-2 align-top whitespace-pre-line text-[11px] text-slate-800">
                                    {row.activities.join("\n")}
                                  </td>
                                )}
                              </tr>
                            );
                            })}
                          </tbody>

                        </table>
                      </div>
                    </section>
                  )}

                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Under-modaler */}
      <MeetingModal
        open={!!editingMeetingId && !!currentMeeting}
        meeting={currentMeeting}
        onSave={(value) => {
          upsertMeeting(value);
        }}
        onClose={() => setEditingMeetingId(null)}
      />
      <DirectorMeetingModal
        open={!!editingDirectorMeetingId && !!currentDirectorMeeting}
        meeting={currentDirectorMeeting}
        allMeetings={directorMeetings}
        supervisionMeetings={meetings}
        assessments={assessments}
        planning={planning}
        placements={placements}
        courses={courses}
        achievements={achievements}
        onSave={(value) => {
          upsertDirectorMeeting(value);
        }}
        onClose={() => setEditingDirectorMeetingId(null)}
      />
      <AssessmentModal
        open={!!editingAssessmentId && !!currentAssessment}
        assessment={currentAssessment}
        instruments={instruments}
        onSave={(value) => {
          upsertAssessment(value);
        }}
        onClose={() => setEditingAssessmentId(null)}
        profile={profile}
      />

      <SpecialistCollegiumModal
        open={!!editingSpecialistCollegiumId && !!currentSpecialistCollegium}
        collegium={currentSpecialistCollegium}
        allCollegiums={specialistCollegiums}
        onSave={(value: IupSpecialistCollegium) => {
          upsertSpecialistCollegium(value);
        }}
        onClose={() => setEditingSpecialistCollegiumId(null)}
      />


      <InstrumentsModal
        open={instrumentsModalOpen}
        instruments={instruments}
        onChange={(next) => {
          setInstruments(next);
          setDirty(true);
        }}
        onClose={() => setInstrumentsModalOpen(false)}
      />

      <NewPlanningSectionModal
        open={newSectionModalOpen}
        onSave={(title) => {
          addPlanningSection(title);
          setNewSectionModalOpen(false);
        }}
        onClose={() => setNewSectionModalOpen(false)}
      />

      {/* === Ta bort-bekräftelsedialog === */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        title="Ta bort"
        message={deleteConfirmConfig?.message || "Är du säker på att du vill ta bort detta?"}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteConfirmConfig(null);
        }}
        onConfirm={() => {
          deleteConfirmConfig?.onConfirm();
        }}
      />
    </>
  );
}




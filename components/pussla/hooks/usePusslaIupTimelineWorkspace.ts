"use client";

import { useEffect, useState } from "react";

export function usePusslaIupTimelineWorkspace() {
  const [supervisionSessions, setSupervisionSessions] = useState<any[]>([]);
  const [hoveredSupervisionId, setHoveredSupervisionId] = useState<string | null>(null);
  const [assessmentSessions, setAssessmentSessions] = useState<any[]>([]);
  const [hoveredAssessmentId, setHoveredAssessmentId] = useState<string | null>(null);
  const [directorMeetingSessions, setDirectorMeetingSessions] = useState<any[]>([]);
  const [hoveredDirectorMeetingId, setHoveredDirectorMeetingId] = useState<string | null>(null);
  const [specialistCollegiumSessions, setSpecialistCollegiumSessions] = useState<any[]>([]);
  const [hoveredSpecialistCollegiumId, setHoveredSpecialistCollegiumId] = useState<string | null>(null);
  const [showSupervisionOnTimeline, setShowSupervisionOnTimeline] = useState<boolean>(true);
  const [showAssessmentsOnTimeline, setShowAssessmentsOnTimeline] = useState<boolean>(true);
  const [showDirectorMeetingsOnTimeline, setShowDirectorMeetingsOnTimeline] = useState<boolean>(true);
  const [showSpecialistCollegiumsOnTimeline, setShowSpecialistCollegiumsOnTimeline] =
    useState<boolean>(true);

  // Ladda handledningstillfällen från IUP (TODO: migrate to Supabase table)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const row = undefined as
          | {
              meetings?: {
                id?: string;
                dateISO?: string;
                focus?: string;
              }[];
              directorMeetings?: {
                id?: string;
                dateISO?: string;
                focus?: string;
              }[];
            }
          | undefined;

        if (cancelled) return;

        const nextDirector = Array.isArray(row?.directorMeetings)
          ? row!.directorMeetings!
              .filter((m: any) => m && typeof m.dateISO === "string")
              .map((m: any, i: number) => ({
                id: String(m.id || `director-${i}`),
                dateISO: String(m.dateISO || ""),
                title: String(m.focus || "Möte med studierektor"),
              }))
          : [];
        setDirectorMeetingSessions(nextDirector);

        const next = Array.isArray(row?.meetings)
          ? (row!.meetings as any[])
              .filter(
                (m) =>
                  m &&
                  typeof (m as any).id === "string" &&
                  (m as any).id &&
                  typeof (m as any).dateISO === "string" &&
                  (m as any).dateISO
              )
              .map((m: any) => ({
                id: String(m.id),
                dateISO: String(m.dateISO),
                title: typeof m.focus === "string" ? m.focus : "",
              }))
          : [];

        setSupervisionSessions(next);
      } catch (e) {
        console.error("Kunde inte läsa handledningstillfällen från IUP:", e);
        if (!cancelled) {
          setSupervisionSessions([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ladda progressionsbedömningar från IUP (för stjärnor i kursspåret)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const row = undefined as
          | {
              assessments?: {
                id?: string;
                dateISO?: string;
                level?: string;
                instrument?: string;
              }[];
              specialistCollegiums?: {
                id?: string;
                dateISO?: string;
              }[];
            }
          | undefined;

        if (cancelled) return;

        const next = Array.isArray(row?.assessments)
          ? (row!.assessments as any[])
              .filter(
                (a) =>
                  a &&
                  typeof (a as any).id === "string" &&
                  (a as any).id &&
                  typeof (a as any).dateISO === "string" &&
                  (a as any).dateISO
              )
              .map((a: any) => ({
                id: String(a.id),
                dateISO: String(a.dateISO),
                title:
                  typeof a.level === "string" && a.level.trim()
                    ? a.level
                    : typeof a.instrument === "string"
                    ? a.instrument
                    : "",
              }))
          : [];

        setAssessmentSessions(next);

        const nextSpec = Array.isArray((row as any)?.specialistCollegiums)
          ? ((row as any).specialistCollegiums as any[])
              .filter(
                (m) =>
                  m &&
                  typeof (m as any).id === "string" &&
                  (m as any).id &&
                  typeof (m as any).dateISO === "string" &&
                  (m as any).dateISO
              )
              .map((m: any) => ({
                id: String(m.id),
                dateISO: String(m.dateISO),
                title: "Specialistkollegium",
              }))
          : [];
        setSpecialistCollegiumSessions(nextSpec);
      } catch (e) {
        console.error("Kunde inte läsa progressionsbedömningar från IUP:", e);
        if (!cancelled) {
          setAssessmentSessions([]);
          setSpecialistCollegiumSessions([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ladda visningsflaggor för handledning/progressionsbedömningar från IUP
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const row = undefined as
          | {
              showMeetingsOnTimeline?: boolean;
              showAssessmentsOnTimeline?: boolean;
              showDirectorMeetingsOnTimeline?: boolean;
              showSpecialistCollegiumsOnTimeline?: boolean;
            }
          | undefined;

        if (cancelled) return;

        if (typeof row?.showMeetingsOnTimeline === "boolean") {
          setShowSupervisionOnTimeline(row.showMeetingsOnTimeline);
        } else {
          setShowSupervisionOnTimeline(true);
        }

        if (typeof row?.showAssessmentsOnTimeline === "boolean") {
          setShowAssessmentsOnTimeline(row.showAssessmentsOnTimeline);
        } else {
          setShowAssessmentsOnTimeline(true);
        }

        if (typeof row?.showDirectorMeetingsOnTimeline === "boolean") {
          setShowDirectorMeetingsOnTimeline(row.showDirectorMeetingsOnTimeline);
        } else {
          setShowDirectorMeetingsOnTimeline(true);
        }

        if (typeof (row as any)?.showSpecialistCollegiumsOnTimeline === "boolean") {
          setShowSpecialistCollegiumsOnTimeline((row as any).showSpecialistCollegiumsOnTimeline);
        } else {
          setShowSpecialistCollegiumsOnTimeline(true);
        }
      } catch (e) {
        console.error("Kunde inte läsa visningsflaggor för IUP:", e);
        if (!cancelled) {
          setShowSupervisionOnTimeline(true);
          setShowAssessmentsOnTimeline(true);
          setShowDirectorMeetingsOnTimeline(true);
          setShowSpecialistCollegiumsOnTimeline(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    supervisionSessions,
    setSupervisionSessions,
    hoveredSupervisionId,
    setHoveredSupervisionId,
    assessmentSessions,
    setAssessmentSessions,
    hoveredAssessmentId,
    setHoveredAssessmentId,
    directorMeetingSessions,
    setDirectorMeetingSessions,
    hoveredDirectorMeetingId,
    setHoveredDirectorMeetingId,
    specialistCollegiumSessions,
    setSpecialistCollegiumSessions,
    hoveredSpecialistCollegiumId,
    setHoveredSpecialistCollegiumId,
    showSupervisionOnTimeline,
    setShowSupervisionOnTimeline,
    showAssessmentsOnTimeline,
    setShowAssessmentsOnTimeline,
    showDirectorMeetingsOnTimeline,
    setShowDirectorMeetingsOnTimeline,
    showSpecialistCollegiumsOnTimeline,
    setShowSpecialistCollegiumsOnTimeline,
  };
}

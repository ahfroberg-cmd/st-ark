"use client";

import { useMemo } from "react";
import type { SupervisorStudent } from "@/lib/mappers/studentData";
import { isValidISODate, normalizeToISODate } from "@/lib/studierektor/dateUtils";

export function useStudentDetailSessions({
  student,
  profile,
}: {
  student: SupervisorStudent;
  profile: any;
}) {
  const iupRow = (student as any).iupSettings || {};

  const iupPlanning = iupRow.planning || {};
  const iupPlanningExtra = iupRow.planning_extra || [];
  const iupPlanningHidden = iupRow.planning_hidden || [];
  const iupMeetings = iupRow.meetings || [];
  const iupAssessments = iupRow.assessments || [];

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

  const supervisionSessions = useMemo(
    () =>
      (iupMeetings.length > 0 ? iupMeetings : supervisorMeetings)
        .map((m: any, i: number) => ({
          ...m,
          id: String(m.id || m._id || `meeting-${i}`),
          dateISO: normalizeToISODate(m.dateISO || m.date || m.iso) || "",
          __type: "supervision" as const,
        }))
        .filter((s: any) => isValidISODate(s.dateISO)),
    [iupMeetings, supervisorMeetings]
  );

  const assessmentSessions = useMemo(
    () =>
      (iupAssessments.length > 0 ? iupAssessments : progressAssessments)
        .map((a: any, i: number) => ({
          ...a,
          id: String(a.id || a._id || `assessment-${i}`),
          dateISO: normalizeToISODate(a.dateISO || a.date || a.iso) || "",
          __type: "assessment" as const,
        }))
        .filter((s: any) => isValidISODate(s.dateISO)),
    [iupAssessments, progressAssessments]
  );

  return {
    iupPlanning,
    iupPlanningExtra,
    iupPlanningHidden,
    iupMeetings,
    iupAssessments,
    supervisorMeetings,
    progressAssessments,
    supervisionSessions,
    assessmentSessions,
  };
}

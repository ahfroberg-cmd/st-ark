"use client";

import IupModal from "@/components/IupModal";

type SupervisionSession = { id: string; dateISO: string; title: string };
type AssessmentSession = { id: string; dateISO: string; title: string };

export default function IupModalBridge(props: {
  iupOpen: boolean;
  setIupOpen: (value: boolean) => void;
  setIupInitialTab: (value: any) => void;
  iupInitialTab: any;
  iupInitialMeetingId: string | null;
  iupInitialAssessmentId: string | null;
  iupInitialDirectorMeetingId: string | null;
  iupInitialSpecialistCollegiumId: string | null;
  setIupInitialMeetingId: (value: string | null) => void;
  setIupInitialAssessmentId: (value: string | null) => void;
  setIupInitialDirectorMeetingId: (value: string | null) => void;
  setIupInitialSpecialistCollegiumId: (value: string | null) => void;
  setSupervisionSessions: (updater: SupervisionSession[]) => void;
  setAssessmentSessions: (updater: AssessmentSession[]) => void;
  setDirectorMeetingSessions: (updater: SupervisionSession[]) => void;
  setSpecialistCollegiumSessions: (updater: AssessmentSession[]) => void;
  showSupervisionOnTimeline: boolean;
  showAssessmentsOnTimeline: boolean;
  showDirectorMeetingsOnTimeline: boolean;
  showSpecialistCollegiumsOnTimeline: boolean;
  setShowSupervisionOnTimeline: (value: boolean) => void;
  setShowAssessmentsOnTimeline: (value: boolean) => void;
  setShowDirectorMeetingsOnTimeline: (value: boolean) => void;
  setShowSpecialistCollegiumsOnTimeline: (value: boolean) => void;
}) {
  return (
    <IupModal
      open={props.iupOpen}
      onClose={() => {
        props.setIupOpen(false);
        props.setIupInitialTab(null);
        props.setIupInitialMeetingId(null);
        props.setIupInitialAssessmentId(null);
        props.setIupInitialDirectorMeetingId(null);
        props.setIupInitialSpecialistCollegiumId(null);
      }}
      initialTab={props.iupInitialTab ?? undefined}
      initialMeetingId={props.iupInitialMeetingId}
      initialAssessmentId={props.iupInitialAssessmentId}
      initialDirectorMeetingId={props.iupInitialDirectorMeetingId}
      initialSpecialistCollegiumId={props.iupInitialSpecialistCollegiumId}
      onMeetingsChange={(sessions) => {
        const next: SupervisionSession[] = Array.isArray(sessions)
          ? (sessions as any[])
              .filter((session: any) => session && typeof session.id === "string" && session.id && typeof session.dateISO === "string" && session.dateISO)
              .map((session: any) => ({
                id: String(session.id),
                dateISO: String(session.dateISO),
                title:
                  typeof session.title === "string"
                    ? session.title
                    : typeof session.focus === "string"
                    ? session.focus
                    : "",
              }))
          : [];
        props.setSupervisionSessions(next);
      }}
      onAssessmentsChange={(sessions) => {
        const next: AssessmentSession[] = Array.isArray(sessions)
          ? (sessions as any[])
              .filter((assessment: any) => assessment && typeof assessment.id === "string" && assessment.id && typeof assessment.dateISO === "string" && assessment.dateISO)
              .map((assessment: any) => ({
                id: String(assessment.id),
                dateISO: String(assessment.dateISO),
                title:
                  typeof assessment.title === "string" && assessment.title.trim()
                    ? assessment.title
                    : typeof assessment.level === "string" && assessment.level.trim()
                    ? assessment.level
                    : typeof assessment.instrument === "string"
                    ? assessment.instrument
                    : "",
              }))
          : [];
        props.setAssessmentSessions(next);
      }}
      onDirectorMeetingsChange={(sessions) => {
        const next: SupervisionSession[] = Array.isArray(sessions)
          ? (sessions as any[])
              .filter((session: any) => session && typeof session.id === "string" && session.id && typeof session.dateISO === "string" && session.dateISO)
              .map((session: any) => ({
                id: String(session.id),
                dateISO: String(session.dateISO),
                title: typeof session.title === "string" ? session.title : "Mote med studierektor",
              }))
          : [];
        props.setDirectorMeetingSessions(next);
      }}
      onSpecialistCollegiumsChange={(sessions) => {
        const next: AssessmentSession[] = Array.isArray(sessions)
          ? (sessions as any[])
              .filter((session: any) => session && typeof session.id === "string" && session.id && typeof session.dateISO === "string" && session.dateISO)
              .map((session: any) => ({
                id: String(session.id),
                dateISO: String(session.dateISO),
                title: "Specialistkollegium",
              }))
          : [];
        props.setSpecialistCollegiumSessions(next);
      }}
      showMeetingsOnTimeline={props.showSupervisionOnTimeline}
      showAssessmentsOnTimeline={props.showAssessmentsOnTimeline}
      showDirectorMeetingsOnTimeline={props.showDirectorMeetingsOnTimeline}
      showSpecialistCollegiumsOnTimeline={props.showSpecialistCollegiumsOnTimeline}
      onTimelineVisibilityChange={(value) => {
        if (typeof value.showMeetingsOnTimeline === "boolean") {
          props.setShowSupervisionOnTimeline(value.showMeetingsOnTimeline);
        }
        if (typeof value.showAssessmentsOnTimeline === "boolean") {
          props.setShowAssessmentsOnTimeline(value.showAssessmentsOnTimeline);
        }
        if (typeof value.showDirectorMeetingsOnTimeline === "boolean") {
          props.setShowDirectorMeetingsOnTimeline(value.showDirectorMeetingsOnTimeline);
        }
        if (typeof (value as any).showSpecialistCollegiumsOnTimeline === "boolean") {
          props.setShowSpecialistCollegiumsOnTimeline((value as any).showSpecialistCollegiumsOnTimeline);
        }
      }}
    />
  );
}

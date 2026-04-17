"use client";

import React from "react";

type SessionItem = {
  id: string;
  dateISO: string;
  title?: string;
};

type TimelineSessionMarkersProps = {
  year: number;
  showSpecialistCollegiumsOnTimeline: boolean;
  showDirectorMeetingsOnTimeline: boolean;
  showSupervisionOnTimeline: boolean;
  showAssessmentsOnTimeline: boolean;
  specialistCollegiumSessions: SessionItem[];
  directorMeetingSessions: SessionItem[];
  supervisionSessions: SessionItem[];
  assessmentSessions: SessionItem[];
  hoveredSpecialistCollegiumId: string | null;
  hoveredDirectorMeetingId: string | null;
  hoveredSupervisionId: string | null;
  hoveredAssessmentId: string | null;
  setHoveredSpecialistCollegiumId: React.Dispatch<React.SetStateAction<string | null>>;
  setHoveredDirectorMeetingId: React.Dispatch<React.SetStateAction<string | null>>;
  setHoveredSupervisionId: React.Dispatch<React.SetStateAction<string | null>>;
  setHoveredAssessmentId: React.Dispatch<React.SetStateAction<string | null>>;
  setIupInitialTab: (tab: "handledning" | "progression") => void;
  setIupInitialSpecialistCollegiumId: (id: string | null) => void;
  setIupInitialDirectorMeetingId: (id: string | null) => void;
  setIupInitialMeetingId: (id: string | null) => void;
  setIupInitialAssessmentId: (id: string | null) => void;
  setIupOpen: (open: boolean) => void;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  dayOfYear: (d: Date) => number;
  daysInYear: (year: number) => number;
  clamp: (v: number, min: number, max: number) => number;
};

export default function TimelineSessionMarkers(props: TimelineSessionMarkersProps) {
  const {
    year,
    showSpecialistCollegiumsOnTimeline,
    showDirectorMeetingsOnTimeline,
    showSupervisionOnTimeline,
    showAssessmentsOnTimeline,
    specialistCollegiumSessions,
    directorMeetingSessions,
    supervisionSessions,
    assessmentSessions,
    hoveredSpecialistCollegiumId,
    hoveredDirectorMeetingId,
    hoveredSupervisionId,
    hoveredAssessmentId,
    setHoveredSpecialistCollegiumId,
    setHoveredDirectorMeetingId,
    setHoveredSupervisionId,
    setHoveredAssessmentId,
    setIupInitialTab,
    setIupInitialSpecialistCollegiumId,
    setIupInitialDirectorMeetingId,
    setIupInitialMeetingId,
    setIupInitialAssessmentId,
    setIupOpen,
    isValidISO,
    isoToDateSafe,
    dayOfYear,
    daysInYear,
    clamp,
  } = props;

  return (
    <>
      {specialistCollegiumSessions
        .filter((m) => {
          if (!showSpecialistCollegiumsOnTimeline) return false;
          if (!m.dateISO || !isValidISO(m.dateISO)) return false;
          const d = isoToDateSafe(m.dateISO);
          return d.getFullYear() === year;
        })
        .map((m) => {
          const d = isoToDateSafe(m.dateISO);
          if (isNaN(d.getTime())) return null;
          const total = Math.max(1, daysInYear(year) - 1);
          const dayIndex = dayOfYear(d);
          const pct = clamp((dayIndex / total) * 100, 0, 100);
          const isHovered = hoveredSpecialistCollegiumId === m.id;
          return (
            <button
              key={m.id + "@spec@" + year}
              type="button"
              className="pointer-events-auto absolute z-[300]"
              style={{
                left: `${pct}%`,
                top: "-0.7rem",
                transform: isHovered ? "translate(-50%, -1px) scale(1.05)" : "translate(-50%, 0) scale(1)",
              }}
              onMouseEnter={() => setHoveredSpecialistCollegiumId(m.id)}
              onMouseLeave={() => setHoveredSpecialistCollegiumId((prev) => (prev === m.id ? null : prev))}
              onClick={(e) => {
                e.stopPropagation();
                setIupInitialTab("progression");
                setIupInitialSpecialistCollegiumId(m.id);
                setIupOpen(true);
              }}
              title={`Specialistkollegium (${m.dateISO})`}
              data-info="Specialistkollegium. Klicka här för att öppna detta specialistkollegium i IUP-modalen där du kan redigera datum, återkoppling och planering."
            >
              <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" style={{ display: "block" }}>
                <path
                  d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
                  fill={isHovered ? "#bae6fd" : "#38bdf8"}
                  stroke="#0284c7"
                  strokeWidth={1.3}
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          );
        })}

      {directorMeetingSessions
        .filter((s) => {
          if (!showDirectorMeetingsOnTimeline) return false;
          if (!s.dateISO || !isValidISO(s.dateISO)) return false;
          const d = isoToDateSafe(s.dateISO);
          return d.getFullYear() === year;
        })
        .map((s) => {
          const d = isoToDateSafe(s.dateISO);
          const total = Math.max(1, daysInYear(year) - 1);
          const dayIndex = dayOfYear(d);
          const pct = clamp((dayIndex / total) * 100, 0, 100);
          const isHovered = hoveredDirectorMeetingId === s.id;
          return (
            <button
              key={s.id + "@director@" + year}
              type="button"
              className="pointer-events-auto absolute z-[300]"
              style={{
                left: `${pct}%`,
                top: "-0.55rem",
                transform: isHovered ? "translate(-50%, -1px)" : "translate(-50%, 0)",
              }}
              onMouseEnter={() => setHoveredDirectorMeetingId(s.id)}
              onMouseLeave={() => setHoveredDirectorMeetingId((prev) => (prev === s.id ? null : prev))}
              onClick={(e) => {
                e.stopPropagation();
                setIupInitialTab("handledning");
                setIupInitialDirectorMeetingId(s.id);
                setIupOpen(true);
              }}
              title={s.title && s.title.trim() ? `${s.title} (${s.dateISO})` : s.dateISO}
              data-info="Möte med studierektor. Klicka för att öppna mötet i IUP-modalen."
            >
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
                    borderBottom: "11px solid #7c2d12",
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
                    borderBottom: isHovered ? "9px solid #fb923c" : "9px solid #ea580c",
                  }}
                />
              </span>
            </button>
          );
        })}

      {supervisionSessions
        .filter((s) => {
          if (!showSupervisionOnTimeline) return false;
          if (!s.dateISO || !isValidISO(s.dateISO)) return false;
          const d = isoToDateSafe(s.dateISO);
          return d.getFullYear() === year;
        })
        .map((s) => {
          const d = isoToDateSafe(s.dateISO);
          const total = Math.max(1, daysInYear(year) - 1);
          const dayIndex = dayOfYear(d);
          const pct = clamp((dayIndex / total) * 100, 0, 100);
          const isHovered = hoveredSupervisionId === s.id;
          return (
            <button
              key={s.id + "@" + year}
              type="button"
              className="pointer-events-auto absolute z-[300]"
              style={{
                left: `${pct}%`,
                top: "-0.55rem",
                transform: isHovered ? "translate(-50%, -1px)" : "translate(-50%, 0)",
              }}
              onMouseEnter={() => setHoveredSupervisionId(s.id)}
              onMouseLeave={() => setHoveredSupervisionId((prev) => (prev === s.id ? null : prev))}
              onClick={(e) => {
                e.stopPropagation();
                setIupInitialTab("handledning");
                setIupInitialMeetingId(s.id);
                setIupOpen(true);
              }}
              title={s.title && s.title.trim() ? `${s.title} (${s.dateISO})` : s.dateISO}
              data-info="Möte med huvudhandledare. Klicka här för att öppna detta handledningstillfälle i IUP-modalen där du kan redigera datum, fokus, sammanfattning och överenskomna åtgärder."
            >
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
                    borderBottom: isHovered ? "9px solid #34d399" : "9px solid #059669",
                  }}
                />
              </span>
            </button>
          );
        })}

      {assessmentSessions
        .filter((a) => {
          if (!showAssessmentsOnTimeline) return false;
          if (!a.dateISO || !isValidISO(a.dateISO)) return false;
          const d = isoToDateSafe(a.dateISO);
          return d.getFullYear() === year;
        })
        .map((a) => {
          const d = isoToDateSafe(a.dateISO);
          if (isNaN(d.getTime())) return null;
          const total = Math.max(1, daysInYear(year) - 1);
          const dayIndex = dayOfYear(d);
          const pct = clamp((dayIndex / total) * 100, 0, 100);
          const isHovered = hoveredAssessmentId === a.id;
          return (
            <button
              key={a.id + "@assess@" + year}
              type="button"
              className="pointer-events-auto absolute z-[300]"
              style={{
                left: `${pct}%`,
                top: "-0.7rem",
                transform: isHovered ? "translate(-50%, -1px) scale(1.05)" : "translate(-50%, 0) scale(1)",
              }}
              onMouseEnter={() => setHoveredAssessmentId(a.id)}
              onMouseLeave={() => setHoveredAssessmentId((prev) => (prev === a.id ? null : prev))}
              onClick={(e) => {
                e.stopPropagation();
                setIupInitialTab("progression");
                setIupInitialAssessmentId(a.id);
                setIupOpen(true);
              }}
              title={a.title && a.title.trim() ? `${a.title} (${a.dateISO})` : a.dateISO}
              data-info="Progressionsbedömning. Klicka här för att öppna denna progressionsbedömning i IUP-modalen där du kan redigera datum, bedömningsinstrument och bedömningsresultat."
            >
              <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" style={{ display: "block" }}>
                <path
                  d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
                  fill={isHovered ? "#facc15" : "#f59e0b"}
                  stroke="#d97706"
                  strokeWidth={1.3}
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          );
        })}
    </>
  );
}

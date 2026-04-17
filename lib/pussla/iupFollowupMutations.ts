type MeetingLike = {
  id?: string;
  dateISO?: string;
  focus?: string;
  summary?: string;
  actions?: string;
};

type AssessmentLike = {
  id?: string;
  dateISO?: string;
  phase?: string;
  level?: string;
  instrument?: string;
  summary?: string;
  strengths?: string;
  development?: string;
};

type SessionLike = {
  id?: string;
  dateISO?: string;
  title?: string;
};

export function upsertHandledartraffMeeting(
  meetings: MeetingLike[],
  dateISO: string,
  createId: () => string
): MeetingLike[] {
  const exists = meetings.some(
    (meeting) =>
      String(meeting?.dateISO || "").slice(0, 10) === dateISO &&
      String(meeting?.focus || "").trim().toLowerCase() === "handledarträff"
  );
  if (exists) return meetings;
  return [
    ...meetings,
    {
      id: createId(),
      dateISO,
      focus: "Handledarträff",
      summary: "",
      actions: "",
    },
  ];
}

export function upsertProgressionsbedomningAssessment(
  assessments: AssessmentLike[],
  dateISO: string,
  phase: string,
  createId: () => string
): AssessmentLike[] {
  const exists = assessments.some(
    (assessment) =>
      String(assessment?.dateISO || "").slice(0, 10) === dateISO &&
      String(assessment?.instrument || "").trim().toLowerCase() === "progressionsbedömning"
  );
  if (exists) return assessments;
  return [
    ...assessments,
    {
      id: createId(),
      dateISO,
      phase,
      level: "",
      instrument: "Progressionsbedömning",
      summary: "",
      strengths: "",
      development: "",
    },
  ];
}

export function upsertFollowupSession(
  sessions: SessionLike[],
  dateISO: string,
  title: string,
  createId: () => string
): SessionLike[] {
  const exists = sessions.some(
    (session) =>
      String(session?.dateISO || "").slice(0, 10) === dateISO &&
      String(session?.title || "").toLowerCase() === title.toLowerCase()
  );
  if (exists) return sessions;
  return [...sessions, { id: createId(), dateISO, title }];
}

export function clearFollowups(input: {
  meetings: MeetingLike[];
  assessments: AssessmentLike[];
  clearMeetings: boolean;
  clearAssessments: boolean;
}): {
  meetings: MeetingLike[];
  assessments: AssessmentLike[];
  removedMeetings: number;
  removedAssessments: number;
} {
  const { meetings, assessments, clearMeetings, clearAssessments } = input;
  return {
    meetings: clearMeetings ? [] : meetings,
    assessments: clearAssessments ? [] : assessments,
    removedMeetings: clearMeetings ? meetings.length : 0,
    removedAssessments: clearAssessments ? assessments.length : 0,
  };
}

export function addFollowupToCollections(input: {
  followupType: "meeting" | "assessment";
  dateISO: string;
  meetings: MeetingLike[];
  assessments: AssessmentLike[];
  inferPhaseFromDate: (dateISO: string) => string;
  createId: () => string;
}): { meetings: MeetingLike[]; assessments: AssessmentLike[] } {
  const {
    followupType,
    dateISO,
    meetings,
    assessments,
    inferPhaseFromDate,
    createId,
  } = input;

  if (followupType === "meeting") {
    return {
      meetings: upsertHandledartraffMeeting(meetings, dateISO, createId),
      assessments,
    };
  }
  return {
    meetings,
    assessments: upsertProgressionsbedomningAssessment(
      assessments,
      dateISO,
      inferPhaseFromDate(dateISO),
      createId
    ),
  };
}

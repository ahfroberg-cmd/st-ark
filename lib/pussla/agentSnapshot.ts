type NormalizedAgentSnapshot = {
  activities: unknown[];
  courses: unknown[];
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  activeLane: "placement" | "course";
  iupOpen: boolean;
  iupInitialTab: string | null;
  hemklinikOpen: boolean;
  scanOpen: boolean;
  btModalOpen: boolean;
  prepareOpen: boolean;
  milestoneOverviewOpen: boolean;
  courseModalOpen: boolean;
  sta3Open: boolean;
  previewOpen: boolean;
  profileOpen: boolean;
  aboutOpen: boolean;
  reportOpen: boolean;
  settingsOpen: boolean;
  supervisionSessions: unknown[];
  assessmentSessions: unknown[];
  directorMeetingSessions: unknown[];
  specialistCollegiumSessions: unknown[];
  dirty: boolean;
};

export function buildAgentSnapshot(input: {
  activities: unknown[];
  courses: unknown[];
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  activeLane: "placement" | "course";
  iupOpen: boolean;
  iupInitialTab: string | null;
  hemklinikOpen: boolean;
  scanOpen: boolean;
  btModalOpen: boolean;
  prepareOpen: boolean;
  milestoneOverviewOpen: boolean;
  courseModalOpen: boolean;
  sta3Open: boolean;
  previewOpen: boolean;
  profileOpen: boolean;
  aboutOpen: boolean;
  reportOpen: boolean;
  settingsOpen: boolean;
  supervisionSessions: unknown[];
  assessmentSessions: unknown[];
  directorMeetingSessions: unknown[];
  specialistCollegiumSessions: unknown[];
  btStartISO: string | null;
  btEndISO: string | null;
  dirty: boolean;
}): Record<string, unknown> {
  const btWindow =
    typeof input.btStartISO === "string" &&
    typeof input.btEndISO === "string" &&
    input.btStartISO.trim() &&
    input.btEndISO.trim()
      ? { startDate: input.btStartISO.slice(0, 10), endDate: input.btEndISO.slice(0, 10) }
      : null;

  return {
    activities: structuredClone(input.activities),
    courses: structuredClone(input.courses),
    selectedPlacementId: input.selectedPlacementId,
    selectedCourseId: input.selectedCourseId,
    activeLane: input.activeLane,
    iupOpen: input.iupOpen,
    iupInitialTab: input.iupInitialTab,
    hemklinikOpen: input.hemklinikOpen,
    scanOpen: input.scanOpen,
    btModalOpen: input.btModalOpen,
    prepareOpen: input.prepareOpen,
    milestoneOverviewOpen: input.milestoneOverviewOpen,
    courseModalOpen: input.courseModalOpen,
    sta3Open: input.sta3Open,
    previewOpen: input.previewOpen,
    profileOpen: input.profileOpen,
    aboutOpen: input.aboutOpen,
    reportOpen: input.reportOpen,
    settingsOpen: input.settingsOpen,
    supervisionSessions: structuredClone(input.supervisionSessions),
    assessmentSessions: structuredClone(input.assessmentSessions),
    directorMeetingSessions: structuredClone(input.directorMeetingSessions),
    specialistCollegiumSessions: structuredClone(input.specialistCollegiumSessions),
    btWindow,
    dirty: input.dirty,
  };
}

export function normalizeAgentSnapshot(snapshot: unknown): {
  ok: boolean;
  data?: NormalizedAgentSnapshot;
  message?: string;
} {
  if (!snapshot || typeof snapshot !== "object") {
    return { ok: false, message: "Kunde inte återställa: ogiltig snapshot." };
  }
  const s = snapshot as Record<string, unknown>;
  return {
    ok: true,
    data: {
      activities: Array.isArray(s.activities) ? s.activities : [],
      courses: Array.isArray(s.courses) ? s.courses : [],
      selectedPlacementId: typeof s.selectedPlacementId === "string" ? s.selectedPlacementId : null,
      selectedCourseId: typeof s.selectedCourseId === "string" ? s.selectedCourseId : null,
      activeLane: s.activeLane === "course" ? "course" : "placement",
      iupOpen: Boolean(s.iupOpen),
      iupInitialTab: typeof s.iupInitialTab === "string" ? s.iupInitialTab : null,
      hemklinikOpen: Boolean(s.hemklinikOpen),
      scanOpen: Boolean(s.scanOpen),
      btModalOpen: Boolean(s.btModalOpen),
      prepareOpen: Boolean(s.prepareOpen),
      milestoneOverviewOpen: Boolean(s.milestoneOverviewOpen),
      courseModalOpen: Boolean(s.courseModalOpen),
      sta3Open: Boolean(s.sta3Open),
      previewOpen: Boolean(s.previewOpen),
      profileOpen: Boolean(s.profileOpen),
      aboutOpen: Boolean(s.aboutOpen),
      reportOpen: Boolean(s.reportOpen),
      settingsOpen: Boolean(s.settingsOpen),
      supervisionSessions: Array.isArray(s.supervisionSessions) ? s.supervisionSessions : [],
      assessmentSessions: Array.isArray(s.assessmentSessions) ? s.assessmentSessions : [],
      directorMeetingSessions: Array.isArray(s.directorMeetingSessions)
        ? s.directorMeetingSessions
        : [],
      specialistCollegiumSessions: Array.isArray(s.specialistCollegiumSessions)
        ? s.specialistCollegiumSessions
        : [],
      dirty: Boolean(s.dirty),
    },
  };
}

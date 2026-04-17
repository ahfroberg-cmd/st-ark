type ProfileLike = {
  goalsVersion?: string;
};

type CourseLike = {
  id: string;
  title: string;
  kind: string;
  city: string;
  courseLeaderName: string;
  startDate: string;
  endDate: string;
  certificateDate: string;
  note: string;
  fulfillsStGoals: boolean;
  milestones?: string[];
  phase: "BT" | "ST";
};

type BuildCourseFromDateRangeInput = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  kind: string;
  startYear: number;
  profile: ProfileLike;
  mapMetisGoalsToMilestoneIds: (title: string) => string[];
  sanitizeStMilestonesForGoals: (ids: string[], goalsVersion?: string) => string[];
  dateToSlot: (startYear: number, dateISO: string, mode: "start" | "end") => number;
  computePhaseByEndSlot: (startSlot: number, lengthSlots: number) => "BT" | "ST";
};

type BuildCourseAtDateInput = {
  id: string;
  dateISO: string;
  kind: string;
  inferPhase: (dateISO: string) => "BT" | "ST";
};

export function buildCourseAtDate(input: BuildCourseAtDateInput): CourseLike {
  const { id, dateISO, kind, inferPhase } = input;
  const phase = inferPhase(dateISO);
  return {
    id,
    title: "",
    kind,
    city: "",
    courseLeaderName: "",
    startDate: dateISO,
    endDate: dateISO,
    certificateDate: dateISO,
    note: "",
    fulfillsStGoals: false,
    phase,
  };
}

export function buildCourseFromDateRange(input: BuildCourseFromDateRangeInput): {
  course: CourseLike;
  normalizedEnd: string;
} {
  const {
    id,
    title,
    startDate,
    endDate,
    kind,
    startYear,
    profile,
    mapMetisGoalsToMilestoneIds,
    sanitizeStMilestonesForGoals,
    dateToSlot,
    computePhaseByEndSlot,
  } = input;

  const normalizedEnd = endDate < startDate ? startDate : endDate;
  const autoMilestones = kind === "Kurs" ? mapMetisGoalsToMilestoneIds(title || "") : [];
  const startSlot = dateToSlot(startYear, startDate, "start");
  const endSlot = dateToSlot(startYear, normalizedEnd, "end");
  const lengthSlots = Math.max(1, endSlot - startSlot + 1);

  const course: CourseLike = {
    id,
    title: title || "Kurs",
    kind,
    city: "",
    courseLeaderName: "",
    startDate,
    endDate: normalizedEnd,
    certificateDate: normalizedEnd,
    note: "",
    fulfillsStGoals: autoMilestones.length > 0,
    ...(autoMilestones.length > 0
      ? {
          milestones: sanitizeStMilestonesForGoals(autoMilestones, profile?.goalsVersion),
        }
      : {}),
    phase: computePhaseByEndSlot(startSlot, lengthSlots),
  };

  return { course, normalizedEnd };
}

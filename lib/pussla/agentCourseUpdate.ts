type CourseAgentFields = {
  title?: string;
  courseKind?: string;
  startDate?: string;
  endDate?: string;
  certificateDate?: string;
  city?: string;
  courseLeaderName?: string;
  note?: string;
  showAsInterval?: boolean;
  phase?: "BT" | "ST";
  btAssessment?: string;
  addToPlacement?: boolean;
  milestones?: string[];
  btMilestones?: string[];
};

export function buildCoursePatchFromAgentFields(input: {
  fields: CourseAgentFields;
  goalsVersion?: string;
  isValidISO: (iso: string) => boolean;
  sanitizeStMilestonesForGoals: (ids: string[], goalsVersion?: string) => string[];
  toMilestoneIds: (ids: string[]) => string[];
}): { patch: Record<string, unknown> } | { error: string } {
  const { fields, goalsVersion, isValidISO, sanitizeStMilestonesForGoals, toMilestoneIds } = input;
  const patch: Record<string, unknown> = {};

  if (typeof fields.title === "string") patch.title = fields.title;
  if (fields.courseKind) patch.kind = fields.courseKind;
  if (typeof fields.startDate === "string") {
    const value = fields.startDate.trim();
    if (value && !isValidISO(value)) {
      return { error: "Ogiltigt startdatum. Använd YYYY-MM-DD." };
    }
    patch.startDate = value || undefined;
  }
  if (typeof fields.endDate === "string") {
    const value = fields.endDate.trim();
    if (value && !isValidISO(value)) {
      return { error: "Ogiltigt slutdatum. Använd YYYY-MM-DD." };
    }
    patch.endDate = value || undefined;
  }
  if (typeof fields.certificateDate === "string") {
    const value = fields.certificateDate.trim();
    if (value && !isValidISO(value)) {
      return { error: "Ogiltigt intygsdatum. Använd YYYY-MM-DD." };
    }
    patch.certificateDate = value || undefined;
  }
  if (typeof fields.city === "string") patch.city = fields.city;
  if (typeof fields.courseLeaderName === "string") patch.courseLeaderName = fields.courseLeaderName;
  if (typeof fields.note === "string") patch.note = fields.note;
  if (typeof fields.showAsInterval === "boolean") patch.showAsInterval = fields.showAsInterval;
  if (fields.phase === "BT" || fields.phase === "ST") patch.phase = fields.phase;
  if (typeof fields.btAssessment === "string") patch.btAssessment = fields.btAssessment;
  if (typeof fields.addToPlacement === "boolean") patch.addToPlacement = fields.addToPlacement;
  if (Array.isArray(fields.milestones)) {
    patch.milestones = sanitizeStMilestonesForGoals(
      fields.milestones.map((milestone) => String(milestone || "")),
      goalsVersion
    );
  }
  if (Array.isArray(fields.btMilestones)) {
    patch.btMilestones = toMilestoneIds(fields.btMilestones);
  }

  if (
    typeof patch.startDate === "string" &&
    typeof patch.endDate === "string" &&
    patch.endDate < patch.startDate
  ) {
    patch.endDate = patch.startDate;
  }

  return { patch };
}

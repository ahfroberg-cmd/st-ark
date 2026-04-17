type PlacementAgentFields = {
  label?: string;
  placementType?: string;
  startDate?: string;
  endDate?: string;
  attendance?: number;
  supervisor?: string;
  supervisorSpeciality?: string;
  supervisorSite?: string;
  note?: string;
  phase?: "BT" | "ST";
  leaveSubtype?: string;
  milestones?: string[];
  btMilestones?: string[];
};

export function buildPlacementPatchFromAgentFields(input: {
  fields: PlacementAgentFields;
  goalsVersion?: string;
  sanitizeStMilestonesForGoals: (ids: string[], goalsVersion?: string) => string[];
  toMilestoneIds: (ids: string[]) => string[];
}): Record<string, unknown> {
  const { fields, goalsVersion, sanitizeStMilestonesForGoals, toMilestoneIds } = input;
  const patch: Record<string, unknown> = {};
  if (typeof fields.label === "string") patch.label = fields.label;
  if (fields.placementType) patch.type = fields.placementType;
  if (typeof fields.attendance === "number" && Number.isFinite(fields.attendance)) {
    patch.attendance = Math.max(0, Math.min(100, Math.round(fields.attendance)));
  }
  if (typeof fields.supervisor === "string") patch.supervisor = fields.supervisor;
  if (typeof fields.supervisorSpeciality === "string") patch.supervisorSpeciality = fields.supervisorSpeciality;
  if (typeof fields.supervisorSite === "string") patch.supervisorSite = fields.supervisorSite;
  if (typeof fields.note === "string") patch.note = fields.note;
  if (fields.phase === "BT" || fields.phase === "ST") patch.phase = fields.phase;
  if (typeof fields.leaveSubtype === "string") patch.leaveSubtype = fields.leaveSubtype;
  if (Array.isArray(fields.milestones)) {
    patch.milestones = sanitizeStMilestonesForGoals(
      fields.milestones.map((m) => String(m || "")),
      goalsVersion
    );
  }
  if (Array.isArray(fields.btMilestones)) {
    patch.btMilestones = toMilestoneIds(fields.btMilestones);
  }
  return patch;
}

export function resolvePlacementDatePatchFromAgentFields(input: {
  fields: PlacementAgentFields;
  oldStartISO: string;
  oldEndISO: string;
  startYear: number;
  selectedPlacementId: string;
  isValidISO: (iso: string) => boolean;
  dateToSlot: (startYear: number, dateISO: string, mode: "start" | "end") => number;
  wouldOverlap: (id: string, startSlot: number, lengthSlots: number) => boolean;
}): { patch: Record<string, unknown> } | { error: string } {
  const {
    fields,
    oldStartISO,
    oldEndISO,
    startYear,
    selectedPlacementId,
    isValidISO,
    dateToSlot,
    wouldOverlap,
  } = input;
  const startISO = typeof fields.startDate === "string" ? fields.startDate.trim() : "";
  const endISO = typeof fields.endDate === "string" ? fields.endDate.trim() : "";
  if (!startISO && !endISO) return { patch: {} };

  const wantedStart = startISO || oldStartISO;
  const wantedEnd = endISO || oldEndISO;
  if (!isValidISO(wantedStart) || !isValidISO(wantedEnd)) {
    return { error: "Ogiltigt datumformat för placering. Använd YYYY-MM-DD." };
  }

  const normalizedEnd = wantedEnd < wantedStart ? wantedStart : wantedEnd;
  const startSlot = dateToSlot(startYear, wantedStart, "start");
  const endSlot = dateToSlot(startYear, normalizedEnd, "end");
  if (!Number.isFinite(startSlot) || !Number.isFinite(endSlot) || endSlot < startSlot) {
    return { error: "Kunde inte mappa placeringens datum till tidslinjen." };
  }
  const lengthSlots = Math.max(1, endSlot - startSlot + 1);
  if (wouldOverlap(selectedPlacementId, startSlot, lengthSlots)) {
    return { error: "Placeringen överlappar en annan aktivitet. Justera datum." };
  }

  return {
    patch: {
      startSlot,
      lengthSlots,
      exactStartISO: wantedStart,
      exactEndISO: normalizedEnd,
    },
  };
}

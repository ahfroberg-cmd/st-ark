export function buildClearedFollowupsMessage(input: {
  clearMeetings: boolean;
  clearAssessments: boolean;
  removedMeetings: number;
  removedAssessments: number;
}): string {
  const { clearMeetings, clearAssessments, removedMeetings, removedAssessments } = input;
  if (clearMeetings && clearAssessments) {
    return `Tog bort ${removedMeetings} handledartillfällen och ${removedAssessments} progressionsbedömningar.`;
  }
  if (clearMeetings) {
    return `Tog bort ${removedMeetings} handledartillfällen.`;
  }
  return `Tog bort ${removedAssessments} progressionsbedömningar.`;
}

export function buildAddedFollowupMessage(
  followupType: "meeting" | "assessment",
  dateISO: string
): string {
  return followupType === "meeting"
    ? `Lade till handledningstillfälle ${dateISO}.`
    : `Lade till progressionsbedömning ${dateISO}.`;
}

export function buildAddedSupervisionMeetingsBatchMessage(count: number, dateISOs: string[]): string {
  const sample = dateISOs.slice(0, 6).join(", ");
  const tail = dateISOs.length > 6 ? ` … (+${dateISOs.length - 6} till)` : "";
  return `Lade till ${count} handledarsamtal${sample ? `: ${sample}${tail}` : "."}`;
}

export function buildShiftSupervisionMeetingsMessage(days: number, count: number): string {
  const dir = days > 0 ? "fram" : "bak";
  const n = Math.abs(days);
  const unit = n === 1 ? "dag" : "dagar";
  return `Flyttade ${count} handledarsamtal ${dir}åt med ${n} ${unit}.`;
}

export function buildRemovedSupervisionMeetingsByDatesMessage(removed: number): string {
  return `Tog bort ${removed} handledarsamtal som matchade angivna datum.`;
}

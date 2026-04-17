import type { PusslaAgentAction } from "@/lib/ai/types";

export function safeStableStringify(value: unknown): string {
  try {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((v) => safeStableStringify(v)).join(",")}]`;
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${safeStableStringify(obj[k])}`)
      .join(",")}}`;
  } catch {
    return String(value);
  }
}

export function pickSnapshotForVerification(snapshot: any) {
  const activities = Array.isArray(snapshot?.activities) ? snapshot.activities : [];
  const courses = Array.isArray(snapshot?.courses) ? snapshot.courses : [];
  const supervisionSessions = Array.isArray(snapshot?.supervisionSessions)
    ? snapshot.supervisionSessions
    : [];
  const assessmentSessions = Array.isArray(snapshot?.assessmentSessions)
    ? snapshot.assessmentSessions
    : [];
  const directorMeetingSessions = Array.isArray(snapshot?.directorMeetingSessions)
    ? snapshot.directorMeetingSessions
    : [];
  return {
    activities,
    courses,
    supervisionSessions,
    assessmentSessions,
    directorMeetingSessions,
    selectedPlacementId:
      typeof snapshot?.selectedPlacementId === "string" ? snapshot.selectedPlacementId : null,
    selectedCourseId: typeof snapshot?.selectedCourseId === "string" ? snapshot.selectedCourseId : null,
    activeLane: snapshot?.activeLane === "course" ? "course" : "placement",
    iupInitialTab: typeof snapshot?.iupInitialTab === "string" ? snapshot.iupInitialTab : "",
  };
}

export function verifyWriteActionOutcome(
  action: PusslaAgentAction,
  beforeSnapshot: unknown,
  afterSnapshot: unknown,
  resultMessage: string
): { verified: boolean; changed: boolean; changedCount: number; reason: string } {
  const before = pickSnapshotForVerification(beforeSnapshot);
  const after = pickSnapshotForVerification(afterSnapshot);
  const fingerprintBefore = safeStableStringify(before);
  const fingerprintAfter = safeStableStringify(after);
  const changed = fingerprintBefore !== fingerprintAfter;

  const changes = {
    activitiesDelta: after.activities.length - before.activities.length,
    coursesDelta: after.courses.length - before.courses.length,
    supervisionDelta: after.supervisionSessions.length - before.supervisionSessions.length,
    assessmentDelta: after.assessmentSessions.length - before.assessmentSessions.length,
    directorMeetingDelta: after.directorMeetingSessions.length - before.directorMeetingSessions.length,
    selectedPlacementChanged: before.selectedPlacementId !== after.selectedPlacementId,
    selectedCourseChanged: before.selectedCourseId !== after.selectedCourseId,
    activeLaneChanged: before.activeLane !== after.activeLane,
    iupTabChanged: before.iupInitialTab !== after.iupInitialTab,
  };
  const changedCount = Object.values(changes).filter((v) => (typeof v === "number" ? v !== 0 : Boolean(v)))
    .length;

  const messageLower = String(resultMessage || "").toLowerCase();
  const explicitNoop =
    /redan|ingen ändring|inga ändringar|oförändrad|inget att|0 ändringar|inget behövde|hittade ingen|ingen kurs|ingen placering/.test(
      messageLower
    );
  const persistOnlyAction =
    action.type === "save_selected_placement" || action.type === "save_selected_course";
  const allowedNoopAction =
    persistOnlyAction ||
    action.type === "sync_course_milestones" ||
    action.type === "rebalance_courses_per_half_year" ||
    action.type === "plan_timeline_distribution";

  if (changed) {
    return { verified: true, changed: true, changedCount, reason: "snapshot_changed" };
  }
  if (explicitNoop) {
    return { verified: true, changed: false, changedCount, reason: "explicit_noop" };
  }
  if (allowedNoopAction) {
    return { verified: true, changed: false, changedCount, reason: "allowed_noop_action" };
  }
  return { verified: false, changed: false, changedCount, reason: "no_observed_change" };
}

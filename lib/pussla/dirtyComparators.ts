function sameStringArray(a: unknown, b: unknown): boolean {
  const aa = Array.isArray(a) ? a : [];
  const bb = Array.isArray(b) ? b : [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i += 1) {
    if (String(aa[i] ?? "") !== String(bb[i] ?? "")) return false;
  }
  return true;
}

export function isPlacementDirty(baseline: any, current: any): boolean {
  if (!baseline || !current) return false;
  return (
    baseline.type !== current.type ||
    baseline.label !== current.label ||
    baseline.leaveSubtype !== current.leaveSubtype ||
    baseline.startSlot !== current.startSlot ||
    baseline.lengthSlots !== current.lengthSlots ||
    baseline.attendance !== current.attendance ||
    baseline?.phase !== current?.phase ||
    baseline.supervisor !== current.supervisor ||
    baseline.supervisorSpeciality !== current.supervisorSpeciality ||
    baseline.supervisorSite !== current.supervisorSite ||
    baseline?.btAssessment !== current?.btAssessment ||
    baseline.note !== current.note ||
    !sameStringArray(baseline?.btMilestones, current?.btMilestones) ||
    !sameStringArray(baseline?.milestones, current?.milestones) ||
    baseline?.fulfillsStGoals !== current?.fulfillsStGoals ||
    (baseline.exactStartISO || "") !== (current?.exactStartISO || "") ||
    (baseline.exactEndISO || "") !== (current?.exactEndISO || "")
  );
}

export function isCourseDirty(baseline: any, current: any): boolean {
  if (!baseline || !current) return false;
  return (
    baseline.title !== current.title ||
    baseline.kind !== current.kind ||
    baseline.city !== current.city ||
    baseline.courseLeaderName !== current.courseLeaderName ||
    baseline.startDate !== current.startDate ||
    baseline.endDate !== current.endDate ||
    baseline.certificateDate !== current.certificateDate ||
    baseline.note !== current.note ||
    (baseline?.courseTitle || "") !== (current?.courseTitle || "") ||
    !sameStringArray(baseline?.milestones, current?.milestones) ||
    !sameStringArray(baseline?.btMilestones, current?.btMilestones) ||
    baseline?.fulfillsStGoals !== current?.fulfillsStGoals ||
    baseline?.addToPlacement !== current?.addToPlacement ||
    baseline?.addToPlacementTargetId !== current?.addToPlacementTargetId ||
    baseline?.phase !== current?.phase ||
    baseline?.btAssessment !== current?.btAssessment ||
    baseline?.showAsInterval !== current?.showAsInterval
  );
}

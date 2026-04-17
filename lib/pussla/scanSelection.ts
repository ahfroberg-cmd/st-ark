type PendingSelection = {
  kind: "placement" | "course";
  dbId: string;
} | null;

type RowLike = Record<string, any>;

export function resolvePendingScanSelection(
  pending: PendingSelection,
  activities: RowLike[],
  courses: RowLike[]
): { placementId: string | null; courseId: string | null; lane: "placement" | "course" | null; consumed: boolean } {
  if (!pending || pending.dbId == null) {
    return { placementId: null, courseId: null, lane: null, consumed: false };
  }

  if (pending.kind === "placement") {
    const found = (activities || []).find((a: any) => a?.linkedPlacementId === pending.dbId);
    if (!found) return { placementId: null, courseId: null, lane: null, consumed: false };
    return { placementId: String(found.id), courseId: null, lane: "placement", consumed: true };
  }

  const found = (courses || []).find((c: any) => c?.linkedCourseId === pending.dbId);
  if (!found) return { placementId: null, courseId: null, lane: null, consumed: false };
  return { placementId: null, courseId: String(found.id), lane: "course", consumed: true };
}

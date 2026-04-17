export type PusslaSearchHit =
  | { id: string; label: string; kind: "Sida"; action: { type: "open_iup" | "open_hemklinik" | "open_docs_root" } }
  | { id: string; label: string; kind: "Placering"; action: { type: "select_placement"; placementId: string } }
  | { id: string; label: string; kind: "Kurs"; action: { type: "select_course"; courseId: string } }
  | {
      id: string;
      label: string;
      kind: "Dokument";
      action:
        | { type: "open_placement_docs"; placementId: string; label: string }
        | { type: "open_course_docs"; courseId: string; label: string };
    };

type ActivityLike = {
  id: string;
  label?: string;
  type?: string;
  linkedPlacementId?: string;
};

type CourseLike = {
  id: string;
  linkedCourseId?: string;
};

export function buildPusslaSearchHits(input: {
  query: string;
  activities: ActivityLike[];
  courses: CourseLike[];
  getCourseDisplayTitle: (course: CourseLike) => string;
  limit?: number;
}): PusslaSearchHit[] {
  const query = String(input.query || "").trim().toLowerCase();
  if (!query) return [];

  const hits: PusslaSearchHit[] = [];
  const addHit = (hit: PusslaSearchHit) => {
    if (!hit.label.toLowerCase().includes(query)) return;
    hits.push(hit);
  };

  addHit({
    id: "page-iup",
    label: "IUP",
    kind: "Sida",
    action: { type: "open_iup" },
  });
  addHit({
    id: "page-hemklinik",
    label: "Hemklinik",
    kind: "Sida",
    action: { type: "open_hemklinik" },
  });
  addHit({
    id: "page-docs",
    label: "Dokument",
    kind: "Sida",
    action: { type: "open_docs_root" },
  });

  input.activities.forEach((activity) => {
    const label = activity.label || activity.type || "Placering";
    addHit({
      id: `pl-${activity.id}`,
      label,
      kind: "Placering",
      action: { type: "select_placement", placementId: activity.id },
    });
    addHit({
      id: `pl-doc-${activity.id}`,
      label: `${label} (Dokument)`,
      kind: "Dokument",
      action: {
        type: "open_placement_docs",
        placementId: String(activity.linkedPlacementId || activity.id),
        label,
      },
    });
  });

  input.courses.forEach((course) => {
    const label = input.getCourseDisplayTitle(course);
    addHit({
      id: `cr-${course.id}`,
      label,
      kind: "Kurs",
      action: { type: "select_course", courseId: course.id },
    });
    addHit({
      id: `cr-doc-${course.id}`,
      label: `${label} (Dokument)`,
      kind: "Dokument",
      action: {
        type: "open_course_docs",
        courseId: String(course.linkedCourseId || course.id),
        label,
      },
    });
  });

  return hits.slice(0, Math.max(1, input.limit ?? 80));
}

export async function runPusslaSearchHitAction(
  hit: PusslaSearchHit,
  deps: {
    setSearchOpen: (open: boolean) => void;
    setIupOpen: (open: boolean) => void;
    setHemklinikOpen: (open: boolean) => void;
    openDocumentsFor: (target: {
      kind: "placement" | "course" | null;
      id: string | null;
      label: string;
    }) => Promise<void>;
    switchActivity: (placementId: string | null, courseId: string | null) => boolean;
  }
): Promise<void> {
  deps.setSearchOpen(false);

  if (hit.action.type === "open_iup") {
    deps.setIupOpen(true);
    return;
  }
  if (hit.action.type === "open_hemklinik") {
    deps.setHemklinikOpen(true);
    return;
  }
  if (hit.action.type === "open_docs_root") {
    await deps.openDocumentsFor({ kind: null, id: null, label: "Alla dokument" });
    return;
  }
  if (hit.action.type === "select_placement") {
    deps.switchActivity(hit.action.placementId, null);
    return;
  }
  if (hit.action.type === "select_course") {
    deps.switchActivity(null, hit.action.courseId);
    return;
  }
  if (hit.action.type === "open_placement_docs") {
    await deps.openDocumentsFor({
      kind: "placement",
      id: hit.action.placementId,
      label: hit.action.label,
    });
    return;
  }
  if (hit.action.type === "open_course_docs") {
    await deps.openDocumentsFor({
      kind: "course",
      id: hit.action.courseId,
      label: hit.action.label,
    });
  }
}

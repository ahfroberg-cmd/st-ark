type PlacementLike = {
  id: string;
  label?: string;
};

type CourseLike = {
  id: string;
  title?: string;
  startDate?: string;
};

export function buildPlacementRowsForAgent(
  placements: PlacementLike[],
  limit: number,
  getPlacementStartISOForAgent: (placement: PlacementLike) => string,
  getPlacementEndISOForAgent: (placement: PlacementLike) => string
): string[] {
  const rows = [...placements]
    .sort((a, b) => getPlacementStartISOForAgent(a).localeCompare(getPlacementStartISOForAgent(b)))
    .slice(0, limit)
    .map(
      (placement, index) =>
        `${index + 1}. ${placement.label || "Placering"} · ${getPlacementStartISOForAgent(
          placement
        )} – ${getPlacementEndISOForAgent(placement)} · id:${placement.id}`
    );
  return rows.length > 0 ? rows : ["(inga)"];
}

export function buildCourseRowsForAgent(courses: CourseLike[], limit: number): string[] {
  const rows = [...courses]
    .sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || "")))
    .slice(0, limit)
    .map(
      (course, index) =>
        `${index + 1}. ${course.title || "Kurs"} · ${String(course.startDate || "").slice(
          0,
          10
        )} · id:${course.id}`
    );
  return rows.length > 0 ? rows : ["(inga)"];
}

export function buildTimelineEntityListMessage(input: {
  target: "placements" | "courses" | "all";
  placementRows: string[];
  courseRows: string[];
}): string {
  const { target, placementRows, courseRows } = input;
  const lines: string[] = [];
  if (target === "all" || target === "placements") {
    lines.push("Placeringar:");
    lines.push(...placementRows);
  }
  if (target === "all" || target === "courses") {
    lines.push("Kurser:");
    lines.push(...courseRows);
  }
  return lines.join("\n");
}

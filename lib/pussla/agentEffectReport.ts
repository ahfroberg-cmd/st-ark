type AgentEffectLike = {
  atISO: string;
  ok: boolean;
  before?: {
    activities?: unknown[];
    courses?: unknown[];
    selectedPlacementId?: unknown;
    selectedCourseId?: unknown;
  };
  after?: {
    activities?: unknown[];
    courses?: unknown[];
    selectedPlacementId?: unknown;
    selectedCourseId?: unknown;
  };
};

export function buildLastAgentEffectMessage(last: AgentEffectLike): string {
  const beforeActivities = Array.isArray(last.before?.activities) ? last.before!.activities!.length : 0;
  const afterActivities = Array.isArray(last.after?.activities) ? last.after!.activities!.length : 0;
  const beforeCourses = Array.isArray(last.before?.courses) ? last.before!.courses!.length : 0;
  const afterCourses = Array.isArray(last.after?.courses) ? last.after!.courses!.length : 0;
  const changed =
    beforeActivities !== afterActivities ||
    beforeCourses !== afterCourses ||
    JSON.stringify(last.before?.selectedPlacementId || "") !==
      JSON.stringify(last.after?.selectedPlacementId || "") ||
    JSON.stringify(last.before?.selectedCourseId || "") !==
      JSON.stringify(last.after?.selectedCourseId || "");

  return [
    `Senaste åtgärdstid: ${last.atISO}`,
    `Resultat: ${last.ok ? "ok" : "failed"}`,
    `Observerad effekt: ${changed ? "ändring observerad" : "ingen säker ändring observerad"}`,
    `Placeringar: ${beforeActivities} -> ${afterActivities}`,
    `Kurser: ${beforeCourses} -> ${afterCourses}`,
  ].join("\n");
}

export function buildPreviewActionDiffMessage(input: {
  actionType: string;
  factor?: number;
  operator?: string;
  selectedCollectionCount?: number;
  selectedCollectionTarget?: string;
  activitiesCount: number;
  coursesCount: number;
}): string {
  const {
    actionType,
    factor,
    operator,
    selectedCollectionCount,
    selectedCollectionTarget,
    activitiesCount,
    coursesCount,
  } = input;
  const lines: string[] = [];
  switch (actionType) {
    case "create_placement_from_range":
    case "create_typed_placement_from_range":
      lines.push("Förväntad diff: +1 placering.");
      break;
    case "create_course_from_range":
    case "create_typed_course_from_range":
      lines.push("Förväntad diff: +1 kurs.");
      break;
    case "delete_selected_placement":
    case "delete_placement_by_month_year":
      lines.push("Förväntad diff: -1 placering (om träff finns).");
      break;
    case "delete_selected_course":
    case "delete_course_by_month_year":
      lines.push("Förväntad diff: -1 kurs (om träff finns).");
      break;
    case "transform_all_placements_duration":
      lines.push(`Förväntad diff: uppdaterar längd på flera placeringar (faktor ${factor}).`);
      break;
    case "apply_operator_to_collection":
      lines.push(
        `Förväntad diff: operator ${operator} på ${selectedCollectionCount || 0} valda ${
          selectedCollectionTarget || "objekt"
        }.`
      );
      break;
    default:
      lines.push(`Förväntad diff: uppdaterar objekt för action "${actionType}".`);
      break;
  }
  lines.push(`Nuvarande antal placeringar: ${activitiesCount}`);
  lines.push(`Nuvarande antal kurser: ${coursesCount}`);
  return lines.join("\n");
}

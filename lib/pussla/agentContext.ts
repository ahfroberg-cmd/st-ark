export function buildActiveAgentContextMessage(input: {
  activeLane: "placement" | "course";
  selectedPlacementLabel: string;
  selectedCourseLabel: string;
  openModals: string[];
  activitiesCount: number;
  coursesCount: number;
  dirty: boolean;
}): string {
  const {
    activeLane,
    selectedPlacementLabel,
    selectedCourseLabel,
    openModals,
    activitiesCount,
    coursesCount,
    dirty,
  } = input;
  return [
    `Aktiv lane: ${activeLane}`,
    `Vald placering: ${selectedPlacementLabel}`,
    `Vald kurs: ${selectedCourseLabel}`,
    `Öppna fönster: ${openModals.length ? openModals.join(", ") : "inga"}`,
    `Antal placeringar: ${activitiesCount}`,
    `Antal kurser: ${coursesCount}`,
    `Dirty: ${dirty ? "ja" : "nej"}`,
  ].join("\n");
}

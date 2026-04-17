export function buildSelectedPlacementLabel(input: {
  selectedPlacement: { label?: string } | null;
  getPlacementStartISOForAgent: (placement: any) => string;
  getPlacementEndISOForAgent: (placement: any) => string;
}): string {
  const { selectedPlacement, getPlacementStartISOForAgent, getPlacementEndISOForAgent } = input;
  if (!selectedPlacement) return "ingen";
  return `${selectedPlacement.label || "Placering"} (${getPlacementStartISOForAgent(
    selectedPlacement
  ) || "?"}–${getPlacementEndISOForAgent(selectedPlacement) || "?"})`;
}

export function buildSelectedCourseLabel(
  selectedCourse: { title?: string; startDate?: string } | null
): string {
  if (!selectedCourse) return "ingen";
  return `${selectedCourse.title || "Kurs"} (${String(selectedCourse.startDate || "").slice(0, 10) || "?"})`;
}

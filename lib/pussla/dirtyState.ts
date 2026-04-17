type BaselineState<TPlacement, TCourse> = {
  placement?: TPlacement;
  course?: TCourse;
} | null;

export function computeDirtyFromBaseline<TPlacement, TCourse>(input: {
  baseline: BaselineState<TPlacement, TCourse>;
  selectedPlacement: TPlacement | null | undefined;
  selectedCourse: TCourse | null | undefined;
  isPlacementDirty: (baseline: TPlacement, current: TPlacement) => boolean;
  isCourseDirty: (baseline: TCourse, current: TCourse) => boolean;
}): boolean {
  const {
    baseline,
    selectedPlacement,
    selectedCourse,
    isPlacementDirty,
    isCourseDirty,
  } = input;
  if (!baseline) return false;
  if (baseline.placement && selectedPlacement) {
    return isPlacementDirty(baseline.placement, selectedPlacement);
  }
  if (baseline.course && selectedCourse) {
    return isCourseDirty(baseline.course, selectedCourse);
  }
  return false;
}

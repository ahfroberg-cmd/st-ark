type BaselineKind = "placement" | "course" | null;

export function computeBaselineSyncPlan(input: {
  selectedPlacementId: string | null | undefined;
  selectedCourseId: string | null | undefined;
  baselinePlacementId: string | null;
  baselineCourseId: string | null;
  hasBaselinePlacement: boolean;
  hasBaselineCourse: boolean;
  hasSelectedPlacement: boolean;
  hasSelectedCourse: boolean;
}): {
  nextBaselinePlacementId: string | null;
  nextBaselineCourseId: string | null;
  clearBaseline: boolean;
  setBaselineKind: BaselineKind;
  resetDirty: boolean;
} {
  const {
    selectedPlacementId,
    selectedCourseId,
    baselinePlacementId,
    baselineCourseId,
    hasBaselinePlacement,
    hasBaselineCourse,
    hasSelectedPlacement,
    hasSelectedCourse,
  } = input;

  if (selectedPlacementId) {
    const changedSelection = baselinePlacementId !== selectedPlacementId;
    const shouldSetPlacementBaseline = (changedSelection || !hasBaselinePlacement) && hasSelectedPlacement;
    return {
      nextBaselinePlacementId: selectedPlacementId,
      nextBaselineCourseId: null,
      clearBaseline: changedSelection,
      setBaselineKind: shouldSetPlacementBaseline ? "placement" : null,
      resetDirty: changedSelection || shouldSetPlacementBaseline,
    };
  }

  if (selectedCourseId) {
    const changedSelection = baselineCourseId !== selectedCourseId;
    const shouldSetCourseBaseline = (changedSelection || !hasBaselineCourse) && hasSelectedCourse;
    return {
      nextBaselinePlacementId: null,
      nextBaselineCourseId: selectedCourseId,
      clearBaseline: changedSelection,
      setBaselineKind: shouldSetCourseBaseline ? "course" : null,
      resetDirty: changedSelection || shouldSetCourseBaseline,
    };
  }

  return {
    nextBaselinePlacementId: null,
    nextBaselineCourseId: null,
    clearBaseline: true,
    setBaselineKind: null,
    resetDirty: true,
  };
}

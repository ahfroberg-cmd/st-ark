export type TimelineCourseKind = "Kurs" | "Konferens" | "Annat" | "Utbildningsmoment";

type SelectionState = {
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  dirty: boolean;
};

type SelectionActions = {
  closeDetailPanel: () => void;
  clearSelection: () => void;
};

export type PlacementCellClickInput = SelectionState &
  SelectionActions & {
    globalSlot: number;
    addActivityAt: (slot: number) => void;
  };

export function handlePlacementCellClick(input: PlacementCellClickInput): void {
  const {
    selectedPlacementId,
    selectedCourseId,
    dirty,
    closeDetailPanel,
    clearSelection,
    globalSlot,
    addActivityAt,
  } = input;

  if (selectedPlacementId || selectedCourseId) {
    if (dirty) {
      closeDetailPanel();
      return;
    }
    clearSelection();
    addActivityAt(globalSlot);
    return;
  }

  clearSelection();
  addActivityAt(globalSlot);
}

export type ComputeCourseDateIsoInput = {
  xPx: number;
  widthPx: number;
  totalDays: number;
  year: number;
  dateToISO: (d: Date) => string;
};

export function computeCourseDateIso(input: ComputeCourseDateIsoInput): string {
  const { xPx, widthPx, totalDays, year, dateToISO } = input;
  const width = widthPx || 1;
  const pct = Math.max(0, Math.min(1, xPx / width));
  const dayIndex = Math.max(0, Math.min(totalDays - 1, Math.round(pct * (totalDays - 1))));
  return dateToISO(new Date(year, 0, 1 + dayIndex));
}

export type CourseCellClickInput = SelectionState &
  SelectionActions & {
    clickedISO: string;
    metaOrCtrlPressed: boolean;
    createCourseAt: (iso: string, kind: TimelineCourseKind) => void;
  };

export function handleCourseCellClick(input: CourseCellClickInput): void {
  const {
    selectedPlacementId,
    selectedCourseId,
    dirty,
    closeDetailPanel,
    clearSelection,
    clickedISO,
    metaOrCtrlPressed,
    createCourseAt,
  } = input;

  const newKind: TimelineCourseKind = metaOrCtrlPressed ? "Utbildningsmoment" : "Kurs";
  if (selectedPlacementId || selectedCourseId) {
    if (dirty) {
      closeDetailPanel();
      return;
    }
    clearSelection();
    createCourseAt(clickedISO, newKind);
    return;
  }
  clearSelection();
  createCourseAt(clickedISO, newKind);
}

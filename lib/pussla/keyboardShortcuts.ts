export function isAnyPusslaModalOpen(flags: {
  saveInfoOpen: boolean;
  scanOpen: boolean;
  aboutOpen: boolean;
  profileOpen: boolean;
  reportOpen: boolean;
  iupOpen: boolean;
  previewOpen: boolean;
  sta3Open: boolean;
  courseModalOpen: boolean;
  btModalOpen: boolean;
  prepareOpen: boolean;
  showCloseConfirm: boolean;
  showDeleteConfirm: boolean;
  aiAgentActivationPromptOpen: boolean;
  aiAgentInfoOpen: boolean;
}): boolean {
  return (
    flags.saveInfoOpen ||
    flags.scanOpen ||
    flags.aboutOpen ||
    flags.profileOpen ||
    flags.reportOpen ||
    flags.iupOpen ||
    flags.previewOpen ||
    flags.sta3Open ||
    flags.courseModalOpen ||
    flags.btModalOpen ||
    flags.prepareOpen ||
    flags.showCloseConfirm ||
    flags.showDeleteConfirm ||
    flags.aiAgentActivationPromptOpen ||
    flags.aiAgentInfoOpen
  );
}

export function handlePusslaGlobalKeyDown(input: {
  event: KeyboardEvent;
  anyModalOpen: boolean;
  selectedPlacement: any;
  selectedCourse: any;
  dirty: boolean;
  savePlacement: (placement: any) => Promise<any> | void;
  saveCourse: (course: any) => Promise<any> | void;
  openSaveInfo: () => void;
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  closeDetailPanel: () => Promise<any> | void;
  triggerCloseOnTopmostModal: () => boolean;
  requestDeletePlacement: () => void;
  requestDeleteCourse: () => void;
}): void {
  const e = input.event;

  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    if (input.anyModalOpen) return;
    e.preventDefault();
    if (input.selectedPlacement && input.dirty) {
      void input.savePlacement(input.selectedPlacement);
      return;
    }
    if (input.selectedCourse && input.dirty) {
      void input.saveCourse(input.selectedCourse);
      return;
    }
    input.openSaveInfo();
    return;
  }

  if (e.key === "Escape") {
    if (input.anyModalOpen) {
      const closed = input.triggerCloseOnTopmostModal();
      if (closed) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
    }
    if (input.selectedPlacementId || input.selectedCourseId) {
      e.preventDefault();
      void input.closeDetailPanel();
      return;
    }
  }

  const tagName = (e.target as HTMLElement)?.tagName;
  const isInput = tagName === "INPUT" || tagName === "TEXTAREA";
  if (isInput) return;

  if (e.key === "Delete" || e.key === "Backspace") {
    if (input.selectedPlacement) {
      input.requestDeletePlacement();
    } else if (input.selectedCourse) {
      input.requestDeleteCourse();
    }
  }
}

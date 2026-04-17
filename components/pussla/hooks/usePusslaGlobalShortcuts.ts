"use client";

import { useEffect } from "react";
import { triggerCloseOnTopmostModal } from "@/lib/modalEscHandler";
import { handlePusslaGlobalKeyDown, isAnyPusslaModalOpen } from "@/lib/pussla/keyboardShortcuts";

export function usePusslaGlobalShortcuts(params: {
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
  selectedPlacement: any;
  selectedCourse: any;
  dirty: boolean;
  savePlacementToDb: (placement: any) => Promise<boolean>;
  saveCourseToDb: (course: any) => Promise<boolean>;
  setSaveInfoOpen: (open: boolean) => void;
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  closeDetailPanel: () => void;
  requestDeletePlacement: () => void;
  requestDeleteCourse: () => void;
}) {
  useEffect(() => {
    const anyModalOpen = isAnyPusslaModalOpen({
      saveInfoOpen: params.saveInfoOpen,
      scanOpen: params.scanOpen,
      aboutOpen: params.aboutOpen,
      profileOpen: params.profileOpen,
      reportOpen: params.reportOpen,
      iupOpen: params.iupOpen,
      previewOpen: params.previewOpen,
      sta3Open: params.sta3Open,
      courseModalOpen: params.courseModalOpen,
      btModalOpen: params.btModalOpen,
      prepareOpen: params.prepareOpen,
      showCloseConfirm: params.showCloseConfirm,
      showDeleteConfirm: params.showDeleteConfirm,
      aiAgentActivationPromptOpen: params.aiAgentActivationPromptOpen,
      aiAgentInfoOpen: params.aiAgentInfoOpen,
    });

    function handleKeyDown(e: KeyboardEvent) {
      handlePusslaGlobalKeyDown({
        event: e,
        anyModalOpen,
        selectedPlacement: params.selectedPlacement,
        selectedCourse: params.selectedCourse,
        dirty: params.dirty,
        savePlacement: (placement) => params.savePlacementToDb(placement),
        saveCourse: (course) => params.saveCourseToDb(course),
        openSaveInfo: () => params.setSaveInfoOpen(true),
        selectedPlacementId: params.selectedPlacementId,
        selectedCourseId: params.selectedCourseId,
        closeDetailPanel: params.closeDetailPanel,
        triggerCloseOnTopmostModal,
        requestDeletePlacement: params.requestDeletePlacement,
        requestDeleteCourse: params.requestDeleteCourse,
      });
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [params]);
}

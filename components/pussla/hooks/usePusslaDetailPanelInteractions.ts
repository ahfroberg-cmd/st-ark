"use client";

import { useCallback } from "react";
import {
  cancelCloseDetailPanelAction,
  closeDetailPanelAction,
  confirmCloseDetailPanelAction,
  saveAndCloseDetailPanelAction,
  switchActivityAction,
} from "@/lib/pussla/detailPanelUiActions";
import { requestDeleteCourseAction, requestDeletePlacementAction } from "@/lib/pussla/detailPanelDeleteActions";
import { usePusslaGlobalShortcuts } from "@/components/pussla/hooks/usePusslaGlobalShortcuts";

export function usePusslaDetailPanelInteractions(params: any) {
  const closeDetailPanel = useCallback(() => {
    closeDetailPanelAction({
      dirty: params.dirty,
      setShowCloseConfirm: params.setShowCloseConfirm,
      setDirty: params.setDirty,
      setSelectedPlacementId: params.setSelectedPlacementId,
      setSelectedCourseId: params.setSelectedCourseId,
    });
  }, [params.dirty, params.setShowCloseConfirm, params.setDirty, params.setSelectedPlacementId, params.setSelectedCourseId]);

  const handleConfirmClose = useCallback(() => {
    confirmCloseDetailPanelAction({
      restoreBaseline: params.restoreBaseline,
      pendingSwitchPlacementId: params.pendingSwitchPlacementId,
      pendingSwitchCourseId: params.pendingSwitchCourseId,
      setDirty: params.setDirty,
      setShowCloseConfirm: params.setShowCloseConfirm,
      setSelectedPlacementId: params.setSelectedPlacementId,
      setSelectedCourseId: params.setSelectedCourseId,
      setPendingSwitchPlacementId: params.setPendingSwitchPlacementId,
      setPendingSwitchCourseId: params.setPendingSwitchCourseId,
    });
  }, [
    params.restoreBaseline,
    params.pendingSwitchPlacementId,
    params.pendingSwitchCourseId,
    params.setDirty,
    params.setShowCloseConfirm,
    params.setSelectedPlacementId,
    params.setSelectedCourseId,
    params.setPendingSwitchPlacementId,
    params.setPendingSwitchCourseId,
  ]);

  const handleSaveAndClose = useCallback(async () => {
    await saveAndCloseDetailPanelAction({
      selectedPlacement: params.selectedPlacement,
      selectedCourse: params.selectedCourse,
      savePlacementToDb: params.savePlacementToDb,
      saveCourseToDb: params.saveCourseToDb,
      pendingSwitchPlacementId: params.pendingSwitchPlacementId,
      pendingSwitchCourseId: params.pendingSwitchCourseId,
      setDirty: params.setDirty,
      setShowCloseConfirm: params.setShowCloseConfirm,
      setSelectedPlacementId: params.setSelectedPlacementId,
      setSelectedCourseId: params.setSelectedCourseId,
      setPendingSwitchPlacementId: params.setPendingSwitchPlacementId,
      setPendingSwitchCourseId: params.setPendingSwitchCourseId,
    });
  }, [
    params.selectedPlacement,
    params.selectedCourse,
    params.savePlacementToDb,
    params.saveCourseToDb,
    params.pendingSwitchPlacementId,
    params.pendingSwitchCourseId,
    params.setDirty,
    params.setShowCloseConfirm,
    params.setSelectedPlacementId,
    params.setSelectedCourseId,
    params.setPendingSwitchPlacementId,
    params.setPendingSwitchCourseId,
  ]);

  const handleCancelClose = useCallback(() => {
    cancelCloseDetailPanelAction({
      setShowCloseConfirm: params.setShowCloseConfirm,
      setPendingSwitchPlacementId: params.setPendingSwitchPlacementId,
      setPendingSwitchCourseId: params.setPendingSwitchCourseId,
    });
  }, [params.setShowCloseConfirm, params.setPendingSwitchPlacementId, params.setPendingSwitchCourseId]);

  const requestDeletePlacement = useCallback(() => {
    requestDeletePlacementAction({
      selectedPlacement: params.selectedPlacement,
      dirty: params.dirty,
      authUserId: params.authUserId,
      getSessionUser: params.getSessionUser,
      deletePlacementForUser: params.deletePlacementForUser,
      setActivities: params.setActivities,
      setSelectedPlacementId: params.setSelectedPlacementId,
      setDirty: params.setDirty,
      refreshLists: params.refreshLists,
      setShowDeleteConfirm: params.setShowDeleteConfirm,
      setDeleteConfirmConfig: params.setDeleteConfirmConfig,
      logAudit: params.logAudit,
    });
  }, [
    params.selectedPlacement,
    params.dirty,
    params.authUserId,
    params.getSessionUser,
    params.deletePlacementForUser,
    params.setActivities,
    params.setSelectedPlacementId,
    params.setDirty,
    params.refreshLists,
    params.setShowDeleteConfirm,
    params.setDeleteConfirmConfig,
    params.logAudit,
  ]);

  const requestDeleteCourse = useCallback(() => {
    requestDeleteCourseAction({
      selectedCourse: params.selectedCourse,
      dirty: params.dirty,
      authUserId: params.authUserId,
      getSessionUser: params.getSessionUser,
      deleteCourseForUser: params.deleteCourseForUser,
      setCourses: params.setCourses,
      setSelectedCourseId: params.setSelectedCourseId,
      setDirty: params.setDirty,
      refreshLists: params.refreshLists,
      setShowDeleteConfirm: params.setShowDeleteConfirm,
      setDeleteConfirmConfig: params.setDeleteConfirmConfig,
      logAudit: params.logAudit,
    });
  }, [
    params.selectedCourse,
    params.dirty,
    params.authUserId,
    params.getSessionUser,
    params.deleteCourseForUser,
    params.setCourses,
    params.setSelectedCourseId,
    params.setDirty,
    params.refreshLists,
    params.setShowDeleteConfirm,
    params.setDeleteConfirmConfig,
    params.logAudit,
  ]);

  const switchActivity = useCallback(
    (newPlacementId: string | null, newCourseId: string | null) => {
      return switchActivityAction({
        newPlacementId,
        newCourseId,
        selectedPlacementId: params.selectedPlacementId,
        selectedCourseId: params.selectedCourseId,
        dirty: params.dirty,
        setPendingSwitchPlacementId: params.setPendingSwitchPlacementId,
        setPendingSwitchCourseId: params.setPendingSwitchCourseId,
        setShowCloseConfirm: params.setShowCloseConfirm,
        setDirty: params.setDirty,
        setSelectedPlacementId: params.setSelectedPlacementId,
        setSelectedCourseId: params.setSelectedCourseId,
      });
    },
    [
      params.selectedPlacementId,
      params.selectedCourseId,
      params.dirty,
      params.setPendingSwitchPlacementId,
      params.setPendingSwitchCourseId,
      params.setShowCloseConfirm,
      params.setDirty,
      params.setSelectedPlacementId,
      params.setSelectedCourseId,
    ]
  );

  usePusslaGlobalShortcuts({
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
    selectedPlacement: params.selectedPlacement,
    selectedCourse: params.selectedCourse,
    dirty: params.dirty,
    savePlacementToDb: params.savePlacementToDb,
    saveCourseToDb: params.saveCourseToDb,
    setSaveInfoOpen: params.setSaveInfoOpen,
    selectedPlacementId: params.selectedPlacementId,
    selectedCourseId: params.selectedCourseId,
    closeDetailPanel,
    requestDeletePlacement,
    requestDeleteCourse,
  });

  return {
    closeDetailPanel,
    handleConfirmClose,
    handleSaveAndClose,
    handleCancelClose,
    requestDeletePlacement,
    requestDeleteCourse,
    switchActivity,
  };
}

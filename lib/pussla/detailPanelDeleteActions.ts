import { createCourseDeleteConfirm, createPlacementDeleteConfirm } from "@/lib/pussla/detailPanelActions";

export function requestDeletePlacementAction(params: {
  selectedPlacement: any;
  dirty: boolean;
  authUserId: string | undefined;
  getSessionUser: any;
  deletePlacementForUser: any;
  setActivities: any;
  setSelectedPlacementId: (id: string | null) => void;
  setDirty: (value: boolean) => void;
  refreshLists: () => Promise<void>;
  setShowDeleteConfirm: (open: boolean) => void;
  setDeleteConfirmConfig: (config: any) => void;
  logAudit: any;
}) {
  const config = createPlacementDeleteConfirm({
    selectedPlacement: params.selectedPlacement as any,
    dirty: params.dirty,
    authUserId: params.authUserId,
    getSessionUser: params.getSessionUser,
    deletePlacementForUser: params.deletePlacementForUser,
    setActivities: params.setActivities,
    setSelectedPlacementId: params.setSelectedPlacementId,
    setDirty: params.setDirty,
    refreshLists: params.refreshLists,
    clearDeleteDialog: () => {
      params.setShowDeleteConfirm(false);
      params.setDeleteConfirmConfig(null);
    },
    logAudit: params.logAudit,
  });
  if (!config) return;
  params.setDeleteConfirmConfig(config);
  params.setShowDeleteConfirm(true);
}

export function requestDeleteCourseAction(params: {
  selectedCourse: any;
  dirty: boolean;
  authUserId: string | undefined;
  getSessionUser: any;
  deleteCourseForUser: any;
  setCourses: any;
  setSelectedCourseId: (id: string | null) => void;
  setDirty: (value: boolean) => void;
  refreshLists: () => Promise<void>;
  setShowDeleteConfirm: (open: boolean) => void;
  setDeleteConfirmConfig: (config: any) => void;
  logAudit: any;
}) {
  const config = createCourseDeleteConfirm({
    selectedCourse: params.selectedCourse as any,
    dirty: params.dirty,
    authUserId: params.authUserId,
    getSessionUser: params.getSessionUser,
    deleteCourseForUser: params.deleteCourseForUser,
    setCourses: params.setCourses,
    setSelectedCourseId: params.setSelectedCourseId,
    setDirty: params.setDirty,
    refreshLists: params.refreshLists,
    clearDeleteDialog: () => {
      params.setShowDeleteConfirm(false);
      params.setDeleteConfirmConfig(null);
    },
    logAudit: params.logAudit,
  });
  if (!config) return;
  params.setDeleteConfirmConfig(config);
  params.setShowDeleteConfirm(true);
}

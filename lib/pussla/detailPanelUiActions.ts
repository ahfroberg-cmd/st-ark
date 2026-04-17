import { decideSwitchActivity, resolveCloseSelectionTargets } from "@/lib/pussla/detailPanelActions";

export function closeDetailPanelAction(params: {
  dirty: boolean;
  setShowCloseConfirm: (open: boolean) => void;
  setDirty: (value: boolean) => void;
  setSelectedPlacementId: (id: string | null) => void;
  setSelectedCourseId: (id: string | null) => void;
}) {
  if (params.dirty) {
    params.setShowCloseConfirm(true);
    return;
  }
  params.setDirty(false);
  params.setSelectedPlacementId(null);
  params.setSelectedCourseId(null);
}

export function confirmCloseDetailPanelAction(params: {
  restoreBaseline: () => void;
  pendingSwitchPlacementId: string | null;
  pendingSwitchCourseId: string | null;
  setDirty: (value: boolean) => void;
  setShowCloseConfirm: (open: boolean) => void;
  setSelectedPlacementId: (id: string | null) => void;
  setSelectedCourseId: (id: string | null) => void;
  setPendingSwitchPlacementId: (id: string | null) => void;
  setPendingSwitchCourseId: (id: string | null) => void;
}) {
  params.restoreBaseline();
  params.setDirty(false);
  params.setShowCloseConfirm(false);
  const closeTargets = resolveCloseSelectionTargets({
    pendingSwitchPlacementId: params.pendingSwitchPlacementId,
    pendingSwitchCourseId: params.pendingSwitchCourseId,
  });
  params.setSelectedPlacementId(closeTargets.nextPlacementId);
  params.setSelectedCourseId(closeTargets.nextCourseId);
  if (closeTargets.clearPending) {
    params.setPendingSwitchPlacementId(null);
    params.setPendingSwitchCourseId(null);
  }
}

export async function saveAndCloseDetailPanelAction(params: {
  selectedPlacement: any;
  selectedCourse: any;
  savePlacementToDb: (placement: any) => Promise<boolean>;
  saveCourseToDb: (course: any) => Promise<boolean>;
  pendingSwitchPlacementId: string | null;
  pendingSwitchCourseId: string | null;
  setDirty: (value: boolean) => void;
  setShowCloseConfirm: (open: boolean) => void;
  setSelectedPlacementId: (id: string | null) => void;
  setSelectedCourseId: (id: string | null) => void;
  setPendingSwitchPlacementId: (id: string | null) => void;
  setPendingSwitchCourseId: (id: string | null) => void;
}) {
  const ok = params.selectedPlacement
    ? await params.savePlacementToDb(params.selectedPlacement)
    : params.selectedCourse
    ? await params.saveCourseToDb(params.selectedCourse)
    : true;
  if (!ok) return;
  params.setDirty(false);
  params.setShowCloseConfirm(false);
  const closeTargets = resolveCloseSelectionTargets({
    pendingSwitchPlacementId: params.pendingSwitchPlacementId,
    pendingSwitchCourseId: params.pendingSwitchCourseId,
  });
  params.setSelectedPlacementId(closeTargets.nextPlacementId);
  params.setSelectedCourseId(closeTargets.nextCourseId);
  if (closeTargets.clearPending) {
    params.setPendingSwitchPlacementId(null);
    params.setPendingSwitchCourseId(null);
  }
}

export function cancelCloseDetailPanelAction(params: {
  setShowCloseConfirm: (open: boolean) => void;
  setPendingSwitchPlacementId: (id: string | null) => void;
  setPendingSwitchCourseId: (id: string | null) => void;
}) {
  params.setShowCloseConfirm(false);
  params.setPendingSwitchPlacementId(null);
  params.setPendingSwitchCourseId(null);
}

export function switchActivityAction(params: {
  newPlacementId: string | null;
  newCourseId: string | null;
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  dirty: boolean;
  setPendingSwitchPlacementId: (id: string | null) => void;
  setPendingSwitchCourseId: (id: string | null) => void;
  setShowCloseConfirm: (open: boolean) => void;
  setDirty: (value: boolean) => void;
  setSelectedPlacementId: (id: string | null) => void;
  setSelectedCourseId: (id: string | null) => void;
}) {
  const decision = decideSwitchActivity({
    newPlacementId: params.newPlacementId,
    newCourseId: params.newCourseId,
    selectedPlacementId: params.selectedPlacementId,
    selectedCourseId: params.selectedCourseId,
    dirty: params.dirty,
  });
  if (!decision.accepted && decision.showCloseConfirm) {
    params.setPendingSwitchPlacementId(params.newPlacementId);
    params.setPendingSwitchCourseId(params.newCourseId);
    params.setShowCloseConfirm(true);
    return false;
  }
  if (!decision.accepted) return false;
  params.setDirty(false);
  params.setSelectedPlacementId(params.newPlacementId);
  params.setSelectedCourseId(params.newCourseId);
  return true;
}

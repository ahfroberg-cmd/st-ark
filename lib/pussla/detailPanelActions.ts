type PlacementLike = {
  id: string;
  type?: string;
  label?: string;
  linkedPlacementId?: string;
};

type CourseLike = {
  id: string;
  title?: string;
  linkedCourseId?: string;
};

export function resolveCloseSelectionTargets(input: {
  pendingSwitchPlacementId: string | null;
  pendingSwitchCourseId: string | null;
}): { nextPlacementId: string | null; nextCourseId: string | null; clearPending: boolean } {
  const hasPending =
    input.pendingSwitchPlacementId !== null || input.pendingSwitchCourseId !== null;
  if (hasPending) {
    return {
      nextPlacementId: input.pendingSwitchPlacementId,
      nextCourseId: input.pendingSwitchCourseId,
      clearPending: true,
    };
  }
  return { nextPlacementId: null, nextCourseId: null, clearPending: false };
}

export function decideSwitchActivity(input: {
  newPlacementId: string | null;
  newCourseId: string | null;
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  dirty: boolean;
}): { accepted: boolean; showCloseConfirm: boolean } {
  const sameSelection =
    input.newPlacementId === input.selectedPlacementId &&
    input.newCourseId === input.selectedCourseId;
  if (sameSelection) return { accepted: true, showCloseConfirm: false };
  if (input.dirty) return { accepted: false, showCloseConfirm: true };
  return { accepted: true, showCloseConfirm: false };
}

function deleteConfirmMessage(dirty: boolean): string {
  return dirty
    ? "Du har osparade ändringar. Ta bort ändå?"
    : "Vill du ta bort vald aktivitet?";
}

export function createPlacementDeleteConfirm(input: {
  selectedPlacement: PlacementLike | null;
  dirty: boolean;
  authUserId?: string;
  getSessionUser: () => Promise<any>;
  deletePlacementForUser: (userId: string, placementId: string) => Promise<any>;
  setActivities: (updater: (prev: any[]) => any[]) => void;
  setSelectedPlacementId: (id: string | null) => void;
  setDirty: (dirty: boolean) => void;
  refreshLists: () => Promise<void>;
  clearDeleteDialog: () => void;
  logAudit: (
    action: any,
    table: string,
    message: string,
    resourceId?: string
  ) => Promise<void> | void;
}): { message: string; onConfirm: () => Promise<void> } | null {
  if (!input.selectedPlacement) return null;
  const placement = input.selectedPlacement;
  return {
    message: deleteConfirmMessage(input.dirty),
    onConfirm: async () => {
      if (placement.linkedPlacementId) {
        let userId = input.authUserId;
        if (!userId) {
          const user = await input.getSessionUser();
          userId = user?.id;
        }
        if (userId) {
          try {
            await input.deletePlacementForUser(userId, placement.linkedPlacementId);
          } catch {
            // ignore remote delete errors
          }
        }
      }
      input.setActivities((prev) => prev.filter((item) => item.id !== placement.id));
      input.setSelectedPlacementId(null);
      input.setDirty(false);
      await input.refreshLists();
      input.clearDeleteDialog();
      void input.logAudit(
        "delete",
        "placements",
        `Raderade: ${placement.type || "Aktivitet"} ${placement.label || ""}`,
        placement.linkedPlacementId || placement.id
      );
    },
  };
}

export function createCourseDeleteConfirm(input: {
  selectedCourse: CourseLike | null;
  dirty: boolean;
  authUserId?: string;
  getSessionUser: () => Promise<any>;
  deleteCourseForUser: (userId: string, courseId: string) => Promise<any>;
  setCourses: (updater: (prev: any[]) => any[]) => void;
  setSelectedCourseId: (id: string | null) => void;
  setDirty: (dirty: boolean) => void;
  refreshLists: () => Promise<void>;
  clearDeleteDialog: () => void;
  logAudit: (
    action: any,
    table: string,
    message: string,
    resourceId?: string
  ) => Promise<void> | void;
}): { message: string; onConfirm: () => Promise<void> } | null {
  if (!input.selectedCourse) return null;
  const course = input.selectedCourse;
  return {
    message: deleteConfirmMessage(input.dirty),
    onConfirm: async () => {
      const id = course.id;
      const linkedId = course.linkedCourseId;
      if (linkedId) {
        let userId = input.authUserId;
        if (!userId) {
          const user = await input.getSessionUser();
          userId = user?.id;
        }
        if (userId) {
          try {
            await input.deleteCourseForUser(userId, linkedId);
          } catch {
            // ignore remote delete errors
          }
        }
        await input.refreshLists();
      }
      input.setCourses((prev) => prev.filter((item) => item.id !== id));
      input.setSelectedCourseId(null);
      input.setDirty(false);
      input.clearDeleteDialog();
      void input.logAudit(
        "delete",
        "courses",
        `Raderade kurs: ${course.title || ""}`,
        linkedId || id
      );
    },
  };
}

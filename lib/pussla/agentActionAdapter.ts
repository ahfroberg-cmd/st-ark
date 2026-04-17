import type { PusslaActionAdapter } from "@/lib/ai/pusslaActionExecutor";

export function createPusslaAgentActionAdapter(params: {
  setActiveLane: (lane: "placement" | "course") => void;
  openAgentWindow: (windowName: string) => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
  closeAgentWindow: (windowName: string) => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
  setIupInitialTab: (tab: any) => void;
  setIupOpen: (open: boolean) => void;
  createPlacementFromDateRange: any;
  createCourseFromDateRange: any;
  selectPlacementForAgent: any;
  selectCourseForAgent: any;
  updateSelectedPlacementForAgent: any;
  updateSelectedCourseForAgent: any;
  selectedPlacement: any;
  selectedCourseIdRef: any;
  selectedCourseId: string | null;
  courses: any[];
  savePlacementToDb: any;
  saveCourseToDb: any;
  setAllProfilePhoneNumbersForAgent: any;
  extendLastPlacementForAgent: any;
  shiftPlacementFromEndForAgent: any;
  transformAllPlacementsDurationForAgent: any;
  shiftAllCoursesForAgent: any;
  rebalanceCoursesPerHalfYearForAgent: any;
  planTimelineDistributionForAgent: any;
  deleteSelectedPlacementForAgent: any;
  deleteSelectedCourseForAgent: any;
  deletePlacementByMonthYearForAgent: any;
  deleteCourseByMonthYearForAgent: any;
  convertCourseToUtbildningsmomentForAgent: any;
  planStFromSrTemplatesForAgent: any;
  planCoursesCoverCourseMilestonesForAgent: any;
  syncCoursesMilestonesForAgent: any;
  summarizeGoalCatalogForAgent: any;
  summarizeAppSectionsForAgent: any;
  summarizeRoleViewsForAgent: any;
  getActiveContextForAgent: any;
  listTimelineEntitiesForAgent: any;
  listInternalGapsForAgent: any;
  verifyLastActionEffectForAgent: any;
  previewActionDiffForAgent: any;
  selectCollectionForAgent: any;
  applyOperatorToCollectionForAgent: any;
  clearIupFollowupsForAgent: any;
  addIupFollowupForAgent: any;
  addIupSupervisionMeetingsForAgent: any;
  shiftIupSupervisionMeetingsForAgent: any;
  removeIupSupervisionMeetingsByDatesForAgent: any;
  undoLastAgentMutationForAgent: any;
  colleaguePlacementDescriptions: any[];
  colleagueCourseDescriptions: any[];
  saveVersionSnapshotBeforeMutation: any;
}): PusslaActionAdapter {
  return {
    navigateLane: async (lane) => {
      params.setActiveLane(lane);
      return {
        ok: true,
        message: lane === "placement" ? "Öppnade vyn för klinisk tjänstgöring." : "Öppnade kursvyn.",
      };
    },
    openWindow: async (windowName) => params.openAgentWindow(windowName),
    closeWindow: async (windowName) => params.closeAgentWindow(windowName),
    setIupTab: async (tab) => {
      params.setIupInitialTab(tab);
      params.setIupOpen(true);
      return { ok: true, message: `Öppnade IUP-fliken ${tab}.` };
    },
    createPlacementFromRange: async (title, startDate, endDate) =>
      params.createPlacementFromDateRange(title, startDate, endDate),
    createTypedPlacementFromRange: async (placementType, title, startDate, endDate) =>
      params.createPlacementFromDateRange(title, startDate, endDate, placementType),
    createCourseFromRange: async (title, startDate, endDate) =>
      params.createCourseFromDateRange(title, startDate, endDate),
    createTypedCourseFromRange: async (courseKind, title, startDate, endDate) =>
      params.createCourseFromDateRange(title, startDate, endDate, courseKind),
    selectPlacement: async (query) => params.selectPlacementForAgent(query),
    selectCourse: async (query) => params.selectCourseForAgent(query),
    updateSelectedPlacement: async (fields) => params.updateSelectedPlacementForAgent(fields),
    updateSelectedCourse: async (fields) => params.updateSelectedCourseForAgent(fields),
    saveSelectedPlacement: async () => {
      if (!params.selectedPlacement) return { ok: false, message: "Ingen vald placering att spara." };
      return (await params.savePlacementToDb(params.selectedPlacement))
        ? { ok: true, message: "Vald placering sparades i databasen." }
        : { ok: false, message: "Kunde inte spara vald placering." };
    },
    saveSelectedCourse: async () => {
      const selectedForAgent = (() => {
        const id = params.selectedCourseIdRef.current || params.selectedCourseId;
        if (!id) return null;
        return params.courses.find((c) => c.id === id) || null;
      })();
      if (!selectedForAgent) return { ok: false, message: "Ingen vald kurs att spara." };
      return (await params.saveCourseToDb(selectedForAgent))
        ? { ok: true, message: "Vald kurs sparades i databasen." }
        : { ok: false, message: "Kunde inte spara vald kurs." };
    },
    setAllProfilePhoneNumbers: params.setAllProfilePhoneNumbersForAgent,
    extendLastPlacement: async (positionFromEnd, months, endDate, placementTitle) =>
      params.extendLastPlacementForAgent(positionFromEnd, months, endDate, placementTitle),
    shiftPlacementFromEnd: params.shiftPlacementFromEndForAgent,
    transformAllPlacementsDuration: params.transformAllPlacementsDurationForAgent,
    shiftAllCourses: params.shiftAllCoursesForAgent,
    rebalanceCoursesPerHalfYear: params.rebalanceCoursesPerHalfYearForAgent,
    planTimelineDistribution: params.planTimelineDistributionForAgent,
    deleteSelectedPlacement: params.deleteSelectedPlacementForAgent,
    deleteSelectedCourse: params.deleteSelectedCourseForAgent,
    deletePlacementByMonthYear: params.deletePlacementByMonthYearForAgent,
    deleteCourseByMonthYear: params.deleteCourseByMonthYearForAgent,
    convertCourseToUtbildningsmoment: params.convertCourseToUtbildningsmomentForAgent,
    planStFromSrTemplates: params.planStFromSrTemplatesForAgent,
    planCoursesCoverCourseMilestones: params.planCoursesCoverCourseMilestonesForAgent,
    syncCourseMilestones: params.syncCoursesMilestonesForAgent,
    summarizeGoalCatalog: params.summarizeGoalCatalogForAgent,
    summarizeAppSections: params.summarizeAppSectionsForAgent,
    summarizeRoleViews: params.summarizeRoleViewsForAgent,
    getActiveContext: params.getActiveContextForAgent,
    listTimelineEntities: params.listTimelineEntitiesForAgent,
    listInternalGaps: params.listInternalGapsForAgent,
    verifyLastActionEffect: params.verifyLastActionEffectForAgent,
    previewActionDiff: params.previewActionDiffForAgent,
    selectCollection: params.selectCollectionForAgent,
    applyOperatorToCollection: params.applyOperatorToCollectionForAgent,
    clearIupFollowups: params.clearIupFollowupsForAgent,
    addIupFollowup: params.addIupFollowupForAgent,
    addIupSupervisionMeetings: params.addIupSupervisionMeetingsForAgent,
    shiftIupSupervisionMeetings: params.shiftIupSupervisionMeetingsForAgent,
    removeIupSupervisionMeetingsByDates: params.removeIupSupervisionMeetingsByDatesForAgent,
    undoLastAgentMutation: params.undoLastAgentMutationForAgent,
    getColleaguePlacementDescriptions: () => params.colleaguePlacementDescriptions,
    getColleagueCourseDescriptions: () => params.colleagueCourseDescriptions,
    preflightSnapshotBeforeMutation: params.saveVersionSnapshotBeforeMutation,
  };
}

import { collectOpenAgentModals } from "@/lib/pussla/agentModals";
import {
  buildSelectedCourseLabel,
  buildSelectedPlacementLabel,
} from "@/lib/pussla/agentSelectionLabels";
import { buildActiveAgentContextMessage } from "@/lib/pussla/agentContext";
import {
  buildCourseRowsForAgent,
  buildPlacementRowsForAgent,
  buildTimelineEntityListMessage,
} from "@/lib/pussla/agentEntityList";
import { buildInternalGapMessage } from "@/lib/pussla/agentGapList";
import {
  buildLastAgentEffectMessage,
  buildPreviewActionDiffMessage,
} from "@/lib/pussla/agentEffectReport";
import {
  buildAgentCollectionSelectionMessage,
  buildAgentCollectionSelectionRef,
  buildCourseCollectionEntities,
  buildPlacementCollectionEntities,
  selectAgentCollectionEntities,
} from "@/lib/pussla/agentCollectionSelection";
import {
  removeEntitiesByIds,
  setCourseKindByIds,
  shiftPlacementsByMonths,
} from "@/lib/pussla/agentCollectionOperators";
import {
  buildDeleteCollectionMessage,
  buildSetCourseKindMessage,
  buildShiftPlacementMonthsMessage,
} from "@/lib/pussla/agentCollectionOperatorFeedback";
import { resolveSupabaseUserId } from "@/lib/pussla/supabaseAuth";
import { fetchNormalizedIupSettings, saveNormalizedIupSettings } from "@/lib/pussla/iupSettingsIO";
import { clearFollowups, addFollowupToCollections, upsertFollowupSession } from "@/lib/pussla/iupFollowupMutations";
import {
  buildAddedFollowupMessage,
  buildAddedSupervisionMeetingsBatchMessage,
  buildClearedFollowupsMessage,
  buildRemovedSupervisionMeetingsByDatesMessage,
  buildShiftSupervisionMeetingsMessage,
} from "@/lib/pussla/iupFollowupFeedback";
import {
  removeMeetingsOnDates,
  shiftMeetingsByDays,
  supervisionTimelineFromMeetings,
} from "@/lib/pussla/iupSupervisionMeetingOps";
import { MAX_SUPERVISION_MEETING_DATES_PER_ACTION } from "@/lib/pussla/iupSupervisionLimits";
import { normalizeIsoDateInput, isIsoDateInput } from "@/lib/pussla/dateInput";
import { toAgentErrorMessage } from "@/lib/pussla/agentErrors";

export function getActiveContextForAgentZone(params: {
  modalFlags: {
    iupOpen: boolean;
    hemklinikOpen: boolean;
    scanOpen: boolean;
    prepareOpen: boolean;
    btModalOpen: boolean;
    profileOpen: boolean;
    aboutOpen: boolean;
    reportOpen: boolean;
    settingsOpen: boolean;
    sta3Open: boolean;
    courseModalOpen: boolean;
    previewOpen: boolean;
    milestoneOverviewOpen: boolean;
  };
  selectedPlacement: any;
  selectedCourse: any;
  getPlacementStartISOForAgent: (placement: any) => string;
  getPlacementEndISOForAgent: (placement: any) => string;
  activeLane: "placement" | "course";
  activitiesCount: number;
  coursesCount: number;
  dirty: boolean;
}): { ok: boolean; message: string } {
  const openModals = collectOpenAgentModals(params.modalFlags);
  const selectedPlacementLabel = buildSelectedPlacementLabel({
    selectedPlacement: params.selectedPlacement,
    getPlacementStartISOForAgent: params.getPlacementStartISOForAgent,
    getPlacementEndISOForAgent: params.getPlacementEndISOForAgent,
  });
  const selectedCourseLabel = buildSelectedCourseLabel(params.selectedCourse);
  return {
    ok: true,
    message: buildActiveAgentContextMessage({
      activeLane: params.activeLane,
      selectedPlacementLabel,
      selectedCourseLabel,
      openModals,
      activitiesCount: params.activitiesCount,
      coursesCount: params.coursesCount,
      dirty: params.dirty,
    }),
  };
}

export function listTimelineEntitiesForAgentZone(params: {
  target?: "placements" | "courses" | "all";
  limit?: number;
  activities: any[];
  courses: any[];
  getPlacementStartISOForAgent: (placement: any) => string;
  getPlacementEndISOForAgent: (placement: any) => string;
}): { ok: boolean; message: string } {
  const target = params.target || "all";
  const limit = Math.max(1, Math.min(50, Number(params.limit || 20)));
  const placementRows = buildPlacementRowsForAgent(
    params.activities,
    limit,
    params.getPlacementStartISOForAgent,
    params.getPlacementEndISOForAgent
  );
  const courseRows = buildCourseRowsForAgent(params.courses, limit);
  return {
    ok: true,
    message: buildTimelineEntityListMessage({ target, placementRows, courseRows }),
  };
}

export function listInternalGapsForAgentZone(params: {
  activities: any[];
  getPlacementStartISOForAgent: (placement: any) => string;
  getPlacementEndISOForAgent: (placement: any) => string;
}): { ok: boolean; message: string } {
  return {
    ok: true,
    message: buildInternalGapMessage({
      placements: params.activities,
      getPlacementStartISOForAgent: params.getPlacementStartISOForAgent,
      getPlacementEndISOForAgent: params.getPlacementEndISOForAgent,
    }),
  };
}

export function verifyLastActionEffectForAgentZone(last: any): { ok: boolean; message: string } {
  if (!last) {
    return { ok: false, message: "Ingen tidigare agentåtgärd finns att verifiera ännu." };
  }
  return { ok: true, message: buildLastAgentEffectMessage(last) };
}

export function previewActionDiffForAgentZone(params: {
  action: any;
  selectedCollection: { ids: string[]; target: string } | null;
  activitiesCount: number;
  coursesCount: number;
}): { ok: boolean; message: string } {
  const sel = params.selectedCollection;
  return {
    ok: true,
    message: buildPreviewActionDiffMessage({
      actionType: params.action.type,
      factor: params.action.factor,
      operator: params.action.operator,
      selectedCollectionCount: sel?.ids.length || 0,
      selectedCollectionTarget: sel?.target || "objekt",
      activitiesCount: params.activitiesCount,
      coursesCount: params.coursesCount,
    }),
  };
}

export function selectCollectionForAgentZone(params: {
  options: {
    target: "placements" | "courses";
    everyN?: number;
    afterQuery?: string;
    matchQuery?: string;
    beforeDate?: string;
    afterDate?: string;
    year?: number;
    month?: number;
    limit?: number;
  };
  activities: any[];
  courses: any[];
  getPlacementStartISOForAgent: (placement: any) => string;
  setSelectedCollectionRef: (value: { target: "placements" | "courses"; ids: string[]; atISO: string }) => void;
}): { ok: boolean; message: string } {
  const entities =
    params.options.target === "placements"
      ? buildPlacementCollectionEntities(params.activities, params.getPlacementStartISOForAgent)
      : buildCourseCollectionEntities(params.courses);
  const selectedResult = selectAgentCollectionEntities(entities, params.options);
  if (!selectedResult.ok) return { ok: false, message: selectedResult.message };
  const { selected, everyN } = selectedResult;
  params.setSelectedCollectionRef(
    buildAgentCollectionSelectionRef({
      target: params.options.target,
      selectedIds: selected.map((entity) => entity.id),
    })
  );
  return {
    ok: true,
    message: buildAgentCollectionSelectionMessage({
      target: params.options.target,
      selectedCount: selected.length,
      everyN,
    }),
  };
}

export type AgentCollectionDeletePersistInput =
  | { target: "courses"; removed: any[] }
  | { target: "placements"; removed: any[] };

export async function applyOperatorToCollectionForAgentZone(params: {
  options: {
    operator: "delete" | "shift_placement_month" | "set_course_kind_utbildningsmoment";
    months?: number;
  };
  selectedCollection: { target: "placements" | "courses"; ids: string[] } | null;
  activities: any[];
  courses: any[];
  getPlacementStartISOForAgent: (placement: any) => string;
  getPlacementEndISOForAgent: (placement: any) => string;
  setActivities: (activities: any[]) => void;
  setCourses: (courses: any[]) => void;
  setDirty: (dirty: boolean) => void;
  /** When set, collection delete also removes linked Supabase rows and refreshes lists (same as manual delete). */
  persistCollectionDeletes?: (input: AgentCollectionDeletePersistInput) => Promise<void>;
}): Promise<{ ok: boolean; message: string }> {
  const sel = params.selectedCollection;
  if (!sel || sel.ids.length === 0) {
    return { ok: false, message: "Ingen vald mängd finns. Kör select_collection först." };
  }
  if (params.options.operator === "delete") {
    if (sel.target === "courses") {
      const idSet = new Set(sel.ids.map(String));
      const removedCourses = params.courses.filter((c) => idSet.has(String(c.id)));
      const removed = removeEntitiesByIds(params.courses, sel.ids);
      const snapshotCourses = params.courses;
      params.setCourses(removed.remaining);
      if (params.persistCollectionDeletes) {
        try {
          await params.persistCollectionDeletes({ target: "courses", removed: removedCourses });
          params.setDirty(false);
        } catch {
          params.setCourses(snapshotCourses);
          return { ok: false, message: "Kunde inte spara borttagningen till databasen." };
        }
      } else {
        params.setDirty(true);
      }
      return { ok: true, message: buildDeleteCollectionMessage("courses", removed.removedCount) };
    }
    const idSetPl = new Set(sel.ids.map(String));
    const removedPlacements = params.activities.filter((a) => idSetPl.has(String(a.id)));
    const removedPl = removeEntitiesByIds(params.activities, sel.ids);
    const snapshotActivities = params.activities;
    params.setActivities(removedPl.remaining);
    if (params.persistCollectionDeletes) {
      try {
        await params.persistCollectionDeletes({ target: "placements", removed: removedPlacements });
        params.setDirty(false);
      } catch {
        params.setActivities(snapshotActivities);
        return { ok: false, message: "Kunde inte spara borttagningen till databasen." };
      }
    } else {
      params.setDirty(true);
    }
    return { ok: true, message: buildDeleteCollectionMessage("placements", removedPl.removedCount) };
  }
  if (params.options.operator === "set_course_kind_utbildningsmoment") {
    if (sel.target !== "courses") return { ok: false, message: "Denna operator kräver en kursmängd." };
    const result = setCourseKindByIds(params.courses, sel.ids, "Utbildningsmoment");
    params.setCourses(result.updated);
    params.setDirty(true);
    return { ok: true, message: buildSetCourseKindMessage(result.changedCount) };
  }
  if (params.options.operator === "shift_placement_month") {
    if (sel.target !== "placements") {
      return { ok: false, message: "Denna operator kräver en placeringsmängd." };
    }
    const months = Math.max(1, Number(params.options.months || 1));
    const shifted = shiftPlacementsByMonths({
      placements: params.activities,
      ids: sel.ids,
      months,
      getPlacementStartISOForAgent: params.getPlacementStartISOForAgent,
      getPlacementEndISOForAgent: params.getPlacementEndISOForAgent,
    });
    params.setActivities(shifted.updated);
    params.setDirty(true);
    return { ok: true, message: buildShiftPlacementMonthsMessage(shifted.changedCount, months) };
  }
  return { ok: false, message: "Operatorn stöds inte ännu." };
}

export async function clearIupFollowupsForAgentZone(params: {
  options?: { clearMeetings?: boolean; clearAssessments?: boolean };
  supabase: any;
  IUP_SETTINGS_COLUMNS: string;
  normalizeIupSettings: (existing: any) => any;
  upsertIupSettingsOnUserId: (payload: any) => Promise<any>;
  buildIupSettingsUpsertPayload: (args: {
    userId: string;
    base: any;
    meetings: any[];
    assessments: any[];
  }) => Record<string, unknown>;
  setSupervisionSessions: (sessions: any[]) => void;
  setAssessmentSessions: (sessions: any[]) => void;
  setDirty: (dirty: boolean) => void;
}): Promise<{ ok: boolean; message: string }> {
  const clearMeetings = params.options?.clearMeetings !== false;
  const clearAssessments = params.options?.clearAssessments !== false;
  if (!clearMeetings && !clearAssessments) {
    return { ok: false, message: "Ingen IUP-uppföljning vald att rensa." };
  }
  try {
    const userId = await resolveSupabaseUserId(params.supabase);
    if (!userId) return { ok: false, message: "Kunde inte identifiera aktuell användare." };
    const normalized = await fetchNormalizedIupSettings({
      supabaseClient: params.supabase,
      userId,
      columns: params.IUP_SETTINGS_COLUMNS,
      normalizeIupSettings: params.normalizeIupSettings,
    });
    const cleared = clearFollowups({
      meetings: normalized.meetings,
      assessments: normalized.assessments,
      clearMeetings,
      clearAssessments,
    });
    await saveNormalizedIupSettings({
      upsertIupSettingsOnUserId: params.upsertIupSettingsOnUserId,
      buildIupSettingsUpsertPayload: params.buildIupSettingsUpsertPayload,
      userId,
      base: normalized,
      meetings: cleared.meetings,
      assessments: cleared.assessments,
    });
    if (clearMeetings) params.setSupervisionSessions([]);
    if (clearAssessments) params.setAssessmentSessions([]);
    params.setDirty(true);
    return {
      ok: true,
      message: buildClearedFollowupsMessage({
        clearMeetings,
        clearAssessments,
        removedMeetings: cleared.removedMeetings,
        removedAssessments: cleared.removedAssessments,
      }),
    };
  } catch (error: unknown) {
    return { ok: false, message: `Kunde inte rensa IUP-uppföljning: ${toAgentErrorMessage(error)}` };
  }
}

export async function addIupFollowupForAgentZone(params: {
  options: { followupType: "meeting" | "assessment"; dateISO: string };
  supabase: any;
  IUP_SETTINGS_COLUMNS: string;
  normalizeIupSettings: (existing: any) => any;
  upsertIupSettingsOnUserId: (payload: any) => Promise<any>;
  buildIupSettingsUpsertPayload: (args: {
    userId: string;
    base: any;
    meetings: any[];
    assessments: any[];
  }) => Record<string, unknown>;
  inferPhaseFromDateForAgent: (dateISO: string) => string;
  uid: () => string;
  setSupervisionSessions: (updater: (prev: any[]) => any[]) => void;
  setAssessmentSessions: (updater: (prev: any[]) => any[]) => void;
  setDirty: (dirty: boolean) => void;
}): Promise<{ ok: boolean; message: string }> {
  const dateISO = normalizeIsoDateInput(params.options.dateISO);
  if (!isIsoDateInput(dateISO)) {
    return { ok: false, message: "Ogiltigt datum för IUP-uppföljning." };
  }
  try {
    const userId = await resolveSupabaseUserId(params.supabase);
    if (!userId) return { ok: false, message: "Kunde inte identifiera aktuell användare." };
    const normalized = await fetchNormalizedIupSettings({
      supabaseClient: params.supabase,
      userId,
      columns: params.IUP_SETTINGS_COLUMNS,
      normalizeIupSettings: params.normalizeIupSettings,
    });
    const nextCollections = addFollowupToCollections({
      followupType: params.options.followupType,
      dateISO,
      meetings: [...normalized.meetings],
      assessments: [...normalized.assessments],
      inferPhaseFromDate: params.inferPhaseFromDateForAgent,
      createId: params.uid,
    });
    await saveNormalizedIupSettings({
      upsertIupSettingsOnUserId: params.upsertIupSettingsOnUserId,
      buildIupSettingsUpsertPayload: params.buildIupSettingsUpsertPayload,
      userId,
      base: normalized,
      meetings: nextCollections.meetings,
      assessments: nextCollections.assessments,
    });
    if (params.options.followupType === "meeting") {
      params.setSupervisionSessions((prev) =>
        upsertFollowupSession(prev, dateISO, "Handledarträff", params.uid)
      );
    } else {
      params.setAssessmentSessions((prev) =>
        upsertFollowupSession(prev, dateISO, "Progressionsbedömning", params.uid)
      );
    }
    params.setDirty(true);
    return { ok: true, message: buildAddedFollowupMessage(params.options.followupType, dateISO) };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Kunde inte lägga till IUP-uppföljning: ${toAgentErrorMessage(error)}`,
    };
  }
}

const MAX_SUPERVISION_SHIFT_DAYS = 365 * 5;

export async function addIupSupervisionMeetingsForAgentZone(params: {
  dateISOs: string[];
  supabase: any;
  IUP_SETTINGS_COLUMNS: string;
  normalizeIupSettings: (existing: any) => any;
  upsertIupSettingsOnUserId: (payload: any) => Promise<any>;
  buildIupSettingsUpsertPayload: (args: {
    userId: string;
    base: any;
    meetings: any[];
    assessments: any[];
  }) => Record<string, unknown>;
  inferPhaseFromDateForAgent: (dateISO: string) => string;
  uid: () => string;
  setSupervisionSessions: (sessions: any[]) => void;
  setDirty: (dirty: boolean) => void;
}): Promise<{ ok: boolean; message: string }> {
  const rawList = Array.isArray(params.dateISOs) ? params.dateISOs : [];
  const seen = new Set<string>();
  const normalizedList: string[] = [];
  for (const raw of rawList) {
    const d = normalizeIsoDateInput(String(raw));
    if (!isIsoDateInput(d)) continue;
    const key = d.slice(0, 10);
    if (seen.has(key)) continue;
    seen.add(key);
    normalizedList.push(key);
  }
  if (normalizedList.length === 0) {
    return { ok: false, message: "Inga giltiga datum för handledarsamtal." };
  }
  if (normalizedList.length > MAX_SUPERVISION_MEETING_DATES_PER_ACTION) {
    return {
      ok: false,
      message: `Högst ${MAX_SUPERVISION_MEETING_DATES_PER_ACTION} datum åt gången.`,
    };
  }
  try {
    const userId = await resolveSupabaseUserId(params.supabase);
    if (!userId) return { ok: false, message: "Kunde inte identifiera aktuell användare." };
    const normalized = await fetchNormalizedIupSettings({
      supabaseClient: params.supabase,
      userId,
      columns: params.IUP_SETTINGS_COLUMNS,
      normalizeIupSettings: params.normalizeIupSettings,
    });
    let meetings = [...normalized.meetings];
    const assessments = [...normalized.assessments];
    let added = 0;
    for (const dateISO of normalizedList) {
      const beforeLen = meetings.length;
      const nextCollections = addFollowupToCollections({
        followupType: "meeting",
        dateISO,
        meetings,
        assessments,
        inferPhaseFromDate: params.inferPhaseFromDateForAgent,
        createId: params.uid,
      });
      meetings = nextCollections.meetings;
      if (meetings.length > beforeLen) added++;
    }
    await saveNormalizedIupSettings({
      upsertIupSettingsOnUserId: params.upsertIupSettingsOnUserId,
      buildIupSettingsUpsertPayload: params.buildIupSettingsUpsertPayload,
      userId,
      base: normalized,
      meetings,
      assessments,
    });
    params.setSupervisionSessions(supervisionTimelineFromMeetings(meetings));
    params.setDirty(true);
    return {
      ok: true,
      message: buildAddedSupervisionMeetingsBatchMessage(added, normalizedList),
    };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Kunde inte lägga till handledarsamtal: ${toAgentErrorMessage(error)}`,
    };
  }
}

export async function shiftIupSupervisionMeetingsForAgentZone(params: {
  days: number;
  supabase: any;
  IUP_SETTINGS_COLUMNS: string;
  normalizeIupSettings: (existing: any) => any;
  upsertIupSettingsOnUserId: (payload: any) => Promise<any>;
  buildIupSettingsUpsertPayload: (args: {
    userId: string;
    base: any;
    meetings: any[];
    assessments: any[];
  }) => Record<string, unknown>;
  setSupervisionSessions: (sessions: any[]) => void;
  setDirty: (dirty: boolean) => void;
}): Promise<{ ok: boolean; message: string }> {
  const days = Math.trunc(Number(params.days));
  if (!Number.isFinite(days) || days === 0) {
    return { ok: false, message: "Ange antal dagar att flytta (positivt = framåt, negativt = bakåt)." };
  }
  if (Math.abs(days) > MAX_SUPERVISION_SHIFT_DAYS) {
    return { ok: false, message: "För stor tidsförskjutning för handledarsamtal." };
  }
  try {
    const userId = await resolveSupabaseUserId(params.supabase);
    if (!userId) return { ok: false, message: "Kunde inte identifiera aktuell användare." };
    const normalized = await fetchNormalizedIupSettings({
      supabaseClient: params.supabase,
      userId,
      columns: params.IUP_SETTINGS_COLUMNS,
      normalizeIupSettings: params.normalizeIupSettings,
    });
    const beforeCount = Array.isArray(normalized.meetings) ? normalized.meetings.length : 0;
    if (beforeCount === 0) {
      return { ok: false, message: "Inga handledarsamtal finns att flytta." };
    }
    const meetings = shiftMeetingsByDays([...normalized.meetings], days);
    await saveNormalizedIupSettings({
      upsertIupSettingsOnUserId: params.upsertIupSettingsOnUserId,
      buildIupSettingsUpsertPayload: params.buildIupSettingsUpsertPayload,
      userId,
      base: normalized,
      meetings,
      assessments: normalized.assessments,
    });
    params.setSupervisionSessions(supervisionTimelineFromMeetings(meetings));
    params.setDirty(true);
    return {
      ok: true,
      message: buildShiftSupervisionMeetingsMessage(days, beforeCount),
    };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Kunde inte flytta handledarsamtal: ${toAgentErrorMessage(error)}`,
    };
  }
}

export async function removeIupSupervisionMeetingsByDatesForAgentZone(params: {
  dateISOs: string[];
  supabase: any;
  IUP_SETTINGS_COLUMNS: string;
  normalizeIupSettings: (existing: any) => any;
  upsertIupSettingsOnUserId: (payload: any) => Promise<any>;
  buildIupSettingsUpsertPayload: (args: {
    userId: string;
    base: any;
    meetings: any[];
    assessments: any[];
  }) => Record<string, unknown>;
  setSupervisionSessions: (sessions: any[]) => void;
  setDirty: (dirty: boolean) => void;
}): Promise<{ ok: boolean; message: string }> {
  const rawList = Array.isArray(params.dateISOs) ? params.dateISOs : [];
  const normalizedDates: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawList) {
    const d = normalizeIsoDateInput(String(raw));
    if (!isIsoDateInput(d)) continue;
    const key = d.slice(0, 10);
    if (seen.has(key)) continue;
    seen.add(key);
    normalizedDates.push(key);
  }
  if (normalizedDates.length === 0) {
    return { ok: false, message: "Inga giltiga datum att ta bort handledarsamtal för." };
  }
  if (normalizedDates.length > MAX_SUPERVISION_MEETING_DATES_PER_ACTION) {
    return {
      ok: false,
      message: `Högst ${MAX_SUPERVISION_MEETING_DATES_PER_ACTION} datum åt gången.`,
    };
  }
  try {
    const userId = await resolveSupabaseUserId(params.supabase);
    if (!userId) return { ok: false, message: "Kunde inte identifiera aktuell användare." };
    const normalized = await fetchNormalizedIupSettings({
      supabaseClient: params.supabase,
      userId,
      columns: params.IUP_SETTINGS_COLUMNS,
      normalizeIupSettings: params.normalizeIupSettings,
    });
    const { next, removed } = removeMeetingsOnDates([...normalized.meetings], normalizedDates);
    if (removed === 0) {
      return { ok: false, message: "Inga handledarsamtal matchade angivna datum." };
    }
    await saveNormalizedIupSettings({
      upsertIupSettingsOnUserId: params.upsertIupSettingsOnUserId,
      buildIupSettingsUpsertPayload: params.buildIupSettingsUpsertPayload,
      userId,
      base: normalized,
      meetings: next,
      assessments: normalized.assessments,
    });
    params.setSupervisionSessions(supervisionTimelineFromMeetings(next));
    params.setDirty(true);
    return {
      ok: true,
      message: buildRemovedSupervisionMeetingsByDatesMessage(removed),
    };
  } catch (error: unknown) {
    return {
      ok: false,
      message: `Kunde inte ta bort handledarsamtal: ${toAgentErrorMessage(error)}`,
    };
  }
}

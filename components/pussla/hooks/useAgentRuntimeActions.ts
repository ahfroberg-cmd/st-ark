"use client";

import { useCallback, useMemo, type MutableRefObject } from "react";
import {
  addIupFollowupForAgentZone,
  addIupSupervisionMeetingsForAgentZone,
  clearIupFollowupsForAgentZone,
  getActiveContextForAgentZone,
  removeIupSupervisionMeetingsByDatesForAgentZone,
  shiftIupSupervisionMeetingsForAgentZone,
} from "@/lib/pussla/agentCommandZone";
import { closeAgentWindowCommand, openAgentWindowCommand } from "@/lib/pussla/agentWindowCommands";

export function useAgentRuntimeActions(params: {
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
  getPlacementStartISOForAgent: any;
  getPlacementEndISOForAgent: any;
  activeLane: "placement" | "course";
  activitiesCount: number;
  coursesCount: number;
  dirty: boolean;
  supabase: any;
  IUP_SETTINGS_COLUMNS: string;
  normalizeIupSettings: any;
  upsertIupSettingsOnUserId: any;
  buildIupSettingsUpsertPayload: any;
  setSupervisionSessions: any;
  setAssessmentSessions: any;
  setDirty: (value: boolean) => void;
  inferPhaseFromDateForAgent: any;
  uid: () => string;
  agentUndoStackRef: MutableRefObject<any[]>;
  restoreAgentUiSnapshot: (snapshot: any) => Promise<{ ok: boolean; message: string }>;
  setIupOpen: (open: boolean) => void;
  setHemklinikOpen: (open: boolean) => void;
  setScanOpen: (open: boolean) => void;
  setBtModalOpen: (open: boolean) => void;
  setPrepareOpen: (open: boolean) => void;
  setProfileOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setReportOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSta3Open: (open: boolean) => void;
  setCourseModalOpen: (open: boolean) => void;
  setPreviewOpen: (open: boolean) => void;
  setMilestoneOverviewOpen: (open: boolean) => void;
}) {
  const getActiveContextForAgent = useCallback((): { ok: boolean; message: string } => {
    return getActiveContextForAgentZone({
      modalFlags: params.modalFlags,
      selectedPlacement: params.selectedPlacement as any,
      selectedCourse: params.selectedCourse as any,
      getPlacementStartISOForAgent: params.getPlacementStartISOForAgent as any,
      getPlacementEndISOForAgent: params.getPlacementEndISOForAgent as any,
      activeLane: params.activeLane,
      activitiesCount: params.activitiesCount,
      coursesCount: params.coursesCount,
      dirty: params.dirty,
    });
  }, [params]);

  const clearIupFollowupsForAgent = useCallback(
    async (options?: { clearMeetings?: boolean; clearAssessments?: boolean }): Promise<{ ok: boolean; message: string }> => {
      return clearIupFollowupsForAgentZone({
        options,
        supabase: params.supabase as any,
        IUP_SETTINGS_COLUMNS: params.IUP_SETTINGS_COLUMNS,
        normalizeIupSettings: params.normalizeIupSettings,
        upsertIupSettingsOnUserId: params.upsertIupSettingsOnUserId,
        buildIupSettingsUpsertPayload: params.buildIupSettingsUpsertPayload,
        setSupervisionSessions: params.setSupervisionSessions,
        setAssessmentSessions: params.setAssessmentSessions,
        setDirty: params.setDirty,
      });
    },
    [params]
  );

  const addIupFollowupForAgent = useCallback(
    async (options: { followupType: "meeting" | "assessment"; dateISO: string }): Promise<{ ok: boolean; message: string }> => {
      return addIupFollowupForAgentZone({
        options,
        supabase: params.supabase as any,
        IUP_SETTINGS_COLUMNS: params.IUP_SETTINGS_COLUMNS,
        normalizeIupSettings: params.normalizeIupSettings,
        upsertIupSettingsOnUserId: params.upsertIupSettingsOnUserId,
        buildIupSettingsUpsertPayload: params.buildIupSettingsUpsertPayload,
        inferPhaseFromDateForAgent: params.inferPhaseFromDateForAgent,
        uid: params.uid,
        setSupervisionSessions: params.setSupervisionSessions,
        setAssessmentSessions: params.setAssessmentSessions,
        setDirty: params.setDirty,
      });
    },
    [params]
  );

  const addIupSupervisionMeetingsForAgent = useCallback(
    async (options: { dateISOs: string[] }): Promise<{ ok: boolean; message: string }> => {
      return addIupSupervisionMeetingsForAgentZone({
        dateISOs: options.dateISOs,
        supabase: params.supabase as any,
        IUP_SETTINGS_COLUMNS: params.IUP_SETTINGS_COLUMNS,
        normalizeIupSettings: params.normalizeIupSettings,
        upsertIupSettingsOnUserId: params.upsertIupSettingsOnUserId,
        buildIupSettingsUpsertPayload: params.buildIupSettingsUpsertPayload,
        inferPhaseFromDateForAgent: params.inferPhaseFromDateForAgent,
        uid: params.uid,
        setSupervisionSessions: params.setSupervisionSessions,
        setDirty: params.setDirty,
      });
    },
    [params]
  );

  const shiftIupSupervisionMeetingsForAgent = useCallback(
    async (options: { days: number }): Promise<{ ok: boolean; message: string }> => {
      return shiftIupSupervisionMeetingsForAgentZone({
        days: options.days,
        supabase: params.supabase as any,
        IUP_SETTINGS_COLUMNS: params.IUP_SETTINGS_COLUMNS,
        normalizeIupSettings: params.normalizeIupSettings,
        upsertIupSettingsOnUserId: params.upsertIupSettingsOnUserId,
        buildIupSettingsUpsertPayload: params.buildIupSettingsUpsertPayload,
        setSupervisionSessions: params.setSupervisionSessions,
        setDirty: params.setDirty,
      });
    },
    [params]
  );

  const removeIupSupervisionMeetingsByDatesForAgent = useCallback(
    async (options: { dateISOs: string[] }): Promise<{ ok: boolean; message: string }> => {
      return removeIupSupervisionMeetingsByDatesForAgentZone({
        dateISOs: options.dateISOs,
        supabase: params.supabase as any,
        IUP_SETTINGS_COLUMNS: params.IUP_SETTINGS_COLUMNS,
        normalizeIupSettings: params.normalizeIupSettings,
        upsertIupSettingsOnUserId: params.upsertIupSettingsOnUserId,
        buildIupSettingsUpsertPayload: params.buildIupSettingsUpsertPayload,
        setSupervisionSessions: params.setSupervisionSessions,
        setDirty: params.setDirty,
      });
    },
    [params]
  );

  const undoLastAgentMutationForAgent = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const stack = params.agentUndoStackRef.current;
    if (!stack.length) return { ok: false, message: "Det finns ingen agentändring att ångra." };
    const snapshot = stack.pop();
    return params.restoreAgentUiSnapshot(snapshot);
  }, [params]);

  const agentWindowSetters = useMemo<Record<string, (open: boolean) => void>>(
    () => ({
      iup: params.setIupOpen,
      hemklinik: params.setHemklinikOpen,
      scan_intyg: params.setScanOpen,
      bt_ansokan: params.setBtModalOpen,
      specialistansokan: params.setPrepareOpen,
      profile: params.setProfileOpen,
      about: params.setAboutOpen,
      report: params.setReportOpen,
      settings: params.setSettingsOpen,
      sta3: params.setSta3Open,
      course_prep: params.setCourseModalOpen,
      preview: params.setPreviewOpen,
      milestone_overview: params.setMilestoneOverviewOpen,
    }),
    [params]
  );

  const openAgentWindow = useCallback(
    (windowName: string) => openAgentWindowCommand(windowName, agentWindowSetters),
    [agentWindowSetters]
  );
  const closeAgentWindow = useCallback(
    (windowName: string) => closeAgentWindowCommand(windowName, agentWindowSetters),
    [agentWindowSetters]
  );

  return {
    getActiveContextForAgent,
    clearIupFollowupsForAgent,
    addIupFollowupForAgent,
    addIupSupervisionMeetingsForAgent,
    shiftIupSupervisionMeetingsForAgent,
    removeIupSupervisionMeetingsByDatesForAgent,
    undoLastAgentMutationForAgent,
    openAgentWindow,
    closeAgentWindow,
  };
}

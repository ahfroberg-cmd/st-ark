"use client";

import { useCallback, type MutableRefObject } from "react";
import { buildAgentSnapshot, normalizeAgentSnapshot } from "@/lib/pussla/agentSnapshot";
import { buildTimelineVersionData, buildVersionName } from "@/lib/pussla/versionSnapshot";

export function useAgentSnapshotActions(params: {
  activities: any[];
  courses: any[];
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  selectedPlacementIdRef: MutableRefObject<string | null>;
  selectedCourseIdRef: MutableRefObject<string | null>;
  activeLane: "placement" | "course";
  iupOpen: boolean;
  iupInitialTab: any;
  hemklinikOpen: boolean;
  scanOpen: boolean;
  btModalOpen: boolean;
  prepareOpen: boolean;
  milestoneOverviewOpen: boolean;
  courseModalOpen: boolean;
  sta3Open: boolean;
  previewOpen: boolean;
  profileOpen: boolean;
  aboutOpen: boolean;
  reportOpen: boolean;
  settingsOpen: boolean;
  supervisionSessions: any[];
  assessmentSessions: any[];
  directorMeetingSessions: any[];
  specialistCollegiumSessions: any[];
  profile: any;
  btEndISO: string | null;
  dirty: boolean;
  setActivities: (value: any) => void;
  setCourses: (value: any) => void;
  setSelectedPlacementId: (id: string | null) => void;
  setSelectedCourseId: (id: string | null) => void;
  setActiveLane: (lane: "placement" | "course") => void;
  setIupOpen: (open: boolean) => void;
  setIupInitialTab: (tab: any) => void;
  setHemklinikOpen: (open: boolean) => void;
  setScanOpen: (open: boolean) => void;
  setBtModalOpen: (open: boolean) => void;
  setPrepareOpen: (open: boolean) => void;
  setMilestoneOverviewOpen: (open: boolean) => void;
  setCourseModalOpen: (open: boolean) => void;
  setSta3Open: (open: boolean) => void;
  setPreviewOpen: (open: boolean) => void;
  setProfileOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setReportOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSupervisionSessions: (rows: any[]) => void;
  setAssessmentSessions: (rows: any[]) => void;
  setDirectorMeetingSessions: (rows: any[]) => void;
  setSpecialistCollegiumSessions: (rows: any[]) => void;
  setDirty: (value: boolean) => void;
  setPendingSwitchPlacementId: (id: string | null) => void;
  setPendingSwitchCourseId: (id: string | null) => void;
  getSessionUser: () => Promise<any>;
  insertTimelineVersionRow: (payload: any) => Promise<{ error?: any }>;
}) {
  const captureAgentUiSnapshot = useCallback(() => {
    return buildAgentSnapshot({
      activities: params.activities as any[],
      courses: params.courses as any[],
      selectedPlacementId: params.selectedPlacementId,
      selectedCourseId: params.selectedCourseId,
      activeLane: params.activeLane,
      iupOpen: params.iupOpen,
      iupInitialTab: params.iupInitialTab,
      hemklinikOpen: params.hemklinikOpen,
      scanOpen: params.scanOpen,
      btModalOpen: params.btModalOpen,
      prepareOpen: params.prepareOpen,
      milestoneOverviewOpen: params.milestoneOverviewOpen,
      courseModalOpen: params.courseModalOpen,
      sta3Open: params.sta3Open,
      previewOpen: params.previewOpen,
      profileOpen: params.profileOpen,
      aboutOpen: params.aboutOpen,
      reportOpen: params.reportOpen,
      settingsOpen: params.settingsOpen,
      supervisionSessions: params.supervisionSessions as any[],
      assessmentSessions: params.assessmentSessions as any[],
      directorMeetingSessions: params.directorMeetingSessions as any[],
      specialistCollegiumSessions: params.specialistCollegiumSessions as any[],
      btStartISO: (params.profile as any)?.btStartDate || null,
      btEndISO: params.btEndISO || (params.profile as any)?.btEndDate || null,
      dirty: params.dirty,
    });
  }, [params]);

  const restoreAgentUiSnapshot = useCallback(
    async (snapshot: any): Promise<{ ok: boolean; message: string }> => {
      const normalized = normalizeAgentSnapshot(snapshot);
      if (!normalized.ok || !normalized.data) {
        return { ok: false, message: normalized.message || "Kunde inte återställa snapshot." };
      }
      const data = normalized.data;
      params.setActivities(data.activities as any[]);
      params.setCourses(data.courses as any[]);
      params.setSelectedPlacementId(data.selectedPlacementId);
      params.selectedPlacementIdRef.current = data.selectedPlacementId;
      params.setSelectedCourseId(data.selectedCourseId);
      params.selectedCourseIdRef.current = data.selectedCourseId;
      params.setActiveLane(data.activeLane);
      params.setIupOpen(data.iupOpen);
      params.setIupInitialTab(data.iupInitialTab as any);
      params.setHemklinikOpen(data.hemklinikOpen);
      params.setScanOpen(data.scanOpen);
      params.setBtModalOpen(data.btModalOpen);
      params.setPrepareOpen(data.prepareOpen);
      params.setMilestoneOverviewOpen(data.milestoneOverviewOpen);
      params.setCourseModalOpen(data.courseModalOpen);
      params.setSta3Open(data.sta3Open);
      params.setPreviewOpen(data.previewOpen);
      params.setProfileOpen(data.profileOpen);
      params.setAboutOpen(data.aboutOpen);
      params.setReportOpen(data.reportOpen);
      params.setSettingsOpen(data.settingsOpen);
      params.setSupervisionSessions(data.supervisionSessions as any[]);
      params.setAssessmentSessions(data.assessmentSessions as any[]);
      params.setDirectorMeetingSessions(data.directorMeetingSessions as any[]);
      params.setSpecialistCollegiumSessions(data.specialistCollegiumSessions as any[]);
      params.setDirty(data.dirty);
      params.setPendingSwitchPlacementId(null);
      params.setPendingSwitchCourseId(null);
      return { ok: true, message: "Återställde vy och tidslinje till vald checkpoint." };
    },
    [params]
  );

  const saveVersionSnapshotBeforeMutation = useCallback(
    async (reason: string): Promise<{ ok: boolean; message: string }> => {
      try {
        const user = await params.getSessionUser();
        if (!user) return { ok: false, message: "Inte inloggad, kunde inte autospara version." };
        const versionName = buildVersionName(reason, new Date());
        const versionData = buildTimelineVersionData(
          params.activities.map((activity) => ({ ...(activity as any), note: (activity as any).note })),
          params.courses as any[]
        );
        const { error } = await params.insertTimelineVersionRow({
          user_id: user.id,
          version_name: versionName,
          version_data: versionData,
        });
        if (error) throw error;
        return { ok: true, message: `Version sparad under Spara: ${versionName}` };
      } catch (e: any) {
        return {
          ok: false,
          message: `Kunde inte autospara version före ändring: ${String(e?.message || e)}`,
        };
      }
    },
    [params]
  );

  return {
    captureAgentUiSnapshot,
    restoreAgentUiSnapshot,
    saveVersionSnapshotBeforeMutation,
  };
}

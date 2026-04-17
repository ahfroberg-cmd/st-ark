"use client";

import { useCallback, useMemo } from "react";
import { persistTimelineToDbZone } from "@/lib/pussla/persistTimeline";
import { persistIntygGroupModalZone } from "@/lib/pussla/intygGroupPersistence";
import {
  buildPusslaSearchHits,
  runPusslaSearchHitAction,
  type PusslaSearchHit,
} from "@/lib/pussla/searchWorkspace";

export function usePusslaAuxWorkspaceActions(params: {
  activities: any[];
  courses: any[];
  selectedPlacementId: string | null;
  searchQuery: string;
  authUserId: string | undefined;
  getSessionUser: any;
  setAuthUser: (user: any) => void;
  isValidISO: any;
  computeMondayDates: any;
  isLeave: any;
  isZeroAttendanceType: any;
  setActivities: any;
  setCourses: any;
  setAchievements: any;
  setDbAchievements: any;
  deleteAchievementsByUserAndPlacement: any;
  deleteAchievementsByUserAndCourse: any;
  insertAchievementRows: any;
  listAchievementsByUserId: any;
  mapAchievementRow: any;
  groupedMembersForDraft: any;
  updatePlacementById: (placementId: string, payload: any) => Promise<any>;
  getCourseDisplayTitle: any;
  setSearchOpen: (open: boolean) => void;
  setIupOpen: (open: boolean) => void;
  setHemklinikOpen: (open: boolean) => void;
  openDocumentsFor: (target: { kind: "placement" | "course" | null; id: string | null; label: string }) => Promise<void>;
  switchActivity: (newPlacementId: string | null, newCourseId: string | null) => boolean;
  alertFn: (message: string) => void;
}) {
  const persistTimelineToDb = useCallback(async () => {
    await persistTimelineToDbZone({
      activities: params.activities as any[],
      courses: params.courses as any[],
      isValidISO: params.isValidISO,
      computeMondayDates: params.computeMondayDates as any,
      isLeave: params.isLeave as any,
      isZeroAttendanceType: params.isZeroAttendanceType as any,
      setActivities: (updater) => params.setActivities(updater as any),
      setCourses: (updater) => params.setCourses(updater as any),
      setAchievements: (rows) => params.setAchievements(rows as any),
      setDbAchievements: (rows) => params.setDbAchievements(rows as any),
      authUserId: params.authUserId,
      getSessionUser: params.getSessionUser,
      setAuthUser: params.setAuthUser,
      deleteAchievementsByUserAndPlacement: params.deleteAchievementsByUserAndPlacement,
      deleteAchievementsByUserAndCourse: params.deleteAchievementsByUserAndCourse,
      insertAchievementRows: params.insertAchievementRows,
      listAchievementsByUserId: params.listAchievementsByUserId,
      mapAchievementRow: params.mapAchievementRow,
    });
  }, [params]);

  const persistIntygGroupModal = useCallback(
    async (draftGroup: number | null, config: any) => {
      await persistIntygGroupModalZone({
        draftGroup,
        config: (config || null) as any,
        activities: params.activities as any[],
        selectedPlacementId: params.selectedPlacementId,
        groupedMembersForDraft: params.groupedMembersForDraft as any,
        setActivities: (updater) => params.setActivities(updater as any),
        updatePlacementById: params.updatePlacementById,
        alertFn: params.alertFn,
      });
    },
    [params]
  );

  const searchHits = useMemo(
    () =>
      buildPusslaSearchHits({
        query: params.searchQuery,
        activities: params.activities as any[],
        courses: params.courses as any[],
        getCourseDisplayTitle: params.getCourseDisplayTitle as any,
      }),
    [params.searchQuery, params.activities, params.courses, params.getCourseDisplayTitle]
  );

  const runSearchHit = useCallback(
    async (hit: PusslaSearchHit) => {
      await runPusslaSearchHitAction(hit, {
        setSearchOpen: params.setSearchOpen,
        setIupOpen: params.setIupOpen,
        setHemklinikOpen: params.setHemklinikOpen,
        openDocumentsFor: params.openDocumentsFor,
        switchActivity: params.switchActivity,
      });
    },
    [params]
  );

  return {
    persistTimelineToDb,
    persistIntygGroupModal,
    searchHits,
    runSearchHit,
  };
}

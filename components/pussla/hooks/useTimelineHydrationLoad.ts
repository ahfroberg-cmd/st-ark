"use client";

import { useEffect, type MutableRefObject } from "react";
import { registerTimelineSyncEvents } from "@/lib/pussla/timelineSyncEvents";

export function useTimelineHydrationLoad(params: {
  startYear: number;
  profileRefreshTick: number;
  profile: any;
  stStartISO: string | null;
  totalYearsNeeded: number;
  authUserId: string | undefined;
  loadingRef: MutableRefObject<boolean>;
  hydratedRef: MutableRefObject<boolean>;
  pendingScanSelectionRef: MutableRefObject<any>;
  isValidISO: any;
  getSessionUser: any;
  fetchProfileById: any;
  mapPusslaProfileRow: any;
  ensureProfile: any;
  normalizeISODateOnlyGlobal: (value: unknown) => string | null;
  setProfile: (profile: any) => void;
  setStStartISO: (iso: string | null) => void;
  setStEndISO: (iso: string | null) => void;
  resolveUserId: any;
  setAuthUser: (user: any) => void;
  fetchLockedTimelineRows: any;
  computeEffectiveStartYear: any;
  setStartYear: (year: number) => void;
  mapLockedPlacementsToActivities: any;
  mapLockedCoursesToTimeline: any;
  phaseForCourseDates: any;
  dateToISO: any;
  dateToSlot: any;
  nextHue: (i: number) => number;
  inferPlacementPhaseByProfileBt: any;
  sanitizeTimelineDrafts: any;
  composeHydratedTimelineState: any;
  slotToYearMonthHalf: any;
  mondayNearestTo: any;
  isoToDateSafe: any;
  slotsPerYear: () => number;
  resolvePendingScanSelection: any;
  setSelectedPlacementId: (id: string | null) => void;
  setSelectedCourseId: (id: string | null) => void;
  setActiveLane: (lane: "placement" | "course") => void;
  setActivities: (rows: any[]) => void;
  setCourses: (rows: any[]) => void;
  setYearsAbove: (value: number) => void;
  setYearsBelow: (value: number) => void;
  setDismissedGaps: (value: string[]) => void;
}) {
  useEffect(() => {
    async function load() {
      if (params.loadingRef.current) return;
      params.loadingRef.current = true;

      try {
        const forceRefresh = params.profileRefreshTick > 0;
        const profLocal = await params.ensureProfile({
          current: params.profile,
          forceRefresh,
          isValidISO: params.isValidISO,
          getSessionUser: params.getSessionUser,
          fetchProfileById: params.fetchProfileById,
          mapProfile: params.mapPusslaProfileRow,
        });

        if (forceRefresh && profLocal) {
          params.setProfile(profLocal);
          params.setStStartISO(
            params.normalizeISODateOnlyGlobal(profLocal.stStartDate) ||
              params.normalizeISODateOnlyGlobal(profLocal.btStartDate) ||
              null
          );
          params.setStEndISO(
            params.normalizeISODateOnlyGlobal(profLocal.stEndDate) ||
              params.normalizeISODateOnlyGlobal(profLocal.stEndISO) ||
              null
          );
        }

        const loadUid = await params.resolveUserId({
          authUserId: params.authUserId,
          getSessionUser: params.getSessionUser,
          onResolvedUser: (user: any) => {
            if (user?.id) params.setAuthUser(user as any);
          },
        });

        const { placements: dbPlac, courses: dbCourses } = await params.fetchLockedTimelineRows(loadUid);
        const effectiveStartYear = params.computeEffectiveStartYear({
          profile: profLocal as any,
          fallbackStartYear: params.startYear,
          isValidISO: params.isValidISO,
          placements: dbPlac,
          courses: dbCourses,
        });
        if (effectiveStartYear !== params.startYear) params.setStartYear(effectiveStartYear);

        const lockedActs = params.mapLockedPlacementsToActivities(dbPlac, {
          effectiveStartYear,
          dateToISO: params.dateToISO,
          dateToSlot: params.dateToSlot,
          nextHue: params.nextHue,
          inferPhaseByBT: (startISO?: string) =>
            params.inferPlacementPhaseByProfileBt((profLocal || params.profile) as any, params.stStartISO, startISO),
        });

        const lockedCrs = params.mapLockedCoursesToTimeline(dbCourses, params.phaseForCourseDates);

        const lsAbove = 0;
        const lsBelow = 0;
        const lsDismissed: string[] = [];
        const draftActs: any[] = [];
        const draftCrs: any[] = [];
        const MAX_EXTRA_YEARS = 50;

        const sanitizedDrafts = params.sanitizeTimelineDrafts({
          draftActivities: draftActs as any[],
          draftCourses: draftCrs as any[],
          startYear: params.startYear,
          slotsPerYear: params.slotsPerYear,
          slotToYearMonthHalf: params.slotToYearMonthHalf,
          isValidISO: params.isValidISO,
        });

        const hydrated = params.composeHydratedTimelineState({
          lockedActivities: lockedActs as any[],
          lockedCourses: lockedCrs as any[],
          draftActivities: sanitizedDrafts.activities as any[],
          draftCourses: sanitizedDrafts.courses as any[],
          profile: params.profile as any,
          stStartISO: params.stStartISO,
          effectiveStartYear,
          totalYearsNeeded: params.totalYearsNeeded,
          lsAbove,
          lsBelow,
          maxExtraYears: MAX_EXTRA_YEARS,
          isValidISO: params.isValidISO,
          isoToDateSafe: params.isoToDateSafe,
          dateToSlot: params.dateToSlot,
          slotToYearMonthHalf: params.slotToYearMonthHalf,
          mondayNearestTo: params.mondayNearestTo,
          dateToISO: params.dateToISO,
        });

        const allActivities = hydrated.allActivities as any[];
        const allCourses = hydrated.allCourses as any[];
        const { nextAbove, nextBelow } = hydrated;

        const pendingResolved = params.resolvePendingScanSelection(
          params.pendingScanSelectionRef.current as any,
          allActivities as any[],
          allCourses as any[]
        );
        if (pendingResolved.consumed) {
          if (pendingResolved.placementId) {
            params.setSelectedPlacementId(pendingResolved.placementId);
            params.setSelectedCourseId(null);
          } else if (pendingResolved.courseId) {
            params.setSelectedCourseId(pendingResolved.courseId);
            params.setSelectedPlacementId(null);
          }
          if (pendingResolved.lane) params.setActiveLane(pendingResolved.lane);
          params.pendingScanSelectionRef.current = null;
        }

        params.setActivities(allActivities);
        params.setCourses(allCourses);
        params.setYearsAbove(nextAbove);
        params.setYearsBelow(nextBelow);
        params.setDismissedGaps(lsDismissed);
        params.hydratedRef.current = true;
      } catch {
        // ignore
      } finally {
        params.loadingRef.current = false;
      }
    }

    load();
    return registerTimelineSyncEvents({
      onReload: load,
      onSetPendingSelection: (selection) => {
        params.pendingScanSelectionRef.current = selection;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.startYear, params.profileRefreshTick]);
}

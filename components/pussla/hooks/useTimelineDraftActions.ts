"use client";

import { useCallback } from "react";
import { patchEntityById } from "@/lib/pussla/entityPatches";
import { normalizePlacementMonths } from "@/lib/pussla/placementMonths";
import { buildActivityAtSlot, buildPlacementFromDateRange } from "@/lib/pussla/placementFactory";
import { buildCourseAtDate, buildCourseFromDateRange } from "@/lib/pussla/courseFactory";
import { inferPhaseByBTRuntime } from "@/lib/pussla/phaseInference";
import { buildUpdatedCourseModel } from "@/lib/pussla/courseUpdateModel";

export function useTimelineDraftActions(params: {
  uid: () => string;
  activities: any[];
  profile: any;
  stStartISO: string | null;
  startYear: number;
  slotToYearMonthHalf: any;
  mondayNearestTo: any;
  sundayNearestTo: any;
  dateToISO: any;
  isoToDateSafe: any;
  isValidISO: any;
  addMonths: any;
  wouldOverlap: (id: string | null, startSlot: number, lengthSlots: number) => boolean;
  setActivities: (updater: any) => void;
  setSelectedPlacementId: (id: string | null) => void;
  setSelectedCourseId: (id: string | null) => void;
  savePlacementToDb: (placement: any) => Promise<boolean>;
  setCourses: (updater: any) => void;
  switchActivity: (newPlacementId: string | null, newCourseId: string | null) => boolean;
  saveCourseToDb: (course: any) => Promise<boolean>;
  dateToSlot: any;
  computePhaseByEndSlot: any;
  setActiveLane: (lane: "placement" | "course") => void;
  mapMetisGoalsToMilestoneIds: any;
  sanitizeStMilestonesForGoals: any;
  selectedCourseIdRef: React.MutableRefObject<string | null>;
  selectedCourseId: string | null;
  btEndISO: string | null;
  todayISO: () => string;
  normalizeISODateOnlyGlobal: any;
  setTypeDraft: (value: any) => void;
  setLabelDraft: (value: string) => void;
  setMonthsDraft: (value: number) => void;
  selectedPlacement: any;
  nextHue: (i: number) => number;
}) {
  const updateSelectedPlacement = useCallback(
    (upd: any) => {
      if (!params.selectedPlacement) return;
      params.setActivities((prev: any[]) =>
        patchEntityById(prev as any[], params.selectedPlacement.id, upd as any) as any[]
      );
    },
    [params]
  );

  const onTypeChange = useCallback(
    (t: any) => {
      params.setTypeDraft(t);
      if (params.selectedPlacement) updateSelectedPlacement({ type: t });
    },
    [params, updateSelectedPlacement]
  );

  const onLabelChange = useCallback(
    (v: string) => {
      params.setLabelDraft(v);
      if (params.selectedPlacement) updateSelectedPlacement({ label: v || undefined });
    },
    [params, updateSelectedPlacement]
  );

  const onMonthsChange = useCallback(
    (newMonths: number) => {
      const normalized = normalizePlacementMonths(newMonths);
      params.setMonthsDraft(normalized.months);
      if (params.selectedPlacement) {
        if (!params.wouldOverlap(params.selectedPlacement.id, params.selectedPlacement.startSlot, normalized.lengthSlots)) {
          updateSelectedPlacement({ lengthSlots: normalized.lengthSlots });
        }
      }
    },
    [params, updateSelectedPlacement]
  );

  const addActivityAt = useCallback(
    (slot: number) => {
      const start = slot;
      const len = 1;
      if (params.wouldOverlap(null, start, len)) return;
      const newAct = buildActivityAtSlot({
        id: params.uid(),
        slot: start,
        startYear: params.startYear,
        hue: params.nextHue(params.activities.length),
        goalsVersion: (params.profile as any)?.goalsVersion,
        btStartISO: (params.profile as any)?.btStartDate || null,
        stStartISO: params.stStartISO || (params.profile as any)?.stStartDate || null,
        btEndManualISO: (params.profile as any)?.btEndDate || null,
        slotToYearMonthHalf: params.slotToYearMonthHalf,
        mondayNearestTo: params.mondayNearestTo,
        sundayNearestTo: params.sundayNearestTo,
        dateToISO: params.dateToISO,
        isoToDateSafe: params.isoToDateSafe,
        isValidISO: params.isValidISO,
        addMonths: params.addMonths,
      }) as any;
      params.setActivities((prev: any[]) => [...prev, newAct]);
      params.setSelectedPlacementId(newAct.id);
      params.setSelectedCourseId(null);
      void params.savePlacementToDb(newAct);
    },
    [params]
  );

  const createCourseAt = useCallback(
    (dateISO: string, kind: any = "Kurs") => {
      const c = buildCourseAtDate({
        id: params.uid(),
        dateISO,
        kind,
        inferPhase: (iso) =>
          inferPhaseByBTRuntime({
            startISO: iso,
            profile: params.profile,
            isValidISO: params.isValidISO,
            isoToDateSafe: params.isoToDateSafe,
            dateToISO: params.dateToISO,
          }),
      }) as any;
      params.setCourses((prev: any[]) => [...prev, c]);
      params.switchActivity(null, c.id);
      void params.saveCourseToDb(c);
    },
    [params]
  );

  const createPlacementFromDateRange = useCallback(
    async (
      title: string,
      startDate: string,
      endDate: string,
      placementType: any = "Klinisk tjänstgöring"
    ): Promise<{ ok: boolean; message: string }> => {
      if (!params.isValidISO(startDate) || !params.isValidISO(endDate)) {
        return { ok: false, message: "Ogiltigt datumformat. Använd YYYY-MM-DD." };
      }
      const created = buildPlacementFromDateRange({
        id: params.uid(),
        title,
        startDate,
        endDate,
        placementType,
        startYear: params.startYear,
        hue: params.nextHue(params.activities.length),
        dateToSlot: params.dateToSlot,
        computePhaseByEndSlot: params.computePhaseByEndSlot,
      });
      if ("error" in created) return { ok: false, message: created.error };
      const { placement: newActRaw, normalizedEnd } = created;
      const newAct = newActRaw as any;
      if (params.wouldOverlap(null, newAct.startSlot, newAct.lengthSlots)) {
        return { ok: false, message: "Placeringen överlappar en befintlig aktivitet. Justera datum." };
      }
      params.setActivities((prev: any[]) => [...prev, newAct]);
      params.setSelectedPlacementId(newAct.id);
      params.setSelectedCourseId(null);
      params.setActiveLane("placement");
      const saved = await params.savePlacementToDb(newAct);
      if (!saved) return { ok: false, message: "Placeringen skapades men kunde inte sparas i databasen." };
      return {
        ok: true,
        message: `${placementType} skapad: ${newAct.label} (${startDate} till ${normalizedEnd}) och sparades i databasen.`,
      };
    },
    [params]
  );

  const createCourseFromDateRange = useCallback(
    async (
      title: string,
      startDate: string,
      endDate: string,
      kind: any = "Kurs"
    ): Promise<{ ok: boolean; message: string }> => {
      if (!params.isValidISO(startDate) || !params.isValidISO(endDate)) {
        return { ok: false, message: "Ogiltigt datumformat. Använd YYYY-MM-DD." };
      }
      const { course: newCourseRaw, normalizedEnd } = buildCourseFromDateRange({
        id: params.uid(),
        title,
        startDate,
        endDate,
        kind,
        startYear: params.startYear,
        profile: { goalsVersion: (params.profile as any)?.goalsVersion },
        mapMetisGoalsToMilestoneIds: (courseTitle: string) =>
          params.mapMetisGoalsToMilestoneIds(courseTitle, params.profile),
        sanitizeStMilestonesForGoals: params.sanitizeStMilestonesForGoals,
        dateToSlot: params.dateToSlot,
        computePhaseByEndSlot: params.computePhaseByEndSlot,
      });
      const newCourse = newCourseRaw as any;
      params.setCourses((prev: any[]) => [...prev, newCourse]);
      params.setSelectedPlacementId(null);
      params.setSelectedCourseId(newCourse.id);
      params.setActiveLane("course");
      const saved = await params.saveCourseToDb(newCourse);
      if (!saved) return { ok: false, message: "Kunde inte spara kursen till databasen." };
      return {
        ok: true,
        message: `${kind} skapad: ${newCourse.title} (${startDate} till ${normalizedEnd}) och sparades i databasen.`,
      };
    },
    [params]
  );

  const updateSelectedCourse = useCallback(
    (upd: any) => {
      const targetId = params.selectedCourseIdRef.current || params.selectedCourseId;
      if (!targetId) return;
      params.setCourses((prev: any[]) =>
        prev.map((c) => {
          if (c.id !== targetId) return c;
          return buildUpdatedCourseModel({
            current: c as any,
            update: upd as any,
            goalsVersion: (params.profile as any)?.goalsVersion,
            btStartISO: (params.profile as any)?.btStartDate || null,
            btEndISO: params.btEndISO || null,
            fallbackISO: params.todayISO(),
            isValidISO: params.isValidISO,
            normalizeISODateOnlyGlobal: params.normalizeISODateOnlyGlobal,
          }) as any;
        })
      );
    },
    [params]
  );

  return {
    addActivityAt,
    updateSelectedPlacement,
    onTypeChange,
    onLabelChange,
    onMonthsChange,
    createCourseAt,
    createPlacementFromDateRange,
    createCourseFromDateRange,
    updateSelectedCourse,
  };
}

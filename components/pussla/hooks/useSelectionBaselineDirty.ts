"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { applyCourseBaseline, applyPlacementBaseline } from "@/lib/pussla/baselineRestore";
import { computeDirtyFromBaseline } from "@/lib/pussla/dirtyState";
import { computeBaselineSyncPlan } from "@/lib/pussla/baselineSync";

export function useSelectionBaselineDirty(params: {
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  selectedPlacement: any;
  selectedCourse: any;
  setDirty: (value: boolean) => void;
  setActivities: (updater: any) => void;
  setCourses: (updater: any) => void;
  isPlacementDirty: any;
  isCourseDirty: any;
}) {
  const baselineRef: MutableRefObject<{ placement?: any; course?: any } | null> = useRef(null);
  const baselinePlacementIdRef = useRef<string | null>(null);
  const baselineCourseIdRef = useRef<string | null>(null);

  useEffect(() => {
    const plan = computeBaselineSyncPlan({
      selectedPlacementId: params.selectedPlacementId,
      selectedCourseId: params.selectedCourseId,
      baselinePlacementId: baselinePlacementIdRef.current,
      baselineCourseId: baselineCourseIdRef.current,
      hasBaselinePlacement: !!baselineRef.current?.placement,
      hasBaselineCourse: !!baselineRef.current?.course,
      hasSelectedPlacement: !!params.selectedPlacement,
      hasSelectedCourse: !!params.selectedCourse,
    });

    baselinePlacementIdRef.current = plan.nextBaselinePlacementId;
    baselineCourseIdRef.current = plan.nextBaselineCourseId;
    if (plan.clearBaseline) baselineRef.current = null;
    if (plan.setBaselineKind === "placement" && params.selectedPlacement) {
      baselineRef.current = { placement: structuredClone(params.selectedPlacement) };
    } else if (plan.setBaselineKind === "course" && params.selectedCourse) {
      baselineRef.current = { course: structuredClone(params.selectedCourse) };
    }
    if (plan.resetDirty) params.setDirty(false);
  }, [params.selectedPlacementId, params.selectedCourseId, params.selectedPlacement, params.selectedCourse, params.setDirty]);

  const checkDirty = useCallback(() => {
    return computeDirtyFromBaseline({
      baseline: baselineRef.current as any,
      selectedPlacement: params.selectedPlacement as any,
      selectedCourse: params.selectedCourse as any,
      isPlacementDirty: params.isPlacementDirty as any,
      isCourseDirty: params.isCourseDirty as any,
    });
  }, [params.selectedPlacement, params.selectedCourse, params.isPlacementDirty, params.isCourseDirty]);

  useEffect(() => {
    const isDirty = checkDirty();
    params.setDirty(isDirty);
  }, [checkDirty, params.setDirty]);

  const restoreBaseline = useCallback(() => {
    const baseline = baselineRef.current;
    if (!baseline) return;

    if (baseline.placement && params.selectedPlacement) {
      const b = baseline.placement;
      params.setActivities((prev: any[]) =>
        applyPlacementBaseline({
          activities: prev as any[],
          selectedPlacementId: params.selectedPlacement.id,
          baselinePlacement: b,
        }) as any[]
      );
    } else if (baseline.course && params.selectedCourse) {
      const b = baseline.course;
      params.setCourses((prev: any[]) =>
        applyCourseBaseline({
          courses: prev as any[],
          selectedCourseId: params.selectedCourse.id,
          baselineCourse: b,
        }) as any[]
      );
    }
  }, [params.selectedPlacement, params.selectedCourse, params.setActivities, params.setCourses]);

  return { baselineRef, restoreBaseline };
}

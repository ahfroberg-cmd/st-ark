"use client";

import { useEffect, useRef } from "react";

export function usePusslaTimelineDragRuntime(params: any) {
  type PlacementDrag = {
    id: string;
    mode: "move" | "resize-left" | "resize-right";
    startCol: number;
    rowLeft: number;
    rowTop: number;
    colWidth: number;
    rowHeight: number;
    startRowIndex: number;
    startSlot: number;
    lengthSlots: number;
  };
  const dragPlacementRef = useRef<PlacementDrag | null>(null);

  type CourseDrag = {
    id: string;
    year: number;
    rowLeft: number;
    rowTop: number;
    rowWidth: number;
    rowHeight: number;
    daysInYear: number;
    mode: "start" | "end" | "move";
    startDayIndex?: number;
  };
  const dragCourseRef = useRef<CourseDrag | null>(null);

  const setFormDatesFromSlots = (startSlot: number, lengthSlots: number, activityId?: string) => {
    if (params.activeCard === "course" && params.selectedCourseId) {
      params.setCourses((prev: any[]) =>
        params.applyCourseDatesFromSlots({
          courses: prev,
          selectedCourseId: params.selectedCourseId,
          startSlot,
          lengthSlots,
          computePhaseByEndSlot: params.computePhaseByEndSlot,
          computeMondayDates: (activityLike: any) => params.computeMondayDates(activityLike),
        })
      );
      params.setActiveLane("course");
      return;
    }

    const targetId = activityId || params.selectedPlacementId;
    if (!targetId) return;
    params.setActivities((prev: any[]) =>
      params.applyActivityDatesFromSlots({
        activities: prev,
        activityId: targetId,
        startSlot,
        lengthSlots,
        computePhaseByEndSlot: params.computePhaseByEndSlot,
        computeMondayDates: (activity: any) => params.computeMondayDates(activity),
      })
    );
    params.setActiveLane("placement");
  };

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (dragPlacementRef.current) {
        const d = dragPlacementRef.current;
        const colPerYear = params.slotsPerYear();
        const { targetRowIndex, colWithinRow, deltaColsGlobal } = params.pointerToGlobalDelta({
          clientX: e.clientX,
          clientY: e.clientY,
          rowLeft: d.rowLeft,
          rowTop: d.rowTop,
          rowHeight: d.rowHeight,
          colWidth: d.colWidth,
          startRowIndex: d.startRowIndex,
          startCol: d.startCol,
          visibleYearCount: params.visibleYearCount,
          columnsPerYear: colPerYear,
          clamp: params.clamp,
        });

        const minSlotGlobal = 0;
        const maxSlotGlobal = params.visibleYearCount * params.slotsPerYear();
        const overlapsAt = (start: number, len: number) => params.wouldOverlap(d.id, start, len);

        if (d.mode === "move") {
          const moved = params.computeMoveStartNoOverlap({
            startSlot: d.startSlot,
            deltaColsGlobal,
            lengthSlots: d.lengthSlots,
            minSlotGlobal,
            maxSlotGlobal,
            overlapsAt,
            clamp: params.clamp,
          });
          if (!moved) return;
          const newStart = moved.startSlot;
          params.setActivities((prev: any[]) =>
            params.applyMovePlacement({
              activities: prev,
              id: d.id,
              newStart,
              resolvePhase: (activity: any) =>
                params.resolveMovedPlacementPhase({
                  existingPhase: activity.phase,
                  goalsVersion: params.profile?.goalsVersion,
                  btStartISO: params.profile?.btStartDate || null,
                  btEndISO: params.btEndISO,
                  startYear: params.startYear,
                  startSlot: newStart,
                  slotToYearMonthHalf: params.slotToYearMonthHalf,
                  mondayNearestTo: params.mondayNearestTo,
                  dateToISO: params.dateToISO,
                }),
            })
          );
          setFormDatesFromSlots(newStart, d.lengthSlots, d.id);
          return;
        }

        if (d.mode === "resize-left") {
          const startSlotGlobal = targetRowIndex * colPerYear + colWithinRow;
          const endSlotFixed = d.startSlot + d.lengthSlots - 1;
          const adjusted = params.adjustResizeLeftNoOverlap({
            startSlotGlobal,
            endSlotFixed,
            minSlotGlobal,
            overlapsAt,
            clamp: params.clamp,
          });
          if (!adjusted) return;
          const newStart = adjusted.startSlot;
          const newLen = adjusted.lengthSlots;
          params.setActivities((prev: any[]) =>
            params.applyResizeLeftPlacement({
              activities: prev,
              id: d.id,
              newStart,
              newLength: newLen,
              phaseForSlots: params.phaseForSlots,
            })
          );
          setFormDatesFromSlots(newStart, newLen, d.id);
          return;
        }

        if (d.mode === "resize-right") {
          const endSlotGlobal = targetRowIndex * colPerYear + colWithinRow;
          const adjusted = params.adjustResizeRightNoOverlap({
            endSlotGlobal,
            startSlot: d.startSlot,
            maxSlotGlobal,
            overlapsAt,
          });
          if (!adjusted) return;
          const newLen = adjusted.lengthSlots;
          params.setActivities((prev: any[]) =>
            params.applyResizeRightPlacement({
              activities: prev,
              id: d.id,
              newLength: newLen,
              phaseForSlots: params.phaseForSlots,
            })
          );
          setFormDatesFromSlots(d.startSlot, newLen, d.id);
          return;
        }
      }

      if (dragCourseRef.current) {
        const d = dragCourseRef.current;
        const dragTarget = params.computeCourseDragDate({
          clientX: e.clientX,
          clientY: e.clientY,
          rowLeft: d.rowLeft,
          rowTop: d.rowTop,
          rowWidth: d.rowWidth,
          rowHeight: d.rowHeight,
          daysInYear: d.daysInYear,
          year: d.year,
          startYear: params.startYear,
          totalYearsNeeded: params.totalYearsNeeded,
          daysInYearForYear: params.daysInYear,
          dateToISO: params.dateToISO,
        });
        const iso = dragTarget.iso;
        if (dragCourseRef.current) {
          dragCourseRef.current.year = dragTarget.nextYear;
          dragCourseRef.current.daysInYear = dragTarget.nextDaysInYear;
          dragCourseRef.current.rowTop = dragTarget.nextRowTop;
        }
        params.setCourses((prev: any[]) =>
          prev.map((c) => {
            if (c.id !== d.id) return c;
            return params.buildDraggedCourse({
              course: c,
              iso,
              mode: d.mode as "move" | "start" | "end",
              phaseForCourseDates: params.phaseForCourseDates,
              dateToISO: params.dateToISO,
            });
          })
        );
      }
    }

    async function onUp() {
      dragPlacementRef.current = null;
      dragCourseRef.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.activities, params.courses, params.selectedPlacementId, params.selectedCourseId]);

  return {
    dragPlacementRef,
    dragCourseRef,
  };
}

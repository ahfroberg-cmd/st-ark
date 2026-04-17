"use client";

import { useCallback } from "react";
import {
  applyActivityDateRangeUpdate,
  getActivityEndISO,
  getActivityStartISO,
} from "@/lib/pussla/activityDateRange";

type OverlapSuggestion = {
  startISO: string;
  endISO: string;
};

type ActivityLike = {
  id: string;
  exactStartISO?: string;
  exactEndISO?: string;
  startSlot: number;
  lengthSlots: number;
  phase?: "BT" | "ST";
  [key: string]: unknown;
};

type Params = {
  selectedPlacement: ActivityLike | null;
  activities: ActivityLike[];
  startYear: number;
  isValidISO: (iso: string) => boolean;
  dateToISO: (d: Date) => string;
  dateToSlot: (startYear: number, dISO: string, mode: "start" | "end") => number;
  roundToAnchors: (iso: string, mode: "start" | "end") => string;
  slotToYearMonthHalf: (startYear: number, slot: number) => { year: number; month0: number; half: 0 | 1 };
  mondayNearestTo: (year: number, month0: number, day: number) => Date;
  sundayBeforeAnchor: (year: number, month0: number, day: number) => Date;
  resolveLengthSlotsForExactEnd: (
    startSlot: number,
    desiredEndISO: string
  ) => { lengthSlots: number; grid: { startISO: string; endISO: string } };
  phaseForSlots: (startSlot: number, lengthSlots: number) => "BT" | "ST";
  setActivities: React.Dispatch<React.SetStateAction<ActivityLike[]>>;
  setOverlapWarning: React.Dispatch<React.SetStateAction<string | null>>;
  setOverlapSuggestion: React.Dispatch<React.SetStateAction<OverlapSuggestion | null>>;
};

export function useApplyPlacementDates({
  selectedPlacement,
  activities,
  startYear,
  isValidISO,
  dateToISO,
  dateToSlot,
  roundToAnchors,
  slotToYearMonthHalf,
  mondayNearestTo,
  sundayBeforeAnchor,
  resolveLengthSlotsForExactEnd,
  phaseForSlots,
  setActivities,
  setOverlapWarning,
  setOverlapSuggestion,
}: Params) {
  return useCallback(
    (which: "start" | "end", iso: string) => {
      const selAct = selectedPlacement;
      if (!selAct) return;

      setOverlapWarning(null);
      setOverlapSuggestion(null);

      const addDaysISO = (base: string, delta: number): string => {
        const d = new Date(base + "T00:00:00");
        d.setDate(d.getDate() + delta);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${d.getFullYear()}-${mm}-${dd}`;
      };

      const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
        aStart <= bEnd && bStart <= aEnd;

      const activityStartISO = (a: ActivityLike): string =>
        getActivityStartISO({
          activity: a as any,
          startYear,
          isValidISO,
          slotToYearMonthHalf,
          mondayNearestTo,
          dateToISO,
        });

      const activityEndISO = (a: ActivityLike): string =>
        getActivityEndISO({
          activity: a as any,
          startYear,
          isValidISO,
          slotToYearMonthHalf,
          sundayBeforeAnchor,
          dateToISO,
        });

      const proposedStart0 = which === "start" ? iso : activityStartISO(selAct);
      const proposedEnd0 = which === "end" ? iso : activityEndISO(selAct);
      if (!isValidISO(proposedStart0) || !isValidISO(proposedEnd0)) return;

      let proposedStart = proposedStart0;
      let proposedEnd = proposedEnd0;
      if (proposedEnd < proposedStart) {
        if (which === "start") proposedEnd = proposedStart;
        else proposedStart = proposedEnd;
      }

      const overlapping = () => {
        const overlaps: any[] = [];
        for (const a of activities) {
          if (!a || a.id === selAct.id) continue;
          const os = activityStartISO(a);
          const oe = activityEndISO(a);
          if (!isValidISO(os) || !isValidISO(oe)) continue;
          if (rangesOverlap(proposedStart, proposedEnd, os, oe)) overlaps.push({ a, os, oe });
        }
        return overlaps;
      };

      let overlaps = overlapping();
      if (overlaps.length > 0) {
        const maxIterations = (activities?.length || 0) + 5;
        let i = 0;

        while (i++ < maxIterations) {
          overlaps = overlapping();
          if (overlaps.length === 0) break;

          if (which === "start") {
            let maxEnd = proposedStart;
            for (const o of overlaps) {
              if (o.oe > maxEnd) maxEnd = o.oe;
            }
            proposedStart = roundToAnchors(addDaysISO(maxEnd, 1), "start");
            if (proposedEnd < proposedStart) proposedEnd = proposedStart;
          } else {
            let minStart = proposedEnd;
            for (const o of overlaps) {
              if (o.os < minStart) minStart = o.os;
            }
            proposedEnd = roundToAnchors(addDaysISO(minStart, -1), "end");
            if (proposedEnd < proposedStart) proposedStart = proposedEnd;
          }
        }

        if (overlapping().length === 0) {
          setOverlapSuggestion({ startISO: proposedStart, endISO: proposedEnd });
          setOverlapWarning(
            "Valt datum skulle skapa överlapp med en annan aktivitet. Välj närmaste datum för att justera."
          );
          return;
        }
      }

      if (overlapping().length > 0) {
        setOverlapWarning(
          "Datumen överlappar fortfarande en annan aktivitet efter justering. Flytta start eller slut så att aktiviteterna inte överlappar."
        );
        return;
      }

      const s = dateToSlot(startYear, proposedStart, "start");
      setActivities((prev) =>
        applyActivityDateRangeUpdate({
          activities: prev as any,
          activityId: selAct.id,
          startSlot: s,
          desiredEndISO: proposedEnd,
          resolveLengthSlotsForExactEnd,
          phaseForSlots,
        }) as any
      );
    },
    [
      activities,
      dateToISO,
      dateToSlot,
      isValidISO,
      mondayNearestTo,
      phaseForSlots,
      resolveLengthSlotsForExactEnd,
      roundToAnchors,
      selectedPlacement,
      setActivities,
      setOverlapSuggestion,
      setOverlapWarning,
      slotToYearMonthHalf,
      startYear,
      sundayBeforeAnchor,
    ]
  );
}

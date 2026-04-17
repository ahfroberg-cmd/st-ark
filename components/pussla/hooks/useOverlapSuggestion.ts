"use client";

import { useCallback, useState } from "react";
import { applyActivityDateRangeUpdate } from "@/lib/pussla/activityDateRange";

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
  selectedPlacement: { id: string } | null;
  startYear: number;
  isValidISO: (iso: string) => boolean;
  dateToSlot: (startYear: number, dISO: string, mode: "start" | "end") => number;
  resolveLengthSlotsForExactEnd: (
    startSlot: number,
    desiredEndISO: string
  ) => { lengthSlots: number; grid: { startISO: string; endISO: string } };
  phaseForSlots: (startSlot: number, lengthSlots: number) => "BT" | "ST";
  setActivities: React.Dispatch<React.SetStateAction<ActivityLike[]>>;
};

export function useOverlapSuggestion({
  selectedPlacement,
  startYear,
  isValidISO,
  dateToSlot,
  resolveLengthSlotsForExactEnd,
  phaseForSlots,
  setActivities,
}: Params) {
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [overlapSuggestion, setOverlapSuggestion] = useState<OverlapSuggestion | null>(null);

  const clearOverlapState = useCallback(() => {
    setOverlapWarning(null);
    setOverlapSuggestion(null);
  }, []);

  const applyOverlapSuggestion = useCallback(() => {
    const selAct = selectedPlacement;
    if (!selAct) return;
    if (!overlapSuggestion) return;

    const proposedStart = overlapSuggestion.startISO;
    const proposedEnd = overlapSuggestion.endISO;
    if (!isValidISO(proposedStart) || !isValidISO(proposedEnd)) return;

    setOverlapWarning(null);
    setOverlapSuggestion(null);

    const s = dateToSlot(startYear, proposedStart, "start");
    setActivities((prev) =>
      applyActivityDateRangeUpdate({
        activities: prev,
        activityId: selAct.id,
        startSlot: s,
        desiredEndISO: proposedEnd,
        resolveLengthSlotsForExactEnd,
        phaseForSlots,
      })
    );
  }, [
    dateToSlot,
    isValidISO,
    overlapSuggestion,
    phaseForSlots,
    resolveLengthSlotsForExactEnd,
    selectedPlacement,
    setActivities,
    startYear,
  ]);

  return {
    overlapWarning,
    overlapSuggestion,
    setOverlapWarning,
    setOverlapSuggestion,
    clearOverlapState,
    applyOverlapSuggestion,
  };
}

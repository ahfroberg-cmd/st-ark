"use client";

import { useCallback, useState } from "react";
import type { PlacementPeriodSuggestionDialogState } from "@/components/pussla/PlacementPeriodSuggestionDialog";
import { applyActivityDateRangeUpdate } from "@/lib/pussla/activityDateRange";

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

export function usePlacementPeriodSuggestionDialog({
  startYear,
  isValidISO,
  dateToSlot,
  resolveLengthSlotsForExactEnd,
  phaseForSlots,
  setActivities,
}: Params) {
  const [dialog, setDialog] = useState<PlacementPeriodSuggestionDialogState | null>(null);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const applyDialog = useCallback(() => {
    const dlg = dialog;
    if (!dlg) return;
    const startISO = dlg.startISO;
    const endISO = dlg.proposedEndISO;
    if (!isValidISO(startISO) || !isValidISO(endISO)) {
      setDialog(null);
      return;
    }
    const s = dateToSlot(startYear, startISO, "start");
    setActivities((prev) =>
      applyActivityDateRangeUpdate({
        activities: prev,
        activityId: dlg.activityId,
        startSlot: s,
        desiredEndISO: endISO,
        resolveLengthSlotsForExactEnd,
        phaseForSlots,
      })
    );
    setDialog(null);
  }, [dateToSlot, dialog, isValidISO, phaseForSlots, resolveLengthSlotsForExactEnd, setActivities, startYear]);

  return {
    placementPeriodSuggestionDialog: dialog,
    setPlacementPeriodSuggestionDialog: setDialog,
    closePlacementPeriodSuggestionDialog: closeDialog,
    applyPlacementPeriodSuggestion: applyDialog,
  };
}

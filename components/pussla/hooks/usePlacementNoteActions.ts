"use client";

import { useCallback } from "react";
import type { SuggestionsPopupFor } from "@/components/pussla/hooks/useSuggestionsPopup";

type ActivityLike = {
  id: string;
  note?: string;
  [key: string]: unknown;
};

type Params = {
  selectedPlacement: { id: string; note?: string } | null;
  setActivities: React.Dispatch<React.SetStateAction<ActivityLike[]>>;
  forslagPopupFor: SuggestionsPopupFor;
  setForslagPopupFor: React.Dispatch<React.SetStateAction<SuggestionsPopupFor>>;
};

export function usePlacementNoteActions({
  selectedPlacement,
  setActivities,
  forslagPopupFor,
  setForslagPopupFor,
}: Params) {
  const updatePlacementNote = useCallback(
    (note: string) => {
      const sel = selectedPlacement;
      if (!sel) return;
      setActivities((prev) => prev.map((a) => (a.id === sel.id ? { ...a, note } : a)));
    },
    [selectedPlacement, setActivities]
  );

  const appendPlacementStudierektorRow = useCallback(
    (rowText: string) => {
      const sel = selectedPlacement;
      if (!sel) return;
      const current = sel.note || "";
      const next = current ? `${current}\n${rowText}` : rowText;
      setActivities((prev) => prev.map((a) => (a.id === sel.id ? { ...a, note: next } : a)));
    },
    [selectedPlacement, setActivities]
  );

  const appendPlacementColleagueDescription = useCallback(
    (description: string) => {
      const sel = selectedPlacement;
      if (!sel) return;
      const current = sel.note || "";
      const next = current ? `${current}\n\n${description}` : description;
      setActivities((prev) => prev.map((a) => (a.id === sel.id ? { ...a, note: next } : a)));
    },
    [selectedPlacement, setActivities]
  );

  const closePlacementSuggestions = useCallback(() => {
    setForslagPopupFor(null);
  }, [setForslagPopupFor]);

  const togglePlacementSuggestions = useCallback(
    (hasSuggestionSources: boolean) => {
      if (!hasSuggestionSources) return;
      setForslagPopupFor(forslagPopupFor === "placement" ? null : "placement");
    },
    [forslagPopupFor, setForslagPopupFor]
  );

  return {
    updatePlacementNote,
    appendPlacementStudierektorRow,
    appendPlacementColleagueDescription,
    closePlacementSuggestions,
    togglePlacementSuggestions,
  };
}

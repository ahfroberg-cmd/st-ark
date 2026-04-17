"use client";

import { useEffect, useState } from "react";

export type SuggestionsPopupFor = "placement" | "course" | "utbildningsmoment" | null;
export type SuggestionsTab = "studierektor" | "kollegor";

export function useSuggestionsPopup(params: {
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
}) {
  const { selectedPlacementId, selectedCourseId } = params;

  const [popupFor, setPopupFor] = useState<SuggestionsPopupFor>(null);
  const [tab, setTab] = useState<SuggestionsTab>("studierektor");

  useEffect(() => {
    if (!popupFor) return;

    const shouldKeepOpen = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return !!el.closest('[data-note-editor="true"], [data-forslag-popup="true"]');
    };

    const closeIfOutside = (e: Event) => {
      if (!shouldKeepOpen(e.target)) {
        setPopupFor(null);
      }
    };

    document.addEventListener("focusin", closeIfOutside);
    document.addEventListener("pointerdown", closeIfOutside);
    return () => {
      document.removeEventListener("focusin", closeIfOutside);
      document.removeEventListener("pointerdown", closeIfOutside);
    };
  }, [popupFor]);

  useEffect(() => {
    setPopupFor(null);
  }, [selectedPlacementId, selectedCourseId]);

  return {
    popupFor,
    setPopupFor,
    tab,
    setTab,
  };
}

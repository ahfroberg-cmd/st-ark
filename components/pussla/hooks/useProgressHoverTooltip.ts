"use client";

import { useCallback } from "react";

type ProgressHoverPhase = "bt" | "st";

type ProgressHoverActivity = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  days: number;
  attendance: number;
  hue: number;
};

type HoveredProgressActivity = ProgressHoverActivity & {
  phase: ProgressHoverPhase;
  anchorX: number;
  anchorTop: number;
};

export function useProgressHoverTooltip(params: {
  setHoveredTimeAct: React.Dispatch<React.SetStateAction<HoveredProgressActivity | null>>;
}) {
  const { setHoveredTimeAct } = params;

  const createProgressHoverEnterHandler = useCallback(
    (act: ProgressHoverActivity, phase: ProgressHoverPhase) =>
      (e: React.MouseEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const anchorX = rect.left + rect.width / 2;
        const anchorTop = rect.top;
        setHoveredTimeAct({ ...act, phase, anchorX, anchorTop });
      },
    [setHoveredTimeAct]
  );

  const clearProgressHover = useCallback(() => {
    setHoveredTimeAct(null);
  }, [setHoveredTimeAct]);

  return {
    createProgressHoverEnterHandler,
    clearProgressHover,
  };
}

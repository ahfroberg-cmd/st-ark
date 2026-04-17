"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCourseHoverSpotRaf } from "@/components/pussla/hooks/useCourseHoverSpotRaf";

export function useTimelineLaneInteraction() {
  const laneRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [laneWidthByYear, setLaneWidthByYear] = useState<Record<number, number>>({});
  const chipWidthsRef = useRef<Record<string, number>>({});
  const [, forceRerender] = useState(0);
  const [, setHover] = useState<{ row: number; col: number } | null>(null);

  const { courseHoverSpot, updateCourseHoverSpot, clearCourseHoverSpotForCell } = useCourseHoverSpotRaf();

  useEffect(() => {
    function updateLaneWidths() {
      const next: Record<number, number> = {};
      for (const k of Object.keys(laneRefs.current)) {
        const y = Number(k);
        const el = laneRefs.current[y];
        if (el) next[y] = el.clientWidth || el.offsetWidth || 0;
      }
      setLaneWidthByYear((prev) => {
        const same =
          Object.keys(prev).length === Object.keys(next).length &&
          Object.keys(prev).every((key) => prev[key as any] === next[key as any]);
        return same ? prev : next;
      });
    }
    updateLaneWidths();
    window.addEventListener("resize", updateLaneWidths);
    return () => window.removeEventListener("resize", updateLaneWidths);
  }, []);

  const onLaneElement = useCallback((laneYear: number, el: HTMLDivElement | null) => {
    laneRefs.current[laneYear] = el;
    if (el) {
      const w = el.clientWidth || el.offsetWidth || 0;
      setLaneWidthByYear((prev) => (w && prev[laneYear] !== w ? { ...prev, [laneYear]: w } : prev));
    }
  }, []);

  const getChipWidth = useCallback((key: string) => chipWidthsRef.current[key] || 0, []);

  const setChipWidth = useCallback((key: string, width: number) => {
    if (width && chipWidthsRef.current[key] !== width) {
      chipWidthsRef.current[key] = width;
      forceRerender((n) => n + 1);
    }
  }, []);

  return {
    laneWidthByYear,
    onLaneElement,
    getChipWidth,
    setChipWidth,
    setHover,
    courseHoverSpot,
    updateCourseHoverSpot,
    clearCourseHoverSpotForCell,
  };
}

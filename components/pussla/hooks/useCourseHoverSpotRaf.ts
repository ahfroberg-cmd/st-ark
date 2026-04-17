"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type HoverSpot = {
  row: number;
  col: number;
  xPx: number;
} | null;

export function useCourseHoverSpotRaf() {
  const [courseHoverSpot, setCourseHoverSpot] = useState<HoverSpot>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<HoverSpot>(null);

  const updateCourseHoverSpot = useCallback((next: HoverSpot) => {
    pendingRef.current = next;
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      setCourseHoverSpot((prev) => {
        if (!pending && !prev) return prev;
        if (!pending) return null;
        if (
          prev &&
          prev.row === pending.row &&
          prev.col === pending.col &&
          Math.abs(prev.xPx - pending.xPx) < 0.5
        ) {
          return prev;
        }
        return pending;
      });
    });
  }, []);

  const clearCourseHoverSpotForCell = useCallback((row: number, col: number) => {
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingRef.current = null;
    setCourseHoverSpot((h) => (h?.row === row && h?.col === col ? null : h));
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      pendingRef.current = null;
    };
  }, []);

  return {
    courseHoverSpot,
    updateCourseHoverSpot,
    clearCourseHoverSpotForCell,
  };
}

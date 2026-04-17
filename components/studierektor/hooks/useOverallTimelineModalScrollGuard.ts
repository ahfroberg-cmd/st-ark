"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

export function useOverallTimelineModalScrollGuard({
  overallTimelineOpen,
  overallTimelineModalRef,
  overallTimelineMonthGridRef,
}: {
  overallTimelineOpen: boolean;
  overallTimelineModalRef: RefObject<HTMLDivElement | null>;
  overallTimelineMonthGridRef: RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    if (!overallTimelineOpen) return;
    const modalEl = overallTimelineModalRef.current;
    if (!modalEl) return;

    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const prevHtmlOverscrollX = htmlEl.style.overscrollBehaviorX;
    const prevBodyOverscrollX = bodyEl.style.overscrollBehaviorX;
    htmlEl.style.overscrollBehaviorX = "none";
    bodyEl.style.overscrollBehaviorX = "none";

    const isInsideModal = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof Node)) return false;
      return modalEl.contains(target);
    };

    const gridScrollMetrics = () => {
      const gridEl = overallTimelineMonthGridRef.current;
      if (!gridEl) return { gridEl: null as HTMLDivElement | null, maxScroll: 0 };
      const maxScroll = Math.max(0, gridEl.scrollWidth - gridEl.clientWidth);
      return { gridEl, maxScroll };
    };

    const onWheel = (e: WheelEvent) => {
      const dx = e.deltaX;
      const dy = e.deltaY;
      const wantsHorizontal = Math.abs(dx) > Math.abs(dy) || e.shiftKey;
      if (!wantsHorizontal) return;

      if (!isInsideModal(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const { gridEl, maxScroll } = gridScrollMetrics();
      const onMonthGrid = !!gridEl && e.target instanceof Node && gridEl.contains(e.target);

      // Let native overflow-x scroll handle horizontal gesture.
      if (onMonthGrid && maxScroll > 0 && !e.shiftKey) {
        return;
      }

      // Shift+vertical scroll should pan horizontal timeline.
      if (onMonthGrid && maxScroll > 0 && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const next = Math.max(0, Math.min(maxScroll, gridEl!.scrollLeft + dy));
        gridEl!.scrollLeft = next;
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (!gridEl || maxScroll <= 0) return;
      const delta = e.shiftKey ? dy : dx;
      const next = Math.max(0, Math.min(maxScroll, gridEl.scrollLeft + delta));
      gridEl.scrollLeft = next;
    };

    let lastTouchX: number | null = null;
    let lastTouchY: number | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (!isInsideModal(e.target)) return;
      const t = e.touches[0];
      if (!t) return;
      lastTouchX = t.clientX;
      lastTouchY = t.clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || lastTouchX == null || lastTouchY == null) return;
      const dx = t.clientX - lastTouchX;
      const dy = t.clientY - lastTouchY;
      const wantsHorizontal = Math.abs(dx) > Math.abs(dy);
      if (!wantsHorizontal) return;

      if (!isInsideModal(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
        return;
      }

      const { gridEl, maxScroll } = gridScrollMetrics();
      const onMonthGrid = !!gridEl && e.target instanceof Node && gridEl.contains(e.target);

      if (onMonthGrid && maxScroll > 0) {
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      if (!gridEl || maxScroll <= 0) return;
      const next = Math.max(0, Math.min(maxScroll, gridEl.scrollLeft - dx));
      gridEl.scrollLeft = next;
      lastTouchX = t.clientX;
      lastTouchY = t.clientY;
    };

    const onTouchEnd = () => {
      lastTouchX = null;
      lastTouchY = null;
    };

    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });
    return () => {
      htmlEl.style.overscrollBehaviorX = prevHtmlOverscrollX;
      bodyEl.style.overscrollBehaviorX = prevBodyOverscrollX;
      window.removeEventListener("wheel", onWheel as any, true);
      window.removeEventListener("touchstart", onTouchStart as any, true);
      window.removeEventListener("touchmove", onTouchMove as any, true);
      window.removeEventListener("touchend", onTouchEnd as any, true);
      window.removeEventListener("touchcancel", onTouchEnd as any, true);
    };
  }, [overallTimelineOpen, overallTimelineModalRef, overallTimelineMonthGridRef]);
}

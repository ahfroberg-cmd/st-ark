import type { CSSProperties } from "react";

export type HoveredTimeActivity = {
  anchorX: number;
  anchorTop: number;
  hue: number;
};

export function getProgressTooltipStyle(
  hovered: HoveredTimeActivity,
  viewportWidth?: number
): CSSProperties {
  const tooltipW = 260;
  const tooltipH = 78;
  const vw = Number.isFinite(viewportWidth) ? Number(viewportWidth) : 1024;
  const x = Math.max(8, Math.min(hovered.anchorX - tooltipW / 2, vw - tooltipW - 8));
  const y = hovered.anchorTop - tooltipH - 10;

  return {
    left: x,
    top: y,
    width: tooltipW,
    backgroundColor: `hsl(${hovered.hue} 30% 95%)`,
    borderColor: `hsl(${hovered.hue} 40% 70%)`,
    zIndex: 10001,
  };
}

export function formatProgressSharePercent(days: number, total: number): string {
  if (!(total > 0)) return "0";
  return ((days / total) * 100).toFixed(1).replace(".", ",");
}

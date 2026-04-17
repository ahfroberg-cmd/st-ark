"use client";

export function getPlacementCellClass(params: {
  isFirstCol: boolean;
  isLastCol: boolean;
  isFirstHalfOfMonth: boolean;
  outside: boolean;
  insideCls: string;
  outsideBgCell: string;
}): string {
  const { isFirstCol, isLastCol, isFirstHalfOfMonth, outside, insideCls, outsideBgCell } = params;
  return [
    "relative z-0 h-7 cursor-crosshair border-t border-slate-300",
    isFirstCol ? "border-l border-slate-300" : "",
    isLastCol ? "border-r border-slate-300" : "",
    !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
    outside ? outsideBgCell : insideCls,
    outside ? "" : "hover:bg-slate-100",
  ].join(" ");
}

export function getCourseLaneCellClass(params: {
  isFirstCol: boolean;
  isLastCol: boolean;
  isFirstHalfOfMonth: boolean;
  outside: boolean;
  monthIndex: number;
  outsideBgLane: string;
  insideBgLane: string;
}): string {
  const { isFirstCol, isLastCol, isFirstHalfOfMonth, outside, monthIndex, outsideBgLane, insideBgLane } = params;
  return [
    "h-3 w-full transition cursor-pointer relative overflow-hidden",
    outside ? outsideBgLane : monthIndex % 2 ? "bg-slate-200" : insideBgLane,
    "border-y border-slate-300",
    isFirstCol ? "border-l border-slate-300" : "",
    isLastCol ? "border-r border-slate-300" : "",
    !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
  ].join(" ");
}

"use client";

import React from "react";
import { halfMidDateISO } from "@/lib/pussla/timelineDateMath";
import { getCourseLaneCellClass, getPlacementCellClass } from "@/lib/pussla/timelineCellStyles";
import {
  computeCourseDateIso,
  handleCourseCellClick,
  handlePlacementCellClick,
  type TimelineCourseKind,
} from "@/lib/pussla/timelineRowActions";

type HoverCell = { row: number; col: number } | null;

type TimelineRowGridProps = {
  cols: number;
  rowIndex: number;
  rowStartSlot: number;
  visibleStartSlot: number;
  endBoundarySlot: number;
  startYear: number;
  year: number;
  totalDays: number;
  monthNames: string[];
  insideBgCell: string;
  outsideBgCell: string;
  insideBgLane: string;
  outsideBgLane: string;
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  dirty: boolean;
  closeDetailPanel: () => void;
  clearSelection: () => void;
  addActivityAt: (slot: number) => void;
  createCourseAt: (iso: string, kind: TimelineCourseKind) => void;
  setHover: React.Dispatch<React.SetStateAction<HoverCell>>;
  updateCourseHoverSpot: (args: { row: number; col: number; xPx: number }) => void;
  clearCourseHoverSpotForCell: (row: number, col: number) => void;
  slotToYearMonthHalf: (
    startYear: number,
    slot: number
  ) => { year: number; month0: number; half: 0 | 1 };
  dateToISO: (date: Date) => string;
};

export default function TimelineRowGrid(props: TimelineRowGridProps) {
  const {
    cols,
    rowIndex,
    rowStartSlot,
    visibleStartSlot,
    endBoundarySlot,
    startYear,
    year,
    totalDays,
    monthNames,
    insideBgCell,
    outsideBgCell,
    insideBgLane,
    outsideBgLane,
    selectedPlacementId,
    selectedCourseId,
    dirty,
    closeDetailPanel,
    clearSelection,
    addActivityAt,
    createCourseAt,
    setHover,
    updateCourseHoverSpot,
    clearCourseHoverSpotForCell,
    slotToYearMonthHalf,
    dateToISO,
  } = props;

  return (
    <div className="grid grid-cols-[repeat(24,minmax(0,1fr))]" style={{ gridTemplateRows: "1.75rem 0.75rem" }}>
      {Array.from({ length: cols }, (_, i) => {
        const globalSlot = rowStartSlot + i;
        const outside = globalSlot < visibleStartSlot || globalSlot >= endBoundarySlot;
        const monthIndex = Math.floor(i / 2);
        const insideCls = monthIndex % 2 ? "bg-slate-50" : insideBgCell;
        const isFirstCol = i === 0;
        const isLastCol = i === cols - 1;
        const isFirstHalfOfMonth = i % 2 === 0;

        return (
          <div
            key={`cell1-${i}`}
            className={getPlacementCellClass({
              isFirstCol,
              isLastCol,
              isFirstHalfOfMonth,
              outside,
              insideCls,
              outsideBgCell,
            })}
            title={`${monthNames[monthIndex]} ${year} · ${i % 2 ? "H2" : "H1"}`}
            data-info="Detta är spåret för placeringar (kliniska tjänstgöringar, auskultationer, arbeten, ledighet). Klicka här för att lägga till en ny aktivitet vid detta datum. Detta är det bredare spåret i tidslinjen."
            onMouseEnter={() => setHover({ row: rowIndex, col: i })}
            onMouseLeave={() => setHover((h) => (h?.row === rowIndex && h?.col === i ? null : h))}
            onClick={() => {
              handlePlacementCellClick({
                selectedPlacementId,
                selectedCourseId,
                dirty,
                closeDetailPanel,
                clearSelection,
                globalSlot,
                addActivityAt,
              });
            }}
            style={{ gridRowStart: 1 }}
          />
        );
      })}

      {Array.from({ length: cols }, (_, i) => {
        const globalSlot = rowStartSlot + i;
        const outside = globalSlot < visibleStartSlot || globalSlot >= endBoundarySlot;
        const { year: y2, month0: m2, half: h2 } = slotToYearMonthHalf(startYear, globalSlot);
        const defaultISO = halfMidDateISO(y2, m2, h2);
        const monthIndex = Math.floor(i / 2);
        const isFirstCol = i === 0;
        const isLastCol = i === cols - 1;
        const isFirstHalfOfMonth = i % 2 === 0;

        return (
          <div
            key={`lane-${i}`}
            className={getCourseLaneCellClass({
              isFirstCol,
              isLastCol,
              isFirstHalfOfMonth,
              outside,
              monthIndex,
              outsideBgLane,
              insideBgLane,
            })}
            style={{ gridRowStart: 2 }}
            title={`Klicka för datum ${defaultISO}`}
            data-info="Detta är spåret för kurser. Klicka här för att lägga till en ny kurs vid detta datum. Detta är det smalare spåret under placeringar-spåret i tidslinjen."
            onMouseMove={(e) => {
              if (outside) return;
              const rowEl = (e.currentTarget as HTMLDivElement).closest(".st-row") as HTMLDivElement | null;
              const rect = (rowEl || (e.currentTarget as HTMLDivElement)).getBoundingClientRect();
              const x = e.clientX - rect.left;
              updateCourseHoverSpot({ row: rowIndex, col: i, xPx: x });
            }}
            onMouseLeave={() => {
              clearCourseHoverSpotForCell(rowIndex, i);
            }}
            onClick={(e) => {
              e.stopPropagation();
              const rowEl = (e.currentTarget as HTMLDivElement).closest(".st-row") as HTMLDivElement | null;
              const rect = (rowEl || (e.currentTarget as HTMLDivElement)).getBoundingClientRect();
              const clickedISO = computeCourseDateIso({
                xPx: e.clientX - rect.left,
                widthPx: rect.width,
                totalDays,
                year,
                dateToISO,
              });

              handleCourseCellClick({
                selectedPlacementId,
                selectedCourseId,
                dirty,
                closeDetailPanel,
                clearSelection,
                clickedISO,
                metaOrCtrlPressed: e.metaKey || e.ctrlKey,
                createCourseAt,
              });
            }}
          />
        );
      })}
    </div>
  );
}

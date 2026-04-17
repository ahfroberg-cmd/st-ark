"use client";

import React from "react";
import TimelineBoundaryMarkers from "@/components/pussla/TimelineBoundaryMarkers";
import TimelineRowGrid from "@/components/pussla/TimelineRowGrid";
import type { TimelineCourseKind } from "@/lib/pussla/timelineRowActions";

type HoverCell = { row: number; col: number } | null;
type CourseHoverSpot = { row: number; col: number; xPx: number } | null;

type TimelineYearRowShellProps = {
  year: number;
  bottomYear: number;
  rowIndex: number;
  rowStartSlot: number;
  visibleStartSlot: number;
  endBoundarySlot: number;
  snappedStartBoundarySlot: number;
  startYear: number;
  cols: number;
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
  profile: any;
  startLineColor: string;
  midLineColor: string;
  endLineColor: string;
  todayLineColor: string;
  dateToSlot: (startYear: number, iso: string, mode: "start" | "end") => number;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  addMonths: (date: Date, months: number) => Date;
  courseHoverSpot: CourseHoverSpot;
  setHoverNull: () => void;
  children: React.ReactNode;
};

export default function TimelineYearRowShell(props: TimelineYearRowShellProps) {
  const {
    year,
    bottomYear,
    rowIndex,
    rowStartSlot,
    visibleStartSlot,
    endBoundarySlot,
    snappedStartBoundarySlot,
    startYear,
    cols,
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
    profile,
    startLineColor,
    midLineColor,
    endLineColor,
    todayLineColor,
    dateToSlot,
    isValidISO,
    isoToDateSafe,
    addMonths,
    courseHoverSpot,
    setHoverNull,
    children,
  } = props;

  return (
    <div className="grid grid-cols-[80px_1fr] items-stretch">
      <div className="pr-2 py-1 text-right font-semibold select-none flex items-center justify-end gap-1">
        <span>{year}</span>
      </div>

      <div
        className="st-row relative isolate bg-white"
        style={{
          height: "2.6rem",
          backgroundImage: "none",
          borderTopLeftRadius: "2px",
          borderTopRightRadius: "2px",
          borderBottomLeftRadius: year === bottomYear ? "2px" : "0px",
          borderBottomRightRadius: year === bottomYear ? "2px" : "0px",
          overflow: "visible",
        }}
        onMouseLeave={setHoverNull}
      >
        <TimelineRowGrid
          cols={cols}
          rowIndex={rowIndex}
          rowStartSlot={rowStartSlot}
          visibleStartSlot={visibleStartSlot}
          endBoundarySlot={endBoundarySlot}
          startYear={startYear}
          year={year}
          totalDays={totalDays}
          monthNames={monthNames}
          insideBgCell={insideBgCell}
          outsideBgCell={outsideBgCell}
          insideBgLane={insideBgLane}
          outsideBgLane={outsideBgLane}
          selectedPlacementId={selectedPlacementId}
          selectedCourseId={selectedCourseId}
          dirty={dirty}
          closeDetailPanel={closeDetailPanel}
          clearSelection={clearSelection}
          addActivityAt={addActivityAt}
          createCourseAt={createCourseAt}
          setHover={setHover}
          updateCourseHoverSpot={updateCourseHoverSpot}
          clearCourseHoverSpotForCell={clearCourseHoverSpotForCell}
          slotToYearMonthHalf={slotToYearMonthHalf}
          dateToISO={dateToISO}
        />

        {courseHoverSpot?.row === rowIndex && typeof courseHoverSpot?.xPx === "number" && (
          <div
            className="pointer-events-none absolute left-0 right-0 z-[5]"
            style={{
              top: "1.75rem",
              height: "0.75rem",
              backgroundImage: `radial-gradient(circle at ${Math.max(0, courseHoverSpot.xPx)}px 50%, rgba(15, 23, 42, 0.22), rgba(15, 23, 42, 0.08) 10px, rgba(15, 23, 42, 0.00) 22px)`,
            }}
            aria-hidden="true"
          />
        )}

        {null}

        <TimelineBoundaryMarkers
          profile={profile}
          rowStartSlot={rowStartSlot}
          startYear={startYear}
          cols={cols}
          snappedStartBoundarySlot={snappedStartBoundarySlot}
          endBoundarySlot={endBoundarySlot}
          year={year}
          startLineColor={startLineColor}
          midLineColor={midLineColor}
          endLineColor={endLineColor}
          todayLineColor={todayLineColor}
          dateToSlot={dateToSlot}
          isValidISO={isValidISO}
          isoToDateSafe={isoToDateSafe}
          dateToISO={dateToISO}
          addMonths={addMonths}
        />

        {children}
      </div>
    </div>
  );
}

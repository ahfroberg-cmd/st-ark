"use client";

import React from "react";
import { buildTimelineYearRowModel } from "@/lib/pussla/timelineRowModel";
import TimelineYearRowShell from "@/components/pussla/TimelineYearRowShell";
import TimelineOverlayGrid from "@/components/pussla/TimelineOverlayGrid";
import TimelineActivitiesLayer from "@/components/pussla/TimelineActivitiesLayer";
import TimelineCoursesLane from "@/components/pussla/TimelineCoursesLane";
import TimelineSessionMarkers from "@/components/pussla/TimelineSessionMarkers";
import TimelineCoursesLayer from "@/components/pussla/TimelineCoursesLayer";
import type { TimelineCourseKind } from "@/lib/pussla/timelineRowActions";

type TimelineYearRowProps = {
  rowIndex: number;
  startYear: number;
  totalYearsNeeded: number;
  totalSlots: number;
  baseSlots: number;
  stStartISO?: string | null;
  stEndISO?: string | null;
  profile: any;
  courses: any[];
  dragCourse: { id: string; year: number } | null;
  isValidISO: (iso: string) => boolean;
  dateToSlot: (startYear: number, iso: string, mode: "start" | "end") => number;
  isoToDateSafe: (iso: string) => Date;
  cols: number;
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
  setHover: React.Dispatch<React.SetStateAction<{ row: number; col: number } | null>>;
  updateCourseHoverSpot: (args: { row: number; col: number; xPx: number }) => void;
  clearCourseHoverSpotForCell: (row: number, col: number) => void;
  slotToYearMonthHalf: (
    startYear: number,
    slot: number
  ) => { year: number; month0: number; half: 0 | 1 };
  dateToISO: (d: Date) => string;
  startLineColor: string;
  midLineColor: string;
  endLineColor: string;
  todayLineColor: string;
  addMonths: (date: Date, months: number) => Date;
  courseHoverSpot: { row: number; col: number; xPx: number } | null;
  activitiesForYear: any[];
  switchActivity: (placementId: string | null, courseId: string | null) => boolean;
  setActiveLane: (lane: "placement" | "course") => void;
  dragPlacementRef: React.MutableRefObject<any>;
  laneWidthByYear: Record<number, number>;
  onLaneElement: (year: number, el: HTMLDivElement | null) => void;
  showSpecialistCollegiumsOnTimeline: boolean;
  showDirectorMeetingsOnTimeline: boolean;
  showSupervisionOnTimeline: boolean;
  showAssessmentsOnTimeline: boolean;
  specialistCollegiumSessions: Array<{ id: string; dateISO: string; title?: string }>;
  directorMeetingSessions: Array<{ id: string; dateISO: string; title?: string }>;
  supervisionSessions: Array<{ id: string; dateISO: string; title?: string }>;
  assessmentSessions: Array<{ id: string; dateISO: string; title?: string }>;
  hoveredSpecialistCollegiumId: string | null;
  hoveredDirectorMeetingId: string | null;
  hoveredSupervisionId: string | null;
  hoveredAssessmentId: string | null;
  setHoveredSpecialistCollegiumId: React.Dispatch<React.SetStateAction<string | null>>;
  setHoveredDirectorMeetingId: React.Dispatch<React.SetStateAction<string | null>>;
  setHoveredSupervisionId: React.Dispatch<React.SetStateAction<string | null>>;
  setHoveredAssessmentId: React.Dispatch<React.SetStateAction<string | null>>;
  setIupInitialTab: (tab: "handledning" | "progression") => void;
  setIupInitialSpecialistCollegiumId: (id: string | null) => void;
  setIupInitialDirectorMeetingId: (id: string | null) => void;
  setIupInitialMeetingId: (id: string | null) => void;
  setIupInitialAssessmentId: (id: string | null) => void;
  setIupOpen: (open: boolean) => void;
  dayOfYear: (d: Date) => number;
  daysInYear: (year: number) => number;
  clamp: (v: number, min: number, max: number) => number;
  hoveredCourseId: string | null;
  dragCourseRef: React.MutableRefObject<any>;
  getChipWidth: (key: string) => number;
  setChipWidth: (key: string, width: number) => void;
  getCourseDisplayTitle: (course: any) => string;
  setHoveredCourseId: React.Dispatch<React.SetStateAction<string | null>>;
  setCertMenu: (menu: any) => void;
  openPreviewForBtGoals: (activity: any) => void;
  setCourseForModal: (course: any) => void;
  setCourseModalOpen: (open: boolean) => void;
};

export default function TimelineYearRow(props: TimelineYearRowProps) {
  const {
    rowIndex,
    startYear,
    totalYearsNeeded,
    totalSlots,
    baseSlots,
    stStartISO,
    stEndISO,
    profile,
    courses,
    dragCourse,
    isValidISO,
    dateToSlot,
    isoToDateSafe,
    cols,
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
    startLineColor,
    midLineColor,
    endLineColor,
    todayLineColor,
    addMonths,
    courseHoverSpot,
    activitiesForYear,
    switchActivity,
    setActiveLane,
    dragPlacementRef,
    laneWidthByYear,
    onLaneElement,
    showSpecialistCollegiumsOnTimeline,
    showDirectorMeetingsOnTimeline,
    showSupervisionOnTimeline,
    showAssessmentsOnTimeline,
    specialistCollegiumSessions,
    directorMeetingSessions,
    supervisionSessions,
    assessmentSessions,
    hoveredSpecialistCollegiumId,
    hoveredDirectorMeetingId,
    hoveredSupervisionId,
    hoveredAssessmentId,
    setHoveredSpecialistCollegiumId,
    setHoveredDirectorMeetingId,
    setHoveredSupervisionId,
    setHoveredAssessmentId,
    setIupInitialTab,
    setIupInitialSpecialistCollegiumId,
    setIupInitialDirectorMeetingId,
    setIupInitialMeetingId,
    setIupInitialAssessmentId,
    setIupOpen,
    dayOfYear,
    daysInYear,
    clamp,
    hoveredCourseId,
    dragCourseRef,
    getChipWidth,
    setChipWidth,
    getCourseDisplayTitle,
    setHoveredCourseId,
    setCertMenu,
    openPreviewForBtGoals,
    setCourseForModal,
    setCourseModalOpen,
  } = props;

  const {
    year,
    rowStartSlot,
    rowEndSlot,
    totalDays,
    bottomYear,
    snappedStartBoundarySlot,
    endBoundarySlot,
    visibleStartSlot,
    coursesThisYear,
  } = buildTimelineYearRowModel({
    rowIndex,
    startYear,
    totalYearsNeeded,
    totalSlots,
    baseSlots,
    stStartISO,
    stEndISO,
    goalsVersion: (profile as any)?.goalsVersion || undefined,
    btStartISO: (profile as any)?.btStartDate,
    courses,
    dragCourse,
    isValidISO,
    dateToSlot,
    isoToDateSafe,
  });

  const handleTimelineActivityDoubleClick = (activity: any, e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = switchActivity(activity.id, null);
    if (!ok) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCertMenu({
      open: true,
      x: Math.round(e.clientX),
      y: Math.round(rect.top + rect.height / 2),
      kind: "placement",
      placement: activity,
      course: null,
    });
  };

  return (
    <TimelineYearRowShell
      year={year}
      bottomYear={bottomYear}
      rowIndex={rowIndex}
      rowStartSlot={rowStartSlot}
      visibleStartSlot={visibleStartSlot}
      endBoundarySlot={endBoundarySlot}
      snappedStartBoundarySlot={snappedStartBoundarySlot}
      startYear={startYear}
      cols={cols}
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
      profile={profile}
      startLineColor={startLineColor}
      midLineColor={midLineColor}
      endLineColor={endLineColor}
      todayLineColor={todayLineColor}
      dateToSlot={dateToSlot}
      isValidISO={isValidISO}
      isoToDateSafe={isoToDateSafe}
      addMonths={addMonths}
      courseHoverSpot={courseHoverSpot}
      setHoverNull={() => setHover(null)}
    >
      <TimelineOverlayGrid>
        <TimelineActivitiesLayer
          activitiesForYear={activitiesForYear}
          rowStartSlot={rowStartSlot}
          rowEndSlot={rowEndSlot}
          rowIndex={rowIndex}
          cols={cols}
          selectedPlacementId={selectedPlacementId}
          selectedCourseId={selectedCourseId}
          dirty={dirty}
          switchActivity={switchActivity}
          setActiveLane={setActiveLane}
          dragPlacementRef={dragPlacementRef}
          onActivityDoubleClick={handleTimelineActivityDoubleClick}
        />

        <TimelineCoursesLane year={year} laneWidth={laneWidthByYear[year]} onLaneElement={onLaneElement}>
          <TimelineSessionMarkers
            year={year}
            showSpecialistCollegiumsOnTimeline={showSpecialistCollegiumsOnTimeline}
            showDirectorMeetingsOnTimeline={showDirectorMeetingsOnTimeline}
            showSupervisionOnTimeline={showSupervisionOnTimeline}
            showAssessmentsOnTimeline={showAssessmentsOnTimeline}
            specialistCollegiumSessions={specialistCollegiumSessions}
            directorMeetingSessions={directorMeetingSessions}
            supervisionSessions={supervisionSessions}
            assessmentSessions={assessmentSessions}
            hoveredSpecialistCollegiumId={hoveredSpecialistCollegiumId}
            hoveredDirectorMeetingId={hoveredDirectorMeetingId}
            hoveredSupervisionId={hoveredSupervisionId}
            hoveredAssessmentId={hoveredAssessmentId}
            setHoveredSpecialistCollegiumId={setHoveredSpecialistCollegiumId}
            setHoveredDirectorMeetingId={setHoveredDirectorMeetingId}
            setHoveredSupervisionId={setHoveredSupervisionId}
            setHoveredAssessmentId={setHoveredAssessmentId}
            setIupInitialTab={setIupInitialTab}
            setIupInitialSpecialistCollegiumId={setIupInitialSpecialistCollegiumId}
            setIupInitialDirectorMeetingId={setIupInitialDirectorMeetingId}
            setIupInitialMeetingId={setIupInitialMeetingId}
            setIupInitialAssessmentId={setIupInitialAssessmentId}
            setIupOpen={setIupOpen}
            isValidISO={isValidISO}
            isoToDateSafe={isoToDateSafe}
            dayOfYear={dayOfYear}
            daysInYear={daysInYear}
            clamp={clamp}
          />
          <TimelineCoursesLayer
            coursesThisYear={coursesThisYear}
            year={year}
            selectedCourseId={selectedCourseId}
            selectedPlacementId={selectedPlacementId}
            dirty={dirty}
            hoveredCourseId={hoveredCourseId}
            laneWidthByYear={laneWidthByYear}
            dragCourseRef={dragCourseRef}
            getChipWidth={getChipWidth}
            setChipWidth={setChipWidth}
            daysInYear={daysInYear}
            dayOfYear={dayOfYear}
            isValidISO={isValidISO}
            isoToDateSafe={isoToDateSafe}
            clamp={clamp}
            getCourseDisplayTitle={getCourseDisplayTitle}
            switchActivity={switchActivity}
            setHoveredCourseId={setHoveredCourseId}
            setCertMenu={setCertMenu}
            setActiveLane={setActiveLane}
            openPreviewForBtGoals={openPreviewForBtGoals}
            profile={profile}
            setCourseForModal={setCourseForModal}
            setCourseModalOpen={setCourseModalOpen}
          />
        </TimelineCoursesLane>
      </TimelineOverlayGrid>
    </TimelineYearRowShell>
  );
}

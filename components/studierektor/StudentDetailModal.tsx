// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { useEffect, useMemo, useState } from "react";
import { loadGoals, type GoalsCatalog } from "@/lib/goals";
import type { SupervisorStudent } from "@/lib/mappers/studentData";
import { dateToSlotSnapped } from "@/lib/studierektor/dateUtils";
import { addMonthsISO, plannedTotalMonths } from "@/lib/studierektor/studierektorPageStudentUtils";
import ActivityDetailPopup from "@/components/studierektor/ActivityDetailPopup";
import StudentDetailSecondaryTabs from "@/components/studierektor/StudentDetailSecondaryTabs";
import StudentDetailTabsNav from "@/components/studierektor/StudentDetailTabsNav";
import StudentUtbildningsmomentTab from "@/components/studierektor/StudentUtbildningsmomentTab";
import StudentProgressDetailModal from "@/components/studierektor/StudentProgressDetailModal";
import StudentDetailHeader from "@/components/studierektor/StudentDetailHeader";
import StudentDetailTimelineOnly from "@/components/studierektor/StudentDetailTimelineOnly";
import StudentTimelineView from "@/components/studierektor/StudentTimelineView";
import { useStudentDetailProgressMetrics } from "@/components/studierektor/hooks/useStudentDetailProgressMetrics";
import { useStudentDetailSessions } from "@/components/studierektor/hooks/useStudentDetailSessions";
import { useStudentDetailTimelineSetup } from "@/components/studierektor/hooks/useStudentDetailTimelineSetup";
import type {
  StudentDetailMainTab,
  StudentDetailUmTab,
} from "@/components/studierektor/studentDetailTypes";

export function StudentDetailModal({
  student,
  onClose,
  clinicMembers: _clinicMembers,
  clinicName: _clinicName,
  embedded = false,
  timelineOnly = false,
  defaultMainTab = "utbildningsmoment",
  defaultUmTab = "lista",
  formerStLakare = false,
  showFlyttaTillTidigare = false,
  onFlyttaTillTidigare,
  onReactivateFormer,
  formerActionBusy = false,
}: {
  student: SupervisorStudent;
  onClose: () => void;
  clinicMembers: { user_id: string; role: string; name: string }[];
  clinicName: string;
  embedded?: boolean;
  /** Endast tidslinjen (t.ex. spegel från Uppföljning), utan flikar och övriga ST-detaljer. */
  timelineOnly?: boolean;
  defaultMainTab?: StudentDetailMainTab;
  defaultUmTab?: StudentDetailUmTab;
  formerStLakare?: boolean;
  showFlyttaTillTidigare?: boolean;
  onFlyttaTillTidigare?: () => void | Promise<void>;
  onReactivateFormer?: () => void | Promise<void>;
  formerActionBusy?: boolean;
}) {
  const [mainTab, setMainTab] = useState<StudentDetailMainTab>(defaultMainTab);
  const [umTab, setUmTab] = useState<StudentDetailUmTab>(defaultUmTab);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [goalsCatalog, setGoalsCatalog] = useState<GoalsCatalog | null>(null);
  const [progressDetailOpen, setProgressDetailOpen] = useState<"time" | "milestones" | null>(null);
  const [hoveredTimeAct, setHoveredTimeAct] = useState<{
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    days: number;
    attendance: number;
    hue: number;
    phase: "bt" | "st";
    anchorX: number;
    anchorTop: number;
  } | null>(null);
  const [planeringSubTab, setPlaneringSubTab] = useState<"overgripande" | "enskild">("overgripande");
  const [selectedPlanPlacReadIdx, setSelectedPlanPlacReadIdx] = useState<number | null>(null);

  const placements = useMemo(() => student.placements || [], [student.placements]);
  const courses = useMemo(() => student.courses || [], [student.courses]);
  const achievements = useMemo(() => student.achievements || [], [student.achievements]);
  const profile = student.profile || {};
  const goalsVersion = student.goalsVersion;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await loadGoals(student.goalsVersion, student.specialty);
        if (!cancelled) setGoalsCatalog(g);
      } catch {
        if (!cancelled) setGoalsCatalog(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student.goalsVersion, student.specialty]);

  useEffect(() => {
    setPlaneringSubTab("overgripande");
    setSelectedPlanPlacReadIdx(null);
    setMainTab(defaultMainTab);
    setUmTab(defaultUmTab);
  }, [student.id, defaultMainTab, defaultUmTab]);

  useEffect(() => {
    if (formerStLakare && mainTab === "kommunikation") {
      setMainTab("utbildningsmoment");
    }
  }, [formerStLakare, mainTab]);

  const placementHueById = useMemo(() => {
    const m = new Map<string, number>();
    (placements || []).forEach((p: any, i: number) => {
      const id = String(p?.id ?? "");
      if (!id) return;
      const hue = (p as any)?.hue ?? (210 + i * 30) % 360;
      m.set(id, hue);
    });
    return m;
  }, [placements]);

  const {
    iupPlanning,
    iupPlanningExtra,
    iupMeetings,
    iupAssessments,
    supervisorMeetings,
    progressAssessments,
    supervisionSessions,
    assessmentSessions,
  } = useStudentDetailSessions({
    student,
    profile,
  });

  const {
    years,
    profileBtStartISO,
    profileStStartISO,
    startYearForSlots,
    visibleStartSlot,
    profileEndISO,
    todayISO,
    btEndISO,
    isPlacementBTPhase,
    pickPercent,
    endBoundarySlot,
    btStartSlot,
    btEndSlot,
    stStartSlot,
    stEndSlot,
    timelineYears,
  } = useStudentDetailTimelineSetup({
    placements,
    courses,
    profile,
    goalsVersion,
    plannedTotalMonths,
    addMonthsISO,
    dateToSlotSnapped,
  });

  const { progressPct, timeDetails, timeByActivity, milestoneDetails, milestoneProgressPct } =
    useStudentDetailProgressMetrics({
      placements,
      courses,
      achievements,
      goalsCatalog,
      goalsVersion,
      profileBtStartISO,
      profileStStartISO,
      profileEndISO,
      btEndISO,
      todayISO,
      pickPercent,
      isPlacementBTPhase,
      placementHueById,
    });

  const studierektorTimelineView = (
    <StudentTimelineView
      years={years}
      timelineYears={timelineYears}
      placements={placements}
      courses={courses}
      goalsVersion={goalsVersion}
      startYearForSlots={startYearForSlots}
      visibleStartSlot={visibleStartSlot}
      endBoundarySlot={endBoundarySlot}
      btStartSlot={btStartSlot}
      btEndSlot={btEndSlot}
      stStartSlot={stStartSlot}
      stEndSlot={stEndSlot}
      supervisionSessions={supervisionSessions}
      assessmentSessions={assessmentSessions}
      selectedActivity={selectedActivity}
      setSelectedActivity={setSelectedActivity}
    />
  );

  const outerClassName = embedded
    ? "flex h-full min-h-0 items-stretch justify-stretch"
    : "fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4";

  return (
    <div className={outerClassName} onClick={embedded ? undefined : onClose}>
      <div
        className={`flex w-full flex-col overflow-hidden ${
          embedded && timelineOnly
            ? "h-full max-h-none max-w-none bg-transparent"
            : embedded
              ? "h-full max-h-none max-w-none rounded-xl bg-white shadow-xl"
              : "max-h-[90vh] max-w-5xl rounded-xl bg-white shadow-xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {timelineOnly ? (
          <StudentDetailTimelineOnly studentName={student.name} timelineView={studierektorTimelineView} />
        ) : (
          <>
            <StudentDetailHeader
              student={student}
              formerStLakare={formerStLakare}
              showFlyttaTillTidigare={showFlyttaTillTidigare}
              formerActionBusy={formerActionBusy}
              onClose={onClose}
              onFlyttaTillTidigare={onFlyttaTillTidigare}
              onReactivateFormer={onReactivateFormer}
            />
            <StudentDetailTabsNav mainTab={mainTab} setMainTab={setMainTab} formerStLakare={formerStLakare} />

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto p-6">
                {mainTab === "utbildningsmoment" ? (
                  <StudentUtbildningsmomentTab
                    umTab={umTab}
                    setUmTab={setUmTab}
                    placements={placements}
                    courses={courses}
                    selectedActivity={selectedActivity}
                    setSelectedActivity={setSelectedActivity}
                    placementHueById={placementHueById}
                    iupMeetings={iupMeetings}
                    supervisorMeetings={supervisorMeetings}
                    iupAssessments={iupAssessments}
                    progressAssessments={progressAssessments}
                    progressPct={progressPct}
                    milestoneProgressPct={milestoneProgressPct}
                    setProgressDetailOpen={setProgressDetailOpen}
                    studierektorTimelineView={studierektorTimelineView}
                  />
                ) : (
                  <StudentDetailSecondaryTabs
                    mainTab={mainTab}
                    student={student}
                    iupPlanning={iupPlanning}
                    iupPlanningExtra={iupPlanningExtra}
                    placements={placements}
                    planeringSubTab={planeringSubTab}
                    setPlaneringSubTab={setPlaneringSubTab}
                    selectedPlanPlacReadIdx={selectedPlanPlacReadIdx}
                    setSelectedPlanPlacReadIdx={setSelectedPlanPlacReadIdx}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {selectedActivity && (
          <ActivityDetailPopup
            activity={selectedActivity}
            onClose={() => setSelectedActivity(null)}
            goalsVersion={goalsVersion}
            allCourses={courses}
            allPlacements={placements}
          />
        )}

        <StudentProgressDetailModal
          progressDetailOpen={progressDetailOpen}
          onClose={() => setProgressDetailOpen(null)}
          hoveredTimeAct={hoveredTimeAct}
          setHoveredTimeAct={setHoveredTimeAct}
          goalsVersion={goalsVersion}
          timeDetails={timeDetails}
          timeByActivity={timeByActivity}
          milestoneDetails={milestoneDetails}
        />
      </div>
    </div>
  );
}

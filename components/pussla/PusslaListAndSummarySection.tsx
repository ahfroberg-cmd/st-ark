"use client";

import ActivitiesTable from "@/components/pussla/ActivitiesTable";
import GapWarnings from "@/components/pussla/GapWarnings";
import CoursesAndMomentsPanel from "@/components/pussla/CoursesAndMomentsPanel";
import PlanSummaryPanel from "@/components/pussla/PlanSummaryPanel";
import ProgressDetailModal from "@/components/pussla/ProgressDetailModal";
import OverlapWarningDialog from "@/components/pussla/OverlapWarningDialog";
import PlacementPeriodSuggestionDialog from "@/components/pussla/PlacementPeriodSuggestionDialog";
import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";

export default function PusslaListAndSummarySection(props: {
  activitiesTableOpen: boolean;
  setActivitiesTableOpen: (updater: (prev: boolean) => boolean) => void;
  startYear: number;
  activities: any[];
  dismissedGaps: string[];
  setDismissedGaps: (updater: (prev: string[]) => string[]) => void;
  selectedPlacementId: string | null;
  displayDatesForActivity: any;
  isZeroAttendanceType: any;
  switchActivity: any;
  setCertMenu: (value: any) => void;
  openPreviewForBtGoals: any;
  profile: any;
  courses: any[];
  getCourseDisplayTitle: (course: any) => string;
  setSta3Placements: (value: any[]) => void;
  setSta3Courses: (value: any[]) => void;
  setSta3ResearchTitle: (value: string) => void;
  setSta3SupervisorName: (value: string) => void;
  setSta3SupervisorSpec: (value: string) => void;
  setSta3SupervisorSite: (value: string) => void;
  setSta3Open: (value: boolean) => void;
  openPreviewForPlacement: any;
  isLeave: any;
  btstWarnActIds: Set<string>;
  selectedCourseId: string | null;
  btstWarnCourseIds: Set<string>;
  setCourseForModal: (value: any) => void;
  setCourseModalOpen: (value: boolean) => void;
  totalPlanMonths: number;
  setTotalPlanMonths: (value: number) => void;
  persistProfilePatch: (patch: Record<string, unknown>) => void | Promise<void>;
  restAttendance: number;
  setRestAttendance: (value: number) => void;
  stEndISO: string | null;
  progressPct: number;
  milestoneProgressPct: number;
  setProgressDetailOpen: (value: "time" | "milestones" | null) => void;
  isValidISO: any;
  isoToDateSafe: any;
  addMonths: (date: Date, months: number) => Date;
  dateToISO: (date: Date) => string;
  onBtEndChange: any;
  progressDetailOpen: "time" | "milestones" | null;
  timeDetails: any;
  timeByActivity: any;
  hoveredTimeAct: any;
  createProgressHoverEnterHandler: any;
  clearProgressHover: () => void;
  milestoneDetails: any;
  setIupOpen: (value: boolean) => void;
  setIupInitialTab: (value: any) => void;
  overlapWarning: string | null;
  overlapSuggestion: any;
  clearOverlapState: () => void;
  applyOverlapSuggestion: () => void;
  placementPeriodSuggestionDialog: any;
  closePlacementPeriodSuggestionDialog: () => void;
  applyPlacementPeriodSuggestion: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => props.setActivitiesTableOpen((v) => !v)}
          className="flex w-full items-center justify-between border-b px-3 py-2 text-left hover:bg-slate-50"
        >
          <div className="font-semibold">Klinisk tjänstgöring, arbeten, ledighet, sjukskrivning</div>
          <span className="text-slate-500">{props.activitiesTableOpen ? "▾" : "▸"}</span>
        </button>

        {props.activitiesTableOpen && (
          <>
            <GapWarnings
              startYear={props.startYear}
              activities={props.activities}
              dismissedGaps={props.dismissedGaps}
              onDismiss={(id) => props.setDismissedGaps((prev) => [...new Set([...prev, id])])}
            />

            <ActivitiesTable
              activities={props.activities}
              selectedPlacementId={props.selectedPlacementId}
              displayDatesForActivity={props.displayDatesForActivity}
              isZeroAttendanceType={props.isZeroAttendanceType as any}
              switchActivity={props.switchActivity as any}
              setCertMenu={props.setCertMenu}
              openPreviewForBtGoals={props.openPreviewForBtGoals}
              profile={props.profile}
              courses={props.courses}
              getCourseDisplayTitle={props.getCourseDisplayTitle}
              setSta3Placements={props.setSta3Placements}
              setSta3Courses={props.setSta3Courses}
              setSta3ResearchTitle={props.setSta3ResearchTitle}
              setSta3SupervisorName={props.setSta3SupervisorName}
              setSta3SupervisorSpec={props.setSta3SupervisorSpec}
              setSta3SupervisorSite={props.setSta3SupervisorSite}
              setSta3Open={props.setSta3Open}
              openPreviewForPlacement={props.openPreviewForPlacement}
              isLeave={props.isLeave as any}
              btstWarnActIds={props.btstWarnActIds}
            />
          </>
        )}
      </div>

      <CoursesAndMomentsPanel
        courses={props.courses}
        selectedCourseId={props.selectedCourseId}
        btstWarnCourseIds={props.btstWarnCourseIds}
        profile={props.profile}
        getCourseDisplayTitle={props.getCourseDisplayTitle}
        switchActivity={props.switchActivity as any}
        setCertMenu={props.setCertMenu}
        openPreviewForBtGoals={props.openPreviewForBtGoals}
        setCourseForModal={props.setCourseForModal}
        setCourseModalOpen={props.setCourseModalOpen}
      />

      <PlanSummaryPanel
        activities={props.activities}
        isZeroAttendanceType={props.isZeroAttendanceType as any}
        profile={props.profile}
        totalPlanMonths={props.totalPlanMonths}
        setTotalPlanMonths={props.setTotalPlanMonths}
        persistProfilePatch={props.persistProfilePatch}
        restAttendance={props.restAttendance}
        setRestAttendance={props.setRestAttendance}
        stEndISO={props.stEndISO}
        progressPct={props.progressPct}
        milestoneProgressPct={props.milestoneProgressPct}
        setProgressDetailOpen={props.setProgressDetailOpen}
        isValidISO={props.isValidISO as any}
        isoToDateSafe={props.isoToDateSafe as any}
        addMonths={props.addMonths}
        dateToISO={props.dateToISO}
        onBtEndChange={props.onBtEndChange as any}
      />

      <ProgressDetailModal
        open={props.progressDetailOpen}
        is2021={normalizeGoalsVersion((props.profile as any)?.goalsVersion) === "2021"}
        onClose={() => props.setProgressDetailOpen(null)}
        timeDetails={props.timeDetails as any}
        timeByActivity={props.timeByActivity as any}
        hoveredTimeAct={props.hoveredTimeAct as any}
        createProgressHoverEnterHandler={props.createProgressHoverEnterHandler as any}
        clearProgressHover={props.clearProgressHover}
        milestoneDetails={props.milestoneDetails as any}
        onOpenMilestonesPage={() => {
          props.setProgressDetailOpen(null);
          props.setIupOpen(true);
          props.setIupInitialTab("delmal");
        }}
      />

      <OverlapWarningDialog
        warning={props.overlapWarning}
        canApplySuggestion={!!props.overlapSuggestion}
        onClose={props.clearOverlapState}
        onApplySuggestion={props.applyOverlapSuggestion}
      />

      <PlacementPeriodSuggestionDialog
        dialog={props.placementPeriodSuggestionDialog}
        onClose={props.closePlacementPeriodSuggestionDialog}
        onApply={props.applyPlacementPeriodSuggestion}
      />
    </div>
  );
}

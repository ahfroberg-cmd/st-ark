"use client";

import PusslaTimelineWorkspace from "@/components/pussla/PusslaTimelineWorkspace";
import PusslaTimelineGridAndLegend from "@/components/pussla/PusslaTimelineGridAndLegend";
import PusslaDetailPanelSection from "@/components/pussla/PusslaDetailPanelSection";
import PusslaListAndSummarySection from "@/components/pussla/PusslaListAndSummarySection";
import PusslaWorkflowModals from "@/components/pussla/PusslaWorkflowModals";
import DocumentsCenterModalBridge from "@/components/pussla/DocumentsCenterModalBridge";
import PusslaAssistantAndSettingsModals from "@/components/pussla/PusslaAssistantAndSettingsModals";
import ColleagueWorkspaceModals from "@/components/pussla/ColleagueWorkspaceModals";
import ColleagueCopyDialogs from "@/components/pussla/ColleagueCopyDialogs";

export default function PusslaPrimarySurface(props: any) {
  return (
    <>
      <PusslaTimelineWorkspace
        setGoHomeWarnOpen={props.setGoHomeWarnOpen}
        is2021={props.is2021}
        setBtModalOpen={props.setBtModalOpen}
        setPrepareOpen={props.setPrepareOpen}
        setIupInitialTab={props.setIupInitialTab}
        setIupInitialMeetingId={props.setIupInitialMeetingId}
        setIupInitialAssessmentId={props.setIupInitialAssessmentId}
        setIupOpen={props.setIupOpen}
        setHemklinikOpen={props.setHemklinikOpen}
        openDocumentsFor={props.openDocumentsFor}
        setSettingsOpen={props.setSettingsOpen}
        searchQuery={props.searchQuery}
        setSearchQuery={props.setSearchQuery}
        setSearchOpen={props.setSearchOpen}
      />

      <PusslaTimelineGridAndLegend
        monthNames={props.monthNames}
        selectedPlacementId={props.selectedPlacementId}
        selectedCourseId={props.selectedCourseId}
        closeDetailPanel={props.closeDetailPanel}
        visibleYearCount={props.visibleYearCount}
        renderYearRow={props.renderYearRow}
        profile={props.profile}
        startLineColor={props.startLineColor}
        midLineColor={props.midLineColor}
        endLineColor={props.endLineColor}
        todayLineColor={props.todayLineColor}
        showSupervisionOnTimeline={props.showSupervisionOnTimeline}
        showDirectorMeetingsOnTimeline={props.showDirectorMeetingsOnTimeline}
        showAssessmentsOnTimeline={props.showAssessmentsOnTimeline}
        showSpecialistCollegiumsOnTimeline={props.showSpecialistCollegiumsOnTimeline}
      />

      <PusslaDetailPanelSection {...props.detailPanelProps} />
      <PusslaListAndSummarySection {...props.listAndSummaryProps} />
      <PusslaWorkflowModals {...props.workflowModalsProps} />
      <DocumentsCenterModalBridge {...props.documentsCenterProps} />
      <PusslaAssistantAndSettingsModals {...props.assistantSettingsProps} />
      <ColleagueWorkspaceModals {...props.colleagueWorkspaceProps} />
      <ColleagueCopyDialogs {...props.colleagueCopyDialogsProps} />
    </>
  );
}

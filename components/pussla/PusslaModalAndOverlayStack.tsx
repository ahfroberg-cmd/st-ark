"use client";

import IupModalBridge from "@/components/pussla/IupModalBridge";
import PusslaAuxModals from "@/components/pussla/PusslaAuxModals";
import HemklinikModalStack from "@/components/pussla/HemklinikModalStack";
import PusslaActionPopups from "@/components/pussla/PusslaActionPopups";
import PusslaChatAndNotifications from "@/components/pussla/PusslaChatAndNotifications";
import PusslaSafetyDialogs from "@/components/pussla/PusslaSafetyDialogs";

export default function PusslaModalAndOverlayStack(props: any) {
  return (
    <>
      <IupModalBridge
        iupOpen={props.iupOpen}
        setIupOpen={props.setIupOpen}
        setIupInitialTab={props.setIupInitialTab}
        iupInitialTab={props.iupInitialTab}
        iupInitialMeetingId={props.iupInitialMeetingId}
        iupInitialAssessmentId={props.iupInitialAssessmentId}
        iupInitialDirectorMeetingId={props.iupInitialDirectorMeetingId}
        iupInitialSpecialistCollegiumId={props.iupInitialSpecialistCollegiumId}
        setIupInitialMeetingId={props.setIupInitialMeetingId}
        setIupInitialAssessmentId={props.setIupInitialAssessmentId}
        setIupInitialDirectorMeetingId={props.setIupInitialDirectorMeetingId}
        setIupInitialSpecialistCollegiumId={props.setIupInitialSpecialistCollegiumId}
        setSupervisionSessions={props.setSupervisionSessions}
        setAssessmentSessions={props.setAssessmentSessions}
        setDirectorMeetingSessions={props.setDirectorMeetingSessions}
        setSpecialistCollegiumSessions={props.setSpecialistCollegiumSessions}
        showSupervisionOnTimeline={props.showSupervisionOnTimeline}
        showAssessmentsOnTimeline={props.showAssessmentsOnTimeline}
        showDirectorMeetingsOnTimeline={props.showDirectorMeetingsOnTimeline}
        showSpecialistCollegiumsOnTimeline={props.showSpecialistCollegiumsOnTimeline}
        setShowSupervisionOnTimeline={props.setShowSupervisionOnTimeline}
        setShowAssessmentsOnTimeline={props.setShowAssessmentsOnTimeline}
        setShowDirectorMeetingsOnTimeline={props.setShowDirectorMeetingsOnTimeline}
        setShowSpecialistCollegiumsOnTimeline={props.setShowSpecialistCollegiumsOnTimeline}
      />

      <PusslaAuxModals
        previewOpen={props.previewOpen}
        previewUrl={props.previewUrl}
        onClosePreview={props.onClosePreview}
        intygGroupModalOpen={props.intygGroupModalOpen}
        setIntygGroupModalOpen={props.setIntygGroupModalOpen}
        selectedPlacement={props.selectedPlacement}
        selectedCourseId={props.selectedCourseId}
        activities={props.activities}
        sortMilestoneIds={props.sortMilestoneIds}
        displayMilestoneCode={props.displayMilestoneCode}
        profileGoalsVersion={props.profileGoalsVersion}
        persistIntygGroupModal={props.persistIntygGroupModal}
        openPreviewForPlacementFromGroupModal={props.openPreviewForPlacementFromGroupModal}
        milestonePicker={props.milestonePicker}
        setMilestonePicker={props.setMilestonePicker}
        btMilestonePicker={props.btMilestonePicker}
        setBtMilestonePicker={props.setBtMilestonePicker}
        goals={props.goals}
        selectedCourse={props.selectedCourse}
        sanitizeStMilestonesForGoals={props.sanitizeStMilestonesForGoals}
        setCourses={props.setCourses}
        setActivities={props.setActivities}
        btMilestoneDetail={props.btMilestoneDetail}
        setBtMilestoneDetail={props.setBtMilestoneDetail}
        btMilestones={props.btMilestones}
        stMilestoneDetail={props.stMilestoneDetail}
        setStMilestoneDetail={props.setStMilestoneDetail}
        sta3Open={props.sta3Open}
        setSta3Open={props.setSta3Open}
        sta3Placements={props.sta3Placements}
        sta3Courses={props.sta3Courses}
        sta3Other={props.sta3Other}
        setSta3Other={props.setSta3Other}
        sta3HowVerified={props.sta3HowVerified}
        setSta3HowVerified={props.setSta3HowVerified}
        profile={props.profile}
        sta3ResearchTitle={props.sta3ResearchTitle}
        sta3SupervisorName={props.sta3SupervisorName}
        sta3SupervisorSpec={props.sta3SupervisorSpec}
        sta3SupervisorSite={props.sta3SupervisorSite}
      />

      <HemklinikModalStack
        hemklinikOpen={props.hemklinikOpen}
        setHemklinikOpen={props.setHemklinikOpen}
        hemklinikTab={props.hemklinikTab}
        setHemklinikTab={props.setHemklinikTab}
        hemklinikLoading={props.hemklinikLoading}
        setHemklinikComposeOpen={props.setHemklinikComposeOpen}
        hemklinikMailbox={props.hemklinikMailbox}
        setHemklinikMailbox={props.setHemklinikMailbox}
        hemklinikMessages={props.hemklinikMessages}
        hemklinikSentMessages={props.hemklinikSentMessages}
        hemklinikMailboxRows={props.hemklinikMailboxRows}
        hemklinikSelectedMessage={props.hemklinikSelectedMessage}
        onOpenMailboxMessage={props.onOpenMailboxMessage}
        onRemoveHemklinikMessage={props.onRemoveHemklinikMessage}
        hemklinikSuggestions={props.hemklinikSuggestions}
        setHemklinikSuggestionDetail={props.setHemklinikSuggestionDetail}
        onDismissHemklinikSuggestion={props.onDismissHemklinikSuggestion}
        hemklinikColleagues={props.hemklinikColleagues}
        hemklinikPrimaryContacts={props.hemklinikPrimaryContacts}
        setHemklinikContactDetail={props.setHemklinikContactDetail}
        setColleagueMainTab={props.setColleagueMainTab}
        setColleagueActivityDetail={props.setColleagueActivityDetail}
        setSelectedColleague={props.setSelectedColleague}
        hemklinikContactDetail={props.hemklinikContactDetail}
        hemklinikComposeOpen={props.hemklinikComposeOpen}
        setHemklinikRecipientPickerOpen={props.setHemklinikRecipientPickerOpen}
        hemklinikComposeRecipients={props.hemklinikComposeRecipients}
        setHemklinikComposeText={props.setHemklinikComposeText}
        hemklinikComposeText={props.hemklinikComposeText}
        onSendHemklinikMessage={props.onSendHemklinikMessage}
        hemklinikComposeSending={props.hemklinikComposeSending}
        hemklinikRecipientPickerOpen={props.hemklinikRecipientPickerOpen}
        setHemklinikComposeRecipients={props.setHemklinikComposeRecipients}
        hemklinikSuggestionDetail={props.hemklinikSuggestionDetail}
      />

      <PusslaActionPopups
        activityTemplateChangeOpen={props.activityTemplateChangeOpen}
        templateChangeCurrent={props.templateChangeCurrent}
        activityTemplateChangeQueueLength={props.activityTemplateChangeQueueLength}
        handleTemplateDeletedRemoveActivity={props.handleTemplateDeletedRemoveActivity}
        handleTemplateDeletedChangeActivity={props.handleTemplateDeletedChangeActivity}
        acknowledgeTemplateChangeNotice={props.acknowledgeTemplateChangeNotice}
        setActivityTemplateChangeOpen={props.setActivityTemplateChangeOpen}
        certMenu={props.certMenu}
        getCourseDisplayTitle={props.getCourseDisplayTitle}
        openDocumentsFor={props.openDocumentsFor}
        runCertificateForCertMenu={props.runCertificateForCertMenu}
        setCertMenu={props.setCertMenu}
      />

      <PusslaChatAndNotifications
        adapter={props.adapter}
        aiAgentEnabled={props.aiAgentEnabled}
        aiAgentProvider={props.aiAgentProvider}
        aiAgentModels={props.aiAgentModels}
        aiAgentUnlockedKeys={props.aiAgentUnlockedKeys}
        aiAgentConfirmMode={props.aiAgentConfirmMode}
        setAiAgentProvider={props.setAiAgentProvider}
        setAiAgentModels={props.setAiAgentModels}
      />

      <PusslaSafetyDialogs
        goHomeWarnOpen={props.goHomeWarnOpen}
        setGoHomeWarnOpen={props.setGoHomeWarnOpen}
        setSaveInfoOpen={props.setSaveInfoOpen}
        onGoHome={props.onGoHome}
        showCloseConfirm={props.showCloseConfirm}
        pendingSwitchPlacementId={props.pendingSwitchPlacementId}
        pendingSwitchCourseId={props.pendingSwitchCourseId}
        handleCancelClose={props.handleCancelClose}
        handleConfirmClose={props.handleConfirmClose}
        handleSaveAndClose={props.handleSaveAndClose}
        showDeleteConfirm={props.showDeleteConfirm}
        deleteConfirmConfig={props.deleteConfirmConfig}
        setShowDeleteConfirm={props.setShowDeleteConfirm}
        setDeleteConfirmConfig={props.setDeleteConfirmConfig}
        logoutConfirmOpen={props.logoutConfirmOpen}
        setLogoutConfirmOpen={props.setLogoutConfirmOpen}
        onConfirmLogout={props.onConfirmLogout}
      />
    </>
  );
}

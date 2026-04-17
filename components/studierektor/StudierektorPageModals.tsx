// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import type { ChangeEvent, Dispatch, RefObject, ReactNode, SetStateAction } from "react";
import dynamic from "next/dynamic";
import type { SupervisorStudent } from "@/lib/mappers/studentData";
import type { WarningRule } from "@/lib/studierektor/warningRuleTypes";
import type {
  ContactField,
  NetworkDataScope,
  NetworkGroup,
  NetworkGroupTab,
  NetworkInviteMode,
  NetworkShareMode,
} from "@/lib/studierektor/networkTypes";
import type { useNetworkOrchestration } from "@/components/studierektor/hooks/useNetworkOrchestration";
import type { ProgressionRow } from "@/components/studierektor/hooks/useProgressionRows";
import UppfoljningModal from "@/components/studierektor/UppfoljningModal";
import { StudentDetailModal } from "@/components/studierektor/StudentDetailModal";
import GoHomeWarningModal from "@/components/studierektor/GoHomeWarningModal";
import StudierektorProfileModal, { type StudierektorProfileData } from "@/components/studierektor/StudierektorProfileModal";
import StudierektorDashboardModal from "@/components/studierektor/StudierektorDashboardModal";
import StCompleteOfferModal from "@/components/studierektor/StCompleteOfferModal";
import OverallTimelineModal from "@/components/studierektor/OverallTimelineModal";
import ProgressionDetailModal from "@/components/studierektor/ProgressionDetailModal";
import WholeGroupProgressionModal, {
  type WholeGroupProgressionStats,
} from "@/components/studierektor/WholeGroupProgressionModal";
import LogoutWarningModal from "@/components/studierektor/LogoutWarningModal";
import MenyModal from "@/components/studierektor/MenyModal";
import NameChangePromptModal, { type NameChangePromptData } from "@/components/studierektor/NameChangePromptModal";
import NetworkModal from "@/components/studierektor/NetworkModal";
import NetworkGroupModalView from "@/components/studierektor/NetworkGroupModalView";

const AboutModal = dynamic(() => import("@/components/AboutModal"), { ssr: false });

type NetworkOrch = ReturnType<typeof useNetworkOrchestration>;

type Props = {
  fileRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;

  networkOpen: boolean;
  setNetworkOpen: (open: boolean) => void;
  networkNewGroupName: string;
  setNetworkNewGroupName: (v: string) => void;
  networkModalModel: NetworkOrch["networkModalModel"];
  networkGroups: NetworkGroup[];
  networkCurrentUserId: string;
  deleteNetworkGroupById: NetworkOrch["deleteNetworkGroupById"];
  leaveNetworkGroupById: NetworkOrch["leaveNetworkGroupById"];
  networkShareScopes: NetworkDataScope[];
  networkShareMode: NetworkShareMode;
  setNetworkShareMode: (v: NetworkShareMode) => void;
  networkSelectedGroupIdsForSharing: string[];
  networkRequestTarget: string;
  setNetworkRequestTarget: (v: string) => void;
  networkShowName: boolean;
  setNetworkShowName: (v: boolean) => void;
  networkShowContact: boolean;
  setNetworkShowContact: (v: boolean) => void;
  networkContactFields: ContactField[];
  srProfile: StudierektorProfileData;
  onSaveNetworkSettings: () => void;

  networkGroupModalModel: NetworkOrch["networkGroupModalModel"] | null;
  networkGroupOpen: boolean;
  setNetworkGroupOpen: (open: boolean) => void;
  isActiveNetworkGroupAdmin: boolean;
  networkGroupTab: NetworkGroupTab;
  setNetworkGroupTab: (t: NetworkGroupTab) => void;
  clinicName: string;
  clinicRegionContext: { regionLabel: string; peerClinicCount: number | null } | null;
  networkSelectedMemberId: string;
  setNetworkSelectedMemberId: Dispatch<SetStateAction<string>>;
  networkGroupRename: string;
  setNetworkGroupRename: (v: string) => void;
  networkInviteMode: NetworkInviteMode;
  setNetworkInviteMode: (v: NetworkInviteMode) => void;
  setNetworkInviteHospital: (v: string) => void;
  setNetworkInviteClinicId: (v: string) => void;
  networkInviteRegion: string;
  setNetworkInviteRegion: (v: string) => void;
  networkInviteHospital: string;
  networkInviteClinicId: string;
  networkInviteUserId: string;
  setNetworkInviteUserId: (v: string) => void;
  networkParticipantsLoading: boolean;

  goHomeWarnOpen: boolean;
  setGoHomeWarnOpen: (v: boolean) => void;
  onGoHomeSaveAndContinue: () => Promise<void>;
  onGoHomeContinueWithoutSave: () => void;

  srProfileOpen: boolean;
  setSrProfileOpen: (v: boolean) => void;
  setSrProfile: Dispatch<SetStateAction<StudierektorProfileData>>;
  srProfileSaving: boolean;
  onSaveSrProfile: () => void | Promise<void>;

  aboutOpen: boolean;
  setAboutOpen: (v: boolean) => void;

  uppfoljningOpen: boolean;
  setUppfoljningOpen: (v: boolean) => void;
  students: SupervisorStudent[];
  studentColorById: Map<string, string>;
  onFollowupStorageChanged: () => void;
  clinicMembers: { user_id: string; role: string; name: string }[];

  dashboardOpen: boolean;
  setDashboardOpen: (v: boolean) => void;

  stCompleteOffer: { studentId: string; name: string } | null;
  onStCompleteNej: () => void;
  onStCompleteJa: () => void | Promise<void>;

  selectedStudent: SupervisorStudent | null;
  setSelectedStudent: (s: SupervisorStudent | null) => void;
  showFlyttaTillTidigareForSelected: boolean;
  onFlyttaTillTidigareFromCard: () => void | Promise<void>;
  onReactivateFormer: () => void | Promise<void>;
  formerActionBusy: boolean;

  overallTimelineOpen: boolean;
  setOverallTimelineOpen: (v: boolean) => void;
  overallTimelineModalRef: RefObject<HTMLDivElement | null>;
  overallTimelinePrimaryTab: "overview" | "progression" | "settings";
  setOverallTimelinePrimaryTab: (t: "overview" | "progression" | "settings") => void;
  timelineTabView: ReactNode;
  progressionSubtabProgressionView: ReactNode;
  progressionSubtabSettingsView: ReactNode;

  progressionDetailStudentId: string | null;
  setProgressionDetailStudentId: (id: string | null) => void;
  progressionRows: ProgressionRow[];
  warningRules: WarningRule[];
  getStudentStartISO: (s: SupervisorStudent) => string | null;
  getStudentPlannedEndISO: (s: SupervisorStudent) => string | null;

  wholeGroupModalOpen: boolean;
  setWholeGroupModalOpen: (v: boolean) => void;
  wholeGroupProgressionStats: WholeGroupProgressionStats;

  nameChangePrompt: NameChangePromptData | null;
  onNameChangeExisting: () => void;
  onNameChangeNew: () => void;
  onNameChangeCancel: () => void;

  logoutWarnOpen: boolean;
  setLogoutWarnOpen: (v: boolean) => void;
  onLogoutConfirm: () => void | Promise<void>;

  menyOpen: boolean;
  setMenyOpen: (v: boolean) => void;
};

export function StudierektorPageModals(props: Props) {
  const {
    fileRef,
    onFileChange,
    networkOpen,
    setNetworkOpen,
    networkNewGroupName,
    setNetworkNewGroupName,
    networkModalModel,
    networkGroups,
    networkCurrentUserId,
    deleteNetworkGroupById,
    leaveNetworkGroupById,
    networkShareScopes,
    networkShareMode,
    setNetworkShareMode,
    networkSelectedGroupIdsForSharing,
    networkRequestTarget,
    setNetworkRequestTarget,
    networkShowName,
    setNetworkShowName,
    networkShowContact,
    setNetworkShowContact,
    networkContactFields,
    srProfile,
    onSaveNetworkSettings,
    networkGroupModalModel,
    networkGroupOpen,
    setNetworkGroupOpen,
    isActiveNetworkGroupAdmin,
    networkGroupTab,
    setNetworkGroupTab,
    clinicName,
    clinicRegionContext,
    networkSelectedMemberId,
    setNetworkSelectedMemberId,
    networkGroupRename,
    setNetworkGroupRename,
    networkInviteMode,
    setNetworkInviteMode,
    setNetworkInviteHospital,
    setNetworkInviteClinicId,
    networkInviteRegion,
    setNetworkInviteRegion,
    networkInviteHospital,
    networkInviteClinicId,
    networkInviteUserId,
    setNetworkInviteUserId,
    networkParticipantsLoading,
    goHomeWarnOpen,
    setGoHomeWarnOpen,
    onGoHomeSaveAndContinue,
    onGoHomeContinueWithoutSave,
    srProfileOpen,
    setSrProfileOpen,
    setSrProfile,
    srProfileSaving,
    onSaveSrProfile,
    aboutOpen,
    setAboutOpen,
    uppfoljningOpen,
    setUppfoljningOpen,
    students,
    studentColorById,
    onFollowupStorageChanged,
    clinicMembers,
    dashboardOpen,
    setDashboardOpen,
    stCompleteOffer,
    onStCompleteNej,
    onStCompleteJa,
    selectedStudent,
    setSelectedStudent,
    showFlyttaTillTidigareForSelected,
    onFlyttaTillTidigareFromCard,
    onReactivateFormer,
    formerActionBusy,
    overallTimelineOpen,
    setOverallTimelineOpen,
    overallTimelineModalRef,
    overallTimelinePrimaryTab,
    setOverallTimelinePrimaryTab,
    timelineTabView,
    progressionSubtabProgressionView,
    progressionSubtabSettingsView,
    progressionDetailStudentId,
    setProgressionDetailStudentId,
    progressionRows,
    warningRules,
    getStudentStartISO,
    getStudentPlannedEndISO,
    wholeGroupModalOpen,
    setWholeGroupModalOpen,
    wholeGroupProgressionStats,
    nameChangePrompt,
    onNameChangeExisting,
    onNameChangeNew,
    onNameChangeCancel,
    logoutWarnOpen,
    setLogoutWarnOpen,
    onLogoutConfirm,
    menyOpen,
    setMenyOpen,
  } = props;

  return (
    <>
      <NetworkModal
        networkOpen={networkOpen}
        onClose={() => setNetworkOpen(false)}
        networkNewGroupName={networkNewGroupName}
        setNetworkNewGroupName={setNetworkNewGroupName}
        onCreateGroup={networkModalModel.createGroup}
        networkGroups={networkGroups}
        networkCurrentUserId={networkCurrentUserId}
        onOpenGroup={networkModalModel.openGroup}
        onDeleteGhostGroup={deleteNetworkGroupById}
        onDeleteGroup={deleteNetworkGroupById}
        onLeaveGroup={leaveNetworkGroupById}
        networkShareScopes={networkShareScopes}
        onToggleScope={networkModalModel.toggleScope}
        networkShareMode={networkShareMode}
        setNetworkShareMode={setNetworkShareMode}
        networkSelectedGroupIdsForSharing={networkSelectedGroupIdsForSharing}
        onToggleGroupShare={networkModalModel.toggleGroupShare}
        networkRequestTarget={networkRequestTarget}
        setNetworkRequestTarget={setNetworkRequestTarget}
        networkShowName={networkShowName}
        setNetworkShowName={setNetworkShowName}
        networkShowContact={networkShowContact}
        setNetworkShowContact={setNetworkShowContact}
        networkContactFields={networkContactFields}
        onToggleContactField={networkModalModel.toggleContactField}
        srProfile={srProfile}
        onSaveSettings={onSaveNetworkSettings}
      />

      {networkGroupModalModel ? (
        <NetworkGroupModalView
          networkGroupOpen={networkGroupOpen}
          setNetworkGroupOpen={setNetworkGroupOpen}
          currentGroup={networkGroupModalModel.currentGroup}
          currentMembers={networkGroupModalModel.currentMembers}
          isActiveNetworkGroupAdmin={isActiveNetworkGroupAdmin}
          deleteNetworkGroupById={deleteNetworkGroupById}
          viewerIsMember={networkGroupModalModel.viewerIsMember}
          leaveNetworkGroupById={leaveNetworkGroupById}
          networkGroupTab={networkGroupTab}
          setNetworkGroupTab={setNetworkGroupTab}
          networkCurrentUserId={networkCurrentUserId}
          srProfile={srProfile}
          clinicName={clinicName}
          clinicRegionContext={clinicRegionContext}
          networkSelectedMemberId={networkSelectedMemberId}
          setNetworkSelectedMemberId={setNetworkSelectedMemberId}
          networkShowName={networkShowName}
          networkShowContact={networkShowContact}
          networkContactFields={networkContactFields}
          networkShareScopes={networkShareScopes}
          networkGroupRename={networkGroupRename}
          setNetworkGroupRename={setNetworkGroupRename}
          renameGroup={networkGroupModalModel.renameGroup}
          networkInviteMode={networkInviteMode}
          setNetworkInviteMode={setNetworkInviteMode}
          setNetworkInviteHospital={setNetworkInviteHospital}
          setNetworkInviteClinicId={setNetworkInviteClinicId}
          networkInviteRegion={networkInviteRegion}
          setNetworkInviteRegion={setNetworkInviteRegion}
          regionOptions={networkGroupModalModel.regionOptions}
          networkInviteHospital={networkInviteHospital}
          hospitalOptions={networkGroupModalModel.hospitalOptions}
          networkInviteClinicId={networkInviteClinicId}
          clinicOptions={networkGroupModalModel.clinicOptions}
          networkInviteUserId={networkInviteUserId}
          setNetworkInviteUserId={setNetworkInviteUserId}
          inviteCandidates={networkGroupModalModel.inviteCandidates}
          inviteTarget={networkGroupModalModel.inviteTarget}
          addMember={networkGroupModalModel.addMember}
          networkParticipantsLoading={networkParticipantsLoading}
          promoteAdmin={networkGroupModalModel.promoteAdmin}
          removeMember={networkGroupModalModel.removeMember}
        />
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        multiple
        className="hidden"
        onChange={onFileChange}
      />

      <GoHomeWarningModal
        open={goHomeWarnOpen}
        onCancel={() => setGoHomeWarnOpen(false)}
        onSaveAndContinue={onGoHomeSaveAndContinue}
        onContinueWithoutSave={onGoHomeContinueWithoutSave}
      />

      <StudierektorProfileModal
        open={srProfileOpen}
        onClose={() => setSrProfileOpen(false)}
        srProfile={srProfile}
        setSrProfile={setSrProfile}
        srProfileSaving={srProfileSaving}
        onSave={onSaveSrProfile}
      />

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <UppfoljningModal
        open={uppfoljningOpen}
        onClose={() => setUppfoljningOpen(false)}
        students={students}
        studentColorById={studentColorById}
        onFollowupStorageChanged={onFollowupStorageChanged}
        renderTimelinePanel={(student, onCloseTimeline) => (
          <StudentDetailModal
            student={student}
            onClose={onCloseTimeline}
            clinicMembers={clinicMembers}
            clinicName={clinicName}
            embedded
            timelineOnly
          />
        )}
      />

      <StudierektorDashboardModal open={dashboardOpen} onClose={() => setDashboardOpen(false)} />

      <StCompleteOfferModal offer={stCompleteOffer} onNo={onStCompleteNej} onYes={() => void onStCompleteJa()} />

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          clinicMembers={clinicMembers}
          clinicName={clinicName}
          formerStLakare={!!selectedStudent.formerStLakare}
          showFlyttaTillTidigare={showFlyttaTillTidigareForSelected}
          onFlyttaTillTidigare={onFlyttaTillTidigareFromCard}
          onReactivateFormer={selectedStudent.formerStLakare ? onReactivateFormer : undefined}
          formerActionBusy={formerActionBusy}
        />
      )}

      <OverallTimelineModal
        open={overallTimelineOpen}
        onClose={() => setOverallTimelineOpen(false)}
        overallTimelineModalRef={overallTimelineModalRef}
        overallTimelinePrimaryTab={overallTimelinePrimaryTab}
        setOverallTimelinePrimaryTab={setOverallTimelinePrimaryTab}
        timelineTabView={timelineTabView}
        progressionSubtabProgressionView={progressionSubtabProgressionView}
        progressionSubtabSettingsView={progressionSubtabSettingsView}
      />
      <ProgressionDetailModal
        progressionDetailStudentId={progressionDetailStudentId}
        setProgressionDetailStudentId={setProgressionDetailStudentId}
        progressionRows={progressionRows}
        warningRules={warningRules}
        getStudentStartISO={getStudentStartISO}
        getStudentPlannedEndISO={getStudentPlannedEndISO}
      />
      <WholeGroupProgressionModal
        open={wholeGroupModalOpen}
        onClose={() => setWholeGroupModalOpen(false)}
        clinicName={clinicName}
        stats={wholeGroupProgressionStats}
        clinicRegionContext={clinicRegionContext}
      />

      <NameChangePromptModal
        prompt={nameChangePrompt}
        onUseExisting={onNameChangeExisting}
        onUseNew={onNameChangeNew}
        onCancel={onNameChangeCancel}
      />

      <LogoutWarningModal
        open={logoutWarnOpen}
        onCancel={() => setLogoutWarnOpen(false)}
        onConfirm={onLogoutConfirm}
      />

      <MenyModal
        open={menyOpen}
        onClose={() => setMenyOpen(false)}
        onOpenProfile={() => {
          setMenyOpen(false);
          setSrProfileOpen(true);
        }}
        onOpenAbout={() => {
          setMenyOpen(false);
          setAboutOpen(true);
        }}
        onOpenLogout={() => {
          setMenyOpen(false);
          setLogoutWarnOpen(true);
        }}
      />
    </>
  );
}

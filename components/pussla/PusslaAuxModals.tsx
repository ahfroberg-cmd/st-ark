"use client";

import IntygGroupModal from "@/components/pussla/IntygGroupModal";
import MilestonePickerModals from "@/components/pussla/MilestonePickerModals";
import MilestoneDetailModals from "@/components/pussla/MilestoneDetailModals";
import CertificatePreview from "@/components/pussla/CertificatePreview";
import Sta3PrepModal from "@/components/Sta3PrepModal";
import InvitationPopup from "@/components/InvitationPopup";

export default function PusslaAuxModals(props: {
  previewOpen: boolean;
  previewUrl: string | null;
  onClosePreview: () => void;
  intygGroupModalOpen: boolean;
  setIntygGroupModalOpen: (value: boolean) => void;
  selectedPlacement: any;
  selectedCourseId?: string | null;
  activities: any[];
  sortMilestoneIds: (ids: string[]) => string[];
  displayMilestoneCode: (id: string) => string;
  profileGoalsVersion?: string;
  persistIntygGroupModal: (draftGroup: any, config: any) => Promise<void>;
  openPreviewForPlacementFromGroupModal: (payload: any) => Promise<void>;
  milestonePicker: { open: boolean; mode: "course" | "placement" | null };
  setMilestonePicker: (value: { open: boolean; mode: "course" | "placement" | null }) => void;
  btMilestonePicker: { open: boolean; mode: "course" | "placement" | null };
  setBtMilestonePicker: (value: { open: boolean; mode: "course" | "placement" | null }) => void;
  goals: any;
  selectedCourse: any;
  sanitizeStMilestonesForGoals: (ids: string[], goalsVersion?: string) => string[];
  setCourses: (updater: (prev: any[]) => any[]) => void;
  setActivities: (updater: (prev: any[]) => any[]) => void;
  btMilestoneDetail: string | null;
  setBtMilestoneDetail: (value: string | null) => void;
  btMilestones: any[];
  stMilestoneDetail: string | null;
  setStMilestoneDetail: (value: string | null) => void;
  sta3Open: boolean;
  setSta3Open: (value: boolean) => void;
  sta3Placements: any[];
  sta3Courses: any[];
  sta3Other: string;
  setSta3Other: (value: string) => void;
  sta3HowVerified: string;
  setSta3HowVerified: (value: string) => void;
  profile: any;
  sta3ResearchTitle: string;
  sta3SupervisorName: string;
  sta3SupervisorSpec: string;
  sta3SupervisorSite: string;
}) {
  return (
    <>
      <CertificatePreview open={props.previewOpen} url={props.previewUrl} onClose={props.onClosePreview} />

      {props.intygGroupModalOpen && props.selectedPlacement && !props.selectedCourseId && (
        <IntygGroupModal
          open={props.intygGroupModalOpen}
          onClose={() => props.setIntygGroupModalOpen(false)}
          baseActivity={props.selectedPlacement}
          activities={props.activities}
          sortMilestoneIds={props.sortMilestoneIds}
          displayMilestoneCode={props.displayMilestoneCode}
          goalsVersion={props.profileGoalsVersion}
          onSave={props.persistIntygGroupModal}
          onOpenIntygPreview={async (payload) => {
            props.setIntygGroupModalOpen(false);
            await props.openPreviewForPlacementFromGroupModal(payload);
          }}
        />
      )}

      <MilestonePickerModals
        milestonePicker={props.milestonePicker}
        setMilestonePicker={props.setMilestonePicker}
        btMilestonePicker={props.btMilestonePicker}
        setBtMilestonePicker={props.setBtMilestonePicker}
        goals={props.goals}
        profileGoalsVersion={props.profileGoalsVersion}
        selectedCourse={props.selectedCourse}
        selectedPlacement={props.selectedPlacement}
        sanitizeStMilestonesForGoals={props.sanitizeStMilestonesForGoals}
        setCourses={props.setCourses}
        setActivities={props.setActivities}
      />

      <MilestoneDetailModals
        btMilestoneDetail={props.btMilestoneDetail}
        setBtMilestoneDetail={props.setBtMilestoneDetail}
        btMilestones={props.btMilestones}
        stMilestoneDetail={props.stMilestoneDetail}
        setStMilestoneDetail={props.setStMilestoneDetail}
        goals={props.goals}
        profileGoalsVersion={props.profileGoalsVersion}
        displayMilestoneCode={props.displayMilestoneCode}
      />

      <Sta3PrepModal
        open={props.sta3Open}
        onClose={() => props.setSta3Open(false)}
        placements={props.sta3Placements}
        courses={props.sta3Courses}
        otherText={props.sta3Other}
        onOtherTextChange={props.setSta3Other}
        howVerifiedText={props.sta3HowVerified}
        onHowVerifiedTextChange={props.setSta3HowVerified}
        profile={{
          name: props.profile?.name,
          firstName: props.profile?.firstName,
          lastName: props.profile?.lastName,
          personalNumber: props.profile?.personalNumber,
          speciality: props.profile?.speciality,
          specialty: props.profile?.specialty,
          homeClinic: props.profile?.homeClinic,
        }}
        researchTitle={props.sta3ResearchTitle}
        supervisorName={props.sta3SupervisorName}
        supervisorSpeciality={props.sta3SupervisorSpec}
        supervisorSite={props.sta3SupervisorSite}
      />

      <InvitationPopup />
    </>
  );
}

"use client";

import dynamic from "next/dynamic";
import ReportPrintModal from "@/components/ReportPrintModal";
import SaveVersionModal from "@/components/pussla/SaveVersionModal";
import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";

const ScanIntygModal = dynamic(() => import("@/components/ScanIntygModal"), { ssr: false });
const MilestoneOverviewModal = dynamic(() => import("@/components/MilestoneOverviewModal"), { ssr: false });
const ProfileModal = dynamic(() => import("@/components/ProfileModal"), { ssr: false });
const AboutModal = dynamic(() => import("@/components/AboutModal"), { ssr: false });
const PrepareApplicationModal = dynamic(() => import("@/components/PrepareApplicationModalWrapper"), {
  ssr: false,
});
const PrepareBtModal = dynamic(() => import("@/components/PrepareBtModal"), { ssr: false });
const CoursePrepModal = dynamic(() => import("@/components/CoursePrepModal"), { ssr: false });

export default function PusslaWorkflowModals(props: {
  milestoneOverviewOpen: boolean;
  setMilestoneOverviewOpen: (value: boolean) => void;
  scanOpen: boolean;
  setScanOpen: (value: boolean) => void;
  refreshLists: () => void;
  profile: any;
  saveInfoOpen: boolean;
  setSaveInfoOpen: (value: boolean) => void;
  activities: any[];
  courses: any[];
  reportOpen: boolean;
  setReportOpen: (value: boolean) => void;
  profileOpen: boolean;
  setProfileOpen: (value: boolean) => void;
  aboutOpen: boolean;
  setAboutOpen: (value: boolean) => void;
  prepareOpen: boolean;
  setPrepareOpen: (value: boolean) => void;
  btModalOpen: boolean;
  setBtModalOpen: (value: boolean) => void;
  courseModalOpen: boolean;
  setCourseModalOpen: (value: boolean) => void;
  courseForModal: any;
  toMilestoneIds: (ids: string[]) => string[];
}) {
  return (
    <>
      <MilestoneOverviewModal
        open={props.milestoneOverviewOpen}
        onClose={() => props.setMilestoneOverviewOpen(false)}
      />

      <ScanIntygModal
        open={props.scanOpen}
        onClose={() => props.setScanOpen(false)}
        onSaved={() => props.refreshLists()}
        goalsVersion={normalizeGoalsVersion((props.profile as any)?.goalsVersion || "2021")}
      />

      <SaveVersionModal
        open={props.saveInfoOpen}
        onClose={() => props.setSaveInfoOpen(false)}
        activities={props.activities}
        courses={props.courses}
      />

      <ReportPrintModal
        open={props.reportOpen}
        onClose={() => {
          props.setReportOpen(false);
        }}
      />

      <ProfileModal open={props.profileOpen} onClose={() => props.setProfileOpen(false)} />
      <AboutModal open={props.aboutOpen} onClose={() => props.setAboutOpen(false)} />

      <PrepareApplicationModal open={props.prepareOpen} onClose={() => props.setPrepareOpen(false)} />

      <PrepareBtModal open={props.btModalOpen} onClose={() => props.setBtModalOpen(false)} />

      <CoursePrepModal
        open={props.courseModalOpen && !!props.courseForModal}
        onClose={() => props.setCourseModalOpen(false)}
        profile={{
          goalsVersion: normalizeGoalsVersion((props.profile as any)?.goalsVersion || "2021"),
          homeClinic: (props.profile as any)?.homeClinic || "",
          name: (props.profile as any)?.name || "",
          firstName: (props.profile as any)?.firstName || "",
          lastName: (props.profile as any)?.lastName || "",
          personalNumber: (props.profile as any)?.personalNumber || "",
          specialty: (props.profile as any)?.specialty || "",
          speciality: (props.profile as any)?.speciality || "",
          supervisor: (props.profile as any)?.supervisor || "",
          supervisorWorkplace: (props.profile as any)?.supervisorWorkplace || "",
          supervisorSpecialty:
            (props.profile as any)?.specialty || (props.profile as any)?.speciality || "",
          supervisorSpeciality:
            (props.profile as any)?.speciality || (props.profile as any)?.specialty || "",
        }}
        course={props.courseForModal}
        milestones={props.toMilestoneIds(((props.courseForModal as any)?.milestones || []) as string[])}
      />
    </>
  );
}

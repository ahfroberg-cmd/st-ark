"use client";

import StudentContactReadonly from "@/components/students/StudentContactReadonly";
import StudentPlaneringReadonly from "@/components/students/StudentPlaneringReadonly";
import type { SupervisorStudent } from "@/lib/mappers/studentData";
import DelmalReadonly from "@/components/studierektor/DelmalReadonly";
import StudentHandledareTab from "@/components/studierektor/StudentHandledareTab";
import type { StudentDetailMainTab } from "@/components/studierektor/studentDetailTypes";

export default function StudentDetailSecondaryTabs({
  mainTab,
  student,
  iupPlanning,
  iupPlanningExtra,
  placements,
  planeringSubTab,
  setPlaneringSubTab,
  selectedPlanPlacReadIdx,
  setSelectedPlanPlacReadIdx,
}: {
  mainTab: StudentDetailMainTab;
  student: SupervisorStudent;
  iupPlanning: any;
  iupPlanningExtra: any[];
  placements: any[];
  planeringSubTab: "overgripande" | "enskild";
  setPlaneringSubTab: (tab: "overgripande" | "enskild") => void;
  selectedPlanPlacReadIdx: number | null;
  setSelectedPlanPlacReadIdx: (idx: number) => void;
}) {
  if (mainTab === "delmal") {
    return <DelmalReadonly student={student} />;
  }

  if (mainTab === "planering") {
    return (
      <StudentPlaneringReadonly
        iupPlanning={iupPlanning}
        iupPlanningExtra={iupPlanningExtra}
        placements={placements}
        planeringSubTab={planeringSubTab}
        setPlaneringSubTab={setPlaneringSubTab}
        selectedPlanPlacReadIdx={selectedPlanPlacReadIdx}
        setSelectedPlanPlacReadIdx={setSelectedPlanPlacReadIdx}
      />
    );
  }

  if (mainTab === "handledartraffar") {
    return <StudentHandledareTab studentId={student.id} studentName={student.name} activeTab="handledning" />;
  }

  if (mainTab === "kommunikation") {
    return <StudentHandledareTab studentId={student.id} studentName={student.name} activeTab="suggest" />;
  }

  if (mainTab === "kontaktuppgifter") {
    return <StudentContactReadonly student={student} />;
  }

  return null;
}

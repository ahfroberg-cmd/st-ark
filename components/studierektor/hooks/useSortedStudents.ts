"use client";

import { useMemo } from "react";
import type { SupervisorStudent } from "@/lib/mappers/studentData";

type StudentSort = {
  column: string;
  direction: "asc" | "desc";
};

export function useSortedStudents({
  students,
  formerStudents,
  studentSort,
  mainSupervisorLabel,
  getOngoingPlacement,
  placementLabel,
  getStudentPhaseLabel,
  getStudentPlannedEndISO,
  getNextPlacement,
  calculateProgress,
}: {
  students: SupervisorStudent[];
  formerStudents: SupervisorStudent[];
  studentSort: StudentSort;
  mainSupervisorLabel: (student: SupervisorStudent) => string;
  getOngoingPlacement: (student: SupervisorStudent) => any;
  placementLabel: (placement: any) => string;
  getStudentPhaseLabel: (student: SupervisorStudent) => string;
  getStudentPlannedEndISO: (student: SupervisorStudent) => string | null;
  getNextPlacement: (student: SupervisorStudent) => any;
  calculateProgress: (student: SupervisorStudent) => number;
}) {
  return useMemo(() => {
    const compareText = (a: string, b: string) => a.localeCompare(b, "sv", { numeric: true, sensitivity: "base" });
    const compareNullableText = (a: string, b: string) => {
      const av = String(a || "").trim();
      const bv = String(b || "").trim();
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return compareText(av, bv);
    };
    const compareNullableDate = (a: string | null, b: string | null) => {
      const at = a ? Date.parse(a) : NaN;
      const bt = b ? Date.parse(b) : NaN;
      const aValid = Number.isFinite(at);
      const bValid = Number.isFinite(bt);
      if (!aValid && !bValid) return 0;
      if (!aValid) return 1;
      if (!bValid) return -1;
      return at - bt;
    };

    const sortRows = (rows: SupervisorStudent[]) => {
      const copy = [...rows];
      copy.sort((a, b) => {
        let result = 0;
        switch (studentSort.column) {
          case "name":
            result = compareNullableText(a.name, b.name);
            break;
          case "goalsVersion":
            result = compareNullableText(a.goalsVersion, b.goalsVersion);
            break;
          case "mainSupervisor":
            result = compareNullableText(mainSupervisorLabel(a), mainSupervisorLabel(b));
            break;
          case "ongoingPlacement":
            result = compareNullableText(placementLabel(getOngoingPlacement(a)), placementLabel(getOngoingPlacement(b)));
            break;
          case "phase":
            result = compareNullableText(getStudentPhaseLabel(a), getStudentPhaseLabel(b));
            break;
          case "stEndDate":
            result = compareNullableDate(getStudentPlannedEndISO(a), getStudentPlannedEndISO(b));
            break;
          case "nextPlacement":
            result = compareNullableText(placementLabel(getNextPlacement(a)), placementLabel(getNextPlacement(b)));
            break;
          case "progress":
            result = calculateProgress(a) - calculateProgress(b);
            break;
          case "lastUpdated":
            result = compareNullableDate(a.lastUpdated || null, b.lastUpdated || null);
            break;
        }

        if (result === 0) {
          result = compareNullableText(a.name, b.name);
        }

        return studentSort.direction === "asc" ? result : -result;
      });
      return copy;
    };

    return {
      sortedStudents: sortRows(students),
      sortedFormerStudents: sortRows(formerStudents),
    };
  }, [
    calculateProgress,
    formerStudents,
    getNextPlacement,
    getOngoingPlacement,
    getStudentPhaseLabel,
    getStudentPlannedEndISO,
    mainSupervisorLabel,
    placementLabel,
    studentSort,
    students,
  ]);
}

"use client";

import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { SupervisorStudent } from "@/lib/mappers/studentData";
import { loadStCompleteDeclinedIds } from "@/lib/studierektor/stCompleteDeclined";

export function useStCompleteOfferDetection({
  students,
  clinicLoading,
  stCompleteOffer,
  setStCompleteOffer,
  getStudentPlannedEndISO,
}: {
  students: SupervisorStudent[];
  clinicLoading: boolean;
  stCompleteOffer: { studentId: string; name: string } | null;
  setStCompleteOffer: Dispatch<SetStateAction<{ studentId: string; name: string } | null>>;
  getStudentPlannedEndISO: (student: SupervisorStudent) => string | null;
}) {
  useEffect(() => {
    if (clinicLoading || stCompleteOffer) return;
    const today = new Date().toISOString().slice(0, 10);
    const declined = loadStCompleteDeclinedIds();
    for (const s of students) {
      if (s.formerStLakare) continue;
      const end = getStudentPlannedEndISO(s);
      if (!end || end >= today) continue;
      if (declined.has(s.id)) continue;
      setStCompleteOffer({ studentId: s.id, name: s.name });
      return;
    }
  }, [students, clinicLoading, stCompleteOffer, setStCompleteOffer, getStudentPlannedEndISO]);
}

"use client";

import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { SupervisorStudent } from "@/lib/mappers/studentData";
import { supabase } from "@/lib/supabase";
import { removeStCompleteDeclined } from "@/lib/studierektor/stCompleteDeclined";

export function useFormerStActions({
  selectedStudent,
  setSelectedStudent,
  students,
  stCompleteOffer,
  setStCompleteOffer,
  setReloadStudentsTick,
}: {
  selectedStudent: SupervisorStudent | null;
  setSelectedStudent: Dispatch<SetStateAction<SupervisorStudent | null>>;
  students: SupervisorStudent[];
  stCompleteOffer: { studentId: string; name: string } | null;
  setStCompleteOffer: Dispatch<SetStateAction<{ studentId: string; name: string } | null>>;
  setReloadStudentsTick: Dispatch<SetStateAction<number>>;
}) {
  const [formerActionBusy, setFormerActionBusy] = useState(false);

  const patchMembershipFormerSt = useCallback(
    async (student: SupervisorStudent, former: boolean) => {
      const mid = student.clinicMembershipId;
      if (!mid) {
        console.error("[Studierektor] Saknar clinicMembershipId – kör supabase/clinic_memberships_former_st_lakare.sql");
        return false;
      }
      setFormerActionBusy(true);
      try {
        const { error } = await supabase.from("clinic_memberships").update({ former_st_lakare: former }).eq("id", mid);
        if (error) throw error;
        removeStCompleteDeclined(student.id);
        setReloadStudentsTick((t) => t + 1);
        return true;
      } catch (e) {
        console.error("[Studierektor] former_st_lakare:", e);
        return false;
      } finally {
        setFormerActionBusy(false);
      }
    },
    [setReloadStudentsTick]
  );

  const handleFlyttaTillTidigareFromCard = useCallback(async () => {
    if (!selectedStudent) return;
    const ok = await patchMembershipFormerSt(selectedStudent, true);
    if (ok) {
      setSelectedStudent(null);
    }
  }, [patchMembershipFormerSt, selectedStudent, setSelectedStudent]);

  const handleReactivateFormer = useCallback(async () => {
    if (!selectedStudent) return;
    const ok = await patchMembershipFormerSt(selectedStudent, false);
    if (ok) setSelectedStudent(null);
  }, [patchMembershipFormerSt, selectedStudent, setSelectedStudent]);

  const handleStCompleteJa = useCallback(async () => {
    if (!stCompleteOffer) return;
    const s = students.find((x) => x.id === stCompleteOffer.studentId);
    if (s) await patchMembershipFormerSt(s, true);
    setStCompleteOffer(null);
  }, [patchMembershipFormerSt, setStCompleteOffer, stCompleteOffer, students]);

  return {
    formerActionBusy,
    handleFlyttaTillTidigareFromCard,
    handleReactivateFormer,
    handleStCompleteJa,
  };
}

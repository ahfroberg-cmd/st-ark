import { supabase } from "@/lib/supabase";

export type ClinicContactInfo = {
  clinicName: string;
  mainSupervisor: {
    id: string;
    name: string;
    specialty: string;
    workplace: string;
  } | null;
  studyDirector: {
    id: string;
    name: string;
    specialty: string;
    workplace: string;
  } | null;
  verksamhetschef: string;
};

export async function fetchClinicContactsForUser(userId: string): Promise<ClinicContactInfo> {
  const out: ClinicContactInfo = {
    clinicName: "",
    mainSupervisor: null,
    studyDirector: null,
    verksamhetschef: "",
  };
  if (!userId) return out;

  const { data: myMembership } = await supabase
    .from("clinic_memberships")
    .select("clinic_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const clinicId = (myMembership as any)?.clinic_id;
  if (!clinicId) return out;

  const { data: clinicRow } = await supabase
    .from("clinics")
    .select("name,verksamhetschef")
    .eq("id", clinicId)
    .maybeSingle();
  out.clinicName = String((clinicRow as any)?.name || "");
  out.verksamhetschef = String((clinicRow as any)?.verksamhetschef || "");

  const [assignmentRes, srMemberRes, hhMemberRes] = await Promise.all([
    supabase
      .from("supervisor_assignments")
      .select("supervisor_id")
      .eq("clinic_id", clinicId)
      .eq("st_lakare_id", userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("clinic_memberships")
      .select("user_id")
      .eq("clinic_id", clinicId)
      .in("role", ["studierektor", "study_director"])
      .limit(1)
      .maybeSingle(),
    supabase
      .from("clinic_memberships")
      .select("user_id")
      .eq("clinic_id", clinicId)
      .in("role", ["huvudhandledare", "supervisor"])
      .limit(1)
      .maybeSingle(),
  ]);

  const supervisorId = String(
    (assignmentRes.data as any)?.supervisor_id ||
      (hhMemberRes.data as any)?.user_id ||
      ""
  );
  const srId = String((srMemberRes.data as any)?.user_id || "");
  const ids = [supervisorId, srId].filter(Boolean);
  if (ids.length === 0) return out;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,name,specialty,sr_specialty,home_clinic")
    .in("id", ids);
  const byId = new Map((profiles || []).map((p: any) => [String(p.id), p]));

  if (supervisorId && byId.has(supervisorId)) {
    const p: any = byId.get(supervisorId);
    out.mainSupervisor = {
      id: supervisorId,
      name: String(p?.name || ""),
      specialty: String(p?.specialty || ""),
      workplace: String(p?.home_clinic || out.clinicName || ""),
    };
  }
  if (srId && byId.has(srId)) {
    const p: any = byId.get(srId);
    out.studyDirector = {
      id: srId,
      name: String(p?.name || ""),
      specialty: String(p?.sr_specialty || p?.specialty || ""),
      workplace: String(p?.home_clinic || out.clinicName || ""),
    };
  }

  return out;
}


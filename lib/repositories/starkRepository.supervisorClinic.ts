import { supabase } from "@/lib/supabase";

export async function listProfilesByIds(userIds: string[], columns = "id,name") {
  if (!Array.isArray(userIds) || userIds.length === 0) return { data: [], error: null } as any;
  return supabase.from("profiles").select(columns).in("id", userIds);
}

export async function listSupervisorAssignedStudentIds(supervisorId: string) {
  return supabase
    .from("supervisor_assignments")
    .select("id,st_lakare_id")
    .eq("supervisor_id", supervisorId);
}

export async function listSupervisorAssignmentsByClinicId(clinicId: string) {
  return supabase
    .from("supervisor_assignments")
    .select("st_lakare_id,supervisor_id")
    .eq("clinic_id", clinicId);
}

export async function listSupervisorAssignments() {
  return supabase
    .from("supervisor_assignments")
    .select("st_lakare_id,supervisor_id");
}

export async function deleteSupervisorAssignmentsForStudent(clinicId: string, stUserId: string) {
  return supabase
    .from("supervisor_assignments")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("st_lakare_id", stUserId);
}

export async function createSupervisorAssignment(row: {
  clinic_id: string;
  supervisor_id: string;
  st_lakare_id: string;
  assigned_by: string;
}) {
  return supabase
    .from("supervisor_assignments")
    .insert(row);
}

export async function listClinicMembershipsByClinicId(clinicId: string) {
  return supabase
    .from("clinic_memberships")
    .select("user_id,role")
    .eq("clinic_id", clinicId);
}

/** Första klinikkoppling med inbäddad klinikrad (rik select, fallback vid fel). */
export async function fetchFirstClinicMembershipWithClinicForUser(userId: string) {
  const rich = await supabase
    .from("clinic_memberships")
    .select("clinic_id, clinics(name,st_chief,verksamhetschef,org_home)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!rich.error) return rich;
  return supabase
    .from("clinic_memberships")
    .select("clinic_id, clinics(name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
}

export async function fetchSupervisorIdForStAtClinic(stLakareId: string, clinicId: string) {
  return supabase
    .from("supervisor_assignments")
    .select("supervisor_id")
    .eq("st_lakare_id", stLakareId)
    .eq("clinic_id", clinicId)
    .limit(1)
    .maybeSingle();
}

export async function listSupervisorIdsForStLakare(stLakareId: string) {
  return supabase.from("supervisor_assignments").select("supervisor_id").eq("st_lakare_id", stLakareId);
}

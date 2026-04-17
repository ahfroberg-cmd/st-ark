import { supabase } from "@/lib/supabase";
import { invalidateCache } from "./starkRepository.cache";

/** Flytta medlemmar till annan klinik innan källklinik tas bort. Hanterar dubblett (användaren finns redan på målkliniken). */
export async function reassignClinicMembersToOtherClinic(
  targetClinicId: string,
  members: { id: string; user_id: string; role: string }[]
) {
  for (const m of members) {
    const { data: existingAtTarget, error: exErr } = await findClinicMembershipIdForUserClinic(
      m.user_id,
      targetClinicId
    );
    if (exErr) return { error: exErr } as const;
    if (existingAtTarget?.id) {
      const del = await supabase.from("clinic_memberships").delete().eq("id", m.id);
      if (del.error) return { error: del.error } as const;
      continue;
    }
    const del = await supabase.from("clinic_memberships").delete().eq("id", m.id);
    if (del.error) return { error: del.error } as const;
    const ins = await supabase.from("clinic_memberships").insert({
      clinic_id: targetClinicId,
      user_id: m.user_id,
      role: m.role,
    });
    if (ins.error) return { error: ins.error } as const;
  }
  return { error: null } as const;
}

export async function updateProfileRoleForUser(userId: string, role: string) {
  invalidateCache("profiles", userId);
  return supabase.from("profiles").update({ role }).eq("id", userId);
}

export async function insertInvitationRow(row: Record<string, unknown>) {
  return supabase.from("invitations").insert(row);
}

export async function findInvitationIdByEmailAndClinic(email: string, clinicId: string) {
  return supabase.from("invitations").select("id").eq("email", email).eq("clinic_id", clinicId).maybeSingle();
}

export async function updateInvitationStatus(invitationId: string, status: string) {
  return supabase.from("invitations").update({ status }).eq("id", invitationId);
}

export async function getInvitationEmailByToken(token: string) {
  return supabase.from("invitations").select("email").eq("token", token).single();
}

export async function getInvitationWithClinicByToken(token: string) {
  return supabase.from("invitations").select("*, clinics(name)").eq("token", token).single();
}

export async function markInvitationAccepted(invitationId: string) {
  return supabase
    .from("invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitationId);
}

/** Första pending-inbjudan som matchar någon av e-postadresserna (nyast först). */
export async function listPendingInvitationsForEmails(emails: string[]) {
  if (emails.length === 0) {
    return { data: [] as unknown[], error: null };
  }
  return supabase
    .from("invitations")
    .select("id, clinic_id, email, role, name, expires_at, clinics(name)")
    .in("email", emails)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);
}

export async function findClinicMembershipIdForUserClinic(userId: string, clinicId: string) {
  return supabase
    .from("clinic_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
}

export async function updateProfileNameForUser(userId: string, name: string) {
  invalidateCache("profiles", userId);
  return supabase
    .from("profiles")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

export async function getProfileIdRoleByUserId(userId: string) {
  return supabase.from("profiles").select("id, role").eq("id", userId).maybeSingle();
}

export async function insertProfileIdRole(userId: string, role: string) {
  invalidateCache("profiles", userId);
  return supabase.from("profiles").insert({ id: userId, role });
}

export async function listClinicsBrief() {
  return supabase
    .from("clinics")
    .select("id,name,hospital_id,hospitals(name)")
    .order("name");
}

export async function listStudierektorClinicRows(userId: string) {
  return supabase
    .from("clinic_memberships")
    .select("clinic_id, clinics(id, name, hospital_id, hospitals(name))")
    .eq("user_id", userId)
    .eq("role", "studierektor");
}

export async function listInvitationsAll() {
  return supabase
    .from("invitations")
    .select("id, clinic_id, email, role, status, created_at, expires_at")
    .order("created_at", { ascending: false });
}

export async function listInvitationsByInviter(userId: string) {
  return supabase
    .from("invitations")
    .select("id, clinic_id, email, role, status, created_at, expires_at")
    .eq("invited_by", userId)
    .order("created_at", { ascending: false });
}

import { supabase } from "@/lib/supabase";
import { SWEDISH_HOSPITALS_SEED } from "@/lib/data/swedishHospitalsSeed";
import { SWEDISH_VARDCENTRAL_SEED } from "@/lib/data/swedishVardcentralSeed";

/** Admin (superadmin) — smala listor och CRUD utan *-select */
export async function listClinicsForAdmin() {
  return supabase
    .from("clinics")
    .select("id,name,hospital_id,created_at,hospitals(id,name,region,facility_type)")
    .order("name");
}

export async function listHospitalsForAdmin() {
  return supabase
    .from("hospitals")
    .select("id,name,region,facility_type,created_at")
    .order("region", { ascending: true })
    .order("facility_type", { ascending: true })
    .order("name", { ascending: true });
}

export async function insertHospitalRow(row: {
  name: string;
  region?: string;
  facility_type?: "sjukhus" | "vardcentral";
}) {
  const name = String(row.name || "").trim();
  if (!name) return { data: null, error: { message: "Saknar namn på enhet" } } as any;
  const facility_type = row.facility_type === "vardcentral" ? "vardcentral" : "sjukhus";
  return supabase
    .from("hospitals")
    .insert({
      name,
      region: String(row.region || "").trim(),
      facility_type,
      updated_at: new Date().toISOString(),
    })
    .select("id,name,region,facility_type")
    .single();
}

export async function updateHospitalRow(
  hospitalId: string,
  patch: { name?: string; region?: string; facility_type?: "sjukhus" | "vardcentral" }
) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) updates.name = String(patch.name || "").trim();
  if (patch.region !== undefined) updates.region = String(patch.region || "").trim();
  if (patch.facility_type !== undefined) updates.facility_type = patch.facility_type;
  return supabase
    .from("hospitals")
    .update(updates)
    .eq("id", hospitalId)
    .select("id,name,region,facility_type")
    .single();
}

export async function deleteHospitalRow(hospitalId: string) {
  const { count, error: cErr } = await supabase
    .from("clinics")
    .select("id", { count: "exact", head: true })
    .eq("hospital_id", hospitalId);
  if (cErr) return { data: null, error: cErr } as any;
  if ((count ?? 0) > 0) {
    return {
      data: null,
      error: {
        message: `Kan inte ta bort enheten: ${count} klinik(er) är kopplade. Flytta eller ta bort klinikerna först.`,
      },
    } as any;
  }
  return supabase.from("hospitals").delete().eq("id", hospitalId);
}

/** Lägger in standardsjukhus och standard vårdcentraler som saknas (nyckel: namn+region+typ). */
export async function syncStandardHospitalsMissing() {
  const { data: existing, error: e1 } = await supabase.from("hospitals").select("name,region,facility_type");
  if (e1) return { inserted: 0, error: e1 } as const;
  const key = (n: string, r: string, t: string) =>
    `${String(n || "")
      .trim()
      .toLowerCase()}\t${String(r || "")
      .trim()
      .toLowerCase()}\t${String(t || "sjukhus")
      .trim()
      .toLowerCase()}`;
  const have = new Set(
    (existing || []).map((r: any) =>
      key(r.name, r.region, r.facility_type === "vardcentral" ? "vardcentral" : "sjukhus")
    )
  );
  const now = new Date().toISOString();
  const toAdd: { name: string; region: string; facility_type: string; updated_at: string }[] = [];
  for (const s of SWEDISH_HOSPITALS_SEED) {
    if (!have.has(key(s.name, s.region, "sjukhus"))) {
      toAdd.push({ name: s.name, region: s.region, facility_type: "sjukhus", updated_at: now });
      have.add(key(s.name, s.region, "sjukhus"));
    }
  }
  for (const s of SWEDISH_VARDCENTRAL_SEED) {
    if (!have.has(key(s.name, s.region, "vardcentral"))) {
      toAdd.push({ name: s.name, region: s.region, facility_type: "vardcentral", updated_at: now });
      have.add(key(s.name, s.region, "vardcentral"));
    }
  }
  if (toAdd.length === 0) return { inserted: 0, error: null } as const;
  const { error: e2 } = await supabase.from("hospitals").insert(toAdd);
  return { inserted: toAdd.length, error: e2 } as const;
}

export async function listClinicMembershipsWithProfiles() {
  const memRes = await supabase.from("clinic_memberships").select("*");
  if (memRes.error) return memRes;
  const rows = (memRes.data || []) as Record<string, unknown>[];
  const ids = [
    ...new Set(rows.map((m) => String(m.user_id || "")).filter(Boolean)),
  ];
  if (ids.length === 0) {
    return {
      data: rows.map((m) => ({ ...m, profiles: null })),
      error: null,
    } as any;
  }
  const profRes = await supabase.from("profiles").select("id, name, role, email").in("id", ids);
  if (profRes.error) return { data: null, error: profRes.error } as any;
  const byId = new Map(
    (profRes.data || []).map((p: any) => [String(p.id), p])
  );
  const data = rows.map((m) => ({
    ...m,
    profiles: byId.get(String(m.user_id)) ?? null,
  }));
  return { data, error: null } as any;
}

export async function listProfilesForAdminPicker() {
  return supabase.from("profiles").select("id, name, role").order("name");
}

export async function insertClinicRow(payload: {
  name: string;
  hospital_id: string | null;
}) {
  return supabase.from("clinics").insert({
    name: payload.name,
    hospital_id: payload.hospital_id,
  });
}

/** Superadmin: ändra kliniknamn och koppling till sjukhus. */
export async function updateClinicRowForAdmin(
  clinicId: string,
  patch: { name: string; hospital_id: string | null }
) {
  const name = String(patch.name || "").trim();
  if (!name) {
    return { data: null, error: { message: "Kliniknamn saknas" } } as any;
  }
  return supabase
    .from("clinics")
    .update({
      name,
      hospital_id: patch.hospital_id,
    })
    .eq("id", clinicId)
    .select("id,name,hospital_id,created_at,hospitals(id,name,region,facility_type)")
    .single();
}

export async function deleteClinicRow(clinicId: string) {
  return supabase.from("clinics").delete().eq("id", clinicId);
}

export async function insertClinicMembershipRow(row: {
  clinic_id: string;
  user_id: string;
  role: string;
}) {
  return supabase.from("clinic_memberships").insert(row);
}

export async function deleteClinicMembershipRow(membershipId: string) {
  return supabase.from("clinic_memberships").delete().eq("id", membershipId);
}

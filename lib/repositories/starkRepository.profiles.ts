import { getSessionUser, supabase } from "@/lib/supabase";
import { PROFILE_COLUMNS, PROFILE_EDITOR_COLUMNS } from "./starkRepository.columns";
import { getCacheKey, invalidateCache, readCache, writeCache } from "./starkRepository.cache";

export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.id ?? null;
}

export async function getClinicIdForCurrentUserRole(role: string): Promise<string | null> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;
  const roleRaw = String(role || "").trim().toLowerCase();
  const roleCandidates =
    roleRaw === "studierektor"
      ? ["studierektor", "study_director", "studierektor_admin"]
      : roleRaw === "huvudhandledare"
      ? ["huvudhandledare", "supervisor"]
      : [roleRaw];
  const res = await supabase
    .from("clinic_memberships")
    .select("clinic_id")
    .eq("user_id", userId)
    .in("role", roleCandidates)
    .limit(1)
    .maybeSingle();
  return res.data?.clinic_id ?? null;
}

export async function fetchProfileById(userId: string) {
  const cacheKey = getCacheKey("profiles", userId);
  const cached = readCache(cacheKey);
  if (cached) return { data: cached, error: null } as any;
  const res = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  if (!res.error && res.data) writeCache(cacheKey, res.data);
  return res;
}

export async function fetchProfileForEditor(userId: string) {
  return supabase.from("profiles").select(PROFILE_EDITOR_COLUMNS).eq("id", userId).maybeSingle();
}

export async function fetchProfileNameById(userId: string) {
  return supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
}

export async function fetchProfileSrContactFields(userId: string) {
  return supabase
    .from("profiles")
    .select("name,sr_specialty,sr_for_specialty,email,mobile,phone_work,address,postal_code,city,personal_number")
    .eq("id", userId)
    .maybeSingle();
}

export async function fetchProfileRoleById(userId: string) {
  return supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
}

/** Minimal profil för inloggningsredirect (robust mot schema-drift i övriga fält). */
export async function fetchProfileRedirectInfoById(userId: string) {
  return supabase.from("profiles").select("id,name,role").eq("id", userId).maybeSingle();
}

export async function getCurrentUserRole(): Promise<string | null> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;
  const res = await fetchProfileRoleById(userId);
  if (res.error) return null;
  return String((res.data as any)?.role || "") || null;
}

export async function upsertProfile(userId: string, updates: Record<string, unknown>) {
  invalidateCache("profiles", userId);
  return supabase
    .from("profiles")
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
    .select(PROFILE_COLUMNS)
    .single();
}

/** Full profil-upsert som i UI (payload med id + snake_case-fält). */
export async function upsertProfilePayload(payload: Record<string, unknown>) {
  const userId = String(payload.id || "");
  if (!userId) {
    return { data: null, error: { message: "Saknar profil-id" } } as any;
  }
  const { id: _omitId, ...rest } = payload;
  invalidateCache("profiles", userId);
  return supabase
    .from("profiles")
    .upsert({ id: userId, ...rest, updated_at: new Date().toISOString() })
    .select(PROFILE_EDITOR_COLUMNS)
    .single();
}

export async function updateProfileSnakeCase(userId: string, patch: Record<string, unknown>) {
  invalidateCache("profiles", userId);
  return supabase.from("profiles").update(patch).eq("id", userId);
}

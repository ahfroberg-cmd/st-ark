import { supabase } from "@/lib/supabase";
import {
  ACHIEVEMENT_COLUMNS,
  ACHIEVEMENT_COLUMNS_FALLBACK,
  IUP_SETTINGS_COLUMNS,
} from "./starkRepository.columns";
import { getCacheKey, invalidateCache, readCache, writeCache } from "./starkRepository.cache";

export async function insertAchievementRows(rows: Record<string, unknown>[]) {
  if (!rows.length) return { data: null, error: null } as any;
  const uids = [...new Set(rows.map((r) => String(r.user_id || "")).filter(Boolean))];
  uids.forEach((uid) => invalidateCache("achievements", uid));
  return supabase.from("achievements").insert(rows);
}

export async function listAchievementsByUserId(userId: string) {
  const cacheKey = getCacheKey("achievements", userId);
  const cached = readCache(cacheKey);
  if (cached) return { data: cached, error: null } as any;
  let res: any = await supabase
    .from("achievements")
    .select(ACHIEVEMENT_COLUMNS)
    .eq("user_id", userId)
    .order("achieved_date", { ascending: true });
  if (res.error) {
    res = await supabase
      .from("achievements")
      .select(ACHIEVEMENT_COLUMNS_FALLBACK)
      .eq("user_id", userId)
      .order("achieved_date", { ascending: true });
  }
  if (!res.error && res.data) writeCache(cacheKey, res.data);
  return res;
}

export async function saveAchievementForUser(userId: string, achievement: Record<string, unknown>) {
  invalidateCache("achievements", userId);
  if (achievement.id) {
    return supabase
      .from("achievements")
      .update({ ...achievement, updated_at: new Date().toISOString() })
      .eq("id", achievement.id)
      .eq("user_id", userId)
      .select(ACHIEVEMENT_COLUMNS)
      .single();
  }
  return supabase
    .from("achievements")
    .insert({ user_id: userId, ...achievement })
    .select(ACHIEVEMENT_COLUMNS)
    .single();
}

export async function deleteAchievementForUser(userId: string, id: string) {
  invalidateCache("achievements", userId);
  return supabase.from("achievements").delete().eq("id", id).eq("user_id", userId);
}

export async function deleteAchievementsByUserAndPlacement(userId: string, placementId: string) {
  invalidateCache("achievements", userId);
  return supabase.from("achievements").delete().eq("user_id", userId).eq("placement_id", placementId);
}

export async function deleteAchievementsByUserAndCourse(userId: string, courseId: string) {
  invalidateCache("achievements", userId);
  return supabase.from("achievements").delete().eq("user_id", userId).eq("course_id", courseId);
}

export async function getIupInstrumentsForUser(userId: string) {
  return supabase.from("iup_settings").select("instruments").eq("user_id", userId).maybeSingle();
}

export async function fetchIupMeetingsByUserId(userId: string) {
  return supabase.from("iup_settings").select("meetings").eq("user_id", userId).maybeSingle();
}

export async function fetchIupSettingsIdAndMeetingsByUserId(userId: string) {
  return supabase.from("iup_settings").select("id,meetings").eq("user_id", userId).maybeSingle();
}

export async function updateIupSettingsMeetingsByRowId(rowId: string, meetings: unknown) {
  return supabase.from("iup_settings").update({ meetings }).eq("id", rowId);
}

export async function insertIupSettingsRow(row: Record<string, unknown>) {
  return supabase.from("iup_settings").insert(row);
}

export async function fetchIupDirectorMeetingsOnly(userId: string) {
  return supabase.from("iup_settings").select("director_meetings").eq("user_id", userId).maybeSingle();
}

export async function fetchIupAssessmentsOnly(userId: string) {
  return supabase.from("iup_settings").select("assessments").eq("user_id", userId).maybeSingle();
}

export async function upsertIupSettingsOnUserId(row: Record<string, unknown>) {
  return supabase.from("iup_settings").upsert(row, { onConflict: "user_id" });
}

export async function fetchIupSettingsRowByUserId(userId: string) {
  return supabase.from("iup_settings").select(IUP_SETTINGS_COLUMNS).eq("user_id", userId).maybeSingle();
}

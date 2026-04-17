import { supabase } from "@/lib/supabase";
import { COURSE_COLUMNS, PLACEMENT_COLUMNS } from "./starkRepository.columns";
import { getCacheKey, invalidateCache, readCache, writeCache } from "./starkRepository.cache";

export async function listPlacementsByUserId(userId: string) {
  const cacheKey = getCacheKey("placements", userId);
  const cached = readCache(cacheKey);
  if (cached) return { data: cached, error: null } as any;
  const res = await supabase
    .from("placements")
    .select(PLACEMENT_COLUMNS)
    .eq("user_id", userId)
    .order("start_date", { ascending: true });
  if (!res.error && res.data) writeCache(cacheKey, res.data);
  return res;
}

export async function savePlacementForUser(userId: string, placement: Record<string, unknown>) {
  invalidateCache("placements", userId);
  if (placement.id) {
    return supabase
      .from("placements")
      .update({ ...placement, updated_at: new Date().toISOString() })
      .eq("id", placement.id)
      .eq("user_id", userId)
      .select(PLACEMENT_COLUMNS)
      .single();
  }
  return supabase
    .from("placements")
    .insert({ user_id: userId, ...placement })
    .select(PLACEMENT_COLUMNS)
    .single();
}

export async function deletePlacementForUser(userId: string, id: string) {
  invalidateCache("placements", userId);
  return supabase.from("placements").delete().eq("id", id).eq("user_id", userId);
}

export async function listCoursesByUserId(userId: string) {
  const cacheKey = getCacheKey("courses", userId);
  const cached = readCache(cacheKey);
  if (cached) return { data: cached, error: null } as any;
  const res = await supabase
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("user_id", userId)
    .order("start_date", { ascending: true });
  if (!res.error && res.data) writeCache(cacheKey, res.data);
  return res;
}

export async function saveCourseForUser(userId: string, course: Record<string, unknown>) {
  invalidateCache("courses", userId);
  if (course.id) {
    return supabase
      .from("courses")
      .update({ ...course, updated_at: new Date().toISOString() })
      .eq("id", course.id)
      .eq("user_id", userId)
      .select(COURSE_COLUMNS)
      .single();
  }
  return supabase
    .from("courses")
    .insert({ user_id: userId, ...course })
    .select(COURSE_COLUMNS)
    .single();
}

export async function deleteCourseForUser(userId: string, id: string) {
  invalidateCache("courses", userId);
  return supabase.from("courses").delete().eq("id", id).eq("user_id", userId);
}

/** Insert med fördefinierat id (t.ex. intygsskanning). */
export async function insertCourseRowForUser(userId: string, row: Record<string, unknown>) {
  invalidateCache("courses", userId);
  const { user_id: _drop, ...rest } = row;
  return supabase.from("courses").insert({ user_id: userId, ...rest });
}

export async function insertPlacementRowForUser(userId: string, row: Record<string, unknown>) {
  invalidateCache("placements", userId);
  const { user_id: _drop, ...rest } = row;
  return supabase.from("placements").insert({ user_id: userId, ...rest });
}

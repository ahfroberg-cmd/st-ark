import { supabase } from "@/lib/supabase";
import { invalidateCache } from "./starkRepository.cache";

export async function deletePlacementsForUserByIds(userId: string, placementIds: string[]) {
  if (!placementIds.length) return { error: null } as any;
  invalidateCache("placements", userId);
  return supabase.from("placements").delete().in("id", placementIds).eq("user_id", userId);
}

export async function deleteCoursesForUserByIds(userId: string, courseIds: string[]) {
  if (!courseIds.length) return { error: null } as any;
  invalidateCache("courses", userId);
  return supabase.from("courses").delete().in("id", courseIds).eq("user_id", userId);
}

export async function fetchClinicNameById(clinicId: string) {
  return supabase.from("clinics").select("name").eq("id", clinicId).maybeSingle();
}

export async function getClinicFormRow(clinicId: string) {
  const withHospital = await supabase
    .from("clinics")
    .select("id,name,hospital_id,st_chief,verksamhetschef,org_home,hospitals(name,region,facility_type)")
    .eq("id", clinicId)
    .maybeSingle();
  if (!withHospital.error) return withHospital;
  if ((withHospital.error as { code?: string }).code === "PGRST200") {
    return supabase
      .from("clinics")
      .select("id,name,hospital_id,st_chief,verksamhetschef,org_home,hospitals(name)")
      .eq("id", clinicId)
      .maybeSingle();
  }
  return withHospital;
}

export async function updateClinicChiefFields(
  clinicId: string,
  stChief: string | null,
  verksamhetschef: string | null,
  orgHome: string | null
) {
  const payloadBase = { st_chief: stChief, verksamhetschef: verksamhetschef } as Record<string, unknown>;
  const payloadWithOrgHome = { ...payloadBase, org_home: orgHome } as Record<string, unknown>;
  let res = await supabase.from("clinics").update(payloadWithOrgHome).eq("id", clinicId);
  if (res.error && String(res.error.message || "").includes("org_home")) {
    res = await supabase.from("clinics").update(payloadBase).eq("id", clinicId);
  }
  return res;
}

export async function getClinicChiefVerificationRow(clinicId: string) {
  return supabase
    .from("clinics")
    .select("st_chief,verksamhetschef,org_home")
    .eq("id", clinicId)
    .maybeSingle();
}

export async function listPlacementsForTemplateScanByUserIds(userIds: string[]) {
  if (!userIds.length) return { data: [], error: null } as any;
  return supabase
    .from("placements")
    .select("id,user_id,clinic,title,start_date,end_date")
    .in("user_id", userIds);
}

export async function listCoursesForTemplateScanByUserIds(userIds: string[]) {
  if (!userIds.length) return { data: [], error: null } as any;
  return supabase
    .from("courses")
    .select("id,user_id,title,kind,start_date,end_date,certificate_date")
    .in("user_id", userIds);
}

export async function clearPlacementLabelsByIds(placementIds: string[]) {
  if (!placementIds.length) return { error: null } as any;
  return supabase
    .from("placements")
    .update({ clinic: "Välj aktivitet", title: "Välj aktivitet" })
    .in("id", placementIds);
}

export async function renamePlacementsClinicTitleByIds(placementIds: string[], newTitle: string) {
  if (!placementIds.length) return { error: null } as any;
  return supabase
    .from("placements")
    .update({ clinic: newTitle, title: newTitle })
    .in("id", placementIds);
}

export async function resetCoursesTitleByIds(courseIds: string[]) {
  if (!courseIds.length) return { error: null } as any;
  return supabase.from("courses").update({ title: "Välj aktivitet" }).in("id", courseIds);
}

export async function renameCoursesTitleByIds(courseIds: string[], newTitle: string) {
  if (!courseIds.length) return { error: null } as any;
  return supabase.from("courses").update({ title: newTitle }).in("id", courseIds);
}

export async function insertActivityTemplateChangeNotifications(rows: Record<string, unknown>[]) {
  if (!rows.length) return { data: null, error: null } as any;
  return supabase.from("activity_template_change_notifications").insert(rows as any);
}

export async function listActivityDocumentsWithPathForUser(userId: string) {
  return supabase
    .from("activity_documents")
    .select("id,title,file_path,mime_type,size_bytes,created_at,activity_kind,activity_id")
    .eq("user_id", userId)
    .not("file_path", "is", null)
    .order("created_at", { ascending: false });
}

export async function listPlacementsBriefForDocumentsPicker(userId: string) {
  return supabase
    .from("placements")
    .select("id,type,clinic,title,start_date,end_date")
    .eq("user_id", userId);
}

export async function listCoursesBriefForDocumentsPicker(userId: string) {
  return supabase
    .from("courses")
    .select("id,title,course_title,start_date,end_date,certificate_date")
    .eq("user_id", userId);
}

export async function listPlacementsColleagueDescriptionsForUserIds(userIds: string[]) {
  if (!userIds.length) return { data: [], error: null } as any;
  return supabase
    .from("placements")
    .select("user_id,clinic,title,note,start_date,end_date")
    .in("user_id", userIds);
}

export async function listCoursesColleagueDescriptionsForUserIds(userIds: string[]) {
  if (!userIds.length) return { data: [], error: null } as any;
  return supabase
    .from("courses")
    .select("user_id,title,course_title,note,start_date,end_date")
    .in("user_id", userIds);
}

export async function updateActivityDocumentLink(
  documentId: string,
  userId: string,
  patch: { activity_kind: string; activity_id: string }
) {
  return supabase.from("activity_documents").update(patch).eq("id", documentId).eq("user_id", userId);
}

export async function insertActivityDocumentRow(row: Record<string, unknown>) {
  return supabase.from("activity_documents").insert(row);
}

export async function listActivityDocumentsForUser(userId: string, columns: string) {
  return supabase
    .from("activity_documents")
    .select(columns)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

export async function insertTimelineVersionRow(row: Record<string, unknown>) {
  return supabase.from("timeline_versions").insert(row);
}

export async function listCourseTitlesByUserIdForSuggest(userId: string) {
  return supabase
    .from("courses")
    .select("id,title,course_title")
    .eq("user_id", userId)
    .order("title");
}

export async function listPlacementsForSuggestByUserId(userId: string) {
  return supabase
    .from("placements")
    .select("id,clinic,title,start_date,end_date")
    .eq("user_id", userId);
}

export async function listRecentTimelineVersionsForUser(userId: string, limit = 10) {
  return supabase
    .from("timeline_versions")
    .select("id,user_id,created_at,version_data")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

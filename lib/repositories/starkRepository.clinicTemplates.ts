import { supabase } from "@/lib/supabase";
import {
  CLINIC_ACTIVITY_TEMPLATE_COLUMNS,
  CLINIC_ACTIVITY_TEMPLATE_COLUMNS_FALLBACK,
} from "./starkRepository.columns";

export async function listClinicActivityTemplatesByClinicId(clinicId: string) {
  let res: any = await supabase
    .from("clinic_activity_templates")
    .select(CLINIC_ACTIVITY_TEMPLATE_COLUMNS)
    .eq("clinic_id", clinicId)
    .order("type")
    .order("title");
  if (res.error && String(res.error.message || "").includes("track_completions")) {
    res = await supabase
      .from("clinic_activity_templates")
      .select(CLINIC_ACTIVITY_TEMPLATE_COLUMNS_FALLBACK)
      .eq("clinic_id", clinicId)
      .order("type")
      .order("title");
  }
  return res;
}

export async function listActiveClinicActivityTemplatesByClinicId(clinicId: string) {
  let res: any = await supabase
    .from("clinic_activity_templates")
    .select(CLINIC_ACTIVITY_TEMPLATE_COLUMNS)
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .order("title");
  if (res.error && String(res.error.message || "").includes("track_completions")) {
    res = await supabase
      .from("clinic_activity_templates")
      .select(CLINIC_ACTIVITY_TEMPLATE_COLUMNS_FALLBACK)
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("title");
  }
  return res;
}

export async function fetchClinicActivityTemplateSuggestedRowsByTitle(clinicId: string, title: string) {
  return supabase
    .from("clinic_activity_templates")
    .select("suggested_rows")
    .eq("clinic_id", clinicId)
    .eq("title", title)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
}

export async function deleteClinicMetisTemplatesByClinicId(clinicId: string) {
  return supabase
    .from("clinic_activity_templates")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("is_metis", true);
}

export async function insertClinicActivityTemplates(rows: Record<string, unknown>[]) {
  return supabase
    .from("clinic_activity_templates")
    .insert(rows);
}

function isTrackCompletionsColumnMissing(error: any): boolean {
  const blob = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
    error?.error_description,
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" ");
  return blob.includes("track_completions") || blob.includes("pgrst204");
}

function stripTrackCompletionsField(payload: Record<string, unknown>): Record<string, unknown> {
  const { track_completions, ...rest } = payload;
  return rest;
}

export async function saveClinicActivityTemplate(
  payload: Record<string, unknown>,
  existingId?: string
): Promise<{ error: any; usedTrackFallback: boolean }> {
  if (existingId) {
    let { error } = await supabase.from("clinic_activity_templates").update(payload).eq("id", existingId);
    if (error && isTrackCompletionsColumnMissing(error)) {
      ({ error } = await supabase
        .from("clinic_activity_templates")
        .update(stripTrackCompletionsField(payload))
        .eq("id", existingId));
      return { error, usedTrackFallback: !error };
    }
    return { error, usedTrackFallback: false };
  }
  let { error } = await supabase.from("clinic_activity_templates").insert(payload);
  if (error && isTrackCompletionsColumnMissing(error)) {
    ({ error } = await supabase
      .from("clinic_activity_templates")
      .insert(stripTrackCompletionsField(payload)));
    return { error, usedTrackFallback: !error };
  }
  return { error, usedTrackFallback: false };
}

export async function updateClinicActivityTemplateById(
  templateId: string,
  updates: Record<string, unknown>
) {
  return supabase
    .from("clinic_activity_templates")
    .update(updates)
    .eq("id", templateId);
}

export async function deleteClinicActivityTemplateById(templateId: string) {
  return supabase
    .from("clinic_activity_templates")
    .delete()
    .eq("id", templateId);
}

export async function getClinicActivityTemplateById(templateId: string) {
  return supabase
    .from("clinic_activity_templates")
    .select("suggested_rows")
    .eq("id", templateId)
    .maybeSingle();
}

export async function saveClinicActivityTemplateConfig(
  clinicId: string,
  title: string,
  payload: Record<string, unknown>
) {
  const existingRes = await supabase
    .from("clinic_activity_templates")
    .select("id")
    .eq("clinic_id", clinicId)
    .eq("title", title)
    .limit(1);
  if (existingRes.error) return { data: null, error: existingRes.error };
  const existing = Array.isArray(existingRes.data) ? existingRes.data[0] : null;
  if (existing?.id) {
    const updatePayload = { ...payload, updated_at: new Date().toISOString() };
    let updateRes = await supabase
      .from("clinic_activity_templates")
      .update(updatePayload)
      .eq("id", existing.id);
    if (updateRes.error && isTrackCompletionsColumnMissing(updateRes.error)) {
      updateRes = await supabase
        .from("clinic_activity_templates")
        .update(stripTrackCompletionsField(updatePayload))
        .eq("id", existing.id);
    }
    return updateRes;
  }
  let insertRes = await supabase.from("clinic_activity_templates").insert(payload);
  if (insertRes.error && isTrackCompletionsColumnMissing(insertRes.error)) {
    insertRes = await supabase
      .from("clinic_activity_templates")
      .insert(stripTrackCompletionsField(payload));
  }
  return insertRes;
}

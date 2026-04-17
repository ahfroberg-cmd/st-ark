// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

async function getAuthUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Exportera ALL persondata som JSON (GDPR rätt till dataportabilitet).
 * Returnerar en Blob redo att laddas ned.
 */
export async function exportPersonalData(): Promise<Blob> {
  
  const userId = await getAuthUserId();

  let profile: any = null;
  let placements: any[] = [];
  let courses: any[] = [];
  let achievements: any[] = [];

  if (userId) {
    try {
      const [profRes, plRes, crRes, achRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("placements").select("*").eq("user_id", userId),
        supabase.from("courses").select("*").eq("user_id", userId),
        supabase.from("achievements").select("*").eq("user_id", userId),
      ]);
      if (!profRes.error && profRes.data) profile = profRes.data;
      if (!plRes.error && plRes.data) placements = plRes.data;
      if (!crRes.error && crRes.data) courses = crRes.data;
      if (!achRes.error && achRes.data) achievements = achRes.data;
    } catch {}
  }

  if (!userId || (!profile && placements.length === 0)) {
    const [lp, lpl, lc, la] = await Promise.all([
      null,
      [],
      [],
      [],
    ]);
    profile = lp ?? null;
    placements = lpl;
    courses = lc;
    achievements = la;
  }

  let iupSettings: any = null;
  let milestonePlans: any[] = [];
  let appDrafts: any[] = [];

  if (userId) {
    try {
      const [iupRes, mpRes, adRes] = await Promise.all([
        supabase.from("iup_settings").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("milestone_plans").select("*").eq("user_id", userId),
        supabase.from("app_drafts").select("*").eq("user_id", userId),
      ]);
      if (!iupRes.error && iupRes.data) iupSettings = iupRes.data;
      if (!mpRes.error && mpRes.data) milestonePlans = mpRes.data;
      if (!adRes.error && adRes.data) appDrafts = adRes.data;
    } catch { /* ignore */ }
  }

  const bundle = {
    exportedAt: new Date().toISOString(),
    purpose: "GDPR – registerutdrag / dataportabilitet",
    profile: profile ?? null,
    placements,
    courses,
    achievements,
    iupSettings,
    milestonePlans,
    appDrafts,
  };

  await logAudit("gdpr_export", "all", "GDPR-export av all persondata");

  return new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
}

/**
 * Radera ALL persondata (GDPR rätt till radering / "rätten att bli glömd").
 * Rensar samtliga tabeller utom auditLog (som behålls av regulatoriska skäl).
 */
export async function deleteAllPersonalData(): Promise<void> {
  

  // Logga raderingen FÖRE vi raderar (annars förlorar vi kontexten)
  await logAudit("gdpr_delete", "all", "Användaren begärde radering av all persondata (GDPR)");

  // Delete from Supabase
  const userId = await getAuthUserId();
  if (userId) {
    try {
      await Promise.all([
        supabase.from("achievements").delete().eq("user_id", userId),
        supabase.from("placements").delete().eq("user_id", userId),
        supabase.from("courses").delete().eq("user_id", userId),
        supabase.from("iup_settings").delete().eq("user_id", userId),
        supabase.from("milestone_plans").delete().eq("user_id", userId),
        supabase.from("app_drafts").delete().eq("user_id", userId),
        supabase.from("profiles").delete().eq("user_id", userId),
      ]);
    } catch {}
  }
}

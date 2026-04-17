// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

import { supabase } from "@/lib/supabase";
import type { Profile, Placement, Course, Achievement } from "@/lib/types";
import { logAudit } from "@/lib/audit";

async function getAuthUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export type ExportBundle = {
  schemaVersion: number;
  app: { name: string; version: string };
  exportedAt: string; // ISO
  profile: Profile | null;
  placements: Placement[];
  courses: Course[];
  achievements: Achievement[];
  timeline?: any[];
  iupMilestonePlans?: any[];
  specialistApplication?: any[];
};

const CURRENT_SCHEMA_VERSION = 2;

function iso10(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const dd = String(v.getDate()).padStart(2, "0");
    return `${v.getFullYear()}-${mm}-${dd}`;
  }
  if (typeof v === "number") {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }
  return String(v).slice(0, 10);
}

function normalizePlacementDates(p: any): any {
  const start =
    iso10(p?.startDate) ||
    iso10(p?.startISO) ||
    iso10(p?.start) ||
    iso10(p?.period?.startISO) ||
    iso10(p?.period?.startDate) ||
    "";
  const end =
    iso10(p?.endDate) ||
    iso10(p?.endISO) ||
    iso10(p?.end) ||
    iso10(p?.period?.endISO) ||
    iso10(p?.period?.endDate) ||
    "";

  const out: any = { ...p };
  if (start) out.startDate = start;
  if (end) out.endDate = end;
  return out;
}

function normalizeProfileDates(p: any): any {
  if (!p || typeof p !== "object") return p;
  const out: any = { ...p };

  out.stStartDate = iso10(out.stStartDate) || out.stStartDate || "";
  out.btStartDate = iso10(out.btStartDate) || out.btStartDate || "";
  out.stEndDate = iso10(out.stEndDate) || out.stEndDate || "";
  out.stEndISO = iso10(out.stEndISO) || out.stEndISO || "";
  out.btEndDate = iso10(out.btEndDate) || out.btEndDate || "";

  out.medDegreeDate = iso10(out.medDegreeDate) || out.medDegreeDate || "";
  out.licenseDate = iso10(out.licenseDate) || out.licenseDate || "";

  if (Array.isArray(out.foreignLicenses)) {
    out.foreignLicenses = out.foreignLicenses.map((r: any) => {
      const row = r && typeof r === "object" ? { ...r } : { country: "", date: "" };
      row.date = iso10(row.date) || row.date || "";
      return row;
    });
  }

  if (Array.isArray(out.priorSpecialties)) {
    out.priorSpecialties = out.priorSpecialties.map((r: any) => {
      const row = r && typeof r === "object" ? { ...r } : { speciality: "", country: "", date: "" };
      row.date = iso10(row.date) || row.date || "";
      return row;
    });
  }

  return out;
}

export async function exportAll(): Promise<ExportBundle> {
  
  const userId = await getAuthUserId();

  let profile: Profile | undefined;
  let placements: Placement[] = [];
  let courses: Course[] = [];
  let achievements: Achievement[] = [];

  if (userId) {
    try {
      const [profRes, plRes, crRes, achRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("placements").select("*").eq("user_id", userId),
        supabase.from("courses").select("*").eq("user_id", userId),
        supabase.from("achievements").select("*").eq("user_id", userId),
      ]);
      if (!profRes.error && profRes.data) {
        const d = profRes.data as any;
        profile = {
          id: "default",
          name: d.name || "",
          specialty: d.specialty,
          speciality: d.specialty,
          goalsVersion: d.goals_version === "2021" ? "st_2021" : d.goals_version,
          stStartDate: d.st_start_date,
          startDate: d.st_start_date,
          btStartDate: d.bt_start_date,
          btEndDate: d.bt_end_date,
          homeClinic: d.home_clinic,
        } as any;
      }
      if (!plRes.error && plRes.data) placements = plRes.data.map((p: any) => ({ id: p.id, type: p.type, clinic: p.clinic, title: p.title, startDate: p.start_date, endDate: p.end_date, attendance: p.attendance, supervisor: p.supervisor, note: p.note, showOnTimeline: p.show_on_timeline !== false } as any));
      if (!crRes.error && crRes.data) courses = crRes.data.map((c: any) => ({ id: c.id, title: c.title, kind: c.kind, city: c.city, courseLeaderName: c.course_leader_name, startDate: c.start_date, endDate: c.end_date, certificateDate: c.certificate_date, note: c.note, courseTitle: c.course_title, showOnTimeline: c.show_on_timeline !== false, showAsInterval: !!c.show_as_interval } as any));
      if (!achRes.error && achRes.data) achievements = achRes.data.map((a: any) => ({ id: a.id, placementId: a.placement_id || undefined, courseId: a.course_id || undefined, milestoneId: a.milestone_id || "", date: a.date || "" } as any));
    } catch {
      // fallback below
    }
  }

  if (!userId || (!profile && placements.length === 0)) {
    const [localProfile, localPlacements, localCourses, localAchievements] = await Promise.all([
      null,
      [],
      [],
      [],
    ]);
    profile = localProfile ?? undefined;
    placements = localPlacements;
    courses = localCourses;
    achievements = localAchievements;
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

  const profileOut = profile ? (normalizeProfileDates(profile) as Profile) : null;
  const placementsOut = (placements as any[]).map((p) => normalizePlacementDates(p)) as Placement[];

  const bundle = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    app: { name: "ST-ARK", version: "1.0.0" },
    exportedAt: new Date().toISOString(),
    profile: profileOut,
    placements: placementsOut,
    courses,
    achievements,
    iupSettings,
    milestonePlans,
    appDrafts,
  };

  void logAudit("export", "all", `Backup-export (${placementsOut.length} placeringar, ${courses.length} kurser)`);
  return bundle;
}

/** Ladda ner JSON som fil (ren klientfunktion) */
export async function downloadJson(bundle: ExportBundle, filename = "st-intyg-backup.json") {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  // Försök använda File System Access API om det stöds (låter användaren välja var filen ska sparas)
  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'JSON-filer',
          accept: { 'application/json': ['.json'] },
        }],
      });
      
      const writable = await fileHandle.createWritable();
      // Konvertera blob till ArrayBuffer för att skriva till filen
      const buffer = await blob.arrayBuffer();
      await writable.write(buffer);
      await writable.close();
      return;
    } catch (err: any) {
      // Användaren avbröt dialogrutan - detta är inte ett fel, avsluta tyst
      if (err.name === 'AbortError' || err.name === 'NotAllowedError') {
        return;
      }
      // För andra fel, logga och fallback till den gamla metoden
      console.warn('File System Access API misslyckades, använder fallback:', err);
    }
  }

  // Fallback: använd den gamla metoden med automatisk nedladdning
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Läs JSON från <input type="file"> */
export async function readJsonFromFile(file: File): Promise<ExportBundle> {
  const text = await file.text();
  return JSON.parse(text) as ExportBundle;
}

/** Import med replace/merge och enkel migrering */
export async function importAll(bundle: ExportBundle, mode: "replace" | "merge" = "replace") {
  if (!bundle || typeof bundle !== "object") throw new Error("Ogiltig backup.");
  const migrated = migrateIfNeeded(bundle);
  if (mode === "replace") {
    await replaceAll(migrated);
  } else {
    await mergeAll(migrated);
  }

  // Mirror to Supabase
  const userId = await getAuthUserId();
  if (userId) {
    try {
      await mirrorBundleToSupabase(migrated, userId, mode);
    } catch {}
  }

  void logAudit(
    "import",
    "all",
    `Backup-import (${mode}): ${migrated.placements?.length ?? 0} placeringar, ${migrated.courses?.length ?? 0} kurser`
  );
}

async function mirrorBundleToSupabase(bundle: ExportBundle, userId: string, mode: string) {
  if (mode === "replace") {
    await Promise.all([
      supabase.from("achievements").delete().eq("user_id", userId),
      supabase.from("placements").delete().eq("user_id", userId),
      supabase.from("courses").delete().eq("user_id", userId),
    ]);
  }

  if (bundle.profile) {
    const p = bundle.profile as any;
    await supabase.from("profiles").upsert({
      id: userId,
      name: p.name || [p.firstName, p.lastName].filter(Boolean).join(" ") || "",
      specialty: p.specialty || p.speciality || "psykiatri",
      goals_version: p.goalsVersion === "st_2021" ? "2021" : p.goalsVersion || "2021",
      st_start_date: p.stStartDate || null,
      bt_start_date: p.btStartDate || null,
      bt_end_date: p.btEndDate || null,
      home_clinic: p.homeClinic || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
  }

  if (bundle.placements?.length) {
    const rows = bundle.placements.map((p: any) => ({
      id: p.id,
      user_id: userId,
      type: p.type || "",
      clinic: p.clinic || "",
      title: p.title || "",
      start_date: p.startDate || null,
      end_date: p.endDate || null,
      attendance: p.attendance ?? 100,
      supervisor: p.supervisor || "",
      note: p.note || "",
      show_on_timeline: p.showOnTimeline !== false,
      updated_at: new Date().toISOString(),
    }));
    await supabase.from("placements").upsert(rows, { onConflict: "id" });
  }

  if (bundle.courses?.length) {
    const rows = bundle.courses.map((c: any) => ({
      id: c.id,
      user_id: userId,
      title: c.title || "",
      kind: c.kind || "Kurs",
      city: c.city || "",
      course_leader_name: c.courseLeaderName || "",
      start_date: c.startDate || null,
      end_date: c.endDate || null,
      certificate_date: c.certificateDate || null,
      note: c.note || "",
      course_title: c.courseTitle || null,
      show_on_timeline: c.showOnTimeline !== false,
      show_as_interval: !!c.showAsInterval,
      updated_at: new Date().toISOString(),
    }));
    await supabase.from("courses").upsert(rows, { onConflict: "id" });
  }

  if (bundle.achievements?.length) {
    const rows = bundle.achievements.map((a: any) => ({
      id: a.id,
      user_id: userId,
      placement_id: a.placementId || null,
      course_id: a.courseId || null,
      milestone_id: a.milestoneId || "",
      date: a.date || "",
    }));
    await supabase.from("achievements").upsert(rows, { onConflict: "id" });
  }
}

/** Rensa DB och skriv in allt från bundle */
async function replaceAll(bundle: ExportBundle) {
  const userId = await getAuthUserId();
  if (!userId) return;

  // Rensa nya tabeller
  await Promise.all([
    supabase.from("iup_settings").delete().eq("user_id", userId),
    supabase.from("milestone_plans").delete().eq("user_id", userId),
    supabase.from("app_drafts").delete().eq("user_id", userId),
  ]);

  // Importera IUP settings
  if ((bundle as any).iupSettings) {
    const iup = (bundle as any).iupSettings;
    await supabase.from("iup_settings").upsert({ ...iup, user_id: userId }, { onConflict: "user_id" });
  }

  // Importera milestone plans
  if ((bundle as any).milestonePlans?.length) {
    const rows = (bundle as any).milestonePlans.map((r: any) => ({ ...r, user_id: userId }));
    await supabase.from("milestone_plans").upsert(rows, { onConflict: "user_id,milestone_id" });
  }

  // Importera app drafts
  if ((bundle as any).appDrafts?.length) {
    const rows = (bundle as any).appDrafts.map((r: any) => ({ ...r, user_id: userId }));
    await supabase.from("app_drafts").upsert(rows, { onConflict: "user_id,draft_key" });
  }
}

/** Slå ihop:
 *  - profile: ersätts helt (id="default")
 *  - placements/courses/achievements: put per id (skapar om den inte finns)
 */
async function mergeAll(bundle: ExportBundle) {
  const userId = await getAuthUserId();
  if (!userId) return;

  // Importera IUP settings (merge = upsert)
  if ((bundle as any).iupSettings) {
    const iup = (bundle as any).iupSettings;
    await supabase.from("iup_settings").upsert({ ...iup, user_id: userId }, { onConflict: "user_id" });
  }

  // Importera milestone plans (merge = upsert per milestone)
  if ((bundle as any).milestonePlans?.length) {
    const rows = (bundle as any).milestonePlans.map((r: any) => ({ ...r, user_id: userId }));
    await supabase.from("milestone_plans").upsert(rows, { onConflict: "user_id,milestone_id" });
  }

  // Importera app drafts (merge = upsert per draft_key)
  if ((bundle as any).appDrafts?.length) {
    const rows = (bundle as any).appDrafts.map((r: any) => ({ ...r, user_id: userId }));
    await supabase.from("app_drafts").upsert(rows, { onConflict: "user_id,draft_key" });
  }
}

/** Migreringstub – bumpa när schemaVersion ändras */
function migrateIfNeeded(src: ExportBundle): ExportBundle {
  // structuredClone finns i moderna miljöer; som fallback kan du använda JSON.parse/stringify
  const out: ExportBundle = typeof structuredClone === "function" ? structuredClone(src) : JSON.parse(JSON.stringify(src));

  if (out.schemaVersion === undefined) out.schemaVersion = 0;

  if (out.schemaVersion < 2) {
    const hasTimeline = Array.isArray((out as any).timeline) && (out as any).timeline.length > 0;
    if (!hasTimeline && Array.isArray(out.placements)) {
      out.placements = (out.placements as any[]).map((p) => {
        const np: any = normalizePlacementDates(p);
        if (np.showOnTimeline === undefined) np.showOnTimeline = true;
        return np;
      }) as Placement[];
    }
  }

  // Exempel: framtida migreringar
  // if (out.schemaVersion < 1) {
  //   // ...transformera data...
  //   out.schemaVersion = 1;
  // }

  // Se till att profile-id alltid är "default"
  if (out.profile && (out.profile as any).id !== "default") {
    out.profile = { ...(out.profile as any), id: "default" } as any;
  }

  if (Array.isArray(out.placements)) {
    out.placements = (out.placements as any[]).map((p) => normalizePlacementDates(p)) as Placement[];
  }

  out.schemaVersion = CURRENT_SCHEMA_VERSION;
  return out;
}

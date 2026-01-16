// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

import { db } from "@/lib/db";
import type { Profile, Placement, Course, Achievement } from "@/lib/types";

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
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
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

export async function exportAll(): Promise<ExportBundle> {
  const anyDb: any = db as any;
  const [profile, placements, courses, achievements, timeline, iupPlans, specApp] =
    await Promise.all([
      db.profile.get("default"),
      db.placements.toArray(),
      db.courses.toArray(),
      db.achievements.toArray(),
      anyDb.timeline?.toArray?.() ?? [],
      anyDb.iupMilestonePlans?.toArray?.() ?? [],
      anyDb.specialistApplication?.toArray?.() ?? [],
    ]);

  const placementsOut = (placements as any[]).map((p) => normalizePlacementDates(p)) as Placement[];

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    app: { name: "ST-ARK", version: "1.0.0" },
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    placements: placementsOut,
    courses,
    achievements,
    timeline,
    iupMilestonePlans: iupPlans,
    specialistApplication: specApp,
  };

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
}

/** Rensa DB och skriv in allt från bundle */
async function replaceAll(bundle: ExportBundle) {
  const anyDb: any = db as any;
  const tables: any[] = [db.profile, db.placements, db.courses, db.achievements];
  if (anyDb.timeline) tables.push(anyDb.timeline);
  if (anyDb.iupMilestonePlans) tables.push(anyDb.iupMilestonePlans);
  if (anyDb.specialistApplication) tables.push(anyDb.specialistApplication);

  await (db as any).transaction("readwrite", ...tables, async () => {
    await Promise.all([
      db.profile.clear(),
      db.placements.clear(),
      db.courses.clear(),
      db.achievements.clear(),
      anyDb.timeline?.clear?.() ?? Promise.resolve(),
      anyDb.iupMilestonePlans?.clear?.() ?? Promise.resolve(),
      anyDb.specialistApplication?.clear?.() ?? Promise.resolve(),
    ]);

    if (bundle.profile) {
      const prof = { ...(bundle.profile as any), id: "default" } as any;
      await db.profile.put(prof);
    }
    if (bundle.placements?.length) await db.placements.bulkPut(bundle.placements);
    if (bundle.courses?.length) await db.courses.bulkPut(bundle.courses);
    if (bundle.achievements?.length) await db.achievements.bulkPut(bundle.achievements);
    if (bundle.timeline?.length) await anyDb.timeline?.bulkPut?.(bundle.timeline);
    if (bundle.iupMilestonePlans?.length)
      await anyDb.iupMilestonePlans?.bulkPut?.(bundle.iupMilestonePlans);
    if (bundle.specialistApplication?.length)
      await anyDb.specialistApplication?.bulkPut?.(bundle.specialistApplication);
  });
}

/** Slå ihop:
 *  - profile: ersätts helt (id="default")
 *  - placements/courses/achievements: put per id (skapar om den inte finns)
 */
async function mergeAll(bundle: ExportBundle) {
  const anyDb: any = db as any;
  const tables: any[] = [db.profile, db.placements, db.courses, db.achievements];
  if (anyDb.timeline) tables.push(anyDb.timeline);
  if (anyDb.iupMilestonePlans) tables.push(anyDb.iupMilestonePlans);
  if (anyDb.specialistApplication) tables.push(anyDb.specialistApplication);

  await (db as any).transaction("readwrite", ...tables, async () => {
    if (bundle.profile) {
      const prof = { ...(bundle.profile as any), id: "default" } as any;
      await db.profile.put(prof);
    }
    for (const p of bundle.placements ?? []) await db.placements.put(p);
    for (const c of bundle.courses ?? []) await db.courses.put(c);
    for (const a of bundle.achievements ?? []) await db.achievements.put(a);
    for (const t of bundle.timeline ?? []) await anyDb.timeline?.put?.(t);
    for (const p of bundle.iupMilestonePlans ?? []) await anyDb.iupMilestonePlans?.put?.(p);
    for (const s of bundle.specialistApplication ?? []) await anyDb.specialistApplication?.put?.(s);
  });
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

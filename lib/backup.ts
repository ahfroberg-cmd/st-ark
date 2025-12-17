// lib/backup.ts
// Export/import av hela databasen (JSON som “source of truth”).
// Stöd för replace/merge + enkel versionsmigrering.

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
};

const CURRENT_SCHEMA_VERSION = 1;

export async function exportAll(): Promise<ExportBundle> {
  const [profile, placements, courses, achievements] = await Promise.all([
    db.profile.get("default"),
    db.placements.toArray(),
    db.courses.toArray(),
    db.achievements.toArray(),
  ]);

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    app: { name: "ST-ARK", version: "1.0.0" },
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    placements,
    courses,
    achievements,
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
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      // Användaren avbröt dialogrutan eller ett fel uppstod
      // Fallback till den gamla metoden
      if (err.name !== 'AbortError') {
        console.warn('File System Access API misslyckades, använder fallback:', err);
      } else {
        // Användaren avbröt, avsluta utan att göra något
        return;
      }
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
  await db.transaction("readwrite", db.profile, db.placements, db.courses, db.achievements, async () => {
    await Promise.all([
      db.profile.clear(),
      db.placements.clear(),
      db.courses.clear(),
      db.achievements.clear(),
    ]);

    if (bundle.profile) {
      const prof: Profile = { ...bundle.profile, id: "default" };
      await db.profile.put(prof);
    }
    if (bundle.placements?.length) await db.placements.bulkPut(bundle.placements);
    if (bundle.courses?.length) await db.courses.bulkPut(bundle.courses);
    if (bundle.achievements?.length) await db.achievements.bulkPut(bundle.achievements);
  });
}

/** Slå ihop:
 *  - profile: ersätts helt (id="default")
 *  - placements/courses/achievements: put per id (skapar om den inte finns)
 */
async function mergeAll(bundle: ExportBundle) {
  await db.transaction("readwrite", db.profile, db.placements, db.courses, db.achievements, async () => {
    if (bundle.profile) {
      const prof: Profile = { ...bundle.profile, id: "default" };
      await db.profile.put(prof);
    }
    for (const p of bundle.placements ?? []) await db.placements.put(p);
    for (const c of bundle.courses ?? []) await db.courses.put(c);
    for (const a of bundle.achievements ?? []) await db.achievements.put(a);
  });
}

/** Migreringstub – bumpa när schemaVersion ändras */
function migrateIfNeeded(src: ExportBundle): ExportBundle {
  // structuredClone finns i moderna miljöer; som fallback kan du använda JSON.parse/stringify
  const out: ExportBundle = typeof structuredClone === "function" ? structuredClone(src) : JSON.parse(JSON.stringify(src));

  if (out.schemaVersion === undefined) out.schemaVersion = 0;

  // Exempel: framtida migreringar
  // if (out.schemaVersion < 1) {
  //   // ...transformera data...
  //   out.schemaVersion = 1;
  // }

  // Se till att profile-id alltid är "default"
  if (out.profile && (out.profile as any).id !== "default") {
    out.profile = { ...out.profile, id: "default" };
  }

  out.schemaVersion = CURRENT_SCHEMA_VERSION;
  return out;
}

// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

/**
 * Exportera ALL persondata som JSON (GDPR rätt till dataportabilitet).
 * Returnerar en Blob redo att laddas ned.
 */
export async function exportPersonalData(): Promise<Blob> {
  const anyDb: any = db as any;

  const [profile, placements, courses, achievements, timeline, iupPlans, specApp, auditEntries] =
    await Promise.all([
      db.profile.get("default"),
      db.placements.toArray(),
      db.courses.toArray(),
      db.achievements.toArray(),
      anyDb.timeline?.toArray?.() ?? [],
      anyDb.iupMilestonePlans?.toArray?.() ?? [],
      anyDb.specialistApplication?.toArray?.() ?? [],
      anyDb.auditLog?.toArray?.() ?? [],
    ]);

  const bundle = {
    exportedAt: new Date().toISOString(),
    purpose: "GDPR – registerutdrag / dataportabilitet",
    profile: profile ?? null,
    placements,
    courses,
    achievements,
    timeline,
    iupMilestonePlans: iupPlans,
    specialistApplication: specApp,
    auditLog: auditEntries,
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
  const anyDb: any = db as any;

  // Logga raderingen FÖRE vi raderar (annars förlorar vi kontexten)
  await logAudit("gdpr_delete", "all", "Användaren begärde radering av all persondata (GDPR)");

  const tables: any[] = [
    db.profile,
    db.placements,
    db.courses,
    db.achievements,
  ];
  if (anyDb.timeline) tables.push(anyDb.timeline);
  if (anyDb.iupMilestonePlans) tables.push(anyDb.iupMilestonePlans);
  if (anyDb.specialistApplication) tables.push(anyDb.specialistApplication);
  if (anyDb.supervisorStudents) tables.push(anyDb.supervisorStudents);

  await (db as any).transaction("readwrite", ...tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
  });
}

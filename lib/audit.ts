// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

import { db } from "@/lib/db";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "export"
  | "import"
  | "login"
  | "logout"
  | "attest"
  | "revoke_attest"
  | "gdpr_export"
  | "gdpr_delete";

export type AuditEntry = {
  id: string;
  timestamp: string; // ISO
  action: AuditAction;
  table: string; // vilken tabell som påverkades (t.ex. "placements", "courses")
  entityId?: string; // id för den entitet som ändrades
  summary: string; // kort beskrivning av ändringen
  details?: string; // JSON-serialiserade detaljer (t.ex. diff)
};

function uid(): string {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

/**
 * Logga en ändring till audit-loggen.
 */
export async function logAudit(
  action: AuditAction,
  table: string,
  summary: string,
  entityId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const entry: AuditEntry = {
      id: uid(),
      timestamp: new Date().toISOString(),
      action,
      table,
      entityId,
      summary,
      details: details ? JSON.stringify(details) : undefined,
    };
    await (db as any).auditLog.add(entry);
  } catch (err) {
    // Audit-loggning ska aldrig krascha appen
    console.warn("[audit] Kunde inte logga:", err);
  }
}

/**
 * Hämta alla audit-poster, sorterade nyast först.
 */
export async function getAuditLog(limit = 500): Promise<AuditEntry[]> {
  try {
    const all: AuditEntry[] = await (db as any).auditLog
      .orderBy("timestamp")
      .reverse()
      .limit(limit)
      .toArray();
    return all;
  } catch {
    return [];
  }
}

/**
 * Radera audit-poster äldre än angivet antal dagar.
 */
export async function pruneAuditLog(olderThanDays = 365): Promise<number> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const cutoffISO = cutoff.toISOString();
    const old = await (db as any).auditLog
      .where("timestamp")
      .below(cutoffISO)
      .primaryKeys();
    await (db as any).auditLog.bulkDelete(old);
    return old.length;
  } catch {
    return 0;
  }
}

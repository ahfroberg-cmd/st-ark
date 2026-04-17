"use client";

import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";

function normalizeStMilestoneCore(
  raw: unknown
): { key: string; as2015: string; as2021: string } | null {
  const base = String(raw ?? "").trim().split(/\s|–|-|:|\u2013/)[0];
  const up = base.toUpperCase().replace(/\s+/g, "");
  const m = up.match(/^ST([ABC])(\d+)$/) || up.match(/^([ABC])(\d+)$/);
  if (!m) return null;
  const letter = m[1].toLowerCase();
  const num = parseInt(m[2], 10);
  if (!Number.isFinite(num) || num <= 0) return null;
  return {
    key: `${letter}${num}`,
    as2015: `${letter}${num}`,
    as2021: `ST${letter}${num}`,
  };
}

export function sanitizeStMilestonesForGoals(
  list: unknown,
  goalsVersionRaw: unknown
): string[] {
  const gv = normalizeGoalsVersion(goalsVersionRaw);
  const arr = Array.isArray(list) ? (list as unknown[]) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    const n = normalizeStMilestoneCore(item);
    if (!n) continue;
    const canonical = gv === "2021" ? n.as2021 : n.as2015;
    const dedupeKey = canonical.toUpperCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(canonical);
  }
  return out;
}

"use client";

export function normalizeGoalsVersion(v: unknown): "2015" | "2021" {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("2015")) return "2015";
  if (s.includes("2021")) return "2021";
  return "2021";
}

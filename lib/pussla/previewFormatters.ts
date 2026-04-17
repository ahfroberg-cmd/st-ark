"use client";

export function getCourseDisplayTitle(c: any): string {
  if (c.title === "Annan kurs" || (c.kind === "Utbildningsmoment" && c.title === "Annan")) {
    return c?.courseTitle?.trim() || (c.kind === "Utbildningsmoment" ? "Utbildningsmoment" : "Kurs");
  }
  return c.title || c?.provider || "Kurs";
}

export function toMilestoneIds(xs: any): string[] {
  return Array.isArray(xs)
    ? xs.map((m: any) => String(m).trim().split(/\s|–|-|:|\u2013/)[0])
    : [];
}

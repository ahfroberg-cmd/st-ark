"use client";

import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";

const METIS_COURSES_VUXEN = [
  "Akutpsykiatri",
  "Psykiatrisk diagnostik",
  "Psykiatrisk juridik",
  "Psykofarmakologi",
  "Suicidologi",
  "Levnadsvanor vid psykisk sjukdom",
  "Beroendelära",
  "Affektiva sjukdomar",
  "BUP för vuxenpsykiatriker",
  "Konsultationspsykiatri och psykosomatik",
  "Neuropsykiatri",
  "Personlighetssyndrom",
  "Psykossjukdomar",
  "Ätstörningar",
  "OCD- och relaterade syndrom",
  "Ångest-, trauma- och stressrelaterade syndrom",
  "Äldrepsykiatri",
  "Kritisk läkemedelsvärdering inom psykofarmakologi",
  "Medicinsk vetenskap",
  "Psykiatrisk neurovetenskap",
  "Psykiatri & samhälle",
  "Rättspsykiatri",
  "Sexualmedicin och könsdysfori",
  "Transkulturell psykiatri",
];

const METIS_COURSES_BUP = [
  "BUP Akutpsykiatri",
  "Grundläggande barn- och ungdomspsykiatrisk bedömning och diagnostik",
  "BUP Suicidologi",
  "BUP Utvecklingspsykologi",
  "BUP Ångest- och tvångssyndrom",
  "BUP Juridik",
  "BUP Substansbrukssyndrom",
  "BUP Psykofarmakologi",
  "BUP Depression",
  "BUP Neuropsykiatri",
  "BUP Pediatrik",
  "BUP Normbrytande beteende",
  "BUP Bipolärt syndrom och psykos",
  "BUP Trauma och migration",
  "Ätstörningar",
];

const METIS_COURSE_GOALS_VUXEN: Record<string, string[]> = {
  Akutpsykiatri: ["c2", "c3", "b1", "a2"],
  "Psykiatrisk diagnostik": ["c1", "c2", "b1", "a2"],
  "Psykiatrisk juridik": ["c10", "c13", "b1", "a2", "a6"],
  Psykofarmakologi: ["c4"],
  Suicidologi: ["c3", "b1", "a2"],
  "Levnadsvanor vid psykisk sjukdom": ["b1", "b2", "a2"],
  Beroendelära: ["c6", "c13", "b1", "b2", "b3", "a2"],
  "Affektiva sjukdomar": ["c1", "c4", "b1", "a2"],
  "BUP för vuxenpsykiatriker": ["c8", "b1", "b3", "b4"],
  "Konsultationspsykiatri och psykosomatik": ["c10", "b1", "a2"],
  Neuropsykiatri: ["c2", "c8", "c11", "b1"],
  Personlighetssyndrom: ["c1", "b1", "a2"],
  Psykossjukdomar: ["c1", "c4", "b1", "b2", "a2"],
  Ätstörningar: ["c2", "c8", "b1", "b3", "a2"],
  "OCD- och relaterade syndrom": ["c1", "b1", "a2"],
  "Ångest-, trauma- och stressrelaterade syndrom": ["c1", "b1", "a2"],
  Äldrepsykiatri: ["c7", "b1", "b3", "a2"],
  "Kritisk läkemedelsvärdering inom psykofarmakologi": ["c4", "b3", "a5"],
  "Medicinsk vetenskap": ["b1", "a2"],
  "Psykiatrisk neurovetenskap": ["c1"],
  "Psykiatri & samhälle": ["c13", "b1", "b2", "b4", "a2"],
  Rättspsykiatri: ["c10", "c13", "b1", "a2", "a6"],
  "Sexualmedicin och könsdysfori": ["c2", "b1", "a2"],
  "Transkulturell psykiatri": ["c2", "c13", "b1", "a2"],
};

const METIS_COURSE_GOALS_BUP: Record<string, string[]> = {
  "BUP Akutpsykiatri": ["c1", "c5", "c8", "c9", "a2", "a6", "b1", "b2", "b3"],
  "Grundläggande barn- och ungdomspsykiatrisk bedömning och diagnostik": ["c3", "c4", "a2", "b1"],
  "BUP Suicidologi": ["c1", "c3", "c8", "a2", "a6", "b1", "b2"],
  "BUP Utvecklingspsykologi": ["c4", "a2", "b1"],
  "BUP Ångest- och tvångssyndrom": ["c3", "c5", "a2", "b2", "b3"],
  "BUP Juridik": ["c8", "a2", "a6"],
  "BUP Substansbrukssyndrom": ["c1", "c3", "c5", "c9", "a2", "b1", "b2"],
  "BUP Psykofarmakologi": ["c3", "c5", "a2", "b3"],
  "BUP Depression": ["c1", "c3", "c5", "c8", "a2", "a6", "b1", "b2", "b3"],
  "BUP Neuropsykiatri": ["c3", "c4", "c5", "a2", "b1", "b2", "b3"],
  "BUP Pediatrik": ["c4", "c11", "a2", "b1", "b2"],
  "BUP Normbrytande beteende": ["c3", "c4", "c8", "c9", "c12", "a2", "a6", "b2"],
  "BUP Bipolärt syndrom och psykos": ["c1", "c3", "c5", "c8", "a2", "a6", "b1", "b2", "b3"],
  "BUP Trauma och migration": ["c3", "c5", "c8", "a2", "b1", "b2"],
  Ätstörningar: ["c3", "c10", "b1", "b3", "a2"],
};

export function getMetisCoursesForSpecialty(specialty: string | null | undefined): string[] {
  const spec = String(specialty || "").toLowerCase().trim();
  if (spec.includes("barn") || spec.includes("ungdom") || spec.includes("bup")) {
    return METIS_COURSES_BUP;
  }
  return METIS_COURSES_VUXEN;
}

export function usesMetisCourses(specialty: string | null | undefined): boolean {
  const spec = String(specialty || "").toLowerCase().trim();
  return spec.includes("psykiatri") && !spec.includes("äldrepsykiatri");
}

export function getMetisCourseGoals(specialty: string | null | undefined): Record<string, string[]> {
  const spec = String(specialty || "").toLowerCase().trim();
  if (spec.includes("barn") || spec.includes("ungdom") || spec.includes("bup")) {
    return METIS_COURSE_GOALS_BUP;
  }
  return METIS_COURSE_GOALS_VUXEN;
}

export function mapMetisGoalsToMilestoneIds(courseTitle: string, profile: any): string[] {
  const specialty = (profile as any)?.specialty || (profile as any)?.speciality;
  const goalsMap = getMetisCourseGoals(specialty);
  const baseList = goalsMap[courseTitle];
  if (!baseList || baseList.length === 0) return [];

  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion || "2021");
  return baseList.map((code) => {
    const trimmed = String(code ?? "").trim().toLowerCase();
    const match = /^([abc])(\d+)$/.exec(trimmed);
    if (!match) return trimmed.toUpperCase();
    const letterLower = match[1].toLowerCase();
    const letterUpper = letterLower.toUpperCase();
    const num = match[2];
    if (gv === "2015") return `${letterUpper}${num}`;
    if (gv === "2021") return `ST${letterLower}${num}`;
    return `${letterUpper}${num}`;
  });
}

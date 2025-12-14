import { db } from "@/lib/db";
import { loadGoals } from "@/lib/goals";
import type { Profile, Course, Achievement } from "@/lib/types";

/** Slår upp aktiv målversion och ger en Map från kod (STa1/a1 etc.) -> milestoneId */
async function activeGoalsMap() {
  const profile = (await db.profile.get("default")) as Profile | undefined;
  const catalog = profile ? await loadGoals(profile.goalsVersion, profile.specialty ?? profile.speciality) : null;
  const byCode = new Map<string, string>();
  if (catalog && Array.isArray(catalog.milestones)) {
    for (const m of catalog.milestones) {
      if (m?.code && m?.id) byCode.set(String(m.code).toUpperCase(), String(m.id));
    }
  }
  return byCode;
}

/** 2021 Bilaga 10 – Kurs (och liknande) */
export async function mapAndSaveKurs(parsed: {
  courseTitle?: string;
  description?: string;
  period?: { startISO?: string; endISO?: string };
  delmalCodes?: string[];
  showOnTimeline?: boolean;
  showAsInterval?: boolean;
  signingRole?: "handledare" | "kursledare";
  supervisorName?: string;
  supervisorSite?: string;
  supervisorSpeciality?: string;
}) {
  // Logik för datum baserat på showAsInterval:
  // - Om showAsInterval är false (Enbart slutdatum): använd bara endDate
  // - Om showAsInterval är true (Start till slut): använd både startDate och endDate
  const isInterval = parsed.showAsInterval ?? false;
  const endDate = parsed.period?.endISO;
  const startDate = isInterval ? parsed.period?.startISO : undefined; // Bara om intervall-läge
  
  const course: any = {
    id: crypto.randomUUID(),
    title: parsed.courseTitle ?? "Kurs",
    city: undefined,
    certificateDate: endDate ?? undefined,
    startDate: startDate ?? undefined,
    endDate: endDate ?? undefined,
    note: parsed.description ?? "",
    showOnTimeline: parsed.showOnTimeline ?? false,
    showAsInterval: isInterval,
    // För 2021: spara signingRole och relaterade fält
    signingRole: parsed.signingRole,
    supervisorName: parsed.supervisorName,
    supervisorSite: parsed.supervisorSite,
    supervisorSpeciality: parsed.supervisorSpeciality,
    // För kompatibilitet: spara även som courseLeader-fält om det är kursledare
    courseLeaderName: parsed.signingRole === "kursledare" ? parsed.supervisorName : undefined,
    courseLeaderSite: parsed.signingRole === "kursledare" ? parsed.supervisorSite : undefined,
  };
  await db.courses.add(course);

  const codeMap = await activeGoalsMap();
  const codes = (parsed.delmalCodes ?? []).map((c) => c.toUpperCase());
  for (const code of codes) {
    const milestoneId = codeMap.get(code);
    if (!milestoneId) continue;
    const a: Achievement = {
      id: crypto.randomUUID(),
      milestoneId,
      courseId: course.id,
      placementId: undefined,
      date: course.certificateDate ?? new Date().toISOString().slice(0, 10),
    };
    await db.achievements.add(a);
  }
  return course.id;
}

/** 2015 Bilaga 4 – Klinisk tjänstgöring under handledning */
export async function mapAndSavePlacement2015(parsed: {
  clinic?: string;
  description?: string;
  period?: { startISO?: string; endISO?: string };
  delmalCodes?: string[];
  supervisorName?: string;
  supervisorSpeciality?: string;
  supervisorSite?: string;
  cityDateRaw?: string;
  firstName?: string;
  lastName?: string;
  specialtyHeader?: string;
}) {
  const placement: any = {
    id: crypto.randomUUID(),
    title: parsed.clinic ?? "Klinisk tjänstgöring",
    city: undefined,
    startDate: parsed.period?.startISO ?? undefined,
    endDate: parsed.period?.endISO ?? undefined,
    note: parsed.description ?? "",
    // extra fält (Dexie tolererar extra nycklar)
    supervisorName: parsed.supervisorName,
    supervisorSpeciality: parsed.supervisorSpeciality,
    supervisorSite: parsed.supervisorSite,
    cityDateRaw: parsed.cityDateRaw,
    headerLastName: parsed.lastName,
    headerFirstName: parsed.firstName,
    headerSpeciality: parsed.specialtyHeader,
  };

  // @ts-ignore – om din Placement-typ saknar dessa fält
  await db.placements.add(placement);

  const codeMap = await activeGoalsMap();
  const codes = (parsed.delmalCodes ?? []).map((c) => c.toUpperCase());
  for (const code of codes) {
    const milestoneId = codeMap.get(code);
    if (!milestoneId) continue;
    const a: Achievement = {
      id: crypto.randomUUID(),
      milestoneId,
      placementId: placement.id,
      courseId: undefined,
      date: placement.endDate ?? new Date().toISOString().slice(0, 10),
    };
    await db.achievements.add(a);
  }
  return placement.id;
}

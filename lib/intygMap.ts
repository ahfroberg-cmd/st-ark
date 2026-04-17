import { loadGoals } from "@/lib/goals";
import {
  getAuthenticatedUserId,
  insertAchievementRows,
  insertCourseRowForUser,
  insertPlacementRowForUser,
} from "@/lib/repositories/starkRepository";
import type { Profile, Course, Achievement } from "@/lib/types";

function normalizeScannedMilestones(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const base = String(item ?? "")
      .trim()
      .split(/\s|–|-|:|\u2013/)[0]
      .toUpperCase()
      .replace(/\s+/g, "");
    const m = base.match(/^ST([ABC])(\d+)$/) || base.match(/^([ABC])(\d+)$/);
    if (!m) continue;
    const normalized = `ST${m[1].toLowerCase()}${parseInt(m[2], 10)}`;
    const key = normalized.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

/** Slår upp aktiv målversion och ger en Map från kod (STa1/a1 etc.) -> milestoneId */
async function activeGoalsMap() {
  const profile = undefined as Profile | undefined;
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
  title?: string; // För förbestämda kurser eller "Annan kurs"
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
  
  const scannedMilestones = normalizeScannedMilestones(parsed.delmalCodes);
  const course: any = {
    id: crypto.randomUUID(),
    title: parsed.title ?? parsed.courseTitle ?? "Kurs",
    courseTitle: parsed.courseTitle, // Spara även courseTitle separat för "Annan kurs"
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
    milestones: scannedMilestones,
    fulfillsStGoals: scannedMilestones.length > 0,
  };
  /* Supabase handles course */;

  const userId = await getAuthenticatedUserId();
  if (userId) {
    try {
      await insertCourseRowForUser(userId, {
        id: course.id,
        title: course.title || "",
        kind: "Kurs",
        city: course.city || "",
        course_leader_name: course.courseLeaderName || "",
        start_date: course.startDate || null,
        end_date: course.endDate || null,
        certificate_date: course.certificateDate || null,
        note: course.note || "",
        course_title: course.courseTitle || null,
        show_on_timeline: course.showOnTimeline !== false,
        show_as_interval: !!course.showAsInterval,
        milestones: course.milestones || [],
        fulfills_st_goals: !!course.fulfillsStGoals,
        updated_at: new Date().toISOString(),
      });
    } catch {}
  }

  const codeMap = await activeGoalsMap();
  const codes = (parsed.delmalCodes ?? []).map((c) => c.toUpperCase());
  const achievementsToAdd: Achievement[] = [];
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
    /* Supabase handles achievement */;
    achievementsToAdd.push(a);
  }

  if (userId && achievementsToAdd.length) {
    try {
      await insertAchievementRows(
        achievementsToAdd.map((a) => ({
          id: a.id,
          user_id: userId,
          placement_id: a.placementId || null,
          course_id: a.courseId || null,
          milestone_id: a.milestoneId,
          date: a.date,
        }))
      );
    } catch {}
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
  const scannedMilestones = normalizeScannedMilestones(parsed.delmalCodes);
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
    milestones: scannedMilestones,
    fulfillsStGoals: scannedMilestones.length > 0,
  };

  // @ts-ignore – om din Placement-typ saknar dessa fält
  /* Supabase handles placement */;

  const userId2 = await getAuthenticatedUserId();
  if (userId2) {
    try {
      await insertPlacementRowForUser(userId2, {
        id: placement.id,
        type: "Klinisk tjänstgöring",
        clinic: parsed.clinic || "",
        title: parsed.clinic || "Klinisk tjänstgöring",
        start_date: placement.startDate || null,
        end_date: placement.endDate || null,
        attendance: 100,
        supervisor: placement.supervisorName || "",
        supervisor_specialty: placement.supervisorSpeciality || "",
        supervisor_site: placement.supervisorSite || "",
        note: placement.note || "",
        show_on_timeline: true,
        milestones: placement.milestones || [],
        fulfills_st_goals: !!placement.fulfillsStGoals,
        updated_at: new Date().toISOString(),
      });
    } catch {}
  }

  const codeMap = await activeGoalsMap();
  const codes = (parsed.delmalCodes ?? []).map((c) => c.toUpperCase());
  const achievementsToAdd: Achievement[] = [];
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
    /* Supabase handles achievement */;
    achievementsToAdd.push(a);
  }

  if (userId2 && achievementsToAdd.length) {
    try {
      await insertAchievementRows(
        achievementsToAdd.map((a) => ({
          id: a.id,
          user_id: userId2,
          placement_id: a.placementId || null,
          course_id: a.courseId || null,
          milestone_id: a.milestoneId,
          date: a.date,
        }))
      );
    } catch {}
  }

  return placement.id;
}

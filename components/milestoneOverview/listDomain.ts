import { displayMilestoneCode } from "@/lib/milestoneDisplay";
import type { GoalsCatalog, GoalsMilestone } from "@/lib/goals";
import type { Achievement, Course, Placement } from "@/lib/types";
import { classifyActivity, classifyCourseActivity, statusAllowed } from "@/components/milestoneOverview/activityMetrics";

export type MilestoneListKind = "intyg" | "klin" | "kurs" | "arb";
export type MilestoneListItem = { id: string; line1: string; line2?: string };

type BuildArgs = {
  kind: MilestoneListKind;
  milestone: { id?: string; code?: string };
  goals: GoalsCatalog | null;
  goalsVersion: unknown;
  achievements: Achievement[];
  placements: Placement[];
  courses: Course[];
  todayIso: string;
  showDone: boolean;
  showOngoing: boolean;
  showPlanned: boolean;
};

const norm = (v: any) =>
  String(v ?? "")
    .trim()
    .split("-")[0]
    .toUpperCase()
    .replace(/\s|_/g, "");

const buildItemsPlac = (arr: any[], placements: Placement[]): MilestoneListItem[] =>
  (arr
    .map((a) => {
      const r = placements.find((p) => p.id === a.placementId);
      if (!r) return null;
      return {
        id: (r as Placement).id,
        line1: (r as any).clinic || (r as any).title || "Klinisk tjänstgöring",
        line2: `${(r as Placement).startDate || ""}${
          (r as Placement).endDate ? ` – ${(r as Placement).endDate}` : ""
        }${(r as any).attendance ? ` · ${(r as any).attendance}%` : ""}`,
      };
    })
    .filter(Boolean) as MilestoneListItem[]);

const buildItemsCourse = (arr: any[], courses: Course[]): MilestoneListItem[] =>
  (arr
    .map((a) => {
      const r = courses.find((c) => c.id === a.courseId);
      if (!r) return null;
      return {
        id: (r as Course).id,
        line1: (r as any).title || (r as any).provider || "Kurs",
        line2: [(r as any).city, (r as any).certificateDate].filter(Boolean).join(" · "),
      };
    })
    .filter(Boolean) as MilestoneListItem[]);

export function buildMilestoneListPayload(args: BuildArgs): {
  kind: MilestoneListKind;
  title: string;
  items: MilestoneListItem[];
} {
  const {
    kind,
    milestone,
    goals,
    goalsVersion,
    achievements,
    placements,
    courses,
    todayIso,
    showDone,
    showOngoing,
    showPlanned,
  } = args;
  const flags = { showDone, showOngoing, showPlanned };
  const idOrCode = (milestone as any)?.id ?? (milestone as any)?.code ?? "";
  const isBt = /^BT\d+$/i.test(String(idOrCode));

  if (isBt) {
    const code = String(idOrCode).toUpperCase().replace(/\s|_|-/g, "");
    const objHasBtCode = (obj: any, codeNorm: string) => {
      const arrs = [obj?.btMilestones, obj?.btGoals, obj?.milestones, obj?.goals, obj?.goalIds, obj?.milestoneIds];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          const cand = String(v ?? "").toUpperCase().replace(/\s|_|-/g, "");
          if (cand === codeNorm) return true;
        }
      }
      return false;
    };

    const achMatches = (achievements as any[]).filter((a) => {
      const cand = [a.goalId, a.milestoneId, a.id, a.code, a.milestone].filter(Boolean);
      const hit = cand.some((c) => String(c).toUpperCase().replace(/\s|_|-/g, "") === code);
      if (!hit) return false;

      if (a.placementId) {
        const pl = placements.find((p) => p.id === a.placementId);
        return !!pl && statusAllowed(classifyActivity(pl?.startDate, pl?.endDate, todayIso), flags);
      }
      if (a.courseId) {
        const cr = courses.find((c) => c.id === a.courseId);
        return !!cr && statusAllowed(classifyCourseActivity(cr, todayIso), flags);
      }
      return false;
    });

    const placMatches = (placements as any[])
      .filter((p) => objHasBtCode(p, code))
      .filter((p) => statusAllowed(classifyActivity(p?.startDate, p?.endDate, todayIso), flags))
      .map((p) => ({ placementId: p.id }));
    const courseMatches = (courses as any[])
      .filter((c) => objHasBtCode(c, code))
      .filter((c) => statusAllowed(classifyCourseActivity(c, todayIso), flags))
      .map((c) => ({ courseId: c.id }));

    const keyOf = (x: any) => (x.placementId ? `P:${x.placementId}` : `C:${x.courseId}`);
    const mergedMap = new Map<string, any>();
    [...achMatches, ...placMatches, ...courseMatches].forEach((x: any) => {
      const k = keyOf(x);
      if (!mergedMap.has(k)) mergedMap.set(k, x);
    });
    const merged = Array.from(mergedMap.values());
    const items =
      merged.length > 0
        ? [
            ...buildItemsPlac(merged.filter((a: any) => a.placementId), placements),
            ...buildItemsCourse(merged.filter((a: any) => a.courseId), courses),
          ]
        : [];

    return { kind: "intyg", title: `${code} – Utbildningsmoment`, items };
  }

  const idNorm = norm(idOrCode);
  const aliases = new Set<string>();
  if (idNorm) {
    aliases.add(idNorm);
    const m1 = idNorm.match(/^ST([ABC])(\d+)$/);
    if (m1) aliases.add(`${m1[1]}${m1[2]}`);
    const m2 = idNorm.match(/^([ABC])(\d+)$/);
    if (m2) aliases.add(`ST${m2[1]}${m2[2]}`);
  }

  const matchKey = (v: any) => {
    const k = norm(v);
    return !!k && aliases.has(k);
  };

  const mFull =
    goals?.milestones.find((x) => {
      const idK = norm(x.id);
      const codeK = norm(x.code);
      return aliases.has(idK) || aliases.has(codeK);
    }) ?? ((milestone as any) as GoalsMilestone | undefined);
  const rawCode = String(((mFull as any)?.code ?? idOrCode) || "");
  const titleCode = displayMilestoneCode(rawCode, goalsVersion);

  const seenPlac = new Set<string>();
  const seenCourse = new Set<string>();
  const placRefs: any[] = [];
  const courseRefs: any[] = [];

  const isArbPlacementId = (placementId: string): boolean => {
    const pl = placements.find((p) => p.id === placementId) as any;
    const t = String(pl?.type ?? "").trim().toLowerCase();
    return t === "vetenskapligt arbete" || t === "förbättringsarbete";
  };

  for (const a of achievements as any[]) {
    const cand = [a.milestoneId, a.goalId, a.id, a.code, a.milestone];
    if (!cand.some(matchKey)) continue;

    if (a.placementId) {
      const pl = placements.find((p) => p.id === a.placementId);
      const st = classifyActivity(pl?.startDate, pl?.endDate, todayIso);
      if (!pl || !statusAllowed(st, flags)) continue;
      if (!seenPlac.has(pl.id)) {
        seenPlac.add(pl.id);
        placRefs.push({ placementId: pl.id });
      }
    }

    if (a.courseId) {
      const cr = courses.find((c) => c.id === a.courseId);
      const st = classifyCourseActivity(cr, todayIso);
      if (!cr || !statusAllowed(st, flags)) continue;
      if (!seenCourse.has(cr.id)) {
        seenCourse.add(cr.id);
        courseRefs.push({ courseId: cr.id });
      }
    }
  }

  for (const pl of placements as any[]) {
    if (seenPlac.has(pl.id)) continue;
    const st = classifyActivity(pl?.startDate, pl?.endDate, todayIso);
    if (!statusAllowed(st, flags)) continue;
    const arrs = [pl.milestones, pl.goals, pl.goalIds, pl.milestoneIds];
    let hit = false;
    for (const arr of arrs) {
      if (!arr) continue;
      for (const v of arr as any[]) {
        if (matchKey(v)) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (hit) {
      seenPlac.add(pl.id);
      placRefs.push({ placementId: pl.id });
    }
  }

  for (const cr of courses as any[]) {
    if (seenCourse.has(cr.id)) continue;
    const arrs = [cr.milestones, cr.goals, cr.goalIds, cr.milestoneIds];
    let hit = false;
    for (const arr of arrs) {
      if (!arr) continue;
      for (const v of arr as any[]) {
        if (matchKey(v)) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (!hit) continue;
    const st = classifyCourseActivity(cr, todayIso);
    if (!statusAllowed(st, flags)) continue;
    seenCourse.add(cr.id);
    courseRefs.push({ courseId: cr.id });
  }

  const klinPlacRefs = placRefs.filter((x: any) => x?.placementId && !isArbPlacementId(String(x.placementId)));
  const arbPlacRefs = placRefs.filter((x: any) => x?.placementId && isArbPlacementId(String(x.placementId)));

  if (kind === "klin") {
    return {
      kind: "klin",
      title: `${titleCode} – Kliniska tjänstgöringar`,
      items: klinPlacRefs.length > 0 ? buildItemsPlac(klinPlacRefs, placements) : [],
    };
  }
  if (kind === "kurs") {
    return {
      kind: "kurs",
      title: `${titleCode} – Kurser`,
      items: courseRefs.length > 0 ? buildItemsCourse(courseRefs, courses) : [],
    };
  }
  if (kind === "arb") {
    return {
      kind: "arb",
      title: `${titleCode} – Arbeten`,
      items: arbPlacRefs.length > 0 ? buildItemsPlac(arbPlacRefs, placements) : [],
    };
  }

  return {
    kind,
    title: `${titleCode} – Utbildningsaktiviteter`,
    items: [
      ...buildItemsPlac(placRefs, placements),
      ...buildItemsCourse(courseRefs, courses),
    ],
  };
}

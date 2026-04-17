import { btMilestones } from "@/lib/goals-bt";
import type { Achievement, Course, Placement } from "@/lib/types";

export type ActivityStatus = "done" | "ongoing" | "planned" | null;
export type BtRow = { code: string; klinCount: number; kursCount: number };

export function classifyActivity(
  startDate: string | undefined | null,
  endDate: string | undefined | null,
  todayIso: string
): ActivityStatus {
  const s = (startDate ?? "").trim();
  const e = (endDate ?? "").trim();
  if (!s && !e) return null;
  if (e && e < todayIso) return "done";
  if (s && s > todayIso) return "planned";
  if (s && (!e || e >= todayIso) && s <= todayIso) return "ongoing";
  return null;
}

export function classifyCourseActivity(course: any, todayIso: string): ActivityStatus {
  if (!course) return null;
  const s = course?.startDate;
  const e = course?.endDate;
  if (s || e) return classifyActivity(s, e, todayIso);
  const cert = course?.certificateDate;
  if (!cert) return null;
  return cert < todayIso ? "done" : "planned";
}

export function statusAllowed(
  status: ActivityStatus,
  flags: { showDone: boolean; showOngoing: boolean; showPlanned: boolean }
): boolean {
  if (!status) return false;
  if (status === "done") return flags.showDone;
  if (status === "ongoing") return flags.showOngoing;
  if (status === "planned") return flags.showPlanned;
  return false;
}

export function normalizeBtCode(x: unknown): string | null {
  const s = String(x ?? "").trim();
  const m = s.match(/^BT[\s\-_]*([0-9]+)/i);
  return m ? `BT${m[1]}` : null;
}

export function buildBtRows(args: {
  achievements: Achievement[];
  placements: Placement[];
  courses: Course[];
  query: string;
  todayIso: string;
  showDone: boolean;
  showOngoing: boolean;
  showPlanned: boolean;
}): BtRow[] {
  const { achievements, placements, courses, query, todayIso, showDone, showOngoing, showPlanned } = args;
  const klin: Record<string, number> = {};
  const kurs: Record<string, number> = {};
  const flags = { showDone, showOngoing, showPlanned };

  for (const a of achievements as any[]) {
    const cand = [a.goalId, a.milestoneId, a.id, a.code, a.milestone].filter(Boolean);
    for (const c of cand) {
      const code = normalizeBtCode(c);
      if (!code) continue;
      if (a.placementId) {
        const pl = placements.find((p) => p.id === a.placementId);
        if (statusAllowed(classifyActivity(pl?.startDate, pl?.endDate, todayIso), flags)) {
          klin[code] = (klin[code] ?? 0) + 1;
        }
      }
      if (a.courseId) {
        const cr = courses.find((c0) => c0.id === a.courseId);
        if (statusAllowed(classifyActivity((cr as any)?.startDate, (cr as any)?.endDate, todayIso), flags)) {
          kurs[code] = (kurs[code] ?? 0) + 1;
        }
      }
    }
  }

  const scan = (obj: any, isPlacement: boolean) => {
    if (!statusAllowed(classifyActivity(obj?.startDate, obj?.endDate, todayIso), flags)) return;
    const arrs = [obj?.btMilestones, obj?.btGoals, obj?.milestones, obj?.goals, obj?.goalIds, obj?.milestoneIds];
    for (const arr of arrs) {
      if (!arr) continue;
      for (const v of arr as any[]) {
        const code = normalizeBtCode(v);
        if (!code) continue;
        if (isPlacement) klin[code] = (klin[code] ?? 0) + 1;
        else kurs[code] = (kurs[code] ?? 0) + 1;
      }
    }
  };
  for (const p of placements as any[]) scan(p, true);
  for (const c of courses as any[]) scan(c, false);

  const filtered = btMilestones.filter((m) => {
    if (!query.trim()) return true;
    const hay = `${m.id} ${m.title} ${m.bullets.join(" ")}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });
  const sortNum = (code: string) => Number(code.replace(/[^\d]/g, "")) || 0;

  return filtered
    .map((m) => {
      const code = m.id.toUpperCase().replace(/\s|_|-/g, "");
      return { code, klinCount: klin[code] ?? 0, kursCount: kurs[code] ?? 0 };
    })
    .sort((a, b) => sortNum(a.code) - sortNum(b.code));
}

export function countMilestoneActivities(args: {
  mid: string;
  achievements: Achievement[];
  placements: Placement[];
  courses: Course[];
  todayIso: string;
  showDone: boolean;
  showOngoing: boolean;
  showPlanned: boolean;
}): { klin: number; kurs: number; arb: number } {
  const { mid, achievements, placements, courses, todayIso, showDone, showOngoing, showPlanned } = args;
  let klin = 0;
  let kurs = 0;
  let arb = 0;

  const norm = (v: any) => String(v ?? "").trim().split("-")[0].toUpperCase().replace(/\s|_/g, "");
  const midNorm = norm(mid);
  if (!midNorm) return { klin, kurs, arb };

  const isArbPlacement = (pl: any): boolean => {
    const t = String(pl?.type ?? "").trim().toLowerCase();
    return t === "vetenskapligt arbete" || t === "förbättringsarbete";
  };

  const aliases = new Set<string>([midNorm]);
  const m1 = midNorm.match(/^ST([ABC])(\d+)$/);
  if (m1) aliases.add(`${m1[1]}${m1[2]}`);
  const m2 = midNorm.match(/^([ABC])(\d+)$/);
  if (m2) aliases.add(`ST${m2[1]}${m2[2]}`);
  const matchKey = (v: any) => {
    const k = norm(v);
    return !!k && aliases.has(k);
  };

  const flags = { showDone, showOngoing, showPlanned };
  const countedPlac = new Set<string>();
  const countedCourse = new Set<string>();

  for (const a of achievements as any[]) {
    const cand = [a.milestoneId, a.goalId, a.id, a.code, a.milestone];
    if (!cand.some(matchKey)) continue;

    if (a.placementId) {
      const pl = placements.find((p) => p.id === a.placementId);
      if (pl && statusAllowed(classifyActivity(pl?.startDate, pl?.endDate, todayIso), flags) && !countedPlac.has(pl.id)) {
        countedPlac.add(pl.id);
        if (isArbPlacement(pl)) arb += 1;
        else klin += 1;
      }
    }
    if (a.courseId) {
      const cr = courses.find((c) => c.id === a.courseId);
      if (cr && statusAllowed(classifyCourseActivity(cr, todayIso), flags) && !countedCourse.has(cr.id)) {
        countedCourse.add(cr.id);
        kurs += 1;
      }
    }
  }

  for (const pl of placements as any[]) {
    if (countedPlac.has(pl.id)) continue;
    if (!statusAllowed(classifyActivity(pl?.startDate, pl?.endDate, todayIso), flags)) continue;
    const arrs = [pl.milestones, pl.goals, pl.goalIds, pl.milestoneIds];
    if (arrs.some((arr) => arr && arr.some(matchKey))) {
      countedPlac.add(pl.id);
      if (isArbPlacement(pl)) arb += 1;
      else klin += 1;
    }
  }

  for (const cr of courses as any[]) {
    if (countedCourse.has(cr.id)) continue;
    if (!statusAllowed(classifyCourseActivity(cr, todayIso), flags)) continue;
    const arrs = [cr.milestones, cr.goals, cr.goalIds, cr.milestoneIds];
    if (arrs.some((arr) => arr && arr.some(matchKey))) {
      countedCourse.add(cr.id);
      kurs += 1;
    }
  }

  return { klin, kurs, arb };
}

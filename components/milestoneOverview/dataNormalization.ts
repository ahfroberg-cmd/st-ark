import type { Achievement, Course, Placement } from "@/lib/types";

const asArray = (v: any): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

export function normalizeSupabaseData(args: {
  placementsRaw: any;
  coursesRaw: any;
  achievementsRaw: any;
}): { placements: Placement[]; courses: Course[]; achievements: Achievement[] } {
  const { placementsRaw, coursesRaw, achievementsRaw } = args;

  const placements: Placement[] = (Array.isArray(placementsRaw) ? placementsRaw : [])
    .map((p: any) => ({
      id: String(p?.id ?? ""),
      clinic: String(p?.clinic ?? p?.title ?? ""),
      startDate: String(p?.startDate ?? p?.start_date ?? ""),
      endDate: String(p?.endDate ?? p?.end_date ?? ""),
      attendance: Number(p?.attendance ?? 100),
      supervisor: String(p?.supervisor ?? ""),
      note: String(p?.note ?? ""),
      type: String(p?.type ?? ""),
      milestones: asArray(p?.milestones ?? p?.st_milestones),
      goals: asArray(p?.goals),
      goalIds: asArray(p?.goalIds ?? p?.goal_ids),
      milestoneIds: asArray(p?.milestoneIds ?? p?.milestone_ids),
      btMilestones: asArray(p?.btMilestones ?? p?.bt_milestones),
    } as any))
    .filter((p) => p.id);

  const courses: Course[] = (Array.isArray(coursesRaw) ? coursesRaw : [])
    .map((c: any) => ({
      id: String(c?.id ?? ""),
      title: String(c?.title ?? c?.course_title ?? ""),
      city: String(c?.city ?? c?.site ?? ""),
      certificateDate: String(c?.certificateDate ?? c?.certificate_date ?? ""),
      startDate: String(c?.startDate ?? c?.start_date ?? ""),
      endDate: String(c?.endDate ?? c?.end_date ?? ""),
      note: String(c?.note ?? ""),
      milestones: asArray(c?.milestones),
      goals: asArray(c?.goals),
      goalIds: asArray(c?.goalIds ?? c?.goal_ids),
      milestoneIds: asArray(c?.milestoneIds ?? c?.milestone_ids),
      btMilestones: asArray(c?.btMilestones ?? c?.bt_milestones),
    } as any))
    .filter((c) => c.id);

  const achievements: Achievement[] = (Array.isArray(achievementsRaw) ? achievementsRaw : [])
    .map((a: any) => ({
      id: String(a?.id ?? ""),
      placementId: a?.placementId ?? a?.placement_id ?? undefined,
      courseId: a?.courseId ?? a?.course_id ?? undefined,
      milestoneId: String(a?.milestoneId ?? a?.milestone_id ?? ""),
      goalId: a?.goalId ?? a?.goal_id ?? undefined,
      code: a?.code ?? undefined,
      milestone: a?.milestone ?? undefined,
      date: String(a?.date ?? a?.achieved_date ?? ""),
    }))
    .filter((a) => a.id);

  return { placements, courses, achievements };
}

import { listCoursesByUserId, listPlacementsByUserId } from "@/lib/repositories/starkRepository";
import { mapCourseRowForDb, mapPlacementRowForDb } from "@/lib/pussla/entitySync";

type RowLike = Record<string, any>;

export async function fetchLockedTimelineRows(userId: string | null): Promise<{
  placements: RowLike[];
  courses: RowLike[];
}> {
  if (!userId) return { placements: [], courses: [] };

  const [placementsRes, coursesRes] = await Promise.all([
    listPlacementsByUserId(userId),
    listCoursesByUserId(userId),
  ]);

  const placements =
    !placementsRes.error && Array.isArray(placementsRes.data)
      ? placementsRes.data.map((p: any) => mapPlacementRowForDb(p))
      : [];

  const courses =
    !coursesRes.error && Array.isArray(coursesRes.data)
      ? coursesRes.data.map((c: any) => mapCourseRowForDb(c))
      : [];

  return { placements, courses };
}

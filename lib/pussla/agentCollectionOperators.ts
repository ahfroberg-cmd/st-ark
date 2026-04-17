type WithId = { id: string };

type CourseLike = WithId & {
  kind?: string;
};

type PlacementLike = WithId & {
  exactStartISO?: string;
  exactEndISO?: string;
  startSlot?: number;
};

function addMonthsIso(iso: string, months: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function removeEntitiesByIds<T extends WithId>(
  entities: T[],
  ids: string[]
): { remaining: T[]; removedCount: number } {
  const idSet = new Set(ids);
  const remaining = entities.filter((entity) => !idSet.has(String(entity.id)));
  return { remaining, removedCount: entities.length - remaining.length };
}

export function setCourseKindByIds<T extends CourseLike>(
  courses: T[],
  ids: string[],
  kind: string
): { updated: T[]; changedCount: number } {
  const idSet = new Set(ids);
  let changedCount = 0;
  const updated = courses.map((course) => {
    if (!idSet.has(String(course.id))) return course;
    changedCount += 1;
    return { ...course, kind };
  });
  return { updated, changedCount };
}

export function shiftPlacementsByMonths<T extends PlacementLike>(input: {
  placements: T[];
  ids: string[];
  months: number;
  getPlacementStartISOForAgent: (placement: T) => string;
  getPlacementEndISOForAgent: (placement: T) => string;
}): { updated: T[]; changedCount: number } {
  const { placements, ids, months, getPlacementStartISOForAgent, getPlacementEndISOForAgent } = input;
  const idSet = new Set(ids);
  let changedCount = 0;
  const updated = placements.map((placement) => {
    if (!idSet.has(String(placement.id))) return placement;
    changedCount += 1;
    const nextStart = addMonthsIso(getPlacementStartISOForAgent(placement), months);
    const nextEnd = addMonthsIso(getPlacementEndISOForAgent(placement), months);
    return {
      ...placement,
      exactStartISO: nextStart,
      exactEndISO: nextEnd,
      startSlot:
        typeof placement.startSlot === "number"
          ? placement.startSlot + months * 2
          : placement.startSlot,
    };
  });
  return { updated, changedCount };
}

type ActivityLike = {
  id: string;
  type: string;
  startSlot: number;
  lengthSlots: number;
};

export function rangeOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

export function isEducationalActivityType(type: string): boolean {
  return (
    type === "Klinisk tjänstgöring" ||
    type === "Vetenskapligt arbete" ||
    type === "Förbättringsarbete" ||
    type === "Auskultation"
  );
}

export function computeEducationalGaps(activities: ActivityLike[]) {
  const indexById = new Map<string, ActivityLike>();
  activities.forEach((a) => indexById.set(a.id, a));

  const edus = activities
    .filter((a) => isEducationalActivityType(a.type))
    .map((a) => ({ id: a.id, start: a.startSlot, end: a.startSlot + a.lengthSlots }))
    .sort((a, b) => a.start - b.start);

  const sigOf = (aId: string) => {
    const a = indexById.get(aId)!;
    return `${a.id}|${a.type}|${a.startSlot}|${a.lengthSlots}`;
  };

  const gaps: { id: string; fromSlot: number; toSlot: number; leftId: string; rightId: string }[] = [];
  for (let i = 0; i < edus.length - 1; i++) {
    const cur = edus[i];
    const nxt = edus[i + 1];
    if (nxt.start > cur.end) {
      const id = `${sigOf(cur.id)}→${sigOf(nxt.id)}`;
      gaps.push({ id, fromSlot: cur.end, toSlot: nxt.start, leftId: cur.id, rightId: nxt.id });
    }
  }
  return gaps;
}

export function wouldOverlapInActivities(
  activities: ActivityLike[],
  id: string | null,
  startSlot: number,
  lengthSlots: number
): boolean {
  const end = startSlot + lengthSlots;
  for (const x of activities || []) {
    if (id && x.id === id) continue;
    if (rangeOverlap(startSlot, end, x.startSlot, x.startSlot + x.lengthSlots)) return true;
  }
  return false;
}

export function findPlacementToRightInActivities(
  activities: ActivityLike[],
  targetId: string
): ActivityLike | null {
  const target = (activities || []).find((a) => a.id === targetId);
  if (!target) return null;
  const myEndEx = target.startSlot + target.lengthSlots;
  let best: ActivityLike | null = null;
  let bestStart = Infinity;
  for (const o of activities || []) {
    if (o.id === targetId) continue;
    if (o.startSlot >= myEndEx && o.startSlot < bestStart) {
      best = o;
      bestStart = o.startSlot;
    }
  }
  return best;
}

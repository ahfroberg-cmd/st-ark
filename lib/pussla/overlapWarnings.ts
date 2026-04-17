type ActivityLike = {
  type: string;
  label?: string | null;
  startSlot: number;
  lengthSlots: number;
};

function normalizeLabel(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function computeActivityOverlaps<T extends ActivityLike>(
  activities: T[],
  computeDates: (activity: T) => { startISO: string; endISO: string }
): Array<{ a: T; b: T }> {
  if (!activities || activities.length < 2) return [];
  const overlaps: Array<{ a: T; b: T }> = [];

  for (let i = 0; i < activities.length; i++) {
    for (let j = i + 1; j < activities.length; j++) {
      const a = activities[i];
      const b = activities[j];

      const a0 = a.startSlot;
      const a1 = a.startSlot + a.lengthSlots;
      const b0 = b.startSlot;
      const b1 = b.startSlot + b.lengthSlots;
      if (!(a0 < b1 && b0 < a1)) continue;

      const sameType = a.type === b.type;
      const sameLabel = normalizeLabel(a.label) === normalizeLabel(b.label);
      if (sameType && sameLabel && a0 === b0 && a1 === b1) continue;

      const aIso = computeDates(a);
      const bIso = computeDates(b);
      if (sameType && sameLabel && aIso.startISO === bIso.startISO && aIso.endISO === bIso.endISO) continue;

      const overlapLenNow = Math.min(a1, b1) - Math.max(a0, b0);
      const shorterLen = Math.max(1, Math.min(a.lengthSlots, b.lengthSlots));
      const overlapRatio = overlapLenNow / shorterLen;
      if (sameType && sameLabel && overlapRatio >= 0.8) continue;

      overlaps.push({ a, b });
    }
  }

  return overlaps;
}

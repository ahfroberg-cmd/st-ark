"use client";

import React from "react";

export default function GapWarnings({
  startYear,
  activities,
  dismissedGaps,
  onDismiss,
}: {
  startYear: number;
  activities: any[];
  dismissedGaps: string[];
  onDismiss: (id: string) => void;
}) {
  const slotToYMH = (baseStartYear: number, slot: number) => {
    const yearOffset = Math.floor(slot / 24);
    const inYear = slot % 24;
    const month0 = Math.floor(inYear / 2);
    const half = inYear % 2;
    return { year: baseStartYear + yearOffset, month0, half };
  };

  const halfMidDateSV = (year: number, month0: number, half: number) => {
    const day = half === 0 ? 7 : 21;
    const d = new Date(year, month0, day);
    return d.toLocaleDateString("sv-SE");
  };

  const isEducational = (a: any) => {
    const t = String(a.type ?? a.kind ?? "").toLowerCase();
    return !(t.includes("kurs") || t.includes("konferens"));
  };

  const indexById = new Map<string, any>();
  activities.forEach((a) => indexById.set(a.id, a));

  const edus = activities
    .filter(isEducational)
    .map((a) => ({ id: a.id, start: a.startSlot, end: a.startSlot + a.lengthSlots }))
    .sort((a, b) => a.start - b.start);

  function sigOf(aId: string) {
    const a = indexById.get(aId)!;
    return `${a.id}|${a.type}|${a.startSlot}|${a.lengthSlots}`;
  }

  const gaps: { id: string; fromSlot: number; toSlot: number; leftId: string; rightId: string }[] = [];
  for (let i = 0; i < edus.length - 1; i++) {
    const cur = edus[i];
    const nxt = edus[i + 1];
    if (nxt.start > cur.end) {
      const id = `${sigOf(cur.id)}→${sigOf(nxt.id)}`;
      gaps.push({ id, fromSlot: cur.end, toSlot: nxt.start, leftId: cur.id, rightId: nxt.id });
    }
  }

  const visible = gaps.filter((g) => !dismissedGaps.includes(g.id));
  if (visible.length === 0) return null;

  const slotToSV = (slot: number) => {
    const ymh = slotToYMH(startYear, slot);
    return halfMidDateSV(ymh.year, ymh.month0, ymh.half);
  };

  const labelOf = (id: string) => {
    const a = indexById.get(id);
    const t = String(a?.type ?? a?.kind ?? "").trim();
    const title = String(a?.title ?? "").trim();
    return title || t || id;
  };

  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
      <div className="mb-2 font-semibold">Varning: glapp mellan utbildningsaktiviteter</div>
      <ul className="space-y-1">
        {visible.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-2">
            <span className="text-sm">
              Glapp mellan <span className="font-medium">{labelOf(g.leftId)}</span> och{" "}
              <span className="font-medium">{labelOf(g.rightId)}</span>:
              <span className="ml-1">
                {slotToSV(g.fromSlot)} - {slotToSV(g.toSlot)}
              </span>
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                onDismiss(g.id);
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              title="Dölj denna varning"
              aria-label="Dölj denna varning"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

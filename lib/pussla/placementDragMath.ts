type OverlapsAt = (start: number, len: number) => boolean;

export function computeMoveStartNoOverlap(input: {
  startSlot: number;
  deltaColsGlobal: number;
  lengthSlots: number;
  minSlotGlobal: number;
  maxSlotGlobal: number;
  overlapsAt: OverlapsAt;
  clamp: (value: number, min: number, max: number) => number;
}): { startSlot: number } | null {
  const {
    startSlot,
    deltaColsGlobal,
    lengthSlots,
    minSlotGlobal,
    maxSlotGlobal,
    overlapsAt,
    clamp,
  } = input;

  let newStart = startSlot + deltaColsGlobal;
  newStart = clamp(
    newStart,
    minSlotGlobal,
    Math.max(minSlotGlobal, maxSlotGlobal - lengthSlots)
  );
  if (overlapsAt(newStart, lengthSlots)) return null;
  return { startSlot: newStart };
}

export function adjustResizeLeftNoOverlap(input: {
  startSlotGlobal: number;
  endSlotFixed: number;
  minSlotGlobal: number;
  overlapsAt: OverlapsAt;
  clamp: (value: number, min: number, max: number) => number;
}): { startSlot: number; lengthSlots: number } | null {
  const { startSlotGlobal, endSlotFixed, minSlotGlobal, overlapsAt, clamp } = input;

  let newStart = clamp(startSlotGlobal, minSlotGlobal, endSlotFixed);
  let newLen = Math.max(1, endSlotFixed - newStart + 1);

  if (overlapsAt(newStart, newLen)) {
    while (overlapsAt(newStart, newLen) && newStart < endSlotFixed) {
      newStart++;
      newLen = Math.max(1, endSlotFixed - newStart + 1);
    }
    while (newLen > 1 && overlapsAt(newStart, newLen)) {
      newStart++;
      newLen = Math.max(1, endSlotFixed - newStart + 1);
    }
    if (overlapsAt(newStart, newLen)) return null;
  }

  return { startSlot: newStart, lengthSlots: newLen };
}

export function adjustResizeRightNoOverlap(input: {
  endSlotGlobal: number;
  startSlot: number;
  maxSlotGlobal: number;
  overlapsAt: OverlapsAt;
}): { lengthSlots: number } | null {
  const { endSlotGlobal, startSlot, maxSlotGlobal, overlapsAt } = input;
  let newLen = Math.max(1, endSlotGlobal - startSlot + 1);
  newLen = Math.min(newLen, Math.max(1, maxSlotGlobal - startSlot));

  if (overlapsAt(startSlot, newLen)) {
    while (newLen > 1 && overlapsAt(startSlot, newLen)) newLen--;
    if (overlapsAt(startSlot, newLen)) return null;
  }

  return { lengthSlots: newLen };
}

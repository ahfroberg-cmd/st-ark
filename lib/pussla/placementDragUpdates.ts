type ActivityLike = {
  id: string;
  startSlot: number;
  lengthSlots: number;
  phase?: "BT" | "ST";
};

export function applyMovePlacement<T extends ActivityLike>(input: {
  activities: T[];
  id: string;
  newStart: number;
  resolvePhase: (activity: T, newStart: number) => "BT" | "ST";
}): T[] {
  const { activities, id, newStart, resolvePhase } = input;
  return activities.map((activity) => {
    if (activity.id !== id) return activity;
    return {
      ...activity,
      startSlot: newStart,
      phase: resolvePhase(activity, newStart),
    };
  });
}

export function applyResizeLeftPlacement<T extends ActivityLike>(input: {
  activities: T[];
  id: string;
  newStart: number;
  newLength: number;
  phaseForSlots: (startSlot: number, lengthSlots: number) => "BT" | "ST";
}): T[] {
  const { activities, id, newStart, newLength, phaseForSlots } = input;
  return activities.map((activity) => {
    if (activity.id !== id) return activity;
    return {
      ...activity,
      startSlot: newStart,
      lengthSlots: newLength,
      phase: activity.phase ? activity.phase : phaseForSlots(newStart, newLength),
    };
  });
}

export function applyResizeRightPlacement<T extends ActivityLike>(input: {
  activities: T[];
  id: string;
  newLength: number;
  phaseForSlots: (startSlot: number, lengthSlots: number) => "BT" | "ST";
}): T[] {
  const { activities, id, newLength, phaseForSlots } = input;
  return activities.map((activity) => {
    if (activity.id !== id) return activity;
    return {
      ...activity,
      lengthSlots: newLength,
      phase: activity.phase ? activity.phase : phaseForSlots(activity.startSlot, newLength),
    };
  });
}

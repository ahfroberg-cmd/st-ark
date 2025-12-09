// lib/progress.ts
import type { GoalsMilestone } from "@/lib/goals";

export type DerivedStatus = "Ej" | "Pågår" | "Uppfyllt";

export interface MilestoneProgress {
  milestoneId: string;
  completed: number;
  required: number;
  status: DerivedStatus;
}

/** Minimal uppfyllelsepost – funkar för både placeringar och kurser */
export interface MinimalAch {
  milestoneId: string;
  subpointId?: string;
}

/** Returnerar uppsättning av subpointId som är uppnådda globalt (alla källor) för ett visst delmål */
export function achievementsByMilestone(
  achievements: MinimalAch[],
  milestoneId: string
): Set<string> {
  const set = new Set<string>();
  for (const a of achievements) {
    if (a.milestoneId === milestoneId && a.subpointId) set.add(a.subpointId);
  }
  return set;
}

/** Beräkna progress för ett mål utifrån uppfyllelser från alla källor */
export function computeMilestoneProgress(
  milestone: GoalsMilestone,
  allAchievements: MinimalAch[]
): MilestoneProgress {
  const requiredIds = milestone.subpoints
    .filter(sp => sp.required !== false) // default = required
    .map(sp => sp.id);

  const doneSet = achievementsByMilestone(allAchievements, milestone.id);
  const completed = requiredIds.reduce((acc, id) => acc + (doneSet.has(id) ? 1 : 0), 0);
  const required = requiredIds.length;

  let status: DerivedStatus = "Ej";
  if (completed === 0) status = "Ej";
  else if (completed < required) status = "Pågår";
  else status = "Uppfyllt";

  return { milestoneId: milestone.id, completed, required, status };
}

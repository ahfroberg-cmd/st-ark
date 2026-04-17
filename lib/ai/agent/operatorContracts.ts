import type { PusslaAgentAction } from "@/lib/ai/types";

export interface OperatorValidationResult {
  valid: boolean;
  reason?: string;
}

export interface OperatorContract {
  id: string;
  risk: "low" | "medium" | "high";
  cost: number;
  effects: string[];
  preconditions?: Array<(action: PusslaAgentAction, snapshot?: unknown) => OperatorValidationResult>;
}

function hasCourses(snapshot?: unknown): boolean {
  if (!snapshot) return true;
  return Array.isArray((snapshot as any)?.courses) && (snapshot as any).courses.length > 0;
}

function hasActivities(snapshot?: unknown): boolean {
  if (!snapshot) return true;
  return Array.isArray((snapshot as any)?.activities) && (snapshot as any).activities.length > 0;
}

const CONTRACTS: Partial<Record<PusslaAgentAction["type"], OperatorContract>> = {
  transform_all_placements_duration: {
    id: "timeline.scale_duration",
    risk: "medium",
    cost: 2,
    effects: ["timeline.placements.duration_changed"],
    preconditions: [
      (action) => {
        if (action.type !== "transform_all_placements_duration") return { valid: true };
        const factor = Number(action.factor);
        if (!Number.isFinite(factor) || factor <= 0 || factor > 1) {
          return {
            valid: false,
            reason: "Ogiltig duration-faktor. Använd värde mellan 0 och 1 (t.ex. 0.5 för halvering).",
          };
        }
        return { valid: true };
      },
      (_action, snapshot) =>
        hasActivities(snapshot)
          ? { valid: true }
          : { valid: false, reason: "Tidslinjen saknar placeringar för denna operation." },
    ],
  },
  plan_timeline_distribution: {
    id: "timeline.distribute",
    risk: "medium",
    cost: 3,
    effects: ["timeline.items.redistributed"],
    preconditions: [
      (action) => {
        if (action.type !== "plan_timeline_distribution") return { valid: true };
        const n = Number(action.itemsPerCadence);
        if (!Number.isFinite(n) || n < 1 || n > 12) {
          return {
            valid: false,
            reason: "Ogiltigt antal per period. Ange ett värde mellan 1 och 12.",
          };
        }
        return { valid: true };
      },
    ],
  },
  shift_all_courses: {
    id: "courses.shift_all",
    risk: "medium",
    cost: 2,
    effects: ["courses.dates.shifted"],
    preconditions: [
      (action) => {
        if (action.type !== "shift_all_courses") return { valid: true };
        const m = Number(action.months || 1);
        if (!Number.isFinite(m) || m < 1 || m > 24) {
          return {
            valid: false,
            reason: "Ogiltigt månadsintervall för kursflytt. Använd 1-24 månader.",
          };
        }
        return { valid: true };
      },
      (_action, snapshot) =>
        hasCourses(snapshot)
          ? { valid: true }
          : { valid: false, reason: "Det finns inga kurser att flytta i aktuell vy." },
    ],
  },
  delete_course_by_month_year: {
    id: "courses.delete_by_month_year",
    risk: "high",
    cost: 1,
    effects: ["courses.deleted"],
    preconditions: [
      (_action, snapshot) =>
        hasCourses(snapshot)
          ? { valid: true }
          : { valid: false, reason: "Det finns inga kurser att ta bort i aktuell vy." },
    ],
  },
};

export function getOperatorContract(action: PusslaAgentAction): OperatorContract | null {
  return CONTRACTS[action.type] || null;
}

export function validateOperatorAction(
  action: PusslaAgentAction,
  snapshot?: unknown
): OperatorValidationResult {
  const contract = getOperatorContract(action);
  if (!contract?.preconditions || contract.preconditions.length === 0) return { valid: true };
  for (const pre of contract.preconditions) {
    const check = pre(action, snapshot);
    if (!check.valid) return check;
  }
  return { valid: true };
}

export function filterInvalidOperatorActions(
  actions: PusslaAgentAction[],
  snapshot?: unknown
): {
  validActions: PusslaAgentAction[];
  dropped: Array<{ action: PusslaAgentAction; reason: string }>;
  metadata: Array<{ actionType: PusslaAgentAction["type"]; risk: string; cost: number; effects: string[] }>;
} {
  const validActions: PusslaAgentAction[] = [];
  const dropped: Array<{ action: PusslaAgentAction; reason: string }> = [];
  const metadata: Array<{ actionType: PusslaAgentAction["type"]; risk: string; cost: number; effects: string[] }> =
    [];
  for (const action of actions) {
    const check = validateOperatorAction(action, snapshot);
    if (check.valid) {
      validActions.push(action);
      const c = getOperatorContract(action);
      if (c) {
        metadata.push({
          actionType: action.type,
          risk: c.risk,
          cost: c.cost,
          effects: [...c.effects],
        });
      }
    } else dropped.push({ action, reason: check.reason || "invalid_operator_contract" });
  }
  return { validActions, dropped, metadata };
}

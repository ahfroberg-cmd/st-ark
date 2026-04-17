import type { PusslaAgentAction } from "@/lib/ai/types";

export type IntentDomain = "timeline" | "courses" | "iup";

export interface IntentIR {
  id: string;
  domain: IntentDomain;
  operation: string;
  params: Record<string, unknown>;
  confidence: "low" | "medium" | "high";
}

export interface ConstraintIR {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
}

export interface TaskNodeIR {
  id: string;
  kind: "goal" | "subgoal" | "operator";
  label: string;
  operatorId?: string;
  params?: Record<string, unknown>;
}

export interface TaskGraphIR {
  goalSummary: string;
  intent: IntentIR;
  constraints: ConstraintIR[];
  nodes: TaskNodeIR[];
  notes: string[];
}

export interface LoweredPlanIR {
  goalSummary: string;
  actions: PusslaAgentAction[];
  confidence: "low" | "medium" | "high";
  clarifyingQuestion?: string;
  notes: string[];
}

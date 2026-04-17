import type { PlannerEngineResult } from "@/lib/ai/agent/plannerEngine";

export interface PlanSelectedEventPayload {
  kind: "plan_selected";
  source: PlannerEngineResult["source"];
  confidence: PlannerEngineResult["confidence"];
  stepCount: number;
  notes: string[];
}

export function buildPlanSelectedEventPayload(
  plan: Pick<PlannerEngineResult, "source" | "confidence" | "actions" | "notes">
): PlanSelectedEventPayload {
  return {
    kind: "plan_selected",
    source: plan.source,
    confidence: plan.confidence,
    stepCount: plan.actions.length,
    notes: [...plan.notes],
  };
}

export function splitDerivedNoteMessages(messages: string[]): {
  systemMessages: string[];
  assistantMessages: string[];
} {
  const assistantMessages = messages.filter((m) =>
    /BT-intygsvyn|utskriften behöver startas manuellt/i.test(m)
  );
  const systemMessages = messages;
  return { systemMessages, assistantMessages };
}

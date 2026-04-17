import { describe, expect, it } from "vitest";
import type { PusslaAgentAction } from "@/lib/ai/types";
import { buildPlanExecutionDecision } from "@/lib/ai/assistantCore/planExecutionGateway";

describe("assistantCore planExecutionGateway", () => {
  it("returns allowed actions for read plan", () => {
    const actions: PusslaAgentAction[] = [{ type: "summarize_app_sections" }];
    const out = buildPlanExecutionDecision({
      userText: "visa appens sektioner",
      actions,
      forceReadOnly: true,
    });
    expect(out.ok).toBe(true);
    expect(out.allowedActions).toEqual(actions);
  });

  it("returns blocked messages for write plan in read-only", () => {
    const actions: PusslaAgentAction[] = [
      { type: "update_selected_placement", fields: { note: "x" } },
    ];
    const out = buildPlanExecutionDecision({
      userText: "uppdatera placering",
      actions,
      forceReadOnly: true,
    });
    expect(out.ok).toBe(false);
    expect(out.assistantMessage).toMatch(/Read-only/i);
  });
});

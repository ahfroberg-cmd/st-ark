import { describe, expect, it } from "vitest";
import type { PusslaAgentAction } from "@/lib/ai/types";
import {
  buildBlockedPlanMessages,
  evaluatePlanForExecution,
} from "@/lib/ai/assistantCore/runController";

describe("assistantCore runController", () => {
  it("allows short read plan in normal mode", () => {
    const actions: PusslaAgentAction[] = [
      { type: "open_window", window: "iup" },
      { type: "set_iup_tab", tab: "delmal" },
    ];
    const out = evaluatePlanForExecution({
      userText: "öppna iup och gå till delmål",
      actions,
      forceReadOnly: false,
    });
    expect(out.blockedReason).toBeNull();
    expect(out.allowedActions).toEqual(actions);
    expect(out.profile.taskType).toBe("read_query");
  });

  it("blocks write plan in forced read-only mode", () => {
    const actions: PusslaAgentAction[] = [
      { type: "select_placement", query: "Vårdcentral" },
      { type: "update_selected_placement", fields: { milestones: ["C2"] } },
    ];
    const out = evaluatePlanForExecution({
      userText: "lägg till delmål c2 till vårdcentral",
      actions,
      forceReadOnly: true,
    });
    expect(out.blockedReason).toMatch(/Read-only/i);
    expect(out.allowedActions).toHaveLength(0);
    expect(out.profile.mode).toBe("read_only");
  });

  it("builds blocked messages for dropped write actions", () => {
    const actions: PusslaAgentAction[] = [
      { type: "update_selected_placement", fields: { note: "x" } },
    ];
    const out = evaluatePlanForExecution({
      userText: "uppdatera anteckning",
      actions,
      forceReadOnly: true,
    });
    const msg = buildBlockedPlanMessages(out);
    expect(msg?.assistantMessage).toMatch(/Read-only/i);
    expect(msg?.systemMessage).toMatch(/Stoppade/i);
  });
});

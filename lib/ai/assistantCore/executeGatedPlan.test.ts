import { describe, expect, it, vi } from "vitest";
import type { PusslaAgentAction } from "@/lib/ai/types";
import { runGatedPlanIfAllowed } from "@/lib/ai/assistantCore/executeGatedPlan";

describe("assistantCore executeGatedPlan", () => {
  it("runs executeAllowed when policy allows", async () => {
    const exec = vi.fn().mockResolvedValue(undefined);
    const actions: PusslaAgentAction[] = [{ type: "summarize_app_sections" }];
    const out = await runGatedPlanIfAllowed({
      userText: "visa sektioner",
      forceReadOnly: true,
      actions,
      executeAllowed: exec,
    });
    expect(out.ok).toBe(true);
    expect(exec).toHaveBeenCalledWith(actions);
  });

  it("does not execute when read-only blocks writes", async () => {
    const exec = vi.fn();
    const actions: PusslaAgentAction[] = [
      { type: "update_selected_placement", fields: { note: "x" } },
    ];
    const out = await runGatedPlanIfAllowed({
      userText: "ändra",
      forceReadOnly: true,
      actions,
      executeAllowed: exec,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.assistantMessage).toMatch(/Read-only|körpolicyn/i);
    }
    expect(exec).not.toHaveBeenCalled();
  });
});

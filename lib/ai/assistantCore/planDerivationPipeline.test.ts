import { describe, expect, it } from "vitest";
import { derivePlanFromParsedResponse } from "@/lib/ai/assistantCore/planDerivationPipeline";
import type { ParsedAgentResponse } from "@/lib/ai/types";

describe("assistantCore planDerivationPipeline", () => {
  it("derives plan and tracks unknown actions", () => {
    const parsed: ParsedAgentResponse = {
      reply: "",
      action: null,
      actions: [
        { type: "open_window", window: "iup" } as any,
        { type: "unknown_action" } as any,
      ],
      stopReason: "none",
      goalSummary: "mål",
    };
    const out = derivePlanFromParsedResponse({
      userText: "öppna iup",
      snapshot: {},
      parsed,
    });
    expect(out.goalSummary).toBe("mål");
    expect(out.stopReason).toBe("none");
    expect(out.llmPlan.length).toBe(1);
    expect(out.droppedUnknownCount).toBe(1);
    expect(Array.isArray(out.derived.actions)).toBe(true);
  });
});

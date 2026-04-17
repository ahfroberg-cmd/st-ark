import { describe, expect, it } from "vitest";
import { interpretLlmReply } from "@/lib/ai/assistantCore/responseInterpreter";

describe("assistantCore responseInterpreter", () => {
  it("flags blocked stop reason and keeps simplified reply", () => {
    const out = interpretLlmReply({
      stopReason: "unsafe",
      parsedReply: "Detta stoppas",
      llmPlanLength: 0,
      simplifyText: (s) => s.trim(),
    });
    expect(out.blockedByStopReason).toBe(true);
    expect(out.assistantReply).toBe("Detta stoppas");
  });

  it("drops agent json envelopes", () => {
    const out = interpretLlmReply({
      stopReason: "none",
      parsedReply: '{"reply":"hej","action":{"type":"open_window","window":"iup"}}',
      llmPlanLength: 0,
      simplifyText: (s) => s.trim(),
    });
    expect(out.assistantReply).toBeUndefined();
    expect(out.showedReply).toBe(false);
  });

  it("adds system warning when commitment text has no actions", () => {
    const out = interpretLlmReply({
      stopReason: "none",
      parsedReply: "Jag kommer nu att utföra dessa steg.",
      llmPlanLength: 0,
      simplifyText: (s) => s.trim(),
    });
    expect(out.systemReply).toMatch(/Inga åtgärder kördes/i);
  });
});

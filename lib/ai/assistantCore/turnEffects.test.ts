import { describe, expect, it } from "vitest";
import {
  buildPlanSelectedEventPayload,
  splitDerivedNoteMessages,
} from "@/lib/ai/assistantCore/turnEffects";

describe("assistantCore turnEffects", () => {
  it("builds plan_selected event payload", () => {
    const out = buildPlanSelectedEventPayload({
      source: "hierarchical",
      confidence: "high",
      actions: [{ type: "open_window", window: "iup" }],
      notes: ["n1"],
    });
    expect(out.kind).toBe("plan_selected");
    expect(out.stepCount).toBe(1);
    expect(out.notes).toEqual(["n1"]);
  });

  it("splits derived note messages by audience", () => {
    const split = splitDerivedNoteMessages([
      "LLM-planen stoppades, men den lokala planeringsmotorn hittade en genomförbar action-kedja.",
      "Jag öppnar BT-intygsvyn. Utskrift behöver sedan bekräftas/manuellt startas i webbläsaren.",
    ]);
    expect(split.systemMessages.length).toBe(2);
    expect(split.assistantMessages.length).toBe(1);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import * as plannerEngine from "@/lib/ai/agent/plannerEngine";
import { runHybridTurn } from "@/lib/ai/assistantCore/runHybridTurn";

vi.mock("@/lib/ai/agent/plannerEngine", async () => {
  const actual = await vi.importActual<typeof plannerEngine>("@/lib/ai/agent/plannerEngine");
  return {
    ...actual,
    deriveExecutionPlan: vi.fn(),
  };
});

const deriveMock = vi.mocked(plannerEngine.deriveExecutionPlan);

describe("assistantCore runHybridTurn", () => {
  beforeEach(() => {
    deriveMock.mockReset();
  });

  it("stops on clarifying question from planner", async () => {
    deriveMock.mockReturnValue({
      goalSummary: "x",
      actions: [],
      confidence: "low",
      source: "none",
      notes: [],
      clarifyingQuestion: "Vilken placering menar du?",
    });

    const append = vi.fn();
    const logEvent = vi.fn();
    const enterPlanning = vi.fn();
    const enterIdle = vi.fn();

    await runHybridTurn({
      userText: "test",
      snapshot: {},
      hasApiKey: true,
      append,
      logEvent,
      ui: {
        enterPlanning,
        setGoalSummaryFromLlm: vi.fn(),
        enterIdle,
        resetAfterMissingApiKey: vi.fn(),
      },
      buildAiMessages: () => [],
      sendLlm: vi.fn().mockRejectedValue(new Error("should not call LLM")),
      parseModelResponse: vi.fn(),
      simplifyText: (s) => s,
      runGatedPlan: vi.fn(),
    });

    expect(enterPlanning).toHaveBeenCalledWith("test");
    expect(append).toHaveBeenCalledWith("assistant", "Vilken placering menar du?");
    expect(logEvent).toHaveBeenCalledWith({
      kind: "needs_user",
      question: "Vilken placering menar du?",
    });
    expect(enterIdle).toHaveBeenCalled();
  });
});

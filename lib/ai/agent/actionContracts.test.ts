import { describe, expect, it } from "vitest";
import {
  isDestructiveAction,
  needsSelectionHint,
  shouldConfirmActionByMode,
  shouldVerifyActionOutcome,
} from "@/lib/ai/agent/actionContracts";

describe("actionContracts", () => {
  it("detects destructive actions", () => {
    expect(isDestructiveAction({ type: "delete_selected_course" })).toBe(true);
    expect(isDestructiveAction({ type: "open_window", window: "profile" })).toBe(false);
  });

  it("returns selection hints from registry", () => {
    expect(needsSelectionHint({ type: "save_selected_course" })).toBe("course");
    expect(needsSelectionHint({ type: "save_selected_placement" })).toBe("placement");
    expect(needsSelectionHint({ type: "open_window", window: "iup" })).toBeUndefined();
  });

  it("drives confirm policy by mode", () => {
    const dangerous = { type: "delete_selected_course" } as const;
    const safe = { type: "open_window", window: "profile" } as const;
    expect(shouldConfirmActionByMode(dangerous, "destructive")).toBe(true);
    expect(shouldConfirmActionByMode(safe, "destructive")).toBe(false);
    expect(shouldConfirmActionByMode(safe, "all")).toBe(false);
  });

  it("marks mutate/macro actions for verification", () => {
    expect(shouldVerifyActionOutcome({ type: "save_selected_course" })).toBe(true);
    expect(shouldVerifyActionOutcome({ type: "sync_course_milestones" })).toBe(true);
    expect(shouldVerifyActionOutcome({ type: "open_window", window: "iup" })).toBe(false);
  });
});


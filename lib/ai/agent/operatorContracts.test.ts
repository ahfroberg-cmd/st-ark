import { describe, expect, it } from "vitest";
import { filterInvalidOperatorActions, validateOperatorAction } from "@/lib/ai/agent/operatorContracts";

describe("operatorContracts", () => {
  it("validates transform factor bounds", () => {
    expect(
      validateOperatorAction({
        type: "transform_all_placements_duration",
        factor: 0.5,
        anchor: "start",
      })
    ).toEqual({ valid: true });
    const invalid = validateOperatorAction({
      type: "transform_all_placements_duration",
      factor: 1.5,
      anchor: "start",
    });
    expect(invalid.valid).toBe(false);
  });

  it("filters invalid operator actions in a batch", () => {
    const filtered = filterInvalidOperatorActions([
      { type: "shift_all_courses", months: 2, direction: "forward" },
      { type: "shift_all_courses", months: 99, direction: "forward" },
    ], { courses: [{ startDate: "2026-01-01" }] });
    expect(filtered.validActions).toHaveLength(1);
    expect(filtered.dropped).toHaveLength(1);
    expect(filtered.metadata[0]?.actionType).toBe("shift_all_courses");
  });

  it("applies snapshot preconditions for course operations", () => {
    const invalid = validateOperatorAction(
      { type: "shift_all_courses", months: 2, direction: "forward" },
      { courses: [] }
    );
    expect(invalid.valid).toBe(false);
    expect(String(invalid.reason || "")).toMatch(/inga kurser/i);
  });
});

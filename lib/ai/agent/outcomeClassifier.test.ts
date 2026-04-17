import { describe, expect, it } from "vitest";
import { classifyActionOutcome } from "@/lib/ai/agent/outcomeClassifier";

describe("classifyActionOutcome", () => {
  it("classifies delete no-target as noop", () => {
    const cls = classifyActionOutcome(
      { type: "delete_course_by_month_year", month: 12, year: 2021 },
      { ok: false, message: "Hittade ingen kurs som börjar 2021-12." }
    );
    expect(cls).toBe("noop");
  });

  it("classifies overlap as retryable", () => {
    const cls = classifyActionOutcome(
      {
        type: "create_typed_placement_from_range",
        placementType: "Klinisk tjänstgöring",
        title: "X",
        startDate: "2026-01-01",
        endDate: "2026-02-01",
      },
      { ok: false, message: "Placeringen överlappar en befintlig aktivitet." }
    );
    expect(cls).toBe("retryable_overlap");
  });

  it("classifies already-adjacent extend/shift as noop", () => {
    const extendCls = classifyActionOutcome(
      { type: "extend_last_placement", positionFromEnd: 2, months: 1 },
      { ok: false, message: "Placeringen ligger redan intill nästa block." }
    );
    expect(extendCls).toBe("noop");

    const shiftCls = classifyActionOutcome(
      { type: "shift_placement_from_end", positionFromEnd: 1, months: 1 },
      { ok: false, message: "Placeringen blev inte längre." }
    );
    expect(shiftCls).toBe("noop");
  });

  it("classifies unchanged transform-all-duration as noop", () => {
    const cls = classifyActionOutcome(
      { type: "transform_all_placements_duration", factor: 0.5, anchor: "start" },
      { ok: false, message: "Inga placeringar ändrades av den valda längdskalningen." }
    );
    expect(cls).toBe("noop");
  });
});


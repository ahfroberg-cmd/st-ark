import { describe, expect, it } from "vitest";
import {
  buildCanonicalPlannerSnapshot,
  buildCanonicalTimelineState,
  buildWorldStateIndex,
} from "@/lib/ai/agent/worldState";

describe("buildWorldStateIndex", () => {
  it("indexes course start months by year", () => {
    const index = buildWorldStateIndex({
      courses: [
        { startDate: "2021-02-10" },
        { startDate: "2021-11-01" },
        { startDate: "2021-11-15" },
        { startDate: "2022-01-05" },
      ],
    });
    expect(index.courseStartMonthsByYear[2021]).toEqual([2, 11]);
    expect(index.courseStartMonthsByYear[2022]).toEqual([1]);
  });

  it("derives BT window from BT-phased activities", () => {
    const index = buildWorldStateIndex({
      activities: [
        { phase: "BT", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-03-31T00:00:00Z" },
        { phase: "ST", exactStartISO: "2027-01-01T00:00:00Z", exactEndISO: "2027-03-31T00:00:00Z" },
        { phase: "BT", exactStartISO: "2026-04-01T00:00:00Z", exactEndISO: "2026-12-31T00:00:00Z" },
      ],
    });
    expect(index.btWindow).toEqual({ startDate: "2026-01-01", endDate: "2026-12-31" });
  });

  it("builds canonical timeline gaps deterministically", () => {
    const state = buildCanonicalTimelineState({
      activities: [
        { id: "b", label: "B", exactStartISO: "2026-03-01T00:00:00Z", exactEndISO: "2026-03-31T00:00:00Z" },
        { id: "a", label: "A", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-01-31T00:00:00Z" },
      ],
    });
    expect(state.placements.map((p) => p.id)).toEqual(["a", "b"]);
    expect(state.gaps).toEqual([
      {
        beforePlacementId: "a",
        afterPlacementId: "b",
        startDate: "2026-02-01",
        endDate: "2026-02-28",
      },
    ]);
  });

  it("adapts snapshot to canonical planner structure", () => {
    const adapted = buildCanonicalPlannerSnapshot({
      activities: [
        { id: "b", label: "B", exactStartISO: "2026-03-01T00:00:00Z", exactEndISO: "2026-03-31T00:00:00Z" },
        { id: "a", label: "A", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-01-31T00:00:00Z" },
      ],
      courses: [
        { id: "c2", title: "C2", startDate: "2026-05-01" },
        { id: "c1", title: "C1", startDate: "2026-02-01" },
      ],
    }) as any;
    expect(adapted.activities[0].id).toBe("a");
    expect(adapted.courses[0].id).toBe("c1");
  });
});


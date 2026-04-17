import { describe, expect, it } from "vitest";
import {
  buildResolvedEntityIndex,
  resolveLatestCourseTitle,
  resolveNextPlacementStartDateByPositionFromEnd,
  resolvePlacementCount,
  resolvePlacementPositionFromEndByLabel,
} from "@/lib/ai/agent/referenceResolver";

describe("referenceResolver", () => {
  it("builds entity index from activities and courses", () => {
    const idx = buildResolvedEntityIndex({
      activities: [
        { label: "VC", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-01T00:00:00Z" },
      ],
      courses: [{ title: "Journal club", startDate: "2026-03-01" }],
    });
    expect(idx.placements).toHaveLength(1);
    expect(idx.courses).toHaveLength(1);
    expect(idx.placements[0].label).toBe("VC");
  });

  it("resolves placement count", () => {
    const count = resolvePlacementCount({
      activities: [{}, {}, {}],
    });
    expect(count).toBe(3);
  });

  it("resolves latest course title by date", () => {
    const title = resolveLatestCourseTitle({
      courses: [
        { title: "A", startDate: "2026-01-01" },
        { title: "B", endDate: "2026-03-01" },
      ],
    });
    expect(title).toBe("B");
  });

  it("resolves placement position from end by label", () => {
    const pos = resolvePlacementPositionFromEndByLabel(
      {
        activities: [
          { label: "Psykos slutenvård", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-03-31T00:00:00Z" },
          { label: "Internmedicin", exactStartISO: "2026-04-01T00:00:00Z", exactEndISO: "2026-06-30T00:00:00Z" },
          { label: "Psykos slutenvård", exactStartISO: "2026-07-01T00:00:00Z", exactEndISO: "2026-08-31T00:00:00Z" },
          { label: "Kirurgi", exactStartISO: "2026-09-01T00:00:00Z", exactEndISO: "2026-10-31T00:00:00Z" },
        ],
      },
      "sista psykos slutenvård",
      1
    );
    expect(pos).toBe(2);
  });

  it("resolves next placement start date from position", () => {
    const nextStart = resolveNextPlacementStartDateByPositionFromEnd(
      {
        activities: [
          { label: "Psykos slutenvård", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-03-31T00:00:00Z" },
          { label: "Internmedicin", exactStartISO: "2026-04-01T00:00:00Z", exactEndISO: "2026-06-30T00:00:00Z" },
          { label: "Psykos slutenvård", exactStartISO: "2026-07-01T00:00:00Z", exactEndISO: "2026-08-31T00:00:00Z" },
          { label: "Kirurgi", exactStartISO: "2026-09-01T00:00:00Z", exactEndISO: "2026-10-31T00:00:00Z" },
        ],
      },
      2
    );
    expect(nextStart).toBe("2026-09-01");
  });
});


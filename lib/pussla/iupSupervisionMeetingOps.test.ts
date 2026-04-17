import { describe, expect, it } from "vitest";
import { addDaysToIsoDate, removeMeetingsOnDates, shiftMeetingsByDays } from "@/lib/pussla/iupSupervisionMeetingOps";

describe("iupSupervisionMeetingOps", () => {
  it("addDaysToIsoDate moves forward across month boundary", () => {
    expect(addDaysToIsoDate("2023-03-27", 7)).toBe("2023-04-03");
  });

  it("shiftMeetingsByDays preserves ids", () => {
    const next = shiftMeetingsByDays(
      [
        { id: "a", dateISO: "2023-01-01", focus: "Handledarträff" },
        { id: "b", dateISO: "2023-02-01" },
      ],
      7
    );
    expect(next[0].dateISO).toBe("2023-01-08");
    expect(next[0].id).toBe("a");
    expect(next[1].dateISO).toBe("2023-02-08");
  });

  it("removeMeetingsOnDates removes by YYYY-MM-DD", () => {
    const { next, removed } = removeMeetingsOnDates(
      [
        { id: "1", dateISO: "2023-04-03T00:00:00Z" },
        { id: "2", dateISO: "2023-05-01" },
      ],
      ["2023-04-03"]
    );
    expect(removed).toBe(1);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("2");
  });
});

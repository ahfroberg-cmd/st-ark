import { describe, expect, it } from "vitest";
import {
  coalesceSupervisionMeetingAdds,
  MAX_SUPERVISION_MEETING_DATES_PER_PLAN,
} from "@/lib/ai/agent/supervisionActionCoalesce";

describe("coalesceSupervisionMeetingAdds", () => {
  it("mergar flera meeting-steg till en batch", () => {
    const { actions, truncatedDates } = coalesceSupervisionMeetingAdds([
      { type: "add_iup_followup", followupType: "meeting", dateISO: "2024-03-01" },
      { type: "add_iup_supervision_meetings", dateISOs: ["2025-03-03", "2024-03-01"] },
    ]);
    expect(truncatedDates).toBe(0);
    expect(actions).toEqual([{ type: "add_iup_supervision_meetings", dateISOs: ["2024-03-01", "2025-03-03"] }]);
  });

  it("kapar till MAX per plan", () => {
    const { actions, truncatedDates } = coalesceSupervisionMeetingAdds([
      {
        type: "add_iup_supervision_meetings",
        dateISOs: Array.from({ length: 25 }, (_, i) => `2024-01-${String(i + 1).padStart(2, "0")}`),
      },
    ]);
    expect(actions).toHaveLength(1);
    expect((actions[0] as { dateISOs: string[] }).dateISOs.length).toBe(MAX_SUPERVISION_MEETING_DATES_PER_PLAN);
    expect(truncatedDates).toBe(10);
  });
});

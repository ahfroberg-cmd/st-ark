import { describe, expect, it } from "vitest";
import { filterUnknownActions } from "@/lib/ai/agent/actionRegistry";

describe("filterUnknownActions", () => {
  it("keeps registered actions and drops unknown", () => {
    const { known, dropped } = filterUnknownActions([
      { type: "navigate_lane", lane: "pussla" },
      { type: "not_a_real_action", foo: 1 } as any,
      { type: "open_window", window: "profile" },
    ]);
    expect(known.map((a) => a.type)).toEqual(["navigate_lane", "open_window"]);
    expect(dropped.length).toBe(1);
  });

  it("drops malformed entries", () => {
    const { known, dropped } = filterUnknownActions([null, {}, { type: 123 }] as any);
    expect(known).toEqual([]);
    expect(dropped.length).toBe(3);
  });
});

import { describe, expect, it } from "vitest";
import { actionLabel, getActionRisk } from "@/lib/ai/actionPolicy";

describe("actionPolicy", () => {
  it("marks navigation as auto", () => {
    const action = { type: "navigate_lane", lane: "placement" } as const;
    expect(getActionRisk(action)).toBe("auto");
    expect(actionLabel(action)).toMatch(/Navigera/i);
  });

  it("marks writes as confirm", () => {
    const createAction = {
      type: "create_placement_from_range",
      title: "Psykiatri",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
    } as const;
    expect(getActionRisk(createAction)).toBe("confirm");
    expect(actionLabel(createAction)).toContain("Psykiatri");

    const extendAction = { type: "extend_last_placement", months: 2 } as const;
    expect(getActionRisk(extendAction)).toBe("confirm");
    expect(actionLabel(extendAction)).toContain("Förläng placering");

    const shiftAction = { type: "shift_placement_from_end", positionFromEnd: 1, months: 1 } as const;
    expect(getActionRisk(shiftAction)).toBe("confirm");
    expect(actionLabel(shiftAction)).toContain("Flytta fram placering");

    const transformAction = {
      type: "transform_all_placements_duration",
      factor: 0.5,
      anchor: "start",
    } as const;
    expect(getActionRisk(transformAction)).toBe("confirm");
    expect(actionLabel(transformAction)).toContain("50%");

    const typedPlacement = {
      type: "create_typed_placement_from_range",
      placementType: "Forskning",
      title: "AI-projekt",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
    } as const;
    expect(getActionRisk(typedPlacement)).toBe("confirm");
    expect(actionLabel(typedPlacement)).toContain("forskning");
  });

  it("marks summaries and window navigation as auto", () => {
    const summaryAction = {
      type: "summarize_colleague_placements",
      placementName: "Psykos slutenvård",
      lineCount: 10,
      style: "akademisk_svenska",
    } as const;
    const openAction = { type: "open_window", window: "iup" } as const;
    expect(getActionRisk(summaryAction)).toBe("auto");
    expect(getActionRisk(openAction)).toBe("auto");
    expect(actionLabel(openAction)).toContain("Öppna fönster");
  });

  it("marks select and close-window actions as auto", () => {
    const selectAction = { type: "select_course", query: "METIS" } as const;
    const closeAction = { type: "close_window", window: "profile" } as const;
    expect(getActionRisk(selectAction)).toBe("auto");
    expect(getActionRisk(closeAction)).toBe("auto");
    expect(actionLabel(selectAction)).toContain("Välj kurs");
  });

  it("marks update selected actions as confirm", () => {
    const updPlacement = {
      type: "update_selected_placement",
      fields: { note: "Ny beskrivning" },
    } as const;
    const updCourse = {
      type: "update_selected_course",
      fields: { city: "Uppsala" },
    } as const;
    expect(getActionRisk(updPlacement)).toBe("confirm");
    expect(getActionRisk(updCourse)).toBe("confirm");
  });
});

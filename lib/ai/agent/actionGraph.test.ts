import { describe, expect, it } from "vitest";
import { expandPlanWithActionGraph } from "@/lib/ai/agent/actionGraph";

describe("expandPlanWithActionGraph", () => {
  it("injects open_window before set_iup_tab", () => {
    const res = expandPlanWithActionGraph(
      [{ type: "set_iup_tab", tab: "delmal" }],
      "visa delmål i iup"
    );
    expect(res.unresolved).toEqual([]);
    expect(res.actions).toEqual([
      { type: "open_window", window: "iup" },
      { type: "set_iup_tab", tab: "delmal" },
    ]);
  });

  it("injects select_course when hint exists", () => {
    const res = expandPlanWithActionGraph(
      [{ type: "save_selected_course" }],
      'spara kursen "Psykiatri intro"'
    );
    expect(res.unresolved).toEqual([]);
    expect(res.actions[0]).toEqual({
      type: "select_course",
      query: "Psykiatri intro",
    });
    expect(res.actions[1]).toEqual({ type: "save_selected_course" });
  });

  it("marks unresolved when selection is missing", () => {
    const res = expandPlanWithActionGraph([{ type: "save_selected_course" }], "spara vald kurs");
    expect(res.actions).toEqual([{ type: "save_selected_course" }]);
    expect(res.unresolved).toContain("course_selection_missing");
  });
});


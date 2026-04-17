import { describe, expect, it } from "vitest";
import { deriveExecutionPlan } from "@/lib/ai/agent/plannerEngine";

describe("deriveExecutionPlan", () => {
  it("prefers local supervisor update when competing plan drops fields", () => {
    const result = deriveExecutionPlan({
      userText:
        'Välj placeringen "Psykos slutenvård", sätt handledare till "Anna Andersson" och spara.',
      llmActions: [
        { type: "select_placement", query: "Psykos slutenvård" },
        { type: "select_placement", query: "Psykos slutenvård" },
        { type: "update_selected_placement", fields: {} },
        { type: "save_selected_placement" },
      ],
    });

    expect(result.actions).toHaveLength(3);
    expect(result.actions[0]?.type).toBe("select_placement");
    expect(result.actions[1]?.type).toBe("update_selected_placement");
    expect(result.actions[2]?.type).toBe("save_selected_placement");
    if (result.actions[1]?.type === "update_selected_placement") {
      expect(result.actions[1].fields.supervisor).toBe("Anna Andersson");
    }
  });

  it("prefers local inline handledare-plan when LLM update saknar supervisor", () => {
    const result = deriveExecutionPlan({
      userText: 'lägg till handledare "Anders Svensson" i Vårdcentral',
      llmActions: [
        { type: "select_placement", query: "Vårdcentral" },
        { type: "update_selected_placement", fields: {} },
        { type: "save_selected_placement" },
      ],
    });
    expect(result.actions).toHaveLength(3);
    if (result.actions[1]?.type === "update_selected_placement") {
      expect(result.actions[1].fields.supervisor).toBe("Anders Svensson");
    }
  });

  it("prefers local plan when LLM drops several placement fields", () => {
    const result = deriveExecutionPlan({
      userText:
        'Välj placeringen "Psykos slutenvård", sätt handledares specialitet till "Psykiatri", sätt handledares tjänsteställe till "SUS" och spara.',
      llmActions: [
        { type: "select_placement", query: "Psykos slutenvård" },
        { type: "update_selected_placement", fields: { supervisor: "Anna" } },
        { type: "save_selected_placement" },
      ],
    });
    expect(result.actions).toHaveLength(3);
    if (result.actions[1]?.type === "update_selected_placement") {
      expect(result.actions[1].fields.supervisorSpeciality).toBe("Psykiatri");
      expect(result.actions[1].fields.supervisorSite).toBe("SUS");
    }
  });
  it("injects open_window before set_iup_tab", () => {
    const res = deriveExecutionPlan({
      userText: "visa delmål i iup",
      llmActions: [{ type: "set_iup_tab", tab: "delmal" }],
    });
    expect(res.actions[0]).toEqual({ type: "open_window", window: "iup" });
    expect(res.actions[1]).toEqual({ type: "set_iup_tab", tab: "delmal" });
  });

  it("overrides llm unsupported when local plan exists", () => {
    const res = deriveExecutionPlan({
      userText: "flytta alla kurser bakåt två månader",
      llmStopReason: "unsupported",
      llmActions: [],
    });
    expect(res.actions.length).toBeGreaterThan(0);
    expect(res.notes.some((n) => n.startsWith("llm_stop_overridden_by_"))).toBe(true);
  });

  it("asks clarification when selected object is missing", () => {
    const res = deriveExecutionPlan({
      userText: "spara den valda kursen",
      llmActions: [{ type: "save_selected_course" }],
    });
    expect(res.actions).toEqual([]);
    expect(res.clarifyingQuestion).toMatch(/vilken kurs/i);
  });

  it("filters destructive actions without explicit destructive intent", () => {
    const res = deriveExecutionPlan({
      userText: "visa mig planen",
      llmActions: [{ type: "delete_course_by_month_year", month: 3, year: 2027 }],
    });
    expect(res.actions).toEqual([]);
    expect(res.clarifyingQuestion).toMatch(/destruktiv/i);
  });

  it("blocks llm plan when stop reason is unsafe", () => {
    const res = deriveExecutionPlan({
      userText: "gör något riskabelt",
      llmStopReason: "unsafe",
      llmActions: [{ type: "open_window", window: "iup" }],
    });
    expect(res.actions).toEqual([]);
    expect(res.clarifyingQuestion).toMatch(/sakerhet|säkerhet/i);
    expect(res.notes).toContain("llm_unsafe_blocked");
  });

  it("adds print intent note when no print action exists", () => {
    const res = deriveExecutionPlan({
      userText: "Skriv ut BT-ansökan nu",
      llmActions: [{ type: "open_window", window: "profile" }],
    });
    expect(res.notes.some((n) => n.startsWith("print_intent_"))).toBe(true);
  });

  it("does not block actionable plan when prompt also mentions undo", () => {
    const res = deriveExecutionPlan({
      userText: "återställ senaste ändringen och förläng nästsista placeringen",
      snapshot: {
        activities: [
          { label: "A", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-28T00:00:00Z" },
          { label: "B", exactStartISO: "2026-03-15T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
          { label: "C", exactStartISO: "2026-06-01T00:00:00Z", exactEndISO: "2026-07-31T00:00:00Z" },
        ],
      },
    });
    expect(res.actions).toEqual([
      { type: "extend_last_placement", positionFromEnd: 2, months: 1 },
    ]);
    expect(res.clarifyingQuestion).toBeUndefined();
  });

  it("keeps hierarchical clarification for gap-fill when no next placement exists", () => {
    const res = deriveExecutionPlan({
      userText: "förläng sista placeringen så glappet fylls",
      snapshot: {
        activities: [
          { label: "A", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-28T00:00:00Z" },
          { label: "B", exactStartISO: "2026-03-15T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
          { label: "C", exactStartISO: "2026-06-01T00:00:00Z", exactEndISO: "2026-07-31T00:00:00Z" },
        ],
      },
    });
    expect(res.actions).toEqual([]);
    expect(res.clarifyingQuestion).toMatch(/efterfoljande|efterföljande|slutdatum/i);
  });

  it("prefers compiler actions over hierarchical clarification for ordinal no-gap prompt", () => {
    const res = deriveExecutionPlan({
      userText: "förläng den nästsista placeringen så att den fyller glappet framåt",
      snapshot: {
        activities: [
          { id: "p1", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-28T00:00:00Z" },
          { id: "p2", exactStartISO: "2026-03-15T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
          { id: "p3", exactStartISO: "2026-06-01T00:00:00Z", exactEndISO: "2026-07-31T00:00:00Z" },
        ],
      },
    });
    expect(res.actions).toEqual([
      { type: "extend_last_placement", positionFromEnd: 2, endDate: "2026-05-31" },
    ]);
    expect(res.clarifyingQuestion).toBeUndefined();
  });

  it("enforces compiler-primary mode when requested", () => {
    const res = deriveExecutionPlan({
      userText: "förläng nästsista placeringen med en månad",
      planningMode: "enforce",
    });
    expect(res.actions).toEqual([]);
    expect(res.source).toBe("compiler");
    expect(res.notes).toContain("compiler_primary_enforced");
  });

  it("emits planning mode and world-state notes", () => {
    const res = deriveExecutionPlan({
      userText: "synka delmål på alla kurser",
      planningMode: "shadow",
      snapshot: { activities: [], courses: [{ startDate: "2026-01-01" }] },
    });
    expect(res.notes).toContain("planning_mode:shadow");
    expect(res.notes.some((n) => n.startsWith("world_state:placements="))).toBe(true);
    expect(res.notes.some((n) => n.startsWith("world_state:courses="))).toBe(true);
  });

  it("handles delete all courses as collection operator flow", () => {
    const res = deriveExecutionPlan({
      userText: "ta bort alla kurser",
      snapshot: {
        courses: [
          { id: "c1", title: "A", startDate: "2026-01-01" },
          { id: "c2", title: "B", startDate: "2026-02-01" },
        ],
      },
    });
    expect(res.actions).toEqual([
      { type: "select_collection", target: "courses", everyN: 1, limit: 200 },
      { type: "apply_operator_to_collection", operator: "delete" },
    ]);
    expect(res.clarifyingQuestion).toBeUndefined();
  });
});


import { describe, expect, it } from "vitest";
import { buildHierarchicalPlan } from "@/lib/ai/agent/hierarchicalPlanner";

describe("buildHierarchicalPlan", () => {
  it("builds stepwise plan for shifting all placements forward", () => {
    const result = buildHierarchicalPlan({
      userText: "flytta fram alla placeringar en månad",
      snapshot: {
        timeline: {
          placements: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
        },
      },
    });
    expect(result).not.toBeNull();
    expect(result?.actions.length).toBe(3);
    expect(result?.actions[0]).toEqual({
      type: "shift_placement_from_end",
      positionFromEnd: 1,
      months: 1,
    });
    expect(result?.actions[2]).toEqual({
      type: "shift_placement_from_end",
      positionFromEnd: 3,
      months: 1,
    });
  });

  it("asks clarification when all-placement scope is requested without countable snapshot", () => {
    const result = buildHierarchicalPlan({
      userText: "flytta fram alla placeringar två månader",
      snapshot: { foo: "bar" },
    });
    expect(result?.actions).toEqual([]);
    expect(result?.clarifyingQuestion).toMatch(/hur manga placeringar/i);
  });

  it("falls back to local parser for generic micro plans", () => {
    const result = buildHierarchicalPlan({
      userText: "öppna iup och sedan gå till delmål",
    });
    expect(result).not.toBeNull();
    expect(result?.actions.length).toBeGreaterThanOrEqual(1);
    expect(result?.actions[0]?.type).toBe("open_window");
  });

  it("prioritizes lägg till delmål … till <placering> over IUP/katalog-sammanfattning", () => {
    const result = buildHierarchicalPlan({
      userText: "lägg till delmål c2, c3 och a3 till Vårdcentral",
    });
    expect(result?.actions).toEqual([
      { type: "select_placement", query: "Vårdcentral" },
      {
        type: "update_selected_placement",
        fields: { milestones: ["C2", "C3", "A3"] },
      },
      { type: "save_selected_placement" },
    ]);
  });

  it("builds high-confidence course shift plan", () => {
    const result = buildHierarchicalPlan({
      userText: "flytta alla kurser bakåt två månader",
    });
    expect(result?.actions).toEqual([
      { type: "shift_all_courses", months: 2, direction: "backward" },
    ]);
  });

  it("builds overview plan across app sections and roles", () => {
    const result = buildHierarchicalPlan({
      userText: "Gå igenom hela appen med sidor och rollvyer",
    });
    expect(result?.actions.map((a) => a.type)).toEqual([
      "summarize_app_sections",
      "summarize_role_views",
    ]);
  });

  it("builds delete-courses plan for only existing months in target year", () => {
    const result = buildHierarchicalPlan({
      userText: "ta bort alla kurser för 2021",
      snapshot: {
        courses: [
          { startDate: "2021-02-10" },
          { startDate: "2021-11-01" },
          { startDate: "2022-01-05" },
        ],
      },
    });
    expect(result?.actions).toEqual([
      { type: "delete_course_by_month_year", month: 2, year: 2021 },
      { type: "delete_course_by_month_year", month: 11, year: 2021 },
    ]);
  });

  it("asks clarification when target year has no courses", () => {
    const result = buildHierarchicalPlan({
      userText: "ta bort alla kurser för 2021",
      snapshot: {
        courses: [{ startDate: "2022-01-05" }],
      },
    });
    expect(result?.actions).toEqual([]);
    expect(result?.clarifyingQuestion).toMatch(/inga kurser/i);
  });

  it("builds advanced BT distribution plan from world state", () => {
    const result = buildHierarchicalPlan({
      userText:
        "Lägg till fyra kliniska placeringar jämnt fördelade över min BT: vårdcentral, medicin, psykiatri och kirurgi. Öppna sedan intygssidan för BT",
      snapshot: {
        btWindow: { startDate: "2026-01-01", endDate: "2026-12-31" },
        activities: [],
      },
    });
    expect(result).not.toBeNull();
    expect(result?.actions.filter((a) => a.type === "create_typed_placement_from_range").length).toBe(4);
    const first = result?.actions[0] as any;
    expect(first.title).toBe("Vårdcentral");
    expect(result?.actions[result.actions.length - 1]).toEqual({
      type: "open_window",
      window: "bt_ansokan",
    });
  });

  it("distributes BT placements into free gaps without overlap", () => {
    const result = buildHierarchicalPlan({
      userText: "Lägg till fyra kliniska placeringar jämnt fördelade över min BT",
      snapshot: {
        btWindow: { startDate: "2026-01-01", endDate: "2026-12-31" },
        activities: [
          { phase: "BT", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-28T00:00:00Z" },
          { phase: "BT", exactStartISO: "2026-07-01T00:00:00Z", exactEndISO: "2026-07-31T00:00:00Z" },
          { phase: "BT", exactStartISO: "2026-12-01T00:00:00Z", exactEndISO: "2026-12-31T00:00:00Z" },
        ],
      },
    });
    const creates = (result?.actions || []).filter(
      (a) => a.type === "create_typed_placement_from_range"
    ) as any[];
    expect(creates.length).toBe(4);
    expect(creates.every((a) => a.startDate >= "2026-03-01" && a.endDate <= "2026-11-30")).toBe(true);
  });

  it("targets last named placement and extends to avoid forward gap", () => {
    const result = buildHierarchicalPlan({
      userText: "förläng sista psykos slutenvård så att det inte blir något glapp framåt",
      snapshot: {
        activities: [
          { label: "Psykos slutenvård", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-03-31T00:00:00Z" },
          { label: "Internmedicin", exactStartISO: "2026-04-01T00:00:00Z", exactEndISO: "2026-06-30T00:00:00Z" },
          { label: "Psykos slutenvård", exactStartISO: "2026-07-01T00:00:00Z", exactEndISO: "2026-08-31T00:00:00Z" },
          { label: "Kirurgi", exactStartISO: "2026-09-01T00:00:00Z", exactEndISO: "2026-10-31T00:00:00Z" },
        ],
      },
    });
    expect(result?.actions).toEqual([
      { type: "extend_last_placement", positionFromEnd: 2, endDate: "2026-08-31" },
    ]);
  });

  it("handles typo variant flrläng for named placement", () => {
    const result = buildHierarchicalPlan({
      userText: "flrläng den sista av de som heter psykos slutenvård med en månad",
      snapshot: {
        activities: [
          { label: "Psykos slutenvård", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-03-31T00:00:00Z" },
          { label: "Internmedicin", exactStartISO: "2026-04-01T00:00:00Z", exactEndISO: "2026-06-30T00:00:00Z" },
          { label: "Psykos slutenvård", exactStartISO: "2026-07-01T00:00:00Z", exactEndISO: "2026-08-31T00:00:00Z" },
        ],
      },
    });
    expect(result?.actions).toEqual([
      { type: "extend_last_placement", positionFromEnd: 1, months: 1 },
    ]);
  });

  it("parses one-word nästsista and fills forward gap", () => {
    const result = buildHierarchicalPlan({
      userText: "förläng den nästsista placeringen så att den fyller glappet framåt",
      snapshot: {
        activities: [
          { label: "A", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-28T00:00:00Z" },
          { label: "B", exactStartISO: "2026-03-15T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
          { label: "C", exactStartISO: "2026-06-01T00:00:00Z", exactEndISO: "2026-07-31T00:00:00Z" },
        ],
      },
    });
    expect(result?.actions).toEqual([
      { type: "extend_last_placement", positionFromEnd: 2, endDate: "2026-05-31" },
    ]);
  });

  it("parses andra från slutet as second from end", () => {
    const result = buildHierarchicalPlan({
      userText: "förläng andra från slutet så glappet försvinner",
      snapshot: {
        activities: [
          { label: "A", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-28T00:00:00Z" },
          { label: "B", exactStartISO: "2026-03-15T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
          { label: "C", exactStartISO: "2026-06-01T00:00:00Z", exactEndISO: "2026-07-31T00:00:00Z" },
        ],
      },
    });
    expect(result?.actions).toEqual([
      { type: "extend_last_placement", positionFromEnd: 2, endDate: "2026-05-31" },
    ]);
  });

  it("supports generic nth-from-end concept, not phrase-specific", () => {
    const result = buildHierarchicalPlan({
      userText: "förläng tredje från slutet så glappet försvinner",
      snapshot: {
        activities: [
          { label: "A", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-01-31T00:00:00Z" },
          { label: "B", exactStartISO: "2026-02-15T00:00:00Z", exactEndISO: "2026-03-31T00:00:00Z" },
          { label: "C", exactStartISO: "2026-05-01T00:00:00Z", exactEndISO: "2026-06-30T00:00:00Z" },
          { label: "D", exactStartISO: "2026-08-01T00:00:00Z", exactEndISO: "2026-09-30T00:00:00Z" },
        ],
      },
    });
    expect(result?.actions).toEqual([
      { type: "extend_last_placement", positionFromEnd: 3, endDate: "2026-04-30" },
    ]);
  });

  it("leaves compiler-first intents to intentCompiler layer", () => {
    const prompts = [
      "Justera alla glapp genom att förlänga placeringar som tidsmässigt ligger innan glappet",
      "fyll glappen mellan alla placeringar",
      "halvera alla placeringars längd, ta bort andra halvan",
      "lägg in placeringar i luckorna: alla ska vara psykos slutenvård",
    ];
    for (const prompt of prompts) {
      const result = buildHierarchicalPlan({
        userText: prompt,
        snapshot: {
          activities: [
            { id: "p1", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-15T00:00:00Z" },
            { id: "p2", exactStartISO: "2026-03-01T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
          ],
        },
      });
      expect(result).toBeNull();
    }
  });
});


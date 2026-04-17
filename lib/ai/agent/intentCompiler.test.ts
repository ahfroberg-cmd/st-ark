import { describe, expect, it } from "vitest";
import { compileIntentPlan } from "@/lib/ai/agent/intentCompiler";

describe("intentCompiler", () => {
  const snapshot = {
    activities: [
      { id: "p1", label: "A", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-15T00:00:00Z" },
      { id: "p2", label: "B", exactStartISO: "2026-03-01T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
      { id: "p3", label: "C", exactStartISO: "2026-06-01T00:00:00Z", exactEndISO: "2026-07-31T00:00:00Z" },
    ],
  };

  it("compiles fill-gaps intent into create actions", () => {
    const plan = compileIntentPlan({
      userText: "lägg in placeringar i luckorna: alla ska vara psykos slutenvård",
      snapshot,
    });
    expect(plan?.actions[0]?.type).toBe("create_typed_placement_from_range");
    expect(plan?.actions.length).toBe(2);
  });

  it("compiles repair-gaps intent into extend actions", () => {
    const plan = compileIntentPlan({
      userText: "justera alla glapp genom att förlänga placeringarna innan glappet",
      snapshot,
    });
    expect(plan?.actions[0]?.type).toBe("extend_last_placement");
    expect(plan?.actions.length).toBe(2);
  });

  it("compiles scale-duration intent into transform action", () => {
    const plan = compileIntentPlan({
      userText: "halvera alla placeringars längd",
      snapshot,
    });
    expect(plan?.actions).toEqual([
      { type: "transform_all_placements_duration", factor: 0.5, anchor: "start" },
    ]);
  });

  it("returns no_gaps clarification when relevant", () => {
    const plan = compileIntentPlan({
      userText: "fyll alla luckor med placeringar",
      snapshot: {
        activities: [
          { id: "x1", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-28T00:00:00Z" },
          { id: "x2", exactStartISO: "2026-03-01T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
        ],
      },
    });
    expect(plan?.actions).toEqual([]);
    expect(plan?.clarifyingQuestion).toMatch(/inga interna luckor/i);
  });

  it("compiles course milestone/distribution/sync pipeline", () => {
    const plan = compileIntentPlan({
      userText: "planera 10 kurser som täcker delmål, fördela 2 kurser per termin och synka",
      snapshot,
    });
    expect(plan?.actions.map((a) => a.type)).toEqual([
      "plan_courses_cover_course_milestones",
      "plan_timeline_distribution",
      "sync_course_milestones",
    ]);
  });

  it("compiles iup navigation pipeline", () => {
    const plan = compileIntentPlan({
      userText: "öppna iup delmål och visa översikt",
      snapshot,
    });
    expect(plan?.actions.map((a) => a.type)).toEqual([
      "open_window",
      "set_iup_tab",
      "summarize_goal_catalog",
    ]);
  });

  it("compiles cursor-style delete every other course", () => {
    const plan = compileIntentPlan({
      userText: "efter Beroendelära: ta bort varannan kurs",
      snapshot: {
        courses: [
          { id: "c1", title: "A", startDate: "2026-01-01" },
          { id: "c2", title: "Beroendelära", startDate: "2026-02-01" },
          { id: "c3", title: "C", startDate: "2026-03-01" },
          { id: "c4", title: "D", startDate: "2026-04-01" },
          { id: "c5", title: "E", startDate: "2026-05-01" },
        ],
      },
    });
    expect(plan?.actions).toEqual([
      { type: "select_collection", target: "courses", everyN: 2, afterQuery: "Beroendelära", limit: 200 },
      { type: "apply_operator_to_collection", operator: "delete" },
    ]);
  });

  it("compiles delete-all-courses intent without selection question", () => {
    const plan = compileIntentPlan({
      userText: "ta bort alla kurser",
      snapshot: {
        courses: [
          { id: "c1", title: "A", startDate: "2026-01-01" },
          { id: "c2", title: "B", startDate: "2026-02-01" },
        ],
      },
    });
    expect(plan?.actions).toEqual([
      { type: "select_collection", target: "courses", everyN: 1, limit: 200 },
      { type: "apply_operator_to_collection", operator: "delete" },
    ]);
  });

  it("compiles generic delete-all placements intent", () => {
    const plan = compileIntentPlan({
      userText: "ta bort alla placeringar",
      snapshot: {
        activities: [
          { id: "p1", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-01T00:00:00Z" },
        ],
      },
    });
    expect(plan?.actions).toEqual([
      { type: "select_collection", target: "placements", everyN: 1, limit: 200 },
      { type: "apply_operator_to_collection", operator: "delete" },
    ]);
  });

  it("compiles generic temporal delete intent for courses", () => {
    const plan = compileIntentPlan({
      userText: "ta bort alla kurser i 2021",
      snapshot: {
        courses: [
          { id: "c1", title: "A", startDate: "2021-02-01" },
          { id: "c2", title: "B", startDate: "2022-02-01" },
        ],
      },
    });
    expect(plan?.actions).toEqual([
      { type: "select_collection", target: "courses", everyN: 1, year: 2021, limit: 200 },
      { type: "apply_operator_to_collection", operator: "delete" },
    ]);
  });

  it("compiles delete intent for iup followups", () => {
    const plan = compileIntentPlan({
      userText: "ta bort alla handledartillfällen och progressionsbedömningar",
    });
    expect(plan?.actions).toEqual([
      { type: "clear_iup_followups", clearMeetings: true, clearAssessments: true },
    ]);
  });

  it("compiles add single iup followup intent with swedish date", () => {
    const plan = compileIntentPlan({
      userText: "lägg till handledningstillfälle 1 mars 2021",
    });
    expect(plan?.actions).toEqual([
      { type: "add_iup_followup", followupType: "meeting", dateISO: "2021-03-01" },
    ]);
  });

  it("compiles shift all handledarsamtal one week forward", () => {
    const plan = compileIntentPlan({
      userText: "flytta alla handledarsamtal en vecka framåt",
    });
    expect(plan?.actions).toEqual([{ type: "shift_iup_supervision_meetings", days: 7 }]);
  });

  it("compiles add iup followup for huvudhandledarsamtal synonym", () => {
    const plan = compileIntentPlan({
      userText: "lägg till huvudhandledarsamtal 2024-06-10",
    });
    expect(plan?.actions).toEqual([
      { type: "add_iup_followup", followupType: "meeting", dateISO: "2024-06-10" },
    ]);
  });

  it("compiles context/state introspection intents", () => {
    const ctx = compileIntentPlan({ userText: "visa aktiv kontext" });
    expect(ctx?.actions).toEqual([{ type: "get_active_context" }]);
    const gaps = compileIntentPlan({ userText: "lista glapp i tidslinjen" });
    expect(gaps?.actions).toEqual([{ type: "list_internal_gaps" }]);
    const preview = compileIntentPlan({ userText: "förhandsvisa diff om du tar bort vald kurs" });
    expect(preview?.actions).toEqual([
      { type: "preview_action_diff", action: { type: "delete_selected_course" } },
    ]);
  });

  it("compiles single-placement no-gap extend intent with ordinal", () => {
    const plan = compileIntentPlan({
      userText: "förläng den nästsista placeringen så att den fyller glappet framåt",
      snapshot: {
        activities: [
          { id: "p1", exactStartISO: "2026-01-01T00:00:00Z", exactEndISO: "2026-02-28T00:00:00Z" },
          { id: "p2", exactStartISO: "2026-03-15T00:00:00Z", exactEndISO: "2026-04-30T00:00:00Z" },
          { id: "p3", exactStartISO: "2026-06-01T00:00:00Z", exactEndISO: "2026-07-31T00:00:00Z" },
        ],
      },
    });
    expect(plan?.actions).toEqual([
      { type: "extend_last_placement", positionFromEnd: 2, endDate: "2026-05-31" },
    ]);
  });
});

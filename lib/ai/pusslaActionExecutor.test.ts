import { describe, expect, it, vi } from "vitest";
import { executePusslaAgentAction, type PusslaActionAdapter } from "@/lib/ai/pusslaActionExecutor";
import type { PusslaAgentAction } from "@/lib/ai/types";

function makeAdapter(): PusslaActionAdapter {
  return {
    navigateLane: vi.fn(async () => ({ ok: true, message: "lane" })),
    openWindow: vi.fn(async () => ({ ok: true, message: "window" })),
    closeWindow: vi.fn(async () => ({ ok: true, message: "close-window" })),
    setIupTab: vi.fn(async () => ({ ok: true, message: "iup-tab" })),
    createPlacementFromRange: vi.fn(async () => ({ ok: true, message: "create-placement" })),
    createTypedPlacementFromRange: vi.fn(async () => ({
      ok: true,
      message: "create-typed-placement",
    })),
    createCourseFromRange: vi.fn(async () => ({ ok: true, message: "create-course" })),
    createTypedCourseFromRange: vi.fn(async () => ({
      ok: true,
      message: "create-typed-course",
    })),
    selectPlacement: vi.fn(async () => ({ ok: true, message: "select-placement" })),
    selectCourse: vi.fn(async () => ({ ok: true, message: "select-course" })),
    updateSelectedPlacement: vi.fn(async () => ({ ok: true, message: "update-placement" })),
    updateSelectedCourse: vi.fn(async () => ({ ok: true, message: "update-course" })),
    saveSelectedPlacement: vi.fn(async () => ({ ok: true, message: "save-placement" })),
    saveSelectedCourse: vi.fn(async () => ({ ok: true, message: "save-course" })),
    setAllProfilePhoneNumbers: vi.fn(async () => ({ ok: true, message: "set-phones" })),
    extendLastPlacement: vi.fn(async () => ({ ok: true, message: "extend-placement" })),
    shiftPlacementFromEnd: vi.fn(async () => ({ ok: true, message: "shift-placement" })),
    transformAllPlacementsDuration: vi.fn(async () => ({
      ok: true,
      message: "transform-all-placements-duration",
    })),
    shiftAllCourses: vi.fn(async () => ({ ok: true, message: "shift-all-courses" })),
    rebalanceCoursesPerHalfYear: vi.fn(async () => ({
      ok: true,
      message: "rebalance-courses-half-year",
    })),
    planTimelineDistribution: vi.fn(async () => ({
      ok: true,
      message: "plan-timeline-distribution",
    })),
    deleteSelectedPlacement: vi.fn(async () => ({
      ok: true,
      message: "delete-selected-placement",
    })),
    deleteSelectedCourse: vi.fn(async () => ({
      ok: true,
      message: "delete-selected-course",
    })),
    deletePlacementByMonthYear: vi.fn(async () => ({ ok: true, message: "delete-placement" })),
    deleteCourseByMonthYear: vi.fn(async () => ({ ok: true, message: "delete-course" })),
    convertCourseToUtbildningsmoment: vi.fn(async () => ({
      ok: true,
      message: "convert-utb",
    })),
    planStFromSrTemplates: vi.fn(async () => ({ ok: true, message: "plan-st" })),
    planCoursesCoverCourseMilestones: vi.fn(async () => ({
      ok: true,
      message: "plan-courses-milestones",
    })),
    syncCourseMilestones: vi.fn(async () => ({
      ok: true,
      message: "sync-course-milestones",
    })),
    summarizeGoalCatalog: vi.fn(async () => ({
      ok: true,
      message: "summarize-goal-catalog",
    })),
    summarizeAppSections: vi.fn(async () => ({
      ok: true,
      message: "summarize-app-sections",
    })),
    summarizeRoleViews: vi.fn(async () => ({
      ok: true,
      message: "summarize-role-views",
    })),
    getActiveContext: vi.fn(async () => ({
      ok: true,
      message: "active-context",
    })),
    listTimelineEntities: vi.fn(async () => ({
      ok: true,
      message: "timeline-entities",
    })),
    listInternalGaps: vi.fn(async () => ({
      ok: true,
      message: "internal-gaps",
    })),
    verifyLastActionEffect: vi.fn(async () => ({
      ok: true,
      message: "verify-last-effect",
    })),
    previewActionDiff: vi.fn(async () => ({
      ok: true,
      message: "preview-diff",
    })),
    selectCollection: vi.fn(async () => ({
      ok: true,
      message: "select-collection",
    })),
    applyOperatorToCollection: vi.fn(async () => ({
      ok: true,
      message: "apply-operator",
    })),
    clearIupFollowups: vi.fn(async () => ({
      ok: true,
      message: "clear-iup-followups",
    })),
    addIupFollowup: vi.fn(async () => ({
      ok: true,
      message: "add-iup-followup",
    })),
    addIupSupervisionMeetings: vi.fn(async () => ({
      ok: true,
      message: "add-iup-supervision-meetings",
    })),
    shiftIupSupervisionMeetings: vi.fn(async () => ({
      ok: true,
      message: "shift-iup-supervision-meetings",
    })),
    removeIupSupervisionMeetingsByDates: vi.fn(async () => ({
      ok: true,
      message: "remove-iup-supervision-meetings",
    })),
    undoLastAgentMutation: vi.fn(async () => ({
      ok: true,
      message: "undo-last-agent-mutation",
    })),
    getColleaguePlacementDescriptions: vi.fn(() => [
      {
        userId: "u1",
        colleagueName: "Anna",
        placementName: "Psykos slutenvård",
        description: "Hög komplexitet och god handledning.",
        startDate: "2025-01-01",
        endDate: "2025-02-01",
      },
    ]),
    getColleagueCourseDescriptions: vi.fn(() => [
      {
        userId: "u1",
        colleagueName: "Anna",
        courseName: "METIS",
        description: "Bra koppling till kliniskt arbete.",
        startDate: "2025-03-01",
        endDate: "2025-03-05",
      },
    ]),
    preflightSnapshotBeforeMutation: vi.fn(async () => ({ ok: true, message: "snap-ok" })),
  };
}

describe("pusslaActionExecutor", () => {
  it("runs preflight before write actions", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = {
      type: "create_placement_from_range",
      title: "Psykiatri",
      startDate: "2026-01-01",
      endDate: "2026-02-01",
    };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(1);
    expect(adapter.createPlacementFromRange).toHaveBeenCalledTimes(1);
  });

  it("runs preflight before convert_course_to_utbildningsmoment", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = {
      type: "convert_course_to_utbildningsmoment",
      courseTitle: "Journal club",
      month: 5,
      year: 2026,
    };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(1);
    expect(adapter.convertCourseToUtbildningsmoment).toHaveBeenCalledWith(
      "Journal club",
      5,
      2026,
      undefined
    );
  });

  it("runs preflight before sync_course_milestones", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = { type: "sync_course_milestones" };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(1);
    expect(adapter.syncCourseMilestones).toHaveBeenCalledTimes(1);
  });

  it("runs preflight before shift_all_courses", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = {
      type: "shift_all_courses",
      months: 1,
      direction: "forward",
    };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(1);
    expect(adapter.shiftAllCourses).toHaveBeenCalledWith(1, "forward");
  });

  it("runs preflight before transform_all_placements_duration", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = {
      type: "transform_all_placements_duration",
      factor: 0.5,
      anchor: "start",
    };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(1);
    expect(adapter.transformAllPlacementsDuration).toHaveBeenCalledWith({
      factor: 0.5,
      anchor: "start",
    });
  });

  it("runs preflight before rebalance_courses_per_half_year", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = {
      type: "rebalance_courses_per_half_year",
      coursesPerHalfYear: 2,
    };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(1);
    expect(adapter.rebalanceCoursesPerHalfYear).toHaveBeenCalledWith(2);
  });

  it("runs preflight before plan_timeline_distribution", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = {
      type: "plan_timeline_distribution",
      target: "courses",
      cadence: "half_year",
      itemsPerCadence: 2,
    };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(1);
    expect(adapter.planTimelineDistribution).toHaveBeenCalledWith({
      target: "courses",
      cadence: "half_year",
      itemsPerCadence: 2,
    });
  });

  it("runs preflight before delete_selected_course", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = { type: "delete_selected_course" };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(1);
    expect(adapter.deleteSelectedCourse).toHaveBeenCalledTimes(1);
  });

  it("runs preflight before delete_selected_placement", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = { type: "delete_selected_placement" };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(1);
    expect(adapter.deleteSelectedPlacement).toHaveBeenCalledTimes(1);
  });

  it("does not run preflight for summarize_goal_catalog", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = { type: "summarize_goal_catalog" };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(res.message).toContain("summarize-goal-catalog");
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(0);
    expect(adapter.summarizeGoalCatalog).toHaveBeenCalledTimes(1);
  });

  it("does not run preflight for summarize_app_sections", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = { type: "summarize_app_sections" };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(0);
    expect(adapter.summarizeAppSections).toHaveBeenCalledTimes(1);
  });

  it("does not run preflight for summarize_role_views", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = { type: "summarize_role_views" };
    const res = await executePusslaAgentAction(adapter, action);
    expect(res.ok).toBe(true);
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(0);
    expect(adapter.summarizeRoleViews).toHaveBeenCalledTimes(1);
  });

  it("forwards description when converting course type", async () => {
    const adapter = makeAdapter();
    const action: PusslaAgentAction = {
      type: "convert_course_to_utbildningsmoment",
      courseTitle: "Journal club",
      month: 5,
      year: 2026,
      description: "Beskriv en artikel om psykos.",
    };
    await executePusslaAgentAction(adapter, action);
    expect(adapter.convertCourseToUtbildningsmoment).toHaveBeenCalledWith(
      "Journal club",
      5,
      2026,
      "Beskriv en artikel om psykos."
    );
  });

  it("does not preflight summary actions", async () => {
    const adapter = makeAdapter();
    const res = await executePusslaAgentAction(adapter, {
      type: "summarize_colleague_placements",
      placementName: "Psykos slutenvård",
      lineCount: 10,
      style: "akademisk_svenska",
    });
    expect(res.ok).toBe(true);
    expect(res.message).toContain("Hög komplexitet");
    expect(adapter.preflightSnapshotBeforeMutation).not.toHaveBeenCalled();
  });

  it("runs context/state actions without preflight", async () => {
    const adapter = makeAdapter();
    await executePusslaAgentAction(adapter, { type: "get_active_context" });
    await executePusslaAgentAction(adapter, { type: "list_internal_gaps" });
    await executePusslaAgentAction(adapter, {
      type: "list_timeline_entities",
      target: "placements",
    });
    await executePusslaAgentAction(adapter, { type: "verify_last_action_effect" });
    expect(adapter.preflightSnapshotBeforeMutation).not.toHaveBeenCalled();
    expect(adapter.getActiveContext).toHaveBeenCalledTimes(1);
    expect(adapter.listInternalGaps).toHaveBeenCalledTimes(1);
    expect(adapter.listTimelineEntities).toHaveBeenCalledTimes(1);
    expect(adapter.verifyLastActionEffect).toHaveBeenCalledTimes(1);
  });

  it("supports collection/operator/undo actions", async () => {
    const adapter = makeAdapter();
    await executePusslaAgentAction(adapter, {
      type: "select_collection",
      target: "courses",
      everyN: 2,
    });
    await executePusslaAgentAction(adapter, {
      type: "apply_operator_to_collection",
      operator: "delete",
    });
    await executePusslaAgentAction(adapter, {
      type: "undo_last_agent_mutation",
    });
    await executePusslaAgentAction(adapter, {
      type: "add_iup_followup",
      followupType: "meeting",
      dateISO: "2021-03-01",
    });
    expect(adapter.selectCollection).toHaveBeenCalledTimes(1);
    expect(adapter.applyOperatorToCollection).toHaveBeenCalledTimes(1);
    expect(adapter.undoLastAgentMutation).toHaveBeenCalledTimes(1);
    expect(adapter.addIupFollowup).toHaveBeenCalledTimes(1);
  });

  it("runs selection actions without preflight", async () => {
    const adapter = makeAdapter();
    await executePusslaAgentAction(adapter, {
      type: "select_placement",
      query: "Psykiatri",
    });
    expect(adapter.selectPlacement).toHaveBeenCalledWith("Psykiatri");
    expect(adapter.preflightSnapshotBeforeMutation).not.toHaveBeenCalled();
  });

  it("runs update_selected_course with preflight", async () => {
    const adapter = makeAdapter();
    await executePusslaAgentAction(adapter, {
      type: "update_selected_course",
      fields: { city: "Stockholm", note: "Uppdaterad notering" },
    });
    expect(adapter.preflightSnapshotBeforeMutation).toHaveBeenCalledTimes(1);
    expect(adapter.updateSelectedCourse).toHaveBeenCalledWith({
      city: "Stockholm",
      note: "Uppdaterad notering",
    });
  });
});

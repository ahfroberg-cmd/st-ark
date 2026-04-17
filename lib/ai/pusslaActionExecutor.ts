import {
  colleagueNameMatches,
  courseNameMatches,
  placementNameMatches,
} from "@/lib/ai/colleagueMatch";
import { redactContactInfoText } from "@/lib/ai/piiRedaction";
import type {
  AgentActionResult,
  PusslaAgentAction,
  SummarizeColleaguePlacementsAction,
} from "@/lib/ai/types";

type ActionResult = AgentActionResult;

const MAX_COLLEAGUE_MESSAGE_CHARS = 14_000;

export type ColleaguePlacementDescription = {
  userId: string;
  colleagueName: string;
  placementName: string;
  /** Om titel och klinik skiljer sig: extra fält för matchning (t.ex. kliniknamn). */
  placementNameAlt?: string;
  description: string;
  startDate: string;
  endDate: string;
};

export interface PusslaActionAdapter {
  navigateLane: (lane: "placement" | "course") => Promise<ActionResult> | ActionResult;
  openWindow: (window: string) => Promise<ActionResult> | ActionResult;
  closeWindow: (window: string) => Promise<ActionResult> | ActionResult;
  setIupTab: (
    tab: "handledning" | "progression" | "planering" | "delmal" | "rapport"
  ) => Promise<ActionResult> | ActionResult;
  createPlacementFromRange: (
    title: string,
    startDate: string,
    endDate: string
  ) => Promise<ActionResult> | ActionResult;
  createTypedPlacementFromRange: (
    placementType:
      | "Klinisk tjänstgöring"
      | "Vetenskapligt arbete"
      | "Förbättringsarbete"
      | "Auskultation"
      | "Forskning"
      | "Tjänstledighet"
      | "Föräldraledighet"
      | "Annan ledighet"
      | "Sjukskriven",
    title: string,
    startDate: string,
    endDate: string
  ) => Promise<ActionResult> | ActionResult;
  createCourseFromRange: (
    title: string,
    startDate: string,
    endDate: string
  ) => Promise<ActionResult> | ActionResult;
  createTypedCourseFromRange: (
    courseKind: "Kurs" | "Konferens" | "Annat" | "Utbildningsmoment",
    title: string,
    startDate: string,
    endDate: string
  ) => Promise<ActionResult> | ActionResult;
  selectPlacement: (query: string) => Promise<ActionResult> | ActionResult;
  selectCourse: (query: string) => Promise<ActionResult> | ActionResult;
  updateSelectedPlacement: (fields: {
    label?: string;
    placementType?:
      | "Klinisk tjänstgöring"
      | "Vetenskapligt arbete"
      | "Förbättringsarbete"
      | "Auskultation"
      | "Forskning"
      | "Tjänstledighet"
      | "Föräldraledighet"
      | "Annan ledighet"
      | "Sjukskriven";
    startDate?: string;
    endDate?: string;
    attendance?: number;
    supervisor?: string;
    supervisorSpeciality?: string;
    supervisorSite?: string;
    note?: string;
    phase?: "BT" | "ST";
    leaveSubtype?: string;
    milestones?: string[];
    btMilestones?: string[];
  }) => Promise<ActionResult> | ActionResult;
  updateSelectedCourse: (fields: {
    title?: string;
    courseKind?: "Kurs" | "Konferens" | "Annat" | "Utbildningsmoment";
    startDate?: string;
    endDate?: string;
    certificateDate?: string;
    city?: string;
    courseLeaderName?: string;
    note?: string;
    showAsInterval?: boolean;
    phase?: "BT" | "ST";
    btAssessment?: string;
    addToPlacement?: boolean;
    milestones?: string[];
    btMilestones?: string[];
  }) => Promise<ActionResult> | ActionResult;
  saveSelectedPlacement: () => Promise<ActionResult> | ActionResult;
  saveSelectedCourse: () => Promise<ActionResult> | ActionResult;
  setAllProfilePhoneNumbers: (phoneNumber: string) => Promise<ActionResult> | ActionResult;
  extendLastPlacement: (
    positionFromEnd?: number,
    months?: number,
    endDate?: string,
    placementTitle?: string
  ) => Promise<ActionResult> | ActionResult;
  shiftPlacementFromEnd: (
    positionFromEnd?: number,
    months?: number
  ) => Promise<ActionResult> | ActionResult;
  transformAllPlacementsDuration: (
    options: { factor: number; anchor?: "start" | "end" }
  ) => Promise<ActionResult> | ActionResult;
  shiftAllCourses: (
    months?: number,
    direction?: "forward" | "backward"
  ) => Promise<ActionResult> | ActionResult;
  rebalanceCoursesPerHalfYear: (
    coursesPerHalfYear?: number
  ) => Promise<ActionResult> | ActionResult;
  planTimelineDistribution: (options: {
    target: "courses" | "placements";
    cadence: "month" | "half_year" | "term" | "year";
    itemsPerCadence: number;
  }) => Promise<ActionResult> | ActionResult;
  deleteSelectedPlacement: () => Promise<ActionResult> | ActionResult;
  deleteSelectedCourse: () => Promise<ActionResult> | ActionResult;
  deletePlacementByMonthYear: (
    month: number,
    year: number
  ) => Promise<ActionResult> | ActionResult;
  deleteCourseByMonthYear: (
    month: number,
    year: number
  ) => Promise<ActionResult> | ActionResult;
  convertCourseToUtbildningsmoment: (
    courseTitle: string,
    month: number,
    year: number,
    description?: string
  ) => Promise<ActionResult> | ActionResult;
  planStFromSrTemplates: (
    options: {
      includePlacements?: boolean;
      includeCourses?: boolean;
      includeUtbildningsmoment?: boolean;
      monthlySupervision?: number;
      assessmentsPerTerm?: number;
    }
  ) => Promise<ActionResult> | ActionResult;
  planCoursesCoverCourseMilestones: (options?: {
    targetCount?: number;
  }) => Promise<ActionResult> | ActionResult;
  syncCourseMilestones: () => Promise<ActionResult> | ActionResult;
  summarizeGoalCatalog: () => Promise<ActionResult> | ActionResult;
  summarizeAppSections: () => Promise<ActionResult> | ActionResult;
  summarizeRoleViews: () => Promise<ActionResult> | ActionResult;
  getActiveContext: () => Promise<ActionResult> | ActionResult;
  listTimelineEntities: (options?: {
    target?: "placements" | "courses" | "all";
    limit?: number;
  }) => Promise<ActionResult> | ActionResult;
  listInternalGaps: () => Promise<ActionResult> | ActionResult;
  verifyLastActionEffect: () => Promise<ActionResult> | ActionResult;
  previewActionDiff: (action: PusslaAgentAction) => Promise<ActionResult> | ActionResult;
  selectCollection: (options: {
    target: "placements" | "courses";
    everyN?: number;
    afterQuery?: string;
    matchQuery?: string;
    beforeDate?: string;
    afterDate?: string;
    year?: number;
    month?: number;
    limit?: number;
  }) => Promise<ActionResult> | ActionResult;
  applyOperatorToCollection: (options: {
    operator: "delete" | "shift_placement_month" | "set_course_kind_utbildningsmoment";
    months?: number;
  }) => Promise<ActionResult> | ActionResult;
  clearIupFollowups: (options?: {
    clearMeetings?: boolean;
    clearAssessments?: boolean;
  }) => Promise<ActionResult> | ActionResult;
  addIupFollowup: (options: {
    followupType: "meeting" | "assessment";
    dateISO: string;
  }) => Promise<ActionResult> | ActionResult;
  addIupSupervisionMeetings: (options: { dateISOs: string[] }) => Promise<ActionResult> | ActionResult;
  shiftIupSupervisionMeetings: (options: { days: number }) => Promise<ActionResult> | ActionResult;
  removeIupSupervisionMeetingsByDates: (options: {
    dateISOs: string[];
  }) => Promise<ActionResult> | ActionResult;
  undoLastAgentMutation: () => Promise<ActionResult> | ActionResult;
  getColleaguePlacementDescriptions: () => ColleaguePlacementDescription[];
  getColleagueCourseDescriptions: () => {
    userId: string;
    colleagueName: string;
    courseName: string;
    courseNameAlt?: string;
    description: string;
    startDate: string;
    endDate: string;
  }[];
  preflightSnapshotBeforeMutation: (reason: string) => Promise<ActionResult>;
}

function placementHint(rows: ColleaguePlacementDescription[]): string {
  const names = [
    ...new Set(
      rows
        .flatMap((r) => [r.placementName, r.placementNameAlt].filter(Boolean) as string[])
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" }));
  if (names.length === 0) {
    return " Inga kollegbeskrivningar är inlästa (saknas delning/noteringar i databasen, eller kollegor i kliniken saknas).";
  }
  return ` Exempel på namn som finns i materialet: ${names.slice(0, 18).join(", ")}${names.length > 18 ? " …" : ""}.`;
}

function courseHint(
  rows: {
    courseName: string;
    courseNameAlt?: string;
  }[]
): string {
  const names = [
    ...new Set(
      rows
        .flatMap((r) => [r.courseName, r.courseNameAlt].filter(Boolean) as string[])
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" }));
  if (names.length === 0) {
    return " Inga kursbeskrivningar från kollegor är inlästa.";
  }
  return ` Exempel på kurser i materialet: ${names.slice(0, 18).join(", ")}${names.length > 18 ? " …" : ""}.`;
}

function summarizeColleaguePlacements(
  action: SummarizeColleaguePlacementsAction,
  rows: ColleaguePlacementDescription[]
): ActionResult {
  const filtered = rows.filter((r) => {
    if (
      !placementNameMatches(
        action.placementName,
        r.placementName,
        r.placementNameAlt
      )
    ) {
      return false;
    }
    if (action.colleagueName) {
      return colleagueNameMatches(action.colleagueName, r.colleagueName);
    }
    return true;
  });
  if (filtered.length === 0) {
    return {
      ok: false,
      message: `Hittade inga kollegbeskrivningar som matchar "${action.placementName}"${action.colleagueName ? ` för ${action.colleagueName}` : ""}.${placementHint(rows)}`,
    };
  }

  const sorted = [...filtered].sort((a, b) =>
    a.colleagueName.localeCompare(b.colleagueName, "sv", { sensitivity: "base" })
  );
  const blocks: string[] = [];
  for (const r of sorted) {
    const label = r.placementNameAlt
      ? `${r.placementName} (${r.placementNameAlt})`
      : r.placementName;
    const period =
      r.startDate && r.endDate
        ? `${r.startDate} – ${r.endDate}`
        : r.startDate || r.endDate || "";
    blocks.push(
      `**${r.colleagueName}** — ${label}${period ? ` · ${period}` : ""}\n${r.description.trim()}`
    );
  }

  let body = blocks.join("\n\n---\n\n");
  if (body.length > MAX_COLLEAGUE_MESSAGE_CHARS) {
    body =
      body.slice(0, MAX_COLLEAGUE_MESSAGE_CHARS) +
      "\n\n[Texten kapades av längdbegränsning — be om en specifik kollega eller kortare utdrag.]";
  }

  return { ok: true, message: redactContactInfoText(body, { redactAddressLikeLines: true }) };
}

function summarizeColleagueCourses(
  action: { courseName: string; lineCount?: number },
  rows: {
    userId: string;
    colleagueName: string;
    courseName: string;
    courseNameAlt?: string;
    description: string;
    startDate: string;
    endDate: string;
  }[]
): ActionResult {
  const filtered = rows.filter((r) =>
    courseNameMatches(action.courseName, r.courseName, r.courseNameAlt)
  );
  if (filtered.length === 0) {
    return {
      ok: false,
      message: `Hittade inga kollegbeskrivningar som matchar kursen "${action.courseName}".${courseHint(rows)}`,
    };
  }
  const sorted = [...filtered].sort((a, b) =>
    a.colleagueName.localeCompare(b.colleagueName, "sv", { sensitivity: "base" })
  );
  const blocks: string[] = [];
  for (const r of sorted) {
    const label = r.courseNameAlt ? `${r.courseName} (${r.courseNameAlt})` : r.courseName;
    const period =
      r.startDate && r.endDate
        ? `${r.startDate} – ${r.endDate}`
        : r.startDate || r.endDate || "";
    blocks.push(
      `**${r.colleagueName}** — ${label}${period ? ` · ${period}` : ""}\n${r.description.trim()}`
    );
  }
  let body = blocks.join("\n\n---\n\n");
  if (body.length > MAX_COLLEAGUE_MESSAGE_CHARS) {
    body =
      body.slice(0, MAX_COLLEAGUE_MESSAGE_CHARS) +
      "\n\n[Texten kapades av längdbegränsning.]";
  }
  return { ok: true, message: redactContactInfoText(body, { redactAddressLikeLines: true }) };
}

function isWriteAction(action: PusslaAgentAction): boolean {
  return (
    action.type === "create_placement_from_range" ||
    action.type === "create_typed_placement_from_range" ||
    action.type === "create_course_from_range" ||
    action.type === "create_typed_course_from_range" ||
    action.type === "update_selected_placement" ||
    action.type === "update_selected_course" ||
    action.type === "save_selected_placement" ||
    action.type === "save_selected_course" ||
    action.type === "extend_last_placement" ||
    action.type === "shift_placement_from_end" ||
    action.type === "transform_all_placements_duration" ||
    action.type === "shift_all_courses" ||
    action.type === "rebalance_courses_per_half_year" ||
    action.type === "plan_timeline_distribution" ||
    action.type === "delete_selected_placement" ||
    action.type === "delete_selected_course" ||
    action.type === "delete_placement_by_month_year" ||
    action.type === "delete_course_by_month_year" ||
    action.type === "convert_course_to_utbildningsmoment" ||
    action.type === "plan_st_from_sr_templates" ||
    action.type === "plan_courses_cover_course_milestones" ||
    action.type === "sync_course_milestones" ||
    action.type === "apply_operator_to_collection" ||
    action.type === "clear_iup_followups" ||
    action.type === "add_iup_followup" ||
    action.type === "add_iup_supervision_meetings" ||
    action.type === "shift_iup_supervision_meetings" ||
    action.type === "remove_iup_supervision_meetings_by_dates" ||
    action.type === "undo_last_agent_mutation"
  );
}

export async function executePusslaAgentAction(
  adapter: PusslaActionAdapter,
  action: PusslaAgentAction
): Promise<ActionResult> {
  const sanitizeResult = (res: ActionResult): ActionResult => ({
    ok: res.ok,
    message: redactContactInfoText(res.message, { redactAddressLikeLines: true }),
  });
  if (action.type === "set_all_profile_phone_numbers") {
    // Personuppgifter (kontaktinfo) ska inte hanteras av agenten.
    return sanitizeResult({
      ok: false,
      message: "Personuppgifter (telefonnummer) hanteras inte via agenten.",
    });
  }
  if (action.type === "summarize_colleague_placements") {
    return sanitizeResult(
      summarizeColleaguePlacements(
        action,
        adapter.getColleaguePlacementDescriptions()
      )
    );
  }
  if (action.type === "summarize_colleague_courses") {
    return sanitizeResult(
      summarizeColleagueCourses(action, adapter.getColleagueCourseDescriptions())
    );
  }
  if (action.type === "summarize_goal_catalog") {
    return sanitizeResult(await adapter.summarizeGoalCatalog());
  }
  if (action.type === "summarize_app_sections") {
    return sanitizeResult(await adapter.summarizeAppSections());
  }
  if (action.type === "summarize_role_views") {
    return sanitizeResult(await adapter.summarizeRoleViews());
  }
  if (action.type === "get_active_context") {
    return sanitizeResult(await adapter.getActiveContext());
  }
  if (action.type === "list_timeline_entities") {
    return sanitizeResult(
      await adapter.listTimelineEntities({
        target: action.target,
        limit: action.limit,
      })
    );
  }
  if (action.type === "list_internal_gaps") {
    return sanitizeResult(await adapter.listInternalGaps());
  }
  if (action.type === "verify_last_action_effect") {
    return sanitizeResult(await adapter.verifyLastActionEffect());
  }
  if (action.type === "preview_action_diff") {
    return sanitizeResult(await adapter.previewActionDiff(action.action));
  }
  if (action.type === "select_collection") {
    return sanitizeResult(
      await adapter.selectCollection({
        target: action.target,
        everyN: action.everyN,
        afterQuery: action.afterQuery,
        matchQuery: action.matchQuery,
        beforeDate: action.beforeDate,
        afterDate: action.afterDate,
        year: action.year,
        month: action.month,
        limit: action.limit,
      })
    );
  }

  if (isWriteAction(action)) {
    const snap = await adapter.preflightSnapshotBeforeMutation(
      `agent:${action.type}`
    );
    if (!snap.ok) return sanitizeResult(snap);
    const snapshotMessage = snap.message;
    const withSnapshot = (res: ActionResult): ActionResult =>
      sanitizeResult({
        ok: res.ok,
        message: `${snapshotMessage}\n${res.message}`,
      });

    switch (action.type) {
      case "create_placement_from_range":
        return withSnapshot(
          await adapter.createPlacementFromRange(
            action.title,
            action.startDate,
            action.endDate
          )
        );
      case "create_typed_placement_from_range":
        return withSnapshot(
          await adapter.createTypedPlacementFromRange(
            action.placementType,
            action.title,
            action.startDate,
            action.endDate
          )
        );
      case "create_course_from_range":
        return withSnapshot(
          await adapter.createCourseFromRange(
            action.title,
            action.startDate,
            action.endDate
          )
        );
      case "create_typed_course_from_range":
        return withSnapshot(
          await adapter.createTypedCourseFromRange(
            action.courseKind,
            action.title,
            action.startDate,
            action.endDate
          )
        );
      case "update_selected_placement":
        return withSnapshot(await adapter.updateSelectedPlacement(action.fields));
      case "update_selected_course":
        return withSnapshot(await adapter.updateSelectedCourse(action.fields));
      case "save_selected_placement":
        return withSnapshot(await adapter.saveSelectedPlacement());
      case "save_selected_course":
        return withSnapshot(await adapter.saveSelectedCourse());
      case "extend_last_placement":
        return withSnapshot(
          await adapter.extendLastPlacement(
            action.positionFromEnd,
            action.months,
            action.endDate,
            action.placementTitle
          )
        );
      case "shift_placement_from_end":
        return withSnapshot(
          await adapter.shiftPlacementFromEnd(action.positionFromEnd, action.months)
        );
      case "transform_all_placements_duration":
        return withSnapshot(
          await adapter.transformAllPlacementsDuration({
            factor: action.factor,
            anchor: action.anchor,
          })
        );
      case "shift_all_courses":
        return withSnapshot(
          await adapter.shiftAllCourses(action.months, action.direction)
        );
      case "rebalance_courses_per_half_year":
        return withSnapshot(
          await adapter.rebalanceCoursesPerHalfYear(action.coursesPerHalfYear)
        );
      case "plan_timeline_distribution":
        return withSnapshot(
          await adapter.planTimelineDistribution({
            target: action.target,
            cadence: action.cadence,
            itemsPerCadence: action.itemsPerCadence,
          })
        );
      case "delete_selected_placement":
        return withSnapshot(await adapter.deleteSelectedPlacement());
      case "delete_selected_course":
        return withSnapshot(await adapter.deleteSelectedCourse());
      case "delete_placement_by_month_year":
        return withSnapshot(
          await adapter.deletePlacementByMonthYear(action.month, action.year)
        );
      case "delete_course_by_month_year":
        return withSnapshot(
          await adapter.deleteCourseByMonthYear(action.month, action.year)
        );
      case "convert_course_to_utbildningsmoment":
        return withSnapshot(
          await adapter.convertCourseToUtbildningsmoment(
            action.courseTitle,
            action.month,
            action.year,
            action.description
          )
        );
      case "plan_st_from_sr_templates":
        return withSnapshot(
          await adapter.planStFromSrTemplates({
            includePlacements: action.includePlacements,
            includeCourses: action.includeCourses,
            includeUtbildningsmoment: action.includeUtbildningsmoment,
            monthlySupervision: action.monthlySupervision,
            assessmentsPerTerm: action.assessmentsPerTerm,
          })
        );
      case "plan_courses_cover_course_milestones":
        return withSnapshot(
          await adapter.planCoursesCoverCourseMilestones({
            targetCount: action.targetCount,
          })
        );
      case "sync_course_milestones":
        return withSnapshot(await adapter.syncCourseMilestones());
      case "apply_operator_to_collection":
        return withSnapshot(
          await adapter.applyOperatorToCollection({
            operator: action.operator,
            months: action.months,
          })
        );
      case "clear_iup_followups":
        return withSnapshot(
          await adapter.clearIupFollowups({
            clearMeetings: action.clearMeetings,
            clearAssessments: action.clearAssessments,
          })
        );
      case "add_iup_followup":
        return withSnapshot(
          await adapter.addIupFollowup({
            followupType: action.followupType,
            dateISO: action.dateISO,
          })
        );
      case "add_iup_supervision_meetings":
        return withSnapshot(
          await adapter.addIupSupervisionMeetings({
            dateISOs: Array.isArray(action.dateISOs) ? action.dateISOs : [],
          })
        );
      case "shift_iup_supervision_meetings":
        return withSnapshot(
          await adapter.shiftIupSupervisionMeetings({
            days: Number(action.days),
          })
        );
      case "remove_iup_supervision_meetings_by_dates":
        return withSnapshot(
          await adapter.removeIupSupervisionMeetingsByDates({
            dateISOs: Array.isArray(action.dateISOs) ? action.dateISOs : [],
          })
        );
      case "undo_last_agent_mutation":
        return withSnapshot(await adapter.undoLastAgentMutation());
      default:
        return sanitizeResult({ ok: false, message: "Okänd action." });
    }
  }

  switch (action.type) {
    case "navigate_lane":
      return sanitizeResult(await adapter.navigateLane(action.lane));
    case "open_window":
      return sanitizeResult(await adapter.openWindow(action.window));
    case "close_window":
      return sanitizeResult(await adapter.closeWindow(action.window));
    case "set_iup_tab":
      return sanitizeResult(await adapter.setIupTab(action.tab));
    case "select_placement":
      return sanitizeResult(await adapter.selectPlacement(action.query));
    case "select_course":
      return sanitizeResult(await adapter.selectCourse(action.query));
    default:
      return sanitizeResult({ ok: false, message: "Okänd action." });
  }
}

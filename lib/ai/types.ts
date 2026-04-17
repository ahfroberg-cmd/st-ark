export type AiProvider = "openai" | "anthropic" | "gemini";

export type AiRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface ProviderRequest {
  provider: AiProvider;
  apiKey: string;
  model?: string;
  messages: AiMessage[];
  temperature?: number;
}

export interface ProviderResponse {
  text: string;
  raw?: unknown;
}

export interface AgentActionResult {
  ok: boolean;
  message: string;
  actionType?: PusslaAgentActionType;
  verified?: boolean;
  changed?: boolean;
  changedCount?: number;
  code?: string;
  meta?: Record<string, unknown>;
}

export type PusslaAgentActionType =
  | "navigate_lane"
  | "open_window"
  | "close_window"
  | "set_iup_tab"
  | "create_placement_from_range"
  | "create_typed_placement_from_range"
  | "create_course_from_range"
  | "create_typed_course_from_range"
  | "select_placement"
  | "select_course"
  | "update_selected_placement"
  | "update_selected_course"
  | "save_selected_placement"
  | "save_selected_course"
  | "set_all_profile_phone_numbers"
  | "extend_last_placement"
  | "shift_placement_from_end"
  | "transform_all_placements_duration"
  | "shift_all_courses"
  | "rebalance_courses_per_half_year"
  | "plan_timeline_distribution"
  | "delete_selected_placement"
  | "delete_selected_course"
  | "delete_placement_by_month_year"
  | "delete_course_by_month_year"
  | "convert_course_to_utbildningsmoment"
  | "plan_st_from_sr_templates"
  | "plan_courses_cover_course_milestones"
  | "sync_course_milestones"
  | "summarize_goal_catalog"
  | "summarize_app_sections"
  | "summarize_role_views"
  | "summarize_colleague_placements"
  | "summarize_colleague_courses"
  | "get_active_context"
  | "list_timeline_entities"
  | "list_internal_gaps"
  | "verify_last_action_effect"
  | "preview_action_diff"
  | "select_collection"
  | "apply_operator_to_collection"
  | "clear_iup_followups"
  | "add_iup_followup"
  | "add_iup_supervision_meetings"
  | "shift_iup_supervision_meetings"
  | "remove_iup_supervision_meetings_by_dates"
  | "undo_last_agent_mutation";

export interface NavigateLaneAction {
  type: "navigate_lane";
  lane: "placement" | "course";
}

export interface OpenWindowAction {
  type: "open_window";
  window:
    | "iup"
    | "hemklinik"
    | "scan_intyg"
    | "bt_ansokan"
    | "specialistansokan"
    | "profile"
    | "about"
    | "report"
    | "settings"
    | "sta3"
    | "course_prep"
    | "preview"
    | "milestone_overview";
}

export interface CloseWindowAction {
  type: "close_window";
  window:
    | "iup"
    | "hemklinik"
    | "scan_intyg"
    | "bt_ansokan"
    | "specialistansokan"
    | "profile"
    | "about"
    | "report"
    | "settings"
    | "sta3"
    | "course_prep"
    | "preview"
    | "milestone_overview";
}

export interface SetIupTabAction {
  type: "set_iup_tab";
  tab: "handledning" | "progression" | "planering" | "delmal" | "rapport";
}

export interface CreatePlacementFromRangeAction {
  type: "create_placement_from_range";
  title: string;
  startDate: string;
  endDate: string;
}

export interface CreateTypedPlacementFromRangeAction {
  type: "create_typed_placement_from_range";
  placementType:
    | "Klinisk tjänstgöring"
    | "Vetenskapligt arbete"
    | "Förbättringsarbete"
    | "Auskultation"
    | "Forskning"
    | "Tjänstledighet"
    | "Föräldraledighet"
    | "Annan ledighet"
    | "Sjukskriven";
  title: string;
  startDate: string;
  endDate: string;
}

export interface CreateCourseFromRangeAction {
  type: "create_course_from_range";
  title: string;
  startDate: string;
  endDate: string;
}

export interface CreateTypedCourseFromRangeAction {
  type: "create_typed_course_from_range";
  courseKind: "Kurs" | "Konferens" | "Annat" | "Utbildningsmoment";
  title: string;
  startDate: string;
  endDate: string;
}

export interface SelectPlacementAction {
  type: "select_placement";
  query: string;
}

export interface SelectCourseAction {
  type: "select_course";
  query: string;
}

export interface UpdateSelectedPlacementAction {
  type: "update_selected_placement";
  fields: {
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
  };
}

export interface UpdateSelectedCourseAction {
  type: "update_selected_course";
  fields: {
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
  };
}

export interface SaveSelectedPlacementAction {
  type: "save_selected_placement";
}

export interface SaveSelectedCourseAction {
  type: "save_selected_course";
}

export interface SetAllProfilePhoneNumbersAction {
  type: "set_all_profile_phone_numbers";
  phoneNumber: string;
}

export interface ExtendLastPlacementAction {
  type: "extend_last_placement";
  positionFromEnd?: number; // 1 = sista, 2 = näst sista, ...
  months?: number; // positiva = förläng, negativa = förkorta
  endDate?: string;
  /** Om satt: förläng denna placering (matchas mot label/typ), i stället för position från slutet. */
  placementTitle?: string;
}

export interface ShiftPlacementFromEndAction {
  type: "shift_placement_from_end";
  positionFromEnd?: number; // 1 = sista, 2 = näst sista, ...
  months?: number;
}

export interface TransformAllPlacementsDurationAction {
  type: "transform_all_placements_duration";
  /** Multiplikativ faktor, t.ex. 0.5 för halvering. */
  factor: number;
  /** Vilken sida av placeringen som behålls. */
  anchor?: "start" | "end";
}

export interface ShiftAllCoursesAction {
  type: "shift_all_courses";
  months?: number;
  direction?: "forward" | "backward";
}

export interface RebalanceCoursesPerHalfYearAction {
  type: "rebalance_courses_per_half_year";
  coursesPerHalfYear?: number;
}

export interface PlanTimelineDistributionAction {
  type: "plan_timeline_distribution";
  target: "courses" | "placements";
  cadence: "month" | "half_year" | "term" | "year";
  itemsPerCadence: number;
}

export interface DeleteSelectedPlacementAction {
  type: "delete_selected_placement";
}

export interface DeleteSelectedCourseAction {
  type: "delete_selected_course";
}

export interface DeletePlacementByMonthYearAction {
  type: "delete_placement_by_month_year";
  month: number; // 1-12
  year: number; // YYYY
}

export interface DeleteCourseByMonthYearAction {
  type: "delete_course_by_month_year";
  month: number; // 1-12
  year: number; // YYYY
}

export interface ConvertCourseToUtbildningsmomentAction {
  type: "convert_course_to_utbildningsmoment";
  courseTitle: string;
  month: number;
  year: number;
  description?: string;
}

export interface PlanStFromSrTemplatesAction {
  type: "plan_st_from_sr_templates";
  includePlacements?: boolean;
  includeCourses?: boolean;
  includeUtbildningsmoment?: boolean;
  monthlySupervision?: number;
  assessmentsPerTerm?: number;
}

export interface PlanCoursesCoverCourseMilestonesAction {
  type: "plan_courses_cover_course_milestones";
  /** Önskat antal kurser på tidslinjen (fylls ut med fler METIS-kurser om täckning kräver färre). */
  targetCount?: number;
}

export interface SyncCourseMilestonesAction {
  type: "sync_course_milestones";
}

export interface SummarizeGoalCatalogAction {
  type: "summarize_goal_catalog";
}

export interface SummarizeAppSectionsAction {
  type: "summarize_app_sections";
}

export interface SummarizeRoleViewsAction {
  type: "summarize_role_views";
}

export interface SummarizeColleaguePlacementsAction {
  type: "summarize_colleague_placements";
  placementName: string;
  /** Om satt: filtrera till denna kollega (förnamn räcker ofta). */
  colleagueName?: string;
  lineCount?: number;
  style?: "akademisk_svenska" | "neutral";
}

export interface SummarizeColleagueCoursesAction {
  type: "summarize_colleague_courses";
  courseName: string;
  lineCount?: number;
  style?: "akademisk_svenska" | "neutral";
}

export interface GetActiveContextAction {
  type: "get_active_context";
}

export interface ListTimelineEntitiesAction {
  type: "list_timeline_entities";
  target?: "placements" | "courses" | "all";
  limit?: number;
}

export interface ListInternalGapsAction {
  type: "list_internal_gaps";
}

export interface VerifyLastActionEffectAction {
  type: "verify_last_action_effect";
}

export interface PreviewActionDiffAction {
  type: "preview_action_diff";
  action: PusslaAgentAction;
}

export interface SelectCollectionAction {
  type: "select_collection";
  target: "placements" | "courses";
  everyN?: number;
  afterQuery?: string;
  matchQuery?: string;
  beforeDate?: string;
  afterDate?: string;
  year?: number;
  month?: number;
  limit?: number;
}

export interface ApplyOperatorToCollectionAction {
  type: "apply_operator_to_collection";
  operator:
    | "delete"
    | "shift_placement_month"
    | "set_course_kind_utbildningsmoment";
  months?: number;
}

export interface ClearIupFollowupsAction {
  type: "clear_iup_followups";
  clearMeetings?: boolean;
  clearAssessments?: boolean;
}

export interface AddIupFollowupAction {
  type: "add_iup_followup";
  followupType: "meeting" | "assessment";
  dateISO: string;
}

/** Flera handledarsamtal / huvudhandledarsamtal (samma IUP-mötestyp som add_iup_followup meeting). */
export interface AddIupSupervisionMeetingsAction {
  type: "add_iup_supervision_meetings";
  dateISOs: string[];
}

/** Flytta alla IUP-handledarsamtal med ett fast antal dagar (7 = en vecka framåt). */
export interface ShiftIupSupervisionMeetingsAction {
  type: "shift_iup_supervision_meetings";
  days: number;
}

/** Ta bort handledarsamtal vars datum (YYYY-MM-DD) finns i listan. */
export interface RemoveIupSupervisionMeetingsByDatesAction {
  type: "remove_iup_supervision_meetings_by_dates";
  dateISOs: string[];
}

export interface UndoLastAgentMutationAction {
  type: "undo_last_agent_mutation";
}

export type PusslaAgentAction =
  | NavigateLaneAction
  | OpenWindowAction
  | CloseWindowAction
  | SetIupTabAction
  | CreatePlacementFromRangeAction
  | CreateTypedPlacementFromRangeAction
  | CreateCourseFromRangeAction
  | CreateTypedCourseFromRangeAction
  | SelectPlacementAction
  | SelectCourseAction
  | UpdateSelectedPlacementAction
  | UpdateSelectedCourseAction
  | SaveSelectedPlacementAction
  | SaveSelectedCourseAction
  | SetAllProfilePhoneNumbersAction
  | ExtendLastPlacementAction
  | ShiftPlacementFromEndAction
  | TransformAllPlacementsDurationAction
  | ShiftAllCoursesAction
  | RebalanceCoursesPerHalfYearAction
  | PlanTimelineDistributionAction
  | DeleteSelectedPlacementAction
  | DeleteSelectedCourseAction
  | DeletePlacementByMonthYearAction
  | DeleteCourseByMonthYearAction
  | ConvertCourseToUtbildningsmomentAction
  | PlanStFromSrTemplatesAction
  | PlanCoursesCoverCourseMilestonesAction
  | SyncCourseMilestonesAction
  | SummarizeGoalCatalogAction
  | SummarizeAppSectionsAction
  | SummarizeRoleViewsAction
  | SummarizeColleaguePlacementsAction
  | SummarizeColleagueCoursesAction
  | GetActiveContextAction
  | ListTimelineEntitiesAction
  | ListInternalGapsAction
  | VerifyLastActionEffectAction
  | PreviewActionDiffAction
  | SelectCollectionAction
  | ApplyOperatorToCollectionAction
  | ClearIupFollowupsAction
  | AddIupFollowupAction
  | AddIupSupervisionMeetingsAction
  | ShiftIupSupervisionMeetingsAction
  | RemoveIupSupervisionMeetingsByDatesAction
  | UndoLastAgentMutationAction;

/** Varför agenten inte kör actions (frivilligt fält i modellens JSON). */
export type AgentModelStopReason = "none" | "needs_user" | "unsupported" | "unsafe" | "blocked";

export interface ParsedAgentResponse {
  reply: string;
  /** Kort operativt mål – visas för användaren, krävs inte för bakåtkompatibilitet. */
  goalSummary?: string;
  /** Om satt: ställ fråga, kör inga actions. */
  clarifyingQuestion?: string | null;
  stopReason?: AgentModelStopReason;
  action: PusslaAgentAction | null;
  actions?: PusslaAgentAction[];
}

export function isPusslaAgentAction(value: unknown): value is PusslaAgentAction {
  if (!value || typeof value !== "object") return false;
  const type = String((value as any).type || "");
  const known: Record<string, true> = {
    navigate_lane: true,
    open_window: true,
    close_window: true,
    set_iup_tab: true,
    create_placement_from_range: true,
    create_typed_placement_from_range: true,
    create_course_from_range: true,
    create_typed_course_from_range: true,
    select_placement: true,
    select_course: true,
    update_selected_placement: true,
    update_selected_course: true,
    save_selected_placement: true,
    save_selected_course: true,
    set_all_profile_phone_numbers: true,
    extend_last_placement: true,
    shift_placement_from_end: true,
    transform_all_placements_duration: true,
    shift_all_courses: true,
    rebalance_courses_per_half_year: true,
    plan_timeline_distribution: true,
    delete_selected_placement: true,
    delete_selected_course: true,
    delete_placement_by_month_year: true,
    delete_course_by_month_year: true,
    convert_course_to_utbildningsmoment: true,
    plan_st_from_sr_templates: true,
    plan_courses_cover_course_milestones: true,
    sync_course_milestones: true,
    summarize_goal_catalog: true,
    summarize_app_sections: true,
    summarize_role_views: true,
    summarize_colleague_placements: true,
    summarize_colleague_courses: true,
    get_active_context: true,
    list_timeline_entities: true,
    list_internal_gaps: true,
    verify_last_action_effect: true,
    preview_action_diff: true,
    select_collection: true,
    apply_operator_to_collection: true,
    clear_iup_followups: true,
    add_iup_followup: true,
    add_iup_supervision_meetings: true,
    shift_iup_supervision_meetings: true,
    remove_iup_supervision_meetings_by_dates: true,
    undo_last_agent_mutation: true,
  };
  return Boolean(known[type]);
}

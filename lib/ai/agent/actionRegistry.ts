import type { PusslaAgentAction, PusslaAgentActionType } from "@/lib/ai/types";
import { isPusslaAgentAction } from "@/lib/ai/types";

export type ActionCapability = "read" | "navigate" | "mutate" | "macro";

export interface RegisteredActionMeta {
  type: PusslaAgentActionType;
  capability: ActionCapability;
  /** Kräver att användaren valt objekt i UI (ungefärlig heuristik). */
  needsSelectionHint?: "placement" | "course" | "either";
  destructive: boolean;
  shortLabel: string;
}

/** En källa till sanning: alla typer som isPusslaAgentAction accepterar ska finnas här. */
export const ACTION_REGISTRY: Record<PusslaAgentActionType, RegisteredActionMeta> = {
  navigate_lane: {
    type: "navigate_lane",
    capability: "navigate",
    destructive: false,
    shortLabel: "Byt tidslinje",
  },
  open_window: {
    type: "open_window",
    capability: "navigate",
    destructive: false,
    shortLabel: "Öppna fönster",
  },
  close_window: {
    type: "close_window",
    capability: "navigate",
    destructive: false,
    shortLabel: "Stäng fönster",
  },
  set_iup_tab: {
    type: "set_iup_tab",
    capability: "navigate",
    destructive: false,
    shortLabel: "IUP-flik",
  },
  create_placement_from_range: {
    type: "create_placement_from_range",
    capability: "mutate",
    destructive: false,
    shortLabel: "Skapa placering",
  },
  create_typed_placement_from_range: {
    type: "create_typed_placement_from_range",
    capability: "mutate",
    destructive: false,
    shortLabel: "Skapa aktivitet",
  },
  create_course_from_range: {
    type: "create_course_from_range",
    capability: "mutate",
    destructive: false,
    shortLabel: "Skapa kurs",
  },
  create_typed_course_from_range: {
    type: "create_typed_course_from_range",
    capability: "mutate",
    destructive: false,
    shortLabel: "Skapa kurs/typ",
  },
  select_placement: {
    type: "select_placement",
    capability: "navigate",
    destructive: false,
    shortLabel: "Välj placering",
  },
  select_course: {
    type: "select_course",
    capability: "navigate",
    destructive: false,
    shortLabel: "Välj kurs",
  },
  update_selected_placement: {
    type: "update_selected_placement",
    capability: "mutate",
    needsSelectionHint: "placement",
    destructive: false,
    shortLabel: "Uppdatera placering",
  },
  update_selected_course: {
    type: "update_selected_course",
    capability: "mutate",
    needsSelectionHint: "course",
    destructive: false,
    shortLabel: "Uppdatera kurs",
  },
  save_selected_placement: {
    type: "save_selected_placement",
    capability: "mutate",
    needsSelectionHint: "placement",
    destructive: false,
    shortLabel: "Spara placering",
  },
  save_selected_course: {
    type: "save_selected_course",
    capability: "mutate",
    needsSelectionHint: "course",
    destructive: false,
    shortLabel: "Spara kurs",
  },
  set_all_profile_phone_numbers: {
    type: "set_all_profile_phone_numbers",
    capability: "mutate",
    destructive: false,
    shortLabel: "Telefon (spärrad)",
  },
  extend_last_placement: {
    type: "extend_last_placement",
    capability: "mutate",
    destructive: false,
    shortLabel: "Förläng placering",
  },
  shift_placement_from_end: {
    type: "shift_placement_from_end",
    capability: "mutate",
    destructive: false,
    shortLabel: "Flytta placering",
  },
  transform_all_placements_duration: {
    type: "transform_all_placements_duration",
    capability: "macro",
    destructive: false,
    shortLabel: "Skala placeringstid",
  },
  shift_all_courses: {
    type: "shift_all_courses",
    capability: "macro",
    destructive: false,
    shortLabel: "Flytta alla kurser",
  },
  rebalance_courses_per_half_year: {
    type: "rebalance_courses_per_half_year",
    capability: "macro",
    destructive: false,
    shortLabel: "Omplanera kurser/halvår",
  },
  plan_timeline_distribution: {
    type: "plan_timeline_distribution",
    capability: "macro",
    destructive: false,
    shortLabel: "Fördelning tidslinje",
  },
  delete_selected_placement: {
    type: "delete_selected_placement",
    capability: "mutate",
    needsSelectionHint: "placement",
    destructive: true,
    shortLabel: "Ta bort vald placering",
  },
  delete_selected_course: {
    type: "delete_selected_course",
    capability: "mutate",
    needsSelectionHint: "course",
    destructive: true,
    shortLabel: "Ta bort vald kurs",
  },
  delete_placement_by_month_year: {
    type: "delete_placement_by_month_year",
    capability: "mutate",
    destructive: true,
    shortLabel: "Ta bort placering (datum)",
  },
  delete_course_by_month_year: {
    type: "delete_course_by_month_year",
    capability: "mutate",
    destructive: true,
    shortLabel: "Ta bort kurs (datum)",
  },
  convert_course_to_utbildningsmoment: {
    type: "convert_course_to_utbildningsmoment",
    capability: "mutate",
    destructive: true,
    shortLabel: "Konvertera till moment",
  },
  plan_st_from_sr_templates: {
    type: "plan_st_from_sr_templates",
    capability: "macro",
    destructive: false,
    shortLabel: "SR-mallar ST-plan",
  },
  plan_courses_cover_course_milestones: {
    type: "plan_courses_cover_course_milestones",
    capability: "macro",
    destructive: false,
    shortLabel: "METIS-kurser/delmål",
  },
  sync_course_milestones: {
    type: "sync_course_milestones",
    capability: "macro",
    destructive: false,
    shortLabel: "Synka kursdelmål",
  },
  summarize_goal_catalog: {
    type: "summarize_goal_catalog",
    capability: "read",
    destructive: false,
    shortLabel: "Delmålskatalog",
  },
  summarize_app_sections: {
    type: "summarize_app_sections",
    capability: "read",
    destructive: false,
    shortLabel: "Appöversikt",
  },
  summarize_role_views: {
    type: "summarize_role_views",
    capability: "read",
    destructive: false,
    shortLabel: "Rollvyer",
  },
  summarize_colleague_placements: {
    type: "summarize_colleague_placements",
    capability: "read",
    destructive: false,
    shortLabel: "Kollegplaceringar",
  },
  summarize_colleague_courses: {
    type: "summarize_colleague_courses",
    capability: "read",
    destructive: false,
    shortLabel: "Kollegkurser",
  },
  get_active_context: {
    type: "get_active_context",
    capability: "read",
    destructive: false,
    shortLabel: "Aktiv kontext",
  },
  list_timeline_entities: {
    type: "list_timeline_entities",
    capability: "read",
    destructive: false,
    shortLabel: "Lista tidslinjeobjekt",
  },
  list_internal_gaps: {
    type: "list_internal_gaps",
    capability: "read",
    destructive: false,
    shortLabel: "Lista interna glapp",
  },
  verify_last_action_effect: {
    type: "verify_last_action_effect",
    capability: "read",
    destructive: false,
    shortLabel: "Verifiera senaste effekt",
  },
  preview_action_diff: {
    type: "preview_action_diff",
    capability: "read",
    destructive: false,
    shortLabel: "Förhandsvisa ändringsdiff",
  },
  select_collection: {
    type: "select_collection",
    capability: "read",
    destructive: false,
    shortLabel: "Välj mängd",
  },
  apply_operator_to_collection: {
    type: "apply_operator_to_collection",
    capability: "macro",
    destructive: true,
    shortLabel: "Applicera operator på mängd",
  },
  clear_iup_followups: {
    type: "clear_iup_followups",
    capability: "mutate",
    destructive: true,
    shortLabel: "Rensa IUP-handledning/progression",
  },
  add_iup_followup: {
    type: "add_iup_followup",
    capability: "mutate",
    destructive: false,
    shortLabel: "Lägg till IUP-uppföljning",
  },
  add_iup_supervision_meetings: {
    type: "add_iup_supervision_meetings",
    capability: "mutate",
    destructive: false,
    shortLabel: "Lägg till flera handledarsamtal",
  },
  shift_iup_supervision_meetings: {
    type: "shift_iup_supervision_meetings",
    capability: "mutate",
    destructive: false,
    shortLabel: "Flytta handledarsamtal (dagar)",
  },
  remove_iup_supervision_meetings_by_dates: {
    type: "remove_iup_supervision_meetings_by_dates",
    capability: "mutate",
    destructive: true,
    shortLabel: "Ta bort handledarsamtal (datum)",
  },
  undo_last_agent_mutation: {
    type: "undo_last_agent_mutation",
    capability: "mutate",
    destructive: false,
    shortLabel: "Ångra senaste agentändring",
  },
};

export function listRegisteredActionTypes(): PusslaAgentActionType[] {
  return Object.keys(ACTION_REGISTRY) as PusslaAgentActionType[];
}

export function filterUnknownActions(actions: PusslaAgentAction[]): {
  known: PusslaAgentAction[];
  dropped: unknown[];
} {
  const known: PusslaAgentAction[] = [];
  const dropped: unknown[] = [];
  for (const a of actions) {
    if (isPusslaAgentAction(a) && ACTION_REGISTRY[a.type]) {
      known.push(a);
    } else {
      dropped.push(a);
    }
  }
  return { known, dropped };
}

export function getActionMeta(action: PusslaAgentAction): RegisteredActionMeta | null {
  return ACTION_REGISTRY[action.type] || null;
}

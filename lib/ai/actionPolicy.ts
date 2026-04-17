import type { PusslaAgentAction } from "@/lib/ai/types";

export type ActionRisk = "auto" | "confirm";

export function getActionRisk(action: PusslaAgentAction): ActionRisk {
  switch (action.type) {
    case "navigate_lane":
    case "open_window":
    case "close_window":
    case "set_iup_tab":
    case "select_placement":
    case "select_course":
    case "summarize_goal_catalog":
    case "summarize_app_sections":
    case "summarize_role_views":
    case "summarize_colleague_placements":
    case "summarize_colleague_courses":
    case "get_active_context":
    case "list_timeline_entities":
    case "list_internal_gaps":
    case "verify_last_action_effect":
    case "preview_action_diff":
    case "select_collection":
      return "auto";
    case "create_placement_from_range":
    case "create_typed_placement_from_range":
    case "create_course_from_range":
    case "create_typed_course_from_range":
    case "update_selected_placement":
    case "update_selected_course":
    case "save_selected_placement":
    case "save_selected_course":
    case "set_all_profile_phone_numbers":
    case "extend_last_placement":
    case "shift_placement_from_end":
    case "transform_all_placements_duration":
    case "shift_all_courses":
    case "rebalance_courses_per_half_year":
    case "plan_timeline_distribution":
    case "delete_selected_placement":
    case "delete_selected_course":
    case "delete_placement_by_month_year":
    case "delete_course_by_month_year":
    case "convert_course_to_utbildningsmoment":
    case "plan_st_from_sr_templates":
    case "plan_courses_cover_course_milestones":
    case "apply_operator_to_collection":
    case "clear_iup_followups":
    case "remove_iup_supervision_meetings_by_dates":
    case "undo_last_agent_mutation":
      return "confirm";
    case "add_iup_followup":
    case "add_iup_supervision_meetings":
    case "shift_iup_supervision_meetings":
      return "auto";
    case "sync_course_milestones":
      return "auto";
    default:
      return "confirm";
  }
}

export function actionLabel(action: PusslaAgentAction): string {
  switch (action.type) {
    case "navigate_lane":
      return action.lane === "placement"
        ? "Navigera till klinisk tjänstgöring"
        : "Navigera till kurs";
    case "open_window":
      return `Öppna fönster: ${action.window}`;
    case "close_window":
      return `Stäng fönster: ${action.window}`;
    case "set_iup_tab":
      return `Byt IUP-flik till ${action.tab}`;
    case "create_placement_from_range":
      return `Skapa placering "${action.title}" ${action.startDate} till ${action.endDate}`;
    case "create_typed_placement_from_range":
      return `Skapa ${action.placementType.toLowerCase()} "${action.title}" ${action.startDate} till ${action.endDate}`;
    case "create_course_from_range":
      return `Skapa kurs "${action.title}" ${action.startDate} till ${action.endDate}`;
    case "create_typed_course_from_range":
      return `Skapa ${action.courseKind.toLowerCase()} "${action.title}" ${action.startDate} till ${action.endDate}`;
    case "select_placement":
      return `Välj placering: ${action.query}`;
    case "select_course":
      return `Välj kurs: ${action.query}`;
    case "update_selected_placement":
      return "Uppdatera vald placering";
    case "update_selected_course":
      return "Uppdatera vald kurs";
    case "save_selected_placement":
      return "Spara vald placering";
    case "save_selected_course":
      return "Spara vald kurs";
    case "set_all_profile_phone_numbers":
      return "Fyll i alla telefonnummer i profil";
    case "extend_last_placement":
      if (action.endDate)
        return `Förläng placering #${Math.max(1, action.positionFromEnd || 1)} från slutet till ${action.endDate}`;
      return `Förläng placering #${Math.max(1, action.positionFromEnd || 1)} från slutet med ${Math.max(1, action.months || 1)} månad(er)`;
    case "shift_placement_from_end":
      return `Flytta fram placering #${Math.max(1, action.positionFromEnd || 1)} från slutet med ${Math.max(1, action.months || 1)} månad(er)`;
    case "transform_all_placements_duration": {
      const pct = Math.max(1, Math.round((Number(action.factor || 1) || 1) * 100));
      const anchor = action.anchor === "end" ? "slutet" : "starten";
      return `Skala alla placeringars längd till ${pct}% (behåll ${anchor})`;
    }
    case "shift_all_courses":
      return `Flytta ${action.direction === "backward" ? "bak" : "fram"} alla kurser med ${Math.max(1, action.months || 1)} månad(er)`;
    case "rebalance_courses_per_half_year":
      return `Omplanera kurser till ${Math.max(1, action.coursesPerHalfYear || 2)} per halvår`;
    case "plan_timeline_distribution":
      return `Planera om ${action.target === "courses" ? "kurser" : "placeringar"} till ${Math.max(1, action.itemsPerCadence || 1)} per ${action.cadence === "half_year" ? "halvår" : action.cadence === "term" ? "termin" : action.cadence === "year" ? "år" : "månad"}`;
    case "delete_selected_placement":
      return "Ta bort vald placering";
    case "delete_selected_course":
      return "Ta bort vald kurs";
    case "delete_placement_by_month_year":
      return `Ta bort placering som börjar ${action.year}-${String(action.month).padStart(2, "0")}`;
    case "delete_course_by_month_year":
      return `Ta bort kurs som börjar ${action.year}-${String(action.month).padStart(2, "0")}`;
    case "convert_course_to_utbildningsmoment":
      if (action.description && action.description.trim()) {
        return `Gör om kursen "${action.courseTitle}" (${action.year}-${String(action.month).padStart(2, "0")}) till utbildningsmoment och uppdatera beskrivning`;
      }
      return `Gör om kursen "${action.courseTitle}" (${action.year}-${String(action.month).padStart(2, "0")}) till utbildningsmoment`;
    case "plan_st_from_sr_templates":
      return "Planera ST med studierektorsmallar, handledning och progressionsbedömningar";
    case "plan_courses_cover_course_milestones":
      return "Planera METIS-kurser som täcker kursdelmål och fördela över ST";
    case "sync_course_milestones":
      return "Synka delmål på alla kurser utifrån kursens titel";
    case "summarize_goal_catalog":
      return "Gå igenom alla delmål i appens katalog";
    case "summarize_app_sections":
      return "Sammanfatta innehåll från appens sektioner";
    case "summarize_role_views":
      return "Sammanfatta rollvyer (ST/SR/huvudhandledare) inom behörighet";
    case "summarize_colleague_placements":
      return action.colleagueName
        ? `Sammanfatta kollegbeskrivningar för ${action.placementName} (${action.colleagueName})`
        : `Sammanfatta kollegbeskrivningar för ${action.placementName}`;
    case "summarize_colleague_courses":
      return `Sammanfatta kollegkursbeskrivningar för ${action.courseName}`;
    case "get_active_context":
      return "Visa aktiv kontext och urval";
    case "list_timeline_entities":
      return `Lista tidslinjeobjekt (${action.target || "all"})`;
    case "list_internal_gaps":
      return "Lista interna glapp i tidslinjen";
    case "verify_last_action_effect":
      return "Verifiera effekt av senaste åtgärd";
    case "preview_action_diff":
      return "Förhandsvisa diff för tänkt åtgärd";
    case "select_collection":
      return `Välj mängd (${action.target}) för operator`;
    case "apply_operator_to_collection":
      return `Applicera operator på vald mängd (${action.operator})`;
    case "clear_iup_followups": {
      const wantsMeetings = action.clearMeetings !== false;
      const wantsAssessments = action.clearAssessments !== false;
      if (wantsMeetings && wantsAssessments) {
        return "Ta bort alla handledartillfällen och progressionsbedömningar";
      }
      if (wantsMeetings) return "Ta bort alla handledartillfällen";
      if (wantsAssessments) return "Ta bort alla progressionsbedömningar";
      return "Rensa IUP-uppföljning";
    }
    case "add_iup_followup":
      return `Lägg till ${action.followupType === "meeting" ? "handledningstillfälle" : "progressionsbedömning"} ${action.dateISO}`;
    case "add_iup_supervision_meetings":
      return `Lägg till ${action.dateISOs?.length ?? 0} handledarsamtal`;
    case "shift_iup_supervision_meetings":
      return `Flytta alla handledarsamtal ${action.days >= 0 ? "fram" : "bak"}åt ${Math.abs(action.days)} dag(ar)`;
    case "remove_iup_supervision_meetings_by_dates":
      return `Ta bort handledarsamtal på ${action.dateISOs?.length ?? 0} datum`;
    case "undo_last_agent_mutation":
      return "Ångra senaste agentändring";
    default:
      return "Utför åtgärd";
  }
}

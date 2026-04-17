import { describe, expect, it } from "vitest";
import {
  parseColleagueSummaryCommand,
  parseConvertCourseToUtbildningsmomentCommand,
  parseCreateCourseCommand,
  parseDeleteCourseCommand,
  parseDeletePlacementCommand,
  parseExtendLastPlacementCommand,
  parseExtendPlacementByTitleCommand,
  parseShortenLastPlacementCommand,
  parseShortenPlacementByTitleCommand,
  parseSetAllProfilePhoneNumbersCommand,
  parseSummarizeAppSectionsCommand,
  parseGetActiveContextCommand,
  parseListTimelineEntitiesCommand,
  parseListInternalGapsCommand,
  parseUndoLastAgentMutationCommand,
  parseSelectCollectionCommand,
  parseApplyOperatorToCollectionCommand,
  parsePreviewActionDiffCommand,
  parseSummarizeGoalCatalogCommand,
  parseSummarizeRoleViewsCommand,
  parseSelectCourseCommand,
  parseSelectPlacementCommand,
  parseTransformAllPlacementsDurationCommand,
  parseSrTemplateMasterPlanCommand,
  parseUpdateSelectedCourseCommand,
  parseUpdateSelectedPlacementCommand,
  parseShiftPlacementCommand,
  parseTypedCourseCommand,
  parseTypedPlacementCommand,
  parseLocalAgentAction,
  parseLocalAgentPlan,
  parseModelJsonResponse,
  parsePlacementCommand,
} from "@/lib/ai/pusslaAgent";
import { getActionRisk } from "@/lib/ai/actionPolicy";

describe("pusslaAgent parsing", () => {
  it("parses placement command with date range", () => {
    const action = parsePlacementCommand(
      "Lägg in placering Psykiatri från 2026-01-10 till 2026-04-20"
    );
    expect(action).toBeTruthy();
    expect(action?.type).toBe("create_placement_from_range");
    if (!action || action.type !== "create_placement_from_range") return;
    expect(action.title).toBe("Psykiatri");
    expect(action.startDate).toBe("2026-01-10");
    expect(action.endDate).toBe("2026-04-20");
  });

  it("falls back to start date when end is earlier", () => {
    const action = parsePlacementCommand(
      "Lägg in placering Kardiologi från 2026-04-20 till 2026-01-10"
    );
    expect(action).toBeTruthy();
    if (!action || action.type !== "create_placement_from_range") return;
    expect(action.endDate).toBe("2026-04-20");
    expect(getActionRisk(action)).toBe("confirm");
  });

  it("parses json response envelope", () => {
    const parsed = parseModelJsonResponse(
      '{"reply":"Jag föreslår en ändring","action":{"type":"navigate_lane","lane":"course"}}'
    );
    expect(parsed.reply).toContain("Jag föreslår");
    expect(parsed.action?.type).toBe("navigate_lane");
  });

  it("parses json response with actions array", () => {
    const parsed = parseModelJsonResponse(
      '{"reply":"Kör två steg","actions":[{"type":"open_window","window":"iup"},{"type":"set_iup_tab","tab":"handledning"}]}'
    );
    expect(parsed.actions?.length).toBe(2);
    expect(parsed.actions?.[0]?.type).toBe("open_window");
  });

  it("filters unknown action types from model json", () => {
    const parsed = parseModelJsonResponse(
      '{"reply":"x","actions":[{"type":"unknown_action"},{"type":"open_window","window":"iup"}]}'
    );
    expect(parsed.actions?.length).toBe(1);
    expect(parsed.actions?.[0]?.type).toBe("open_window");
  });

  it("supports local navigate command", () => {
    const action = parseLocalAgentAction("gå till kurs");
    expect(action?.type).toBe("navigate_lane");
  });

  it("parses delete placement by swedish month/year", () => {
    const action = parseDeletePlacementCommand(
      "ta bort placeringen som börjar i mars 2026"
    );
    expect(action?.type).toBe("delete_placement_by_month_year");
    if (!action || action.type !== "delete_placement_by_month_year") return;
    expect(action.month).toBe(3);
    expect(action.year).toBe(2026);
    expect(getActionRisk(action)).toBe("confirm");
  });

  it("parses create and delete course commands", () => {
    const create = parseCreateCourseCommand(
      "Lägg in kurs METIS från 2026-03-01 till 2026-03-20"
    );
    expect(create?.type).toBe("create_course_from_range");
    const del = parseDeleteCourseCommand("Ta bort kursen som börjar i april 2027");
    expect(del?.type).toBe("delete_course_by_month_year");
  });

  it("parses shift-all-courses command", () => {
    const action = parseLocalAgentAction("flytta dem en månad framåt");
    expect(action?.type).toBe("shift_all_courses");
    if (!action || action.type !== "shift_all_courses") return;
    expect(action.months).toBe(1);
    expect(action.direction).toBe("forward");
    expect(getActionRisk(action)).toBe("confirm");
  });

  it("parses rebalance courses per term command", () => {
    const action = parseLocalAgentAction("flytta så att det är två kurser per termin");
    expect(action?.type).toBe("plan_timeline_distribution");
    if (!action || action.type !== "plan_timeline_distribution") return;
    expect(action.target).toBe("courses");
    expect(action.cadence).toBe("half_year");
    expect(action.itemsPerCadence).toBe(2);
    expect(getActionRisk(action)).toBe("confirm");
  });

  it("parses delete selected course command", () => {
    const action = parseLocalAgentAction("ta bort vald kurs");
    expect(action?.type).toBe("delete_selected_course");
    expect(getActionRisk(action as any)).toBe("confirm");
  });

  it("parses convert course to utbildningsmoment", () => {
    const a = parseConvertCourseToUtbildningsmomentCommand(
      'gör om Journal club i maj 2026 till ett utbildningsmoment'
    );
    expect(a?.type).toBe("convert_course_to_utbildningsmoment");
    if (!a || a.type !== "convert_course_to_utbildningsmoment") return;
    expect(a.courseTitle).toBe("Journal club");
    expect(a.month).toBe(5);
    expect(a.year).toBe(2026);
    expect(getActionRisk(a)).toBe("confirm");
  });

  it("parses convert with inline description", () => {
    const a = parseConvertCourseToUtbildningsmomentCommand(
      "ändra kursen journal club i maj 2026 till ett utbildningsmoment. i beskrivning: beskriv en artikel som handlar om psykos"
    );
    expect(a?.type).toBe("convert_course_to_utbildningsmoment");
    if (!a || a.type !== "convert_course_to_utbildningsmoment") return;
    expect(a.courseTitle.toLowerCase()).toContain("journal");
    expect(a.description?.toLowerCase()).toContain("psykos");
  });

  it("keeps rich direct parse when clause split would lose details", () => {
    const actions = parseLocalAgentPlan(
      "ändra kursen journal club i maj 2026 till ett utbildningsmoment. i beskrivning: beskriv en artikel som handlar om psykos"
    );
    expect(actions.length).toBe(1);
    expect(actions[0]?.type).toBe("convert_course_to_utbildningsmoment");
    if (!actions[0] || actions[0].type !== "convert_course_to_utbildningsmoment") return;
    expect(actions[0].description?.toLowerCase()).toContain("psykos");
  });

  it("parses advanced colleague summary command", () => {
    const action = parseColleagueSummaryCommand(
      'Gå igenom alla ST-kollegors beskrivningar av placeringen "Psykos slutenvård". Sammanfatta på tio rader med akademisk svenska'
    );
    expect(action?.type).toBe("summarize_colleague_placements");
    if (!action || action.type !== "summarize_colleague_placements") return;
    expect(action.placementName).toBe("Psykos slutenvård");
    expect(action.lineCount).toBe(10);
    expect(getActionRisk(action)).toBe("auto");
  });

  it("parses loose colleague placement summary", () => {
    const action = parseColleagueSummaryCommand(
      "Sammanställ information om alla kollegors beskrivning av psykos slutenvård"
    );
    expect(action?.type).toBe("summarize_colleague_placements");
    if (!action || action.type !== "summarize_colleague_placements") return;
    expect(action.placementName.toLowerCase()).toContain("psykos");
  });

  it("parses possessive colleague placement summary", () => {
    const action = parseColleagueSummaryCommand(
      "Cecilias beskrivning av Psykos slutenvård"
    );
    expect(action?.type).toBe("summarize_colleague_placements");
    if (!action || action.type !== "summarize_colleague_placements") return;
    expect(action.colleagueName?.toLowerCase()).toBe("cecilia");
    expect(action.placementName).toMatch(/psykos/i);
  });

  it("supports local open window command", () => {
    const action = parseLocalAgentAction("öppna iup");
    expect(action?.type).toBe("open_window");
  });

  it("supports local close window command", () => {
    const action = parseLocalAgentAction("stäng profil");
    expect(action?.type).toBe("close_window");
  });

  it("parses set all profile phone numbers command", () => {
    const action = parseSetAllProfilePhoneNumbersCommand(
      "fyll i 12345678 på alla telefonnummer"
    );
    expect(action?.type).toBe("set_all_profile_phone_numbers");
    if (!action || action.type !== "set_all_profile_phone_numbers") return;
    expect(action.phoneNumber).toBe("12345678");
  });

  it("parses ändra telefonnummer till without alla", () => {
    const action = parseSetAllProfilePhoneNumbersCommand(
      "ändra telefonnummer till 12345"
    );
    expect(action?.type).toBe("set_all_profile_phone_numbers");
    if (!action || action.type !== "set_all_profile_phone_numbers") return;
    expect(action.phoneNumber).toBe("12345");
  });

  it("does not match telefonnummer till on full multi-step string (clauses split)", () => {
    expect(
      parseSetAllProfilePhoneNumbersCommand(
        "öppna profil och ändra telefonnummer till 12345"
      )
    ).toBeNull();
  });

  it("parses multi-step profile open + phone fill", () => {
    const actions = parseLocalAgentPlan(
      "Öppna profil och fyll i 12345678 på alla telefonnummer"
    );
    // Agenten ska inte hantera personuppgifter via plan-parsning.
    // Därför triggas bara "open_window" och inte telefon-fyll.
    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions[0]?.type).toBe("open_window");
  });

  it("parses multi-step öppna profil och ändra telefonnummer till", () => {
    const actions = parseLocalAgentPlan(
      "öppna profil och ändra telefonnummer till 12345"
    );
    // Agenten ska inte hantera personuppgifter via plan-parsning.
    expect(actions.length).toBe(1);
    expect(actions[0]?.type).toBe("open_window");
    if (actions[0]?.type === "open_window") {
      expect(actions[0].window).toBe("profile");
    }
  });

  it("parses select placement and course commands", () => {
    const p = parseSelectPlacementCommand("välj placering psykiatri");
    expect(p?.type).toBe("select_placement");
    if (!p || p.type !== "select_placement") return;
    expect(p.query.toLowerCase()).toContain("psykiatri");

    const c = parseSelectCourseCommand("välj kurs METIS");
    expect(c?.type).toBe("select_course");
    if (!c || c.type !== "select_course") return;
    expect(c.query).toContain("METIS");
  });

  it("parses update selected placement command", () => {
    const action = parseUpdateSelectedPlacementCommand(
      "ändra placering beskrivning till Detta är uppdaterat"
    );
    expect(action?.type).toBe("update_selected_placement");
    if (!action || action.type !== "update_selected_placement") return;
    expect(action.fields.note).toContain("Detta är uppdaterat");
  });

  it("parses update selected course command", () => {
    const action = parseUpdateSelectedCourseCommand(
      "ändra kurs stad till Göteborg"
    );
    expect(action?.type).toBe("update_selected_course");
    if (!action || action.type !== "update_selected_course") return;
    expect(action.fields.city).toBe("Göteborg");
  });

  it("parses rename of last matching course into multi-step plan", () => {
    const actions = parseLocalAgentPlan(
      "ändra den sista Journal Club till en kurs i suicidologi"
    );
    expect(actions.length).toBe(3);
    expect(actions[0]?.type).toBe("select_course");
    if (actions[0]?.type === "select_course") {
      expect(actions[0].query.toLowerCase()).toContain("journal club");
    }
    expect(actions[1]?.type).toBe("update_selected_course");
    if (actions[1]?.type === "update_selected_course") {
      expect(actions[1].fields.title?.toLowerCase()).toBe("suicidologi");
      expect(actions[1].fields.courseKind).toBe("Kurs");
    }
    expect(actions[2]?.type).toBe("save_selected_course");
  });

  it("parses rename of last matching course with explanatory parenthesis", () => {
    const actions = parseLocalAgentPlan(
      "ändra den sista Journal club (som är ett utbildningsmoment) till en kurs i suicidologi"
    );
    expect(actions.length).toBe(3);
    expect(actions[0]?.type).toBe("select_course");
    if (actions[0]?.type === "select_course") {
      expect(actions[0].query.toLowerCase()).toBe("journal club");
    }
    expect(actions[1]?.type).toBe("update_selected_course");
    if (actions[1]?.type === "update_selected_course") {
      expect(actions[1].fields.title?.toLowerCase()).toBe("suicidologi");
      expect(actions[1].fields.courseKind).toBe("Kurs");
    }
    expect(actions[2]?.type).toBe("save_selected_course");
  });

  it("parses sync all courses milestones command", () => {
    const actions = parseLocalAgentPlan(
      "uppdatera alla kurser så de får delmål som hör till resp kurs"
    );
    expect(actions.length).toBe(1);
    expect(actions[0]?.type).toBe("sync_course_milestones");
  });

  it("supports local synonyms for creation", () => {
    const action = parseLocalAgentAction(
      "Skapa placering Psykiatri från 2026-01-10 till 2026-04-20"
    );
    expect(action?.type).toBe("create_placement_from_range");
  });

  it("parses typed placement command", () => {
    const action = parseTypedPlacementCommand(
      "Lägg in forskning AI-projekt från 2026-01-10 till 2026-04-20"
    );
    expect(action?.type).toBe("create_typed_placement_from_range");
    if (!action || action.type !== "create_typed_placement_from_range") return;
    expect(action.placementType).toBe("Forskning");
    expect(action.title).toContain("AI-projekt");
  });

  it("parses typed course command", () => {
    const action = parseTypedCourseCommand(
      "Lägg in konferens Psykiatridagarna från 2026-05-10 till 2026-05-12"
    );
    expect(action?.type).toBe("create_typed_course_from_range");
    if (!action || action.type !== "create_typed_course_from_range") return;
    expect(action.courseKind).toBe("Konferens");
    expect(action.title).toContain("Psykiatridagarna");
  });

  it("parses request to review all milestone info pages", () => {
    const action = parseSummarizeGoalCatalogCommand(
      "kolla alla enskilda delmål i appen och gå igenom varje delmåls infosida"
    );
    expect(action?.type).toBe("summarize_goal_catalog");
    if (!action || action.type !== "summarize_goal_catalog") return;
    expect(getActionRisk(action)).toBe("auto");
  });

  it("parses request to summarize app sections", () => {
    const action = parseSummarizeAppSectionsCommand(
      "gå igenom allt som finns på alla sidor i appen"
    );
    expect(action?.type).toBe("summarize_app_sections");
    if (!action || action.type !== "summarize_app_sections") return;
    expect(getActionRisk(action)).toBe("auto");
  });

  it("parses request to summarize role views", () => {
    const action = parseSummarizeRoleViewsCommand(
      "gå igenom studierektor och huvudhandledare-vyerna"
    );
    expect(action?.type).toBe("summarize_role_views");
    if (!action || action.type !== "summarize_role_views") return;
    expect(getActionRisk(action)).toBe("auto");
  });

  it("parses context/state introspection commands", () => {
    const contextAction = parseGetActiveContextCommand("visa aktiv kontext");
    expect(contextAction?.type).toBe("get_active_context");
    const entitiesAction = parseListTimelineEntitiesCommand("lista placeringar i tidslinjen");
    expect(entitiesAction?.type).toBe("list_timeline_entities");
    const gapsAction = parseListInternalGapsCommand("visa glapp i tidslinjen");
    expect(gapsAction?.type).toBe("list_internal_gaps");
    if (!contextAction || contextAction.type !== "get_active_context") return;
    expect(getActionRisk(contextAction)).toBe("auto");
  });

  it("parses collection and undo commands", () => {
    const undo = parseUndoLastAgentMutationCommand("ångra senaste agentändring");
    expect(undo?.type).toBe("undo_last_agent_mutation");
    const select = parseSelectCollectionCommand("välj var 2 kurs efter beroendelära");
    expect(select?.type).toBe("select_collection");
    const notCollection = parseSelectCollectionCommand(
      'Välj placeringen "Psykos slutenvård", sätt handledare till "Anna Andersson" och spara.'
    );
    expect(notCollection).toBeNull();
    const apply = parseApplyOperatorToCollectionCommand("ta bort valda i selektionsmängd");
    expect(apply?.type).toBe("apply_operator_to_collection");
    const preview = parsePreviewActionDiffCommand("förhandsvisa diff om du tar bort vald kurs");
    expect(preview?.type).toBe("preview_action_diff");
    const clearFollowups = parseLocalAgentAction(
      "ta bort alla handledartillfällen och progressionsbedömningar"
    );
    expect(clearFollowups?.type).toBe("clear_iup_followups");
    const addFollowup = parseLocalAgentAction("lägg till handledningstillfälle 1 mars 2021");
    expect(addFollowup?.type).toBe("add_iup_followup");
    if (addFollowup?.type === "add_iup_followup") {
      expect(addFollowup.followupType).toBe("meeting");
      expect(addFollowup.dateISO).toBe("2021-03-01");
    }
  });

  it("parses milestone updates on selected placement", () => {
    const action = parseUpdateSelectedPlacementCommand(
      "ändra placering delmål till STA1 STC3"
    );
    expect(action?.type).toBe("update_selected_placement");
    if (!action || action.type !== "update_selected_placement") return;
    expect(action.fields.milestones).toContain("STA1");
  });

  it("parses BT milestone updates on selected course", () => {
    const action = parseUpdateSelectedCourseCommand(
      "ändra kurs bt-delmål till BT1 BT2"
    );
    expect(action?.type).toBe("update_selected_course");
    if (!action || action.type !== "update_selected_course") return;
    expect(action.fields.btMilestones).toContain("BT1");
  });

  it("parses studierektor template master plan command", () => {
    const action = parseSrTemplateMasterPlanCommand(
      "Planera en ST med inslag av alla placeringar och kurser som studierektorn har lagt in. En handledarträff i månaden och två progressionsbedömningar per termin."
    );
    expect(action?.type).toBe("plan_st_from_sr_templates");
    if (!action || action.type !== "plan_st_from_sr_templates") return;
    expect(action.monthlySupervision).toBe(1);
    expect(action.assessmentsPerTerm).toBe(2);
    expect(getActionRisk(action)).toBe("confirm");
  });

  it("parses SR courses-only even spread from natural Swedish", () => {
    const action = parseSrTemplateMasterPlanCommand(
      "Lägg in en av varje kurs som studierektor lagt in, jämnt fördelat över hela ST:n"
    );
    expect(action?.type).toBe("plan_st_from_sr_templates");
    if (!action || action.type !== "plan_st_from_sr_templates") return;
    expect(action.includePlacements).toBe(false);
    expect(action.includeCourses).toBe(true);
    expect(action.includeUtbildningsmoment).toBe(false);
  });

  it("parses extend placement by clinic/title (not only sista/nästsista)", () => {
    const named = parseExtendPlacementByTitleCommand("förläng Psykos slutenvård med tre månader");
    expect(named?.type).toBe("extend_last_placement");
    if (!named || named.type !== "extend_last_placement") return;
    expect(named.placementTitle).toMatch(/psykos/i);
    expect(named.months).toBe(3);
    expect(named.positionFromEnd).toBeUndefined();

    const viaLocal = parseLocalAgentAction('förläng placeringen "Psykos slutenvård" med 3 månader');
    expect(viaLocal?.type).toBe("extend_last_placement");
    if (!viaLocal || viaLocal.type !== "extend_last_placement") return;
    expect(viaLocal.placementTitle).toMatch(/psykos/i);

    expect(parseExtendPlacementByTitleCommand("förläng nästsista placeringen med en månad")).toBeNull();
  });

  it("parses shorten placement by clinic/title", () => {
    const named = parseShortenPlacementByTitleCommand("förkorta Psykos slutenvård med 4 månader");
    expect(named?.type).toBe("extend_last_placement");
    if (!named || named.type !== "extend_last_placement") return;
    expect(named.placementTitle).toMatch(/psykos/i);
    expect(named.months).toBe(-4);
    expect(named.positionFromEnd).toBeUndefined();

    const viaLocal = parseLocalAgentAction("förkorta placeringen \"Psykos slutenvård\" med fyra månader");
    expect(viaLocal?.type).toBe("extend_last_placement");
    if (!viaLocal || viaLocal.type !== "extend_last_placement") return;
    expect(viaLocal.placementTitle).toMatch(/psykos/i);
    expect(viaLocal.months).toBe(-4);

    expect(parseShortenPlacementByTitleCommand("förkorta nästsista placeringen med en månad")).toBeNull();
  });

  it("parses shorten last/näst sista placement commands", () => {
    const secondLast = parseShortenLastPlacementCommand("förkorta den näst sista placeringen med 2 månader");
    expect(secondLast?.type).toBe("extend_last_placement");
    if (!secondLast || secondLast.type !== "extend_last_placement") return;
    expect(secondLast.positionFromEnd).toBe(2);
    expect(secondLast.months).toBe(-2);

    const viaLocal = parseLocalAgentAction("förkorta den näst sista placeringen med 2 månader");
    expect(viaLocal?.type).toBe("extend_last_placement");
    if (!viaLocal || viaLocal.type !== "extend_last_placement") return;
    expect(viaLocal.positionFromEnd).toBe(2);
    expect(viaLocal.months).toBe(-2);
  });

  it("parses extend last placement commands", () => {
    const defaultExtend = parseExtendLastPlacementCommand("förläng den sista placeringen");
    expect(defaultExtend?.type).toBe("extend_last_placement");
    if (!defaultExtend || defaultExtend.type !== "extend_last_placement") return;
    expect(defaultExtend.months).toBe(1);

    const withMonths = parseExtendLastPlacementCommand(
      "förläng sista placeringen med 3 månader"
    );
    expect(withMonths?.type).toBe("extend_last_placement");
    if (!withMonths || withMonths.type !== "extend_last_placement") return;
    expect(withMonths.months).toBe(3);
    expect(withMonths.positionFromEnd).toBe(1);
    expect(getActionRisk(withMonths)).toBe("confirm");

    const secondLast = parseExtendLastPlacementCommand(
      "förläng den näst sista placeringen med en månad"
    );
    expect(secondLast?.type).toBe("extend_last_placement");
    if (!secondLast || secondLast.type !== "extend_last_placement") return;
    expect(secondLast.positionFromEnd).toBe(2);
    const twoMonths = parseExtendLastPlacementCommand(
      "förläng sista placeringen med två månader"
    );
    expect(twoMonths?.type).toBe("extend_last_placement");
    if (!twoMonths || twoMonths.type !== "extend_last_placement") return;
    expect(twoMonths.months).toBe(2);

    const oneWordSecondLast = parseExtendLastPlacementCommand(
      "förläng nästsista placeringen med en månad"
    );
    expect(oneWordSecondLast?.type).toBe("extend_last_placement");
    if (!oneWordSecondLast || oneWordSecondLast.type !== "extend_last_placement") return;
    expect(oneWordSecondLast.positionFromEnd).toBe(2);

    const fromEndAlias = parseExtendLastPlacementCommand(
      "förläng andra från slutet med en månad"
    );
    expect(fromEndAlias?.type).toBe("extend_last_placement");
    if (!fromEndAlias || fromEndAlias.type !== "extend_last_placement") return;
    expect(fromEndAlias.positionFromEnd).toBe(2);

    const thirdFromEnd = parseExtendLastPlacementCommand(
      "förläng 3:e från slutet med en månad"
    );
    expect(thirdFromEnd?.type).toBe("extend_last_placement");
    if (!thirdFromEnd || thirdFromEnd.type !== "extend_last_placement") return;
    expect(thirdFromEnd.positionFromEnd).toBe(3);
  });

  it("parses shift placement command with lika mycket", () => {
    const shift = parseShiftPlacementCommand("knuffa fram den sista lika mycket");
    expect(shift?.type).toBe("shift_placement_from_end");
    if (!shift || shift.type !== "shift_placement_from_end") return;
    expect(shift.positionFromEnd).toBe(1);
    expect(shift.months).toBeUndefined();
  });

  it("parses transform command for all placement durations", () => {
    const action = parseTransformAllPlacementsDurationCommand(
      "halvera alla placeringars längd, ta bort andra halvan"
    );
    expect(action?.type).toBe("transform_all_placements_duration");
    if (!action || action.type !== "transform_all_placements_duration") return;
    expect(action.factor).toBe(0.5);
    expect(action.anchor).toBe("start");
  });

  it("parses simple multi-step command into plan", () => {
    const actions = parseLocalAgentPlan(
      "Öppna iup och sedan gå till kurs"
    );
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions[0]?.type).toBe("open_window");
    expect(actions[1]?.type).toBe("navigate_lane");
  });

  it("parses lägg till delmål … till … (inline välj + delmål + spara, med och i listan)", () => {
    const actions = parseLocalAgentPlan(
      "lägg till delmål c2, c3 och a3 till Vårdcentral"
    );
    expect(actions).toHaveLength(3);
    expect(actions[0]?.type).toBe("select_placement");
    expect(actions[1]?.type).toBe("update_selected_placement");
    expect(actions[2]?.type).toBe("save_selected_placement");
    if (actions[0]?.type === "select_placement") {
      expect(actions[0].query).toMatch(/vårdcentral/i);
    }
    if (actions[1]?.type === "update_selected_placement") {
      expect(actions[1].fields.milestones).toEqual(["C2", "C3", "A3"]);
    }
  });

  it("parses lägg till handledare … i … (inline välj + uppdatera + spara)", () => {
    const actions = parseLocalAgentPlan('lägg till handledare "Anders Svensson" i Vårdcentral');
    expect(actions).toHaveLength(3);
    expect(actions[0]?.type).toBe("select_placement");
    expect(actions[1]?.type).toBe("update_selected_placement");
    expect(actions[2]?.type).toBe("save_selected_placement");
    if (actions[0]?.type === "select_placement") expect(actions[0].query).toMatch(/vårdcentral/i);
    if (actions[1]?.type === "update_selected_placement") {
      expect(actions[1].fields.supervisor).toBe("Anders Svensson");
    }
  });

  it("parses select + set supervisor + save placement plan", () => {
    const actions = parseLocalAgentPlan(
      'Välj placeringen "Psykos slutenvård", sätt handledare till "Anna Andersson" och spara.'
    );
    expect(actions).toHaveLength(3);
    expect(actions[0]?.type).toBe("select_placement");
    expect(actions[1]?.type).toBe("update_selected_placement");
    expect(actions[2]?.type).toBe("save_selected_placement");
    if (actions[0]?.type === "select_placement") {
      expect(actions[0].query).toMatch(/Psykos slutenvård/i);
    }
    if (actions[1]?.type === "update_selected_placement") {
      expect(actions[1].fields.supervisor).toBe("Anna Andersson");
    }
  });

  it("parses select + placement fields (specialitet, tjänsteställe, beskrivning, ST-delmål) + save", () => {
    const actions = parseLocalAgentPlan(
      'Välj placeringen "Psykos slutenvård", sätt handledares specialitet till "Psykiatri", sätt handledares tjänsteställe till "SUS", beskrivning till "Min text", delmål till STA1 STC2 och spara.'
    );
    expect(actions).toHaveLength(3);
    if (actions[1]?.type === "update_selected_placement") {
      expect(actions[1].fields.supervisorSpeciality).toBe("Psykiatri");
      expect(actions[1].fields.supervisorSite).toBe("SUS");
      expect(actions[1].fields.note).toBe("Min text");
      expect(actions[1].fields.milestones).toEqual(["STA1", "STC2"]);
    }
  });

  it("parses select + BT-delmål + save placement plan", () => {
    const actions = parseLocalAgentPlan(
      'Välj placeringen "BT-block", sätt BT-delmål till BT1 BT2 och spara.'
    );
    expect(actions).toHaveLength(3);
    if (actions[1]?.type === "update_selected_placement") {
      expect(actions[1].fields.btMilestones).toEqual(["BT1", "BT2"]);
    }
  });

  it("parses update placement with handledares specialitet (placering i text)", () => {
    const action = parseUpdateSelectedPlacementCommand(
      "ändra placering: sätt handledares specialitet till Psykiatri A"
    );
    expect(action?.type).toBe("update_selected_placement");
    if (!action || action.type !== "update_selected_placement") return;
    expect(action.fields.supervisorSpeciality).toBe("Psykiatri A");
  });

  it("reorders shift before extend for overlap-safe command", () => {
    const actions = parseLocalAgentPlan(
      "förläng näst sista placeringen med en månad. knuffa fram den sista lika mycket"
    );
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions[0]?.type).toBe("shift_placement_from_end");
    expect(actions[1]?.type).toBe("extend_last_placement");
  });
});

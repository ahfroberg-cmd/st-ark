import type { PusslaAgentAction } from "@/lib/ai/types";
import { needsSelectionHint } from "@/lib/ai/agent/actionContracts";

export interface ActionGraphState {
  iupWindowOpen: boolean;
  courseSelected: boolean;
  placementSelected: boolean;
}

export interface ActionGraphExpansion {
  actions: PusslaAgentAction[];
  unresolved: Array<"course_selection_missing" | "placement_selection_missing">;
}

function extractQueryHint(userText: string): string | null {
  const quoted = userText.match(/["”]([^"”]{2,})["”]/);
  if (quoted?.[1]) return quoted[1].trim();
  const aroundCourse = userText.match(/\bkurs(?:en|er|erna)?\s+([a-zA-Z0-9åäöÅÄÖ \-]{3,40})/i);
  if (aroundCourse?.[1]) return aroundCourse[1].trim();
  const aroundPlacement = userText.match(
    /\bplacering(?:en|ar|arna)?\s+([a-zA-Z0-9åäöÅÄÖ \-]{3,40})/i
  );
  if (aroundPlacement?.[1]) return aroundPlacement[1].trim();
  return null;
}

function applyEffects(state: ActionGraphState, action: PusslaAgentAction): ActionGraphState {
  if (action.type === "open_window" && action.window === "iup") {
    return { ...state, iupWindowOpen: true };
  }
  if (action.type === "close_window" && action.window === "iup") {
    return { ...state, iupWindowOpen: false };
  }
  if (action.type === "select_course") {
    return { ...state, courseSelected: true };
  }
  if (action.type === "select_placement") {
    return { ...state, placementSelected: true };
  }
  return state;
}

export function expandPlanWithActionGraph(
  actions: PusslaAgentAction[],
  userText: string,
  initialState: ActionGraphState = {
    iupWindowOpen: false,
    courseSelected: false,
    placementSelected: false,
  }
): ActionGraphExpansion {
  const out: PusslaAgentAction[] = [];
  const unresolved: Array<"course_selection_missing" | "placement_selection_missing"> = [];
  const hint = extractQueryHint(userText);
  let state = initialState;

  for (const action of actions) {
    if (action.type === "set_iup_tab" && !state.iupWindowOpen) {
      const pre: PusslaAgentAction = { type: "open_window", window: "iup" };
      out.push(pre);
      state = applyEffects(state, pre);
    }
    const selectionHint = needsSelectionHint(action);
    if ((selectionHint === "course" || selectionHint === "either") && !state.courseSelected) {
      if (hint) {
        const pre: PusslaAgentAction = { type: "select_course", query: hint };
        out.push(pre);
        state = applyEffects(state, pre);
      } else {
        unresolved.push("course_selection_missing");
      }
    }
    if ((selectionHint === "placement" || selectionHint === "either") && !state.placementSelected) {
      if (hint) {
        const pre: PusslaAgentAction = { type: "select_placement", query: hint };
        out.push(pre);
        state = applyEffects(state, pre);
      } else {
        unresolved.push("placement_selection_missing");
      }
    }
    out.push(action);
    state = applyEffects(state, action);
  }
  return { actions: out, unresolved };
}


import { describe, expect, it } from "vitest";
import {
  buildTaskProfile,
  classifyTaskType,
  gatePlanActions,
} from "@/lib/ai/assistantCore/runPolicy";
import type { PusslaAgentAction } from "@/lib/ai/types";

describe("assistantCore runPolicy", () => {
  it("allows read actions in read-only mode", () => {
    const actions: PusslaAgentAction[] = [
      { type: "open_window", window: "iup" },
      { type: "set_iup_tab", tab: "delmal" },
      { type: "summarize_goal_catalog" },
    ];
    const out = gatePlanActions({ actions, mode: "read_only", maxToolCalls: 4 });
    expect(out.blockedReason).toBeNull();
    expect(out.dropped).toHaveLength(0);
    expect(out.allowed).toEqual(actions);
  });

  it("blocks write actions in read-only mode", () => {
    const actions: PusslaAgentAction[] = [
      { type: "select_placement", query: "Vårdcentral" },
      { type: "update_selected_placement", fields: { milestones: ["C2"] } },
      { type: "save_selected_placement" },
    ];
    const out = gatePlanActions({ actions, mode: "read_only", maxToolCalls: 6 });
    expect(out.allowed).toHaveLength(0);
    expect(out.dropped.map((a) => a.type)).toContain("update_selected_placement");
    expect(out.blockedReason).toMatch(/Read-only/i);
  });

  it("blocks plans over max tool calls", () => {
    const actions: PusslaAgentAction[] = [
      { type: "open_window", window: "iup" },
      { type: "set_iup_tab", tab: "delmal" },
      { type: "summarize_goal_catalog" },
    ];
    const out = gatePlanActions({ actions, mode: "write_enabled", maxToolCalls: 2 });
    expect(out.allowed).toHaveLength(0);
    expect(out.blockedReason).toMatch(/max/i);
  });

  it("classifies write request by actions and text", () => {
    const actions: PusslaAgentAction[] = [
      { type: "select_placement", query: "Vårdcentral" },
      { type: "update_selected_placement", fields: { note: "hej" } },
    ];
    const task = classifyTaskType({ userText: "lägg till delmål", actions });
    expect(task).toBe("write_request");
  });

  it("builds forced read-only profile", () => {
    const actions: PusslaAgentAction[] = [{ type: "summarize_app_sections" }];
    const profile = buildTaskProfile({
      userText: "visa appens delar",
      actions,
      forceReadOnly: true,
    });
    expect(profile.mode).toBe("read_only");
    expect(profile.maxToolCalls).toBe(4);
  });
});

import { describe, expect, it } from "vitest";
import {
  createAgentTaskState,
  markTaskInProgress,
  markTaskOutcome,
  summarizeTaskState,
} from "@/lib/ai/agent/taskState";

describe("taskState", () => {
  it("tracks progress through pending/in-progress/completed", () => {
    let state = createAgentTaskState(
      [
        { type: "open_window", window: "iup" },
        { type: "set_iup_tab", tab: "delmal" },
      ],
      () => "x"
    );
    expect(summarizeTaskState(state)).toMatch(/0\/2/);
    state = markTaskInProgress(state, 0);
    state = markTaskOutcome(state, 0, { status: "ok" });
    expect(summarizeTaskState(state)).toMatch(/1\/2/);
  });

  it("marks noop delete as skipped via message", () => {
    let state = createAgentTaskState(
      [{ type: "delete_course_by_month_year", month: 1, year: 2021 }],
      () => "x"
    );
    state = markTaskInProgress(state, 0);
    state = markTaskOutcome(state, 0, {
      status: "ok",
      message: "Hittade ingen kurs som börjar 2021-01. Ingen träff för denna månad.",
      outcomeClass: "noop",
    });
    expect(state.items[0].status).toBe("skipped");
    expect(summarizeTaskState(state)).toMatch(/1\/1/);
  });
});


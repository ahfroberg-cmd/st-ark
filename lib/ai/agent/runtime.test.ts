import { describe, expect, it } from "vitest";
import { runAgentAction, runAgentPlan, runAgentRuntime } from "@/lib/ai/agent/runtime";

describe("runAgentRuntime", () => {
  it("tracks attempts and replans", async () => {
    let calls = 0;
    const result = await runAgentRuntime({
      initialActions: [
        { type: "open_window", window: "iup" },
        { type: "set_iup_tab", tab: "delmal" },
      ],
      maxAttempts: 3,
      runPlan: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            status: "failed",
            message: "first_fail",
            remainingActions: [{ type: "set_iup_tab", tab: "delmal" }],
          };
        }
        return { status: "ok" };
      },
    });
    expect(result.status).toBe("ok");
    expect(result.attemptsUsed).toBeGreaterThanOrEqual(2);
    expect(result.replanCount).toBeGreaterThanOrEqual(1);
  });
});

describe("runAgentAction", () => {
  it("accepts message-confirmed success when snapshot is unchanged", async () => {
    const result = await runAgentAction({
      action: {
        type: "create_typed_placement_from_range",
        placementType: "Klinisk tjänstgöring",
        title: "Test",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      },
      confirmMode: "never",
      friendlyActionLabel: () => "Skapa placering",
      executeAction: async () => ({ ok: true, message: "Klinisk tjänstgöring skapad och sparades." }),
      captureSnapshot: () => ({ activities: [] }),
      appendSystem: () => {},
      appendAssistantAfterAction: async () => {},
      onAwaitingConfirm: () => {},
      onBlocked: () => {},
      rememberCurrentSnapshot: () => {},
      onRecordStepAndCheckGuardrail: () => ({ blocked: false }),
    });
    expect(result.status).toBe("ok");
  });

  it("recovers from overlap by adjusting placement end date", async () => {
    const calls: any[] = [];
    const result = await runAgentAction({
      action: {
        type: "create_typed_placement_from_range",
        placementType: "Klinisk tjänstgöring",
        title: "Test",
        startDate: "2026-01-01",
        endDate: "2026-03-31",
      },
      confirmMode: "never",
      friendlyActionLabel: () => "Skapa placering",
      executeAction: async (a) => {
        calls.push(a);
        if (calls.length === 1) {
          return { ok: false, message: "Placeringen överlappar en befintlig aktivitet." };
        }
        return { ok: true, message: "Klinisk tjänstgöring skapad." };
      },
      captureSnapshot: () => ({
        activities: [{ exactStartISO: "2026-03-01T00:00:00Z" }],
      }),
      appendSystem: () => {},
      appendAssistantAfterAction: async () => {},
      onAwaitingConfirm: () => {},
      onBlocked: () => {},
      rememberCurrentSnapshot: () => {},
      onRecordStepAndCheckGuardrail: () => ({ blocked: false }),
    });
    expect(result.status).toBe("ok");
    expect(calls.length).toBe(2);
    expect(calls[1].endDate).toBe("2026-02-28");
  });

  it("treats delete-by-month missing target as noop success", async () => {
    const result = await runAgentAction({
      action: {
        type: "delete_course_by_month_year",
        month: 12,
        year: 2021,
      },
      confirmMode: "never",
      friendlyActionLabel: () => "Ta bort kurs",
      executeAction: async () => ({
        ok: false,
        message: "Hittade ingen kurs som börjar 2021-12.",
      }),
      captureSnapshot: () => ({ activities: [], courses: [] }),
      appendSystem: () => {},
      appendAssistantAfterAction: async () => {},
      onAwaitingConfirm: () => {},
      onBlocked: () => {},
      rememberCurrentSnapshot: () => {},
      onRecordStepAndCheckGuardrail: () => ({ blocked: false }),
    });
    expect(result.status).toBe("ok");
    expect(result.verdict).toBe("noop");
    expect(result.outcomeClass).toBe("noop");
  });

  it("retries transient failure once and succeeds", async () => {
    let calls = 0;
    const result = await runAgentAction({
      action: {
        type: "open_window",
        window: "iup",
      },
      confirmMode: "never",
      friendlyActionLabel: () => "Öppna IUP",
      executeAction: async () => {
        calls += 1;
        if (calls === 1) return { ok: false, message: "Tillfälligt nätverksfel." };
        return { ok: true, message: "Öppnade IUP." };
      },
      captureSnapshot: () => ({ activities: [], courses: [] }),
      appendSystem: () => {},
      appendAssistantAfterAction: async () => {},
      onAwaitingConfirm: () => {},
      onBlocked: () => {},
      rememberCurrentSnapshot: () => {},
      onRecordStepAndCheckGuardrail: () => ({ blocked: false }),
    });
    expect(result.status).toBe("ok");
    expect(calls).toBe(2);
  });
});

describe("runAgentPlan", () => {
  it("locally replans retryable failed step by postponing once", async () => {
    const calls: string[] = [];
    const res = await runAgentPlan({
      actions: [
        { type: "open_window", window: "iup" },
        { type: "set_iup_tab", tab: "delmal" },
      ],
      runAction: async (action) => {
        calls.push(action.type);
        if (action.type === "open_window" && calls.filter((c) => c === "open_window").length === 1) {
          return {
            status: "failed",
            verdict: "retryable",
            outcomeClass: "retryable_transient",
            message: "Tillfälligt fel",
          };
        }
        return { status: "ok", verdict: "applied", outcomeClass: "success" };
      },
      onStepStart: () => {},
      onStepEnd: () => {},
      onNeedsConfirm: () => {},
      onPlanFailed: () => {},
      onPlanComplete: () => {},
    });
    expect(res.status).toBe("ok");
    expect(calls).toEqual(["open_window", "set_iup_tab", "open_window"]);
  });
});


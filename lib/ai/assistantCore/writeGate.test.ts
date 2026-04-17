import { describe, expect, it } from "vitest";
import type { PusslaAgentAction } from "@/lib/ai/types";
import {
  consumeWriteProposal,
  createWriteGateState,
  createWriteProposal,
  isWriteAction,
} from "@/lib/ai/assistantCore/writeGate";

describe("assistantCore writeGate", () => {
  it("classifies mutate actions as write", () => {
    const action: PusslaAgentAction = {
      type: "update_selected_placement",
      fields: { note: "hej" },
    };
    expect(isWriteAction(action)).toBe(true);
  });

  it("requires matching token for write consume", () => {
    const action: PusslaAgentAction = {
      type: "update_selected_placement",
      fields: { milestones: ["C2"] },
    };
    const state0 = createWriteGateState();
    const built = createWriteProposal({ state: state0, action, nowMs: 1000, ttlMs: 60000 });
    const ok = consumeWriteProposal({
      state: built.state,
      action,
      token: built.proposal.token,
      nowMs: 1200,
    });
    expect(ok.ok).toBe(true);
  });

  it("rejects missing token", () => {
    const action: PusslaAgentAction = {
      type: "update_selected_placement",
      fields: { supervisor: "A" },
    };
    const state = createWriteGateState();
    const out = consumeWriteProposal({ state, action, token: "", nowMs: 1000 });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/token/i);
  });
});

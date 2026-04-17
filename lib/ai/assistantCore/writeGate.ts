import type { PusslaAgentAction } from "@/lib/ai/types";
import { getActionMeta } from "@/lib/ai/agent/actionRegistry";

export interface WriteProposal {
  token: string;
  actionFingerprint: string;
  createdAtMs: number;
  expiresAtMs: number;
  used: boolean;
}

export interface WriteGateState {
  proposals: WriteProposal[];
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_PROPOSALS = 20;

function uidToken(): string {
  return `wg_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createWriteGateState(): WriteGateState {
  return { proposals: [] };
}

export function fingerprintAction(action: PusslaAgentAction): string {
  return JSON.stringify(action);
}

export function isWriteAction(action: PusslaAgentAction): boolean {
  const capability = getActionMeta(action)?.capability;
  return capability === "mutate" || capability === "macro";
}

export function pruneWriteProposals(
  state: WriteGateState,
  nowMs: number = Date.now(),
  maxProposals: number = DEFAULT_MAX_PROPOSALS
): WriteGateState {
  const fresh = state.proposals.filter((p) => !p.used && p.expiresAtMs > nowMs);
  const sliced = fresh.slice(-Math.max(1, maxProposals));
  return { proposals: sliced };
}

export function createWriteProposal(params: {
  state: WriteGateState;
  action: PusslaAgentAction;
  nowMs?: number;
  ttlMs?: number;
}): { state: WriteGateState; proposal: WriteProposal } {
  const now = params.nowMs ?? Date.now();
  const ttlMs = Math.max(1000, params.ttlMs ?? DEFAULT_TTL_MS);
  const proposal: WriteProposal = {
    token: uidToken(),
    actionFingerprint: fingerprintAction(params.action),
    createdAtMs: now,
    expiresAtMs: now + ttlMs,
    used: false,
  };
  const pruned = pruneWriteProposals(params.state, now);
  return { state: { proposals: [...pruned.proposals, proposal] }, proposal };
}

export function consumeWriteProposal(params: {
  state: WriteGateState;
  action: PusslaAgentAction;
  token?: string | null;
  nowMs?: number;
}): {
  state: WriteGateState;
  ok: boolean;
  reason?: string;
} {
  const now = params.nowMs ?? Date.now();
  const pruned = pruneWriteProposals(params.state, now);
  const token = String(params.token || "").trim();
  if (!token) {
    return {
      state: pruned,
      ok: false,
      reason: "Skrivande steg saknar bekräftelse-token.",
    };
  }
  const fp = fingerprintAction(params.action);
  const idx = pruned.proposals.findIndex((p) => p.token === token);
  if (idx < 0) {
    return {
      state: pruned,
      ok: false,
      reason: "Bekräftelse-token saknas eller har gått ut.",
    };
  }
  const proposal = pruned.proposals[idx];
  if (proposal.used) {
    return { state: pruned, ok: false, reason: "Bekräftelse-token är redan förbrukad." };
  }
  if (proposal.expiresAtMs <= now) {
    return { state: pruned, ok: false, reason: "Bekräftelse-token har gått ut." };
  }
  if (proposal.actionFingerprint !== fp) {
    return {
      state: pruned,
      ok: false,
      reason: "Bekräftelse-token matchar inte det skrivande steget.",
    };
  }
  const updated = [...pruned.proposals];
  updated[idx] = { ...proposal, used: true };
  return { state: { proposals: updated }, ok: true };
}

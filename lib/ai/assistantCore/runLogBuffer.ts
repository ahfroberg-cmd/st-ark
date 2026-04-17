import type { AgentTelemetryEvent } from "@/lib/ai/agent/telemetry";

const STORAGE_KEY = "stark:agent-run-log:v1";
const MAX_ENTRIES = 300;

/** Fallback nar sessionStorage saknas (t.ex. vissa testmiljoer) eller ar kvotfull. */
let memoryFallback: AgentRunLogEntry[] = [];

export interface AgentRunLogEntry {
  ts: string;
  runId: string;
  event: AgentTelemetryEvent;
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readRaw(): AgentRunLogEntry[] {
  const store = getSessionStorage();
  if (store) {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return [...memoryFallback];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as AgentRunLogEntry[]) : [...memoryFallback];
    } catch {
      return [...memoryFallback];
    }
  }
  return [...memoryFallback];
}

function writeRaw(entries: AgentRunLogEntry[]) {
  const sliced = entries.slice(-MAX_ENTRIES);
  memoryFallback = sliced;
  const store = getSessionStorage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(sliced));
  } catch {
    /* quota / private mode — behaller memoryFallback */
  }
}

/** Sparar telemetri per runId i sessionStorage (felsökning / support, inte PII-intensiv). */
export function appendAgentRunLogEntry(runId: string, event: AgentTelemetryEvent): void {
  if (!runId) return;
  const entry: AgentRunLogEntry = {
    ts: new Date().toISOString(),
    runId,
    event: { ...event, runId },
  };
  const next = [...readRaw(), entry];
  writeRaw(next);
}

export function getAgentRunLog(): AgentRunLogEntry[] {
  return readRaw();
}

export function clearAgentRunLog(): void {
  memoryFallback = [];
  const store = getSessionStorage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

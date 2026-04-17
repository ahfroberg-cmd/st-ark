"use client";

import React, { useEffect, useRef, useState } from "react";
import AgentRunStatus, { type AgentRunPhase } from "@/components/chat/AgentRunStatus";
import ConfirmActionCard from "@/components/chat/ConfirmActionCard";
import { logAgentEvent, type AgentTelemetryEvent } from "@/lib/ai/agent/telemetry";
import {
  pickSnapshotForVerification,
  safeStableStringify,
} from "@/lib/ai/agent/snapshotVerify";
import { runAgentAction, runAgentPlan, runAgentRuntime } from "@/lib/ai/agent/runtime";
import {
  createAgentTaskState,
  markTaskInProgress,
  markTaskOutcome,
  summarizeTaskState,
  type AgentTaskState,
} from "@/lib/ai/agent/taskState";
import {
  createAgentSessionMemory,
  evaluateSessionGuardrails,
  fingerprintAction,
  recordAgentStep,
} from "@/lib/ai/agent/sessionMemory";
import { AGENT_DEFAULTS } from "@/lib/ai/agent/types";
import { hasUndoIntent, stripUndoPrefix } from "@/lib/ai/agent/languageLexicon";
import { actionLabel } from "@/lib/ai/actionPolicy";
import {
  buildAgentSystemPrompt,
  parseLocalAgentPlan,
  parseModelJsonResponse,
} from "@/lib/ai/pusslaAgent";
import { redactContactInfoText } from "@/lib/ai/piiRedaction";
import { mergeAgentUserFollowupInstruction } from "@/lib/chat/mergeAgentUserFollowup";
import { sendChatWithProvider } from "@/lib/ai/providerRouter";
import {
  isAssistantCoreReadOnlyEnabled,
} from "@/lib/ai/assistantCore/runPolicy";
import { runGatedPlanIfAllowed } from "@/lib/ai/assistantCore/executeGatedPlan";
import { createAgentRunId } from "@/lib/ai/assistantCore/runContext";
import { appendAgentRunLogEntry } from "@/lib/ai/assistantCore/runLogBuffer";
import { runHybridTurn } from "@/lib/ai/assistantCore/runHybridTurn";
import {
  consumeWriteProposal,
  createWriteGateState,
  createWriteProposal,
  isWriteAction,
} from "@/lib/ai/assistantCore/writeGate";
import type {
  AgentActionResult,
  AiMessage,
  AiProvider,
  PusslaAgentAction,
} from "@/lib/ai/types";
import type { AgentSessionMemoryState } from "@/lib/ai/agent/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

type PromptCheckpoint = {
  id: string;
  prompt: string;
  snapshotBefore: unknown;
  messageCountBefore: number;
  snapshotAfter?: unknown;
  messageCountAfter?: number;
};

export type AgentConfirmMode = "never" | "destructive" | "all";

export interface PusslaAgentAdapter {
  executeAction: (action: PusslaAgentAction) => Promise<AgentActionResult>;
  getContextSummary: () => string;
  captureSnapshot: () => unknown;
  restoreSnapshot: (snapshot: unknown) => Promise<AgentActionResult> | AgentActionResult;
}

const HISTORY_KEY = "stark:pussla-chat-history:v1";
const MAX_PROMPT_HISTORY_STEPS = 3;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function toAiMessages(messages: ChatMessage[], systemPrompt: string): AiMessage[] {
  const out: AiMessage[] = [
    {
      role: "system",
      content: redactContactInfoText(systemPrompt, { redactAddressLikeLines: true }),
    },
  ];
  messages.slice(-8).forEach((m) => {
    if (m.role === "system") return;
    out.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content: redactContactInfoText(m.text, { redactAddressLikeLines: true }),
    });
  });
  return out;
}

function loadHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x.text === "string");
  } catch {
    return [];
  }
}

function saveHistory(history: ChatMessage[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-50)));
}

function suggestNextBest(action: PusslaAgentAction, message: string): string | null {
  const m = String(message || "").toLowerCase();
  if (action.type === "save_selected_placement" && m.includes("ingen vald")) {
    return "Välj en placering först (klicka på placeringen i tidslinjen), och be mig sedan spara igen.";
  }
  if (action.type === "save_selected_course" && m.includes("ingen vald")) {
    return "Välj en kurs först (klicka på kursen i tidslinjen), och be mig sedan spara igen.";
  }
  if (action.type === "extend_last_placement" && m.includes("överlappa")) {
    return "Jag kan i stället föreslå ett kortare slutdatum som inte överlappar. Skriv t.ex. 'förläng sista placeringen till YYYY-MM-DD'.";
  }
  if (
    (action.type === "delete_selected_placement" ||
      action.type === "delete_selected_course" ||
      action.type === "delete_placement_by_month_year" ||
      action.type === "delete_course_by_month_year" ||
      action.type === "convert_course_to_utbildningsmoment") &&
    (m.includes("hittade") || m.includes("flera matchande"))
  ) {
    return action.type === "convert_course_to_utbildningsmoment"
      ? "Prova med mer exakt kursnamn (t.ex. citattecken kring titeln) eller kontrollera att start-, slut- eller intygdatum ligger i rätt månad."
      : "Prova med mer specifik instruktion, t.ex. exakt månad/år eller välj objektet och be mig ta bort den valda.";
  }
  if (m.includes("kunde inte")) {
    return "Jag kan försöka med en alternativ tolkning. Beskriv gärna målet med andra ord så tar jag nästa bästa steg.";
  }
  return null;
}

function summarizePlan(actions: PusslaAgentAction[]): string {
  if (actions.length === 0) return "Plan: inga steg.";
  const lines = actions.map((a, i) => `${i + 1}. ${friendlyActionLabel(a)}`);
  return `Jag tänker göra så här:\n${lines.join("\n")}`;
}

function sourceLabel(source?: string): string {
  if (source === "compiler") return "Intent-kompilator";
  if (source === "hierarchical") return "Hierarkisk plan";
  if (source === "local") return "Lokal parser";
  if (source === "llm") return "LLM-plan";
  return "";
}

function isColleagueReadAction(action: PusslaAgentAction): boolean {
  return (
    action.type === "summarize_colleague_placements" ||
    action.type === "summarize_colleague_courses"
  );
}

function friendlyActionLabel(action: PusslaAgentAction): string {
  if (action.type === "convert_course_to_utbildningsmoment") {
    return `Ändra "${action.courseTitle}" till utbildningsmoment${action.description ? " och uppdatera beskrivningen" : ""}`;
  }
  return actionLabel(action);
}

function simplifyAssistantText(input: string): string {
  let text = String(input || "");
  text = text
    .split("\n")
    .filter((line) => !/^Version sparad under Spara:/i.test(line.trim()))
    .join("\n")
    .trim();

  text = text
    .split("\n")
    .filter((line) => {
      const L = line.trim();
      if (!L) return true;
      if (/^bekräfta\b/i.test(L)) return false;
      if (/vill du att jag (ska )?(köra|göra|fortsätta)\b/i.test(L)) return false;
      if (/^säg (ja|ok|okej|kör)\b/i.test(L)) return false;
      if (/ge (klartecken|besked)/i.test(L) && L.length < 160) return false;
      return true;
    })
    .join("\n")
    .trim();

  text = text
    .replace(/\(sparad i databasen\)\.?/gi, "")
    .replace(/\bi databasen\b/gi, "")
    .replace(
      /\s*[.!?]?\s*(Bekräfta( om jag ska köra( detta)?)?|Vill du att jag ska köra\??|Säg (ja|ok|kör)( om.*)?)\s*[.!?]?\s*$/i,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || "Klart.";
}

function buildChronologicalCheckpoints(
  applied: PromptCheckpoint[],
  redo: PromptCheckpoint[]
): PromptCheckpoint[] {
  const redoChrono = [...redo].reverse();
  const chronoAll = [...applied, ...redoChrono];
  const seenCheckpointIds = new Set<string>();
  const dedupedChrono: PromptCheckpoint[] = [];
  for (let i = chronoAll.length - 1; i >= 0; i -= 1) {
    const cp = chronoAll[i];
    if (seenCheckpointIds.has(cp.id)) continue;
    seenCheckpointIds.add(cp.id);
    dedupedChrono.unshift(cp);
  }
  return dedupedChrono;
}

async function narrateColleagueNaturalReply(
  provider: AiProvider,
  model: string,
  apiKey: string,
  userQuestion: string,
  rawData: string
): Promise<string> {
  const system = [
    "Du är en hjälpsam assistent för ST-läkare i appen PusslaDinST.",
    "Du får rådata: kollegors egna noteringar i databasen (placering eller kurs).",
    "Svara kort och naturligt på svenska, som i en vanlig chatt.",
    "Inga JSON-objekt. Skriv inte rubriker som \"Underlag\", \"Källtexter\" eller \"Plan\".",
    "Om noteringen är tom, bara ett par tecken eller uppenbart meningslös (t.ex. slumpmässiga bokstäver som inte bildar begripliga svenska ord), säg det rakt ut och exemplifiera gärna.",
    "Om innehållet är vettigt kan du kort sammanfatta eller återge poängen.",
  ].join(" ");
  const safeQuestion = redactContactInfoText(userQuestion, { redactAddressLikeLines: true });
  const safeRawData = redactContactInfoText(rawData, { redactAddressLikeLines: true });
  const user = `Användarens fråga:\n${safeQuestion}\n\nData från databasen:\n${safeRawData.slice(0, 12000)}`;
  const llm = await sendChatWithProvider({
    provider,
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  let t = llm.text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-z]*\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }
  return t || rawData;
}

export default function PusslaChatWidget({
  adapter,
  enabled,
  provider,
  model,
  apiKey,
  confirmMode,
  onProviderChange,
  onModelChange,
}: {
  adapter: PusslaAgentAdapter;
  enabled: boolean;
  provider: AiProvider;
  model: string;
  apiKey?: string;
  confirmMode: AgentConfirmMode;
  onProviderChange: (provider: AiProvider) => void;
  onModelChange: (model: string) => void;
}) {
  const assistantCoreReadOnly = isAssistantCoreReadOnlyEnabled();
  const telemetryRunIdRef = useRef<string | undefined>(undefined);
  const awaitingConfirmAfterRunRef = useRef(false);
  const logTelemetry = (event: AgentTelemetryEvent) => {
    const rid = telemetryRunIdRef.current;
    const payload = rid ? { ...event, runId: rid } : event;
    logAgentEvent(payload);
    if (rid) appendAgentRunLogEntry(rid, payload);
  };
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const messagesRef = useRef<ChatMessage[]>(messages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PusslaAgentAction | null>(null);
  const pendingWriteTokenRef = useRef<string | null>(null);
  const writeGateStateRef = useRef(createWriteGateState());
  const [queuedActions, setQueuedActions] = useState<PusslaAgentAction[]>([]);
  const [promptCheckpoints, setPromptCheckpoints] = useState<PromptCheckpoint[]>([]);
  const [redoCheckpoints, setRedoCheckpoints] = useState<PromptCheckpoint[]>([]);
  const [undoPanelOpen, setUndoPanelOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string>("");
  const recognitionRef = useRef<any>(null);
  const micAccessVerifiedRef = useRef(false);
  const voiceDebug = (event: string, data?: Record<string, unknown>) => {
    try {
      const payload = {
        event,
        ts: new Date().toISOString(),
        origin: typeof window !== "undefined" ? window.location.origin : "n/a",
        secureContext: typeof window !== "undefined" ? window.isSecureContext : false,
        visibility:
          typeof document !== "undefined" ? document.visibilityState : "unknown",
        ...data,
      };
      if (typeof window !== "undefined") {
        const w = window as any;
        if (!Array.isArray(w.__voiceDebugEvents)) w.__voiceDebugEvents = [];
        w.__voiceDebugEvents.push(payload);
        if (w.__voiceDebugEvents.length > 200) {
          w.__voiceDebugEvents = w.__voiceDebugEvents.slice(-200);
        }
      }
      console.log("[voice-debug]", payload);
    } catch {
      // ignore debug errors
    }
  };
  const lastResolvedInstructionRef = useRef<string>("");
  const pendingPlanRef = useRef<PusslaAgentAction[]>([]);
  const sessionMemRef = useRef<AgentSessionMemoryState | null>(null);
  const internalMutationDepthRef = useRef(0);
  const lastKnownSnapshotRef = useRef("");
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [agentUi, setAgentUi] = useState<{
    phase: AgentRunPhase;
    goalSummary: string;
    stepIndex: number;
    stepTotal: number;
    currentLabel: string;
    planSource: string;
    replanReason: string;
    taskSummary: string;
  }>({
    phase: "idle",
    goalSummary: "",
    stepIndex: 0,
    stepTotal: 0,
    currentLabel: "",
    planSource: "",
    replanReason: "",
    taskSummary: "",
  });
  const taskStateRef = useRef<AgentTaskState | null>(null);

  const runAsInternalMutation = async <T,>(fn: () => Promise<T>): Promise<T> => {
    internalMutationDepthRef.current += 1;
    try {
      return await fn();
    } finally {
      internalMutationDepthRef.current = Math.max(0, internalMutationDepthRef.current - 1);
    }
  };

  const rememberCurrentSnapshot = () => {
    const current = adapter.captureSnapshot();
    const fp = safeStableStringify(pickSnapshotForVerification(current));
    lastKnownSnapshotRef.current = fp;
  };

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    rememberCurrentSnapshot();
    const t = window.setInterval(() => {
      if (busy) return;
      const current = adapter.captureSnapshot();
      const fp = safeStableStringify(pickSnapshotForVerification(current));
      if (!lastKnownSnapshotRef.current) {
        lastKnownSnapshotRef.current = fp;
        return;
      }
      if (fp !== lastKnownSnapshotRef.current) {
        // Manuella ändringar efter tidsresa ska kapa framtida prompts.
        if (internalMutationDepthRef.current === 0 && redoCheckpoints.length > 0) {
          setRedoCheckpoints([]);
        }
        lastKnownSnapshotRef.current = fp;
      }
    }, 900);
    return () => window.clearInterval(t);
  }, [adapter, busy, redoCheckpoints.length]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = messagesScrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages, pendingAction, open, busy]);

  useEffect(() => {
    if (!pendingAction) pendingWriteTokenRef.current = null;
  }, [pendingAction]);

  const append = (role: ChatMessage["role"], text: string) => {
    setMessages((prev) => {
      const next = [...prev, { id: uid(), role, text }];
      messagesRef.current = next;
      saveHistory(next);
      return next;
    });
  };

  const replaceMessages = (nextMessages: ChatMessage[]) => {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    saveHistory(nextMessages);
  };

  const resetAssistantMemory = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
    messagesRef.current = [];
    setMessages([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(HISTORY_KEY);
    }
    setInput("");
    setPendingAction(null);
    setQueuedActions([]);
    setPromptCheckpoints([]);
    setRedoCheckpoints([]);
    setUndoPanelOpen(false);
    setListening(false);
    setVoiceMsg("");
    lastResolvedInstructionRef.current = "";
    pendingPlanRef.current = [];
    sessionMemRef.current = null;
    taskStateRef.current = null;
    setAgentUi({
      phase: "idle",
      goalSummary: "",
      stepIndex: 0,
      stepTotal: 0,
      currentLabel: "",
      planSource: "",
      replanReason: "",
      taskSummary: "",
    });
    logTelemetry({ kind: "run_end", status: "aborted" });
    rememberCurrentSnapshot();
  };

  const restoreFromCheckpoint = async (checkpointId: string) => {
    if (busy) return;
    const idx = promptCheckpoints.findIndex((c) => c.id === checkpointId);
    if (idx < 0) return;
    const cp = promptCheckpoints[idx];
    setBusy(true);
    try {
      const restored = await runAsInternalMutation(() =>
        Promise.resolve(adapter.restoreSnapshot(cp.snapshotBefore))
      );
      if (!restored.ok) {
        append("assistant", restored.message);
        return;
      }
      replaceMessages(messagesRef.current.slice(0, cp.messageCountBefore));
      setInput("");
      setPendingAction(null);
      setQueuedActions([]);
      pendingPlanRef.current = [];
      lastResolvedInstructionRef.current = "";
      setPromptCheckpoints((prev) => {
        const removed = prev.slice(idx);
        if (removed.length > 0) {
          setRedoCheckpoints((curr) =>
            [...curr, ...removed.reverse()].slice(-MAX_PROMPT_HISTORY_STEPS)
          );
        }
        return prev.slice(0, idx);
      });
      rememberCurrentSnapshot();
    } finally {
      setBusy(false);
    }
  };

  const undoLatestAppliedCheckpoint = async (): Promise<{ ok: boolean; message: string }> => {
    const latest = promptCheckpoints[promptCheckpoints.length - 1];
    if (!latest) {
      return { ok: false, message: "Jag hittar ingen tidigare agentändring att återställa." };
    }
    const restored = await runAsInternalMutation(() =>
      Promise.resolve(adapter.restoreSnapshot(latest.snapshotBefore))
    );
    if (!restored.ok) {
      return restored;
    }
    setPromptCheckpoints((prev) => prev.slice(0, -1));
    setRedoCheckpoints((curr) => [...curr, latest].slice(-MAX_PROMPT_HISTORY_STEPS));
    setPendingAction(null);
    setQueuedActions([]);
    pendingPlanRef.current = [];
    rememberCurrentSnapshot();
    return { ok: true, message: "Återställde senaste agentändringen." };
  };

  const jumpForwardToCheckpoint = async (checkpointId: string) => {
    if (busy) return;

    const chronoAll = buildChronologicalCheckpoints(promptCheckpoints, redoCheckpoints);
    const idx = chronoAll.findIndex((c) => c.id === checkpointId);
    if (idx < 0) return;

    const cp = chronoAll[idx];
    if (!cp.snapshotAfter || !Number.isFinite(cp.messageCountAfter || NaN)) return;

    setBusy(true);
    try {
      const restored = await runAsInternalMutation(() =>
        Promise.resolve(adapter.restoreSnapshot(cp.snapshotAfter))
      );
      if (!restored.ok) {
        append("assistant", restored.message);
        return;
      }

      replaceMessages(messagesRef.current.slice(0, Number(cp.messageCountAfter)));
      setInput("");
      setPendingAction(null);
      setQueuedActions([]);
      pendingPlanRef.current = [];
      lastResolvedInstructionRef.current = "";

      const newApplied = chronoAll.slice(0, idx + 1).slice(-MAX_PROMPT_HISTORY_STEPS);
      const newRedoChrono = chronoAll.slice(idx + 1);
      const newRedoStored = [...newRedoChrono]
        .reverse()
        .slice(-MAX_PROMPT_HISTORY_STEPS);

      setPromptCheckpoints(newApplied.slice(-MAX_PROMPT_HISTORY_STEPS));
      setRedoCheckpoints(newRedoStored);
      rememberCurrentSnapshot();
    } finally {
      setBusy(false);
    }
  };

  const redoLatestCheckpoint = async () => {
    if (busy || redoCheckpoints.length === 0) return;
    const cp = redoCheckpoints[redoCheckpoints.length - 1];
    if (!cp.snapshotAfter || !Number.isFinite(cp.messageCountAfter || NaN)) {
      return;
    }
    setBusy(true);
    try {
      const restored = await runAsInternalMutation(() =>
        Promise.resolve(adapter.restoreSnapshot(cp.snapshotAfter))
      );
      if (!restored.ok) {
        append("assistant", restored.message);
        return;
      }
      replaceMessages(messagesRef.current.slice(0, Number(cp.messageCountAfter)));
      setRedoCheckpoints((prev) => prev.slice(0, -1));
      setPromptCheckpoints((prev) => [...prev, cp].slice(-MAX_PROMPT_HISTORY_STEPS));
      rememberCurrentSnapshot();
    } finally {
      setBusy(false);
    }
  };

  const jumpToPromptBoundary = async (
    history: PromptCheckpoint[],
    boundaryIdx: number
  ) => {
    if (busy || history.length === 0) return;
    const safeBoundary = Math.max(0, Math.min(boundaryIdx, history.length));
    setBusy(true);
    try {
      if (safeBoundary === 0) {
        const first = history[0];
        const restored = await runAsInternalMutation(() =>
          Promise.resolve(adapter.restoreSnapshot(first.snapshotBefore))
        );
        if (!restored.ok) {
          append("assistant", restored.message);
          return;
        }
        replaceMessages(messagesRef.current.slice(0, first.messageCountBefore));
        setPromptCheckpoints([]);
        setRedoCheckpoints([...history].reverse().slice(-MAX_PROMPT_HISTORY_STEPS));
        setInput("");
        setPendingAction(null);
        setQueuedActions([]);
        pendingPlanRef.current = [];
        lastResolvedInstructionRef.current = "";
        rememberCurrentSnapshot();
        return;
      }

      const prev = history[safeBoundary - 1];
      if (!prev.snapshotAfter || !Number.isFinite(Number(prev.messageCountAfter))) return;
      const restored = await runAsInternalMutation(() =>
        Promise.resolve(adapter.restoreSnapshot(prev.snapshotAfter))
      );
      if (!restored.ok) {
        append("assistant", restored.message);
        return;
      }
      replaceMessages(messagesRef.current.slice(0, Number(prev.messageCountAfter)));
      setPromptCheckpoints(history.slice(0, safeBoundary).slice(-MAX_PROMPT_HISTORY_STEPS));
      setRedoCheckpoints(
        [...history.slice(safeBoundary)].reverse().slice(-MAX_PROMPT_HISTORY_STEPS)
      );
      setInput("");
      setPendingAction(null);
      setQueuedActions([]);
      pendingPlanRef.current = [];
      lastResolvedInstructionRef.current = "";
      rememberCurrentSnapshot();
    } finally {
      setBusy(false);
    }
  };

  const appendAssistantAfterAction = async (
    action: PusslaAgentAction,
    res: AgentActionResult,
    userQuestion?: string
  ) => {
    if (!res.ok) {
      append("assistant", simplifyAssistantText(res.message));
      const suggestion = suggestNextBest(action, res.message);
      if (suggestion) append("assistant", suggestion);
      return;
    }
    const uq =
      (userQuestion || "").trim() ||
      lastResolvedInstructionRef.current.trim() ||
      "Kollegdata";
    if (isColleagueReadAction(action) && apiKey) {
      try {
        const narrated = await narrateColleagueNaturalReply(
          provider,
          model,
          apiKey,
          uq,
          res.message
        );
        append("assistant", simplifyAssistantText(narrated));
      } catch {
        append("assistant", simplifyAssistantText(res.message));
      }
      return;
    }
    append("assistant", simplifyAssistantText(res.message));
  };

  const runAction = async (
    action: PusslaAgentAction,
    userQuestion?: string,
    forceExecute = false,
    writeToken?: string | null
  ): Promise<{ status: "ok" | "confirm" | "failed"; message?: string; blocked?: boolean }> => {
    if (forceExecute && isWriteAction(action)) {
      const consumed = consumeWriteProposal({
        state: writeGateStateRef.current,
        action,
        token: writeToken,
      });
      writeGateStateRef.current = consumed.state;
      if (!consumed.ok) {
        append("assistant", consumed.reason || "Skrivande steg saknar giltig bekräftelse.");
        return { status: "failed", message: consumed.reason, blocked: true };
      }
    }

    return runAgentAction({
      action,
      userQuestion,
      forceExecute,
      confirmMode,
      friendlyActionLabel,
      executeAction: (a) => runAsInternalMutation(() => adapter.executeAction(a)),
      captureSnapshot: () => adapter.captureSnapshot(),
      appendSystem: (text) => append("system", text),
      appendAssistantAfterAction,
      onAwaitingConfirm: (a) => {
        if (isWriteAction(a)) {
          const built = createWriteProposal({
            state: writeGateStateRef.current,
            action: a,
          });
          writeGateStateRef.current = built.state;
          pendingWriteTokenRef.current = built.proposal.token;
        } else {
          pendingWriteTokenRef.current = null;
        }
        setPendingAction(a);
        setAgentUi((u) => ({
          ...u,
          phase: "waiting_confirm",
          currentLabel: friendlyActionLabel(a),
        }));
      },
      onBlocked: (reason) => {
        append("assistant", reason);
        logTelemetry({ kind: "blocked", reason });
        setAgentUi((u) => ({ ...u, phase: "blocked" }));
      },
      rememberCurrentSnapshot,
      onRecordStepAndCheckGuardrail: (a, ok) => {
        if (!sessionMemRef.current) return { blocked: false };
        recordAgentStep(sessionMemRef.current, a, ok);
        if (ok) return { blocked: false };
        const guard = evaluateSessionGuardrails(
          sessionMemRef.current,
          fingerprintAction(a)
        );
        return guard.blocked
          ? { blocked: true, reason: guard.reason }
          : { blocked: false };
      },
    });
  };

  const runPlan = async (
    actions: PusslaAgentAction[],
    userQuestion?: string
  ): Promise<{
    status: "ok" | "confirm" | "failed";
    message?: string;
    remainingActions?: PusslaAgentAction[];
  }> => {
    return runAgentPlan({
      actions,
      userQuestion,
      runAction,
      onStepStart: (i, total, action) => {
        if (taskStateRef.current) {
          taskStateRef.current = markTaskInProgress(taskStateRef.current, i);
        }
        setAgentUi((u) => ({
          ...u,
          phase: "executing",
          stepIndex: i,
          stepTotal: total,
          currentLabel: friendlyActionLabel(action),
          taskSummary: taskStateRef.current ? summarizeTaskState(taskStateRef.current) : u.taskSummary,
        }));
        logTelemetry({
          kind: "step_start",
          index: i,
          total,
          actionType: action.type,
        });
      },
      onStepEnd: (i, ok, outcome) => {
        if (taskStateRef.current) {
          taskStateRef.current = markTaskOutcome(taskStateRef.current, i, outcome);
          setAgentUi((u) => ({
            ...u,
            taskSummary: summarizeTaskState(taskStateRef.current!),
          }));
        }
        logTelemetry({
          kind: "step_end",
          index: i,
          ok,
        });
      },
      onNeedsConfirm: (i, remaining) => {
        setQueuedActions(remaining);
        pendingPlanRef.current = actions.slice(i);
        if (remaining.length > 0) {
          append(
            "assistant",
            `Efter bekräftelse återstår:\n${remaining
              .map((a, idx) => `${idx + 1}. ${friendlyActionLabel(a)}`)
              .join("\n")}`
          );
        }
      },
      onPlanFailed: (remaining) => {
        if (remaining.length > 0) {
          append(
            "assistant",
            `Jag kunde inte slutföra hela planen. Kvar att göra:\n${remaining
              .map((a, idx) => `${idx + 1}. ${friendlyActionLabel(a)}`)
              .join("\n")}`
          );
        }
      },
      onPlanComplete: () => {
        setQueuedActions([]);
        pendingPlanRef.current = [];
      },
    });
  };

  const executeWithAutoReplan = async (
    initialActions: PusslaAgentAction[],
    skipPrimaryPlan = false,
    userQuestion?: string,
    goalSummary?: string,
    planSource?: string
  ) => {
    if (initialActions.length === 0) return;
    if (!sessionMemRef.current) {
      sessionMemRef.current = createAgentSessionMemory(
        (goalSummary || "").trim() || (userQuestion || "").slice(0, 160),
        userQuestion || ""
      );
    }
    setAgentUi((u) => ({
      ...u,
      goalSummary: sessionMemRef.current?.goalSummary || u.goalSummary,
      phase: "executing",
      stepTotal: initialActions.length,
      planSource: sourceLabel(planSource) || u.planSource,
      replanReason: "",
      taskSummary: taskStateRef.current ? summarizeTaskState(taskStateRef.current) : "",
    }));
    logTelemetry({
      kind: "run_start",
      instructionPreview: (userQuestion || "").slice(0, 120),
      goalSummary: sessionMemRef.current?.goalSummary,
    });
    logTelemetry({ kind: "plan_ready", stepCount: initialActions.length });

    const maxAttempts = AGENT_DEFAULTS.maxPlanReorderAttempts;
    const result = await runAgentRuntime({
      initialActions,
      maxAttempts,
      skipPrimaryPlan,
      runPlan: (plan) => runPlan(plan, userQuestion),
      onAttemptStart: (attempt, max, plan) => {
        taskStateRef.current = createAgentTaskState(plan, friendlyActionLabel);
        setAgentUi((u) => ({
          ...u,
          stepTotal: plan.length,
          taskSummary: summarizeTaskState(taskStateRef.current!),
        }));
        const onlyColleagueReads =
          plan.length > 0 && plan.every((a) => isColleagueReadAction(a));
        if (!onlyColleagueReads) {
          append("system", `Planförsök ${attempt + 1}/${max}`);
          append(
            "assistant",
            attempt === 0
              ? summarizePlan(plan)
              : `Alternativ plan ${attempt + 1}:\n${summarizePlan(plan)}`
          );
        }
        if (attempt > 0) {
          logTelemetry({ kind: "replan", attempt: attempt + 1, reason: "retry_alternate_order" });
        }
      },
      onAttemptFailed: (_attempt, failedResult) => {
        setAgentUi((u) => ({
          ...u,
          replanReason: String(failedResult.message || "Planfel"),
        }));
        append(
          "assistant",
          "Något hindrade planen. Jag backar, planerar om och försöker igen med en annan ordning."
        );
      },
    });
    if (result.status === "ok") {
      awaitingConfirmAfterRunRef.current = false;
      logTelemetry({ kind: "run_end", status: "ok" });
      setAgentUi((u) => ({ ...u, phase: "idle", currentLabel: "" }));
      return;
    }
    if (result.status === "confirm") {
      awaitingConfirmAfterRunRef.current = true;
      logTelemetry({ kind: "run_end", status: "confirm_wait" });
      return;
    }
    awaitingConfirmAfterRunRef.current = false;
    logTelemetry({ kind: "run_end", status: "failed" });
    setAgentUi((u) => ({ ...u, phase: "idle", currentLabel: "" }));
    append(
      "assistant",
      "Jag kunde inte slutföra hela kedjan automatiskt den här gången. Jag har backat och försökt flera vägar."
    );
  };

  const confirmPendingAction = async () => {
    const action = pendingAction;
    if (!action) return;
    setBusy(true);
    try {
      const result = await runAction(
        action,
        lastResolvedInstructionRef.current,
        true,
        pendingWriteTokenRef.current
      );
      if (result.status === "failed") {
        const canRetry = pendingPlanRef.current.length > 1;
        if (canRetry) {
          append(
            "assistant",
            "Steget misslyckades. Jag backar och planerar om resterande steg."
          );
          const fallbackPlan = [...pendingPlanRef.current];
          setPendingAction(null);
          pendingWriteTokenRef.current = null;
          setQueuedActions([]);
          await executeWithAutoReplan(
            fallbackPlan,
            true,
            lastResolvedInstructionRef.current
          );
          return;
        }
        setPendingAction(null);
        pendingWriteTokenRef.current = null;
        setQueuedActions([]);
        return;
      }
      setPendingAction(null);
      pendingWriteTokenRef.current = null;
      if (queuedActions.length > 0) {
        const rest = [...queuedActions];
        setQueuedActions([]);
        const runRest = await runPlan(rest, lastResolvedInstructionRef.current);
        if (
          runRest.status === "failed"
        ) {
          append("assistant", "Resterande steg mötte motstånd. Jag planerar om och provar igen.");
          await executeWithAutoReplan(
            rest,
            false,
            lastResolvedInstructionRef.current
          );
        }
      }
    } finally {
      setBusy(false);
      awaitingConfirmAfterRunRef.current = false;
      telemetryRunIdRef.current = undefined;
    }
  };

  const runHybridPlan = async (text: string) => {
    telemetryRunIdRef.current = createAgentRunId();
    awaitingConfirmAfterRunRef.current = false;
    try {
    const applyGatedPlanOrStop = async (
      actions: PusslaAgentAction[],
      goalSummary: string,
      source?: string
    ) => {
      const result = await runGatedPlanIfAllowed({
        userText: text,
        forceReadOnly: assistantCoreReadOnly,
        actions,
        executeAllowed: (allowed) =>
          executeWithAutoReplan(allowed, false, text, goalSummary, source),
      });
      if (!result.ok) {
        append("assistant", result.assistantMessage);
        if (result.systemMessage) append("system", result.systemMessage);
        setAgentUi((u) => ({ ...u, phase: "idle", currentLabel: "" }));
        return false;
      }
      return true;
    };

    await runHybridTurn({
      userText: text,
      snapshot: adapter.captureSnapshot(),
      hasApiKey: Boolean(apiKey),
      append,
      logEvent: logTelemetry,
      ui: {
        enterPlanning: (preview) =>
          setAgentUi({
            phase: "planning",
            goalSummary: preview,
            stepIndex: 0,
            stepTotal: 0,
            currentLabel: "Tolkar mål och plan…",
            planSource: "",
            replanReason: "",
            taskSummary: "",
          }),
        setGoalSummaryFromLlm: (gs) => setAgentUi((u) => ({ ...u, goalSummary: gs })),
        enterIdle: () => setAgentUi((u) => ({ ...u, phase: "idle", currentLabel: "" })),
        resetAfterMissingApiKey: () =>
          setAgentUi({
            phase: "idle",
            goalSummary: "",
            stepIndex: 0,
            stepTotal: 0,
            currentLabel: "",
            planSource: "",
            replanReason: "",
            taskSummary: "",
          }),
      },
      buildAiMessages: () =>
        toAiMessages(
          [...messagesRef.current, { id: uid(), role: "user", text }],
          buildAgentSystemPrompt(adapter.getContextSummary())
        ),
      sendLlm: (messages) =>
        sendChatWithProvider({
          provider,
          apiKey: apiKey as string,
          model,
          messages,
        }),
      parseModelResponse: parseModelJsonResponse,
      simplifyText: simplifyAssistantText,
      runGatedPlan: applyGatedPlanOrStop,
    });
    } finally {
      if (!awaitingConfirmAfterRunRef.current) {
        telemetryRunIdRef.current = undefined;
      }
    }
  };

  const onSend = async () => {
    const text = input.trim();
    if (!text || busy) return;

    const isConfirmShort =
      /^(ja|japp|ok|okej|gärna|gör\s+det|kör|bekräfta|yes)\b/i.test(text);
    if (pendingAction && isConfirmShort) {
      setInput("");
      append("user", text);
      await confirmPendingAction();
      return;
    }

    const priorInstruction = lastResolvedInstructionRef.current.trim();
    let resolvedText = mergeAgentUserFollowupInstruction(priorInstruction, text);
    setInput("");
    append("user", text);

    setBusy(true);
    let checkpoint: PromptCheckpoint | null = null;
    try {
      if (hasUndoIntent(resolvedText)) {
        const undoRes = await undoLatestAppliedCheckpoint();
        append("assistant", undoRes.message);
        if (!undoRes.ok) {
          setAgentUi((u) => ({ ...u, phase: "idle", currentLabel: "" }));
          return;
        }
        const stripped = stripUndoPrefix(resolvedText);
        if (!stripped) {
          setAgentUi((u) => ({ ...u, phase: "idle", currentLabel: "" }));
          return;
        }
        resolvedText = stripped;
      }
      checkpoint = {
        id: uid(),
        prompt: text,
        snapshotBefore: adapter.captureSnapshot(),
        messageCountBefore: messagesRef.current.length,
      };
      // Om man har backat och sedan gör en ny ändring i UI-läget
      // (dvs divergerar från den tidigare agenttråden), så ska "framåt"-historiken tas bort.
      setRedoCheckpoints([]);
      sessionMemRef.current = null;
      taskStateRef.current = null;
      setPromptCheckpoints((prev) => [...prev, checkpoint!].slice(-MAX_PROMPT_HISTORY_STEPS));
      lastResolvedInstructionRef.current = resolvedText;
      await runHybridPlan(resolvedText);
    } catch {
      const localPlan = parseLocalAgentPlan(resolvedText);
      if (localPlan.length > 0) {
        append(
          "assistant",
          "Jag kunde inte använda AI-svaret, så jag försökte med en enklare tolkning."
        );
        await applyGatedPlanOrStop(
          localPlan,
          resolvedText.slice(0, 120),
          "local"
        );
      } else {
        append(
          "assistant",
          `Jag kunde inte slutföra just nu. Försök igen strax. (${provider})`
        );
        setAgentUi((u) => ({ ...u, phase: "idle", currentLabel: "" }));
      }
    } finally {
      const snapshotAfter = adapter.captureSnapshot();
      const messageCountAfter = messagesRef.current.length;
      if (checkpoint) {
        setPromptCheckpoints((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i -= 1) {
            if (next[i].id === checkpoint!.id) {
              next[i] = { ...next[i], snapshotAfter, messageCountAfter };
              break;
            }
          }
          return next;
        });
      }
      setBusy(false);
    }
  };

  const startVoiceInput = async () => {
    try {
      voiceDebug("startVoiceInput:begin", {
        listening,
        hasRecognition: Boolean(recognitionRef.current),
      });
      if (recognitionRef.current && listening) {
        voiceDebug("startVoiceInput:stop-existing");
        recognitionRef.current.stop();
        return;
      }
      const getMicPermissionState = async (): Promise<"granted" | "denied" | "prompt" | "unknown"> => {
        try {
          if (!(navigator as any)?.permissions?.query) return "unknown";
          const status = await (navigator as any).permissions.query({ name: "microphone" });
          const state = String(status?.state || "unknown");
          voiceDebug("permissions.query:microphone", { state });
          if (state === "granted" || state === "denied" || state === "prompt") return state;
          return "unknown";
        } catch {
          voiceDebug("permissions.query:microphone:error");
          return "unknown";
        }
      };
      const SpeechCtor =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      voiceDebug("speechCtor:check", {
        supported: Boolean(SpeechCtor),
        ctor: (window as any).SpeechRecognition
          ? "SpeechRecognition"
          : (window as any).webkitSpeechRecognition
            ? "webkitSpeechRecognition"
            : "none",
      });
      if (!SpeechCtor) {
        setVoiceMsg("Taligenkänning stöds inte i denna webbläsare.");
        return;
      }

      // Trigger browser mic permission prompt as the first async call in the click handler.
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          setVoiceMsg("Begär mikrofonåtkomst i webbläsaren...");
          voiceDebug("gum:request");
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          voiceDebug("gum:success", {
            tracks: Array.isArray(stream?.getTracks?.()) ? stream.getTracks().length : 0,
          });
          micAccessVerifiedRef.current = true;
          stream.getTracks().forEach((t) => t.stop());
          setVoiceMsg("Mikrofon aktiverad. Startar lyssning...");
        } catch (err: any) {
          micAccessVerifiedRef.current = false;
          const code = String(err?.name || err?.code || "").toLowerCase();
          voiceDebug("gum:error", {
            code,
            rawName: err?.name,
            rawMessage: err?.message,
          });
          if (code.includes("notallowed") || code.includes("permissiondenied")) {
            const afterState = await getMicPermissionState();
            const origin = window.location.origin;
            voiceDebug("gum:not-allowed", { afterState, origin });
            if (afterState === "granted") {
              setVoiceMsg(
                `Mikrofon är tillåten men blockerades ändå (origin: ${origin}). Stäng andra appar/flikar som använder mikrofonen och försök igen.`
              );
              return;
            }
            if (afterState === "prompt") {
              setVoiceMsg(
                "Mikrofonåtkomst nekades trots läge 'Fråga'. Klicka på 'Begär mikrofon igen' och välj Tillåt i popupen."
              );
            } else {
              setVoiceMsg(
                `Mikrofonåtkomst nekades för ${origin}. Tillåt mikrofon för just denna adress och försök igen.`
              );
            }
            return;
          }
          if (code.includes("notfound") || code.includes("devicesnotfounderror")) {
            setVoiceMsg("Ingen mikrofon hittades. Kontrollera ljudenhet i systemet.");
            return;
          }
          setVoiceMsg("Kunde inte begära mikrofonåtkomst. Kontrollera webbläsarens behörigheter.");
          return;
        }
      }

      const recognition = new SpeechCtor();
      recognition.lang = "sv-SE";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => {
        voiceDebug("sr:onstart");
        setListening(true);
        setVoiceMsg("Lyssnar...");
      };
      recognition.onerror = (event: any) => {
        setListening(false);
        const code = String(event?.error || "").toLowerCase();
        voiceDebug("sr:onerror", {
          code,
          rawError: event?.error,
          message: event?.message,
          micAccessVerified: micAccessVerifiedRef.current,
        });
        if (code === "not-allowed" || code === "service-not-allowed") {
          if (micAccessVerifiedRef.current) {
            setVoiceMsg(
              "Mikrofonen är tillåten, men taligenkänningen blockerades av webbläsaren. Testa att stänga andra mikrofon-appar/flikar och starta om Chrome."
            );
          } else {
            setVoiceMsg("Mikrofonåtkomst nekades. Tillåt mikrofon för sidan och försök igen.");
          }
          return;
        }
        if (code === "no-speech") {
          setVoiceMsg("Ingen talinput hördes. Försök igen och tala direkt.");
          return;
        }
        if (code === "audio-capture") {
          setVoiceMsg("Ingen mikrofon hittades. Kontrollera ljudenhet i systemet.");
          return;
        }
        if (code === "network") {
          setVoiceMsg("Nätverksfel i taligenkänning. Kontrollera anslutning och försök igen.");
          return;
        }
        setVoiceMsg("Taligenkänning misslyckades. Försök igen.");
      };
      recognition.onend = () => {
        voiceDebug("sr:onend");
        setListening(false);
        micAccessVerifiedRef.current = false;
        recognitionRef.current = null;
      };
      recognition.onresult = (event: any) => {
        const transcript = String(event?.results?.[0]?.[0]?.transcript || "").trim();
        voiceDebug("sr:onresult", { transcriptLength: transcript.length });
        if (!transcript) return;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setVoiceMsg("Text inläst.");
      };
      recognitionRef.current = recognition;
      voiceDebug("sr:start-call");
      recognition.start();
    } catch {
      voiceDebug("startVoiceInput:catch");
      setListening(false);
      micAccessVerifiedRef.current = false;
      setVoiceMsg("Kunde inte starta taligenkänning.");
    }
  };

  const requestMicAccessOnly = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        voiceDebug("requestMicAccessOnly:no-mediaDevices");
        setVoiceMsg("Denna webbläsare saknar stöd för mikrofon-API.");
        return;
      }
      setVoiceMsg("Begär mikrofonåtkomst i webbläsaren...");
      voiceDebug("requestMicAccessOnly:gum:request");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceDebug("requestMicAccessOnly:gum:success");
      stream.getTracks().forEach((t) => t.stop());
      setVoiceMsg("Mikrofonåtkomst beviljad. Tryck på 🎤 igen för taligenkänning.");
    } catch (err: any) {
      const code = String(err?.name || err?.code || "").toLowerCase();
      voiceDebug("requestMicAccessOnly:gum:error", {
        code,
        rawName: err?.name,
        rawMessage: err?.message,
      });
      if (code.includes("notallowed") || code.includes("permissiondenied")) {
        setVoiceMsg(
          `Mikrofonåtkomst nekades för ${window.location.origin}. Tillåt mikrofon för just denna adress och försök igen.`
        );
        return;
      }
      if (code.includes("notfound") || code.includes("devicesnotfounderror")) {
        setVoiceMsg("Ingen mikrofon hittades. Kontrollera ljudenhet i systemet.");
        return;
      }
      setVoiceMsg("Kunde inte begära mikrofonåtkomst.");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOpenWidget = () => {
      if (!enabled) return;
      if (!apiKey) {
        window.dispatchEvent(new Event("stark:ai-agent:request-activation"));
        return;
      }
      setOpen(true);
    };
    window.addEventListener("stark:ai-agent:open", onOpenWidget as EventListener);
    return () => {
      window.removeEventListener("stark:ai-agent:open", onOpenWidget as EventListener);
    };
  }, [enabled, apiKey]);

  if (!enabled) return null;

  void provider;
  void model;
  void onProviderChange;
  void onModelChange;

  return (
    <div className="fixed bottom-4 left-4 z-[1200]">
      {open ? (
        <div className="w-[360px] rounded-xl border border-slate-300 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">AI-assistent</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUndoPanelOpen((v) => !v)}
                disabled={busy || promptCheckpoints.length === 0}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Ångra
              </button>
              <button
                type="button"
                onClick={resetAssistantMemory}
                disabled={busy}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="Rensa assistentens minne"
              >
                Nollställ
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Dölj
              </button>
            </div>
          </div>
          {undoPanelOpen && promptCheckpoints.length + redoCheckpoints.length > 0 ? (
            <div className="border-b border-slate-200 px-3 py-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Prompt-historik (3 steg)
                </p>
                <button
                  type="button"
                  onClick={() => setUndoPanelOpen(false)}
                  className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Stäng
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto pr-1">
                {(() => {
                  const chrono = buildChronologicalCheckpoints(promptCheckpoints, redoCheckpoints);
                  const lastThree = chrono.slice(-MAX_PROMPT_HISTORY_STEPS);
                  const promptIds = new Set(promptCheckpoints.map((c) => c.id));
                  const activeBoundary = (() => {
                    let count = 0;
                    for (const cp of lastThree) {
                      if (!promptIds.has(cp.id)) break;
                      count += 1;
                    }
                    return count; // 0..lastThree.length
                  })();

                  return (
                    <div className="space-y-1">
                      {Array.from({ length: lastThree.length + 1 }).map((_, boundaryIdx) => {
                        const prevCp = boundaryIdx > 0 ? lastThree[boundaryIdx - 1] : null;
                        const isActiveBoundary = boundaryIdx === activeBoundary;
                        return (
                          <div key={`boundary-${boundaryIdx}`} className="space-y-1">
                            <div className="pl-4">
                              <span className="mr-1 inline-block text-[10px] font-medium text-slate-500">
                                Gå tillbaka hit
                              </span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  void jumpToPromptBoundary(lastThree, boundaryIdx);
                                }}
                                className={`inline-flex h-5 w-7 items-center justify-center rounded border text-[10px] font-semibold transition ${
                                  isActiveBoundary
                                    ? "border-sky-500 bg-sky-100 text-sky-800"
                                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                } disabled:opacity-50`}
                                title={
                                  boundaryIdx === 0
                                    ? "Hoppa till före första prompten"
                                    : `Hoppa till efter: ${prevCp?.prompt || ""}`
                                }
                              >
                                →
                              </button>
                            </div>

                            {boundaryIdx < lastThree.length ? (
                              <div
                                className={`ml-7 rounded border px-2 py-1.5 ${
                                  boundaryIdx < activeBoundary
                                    ? "border-slate-200 bg-slate-50"
                                    : "border-slate-200 bg-slate-50/40 opacity-50"
                                }`}
                                title={lastThree[boundaryIdx].prompt}
                              >
                                <div className="truncate text-[11px] text-slate-700">
                                  {lastThree[boundaryIdx].prompt}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}
          <div
            ref={messagesScrollRef}
            className="max-h-[260px] space-y-2 overflow-y-auto overflow-x-hidden p-3"
          >
            <AgentRunStatus
              phase={pendingAction ? "waiting_confirm" : agentUi.phase}
              goalSummary={agentUi.goalSummary}
              stepIndex={agentUi.stepIndex}
              stepTotal={agentUi.stepTotal}
              currentLabel={agentUi.currentLabel}
              planSource={agentUi.planSource}
              replanReason={agentUi.replanReason}
              taskSummary={agentUi.taskSummary}
              busy={
                busy ||
                !!pendingAction ||
                agentUi.phase === "executing" ||
                agentUi.phase === "planning"
              }
            />
            {messages.length === 0 ? (
              <p className="text-xs text-slate-500">
                Exempel: Lägg in placering Psykiatri från 2026-01-10 till 2026-04-20
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg px-2 py-1.5 text-xs ${
                    m.role === "user"
                      ? "bg-sky-50 text-sky-900"
                      : m.role === "assistant"
                      ? "bg-slate-100 text-slate-800"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {m.text}
                </div>
              ))
            )}
            {pendingAction ? (
              <ConfirmActionCard
                action={pendingAction}
                busy={busy}
                onCancel={() => {
                  setPendingAction(null);
                  setQueuedActions([]);
                  setAgentUi((u) => ({ ...u, phase: "idle", currentLabel: "" }));
                }}
                onConfirm={() => void confirmPendingAction()}
              />
            ) : null}
          </div>

          <div className="border-t border-slate-200 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onSend();
                  }
                }}
                className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                placeholder="Skriv kommando eller fråga..."
              />
              <button
                type="button"
                onClick={() => void startVoiceInput()}
                disabled={busy || listening}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="Tala in instruktion"
              >
                {listening ? "Lyssnar" : "🎤"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSend()}
                className="rounded-md border border-violet-700 bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {busy ? "..." : "Skicka"}
              </button>
            </div>
            {voiceMsg ? (
              <div className="mt-2 space-y-1">
                <p className="text-[11px] text-slate-500">{voiceMsg}</p>
                {voiceMsg.includes("Mikrofonåtkomst nekades") ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void requestMicAccessOnly()}
                      className="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-50"
                    >
                      Begär mikrofon igen
                    </button>
                    <a
                      href="https://support.google.com/chrome/answer/2693767"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-[11px] text-violet-700 underline"
                    >
                      Så tillåter du mikrofon i webbläsaren
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!apiKey) {
              window.dispatchEvent(
                new Event("stark:ai-agent:request-activation")
              );
              return;
            }
            setOpen(true);
          }}
          className="rounded-full border border-violet-700 bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-violet-800"
        >
          AI-assistent
        </button>
      )}
    </div>
  );
}

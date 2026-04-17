"use client";

import React from "react";

export type AgentRunPhase = "idle" | "planning" | "executing" | "waiting_confirm" | "blocked";

export default function AgentRunStatus(props: {
  phase: AgentRunPhase;
  goalSummary?: string;
  stepIndex: number;
  stepTotal: number;
  currentLabel?: string;
  planSource?: string;
  replanReason?: string;
  taskSummary?: string;
  busy: boolean;
}) {
  const { phase, goalSummary, stepIndex, stepTotal, currentLabel, planSource, replanReason, taskSummary, busy } = props;
  if (!busy && phase === "idle") return null;

  const phaseSv =
    phase === "planning"
      ? "Planerar"
      : phase === "executing"
        ? "Utför"
        : phase === "waiting_confirm"
          ? "Väntar på bekräftelse"
          : phase === "blocked"
            ? "Stoppad"
            : "Arbetar";

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5 text-[11px] text-violet-950">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-semibold">{phaseSv}</span>
        {stepTotal > 0 ? (
          <span className="text-violet-800">
            Steg {Math.min(stepIndex + 1, stepTotal)}/{stepTotal}
          </span>
        ) : null}
      </div>
      {goalSummary ? <p className="mt-0.5 text-violet-900/90 line-clamp-2">{goalSummary}</p> : null}
      {taskSummary ? <p className="mt-0.5 text-violet-900/80">{taskSummary}</p> : null}
      {planSource ? <p className="mt-0.5 text-violet-900/80">Plan: {planSource}</p> : null}
      {replanReason ? <p className="mt-0.5 text-violet-900/80 line-clamp-1">Omplanering: {replanReason}</p> : null}
      {currentLabel ? <p className="mt-0.5 font-medium text-violet-800 truncate">{currentLabel}</p> : null}
    </div>
  );
}

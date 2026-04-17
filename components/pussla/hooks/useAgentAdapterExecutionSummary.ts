"use client";

import { useCallback, type MutableRefObject } from "react";
import type { AgentActionResult, PusslaAgentAction } from "@/lib/ai/types";
import { createPusslaAgentActionAdapter } from "@/lib/pussla/agentActionAdapter";
import { executeAgentActionWithTracking } from "@/lib/pussla/agentExecution";
import { buildAgentContextSummaryText } from "@/lib/pussla/agentContextSummary";

export function useAgentAdapterExecutionSummary(params: {
  adapterDeps: any;
  captureAgentUiSnapshot: () => any;
  agentUndoStackRef: MutableRefObject<any[]>;
  lastAgentEffectRef: MutableRefObject<any>;
  summaryDeps: any;
}) {
  const agentActionAdapter = createPusslaAgentActionAdapter(params.adapterDeps);

  const executeAgentAction = useCallback(
    async (action: PusslaAgentAction): Promise<AgentActionResult> => {
      return executeAgentActionWithTracking({
        adapter: agentActionAdapter,
        action,
        captureSnapshot: params.captureAgentUiSnapshot,
        undoStackRef: params.agentUndoStackRef as any,
        lastEffectRef: params.lastAgentEffectRef as any,
        maxUndoDepth: 20,
      });
    },
    [agentActionAdapter, params.captureAgentUiSnapshot, params.agentUndoStackRef, params.lastAgentEffectRef]
  );

  const getAgentContextSummary = useCallback((): string => {
    return buildAgentContextSummaryText(params.summaryDeps);
  }, [params.summaryDeps]);

  return { executeAgentAction, getAgentContextSummary };
}

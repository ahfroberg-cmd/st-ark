"use client";

import { useCallback, useRef, type MutableRefObject } from "react";
import type { PusslaAgentAction } from "@/lib/ai/types";
import type { AgentCollectionDeletePersistInput } from "@/lib/pussla/agentCommandZone";
import {
  applyOperatorToCollectionForAgentZone,
  listInternalGapsForAgentZone,
  listTimelineEntitiesForAgentZone,
  previewActionDiffForAgentZone,
  selectCollectionForAgentZone,
  verifyLastActionEffectForAgentZone,
} from "@/lib/pussla/agentCommandZone";

export function useAgentCollectionActions(params: {
  activities: any[];
  courses: any[];
  getPlacementStartISOForAgent: any;
  getPlacementEndISOForAgent: any;
  setActivities: (rows: any[]) => void;
  setCourses: (rows: any[]) => void;
  setDirty: (value: boolean) => void;
  lastAgentEffectRef: MutableRefObject<any>;
  authUserId?: string;
  getSessionUser?: () => Promise<any>;
  supabase?: any;
  refreshLists?: () => Promise<void>;
  logAudit?: (action: any, table: string, message: string, resourceId?: string) => void | Promise<void>;
}) {
  const selectedAgentCollectionRef = useRef<{
    target: "placements" | "courses";
    ids: string[];
    atISO: string;
  } | null>(null);

  const listTimelineEntitiesForAgent = useCallback(
    (options?: { target?: "placements" | "courses"; limit?: number }): { ok: boolean; message: string } => {
      return listTimelineEntitiesForAgentZone({
        target: options?.target,
        limit: options?.limit,
        activities: params.activities as any[],
        courses: params.courses as any[],
        getPlacementStartISOForAgent: params.getPlacementStartISOForAgent as any,
        getPlacementEndISOForAgent: params.getPlacementEndISOForAgent as any,
      });
    },
    [params]
  );

  const listInternalGapsForAgent = useCallback((): { ok: boolean; message: string } => {
    return listInternalGapsForAgentZone({
      activities: params.activities as any[],
      getPlacementStartISOForAgent: params.getPlacementStartISOForAgent as any,
      getPlacementEndISOForAgent: params.getPlacementEndISOForAgent as any,
    });
  }, [params]);

  const verifyLastActionEffectForAgent = useCallback((): { ok: boolean; message: string } => {
    return verifyLastActionEffectForAgentZone(params.lastAgentEffectRef.current as any);
  }, [params.lastAgentEffectRef]);

  const previewActionDiffForAgent = useCallback(
    (action: PusslaAgentAction): { ok: boolean; message: string } => {
      return previewActionDiffForAgentZone({
        action: action as any,
        selectedCollection: selectedAgentCollectionRef.current as any,
        activitiesCount: params.activities.length,
        coursesCount: params.courses.length,
      });
    },
    [params.activities.length, params.courses.length]
  );

  const selectCollectionForAgent = useCallback(
    (options: {
      target: "placements" | "courses";
      everyN?: number;
      afterQuery?: string;
      matchQuery?: string;
      beforeDate?: string;
      afterDate?: string;
      year?: number;
      month?: number;
      limit?: number;
    }): { ok: boolean; message: string } => {
      return selectCollectionForAgentZone({
        options,
        activities: params.activities as any[],
        courses: params.courses as any[],
        getPlacementStartISOForAgent: params.getPlacementStartISOForAgent as any,
        setSelectedCollectionRef: (value) => {
          selectedAgentCollectionRef.current = value;
        },
      });
    },
    [params]
  );

  const applyOperatorToCollectionForAgent = useCallback(
    async (options: {
      operator: "delete" | "shift_placement_month" | "set_course_kind_utbildningsmoment";
      months?: number;
    }): Promise<{ ok: boolean; message: string }> => {
      const persistCollectionDeletes =
        options.operator === "delete" && params.supabase && params.refreshLists
          ? async (input: AgentCollectionDeletePersistInput) => {
              let userId = params.authUserId;
              if (!userId && params.getSessionUser) {
                const u = await params.getSessionUser();
                userId = u?.id;
              }
              if (!userId) {
                const hasLinked =
                  input.target === "courses"
                    ? input.removed.some((c: any) => c.linkedCourseId)
                    : input.removed.some((p: any) => p.linkedPlacementId);
                if (hasLinked) throw new Error("not authenticated");
                await params.refreshLists!();
                return;
              }
              if (input.target === "courses") {
                for (const c of input.removed) {
                  if (c.linkedCourseId) {
                    await params.supabase!.from("courses").delete().eq("id", c.linkedCourseId).eq("user_id", userId);
                  }
                }
                void params.logAudit?.(
                  "delete",
                  "courses",
                  `Raderade ${input.removed.length} kurser via agent (urval)`,
                  undefined
                );
              } else {
                for (const p of input.removed) {
                  if (p.linkedPlacementId) {
                    await params.supabase!.from("placements").delete().eq("id", p.linkedPlacementId).eq("user_id", userId);
                  }
                }
                void params.logAudit?.(
                  "delete",
                  "placements",
                  `Raderade ${input.removed.length} placeringar via agent (urval)`,
                  undefined
                );
              }
              await params.refreshLists!();
            }
          : undefined;

      return applyOperatorToCollectionForAgentZone({
        options,
        selectedCollection: selectedAgentCollectionRef.current as any,
        activities: params.activities as any[],
        courses: params.courses as any[],
        getPlacementStartISOForAgent: params.getPlacementStartISOForAgent as any,
        getPlacementEndISOForAgent: params.getPlacementEndISOForAgent as any,
        setActivities: (next) => params.setActivities(next as any[]),
        setCourses: (next) => params.setCourses(next as any[]),
        setDirty: params.setDirty,
        persistCollectionDeletes,
      });
    },
    [params]
  );

  return {
    selectedAgentCollectionRef,
    listTimelineEntitiesForAgent,
    listInternalGapsForAgent,
    verifyLastActionEffectForAgent,
    previewActionDiffForAgent,
    selectCollectionForAgent,
    applyOperatorToCollectionForAgent,
  };
}

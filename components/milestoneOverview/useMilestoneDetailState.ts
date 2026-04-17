"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Args = {
  planByMilestone: Record<string, string>;
  setPlanByMilestone: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPlanDatesByMilestone: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  getConfiguredSuggestionsForMilestone: (milestoneId: string) => string[];
  mergePlanTextWithSuggestions: (planText: string, suggestions: string[]) => string;
  onDirtyChange?: (dirty: boolean) => void;
};

export function useMilestoneDetailState({
  planByMilestone,
  setPlanByMilestone,
  setPlanDatesByMilestone,
  getConfiguredSuggestionsForMilestone,
  mergePlanTextWithSuggestions,
  onDirtyChange,
}: Args) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailPlanText, setDetailPlanText] = useState<string>("");
  const [detailDirty, setDetailDirty] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [detailSelectedSuggestions, setDetailSelectedSuggestions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (onDirtyChange && detailDirty) onDirtyChange(true);
  }, [detailDirty, onDirtyChange]);

  useEffect(() => {
    if (!detailId || /^BT\d+$/i.test(String(detailId))) return;
    if (detailDirty) return;
    const raw = planByMilestone[detailId] ?? "";
    const configured = getConfiguredSuggestionsForMilestone(detailId);
    const merged = mergePlanTextWithSuggestions(raw, configured);
    setDetailPlanText(merged);
  }, [detailDirty, detailId, getConfiguredSuggestionsForMilestone, mergePlanTextWithSuggestions, planByMilestone]);

  const openDetail = useCallback(
    (id: string) => {
      if (detailDirty && detailId) {
        const ok = window.confirm("Du har osparade ändringar. Vill du öppna ett annat delmål utan att spara?");
        if (!ok) return;
        const currentInitial = mergePlanTextWithSuggestions(
          planByMilestone[detailId] ?? "",
          getConfiguredSuggestionsForMilestone(detailId)
        );
        setDetailPlanText(currentInitial);
        setDetailDirty(false);
      }

      setDetailId(id);
      setDetailPlanText(planByMilestone[id] ?? "");
      setDetailDirty(false);
      setDetailSaving(false);
      setDetailSelectedSuggestions({});
    },
    [
      detailDirty,
      detailId,
      getConfiguredSuggestionsForMilestone,
      mergePlanTextWithSuggestions,
      planByMilestone,
    ]
  );

  const savePlanForMilestone = useCallback(
    async (mid: string, text: string) => {
      try {
        setDetailSaving(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from("milestone_plans")
            .upsert(
              {
                id: `${user.id}::${mid}`,
                user_id: user.id,
                milestone_id: mid,
                plan_text: text,
                updated_at: now,
              },
              { onConflict: "user_id,milestone_id" }
            );
          if (error) {
            console.error("Kunde inte spara delmålsplan:", error);
          }
          setPlanByMilestone((prev) => ({ ...prev, [mid]: text }));
          setPlanDatesByMilestone((prev) => ({ ...prev, [mid]: now }));
        }
        setDetailDirty(false);
      } finally {
        setDetailSaving(false);
      }
    },
    [setPlanByMilestone, setPlanDatesByMilestone]
  );

  const handleSaveDetail = useCallback(
    async (mid: string) => {
      await savePlanForMilestone(mid, detailPlanText);
    },
    [detailPlanText, savePlanForMilestone]
  );

  const handleRequestCloseDetail = useCallback(() => {
    if (detailDirty) {
      setShowCloseConfirm(true);
      return;
    }
    setDetailId(null);
  }, [detailDirty]);

  const handleConfirmCloseDetail = useCallback(() => {
    if (detailId) {
      const initial = mergePlanTextWithSuggestions(
        planByMilestone[detailId] ?? "",
        getConfiguredSuggestionsForMilestone(detailId)
      );
      setDetailPlanText(initial);
      setDetailDirty(false);
    }
    setShowCloseConfirm(false);
    setDetailId(null);
  }, [detailId, getConfiguredSuggestionsForMilestone, mergePlanTextWithSuggestions, planByMilestone]);

  const handleSaveAndCloseDetail = useCallback(async () => {
    if (detailId) await savePlanForMilestone(detailId, detailPlanText);
    setShowCloseConfirm(false);
    setDetailId(null);
  }, [detailId, detailPlanText, savePlanForMilestone]);

  const handleCancelCloseDetail = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  const toggleSuggestion = useCallback((s: string) => {
    setDetailSelectedSuggestions((prev) => ({
      ...prev,
      [s]: !prev[s],
    }));
  }, []);

  const addSelectedSuggestions = useCallback(
    (suggestionItems: string[], initialTextForMid: string) => {
      const selected = suggestionItems.filter((s) => detailSelectedSuggestions[s]);
      if (!selected.length) return;
      const trimmed = detailPlanText.replace(/\s+$/g, "");
      const prefix = trimmed.length > 0 ? `${trimmed}\n` : "";
      const next = prefix + selected.join("\n");
      setDetailPlanText(next);
      setDetailDirty(next !== initialTextForMid);
      setDetailSelectedSuggestions({});
    },
    [detailPlanText, detailSelectedSuggestions]
  );

  return {
    detailId,
    setDetailId,
    detailPlanText,
    setDetailPlanText,
    detailDirty,
    setDetailDirty,
    detailSaving,
    showCloseConfirm,
    detailSelectedSuggestions,
    setDetailSelectedSuggestions,
    openDetail,
    handleRequestCloseDetail,
    handleConfirmCloseDetail,
    handleSaveAndCloseDetail,
    handleCancelCloseDetail,
    handleSaveDetail,
    toggleSuggestion,
    addSelectedSuggestions,
  };
}

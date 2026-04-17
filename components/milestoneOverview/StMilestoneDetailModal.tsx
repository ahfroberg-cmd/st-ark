"use client";

import React, { useEffect, useRef, useState } from "react";
import type { GoalsCatalog, GoalsMilestone } from "@/lib/goals";
import { COMMON_AB_MILESTONES, mergeWithCommon } from "@/lib/goals-common";
import { displayMilestoneCode } from "@/lib/milestoneDisplay";

type Props = {
  detailId: string;
  is2021: boolean;
  goals: GoalsCatalog;
  goalsVersion?: unknown;
  planByMilestone: Record<string, string>;
  srGoalSuggestionsByMilestone: Record<string, string[]>;
  srGoalSuggestionPool: string[];
  defaultSuggestions: string[];
  detailPlanText: string;
  detailDirty: boolean;
  detailSaving: boolean;
  detailSelectedSuggestions: Record<string, boolean>;
  setDetailPlanText: (value: string) => void;
  setDetailDirty: (value: boolean) => void;
  handleRequestCloseDetail: () => void;
  handleSaveDetail: (mid: string) => Promise<void>;
  toggleSuggestion: (suggestion: string) => void;
  addSelectedSuggestions: (suggestionItems: string[], initialTextForMid: string) => void;
  mergePlanTextWithSuggestions: (planText: string, suggestions: string[]) => string;
  overlayRef: React.RefObject<HTMLDivElement | null>;
};

export function StMilestoneDetailModal({
  detailId,
  is2021,
  goals,
  goalsVersion,
  planByMilestone,
  srGoalSuggestionsByMilestone,
  srGoalSuggestionPool,
  defaultSuggestions,
  detailPlanText,
  detailDirty,
  detailSaving,
  detailSelectedSuggestions,
  setDetailPlanText,
  setDetailDirty,
  handleRequestCloseDetail,
  handleSaveDetail,
  toggleSuggestion,
  addSelectedSuggestions,
  mergePlanTextWithSuggestions,
  overlayRef,
}: Props) {
  const detailPlanTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const [suggestionsMaxHeight, setSuggestionsMaxHeight] = useState<number | undefined>(undefined);

  const mid = String(detailId);
  const midNorm = mid.toUpperCase().replace(/\s+/g, "");
  const isAb2015 = !is2021 && /^[AB]\d+$/i.test(midNorm);

  let base: GoalsMilestone | null = null;

  if (isAb2015) {
    const commonByKey =
      (COMMON_AB_MILESTONES as any)[midNorm] ?? (COMMON_AB_MILESTONES as any)[midNorm.toLowerCase()];
    if (commonByKey) {
      base = commonByKey as GoalsMilestone;
    } else {
      const commonByCode = Object.values(COMMON_AB_MILESTONES as any).find((cm: any) => {
        const codeRaw = String(cm?.code ?? cm?.id ?? "");
        const codeKey = codeRaw.toUpperCase().replace(/\s+/g, "");
        return codeKey === midNorm;
      }) as GoalsMilestone | undefined;
      if (commonByCode) {
        base = commonByCode;
      }
    }
  } else {
    base =
      (goals.milestones.find((m) => m.id === mid || m.code === mid) as GoalsMilestone | undefined) ?? null;

    if (!base) {
      const commonByKey =
        (COMMON_AB_MILESTONES as any)[midNorm] ?? (COMMON_AB_MILESTONES as any)[midNorm.toLowerCase()];
      if (commonByKey) {
        base = commonByKey as GoalsMilestone;
      } else {
        const commonByCode = Object.values(COMMON_AB_MILESTONES as any).find((cm: any) => {
          const codeRaw = String(cm?.code ?? cm?.id ?? "");
          const codeKey = codeRaw.toUpperCase().replace(/\s+/g, "");
          return codeKey === midNorm;
        }) as GoalsMilestone | undefined;
        if (commonByCode) {
          base = commonByCode;
        }
      }
    }
  }

  const milestone = mergeWithCommon(base);

  const milestoneCodeKey = String((milestone as any)?.code || (milestone as any)?.id || detailId || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  const milestoneIdKey = String((milestone as any)?.id || detailId || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  const configuredSuggestions =
    srGoalSuggestionsByMilestone[milestoneCodeKey] || srGoalSuggestionsByMilestone[milestoneIdKey] || [];
  const suggestionItems: string[] =
    configuredSuggestions.length > 0
      ? configuredSuggestions
      : srGoalSuggestionPool.length > 0
        ? srGoalSuggestionPool
        : defaultSuggestions;

  const initialTextForMid = mergePlanTextWithSuggestions(planByMilestone[mid] ?? "", configuredSuggestions);

  useEffect(() => {
    if (!detailId || /^BT\d+$/i.test(String(detailId))) {
      setSuggestionsMaxHeight(undefined);
      return;
    }
    if (!leftColRef.current || !rightColRef.current) return;

    const updateHeight = () => {
      const leftHeight = leftColRef.current?.offsetHeight || 0;
      const textarea = rightColRef.current?.querySelector("textarea");
      const button = rightColRef.current?.querySelector("button");
      const textareaHeight = textarea?.offsetHeight || 120;
      const labelHeight = 20;
      const gap = 12;
      const buttonHeight = (button?.offsetHeight || 0) + 8;
      const availableHeight = leftHeight - textareaHeight - labelHeight * 2 - gap - buttonHeight;
      setSuggestionsMaxHeight(Math.max(100, availableHeight));
    };

    const timeoutId = setTimeout(updateHeight, 0);
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    if (leftColRef.current) resizeObserver.observe(leftColRef.current);
    if (rightColRef.current) resizeObserver.observe(rightColRef.current);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [detailId, detailPlanText]);

  useEffect(() => {
    const textarea = detailPlanTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
  }, [detailId, detailPlanText]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleRequestCloseDetail();
        }
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 gap-4">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 shrink-0">
              {displayMilestoneCode(String((milestone as any)?.code ?? detailId), goalsVersion)}
            </span>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
              {String((milestone as any)?.title ?? "Delmål")}
            </h3>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-5 py-5">
          {milestone ? (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)] md:items-start">
              <div className="space-y-4" ref={leftColRef}>
                {typeof (milestone as any).description === "string" &&
                (milestone as any).description.trim().length > 0 ? (
                  <p className="text-[14px] leading-relaxed text-slate-900">{(milestone as any).description}</p>
                ) : null}

                {Array.isArray((milestone as any).sections) && (milestone as any).sections.length > 0 ? (
                  <div className="space-y-4">
                    {(milestone as any).sections.map(
                      (sec: { title?: string; items?: any[]; text?: string }, idx: number) => (
                        <section key={idx}>
                          {sec.title ? (
                            <div className="mb-1 text-[13px] font-semibold text-slate-900">{sec.title}</div>
                          ) : null}
                          {Array.isArray(sec.items) ? (
                            <ul className="list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-slate-900">
                              {sec.items.map((it, i) => (
                                <li key={i} className="text-slate-900">
                                  {typeof it === "string" ? it : String(it)}
                                </li>
                              ))}
                            </ul>
                          ) : sec.text ? (
                            <p className="text-[14px] leading-relaxed text-slate-900">{sec.text}</p>
                          ) : null}
                        </section>
                      )
                    )}
                  </div>
                ) : !((milestone as any).description) ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                    Ingen beskrivning hittades i målfilen.
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col space-y-3" ref={rightColRef}>
                <div>
                  <div className="mb-1 text-[13px] font-semibold text-slate-900">
                    Planerade metoder och bedömningsinstrument
                  </div>
                  <textarea
                    ref={detailPlanTextareaRef}
                    value={detailPlanText}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDetailPlanText(value);
                      setDetailDirty(value !== initialTextForMid);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-[13px] leading-relaxed text-slate-900 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    style={{ minHeight: 120, resize: "none", overflow: "hidden" }}
                  />
                </div>

                <div className="flex flex-col">
                  <div className="mb-1 text-[13px] font-semibold text-slate-900">Förslag</div>
                  <div
                    className="overflow-y-auto overscroll-contain touch-pan-y rounded-lg border border-slate-200 bg-slate-50 p-2"
                    style={{ maxHeight: suggestionsMaxHeight }}
                  >
                    <ul className="space-y-1.5 text-[13px] text-slate-900">
                      {suggestionItems.map((s) => (
                        <li key={s} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                            checked={!!detailSelectedSuggestions[s]}
                            onChange={() => toggleSuggestion(s)}
                          />
                          <span className="leading-snug text-slate-900">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-2 flex justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => addSelectedSuggestions(suggestionItems, initialTextForMid)}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                    >
                      Lägg till markerade
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
              Information saknas för det valda delmålet.
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={async () => {
              await handleSaveDetail(mid);
            }}
            disabled={!detailDirty || detailSaving}
            className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {detailSaving ? "Sparar..." : "Spara"}
          </button>
          <button
            type="button"
            onClick={handleRequestCloseDetail}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
          >
            Stäng
          </button>
        </footer>
      </div>
    </div>
  );
}

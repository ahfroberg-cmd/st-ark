"use client";

import { Fragment } from "react";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";

export default function OverallTimelineOverviewTab({
  overallTimelineLinear,
  overallTimelineShowAllActivities,
  setOverallTimelineShowAllActivities,
  overallTimelineMonthGridRef,
  overallTimelineHoveredBarId,
  setOverallTimelineHoveredBarId,
  overallTimelineHoverCollapseTimerRef,
}: {
  overallTimelineLinear: any;
  overallTimelineShowAllActivities: boolean;
  setOverallTimelineShowAllActivities: (value: boolean) => void;
  overallTimelineMonthGridRef: RefObject<HTMLDivElement | null>;
  overallTimelineHoveredBarId: string | null;
  setOverallTimelineHoveredBarId: Dispatch<SetStateAction<string | null>>;
  overallTimelineHoverCollapseTimerRef: MutableRefObject<number | null>;
}) {
  if (!overallTimelineLinear.ok) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
        {overallTimelineLinear.reason}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={overallTimelineShowAllActivities}
          onChange={(e) => setOverallTimelineShowAllActivities(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        />
        <span>Visa alla utbildningsaktiviteter</span>
      </label>
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div
          ref={overallTimelineMonthGridRef}
          className="touch-pan-x overflow-x-auto overscroll-x-contain pb-4"
          style={{ overscrollBehaviorX: "contain" }}
        >
          <div className="min-w-max pb-1">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `max-content ${overallTimelineLinear.monthKeys.length * overallTimelineLinear.cellW}px`,
              }}
            >
              <div className="sticky left-0 z-[60] bg-white px-3 text-sm font-semibold text-slate-700 h-[56px] flex items-center whitespace-nowrap relative overflow-hidden">
                <span className="relative z-10">ST-läkare</span>
                <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-white" aria-hidden="true" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-0 border-l-2 border-slate-300" aria-hidden="true" />
                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 border-b border-slate-200"
                  aria-hidden="true"
                />
              </div>
              <div className="border-b border-slate-200 bg-white">
                <div className="relative">
                  <div
                    className="grid text-[11px] text-slate-700"
                    style={{
                      gridTemplateColumns: `repeat(${overallTimelineLinear.monthKeys.length}, ${overallTimelineLinear.cellW}px)`,
                    }}
                  >
                    {(() => {
                      const keys = overallTimelineLinear.monthKeys as number[];
                      const segs: Array<{ year: number; start: number; len: number }> = [];
                      for (let i = 0; i < keys.length; ) {
                        const y = Math.floor(keys[i] / 12);
                        let j = i;
                        while (j < keys.length && Math.floor(keys[j] / 12) === y) j++;
                        segs.push({ year: y, start: i, len: j - i });
                        i = j;
                      }
                      return segs.map((s) => (
                        <div
                          key={`y-${s.year}-${s.start}`}
                          className="h-6 flex items-center justify-center font-semibold text-slate-700"
                          style={{ gridColumn: `${s.start + 1} / span ${s.len}` }}
                        >
                          {s.year}
                        </div>
                      ));
                    })()}
                  </div>
                  <div
                    className="grid text-[11px] text-slate-600"
                    style={{
                      gridTemplateColumns: `repeat(${overallTimelineLinear.monthKeys.length}, ${overallTimelineLinear.cellW}px)`,
                    }}
                  >
                    {overallTimelineLinear.monthKeys.map((k: number, idx: number) => {
                      const lab = (overallTimelineLinear.monthLabels as string[])[idx] || "";
                      const isYearStart = k % 12 === 0;
                      return (
                        <div
                          key={`m-${k}`}
                          className={`h-8 flex items-end justify-center pb-1 ${
                            idx === 0 ? "" : `border-l ${isYearStart ? "border-slate-400 border-l-2" : "border-slate-200"}`
                          }`}
                        >
                          {lab}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {overallTimelineLinear.rows
                .slice()
                .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || ""), "sv"))
                .map((r: any) => {
                  const bars = overallTimelineLinear.placementBarsByStudent.get(String(r.id)) || [];
                  const compactBars = overallTimelineLinear.activityBarsByStudent.get(String(r.id)) || [];
                  return (
                    <Fragment key={String(r.id)}>
                      <div className="sticky left-0 z-[60] bg-white px-3 text-sm text-slate-900 h-[32px] flex items-center whitespace-nowrap relative overflow-hidden shadow-[6px_0_8px_-8px_rgba(15,23,42,0.35)]">
                        <span className="relative z-10">{r.name}</span>
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-white" aria-hidden="true" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-0 border-l-2 border-slate-400" aria-hidden="true" />
                        <div
                          className="pointer-events-none absolute bottom-0 left-0 right-0 border-b border-slate-200"
                          aria-hidden="true"
                        />
                      </div>
                      <div
                        className="relative overflow-visible border-b border-slate-200 bg-white"
                        style={{ height: overallTimelineLinear.rowH }}
                      >
                        {typeof overallTimelineLinear.todayMarkerX === "number" && (
                          <div
                            className="pointer-events-none absolute inset-y-0 z-10"
                            style={{ left: overallTimelineLinear.todayMarkerX, width: 0 }}
                            aria-hidden="true"
                          >
                            <div
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 0,
                                borderLeft: "3px solid #2563eb",
                                transform: "translateX(-1px)",
                              }}
                              title={`Idag (${new Date().toISOString().slice(0, 10)})`}
                            />
                          </div>
                        )}
                        <div
                          className="absolute inset-0 grid z-0"
                          style={{
                            gridTemplateColumns: `repeat(${overallTimelineLinear.monthKeys.length}, ${overallTimelineLinear.cellW}px)`,
                          }}
                        >
                          {overallTimelineLinear.monthKeys.map((k: number, idx: number) => {
                            const isYearStart = k % 12 === 0;
                            return (
                              <div
                                key={`${r.id}-${k}`}
                                className={
                                  idx === 0 ? "" : `border-l ${isYearStart ? "border-slate-300 border-l-2" : "border-slate-100"}`
                                }
                              />
                            );
                          })}
                        </div>
                        {bars.map((b: any, idx: number) => (
                          <div
                            key={`${r.id}-bar-${idx}`}
                            className="absolute top-1/2 -translate-y-1/2 z-20 h-[18px] rounded-md border border-white/80 px-2 text-[11px] font-semibold text-white overflow-hidden whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(15,23,42,0.18)]"
                            style={{ left: b.left, width: b.width, backgroundColor: b.bg }}
                            title={b.title}
                          >
                            {b.label}
                          </div>
                        ))}
                      </div>
                      {overallTimelineShowAllActivities && (
                        <>
                          <div className="sticky left-0 z-[60] bg-white px-3 text-[11px] text-slate-500 h-[24px] flex items-center whitespace-nowrap relative overflow-hidden shadow-[6px_0_8px_-8px_rgba(15,23,42,0.35)]">
                            <span className="relative z-10">Aktiviteter</span>
                            <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-white" aria-hidden="true" />
                            <div className="pointer-events-none absolute inset-y-0 right-0 w-0 border-l-2 border-slate-300" aria-hidden="true" />
                            <div
                              className="pointer-events-none absolute bottom-0 left-0 right-0 border-b border-slate-200"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="relative overflow-visible border-b border-slate-200 bg-slate-50" style={{ height: 24 }}>
                            <div
                              className="absolute inset-0 grid z-0"
                              style={{
                                gridTemplateColumns: `repeat(${overallTimelineLinear.monthKeys.length}, ${overallTimelineLinear.cellW}px)`,
                              }}
                            >
                              {overallTimelineLinear.monthKeys.map((k: number, idx: number) => {
                                const isYearStart = k % 12 === 0;
                                return (
                                  <div
                                    key={`${r.id}-a-${k}`}
                                    className={
                                      idx === 0 ? "" : `border-l ${isYearStart ? "border-slate-300 border-l-2" : "border-slate-100"}`
                                    }
                                  />
                                );
                              })}
                            </div>
                            {compactBars.map((b: any, idx: number) => {
                              const barId = `${r.id}-act-${idx}`;
                              const isHovered = overallTimelineHoveredBarId === barId;
                              const shownLabel = isHovered ? b.hoverLabel || b.label : b.label;
                              return (
                                <div
                                  key={barId}
                                  onMouseEnter={() => {
                                    if (overallTimelineHoverCollapseTimerRef.current != null) {
                                      window.clearTimeout(overallTimelineHoverCollapseTimerRef.current);
                                      overallTimelineHoverCollapseTimerRef.current = null;
                                    }
                                    setOverallTimelineHoveredBarId(barId);
                                  }}
                                  onMouseLeave={() => {
                                    if (overallTimelineHoverCollapseTimerRef.current != null) {
                                      window.clearTimeout(overallTimelineHoverCollapseTimerRef.current);
                                    }
                                    overallTimelineHoverCollapseTimerRef.current = window.setTimeout(() => {
                                      setOverallTimelineHoveredBarId((prev) => (prev === barId ? null : prev));
                                      overallTimelineHoverCollapseTimerRef.current = null;
                                    }, 45);
                                  }}
                                  onWheel={() => {
                                    if (overallTimelineHoverCollapseTimerRef.current != null) {
                                      window.clearTimeout(overallTimelineHoverCollapseTimerRef.current);
                                      overallTimelineHoverCollapseTimerRef.current = null;
                                    }
                                    setOverallTimelineHoveredBarId(barId);
                                  }}
                                  className={`absolute top-1/2 -translate-y-1/2 h-[14px] rounded px-1 text-[10px] font-semibold text-white whitespace-nowrap origin-left will-change-[clip-path,transform] transition-[max-width,clip-path,transform,box-shadow,filter] ${
                                    isHovered
                                      ? "z-40 overflow-visible duration-120 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] scale-x-100 scale-y-[1.06] shadow-[0_5px_14px_rgba(15,23,42,0.24)]"
                                      : "z-20 overflow-hidden text-ellipsis duration-70 [transition-timing-function:cubic-bezier(0.4,0,1,1)] scale-x-[0.99] scale-y-100"
                                  }`}
                                  style={{
                                    left: b.left,
                                    width: "max-content",
                                    minWidth: b.width,
                                    maxWidth: isHovered ? "520px" : `${b.width}px`,
                                    backgroundColor: b.bg,
                                    clipPath: isHovered
                                      ? "inset(0 0 0 0 round 4px)"
                                      : `inset(0 calc(100% - ${Math.max(8, b.width)}px) 0 0 round 4px)`,
                                  }}
                                  title={b.title}
                                >
                                  {shownLabel}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </Fragment>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

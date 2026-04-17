"use client";

import { formatDate } from "@/lib/studierektor/dateUtils";
import { MONTH_NAMES } from "@/lib/studierektor/timelineConstants";

type ProgressionSlutdatumOverallTimeline = {
  minStart?: string | null;
  maxEnd?: string | null;
  markers: any[];
  years: number[];
  startYearForSlots?: number | null;
};

export default function ProgressionSlutdatumView({
  overallTimeline,
}: {
  overallTimeline: ProgressionSlutdatumOverallTimeline;
}) {
  if (!(overallTimeline.minStart && overallTimeline.maxEnd)) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
        Saknar start/slutdatum för att rita tidslinjen. Kontrollera att profilerna innehåller ST-startdatum och planerat slutdatum.
      </div>
    );
  }

  const markerLegendRows = overallTimeline.markers
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "sv"));

  return (
    <div className="space-y-4">
      <div className="space-y-0 rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-[80px_1fr] items-end sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-slate-200">
          <div className="pr-2" />
          <div className="relative">
            <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] text-xs text-slate-700">
              {MONTH_NAMES.map((m) => (
                <div key={m} className="col-span-2 text-center font-medium pb-1">
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>

        {overallTimeline.years.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600">Inget att visa.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {overallTimeline.years.map((year, yearIdx) => {
              const isFirst = yearIdx === 0;
              const isLast = yearIdx === overallTimeline.years.length - 1;
              const rowStartSlot = (year - (overallTimeline.startYearForSlots as number)) * 24;
              const rowEndSlot = rowStartSlot + 24;
              return (
                <div key={year} className="grid grid-cols-[80px_1fr] items-stretch bg-white">
                  <div className="pr-2 py-1 text-right font-semibold select-none flex items-center justify-end">
                    <span>{year}</span>
                  </div>
                  <div
                    className="st-row relative isolate bg-white"
                    style={{
                      height: "2.6rem",
                      backgroundImage: "none",
                      borderTopLeftRadius: isFirst ? "2px" : "0px",
                      borderTopRightRadius: isFirst ? "2px" : "0px",
                      borderBottomLeftRadius: isLast ? "2px" : "0px",
                      borderBottomRightRadius: isLast ? "2px" : "0px",
                      overflow: "visible",
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0 z-0 flex flex-col">
                      <div className="grid h-7 grid-cols-[repeat(24,minmax(0,1fr))]">
                        {Array.from({ length: 24 }, (_, i) => {
                          const monthIndex = Math.floor(i / 2);
                          const isFirstCol = i === 0;
                          const isLastCol = i === 23;
                          const isFirstHalfOfMonth = i % 2 === 0;
                          const insideCls = monthIndex % 2 ? "bg-slate-50" : "bg-white";
                          return (
                            <div
                              key={`sl-${year}-p-${i}`}
                              className={[
                                "relative z-0 h-7 border-t border-slate-300",
                                isFirstCol ? "border-l border-slate-300" : "",
                                isLastCol ? "border-r border-slate-300" : "",
                                !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
                                insideCls,
                              ].join(" ")}
                            />
                          );
                        })}
                      </div>
                      <div className="grid h-3 grid-cols-[repeat(24,minmax(0,1fr))]">
                        {Array.from({ length: 24 }, (_, i) => {
                          const monthIndex = Math.floor(i / 2);
                          const isFirstCol = i === 0;
                          const isLastCol = i === 23;
                          const isFirstHalfOfMonth = i % 2 === 0;
                          return (
                            <div
                              key={`sl-${year}-k-${i}`}
                              className={[
                                "relative h-3 w-full overflow-hidden border-y border-slate-300",
                                monthIndex % 2 ? "bg-slate-200" : "bg-slate-100",
                                isFirstCol ? "border-l border-slate-300" : "",
                                isLastCol ? "border-r border-slate-300" : "",
                                !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
                              ].join(" ")}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <div
                      className="pointer-events-none absolute inset-0 z-[60] grid grid-cols-[repeat(24,minmax(0,1fr))] rounded-[2px]"
                      style={{ gridTemplateRows: "minmax(0, 1fr)", overflow: "visible" }}
                    >
                      {overallTimeline.markers
                        .filter((m: any) => m.slot >= rowStartSlot && m.slot < rowEndSlot)
                        .map((m: any) => {
                          const col = m.slot - rowStartSlot;
                          return (
                            <div
                              key={`m-${year}-${m.id}`}
                              className="relative min-h-0 h-full"
                              style={{ gridColumnStart: col + 1, gridRowStart: 1 }}
                            >
                              <div
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-[3px] rounded"
                                style={{ backgroundColor: m.color }}
                                title={`${m.name} - ${formatDate(String(m.endISO || ""))}`}
                              />
                            </div>
                          );
                        })}
                    </div>
                    {(() => {
                      const today = new Date();
                      const yearToday = today.getFullYear();
                      if (yearToday !== year) return null;
                      const startOfYear = new Date(yearToday, 0, 1);
                      const startOfNextYear = new Date(yearToday + 1, 0, 1);
                      const msInDay = 24 * 60 * 60 * 1000;
                      const dayIndex = Math.floor((today.getTime() - startOfYear.getTime()) / msInDay);
                      const daysInYear = Math.max(
                        1,
                        Math.floor((startOfNextYear.getTime() - startOfYear.getTime()) / msInDay),
                      );
                      const frac = Math.min(Math.max(dayIndex / daysInYear, 0), 1);
                      const pct = frac * 100;
                      if (pct < 0 || pct > 100) return null;
                      const todayISO = new Date().toISOString().slice(0, 10);
                      return (
                        <div className="pointer-events-none absolute inset-0 z-[70]" aria-hidden="true">
                          <div
                            className="absolute"
                            style={{
                              top: 0,
                              height: "1.75rem",
                              left: `${pct}%`,
                              width: 0,
                              borderLeft: "3.5px solid #2563eb",
                              transform: "translateX(0)",
                            }}
                            title={`Idag (${todayISO})`}
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-4 w-[3px] rounded bg-slate-500" />
          Slutdatum
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-4 w-[3.5px] rounded bg-blue-600" />
          Idag
        </span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
          ST-lakare
        </div>
        <div className="divide-y divide-slate-100">
          {markerLegendRows.map((m) => (
            <div key={`legend-${m.id}`} className="flex items-center gap-2 px-3 py-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: m.color }} />
              <span className="text-sm text-slate-900">{m.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

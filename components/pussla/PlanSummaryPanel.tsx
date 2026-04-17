"use client";

import React from "react";
import CalendarDatePicker from "@/components/CalendarDatePicker";

type PlanSummaryPanelProps = {
  activities: any[];
  isZeroAttendanceType: (type: string) => boolean;
  profile: any;
  totalPlanMonths: number;
  setTotalPlanMonths: (next: number) => void;
  persistProfilePatch: (patch: Record<string, any>) => void | Promise<void>;
  restAttendance: number;
  setRestAttendance: (next: number) => void;
  stEndISO: string | null;
  progressPct: number;
  milestoneProgressPct: number;
  setProgressDetailOpen: (next: "time" | "milestones" | null) => void;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  addMonths: (date: Date, months: number) => Date;
  dateToISO: (date: Date) => string;
  onBtEndChange: (iso: string | null) => void | Promise<void>;
};

export default function PlanSummaryPanel(props: PlanSummaryPanelProps) {
  const {
    activities,
    isZeroAttendanceType,
    profile,
    totalPlanMonths,
    setTotalPlanMonths,
    persistProfilePatch,
    restAttendance,
    setRestAttendance,
    stEndISO,
    progressPct,
    milestoneProgressPct,
    setProgressDetailOpen,
    isValidISO,
    isoToDateSafe,
    addMonths,
    dateToISO,
    onBtEndChange,
  } = props;

  const workedFteMonths = activities
    .filter((a) => !isZeroAttendanceType(String(a?.type || "")))
    .reduce((acc, a) => acc + Number(a?.lengthSlots || 0) * 0.5 * ((a?.attendance ?? 100) / 100), 0);

  const profAny: any = profile || {};
  const gv = String(profAny?.goalsVersion || "").trim();
  const totalLabel = gv === "2021" ? "Total tid för BT + ST:" : "Total tid för ST:";

  const btStartISO: string | null = profAny?.btStartDate || null;
  const btEndManualISO: string | null = profAny?.btEndDate || null;
  let autoBtEndISO: string | null = null;
  if (!btEndManualISO && btStartISO && isValidISO(btStartISO)) {
    try {
      const btDate = isoToDateSafe(btStartISO);
      const btEndDate = addMonths(btDate, 24);
      autoBtEndISO = dateToISO(btEndDate);
    } catch {
      autoBtEndISO = null;
    }
  }
  const effectiveBtEndISO: string | null = btEndManualISO || autoBtEndISO;

  return (
    <div className="mt-2 rounded-xl border bg-white p-3 flex flex-col gap-2">
      <div className="text-sm">
        <div className="mt-1 grid w-full grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-3 md:grid-rows-2 md:items-center">
          <div className="md:col-start-1 md:row-start-1 flex items-center gap-2">
            <span className="font-medium whitespace-nowrap">Registrerad tid motsvarande heltid:</span>
            <span className="font-semibold">{workedFteMonths.toFixed(1)} mån</span>
          </div>

          <div className="md:col-start-1 md:row-start-2 flex items-center gap-2">
            <span className="font-medium whitespace-nowrap">{totalLabel}</span>
            <select
              value={String(Math.max(0, Math.floor(totalPlanMonths)))}
              onChange={(e) => {
                const v = Math.floor(Number((e.target as HTMLSelectElement).value) || 0);
                const next = Math.max(0, v);
                setTotalPlanMonths(next);
                void persistProfilePatch({ stTotalMonths: next });
              }}
              className="h-8 rounded-lg border px-2 text-sm w-[110px]"
              title="Planerad total tid i månader"
            >
              {Array.from({ length: 240 }, (_, i) => i + 1).map((m) => {
                const isSix = m % 6 === 0;
                const label = (() => {
                  if (!isSix) return `${m}`;
                  if (m % 12 === 0) return `${m} (${m / 12} år)`;
                  return `${m} (${Math.floor(m / 12)},5 år)`;
                })();
                return (
                  <option key={m} value={m}>
                    {label}
                  </option>
                );
              })}
            </select>
            <span>månader</span>
          </div>

          <div className="md:col-start-2 md:row-start-1 flex items-center gap-2">
            <span className="font-medium whitespace-nowrap">Slutdatum vid fortsatt tjänstgöring på</span>
            <select
              value={String(Math.max(5, Math.min(100, Math.round(restAttendance / 5) * 5)))}
              onChange={(e) => {
                const v = Number((e.target as HTMLSelectElement).value) || 100;
                const next = Math.max(5, Math.min(100, v));
                setRestAttendance(next);
                void persistProfilePatch({ stEndAttendance: next });
              }}
              className="h-8 rounded-lg border px-2 text-sm w-[90px]"
              title="Sysselsättningsgrad"
            >
              {Array.from({ length: 20 }, (_, i) => (i + 1) * 5).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span>%:</span>
            <span className="font-semibold">{stEndISO || "—"}</span>
          </div>

          <div className="md:col-start-2 md:row-start-2">
            {gv === "2021" && (
              <div className="flex items-center gap-2">
                <span className="font-medium whitespace-nowrap">Slutdatum för BT:</span>
                <div className="w-[140px]">
                  <CalendarDatePicker
                    value={effectiveBtEndISO || ""}
                    onChange={(iso) => {
                      void onBtEndChange(iso || null);
                    }}
                    weekStartsOn={1}
                    className="h-8 w-full"
                    align="right"
                    forceDirection="up"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="md:col-start-3 md:row-start-1 w-full">
            <div className="w-full">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0 focus:outline-none focus-visible:outline-none focus:ring-0"
                  data-info="Genomförd tid visar hur stor del av den planerade utbildningstiden som har genomförts."
                  onClick={() => setProgressDetailOpen("time")}
                >
                  Genomförd tid
                </button>
                <button
                  type="button"
                  className="font-semibold text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0 focus:outline-none focus-visible:outline-none focus:ring-0"
                  data-info="Genomförd tid visar hur stor del av den planerade utbildningstiden som har genomförts."
                  onClick={() => setProgressDetailOpen("time")}
                >
                  {progressPct.toFixed(0)} %
                </button>
              </div>
              <div
                className="mt-1 h-4 w-full rounded-full bg-slate-200 cursor-pointer"
                onClick={() => setProgressDetailOpen("time")}
              >
                {progressPct >= 1 && (
                  <div
                    className="h-4 rounded-full transition-[width] duration-300 bg-emerald-500/80"
                    style={{ width: `${progressPct}%` }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="md:col-start-3 md:row-start-2 w-full">
            <div className="w-full">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  className="text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0"
                  data-info="Delmålsuppfyllelse visar hur många procent av alla delmål som har uppfyllts."
                  onClick={() => setProgressDetailOpen("milestones")}
                >
                  Delmålsuppfyllelse
                </button>
                <button
                  type="button"
                  className="font-semibold text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0"
                  data-info="Delmålsuppfyllelse visar hur många procent av alla delmål som har uppfyllts."
                  onClick={() => setProgressDetailOpen("milestones")}
                >
                  {milestoneProgressPct.toFixed(0)} %
                </button>
              </div>
              <div
                className="mt-1 h-4 w-full rounded-full bg-slate-200 cursor-pointer"
                onClick={() => setProgressDetailOpen("milestones")}
              >
                {milestoneProgressPct >= 1 && (
                  <div
                    className="h-4 rounded-full transition-[width] duration-300 bg-emerald-500/80"
                    style={{ width: `${milestoneProgressPct}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

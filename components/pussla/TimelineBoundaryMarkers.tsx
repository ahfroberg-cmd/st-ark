"use client";

import React from "react";
import { computeYearPercent } from "@/lib/pussla/yearPosition";

type TimelineBoundaryMarkersProps = {
  profile: any;
  rowStartSlot: number;
  startYear: number;
  cols: number;
  snappedStartBoundarySlot: number;
  endBoundarySlot: number;
  year: number;
  startLineColor: string;
  midLineColor: string;
  endLineColor: string;
  todayLineColor: string;
  dateToSlot: (startYear: number, iso: string, mode: "start" | "end") => number;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  dateToISO: (date: Date) => string;
  addMonths: (date: Date, months: number) => Date;
};

export default function TimelineBoundaryMarkers(props: TimelineBoundaryMarkersProps) {
  const {
    profile,
    rowStartSlot,
    startYear,
    cols,
    snappedStartBoundarySlot,
    endBoundarySlot,
    year,
    startLineColor,
    midLineColor,
    endLineColor,
    todayLineColor,
    dateToSlot,
    isValidISO,
    isoToDateSafe,
    dateToISO,
    addMonths,
  } = props;

  return (
    <div className="pointer-events-none absolute inset-0 z-[250]">
      {(() => {
        const goals = String((profile as any)?.goalsVersion || "").trim();
        const is2021 = goals === "2021";

        if (is2021) {
          const btISO = (profile as any)?.btStartDate || null;
          const btSlotGlobal = btISO ? dateToSlot(startYear, btISO, "start") : null;
          const slot = btSlotGlobal ?? snappedStartBoundarySlot;
          const pct = ((slot - rowStartSlot) / cols) * 100;
          if (pct < 0 || pct > 100) return null;
          return (
            <div
              className="absolute"
              style={{
                top: 0,
                height: "1.75rem",
                left: `${pct}%`,
                width: 0,
                borderLeft: `3.5px solid ${startLineColor}`,
                transform: "translateX(-0.25px)",
              }}
              title={btSlotGlobal != null ? "BT start" : "ST start"}
            />
          );
        }

        const slot = snappedStartBoundarySlot;
        const pct = ((slot - rowStartSlot) / cols) * 100;
        if (pct < 0 || pct > 100) return null;
        return (
          <div
            className="absolute"
            style={{
              top: 0,
              height: "1.75rem",
              left: `${pct}%`,
              width: 0,
              borderLeft: `3.5px solid ${startLineColor}`,
              transform: "translateX(-0.25px)",
            }}
            title="ST start"
          />
        );
      })()}

      {(() => {
        const goals = String((profile as any)?.goalsVersion || "").trim();
        const is2021 = goals === "2021";
        if (!is2021) return null;

        const btISO = (profile as any)?.btStartDate || null;
        const btEndManual = (profile as any)?.btEndDate || null;
        const btSlotGlobal = btISO ? dateToSlot(startYear, btISO, "start") : null;

        let yellowSlot = snappedStartBoundarySlot;
        let yellowTitle = "ST start";

        if (btISO) {
          try {
            let btEndISO: string;
            if (btEndManual && isValidISO(btEndManual)) {
              btEndISO = btEndManual;
            } else {
              const btd = isoToDateSafe(btISO);
              btEndISO = dateToISO(addMonths(btd, 24));
            }
            yellowSlot = dateToSlot(startYear, btEndISO, "end");
            yellowTitle = "Sista datum för färdig BT";
          } catch {
            // keep fallback
          }
        }

        const samePos = btSlotGlobal != null && btSlotGlobal === yellowSlot;
        const pct = ((yellowSlot - rowStartSlot) / cols) * 100;
        if (pct < 0 || pct > 100 || samePos) return null;

        return (
          <div
            className="absolute"
            style={{
              top: 0,
              height: "1.75rem",
              left: `${pct}%`,
              width: 0,
              borderLeft: `3.5px solid ${midLineColor}`,
              transform: "translateX(-0.25px)",
            }}
            title={yellowTitle}
          />
        );
      })()}

      {(() => {
        const pct = ((endBoundarySlot - rowStartSlot) / cols) * 100;
        if (pct < 0 || pct > 100) return null;
        return (
          <div
            className="absolute"
            style={{
              top: 0,
              height: "1.75rem",
              left: `${pct}%`,
              width: 0,
              borderLeft: `3.5px solid ${endLineColor}`,
              transform: "translateX(-0.75px)",
            }}
            title="ST slut"
          />
        );
      })()}

      {(() => {
        const today = new Date();
        const yearToday = today.getFullYear();
        if (yearToday !== year) return null;
        const pct = computeYearPercent(today, yearToday);
        if (pct < 0 || pct > 100) return null;

        const todayISO = dateToISO(today);

        return (
          <div
            className="absolute"
            style={{
              top: 0,
              height: "1.75rem",
              left: `${pct}%`,
              width: 0,
              borderLeft: `3.5px solid ${todayLineColor}`,
              transform: "translateX(0)",
            }}
            title={`Idag (${todayISO})`}
          />
        );
      })()}
    </div>
  );
}

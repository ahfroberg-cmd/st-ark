"use client";

import { useMemo } from "react";
import type { SupervisorStudent } from "@/lib/mappers/studentData";

export function useOverallTimelineSummary({
  students,
  spreadStudentColors,
  getStudentStartISO,
  getStudentPlannedEndISO,
  isValidISODate,
  dateToSlotSnapped,
  dateToMarkerSlot,
}: {
  students: SupervisorStudent[];
  spreadStudentColors: (students: SupervisorStudent[]) => Map<string, string>;
  getStudentStartISO: (student: SupervisorStudent) => string | null;
  getStudentPlannedEndISO: (student: SupervisorStudent) => string | null;
  isValidISODate: (value: string) => boolean;
  dateToSlotSnapped: (startYear: number, iso: string, snap: "start" | "end") => number | null;
  dateToMarkerSlot: (startYear: number, iso: string) => number | null;
}) {
  return useMemo(() => {
    const colorById = spreadStudentColors(students || []);
    const arr = (students || []).map((s) => {
      const startISO = getStudentStartISO(s);
      const endISO = getStudentPlannedEndISO(s);
      return {
        id: s.id,
        name: s.name,
        startISO,
        endISO,
        color: colorById.get(String(s.id || "")) || "hsl(210 70% 45%)",
      };
    });

    const starts = arr
      .map((x) => (isValidISODate(x.startISO || "") ? x.startISO : null))
      .filter(Boolean) as string[];
    const ends = arr
      .map((x) => (isValidISODate(x.endISO || "") ? x.endISO : null))
      .filter(Boolean) as string[];

    const minStart = starts.length ? starts.slice().sort()[0] : null;
    const maxEnd = ends.length ? ends.slice().sort()[ends.length - 1] : null;
    const minEnd = ends.length ? ends.slice().sort()[0] : null;

    const todayYear = new Date().getFullYear();
    const computedStartYearForSlots = minEnd ? new Date(minEnd + "T00:00:00").getFullYear() - 1 : null;
    const startYearForSlots = computedStartYearForSlots != null ? Math.min(computedStartYearForSlots, todayYear) : todayYear;
    const visibleStartSlot = startYearForSlots != null ? 0 : null;
    const endBoundarySlot = startYearForSlots != null && maxEnd ? dateToSlotSnapped(startYearForSlots, maxEnd, "end") : null;

    const markers = arr
      .filter((x) => isValidISODate(x.endISO || "") && startYearForSlots != null)
      .map((x) => {
        const slot = dateToMarkerSlot(startYearForSlots as number, x.endISO as string);
        return {
          ...x,
          slot,
        };
      })
      .filter((x: any) => typeof x.slot === "number" && Number.isFinite(x.slot))
      .sort((a: any, b: any) => (a.endISO as string).localeCompare(b.endISO as string));

    const startYear = startYearForSlots;
    const endYear = (() => {
      if (!maxEnd) return Math.max(startYearForSlots as number, todayYear);
      const y = new Date(maxEnd + "T00:00:00").getFullYear();
      return Math.max(startYearForSlots as number, y, todayYear);
    })();
    const years: number[] = [];
    if (startYear != null && endYear != null) {
      for (let y = startYear; y <= endYear; y++) years.push(y);
    }

    return {
      minStart,
      maxEnd,
      startYearForSlots,
      visibleStartSlot,
      endBoundarySlot,
      years,
      markers,
    };
  }, [
    dateToMarkerSlot,
    dateToSlotSnapped,
    getStudentPlannedEndISO,
    getStudentStartISO,
    isValidISODate,
    spreadStudentColors,
    students,
  ]);
}

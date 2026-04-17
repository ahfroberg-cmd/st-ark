"use client";

import { useMemo } from "react";
import type { SupervisorStudent } from "@/lib/mappers/studentData";

export function useOverallTimelineLinear({
  students,
  spreadStudentColors,
  getStudentStartISO,
  getStudentPlannedEndISO,
  isValidISODate,
  normalizeToISODate,
  dateToSlotSnapped,
  formatDate,
}: {
  students: SupervisorStudent[];
  spreadStudentColors: (students: SupervisorStudent[]) => Map<string, string>;
  getStudentStartISO: (student: SupervisorStudent) => string | null;
  getStudentPlannedEndISO: (student: SupervisorStudent) => string | null;
  isValidISODate: (value: string) => boolean;
  normalizeToISODate: (value: string) => string | null;
  dateToSlotSnapped: (startYear: number, iso: string, snap: "start" | "end") => number | null;
  formatDate: (iso: string) => string;
}) {
  return useMemo(() => {
    const cellW = 32;
    const rowH = 32;
    const halfSlotW = cellW / 2;

    const colorById = spreadStudentColors(students || []);

    const safeMonthStart = (iso: string): string | null => {
      if (!isValidISODate(iso)) return null;
      return iso.slice(0, 7) + "-01";
    };

    const monthKey = (iso: string): number => {
      const d = new Date(iso + "T00:00:00");
      return d.getFullYear() * 12 + d.getMonth();
    };

    const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
    const toMonthShort = (k: number): string => MONTH_SHORT[k % 12] || "";

    const rows = (students || []).map((s) => {
      const startISO = getStudentStartISO(s);
      const endISO = getStudentPlannedEndISO(s);
      return {
        id: s.id,
        name: s.name,
        startISO: isValidISODate(startISO || "") ? startISO : null,
        endISO: isValidISODate(endISO || "") ? endISO : null,
        color: colorById.get(String(s.id || "")) || "hsl(210 70% 45%)",
        placements: Array.isArray((s as any)?.placements) ? ((s as any).placements as any[]) : [],
        courses: Array.isArray((s as any)?.courses) ? ((s as any).courses as any[]) : [],
        iupSettings: (s as any)?.iupSettings || {},
      };
    });

    const startMonths = rows.map((r: any) => (r.startISO ? safeMonthStart(r.startISO) : null)).filter(Boolean) as string[];
    const endMonths = rows.map((r: any) => (r.endISO ? safeMonthStart(r.endISO) : null)).filter(Boolean) as string[];

    const minMonthISO = startMonths.length ? startMonths.slice().sort()[0] : null;
    const maxMonthISO = endMonths.length ? endMonths.slice().sort()[endMonths.length - 1] : null;

    if (!minMonthISO || !maxMonthISO) {
      return {
        ok: false as const,
        reason:
          "Saknar start/slutdatum för att rita månadsgrid. Kontrollera att profilerna innehåller ST-startdatum och planerat slutdatum.",
      };
    }

    const minKey = monthKey(minMonthISO);
    const maxKey = monthKey(maxMonthISO);
    const monthKeys: number[] = [];
    for (let k = minKey; k <= maxKey; k++) monthKeys.push(k);

    const startYearForSlots = Math.floor(minKey / 12);
    const totalHalfSlots = monthKeys.length * 2;

    const todayMarkerX = (() => {
      const todayISO = new Date().toISOString().slice(0, 10);
      const slot = dateToSlotSnapped(startYearForSlots, todayISO, "start");
      if (typeof slot !== "number" || !Number.isFinite(slot) || slot < 0 || slot > totalHalfSlots) return null;
      return slot * halfSlotW;
    })();

    const placementBarsByStudent = new Map<
      string,
      Array<{ left: number; width: number; label: string; bg: string; title: string }>
    >();
    const activityBarsByStudent = new Map<
      string,
      Array<{
        left: number;
        width: number;
        label: string;
        hoverLabel?: string;
        bg: string;
        title: string;
      }>
    >();

    for (const r of rows as any[]) {
      const bars: Array<{ left: number; width: number; label: string; bg: string; title: string }> = [];
      for (const p of r.placements) {
        const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
        if (!start) continue;
        const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || "");
        const end = endRaw || start;

        const startSlot = dateToSlotSnapped(startYearForSlots, start, "start");
        const endSlot = dateToSlotSnapped(startYearForSlots, end, "end");
        if (typeof startSlot !== "number" || typeof endSlot !== "number") continue;
        if (!Number.isFinite(startSlot) || !Number.isFinite(endSlot)) continue;

        const clampedStartSlot = Math.max(0, Math.min(totalHalfSlots - 1, startSlot));
        const clampedEndSlot = Math.max(clampedStartSlot + 1, Math.min(totalHalfSlots, endSlot));
        const widthHalfSlots = Math.max(1, clampedEndSlot - clampedStartSlot);

        const label = String(p?.clinic || p?.title || p?.type || "Placering");
        bars.push({
          left: clampedStartSlot * halfSlotW + 1,
          width: Math.max(halfSlotW * 0.75, widthHalfSlots * halfSlotW - 2),
          label,
          bg: r.color,
          title: `${r.name} – ${label}: ${formatDate(start)} – ${formatDate(end)}`,
        });
      }
      placementBarsByStudent.set(String(r.id), bars);

      const compactBars: Array<{
        left: number;
        width: number;
        label: string;
        hoverLabel?: string;
        bg: string;
        title: string;
      }> = [];
      const appendCompactBar = (
        startISO: string,
        endISO: string,
        label: string,
        hoverLabel: string | undefined,
        bg: string,
        title: string
      ) => {
        if (!isValidISODate(startISO) || !isValidISODate(endISO)) return;
        const startSlot = dateToSlotSnapped(startYearForSlots, startISO, "start");
        const endSlot = dateToSlotSnapped(startYearForSlots, endISO, "end");
        if (typeof startSlot !== "number" || typeof endSlot !== "number") return;
        if (!Number.isFinite(startSlot) || !Number.isFinite(endSlot)) return;
        const clampedStartSlot = Math.max(0, Math.min(totalHalfSlots - 1, startSlot));
        const clampedEndSlot = Math.max(clampedStartSlot + 1, Math.min(totalHalfSlots, endSlot));
        const widthHalfSlots = Math.max(1, clampedEndSlot - clampedStartSlot);
        compactBars.push({
          left: clampedStartSlot * halfSlotW + 1,
          width: Math.max(halfSlotW * 0.75, widthHalfSlots * halfSlotW - 2),
          label,
          hoverLabel,
          bg,
          title,
        });
      };

      for (const c of r.courses || []) {
        const start = normalizeToISODate(c?.startDate || c?.start_date || c?.certificateDate || c?.certificate_date || "");
        const end = normalizeToISODate(c?.endDate || c?.end_date || c?.certificateDate || c?.certificate_date || "");
        if (!start && !end) continue;
        const s = start || end;
        const e = end || start;
        const courseLabel = String(c?.courseTitle || c?.course_title || c?.title || "Kurs");
        appendCompactBar(
          String(s),
          String(e),
          courseLabel,
          courseLabel,
          "hsl(221 83% 53%)",
          `${r.name} – Kurs: ${courseLabel} (${formatDate(String(s))}${s !== e ? ` – ${formatDate(String(e))}` : ""})`
        );
      }

      const iupRow = r.iupSettings || {};
      const hhMeetings = Array.isArray(iupRow?.meetings) ? iupRow.meetings : [];
      const pbAssessments = Array.isArray(iupRow?.assessments) ? iupRow.assessments : [];
      const srMeetings = Array.isArray(iupRow?.director_meetings) ? iupRow.director_meetings : [];

      for (const m of hhMeetings) {
        const d = normalizeToISODate(m?.dateISO || m?.date || m?.iso || "");
        if (!d) continue;
        appendCompactBar(d, d, "HH", "Huvudhandledarsamtal", "hsl(163 74% 34%)", `${r.name} – Huvudhandledarsamtal (${formatDate(d)})`);
      }
      for (const a of pbAssessments) {
        const d = normalizeToISODate(a?.dateISO || a?.date || a?.iso || "");
        if (!d) continue;
        const assessmentKind = String(a?.instrument || a?.assessmentType || a?.type || a?.title || a?.name || "").trim();
        appendCompactBar(
          d,
          d,
          "PB",
          assessmentKind ? `Progressionsbedömning (${assessmentKind})` : "Progressionsbedömning",
          "hsl(334 74% 45%)",
          `${r.name} – Progressionsbedömning${assessmentKind ? ` (${assessmentKind})` : ""} (${formatDate(d)})`
        );
      }
      for (const srm of srMeetings) {
        const d = normalizeToISODate(srm?.dateISO || srm?.date || srm?.iso || "");
        if (!d) continue;
        appendCompactBar(d, d, "SR", "Studierektorsmöte", "hsl(25 95% 53%)", `${r.name} – Studierektorsmöte (${formatDate(d)})`);
      }

      compactBars.sort((a, b) => a.left - b.left || a.width - b.width);
      activityBarsByStudent.set(String(r.id), compactBars);
    }

    return {
      ok: true as const,
      cellW,
      rowH,
      monthKeys,
      monthLabels: monthKeys.map(toMonthShort),
      rows,
      placementBarsByStudent,
      activityBarsByStudent,
      todayMarkerX,
    };
  }, [
    dateToSlotSnapped,
    formatDate,
    getStudentPlannedEndISO,
    getStudentStartISO,
    isValidISODate,
    normalizeToISODate,
    spreadStudentColors,
    students,
  ]);
}

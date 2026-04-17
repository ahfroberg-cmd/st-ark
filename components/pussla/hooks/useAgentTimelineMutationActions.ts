"use client";

import { useCallback } from "react";
import { placementNameMatches } from "@/lib/ai/colleagueMatch";

export function useAgentTimelineMutationActions(params: {
  activities: any[];
  courses: any[];
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  selectedPlacementIdRef: any;
  selectedCourseIdRef: any;
  authUserId: string | undefined;
  getSessionUser: any;
  supabase: any;
  startYear: number;
  getPlacementStartISOForAgent: any;
  getPlacementEndISOForAgent: any;
  getCourseStartISOForAgent: any;
  isValidISO: any;
  dateToSlot: any;
  findPlacementToRight: any;
  computeMondayDates: any;
  computePhaseByEndSlot: any;
  wouldOverlap: any;
  setActivities: any;
  setCourses: any;
  setSelectedPlacementId: any;
  setSelectedCourseId: any;
  setActiveLane: any;
  setDirty: any;
  refreshLists: any;
  logAudit: any;
  saveCourseToDb: any;
  totalPlanMonths: number;
  stStartISO: string | null;
  stEndISO: string | null;
  todayISO: () => string;
  normalizeCourseTitleForAgent: any;
  courseTouchesMonthYearForAgent: any;
  courseTitleMatchesAgent: any;
}) {
  const addMonthsISOForAgent = useCallback((iso: string, months: number): string => {
    const d = new Date(`${iso}T12:00:00`);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }, []);

  const addDaysISOForAgent = useCallback((iso: string, days: number): string => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }, []);

  const deletePlacementByMonthYearForAgent = useCallback(
    async (month: number, year: number): Promise<{ ok: boolean; message: string }> => {
      const matches = params.activities.filter((a) => {
        const startISO = params.getPlacementStartISOForAgent(a);
        if (!params.isValidISO(startISO)) return false;
        const d = new Date(`${startISO}T00:00:00`);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
      if (matches.length === 0) {
        return { ok: false, message: `Hittade ingen placering som börjar ${year}-${String(month).padStart(2, "0")}.` };
      }
      if (matches.length > 1) {
        return {
          ok: false,
          message:
            `Hittade ${matches.length} placeringar som börjar ${year}-${String(month).padStart(2, "0")}. ` +
            "Var mer specifik med exakt startdatum.",
        };
      }
      const a = matches[0];
      if (a.linkedPlacementId) {
        let delUserId = params.authUserId;
        if (!delUserId) {
          const user = await params.getSessionUser();
          delUserId = user?.id;
        }
        if (delUserId) {
          await params.supabase.from("placements").delete().eq("id", a.linkedPlacementId).eq("user_id", delUserId);
        }
      }
      params.setActivities((prev: any[]) => prev.filter((x) => x.id !== a.id));
      if (params.selectedPlacementId === a.id) {
        params.setSelectedPlacementId(null);
        params.setDirty(false);
      }
      await params.refreshLists();
      void params.logAudit("delete", "placements", `Raderade via agent: ${a.type || "Aktivitet"} ${a.label || ""}`, a.linkedPlacementId || a.id);
      return { ok: true, message: `Placeringen som började ${year}-${String(month).padStart(2, "0")} är borttagen.` };
    },
    [params]
  );

  const extendLastPlacementForAgent = useCallback(
    async (
      positionFromEnd?: number,
      months?: number,
      endDate?: string,
      placementTitle?: string
    ): Promise<{ ok: boolean; message: string }> => {
      const total = params.activities.length;
      if (total === 0) return { ok: false, message: "Det finns ingen placering att förlänga." };
      const q = String(placementTitle || "").trim();
      let target: any = null;
      if (q) {
        const matches = params.activities.filter((a) =>
          placementNameMatches(q, String(a?.label || ""), String(a?.type || ""))
        );
        if (matches.length === 0) {
          return {
            ok: false,
            message: `Hittade ingen placering som matchar "${q}". Skriv namnet som i tidslinjen eller välj placeringen först.`,
          };
        }
        matches.sort((a, b) => String(a?.label || "").length - String(b?.label || "").length);
        target = matches[0];
      } else {
        const pos = Math.max(1, Number(positionFromEnd || 1));
        if (total < pos) {
          return {
            ok: false,
            message:
              pos === 2
                ? `Det finns bara ${total} placering${total === 1 ? "" : "ar"} på sidan, så det finns ingen näst sista placering.`
                : `Det finns bara ${total} placering${total === 1 ? "" : "ar"} på sidan, så placering #${pos} från slutet saknas.`,
          };
        }
        const sorted = [...params.activities].sort((a, b) =>
          params.getPlacementEndISOForAgent(b).localeCompare(params.getPlacementEndISOForAgent(a))
        );
        target = sorted[pos - 1];
      }
      const currentEnd = params.getPlacementEndISOForAgent(target);
      if (!params.isValidISO(currentEnd)) return { ok: false, message: "Kunde inte läsa slutdatum för vald placering." };

      let nextEndISO = currentEnd;
      let monthDelta = 0;
      if (endDate) {
        if (!params.isValidISO(endDate)) return { ok: false, message: "Ogiltigt slutdatum. Använd YYYY-MM-DD." };
        nextEndISO = endDate;
      } else {
        const rawDelta = Number(months || 1);
        monthDelta = Number.isFinite(rawDelta) ? Math.trunc(rawDelta) : 1;
        if (monthDelta === 0) monthDelta = 1;
        monthDelta = Math.max(-24, Math.min(24, monthDelta));
        const d = new Date(`${currentEnd}T12:00:00`);
        d.setMonth(d.getMonth() + monthDelta);
        nextEndISO = d.toISOString().slice(0, 10);
      }
      if (nextEndISO === currentEnd) {
        return { ok: false, message: `Slutdatum blev oförändrat (${currentEnd}). Ange annan period eller nytt datum.` };
      }
      const isShortening = nextEndISO < currentEnd;

      let nextEndSlot = params.dateToSlot(params.startYear, nextEndISO, "end");
      let nextLength = Math.max(1, nextEndSlot - target.startSlot + 1);
      let adjustedToNeighbor = false;
      if (!isShortening) {
        const right = params.findPlacementToRight(target.id);
        if (right) {
          const maxLen = right.startSlot - target.startSlot;
          if (maxLen <= target.lengthSlots) {
            const rs = params.getPlacementStartISOForAgent(right);
            return { ok: false, message: `Placeringen är redan intill nästa placering${params.isValidISO(rs) ? ` (börjar ${rs})` : ""}.` };
          }
          if (nextLength > maxLen) {
            nextLength = maxLen;
            adjustedToNeighbor = true;
            nextEndSlot = target.startSlot + nextLength - 1;
          }
        }
      } else {
        if (nextEndSlot < target.startSlot) {
          return { ok: false, message: "Kan inte förkorta förbi placeringens startdatum." };
        }
      }
      if (!isShortening && nextLength <= target.lengthSlots) {
        return { ok: false, message: "Placeringen blev inte längre. Ange ett senare slutdatum." };
      }
      if (isShortening && nextLength >= target.lengthSlots) {
        return { ok: false, message: "Placeringen blev inte kortare. Ange ett tidigare slutdatum." };
      }
      const snapped = params.computeMondayDates({ ...target, lengthSlots: nextLength });
      const finalEndISO = snapped.endISO;
      if (!params.isValidISO(finalEndISO)) return { ok: false, message: "Kunde inte beräkna slutdatum efter justering mot nästa placering." };
      if (!isShortening && params.wouldOverlap(target.id, target.startSlot, nextLength)) {
        return { ok: false, message: "Kan inte förlänga den valda placeringen eftersom den skulle överlappa en annan placering." };
      }

      params.setActivities((prev: any[]) =>
        prev.map((a) =>
          a.id === target.id
            ? { ...a, lengthSlots: nextLength, exactEndISO: finalEndISO, phase: params.computePhaseByEndSlot(a.startSlot, nextLength) }
            : a
        )
      );
      params.setSelectedPlacementId(target.id);
      params.setSelectedCourseId(null);
      params.setActiveLane("placement");
      params.setDirty(true);
      const adj = adjustedToNeighbor && params.isValidISO(finalEndISO)
        ? ` Slutdatumet sattes intill nästa placering (${finalEndISO}) i stället för att överlappa.`
        : "";
      const pos = Math.max(1, Number(positionFromEnd || 1));
      const posLabel = q
        ? `matchning "${q}"`
        : `position ${pos} från slutet`;
      return {
        ok: true,
        message: `Placeringen "${target.label || "Klinisk tjänstgöring"}" (${posLabel}) ${isShortening ? "förkortades" : "förlängdes"} från ${currentEnd} till ${finalEndISO}.${adj}`,
      };
    },
    [params]
  );

  const shiftPlacementFromEndForAgent = useCallback(
    async (positionFromEnd?: number, months?: number): Promise<{ ok: boolean; message: string }> => {
      const total = params.activities.length;
      if (total === 0) return { ok: false, message: "Det finns ingen placering att flytta fram." };
      const pos = Math.max(1, Number(positionFromEnd || 1));
      if (total < pos) {
        return { ok: false, message: `Det finns bara ${total} placering${total === 1 ? "" : "ar"} på sidan, så placering #${pos} från slutet saknas.` };
      }
      const moveMonths = Math.max(1, Math.min(24, Number(months || 1)));
      const sorted = [...params.activities].sort((a, b) =>
        params.getPlacementEndISOForAgent(b).localeCompare(params.getPlacementEndISOForAgent(a))
      );
      const target = sorted[pos - 1];
      const currentStart = params.getPlacementStartISOForAgent(target);
      const currentEnd = params.getPlacementEndISOForAgent(target);
      if (!params.isValidISO(currentStart) || !params.isValidISO(currentEnd)) {
        return { ok: false, message: "Kunde inte läsa start/slutdatum för vald placering." };
      }
      const dStart = new Date(`${currentStart}T12:00:00`);
      const dEnd = new Date(`${currentEnd}T12:00:00`);
      dStart.setMonth(dStart.getMonth() + moveMonths);
      dEnd.setMonth(dEnd.getMonth() + moveMonths);
      const nextStartISO = dStart.toISOString().slice(0, 10);
      const nextEndISO = dEnd.toISOString().slice(0, 10);
      let nextStartSlot = params.dateToSlot(params.startYear, nextStartISO, "start");
      const nextEndSlot = params.dateToSlot(params.startYear, nextEndISO, "end");
      const nextLength = Math.max(1, nextEndSlot - nextStartSlot + 1);
      const right = params.findPlacementToRight(target.id);
      let adjustedToNeighbor = false;
      if (params.wouldOverlap(target.id, nextStartSlot, nextLength)) {
        if (!right) return { ok: false, message: "Kan inte flytta fram den valda placeringen eftersom den skulle överlappa en annan placering." };
        const maxStart = right.startSlot - nextLength;
        if (nextStartSlot > maxStart) {
          nextStartSlot = maxStart;
          adjustedToNeighbor = true;
        }
      }
      if (params.wouldOverlap(target.id, nextStartSlot, nextLength)) {
        return { ok: false, message: "Kan inte flytta fram den valda placeringen eftersom den skulle överlappa en annan placering." };
      }
      if (nextStartSlot === target.startSlot && moveMonths > 0) {
        const rs = right ? params.getPlacementStartISOForAgent(right) : "";
        return { ok: false, message: `Flytten skulle möta nästa placering; placeringen ligger redan intill nästa block${params.isValidISO(rs) ? ` (nästa börjar ${rs})` : ""}.` };
      }
      const snapped = params.computeMondayDates({ ...target, startSlot: nextStartSlot, lengthSlots: nextLength });
      params.setActivities((prev: any[]) =>
        prev.map((a) =>
          a.id === target.id
            ? {
                ...a,
                startSlot: nextStartSlot,
                lengthSlots: nextLength,
                exactStartISO: snapped.startISO,
                exactEndISO: snapped.endISO,
                phase: params.computePhaseByEndSlot(nextStartSlot, nextLength),
              }
            : a
        )
      );
      params.setSelectedPlacementId(target.id);
      params.setSelectedCourseId(null);
      params.setActiveLane("placement");
      params.setDirty(true);
      const adj = adjustedToNeighbor ? " Datum justerades så att placeringen ligger intill nästa block utan överlapp." : "";
      return {
        ok: true,
        message: `Placeringen "${target.label || "Klinisk tjänstgöring"}" flyttades fram ${moveMonths} månad(er): ${currentStart}–${currentEnd} -> ${snapped.startISO}–${snapped.endISO}.${adj}`,
      };
    },
    [params]
  );

  const transformAllPlacementsDurationForAgent = useCallback(
    async (options: { factor: number; anchor?: "start" | "end" }): Promise<{ ok: boolean; message: string }> => {
      if (!Array.isArray(params.activities) || params.activities.length === 0) {
        return { ok: false, message: "Det finns inga placeringar att transformera." };
      }
      const factorRaw = Number(options?.factor);
      if (!Number.isFinite(factorRaw) || factorRaw <= 0) return { ok: false, message: "Ogiltig faktor för längdskalning." };
      if (factorRaw > 1) {
        return {
          ok: false,
          message: "Skalning > 1 (förlängning) stöds inte i bulk-läge ännu eftersom det riskerar överlapp. Använd punktvisa förlängningar.",
        };
      }
      const factor = Math.max(0.05, Math.min(1, factorRaw));
      const anchor = options?.anchor === "end" ? "end" : "start";
      let changedCount = 0;
      const transformed = params.activities.map((a) => {
        const currentLength = Math.max(1, Number(a.lengthSlots || 1));
        const nextLength = Math.max(1, Math.floor(currentLength * factor));
        if (nextLength >= currentLength) return a;
        const nextStartSlot = anchor === "end" ? Math.max(0, Number(a.startSlot || 0) + (currentLength - nextLength)) : Number(a.startSlot || 0);
        const snapped = params.computeMondayDates({ ...a, startSlot: nextStartSlot, lengthSlots: nextLength });
        changedCount += 1;
        return { ...a, startSlot: nextStartSlot, lengthSlots: nextLength, exactStartISO: snapped.startISO, exactEndISO: snapped.endISO, phase: params.computePhaseByEndSlot(nextStartSlot, nextLength) };
      });
      if (changedCount === 0) return { ok: false, message: "Inga placeringar ändrades av den valda längdskalningen." };
      params.setActivities(transformed);
      params.setSelectedCourseId(null);
      params.setActiveLane("placement");
      params.setDirty(true);
      const pct = Math.round(factor * 100);
      return { ok: true, message: `${changedCount} placering(ar) längdskalades till ${pct}% (${anchor === "end" ? "behöll slut" : "behöll start"}).` };
    },
    [params]
  );

  const shiftAllCoursesForAgent = useCallback(
    async (months?: number, direction: "forward" | "backward" = "forward"): Promise<{ ok: boolean; message: string }> => {
      if (!Array.isArray(params.courses) || params.courses.length === 0) return { ok: false, message: "Det finns inga kurser att flytta." };
      const moveMonths = Math.max(1, Math.min(24, Number(months || 1)));
      const delta = direction === "backward" ? -moveMonths : moveMonths;
      const shiftIso = (iso?: string) => {
        const s = String(iso || "").trim();
        if (!params.isValidISO(s)) return s || undefined;
        return addMonthsISOForAgent(s, delta);
      };
      let changedCount = 0;
      const shifted = params.courses.map((c) => {
        const nextStart = shiftIso(c.startDate);
        const nextEnd = shiftIso(c.endDate);
        const nextCert = shiftIso(c.certificateDate);
        const changed =
          String(nextStart || "") !== String(c.startDate || "") ||
          String(nextEnd || "") !== String(c.endDate || "") ||
          String(nextCert || "") !== String(c.certificateDate || "");
        if (!changed) return c;
        changedCount += 1;
        return { ...c, startDate: nextStart, endDate: nextEnd, certificateDate: nextCert };
      });
      if (changedCount === 0) return { ok: false, message: "Hittade inga kursdatum att flytta." };
      params.setCourses(shifted);
      params.setActiveLane("course");
      params.setDirty(true);
      let saved = 0;
      for (const c of shifted) {
        const original = params.courses.find((x) => x.id === c.id);
        if (!original) continue;
        const hasChanged =
          String(c.startDate || "") !== String(original.startDate || "") ||
          String(c.endDate || "") !== String(original.endDate || "") ||
          String(c.certificateDate || "") !== String(original.certificateDate || "");
        if (!hasChanged) continue;
        if (await params.saveCourseToDb(c)) saved += 1;
      }
      const dirLabel = direction === "backward" ? "bakåt" : "framåt";
      if (saved < changedCount) {
        return { ok: false, message: `Flyttade ${changedCount} kurser ${moveMonths} månad(er) ${dirLabel}, men kunde bara spara ${saved}.` };
      }
      return { ok: true, message: `Flyttade ${changedCount} kurser ${moveMonths} månad(er) ${dirLabel}.` };
    },
    [params, addMonthsISOForAgent]
  );

  const planTimelineDistributionForAgent = useCallback(
    async (options: { target: "courses" | "placements"; cadence: "month" | "half_year" | "term" | "year"; itemsPerCadence: number }): Promise<{ ok: boolean; message: string }> => {
      if (options.target !== "courses") {
        return { ok: false, message: "Generell frekvensplanering är just nu implementerad för kurser." };
      }
      const perCadence = Math.max(1, Math.min(8, Number(options.itemsPerCadence || 1)));
      const cadenceDays = options.cadence === "month" ? 30 : options.cadence === "year" ? 365 : 183;
      if (!Array.isArray(params.courses) || params.courses.length === 0) return { ok: false, message: "Det finns inga kurser att omplanera." };
      const targetCourses = params.courses.filter((c) => (c.kind || "Kurs") === "Kurs");
      const baseCourses = targetCourses.length > 0 ? targetCourses : params.courses;
      if (baseCourses.length === 0) return { ok: false, message: "Hittade inga kurser att omplanera." };
      const windowStart = params.isValidISO(String(params.stStartISO || ""))
        ? String(params.stStartISO)
        : (() => {
            const first = [...baseCourses]
              .map((c) => String(c.startDate || c.certificateDate || c.endDate || ""))
              .filter((d) => params.isValidISO(d))
              .sort()[0];
            return first || params.todayISO();
          })();
      const windowEnd = params.isValidISO(String(params.stEndISO || ""))
        ? String(params.stEndISO)
        : addMonthsISOForAgent(windowStart, Math.max(12, Number(params.totalPlanMonths || 60)));
      const sorted = [...baseCourses].sort((a, b) =>
        String(a.startDate || a.certificateDate || a.endDate || "").localeCompare(
          String(b.startDate || b.certificateDate || b.endDate || "")
        )
      );
      const stepDays = Math.max(1, Math.round(cadenceDays / perCadence));
      const shiftedById = new Map<string, any>();
      sorted.forEach((c, idx) => {
        const oldBase = String(c.startDate || c.certificateDate || c.endDate || "");
        if (!params.isValidISO(oldBase)) return;
        const targetStart = addDaysISOForAgent(windowStart, idx * stepDays);
        const boundedStart = targetStart > windowEnd ? windowEnd : targetStart;
        const oldStart = String(c.startDate || oldBase);
        const oldEnd = String(c.endDate || oldBase);
        const oldCert = String(c.certificateDate || oldEnd || oldBase);
        const startMs = Date.parse(`${oldBase}T12:00:00`);
        const targetMs = Date.parse(`${boundedStart}T12:00:00`);
        if (!Number.isFinite(startMs) || !Number.isFinite(targetMs)) return;
        const deltaDays = Math.round((targetMs - startMs) / (1000 * 60 * 60 * 24));
        const nextStart = params.isValidISO(oldStart) ? addDaysISOForAgent(oldStart, deltaDays) : boundedStart;
        const nextEnd = params.isValidISO(oldEnd) ? addDaysISOForAgent(oldEnd, deltaDays) : boundedStart;
        const nextCert = params.isValidISO(oldCert) ? addDaysISOForAgent(oldCert, deltaDays) : nextEnd;
        shiftedById.set(c.id, { ...c, startDate: nextStart, endDate: nextEnd, certificateDate: nextCert });
      });
      if (shiftedById.size === 0) return { ok: false, message: "Hittade inga kursdatum att omplanera." };
      const nextCourses = params.courses.map((c) => shiftedById.get(c.id) || c);
      params.setCourses(nextCourses);
      params.setActiveLane("course");
      params.setDirty(true);
      let saved = 0;
      for (const c of nextCourses) {
        if (!shiftedById.has(c.id)) continue;
        if (await params.saveCourseToDb(c)) saved += 1;
      }
      const cadenceLabel = options.cadence === "half_year" ? "halvår" : options.cadence === "term" ? "termin" : options.cadence === "year" ? "år" : "månad";
      if (saved < shiftedById.size) {
        return { ok: false, message: `Omplanerade ${shiftedById.size} kurser till ${perCadence} per ${cadenceLabel}, men kunde bara spara ${saved}.` };
      }
      return { ok: true, message: `Omplanerade ${shiftedById.size} kurser till ${perCadence} per ${cadenceLabel}.` };
    },
    [params, addMonthsISOForAgent, addDaysISOForAgent]
  );

  const rebalanceCoursesPerHalfYearForAgent = useCallback(
    async (coursesPerHalfYear?: number): Promise<{ ok: boolean; message: string }> => {
      return planTimelineDistributionForAgent({
        target: "courses",
        cadence: "half_year",
        itemsPerCadence: Math.max(1, Number(coursesPerHalfYear || 2)),
      });
    },
    [planTimelineDistributionForAgent]
  );

  const deleteSelectedPlacementForAgent = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const id = params.selectedPlacementIdRef.current || params.selectedPlacementId;
    if (!id) return { ok: false, message: "Ingen vald placering att ta bort." };
    const target = params.activities.find((a) => a.id === id);
    if (!target) return { ok: false, message: "Vald placering hittades inte." };
    if (target.linkedPlacementId) {
      let delUserId = params.authUserId;
      if (!delUserId) {
        const user = await params.getSessionUser();
        delUserId = user?.id;
      }
      if (delUserId) await params.supabase.from("placements").delete().eq("id", target.linkedPlacementId).eq("user_id", delUserId);
    }
    params.setActivities((prev: any[]) => prev.filter((a) => a.id !== id));
    params.setSelectedPlacementId(null);
    params.selectedPlacementIdRef.current = null;
    params.setDirty(false);
    await params.refreshLists();
    return { ok: true, message: `Tog bort vald placering: ${target.label || target.type || "placering"}.` };
  }, [params]);

  const deleteSelectedCourseForAgent = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const id = params.selectedCourseIdRef.current || params.selectedCourseId;
    if (!id) return { ok: false, message: "Ingen vald kurs att ta bort." };
    const target = params.courses.find((c) => c.id === id);
    if (!target) return { ok: false, message: "Vald kurs hittades inte." };
    if (target.linkedCourseId) {
      let delUserId = params.authUserId;
      if (!delUserId) {
        const user = await params.getSessionUser();
        delUserId = user?.id;
      }
      if (delUserId) await params.supabase.from("courses").delete().eq("id", target.linkedCourseId).eq("user_id", delUserId);
    }
    params.setCourses((prev: any[]) => prev.filter((c) => c.id !== id));
    params.setSelectedCourseId(null);
    params.selectedCourseIdRef.current = null;
    params.setDirty(false);
    await params.refreshLists();
    return { ok: true, message: `Tog bort vald kurs: ${target.title || target.kind || "kurs"}.` };
  }, [params]);

  const deleteCourseByMonthYearForAgent = useCallback(
    async (month: number, year: number): Promise<{ ok: boolean; message: string }> => {
      const matches = params.courses.filter((c) => {
        const startISO = params.getCourseStartISOForAgent(c);
        if (!params.isValidISO(startISO)) return false;
        const d = new Date(`${startISO}T00:00:00`);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
      if (matches.length === 0) return { ok: false, message: `Hittade ingen kurs som börjar ${year}-${String(month).padStart(2, "0")}.` };
      if (matches.length > 1) {
        return {
          ok: false,
          message:
            `Hittade ${matches.length} kurser som börjar ${year}-${String(month).padStart(2, "0")}. ` +
            "Var mer specifik med exakt startdatum.",
        };
      }
      const c = matches[0];
      if (c.linkedCourseId) {
        let delUserId = params.authUserId;
        if (!delUserId) {
          const user = await params.getSessionUser();
          delUserId = user?.id;
        }
        if (delUserId) await params.supabase.from("courses").delete().eq("id", c.linkedCourseId).eq("user_id", delUserId);
      }
      params.setCourses((prev: any[]) => prev.filter((x) => x.id !== c.id));
      if (params.selectedCourseId === c.id) {
        params.setSelectedCourseId(null);
        params.setDirty(false);
      }
      await params.refreshLists();
      void params.logAudit("delete", "courses", `Raderade via agent: ${c.title || "Kurs"}`, c.linkedCourseId || c.id);
      return { ok: true, message: `Kursen som började ${year}-${String(month).padStart(2, "0")} är borttagen.` };
    },
    [params]
  );

  const convertCourseToUtbildningsmomentForAgent = useCallback(
    async (courseTitle: string, month: number, year: number, description?: string): Promise<{ ok: boolean; message: string }> => {
      const q = params.normalizeCourseTitleForAgent(courseTitle);
      if (!q) return { ok: false, message: "Ange kursens titel." };
      const inMonth = params.courses.filter(
        (c) =>
          params.courseTouchesMonthYearForAgent(c, month, year, params.isValidISO) &&
          params.courseTitleMatchesAgent(c, courseTitle)
      );
      const toConvert = inMonth.filter((c) => c.kind !== "Utbildningsmoment");
      const wantedDescription = String(description || "").trim();
      if (inMonth.length === 0) {
        return {
          ok: false,
          message: `Hittade ingen kurs som matchar "${courseTitle}" i ${year}-${String(month).padStart(2, "0")} (kontrollera start-, slut- eller intygdatum).`,
        };
      }
      if (toConvert.length === 0 && !wantedDescription) return { ok: true, message: "Kursen är redan markerad som utbildningsmoment." };
      const candidateSet = toConvert.length > 0 ? toConvert : inMonth;
      if (candidateSet.length > 1) {
        const names = [...new Set(candidateSet.map((c) => c.title || "(utan titel)"))].join(", ");
        return { ok: false, message: `Hittade flera matchande kurser: ${names}. Var mer specifik med titeln.` };
      }
      const c = candidateSet[0];
      const updated = { ...c, kind: "Utbildningsmoment", ...(wantedDescription ? { note: wantedDescription } : {}) };
      params.setCourses((prev: any[]) => prev.map((x) => (x.id === c.id ? updated : x)));
      params.setSelectedCourseId(c.id);
      params.setActiveLane("course");
      const saved = await params.saveCourseToDb(updated);
      if (!saved) return { ok: false, message: "Kunde inte spara ändringen till databasen." };
      return {
        ok: true,
        message: `"${c.title || "Kurs"}" är nu ett utbildningsmoment${wantedDescription ? " med uppdaterad beskrivning" : ""} (sparad i databasen).`,
      };
    },
    [params]
  );

  return {
    addMonthsISOForAgent,
    addDaysISOForAgent,
    deletePlacementByMonthYearForAgent,
    extendLastPlacementForAgent,
    shiftPlacementFromEndForAgent,
    transformAllPlacementsDurationForAgent,
    shiftAllCoursesForAgent,
    rebalanceCoursesPerHalfYearForAgent,
    planTimelineDistributionForAgent,
    deleteSelectedPlacementForAgent,
    deleteSelectedCourseForAgent,
    deleteCourseByMonthYearForAgent,
    convertCourseToUtbildningsmomentForAgent,
  };
}

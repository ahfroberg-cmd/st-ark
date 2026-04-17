"use client";

import { useCallback, type MutableRefObject } from "react";

export function useSelectionSaveActions(params: {
  selectedPlacement: any;
  selectedCourse: any;
  activities: any[];
  profile: any;
  startYear: number;
  authUserId: string | undefined;
  isValidISO: (value: string) => boolean;
  slotToYearMonthHalf: any;
  dateToISO: any;
  mondayNearestTo: any;
  sundayBeforeAnchor: any;
  isPlacementInBtWindow: any;
  getEffectiveBtWindow: any;
  isoToDateSafe: any;
  addMonths: any;
  dateToSlot: any;
  sanitizeStMilestonesForGoals: any;
  buildPlacementSupabaseRecord: any;
  buildCourseSupabaseRecord: any;
  ensureUserId: any;
  getSessionUser: any;
  setAuthUser: (user: any) => void;
  saveEntityRow: any;
  supabase: any;
  mapPlacementRowForList: any;
  mapPlacementRowForDb: any;
  mapCourseRowForList: any;
  mapCourseRowForDb: any;
  upsertById: any;
  perfMark: any;
  perfMeasure: any;
  baselineRef: MutableRefObject<any>;
  setDirty: (value: boolean) => void;
  setOverlapWarning: (message: string | null) => void;
  setActivities: (updater: any) => void;
  setCourses: (updater: any) => void;
  setListPlac: (updater: any) => void;
  setDbPlacements: (updater: any) => void;
  setListCourses: (updater: any) => void;
  setDbCourses: (updater: any) => void;
  isIsoInBtWindow: any;
  logAudit: any;
}) {
  const savePlacementToDb = useCallback(
    async (selAct: any): Promise<boolean> => {
      if (!selAct) return false;

      try {
        const startISO = (selAct.exactStartISO || "").trim();
        const endISO = (selAct.exactEndISO || "").trim();
        if (!startISO || !endISO || !params.isValidISO(startISO) || !params.isValidISO(endISO)) {
          params.setOverlapWarning("Kunde inte tolka datum i detaljrutan. Kontrollera start- och slutdatum.");
          return false;
        }

        const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
          aStart <= bEnd && bStart <= aEnd;

        const activityStartISO = (a: any): string => {
          const s = String(a?.exactStartISO || "");
          if (params.isValidISO(s)) return s;
          const sh = params.slotToYearMonthHalf(params.startYear, a.startSlot);
          return params.dateToISO(params.mondayNearestTo(sh.year, sh.month0, sh.half === 0 ? 1 : 15));
        };

        const activityEndISO = (a: any): string => {
          const e = String(a?.exactEndISO || "");
          if (params.isValidISO(e)) return e;
          const eSlot = a.startSlot + a.lengthSlots - 1;
          const eh = params.slotToYearMonthHalf(params.startYear, eSlot);
          const d = params.sundayBeforeAnchor(
            eh.year + (eh.half === 1 && eh.month0 === 11 ? 1 : (eh.month0 + (eh.half === 1 ? 1 : 0) > 11 ? 1 : 0)),
            (eh.month0 + (eh.half === 1 ? 1 : 0) + 12) % 12,
            eh.half === 0 ? 15 : 1
          );
          return params.dateToISO(d);
        };

        const hasOverlap = params.activities.some((a) => {
          if (!a || a.id === selAct.id) return false;
          const os = activityStartISO(a);
          const oe = activityEndISO(a);
          if (!params.isValidISO(os) || !params.isValidISO(oe)) return false;
          return rangesOverlap(startISO, endISO, os, oe);
        });
        if (hasOverlap) {
          params.setOverlapWarning(
            "Datumen överlappar en annan aktivitet i tidslinjen. Justera start/slut så att aktiviteterna inte överlappar."
          );
          return false;
        }

        const record: any = {
          type: selAct.type,
          clinic: selAct.type === "Annan ledighet" ? undefined : (selAct.label || ""),
          title: selAct.type === "Annan ledighet" ? (selAct.leaveSubtype || "") : (selAct.label || ""),
          leaveSubtype: selAct.type === "Annan ledighet" ? (selAct.leaveSubtype || "") : "",
          startDate: startISO,
          endDate: endISO,
          attendance: selAct.attendance ?? 100,
          phase:
            (selAct as any)?.phase ||
            (params.isPlacementInBtWindow(
              selAct,
              params.getEffectiveBtWindow(params.profile || {}, {
                isValidISO: params.isValidISO,
                isoToDateSafe: params.isoToDateSafe,
                dateToISO: params.dateToISO,
                addMonths: params.addMonths,
              }),
              params.startYear,
              params.dateToSlot
            )
              ? "BT"
              : "ST"),
          supervisor: selAct.supervisor || "",
          supervisorSpeciality: selAct.supervisorSpeciality || "",
          supervisorSite: selAct.supervisorSite || "",
          btAssessment: (selAct as any)?.btAssessment || "",
          note: selAct.note || "",
          showOnTimeline: true,
          btMilestones: ((selAct as any)?.btMilestones || []),
          milestones: params.sanitizeStMilestonesForGoals(((selAct as any)?.milestones || []), (params.profile as any)?.goalsVersion),
          fulfillsStGoals: !!(selAct as any)?.fulfillsStGoals,
          intygGroup: Number.isFinite(Number((selAct as any)?.intygGroup))
            ? Number((selAct as any).intygGroup)
            : null,
          intygGroupConfig: (selAct as any)?.intygGroupConfig ?? null,
        };

        const supabaseRecord = params.buildPlacementSupabaseRecord(
          { ...record, milestones: params.sanitizeStMilestonesForGoals(record.milestones, (params.profile as any)?.goalsVersion) },
          String(params.authUserId || "")
        );

        const userId = await params.ensureUserId({
          authUserId: params.authUserId,
          getSessionUser: params.getSessionUser,
          onResolvedUser: (user: any) => {
            if (user?.id) params.setAuthUser(user as any);
          },
        });
        supabaseRecord.user_id = userId;

        const saveStart = params.perfMark("pussla.savePlacementToDb");
        const placementSaveResult = await params.saveEntityRow({
          supabase: params.supabase as any,
          table: "placements",
          linkedId: selAct.linkedPlacementId,
          payload: supabaseRecord,
        });
        const newId = placementSaveResult.id;
        const savedPlacement = placementSaveResult.data;
        if (placementSaveResult.created) {
          const newIdAny = newId as any;
          params.setActivities((prev: any[]) =>
            prev.map((a) => (a.id === selAct.id ? { ...a, linkedPlacementId: newIdAny } : a))
          );
        }

        if (savedPlacement) {
          const mapped = params.mapPlacementRowForList(savedPlacement);
          params.setListPlac((prev: any[]) =>
            params.upsertById(prev as any[], mapped as any).sort((a: any, b: any) =>
              String(a.startDate || "").localeCompare(String(b.startDate || ""))
            )
          );
          params.setDbPlacements((prev: any[]) =>
            params.upsertById(prev as any[], params.mapPlacementRowForDb(savedPlacement) as any)
          );
        }
        params.perfMeasure("pussla.savePlacementToDb", saveStart, { created: !newId });

        params.baselineRef.current = { placement: structuredClone(selAct) };
        params.setDirty(false);
        void params.logAudit(
          newId ? "update" : "create",
          "placements",
          `${selAct.type || "Aktivitet"}: ${selAct.label || ""} (${startISO} – ${endISO})`,
          newId || selAct.id
        );
        return true;
      } catch (e) {
        console.error(e);
        alert("Kunde inte spara till databasen.");
        return false;
      }
    },
    [params]
  );

  const saveCourseToDb = useCallback(
    async (selCourse: any): Promise<boolean> => {
      if (!selCourse) return false;
      try {
        const start = selCourse.startDate || selCourse.endDate || selCourse.certificateDate || "";
        const end = selCourse.endDate || selCourse.startDate || selCourse.certificateDate || "";
        const cert = selCourse.certificateDate || selCourse.endDate || selCourse.startDate || "";

        const record: any = {
          title: selCourse.title || "Kurs",
          kind: selCourse.kind || "Kurs",
          city: selCourse.city || "",
          courseLeaderName: selCourse.courseLeaderName || "",
          startDate: start || "",
          endDate: end || "",
          certificateDate: cert || "",
          note: selCourse.note || "",
          courseTitle: (selCourse as any)?.courseTitle || undefined,
          showOnTimeline: true,
          milestones: ((selCourse as any)?.milestones || []) as string[],
          btMilestones: ((selCourse as any)?.btMilestones || []) as string[],
          fulfillsStGoals: !!(selCourse as any)?.fulfillsStGoals,
          phase:
            (selCourse as any)?.phase ||
            (params.isIsoInBtWindow(
              selCourse.startDate || selCourse.endDate || "",
              params.getEffectiveBtWindow(params.profile || {}, {
                isValidISO: params.isValidISO,
                isoToDateSafe: params.isoToDateSafe,
                dateToISO: params.dateToISO,
                addMonths: params.addMonths,
              }),
              params.isValidISO
            )
              ? "BT"
              : "ST"),
          btAssessment: (selCourse as any)?.btAssessment || "",
          ...(typeof (selCourse as any)?.showAsInterval === "boolean"
            ? { showAsInterval: !!(selCourse as any).showAsInterval }
            : {}),
        };

        const supabaseRecord = params.buildCourseSupabaseRecord(record, String(params.authUserId || ""));
        const userId = await params.ensureUserId({
          authUserId: params.authUserId,
          getSessionUser: params.getSessionUser,
          onResolvedUser: (user: any) => {
            if (user?.id) params.setAuthUser(user as any);
          },
        });
        supabaseRecord.user_id = userId;

        const saveStart = params.perfMark("pussla.saveCourseToDb");
        const courseSaveResult = await params.saveEntityRow({
          supabase: params.supabase as any,
          table: "courses",
          linkedId: selCourse.linkedCourseId,
          payload: supabaseRecord,
        });
        const newId = courseSaveResult.id;
        const savedCourse = courseSaveResult.data;
        if (courseSaveResult.created) {
          const newIdAny = newId as any;
          params.setCourses((prev: any[]) =>
            prev.map((c) => (c.id === selCourse.id ? { ...c, linkedCourseId: newIdAny } : c))
          );
        }

        if (savedCourse) {
          const mapped = params.mapCourseRowForList(savedCourse);
          params.setListCourses((prev: any[]) =>
            params.upsertById(prev as any[], mapped as any).sort((a: any, b: any) =>
              String(a.certificateDate || "").localeCompare(String(b.certificateDate || ""))
            )
          );
          params.setDbCourses((prev: any[]) =>
            params.upsertById(prev as any[], params.mapCourseRowForDb(savedCourse) as any)
          );
        }
        params.perfMeasure("pussla.saveCourseToDb", saveStart, { created: !newId });
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("stark:reload-courses"));

        params.baselineRef.current = { course: structuredClone(selCourse) };
        params.setDirty(false);
        void params.logAudit(
          newId ? "update" : "create",
          "courses",
          `Kurs: ${selCourse.title || ""} (${cert})`,
          newId || selCourse.id
        );
        return true;
      } catch (e) {
        console.error(e);
        alert("Kunde inte spara kursen till databasen.");
        return false;
      }
    },
    [params]
  );

  const handleAutosave = useCallback(() => {
    if (params.selectedPlacement) {
      const s = String((params.selectedPlacement as any)?.exactStartISO || "").trim();
      const e = String((params.selectedPlacement as any)?.exactEndISO || "").trim();
      if (!params.isValidISO(s) || !params.isValidISO(e)) return;
      void savePlacementToDb(params.selectedPlacement);
      return;
    }
    if (params.selectedCourse) {
      const start = String((params.selectedCourse as any)?.startDate || "").trim();
      const end = String((params.selectedCourse as any)?.endDate || "").trim();
      const cert = String((params.selectedCourse as any)?.certificateDate || "").trim();
      const hasAnyValidDate = [start, end, cert].some((d) => params.isValidISO(d));
      if (!hasAnyValidDate) return;
      void saveCourseToDb(params.selectedCourse);
    }
  }, [params, savePlacementToDb, saveCourseToDb]);

  return { savePlacementToDb, saveCourseToDb, handleAutosave };
}

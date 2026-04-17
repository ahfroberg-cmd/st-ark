"use client";

import { useCallback } from "react";
import { patchEntityById } from "@/lib/pussla/entityPatches";
import { appendDescription, mergeMilestones, replaceMilestones } from "@/lib/pussla/colleagueCopy";
import { triggerTimedFlag } from "@/lib/pussla/uiFeedback";

export function useColleagueCopyWorkspace(params: any) {
  const normalizeClinicRole = useCallback(
    (role: unknown): "st_lakare" | "huvudhandledare" | "studierektor" | "" => {
      const r = String(role || "").trim().toLowerCase();
      if (r === "st_lakare" || r === "st") return "st_lakare";
      if (r === "huvudhandledare" || r === "supervisor" || r === "handledare")
        return "huvudhandledare";
      if (r === "studierektor" || r === "study_director" || r === "studierektor_admin")
        return "studierektor";
      return "";
    },
    []
  );

  const colleagueFormatDate = useCallback((dateISO?: string | null) => {
    if (!dateISO) return "—";
    const d = new Date(dateISO);
    return Number.isNaN(d.getTime()) ? String(dateISO) : d.toLocaleDateString("sv-SE");
  }, []);

  const colleagueCalculateMonths = useCallback(
    (startDate?: string, endDate?: string, attendance: number = 100) => {
      if (!startDate || !endDate) return 0;
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
        return Math.round(months * (attendance / 100) * 10) / 10;
      } catch {
        return 0;
      }
    },
    []
  );

  const colleagueBirthDate = useCallback((personalNumber?: string | null) => {
    const pnr = String(personalNumber || "").trim();
    if (!pnr) return "—";
    return pnr.replace(/[-+]?\d{4}$/, "") || "—";
  }, []);

  const normalizePlacementName = useCallback((value?: string | null) => {
    return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("sv-SE");
  }, []);

  const colleagueActivityKind = useCallback(
    (item: any): "placement" | "course" | "utbildningsmoment" => {
      if (item?.kind === "Utbildningsmoment") return "utbildningsmoment";
      if (item?.kind || item?.certificateDate || item?.courseLeader || item?.courseLeaderName || item?.organizer) {
        return "course";
      }
      return "placement";
    },
    []
  );

  const handleApplyColleagueMilestones = useCallback(
    (target: any, mode: "append" | "replace") => {
      if (!target) return;
      const colleagueMilestones = (params.colleagueActivityDetail?.milestones || []) as string[];
      const nextMilestones =
        mode === "append"
          ? mergeMilestones((target.milestones || []) as string[], colleagueMilestones)
          : replaceMilestones(colleagueMilestones);

      if (target.kind) {
        params.setCourses((prev: any[]) =>
          patchEntityById(prev as any[], target.id, { milestones: nextMilestones } as any)
        );
      } else {
        params.setActivities((prev: any[]) =>
          patchEntityById(prev as any[], target.id, { milestones: nextMilestones } as any)
        );
      }
      params.setColleagueMilestoneCopyDialog({ show: false, type: null });
      triggerTimedFlag(params.setColleagueCopiedToast, 1500);
    },
    [params]
  );

  const handleApplyColleagueDescription = useCallback(
    (target: any, mode: "append" | "replace") => {
      if (!target) return;
      const description = String(params.colleagueActivityDetail?.note || params.colleagueActivityDetail?.notes || "");
      if (!description) return;
      const nextDescription =
        mode === "append" ? appendDescription(String(target.note || ""), description) : description;

      if (target.kind) {
        params.setCourses((prev: any[]) =>
          patchEntityById(prev as any[], target.id, { note: nextDescription } as any)
        );
      } else {
        params.setActivities((prev: any[]) =>
          patchEntityById(prev as any[], target.id, { note: nextDescription } as any)
        );
      }
      params.setColleagueDescCopyDialog({ show: false, type: null });
      triggerTimedFlag(params.setColleagueCopiedToast, 1500);
    },
    [params]
  );

  const handleRequestCopyColleagueMilestones = useCallback(
    (sourceDetail: any) => {
      const colleagueGoalsVersion = String(params.colleagueData?.profile?.goalsVersion || "2021");
      const myGoalsVersion = String(params.profile?.goalsVersion || "2021");
      if (colleagueGoalsVersion !== myGoalsVersion) {
        params.setColleagueWarningDialog({
          show: true,
          message: `Kan inte kopiera delmal. ST-kollegan har malversion ${colleagueGoalsVersion} och du har ${myGoalsVersion}.`,
        });
        return;
      }

      const sourceKind = colleagueActivityKind(sourceDetail);
      const sourceName = normalizePlacementName(
        sourceKind === "placement"
          ? (sourceDetail.clinic || sourceDetail.label || sourceDetail.title || "")
          : (sourceDetail.title || sourceDetail.clinic || "")
      );

      const matchingTarget =
        sourceKind === "placement"
          ? params.activities.find(
              (activity: any) =>
                activity.type === "Klinisk tjänstgöring" &&
                normalizePlacementName(
                  (activity as any).label || (activity as any).clinic || (activity as any).title || ""
                ) === sourceName
            ) || null
          : sourceKind === "utbildningsmoment"
          ? params.courses.find(
              (course: any) =>
                course.kind === "Utbildningsmoment" &&
                normalizePlacementName(
                  course.title === "Annan" ? ((course as any).courseTitle || "") : (course.title || "")
                ) === sourceName
            ) || null
          : params.courses.find(
              (course: any) =>
                course.kind !== "Utbildningsmoment" &&
                normalizePlacementName(
                  course.title === "Annan" ? ((course as any).courseTitle || "") : (course.title || "")
                ) === sourceName
            ) || null;

      if (matchingTarget) {
        params.setColleagueMilestoneCopyDialog({ show: true, type: "confirm", selectedPlacement: matchingTarget });
        return;
      }

      const allTargets: any[] =
        sourceKind === "placement"
          ? params.activities.filter((activity: any) => activity.type === "Klinisk tjänstgöring")
          : sourceKind === "utbildningsmoment"
          ? params.courses.filter((course: any) => course.kind === "Utbildningsmoment")
          : params.courses.filter((course: any) => course.kind !== "Utbildningsmoment");
      if (allTargets.length === 0) {
        params.setColleagueWarningDialog({
          show: true,
          message: "Du har inga registrerade aktiviteter att kopiera till.",
        });
        return;
      }
      params.setColleagueMilestoneCopyDialog({ show: true, type: "ask", placements: allTargets });
    },
    [params, colleagueActivityKind, normalizePlacementName]
  );

  const handleRequestCopyColleagueDescription = useCallback(
    (sourceDetail: any) => {
      const description = String(sourceDetail.note || sourceDetail.notes || "");
      if (!description) return;

      const sourceKind = colleagueActivityKind(sourceDetail);
      const sourceName = normalizePlacementName(
        sourceKind === "placement"
          ? (sourceDetail.clinic || sourceDetail.label || sourceDetail.title || "")
          : (sourceDetail.title || sourceDetail.clinic || "")
      );
      const matchingTarget =
        sourceKind === "placement"
          ? params.activities.find(
              (activity: any) =>
                activity.type === "Klinisk tjänstgöring" &&
                normalizePlacementName(
                  (activity as any).label || (activity as any).clinic || (activity as any).title || ""
                ) === sourceName
            ) || null
          : sourceKind === "utbildningsmoment"
          ? params.courses.find(
              (course: any) =>
                course.kind === "Utbildningsmoment" &&
                normalizePlacementName(
                  course.title === "Annan" ? ((course as any).courseTitle || "") : (course.title || "")
                ) === sourceName
            ) || null
          : params.courses.find(
              (course: any) =>
                course.kind !== "Utbildningsmoment" &&
                normalizePlacementName(
                  course.title === "Annan" ? ((course as any).courseTitle || "") : (course.title || "")
                ) === sourceName
            ) || null;

      if (matchingTarget) {
        params.setColleagueDescCopyDialog({ show: true, type: "confirm", selectedPlacement: matchingTarget });
        return;
      }

      const allTargets: any[] =
        sourceKind === "placement"
          ? params.activities.filter((activity: any) => activity.type === "Klinisk tjänstgöring")
          : sourceKind === "utbildningsmoment"
          ? params.courses.filter((course: any) => course.kind === "Utbildningsmoment")
          : params.courses.filter((course: any) => course.kind !== "Utbildningsmoment");
      if (allTargets.length === 0) {
        params.setColleagueWarningDialog({
          show: true,
          message: "Du har inga registrerade aktiviteter att kopiera till.",
        });
        return;
      }
      params.setColleagueDescCopyDialog({ show: true, type: "ask", placements: allTargets });
    },
    [params, colleagueActivityKind, normalizePlacementName]
  );

  return {
    normalizeClinicRole,
    colleagueFormatDate,
    colleagueCalculateMonths,
    colleagueBirthDate,
    colleagueActivityKind,
    handleApplyColleagueMilestones,
    handleApplyColleagueDescription,
    handleRequestCopyColleagueMilestones,
    handleRequestCopyColleagueDescription,
  };
}

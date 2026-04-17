"use client";

import { exportCertificate } from "@/lib/exporters";
import {
  buildGroupedPlacementExport,
  buildGroupedPlacementExportFromState,
  type ActivityLike,
  type IntygGroupConfig,
} from "@/lib/pussla/intygGroupHelpers";

function normalizeGoalsVersion(v: any): "2015" | "2021" {
  return String(v || "").trim() === "2015" ? "2015" : "2021";
}

function toMilestoneIds(xs: any) {
  return Array.isArray(xs)
    ? xs.map((m: any) => String(m).trim().split(/\s|–|-|:|\u2013/)[0])
    : [];
}

function resolvePlacementActivityType(type: string): "AUSKULTATION" | "KVALITETSARBETE" | "SKRIFTLIGT_ARBETE" | "PLACERING" {
  if (type === "Auskultation") return "AUSKULTATION";
  if (type === "Förbättringsarbete") return "KVALITETSARBETE";
  if (type === "Vetenskapligt arbete") return "SKRIFTLIGT_ARBETE";
  return "PLACERING";
}

export async function buildPlacementPreviewBlob(params: {
  profile: any;
  placement: any;
  activities: any[];
  isZeroAttendanceType: (type: string) => boolean;
}): Promise<Blob> {
  const { profile, placement, activities, isZeroAttendanceType } = params;
  const gv = normalizeGoalsVersion(profile?.goalsVersion);
  const activityType = resolvePlacementActivityType(String(placement?.type || ""));
  const { act, milestones } = buildGroupedPlacementExport(placement, activities, { isZeroAttendanceType });
  const result = await exportCertificate(
    {
      goalsVersion: gv,
      activityType,
      profile,
      activity: act as any,
      milestones: toMilestoneIds(milestones),
    },
    { output: "blob", filename: "preview.pdf" }
  );
  if (!(result instanceof Blob)) {
    throw new Error("Felaktigt returvärde från exportCertificate.");
  }
  return result;
}

export async function buildGroupedPlacementPreviewBlob(params: {
  profile: any;
  grouped: ActivityLike[];
  config: IntygGroupConfig | null;
  groupNum: number | null;
  selectedPlacementId: string | null;
  isZeroAttendanceType: (type: string) => boolean;
}): Promise<Blob> {
  const { profile, grouped, config, groupNum, selectedPlacementId, isZeroAttendanceType } = params;
  const clicked = (grouped.find((x) => x.id === selectedPlacementId) || grouped[0]) as any;
  if (!clicked) throw new Error("Ingen aktivitet vald i gruppen.");

  const gv = normalizeGoalsVersion(profile?.goalsVersion);
  const activityType = resolvePlacementActivityType(String(clicked?.type || ""));
  const { act, milestones } = buildGroupedPlacementExportFromState(grouped, clicked, config, groupNum, {
    isZeroAttendanceType,
  });
  const result = await exportCertificate(
    {
      goalsVersion: gv,
      activityType,
      profile,
      activity: act as any,
      milestones: toMilestoneIds(milestones),
    },
    { output: "blob", filename: "preview.pdf" }
  );
  if (!(result instanceof Blob)) {
    throw new Error("Felaktigt returvärde från exportCertificate.");
  }
  return result;
}

export async function buildBtGoalsPreviewBlob(params: {
  profile: any;
  placement: any;
}): Promise<Blob> {
  const { profile, placement } = params;
  const act: any = {
    title: placement.label || placement.type || "",
    clinic: placement.label || "",
    site: placement.site || placement.clinic || "",
    startDate: placement.exactStartISO || placement.startDate || "",
    endDate: placement.exactEndISO || placement.endDate || placement.startDate || "",
    activities: [
      {
        text: placement.label || placement.type || "",
        startDate: placement.exactStartISO || placement.startDate || null,
        endDate: placement.exactEndISO || placement.endDate || placement.startDate || null,
        source: "registered",
        refId: placement.linkedPlacementId || placement.id || null,
        milestones: Array.isArray(placement.btMilestones) ? placement.btMilestones : [],
      },
    ],
    supervisor: placement.supervisor || "",
    supervisorName: placement.supervisor || "",
    supervisorSpeciality: placement.supervisorSpeciality || "",
    supervisorSpecialty: placement.supervisorSpeciality || "",
    supervisorSpec: placement.supervisorSpeciality || "",
    supervisorSite: placement.supervisorSite || "",
    notes: placement.note || "",
    btAssessment: placement.btAssessment || "",
  };

  const btIds = toMilestoneIds(placement.btMilestones);
  const profileForBt: any = {
    ...(profile || {}),
    supervisor: act.supervisor || profile?.supervisor || "",
    supervisorName: act.supervisor || profile?.supervisorName || "",
    supervisorSite: act.supervisorSite || profile?.supervisorSite || "",
    supervisorSpeciality:
      act.supervisorSpeciality || profile?.supervisorSpeciality || profile?.supervisorSpecialty || profile?.supervisorSpec || "",
    supervisorSpecialty:
      act.supervisorSpeciality || profile?.supervisorSpecialty || profile?.supervisorSpeciality || profile?.supervisorSpec || "",
    supervisorSpec:
      act.supervisorSpeciality || profile?.supervisorSpec || profile?.supervisorSpeciality || profile?.supervisorSpecialty || "",
  };

  (globalThis as any).supervisorName = profileForBt.supervisorName;
  (globalThis as any).supervisorSite = profileForBt.supervisorSite;
  (globalThis as any).supervisorSpeciality = profileForBt.supervisorSpeciality;
  (globalThis as any).supervisorSpecialty = profileForBt.supervisorSpecialty;
  (globalThis as any).supervisorSpec = profileForBt.supervisorSpec;

  const result = await exportCertificate(
    {
      goalsVersion: "2021",
      activityType: "BT_GOALS",
      profile: profileForBt,
      activity: act,
      milestones: btIds,
    },
    { output: "blob", filename: "delmal-i-bt-preview.pdf" }
  );
  if (!(result instanceof Blob)) throw new Error("Felaktigt returvärde från exportCertificate.");
  return result;
}

export async function buildCoursePreviewBlob(params: {
  profile: any;
  course: any;
  displayTitle: string;
}): Promise<Blob> {
  const { profile, course, displayTitle } = params;
  const act: any = {
    title: displayTitle,
    site: course.site || "",
    clinic: course.site || "",
    startDate: course.startDate || course.endDate || course.certificateDate,
    endDate: course.endDate || course.startDate || course.certificateDate,
    courseLeaderName: course.courseLeaderName || "",
    courseLeaderSite: course.courseLeaderSite || "",
    courseLeaderSpeciality: course.courseLeaderSpeciality || "",
    notes: course.note || "",
    signer: undefined,
  };

  const result = await exportCertificate(
    {
      goalsVersion: normalizeGoalsVersion(profile?.goalsVersion),
      activityType: "KURS",
      profile,
      activity: act,
      milestones: toMilestoneIds(course.milestones),
    },
    { output: "blob", filename: "preview.pdf" }
  );
  if (!(result instanceof Blob)) throw new Error("Felaktigt returvärde från exportCertificate.");
  return result;
}

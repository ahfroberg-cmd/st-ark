"use client";

type Chip = { id: string; label: string };
type BtActivity = {
  id: string;
  text: string;
  startISO: string | null;
  endISO: string | null;
  source?: "manual" | "registered";
  refId?: string;
};

export function normalizeGoalsVersion(v: any): "2015" | "2021" {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("2015")) return "2015";
  if (s.includes("2021")) return "2021";
  return "2021";
}

export function toMilestoneIds(chips: Chip[]) {
  return Array.isArray(chips)
    ? chips.map((c) => String(c.id).trim().split(/\s|–|-|:|\u2013/)[0])
    : [];
}

export async function buildBtGoalsPreviewBlob(args: {
  profile: any;
  btGoals: Chip[];
  btActivities: BtActivity[];
  btPlacements: any[];
  controlHow: string;
  mainSupervisorPrints: boolean;
  issuingSupervisor: { name: string; specialty: string; workplace: string };
  extractPlacementGoals: (pl: any) => string[];
}): Promise<Blob> {
  const {
    profile,
    btGoals,
    btActivities,
    btPlacements,
    controlHow,
    mainSupervisorPrints,
    issuingSupervisor,
    extractPlacementGoals,
  } = args;
  const { exportCertificate } = await import("@/lib/exporters");
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);

  const placementById = new Map<string, any>(
    (btPlacements || []).map((pl: any) => [String(pl?.id ?? ""), pl])
  );
  const isCourseLike = (x: any) =>
    Boolean((x as any)?.certificateDate || (x as any)?.courseLeaderName || (x as any)?.city);

  const activity: any = {
    goals: toMilestoneIds(btGoals),
    activities: btActivities.map((a) => ({
      text: a.text || "",
      startDate: a.startISO || null,
      endDate: a.endISO || null,
      source: a.source || "manual",
      refId: a.refId || null,
      kind:
        a.source === "registered" && a.refId
          ? isCourseLike(placementById.get(String(a.refId)) || null)
            ? "course"
            : "placement"
          : "unknown",
      milestones:
        a.source === "registered" && a.refId
          ? extractPlacementGoals(placementById.get(String(a.refId)) || null)
          : [],
    })),
    controlHow: String(controlHow || "").trim() || "",
    useOtherSigner: mainSupervisorPrints,
    signer: mainSupervisorPrints
      ? {
          name: issuingSupervisor?.name || "",
          specialty: issuingSupervisor?.specialty || "",
          workplace: issuingSupervisor?.workplace || "",
          useOther: true,
        }
      : {
          name: (profile as any)?.supervisor || "",
          specialty: (profile as any)?.specialty || (profile as any)?.speciality || "",
          workplace: (profile as any)?.supervisorWorkplace || (profile as any)?.homeClinic || "",
          useOther: false,
        },
  };

  return (await exportCertificate(
    {
      goalsVersion: gv,
      activityType: "BT_GOALS",
      profile: profile as any,
      activity,
      milestones: toMilestoneIds(btGoals),
    },
    { output: "blob", filename: "bt-delmal-preview.pdf" }
  )) as Blob;
}

export async function buildBtFullPreviewBlob(args: {
  profile: any;
  btRows: any[];
  otherThanManager: boolean;
  appointedSigner: { name: string; workplace: string };
}): Promise<Blob> {
  const { profile, btRows, otherThanManager, appointedSigner } = args;
  const { exportCertificate } = await import("@/lib/exporters");
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);

  const activity: any = {
    rows: btRows.map((r: any) => ({
      id: r.id,
      clinic: (r.ref as any)?.clinic || (r.ref as any)?.note || "",
      startDate: (r.ref as any)?.startDate || "",
      endDate: (r.ref as any)?.endDate || (r.ref as any)?.startDate || "",
      percent: r.percent,
      monthsFte: r.monthsFte,
      primaryCare: !!r.primaryCare,
      acuteCare: !!r.acuteCare,
    })),
    signer: otherThanManager
      ? {
          role: "appointed",
          name: appointedSigner.name || "",
          workplace: appointedSigner.workplace || "",
        }
      : {
          role: "manager",
          name: (profile as any)?.managerName || "",
          workplace: (profile as any)?.homeClinic || "",
        },
  };

  return (await exportCertificate(
    {
      goalsVersion: gv,
      activityType: "BT_FULLGJORD",
      profile: profile as any,
      activity,
    },
    { output: "blob", filename: "bt-fullgjord-preview.pdf" }
  )) as Blob;
}

export async function buildBtCompetencePreviewBlob(args: {
  profile: any;
  resolvedMainSupervisor: { name: string; specialty: string; workplace: string };
}): Promise<Blob> {
  const { profile, resolvedMainSupervisor } = args;
  const { exportCertificate } = await import("@/lib/exporters");
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);

  const activity: any = {
    externAssessor: {
      name: (profile as any)?.btExtAssessorName || "",
      specialty: (profile as any)?.btExtAssessorSpec || "",
      workplace: (profile as any)?.btExtAssessorWorkplace || "",
    },
    mainSupervisor: {
      name: resolvedMainSupervisor.name || (profile as any)?.mainSupervisorName || "",
      specialty: resolvedMainSupervisor.specialty || (profile as any)?.mainSupervisorSpec || "",
      workplace:
        resolvedMainSupervisor.workplace ||
        (profile as any)?.mainSupervisorWorkplace ||
        (profile as any)?.homeClinic ||
        "",
    },
  };

  return (await exportCertificate(
    {
      goalsVersion: gv,
      activityType: "BT_KOMPETENS",
      profile: profile as any,
      activity,
    },
    { output: "blob", filename: "bt-uppnadd-baskompetens-preview.pdf" }
  )) as Blob;
}

export async function buildBtApplicationPreviewBlob(args: {
  profile: any;
  attachments: string[];
}): Promise<Blob> {
  const { profile, attachments } = args;
  const { exportCertificate } = await import("@/lib/exporters");
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);

  const collapseRanges = (nums: number[]) => {
    const arr = Array.from(new Set(nums.filter((n) => Number.isFinite(n)).map((n) => Math.trunc(n)))).sort(
      (a, b) => a - b
    );
    if (arr.length === 0) return "";
    const pieces: string[] = [];
    let start = arr[0];
    let prev = arr[0];
    for (let i = 1; i < arr.length; i++) {
      const n = arr[i];
      if (n === prev + 1) {
        prev = n;
        continue;
      }
      pieces.push(start === prev ? String(start) : `${start}-${prev}`);
      start = prev = n;
    }
    pieces.push(start === prev ? String(start) : `${start}-${prev}`);
    return pieces.join(", ");
  };

  const prefixSavedBt = "Delmål i bastjänstgöringen: Intyg delmål i BT ";
  const isSavedBtCert = (x: string) => x.startsWith(prefixSavedBt);
  const isFullgjord = (x: string) => x === "Fullgjord bastjänstgöring";
  const isBaskomp = (x: string) => x === "Uppnådd baskompetens";
  const isPrelicense = (x: string) =>
    x.startsWith("Tjänstgöring före legitimation:") || /^Intyg tjänstgöring före legitimation\b/.test(x);
  const isForeign = (x: string) => x.startsWith("Utländsk tjänstgöring:");

  const numbered = attachments.map((label, idx) => ({ no: idx + 1, label }));
  const attachmentsSummary = {
    delmalLine: collapseRanges(numbered.filter((x) => isSavedBtCert(x.label)).map((x) => x.no)),
    fullgjordLine: collapseRanges(numbered.filter((x) => isFullgjord(x.label)).map((x) => x.no)),
    baskompetensLine: collapseRanges(numbered.filter((x) => isBaskomp(x.label)).map((x) => x.no)),
    prelicenseLine: collapseRanges(numbered.filter((x) => isPrelicense(x.label)).map((x) => x.no)),
    foreignLine: collapseRanges(numbered.filter((x) => isForeign(x.label)).map((x) => x.no)),
  };

  const primaryLicense = {
    country: String((profile as any)?.licenseCountry ?? ""),
    date: String((profile as any)?.licenseDate ?? ""),
  };
  const extraForeign = Array.isArray((profile as any)?.foreignLicenses)
    ? ((profile as any).foreignLicenses as any[]).slice(0, 2).map((r) => ({
        country: String(r?.country ?? ""),
        date: String(r?.date ?? ""),
      }))
    : [];
  const foreignLicenses = [primaryLicense, ...extraForeign].filter((r) => r.country || r.date).slice(0, 3);

  const derivedLicenseCountry =
    String((profile as any)?.licenseCountry || "") || String((profile as any)?.medDegreeCountry || "");

  const activity: any = {
    applicant: {
      name: (profile as any)?.name || "",
      personalNumber: (profile as any)?.personalNumber || "",
      address: (profile as any)?.address || "",
      postalCode: (profile as any)?.postalCode || "",
      city: (profile as any)?.city || "",
      mobile: (profile as any)?.mobile || "",
      phoneHome: (profile as any)?.phoneHome || "",
      phoneWork: (profile as any)?.phoneWork || "",
      email: String((profile as any)?.email || ""),
      workplace: String((profile as any)?.homeClinic || ""),
      medDegreeCountry: (profile as any)?.medDegreeCountry || "",
      medDegreeDate: (profile as any)?.medDegreeDate || "",
      licenseCountry: derivedLicenseCountry,
      licenseDate: String((profile as any)?.licenseDate || ""),
      foreignLicenses,
    },
    attachments: attachments.slice(),
    attachmentsSummary,
  };

  return (await exportCertificate(
    {
      goalsVersion: gv,
      activityType: "BT_ANSOKAN",
      profile: profile as any,
      activity,
    },
    { output: "blob", filename: "bt-ansokan-preview.pdf" }
  )) as Blob;
}

export async function buildPlacementPreviewBlob(args: {
  profile: any;
  placement: any;
  extractPlacementGoals: (pl: any) => string[];
}): Promise<Blob> {
  const { profile, placement, extractPlacementGoals } = args;
  const { exportCertificate } = await import("@/lib/exporters");
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);

  const oneActivity = {
    text: (placement as any).clinic || (placement as any).note || "Klinisk tjänstgöring",
    startDate: (placement as any).startDate || null,
    endDate: (placement as any).endDate || (placement as any).startDate || null,
    source: "registered",
    refId: (placement as any).id || null,
  };

  const goalsForThis = extractPlacementGoals(placement).map((g) => String(g));

  const activityPayload: any = {
    goals: goalsForThis,
    activities: [oneActivity],
    controlHow: "",
    useOtherSigner: false,
    signer: {
      name: (profile as any)?.supervisor || "",
      specialty: (profile as any)?.specialty || (profile as any)?.speciality || "",
      workplace: (profile as any)?.supervisorWorkplace || (profile as any)?.homeClinic || "",
      useOther: false,
    },
  };

  return (await exportCertificate(
    {
      goalsVersion: gv,
      activityType: "BT_GOALS",
      profile: profile as any,
      activity: activityPayload,
      milestones: goalsForThis,
    },
    { output: "blob", filename: "bt-delmal-preview.pdf" }
  )) as Blob;
}

export async function buildSavedBtPreviewBlob(args: {
  profile: any;
  saved: {
    goals: Chip[];
    activities: BtActivity[];
    controlHow: string;
    signer?: { useOther?: boolean; name?: string; specialty?: string; workplace?: string };
  };
}): Promise<Blob> {
  const { profile, saved } = args;
  const { exportCertificate } = await import("@/lib/exporters");
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);

  const activity: any = {
    goals: toMilestoneIds(saved.goals),
    activities: saved.activities.map((a) => ({
      text: a.text || "",
      startDate: a.startISO || null,
      endDate: a.endISO || null,
      source: a.source || "manual",
      refId: a.refId || null,
    })),
    controlHow: String(saved.controlHow || ""),
    useOtherSigner: !!saved.signer?.useOther,
    signer: saved.signer?.useOther
      ? {
          name: saved.signer?.name || "",
          specialty: saved.signer?.specialty || "",
          workplace: saved.signer?.workplace || "",
          useOther: true,
        }
      : {
          name: (profile as any)?.supervisor || "",
          specialty: (profile as any)?.specialty || (profile as any)?.speciality || "",
          workplace: (profile as any)?.supervisorWorkplace || (profile as any)?.homeClinic || "",
          useOther: false,
        },
  };

  return (await exportCertificate(
    {
      goalsVersion: gv,
      activityType: "BT_GOALS",
      profile: profile as any,
      activity,
      milestones: toMilestoneIds(saved.goals),
    },
    { output: "blob", filename: "bt-delmal-preview.pdf" }
  )) as Blob;
}

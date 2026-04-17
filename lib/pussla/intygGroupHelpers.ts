/**
 * Intygsgrupp: sammanslagning av placeringar som delar samma intyg.
 */

export type IntygGroupConfig = {
  title?: string | null;
  certSupervisor?: string | null;
  certSpecialty?: string | null;
  certSite?: string | null;
  /** Redigerad sammanslagen beskrivning för intyget; om saknas beräknas från placeringarna. */
  mergedDescription?: string | null;
};

export type ActivityLike = {
  id: string;
  type?: string;
  label?: string;
  exactStartISO?: string;
  exactEndISO?: string;
  supervisor?: string;
  supervisorSpeciality?: string;
  supervisorSite?: string;
  note?: string;
  milestones?: string[];
  intygGroup?: number | null;
  intygGroupConfig?: IntygGroupConfig | null;
};

export function parseIntygGroupConfig(raw: unknown): IntygGroupConfig | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const base: IntygGroupConfig = {
    title: o.title != null ? String(o.title) : null,
    certSupervisor: o.certSupervisor != null ? String(o.certSupervisor) : null,
    certSpecialty: o.certSpecialty != null ? String(o.certSpecialty) : null,
    certSite: o.certSite != null ? String(o.certSite) : null,
  };
  if ("mergedDescription" in o) {
    base.mergedDescription =
      o.mergedDescription === null || o.mergedDescription === undefined
        ? ""
        : String(o.mergedDescription);
  }
  return base;
}

export function getIntygGroupNumber(a: ActivityLike | null | undefined): number | null {
  const g = Number((a as any)?.intygGroup ?? 0);
  if (!Number.isFinite(g) || g <= 0) return null;
  return g;
}

export function computeIntygGroupOptions(activities: ActivityLike[]): number[] {
  const maxUsed = activities.reduce((max, a) => {
    const g = Number((a as any)?.intygGroup || 0);
    if (Number.isFinite(g) && g > max) return g;
    return max;
  }, 0);
  const top = Math.max(1, maxUsed + 1);
  return Array.from({ length: top }, (_, i) => i + 1);
}

export function sortActsByStart(acts: ActivityLike[]): ActivityLike[] {
  return acts.slice().sort((a, b) => {
    const as = String(a.exactStartISO || "");
    const bs = String(b.exactStartISO || "");
    return as.localeCompare(bs);
  });
}

export function placementsInGroup(activities: ActivityLike[], groupNum: number): ActivityLike[] {
  return sortActsByStart(activities.filter((a) => getIntygGroupNumber(a) === groupNum));
}

export function pickGroupConfig(grouped: ActivityLike[]): IntygGroupConfig | null {
  for (const a of grouped) {
    const c = parseIntygGroupConfig((a as any)?.intygGroupConfig);
    if (
      c &&
      (c.title ||
        c.certSupervisor ||
        c.certSpecialty ||
        c.certSite ||
        "mergedDescription" in c)
    ) {
      return c;
    }
  }
  return null;
}

/**
 * Förslag till intygstitel: endast ord som ALLA placeringar delar i samma ordning från början
 * (första gemensamma ordet, sedan nästa, tills någon avviker). Resten ignoreras — användaren kan ändra manuellt.
 */
export function commonPrefixTitle(labels: string[]): string {
  const tokenize = (s: string) =>
    s
      .trim()
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(Boolean);
  const trimmed = labels.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return "";
  const wordRows = trimmed.map(tokenize);
  const firstWords = wordRows[0];
  const prefixWords: string[] = [];
  for (let i = 0; i < firstWords.length; i++) {
    const w = firstWords[i];
    if (wordRows.every((row) => (row[i] ?? "") === w)) prefixWords.push(w);
    else break;
  }
  return prefixWords.join(" ").trim();
}

function milestoneCodeKey(m: string): string {
  return String(m ?? "")
    .trim()
    .split(/\s|–|-|:|\u2013/)[0]
    .toLowerCase();
}

/** Samlar delmål från flera placeringar utan dubbletter (samma kod räknas en gång, behåller första fullständiga raden). */
export function mergeGroupMilestoneRows(acts: ActivityLike[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of sortActsByStart(acts)) {
    const ms = Array.isArray(a.milestones) ? a.milestones : [];
    for (const raw of ms) {
      const s = String(raw ?? "").trim();
      if (!s) continue;
      const k = milestoneCodeKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

/**
 * Slår ihop beskrivningar: identiska rader (efter normalisering av whitespace) tas bara en gång,
 * i den ordning de först förekommer när man går igenom placeringarna i datumordning.
 */
export function mergeGroupNotes(acts: ActivityLike[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of sortActsByStart(acts)) {
    const note = String(a.note || "");
    if (!note.trim()) continue;
    const rawLines = note.split(/\n/);
    for (const raw of rawLines) {
      const t = raw.trim();
      if (!t) continue;
      const key = t.replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
  }
  return out.join("\n");
}

export function formatGroupedPeriodDisplay(acts: ActivityLike[]): string {
  const parts: string[] = [];
  for (const a of sortActsByStart(acts)) {
    const s = String(a.exactStartISO || "").trim();
    const e = String(a.exactEndISO || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) && /^\d{4}-\d{2}-\d{2}$/.test(e)) {
      parts.push(`${s} -- ${e}`);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      parts.push(s);
    }
  }
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.join(" och ");
}

export function buildGroupedCertificateBodyNotes(
  grouped: ActivityLike[],
  groupNum: number | null,
  _periodDisplay: string,
  config?: IntygGroupConfig | null
): string {
  const useSaved = config != null && "mergedDescription" in config;
  const merged = useSaved ? String((config as IntygGroupConfig).mergedDescription ?? "") : mergeGroupNotes(grouped);
  if (groupNum == null || grouped.length <= 1) {
    return merged || String((grouped[0] as any)?.note || "").trim();
  }
  return merged;
}

export function resolveSupervisorTrioForGroup(
  grouped: ActivityLike[],
  config: IntygGroupConfig | null
): { supervisor: string; spec: string; site: string } {
  const cfgS = config?.certSupervisor?.trim();
  if (cfgS) {
    return {
      supervisor: cfgS,
      spec: (config?.certSpecialty ?? "").trim(),
      site: (config?.certSite ?? "").trim(),
    };
  }
  const sups = [
    ...new Set(grouped.map((g) => String(g.supervisor || "").trim()).filter(Boolean)),
  ];
  if (sups.length === 1) {
    const sup = sups[0];
    const rows = grouped.filter((g) => String(g.supervisor || "").trim() === sup);
    const specs = [...new Set(rows.map((r) => String(r.supervisorSpeciality || "").trim()))];
    const sites = [...new Set(rows.map((r) => String(r.supervisorSite || "").trim()))];
    let spec = specs.length === 1 ? specs[0] : "";
    let site = sites.length === 1 ? sites[0] : "";
    if (config?.certSpecialty?.trim()) spec = config.certSpecialty.trim();
    if (config?.certSite?.trim()) site = config.certSite.trim();
    return { supervisor: sup, spec, site };
  }
  const anchor = sortActsByStart(grouped)[0];
  return {
    supervisor: String(anchor?.supervisor || ""),
    spec: String(anchor?.supervisorSpeciality || ""),
    site: String(anchor?.supervisorSite || ""),
  };
}

export type GroupedPlacementExport = {
  act: Record<string, unknown>;
  milestones: string[];
};

export function buildGroupedPlacementExportFromState(
  groupedInput: ActivityLike[],
  clicked: ActivityLike,
  explicitConfig: IntygGroupConfig | null,
  groupNum: number | null,
  opts?: { attendanceFallback?: number; isZeroAttendanceType?: (t: string) => boolean }
): GroupedPlacementExport {
  const grouped = sortActsByStart(groupedInput.length > 0 ? groupedInput : [clicked]);
  const anchor = grouped[0] ?? clicked;
  const config = explicitConfig ?? pickGroupConfig(grouped);

  const defaultTitle =
    commonPrefixTitle(
      grouped.map((a) => String(a.label || a.type || "").trim()).filter(Boolean)
    ) || String(clicked.label || clicked.type || "");

  const title = (config?.title && String(config.title).trim()) || defaultTitle;

  const { supervisor, spec, site } = resolveSupervisorTrioForGroup(grouped, config);

  const periodDisplay =
    groupNum != null && grouped.length > 1 ? formatGroupedPeriodDisplay(grouped) : "";

  const notes =
    groupNum != null && grouped.length > 1
      ? buildGroupedCertificateBodyNotes(grouped, groupNum, periodDisplay, config)
      : String((clicked as any).note || "").trim();

  const milestoneRows =
    groupNum != null && grouped.length > 1
      ? mergeGroupMilestoneRows(grouped)
      : clicked.milestones || [];

  const isZero = opts?.isZeroAttendanceType?.(String(clicked.type)) ?? false;
  const attendance = isZero ? 0 : (anchor as any).attendance ?? opts?.attendanceFallback ?? 100;

  const last = grouped[grouped.length - 1] ?? anchor;

  const act: Record<string, unknown> = {
    title,
    clinic: title,
    site: (anchor as any).site || title,
    startDate: String(anchor.exactStartISO || ""),
    endDate: String(last.exactEndISO || anchor.exactEndISO || ""),
    periodDisplay: periodDisplay || undefined,
    attendance,
    supervisor,
    supervisorSpeciality: spec,
    supervisorSpecialty: spec,
    supervisorSite: site,
    notes,
  };

  return { act, milestones: milestoneRows.map((m) => String(m).trim()).filter(Boolean) };
}

export function buildGroupedPlacementExport(
  clicked: ActivityLike,
  allActivities: ActivityLike[],
  opts?: { attendanceFallback?: number; isZeroAttendanceType?: (t: string) => boolean }
): GroupedPlacementExport {
  const group = getIntygGroupNumber(clicked);
  const grouped =
    group != null ? placementsInGroup(allActivities, group) : sortActsByStart([clicked]);
  return buildGroupedPlacementExportFromState(grouped, clicked, null, group, opts);
}

/** Medlemmar i vald grupp + aktuell placering (för utkast innan sparning). */
export function groupedMembersForDraft(
  base: ActivityLike,
  allActivities: ActivityLike[],
  draftGroup: number | null
): ActivityLike[] {
  if (draftGroup == null) return [base];
  const others = allActivities.filter(
    (a) => a.id !== base.id && getIntygGroupNumber(a) === draftGroup
  );
  return sortActsByStart([...others, base]);
}

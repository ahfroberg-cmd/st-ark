import type { PusslaAgentAction } from "@/lib/ai/types";
import {
  parseAddDelmalToPlacementInlinePlan,
  parseLocalAgentPlan,
} from "@/lib/ai/pusslaAgent";
import {
  detectPositionFromEnd,
  hasNoGapIntent,
  hasOrdinalFromEndMention,
  normalizeSv,
} from "@/lib/ai/agent/languageLexicon";
import {
  buildResolvedEntityIndex,
  resolveLatestCourseTitle,
  resolvePlacementCount,
  resolvePlacementPositionFromEndByLabel,
  resolveNextPlacementStartDateByPositionFromEnd,
} from "@/lib/ai/agent/referenceResolver";
import { buildWorldStateIndex } from "@/lib/ai/agent/worldState";

export interface HierarchicalPlannerInput {
  userText: string;
  snapshot?: unknown;
}

export interface HierarchicalPlannerResult {
  goalSummary: string;
  actions: PusslaAgentAction[];
  confidence: "low" | "medium" | "high";
  clarifyingQuestion?: string;
}

const SV_NUMBERS: Record<string, number> = {
  en: 1,
  ett: 1,
  tva: 2,
  tre: 3,
  fyra: 4,
  fem: 5,
  sex: 6,
  sju: 7,
  atta: 8,
  nio: 9,
  tio: 10,
  elva: 11,
  tolv: 12,
};

function extractMonths(norm: string): number {
  const numeric = norm.match(/(\d+)\s*manad/);
  if (numeric) {
    const value = Number(numeric[1]);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }
  const token = norm.match(/([a-z0-9]+)\s*manad/);
  if (!token) return 1;
  const key = token[1];
  if (SV_NUMBERS[key]) return SV_NUMBERS[key];
  return 1;
}


function extractCountFromText(norm: string): number | null {
  const numeric = norm.match(/(\d+)\s+(?:kliniska?\s+)?placering/);
  if (numeric) {
    const n = Number(numeric[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const worded = norm.match(/([a-z0-9]+)\s+(?:kliniska?\s+)?placering/);
  if (worded) {
    const n = SV_NUMBERS[worded[1]];
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extractPlacementTitles(raw: string): string[] {
  const source = raw.includes(":") ? raw.split(":").slice(1).join(":") : raw;
  const firstSentence = source.split(/[.!?]/)[0] || source;
  return firstSentence
    .split(/,|\boch\b/gi)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .filter((s) => !/(lägg|skapa|placering|bt|jämn|jamn|fördel|fordel|öppna|intyg|skriv ut)/i.test(s))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .slice(0, 12);
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface TimelinePlacement {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function collectTimelinePlacements(snapshot: unknown): TimelinePlacement[] {
  const rows = Array.isArray((snapshot as any)?.activities) ? (snapshot as any).activities : [];
  const out: TimelinePlacement[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const startDate = toIsoDate(row?.exactStartISO) || toIsoDate(row?.startDate);
    const endDate = toIsoDate(row?.exactEndISO) || toIsoDate(row?.endDate);
    if (!startDate || !endDate) continue;
    const idRaw = typeof row?.id === "string" ? row.id : "";
    const id = idRaw || `placement:${i}:${startDate}:${endDate}`;
    out.push({
      id,
      label: String(row?.label || "Placering"),
      startDate,
      endDate,
    });
  }
  return out;
}

function listTimelineInternalGaps(
  placements: TimelinePlacement[]
): Array<{ startDate: string; endDate: string }> {
  const sorted = [...placements].sort((a, b) =>
    a.startDate === b.startDate
      ? a.endDate.localeCompare(b.endDate)
      : a.startDate.localeCompare(b.startDate)
  );
  const gaps: Array<{ startDate: string; endDate: string }> = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gapStart = addDaysIso(a.endDate, 1);
    const gapEnd = addDaysIso(b.startDate, -1);
    if (gapStart <= gapEnd) gaps.push({ startDate: gapStart, endDate: gapEnd });
  }
  return gaps;
}

function extractPlacementLabelFromPrompt(raw: string): string | null {
  const quoted = raw.match(/["”]([^"”]+)["”]/);
  if (quoted && quoted[1]) return String(quoted[1]).trim() || null;
  const m =
    raw.match(/(?:alla|samtliga|de)\s+ska\s+vara\s+([^\n.,;:]+)$/i) ||
    raw.match(/(?:vara|bli)\s+([^\n.,;:]+)$/i);
  if (!m || !m[1]) return null;
  const label = String(m[1]).trim();
  return label.length >= 2 ? label : null;
}

function planFillTimelineGapsWithPlacements(
  raw: string,
  norm: string,
  snapshot: unknown
): HierarchicalPlannerResult | null {
  const asksAdd = /(lagg till|lägg till|lagg in|lägg in|skapa|planera)/.test(norm);
  const mentionsGap = /\b(glapp(?:et|en)?|luck(?:a|or|an|orna)|mellanrum)\b/.test(norm);
  const mentionsPlacement = /\bplacering(?:ar|en)?\b/.test(norm);
  if (!asksAdd || !mentionsGap || !mentionsPlacement) return null;

  const placements = collectTimelinePlacements(snapshot);
  if (placements.length < 2) {
    return {
      goalSummary: "Fyll luckor i tidslinjen med nya placeringar",
      actions: [],
      confidence: "medium",
      clarifyingQuestion:
        "Jag behöver minst två befintliga placeringar för att kunna identifiera luckor mellan dem.",
    };
  }
  const gaps = listTimelineInternalGaps(placements);
  if (gaps.length === 0) {
    return {
      goalSummary: "Fyll luckor i tidslinjen med nya placeringar",
      actions: [],
      confidence: "medium",
      clarifyingQuestion: "Jag hittar inga luckor mellan befintliga placeringar just nu.",
    };
  }

  const requestedLabel = extractPlacementLabelFromPrompt(raw) || "Klinisk tjänstgöring";
  const actions: PusslaAgentAction[] = gaps.map((g) => ({
    type: "create_typed_placement_from_range",
    placementType: "Klinisk tjänstgöring",
    title: requestedLabel,
    startDate: g.startDate,
    endDate: g.endDate,
  }));
  return {
    goalSummary: `Fyll ${gaps.length} luckor med placeringar`,
    actions,
    confidence: "high",
  };
}

function planRepairTimelineGaps(norm: string, snapshot: unknown): HierarchicalPlannerResult | null {
  const mentionsGap = /\b(glapp(?:et|en)?|lucka|luckor|mellanrum)\b/.test(norm);
  const mentionsPlacement = /\bplacering(?:ar|en)?\b/.test(norm);
  const hasAllScope = /\b(alla|samtliga|hela)\b/.test(norm);
  const asksRepair = /(justera|fixa|fyll|stang|tapp|forlang|koppla|synka|eliminera|ta bort)/.test(norm);
  if (!mentionsGap || !mentionsPlacement || !asksRepair || !hasAllScope) return null;

  const placements = collectTimelinePlacements(snapshot).sort((a, b) =>
    a.startDate === b.startDate
      ? a.endDate.localeCompare(b.endDate)
      : a.startDate.localeCompare(b.startDate)
  );
  if (placements.length < 2) {
    return {
      goalSummary: "Justera glapp mellan placeringar",
      actions: [],
      confidence: "medium",
      clarifyingQuestion:
        "Jag behöver minst två placeringar i tidslinjen för att kunna justera glapp. Öppna rätt vy och försök igen.",
    };
  }

  const byEndDesc = [...placements].sort((a, b) =>
    a.endDate === b.endDate
      ? b.startDate.localeCompare(a.startDate)
      : b.endDate.localeCompare(a.endDate)
  );
  const positionById = new Map<string, number>();
  byEndDesc.forEach((p, idx) => positionById.set(p.id, idx + 1));

  const actions: PusslaAgentAction[] = [];
  for (let i = 0; i < placements.length - 1; i += 1) {
    const before = placements[i];
    const after = placements[i + 1];
    const targetEnd = addDaysIso(after.startDate, -1);
    if (before.endDate >= targetEnd) continue;
    const positionFromEnd = positionById.get(before.id);
    if (!positionFromEnd) continue;
    actions.push({
      type: "extend_last_placement",
      positionFromEnd,
      endDate: targetEnd,
    });
  }

  if (actions.length === 0) {
    return {
      goalSummary: "Justera glapp mellan placeringar",
      actions: [],
      confidence: "medium",
      clarifyingQuestion:
        "Jag hittar inga faktiska glapp mellan placeringarna just nu, så inget behöver förlängas.",
    };
  }

  return {
    goalSummary: `Justera ${actions.length} glapp genom att förlänga placeringar framåt`,
    actions,
    confidence: "high",
  };
}

function resolveMentionedPlacementLabel(norm: string, snapshot: unknown): string | null {
  const labels = Array.from(
    new Set(
      buildResolvedEntityIndex(snapshot).placements
        .map((p) => String(p.label || "").trim())
        .filter((s) => s.length >= 2)
    )
  );
  if (labels.length === 0) return null;
  const normalizeLoose = (v: string) =>
    normalizeSv(v)
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const text = normalizeLoose(norm);
  const candidates = labels
    .map((label) => ({ label, key: normalizeLoose(label) }))
    .filter((x) => x.key.length >= 2 && text.includes(x.key))
    .sort((a, b) => b.key.length - a.key.length);
  return candidates[0]?.label || null;
}

function planExtendNamedPlacement(
  raw: string,
  norm: string,
  snapshot: unknown
): HierarchicalPlannerResult | null {
  const asksExtend = /(forlang|flrlang)/.test(norm);
  if (!asksExtend || !hasOrdinalFromEndMention(norm)) return null;
  const label = resolveMentionedPlacementLabel(raw, snapshot);
  if (!label) return null;

  const amongMatchOrdinal = detectPositionFromEnd(norm);
  const positionFromEnd = resolvePlacementPositionFromEndByLabel(snapshot, label, amongMatchOrdinal);
  if (!positionFromEnd) {
    return {
      goalSummary: `Förläng senaste "${label}" utan fel mål`,
      actions: [],
      confidence: "medium",
      clarifyingQuestion: `Jag hittar ingen placering som matchar "${label}" i den här vyn. Välj placeringen eller skriv exakt namn.`,
    };
  }

  const explicitEndDate = raw.match(/\btill\s+(\d{4}-\d{2}-\d{2})\b/i)?.[1] || null;
  if (explicitEndDate) {
    return {
      goalSummary: `Förläng senaste "${label}" till ${explicitEndDate}`,
      actions: [{ type: "extend_last_placement", positionFromEnd, endDate: explicitEndDate }],
      confidence: "high",
    };
  }

  if (hasNoGapIntent(norm)) {
    const nextStart = resolveNextPlacementStartDateByPositionFromEnd(snapshot, positionFromEnd);
    if (!nextStart) {
      return {
        goalSummary: `Förläng senaste "${label}" utan glapp`,
        actions: [],
        confidence: "medium",
        clarifyingQuestion:
          "Jag hittar ingen efterföljande placering att möta framåt. Ange slutdatum (YYYY-MM-DD) eller antal månader.",
      };
    }
    return {
      goalSummary: `Förläng senaste "${label}" fram till nästa placering`,
      actions: [
        {
          type: "extend_last_placement",
          positionFromEnd,
          endDate: addDaysIso(nextStart, -1),
        },
      ],
      confidence: "high",
    };
  }

  const months = extractMonths(norm);
  return {
    goalSummary: `Förläng senaste "${label}" med ${months} månad(er)`,
    actions: [{ type: "extend_last_placement", positionFromEnd, months }],
    confidence: "high",
  };
}

function planExtendOrdinalPlacement(
  raw: string,
  norm: string,
  snapshot: unknown
): HierarchicalPlannerResult | null {
  const asksExtend = /(forlang|flrlang)/.test(norm);
  if (!asksExtend || !hasOrdinalFromEndMention(norm)) return null;
  if (!/\bplacering/.test(norm) && !/fran\s+slutet/.test(norm)) return null;
  if (resolveMentionedPlacementLabel(raw, snapshot)) return null;

  const positionFromEnd = detectPositionFromEnd(norm);
  const explicitEndDate = raw.match(/\btill\s+(\d{4}-\d{2}-\d{2})\b/i)?.[1] || null;
  if (explicitEndDate) {
    return {
      goalSummary: `Förläng placering #${positionFromEnd} från slutet`,
      actions: [{ type: "extend_last_placement", positionFromEnd, endDate: explicitEndDate }],
      confidence: "high",
    };
  }

  if (hasNoGapIntent(norm)) {
    const nextStart = resolveNextPlacementStartDateByPositionFromEnd(snapshot, positionFromEnd);
    if (!nextStart) {
      return {
        goalSummary: `Förläng placering #${positionFromEnd} från slutet utan glapp`,
        actions: [],
        confidence: "medium",
        clarifyingQuestion:
          "Jag hittar ingen efterföljande placering att möta framåt. Ange slutdatum (YYYY-MM-DD) eller antal månader.",
      };
    }
    return {
      goalSummary: `Förläng placering #${positionFromEnd} från slutet fram till nästa placering`,
      actions: [
        {
          type: "extend_last_placement",
          positionFromEnd,
          endDate: addDaysIso(nextStart, -1),
        },
      ],
      confidence: "high",
    };
  }

  const months = extractMonths(norm);
  return {
    goalSummary: `Förläng placering #${positionFromEnd} från slutet med ${months} månad(er)`,
    actions: [{ type: "extend_last_placement", positionFromEnd, months }],
    confidence: "high",
  };
}

function diffDaysInclusive(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T00:00:00Z`).getTime();
  const b = new Date(`${endIso}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86400000) + 1;
}

function isoMin(a: string, b: string): string {
  return a < b ? a : b;
}

function isoMax(a: string, b: string): string {
  return a > b ? a : b;
}

function buildFreeRanges(
  windowStart: string,
  windowEnd: string,
  occupied: Array<{ startDate: string; endDate: string }>
): Array<{ startDate: string; endDate: string }> {
  if (windowEnd < windowStart) return [];
  const merged = [...occupied]
    .map((r) => ({
      startDate: isoMax(r.startDate, windowStart),
      endDate: isoMin(r.endDate, windowEnd),
    }))
    .filter((r) => r.endDate >= r.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const compact: Array<{ startDate: string; endDate: string }> = [];
  for (const r of merged) {
    const last = compact[compact.length - 1];
    if (!last) {
      compact.push({ ...r });
      continue;
    }
    const dayAfterLast = addDaysIso(last.endDate, 1);
    if (r.startDate <= dayAfterLast) {
      if (r.endDate > last.endDate) last.endDate = r.endDate;
    } else {
      compact.push({ ...r });
    }
  }

  const free: Array<{ startDate: string; endDate: string }> = [];
  let cursor = windowStart;
  for (const r of compact) {
    if (cursor < r.startDate) {
      free.push({ startDate: cursor, endDate: addDaysIso(r.startDate, -1) });
    }
    cursor = addDaysIso(r.endDate, 1);
  }
  if (cursor <= windowEnd) {
    free.push({ startDate: cursor, endDate: windowEnd });
  }
  return free.filter((r) => r.endDate >= r.startDate);
}

function remainingDaysInRanges(
  ranges: Array<{ startDate: string; endDate: string }>,
  idx: number,
  cursor: string
): number {
  let sum = 0;
  for (let i = idx; i < ranges.length; i += 1) {
    const start = i === idx ? isoMax(ranges[i].startDate, cursor) : ranges[i].startDate;
    if (ranges[i].endDate >= start) {
      sum += diffDaysInclusive(start, ranges[i].endDate);
    }
  }
  return sum;
}

function distributeAcrossFreeRanges(
  freeRanges: Array<{ startDate: string; endDate: string }>,
  count: number
): Array<{ startDate: string; endDate: string }> {
  const out: Array<{ startDate: string; endDate: string }> = [];
  if (count <= 0 || freeRanges.length === 0) return out;

  let rangeIdx = 0;
  let cursor = freeRanges[0].startDate;
  for (let i = 0; i < count; i += 1) {
    while (rangeIdx < freeRanges.length && cursor > freeRanges[rangeIdx].endDate) {
      rangeIdx += 1;
      if (rangeIdx < freeRanges.length) cursor = freeRanges[rangeIdx].startDate;
    }
    if (rangeIdx >= freeRanges.length) break;

    const remPlacements = count - i;
    const remDays = remainingDaysInRanges(freeRanges, rangeIdx, cursor);
    const allocDays = Math.max(1, Math.floor(remDays / remPlacements));

    const range = freeRanges[rangeIdx];
    const start = isoMax(cursor, range.startDate);
    const endCandidate = addDaysIso(start, allocDays - 1);
    const end = endCandidate <= range.endDate ? endCandidate : range.endDate;
    out.push({ startDate: start, endDate: end });
    cursor = addDaysIso(end, 1);
  }
  return out;
}

function inferPlacementCount(snapshot: unknown): number | null {
  const c = resolvePlacementCount(snapshot);
  return c > 0 ? c : null;
}

function parsePlacementDurationScaleFactor(norm: string): number | null {
  if (/(halvera|halver)/.test(norm)) return 0.5;
  const percentMatch = norm.match(/(?:till|till\s+ca)?\s*(\d{1,3})\s*%/);
  if (percentMatch) {
    const pct = Number(percentMatch[1]);
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) return pct / 100;
  }
  const fractionMatch = norm.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (fractionMatch) {
    const a = Number(fractionMatch[1]);
    const b = Number(fractionMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 && a <= b) return a / b;
  }
  return null;
}

function planScaleAllPlacementDurations(norm: string): HierarchicalPlannerResult | null {
  const mentionsPlacement = /\bplacering(?:ar|en)?s?\b/.test(norm);
  const hasAllScope = /\b(alla|samtliga|hela)\b/.test(norm);
  const asksLengthTransform = /(langd|längd|halv|halver|minska|korta|skala)/.test(norm);
  if (!mentionsPlacement || !hasAllScope || !asksLengthTransform) return null;

  const factor = parsePlacementDurationScaleFactor(norm);
  if (!factor) {
    return {
      goalSummary: "Skala längden på alla placeringar",
      actions: [],
      confidence: "medium",
      clarifyingQuestion:
        "Ange hur mycket placeringarna ska kortas, t.ex. 'halvera', 'till 60%' eller '3/4'.",
    };
  }

  return {
    goalSummary: `Skala alla placeringars längd till ${Math.round(factor * 100)}%`,
    actions: [{ type: "transform_all_placements_duration", factor, anchor: "start" }],
    confidence: "high",
  };
}

function planShiftAllPlacements(
  norm: string,
  snapshot: unknown
): HierarchicalPlannerResult | null {
  const hasShiftVerb = /(flytta|skjut|forflytta|justera|omplanera)/.test(norm);
  const hasPlacementTarget = /\bplacering(?:ar|en)?\b/.test(norm);
  const hasAllScope = /\b(alla|samtliga|hela)\b/.test(norm);
  const hasTimeDirection = /\b(fram|framat|bak|bakat)\b/.test(norm);
  if (!hasShiftVerb || !hasPlacementTarget || !hasAllScope || !hasTimeDirection) return null;

  if (/\bbak|\bbakat/.test(norm)) {
    return {
      goalSummary: "Flytta alla placeringar bakat i tid",
      actions: [],
      confidence: "high",
      clarifyingQuestion:
        "Jag kan flytta placeringar framat i steg, men inte bakat med nuvarande action-uppsattning. Vill du att jag flyttar alla framat i stallet?",
    };
  }

  const months = extractMonths(norm);
  const placementCount = inferPlacementCount(snapshot);
  if (!placementCount) {
    return {
      goalSummary: "Flytta alla placeringar framat i tid",
      actions: [],
      confidence: "medium",
      clarifyingQuestion:
        "Jag kan flytta alla placeringar framat, men jag kan inte lasa ut hur manga placeringar som finns just nu. Oppna tidslinjen och forsok igen, eller ange hur manga placeringar som ska flyttas.",
    };
  }

  const actions: PusslaAgentAction[] = [];
  for (let positionFromEnd = 1; positionFromEnd <= placementCount; positionFromEnd += 1) {
    actions.push({
      type: "shift_placement_from_end",
      positionFromEnd,
      months,
    });
  }
  return {
    goalSummary: `Flytta alla ${placementCount} placeringar framat ${months} manad(er)`,
    actions,
    confidence: "high",
  };
}

function planShiftAllCourses(norm: string): HierarchicalPlannerResult | null {
  const hasShiftVerb = /(flytta|skjut|forflytta|justera|omplanera)/.test(norm);
  const hasCourseTarget = /\b(kurser|kurs(?:erna|en)?|dem|dom)\b/.test(norm);
  const hasDirection = /\b(fram|framat|bak|bakat)\b/.test(norm);
  if (!hasShiftVerb || !hasCourseTarget || !hasDirection) return null;
  if (/\bplacering/.test(norm)) return null;

  const months = extractMonths(norm);
  const direction: "forward" | "backward" = /\bbak|\bbakat/.test(norm)
    ? "backward"
    : "forward";
  return {
    goalSummary: `Flytta alla kurser ${direction === "forward" ? "framat" : "bakat"} i tid`,
    actions: [{ type: "shift_all_courses", months, direction }],
    confidence: "high",
  };
}

function planGoalCatalogAndIup(norm: string): HierarchicalPlannerResult | null {
  const asksGoals = /\b(delmal|malbild|alla mal|malen)\b/.test(norm);
  if (!asksGoals) return null;
  // "Lägg till delmål … till <placering>" hanteras av parseAddDelmalToPlacementInlinePlan, inte katalogdump.
  if (
    /\b(lagg\s+till|satt)\s+delmal\b/.test(norm) &&
    /\bdelmal\s+.+\s+(till|pa)\s+\S/.test(norm)
  ) {
    return null;
  }
  return {
    goalSummary: "Oppna delmalsvyn och sammanfatta malkatalogen",
    actions: [
      { type: "open_window", window: "iup" },
      { type: "set_iup_tab", tab: "delmal" },
      { type: "summarize_goal_catalog" },
    ],
    confidence: "medium",
  };
}

function planAppOverview(norm: string): HierarchicalPlannerResult | null {
  const asksOverview =
    /\b(hela appen|appen|oversikt|översikt|ga igenom|kartlagg|karta|scanna)\b/.test(norm) &&
    /\b(sidor|sektioner|funktioner|vyer|roller)\b/.test(norm);
  if (!asksOverview) return null;
  return {
    goalSummary: "Sammanfatta appens sektioner och rollvyer",
    actions: [{ type: "summarize_app_sections" }, { type: "summarize_role_views" }],
    confidence: "medium",
  };
}

function planMilestoneSync(norm: string): HierarchicalPlannerResult | null {
  const asksSync = /(synk|synka|uppdatera|matcha)/.test(norm);
  const mentionsCourses = /\b(kurser|kurs(?:erna|en)?)\b/.test(norm);
  const mentionsMilestones = /\b(delmal|mål|mal)\b/.test(norm);
  if (!asksSync || !mentionsCourses || !mentionsMilestones) return null;
  return {
    goalSummary: "Synka kursers delmal med respektive kurs",
    actions: [{ type: "sync_course_milestones" }],
    confidence: "high",
  };
}

function planDeleteAllCoursesForYear(
  norm: string,
  snapshot: unknown
): HierarchicalPlannerResult | null {
  const asksDelete = /(ta bort|radera|delete|rens[a]?)/.test(norm);
  const hasCourseTarget = /\bkurser?\b/.test(norm);
  const hasAllScope = /\b(alla|samtliga|hela)\b/.test(norm);
  const yearMatch = norm.match(/\b(19|20)\d{2}\b/);
  if (!asksDelete || !hasCourseTarget || !hasAllScope || !yearMatch) return null;

  const year = Number(yearMatch[0]);
  const world = buildWorldStateIndex(snapshot);
  const months = world.courseStartMonthsByYear[year] || [];
  if (months.length === 0) {
    return {
      goalSummary: `Ta bort alla kurser för ${year}`,
      actions: [],
      confidence: "high",
      clarifyingQuestion: `Jag hittar inga kurser med start under ${year}. Vill du att jag ska söka i ett annat år?`,
    };
  }
  return {
    goalSummary: `Ta bort alla kurser för ${year}`,
    actions: months.map((month) => ({
      type: "delete_course_by_month_year",
      month,
      year,
    })),
    confidence: "high",
  };
}

function planBtClinicalDistribution(
  raw: string,
  norm: string,
  snapshot: unknown
): HierarchicalPlannerResult | null {
  const asksAdd = /(lagg till|lägg till|skapa|planera)/.test(norm);
  const asksPlacement = /\bplacering(?:ar|en)?\b/.test(norm);
  const asksBt = /\bbt\b/.test(norm);
  const asksEven = /(jamn|jämn|fordel|fördel)/.test(norm);
  if (!asksAdd || !asksPlacement || !asksBt || !asksEven) return null;

  const world = buildWorldStateIndex(snapshot);
  if (!world.btWindow) {
    return {
      goalSummary: "Skapa kliniska BT-placeringar jämnt fördelat",
      actions: [],
      confidence: "medium",
      clarifyingQuestion:
        "Jag hittar inte BT-fönstret i nuvarande data. Öppna BT-tidslinjen eller ange BT-start och BT-slut.",
    };
  }

  const count = extractCountFromText(norm) || 4;
  const freeRanges = buildFreeRanges(
    world.btWindow.startDate,
    world.btWindow.endDate,
    world.btOccupiedRanges
  );
  const totalFreeDays = freeRanges.reduce(
    (sum, r) => sum + diffDaysInclusive(r.startDate, r.endDate),
    0
  );
  if (totalFreeDays < count * 14) {
    return {
      goalSummary: "Skapa kliniska BT-placeringar jämnt fördelat",
      actions: [],
      confidence: "medium",
      clarifyingQuestion:
        "Det finns för lite ledig BT-tid för så många nya placeringar utan överlapp. Ange färre placeringar eller be mig först frigöra tid.",
    };
  }

  const titles = extractPlacementTitles(raw);
  const segments = distributeAcrossFreeRanges(freeRanges, count);
  if (segments.length < count) {
    return {
      goalSummary: "Skapa kliniska BT-placeringar jämnt fördelat",
      actions: [],
      confidence: "medium",
      clarifyingQuestion: "Jag kunde inte hitta tillräckligt med sammanhängande BT-luckor för hela planen.",
    };
  }
  const actions: PusslaAgentAction[] = [];
  for (let i = 0; i < count; i += 1) {
    const startDate = segments[i].startDate;
    const endDate = segments[i].endDate;
    actions.push({
      type: "create_typed_placement_from_range",
      placementType: "Klinisk tjänstgöring",
      title: titles[i] || `Klinisk placering ${i + 1}`,
      startDate,
      endDate,
    });
  }

  const asksSrSuggestions =
    /(studierektor|sr)/.test(norm) && /(forslag|förslag|delmal|beskriv)/.test(norm);
  if (asksSrSuggestions) {
    actions.push({
      type: "plan_st_from_sr_templates",
      includePlacements: true,
      includeCourses: false,
      includeUtbildningsmoment: false,
      monthlySupervision: 1,
      assessmentsPerTerm: 2,
    });
  }

  const asksBtCertOpen = /(intyg|ansokan|ansökan)/.test(norm) && /\bbt\b/.test(norm);
  if (asksBtCertOpen) {
    actions.push({ type: "open_window", window: "bt_ansokan" });
  }

  return {
    goalSummary: `Skapa ${count} kliniska BT-placeringar jämnt fördelade`,
    actions,
    confidence: "high",
  };
}

function planLatestCourseRename(
  raw: string,
  norm: string,
  snapshot: unknown
): HierarchicalPlannerResult | null {
  const asksRename = /(andra|ändra|byt)/.test(norm);
  const mentionsLatest = /\b(senaste|sista)\b/.test(norm);
  const mentionsCourse = /\bkurs(?:en|er|erna)?\b/.test(norm);
  const hasTo = /\btill\b/.test(norm);
  if (!asksRename || !mentionsLatest || !mentionsCourse || !hasTo) return null;

  const m =
    raw.match(/(?:ändra|andra|byt)\s+[\s\S]*?\s+till\s+["”]([^"”]+)["”]/i) ||
    raw.match(/(?:ändra|andra|byt)\s+[\s\S]*?\s+till\s+([^\n.]+)$/i);
  if (!m) return null;
  const toTitle = String(m[1] || "").trim();
  if (!toTitle) return null;

  const fromQuoted = raw.match(/["”]([^"”]+)["”]\s+till/i);
  const fromTitle =
    (fromQuoted && fromQuoted[1] ? String(fromQuoted[1]).trim() : "") ||
    resolveLatestCourseTitle(snapshot) ||
    "";
  if (!fromTitle) {
    return {
      goalSummary: "Byt namn på senaste kursen",
      actions: [],
      confidence: "medium",
      clarifyingQuestion:
        "Jag hittar inte vilken kurs som är den senaste i vyn. Välj kursen eller ange kursnamnet så byter jag den.",
    };
  }

  return {
    goalSummary: "Byt namn på senaste kursen",
    actions: [
      { type: "select_course", query: fromTitle },
      { type: "update_selected_course", fields: { title: toTitle } },
      { type: "save_selected_course" },
    ],
    confidence: "high",
  };
}

function planDiagnosticsForMissingInfo(norm: string): HierarchicalPlannerResult | null {
  const asksMissing = /(vad som saknas|vad saknas|visa planen|visa plan|status)/.test(norm);
  if (!asksMissing) return null;
  return {
    goalSummary: "Diagnostisera läget och vad som saknas",
    actions: [
      { type: "summarize_goal_catalog" },
      { type: "summarize_app_sections" },
      { type: "summarize_role_views" },
    ],
    confidence: "medium",
  };
}

export function buildHierarchicalPlan(
  input: HierarchicalPlannerInput
): HierarchicalPlannerResult | null {
  const userText = String(input.userText || "").trim();
  if (!userText) return null;
  const norm = normalizeSv(userText);

  const allPlacementPlan = planShiftAllPlacements(norm, input.snapshot);
  if (allPlacementPlan) return allPlacementPlan;

  const btDistributionPlan = planBtClinicalDistribution(userText, norm, input.snapshot);
  if (btDistributionPlan) return btDistributionPlan;

  const namedExtendPlan = planExtendNamedPlacement(userText, norm, input.snapshot);
  if (namedExtendPlan) return namedExtendPlan;

  const ordinalExtendPlan = planExtendOrdinalPlacement(userText, norm, input.snapshot);
  if (ordinalExtendPlan) return ordinalExtendPlan;

  const latestRenamePlan = planLatestCourseRename(userText, norm, input.snapshot);
  if (latestRenamePlan) return latestRenamePlan;

  const allCoursesPlan = planShiftAllCourses(norm);
  if (allCoursesPlan) return allCoursesPlan;

  const syncPlan = planMilestoneSync(norm);
  if (syncPlan) return syncPlan;

  const deleteYearPlan = planDeleteAllCoursesForYear(norm, input.snapshot);
  if (deleteYearPlan) return deleteYearPlan;

  const diagnosticsPlan = planDiagnosticsForMissingInfo(norm);
  if (diagnosticsPlan) return diagnosticsPlan;

  const addDelmalActions = parseAddDelmalToPlacementInlinePlan(userText);
  if (addDelmalActions.length > 0) {
    return {
      goalSummary: userText.slice(0, 140),
      actions: addDelmalActions,
      confidence: "high",
    };
  }

  const goalPlan = planGoalCatalogAndIup(norm);
  if (goalPlan) return goalPlan;

  const overviewPlan = planAppOverview(norm);
  if (overviewPlan) return overviewPlan;

  const localPlan = parseLocalAgentPlan(userText);
  if (localPlan.length > 0) {
    return {
      goalSummary: userText.slice(0, 140),
      actions: localPlan,
      confidence: localPlan.length >= 2 ? "high" : "medium",
    };
  }

  return null;
}


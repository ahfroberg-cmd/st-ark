import { detectPositionFromEnd, hasNoGapIntent, normalizeSv } from "@/lib/ai/agent/languageLexicon";
import type { LoweredPlanIR as CompilerPlan, IntentIR } from "@/lib/ai/agent/plannerIr";
import { buildTaskGraphFromIntent, lowerTaskGraphToActions } from "@/lib/ai/agent/taskGraph";
import { selectItemsByCursorRule, type CursorItem } from "@/lib/ai/agent/collectionExecutor";

export type CompiledIntentPlan = CompilerPlan;

type CourseCadence = "month" | "half_year" | "term" | "year";

const MAX_SUPERVISION_SHIFT_DAYS_INTENT = 365 * 5;

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

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function collectPlacements(snapshot: unknown): Array<{ id: string; startDate: string; endDate: string }> {
  const rows = Array.isArray((snapshot as any)?.activities) ? (snapshot as any).activities : [];
  const out: Array<{ id: string; startDate: string; endDate: string }> = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const startDate = toIsoDate(row?.exactStartISO) || toIsoDate(row?.startDate);
    const endDate = toIsoDate(row?.exactEndISO) || toIsoDate(row?.endDate);
    if (!startDate || !endDate) continue;
    out.push({ id: String(row?.id || `placement:${i}`), startDate, endDate });
  }
  return out;
}

function compileSinglePlacementNoGapExtendIntent(input: {
  userText: string;
  snapshot?: unknown;
}): CompiledIntentPlan | null {
  const norm = normalizeSv(input.userText);
  if (!/\bplacering[a-z]*\b/.test(norm)) return null;
  if (!hasNoGapIntent(norm)) return null;
  if (!/(forlang|förläng|justera|fyll)/.test(norm)) return null;

  const placements = collectPlacements(input.snapshot);
  if (placements.length < 2) {
    return {
      goalSummary: "Förläng placering för att fylla glapp",
      actions: [],
      confidence: "medium",
      clarifyingQuestion: "Jag behöver minst två placeringar för att kunna fylla glapp framåt.",
      notes: ["intent_compiler:single_extend:insufficient_placements"],
    };
  }
  const positionFromEnd = Math.max(1, detectPositionFromEnd(input.userText));
  const byEndDesc = [...placements].sort((a, b) =>
    a.endDate === b.endDate ? b.startDate.localeCompare(a.startDate) : b.endDate.localeCompare(a.endDate)
  );
  const target = byEndDesc[positionFromEnd - 1];
  if (!target) {
    return {
      goalSummary: "Förläng placering för att fylla glapp",
      actions: [],
      confidence: "medium",
      clarifyingQuestion: `Jag hittar inte placering #${positionFromEnd} från slutet i tidslinjen.`,
      notes: ["intent_compiler:single_extend:position_out_of_range"],
    };
  }
  const nextByStart = [...placements]
    .filter((p) => p.startDate > target.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (!nextByStart) {
    return {
      goalSummary: "Förläng placering för att fylla glapp",
      actions: [],
      confidence: "medium",
      clarifyingQuestion: "Jag hittar ingen efterföljande placering att fylla glapp mot.",
      notes: ["intent_compiler:single_extend:no_next_placement"],
    };
  }
  const endDate = addDaysIso(nextByStart.startDate, -1);
  if (endDate <= target.endDate) {
    return {
      goalSummary: "Förläng placering för att fylla glapp",
      actions: [],
      confidence: "medium",
      clarifyingQuestion: "Det verkar inte finnas något glapp framåt att fylla för den placeringen.",
      notes: ["intent_compiler:single_extend:no_gap_forward"],
    };
  }
  return {
    goalSummary: `Förläng placering #${positionFromEnd} från slutet till nästa placering`,
    actions: [{ type: "extend_last_placement", positionFromEnd, endDate }],
    confidence: "high",
    notes: ["intent_compiler:single_extend:no_gap_forward"],
  };
}

function parseScaleFactor(norm: string): number | null {
  if (/(halvera|halver)/.test(norm)) return 0.5;
  const percent = norm.match(/(?:till|ca)?\s*(\d{1,3})\s*%/);
  if (percent) {
    const pct = Number(percent[1]);
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) return pct / 100;
  }
  const fraction = norm.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (fraction) {
    const a = Number(fraction[1]);
    const b = Number(fraction[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 && a <= b) return a / b;
  }
  return null;
}

function extractPlacementLabel(raw: string): string | null {
  const quoted = raw.match(/["”]([^"”]+)["”]/);
  if (quoted && quoted[1]) return String(quoted[1]).trim() || null;
  const m =
    raw.match(/(?:alla|samtliga|de)\s+ska\s+vara\s+([^\n.,;:]+)$/i) ||
    raw.match(/(?:vara|bli)\s+([^\n.,;:]+)$/i);
  if (!m || !m[1]) return null;
  const label = String(m[1]).trim();
  return label.length >= 2 ? label : null;
}

function deriveTimelineIntent(userText: string): IntentIR | null {
  const norm = normalizeSv(userText);
  const mentionsPlacement = /\bplacering[a-z]*\b/.test(norm);
  const hasAllScope = /\b(alla|samtliga|hela)\b/.test(norm);
  if (!mentionsPlacement || !hasAllScope) return null;

  const mentionsGap = /\b(glapp(?:et|en)?|luck(?:a|or|an|orna)|mellanrum)\b/.test(norm);
  const asksAdd = /(lagg till|lägg till|lagg in|lägg in|skapa|planera)/.test(norm);
  if (mentionsGap && asksAdd) {
    return {
      id: "timeline.fill_gaps_with_placements",
      domain: "timeline",
      operation: "timeline.fill_gaps_with_placements",
      params: {
        label: extractPlacementLabel(userText) || "Klinisk tjänstgöring",
        goalSummary: "Fyll luckor med placeringar",
      },
      confidence: "high",
    };
  }

  const asksRepair = /(justera|fixa|fyll|stang|tapp|forlang|koppla|synka|eliminera|ta bort)/.test(norm);
  if (mentionsGap && asksRepair) {
    return {
      id: "timeline.repair_gaps_by_extending_preceding",
      domain: "timeline",
      operation: "timeline.repair_gaps_by_extending_preceding",
      params: { goalSummary: "Justera luckor genom att förlänga placeringar" },
      confidence: "high",
    };
  }

  const asksLengthTransform = /(langd|längd|halv|halver|minska|korta|skala)/.test(norm);
  if (asksLengthTransform) {
    const factor = parseScaleFactor(norm);
    if (!factor) return null;
    const anchor: "start" | "end" = /(ta bort forsta halvan|ta bort första halvan|behall slut|behåll slut)/.test(
      norm
    )
      ? "end"
      : "start";
    return {
      id: "timeline.scale_duration",
      domain: "timeline",
      operation: "timeline.scale_duration",
      params: {
        factor,
        anchor,
        goalSummary: `Skala alla placeringars längd till ${Math.round(factor * 100)}%`,
      },
      confidence: "high",
    };
  }

  return null;
}

function extractCountNearCourses(norm: string): number | null {
  const numeric = norm.match(/(\d{1,2})\s+kurser?/);
  if (numeric) {
    const n = Number(numeric[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const worded = norm.match(/([a-z0-9]+)\s+kurser?/);
  if (worded) {
    const n = SV_NUMBERS[worded[1]];
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function deriveCourseCadence(norm: string): CourseCadence | null {
  if (/(per\s+termin|terminsvis)/.test(norm)) return "term";
  if (/(per\s+halv[aå]r|halvarsvis|halvårsvis)/.test(norm)) return "half_year";
  if (/(per\s+manad|per\s+m[aå]nad|manadsvis|månadsvis)/.test(norm)) return "month";
  if (/(per\s+ar|arsvis|årsvis)/.test(norm)) return "year";
  return null;
}

function compileCourseIntent(userText: string): IntentIR | null {
  const norm = normalizeSv(userText);
  const mentionsCourses = /\bkurs(?:er)?\b/.test(norm);
  if (!mentionsCourses) return null;

  const mentionsMilestones = /\b(delmal|mål|mal|kursdelmal)\b/.test(norm);
  const asksCoverage = /(tack|täck|cover|omfatta|mappa|koppla)/.test(norm);
  const asksPlanning = /(planera|fordela|fördela|jamn|jämn|sprid)/.test(norm);
  const asksSync = /(synk|synka|matcha|uppdatera)/.test(norm) && mentionsMilestones;
  const targetCount = extractCountNearCourses(norm) || undefined;
  const cadence = deriveCourseCadence(norm);
  const itemsPerCadence =
    (cadence === "term" || cadence === "half_year"
      ? extractCountNearCourses(norm)
      : null) || undefined;

  const shouldCompile = mentionsMilestones && (asksCoverage || asksPlanning || asksSync);
  if (!shouldCompile) return null;
  return {
    id: "courses.cover_distribute_sync",
    domain: "courses",
    operation: "courses.cover_distribute_sync",
    params: {
      targetCount,
      cadence,
      itemsPerCadence: Math.max(1, Math.min(12, itemsPerCadence || (cadence === "month" ? 1 : 2))),
      goalSummary: "Planera kurser mot delmål med distribution och synk",
    },
    confidence: asksSync && asksPlanning ? "high" : "medium",
  };
}

function collectCourses(snapshot: unknown): Array<{
  id: string;
  title: string;
  startDate: string | null;
  month: number | null;
  year: number | null;
}> {
  const rows = Array.isArray((snapshot as any)?.courses) ? (snapshot as any).courses : [];
  return rows.map((c: any, idx: number) => {
    const title = String(c?.title || c?.name || `Kurs ${idx + 1}`).trim();
    const startRaw =
      typeof c?.startDate === "string"
        ? c.startDate
        : typeof c?.certificateDate === "string"
          ? c.certificateDate
          : "";
    const m = String(startRaw).match(/^(\d{4})-(\d{2})-/);
    const year = m ? Number(m[1]) : null;
    const month = m ? Number(m[2]) : null;
    return {
      id: String(c?.id || `course:${idx}:${title}`),
      title: title || `Kurs ${idx + 1}`,
      startDate: startRaw ? String(startRaw).slice(0, 10) : null,
      month,
      year,
    };
  });
}

function extractAfterAnchor(userText: string): string | null {
  const m =
    userText.match(/efter\s+([^:.,;\n]+)\s*[:.,;]?/i) ||
    userText.match(/^([^:]+):\s*ta bort varannan kurs/i);
  if (!m || !m[1]) return null;
  const q = String(m[1]).trim();
  return q.length >= 2 ? q : null;
}

function extractQuotedName(userText: string): string | null {
  const m = userText.match(/["”]([^"”]+)["”]/);
  if (!m?.[1]) return null;
  const v = String(m[1]).trim();
  return v.length >= 2 ? v : null;
}

function extractTemporalFilters(norm: string): {
  year?: number;
  month?: number;
  beforeDate?: string;
  afterDate?: string;
} {
  const out: { year?: number; month?: number; beforeDate?: string; afterDate?: string } = {};
  const yearMatch = norm.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const monthNames: Record<string, number> = {
    januari: 1,
    februari: 2,
    mars: 3,
    april: 4,
    maj: 5,
    juni: 6,
    juli: 7,
    augusti: 8,
    september: 9,
    oktober: 10,
    november: 11,
    december: 12,
  };
  const monthMatch = norm.match(
    /\b(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\b/
  );
  const month = monthMatch ? monthNames[monthMatch[1]] : null;
  if (/(i|under)\s+20\d{2}/.test(norm) && year) out.year = year;
  if (year && month) {
    out.year = year;
    out.month = month;
  }
  if (/\bfore\b/.test(norm) && year) out.beforeDate = `${year}-01-01`;
  if (/\befter\b/.test(norm) && year) out.afterDate = `${year}-12-31`;
  const iso = norm.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) {
    if (/\bfore\b/.test(norm)) out.beforeDate = iso[1];
    if (/\befter\b/.test(norm)) out.afterDate = iso[1];
  }
  return out;
}

function compileCollectionDeleteIntent(input: {
  userText: string;
  snapshot?: unknown;
}): CompilerPlan | null {
  const userText = String(input.userText || "");
  const norm = normalizeSv(userText);
  if (!/(ta bort|radera|delete)/.test(norm)) return null;
  if (/(vald[a]?|markerad[a]?|den valda|den markerade|nuvarande)/.test(norm)) return null;
  const target: "courses" | "placements" | null = /\bkurs(?:er)?\b/.test(norm)
    ? "courses"
    : /\bplacering[a-z]*\b/.test(norm)
      ? "placements"
      : null;
  if (!target) return null;

  const asksAll = /\b(alla|samtliga|hela)\b/.test(norm);
  const asksEveryOther = /(varannan|var annan|var\s+2:a|var\s+andra|every\s+other)/.test(norm);
  const anchor = extractAfterAnchor(userText);
  const matchQuery = extractQuotedName(userText);
  const temporal = extractTemporalFilters(norm);
  const hasTemporal = Boolean(temporal.year || temporal.month || temporal.beforeDate || temporal.afterDate);
  if (!asksAll && !asksEveryOther && !anchor && !matchQuery && !hasTemporal) return null;

  const count =
    target === "courses"
      ? (Array.isArray((input.snapshot as any)?.courses) ? (input.snapshot as any).courses.length : null)
      : (Array.isArray((input.snapshot as any)?.activities) ? (input.snapshot as any).activities.length : null);
  if (count === 0) {
    return {
      goalSummary: target === "courses" ? "Ta bort kurser" : "Ta bort placeringar",
      actions: [],
      confidence: "medium",
      clarifyingQuestion:
        target === "courses"
          ? "Jag hittar inga kurser i tidslinjen att ta bort."
          : "Jag hittar inga placeringar i tidslinjen att ta bort.",
      notes: [`intent_compiler:delete_collection:no_${target}`],
    };
  }
  const everyN = asksEveryOther ? 2 : 1;
  return {
    goalSummary: target === "courses" ? "Ta bort kurser via urval" : "Ta bort placeringar via urval",
    actions: [
      {
        type: "select_collection",
        target,
        everyN,
        ...(anchor ? { afterQuery: anchor } : {}),
        ...(matchQuery ? { matchQuery } : {}),
        ...(temporal.year ? { year: temporal.year } : {}),
        ...(temporal.month ? { month: temporal.month } : {}),
        ...(temporal.beforeDate ? { beforeDate: temporal.beforeDate } : {}),
        ...(temporal.afterDate ? { afterDate: temporal.afterDate } : {}),
        limit: 200,
      },
      {
        type: "apply_operator_to_collection",
        operator: "delete",
      },
    ],
    confidence: "high",
    notes: [
      `intent_compiler:delete_collection:${target}`,
      ...(asksEveryOther ? ["intent_compiler:delete_collection:every_2"] : []),
      ...(hasTemporal ? ["intent_compiler:delete_collection:temporal_filter"] : []),
    ],
  };
}

function compileDeleteIupFollowupsIntent(input: {
  userText: string;
}): CompilerPlan | null {
  const norm = normalizeSv(String(input.userText || ""));
  if (!/(ta bort|radera|delete|rensa)/.test(norm)) return null;
  if (/(vald[a]?|markerad[a]?|den valda|den markerade|nuvarande)/.test(norm)) return null;
  const wantsMeetings =
    /(handledartraff|handledartillfalle|handledningstillfalle|handledningstillfallen|handledarsamtal|huvudhandledarsamtal)/.test(
      norm
    );
  const wantsAssessments = /(progressionsbedomning|progressionsbedomningar)/.test(norm);
  if (!wantsMeetings && !wantsAssessments) return null;
  return {
    goalSummary:
      wantsMeetings && wantsAssessments
        ? "Ta bort handledartillfällen och progressionsbedömningar"
        : wantsMeetings
          ? "Ta bort handledartillfällen"
          : "Ta bort progressionsbedömningar",
    actions: [
      {
        type: "clear_iup_followups",
        clearMeetings: wantsMeetings,
        clearAssessments: wantsAssessments,
      },
    ],
    confidence: "high",
    notes: [
      "intent_compiler:delete_iup_followups",
      ...(wantsMeetings ? ["intent_compiler:delete_iup_followups:meetings"] : []),
      ...(wantsAssessments ? ["intent_compiler:delete_iup_followups:assessments"] : []),
    ],
  };
}

function compileAddIupFollowupIntent(input: {
  userText: string;
}): CompilerPlan | null {
  const raw = String(input.userText || "").trim();
  const norm = normalizeSv(raw);
  if (!/(lagg till|lagg in|skapa|registrera|bok[a]? in)/.test(norm)) return null;
  const isMeeting =
    /(handledartraff|handledningstillfalle|handledartillfalle|handledarsamtal|huvudhandledarsamtal)/.test(norm);
  const isAssessment = /(progressionsbedomning|bedomningstillfalle|progressionstillfalle)/.test(norm);
  if (!isMeeting && !isAssessment) return null;
  const m =
    raw.match(/\b(\d{4}-\d{2}-\d{2})\b/) ||
    raw.match(
      /\b(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(\d{4})\b/i
    );
  if (!m) return null;
  let dateISO: string | null = null;
  if (m[1] && /^\d{4}-\d{2}-\d{2}$/.test(m[1])) {
    dateISO = m[1];
  } else {
    const monthMap: Record<string, number> = {
      januari: 1, februari: 2, mars: 3, april: 4, maj: 5, juni: 6,
      juli: 7, augusti: 8, september: 9, oktober: 10, november: 11, december: 12,
    };
    const day = Number(m[1]);
    const month = monthMap[String(m[2] || "").toLowerCase()];
    const year = Number(m[3]);
    if (Number.isFinite(day) && month && Number.isFinite(year) && day >= 1 && day <= 31) {
      dateISO = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  if (!dateISO) return null;
  return {
    goalSummary:
      isAssessment ? `Lägg till progressionsbedömning ${dateISO}` : `Lägg till handledningstillfälle ${dateISO}`,
    actions: [
      {
        type: "add_iup_followup",
        followupType: isAssessment ? "assessment" : "meeting",
        dateISO,
      },
    ],
    confidence: "high",
    notes: ["intent_compiler:add_iup_followup"],
  };
}

function compileShiftIupSupervisionMeetingsIntent(input: { userText: string }): CompilerPlan | null {
  const norm = normalizeSv(String(input.userText || ""));
  const mentionsSupervision =
    /(handledarsamtal|huvudhandledarsamtal|handledartraff|handledningstillfalle|handledartillfalle)/.test(norm);
  if (!mentionsSupervision) return null;
  if (!/(flytta|skjut)/.test(norm)) return null;
  if (!/(alla|samtliga|varje)/.test(norm)) return null;
  let days = 7;
  const dagM = norm.match(/(\d+)\s*dagar/);
  if (dagM) {
    days = Math.max(1, Math.min(MAX_SUPERVISION_SHIFT_DAYS_INTENT, Number(dagM[1])));
  } else if (/(en vecka|1 vecka)/.test(norm)) {
    days = 7;
  } else if (/(tva veckor|två veckor|2 veckor)/.test(norm)) {
    days = 14;
  }
  if (/(bak|bakåt)/.test(norm)) days = -Math.abs(days);
  else days = Math.abs(days);
  return {
    goalSummary: `Flytta alla handledarsamtal ${days >= 0 ? "fram" : "bak"}åt ${Math.abs(days)} dagar`,
    actions: [{ type: "shift_iup_supervision_meetings", days }],
    confidence: "high",
    notes: ["intent_compiler:shift_iup_supervision_meetings"],
  };
}

function compileCourseCursorDeleteIntent(input: { userText: string; snapshot?: unknown }): CompilerPlan | null {
  const userText = String(input.userText || "");
  const norm = normalizeSv(userText);
  const asksDelete = /(ta bort|radera|delete)/.test(norm);
  const asksEveryOther = /(varannan|var annan|var\s+2:a|var\s+andra|every\s+other)/.test(norm);
  const mentionsCourse = /\bkurs(?:er)?\b/.test(norm);
  if (!asksDelete || !asksEveryOther || !mentionsCourse) return null;

  const allCourses = collectCourses(input.snapshot);
  if (allCourses.length === 0) {
    return {
      goalSummary: "Ta bort varannan kurs",
      actions: [],
      confidence: "medium",
      clarifyingQuestion: "Jag hittar inga kurser i tidslinjen att arbeta på.",
      notes: ["intent_compiler:cursor_delete:no_courses"],
    };
  }
  const anchor = extractAfterAnchor(userText);
  const cursorItems: CursorItem[] = allCourses.map((c) => ({
    id: c.id,
    title: c.title,
    startDate: c.startDate || undefined,
  }));
  const selection = selectItemsByCursorRule(cursorItems, {
    everyN: 2,
    startAt: 0,
    ...(anchor ? { afterTitle: anchor } : {}),
  });
  const anchorFallback = Boolean(anchor && !selection.anchorFound);
  const effectiveAnchor = anchorFallback ? null : anchor;
  const effectiveSelection = anchorFallback
    ? selectItemsByCursorRule(cursorItems, { everyN: 2, startAt: 0 })
    : selection;
  if (effectiveSelection.selected.length === 0) {
    return {
      goalSummary: "Ta bort varannan kurs",
      actions: [],
      confidence: "medium",
      clarifyingQuestion: "Urvalet gav inga kurser att ta bort med regeln varannan.",
      notes: ["intent_compiler:cursor_delete:empty_selection"],
    };
  }
  const actions = [
    {
      type: "select_collection" as const,
      target: "courses" as const,
      everyN: 2,
      ...(effectiveAnchor ? { afterQuery: effectiveAnchor } : {}),
      limit: 50,
    },
    {
      type: "apply_operator_to_collection" as const,
      operator: "delete" as const,
    },
  ];
  return {
    goalSummary: `Ta bort varannan kurs${effectiveAnchor ? ` efter ${effectiveAnchor}` : ""}`,
    actions,
    confidence: "high",
    notes: [
      "intent_compiler:cursor_delete:every_2",
      `intent_compiler:cursor_selected=${effectiveSelection.selected.length}`,
      ...(anchorFallback ? ["intent_compiler:cursor_anchor_fallback_to_start"] : []),
    ],
  };
}

function compileDeleteAllCoursesIntent(input: {
  userText: string;
  snapshot?: unknown;
}): CompilerPlan | null {
  const norm = normalizeSv(input.userText);
  const asksDelete = /(ta bort|radera|delete)/.test(norm);
  const asksAll = /\b(alla|samtliga|hela)\b/.test(norm);
  const mentionsCourses = /\bkurs(?:er)?\b/.test(norm);
  const asksEveryOther = /(varannan|var annan|var\s+2:a|var\s+andra|every\s+other)/.test(norm);
  if (!asksDelete || !asksAll || !mentionsCourses || asksEveryOther) return null;
  const allCourses = collectCourses(input.snapshot);
  if (allCourses.length === 0) {
    return {
      goalSummary: "Ta bort alla kurser",
      actions: [],
      confidence: "medium",
      clarifyingQuestion: "Jag hittar inga kurser i tidslinjen att ta bort.",
      notes: ["intent_compiler:delete_all_courses:no_courses"],
    };
  }
  return {
    goalSummary: "Ta bort alla kurser",
    actions: [
      {
        type: "select_collection",
        target: "courses",
        everyN: 1,
        limit: 200,
      },
      {
        type: "apply_operator_to_collection",
        operator: "delete",
      },
    ],
    confidence: "high",
    notes: ["intent_compiler:delete_all_courses"],
  };
}

function compilePlacementCursorDeleteIntent(input: {
  userText: string;
  snapshot?: unknown;
}): CompilerPlan | null {
  const userText = String(input.userText || "");
  const norm = normalizeSv(userText);
  const asksDelete = /(ta bort|radera|delete)/.test(norm);
  const asksEveryOther = /(varannan|var annan|var\s+2:a|var\s+andra|every\s+other)/.test(norm);
  const mentionsPlacement = /\bplacering[a-z]*\b/.test(norm);
  if (!asksDelete || !asksEveryOther || !mentionsPlacement) return null;

  const rows = Array.isArray((input.snapshot as any)?.activities) ? (input.snapshot as any).activities : [];
  if (rows.length === 0) {
    return {
      goalSummary: "Ta bort varannan placering",
      actions: [],
      confidence: "medium",
      clarifyingQuestion: "Jag hittar inga placeringar i tidslinjen att arbeta på.",
      notes: ["intent_compiler:cursor_delete_placements:no_placements"],
    };
  }

  const anchor = extractAfterAnchor(userText);
  return {
    goalSummary: `Ta bort varannan placering${anchor ? ` efter ${anchor}` : ""}`,
    actions: [
      {
        type: "select_collection",
        target: "placements",
        everyN: 2,
        ...(anchor ? { afterQuery: anchor } : {}),
        limit: 50,
      },
      {
        type: "apply_operator_to_collection",
        operator: "delete",
      },
    ],
    confidence: "high",
    notes: ["intent_compiler:cursor_delete_placements:every_2"],
  };
}

function compileIupIntent(userText: string): IntentIR | null {
  const norm = normalizeSv(userText);
  if (!/\biup\b/.test(norm)) return null;
  const tab =
    /\bdelmal\b/.test(norm)
      ? "delmal"
      : /\bhandledning\b/.test(norm)
        ? "handledning"
        : /\bprogression\b/.test(norm)
          ? "progression"
          : /\bplanering\b/.test(norm)
            ? "planering"
            : /\brapport\b/.test(norm)
              ? "rapport"
              : null;
  if (!tab) return null;
  const includeSummary = tab === "delmal" && /(visa|sammanfatta|ga igenom|översikt|oversikt)/.test(norm);
  return {
    id: "iup.open_tab_summary",
    domain: "iup",
    operation: "iup.open_tab_summary",
    params: {
      tab,
      includeSummary,
      goalSummary: "Öppna IUP och gå till rätt delvy",
    },
    confidence: includeSummary ? "high" : "medium",
  };
}

function compileIntentIR(userText: string): IntentIR | null {
  return compileCourseIntent(userText) || compileIupIntent(userText) || deriveTimelineIntent(userText);
}

function compileStateIntent(userText: string): CompiledIntentPlan | null {
  const norm = normalizeSv(userText);
  if (/(forhandsvis|preview|diff|vad hander|vad händer)/.test(norm)) {
    if (/(ta|tar)\s+bort\s+vald\s+kurs/.test(norm)) {
      return {
        goalSummary: "Förhandsvisa diff för borttagning av vald kurs",
        actions: [{ type: "preview_action_diff", action: { type: "delete_selected_course" } }],
        confidence: "high",
        notes: ["intent_compiler:state_preview_diff_course_delete"],
      };
    }
    if (/(ta|tar)\s+bort\s+vald\s+placering/.test(norm)) {
      return {
        goalSummary: "Förhandsvisa diff för borttagning av vald placering",
        actions: [{ type: "preview_action_diff", action: { type: "delete_selected_placement" } }],
        confidence: "high",
        notes: ["intent_compiler:state_preview_diff_placement_delete"],
      };
    }
  }
  if (/(aktiv kontext|nuvarande kontext|vad ar valt|vad är valt|current context)/.test(norm)) {
    return {
      goalSummary: "Visa aktiv kontext",
      actions: [{ type: "get_active_context" }],
      confidence: "high",
      notes: ["intent_compiler:state_context"],
    };
  }
  if (/(lista|visa).*(glapp|luckor|mellanrum)/.test(norm)) {
    return {
      goalSummary: "Lista interna glapp i tidslinjen",
      actions: [{ type: "list_internal_gaps" }],
      confidence: "high",
      notes: ["intent_compiler:state_gaps"],
    };
  }
  if (/(lista|visa).*(placering|kurs|objekt).*(tidslinje)|timeline entities/.test(norm)) {
    const target: "placements" | "courses" | "all" = /\bkurser?\b/.test(norm)
      ? "courses"
      : /\bplacering[a-z]*\b/.test(norm)
        ? "placements"
        : "all";
    return {
      goalSummary: "Lista objekt i tidslinjen",
      actions: [{ type: "list_timeline_entities", target }],
      confidence: "high",
      notes: ["intent_compiler:state_entities"],
    };
  }
  if (/(verifiera|kontrollera).*(senaste|forra|förra).*(andring|ändring|effekt)/.test(norm)) {
    return {
      goalSummary: "Verifiera senaste åtgärdseffekt",
      actions: [{ type: "verify_last_action_effect" }],
      confidence: "medium",
      notes: ["intent_compiler:state_verify_last"],
    };
  }
  return null;
}

export function compileIntentPlan(input: {
  userText: string;
  snapshot?: unknown;
}): CompiledIntentPlan | null {
  const singleExtend = compileSinglePlacementNoGapExtendIntent(input);
  if (singleExtend) return singleExtend;
  const statePlan = compileStateIntent(input.userText);
  if (statePlan) return statePlan;
  const shiftSupervision = compileShiftIupSupervisionMeetingsIntent(input);
  if (shiftSupervision) return shiftSupervision;
  const addIupFollowup = compileAddIupFollowupIntent(input);
  if (addIupFollowup) return addIupFollowup;
  const deleteIupFollowups = compileDeleteIupFollowupsIntent(input);
  if (deleteIupFollowups) return deleteIupFollowups;
  const genericDeleteCollection = compileCollectionDeleteIntent(input);
  if (genericDeleteCollection) return genericDeleteCollection;
  const deleteAllCourses = compileDeleteAllCoursesIntent(input);
  if (deleteAllCourses) return deleteAllCourses;
  const cursorDelete = compileCourseCursorDeleteIntent(input);
  if (cursorDelete) return cursorDelete;
  const placementCursorDelete = compilePlacementCursorDeleteIntent(input);
  if (placementCursorDelete) return placementCursorDelete;
  const intent = compileIntentIR(input.userText);
  if (!intent) return null;
  const graph = buildTaskGraphFromIntent(intent, input.snapshot);
  const lowered = lowerTaskGraphToActions(graph, input.snapshot);
  return {
    goalSummary: lowered.goalSummary,
    actions: lowered.actions,
    confidence: lowered.confidence,
    clarifyingQuestion: lowered.clarifyingQuestion,
    notes: [...graph.notes, ...lowered.notes],
  };
}

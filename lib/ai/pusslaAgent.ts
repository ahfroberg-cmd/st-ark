import type { AgentModelStopReason, ParsedAgentResponse, PusslaAgentAction } from "@/lib/ai/types";
import { listRegisteredActionTypes } from "@/lib/ai/agent/actionRegistry";
import { isPusslaAgentAction } from "@/lib/ai/types";
import {
  ADVANCED_PROMPT_BANK_100,
  MIDDLE_ACTION_PROMPT_BANK_100,
} from "@/lib/ai/promptCurriculum";
import { detectPositionFromEnd } from "@/lib/ai/agent/languageLexicon";

function isoDate(value: string): string | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return v;
}

const MONTHS_SV: Record<string, number> = {
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

const PLACEMENT_TYPE_BY_TOKEN: Record<
  string,
  | "Klinisk tjänstgöring"
  | "Vetenskapligt arbete"
  | "Förbättringsarbete"
  | "Auskultation"
  | "Forskning"
  | "Tjänstledighet"
  | "Föräldraledighet"
  | "Annan ledighet"
  | "Sjukskriven"
> = {
  "placering": "Klinisk tjänstgöring",
  "klinisk tjänstgöring": "Klinisk tjänstgöring",
  "klinisk tjanstgoring": "Klinisk tjänstgöring",
  "vetenskapligt arbete": "Vetenskapligt arbete",
  "förbättringsarbete": "Förbättringsarbete",
  "forbattringsarbete": "Förbättringsarbete",
  "auskultation": "Auskultation",
  "forskning": "Forskning",
  "tjänstledighet": "Tjänstledighet",
  "tjanstledighet": "Tjänstledighet",
  "föräldraledighet": "Föräldraledighet",
  "foraldraledighet": "Föräldraledighet",
  "annan ledighet": "Annan ledighet",
  "sjukskriven": "Sjukskriven",
};

const COURSE_KIND_BY_TOKEN: Record<
  string,
  "Kurs" | "Konferens" | "Annat" | "Utbildningsmoment"
> = {
  "kurs": "Kurs",
  "konferens": "Konferens",
  "annat": "Annat",
  "utbildningsmoment": "Utbildningsmoment",
};

function normalizeSv(input: string): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function swedishNumberToInt(value: string): number {
  const t = normalizeSv(value).trim();
  const map: Record<string, number> = {
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
  const parsed = Number(t);
  if (Number.isFinite(parsed)) return parsed;
  return map[t] || 0;
}

function splitMilestoneIdTokens(segment: string): string[] {
  const cleaned = String(segment || "")
    .replace(/\s+och\s+/gi, ", ")
    .replace(/\s+till\s*$/i, "")
    .trim();
  return cleaned
    .split(/[,\s]+/)
    .map((x) => x.trim().toUpperCase())
    .filter((x) => /^[A-Z]{1,3}\d{1,2}$|^ST[A-Z]\d{1,2}$|^BT\d{1,2}$/.test(x));
}

function parseMilestoneList(raw: string): string[] {
  const m = String(raw || "").match(
    /(?:bt[-\s]*delm[aå]l|delm[aå]l)\s*(?:till|:)?\s*([A-Za-z0-9,\s\-._]+)/i
  );
  if (!m) return [];
  return splitMilestoneIdTokens(String(m[1] || ""));
}

/** Fält för update_selected_placement utan att kräva ordet "placering" i samma fras. */
function collectPlacementUpdateFieldsFromText(raw: string): Record<string, any> {
  const fields: Record<string, any> = {};
  const titleMatch = raw.match(
    /(?:byt namn på|ändra namn på|sätt namn på|placering(?:en)?\s+namn(?:et)?)\s+(?:till\s+)?["”]?([^"”\n]+)["”]?/i
  );
  if (titleMatch) fields.label = String(titleMatch[1] || "").trim();

  const noteQuoted = raw.match(/(?:beskrivning|anteckning)\s*(?:till|:)\s*["“”']([^"“”']+)["“”']/i);
  if (noteQuoted) {
    fields.note = String(noteQuoted[1] || "").trim();
  } else {
    const noteTail = raw.match(
      /(?:beskrivning|anteckning)\s*(?:till|:)\s*([\s\S]+?)(?=\s+och\s+(?:spara|sätt|satt)|$)/i
    );
    if (noteTail) fields.note = String(noteTail[1] || "").trim().replace(/^["']|["']$/g, "");
  }

  const supMatch = raw.match(/handledare\s*(?:till|:)\s*["”]?([^"”\n]+)["”]?/i);
  if (supMatch) fields.supervisor = String(supMatch[1] || "").trim();

  const supSpecGen = raw.match(
    /(?:handledares|handledarens|huvudhandledares|huvudhandledarens)\s+specialitet\s*(?:till|:)\s*["“”']?([^"“”'\n,]+)["“”']?/i
  );
  if (supSpecGen) {
    fields.supervisorSpeciality = String(supSpecGen[1] || "").trim();
  } else {
    const supSpecMatch = raw.match(
      /(?:handledar|huvudhandledar)(?:ens|es|e)?s?\s+specialitet\s*(?:till|:)\s*["“”']?([^"“”'\n,]+)["“”']?/i
    );
    if (supSpecMatch) fields.supervisorSpeciality = String(supSpecMatch[1] || "").trim();
  }
  const supSpecForMatch = raw.match(
    /specialitet\s+för\s+(?:handledar|huvudhandledar)(?:en|e|n)?\s*(?:till|:)\s*["“”']?([^"“”'\n,]+)["“”']?/i
  );
  if (supSpecForMatch) fields.supervisorSpeciality = String(supSpecForMatch[1] || "").trim();

  const supSiteGen = raw.match(
    /(?:handledares|handledarens|huvudhandledares|huvudhandledarens)\s+(?:tjänsteställe|tjanstestalle)\s*(?:till|:)\s*["“”']?([^"“”'\n,]+)["“”']?/i
  );
  if (supSiteGen) {
    fields.supervisorSite = String(supSiteGen[1] || "").trim();
  } else {
    const supSiteMatch = raw.match(
      /(?:handledar|huvudhandledar)(?:ens|es|e)?s?\s+(?:tjänsteställe|tjanstestalle)\s*(?:till|:)\s*["“”']?([^"“”'\n,]+)["“”']?/i
    );
    if (supSiteMatch) fields.supervisorSite = String(supSiteMatch[1] || "").trim();
  }
  const supSiteForMatch = raw.match(
    /(?:tjänsteställe|tjanstestalle)\s+för\s+(?:handledar|huvudhandledar)(?:en|e|n)?\s*(?:till|:)\s*["“”']?([^"“”'\n,]+)["“”']?/i
  );
  if (supSiteForMatch) fields.supervisorSite = String(supSiteForMatch[1] || "").trim();

  const attMatch = raw.match(/(?:syssels[äa]ttningsgrad|närvaro)\s*(?:till|:)?\s*([0-9]{1,3})\s*%?/i);
  if (attMatch) fields.attendance = Number(attMatch[1]);
  const startMatch = raw.match(/start(?:datum)?\s*(?:till|:)\s*(\d{4}-\d{2}-\d{2})/i);
  if (startMatch) fields.startDate = startMatch[1];
  const endMatch = raw.match(/slut(?:datum)?\s*(?:till|:)\s*(\d{4}-\d{2}-\d{2})/i);
  if (endMatch) fields.endDate = endMatch[1];
  const phaseMatch = raw.match(/\bfas\s*(?:till|:)?\s*(BT|ST)\b/i);
  if (phaseMatch) fields.phase = phaseMatch[1].toUpperCase();
  const leaveSubtypeMatch = raw.match(
    /(?:ledighetstyp|subtyp)\s*(?:till|:)\s*["”]?([^"”\n]+)["”]?/i
  );
  if (leaveSubtypeMatch) fields.leaveSubtype = String(leaveSubtypeMatch[1] || "").trim();

  if (/bt[-\s]*delm[aå]l/i.test(raw)) {
    const list = parseMilestoneList(raw);
    if (list.length > 0) fields.btMilestones = list;
  } else if (/delm[aå]l/i.test(raw)) {
    const list = parseMilestoneList(raw);
    if (list.length > 0) fields.milestones = list;
  }

  return fields;
}

export function parsePlacementCommand(input: string): PusslaAgentAction | null {
  const text = input.trim();
  const rx =
    /(lägg\s+in|lagg\s+in|lägg\s+till|skapa|planera)\s+placering(?:\s+(.+?))?\s+från\s+(\d{4}-\d{2}-\d{2})\s+till\s+(\d{4}-\d{2}-\d{2})/i;
  const m = text.match(rx);
  if (!m) return null;

  const title = (m[2] || "Klinisk tjänstgöring").trim();
  const startDate = isoDate(m[3]);
  const endDate = isoDate(m[4]);
  if (!startDate || !endDate) return null;

  return {
    type: "create_placement_from_range",
    title,
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
  };
}

export function parseTypedPlacementCommand(input: string): PusslaAgentAction | null {
  const text = input.trim();
  const rx =
    /(lägg\s+in|lagg\s+in|lägg\s+till|skapa|planera)\s+(placering|klinisk\s+tjänstgöring|klinisk\s+tjanstgoring|vetenskapligt\s+arbete|förbättringsarbete|forbattringsarbete|auskultation|forskning|tjänstledighet|tjanstledighet|föräldraledighet|foraldraledighet|annan\s+ledighet|sjukskriven)(?:\s+(.+?))?\s+från\s+(\d{4}-\d{2}-\d{2})\s+till\s+(\d{4}-\d{2}-\d{2})/i;
  const m = text.match(rx);
  if (!m) return null;
  const token = normalizeSv(m[2] || "");
  const placementType = PLACEMENT_TYPE_BY_TOKEN[token];
  if (!placementType) return null;
  const title =
    (m[3] || "").trim() ||
    (placementType === "Klinisk tjänstgöring" ? "Klinisk tjänstgöring" : placementType);
  const startDate = isoDate(m[4]);
  const endDate = isoDate(m[5]);
  if (!startDate || !endDate) return null;
  if (placementType === "Klinisk tjänstgöring") {
    return {
      type: "create_placement_from_range",
      title,
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
    };
  }
  return {
    type: "create_typed_placement_from_range",
    placementType,
    title,
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
  };
}

export function parseNavigateCommand(input: string): PusslaAgentAction | null {
  const t = normalizeSv(input);
  if (t.includes("oppna iup")) {
    return { type: "open_window", window: "iup" };
  }
  if (t.includes("oppna hemklinik")) {
    return { type: "open_window", window: "hemklinik" };
  }
  if (t.includes("oppna skanna intyg") || t.includes("oppna skanning")) {
    return { type: "open_window", window: "scan_intyg" };
  }
  if (t.includes("oppna bt") || t.includes("intyg bastjanstgoring")) {
    return { type: "open_window", window: "bt_ansokan" };
  }
  if (t.includes("oppna specialistansokan")) {
    return { type: "open_window", window: "specialistansokan" };
  }
  if (t.includes("oppna profil")) {
    return { type: "open_window", window: "profile" };
  }
  if (t.includes("oppna om") || t.includes("oppna about")) {
    return { type: "open_window", window: "about" };
  }
  if (t.includes("oppna rapport")) {
    return { type: "open_window", window: "report" };
  }
  if (t.includes("oppna installning") || t.includes("oppna installningar")) {
    return { type: "open_window", window: "settings" };
  }
  if (t.includes("oppna sta3")) {
    return { type: "open_window", window: "sta3" };
  }
  if (t.includes("oppna kursintyg") || t.includes("oppna course prep")) {
    return { type: "open_window", window: "course_prep" };
  }
  if (t.includes("oppna forhandsvisning") || t.includes("oppna preview")) {
    return { type: "open_window", window: "preview" };
  }
  if (t.includes("oppna delmalsover") || t.includes("oppna delmal oversikt")) {
    return { type: "open_window", window: "milestone_overview" };
  }
  if (t.includes("stang iup")) {
    return { type: "close_window", window: "iup" };
  }
  if (t.includes("stang hemklinik")) {
    return { type: "close_window", window: "hemklinik" };
  }
  if (t.includes("stang skanna intyg") || t.includes("stang skanning")) {
    return { type: "close_window", window: "scan_intyg" };
  }
  if (t.includes("stang bt")) {
    return { type: "close_window", window: "bt_ansokan" };
  }
  if (t.includes("stang specialistansokan")) {
    return { type: "close_window", window: "specialistansokan" };
  }
  if (t.includes("stang profil")) {
    return { type: "close_window", window: "profile" };
  }
  if (t.includes("stang om") || t.includes("stang about")) {
    return { type: "close_window", window: "about" };
  }
  if (t.includes("stang rapport")) {
    return { type: "close_window", window: "report" };
  }
  if (t.includes("stang installning") || t.includes("stang installningar")) {
    return { type: "close_window", window: "settings" };
  }
  if (t.includes("stang sta3")) {
    return { type: "close_window", window: "sta3" };
  }
  if (t.includes("stang kursintyg")) {
    return { type: "close_window", window: "course_prep" };
  }
  if (t.includes("stang forhandsvisning") || t.includes("stang preview")) {
    return { type: "close_window", window: "preview" };
  }
  if (t.includes("stang delmalsover") || t.includes("stang delmal oversikt")) {
    return { type: "close_window", window: "milestone_overview" };
  }
  if (t.includes("ga till iup handledning") || t.includes("oppna iup handledning"))
    return { type: "set_iup_tab", tab: "handledning" };
  if (t.includes("ga till iup progression") || t.includes("oppna iup progression"))
    return { type: "set_iup_tab", tab: "progression" };
  if (t.includes("ga till iup planering") || t.includes("oppna iup planering"))
    return { type: "set_iup_tab", tab: "planering" };
  if (t.includes("ga till iup delmal") || t.includes("oppna iup delmal"))
    return { type: "set_iup_tab", tab: "delmal" };
  if (t.includes("ga till iup rapport") || t.includes("oppna iup rapport"))
    return { type: "set_iup_tab", tab: "rapport" };
  if (t.includes("ga till kurs") || t.includes("visa kurs")) {
    return { type: "navigate_lane", lane: "course" };
  }
  if (t.includes("ga till placering") || t.includes("visa placering")) {
    return { type: "navigate_lane", lane: "placement" };
  }
  if (t.includes("spara vald placering")) {
    return { type: "save_selected_placement" };
  }
  if (t.includes("spara vald kurs")) {
    return { type: "save_selected_course" };
  }
  return null;
}

export function parseSelectPlacementCommand(input: string): PusslaAgentAction | null {
  const raw = input.trim();
  const t = normalizeSv(raw);
  if (!/(valj|markera|fokusera)/.test(t) || !/placering/.test(t)) return null;
  const m =
    raw.match(/(?:välj|valj|markera|fokusera)\s+(?:placering(?:en)?)\s+(.+)/i) ||
    raw.match(/placering(?:en)?\s+(.+)/i);
  if (!m) return null;
  const query = String(m[1] || "").trim().replace(/^["']|["']$/g, "");
  if (!query) return null;
  return { type: "select_placement", query };
}

export function parseSelectCourseCommand(input: string): PusslaAgentAction | null {
  const raw = input.trim();
  const t = normalizeSv(raw);
  if (!/(valj|markera|fokusera)/.test(t) || !/kurs|utbildningsmoment|konferens/.test(t))
    return null;
  const m =
    raw.match(/(?:välj|valj|markera|fokusera)\s+(?:kurs(?:en)?|utbildningsmoment(?:et)?|konferens(?:en)?)\s+(.+)/i) ||
    raw.match(/(?:kurs(?:en)?|utbildningsmoment(?:et)?|konferens(?:en)?)\s+(.+)/i);
  if (!m) return null;
  const query = String(m[1] || "").trim().replace(/^["']|["']$/g, "");
  if (!query) return null;
  return { type: "select_course", query };
}

export function parseUpdateSelectedPlacementCommand(input: string): PusslaAgentAction | null {
  const raw = input.trim();
  const t = normalizeSv(raw);
  if (!/(placering)/.test(t)) return null;
  const fields = collectPlacementUpdateFieldsFromText(raw);
  if (Object.keys(fields).length === 0) return null;
  return { type: "update_selected_placement", fields };
}

export function parseUpdateSelectedCourseCommand(input: string): PusslaAgentAction | null {
  const raw = input.trim();
  const t = normalizeSv(raw);
  if (!/(kurs|utbildningsmoment|konferens)/.test(t)) return null;
  const fields: Record<string, any> = {};
  const titleMatch = raw.match(/(?:byt namn på|ändra namn på|sätt namn på|kurs(?:en)?\s+namn(?:et)?)\s+(?:till\s+)?["”]?([^"”\n]+)["”]?/i);
  if (titleMatch) fields.title = String(titleMatch[1] || "").trim();
  const noteMatch = raw.match(/(?:beskrivning|anteckning)\s*(?:till|:)\s*([\s\S]+)$/i);
  if (noteMatch) fields.note = String(noteMatch[1] || "").trim().replace(/^["']|["']$/g, "");
  const cityMatch = raw.match(/stad\s*(?:till|:)\s*["”]?([^"”\n]+)["”]?/i);
  if (cityMatch) fields.city = String(cityMatch[1] || "").trim();
  const leaderMatch = raw.match(/(?:kursledare|kursansvarig)\s*(?:till|:)\s*["”]?([^"”\n]+)["”]?/i);
  if (leaderMatch) fields.courseLeaderName = String(leaderMatch[1] || "").trim();
  const startMatch = raw.match(/start(?:datum)?\s*(?:till|:)\s*(\d{4}-\d{2}-\d{2})/i);
  if (startMatch) fields.startDate = startMatch[1];
  const endMatch = raw.match(/slut(?:datum)?\s*(?:till|:)\s*(\d{4}-\d{2}-\d{2})/i);
  if (endMatch) fields.endDate = endMatch[1];
  const certMatch = raw.match(/(?:intygsdatum|certifikatdatum)\s*(?:till|:)\s*(\d{4}-\d{2}-\d{2})/i);
  if (certMatch) fields.certificateDate = certMatch[1];
  const phaseMatch = raw.match(/\bfas\s*(?:till|:)?\s*(BT|ST)\b/i);
  if (phaseMatch) fields.phase = phaseMatch[1].toUpperCase();
  const kindMatch = raw.match(/\btyp\s*(?:till|:)\s*(kurs|konferens|annat|utbildningsmoment)\b/i);
  if (kindMatch) {
    const token = normalizeSv(kindMatch[1]);
    if (token === "kurs") fields.courseKind = "Kurs";
    if (token === "konferens") fields.courseKind = "Konferens";
    if (token === "annat") fields.courseKind = "Annat";
    if (token === "utbildningsmoment") fields.courseKind = "Utbildningsmoment";
  }
  if (/bt[-\s]*delm[aå]l/i.test(raw)) {
    const list = parseMilestoneList(raw);
    if (list.length > 0) fields.btMilestones = list;
  } else if (/delm[aå]l/i.test(raw)) {
    const list = parseMilestoneList(raw);
    if (list.length > 0) fields.milestones = list;
  }
  if (Object.keys(fields).length === 0) return null;
  return { type: "update_selected_course", fields };
}

function extractProfilePhoneFromExplicitTill(raw: string): string | null {
  const m =
    raw.match(
      /(?:andra|ändra)\s+telefonnummer(?:et)?\s+till\s+([0-9+\-\s()]{4,})/i
    ) ||
    raw.match(/telefonnummer(?:et)?\s+till\s+([0-9+\-\s()]{4,})/i) ||
    raw.match(/\bmobil(?:nummer)?\s+till\s+([0-9+\-\s()]{4,})/i);
  if (!m) return null;
  const phone = String(m[1] || "").trim();
  return phone.length >= 4 ? phone : null;
}

export function parseSetAllProfilePhoneNumbersCommand(
  input: string
): PusslaAgentAction | null {
  const raw = input.trim();
  const t = normalizeSv(raw);

  const looksMultiStep =
    /\s+(?:och sedan|sedan|och|därefter|först|forst)\s+|[.;]\s*/i.test(raw);

  const explicitTill = extractProfilePhoneFromExplicitTill(raw);
  if (explicitTill && looksMultiStep) {
    return null;
  }

  const asksAllPhones =
    /telefonnummer/.test(t) &&
    (/alla/.test(t) || /samtliga/.test(t)) &&
    /(fyll i|satt|ange|uppdatera)/.test(t);

  let phoneNumber: string | null = explicitTill;

  if (!phoneNumber && asksAllPhones) {
    const m = raw.match(/(?:fyll i|sätt|ange|uppdatera)\s+([0-9+\-\s()]{4,})/i);
    if (m) phoneNumber = String(m[1] || "").trim() || null;
  }

  if (!phoneNumber) return null;

  if (explicitTill || asksAllPhones) {
    return { type: "set_all_profile_phone_numbers", phoneNumber };
  }

  return null;
}

export function parseDeletePlacementCommand(input: string): PusslaAgentAction | null {
  const text = input.trim().toLowerCase();
  const rx = /ta\s+bort\s+placering(?:en)?(?:\s+som\s+börjar\s+i)?\s+([a-zåäö]+)\s+(\d{4})/i;
  const m = text.match(rx);
  if (!m) return null;
  const month = MONTHS_SV[m[1].toLowerCase()];
  const year = Number(m[2]);
  if (!month || !Number.isFinite(year)) return null;
  return { type: "delete_placement_by_month_year", month, year };
}

export function parseDeleteCourseCommand(input: string): PusslaAgentAction | null {
  const text = input.trim().toLowerCase();
  const rx = /ta\s+bort\s+kurs(?:en)?(?:\s+som\s+börjar\s+i)?\s+([a-zåäö]+)\s+(\d{4})/i;
  const m = text.match(rx);
  if (!m) return null;
  const month = MONTHS_SV[m[1].toLowerCase()];
  const year = Number(m[2]);
  if (!month || !Number.isFinite(year)) return null;
  return { type: "delete_course_by_month_year", month, year };
}

export function parseDeleteSelectedCommand(input: string): PusslaAgentAction | null {
  const t = normalizeSv(input.trim());
  if (/(forhandsvis|preview|diff|vad hander)/.test(t)) return null;
  if (!/(ta bort|radera|delete)/.test(t)) return null;
  const hasSelectedHint = /(vald[a]?|markerad[a]?|den valda|den markerade|nuvarande)/.test(t);
  if (!hasSelectedHint) return null;
  if (/\bkurs|utbildningsmoment|konferens\b/.test(t)) {
    return { type: "delete_selected_course" };
  }
  if (/\bplacering|aktivitet\b/.test(t)) {
    return { type: "delete_selected_placement" };
  }
  return null;
}

export function parseConvertCourseToUtbildningsmomentCommand(input: string): PusslaAgentAction | null {
  const t = input.trim();
  const lower = t.toLowerCase();
  const wantsConvert =
    /utbildningsmoment/.test(lower) ||
    /gör\s+om/.test(lower) ||
    /konvertera/.test(lower) ||
    /ändra\s+kursen\b/.test(lower) ||
    /\bändra\s+kurs\b/.test(lower);
  if (!wantsConvert) return null;

  const my = t.match(/\bi\s+([a-zåäö]+)\s+(\d{4})/i);
  if (!my) return null;
  const month = MONTHS_SV[my[1].toLowerCase()];
  const year = Number(my[2]);
  if (!month || !Number.isFinite(year)) return null;

  const beforeI = t.split(/\s+i\s+[a-zåäö]+\s+\d{4}/i)[0];
  let title = beforeI
    .replace(/^(?:gör\s+om|konvertera|ändra)(?:\s+kursen|\s+kurs)?\s+/i, "")
    .trim();

  const qm = t.match(/"([^"]+)"|'([^']+)'/);
  if (qm) {
    const qt = String(qm[1] || qm[2] || "").trim();
    if (qt && (!title || title.length < 2)) title = qt;
  }

  if (!title || title.length < 2) return null;
  if (title.toLowerCase().includes("utbildningsmoment")) return null;

  let description: string | undefined;
  const descMatch = t.match(
    /(?:i\s+beskrivning(?:en)?\s*[:\-]|beskrivning\s*[:\-])\s*([\s\S]+)$/i
  );
  if (descMatch) {
    const cleaned = String(descMatch[1] || "").trim().replace(/^["']|["']$/g, "");
    if (cleaned) description = cleaned;
  }

  return { type: "convert_course_to_utbildningsmoment", courseTitle: title, month, year, description };
}

export function parseCreateCourseCommand(input: string): PusslaAgentAction | null {
  const text = input.trim();
  const rx =
    /(lägg\s+in|lagg\s+in|lägg\s+till|skapa|planera)\s+kurs(?:\s+(.+?))?\s+från\s+(\d{4}-\d{2}-\d{2})\s+till\s+(\d{4}-\d{2}-\d{2})/i;
  const m = text.match(rx);
  if (!m) return null;
  const title = (m[2] || "Kurs").trim();
  const startDate = isoDate(m[3]);
  const endDate = isoDate(m[4]);
  if (!startDate || !endDate) return null;
  return {
    type: "create_course_from_range",
    title,
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
  };
}

export function parseTypedCourseCommand(input: string): PusslaAgentAction | null {
  const text = input.trim();
  const rx =
    /(lägg\s+in|lagg\s+in|lägg\s+till|skapa|planera)\s+(kurs|konferens|utbildningsmoment|annat)(?:\s+(.+?))?\s+från\s+(\d{4}-\d{2}-\d{2})\s+till\s+(\d{4}-\d{2}-\d{2})/i;
  const m = text.match(rx);
  if (!m) return null;
  const token = normalizeSv(m[2] || "");
  const courseKind = COURSE_KIND_BY_TOKEN[token];
  if (!courseKind) return null;
  const title =
    (m[3] || "").trim() ||
    (courseKind === "Kurs" ? "Kurs" : courseKind);
  const startDate = isoDate(m[4]);
  const endDate = isoDate(m[5]);
  if (!startDate || !endDate) return null;
  return {
    type: "create_typed_course_from_range",
    courseKind,
    title,
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
  };
}

/**
 * Förläng en placering som anges med namn (label), t.ex.
 * "förläng Psykos slutenvård med tre månader" — skiljer från sista/nästsista.
 */
export function parseExtendPlacementByTitleCommand(input: string): PusslaAgentAction | null {
  const raw = input.trim();
  const norm = normalizeSv(raw);
  if (!/(forlang|flrlang)/.test(norm)) return null;

  const candidateLine =
    raw
      .split(/\n/)
      .map((x) => x.trim())
      .filter(Boolean)
      .find(
        (ln) =>
          /(forlang|flrlang|förläng)/i.test(ln) &&
          (/med\s+\S+\s*mån/i.test(ln) || /\btill\s+\d{4}-\d{2}-\d{2}/i.test(ln))
      ) || raw;

  const toDateMatch = candidateLine.match(/\btill\s+(\d{4}-\d{2}-\d{2})/i);
  if (toDateMatch) {
    const endDate = isoDate(toDateMatch[1]);
    if (!endDate) return null;
    const head = candidateLine.split(/\btill\b/i)[0] || "";
    const fm = head.match(/(?:förläng|forlang|flrlang)\s+(.+?)\s*$/i);
    if (!fm) return null;
    let title = String(fm[1] || "").trim();
    title = title.replace(/^(?:placeringen|placering)\s+/i, "").trim();
    title = title.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (title.length < 2) return null;
    const titleNorm = normalizeSv(title);
    if (/\b(sista|nastsista|nast\s*sista|andra|tredje|fjarde|femte)\s+(placering|placeringen)\b/.test(titleNorm)) {
      return null;
    }
    return { type: "extend_last_placement", placementTitle: title, endDate };
  }

  const mm = candidateLine.match(/med\s+([a-zåäö0-9]+)\s*mån/i);
  if (!mm) return null;
  const months = swedishNumberToInt(mm[1]);
  if (!Number.isFinite(months) || months < 1) return null;

  const titleMatch = candidateLine.match(/(?:förläng|forlang|flrlang)\s+(.+?)\s+med\s+/i);
  if (!titleMatch) return null;
  let title = titleMatch[1].trim();
  title = title.replace(/^(?:placeringen|placering)\s+/i, "").trim();
  title = title.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (title.length < 2) return null;

  const titleNorm = normalizeSv(title);
  if (/\b(sista|nastsista|nast\s*sista)\s+(placering|placeringen)\b/.test(titleNorm)) return null;
  if (/^(den\s+|de\s+)?(sista|nastsista|nast\s*sista|andra|tredje)\s+(placering|placeringen)$/.test(titleNorm)) return null;
  if (/^(sista|nastsista|nast\s*sista)$/.test(titleNorm)) return null;
  if (
    /\b(sista|nastsista|nast\s*sista|fran\s+slutet)\b/.test(titleNorm) &&
    /\bplacering\b/.test(titleNorm)
  ) {
    return null;
  }

  return { type: "extend_last_placement", placementTitle: title, months };
}

/**
 * Förkorta en placering som anges med namn (label), t.ex.
 * "förkorta Psykos slutenvård med fyra månader".
 */
export function parseShortenPlacementByTitleCommand(input: string): PusslaAgentAction | null {
  const raw = input.trim();
  const norm = normalizeSv(raw);
  if (!/(forkorta|korta)\b/.test(norm)) return null;

  const candidateLine =
    raw
      .split(/\n/)
      .map((x) => x.trim())
      .filter(Boolean)
      .find(
        (ln) =>
          /(förkorta|forkorta|korta)/i.test(ln) &&
          (/med\s+\S+\s*mån/i.test(ln) || /\btill\s+\d{4}-\d{2}-\d{2}/i.test(ln))
      ) || raw;

  const toDateMatch = candidateLine.match(/\btill\s+(\d{4}-\d{2}-\d{2})/i);
  if (toDateMatch) {
    const endDate = isoDate(toDateMatch[1]);
    if (!endDate) return null;
    const head = candidateLine.split(/\btill\b/i)[0] || "";
    const fm = head.match(/(?:förkorta|forkorta|korta)\s+(.+?)\s*$/i);
    if (!fm) return null;
    let title = String(fm[1] || "").trim();
    title = title.replace(/^(?:placeringen|placering)\s+/i, "").trim();
    title = title.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (title.length < 2) return null;
    const titleNorm = normalizeSv(title);
    if (/\b(sista|nastsista|nast\s*sista|andra|tredje|fjarde|femte)\s+(placering|placeringen)\b/.test(titleNorm)) {
      return null;
    }
    return { type: "extend_last_placement", placementTitle: title, endDate };
  }

  const mm = candidateLine.match(/med\s+([a-zåäö0-9]+)\s*mån/i);
  if (!mm) return null;
  const months = swedishNumberToInt(mm[1]);
  if (!Number.isFinite(months) || months < 1) return null;

  const titleMatch = candidateLine.match(/(?:förkorta|forkorta|korta)\s+(.+?)\s+med\s+/i);
  if (!titleMatch) return null;
  let title = titleMatch[1].trim();
  title = title.replace(/^(?:placeringen|placering)\s+/i, "").trim();
  title = title.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (title.length < 2) return null;

  const titleNorm = normalizeSv(title);
  if (/\b(sista|nastsista|nast\s*sista)\s+(placering|placeringen)\b/.test(titleNorm)) return null;
  if (/^(den\s+|de\s+)?(sista|nastsista|nast\s*sista|andra|tredje)\s+(placering|placeringen)$/.test(titleNorm)) return null;
  if (/^(sista|nastsista|nast\s*sista)$/.test(titleNorm)) return null;
  if (
    /\b(sista|nastsista|nast\s*sista|fran\s+slutet)\b/.test(titleNorm) &&
    /\bplacering\b/.test(titleNorm)
  ) {
    return null;
  }

  return { type: "extend_last_placement", placementTitle: title, months: -months };
}

export function parseShortenLastPlacementCommand(input: string): PusslaAgentAction | null {
  const raw = input.trim();
  const text = normalizeSv(raw);
  if (!/(forkorta|korta)\b/.test(text)) return null;
  if (!/(placering|sista|fran\s+slutet)/.test(text)) return null;

  const positionFromEnd = detectPositionFromEnd(text);
  if (positionFromEnd === 1 && !/sista/.test(text)) return null;

  const withMonths = raw.match(/med\s+([a-zåäö0-9]+)\s+mån/i);
  if (withMonths) {
    const months = swedishNumberToInt(withMonths[1]);
    if (!Number.isFinite(months) || months < 1) return null;
    return { type: "extend_last_placement", positionFromEnd, months: -months };
  }

  return { type: "extend_last_placement", positionFromEnd, months: -1 };
}

export function parseExtendLastPlacementCommand(input: string): PusslaAgentAction | null {
  const raw = input.trim();
  const text = normalizeSv(raw);
  if (!/(forlang|flrlang)/.test(text)) return null;
  if (!/(placering|sista|fran\s+slutet)/.test(text)) return null;

  const positionFromEnd = detectPositionFromEnd(text);
  if (positionFromEnd === 1 && !/sista/.test(text)) return null;

  const toDate = text.match(/till\s+(\d{4}-\d{2}-\d{2})/i);
  if (toDate) {
    const endDate = isoDate(toDate[1]);
    if (!endDate) return null;
    return { type: "extend_last_placement", positionFromEnd, endDate };
  }

  const withMonths = raw.match(/med\s+([a-zåäö0-9]+)\s+mån/i);
  if (withMonths) {
    const months = swedishNumberToInt(withMonths[1]);
    if (!Number.isFinite(months) || months < 1) return null;
    return { type: "extend_last_placement", positionFromEnd, months };
  }

  return { type: "extend_last_placement", positionFromEnd, months: 1 };
}

export function parseShiftPlacementCommand(input: string): PusslaAgentAction | null {
  const raw = input.trim();
  const text = normalizeSv(raw);
  if (!/(knuffa|flytta)\s+fram/.test(text) || !/(placering|sista|fran\s+slutet)/.test(text))
    return null;

  const positionFromEnd = detectPositionFromEnd(text);

  const withMonths = raw.match(/med\s+([a-zåäö0-9]+)\s+mån/i);
  if (withMonths) {
    const months = swedishNumberToInt(withMonths[1]);
    if (!Number.isFinite(months) || months < 1) return null;
    return { type: "shift_placement_from_end", positionFromEnd, months };
  }
  if (/lika\s+mycket/i.test(raw)) {
    return { type: "shift_placement_from_end", positionFromEnd };
  }
  return { type: "shift_placement_from_end", positionFromEnd, months: 1 };
}

export function parseShiftAllCoursesCommand(input: string): PusslaAgentAction | null {
  const raw = input.trim();
  const norm = normalizeSv(raw);
  const hasShiftVerb = /(flytta|skjut|forflytta)/.test(norm);
  const hasDirection = /(fram|fram[aå]t|bak|bak[aå]t)/.test(norm);
  const hasCourseTarget =
    /\bkurser?\b/.test(norm) ||
    /\bkurs(?:erna|en)?\b/.test(norm) ||
    /\bdem\b/.test(norm) ||
    /\bdom\b/.test(norm);
  if (!hasShiftVerb || !hasDirection || !hasCourseTarget) return null;
  if (/\bplacering/.test(norm)) return null;

  let months = 1;
  const numeric = norm.match(/(\d+)\s*manad/);
  if (numeric) {
    months = Math.max(1, Number(numeric[1]));
  } else {
    const token = norm.match(/([a-z0-9]+)\s*manad/);
    if (token) {
      const parsed = swedishNumberToInt(token[1]);
      if (Number.isFinite(parsed) && parsed > 0) months = parsed;
    }
  }
  const direction: "forward" | "backward" =
    /\bbak|\bbak[aå]t/.test(norm) ? "backward" : "forward";
  return { type: "shift_all_courses", months, direction };
}

export function parseTransformAllPlacementsDurationCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  const mentionsPlacement = /\bplacering(?:ar|en)?s?\b/.test(norm);
  const hasAllScope = /\b(alla|samtliga|hela)\b/.test(norm);
  const asksLengthTransform = /(langd|längd|halv|halver|minska|korta|skala)/.test(norm);
  if (!mentionsPlacement || !hasAllScope || !asksLengthTransform) return null;

  let factor: number | null = null;
  if (/(halvera|halver)/.test(norm)) factor = 0.5;
  const percentMatch = norm.match(/(?:till|ca)?\s*(\d{1,3})\s*%/);
  if (!factor && percentMatch) {
    const pct = Number(percentMatch[1]);
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) factor = pct / 100;
  }
  if (!factor) return null;

  const anchor: "start" | "end" = /(ta bort forsta halvan|ta bort första halvan|behall slut|behåll slut)/.test(
    norm
  )
    ? "end"
    : "start";
  return {
    type: "transform_all_placements_duration",
    factor,
    anchor,
  };
}

export function parseRebalanceCoursesPerHalfYearCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  if (!/\bkurser?\b/.test(norm) || !/(termin|halv[aå]r|halvar)/.test(norm)) {
    return null;
  }
  const tokenMatch = norm.match(/([a-z0-9]+)\s+kurser?\s+per\s+(termin|halv[aå]r|halvar)/);
  const hasReplanVerb = /(flytta|omplanera|planera|fordela|fördela|justera)/.test(norm);
  if (!tokenMatch && !hasReplanVerb) return null;
  let count = 2;
  if (tokenMatch) {
    const parsed = swedishNumberToInt(tokenMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) count = parsed;
  }
  return {
    type: "plan_timeline_distribution",
    target: "courses",
    cadence: "half_year",
    itemsPerCadence: Math.max(1, Math.min(6, count)),
  };
}

export function parseColleagueSummaryCommand(input: string): PusslaAgentAction | null {
  const text = input.trim();
  const colleagueCue =
    /kolleg|sammanställ|sammanfatta|information|alla\s+kolleg|beskrivning(?:er)?|st-kolleg/i.test(
      text
    );

  const possessive = text.match(
    /([a-zåäöé]+)s\s+beskrivning\s+av\s+["”]?([^"”\n.]+)/i
  );
  if (possessive) {
    const raw = possessive[1].trim().toLowerCase();
    const placementName = String(possessive[2] || "").trim();
    if (
      placementName.length >= 2 &&
      !raw.startsWith("kolleg") &&
      raw !== "alla" &&
      raw !== "vår" &&
      raw !== "er"
    ) {
      const first = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      return {
        type: "summarize_colleague_placements",
        placementName,
        lineCount: 15,
        style: "neutral",
        colleagueName: first,
      };
    }
  }

  const placementRxStrict =
    /gå\s+igenom\s+alla\s+st-kollegors\s+beskrivningar\s+av\s+placeringen\s+["”]?([^"”]+)["”]?.*sammanfatta\s+på\s+([a-zåäö0-9]+)\s+rader.*akademisk\s+svenska/i;
  const placementMatch = text.match(placementRxStrict);
  if (placementMatch) {
    const placementName = String(placementMatch[1] || "").trim();
    const lineCount = swedishNumberToInt(String(placementMatch[2] || "")) || 10;
    if (!placementName) return null;
    return {
      type: "summarize_colleague_placements",
      placementName,
      lineCount,
      style: "akademisk_svenska",
    };
  }

  const courseRxStrict =
    /gå\s+igenom\s+alla\s+st-kollegors\s+beskrivningar\s+av\s+kursen\s+["”]?([^"”]+)["”]?.*sammanfatta\s+på\s+([a-zåäö0-9]+)\s+rader.*akademisk\s+svenska/i;
  const courseMatch = text.match(courseRxStrict);
  if (courseMatch) {
    const courseName = String(courseMatch[1] || "").trim();
    const lineCount = swedishNumberToInt(String(courseMatch[2] || "")) || 10;
    if (!courseName) return null;
    return {
      type: "summarize_colleague_courses",
      courseName,
      lineCount,
      style: "akademisk_svenska",
    };
  }

  const byDesc = text.match(
    /beskrivning(?:er)?\s+av\s+["”]?([^"”\n.]+?)(?:\.|,|$|\s+med)/i
  );
  if (byDesc && colleagueCue && !/\bkurs(?:en)?\b/i.test(text)) {
    const placementName = String(byDesc[1] || "").trim();
    if (placementName.length >= 3) {
      return {
        type: "summarize_colleague_placements",
        placementName,
        lineCount: 12,
        style: "neutral",
      };
    }
  }

  if (byDesc && colleagueCue && /\bkurs(?:en)?\b/i.test(text)) {
    const courseName = String(byDesc[1] || "").trim();
    if (courseName.length >= 2) {
      return {
        type: "summarize_colleague_courses",
        courseName,
        lineCount: 12,
        style: "neutral",
      };
    }
  }

  const placementRxLoose = text.match(
    /placering(?:en)?\s+["”]?([^"”\n.]+?)(?:["”]|\.|,|$)/i
  );
  if (placementRxLoose && colleagueCue && !/\bkurs/i.test(text)) {
    const placementName = String(placementRxLoose[1] || "").trim();
    if (placementName.length >= 3) {
      return {
        type: "summarize_colleague_placements",
        placementName,
        lineCount: 12,
        style: "neutral",
      };
    }
  }

  return null;
}

export function parsePlanCoursesCoverMilestonesCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  if (!/\bdelmal/.test(norm) || !/\bkurs/.test(norm)) return null;
  const wantsCover =
    /tack/.test(norm) ||
    /\bticka\b/.test(norm) ||
    /\buppfyl/.test(norm) ||
    /\bkrav/.test(norm);
  const wantsCount =
    /\btio\b/.test(norm) ||
    /\b10\b/.test(norm) ||
    /\b(\d{1,2})\s*kurs/.test(norm);
  if (!wantsCover && !wantsCount) return null;

  let targetCount = 10;
  const digitKurs = input.match(/(\d{1,2})\s*kurs/i);
  if (digitKurs) targetCount = Math.max(1, Math.min(40, Number(digitKurs[1])));
  else if (/\btio\b/.test(norm)) targetCount = 10;
  else if (/\b12\b/.test(norm)) targetCount = 12;

  return { type: "plan_courses_cover_course_milestones", targetCount };
}

export function parseSummarizeGoalCatalogCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  const asksAllMilestones =
    (/\balla\b/.test(norm) ||
      /\bvarje\b/.test(norm) ||
      /\benskilda\b/.test(norm) ||
      /\bsamtliga\b/.test(norm)) &&
    /\bdelmal/.test(norm);
  const asksInfoPages =
    /\bdelmal/.test(norm) &&
    (/\binfosida/.test(norm) ||
      /\binformation/.test(norm) ||
      /\bga\s+igenom/.test(norm) ||
      /\bkolla/.test(norm));

  if (!asksAllMilestones && !asksInfoPages) return null;
  return { type: "summarize_goal_catalog" };
}

export function parseSyncCourseMilestonesCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  const asksAllCourses =
    /(uppdater\w*|synka\w*|synk\w*)/.test(norm) &&
    /\balla\b/.test(norm) &&
    /\bkurser?\b/.test(norm);

  const asksMilestones =
    /\bdelmal|delm[aå]l|milestone|kursdelmal|kursdelm[aå]l\b/.test(norm) ||
    /\bdelmal|delm[aå]l\b/.test(norm);

  if (!asksAllCourses) return null;
  // Om användaren inte säger "delmål" explicit, synka ändå delmål utifrån kursens titel.
  return { type: "sync_course_milestones" };
}

export function parseSummarizeAppSectionsCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  const asksAllPages =
    (/\balla\b/.test(norm) || /\bhela\b/.test(norm)) &&
    (/\bsidor\b/.test(norm) || /\bappen\b/.test(norm) || /\bappen\b/.test(norm)) &&
    (/\bga\s+igenom\b/.test(norm) || /\blas\b/.test(norm) || /\bkolla\b/.test(norm));
  if (!asksAllPages) return null;
  return { type: "summarize_app_sections" };
}

export function parseSummarizeRoleViewsCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  const asksRoleViews =
    /\bstudierektor\b|\bhuvudhandledare\b|\bhandledare\b|\broller\b/.test(norm) &&
    (/\bga\s+igenom\b/.test(norm) || /\bsammanfatta\b/.test(norm) || /\blasa\b/.test(norm));
  if (!asksRoleViews) return null;
  return { type: "summarize_role_views" };
}

export function parseGetActiveContextCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  const asksContext =
    /(vad ar valt|vad är valt|aktiv kontext|nuvarande kontext|visa kontext|status just nu)/.test(
      norm
    );
  if (!asksContext) return null;
  return { type: "get_active_context" };
}

export function parseListTimelineEntitiesCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  const asksList = /(lista|visa|printa|skriv ut)/.test(norm);
  const mentionsTimeline = /(tidslinje|placering|kurs|objekt)/.test(norm);
  if (!asksList || !mentionsTimeline) return null;
  const target: "placements" | "courses" | "all" = /\bkurser?\b/.test(norm)
    ? "courses"
    : /\bplacering[a-z]*\b/.test(norm)
      ? "placements"
      : "all";
  return { type: "list_timeline_entities", target };
}

export function parseListInternalGapsCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  const asksGaps = /(lista|visa|hitta|finns det).*(glapp|luckor|mellanrum)/.test(norm);
  if (!asksGaps) return null;
  return { type: "list_internal_gaps" };
}

export function parseVerifyLastActionEffectCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  const asksVerify = /(verifiera|kontrollera|stam av|stäm av).*(senaste|forra|förra).*(andring|ändring|effekt)/.test(
    norm
  );
  if (!asksVerify) return null;
  return { type: "verify_last_action_effect" };
}

export function parseUndoLastAgentMutationCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  if (!/(angra|ångra|aterstall|återställ).*(senaste|forra|förra).*(agent|andring|ändring)/.test(norm)) {
    return null;
  }
  return { type: "undo_last_agent_mutation" };
}

export function parseSelectCollectionCommand(
  input: string
): PusslaAgentAction | null {
  const raw = input.trim();
  const norm = normalizeSv(raw);
  const asksSelect = /(valj|välj|markera|ta ut|select)/.test(norm);
  if (!asksSelect) return null;
  const hasCollectionIntent =
    /\balla\b|\bsamtliga\b|\bvalda\b|\bmarkerade\b|\bmangd\b|\bselektionsmangd\b/.test(norm) ||
    /\bplaceringar\b|\bkurser\b/.test(norm) ||
    /var\s*\d+/.test(norm);
  if (!hasCollectionIntent) return null;
  if (/(?:välj|valj|markera|fokusera)\s+placering(?:en)?\s+["“”']?[^"“”'\n]+["“”']?/i.test(raw)) {
    return null;
  }
  const target: "placements" | "courses" | null = /\bkurs(?:er)?\b/.test(norm)
    ? "courses"
    : /\bplacering[a-z]*\b/.test(norm)
      ? "placements"
      : null;
  if (!target) return null;
  const everyMatch = norm.match(/var\s*(\d+)/);
  const everyN = everyMatch ? Math.max(1, Number(everyMatch[1])) : undefined;
  const afterMatch = input.match(/efter\s+([^:.,;\n]+)/i);
  const afterQuery = afterMatch?.[1] ? String(afterMatch[1]).trim() : undefined;
  return {
    type: "select_collection",
    target,
    ...(everyN ? { everyN } : {}),
    ...(afterQuery ? { afterQuery } : {}),
  };
}

export function parseApplyOperatorToCollectionCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  const mentionsSelected = /(vald[a]? mangd|valda|markerade|selektionsmangd)/.test(norm);
  if (!mentionsSelected) return null;
  if (/(ta bort|radera|delete)/.test(norm)) {
    return { type: "apply_operator_to_collection", operator: "delete" };
  }
  if (/(flytta|skjut).*(manad|månad)/.test(norm)) {
    const m = norm.match(/(\d+)\s*(manad|månad)/);
    return {
      type: "apply_operator_to_collection",
      operator: "shift_placement_month",
      months: m ? Math.max(1, Number(m[1])) : 1,
    };
  }
  if (/(utbildningsmoment|konvertera|gora om|gör om)/.test(norm)) {
    return { type: "apply_operator_to_collection", operator: "set_course_kind_utbildningsmoment" };
  }
  return null;
}

export function parseClearIupFollowupsCommand(input: string): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  if (!/(ta bort|radera|delete|rensa)/.test(norm)) return null;
  const clearMeetings =
    /(handledartraff|handledartillfalle|handledningstillfalle|handledningstillfallen|handledarsamtal|huvudhandledarsamtal)/.test(
      norm
    );
  const clearAssessments = /(progressionsbedomning|progressionsbedomningar)/.test(norm);
  if (!clearMeetings && !clearAssessments) return null;
  return {
    type: "clear_iup_followups",
    clearMeetings,
    clearAssessments,
  };
}

export function parseAddIupFollowupCommand(input: string): PusslaAgentAction | null {
  const raw = String(input || "").trim();
  const norm = normalizeSv(raw);
  const wantsAdd = /(lagg till|lagg in|skapa|registrera|bok[a]? in)/.test(norm);
  if (!wantsAdd) return null;
  const isMeeting =
    /(handledartraff|handledningstillfalle|handledartillfalle|handledarsamtal|huvudhandledarsamtal)/.test(norm);
  const isAssessment = /(progressionsbedomning|bedomningstillfalle|progressionstillfalle)/.test(norm);
  if (!isMeeting && !isAssessment) return null;
  const m =
    raw.match(/\b(\d{4}-\d{2}-\d{2})\b/) ||
    raw.match(/\b(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(\d{4})\b/i);
  if (!m) return null;
  let dateISO: string | null = null;
  if (m[1] && /^\d{4}-\d{2}-\d{2}$/.test(m[1])) {
    dateISO = isoDate(m[1]);
  } else {
    const day = Number(m[1]);
    const month = MONTHS_SV[String(m[2] || "").toLowerCase()];
    const year = Number(m[3]);
    if (Number.isFinite(day) && month && Number.isFinite(year) && day >= 1 && day <= 31) {
      dateISO = isoDate(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
  }
  if (!dateISO) return null;
  return {
    type: "add_iup_followup",
    followupType: isAssessment ? "assessment" : "meeting",
    dateISO,
  };
}

export function parsePreviewActionDiffCommand(
  input: string
): PusslaAgentAction | null {
  const norm = normalizeSv(input.trim());
  if (/(ta|tar)\s+bort\s+vald\s+kurs/.test(norm)) {
    return { type: "preview_action_diff", action: { type: "delete_selected_course" } };
  }
  if (/(ta|tar)\s+bort\s+vald\s+placering/.test(norm)) {
    return { type: "preview_action_diff", action: { type: "delete_selected_placement" } };
  }
  if (!/(forhandsvis|preview|diff|vad hander)/.test(norm)) return null;
  let nested =
    parseDeleteSelectedCommand(input) ||
    parseShiftAllCoursesCommand(input) ||
    parseShiftPlacementCommand(input);
  if (!nested) {
    if (/(ta bort).*(vald).*(kurs)/.test(norm)) nested = { type: "delete_selected_course" };
    else if (/(ta bort).*(vald).*(placering)/.test(norm))
      nested = { type: "delete_selected_placement" };
  }
  if (!nested) return null;
  return { type: "preview_action_diff", action: nested };
}

export function parseSrTemplateMasterPlanCommand(input: string): PusslaAgentAction | null {
  const text = input.trim();
  const norm = normalizeSv(text);

  const mentionsStudierektorOrSr =
    /\bsr\b/.test(norm) || (norm.includes("studi") && norm.includes("rekto"));
  const wantsOnlySrCoursesEvenly =
    mentionsStudierektorOrSr &&
    /\bkurs/.test(norm) &&
    /\ben\s+av\s+varje\b/.test(norm) &&
    !/\bplacering/.test(norm) &&
    (/\blagg\s+in\b/.test(norm) ||
      /\bplanera\b/.test(norm) ||
      /\bskapa\b/.test(norm) ||
      /\bjamnt\b/.test(norm) ||
      /\bfordel/.test(norm) ||
      /\bhela\s+st/.test(norm));
  if (wantsOnlySrCoursesEvenly) {
    let monthlySupervision = 1;
    const monthMatch = norm.match(/([a-z0-9]+)\s+handledartraff.*manad/);
    if (monthMatch) {
      const parsed = swedishNumberToInt(monthMatch[1]);
      if (parsed > 0) monthlySupervision = parsed;
    }
    let assessmentsPerTerm = 2;
    const termMatch = norm.match(/([a-z0-9]+)\s+progressionsbedomning(?:ar)?\s+per\s+termin/);
    if (termMatch) {
      const parsed = swedishNumberToInt(termMatch[1]);
      if (parsed > 0) assessmentsPerTerm = parsed;
    }
    return {
      type: "plan_st_from_sr_templates",
      includePlacements: false,
      includeCourses: true,
      includeUtbildningsmoment: false,
      monthlySupervision: Math.max(1, Math.min(8, monthlySupervision)),
      assessmentsPerTerm: Math.max(1, Math.min(8, assessmentsPerTerm)),
    };
  }

  const hasSrTemplateIntent =
    /planera\s+en\s+st/.test(norm) &&
    mentionsStudierektorOrSr &&
    /(placering|kurser|kurs)/.test(norm);
  if (!hasSrTemplateIntent) return null;

  let monthlySupervision = 1;
  const monthMatch = norm.match(/([a-z0-9]+)\s+handledartraff.*manad/);
  if (monthMatch) {
    const parsed = swedishNumberToInt(monthMatch[1]);
    if (parsed > 0) monthlySupervision = parsed;
  }

  let assessmentsPerTerm = 2;
  const termMatch = norm.match(/([a-z0-9]+)\s+progressionsbedomning(?:ar)?\s+per\s+termin/);
  if (termMatch) {
    const parsed = swedishNumberToInt(termMatch[1]);
    if (parsed > 0) assessmentsPerTerm = parsed;
  }

  return {
    type: "plan_st_from_sr_templates",
    includePlacements: true,
    includeCourses: true,
    includeUtbildningsmoment: true,
    monthlySupervision: Math.max(1, Math.min(8, monthlySupervision)),
    assessmentsPerTerm: Math.max(1, Math.min(8, assessmentsPerTerm)),
  };
}

export function parseLocalAgentAction(input: string): PusslaAgentAction | null {
  return (
    parseUndoLastAgentMutationCommand(input) ||
    parseAddIupFollowupCommand(input) ||
    parseClearIupFollowupsCommand(input) ||
    parseSelectCollectionCommand(input) ||
    parseApplyOperatorToCollectionCommand(input) ||
    parseGetActiveContextCommand(input) ||
    parseListInternalGapsCommand(input) ||
    parseListTimelineEntitiesCommand(input) ||
    parseVerifyLastActionEffectCommand(input) ||
    parsePlanCoursesCoverMilestonesCommand(input) ||
    parseSrTemplateMasterPlanCommand(input) ||
    parseSummarizeAppSectionsCommand(input) ||
    parseSummarizeRoleViewsCommand(input) ||
    parseSyncCourseMilestonesCommand(input) ||
    parseSummarizeGoalCatalogCommand(input) ||
    parseColleagueSummaryCommand(input) ||
    parseTypedPlacementCommand(input) ||
    parsePlacementCommand(input) ||
    parseTypedCourseCommand(input) ||
    parseCreateCourseCommand(input) ||
    parseSelectPlacementCommand(input) ||
    parseSelectCourseCommand(input) ||
    parseRebalanceCoursesPerHalfYearCommand(input) ||
    parseShiftAllCoursesCommand(input) ||
    parseDeleteSelectedCommand(input) ||
    parsePreviewActionDiffCommand(input) ||
    parseExtendPlacementByTitleCommand(input) ||
    parseShortenPlacementByTitleCommand(input) ||
    parseShortenLastPlacementCommand(input) ||
    parseExtendLastPlacementCommand(input) ||
    parseShiftPlacementCommand(input) ||
    parseDeletePlacementCommand(input) ||
    parseDeleteCourseCommand(input) ||
    parseConvertCourseToUtbildningsmomentCommand(input) ||
    parseUpdateSelectedPlacementCommand(input) ||
    parseUpdateSelectedCourseCommand(input) ||
    parseNavigateCommand(input)
  );
}

function parseReplaceLastCourseRenamePlan(input: string): PusslaAgentAction[] {
  const raw = String(input || "").trim();
  if (!raw) return [];
  const norm = normalizeSv(raw);
  if (!/(andra|andra|ändra|byt)/i.test(raw) || !/\b(sista|senaste)\b/.test(norm)) {
    return [];
  }

  const m =
    raw.match(
      /(?:ändra|andra|byt)\s+(?:den\s+)?(?:sista|senaste)\s+(?:kurs(?:en)?\s+)?["”]?([^"”\n]+?)["”]?\s+till\s+(?:en\s+)?(?:kurs(?:en)?\s+i\s+)?["”]?([^"”\n]+?)["”]?\s*$/i
    ) ||
    raw.match(
      /(?:ändra|andra|byt)\s+(?:sista|senaste)\s+(?:kurs(?:en)?\s+)?["”]?([^"”\n]+?)["”]?\s+till\s+(?:en\s+)?(?:kurs(?:en)?\s+i\s+)?["”]?([^"”\n]+?)["”]?\s*$/i
    );
  if (!m) return [];

  const fromTitle = String(m[1] || "")
    .trim()
    .replace(/^kurs(?:en)?\s+/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bsom\s+[äa]r\b[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const toRawTitle = String(m[2] || "").trim();
  const toTitle = toRawTitle.replace(/^kurs(?:en)?\s+i?\s*/i, "");
  if (!fromTitle || !toTitle) return [];

  // Ange ny kurs/utbildningsmoment-typ om användaren explicit säger "till en kurs".
  let courseKind: "Kurs" | "Konferens" | "Annat" | "Utbildningsmoment" | undefined;
  if (/\btill\s+(?:en\s+)?kurs\b/i.test(norm) || /\bkurs\s+i\b/i.test(norm)) {
    courseKind = "Kurs";
  } else if (/\btill\s+(?:ett\s+)?utbildningsmoment\b/i.test(norm)) {
    courseKind = "Utbildningsmoment";
  } else if (/\btill\s+(?:en\s+)?konferens\b/i.test(norm)) {
    courseKind = "Konferens";
  } else if (/\btill\s+(?:en\s+)?annat\b/i.test(norm)) {
    courseKind = "Annat";
  }

  return [
    { type: "select_course", query: fromTitle },
    {
      type: "update_selected_course",
      fields: { title: toTitle, ...(courseKind ? { courseKind } : {}) },
    },
    { type: "save_selected_course" },
  ];
}

/**
 * "lägg till delmål c2, c3 och a3 till Vårdcentral" → välj placering + delmål + spara.
 * Skiljer från katalog-/IUP-intent som också nämner "delmål".
 */
export function parseAddDelmalToPlacementInlinePlan(input: string): PusslaAgentAction[] {
  const raw = input.trim();
  const m = raw.match(
    /^(?:lägg\s+till|sätt)\s+delm[aå]l\s+(.+?)\s+(?:till|på)\s+(.+)$/i
  );
  if (!m) return [];
  const listPart = String(m[1] || "").trim();
  let query = String(m[2] || "").trim().replace(/^["“”']|["“”']$/g, "");
  if (!listPart || !query) return [];

  const ids = splitMilestoneIdTokens(listPart);
  if (ids.length === 0) return [];

  const queryClean = query.replace(/^placeringen\s+/i, "").trim();
  if (!queryClean) return [];

  return [
    { type: "select_placement", query: queryClean },
    { type: "update_selected_placement", fields: { milestones: ids } },
    { type: "save_selected_placement" },
  ];
}

function parseSelectUpdateSavePlacementPlan(input: string): PusslaAgentAction[] {
  const raw = input.trim();
  const selectMatch = raw.match(/(?:välj|valj|markera|fokusera)\s+placering(?:en)?\s+["“”']?([^"“”'\n,]+)["“”']?/i);
  if (!selectMatch) return [];
  const query = String(selectMatch[1] || "").trim();
  if (!query) return [];

  const wantsSave =
    /\bspara\b/.test(normalizeSv(raw)) ||
    /\boch\s+spara\b/i.test(raw);
  if (!wantsSave) return [];

  const fields = collectPlacementUpdateFieldsFromText(raw);
  if (Object.keys(fields).length === 0) return [];

  return [
    { type: "select_placement", query },
    { type: "update_selected_placement", fields },
    { type: "save_selected_placement" },
  ];
}

/**
 * "lägg till handledare \"Namn\" i Vårdcentral" / "sätt handledare Namn på X"
 * — samma effekt som välj + uppdatera handledare + spara, utan att användaren skriver "välj placeringen" / "och spara".
 */
function parseSupervisorPlacementInlinePlan(input: string): PusslaAgentAction[] {
  const raw = input.trim();
  const head = raw.match(/^(?:lägg\s+till|sätt)\s+handledar(?:en|e)\s+([\s\S]+)$/i);
  if (!head) return [];
  const tail = String(head[1] || "").trim();
  if (!tail) return [];

  let supervisor = "";
  let query = "";

  const partsI = tail.split(/\s+i\s+/i);
  if (partsI.length >= 2) {
    supervisor = partsI[0].replace(/^["“”']|["“”']$/g, "").trim();
    query = partsI
      .slice(1)
      .join(" i ")
      .replace(/^["“”']|["“”']$/g, "")
      .trim();
  } else {
    const partsPa = tail.split(/\s+på\s+/i);
    if (partsPa.length >= 2) {
      supervisor = partsPa[0].replace(/^["“”']|["“”']$/g, "").trim();
      query = partsPa
        .slice(1)
        .join(" på ")
        .replace(/^["“”']|["“”']$/g, "")
        .trim();
    }
  }

  if (!supervisor || !query) return [];

  const queryClean = query.replace(/^placeringen\s+/i, "").trim();
  if (!queryClean) return [];

  return [
    { type: "select_placement", query: queryClean },
    { type: "update_selected_placement", fields: { supervisor } },
    { type: "save_selected_placement" },
  ];
}

export function parseLocalAgentPlan(input: string): PusslaAgentAction[] {
  const selectUpdateSavePlacementPlan = parseSelectUpdateSavePlacementPlan(input);
  if (selectUpdateSavePlacementPlan.length > 0) return selectUpdateSavePlacementPlan;

  const addDelmalPlacementPlan = parseAddDelmalToPlacementInlinePlan(input);
  if (addDelmalPlacementPlan.length > 0) return addDelmalPlacementPlan;

  const supervisorInlinePlan = parseSupervisorPlacementInlinePlan(input);
  if (supervisorInlinePlan.length > 0) return supervisorInlinePlan;

  const replaceLastCoursePlan = parseReplaceLastCourseRenamePlan(input);
  if (replaceLastCoursePlan.length > 0) return replaceLastCoursePlan;

  const hasStepConnectors =
    /\s+(?:och sedan|sedan|och|därefter|forst|först)\s+/i.test(input) ||
    /[.;]\s*/.test(input);
  const direct = parseLocalAgentAction(input);
  if (direct && !hasStepConnectors) return [direct];

  const clauses = input
    .split(/\s+(?:och sedan|sedan|och|därefter|först|forst)\s+|[.;]\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);
  const actions: PusslaAgentAction[] = [];
  clauses.forEach((clause) => {
    const parsed = parseLocalAgentAction(clause);
    if (parsed) actions.push(parsed);
  });
  if (direct && actions.length <= 1) return [direct];
  if (actions.length === 0) return actions;

  // Resolve "lika mycket" for follow-up shift actions.
  let latestMonths: number | null = null;
  const resolved = actions.map((action) => {
    if (action.type === "extend_last_placement" && Number.isFinite(action.months || NaN)) {
      latestMonths = Math.max(1, Math.abs(Number(action.months)));
      return action;
    }
    if (action.type === "shift_placement_from_end") {
      if (Number.isFinite(action.months || NaN)) {
        latestMonths = Math.max(1, Number(action.months));
        return action;
      }
      if (latestMonths && latestMonths > 0) {
        return { ...action, months: latestMonths };
      }
      return { ...action, months: 1 };
    }
    return action;
  });

  // If user asks to extend #2 and shift #1 equally, shift first to avoid overlap.
  const hasExtendSecond = resolved.some(
    (a) => a.type === "extend_last_placement" && (a.positionFromEnd || 1) === 2
  );
  const hasShiftLast = resolved.some(
    (a) => a.type === "shift_placement_from_end" && (a.positionFromEnd || 1) === 1
  );
  if (hasExtendSecond && hasShiftLast) {
    const shifted = resolved.filter((a) => a.type === "shift_placement_from_end");
    const rest = resolved.filter((a) => a.type !== "shift_placement_from_end");
    return [...shifted, ...rest];
  }

  return resolved;
}

function normalizeStopReason(v: unknown): AgentModelStopReason | undefined {
  const s = String(v || "").toLowerCase().trim();
  if (!s || s === "none") return "none";
  if (s === "needs_user" || s === "needsuser") return "needs_user";
  if (s === "unsupported") return "unsupported";
  if (s === "unsafe") return "unsafe";
  if (s === "blocked") return "blocked";
  return undefined;
}

export function parseModelJsonResponse(rawText: string): ParsedAgentResponse {
  const trimmed = rawText.trim();

  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    const data = JSON.parse(candidate) as any;
    if (data && typeof data === "object") {
      const reply = typeof data.reply === "string" ? data.reply : "";
      const goalSummary =
        typeof data.goal_summary === "string"
          ? data.goal_summary.trim()
          : typeof data.goalSummary === "string"
            ? data.goalSummary.trim()
            : undefined;
      const clarifyingRaw =
        data.clarifying_question ?? data.clarifyingQuestion ?? data.question ?? null;
      const clarifyingQuestion =
        typeof clarifyingRaw === "string" && clarifyingRaw.trim()
          ? clarifyingRaw.trim()
          : clarifyingRaw === null
            ? null
            : undefined;
      const stopReason =
        normalizeStopReason(data.stop_reason) ?? normalizeStopReason(data.stopReason);
      const action =
        data.action && isPusslaAgentAction(data.action)
          ? (data.action as PusslaAgentAction)
          : null;
      const actions = Array.isArray(data.actions)
        ? data.actions.filter((a: any) => isPusslaAgentAction(a))
        : [];
      return {
        reply,
        goalSummary,
        clarifyingQuestion: clarifyingQuestion === undefined ? undefined : clarifyingQuestion,
        stopReason,
        action,
        actions,
      };
    }
  } catch {
    // Fallback to plain text.
  }

  return { reply: trimmed, action: null, actions: [] };
}

export function buildAgentSystemPrompt(contextSummary: string): string {
  const registeredTypes = listRegisteredActionTypes();
  const advancedPlanningExamples = [
    'Exempel: "Inspireras av kollegorna och planera hela min ST med extra tyngd på psykos och suicidologi." => actions:[{"type":"summarize_colleague_placements","placementName":"Psykos","lineCount":12,"style":"akademisk_svenska"},{"type":"summarize_colleague_courses","courseName":"Suicidologi","lineCount":12,"style":"akademisk_svenska"},{"type":"plan_courses_cover_course_milestones","targetCount":10},{"type":"plan_timeline_distribution","target":"courses","cadence":"half_year","itemsPerCadence":2},{"type":"sync_course_milestones"}]',
    'Exempel: "Planera om så att jag har två kurser per termin och flytta allt en månad framåt." => actions:[{"type":"shift_all_courses","months":1,"direction":"forward"},{"type":"plan_timeline_distribution","target":"courses","cadence":"term","itemsPerCadence":2},{"type":"sync_course_milestones"}]',
    'Exempel: "Lägg in en komplett ST-plan från SR-mallar och säkerställ kursdelmål." => actions:[{"type":"plan_st_from_sr_templates","includePlacements":true,"includeCourses":true,"includeUtbildningsmoment":true,"monthlySupervision":1,"assessmentsPerTerm":2},{"type":"sync_course_milestones"}]',
    'Exempel: "Byt sista Journal club till kurs i suicidologi och spara." => actions:[{"type":"select_course","query":"Journal club"},{"type":"update_selected_course","fields":{"title":"Suicidologi","courseKind":"Kurs"}},{"type":"save_selected_course"}]',
    'Exempel: "Ta bort vald kurs och lägg in en ny kurs i april 2027." => actions:[{"type":"delete_selected_course"},{"type":"create_typed_course_from_range","courseKind":"Kurs","title":"Ny kurs","startDate":"2027-04-01","endDate":"2027-04-15"}]',
    'Exempel: "Gå till IUP, öppna delmål och summera målbilden kort." => actions:[{"type":"open_window","window":"iup"},{"type":"set_iup_tab","tab":"delmal"},{"type":"summarize_goal_catalog"}]',
    'Exempel: "Skanna appen, visa vad som saknas och föreslå nästa steg." => actions:[{"type":"summarize_app_sections"},{"type":"summarize_role_views"}]',
    'Exempel: "Planera 12 kurser som täcker delmål och fördela månadsvis." => actions:[{"type":"plan_courses_cover_course_milestones","targetCount":12},{"type":"plan_timeline_distribution","target":"courses","cadence":"month","itemsPerCadence":1},{"type":"sync_course_milestones"}]',
    'Exempel: "Flytta dem bakåt två månader och håll samma fördelning." => actions:[{"type":"shift_all_courses","months":2,"direction":"backward"},{"type":"plan_timeline_distribution","target":"courses","cadence":"half_year","itemsPerCadence":2}]',
    'Exempel: "Öppna profil och rapport, men ändra inget." => actions:[{"type":"open_window","window":"profile"},{"type":"open_window","window":"report"}]',
    'Exempel: "Rensa vald placering och skapa ny klinisk placering maj-juni 2028." => actions:[{"type":"delete_selected_placement"},{"type":"create_typed_placement_from_range","placementType":"Klinisk tjänstgöring","title":"Ny klinisk placering","startDate":"2028-05-01","endDate":"2028-06-30"}]',
    'Exempel: "Gör stor omplanering stegvis: först SR-bas, sen kurstäckning, sen synk." => actions:[{"type":"plan_st_from_sr_templates","includePlacements":true,"includeCourses":true,"includeUtbildningsmoment":true,"monthlySupervision":1,"assessmentsPerTerm":2},{"type":"plan_courses_cover_course_milestones","targetCount":10},{"type":"sync_course_milestones"}]',
    'Exempel: "Flytta alla handledarsamtal en vecka framåt." => actions:[{"type":"shift_iup_supervision_meetings","days":7}]',
    'Exempel: "Lägg in fyra huvudhandledarsamtal våren 2023, första måndagen varje månad." => actions:[{"type":"add_iup_supervision_meetings","dateISOs":["2023-03-06","2023-04-03","2023-05-01","2023-06-05"]}]',
    'Exempel: "Ta bort handledarsamtalen 2023-04-03 och 2023-05-01." => actions:[{"type":"remove_iup_supervision_meetings_by_dates","dateISOs":["2023-04-03","2023-05-01"]}]',
    'Exempel: "Välj placeringen Psykos, sätt handledares specialitet till Psykiatri, tjänsteställe till SUS, beskrivning till Kort text, delmål till STA1 STC2 och spara." => actions:[{"type":"select_placement","query":"Psykos"},{"type":"update_selected_placement","fields":{"supervisorSpeciality":"Psykiatri","supervisorSite":"SUS","note":"Kort text","milestones":["STA1","STC2"]}},{"type":"save_selected_placement"}]',
    'Exempel: "lägg till handledare \"Anders Svensson\" i Vårdcentral" => actions:[{"type":"select_placement","query":"Vårdcentral"},{"type":"update_selected_placement","fields":{"supervisor":"Anders Svensson"}},{"type":"save_selected_placement"}]',
  ];
  const curriculumLines = [
    "Träningsbank (100 avancerade uppdrag):",
    ...ADVANCED_PROMPT_BANK_100,
    "Träningsbank (100 mellanlägen mellan mikro och breda block):",
    ...MIDDLE_ACTION_PROMPT_BANK_100,
  ];

  return [
    "Du är en måldriven assistent i PusslaDinST: du tolkar användarens mål, planerar konkreta steg och använder endast definierade JSON-actions — aldrig påhittade funktioner.",
    "Regler för JSON-fält: goal_summary = en mening om vad som ska uppnås. clarifying_question = null om du kan köra actions; annars en enda tydlig fråga och tomma actions/action. stop_reason: none | needs_user | unsupported | unsafe | blocked.",
    "Giltiga action type-värden (inga andra):",
    registeredTypes.join(", ") + ".",
    "Svara alltid som ett JSON-objekt med reply, goal_summary, clarifying_question, stop_reason, action och actions enligt:",
    '{"reply":"kort text","goal_summary":"...","clarifying_question":null,"stop_reason":"none","action":null|{"type":"navigate_lane","lane":"placement|course"}|{"type":"open_window","window":"iup|hemklinik|scan_intyg|bt_ansokan|specialistansokan|profile|about|report|settings|sta3|course_prep|preview|milestone_overview"}|{"type":"close_window","window":"iup|hemklinik|scan_intyg|bt_ansokan|specialistansokan|profile|about|report|settings|sta3|course_prep|preview|milestone_overview"}|{"type":"set_iup_tab","tab":"handledning|progression|planering|delmal|rapport"}|{"type":"create_placement_from_range","title":"...","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"}|{"type":"create_typed_placement_from_range","placementType":"Klinisk tjänstgöring|Vetenskapligt arbete|Förbättringsarbete|Auskultation|Forskning|Tjänstledighet|Föräldraledighet|Annan ledighet|Sjukskriven","title":"...","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"}|{"type":"create_course_from_range","title":"...","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"}|{"type":"create_typed_course_from_range","courseKind":"Kurs|Konferens|Annat|Utbildningsmoment","title":"...","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"}|{"type":"select_placement","query":"..."}|{"type":"select_course","query":"..."}|{"type":"update_selected_placement","fields":{"label":"...","placementType":"Klinisk tjänstgöring|Vetenskapligt arbete|Förbättringsarbete|Auskultation|Forskning|Tjänstledighet|Föräldraledighet|Annan ledighet|Sjukskriven","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","attendance":100,"supervisor":"...","supervisorSpeciality":"...","supervisorSite":"...","note":"...","phase":"BT|ST","leaveSubtype":"...","milestones":["STA1"],"btMilestones":["BT1"]}}|{"type":"update_selected_course","fields":{"title":"...","courseKind":"Kurs|Konferens|Annat|Utbildningsmoment","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","certificateDate":"YYYY-MM-DD","city":"...","courseLeaderName":"...","note":"...","showAsInterval":true,"phase":"BT|ST","btAssessment":"...","addToPlacement":true,"milestones":["STC1"],"btMilestones":["BT2"]}}|{"type":"save_selected_placement"}|{"type":"save_selected_course"}|{"type":"extend_last_placement","placementTitle":"...","months":1}|{"type":"extend_last_placement","placementTitle":"...","months":-1}|{"type":"extend_last_placement","placementTitle":"...","endDate":"YYYY-MM-DD"}|{"type":"extend_last_placement","positionFromEnd":1,"months":1}|{"type":"extend_last_placement","positionFromEnd":2,"months":1}|{"type":"extend_last_placement","positionFromEnd":1,"endDate":"YYYY-MM-DD"}|{"type":"shift_placement_from_end","positionFromEnd":1,"months":1}|{"type":"shift_all_courses","months":1,"direction":"forward|backward"}|{"type":"plan_timeline_distribution","target":"courses|placements","cadence":"month|half_year|term|year","itemsPerCadence":2}|{"type":"delete_selected_placement"}|{"type":"delete_selected_course"}|{"type":"delete_placement_by_month_year","month":3,"year":2026}|{"type":"delete_course_by_month_year","month":3,"year":2026}|{"type":"convert_course_to_utbildningsmoment","courseTitle":"Journal club","month":5,"year":2026,"description":"..." }|{"type":"plan_st_from_sr_templates","includePlacements":true,"includeCourses":true,"includeUtbildningsmoment":true,"monthlySupervision":1,"assessmentsPerTerm":2}|{"type":"plan_courses_cover_course_milestones","targetCount":10}|{"type":"sync_course_milestones"}|{"type":"summarize_goal_catalog"}|{"type":"summarize_app_sections"}|{"type":"summarize_role_views"}|{"type":"summarize_colleague_placements","placementName":"...","colleagueName":"Cecilia","lineCount":10,"style":"akademisk_svenska"}|{"type":"summarize_colleague_courses","courseName":"...","lineCount":10,"style":"akademisk_svenska"},"actions":[...]}',
    "Använd actions-array när användaren ber om flera steg. Annars använd action.",
    "Planera alltid hierarkiskt innan du väljer actions: (1) mål, (2) delmål, (3) konkreta steg, (4) kontroll. Returnera sedan den bästa action-kedjan.",
    "Föredra mikromoment (select/update/save/open/tab) när uppgiften är detaljerad. Kombinera med breda block (plan_*/shift_*/sync_*) för stora helhetsmål.",
    "Om uppgiften är komplex: bygg en kedja med flera actions i logisk ordning, inte en enda grov action.",
    "Om användaren ber om dataändring, föreslå en action i JSON.",
    "Du får och ska använda så många actions som behövs för avancerade kombinationsinstruktioner.",
    "Begreppslexikon (tolka dessa likvärdigt): näst sista = nästsista = näst-sista = andra från slutet. utan glapp framåt = fyll glappet = möt nästa placering = till nästa placering börjar.",
    "Om användaren skriver ångra/återställ och sedan en ny instruktion: behandla det som två steg i ordning (först återställ senaste ändring, sedan den nya instruktionen).",
    "När användaren vill planera en ST baserat på studierektors inlagda mallar: använd plan_st_from_sr_templates.",
    "När användaren vill välja ett antal kurser (t.ex. tio) som täcker kursdelmål i målbilden och placeras jämnt över hela ST: använd plan_courses_cover_course_milestones med targetCount. Använd inte plan_st_from_sr_templates för det — den fyller studierektorsmallar och IUP, inte METIS-matris mot delmål.",
    "När användaren ber att flytta kurser i tid (t.ex. 'flytta dem en månad framåt'): använd shift_all_courses.",
    "När användaren ber att förlänga en placering med namn (t.ex. 'Psykos slutenvård med tre månader'), inte bara sista/nästsista: använd extend_last_placement med placementTitle och months eller endDate.",
    "När användaren ber att förkorta en namngiven placering (t.ex. 'Psykos slutenvård med fyra månader'): använd extend_last_placement med placementTitle och negativa månader (months: -4) eller med tidigare endDate.",
    "När användaren ber om fördelning/frekvens per period (t.ex. två kurser per termin): använd plan_timeline_distribution.",
    "När användaren ber att flytta alla placeringar framåt i tid: bygg en kedja av flera shift_placement_from_end-steg (positionFromEnd 1..N), i stället för att säga att funktionen saknas.",
    "När användaren ber om att korta/skala längden på alla placeringar (t.ex. halvera): använd transform_all_placements_duration med factor (0..1) och anchor ('start' eller 'end').",
    "När användaren ber om att ta bort den valda/markerade kursen eller placeringen: använd delete_selected_course eller delete_selected_placement.",
    "När användaren vill synka delmål på alla kurser så att de matchar respektive kurs: använd sync_course_milestones.",
    "När användaren ber om att gå igenom alla delmål, alla enskilda delmål eller varje delmåls infosida: använd summarize_goal_catalog.",
    "När användaren ber om en omfattande genomgång av hela appen/sidorna: använd summarize_app_sections.",
    "När användaren ber om studierektor/huvudhandledare-vyer eller rollsammanfattning: använd summarize_role_views.",
    "IUP handledarsamtal: handledarsamtal, huvudhandledarsamtal och handledarträff/huvudhandledning (möten med huvudhandledare) ska tolkas som samma sak — samma poster som add_iup_followup med followupType meeting.",
    "Flera handledarsamtal med egna datum: add_iup_supervision_meetings med dateISOs (lista YYYY-MM-DD). Högst 15 datum per action — dela upp i flera steg bara om användaren uttryckligen bett om fler tillfällen.",
    "Återkommande utan exakt årtal (t.ex. 'mars varje år'): lägg ett handledarsamtal per år endast för år som ryms i användarens ST-period (från kontextens start–slutår om de finns); annars ställ en kort förtydligandefråga. Gissa inte 20+ år.",
    "En enda add_iup_supervision_meetings per omgång om möjligt — kör inte flera identiska batch-actions i rad som duplicerar samma datum.",
    "Om du skriver att du 'kommer att utföra' eller listar steg ska samma svar alltid innehålla ifyllda actions/actions med giltig JSON — annars körs ingenting i appen. Prosa utan actions = misslyckad begäran.",
    "Flytta alla befintliga handledarsamtal lika många dagar: shift_iup_supervision_meetings med days (7 = en vecka framåt, -7 = en vecka bakåt).",
    "Ta bort handledarsamtal på utvalda datum men behåll övriga: remove_iup_supervision_meetings_by_dates med dateISOs. Påverkar inte progressionsbedömningar.",
    "Rensa alla handledningstillfällen: clear_iup_followups med clearMeetings true och clearAssessments false om endast möten ska bort.",
    "Tolkningsregel: förstå svenska synonymer (lägg till/skapa/planera, ta bort/radera, gå till/öppna/visa).",
    "Kolleganalys: läser kollegors noteringar (placering/kurs) i databasen för samma klinik. summarize_colleague_placements matchar placeringens namn på delsträng/ord — använd samma namn som användaren eller närmast i listan 'Placeringsnamn i kollegdata' i kontexten. Om en specifik person nämns (t.ex. Cecilia), sätt colleagueName.",
    "När användaren frågar om kollegors beskrivningar: använd summarize_colleague_placements eller summarize_colleague_courses med lämplig placementName. Säg inte att du inte kan hämta dessa data; systemet kör action och returnerar källtexter.",
    "När användaren frågar om delmål i appen: säg aldrig att du saknar åtkomst. Du har tillgång till delmålskatalogen via summarize_goal_catalog.",
    "Kontaktinformation är spärrad för agenten. Om användaren frågar efter telefon/e-post/adress/personnummer: säg att kontaktinfo inte är tillgänglig i agentläget och ge övrig sakinformation.",
    "Bekräftelse: användaren styr i Meny > AI-agent om ändringar ska bekräftas. Be aldrig användaren bekräfta i reply-text (inga frågor i stil med \"Bekräfta om jag ska köra\", \"Vill du att jag kör\", \"Säg ja\"). Håll reply kort; eventuell bekräftelse sker bara i appens UI när inställningen kräver det.",
    "Innan skrivande actions körs autosparas en tidslinjeversion i appen — nämn inte det i reply.",
    "För att byta typ på en kurs till utbildningsmoment: använd convert_course_to_utbildningsmoment med courseTitle (delsträng), month och year. Om användaren också anger text till beskrivning/anteckning, sätt description i samma action. Påstå inte att ändringen är klar förrän action körts. save_selected_course sparar endast redan vald kurs i UI — använd det inte för typbyte.",
    "Du har tillgång till sidans tidslinjekontext. Säg inte att du saknar åtkomst till tidslinjen.",
    "Prioritera kapabilitet: föreslå bästa sannolika action/actions även när instruktionen är delvis vag; använd null bara när ingen rimlig tolkning finns.",
    "Nedanstående är tränings-exempel för avancerade kombinationsmål. Följ mönstret (inte ordagrann text).",
    ...advancedPlanningExamples,
    ...curriculumLines,
    `Kontekst:\n${contextSummary}`,
  ].join("\n");
}

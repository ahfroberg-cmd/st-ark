// lib/intygParsers/parse_2021_bilaga10.ts
import { ExtractedCommon, extractCommon } from "../fieldExtract";
import type { OcrWord } from "@/lib/ocr";
import { extractDates } from "@/lib/dateExtract";

export type ParsedKurs2021 = ExtractedCommon & {
  type: "KURS";
  // kompatibilitet med mapAndSaveKurs
  courseTitle?: string;
  description?: string;
  subject?: string;
  supervisorName?: string;
  supervisorSpeciality?: string;
  supervisorSite?: string;
  signingRole?: "handledare" | "kursledare";
};
export function parse_2021_bilaga10(text: string, words?: OcrWord[]): ParsedKurs2021 {
  // 1) Om användaren har annoterat med X/R/T, använd det först (mycket mer robust).
  const annotated = parseByAnnotatedMarkers(text);
  if (annotated) return annotated;

  // 2) OCR.space ParsedText (utan R/T/X) – rubrik-baserad parsing (motsvarar den "tydliga textfilen").
  const headings = parseByOcrSpaceHeadings(text);
  if (headings) return headings;

  // 3) Sista fallback: äldre enkel regex
  const base = extractCommon(text);
  const title = (text.match(/Kursens ämne.*?:\s*(.+)/i) || [])[1]?.trim();
  const desc = (text.match(/Beskrivning av kursen\s*(.+)$/i) || [])[1]?.trim();
  return { ...base, type: "KURS", courseTitle: title, subject: title, description: desc };
}

function parseByOcrSpaceHeadings(raw: string): ParsedKurs2021 | null {
  const linesAll = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const IGNORE: RegExp[] = [
    /^\*{3,}\s*result\s+for\s+image\/page/i,
    /^\*{3,}/,
    /^\s*(page|sida)\s*\d+\s*$/i,
    /\bHSLF[-\s]?FS\b/i,
    /\bBilaga\s*10\b/i,
    /\bBilaga\s*nr\b/i,
    /^\s*INTYG\b/i,
    /\bSkriv\s+ut\b/i,
    /\bRensa\b/i,
  ];

  const lines = linesAll.filter((l) => !IGNORE.some((re) => re.test(l)));
  if (lines.length < 5) return null;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const isLabelLine = (l: string) => {
    const n = norm(l);
    return (
      n.includes("efternamn") ||
      n.includes("fornamn") ||
      n.includes("personnummer") ||
      n.includes("specialitet som ansokan avser") ||
      n.includes("delmal som intyget avser") ||
      n.includes("kursens amne") ||
      n.includes("beskrivning av kursen") ||
      n.includes("namnfortydligande") ||
      n.includes("tjanstestalle") ||
      n.includes("ort och datum")
    );
  };

  const valueAfter = (labelRe: RegExp, stopRes: RegExp[] = []): string | undefined => {
    const idx = lines.findIndex((l) => labelRe.test(l));
    if (idx < 0) return undefined;

    // "Label: value" på samma rad
    const sameLine = lines[idx].split(":").slice(1).join(":").trim();
    if (sameLine) return sameLine;

    // Annars: ta efterföljande rader tills nästa rubrik/stopp
    const out: string[] = [];
    for (let i = idx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l) break;
      if (isLabelLine(l)) break;
      if (stopRes.some((re) => re.test(l))) break;
      out.push(l);
    }
    return out.join("\n").trim() || undefined;
  };

  // Bas (personnummer/delmål/period-range) som fallback om rubriker inte ger träff
  const base = extractCommon(raw);

  // Ämne + beskrivning
  const subject =
    valueAfter(/Kursens ämne/i, [/Beskrivning av kursen/i, /Namnförtydligande/i]) ||
    valueAfter(/Kursens amne/i, [/Beskrivning av kursen/i, /Namnförtydligande/i]);

  const description = valueAfter(/Beskrivning av kursen/i, [
    /Namnförtydligande/i,
    /Ort och datum/i,
    /Tjänsteställe/i,
    /Tjanstestalle/i,
  ]);

  // Delmål (försök rubrikfält först, annars fallback från hela texten)
  const delmalText = valueAfter(/Delmål som intyget avser/i, [
    /Kursens ämne/i,
    /Kursens amne/i,
    /Beskrivning av kursen/i,
  ]);
  const delmalCodes =
    (delmalText ? extractCommon(delmalText).delmalCodes : undefined) ?? base.delmalCodes;

  // Personnummer (rubrikfält eller fallback)
  const pnrText = valueAfter(/Personnummer/i) || lines.join(" ");
  const personnummer =
    (pnrText.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) || [])[0] || base.personnummer;

  // Intygare (handledare/kursledare)
  const supervisorName = valueAfter(/Namnförtydligande/i);
  const supervisorSpeciality = valueAfter(/Specialitet/i);
  const supervisorSite = valueAfter(/Tjänsteställe/i) || valueAfter(/Tjanstestalle/i);

  // Datum (ofta "Ort och datum") → lägg i period.endISO så mapAndSaveKurs kan använda som certificateDate
  const placeDateRaw = valueAfter(/Ort och datum/i) || "";
  const dateFromPlace = placeDateRaw ? extractDates(placeDateRaw).startISO : undefined;
  let period = base.period;
  if (dateFromPlace && !period?.endISO) {
    period = { ...(period || {}), endISO: dateFromPlace };
  }

  // Kryssrutor handledare/kursledare (OCR.space kan ge "x" nära ordet)
  const markRe = /(☒|✓|✗|\bx\b)/i;
  const handledLine = lines.find((l) => /handledare/i.test(l) && markRe.test(l));
  const kursledLine = lines.find((l) => /kursledare/i.test(l) && markRe.test(l));
  let signingRole: "handledare" | "kursledare" | undefined;
  if (handledLine && !kursledLine) signingRole = "handledare";
  else if (kursledLine && !handledLine) signingRole = "kursledare";
  else {
    // Heuristik: om handledare-fält verkar ifyllda → handledare
    if (supervisorSpeciality || supervisorSite) signingRole = "handledare";
    else signingRole = "kursledare";
  }

  // Om vi fick åtminstone titel/subject eller beskrivning så anser vi att rubrik-parsning lyckades
  const ok = Boolean(subject || description || supervisorName || personnummer);
  if (!ok) return null;

  return {
    personnummer,
    delmalCodes,
    period,
    type: "KURS",
    courseTitle: subject || undefined,
    subject: subject || undefined,
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: supervisorSite || undefined,
    signingRole,
  };
}

/**
 * Stöd för manuellt annoterad OCR-text där:
 * - X    = rad som aldrig ska in i något fält
 * - R<n> = rubrikrad (ska aldrig in i textfält)
 * - T<n> = text kopplad till rubriken R<n>
 *
 * Specialfall:
 * - R10 markerar kryssrutor Handledare/Kursledare. Om T10 innehåller "handledare" eller "kursledare" används det.
 *   Annars: om fält som tydligt säger "gäller endast handledare" har värden → handledare; annars default kursledare.
 */
function parseByAnnotatedMarkers(raw: string): ParsedKurs2021 | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rtCount = lines.filter((l) => /^[rRtT]\d+\b/.test(l)).length;
  const xCount = lines.filter((l) => /^[xX]\b/.test(l)).length;
  if (rtCount < 6 && xCount < 3) return null;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  type Bucket = { labels: string[]; values: string[] };
  const buckets = new Map<number, Bucket>();
  const getBucket = (n: number) => {
    const b = buckets.get(n) ?? { labels: [], values: [] };
    buckets.set(n, b);
    return b;
  };

  for (const line of lines) {
    if (/^[xX]\b/.test(line)) continue;

    const m = /^([rRtT])(\d+)\s*(.*)$/.exec(line);
    if (!m) continue;
    const tag = m[1].toLowerCase();
    const id = Number(m[2]);
    const rest = (m[3] || "").trim();
    if (!Number.isFinite(id) || !rest) continue;

    const b = getBucket(id);
    if (tag === "r") {
      b.labels.push(rest);
    } else {
      b.values.push(rest);
    }
  }

  const findIdByLabel = (needle: string) => {
    const nNeedle = norm(needle);
    for (const [id, b] of buckets.entries()) {
      if (!b.labels.length) continue;
      if (b.labels.some((lab) => norm(lab).includes(nNeedle))) return id;
    }
    return null;
  };

  const valueFor = (id: number | null) => {
    if (!id) return undefined;
    const b = buckets.get(id);
    if (!b || !b.values.length) return undefined;
    return b.values.join("\n").trim() || undefined;
  };

  // Gemensamma fält från OCR (delmål/personnummer/period-range)
  const base = extractCommon(raw);

  const courseTitle = valueFor(findIdByLabel("Kursens ämne")) || valueFor(findIdByLabel("Kursens amne"));
  const description = valueFor(findIdByLabel("Beskrivning av kursen"));

  // Handledare/Kursledare: vi mappar till supervisor* (ScanIntygModal använder dessa till courseLeader*)
  const supervisorName = valueFor(findIdByLabel("Namnförtydligande"));
  const supervisorSpeciality = valueFor(findIdByLabel("Specialitet"));
  const supervisorSite = valueFor(findIdByLabel("Tjänsteställe")) || valueFor(findIdByLabel("Tjanstestalle"));

  // Datum för kurs (ofta "Ort och datum") → lägg i period.endISO så mapAndSaveKurs kan använda det som certificateDate
  let period = base.period;
  const placeDateRaw = valueFor(findIdByLabel("Ort och datum")) || "";
  const dateFromPlace = placeDateRaw ? extractDates(placeDateRaw).startISO : undefined;
  if (dateFromPlace && !period?.endISO) {
    period = { ...(period || {}), endISO: dateFromPlace };
  }

  // R10 (kryssrutor): försök läsa T10 om användaren anger det, annars heuristik
  let signingRole: "handledare" | "kursledare" | undefined;
  {
    const b10 = buckets.get(10);
    const t10 = b10?.values?.join(" ").toLowerCase() || "";
    if (t10.includes("kursled")) signingRole = "kursledare";
    else if (t10.includes("handled")) signingRole = "handledare";
    else {
      // Heuristik: om ett fält som uttryckligen säger "gäller endast handledare" har värde → handledare
      for (const [, b] of buckets.entries()) {
        const labAll = b.labels.join(" ");
        if (norm(labAll).includes(norm("galler endast handledare")) && b.values.length) {
          signingRole = "handledare";
          break;
        }
      }
      if (!signingRole) signingRole = "kursledare";
    }
  }

  // Returnera i format som ScanIntygModal redan hanterar
  return {
    ...base,
    type: "KURS",
    courseTitle: courseTitle || undefined,
    subject: courseTitle || undefined,
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: supervisorSite || undefined,
    signingRole,
    period,
  };
}

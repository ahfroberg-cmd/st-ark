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

  // 2) Fallback: äldre enkel regex
  const base = extractCommon(text);
  const title = (text.match(/Kursens ämne.*?:\s*(.+)/i) || [])[1]?.trim();
  const desc = (text.match(/Beskrivning av kursen\s*(.+)$/i) || [])[1]?.trim();
  return { ...base, type: "KURS", courseTitle: title, subject: title, description: desc };
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

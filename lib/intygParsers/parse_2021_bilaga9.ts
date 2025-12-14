// lib/intygParsers/parse_2021_bilaga9.ts
import type { ParsedIntyg } from "./types";
import type { OcrWord } from "@/lib/ocr";
import {
  extractDelmalCodes, extractPersonnummer, extractFullNameBlock,
  extractSpecialty, extractBlockAfterLabel, extractClinicAndPeriodFromLine, 
  fallbackPeriod, extractPeriodFromZoneText, normalizeAndSortDelmalCodes2021
} from "./common";
import { extractCommon } from "../fieldExtract";
import { extractZonesFromWords, zones_2021_B9_KLIN } from "@/lib/ocr";

export function parse_2021_bilaga9(text: string, words?: OcrWord[], zonesFromImage?: Record<string, string>): ParsedIntyg {
  const kind = "2021-B9-KLIN";

  // 1) Rubrik-baserad parsing (funkar väldigt bra för OCR.space-texter där rubrikerna ligger på egna rader)
  // Kör först och använd den om vi får en "hög" träffsäkerhet.
  const annotatedParsed = parseByAnnotatedMarkers(text);
  if (annotatedParsed) return annotatedParsed;
  const headingParsed = parseByHeadings(text);
  if (headingParsed) return headingParsed;
  
  // Använd zonlogik om words finns (direktfotograferat dokument) eller om zonesFromImage finns (OpenCV-baserad)
  let zones: Record<string, string> = {};
  
  if (zonesFromImage) {
    // Använd OpenCV-baserade zoner direkt
    zones = zonesFromImage;
  } else if (words && words.length > 0) {
    // Zoner är definierade för 1057×1496 px (A4-format för 2021-intyg)
    zones = extractZonesFromWords(words, zones_2021_B9_KLIN, { width: 1057, height: 1496 });
  }
  
  if (Object.keys(zones).length > 0) {
    
    // Kombinera förnamn och efternamn (förnamn först)
    const firstName = zones.applicantFirstName?.trim() || "";
    const lastName = zones.applicantLastName?.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim() || undefined;
    
    // Extrahera personnummer från zon
    const personnummer = zones.personnummer?.trim().replace(/\s+/g, "") || undefined;
    
    // Extrahera delmål från zon
    const rawDelmalCodes = extractDelmalCodes(zones.delmal || "");
    // Normalisera och sortera delmål för 2021
    const delmalCodes = rawDelmalCodes.length > 0 ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) : undefined;
    
    // Extrahera period från period-zon
    const period = extractPeriodFromZoneText(zones.period || "");
    
    // Extrahera klinik från clinic-zon
    const clinic = zones.clinic?.trim() || undefined;
    
    // Beskrivning från description-zon
    const description = zones.description?.trim() || undefined;
    
    // Handledare-information
    const supervisorName = zones.supervisorNamePrinted?.trim() || undefined;
    const supervisorSpeciality = zones.supervisorSpecialty?.trim() || undefined;
    const supervisorSite = zones.supervisorSite?.trim() || undefined;
    
    // Specialitet
    const specialtyHeader = zones.specialty?.trim() || undefined;
    
    return {
      kind,
      fullName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      personnummer,
      specialtyHeader,
      delmalCodes,
      clinic,
      period: period || fallbackPeriod(text),
      description,
      supervisorName,
      supervisorSpeciality,
      supervisorSite,
    };
  }
  
  // Fallback till smart logik om inga words finns (bakåtkompatibilitet)
  const rawDelmalCodes = extractDelmalCodes(text);
  // Normalisera och sortera delmål för 2021
  const delmalCodes = rawDelmalCodes.length > 0 ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) : undefined;
  const { fullName, firstName, lastName } = extractFullNameBlock(text);
  const personnummer = extractPersonnummer(text);
  const specialtyHeader = extractSpecialty(text);

  const clinicLine = matchLine(text, /(Tjänstgöringsställe|klinisk tjänstgöring)/i);
  const { clinic, period } = extractClinicAndPeriodFromLine(clinicLine);
  const description = extractBlockAfterLabel(text, /Beskrivning av den kliniska tjänstgöringen/i);

  return { kind, fullName, firstName, lastName, personnummer, specialtyHeader,
    delmalCodes, clinic, period: period ?? fallbackPeriod(text), description };
}

function matchLine(text: string, re: RegExp): string {
  const m = text.split(/\r?\n/).find(l => re.test(l));
  return m ?? "";
}

function parseByHeadings(raw: string): ParsedIntyg | null {
  return parseByOcrSpaceHeadings(raw);
}

function parseByOcrSpaceHeadings(raw: string): ParsedIntyg | null {
  const kind = "2021-B9-KLIN";
  
  // Normalisera OCR-fel INNAN split
  const normalizedRaw = raw
    .replace(/\bFömamn\b/gi, "Förnamn")
    .replace(/\bEftemamn\b/gi, "Efternamn")
    .replace(/\bfömamn\b/gi, "Förnamn")
    .replace(/\beftemamn\b/gi, "Efternamn");
  
  const linesAll = normalizedRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  
  if (linesAll.length === 0) return null;

  // IGNORE-lista: exakta rader som ska filtreras bort
  // Viktigt: "Sökande" ska bara ignoreras om det är en enskild rad, inte om det ingår i en mening
  const IGNORE_EXACT: string[] = [
    "Rensa",
    "Bilaga nr:",
    "INTYG",
    "om genomförd utbildningsaktivitet och uppfyllda kompetenskrav",
    "Skriv ut",
    "Intygsutfärdande handledare intygar att sökanden har genomfört utbildningsaktiviteten och",
    "bedömer att han eller hon har uppfyllt kompetenskrav i delmålet/-en.",
    "HSLF-FS 9021:8 Bilaga 9",
  ];

  const IGNORE: RegExp[] = [
    /^\*{3,}\s*result\s+for\s+image\/page/i,
    /^\*{3,}/,
    /^\s*(page|sida)\s*\d+\s*$/i,
    /^HSLF/i, // Blockera alla rader som börjar med "HSLF"
    /\bHSLF[-\s]?FS\b/i,
    /\bHSLF[-\s]?FS\s+\d{4}:\d+/i,
    /\bHSLF[-\s]?FS\s+\d{4}:\d+\s*\(/i,
    /\bBilaga\s*9\b/i,
    /\bBilaga\s*nr\b/i,
    /^\s*INTYG\b/i,
    /\bSkriv\s+ut\b/i,
    /\bRensa\b/i,
    /\bom\s+genomförd\s+utbildningsaktivitet/i,
    /^Sökande\s*$/i, // Bara exakt "Sökande" (enskild rad), inte när det ingår i en mening
    /\bIntygsutfärdande\s+handledare\s+intygar\s+att\s+sökanden/i,
    /\bintygar\s+att\s+sökanden/i,
    /\bbedömer\s+att\s+han\s+eller\s+hon/i,
    /^Klinisk\s+tjänstgöring\s*$/i, // Bara exakt rubrik, inte när det ingår i "Tjänstgöringsställe för klinisk tjänstgöring"
  ];

  // Filtrera bort rader som matchar IGNORE-listan
  const lines = linesAll.filter((l) => {
    // Kontrollera exakta matchningar först
    if (IGNORE_EXACT.some((exact) => l === exact)) return false;
    // Kontrollera regex-mönster
    if (IGNORE.some((re) => re.test(l))) return false;
    return true;
  });

  if (lines.length < 5) return null;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  // Identifiera rubriker
  const isLabelLine = (l: string) => {
    const n = norm(l);
    return (
      n === norm("Efternamn") ||
      n === norm("Personnummer") ||
      n.includes("klinisk tjanstgoring under handledning") ||
      n === norm("Förnamn") ||
      n === norm("Fornamn") ||
      n.includes("specialitet som ansokan avser") ||
      n.includes("specialitet som ansökan avser") ||
      n.includes("delmal som intyget avser") ||
      n.includes("delmål som intyget avser") ||
      n.includes("tjanstgoringsstalle for klinisk tjanstgoring") ||
      n.includes("tjanstgoringsstalle") ||
      n.includes("beskrivning av den kliniska tjanstgoringen") ||
      n.includes("beskrivning") ||
      n.includes("period") ||
      n === norm("Namnförtydligande") ||
      n === norm("Namnfortydligande") ||
      (n === norm("Specialitet") && !n.includes("ansokan")) ||
      n === norm("Tjänsteställe") ||
      n === norm("Tjanstestalle") ||
      n === norm("Namnteckning") ||
      n === norm("Ort och datum") ||
      n === norm("Ort o datum")
    );
  };

  // Kontrollera om en rad ska ignoreras
  const shouldIgnoreLine = (l: string): boolean => {
    if (!l) return true;
    // Blockera alla rader som börjar med "HSLF"
    if (/^HSLF/i.test(l.trim())) return true;
    // Kontrollera IGNORE-mönster
    if (IGNORE.some((re) => re.test(l))) return true;
    // Kontrollera exakta matchningar
    if (IGNORE_EXACT.some((exact) => l === exact)) return true;
    // Ignorera rubriker som inte ska inkluderas: Namnteckning, Ort och datum, Personnummer (handledarens)
    const n = norm(l);
    if (n === norm("Namnteckning") || n === norm("Ort och datum") || n === norm("Ort o datum")) {
      return true;
    }
    return false;
  };

  // Extrahera värde efter rubrik
  const valueAfter = (labelRe: RegExp, stopRes: RegExp[] = []): string | undefined => {
    // Försök hitta rubriken
    let idx = lines.findIndex((l) => labelRe.test(l));
    
    // Om inte hittat, försök med mer flexibel matchning
    if (idx < 0) {
      const patternStr = labelRe.source
        .replace(/\\b/g, '')
        .replace(/[.*+?^${}()|[\]\\]/g, '')
        .replace(/\\s\+/g, '\\s*')
        .replace(/\\s\*/g, '\\s*');
      const flexibleRe = new RegExp(patternStr, 'i');
      idx = lines.findIndex((l) => flexibleRe.test(norm(l)));
    }
    
    if (idx < 0) return undefined;

    // "Label: value" på samma rad
    const sameLine = lines[idx].split(":").slice(1).join(":").trim();
    if (sameLine) return sameLine;

    // För Beskrivning: samla alla rader tills nästa rubrik
    const isDescription = labelRe.source.includes("Beskrivning");
    
    if (isDescription) {
      const out: string[] = [];
      for (let i = idx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (!l) break;
        if (shouldIgnoreLine(l)) continue;
        if (isLabelLine(l)) break;
        if (stopRes.some((re) => re.test(l))) break;
        out.push(l);
      }
      return out.join("\n").trim() || undefined;
    } else {
      // För ALLA övriga fält: ta BARA nästa rad (inte flera rader)
      if (idx + 1 >= lines.length) return undefined;
      const nextLine = lines[idx + 1];
      if (!nextLine) return undefined;
      if (shouldIgnoreLine(nextLine)) return undefined;
      if (isLabelLine(nextLine)) return undefined;
      if (stopRes.some((re) => re.test(nextLine))) return undefined;
      
      // För "Tjänsteställe": ta bara nästa rad och stopp om den innehåller "FS" eller "HSLF"
      const isTjanstestalle = labelRe.source.includes("Tjänsteställe") || 
                              labelRe.source.includes("Tjanstestalle");
      if (isTjanstestalle) {
        const trimmed = nextLine.trim();
        const fsMatch = trimmed.match(/^(.+?)(?:\s+FS\s+|\s+HSLF)/i);
        if (fsMatch) {
          return fsMatch[1].trim() || undefined;
        }
        return trimmed || undefined;
      }
      
      return nextLine.trim() || undefined;
    }
  };

  // Bas (personnummer/delmål/period-range) som fallback
  const base = extractCommon(raw);

  // Namn: Efternamn och Förnamn är separata rubriker, slå ihop till "Förnamn Efternamn"
  const lastName = valueAfter(/^Efternamn$/i) ||
                   valueAfter(/Efternamn/i);
  const firstName = valueAfter(/^Förnamn$/i) || 
                   valueAfter(/Fornamn$/i) ||
                   valueAfter(/Förnamn/i);
  const fullName = firstName && lastName 
    ? `${firstName.trim()} ${lastName.trim()}`.trim()
    : (firstName || lastName || undefined);

  // Personnummer
  const pnrText = valueAfter(/^Personnummer$/i) || lines.join(" ");
  const personnummer = extractPersonnummer(pnrText) || base.personnummer;

  // Specialitet som ansökan avser
  const specialtyHeader = valueAfter(/Specialitet\s+som\s+ansökan\s+avser/i) ||
                         valueAfter(/Specialitet\s+som\s+ansokan\s+avser/i);

  // Delmål
  const delmalText = valueAfter(/Delmål\s+som\s+intyget\s+avser/i) ||
                     valueAfter(/Delmal\s+som\s+intyget\s+avser/i);
  let rawDelmalCodes: string[] | undefined;
  if (delmalText) {
    rawDelmalCodes = extractDelmalCodes(delmalText);
  }
  if (!rawDelmalCodes || rawDelmalCodes.length === 0) {
    rawDelmalCodes = extractDelmalCodes(raw);
  }
  const delmalCodes = rawDelmalCodes && rawDelmalCodes.length > 0 
    ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) 
    : undefined;

  // Tjänstgöringsställe för klinisk tjänstgöring
  const clinic = valueAfter(/Tjänstgöringsställe\s+för\s+klinisk\s+tjänstgöring/i) ||
                 valueAfter(/Tjanstgoringsstalle\s+for\s+klinisk\s+tjanstgoring/i) ||
                 valueAfter(/Tjänstgöringsställe/i);

  // Beskrivning av den kliniska tjänstgöringen
  const descriptionStopPatterns = [
    /^Period/i,
    /^Namnförtydligande/i,
    /^Namnfortydligande/i,
    /^Ort och datum/i,
    /^Namnteckning/i,
  ];
  const description = valueAfter(/Beskrivning\s+av\s+den\s+kliniska\s+tjänstgöringen/i, descriptionStopPatterns) ||
                      valueAfter(/Beskrivning\s+av\s+den\s+kliniska\s+tjanstgoringen/i, descriptionStopPatterns) ||
                      valueAfter(/Beskrivning/i, descriptionStopPatterns);

  // Period
  const periodText = valueAfter(/Period/i);
  const period = periodText ? extractPeriodFromZoneText(periodText) : undefined;

  // Handledare
  const supervisorName = valueAfter(/Namnförtydligande/i) ||
                        valueAfter(/Namnfortydligande/i);
  
  // Handledarens specialitet (inte sökandens)
  // Hitta "Specialitet" som INTE innehåller "ansökan" eller "ansokan"
  let supervisorSpeciality: string | undefined = undefined;
  const supSpecIdx = lines.findIndex((l) => {
    const n = norm(l);
    return n === norm("Specialitet") && !n.includes("ansokan") && !n.includes("ansökan");
  });
  if (supSpecIdx >= 0 && supSpecIdx + 1 < lines.length) {
    const nextLine = lines[supSpecIdx + 1];
    if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
      supervisorSpeciality = nextLine.trim();
    }
  }
  
  // Handledarens tjänsteställe
  const supervisorSite = valueAfter(/Tjänsteställe/i) ||
                         valueAfter(/Tjanstestalle/i);

  // Kontrollera om vi har tillräckligt med data
  const ok = fullName || personnummer || specialtyHeader || clinic || 
             description || delmalCodes?.length || period?.startISO || period?.endISO ||
             supervisorName;
  
  if (!ok) return null;

  return {
    kind,
    fullName,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    personnummer: personnummer || undefined,
    specialtyHeader: specialtyHeader || undefined,
    delmalCodes,
    clinic: clinic || undefined,
    period: period || fallbackPeriod(raw),
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: supervisorSite || undefined,
  };
}

/**
 * Stöd för manuellt annoterad OCR-text där:
 * - R<n> = rubrikrad (ska aldrig in i textfält)
 * - T<n> = text kopplad till rubriken R<n>
 * - X    = rad som aldrig ska in i något fält
 *
 * Ex: "R1 Efternamn" + "T1 Fröberg"
 */
function parseByAnnotatedMarkers(raw: string): ParsedIntyg | null {
  const kind = "2021-B9-KLIN";
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rtCount = lines.filter((l) => /^[RT]\d+\b/.test(l)).length;
  const xCount = lines.filter((l) => /^X\b/.test(l)).length;
  // Kör bara denna logik om det tydligt ser annoterat ut
  if (rtCount < 6 && xCount < 3) return null;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  type Bucket = { label?: string; values: string[] };
  const buckets = new Map<number, Bucket>();

  const getBucket = (n: number) => {
    const b = buckets.get(n) ?? { values: [] };
    buckets.set(n, b);
    return b;
  };

  const looksLikeValue = (s: string) => {
    const t = s.trim();
    if (!t) return false;
    // personnummer/datum/period
    if (/\d{6}[-+ ]?\d{4}\b/.test(t)) return true;
    if (/\b\d{6}\s*[-–—]\s*\d{6}\b/.test(t)) return true;
    if (/\b\d{6}-\d{6}\b/.test(t)) return true;
    if (/\b\d{2,4}\D?\d{2}\D?\d{2}\b/.test(t)) return true;
    // annars: en "vanlig" text kan också vara value
    return true;
  };

  for (const line of lines) {
    // X-rader ska alltid ignoreras
    if (/^X\b/.test(line)) continue;

    const m = /^([RT])(\d+)\s*(.*)$/.exec(line);
    if (!m) continue;

    const tag = m[1];
    const id = Number(m[2]);
    const rest = (m[3] || "").trim();
    if (!Number.isFinite(id)) continue;

    const b = getBucket(id);

    // Om rest råkar vara tomt, inget att göra
    if (!rest) continue;

    if (tag === "R") {
      // Ibland kan OCR/handpåläggning råka skriva value som R-rad (t.ex. "R2 861027-4857").
      // Om vi redan har label för id, eller rest ser ut som värde, lägg den som value.
      if (b.label && looksLikeValue(rest)) {
        b.values.push(rest);
      } else {
        // Annars är det rubriken
        b.label = rest;
      }
      continue;
    }

    // tag === "T"
    // Om T-raden råkar innehålla rubrikord (t.ex. "T7 Beskrivning") – ignorera den.
    if (b.label) {
      const nRest = norm(rest);
      const nLab = norm(b.label);
      if (nRest === nLab) continue;
    }
    b.values.push(rest);
  }

  const findIdByLabel = (needle: string) => {
    const nNeedle = norm(needle);
    for (const [id, b] of buckets.entries()) {
      if (!b.label) continue;
      const n = norm(b.label);
      if (n === nNeedle || n.includes(nNeedle)) return id;
    }
    return null;
  };

  const valueFor = (id: number | null) => {
    if (!id) return undefined;
    const b = buckets.get(id);
    if (!b || !b.values.length) return undefined;
    return b.values.join("\n").trim() || undefined;
  };

  const lastName = valueFor(findIdByLabel("Efternamn"));
  const firstName = valueFor(findIdByLabel("Förnamn")) || valueFor(findIdByLabel("Fornamn"));
  // fullName: förnamn först
  const fullName = `${(firstName || "").trim()} ${(lastName || "").trim()}`.trim() || undefined;

  // Sökandens personnummer: rubriken brukar vara "Personnummer" nära toppen.
  // Vi tar första personnummer vi hittar i T-values om möjligt.
  let personnummer: string | undefined;
  {
    const pId = findIdByLabel("Personnummer");
    const v = valueFor(pId);
    const m = v ? v.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) : null;
    personnummer = m?.[0]?.replace(/\s+/g, "") || undefined;
    if (!personnummer) {
      // fallback: första personnummer i hela texten (kan råka vara handledaren, men oftast kommer sökanden först)
      const all = Array.from(buckets.values()).flatMap((b) => b.values);
      const m2 = all.join("\n").match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/);
      personnummer = m2?.[0]?.replace(/\s+/g, "") || undefined;
    }
  }

  const specialtyHeader = valueFor(findIdByLabel("Specialitet som ansökan avser"));
  const clinic = valueFor(findIdByLabel("Tjänstgöringsställe för klinisk tjänstgöring"));

  const delmalRaw = valueFor(findIdByLabel("Delmål som intyget avser")) || "";
  const rawDelmalCodes = extractDelmalCodes(delmalRaw);
  // Normalisera och sortera delmål för 2021
  const delmalCodes = rawDelmalCodes.length > 0 ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) : [];

  const periodText = valueFor(findIdByLabel("Period")) || "";
  const period = extractPeriodFromZoneText(periodText) || fallbackPeriod(raw);

  // Beskrivning: i din mall är T7 bara ordet "Beskrivning" (rubrik) och ska ignoreras.
  // Om det finns fler rader i samma bucket tar vi dem.
  let description = valueFor(findIdByLabel("Beskrivning av den kliniska tjänstgöringen"));
  if (description) {
    const d = description.trim();
    if (norm(d) === norm("Beskrivning")) description = undefined;
  }

  const supervisorName = valueFor(findIdByLabel("Namnförtydligande"));
  const supervisorSpeciality = valueFor(findIdByLabel("Specialitet"));
  const supervisorSite = valueFor(findIdByLabel("Tjänsteställe"));

  // Kräver minst grundfält för att acceptera
  const score =
    (fullName ? 1 : 0) +
    (personnummer ? 1 : 0) +
    (specialtyHeader ? 1 : 0) +
    (clinic ? 1 : 0) +
    (period?.startISO || period?.endISO ? 1 : 0) +
    (delmalCodes.length ? 1 : 0);

  if (score < 4) return null;

  return {
    kind,
    fullName,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    personnummer,
    specialtyHeader: specialtyHeader || undefined,
    delmalCodes: delmalCodes.length ? delmalCodes : undefined,
    clinic: clinic || undefined,
    period,
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: supervisorSite || undefined,
  };
}

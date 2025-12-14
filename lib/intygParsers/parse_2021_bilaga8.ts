// lib/intygParsers/parse_2021_bilaga8.ts
import { ExtractedCommon, extractCommon } from "../fieldExtract";
import type { OcrWord } from "@/lib/ocr";
import { extractDates } from "@/lib/dateExtract";
import type { ParsedIntyg } from "./types";
import { normalizeAndSortDelmalCodes2021 } from "./common";

export function parse_2021_bilaga8(text: string, words?: OcrWord[]): ParsedIntyg {
  // 1) Om användaren har annoterat med X/R/T, använd det först (mycket mer robust).
  const annotated = parseByAnnotatedMarkers(text);
  if (annotated) return annotated;

  // 2) OCR.space ParsedText (utan R/T/X) – rubrik-baserad parsing (motsvarar den "tydliga textfilen").
  const headings = parseByOcrSpaceHeadings(text);
  if (headings) return headings;

  // 3) Sista fallback: äldre enkel regex
  const base = extractCommon(text);
  const { fullName, firstName, lastName } = extractFullNameBlock(text);
  const personnummer = extractPersonnummer(text);
  const specialtyHeader = extractSpecialty(text);
  const rawDelmalCodes = extractDelmalCodes(text);
  const delmalCodes = rawDelmalCodes.length > 0 ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) : undefined;
  const clinicLine = matchLine(text, /(Tjänstgöringsställe|Auskultation)/i);
  const { clinic, period } = extractClinicAndPeriodFromLine(clinicLine);
  const description = extractBlockAfterLabel(text, /Beskrivning av auskultationen/i);

  return { 
    kind: "2021-B8-AUSK", 
    ...base,
    fullName, 
    firstName, 
    lastName, 
    personnummer, 
    specialtyHeader,
    delmalCodes, 
    clinic, 
    period: period ?? fallbackPeriod(text), 
    description 
  };
}

function matchLine(text: string, re: RegExp): string {
  const m = text.split(/\r?\n/).find(l => re.test(l));
  return m ?? "";
}

function extractDelmalCodes(text: string): string[] {
  const res = new Set<string>();
  const re = /\b(ST?[abc][0-9]{1,2})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) res.add(m[1].toUpperCase());
  return Array.from(res);
}

function extractPersonnummer(text: string): string | undefined {
  const m = text.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/);
  return m ? m[0].replace(/\s+/g, "") : undefined;
}

function extractFullNameBlock(text: string): { fullName?: string, firstName?: string, lastName?: string } {
  // Normalisera vanliga OCR-fel för Förnamn/Efternamn
  const normalizedText = text
    .replace(/Fömamn/gi, "Förnamn")
    .replace(/Eftemamn/gi, "Efternamn");

  const lines = normalizedText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  
  let firstName: string | undefined;
  let lastName: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const n = norm(line);
    
    if (n.includes("fornamn") && !n.includes("efternamn")) {
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !isLabelLine(nextLine)) {
          firstName = nextLine;
        }
      }
    }
    
    if (n.includes("efternamn") && !n.includes("fornamn")) {
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !isLabelLine(nextLine)) {
          lastName = nextLine;
        }
      }
    }
  }

  const fullName = firstName && lastName 
    ? `${firstName.trim()} ${lastName.trim()}`.trim()
    : (firstName || lastName || undefined);

  return { fullName, firstName, lastName };
}

function extractSpecialty(text: string): string | undefined {
  const m = text.match(/Specialitet\s+som\s+ansökan\s+avser[^\n]*\n([^\n]+)/i);
  return m ? m[1].trim() : undefined;
}

function extractBlockAfterLabel(text: string, labelRe: RegExp): string | undefined {
  const m = text.match(new RegExp(labelRe.source + "[^\n]*\n([\\s\\S]+?)(?=\\n\\s*(?:Namnteckning|Ort och datum|Personnummer|Intygsutfärdande|Namnförtydligande|Specialitet|Tjänsteställe|$))", "i"));
  return m ? m[1].trim() : undefined;
}

function extractClinicAndPeriodFromLine(line: string): { clinic?: string, period?: { startISO?: string, endISO?: string } } {
  const clinicMatch = line.match(/Tjänstgöringsställe[^\n]*:\s*([^\n]+)/i);
  const clinic = clinicMatch ? clinicMatch[1].trim() : undefined;
  const period = extractDates(line);
  return { clinic, period };
}

function fallbackPeriod(text: string): { startISO?: string, endISO?: string } | undefined {
  return extractDates(text);
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isLabelLine(line: string): boolean {
  const n = norm(line);
  return (
    n.includes("efternamn") ||
    n.includes("fornamn") ||
    n.includes("personnummer") ||
    n.includes("specialitet som ansokan avser") ||
    n.includes("delmal som intyget avser") ||
    n.includes("tjanstgoringsstalle for auskultation") ||
    n.includes("beskrivning av auskultationen") ||
    n.includes("period") ||
    n.includes("namnfortydligande") ||
    n.includes("specialitet") && !n.includes("ansokan") ||
    n.includes("tjanstestalle") ||
    n.includes("namnteckning") ||
    n.includes("ort och datum") ||
    n.includes("personnummer") && n.includes("galler endast handledare")
  );
}

function parseByOcrSpaceHeadings(raw: string): ParsedIntyg | null {
  // Normalisera OCR-fel: "Fömamn" -> "Förnamn", "Eftemamn" -> "Efternamn"
  const normalizedRaw = raw
    .replace(/\bFömamn\b/gi, "Förnamn")
    .replace(/\bEftemamn\b/gi, "Efternamn");

  const lines = normalizedRaw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Ignorera boilerplate-rader
  const IGNORE = [
    /^Rensa$/i,
    /^Bilaga\s+nr:/i,
    /^INTYG$/i,
    /^om\s+genomförd\s+utbildningsaktivitet\s+och\s+uppfyllda\s+kompetenskrav$/i,
    /^Skriv\s+ut$/i,
    /^Sökande$/i,
    /^Auskultation$/i,
    /^Intygsutfärdande\s+handledare\s+intygar\s+att\s+sökanden\s+har\s+genomfört\s+utbildningsaktiviteten\s+och/i,
    /^bedömer\s+att\s+han\s+eller\s+hon\s+har\s+uppfyllt\s+kompetenskrav\s+i\s+delmålet/i,
    /^HSLF[- ]?FS\s+2021:8\s+Bilaga\s+8/i,
    /^HSLF/i, // Blockera alla rader som börjar med HSLF
  ];

  const shouldIgnoreLine = (l: string): boolean => {
    if (!l) return true;
    // Blockera alla rader som börjar med HSLF
    if (/^HSLF/i.test(l.trim())) return true;
    return IGNORE.some((re) => re.test(l));
  };

  // Hjälpfunktion för att hitta värde efter en rubrik
  const valueAfter = (
    labelRe: RegExp,
    stopBefore: RegExp[] = []
  ): string | undefined => {
    const idx = lines.findIndex((l) => {
      if (shouldIgnoreLine(l)) return false;
      return labelRe.test(l);
    });
    if (idx < 0) return undefined;

    // För Tjänsteställe: bara FÖLJANDE RAD ska inkluderas
    const isTjanstestalle = labelRe.source.includes("Tjänsteställe") || labelRe.source.includes("Tjanstestalle");
    
    if (isTjanstestalle) {
      // För Tjänsteställe: ta BARA nästa rad (inte flera rader)
      if (idx + 1 >= lines.length) return undefined;
      const nextLine = lines[idx + 1];
      if (!nextLine) return undefined;
      if (shouldIgnoreLine(nextLine)) return undefined; // Ignorera om raden ska ignoreras
      if (isLabelLine(nextLine)) return undefined;
      return nextLine.trim() || undefined;
    }

    // För övriga fält: ta alla rader tills nästa rubrik
    const out: string[] = [];
    for (let i = idx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!l) break;
      if (shouldIgnoreLine(l)) continue; // Hoppa över rader som ska ignoreras
      // Stoppa vid nästa rubrik
      if (isLabelLine(l)) break;
      // Stoppa vid stoppord
      if (stopBefore.some((re) => re.test(l))) break;
      out.push(l);
    }
    return out.join("\n").trim() || undefined;
  };

  // Stoppord för beskrivningen
  const descriptionStopPatterns = [
    /^Namnteckning/i,
    /^Ort och datum/i,
    /^Personnummer\s*\(gäller endast handledare\)/i,
    /^Namnförtydligande/i,
    /^Specialitet/i,
    /^Tjänsteställe/i,
  ];

  // Namn: Efternamn och Förnamn är separata rubriker, slå ihop till "Förnamn Efternamn"
  const lastName = valueAfter(/Efternamn/i);
  const firstName = valueAfter(/Förnamn/i) || valueAfter(/Fornamn/i);
  const fullName = firstName && lastName 
    ? `${firstName.trim()} ${lastName.trim()}`.trim()
    : (firstName || lastName || undefined);

  // Personnummer
  const pnrText = valueAfter(/Personnummer/i) || lines.join(" ");
  const personnummer =
    (pnrText.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) || [])[0] || undefined;

  // Delmål
  const delmalText = valueAfter(/Delmål som intyget avser/i, [
    /Tjänstgöringsställe/i,
    /Beskrivning/i,
  ]);
  const rawDelmalCodes =
    (delmalText ? extractDelmalCodes(delmalText) : extractDelmalCodes(raw)) ?? [];
  const delmalCodes = rawDelmalCodes.length > 0 ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) : undefined;

  // Specialitet som ansökan avser
  const specialtyHeaderRaw = valueAfter(/Specialitet som ansökan avser/i, [
    /Delmål som intyget avser/i,
    /Tjänstgöringsställe/i,
    /Beskrivning/i,
  ]);
  const specialtyHeader = specialtyHeaderRaw?.trim() || undefined;

  // Tjänstgöringsställe för auskultation
  const clinic = valueAfter(/Tjänstgöringsställe för auskultation/i, [
    /Beskrivning/i,
  ]);

  // Period
  const periodText = valueAfter(/Period/i, [
    /Namnförtydligande/i,
    /Beskrivning/i,
  ]);
  const period = periodText ? extractDates(periodText) : undefined;

  // Beskrivning
  const description = valueAfter(/Beskrivning av auskultationen/i, descriptionStopPatterns);

  // Intygare (handledare)
  const supervisorName = valueAfter(/Namnförtydligande/i);
  // OBS: "Specialitet" ska INTE matcha "Specialitet som ansökan avser"
  const supervisorSpeciality = (() => {
    // Leta efter "Specialitet" men INTE "Specialitet som ansökan avser"
    const idx = lines.findIndex((l) => {
      if (shouldIgnoreLine(l)) return false;
      const n = norm(l);
      return n.includes("specialitet") && !n.includes("ansokan") && !n.includes("ansökan");
    });
    if (idx < 0) return undefined;
    
    // Ta nästa rad (inte flera)
    if (idx + 1 >= lines.length) return undefined;
    const nextLine = lines[idx + 1];
    if (!nextLine || shouldIgnoreLine(nextLine) || isLabelLine(nextLine)) return undefined;
    return nextLine.trim() || undefined;
  })();
  
  // Tjänsteställe: bara FÖLJANDE RAD ska inkluderas
  const supervisorSite = valueAfter(/Tjänsteställe/i) || valueAfter(/Tjanstestalle/i);

  // Om vi fick åtminstone några fält så anser vi att rubrik-parsning lyckades
  const ok = Boolean(fullName || personnummer || delmalCodes || clinic || description || supervisorName);

  if (!ok) return null;

  const base = extractCommon(raw);

  return {
    kind: "2021-B8-AUSK",
    personnummer,
    delmalCodes,
    fullName: fullName || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    specialtyHeader: specialtyHeader || undefined,
    clinic: clinic || undefined,
    period: period || base.period,
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: supervisorSite || undefined,
  };
}

/**
 * Stöd för manuellt annoterad OCR-text där:
 * - X = rad ska ignoreras
 * - R = rubrik (t.ex. "R Efternamn")
 * - T = text-värde (t.ex. "T Andersson")
 */
function parseByAnnotatedMarkers(raw: string): ParsedIntyg | null {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);

  // Normalisera funktion
  const norm = (s: string): string =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  // Mappa: rubrik-text → värde (kan vara flerradigt)
  const rubricToValue = new Map<string, string>();

  // Hjälpfunktion för att kontrollera om en rad ska ignoreras
  const shouldIgnoreLineAnnotated = (l: string): boolean => {
    if (!l) return true;
    // Blockera alla rader som börjar med "HSLF"
    if (/^HSLF/i.test(l.trim())) return true;
    // Ignorera boilerplate
    if (/^Rensa$/i.test(l)) return true;
    if (/^Bilaga\s+nr:/i.test(l)) return true;
    if (/^INTYG$/i.test(l)) return true;
    if (/^om\s+genomförd\s+utbildningsaktivitet/i.test(l)) return true;
    if (/^Skriv\s+ut$/i.test(l)) return true;
    if (/^Sökande$/i.test(l)) return true;
    if (/^Auskultation$/i.test(l)) return true;
    if (/^Intygsutfärdande\s+handledare/i.test(l)) return true;
    if (/^HSLF[- ]?FS\s+2021:8\s+Bilaga\s+8/i.test(l)) return true;
    return false;
  };

  // Iterera sekventiellt genom raderna
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Ignorera X-rader helt
    if (/^[xX]\b/.test(line)) continue;
    
    // Ignorera boilerplate-rader
    if (shouldIgnoreLineAnnotated(line)) continue;

    // Matcha R-rad (rubrik) - kan vara "R <rubrik>" eller "R<n> <rubrik>"
    const rMatch = /^[Rr](?:\d+)?\s+(.*)$/.exec(line);
    if (rMatch) {
      const rubricText = rMatch[1].trim();
      if (!rubricText) continue;

      // Kolla om detta är "Tjänsteställe" (bara FÖLJANDE RAD ska inkluderas)
      const nRubric = norm(rubricText);
      const isTjanstestalleRubric = nRubric.includes("tjanstestalle");

      // För Tjänsteställe: ta BARA nästa rad (inte flera rader)
      if (isTjanstestalleRubric) {
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && !/^[Rr](?:\d+)?\s/.test(nextLine) && !/^[xX]\b/.test(nextLine)) {
            // Om nästa rad är HSLF, hoppa över
            if (/^HSLF/i.test(nextLine.trim())) {
              continue;
            }
            if (!shouldIgnoreLineAnnotated(nextLine)) {
              rubricToValue.set(norm(rubricText), nextLine);
            }
          }
        }
        continue;
      }

      // För övriga rubriker: samla alla icke-X-rader tills nästa R-rad
      const valueLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (!nextLine) continue;

        // Stoppa vid nästa R-rad
        if (/^[Rr](?:\d+)?\s/.test(nextLine)) break;

        // Ignorera X-rader
        if (/^[xX]\b/.test(nextLine)) continue;
        
        // Ignorera boilerplate-rader
        if (shouldIgnoreLineAnnotated(nextLine)) {
          // Om det är HSLF, stoppa här
          if (/^HSLF/i.test(nextLine.trim())) break;
          continue;
        }

        // Om det är en T-rad med samma ID (om R hade ID), använd den och stoppa
        const rIdMatch = /^[Rr](\d+)\s/.exec(line);
        if (rIdMatch) {
          const tMatch = /^[Tt](\d+)\s*(.*)$/.exec(nextLine);
          if (tMatch && tMatch[1] === rIdMatch[1]) {
            valueLines.push(tMatch[2].trim());
            break;
          }
        }

        // Annars: lägg till alla icke-X, icke-R, icke-T rader
        if (!/^[Rr](?:\d+)?\s/.test(nextLine) && !/^[Tt]\d+\b/.test(nextLine)) {
          valueLines.push(nextLine);
        }
      }

      // Om vi hittade värden, samla dem till en sträng
      if (valueLines.length > 0) {
        const value = valueLines.join("\n").trim();
        rubricToValue.set(norm(rubricText), value);
      }
      continue;
    }

    // Matcha T-rad (explicit text-värde)
    const tMatch = /^[Tt](\d*)\s*(.*)$/.exec(line);
    if (tMatch) {
      // T-rader hanteras ovan när vi hittar motsvarande R-rad
      continue;
    }
    
    // Allt utan R/X/T ignoreras
  }

  // Hjälpfunktion för att hitta värde baserat på rubrik-text
  const findValueByRubric = (rubricVariants: string[]): string | undefined => {
    for (const variant of rubricVariants) {
      const nVariant = norm(variant);
      for (const [rubricNorm, value] of rubricToValue.entries()) {
        if (rubricNorm === nVariant || rubricNorm.includes(nVariant) || nVariant.includes(rubricNorm)) {
          return value;
        }
      }
    }
    return undefined;
  };

  // Bas (personnummer/delmål/period-range) från hela texten
  const base = extractCommon(raw);

  // Namn: Efternamn och Förnamn är separata rubriker, slå ihop till "Förnamn Efternamn"
  const lastName = findValueByRubric(["Efternamn"]);
  const firstName = findValueByRubric(["Förnamn", "Fornamn"]);
  const fullName = firstName && lastName 
    ? `${firstName.trim()} ${lastName.trim()}`.trim()
    : (firstName || lastName || undefined);

  // Extrahera fält baserat på rubriker
  const clinic = findValueByRubric(["Tjänstgöringsställe för auskultation", "Tjanstgoringsstalle for auskultation"]);
  const description = findValueByRubric(["Beskrivning av auskultationen"]);
  
  // Personnummer
  let pnrValue = findValueByRubric(["Personnummer", "Person nummer"]);
  const personnummer = pnrValue 
    ? (pnrValue.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) || [])[0]?.replace(/\s+/g, "")
    : base.personnummer;

  // Delmål
  let delmalValue = findValueByRubric(["Delmål som intyget avser", "Delmal som intyget avser"]);
  const rawDelmalCodes = delmalValue 
    ? extractDelmalCodes(delmalValue)
    : base.delmalCodes ?? [];
  const delmalCodes = rawDelmalCodes.length > 0 ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) : undefined;

  // Specialitet som ansökan avser
  let specialtyHeaderRaw = findValueByRubric(["Specialitet som ansökan avser", "Specialitet som ansokan avser"]);
  const specialtyHeader = specialtyHeaderRaw?.trim() || undefined;

  // Intygare
  const supervisorName = findValueByRubric(["Namnförtydligande", "Namnfortydligande"]);
  // OBS: "Specialitet" ska INTE matcha "Specialitet som ansökan avser"
  const supervisorSpeciality = (() => {
    // Leta efter "Specialitet" men INTE "Specialitet som ansökan avser"
    for (const [rubricNorm, value] of rubricToValue.entries()) {
      if (
        (rubricNorm.includes("specialitet") && !rubricNorm.includes("ansokan") && !rubricNorm.includes("ansökan")) ||
        rubricNorm === "specialitet"
      ) {
        return value;
      }
    }
    return undefined;
  })();
  // Tjänsteställe: bara FÖLJANDE RAD ska inkluderas
  const supervisorSite = (() => {
    // Hitta rubriken "Tjänsteställe" i rubricToValue
    for (const [rubricNorm, value] of rubricToValue.entries()) {
      if (rubricNorm.includes("tjanstestalle")) {
        // För Tjänsteställe: ta bara första raden (inte flera rader)
        const firstLine = value.split(/\r?\n/)[0]?.trim();
        return firstLine || undefined;
      }
    }
    // Om inte hittat i rubricToValue, leta i råtexten
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^[Rr](?:\d+)?\s/.test(line)) {
        const rMatch = /^[Rr](?:\d+)?\s+(.*)$/.exec(line);
        if (rMatch) {
          const rubricText = rMatch[1].trim();
          const n = norm(rubricText);
          if (n.includes("tjanstestalle")) {
            // Ta BARA nästa rad (inte flera)
            if (i + 1 < lines.length) {
              const nextLine = lines[i + 1].trim();
              if (nextLine && !/^[Rr](?:\d+)?\s/.test(nextLine) && !/^[xX]\b/.test(nextLine)) {
                if (shouldIgnoreLineAnnotated(nextLine)) {
                  // Om nästa rad är HSLF, returnera undefined
                  if (/^HSLF/i.test(nextLine.trim())) return undefined;
                  continue;
                }
                return nextLine;
              }
            }
          }
        }
      }
    }
    return undefined;
  })();

  // Period
  const periodText = findValueByRubric(["Period"]);
  const period = periodText ? extractDates(periodText) : undefined;

  return {
    kind: "2021-B8-AUSK",
    personnummer,
    delmalCodes,
    fullName: fullName || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    specialtyHeader: specialtyHeader || undefined,
    clinic: clinic || undefined,
    period: period || base.period,
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: supervisorSite || undefined,
  };
}

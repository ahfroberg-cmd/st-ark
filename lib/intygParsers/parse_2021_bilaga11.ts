// lib/intygParsers/parse_2021_bilaga11.ts
import { ExtractedCommon, extractCommon } from "../fieldExtract";
import type { OcrWord } from "@/lib/ocr";
import { extractDates } from "@/lib/dateExtract";
import type { ParsedIntyg } from "./types";
import { normalizeAndSortDelmalCodes2021 } from "./common";

export function parse_2021_bilaga11(text: string, words?: OcrWord[]): ParsedIntyg {
  // 1) Om användaren har annoterat med X/R/T, använd det först (mycket mer robust).
  const annotated = parseByAnnotatedMarkers(text);
  if (annotated) return annotated;

  // 2) OCR.space ParsedText (utan R/T/X) – rubrik-baserad parsing (motsvarar den "tydliga textfilen").
  const headings = parseByOcrSpaceHeadings(text);
  if (headings) return headings;

  // 3) Sista fallback: äldre enkel regex
  const base = extractCommon(text);
  const subject = (text.match(/Utvecklingsarbetets ämne.*?:\s*(.+)/i) || [])[1]?.trim();
  const desc = (text.match(/Beskrivning av ST-läkarens deltagande.*?:\s*(.+)$/i) || [])[1]?.trim();
  return { ...base, kind: "2021-B11-UTV", subject, description: desc };
}

function parseByOcrSpaceHeadings(raw: string): ParsedIntyg | null {
  // Normalisera OCR-fel: "Fömamn" -> "Förnamn", "Eftemamn" -> "Efternamn"
  const normalizedRaw = raw
    .replace(/\bFömamn\b/gi, "Förnamn")
    .replace(/\bEftemamn\b/gi, "Efternamn");
  
  const linesAll = normalizedRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const IGNORE: RegExp[] = [
    /^\*{3,}\s*result\s+for\s+image\/page/i,
    /^\*{3,}/,
    /^\s*(page|sida)\s*\d+\s*$/i,
    /^HSLF/i, // Blockera alla rader som börjar med "HSLF"
    /\bHSLF[-\s]?FS\b/i, // Matchar "HSLF- FS", "HSLF FS", etc.
    /\bHSLF[-\s]?FS\s+\d{4}:\d+/i, // Matchar "HSLF- FS 2021:81"
    /\bHSLF[-\s]?FS\s+\d{4}:\d+\s*\(/i, // Matchar "HSLF- FS 2021:81 ("
    /\bBilaga\s*11\b/i,
    /\bBilaga\s*nr\b/i,
    /^\s*INTYG\b/i,
    /\bSkriv\s+ut\b/i,
    /\bRensa\b/i,
    /\bom\s+genomförd\s+utbildningsaktivitet/i,
    /\bSökande\b/i,
    /\bDeltagande\s+i\s+utvecklingsarbete\b/i,
    /\bIntygsutfärdande\s+handledare/i,
    /\bintygar\s+att\s+sökanden/i,
    /\bbedömer\s+att\s+han\s+eller\s+hon/i,
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
      n.includes("utvecklingsarbetets amne") ||
      n.includes("utvecklingsarbetets amne (anges i rubrikform)") ||
      n.includes("beskrivning av st-lakarens deltagande") ||
      n.includes("namnfortydligande") ||
      n.includes("tjanstestalle") ||
      n.includes("ort och datum") ||
      n.includes("intygsutfardande") ||
      n.includes("namnteckning") ||
      n.includes("specialitet") && !n.includes("ansokan")
    );
  };

  // Kontrollera om en rad ska ignoreras (inklusive HSLF- FS-mönster)
  const shouldIgnoreLine = (l: string): boolean => {
    if (!l) return true;
    // Blockera alla rader som börjar med "HSLF"
    if (/^HSLF/i.test(l.trim())) return true;
    const n = norm(l);
    // Kontrollera IGNORE-mönster
    if (IGNORE.some((re) => re.test(l))) return true;
    // Ytterligare kontroll för HSLF- FS med siffror och kolon
    if (/\bHSLF[-\s]?FS\s+\d{4}:\d+/.test(l)) return true;
    // Ignorera rader som börjar med stoppord
    if (/^(namnteckning|ort och datum|personnummer)$/i.test(l.trim())) return true;
    return false;
  };

  const valueAfter = (labelRe: RegExp, stopRes: RegExp[] = []): string | undefined => {
    const idx = lines.findIndex((l) => labelRe.test(l));
    if (idx < 0) return undefined;

    // "Label: value" på samma rad
    const sameLine = lines[idx].split(":").slice(1).join(":").trim();
    if (sameLine) return sameLine;

    // Annars: ta nästa rad (såvida det inte är en annan rubrik eller stopp-mönster)
    // För beskrivningar kan det vara flera rader, så vi tar alla tills nästa rubrik
    const isDescription = labelRe.source.includes("Beskrivning");
    
    if (isDescription) {
      // För beskrivningar: ta alla rader tills nästa rubrik/stopp
      const out: string[] = [];
      for (let i = idx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (!l) break;
        if (shouldIgnoreLine(l)) continue; // Hoppa över rader som ska ignoreras
        if (isLabelLine(l)) break;
        if (stopRes.some((re) => re.test(l))) break;
        out.push(l);
      }
      return out.join("\n").trim() || undefined;
    } else {
      // För övriga fält: ta nästa rad (eller flera rader om det är flerradigt)
      // För "Tjänsteställe" kan det vara flera rader, så vi tar alla tills nästa rubrik eller HSLF
      const isTjanstestalle = labelRe.source.includes("Tjänsteställe") || labelRe.source.includes("Tjanstestalle");
      
      if (isTjanstestalle) {
        // För Tjänsteställe: ta alla rader tills nästa rubrik/stopp eller HSLF
        const out: string[] = [];
        for (let i = idx + 1; i < lines.length; i++) {
          const l = lines[i];
          if (!l) break;
          if (shouldIgnoreLine(l)) {
            // Om det är HSLF, stoppa här
            if (/^HSLF/i.test(l.trim())) break;
            continue; // Hoppa över andra ignorerbara rader
          }
          // Stoppa vid nästa rubrik (men inte om det är samma rubrik igen)
          if (isLabelLine(l) && !labelRe.test(l)) break;
          if (stopRes.some((re) => re.test(l))) break;
          out.push(l);
        }
        return out.join("\n").trim() || undefined;
      } else {
        // För övriga fält: ta bara nästa rad
        if (idx + 1 >= lines.length) return undefined;
        const nextLine = lines[idx + 1];
        if (!nextLine) return undefined;
        if (shouldIgnoreLine(nextLine)) return undefined; // Ignorera om raden ska ignoreras
        if (isLabelLine(nextLine)) return undefined;
        if (stopRes.some((re) => re.test(nextLine))) return undefined;
        return nextLine.trim() || undefined;
      }
    }
  };

  // Bas (personnummer/delmål/period-range) som fallback om rubriker inte ger träff
  const base = extractCommon(raw);

  // Namn: Efternamn och Förnamn är separata rubriker, slå ihop till "Förnamn Efternamn"
  const lastName = valueAfter(/Efternamn/i, [/Förnamn/i, /Fornamn/i]);
  const firstName = valueAfter(/Förnamn/i, [/Efternamn/i]) || valueAfter(/Fornamn/i, [/Efternamn/i]);
  const fullName = firstName && lastName 
    ? `${firstName.trim()} ${lastName.trim()}`.trim()
    : (firstName || lastName || undefined);

  // Ämne + beskrivning
  const subject =
    valueAfter(/Utvecklingsarbetets ämne\s*\(anges i rubrikform\)/i, [/Beskrivning av ST-läkarens deltagande/i, /Namnförtydligande/i]) ||
    valueAfter(/Utvecklingsarbetets amne\s*\(anges i rubrikform\)/i, [/Beskrivning av ST-läkarens deltagande/i, /Namnförtydligande/i]) ||
    valueAfter(/Utvecklingsarbetets ämne/i, [/Beskrivning av ST-läkarens deltagande/i, /Namnförtydligande/i]) ||
    valueAfter(/Utvecklingsarbetets amne/i, [/Beskrivning av ST-läkarens deltagande/i, /Namnförtydligande/i]);

  // Stoppord för beskrivningen
  const descriptionStopPatterns = [
    /^Namnteckning/i,
    /^Ort och datum/i,
    /^Namnförtydligande/i,
    /^Namnfortydligande/i,
    /^Specialitet/i,
    /^Tjänsteställe/i,
    /^Tjanstestalle/i,
  ];
  
  const description = valueAfter(/Beskrivning av ST-läkarens deltagande/i, descriptionStopPatterns);

  // Delmål (försök rubrikfält först, annars fallback från hela texten)
  const delmalText = valueAfter(/Delmål som intyget avser/i, [
    /Utvecklingsarbetets ämne\s*\(anges i rubrikform\)/i,
    /Utvecklingsarbetets amne\s*\(anges i rubrikform\)/i,
    /Utvecklingsarbetets ämne/i,
    /Utvecklingsarbetets amne/i,
    /Beskrivning av ST-läkarens deltagande/i,
  ]);
  const rawDelmalCodes =
    (delmalText ? extractCommon(delmalText).delmalCodes : undefined) ?? base.delmalCodes;
  // Normalisera och sortera delmål för 2021
  const delmalCodes = rawDelmalCodes ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) : undefined;

  // Personnummer (rubrikfält eller fallback) - men ignorera om det är en rubrik-rad
  const pnrText = valueAfter(/Personnummer/i) || lines.join(" ");
  const personnummer =
    (pnrText.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) || [])[0] || base.personnummer;

  // Specialitet som ansökan avser
  const specialtyHeaderRaw = valueAfter(/Specialitet som ansökan avser/i, [
    /Delmål som intyget avser/i,
    /Utvecklingsarbetets ämne\s*\(anges i rubrikform\)/i,
    /Utvecklingsarbetets amne\s*\(anges i rubrikform\)/i,
    /Utvecklingsarbetets ämne/i,
  ]);
  const specialtyHeader = specialtyHeaderRaw?.trim() || undefined;

  // Intygare
  const supervisorName = valueAfter(/Namnförtydligande/i);
  // OBS: "Specialitet" ska INTE matcha "Specialitet som ansökan avser"
  const supervisorSpeciality = (() => {
    // Leta efter "Specialitet" men INTE "Specialitet som ansökan avser"
    const idx = lines.findIndex((l) => {
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
  const supervisorSite = (() => {
    const idx = lines.findIndex((l) => /Tjänsteställe/i.test(l) || /Tjanstestalle/i.test(l));
    if (idx < 0) return undefined;
    
    // Ta BARA nästa rad (inte flera)
    if (idx + 1 >= lines.length) return undefined;
    const nextLine = lines[idx + 1];
    if (!nextLine) return undefined;
    if (shouldIgnoreLine(nextLine)) {
      // Om nästa rad är HSLF, returnera undefined
      if (/^HSLF/i.test(nextLine.trim())) return undefined;
      return undefined;
    }
    if (isLabelLine(nextLine)) return undefined;
    return nextLine.trim() || undefined;
  })();

  // Om vi fick åtminstone titel/subject eller beskrivning så anser vi att rubrik-parsning lyckades
  const ok = Boolean(subject || description || supervisorName || personnummer);
  if (!ok) return null;

  // Validera och förbättra parsning för tomma fält
  let finalSupervisorSite = supervisorSite;
  
  // Om Tjänsteställe saknas men andra fält är ifyllda, leta extra noga
  if (!finalSupervisorSite) {
    // Räkna igenom alla rubriker i texten och matcha mot obligatoriska fält
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const n = norm(line);
      
      // Identifiera rubriker
      if (n.includes("tjanstestalle") || n.includes("tjanstestalle")) {
        // Om vi hittar rubriken men inte har värdet, försök hämta det
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (nextLine && !isLabelLine(nextLine)) {
            // Ta alla rader tills nästa rubrik eller HSLF
            const valueLines: string[] = [];
            for (let j = i + 1; j < lines.length; j++) {
              const l = lines[j];
              if (!l) break;
              if (shouldIgnoreLine(l)) {
                if (/^HSLF/i.test(l.trim())) break;
                continue;
              }
              if (isLabelLine(l) && !/tjanstestalle/i.test(l)) break;
              valueLines.push(l);
            }
            const candidate = valueLines.join("\n").trim();
            if (candidate && candidate.length > 2) {
              finalSupervisorSite = candidate;
              break;
            }
          }
        }
      }
    }
    
    // Om fortfarande tomt, försök smart matching
    if (!finalSupervisorSite) {
      const filledFields = {
        firstName: !!firstName,
        lastName: !!lastName,
        personnummer: !!personnummer,
        specialtyHeader: !!specialtyHeader,
        subject: !!subject,
        description: !!description,
        supervisorName: !!supervisorName,
        supervisorSpeciality: !!supervisorSpeciality,
      };
      
      const filledCount = Object.values(filledFields).filter(Boolean).length;
      
      if (filledCount >= 5) {
        // Leta efter rader efter "Namnförtydligande" eller "Specialitet"
        const supervisorNameIdx = lines.findIndex((l) => /namnfortydligande/i.test(l));
        const supervisorSpecialityIdx = lines.findIndex((l) => /^specialitet/i.test(l));
        
        const searchStartIdx = Math.max(supervisorNameIdx, supervisorSpecialityIdx);
        if (searchStartIdx >= 0) {
          for (let i = searchStartIdx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) break;
            if (isLabelLine(line)) break;
            if (shouldIgnoreLine(line)) {
              if (/^HSLF/i.test(line.trim())) break;
              continue;
            }
            
            const n = norm(line);
            if (
              line.length > 2 &&
              line.length < 100 &&
              !/^\d+$/.test(line) &&
              !n.includes("ort och datum") &&
              !n.includes("intygsutfardande") &&
              !n.includes("namnteckning")
            ) {
              finalSupervisorSite = line.trim();
              break;
            }
          }
        }
      }
    }
  }

  return {
    kind: "2021-B11-UTV",
    personnummer,
    delmalCodes,
    fullName: fullName || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    specialtyHeader: specialtyHeader || undefined,
    subject: subject || undefined,
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: finalSupervisorSite || undefined,
  };
}

/**
 * Stöd för manuellt annoterad OCR-text där:
 * - R<n> = rubrikrad (samma som i app-fönstret) - alla icke-X-rader tills nästa R är värdet
 * - X    = rad som alltid ska ignoreras
 * - T<n> = explicit text kopplad till rubriken R<n> (används om användaren markerat det)
 */
function parseByAnnotatedMarkers(raw: string): ParsedIntyg | null {
  // Normalisera OCR-fel: "Fömamn" -> "Förnamn", "Eftemamn" -> "Efternamn"
  const normalizedRaw = raw
    .replace(/\bFömamn\b/gi, "Förnamn")
    .replace(/\bEftemamn\b/gi, "Efternamn");
  
  const lines = normalizedRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Kontrollera om det finns tillräckligt med R/X-markeringar
  const rCount = lines.filter((l) => /^[Rr]\d*\s/.test(l)).length;
  const xCount = lines.filter((l) => /^[xX]\b/.test(l)).length;
  if (rCount < 6 && xCount < 3) return null;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  // Mappa: rubrik-text → värde (kan vara flerradigt)
  const rubricToValue = new Map<string, string>();

  // Hjälpfunktion för att kontrollera om en rad ska ignoreras
  const shouldIgnoreLineAnnotated = (l: string): boolean => {
    if (!l) return true;
    // Blockera alla rader som börjar med "HSLF"
    if (/^HSLF/i.test(l.trim())) return true;
    // Ignorera HSLF- FS med siffror och kolon
    if (/\bHSLF[-\s]?FS\s+\d{4}:\d+/.test(l)) return true;
    return false;
  };

  // Iterera sekventiellt genom raderna
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Ignorera X-rader helt
    if (/^[xX]\b/.test(line)) continue;
    
    // Ignorera HSLF- FS-rader
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
        
        // Ignorera HSLF- FS-rader
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
  const subject = findValueByRubric([
    "Utvecklingsarbetets ämne (anges i rubrikform)",
    "Utvecklingsarbetets amne (anges i rubrikform)",
    "Utvecklingsarbetets ämne",
    "Utvecklingsarbetets amne"
  ]);
  const description = findValueByRubric(["Beskrivning av ST-läkarens deltagande i utvecklingsarbetet"]);
  
  // Personnummer
  let pnrValue = findValueByRubric(["Personnummer", "Person nummer"]);
  const personnummer = pnrValue 
    ? (pnrValue.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) || [])[0]?.replace(/\s+/g, "")
    : base.personnummer;

  // Delmål
  let delmalValue = findValueByRubric(["Delmål som intyget avser", "Delmal som intyget avser"]);
  const rawDelmalCodes = delmalValue 
    ? extractCommon(delmalValue).delmalCodes 
    : base.delmalCodes;
  // Normalisera och sortera delmål för 2021
  const delmalCodes = rawDelmalCodes ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) : undefined;

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

  return {
    kind: "2021-B11-UTV",
    personnummer,
    delmalCodes,
    fullName: fullName || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    specialtyHeader: specialtyHeader || undefined,
    subject: subject || undefined,
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: supervisorSite || undefined,
  };
}

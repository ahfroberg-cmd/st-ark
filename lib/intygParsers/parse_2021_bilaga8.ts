// lib/intygParsers/parse_2021_bilaga8.ts
import { ExtractedCommon, extractCommon } from "../fieldExtract";
import type { OcrWord } from "@/lib/ocr";
import { extractDates } from "@/lib/dateExtract";
import type { ParsedIntyg } from "./types";
import { 
  normalizeAndSortDelmalCodes2021,
  extractDelmalCodes,
  extractPersonnummer,
  extractFullNameBlock,
  extractSpecialty,
  extractBlockAfterLabel,
  extractClinicAndPeriodFromLine,
  fallbackPeriod
} from "./common";

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
  console.log('[Bilaga 8 Parser] ====== PARSER STARTAR ======');
  console.log('[Bilaga 8 Parser] Raw input length:', raw.length);
  console.log('[Bilaga 8 Parser] Raw input first 500 chars:', raw.substring(0, 500));
  
  // Normalisera OCR-fel: "Fömamn" -> "Förnamn", "Eftemamn" -> "Efternamn", "fömamn" -> "Förnamn", "eftemamn" -> "Efternamn"
  const normalizedRaw = raw
    .replace(/\bFömamn\b/gi, "Förnamn")
    .replace(/\bEftemamn\b/gi, "Efternamn")
    .replace(/\bfömamn\b/gi, "Förnamn")
    .replace(/\beftemamn\b/gi, "Efternamn");
  
  const linesAll = normalizedRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  
  console.log('[Bilaga 8 Parser] Total lines after split:', linesAll.length);

  const IGNORE: RegExp[] = [
    /^\*{3,}\s*result\s+for\s+image\/page/i,
    /^\*{3,}/,
    /^\s*(page|sida)\s*\d+\s*$/i,
    /^HSLF/i, // Blockera alla rader som börjar med "HSLF"
    /\bHSLF[-\s]?FS\b/i, // Matchar "HSLF- FS", "HSLF FS", etc.
    /\bHSLF[-\s]?FS\s+\d{4}:\d+/i, // Matchar "HSLF- FS 2021:8"
    /\bHSLF[-\s]?FS\s+\d{4}:\d+\s*\(/i, // Matchar "HSLF- FS 2021:8 ("
    /\bBilaga\s*8\b/i,
    /\bBilaga\s*nr\b/i,
    /^\s*INTYG\b/i,
    /\bSkriv\s+ut\b/i,
    /\bRensa\b/i,
    /\bom\s+genomförd\s+utbildningsaktivitet/i,
    /\bSökande\b/i,
    /^Auskultation\s*$/i, // Bara rader som BÖRJAR med "Auskultation" (rubrik), inte rader som innehåller "auskultation" i texten
    /\bIntygsutfärdande\s+handledare/i,
    /\bintygar\s+att\s+sökanden/i,
    /\bbedömer\s+att\s+han\s+eller\s+hon/i,
  ];

  // Logga vilka rader som filtreras bort
  const filteredOut: Array<{line: string; reason: string}> = [];
  const lines = linesAll.filter((l) => {
    for (const re of IGNORE) {
      if (re.test(l)) {
        filteredOut.push({line: l, reason: re.source});
        return false;
      }
    }
    return true;
  });
  console.warn('[Bilaga 8 Parser] Lines after IGNORE filter:', lines.length);
  console.warn('[Bilaga 8 Parser] Filtered out lines:', filteredOut);
  console.warn('[Bilaga 8 Parser] First 30 lines after filter:', lines.slice(0, 30));
  // Logga även alla rader för att se exakt vad som finns
  console.warn('[Bilaga 8 Parser] ALL lines:', lines);
  if (lines.length < 5) {
    console.warn('[Bilaga 8 Parser] RETURNERAR NULL - för få rader efter filter');
    return null;
  }

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
      n.includes("tjanstgoringsstalle for auskultation") ||
      n.includes("tjanstgoringsstalle for auskultationen") ||
      n.includes("beskrivning av auskultationen") ||
      n.includes("beskrivning av auskultation") ||
      n.includes("period") ||
      n.includes("namnfortydligande") ||
      n.includes("tjanstestalle") ||
      n.includes("ort och datum") ||
      n.includes("intygsutfardande") ||
      n.includes("namnteckning") ||
      (n.includes("specialitet") && !n.includes("ansokan"))
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
    // Försök hitta rubriken - testa både direkt matchning och flexibel matchning
    let idx = lines.findIndex((l) => labelRe.test(l));
    
    // Om inte hittat, försök med mer flexibel matchning (ta bort word boundaries och specialtecken)
    if (idx < 0) {
      const patternStr = labelRe.source
        .replace(/\\b/g, '')
        .replace(/[.*+?^${}()|[\]\\]/g, '')
        .replace(/\\s\+/g, '\\s*')
        .toLowerCase();
      const flexibleRe = new RegExp(patternStr, 'i');
      idx = lines.findIndex((l) => flexibleRe.test(l));
    }
    
    if (idx < 0) {
      console.warn('[Bilaga 8 Parser] valueAfter: Hittade INTE rubrik:', labelRe.source);
      // Ytterligare försök: leta efter delar av mönstret
      const patternWords = labelRe.source
        .replace(/[.*+?^${}()|[\]\\]/g, ' ')
        .replace(/\\b|\\s\+/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2)
        .map(w => w.toLowerCase());
      if (patternWords.length > 0) {
        const firstWord = patternWords[0];
        idx = lines.findIndex((l) => {
          const lower = l.toLowerCase();
          return lower.includes(firstWord) && patternWords.every(w => lower.includes(w));
        });
        if (idx >= 0) {
          console.warn('[Bilaga 8 Parser] valueAfter: Hittade med ord-baserad matchning på rad', idx, ':', lines[idx]);
        }
      }
      if (idx < 0) return undefined;
    } else {
      console.warn('[Bilaga 8 Parser] valueAfter: Hittade rubrik:', labelRe.source, 'på rad', idx, ':', lines[idx]);
    }

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
      // För ALLA övriga fält: ta BARA nästa rad (inte flera rader)
      if (idx + 1 >= lines.length) {
        console.warn('[Bilaga 8 Parser] valueAfter: Ingen nästa rad för', labelRe.source);
        return undefined;
      }
      const nextLine = lines[idx + 1];
      console.warn('[Bilaga 8 Parser] valueAfter: Nästa rad för', labelRe.source, ':', nextLine);
      if (!nextLine) {
        console.warn('[Bilaga 8 Parser] valueAfter: Nästa rad är tom');
        return undefined;
      }
      if (shouldIgnoreLine(nextLine)) {
        console.warn('[Bilaga 8 Parser] valueAfter: Nästa rad ska ignoreras:', nextLine);
        return undefined;
      }
      if (isLabelLine(nextLine)) {
        console.warn('[Bilaga 8 Parser] valueAfter: Nästa rad är en rubrik, stoppar:', nextLine);
        return undefined;
      }
      if (stopRes.some((re) => re.test(nextLine))) {
        console.warn('[Bilaga 8 Parser] valueAfter: Nästa rad matchar stopp-mönster');
        return undefined;
      }
      const result = nextLine.trim() || undefined;
      console.warn('[Bilaga 8 Parser] valueAfter: Returnerar:', result);
      return result;
    }
  };

  // Bas (personnummer/delmål/period-range) som fallback om rubriker inte ger träff
  const base = extractCommon(raw);

  // Namn: Efternamn och Förnamn är separata rubriker, slå ihop till "Förnamn Efternamn"
  // Hantera OCR-fel: "Eftemamn" och "Fömamn"
  // Gör regex mer flexibel - matcha även med extra mellanslag eller tecken
  const lastName = valueAfter(/Efternamn/i) ||
                   valueAfter(/Eftemamn/i) ||
                   valueAfter(/Efter\s+namn/i);
  const firstName = valueAfter(/Förnamn/i) || 
                   valueAfter(/Fornamn/i) ||
                   valueAfter(/Fömamn/i) ||
                   valueAfter(/For\s+namn/i);
  const fullName = firstName && lastName 
    ? `${firstName.trim()} ${lastName.trim()}`.trim()
    : (firstName || lastName || undefined);

  // Tjänstgöringsställe för auskultation - gör mer flexibel
  let clinic = valueAfter(/Tjänstgöringsställe\s+för\s+auskultation/i) ||
               valueAfter(/Tjanstgoringsstalle\s+for\s+auskultation/i) ||
               valueAfter(/Tjänstgöringsställe.*?auskultation/i) ||
               valueAfter(/Tjanstgoringsstalle.*?auskultation/i);
  
  console.warn('[Bilaga 8 Parser] clinic efter valueAfter:', clinic);
  
  // Fallback: leta direkt i lines om valueAfter misslyckades
  if (!clinic) {
    console.warn('[Bilaga 8 Parser] Försöker fallback för clinic...');
    // Försök hitta rubriken med olika varianter - både med och utan diakritiska tecken
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const n = norm(l);
      const lLower = l.toLowerCase();
      
      // Kolla om raden innehåller både "tjänstgöringsställe" och "auskultation"
      // Testa både normaliserad text och originaltext
      const hasTjanstgoringsstalle = n.includes("tjanstgoringsstalle") || 
                                     lLower.includes("tjänstgöringsställe") || 
                                     lLower.includes("tjanstgoringsstalle") ||
                                     l.includes("Tjänstgöringsställe") ||
                                     l.includes("Tjanstgoringsstalle");
      const hasAuskultation = n.includes("auskultation") || 
                             lLower.includes("auskultation") || 
                             lLower.includes("auskultationen") ||
                             l.includes("auskultation");
      
      console.warn('[Bilaga 8 Parser] Rad', i, ':', l, '- hasTjanstgoringsstalle:', hasTjanstgoringsstalle, 'hasAuskultation:', hasAuskultation);
      
      if (hasTjanstgoringsstalle && hasAuskultation) {
        console.warn('[Bilaga 8 Parser] Hittade clinic-rubrik på rad', i, ':', l);
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          console.warn('[Bilaga 8 Parser] Nästa rad:', nextLine);
          if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
            clinic = nextLine.trim();
            console.warn('[Bilaga 8 Parser] Clinic satt till:', clinic);
            break;
          } else {
            console.warn('[Bilaga 8 Parser] Nästa rad ignoreras eller är en rubrik:', {
              shouldIgnore: shouldIgnoreLine(nextLine),
              isLabel: isLabelLine(nextLine),
              nextLine
            });
          }
        }
      }
    }
  }
  
  console.warn('[Bilaga 8 Parser] clinic slutgiltigt:', clinic);

  // Period - gör mer flexibel
  const periodText = valueAfter(/Period/i) ||
                     valueAfter(/Period\s*\(ååmmdd/i);
  const period = periodText ? extractDates(periodText) : undefined;

  // Stoppord för beskrivningen
  const descriptionStopPatterns = [
    /^Namnteckning/i,
    /^Ort och datum/i,
    /^Personnummer\s*\(gäller endast handledare\)/i,
    /^Namnförtydligande/i,
    /^Namnfortydligande/i,
    /^Specialitet/i,
    /^Tjänsteställe/i,
    /^Tjanstestalle/i,
  ];
  
  // Beskrivning - gör mer flexibel, måste samla flera rader tills nästa rubrik
  let description = valueAfter(/Beskrivning\s+av\s+auskultationen/i, descriptionStopPatterns) ||
                    valueAfter(/Beskrivning\s+av\s+auskultation/i, descriptionStopPatterns) ||
                    valueAfter(/Beskrivning.*?auskultation/i, descriptionStopPatterns);
  
  console.warn('[Bilaga 8 Parser] description efter valueAfter:', description);
  
  // Fallback: leta direkt i lines om valueAfter misslyckades
  if (!description) {
    console.warn('[Bilaga 8 Parser] Försöker fallback för description...');
    // Försök hitta rubriken direkt i lines
    for (let descIdx = 0; descIdx < lines.length; descIdx++) {
      const l = lines[descIdx];
      const n = norm(l);
      const lLower = l.toLowerCase();
      
      // Kolla om raden innehåller både "beskrivning" och "auskultation"
      if ((n.includes("beskrivning") || lLower.includes("beskrivning")) &&
          (n.includes("auskultation") || lLower.includes("auskultation") || lLower.includes("auskultationen"))) {
        console.warn('[Bilaga 8 Parser] Hittade description-rubrik på rad', descIdx, ':', l);
        // Samla alla rader tills nästa rubrik
        const out: string[] = [];
        for (let i = descIdx + 1; i < lines.length; i++) {
          const l = lines[i];
          if (!l) break;
          if (shouldIgnoreLine(l)) {
            console.warn('[Bilaga 8 Parser] Ignorerar rad', i, ':', l);
            continue;
          }
          // För beskrivning: stoppa INTE vid "Period" om det är första raden efter rubriken
          // Vi vill ha med beskrivningen även om nästa rad är "Period"
          const isPeriodLine = n.includes("period") || lLower.includes("period");
          if (isLabelLine(l) && !isPeriodLine) {
            console.warn('[Bilaga 8 Parser] Stoppar vid rubrik på rad', i, ':', l);
            break;
          }
          // Om det är "Period" och vi redan har samlat något, stoppa
          if (isPeriodLine && out.length > 0) {
            console.warn('[Bilaga 8 Parser] Stoppar vid Period på rad', i, ':', l);
            break;
          }
          if (descriptionStopPatterns.some((re) => re.test(l))) {
            console.warn('[Bilaga 8 Parser] Stoppar vid stoppmönster på rad', i, ':', l);
            break;
          }
          out.push(l);
          console.warn('[Bilaga 8 Parser] Lägger till rad', i, ':', l);
        }
        if (out.length > 0) {
          description = out.join("\n").trim();
          console.warn('[Bilaga 8 Parser] Description satt till:', description);
          break;
        }
      }
    }
  }
  
  console.warn('[Bilaga 8 Parser] description slutgiltigt:', description);

  // Delmål (försök rubrikfält först, annars fallback från hela texten)
  const delmalText = valueAfter(/Delmål\s+som\s+intyget\s+avser/i) ||
                     valueAfter(/Delmal\s+som\s+intyget\s+avser/i) ||
                     valueAfter(/Delmål.*?intyget.*?avser/i);
  const rawDelmalCodes =
    (delmalText ? extractCommon(delmalText).delmalCodes : undefined) ?? base.delmalCodes;
  // Normalisera och sortera delmål för 2021
  const delmalCodes = rawDelmalCodes ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) : undefined;

  // Personnummer (rubrikfält eller fallback) - men ignorera om det är en rubrik-rad
  const pnrText = valueAfter(/Personnummer/i) || 
                  valueAfter(/Person\s+nummer/i) ||
                  lines.join(" ");
  const personnummer =
    (pnrText.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) || [])[0] || base.personnummer;

  // Specialitet som ansökan avser - gör mer flexibel
  // VIKTIGT: Måste matcha EXAKT "Specialitet som ansökan avser", INTE bara "Specialitet"
  const specialtyHeaderRaw = valueAfter(/Specialitet\s+som\s+ansökan\s+avser/i) ||
                             valueAfter(/Specialitet\s+som\s+ansokan\s+avser/i) ||
                             valueAfter(/Specialitet.*?ansökan.*?avser/i);
  const specialtyHeader = specialtyHeaderRaw?.trim() || undefined;
  
  console.warn('[Bilaga 8 Parser] specialtyHeader (ansökan avser):', specialtyHeader);

  // Intygare - gör mer flexibel
  const supervisorName = valueAfter(/Namnförtydligande/i) ||
                        valueAfter(/Namnfortydligande/i) ||
                        valueAfter(/Namn.*?fortydligande/i);
  
  // OBS: "Specialitet" (handledarens specialitet) ska INTE matcha "Specialitet som ansökan avser"
  // Vi måste explicit leta efter "Specialitet" som INTE följs av "som ansökan avser"
  const supervisorSpeciality = (() => {
    // Först: leta efter en rad som innehåller "Specialitet" men INTE "som ansökan avser"
    // Vi måste hitta rubriken "Specialitet" som kommer EFTER "Specialitet som ansökan avser"
    let foundSpecialitetSomAnsokanIdx = -1;
    let foundSpecialitetIdx = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const n = norm(l);
      
      // Hitta "Specialitet som ansökan avser" först
      if (n.includes("specialitet") && (n.includes("ansokan") || n.includes("ansökan")) && n.includes("avser")) {
        foundSpecialitetSomAnsokanIdx = i;
      }
      
      // Hitta "Specialitet" som INTE är "Specialitet som ansökan avser"
      // Denna måste komma EFTER "Specialitet som ansökan avser"
      if (n.includes("specialitet") && !n.includes("ansokan") && !n.includes("ansökan") && !n.includes("avser")) {
        // Om vi redan hittat "Specialitet som ansökan avser", så är detta förmodligen handledarens specialitet
        if (foundSpecialitetSomAnsokanIdx >= 0 && i > foundSpecialitetSomAnsokanIdx) {
          foundSpecialitetIdx = i;
          break;
        }
        // Om vi inte hittat "Specialitet som ansökan avser" ännu, spara detta som kandidat
        if (foundSpecialitetSomAnsokanIdx < 0 && foundSpecialitetIdx < 0) {
          foundSpecialitetIdx = i;
        }
      }
    }
    
    if (foundSpecialitetIdx < 0) return undefined;
    
    // Ta nästa rad (inte flera)
    if (foundSpecialitetIdx + 1 >= lines.length) return undefined;
    const nextLine = lines[foundSpecialitetIdx + 1];
    if (!nextLine || shouldIgnoreLine(nextLine) || isLabelLine(nextLine)) return undefined;
    return nextLine.trim() || undefined;
  })();
  
  console.warn('[Bilaga 8 Parser] supervisorSpeciality (handledarens):', supervisorSpeciality);
  // Tjänsteställe: bara FÖLJANDE RAD ska inkluderas
  const supervisorSite = valueAfter(/\bTjänsteställe\b/i) ||
                         valueAfter(/\bTjanstestalle\b/i) ||
                         (() => {
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

  // Om vi fick åtminstone några fält så anser vi att rubrik-parsning lyckades
      // För Bilaga 8: acceptera även om vi bara har delmål eller period
  const ok = Boolean(clinic || description || supervisorName || personnummer || delmalCodes || period?.startISO || period?.endISO);
  
  // Debug: logga vad vi hittade - ALLTID, inte bara i development
  console.log('[Bilaga 8 Parser] ====== PARSER RESULTAT ======');
  console.log('[Bilaga 8 Parser] fullName:', fullName);
  console.log('[Bilaga 8 Parser] firstName:', firstName);
  console.log('[Bilaga 8 Parser] lastName:', lastName);
  console.log('[Bilaga 8 Parser] personnummer:', personnummer);
  console.log('[Bilaga 8 Parser] delmalCodes:', delmalCodes);
  console.log('[Bilaga 8 Parser] clinic:', clinic);
  console.log('[Bilaga 8 Parser] description:', description);
  console.log('[Bilaga 8 Parser] specialtyHeader:', specialtyHeader);
  console.log('[Bilaga 8 Parser] supervisorName:', supervisorName);
  console.log('[Bilaga 8 Parser] supervisorSpeciality:', supervisorSpeciality);
  console.log('[Bilaga 8 Parser] supervisorSite:', supervisorSite);
  console.log('[Bilaga 8 Parser] period:', period);
  console.log('[Bilaga 8 Parser] ok:', ok);
  console.log('[Bilaga 8 Parser] Lines count:', lines.length);
  console.log('[Bilaga 8 Parser] First 20 lines:', lines.slice(0, 20));
  console.log('[Bilaga 8 Parser] ============================');
  
  if (!ok) {
    console.log('[Bilaga 8 Parser] RETURNERAR NULL - ok check misslyckades');
    return null;
  }

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
            // Ta BARA nästa rad (inte flera rader)
            if (shouldIgnoreLine(nextLine)) {
              // Om nästa rad är HSLF, hoppa över
              if (/^HSLF/i.test(nextLine.trim())) continue;
              continue;
            }
            const candidate = nextLine.trim();
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
        clinic: !!clinic,
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
    supervisorSite: finalSupervisorSite || undefined,
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
  // Samma logik som shouldIgnoreLine ovan
  const shouldIgnoreLineAnnotated = (l: string): boolean => {
    if (!l) return true;
    const trimmed = l.trim();
    
    // Blockera alla rader som börjar med "HSLF"
    if (/^HSLF/i.test(trimmed)) return true;
    
    // Exakta matchningar
    if (/^Rensa\s*$/i.test(trimmed)) return true;
    if (/^Bilaga\s+nr\s*:\s*$/i.test(trimmed)) return true;
    if (/^INTYG\s*$/i.test(trimmed)) return true;
    if (/^Skriv\s+ut\s*$/i.test(trimmed)) return true;
    if (/^Sökande\s*$/i.test(trimmed)) return true;
    if (/^Auskultation\s*$/i.test(trimmed)) return true;
    
    // Partiella matchningar för längre texter
    if (/om\s+genomförd\s+utbildningsaktivitet/i.test(trimmed)) return true;
    if (/Intygsutfärdande\s+handledare\s+intygar/i.test(trimmed)) return true;
    if (/bedömer\s+att\s+han\s+eller\s+hon\s+har\s+uppfyllt\s+kompetenskrav/i.test(trimmed)) return true;
    if (/^HSLF[- ]?FS\s+2021:8\s+Bilaga\s+8/i.test(trimmed)) return true;
    
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

  // Om vi inte hittade några R/T/X-annotationer, returnera null så att parseByOcrSpaceHeadings körs
  if (rubricToValue.size === 0) {
    return null;
  }

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


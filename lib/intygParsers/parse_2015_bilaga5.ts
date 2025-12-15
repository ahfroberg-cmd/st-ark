// lib/intygParsers/parse_2015_bilaga5.ts
import type { ParsedIntyg } from "./types";
import type { OcrWord } from "@/lib/ocr";
import {
  extractDelmalCodes, extractPersonnummer, extractFullNameBlock,
  extractSpecialty, extractBlockAfterLabel, extractClinicAndPeriodFromLine, 
  fallbackPeriod, extractPeriodFromZoneText, normalizeAndSortDelmalCodes2015
} from "./common";
import { extractCommon } from "../fieldExtract";

export function parse_2015_bilaga5(text: string, words?: OcrWord[]): ParsedIntyg {
  const kind = "2015-B5-KURS";

  // 1) Om användaren har annoterat med X/R/T, använd det först
  const annotated = parseByAnnotatedMarkers(text);
  if (annotated) return annotated;

  // 2) OCR.space rubrik-baserad parsing
  const headings = parseByOcrSpaceHeadings(text);
  if (headings) return headings;

  // 3) Fallback till äldre logik
  const delmalCodes = extractDelmalCodes(text);
  const { fullName, firstName, lastName } = extractFullNameBlock(text);
  const personnummer = extractPersonnummer(text);
  const specialtyHeader = extractSpecialty(text);

  const subject = extractBlockAfterLabel(text, /Kursens ämne/i);
  const description = extractBlockAfterLabel(text, /Beskrivning av kursen/i);
  const period = fallbackPeriod(text);

  return { kind, fullName, firstName, lastName, personnummer, specialtyHeader, delmalCodes, subject, description, period };
}

function matchLine(text: string, re: RegExp): string {
  const m = text.split(/\r?\n/).find(l => re.test(l));
  return m ?? "";
}

function parseByOcrSpaceHeadings(raw: string): ParsedIntyg | null {
  const kind = "2015-B5-KURS";
  
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
  // VIKTIGT: "Kursledare" och "Handledare" ska INTE filtreras bort - de är rubriker vi behöver!
  const IGNORE_EXACT: string[] = [
    "Skriv ut",
    "Sökande",
    "Rensa",
    "Bilaga nr:",
    "INTYG",
    "om genomförd utbildningsaktivitet och",
    "uppfyllda kompetenskrav",
    "Intygande",
    "Sökanden har genomfört utbildningsaktiviteten och uppfyllt kompetenskrav i delmålet/-en.",
    // "Kurs" - TA BORT FRÅN IGNORE! Vi behöver den som rubrik, men bara exakt "Kurs"
    // "Kursledare" - TA BORT FRÅN IGNORE! Vi behöver den som rubrik
    // "Handledare" - TA BORT FRÅN IGNORE! Vi behöver den som rubrik
    "SOSFS 2015:8 - Bilaga 5",
  ];

  const IGNORE: RegExp[] = [
    /^\*{3,}\s*result\s+for\s+image\/page/i,
    /^\*{3,}/,
    /^\s*(page|sida)\s*\d+\s*$/i,
    /\bSOSFS\s+2015:8/i,
    /\bBilaga\s*5\b/i,
    /\bBilaga\s*nr\b/i,
    /^\s*INTYG\b/i,
    /\bSkriv\s+ut\b/i,
    /\bRensa\b/i,
    /\bom\s+genomförd\s+utbildningsaktivitet/i,
    /^Sökande\s*$/i, // Bara exakt "Sökande" (enskild rad)
    /^Kurs\s*$/i, // Bara exakt "Kurs" (enskild rad) - VIKTIGT: inte när "kurs" ingår i texten
    /\bIntygande\b/i,
    /\bSökanden\s+har\s+genomfört/i,
    // Checkbox-raderna: "X Kursledare", "X Handledare", "Kursledare" (utan X), "Handledare" (utan X)
    // Dessa ska ALDRIG inkluderas i något fält
    /^(☒|✓|✗|☑|\bx\b|\bX\b)\s*Kursledare\s*$/i, // "X Kursledare"
    /^(☒|✓|✗|☑|\bx\b|\bX\b)\s*Handledare\s*$/i, // "X Handledare"
    // "Kursledare" och "Handledare" - TA BORT FRÅN IGNORE! Vi behöver dem som rubriker (för kursledare-namnet)
    // Men checkbox-raderna ska ignoreras
  ];

  // Filtrera bort rader som matchar IGNORE-listan (bara initial filtrering)
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
  // VIKTIGT: Var specifik - matcha bara exakta rubriker, inte bara om ordet finns i raden
  const isLabelLine = (l: string) => {
    const n = norm(l);
    return (
      n === norm("Efternamn") ||
      n === norm("Personnummer") ||
      n === norm("Kursledare") ||
      n === norm("Förnamn") ||
      n === norm("Fornamn") ||
      n.includes("specialitet som ansokan avser") ||
      n.includes("specialitet som ansökan avser") ||
      n.includes("delmal som intyget avser") ||
      n.includes("delmål som intyget avser") ||
      n.includes("amne") && n.includes("rubrikform") && n.includes("period") ||
      n.includes("ämne") && n.includes("rubrikform") && n.includes("period") ||
      // Bara matcha exakt rubrik "Beskrivning av kursen", inte bara om "beskrivning" finns
      n.includes("beskrivning av kursen") ||
      n === norm("Handledare") ||
      // Matcha "Specialitet" som rubrik (intygandens), inte sökandens
      (n === norm("Specialitet") && !n.includes("ansokan")) ||
      n === norm("Tjänsteställe") ||
      n === norm("Tjanstestalle") ||
      // Mer flexibel matchning - matcha om raden innehåller "tjanst" och "stalle" (med variationer)
      // VIKTIGT: Exkludera "Tjänstgöringsställe" - den ska INTE matchas här
      (n.includes("tjanst") && n.includes("stalle") && !n.includes("gorings") && !n.includes("göring")) ||
      (n.includes("tjanst") && n.includes("ställe") && !n.includes("gorings") && !n.includes("göring")) ||
      (n.includes("tjänst") && n.includes("stalle") && !n.includes("gorings") && !n.includes("göring")) ||
      (n.includes("tjänst") && n.includes("ställe") && !n.includes("gorings") && !n.includes("göring")) ||
      n === norm("Namnförtydligande") ||
      n === norm("Namnfortydligande") ||
      n === norm("Namnteckning") ||
      n === norm("Ort och datum") ||
      n === norm("Ort o datum")
    );
  };

  // Kontrollera om en rad ska ignoreras (bara för rubriker, inte för innehåll)
  const shouldIgnoreLine = (l: string): boolean => {
    if (!l) return true;
    const n = norm(l);
    // Ignorera rubriker som inte ska inkluderas: Namnteckning, Ort och datum
    if (n === norm("Namnteckning") || n === norm("Ort och datum") || n === norm("Ort o datum")) {
      return true;
    }
    // Ignorera checkbox-raderna: "X Kursledare", "X Handledare", och raden efter dem
    const markRe = /(☒|✓|✗|☑|\bx\b|\bX\b)/i;
    if (markRe.test(l) && (/kursledare/i.test(l) || /handledare/i.test(l))) {
      return true;
    }
    // Ignorera raden efter checkbox-raderna om den bara är "Kursledare" eller "Handledare" (utan checkbox)
    // Detta är den andra raden i checkbox-paret
    if ((n === norm("Kursledare") || n === norm("Handledare")) && !markRe.test(l)) {
      // Kontrollera om föregående rad var en checkbox-rad
      const lineIdx = lines.findIndex(line => line === l);
      if (lineIdx > 0) {
        const prevLine = lines[lineIdx - 1];
        if (prevLine && markRe.test(prevLine) && (/kursledare/i.test(prevLine) || /handledare/i.test(prevLine))) {
          return true; // Detta är den andra raden i checkbox-paret, ignorera den
        }
      }
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
      // För Beskrivning: samla alla rader tills nästa rubrik
      // VIKTIGT: Filtrera bort checkbox-raderna
      const markRe = /(☒|✓|✗|☑|\bx\b|\bX\b)/i;
      const out: string[] = [];
      for (let i = idx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (!l) break;
        // Hoppa över om första raden efter rubriken är en duplicerad "Beskrivning"-rubrik
        if (i === idx + 1) {
          const n = norm(l);
          if (n === norm("Beskrivning") || n.includes("beskrivning av kursen")) {
            continue;
          }
        }
        // Filtrera bort checkbox-raderna: "X Kursledare", "X Handledare"
        if (markRe.test(l) && (/kursledare/i.test(l) || /handledare/i.test(l))) {
          // Hoppa över checkbox-raden och nästa rad (som också kan vara "Kursledare" eller "Handledare")
          i++; // Hoppa över nästa rad också
          continue;
        }
        // Ignorera raden efter checkbox om den bara är "Kursledare" eller "Handledare" (utan checkbox)
        const n = norm(l);
        if ((n === norm("Kursledare") || n === norm("Handledare")) && !markRe.test(l)) {
          // Kontrollera om föregående rad var en checkbox-rad
          if (i > 0) {
            const prevLine = lines[i - 1];
            if (prevLine && markRe.test(prevLine) && (/kursledare/i.test(prevLine) || /handledare/i.test(prevLine))) {
              continue; // Detta är den andra raden i checkbox-paret, hoppa över den
            }
          }
        }
        // Stoppa vid rubriker eller stopp-mönster
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
      // VIKTIGT: Använd INTE shouldIgnoreLine här - innehåll kan innehålla ord som tidigare ignorerats
      // Stoppa bara om det är en rubrik eller stopp-mönster
      if (isLabelLine(nextLine)) return undefined;
      if (stopRes.some((re) => re.test(nextLine))) return undefined;
      
      // För "Tjänsteställe": ta bara nästa rad och stopp om den innehåller "SOSFS" eller liknande
      const isTjanstestalle = labelRe.source.includes("Tjänsteställe") || 
                              labelRe.source.includes("Tjanstestalle");
      if (isTjanstestalle) {
        const trimmed = nextLine.trim();
        // Stoppa om raden innehåller "SOSFS" eller "Bilaga"
        if (/SOSFS|Bilaga/i.test(trimmed)) {
          const match = trimmed.match(/^(.+?)(?:\s+SOSFS|\s+Bilaga)/i);
          if (match) {
            return match[1].trim() || undefined;
          }
          return undefined;
        }
        return trimmed || undefined;
      }
      
      return nextLine.trim() || undefined;
    }
  };

  // Bas (personnummer/delmål/period-range) som fallback
  const base = extractCommon(raw);

  // Namn: Efternamn och Förnamn är separata rubriker, slå ihop till "Förnamn Efternamn"
  // VIKTIGT: Kontrollera att värdet inte är "Sökande" eller "Kurs"
  const lastNameRaw = valueAfter(/^Efternamn$/i) ||
                      valueAfter(/Efternamn/i);
  const firstNameRaw = valueAfter(/^Förnamn$/i) || 
                      valueAfter(/Fornamn$/i) ||
                      valueAfter(/Förnamn/i);
  
  // Filtrera bort "Sökande" och "Kurs" om de råkar vara värden
  const lastName = lastNameRaw && 
                   lastNameRaw.toLowerCase() !== "sökande" && 
                   lastNameRaw.toLowerCase() !== "kurs"
                   ? lastNameRaw 
                   : undefined;
  const firstName = firstNameRaw && 
                    firstNameRaw.toLowerCase() !== "sökande" && 
                    firstNameRaw.toLowerCase() !== "kurs"
                    ? firstNameRaw 
                    : undefined;
  
  const fullName = firstName && lastName 
    ? `${firstName.trim()} ${lastName.trim()}`.trim()
    : (firstName || lastName || undefined);

  // Personnummer
  const pnrText = valueAfter(/^Personnummer$/i) || lines.join(" ");
  const personnummer = extractPersonnummer(pnrText) || base.personnummer;

  // Specialitet som ansökan avser
  const specialtyHeader = valueAfter(/Specialitet\s+som\s+ansökan\s+avser/i) ||
                         valueAfter(/Specialitet\s+som\s+ansokan\s+avser/i);

  // Delmål (för 2015: a1, b1, c1 etc - INTE ST-prefix, alltid gemener)
  const delmalText = valueAfter(/Delmål\s+som\s+intyget\s+avser/i) ||
                     valueAfter(/Delmal\s+som\s+intyget\s+avser/i);
  let rawDelmalCodes: string[] | undefined;
  if (delmalText) {
    rawDelmalCodes = extractDelmalCodes(delmalText);
  }
  if (!rawDelmalCodes || rawDelmalCodes.length === 0) {
    rawDelmalCodes = extractDelmalCodes(raw);
  }
  // För 2015: normalisera till gemener och sortera (a1-a6, b1-b5, c1-c14)
  const delmalCodes = rawDelmalCodes && rawDelmalCodes.length > 0 
    ? normalizeAndSortDelmalCodes2015(rawDelmalCodes)
    : undefined;

  // Ämne (i rubrikform) och period (ååmmdd — ååmmdd) för kursen
  // Detta kan vara på samma rad: "Ämne (i rubrikform) och period (ååmmdd - ååmmdd) för kursen"
  // OCR kan skriva "Amne" istället för "Ämne" och "rubrikform" kan vara "rubrikform" eller "rubrik form"
  const amneAndPeriodText = valueAfter(/Ämne\s*\(i\s+rubrikform\)\s+och\s+period/i) ||
                            valueAfter(/Amne\s*\(i\s+rubrikform\)\s+och\s+period/i) ||
                            valueAfter(/Ämne\s*\(i\s+rubrik\s+form\)\s+och\s+period/i) ||
                            valueAfter(/Amne\s*\(i\s+rubrik\s+form\)\s+och\s+period/i) ||
                            valueAfter(/Ämne.*?rubrikform.*?period/i) ||
                            valueAfter(/Amne.*?rubrikform.*?period/i) ||
                            valueAfter(/Ämne.*?rubrik.*?form.*?period/i) ||
                            valueAfter(/Amne.*?rubrik.*?form.*?period/i);
  
  // Extrahera ämne och period från texten
  let subject: string | undefined = undefined;
  let period: { startISO?: string; endISO?: string } | undefined = undefined;
  
  if (amneAndPeriodText) {
    // Filtrera bort "Kurs" om det råkar vara värdet
    if (amneAndPeriodText.toLowerCase().trim() === "kurs") {
      subject = undefined;
    } else {
      // Försök extrahera period först (datumformat: ååmmdd - ååmmdd eller liknande)
      const periodMatch = amneAndPeriodText.match(/(\d{6})\s*[-–—]\s*(\d{6})/);
      if (periodMatch) {
        // Konvertera ååmmdd till ISO-format
        const startYY = periodMatch[1].substring(0, 2);
        const startMM = periodMatch[1].substring(2, 4);
        const startDD = periodMatch[1].substring(4, 6);
        const endYY = periodMatch[2].substring(0, 2);
        const endMM = periodMatch[2].substring(2, 4);
        const endDD = periodMatch[2].substring(4, 6);
        
        // Anta 1900-tal om året är > 50, annars 2000-tal
        const startYear = parseInt(startYY) > 50 ? `19${startYY}` : `20${startYY}`;
        const endYear = parseInt(endYY) > 50 ? `19${endYY}` : `20${endYY}`;
        
        period = {
          startISO: `${startYear}-${startMM}-${startDD}`,
          endISO: `${endYear}-${endMM}-${endDD}`,
        };
        
        // Ta bort period-delen från texten för att få ämnet
        subject = amneAndPeriodText.replace(/\d{6}\s*[-–—]\s*\d{6}.*$/, "").trim();
        // Ta också bort "för kursen" om det finns
        subject = subject.replace(/\s+for\s+kursen?/i, "").trim();
        // Ta bort "Ämne (i rubrikform) och period" om det finns kvar
        subject = subject.replace(/^amne\s*\(i\s+rubrikform\)\s+och\s+period/i, "").trim();
        subject = subject.replace(/^ämne\s*\(i\s+rubrikform\)\s+och\s+period/i, "").trim();
      } else {
        // Om ingen period hittades, använd hela texten som ämne
        subject = amneAndPeriodText;
        // Ta bort "för kursen" om det finns
        subject = subject.replace(/\s+for\s+kursen?/i, "").trim();
        // Ta bort "Ämne (i rubrikform) och period" om det finns kvar
        subject = subject.replace(/^amne\s*\(i\s+rubrikform\)\s+och\s+period/i, "").trim();
        subject = subject.replace(/^ämne\s*\(i\s+rubrikform\)\s+och\s+period/i, "").trim();
        // Försök hitta period med extractPeriodFromZoneText
        period = extractPeriodFromZoneText(amneAndPeriodText);
      }
    }
  }

  // Kursledare (det som följer efter rubriken "Kursledare", INTE checkbox-raden)
  // VIKTIGT: Detta är en separat rubrik som kommer FÖRE checkbox-raderna
  // Checkbox-raderna är "X Kursledare" och "X Handledare" (eller "Kursledare" och "X Handledare")
  const courseLeaderName = valueAfter(/^Kursledare$/i);
  // Om vi inte hittade det, försök med mer flexibel matchning (men inte checkbox-raden)
  let courseLeader: string | undefined = courseLeaderName;
  if (!courseLeader) {
    // Leta efter "Kursledare" som rubrik, men INTE om det är checkbox-raden
    const kursledareIdx = lines.findIndex((l) => {
      const n = norm(l);
      // Matcha exakt "Kursledare" men INTE om det innehåller checkbox-tecken
      return n === norm("Kursledare") && !/(☒|✓|✗|☑|\bx\b|\bX\b)/i.test(l);
    });
    if (kursledareIdx >= 0 && kursledareIdx + 1 < lines.length) {
      const nextLine = lines[kursledareIdx + 1];
      // Kontrollera att nästa rad inte är checkbox-raden eller en annan rubrik
      if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
        const n = norm(nextLine);
        // Om nästa rad är checkbox-raden ("X Kursledare" eller "X Handledare"), hoppa över
        if (!/(☒|✓|✗|☑|\bx\b|\bX\b)/i.test(nextLine) && 
            !n.includes("handledare") && 
            !n.includes("kursledare")) {
          courseLeader = nextLine.trim();
        }
      }
    }
  }

  // Kryssrutor handledare/kursledare
  // VIKTIGT: Det finns två rader:
  // - Om kursledare ska signera: "X Kursledare" + "Handledare" (utan X)
  // - Om handledare ska signera: "Kursledare" (utan X) + "X Handledare"
  // Båda raderna kan innehålla "Kursledare", så vi måste vara försiktiga
  // Deklarera markRe här så att den kan användas i descriptionStopPatterns
  const markRe = /(☒|✓|✗|☑|\bx\b|\bX\b)/i;
  
  // Beskrivning av kursen
  // VIKTIGT: Stoppa vid checkbox-raderna också
  const descriptionStopPatterns = [
    /^Intygande/i,
    /^Specialitet/i,
    /^Tjänsteställe/i,
    /^Tjanstestalle/i,
    /^Namnförtydligande/i,
    /^Namnfortydligande/i,
    /^Ort och datum/i,
    /^Namnteckning/i,
    // Stoppa vid checkbox-raderna
    new RegExp(`^${markRe.source}\\s*Kursledare`, 'i'),
    new RegExp(`^${markRe.source}\\s*Handledare`, 'i'),
  ];
  const description = valueAfter(/Beskrivning\s+av\s+kursen/i, descriptionStopPatterns) ||
                      valueAfter(/Beskrivning\s+av\s+kurs/i, descriptionStopPatterns);
  
  // Leta efter checkbox-raderna
  // Först: hitta rader som innehåller checkbox-tecken och "Kursledare" eller "Handledare"
  let handledLine: string | undefined = undefined;
  let kursledLine: string | undefined = undefined;
  
  console.log('[Bilaga 5 Parser] Letar efter checkbox-raderna...');
  console.log('[Bilaga 5 Parser] markRe:', markRe);
  
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const lower = l.toLowerCase();
    const hasMark = markRe.test(l);
    
    console.log(`[Bilaga 5 Parser] Rad ${i}: "${l}" - hasMark: ${hasMark}`);
    
    // Om raden har checkbox och innehåller "handledare" men INTE "kursledare"
    if (hasMark && /handledare/i.test(lower) && !/kursledare/i.test(lower)) {
      handledLine = l;
      console.log('[Bilaga 5 Parser] Hittade handledLine:', l);
    }
    // Om raden har checkbox och innehåller "kursledare" men INTE "handledare"
    if (hasMark && /kursledare/i.test(lower) && !/handledare/i.test(lower)) {
      kursledLine = l;
      console.log('[Bilaga 5 Parser] Hittade kursledLine:', l);
    }
  }
  
  // Om vi inte hittade checkbox-rader, leta efter rader utan checkbox
  // (detta betyder att den andra har checkbox)
  if (!handledLine && !kursledLine) {
    console.log('[Bilaga 5 Parser] Inga checkbox-rader hittades direkt, letar efter par...');
    // Leta efter "Kursledare" utan checkbox (betyder att handledare har checkbox)
    const kursledWithoutMark = lines.find((l) => {
      const lower = l.toLowerCase();
      return /^kursledare\s*$/i.test(l) && !markRe.test(l);
    });
    // Leta efter "Handledare" utan checkbox (betyder att kursledare har checkbox)
    const handledWithoutMark = lines.find((l) => {
      const lower = l.toLowerCase();
      return /^handledare\s*$/i.test(l) && !markRe.test(l);
    });
    
    console.log('[Bilaga 5 Parser] kursledWithoutMark:', kursledWithoutMark);
    console.log('[Bilaga 5 Parser] handledWithoutMark:', handledWithoutMark);
    
    if (kursledWithoutMark) {
      // "Kursledare" utan checkbox + "X Handledare" = handledare signerar
      handledLine = lines.find((l) => {
        const lower = l.toLowerCase();
        return /handledare/i.test(lower) && markRe.test(l);
      });
      console.log('[Bilaga 5 Parser] Hittade handledLine via par:', handledLine);
    }
    if (handledWithoutMark) {
      // "Handledare" utan checkbox + "X Kursledare" = kursledare signerar
      kursledLine = lines.find((l) => {
        const lower = l.toLowerCase();
        return /kursledare/i.test(lower) && markRe.test(l);
      });
      console.log('[Bilaga 5 Parser] Hittade kursledLine via par:', kursledLine);
    }
  }
  
  console.log('[Bilaga 5 Parser] handledLine:', handledLine);
  console.log('[Bilaga 5 Parser] kursledLine:', kursledLine);
  
  let signingRole: "handledare" | "kursledare" | undefined;
  if (handledLine && !kursledLine) {
    signingRole = "handledare";
    console.log('[Bilaga 5 Parser] signingRole satt till: handledare');
  } else if (kursledLine && !handledLine) {
    signingRole = "kursledare";
    console.log('[Bilaga 5 Parser] signingRole satt till: kursledare');
  } else {
    console.log('[Bilaga 5 Parser] signingRole kunde inte bestämmas från checkbox-raderna');
    // Heuristik: om handledare-fält verkar ifyllda → handledare
    // (kommer att sättas senare när vi har supervisorSpeciality och supervisorSite)
  }

  // Intygande person - leta efter "Namnförtydligande"
  // VIKTIGT: Hitta "Namnförtydligande" som kommer EFTER checkbox-raderna
  let supervisorName: string | undefined = undefined;
  
  // Hitta index för checkbox-raderna för att veta var de slutar
  let checkboxEndIdx = -1;
  if (handledLine || kursledLine) {
    const handledIdx = handledLine ? lines.findIndex(l => l === handledLine) : -1;
    const kursledIdx = kursledLine ? lines.findIndex(l => l === kursledLine) : -1;
    const maxIdx = Math.max(handledIdx, kursledIdx);
    console.log('[Bilaga 5 Parser] handledIdx:', handledIdx, 'kursledIdx:', kursledIdx, 'maxIdx:', maxIdx);
    if (maxIdx >= 0) {
      // Checkbox-raderna är på maxIdx och maxIdx+1 (den andra raden i paret)
      checkboxEndIdx = maxIdx + 1;
      console.log('[Bilaga 5 Parser] checkboxEndIdx satt till:', checkboxEndIdx);
    }
  } else {
    console.log('[Bilaga 5 Parser] Inga checkbox-rader hittades, checkboxEndIdx förblir -1');
  }
  
  // Leta efter "Namnförtydligande" som kommer EFTER checkbox-raderna
  console.log('[Bilaga 5 Parser] Letar efter Namnförtydligande efter index:', checkboxEndIdx);
  const namnfortydligandeIdx = lines.findIndex((l, idx) => {
    if (idx <= checkboxEndIdx) return false; // Hoppa över checkbox-raderna
    const matches = norm(l) === norm("Namnförtydligande") || norm(l) === norm("Namnfortydligande");
    if (matches) {
      console.log(`[Bilaga 5 Parser] Hittade Namnförtydligande på index ${idx}: "${l}"`);
    }
    return matches;
  });
  console.log('[Bilaga 5 Parser] namnfortydligandeIdx:', namnfortydligandeIdx);
  
  if (namnfortydligandeIdx >= 0) {
    console.log('[Bilaga 5 Parser] Namnförtydligande hittades på index:', namnfortydligandeIdx);
    // Ta nästa rad efter "Namnförtydligande"
    let candidateIdx = namnfortydligandeIdx + 1;
    
    // Om nästa rad ser ut som en rubrik (t.ex. "Namn Handledare"), ta nästa rad istället
    if (candidateIdx < lines.length) {
      const candidateLine = lines[candidateIdx];
      console.log('[Bilaga 5 Parser] Kandidat-rad efter Namnförtydligande:', candidateLine);
      const candidateNorm = norm(candidateLine);
      // Om raden innehåller både "namn" och "handledare" eller "kursledare", är det troligen en rubrik, inte värdet
      if ((candidateNorm.includes("namn") && candidateNorm.includes("handledare")) ||
          (candidateNorm.includes("namn") && candidateNorm.includes("kursledare"))) {
        console.log('[Bilaga 5 Parser] Kandidat-rad ser ut som rubrik, hoppar över den');
        candidateIdx++;
      }
    }
    
    if (candidateIdx < lines.length) {
      const nextLine = lines[candidateIdx];
      console.log('[Bilaga 5 Parser] Nästa rad att använda:', nextLine);
      console.log('[Bilaga 5 Parser] shouldIgnoreLine:', shouldIgnoreLine(nextLine));
      console.log('[Bilaga 5 Parser] isLabelLine:', isLabelLine(nextLine));
      if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
        // Filtrera bort om det ser ut som ett nummer eller parenteser (t.ex. "1 (1)")
        const trimmed = nextLine.trim();
        if (!/^\d+\s*\(?\d*\)?$/.test(trimmed)) {
          supervisorName = trimmed;
          console.log('[Bilaga 5 Parser] supervisorName satt till:', supervisorName);
        } else {
          console.log('[Bilaga 5 Parser] Nästa rad ser ut som nummer, filtreras bort');
        }
      } else {
        console.log('[Bilaga 5 Parser] Nästa rad ignoreras eller är en rubrik');
      }
    } else {
      console.log('[Bilaga 5 Parser] Ingen nästa rad finns');
    }
  } else {
    console.log('[Bilaga 5 Parser] Namnförtydligande hittades INTE');
  }
  
  // Om inte hittat, försök direkt med valueAfter (men hoppa över checkbox-raderna)
  if (!supervisorName) {
    console.log('[Bilaga 5 Parser] Försöker hitta Namnförtydligande via valueAfter...');
    // Hitta första förekomsten av "Namnförtydligande" som kommer EFTER checkbox-raderna
    const firstNamnfortydligandeIdx = lines.findIndex((l, idx) => {
      if (idx <= checkboxEndIdx) return false; // Hoppa över checkbox-raderna
      return norm(l) === norm("Namnförtydligande") || norm(l) === norm("Namnfortydligande");
    });
    
    if (firstNamnfortydligandeIdx >= 0) {
      // Använd valueAfter men se till att vi hittar rätt förekomst
      const nameFromValueAfter = valueAfter(/Namnförtydligande/i) ||
                                valueAfter(/Namnfortydligande/i);
      console.log('[Bilaga 5 Parser] nameFromValueAfter:', nameFromValueAfter);
      // Filtrera bort om det ser ut som ett nummer eller parenteser
      // Också filtrera bort om det är checkbox-raden
      if (nameFromValueAfter && 
          !/^\d+\s*\(?\d*\)?$/.test(nameFromValueAfter.trim()) &&
          !markRe.test(nameFromValueAfter) &&
          !/^(kursledare|handledare)$/i.test(nameFromValueAfter.trim())) {
        supervisorName = nameFromValueAfter;
        console.log('[Bilaga 5 Parser] supervisorName satt via valueAfter till:', supervisorName);
      } else {
        console.log('[Bilaga 5 Parser] nameFromValueAfter filtrerades bort');
      }
    } else {
      console.log('[Bilaga 5 Parser] Ingen Namnförtydligande hittades efter checkbox-raderna');
    }
  } else {
    console.log('[Bilaga 5 Parser] supervisorName redan satt till:', supervisorName);
  }
  
  // Intygandens specialitet (om den intygande personen är specialistkompetent läkare)
  // Detta är INTE sökandens specialitet
  // VIKTIGT: Hitta "Specialitet" som kommer EFTER checkbox-raderna
  let supervisorSpeciality: string | undefined = undefined;
  console.log('[Bilaga 5 Parser] Letar efter Specialitet efter index:', checkboxEndIdx);
  const supSpecIdx = lines.findIndex((l, idx) => {
    if (idx <= checkboxEndIdx) return false; // Hoppa över checkbox-raderna
    const n = norm(l);
    // Matcha "Specialitet" men INTE "Specialitet som ansökan avser"
    const matches = n === norm("Specialitet") && !n.includes("ansokan") && !n.includes("ansökan");
    if (matches) {
      console.log(`[Bilaga 5 Parser] Hittade Specialitet på index ${idx}: "${l}"`);
    }
    return matches;
  });
  console.log('[Bilaga 5 Parser] supSpecIdx:', supSpecIdx);
  if (supSpecIdx >= 0 && supSpecIdx + 1 < lines.length) {
    const nextLine = lines[supSpecIdx + 1];
    console.log('[Bilaga 5 Parser] Nästa rad efter Specialitet:', nextLine);
    if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
      supervisorSpeciality = nextLine.trim();
      console.log('[Bilaga 5 Parser] supervisorSpeciality satt till:', supervisorSpeciality);
    } else {
      console.log('[Bilaga 5 Parser] Nästa rad efter Specialitet ignoreras eller är en rubrik');
    }
  } else {
    console.log('[Bilaga 5 Parser] Ingen Specialitet hittades eller ingen nästa rad');
  }
  
  // Intygandens tjänsteställe
  // VIKTIGT: Hitta "Tjänsteställe" som kommer EFTER checkbox-raderna
  let supervisorSite: string | undefined = undefined;
  
  console.log('[Bilaga 5 Parser] Letar efter Tjänsteställe efter index:', checkboxEndIdx);
  
  // Först: hitta index för "Tjänsteställe" som kommer EFTER checkbox-raderna
  const tjänsteställeRubrikIdx = lines.findIndex((l, idx) => {
    if (idx <= checkboxEndIdx) return false; // Hoppa över checkbox-raderna
    const n = norm(l);
    // Mer flexibel matchning - matcha om raden innehåller "tjanst" och "stalle" (med variationer)
    // VIKTIGT: Exkludera "Tjänstgöringsställe" - den ska INTE matchas här
    const isMatch = 
      n === norm("Tjänsteställe") || 
      n === norm("Tjanstestalle") || 
      (n.includes("tjanst") && n.includes("stalle") && !n.includes("gorings") && !n.includes("göring")) ||
      (n.includes("tjanst") && n.includes("ställe") && !n.includes("gorings") && !n.includes("göring")) ||
      (n.includes("tjänst") && n.includes("stalle") && !n.includes("gorings") && !n.includes("göring")) ||
      (n.includes("tjänst") && n.includes("ställe") && !n.includes("gorings") && !n.includes("göring"));
    if (isMatch) {
      console.log(`[Bilaga 5 Parser] Hittade Tjänsteställe på index ${idx}: "${l}"`);
    }
    return isMatch;
  });
  console.log('[Bilaga 5 Parser] tjänsteställeRubrikIdx:', tjänsteställeRubrikIdx);
  
  if (tjänsteställeRubrikIdx >= 0 && tjänsteställeRubrikIdx + 1 < lines.length) {
    const nextLine = lines[tjänsteställeRubrikIdx + 1];
    console.log('[Bilaga 5 Parser] Nästa rad efter Tjänsteställe:', nextLine);
    if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
      const trimmed = nextLine.trim();
      // Stoppa om raden innehåller "SOSFS" eller "Bilaga"
      if (/SOSFS|Bilaga/i.test(trimmed)) {
        const match = trimmed.match(/^(.+?)(?:\s+SOSFS|\s+Bilaga)/i);
        if (match) {
          supervisorSite = match[1].trim() || undefined;
        }
      } else {
        supervisorSite = trimmed;
      }
      console.log('[Bilaga 5 Parser] supervisorSite satt till:', supervisorSite);
    } else {
      console.log('[Bilaga 5 Parser] Nästa rad efter Tjänsteställe ignoreras eller är en rubrik');
    }
  } else {
    console.log('[Bilaga 5 Parser] Ingen Tjänsteställe hittades efter checkbox-raderna eller ingen nästa rad');
  }
  
  // Om inte hittat via valueAfter, försök direkt i lines-arrayen (efter checkbox-raderna)
  if (!supervisorSite) {
    const tjänsteställeIdx = lines.findIndex((l, idx) => {
      if (idx <= checkboxEndIdx) return false; // Hoppa över checkbox-raderna
      const n = norm(l);
      // Mer flexibel matchning - matcha om raden innehåller "tjanst" och "stalle" (med variationer)
      // VIKTIGT: Exkludera "Tjänstgöringsställe" - den ska INTE matchas här
      const isMatch = 
        n === norm("Tjänsteställe") || 
        n === norm("Tjanstestalle") || 
        (n.includes("tjanst") && n.includes("stalle") && !n.includes("gorings") && !n.includes("göring")) ||
        (n.includes("tjanst") && n.includes("ställe") && !n.includes("gorings") && !n.includes("göring")) ||
        (n.includes("tjänst") && n.includes("stalle") && !n.includes("gorings") && !n.includes("göring")) ||
        (n.includes("tjänst") && n.includes("ställe") && !n.includes("gorings") && !n.includes("göring"));
      return isMatch;
    });
    
    if (tjänsteställeIdx >= 0 && tjänsteställeIdx + 1 < lines.length) {
      const nextLine = lines[tjänsteställeIdx + 1];
      if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
        const trimmed = nextLine.trim();
        // Stoppa om raden innehåller "SOSFS" eller "Bilaga"
        if (/SOSFS|Bilaga/i.test(trimmed)) {
          const match = trimmed.match(/^(.+?)(?:\s+SOSFS|\s+Bilaga)/i);
          if (match) {
            supervisorSite = match[1].trim() || undefined;
          }
        } else {
          supervisorSite = trimmed;
        }
      }
    }
  }

  // Sätt signingRole baserat på heuristik om checkbox inte hittades
  if (!signingRole) {
    if (supervisorSpeciality || supervisorSite) {
      signingRole = "handledare";
    } else {
      signingRole = "kursledare"; // Default
    }
  }

  // Kontrollera om vi har tillräckligt med data
  const ok = fullName || personnummer || specialtyHeader || subject || 
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
    subject: subject || undefined,
    period: period || fallbackPeriod(raw),
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: supervisorSite || undefined,
    courseLeader: courseLeader || undefined, // Kursledare (namn)
    signer: {
      role: signingRole === "handledare" ? "HANDLEDARE" : signingRole === "kursledare" ? "KURSLEDARE" : undefined,
      name: supervisorName,
      speciality: supervisorSpeciality,
      site: supervisorSite,
    },
  };
}

/**
 * Stöd för manuellt annoterad OCR-text där:
 * - R<n> = rubrikrad (ska aldrig in i textfält)
 * - T<n> = text kopplad till rubriken R<n>
 * - X    = rad som aldrig ska in i något fält
 */
function parseByAnnotatedMarkers(raw: string): ParsedIntyg | null {
  const kind = "2015-B5-KURS";
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
    // namn (minst två ord)
    if (/\b\w+\s+\w+/.test(t)) return true;
    // delmål
    if (/[abc]\d+/i.test(t)) return true;
    return t.length > 2;
  };

  for (const line of lines) {
    if (/^R\d+\b/.test(line)) {
      const num = parseInt(line.match(/^R(\d+)/)?.[1] ?? "0");
      const label = line.replace(/^R\d+\s*/, "").trim();
      const b = getBucket(num);
      b.label = label;
    } else if (/^T\d+\b/.test(line)) {
      const num = parseInt(line.match(/^T(\d+)/)?.[1] ?? "0");
      const value = line.replace(/^T\d+\s*/, "").trim();
      if (value && looksLikeValue(value)) {
        getBucket(num).values.push(value);
      }
    }
    // X-rade ignoreras
  }

  const base = extractCommon(raw);
  const out: ParsedIntyg = { kind, ...base };

  for (const [num, bucket] of buckets) {
    if (!bucket.label || bucket.values.length === 0) continue;
    const labelNorm = norm(bucket.label);
    const value = bucket.values.join(" ").trim();

    if (labelNorm.includes("efternamn")) {
      out.lastName = value;
    } else if (labelNorm.includes("fornamn")) {
      out.firstName = value;
    } else if (labelNorm.includes("personnummer")) {
      out.personnummer = extractPersonnummer(value) || out.personnummer;
    } else if (labelNorm.includes("specialitet") && labelNorm.includes("ansokan")) {
      out.specialtyHeader = value;
    } else if (labelNorm.includes("delmal")) {
      const codes = extractDelmalCodes(value);
      if (codes.length > 0) out.delmalCodes = codes;
    } else if (labelNorm.includes("amne") || labelNorm.includes("ämne")) {
      out.subject = value;
    } else if (labelNorm.includes("beskrivning")) {
      out.description = value;
    } else if (labelNorm.includes("kursledare") && !/(☒|✓|✗|☑|\bx\b|\bX\b)/i.test(value)) {
      // Kursledare (namn) - INTE checkbox-raden
      (out as any).courseLeader = value;
    } else if (labelNorm.includes("namnfortydligande") || labelNorm.includes("namnförtydligande")) {
      out.supervisorName = value;
    } else if (labelNorm.includes("specialitet") && !labelNorm.includes("ansokan")) {
      out.supervisorSpeciality = value;
    } else if (labelNorm.includes("tjanstestalle") && !labelNorm.includes("gorings")) {
      out.supervisorSite = value;
    }
  }

  if (out.firstName && out.lastName) {
    out.fullName = `${out.firstName} ${out.lastName}`;
  }

  // För 2015: normalisera delmål till gemener
  if (out.delmalCodes && out.delmalCodes.length > 0) {
    out.delmalCodes = normalizeAndSortDelmalCodes2015(out.delmalCodes);
  }
  
  const ok = out.fullName || out.personnummer || out.specialtyHeader || out.subject || 
             out.description || out.delmalCodes?.length || out.period?.startISO || out.period?.endISO ||
             out.supervisorName;
  
  if (!ok) return null;
  return out;
}

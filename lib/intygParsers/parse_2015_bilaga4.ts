// lib/intygParsers/parse_2015_bilaga4.ts
import type { ParsedIntyg } from "./types";
import type { OcrWord } from "@/lib/ocr";
import {
  extractDelmalCodes, extractPersonnummer, extractFullNameBlock,
  extractSpecialty, extractBlockAfterLabel, extractClinicAndPeriodFromLine, 
  fallbackPeriod, extractPeriodFromZoneText, normalizeAndSortDelmalCodes2015
} from "./common";
import { extractCommon } from "../fieldExtract";

export function parse_2015_bilaga4(text: string, words?: OcrWord[]): ParsedIntyg {
  const kind = "2015-B4-KLIN";

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

  const clinicLine = matchLine(text, /Tjänstgöringsställe/i);
  const { clinic, period } = extractClinicAndPeriodFromLine(clinicLine);
  const description = extractBlockAfterLabel(text, /Beskrivning av den kliniska tjänstgöringen/i);

  return { kind, fullName, firstName, lastName, personnummer, specialtyHeader,
    delmalCodes, clinic, period: period ?? fallbackPeriod(text), description };
}

function matchLine(text: string, re: RegExp): string {
  const m = text.split(/\r?\n/).find(l => re.test(l));
  return m ?? "";
}

function parseByOcrSpaceHeadings(raw: string): ParsedIntyg | null {
  const kind = "2015-B4-KLIN";
  
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
  // VIKTIGT: "Handledare" ska INTE filtreras bort - det är en rubrik vi behöver!
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
    // "Handledare" - TA BORT FRÅN IGNORE! Vi behöver den som rubrik
    "SOSFS 2015:8 - Bilaga 4",
  ];

  const IGNORE: RegExp[] = [
    /^\*{3,}\s*result\s+for\s+image\/page/i,
    /^\*{3,}/,
    /^\s*(page|sida)\s*\d+\s*$/i,
    /\bSOSFS\s+2015:8/i,
    /\bBilaga\s*4\b/i,
    /\bBilaga\s*nr\b/i,
    /^\s*INTYG\b/i,
    /\bSkriv\s+ut\b/i,
    /\bRensa\b/i,
    /\bom\s+genomförd\s+utbildningsaktivitet/i,
    /^Sökande\s*$/i, // Bara exakt "Sökande" (enskild rad)
    /^Klinisk\s+tjänstgöring\s+under\s+handledning\s*$/i, // Bara exakt rubrik, inte när det ingår i texten
    /\bIntygande\b/i,
    /\bSökanden\s+har\s+genomfört/i,
    // "Handledare" - TA BORT FRÅN IGNORE! Vi behöver den som rubrik
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
      n === norm("Förnamn") ||
      n === norm("Fornamn") ||
      n.includes("specialitet som ansokan avser") ||
      n.includes("specialitet som ansökan avser") ||
      n.includes("delmal som intyget avser") ||
      n.includes("delmål som intyget avser") ||
      n.includes("tjanstgoringsstalle och period") ||
      n.includes("tjanstgoringsstalle") ||
      // Bara matcha exakt rubrik "Beskrivning av den kliniska tjänstgöringen", inte bara om "beskrivning" finns
      n.includes("beskrivning av den kliniska tjanstgoringen") ||
      n.includes("beskrivning av den kliniska tjänstgöringen") ||
      n === norm("Handledare") ||
      // Matcha "Specialitet" som rubrik (handledarens), inte sökandens
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
      // VIKTIGT: Använd INTE shouldIgnoreLine här - innehåll kan innehålla ord som tidigare ignorerats
      const out: string[] = [];
      for (let i = idx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (!l) break;
        // Hoppa över om första raden efter rubriken är en duplicerad "Beskrivning"-rubrik
        if (i === idx + 1) {
          const n = norm(l);
          if (n === norm("Beskrivning") || n.includes("beskrivning av den kliniska tjanstgoringen") || n.includes("beskrivning av den kliniska tjänstgöringen")) {
            continue;
          }
        }
        // Stoppa bara vid rubriker eller stopp-mönster, INTE vid IGNORE-listan
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
  // VIKTIGT: Kontrollera att värdet inte är "Sökande" eller "Klinisk tjänstgöring"
  const lastNameRaw = valueAfter(/^Efternamn$/i) ||
                      valueAfter(/Efternamn/i);
  const firstNameRaw = valueAfter(/^Förnamn$/i) || 
                      valueAfter(/Fornamn$/i) ||
                      valueAfter(/Förnamn/i);
  
  // Filtrera bort "Sökande" och "Klinisk tjänstgöring" om de råkar vara värden
  const lastName = lastNameRaw && 
                   lastNameRaw.toLowerCase() !== "sökande" && 
                   !lastNameRaw.toLowerCase().includes("klinisk tjänstgöring")
                   ? lastNameRaw 
                   : undefined;
  const firstName = firstNameRaw && 
                    firstNameRaw.toLowerCase() !== "sökande" && 
                    !firstNameRaw.toLowerCase().includes("klinisk tjänstgöring")
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

  // Delmål (för 2015: a1, b1, c1 etc - INTE ST-prefix)
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

  // Tjänstgöringsställe och period för den kliniska tjänstgöringen
  // Detta kan vara på samma rad: "Tjänstgöringsställe och period (ååmmdd - ååmmdd) för den kliniska tjänstgöringen"
  // OCR kan skriva "Tiänstgöringsställe" (med "i" istället för "ä")
  const clinicAndPeriodText = valueAfter(/T[ji]änstgöringsställe\s+och\s+period/i) ||
                              valueAfter(/T[ji]anstgoringsstalle\s+och\s+period/i) ||
                              valueAfter(/T[ji]änstgöringsställe/i) ||
                              valueAfter(/T[ji]anstgoringsstalle/i);
  
  // Extrahera klinik och period från texten
  let clinic: string | undefined = undefined;
  let period: { startISO?: string; endISO?: string } | undefined = undefined;
  
  if (clinicAndPeriodText) {
    // Filtrera bort "Klinisk tjänstgöring" om det råkar vara värdet
    if (clinicAndPeriodText.toLowerCase().trim().includes("klinisk tjänstgöring")) {
      clinic = undefined;
    } else {
      // Försök extrahera period först (datumformat: ååmmdd - ååmmdd eller liknande)
      const periodMatch = clinicAndPeriodText.match(/(\d{6})\s*[-–—]\s*(\d{6})/);
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
        
        // Ta bort period-delen från texten för att få kliniken
        clinic = clinicAndPeriodText.replace(/\d{6}\s*[-–—]\s*\d{6}.*$/, "").trim();
        // Ta också bort "för den kliniska tjänstgöringen" om det finns
        clinic = clinic.replace(/\s+for\s+den\s+kliniska\s+tjanstgoringen?/i, "").trim();
      } else {
        // Om ingen period hittades, använd hela texten som klinik
        clinic = clinicAndPeriodText;
        // Ta bort "för den kliniska tjänstgöringen" om det finns
        clinic = clinic.replace(/\s+for\s+den\s+kliniska\s+tjanstgoringen?/i, "").trim();
        // Försök hitta period med extractPeriodFromZoneText
        period = extractPeriodFromZoneText(clinicAndPeriodText);
      }
    }
  }

  // Beskrivning av den kliniska tjänstgöringen
  const descriptionStopPatterns = [
    /^Intygande/i,
    /^Handledare\s*$/i, // Bara exakt "Handledare" (enskild rad)
    /^Specialitet/i,
    /^Tjänsteställe/i,
    /^Tjanstestalle/i,
    /^Namnförtydligande/i,
    /^Namnfortydligande/i,
    /^Ort och datum/i,
    /^Namnteckning/i,
  ];
  const description = valueAfter(/Beskrivning\s+av\s+den\s+kliniska\s+tjänstgöringen/i, descriptionStopPatterns) ||
                      valueAfter(/Beskrivning\s+av\s+den\s+kliniska\s+tjanstgoringen/i, descriptionStopPatterns);

  // Handledare - leta efter "Handledare" rubrik och sedan "Namnförtydligande"
  // För 2015 Bilaga 4 kommer "Handledare" först, sedan "Namnförtydligande"
  let supervisorName: string | undefined = undefined;
  const handledareIdx = lines.findIndex((l) => norm(l) === norm("Handledare"));
  if (handledareIdx >= 0) {
    // Efter "Handledare" kommer "Namnförtydligande"
    const namnfortydligandeIdx = lines.findIndex((l, idx) => 
      idx > handledareIdx && (norm(l) === norm("Namnförtydligande") || norm(l) === norm("Namnfortydligande"))
    );
    if (namnfortydligandeIdx >= 0) {
      // Ta nästa rad efter "Namnförtydligande"
      let candidateIdx = namnfortydligandeIdx + 1;
      
      // Om nästa rad ser ut som en rubrik (t.ex. "Namn Handledare"), ta nästa rad istället
      if (candidateIdx < lines.length) {
        const candidateLine = lines[candidateIdx];
        const candidateNorm = norm(candidateLine);
        // Om raden innehåller både "namn" och "handledare", är det troligen en rubrik, inte värdet
        if (candidateNorm.includes("namn") && candidateNorm.includes("handledare")) {
          candidateIdx++;
        }
      }
      
      if (candidateIdx < lines.length) {
        const nextLine = lines[candidateIdx];
        if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
          // Filtrera bort om det ser ut som ett nummer eller parenteser (t.ex. "1 (1)")
          const trimmed = nextLine.trim();
          if (!/^\d+\s*\(?\d*\)?$/.test(trimmed)) {
            supervisorName = trimmed;
          }
        }
      }
    }
  }
  
  // Om inte hittat via "Handledare", försök direkt med "Namnförtydligande"
  if (!supervisorName) {
    // Hitta "Namnförtydligande" rubriken
    const namnfortydligandeIdx = lines.findIndex((l) => 
      norm(l) === norm("Namnförtydligande") || norm(l) === norm("Namnfortydligande")
    );
    
    if (namnfortydligandeIdx >= 0) {
      // Ta nästa rad efter "Namnförtydligande"
      let candidateIdx = namnfortydligandeIdx + 1;
      
      // Om nästa rad ser ut som en rubrik (t.ex. "Namn Handledare"), ta nästa rad istället
      if (candidateIdx < lines.length) {
        const candidateLine = lines[candidateIdx];
        const candidateNorm = norm(candidateLine);
        // Om raden innehåller både "namn" och "handledare", är det troligen en rubrik, inte värdet
        if (candidateNorm.includes("namn") && candidateNorm.includes("handledare")) {
          candidateIdx++;
        }
      }
      
      if (candidateIdx < lines.length) {
        const nextLine = lines[candidateIdx];
        if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
          // Filtrera bort om det ser ut som ett nummer eller parenteser
          const trimmed = nextLine.trim();
          if (!/^\d+\s*\(?\d*\)?$/.test(trimmed)) {
            supervisorName = trimmed;
          }
        }
      }
    }
    
    // Fallback: använd valueAfter om ovanstående inte fungerade
    if (!supervisorName) {
      const nameFromValueAfter = valueAfter(/Namnförtydligande/i) ||
                                valueAfter(/Namnfortydligande/i);
      // Filtrera bort om det ser ut som ett nummer eller parenteser
      if (nameFromValueAfter && !/^\d+\s*\(?\d*\)?$/.test(nameFromValueAfter.trim())) {
        supervisorName = nameFromValueAfter;
      }
    }
  }
  
  // Handledarens specialitet (inte sökandens)
  // Efter "Handledare" kommer "Specialitet" (handledarens)
  let supervisorSpeciality: string | undefined = undefined;
  if (handledareIdx >= 0) {
    const supSpecIdx = lines.findIndex((l, idx) => {
      if (idx <= handledareIdx) return false;
      const n = norm(l);
      return n === norm("Specialitet") && !n.includes("ansokan") && !n.includes("ansökan");
    });
    if (supSpecIdx >= 0 && supSpecIdx + 1 < lines.length) {
      const nextLine = lines[supSpecIdx + 1];
      if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
        supervisorSpeciality = nextLine.trim();
      }
    }
  }
  
  // Om inte hittat, försök direkt
  if (!supervisorSpeciality) {
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
  }
  
  // Handledarens tjänsteställe
  // Efter "Handledare" kommer "Tjänsteställe"
  // Använd valueAfter som primär metod (den hanterar SOSFS/Bilaga korrekt)
  let supervisorSite: string | undefined = undefined;
  
  // Försök först med valueAfter (den hanterar SOSFS/Bilaga korrekt)
  // Använd mer flexibla regex-mönster som matchar variationer
  // VIKTIGT: Exkludera "Tjänstgöringsställe" - den ska INTE matchas här
  const siteFromValueAfter1 = valueAfter(/Tjänsteställe/i);
  const siteFromValueAfter2 = valueAfter(/Tjanstestalle/i);
  const siteFromValueAfter3 = valueAfter(/T[ji]änsteställe/i);
  const siteFromValueAfter4 = valueAfter(/T[ji]anstestalle/i);
  // Mer flexibel: matcha om raden innehåller "tjanst" och "stalle" men INTE "görings" eller "göring"
  const siteFromValueAfter5 = valueAfter(/T[ji]än?st(?!.*göring).*?st[äa]lle/i);
  
  supervisorSite = siteFromValueAfter1 || siteFromValueAfter2 || siteFromValueAfter3 || siteFromValueAfter4 || siteFromValueAfter5;
  
  // Om inte hittat via valueAfter, försök direkt i lines-arrayen
  if (!supervisorSite && handledareIdx >= 0) {
    const tjänsteställeIdx = lines.findIndex((l, idx) => {
      if (idx <= handledareIdx) return false;
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
 */
function parseByAnnotatedMarkers(raw: string): ParsedIntyg | null {
  const kind = "2015-B4-KLIN";
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
    } else if (labelNorm.includes("tjanstgoringsstalle") || labelNorm.includes("tjanstgoringsstalle")) {
      const { clinic, period } = extractClinicAndPeriodFromLine(value);
      if (clinic) out.clinic = clinic;
      if (period) out.period = period;
    } else if (labelNorm.includes("beskrivning")) {
      out.description = value;
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

  const ok = out.fullName || out.personnummer || out.specialtyHeader || out.clinic || 
             out.description || out.delmalCodes?.length || out.period?.startISO || out.period?.endISO ||
             out.supervisorName;
  
  if (!ok) return null;
  return out;
}

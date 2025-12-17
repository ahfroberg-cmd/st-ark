// lib/intygParsers/parse_2015_bilaga7.ts
import type { ParsedIntyg } from "./types";
import type { OcrWord } from "@/lib/ocr";
import {
  extractDelmalCodes, extractPersonnummer, extractFullNameBlock,
  extractSpecialty, extractBlockAfterLabel,
  normalizeAndSortDelmalCodes2015
} from "./common";
import { extractCommon } from "../fieldExtract";

export function parse_2015_bilaga7(text: string, words?: OcrWord[]): ParsedIntyg {
  const kind = "2015-B7-SKRIFTLIGT";

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

  const subject = extractBlockAfterLabel(text, /Ämne för självständigt skriftligt arbete/i);
  const description = extractBlockAfterLabel(text, /Beskrivning av det självständiga skriftliga arbetet/i);

  return { kind, fullName, firstName, lastName, personnummer, specialtyHeader, delmalCodes, clinic: subject, description };
}

function parseByOcrSpaceHeadings(raw: string): ParsedIntyg | null {
  const kind = "2015-B7-SKRIFTLIGT";
  
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
  // "Handledare" ska INTE filtreras bort - det är en rubrik vi behöver!
  const IGNORE_EXACT: string[] = [
    "Rensa",
    "Bilaga nr:",
    "INTYG",
    "om genomförd utbildningsaktivitet och uppfyllda kompetenskrav",
    "Skriv ut",
    "Sökande",
    "Intygande",
    "Sökanden har genomfört utbildningsaktiviteten och uppfyllt kompetenskrav i delmålet/-en.",
    "Självständigt skriftligt arbete enligt vetenskapliga principer",
    "SOSFS 2015:8 - Bilaga 7",
  ];

  const IGNORE: RegExp[] = [
    /^\*{3,}\s*result\s+for\s+image\/page/i,
    /^\*{3,}/,
    /^\s*(page|sida)\s*\d+\s*$/i,
    /^SOSFS/i, // Blockera alla rader som börjar med "SOSFS"
    /\bSOSFS\s+2015:8/i,
    /\bBilaga\s*7\b/i,
    /\bBilaga\s*nr\b/i,
    /^\s*INTYG\b/i,
    /\bSkriv\s+ut\b/i,
    /\bRensa\b/i,
    /\bom\s+genomförd\s+utbildningsaktivitet/i,
    /^Sökande\s*$/i, // Bara exakt "Sökande" (enskild rad), inte när det ingår i en mening
    /\bSjälvständigt\s+skriftligt\s+arbete\s+enligt\s+vetenskapliga\s+principer\b/i,
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
      // Ämne för självständigt skriftligt arbete - hantera OCR-fel som "siälvständiat" och "skriftliat"
      (n.includes("amne") && 
       (n.includes("for") || n.includes("för")) &&
       (n.includes("sjalvstand") || n.includes("självständ") || n.includes("sialvstand") || n.includes("siälvständ")) &&
       (n.includes("skrift") || n.includes("skriftli")) &&
       n.includes("arbete")) ||
      // Bara matcha exakt rubrik "Beskrivning av det självständiga skriftliga arbetet", inte bara om "beskrivning" finns
      n.includes("beskrivning av det sjalvstandiga skriftliga arbetet") ||
      n.includes("beskrivning av det självständiga skriftliga arbetet") ||
      // Matcha "Specialitet" som rubrik (handledarens), inte sökandens
      (n === norm("Specialitet") && !n.includes("ansokan") && !n.includes("ansökan")) ||
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
      n === norm("Handledare") ||
      n === norm("Namnteckning") ||
      n === norm("Ort och datum") ||
      n === norm("Ort o datum")
    );
  };

  // Kontrollera om en rad ska ignoreras (bara för rubriker, inte för innehåll)
  const shouldIgnoreLine = (l: string): boolean => {
    if (!l) return true;
    const n = norm(l);
    // Ignorera rubriker som inte ska inkluderas: Namnteckning, Ort och datum, Personnummer (handledarens)
    if (n === norm("Namnteckning") || n === norm("Ort och datum") || n === norm("Ort o datum") || n === norm("Personnummer")) {
      return true;
    }
    // Blockera alla rader som börjar med "SOSFS"
    if (/^SOSFS/i.test(l.trim())) {
      return true;
    }
    return false;
  };

  // Extrahera värde efter rubrik
  const valueAfter = (labelRe: RegExp, stopRes: RegExp[] = []): string | undefined => {
    // Debug: logga om vi letar efter ämne
    const isAmne = labelRe.source.includes("ämne") || labelRe.source.includes("amne");
    if (isAmne) {
      console.warn('[Bilaga 7 Parser] Letar efter ämne med regex:', labelRe.source);
      console.warn('[Bilaga 7 Parser] Första 10 raderna:', lines.slice(0, 10));
    }
    
    // Försök hitta rubriken
    let idx = lines.findIndex((l) => labelRe.test(l));
    
    if (isAmne && idx >= 0) {
      console.warn('[Bilaga 7 Parser] Hittade ämne-rubrik på index:', idx, 'rad:', lines[idx]);
    }
    
    // Om inte hittat, försök med mer flexibel matchning
    if (idx < 0) {
      const patternStr = labelRe.source
        .replace(/\\b/g, '')
        .replace(/[.*+?^${}()|[\]\\]/g, '')
        .replace(/\\s\+/g, '\\s*')
        .replace(/\\s\*/g, '\\s*');
      const flexibleRe = new RegExp(patternStr, 'i');
      idx = lines.findIndex((l) => flexibleRe.test(norm(l)));
      
      if (isAmne && idx >= 0) {
        console.warn('[Bilaga 7 Parser] Hittade ämne-rubrik med flexibel matchning på index:', idx, 'rad:', lines[idx]);
      }
    }
    
    if (idx < 0) {
      if (isAmne) {
        console.warn('[Bilaga 7 Parser] Kunde INTE hitta ämne-rubrik');
      }
      return undefined;
    }

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
          if (n.includes("beskrivning av det sjalvstandiga skriftliga arbetet") ||
              n.includes("beskrivning av det självständiga skriftliga arbetet")) {
            continue;
          }
        }
        
        // Stoppa vid rubriker (inklusive de som ska ignoreras)
        if (isLabelLine(l)) break;
        
        // Stoppa vid stopp-mönster
        if (stopRes.some((re) => re.test(l))) break;
        
        // Stoppa vid rader som börjar med "SOSFS"
        if (/^SOSFS/i.test(l.trim())) break;
        
        out.push(l);
      }
      return out.join("\n").trim() || undefined;
    } else {
      // För ALLA övriga fält: ta BARA nästa rad (inte flera rader)
      if (idx + 1 >= lines.length) {
        if (isAmne) {
          console.warn('[Bilaga 7 Parser] Ingen nästa rad efter ämne-rubrik (idx + 1 >= lines.length)');
        }
        return undefined;
      }
      const nextLine = lines[idx + 1];
      if (!nextLine) {
        if (isAmne) {
          console.warn('[Bilaga 7 Parser] Nästa rad är tom');
        }
        return undefined;
      }
      
      // Stoppa om nästa rad är en rubrik
      if (isLabelLine(nextLine)) {
        if (isAmne) {
          console.warn('[Bilaga 7 Parser] Nästa rad efter ämne-rubrik är en rubrik:', nextLine);
        }
        return undefined;
      }
      
      // Stoppa om nästa rad ska ignoreras (t.ex. "Namnteckning", "Ort och datum", "Personnummer")
      if (shouldIgnoreLine(nextLine)) {
        if (isAmne) {
          console.warn('[Bilaga 7 Parser] Nästa rad efter ämne-rubrik ska ignoreras:', nextLine);
        }
        return undefined;
      }
      
      // Stoppa vid stopp-mönster
      if (stopRes.some((re) => re.test(nextLine))) {
        if (isAmne) {
          console.warn('[Bilaga 7 Parser] Nästa rad efter ämne-rubrik matchar stopp-mönster:', nextLine);
        }
        return undefined;
      }
      
      if (isAmne) {
        console.warn('[Bilaga 7 Parser] Returnerar nästa rad som ämne:', nextLine);
      }
      
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
  // VIKTIGT: Kontrollera att värdet inte är "Sökande"
  const lastNameRaw = valueAfter(/^Efternamn$/i) ||
                      valueAfter(/Efternamn/i);
  const firstNameRaw = valueAfter(/^Förnamn$/i) || 
                      valueAfter(/Fornamn$/i) ||
                      valueAfter(/Förnamn/i);
  
  // Filtrera bort "Sökande" om det råkar vara värdet
  const lastName = lastNameRaw && 
                   lastNameRaw.toLowerCase() !== "sökande"
                   ? lastNameRaw 
                   : undefined;
  const firstName = firstNameRaw && 
                    firstNameRaw.toLowerCase() !== "sökande"
                    ? firstNameRaw 
                    : undefined;
  
  const fullName = firstName && lastName 
    ? `${firstName.trim()} ${lastName.trim()}`.trim()
    : (firstName || lastName || undefined);

  // Personnummer (sökandens - inte handledarens)
  const pnrText = valueAfter(/^Personnummer$/i);
  const personnummer = pnrText ? extractPersonnummer(pnrText) : (extractPersonnummer(lines.join(" ")) || base.personnummer);

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

  // Ämne för självständigt skriftligt arbete (i rubrikform)
  // Detta ska sparas i clinic-fältet
  // Rubriken kan vara "Ämne för självständigt skriftligt arbete (i rubrikform)" eller kortare
  // Hantera OCR-fel: "siälvständiat" -> "självständigt", "skriftliat" -> "skriftligt"
  // Först försök med regex-mönster
  let subject = valueAfter(/Ämne\s+för\s+sj[äa]lvst[äa]ndi[at]t\s+skriftli[at]t\s+arbete\s*\(i\s*rubrikform\)/i) ||
                 valueAfter(/Amne\s+for\s+s[ij][äa]lvst[äa]ndi[at]t\s+skriftli[at]t\s+arbete\s*\(i\s*rubrikform\)/i) ||
                 valueAfter(/Ämne\s+för\s+sj[äa]lvst[äa]ndi[at]t\s+skriftli[at]t\s+arbete/i) ||
                 valueAfter(/Amne\s+for\s+s[ij][äa]lvst[äa]ndi[at]t\s+skriftli[at]t\s+arbete/i) ||
                 valueAfter(/Ämne\s+för\s+sj[äa]lvst[äa]ndi[at]t\s+skriftli[at]t/i) ||
                 valueAfter(/Amne\s+for\s+s[ij][äa]lvst[äa]ndi[at]t\s+skriftli[at]t/i) ||
                 valueAfter(/Ämne\s+för\s+sj[äa]lvst[äa]ndi[at]t/i) ||
                 valueAfter(/Amne\s+for\s+s[ij][äa]lvst[äa]ndi[at]t/i);
  
  // Om inte hittat, använd mer flexibel matchning baserat på isLabelLine-logik
  if (!subject) {
    const amneIdx = lines.findIndex((l) => {
      const n = norm(l);
      // Matcha om raden innehåller "amne", "for"/"för", "sjalvstand"/"självständ"/"sialvstand"/"siälvständ", "skrift", "arbete"
      return n.includes("amne") && 
             (n.includes("for") || n.includes("för")) &&
             (n.includes("sjalvstand") || n.includes("självständ") || n.includes("sialvstand") || n.includes("siälvständ")) &&
             (n.includes("skrift") || n.includes("skriftli")) &&
             n.includes("arbete");
    });
    if (amneIdx >= 0 && amneIdx + 1 < lines.length) {
      const nextLine = lines[amneIdx + 1];
      if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
        subject = nextLine.trim() || undefined;
      }
    }
  }
  
  console.warn('[Bilaga 7 Parser] ====== ÄMNE EXTRAHERING ======');
  console.warn('[Bilaga 7 Parser] subject:', subject);
  console.warn('[Bilaga 7 Parser] ====== SLUT ÄMNE ======');

  // Beskrivning av det självständiga skriftliga arbetet
  // Stoppa vid: Handledare, Namnförtydligande, Specialitet, Tjänsteställe, Namnteckning, Ort och datum
  const descriptionStopPatterns = [
    /^Intygande/i,
    /^Handledare\s*$/i, // Bara exakt "Handledare" (enskild rad)
    /^Namnförtydligande/i,
    /^Namnfortydligande/i,
    /^Specialitet/i,
    /^Tjänsteställe/i,
    /^Tjanstestalle/i,
    /^Namnteckning/i,
    /^Ort och datum/i,
    /^Ort o datum/i,
  ];
  const description = valueAfter(/Beskrivning\s+av\s+det\s+självständiga\s+skriftliga\s+arbetet/i, descriptionStopPatterns) ||
                      valueAfter(/Beskrivning\s+av\s+det\s+sjalvstandiga\s+skriftliga\s+arbetet/i, descriptionStopPatterns);

  // Handledare - leta efter "Handledare" rubrik och sedan "Namnförtydligande"
  // För 2015 Bilaga 7 kommer "Handledare" först, sedan "Namnförtydligande"
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
  if (!supervisorSite) {
    // Sök efter "Tjänsteställe" i hela arrayen, men prioritera efter "Handledare" om det finns
    let searchStartIdx = 0;
    if (handledareIdx >= 0) {
      searchStartIdx = handledareIdx;
    }
    
    const tjänsteställeIdx = lines.findIndex((l, idx) => {
      if (idx < searchStartIdx) return false;
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
  const ok = fullName || personnummer || specialtyHeader || subject || 
             description || delmalCodes?.length || supervisorName;
  
  if (!ok) return null;

  return {
    kind,
    fullName,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    personnummer: personnummer || undefined,
    specialtyHeader: specialtyHeader || undefined,
    delmalCodes,
    clinic: subject || undefined, // Ämne sparas i clinic-fältet
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
  const kind = "2015-B7-SKRIFTLIGT";
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

  // Sökandens personnummer
  let personnummer: string | undefined;
  {
    const pId = findIdByLabel("Personnummer");
    const v = valueFor(pId);
    const m = v ? v.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) : null;
    personnummer = m?.[0]?.replace(/\s+/g, "") || undefined;
    if (!personnummer) {
      // fallback: första personnummer i hela texten
      const all = Array.from(buckets.values()).flatMap((b) => b.values);
      const m2 = all.join("\n").match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/);
      personnummer = m2?.[0]?.replace(/\s+/g, "") || undefined;
    }
  }

  const specialtyHeader = valueFor(findIdByLabel("Specialitet som ansökan avser"));
  
  const delmalRaw = valueFor(findIdByLabel("Delmål som intyget avser")) || "";
  const rawDelmalCodes = extractDelmalCodes(delmalRaw);
  // För 2015: använd delmål direkt, INTE normalizeAndSortDelmalCodes2021
  const delmalCodes = rawDelmalCodes.length > 0 ? rawDelmalCodes : [];

  const subject = valueFor(findIdByLabel("Ämne för självständigt skriftligt arbete"));

  const description = valueFor(findIdByLabel("Beskrivning av det självständiga skriftliga arbetet"));

  const supervisorName = valueFor(findIdByLabel("Namnförtydligande"));
  const supervisorSpeciality = valueFor(findIdByLabel("Specialitet"));
  const supervisorSite = valueFor(findIdByLabel("Tjänsteställe"));

  // Kräver minst grundfält för att acceptera
  const score =
    (fullName ? 1 : 0) +
    (personnummer ? 1 : 0) +
    (specialtyHeader ? 1 : 0) +
    (subject ? 1 : 0) +
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
    clinic: subject || undefined, // Ämne sparas i clinic-fältet
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: supervisorSite || undefined,
  };
}

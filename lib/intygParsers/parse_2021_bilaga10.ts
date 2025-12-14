// lib/intygParsers/parse_2021_bilaga10.ts
import { ExtractedCommon, extractCommon } from "../fieldExtract";
import type { OcrWord } from "@/lib/ocr";
import { extractDates } from "@/lib/dateExtract";
import { normalizeAndSortDelmalCodes2021, extractDelmalCodes } from "./common";

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
      n.includes("ort och datum") ||
      n.includes("intygsutfardande") ||
      n.includes("namnteckning") ||
      n.includes("handledare") ||
      n.includes("kursledare") ||
      // "Specialitet (gäller endast handledare)" är en rubrik, men ska inte stoppa beskrivningen
      // eftersom den kommer EFTER beskrivningen
      (n.includes("specialitet") && n.includes("galler") && n.includes("endast") && n.includes("handledare"))
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
      // För "Tjänsteställe" kan det vara flera rader, så vi tar alla tills nästa rubrik
      const isTjanstestalle = labelRe.source.includes("Tjänsteställe") || labelRe.source.includes("Tjanstestalle");
      
      if (isTjanstestalle) {
        // För Tjänsteställe: ta BARA nästa rad (inte flera rader) och stanna där
        if (idx + 1 >= lines.length) return undefined;
        const nextLine = lines[idx + 1];
        if (!nextLine) return undefined;
        if (shouldIgnoreLine(nextLine)) return undefined; // Ignorera om raden ska ignoreras
        if (isLabelLine(nextLine)) return undefined;
        if (stopRes.some((re) => re.test(nextLine))) return undefined;
        // Ta bara första raden, även om det finns fler rader efter
        // Stoppa också om nästa rad innehåller "FS" eller "HSLF" (för att undvika "FS 2021:81 (1)")
        const trimmed = nextLine.trim();
        // Om raden innehåller "FS" eller "HSLF", ta bara delen före det
        const fsMatch = trimmed.match(/^(.+?)(?:\s+FS\s+|\s+HSLF)/i);
        if (fsMatch) {
          return fsMatch[1].trim() || undefined;
        }
        return trimmed || undefined;
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
    valueAfter(/Kursens ämne/i, [/Beskrivning av kursen/i, /Namnförtydligande/i]) ||
    valueAfter(/Kursens amne/i, [/Beskrivning av kursen/i, /Namnförtydligande/i]);

  // Stoppord för beskrivningen - standardtext från intyget
  // OBS: "Tjänsteställe" ska INTE stoppa beskrivningen eftersom det kommer EFTER beskrivningen
  const descriptionStopPatterns = [
    /^Intygsutfärdande/i,
    /^Namnteckning/i,
    /^Ort och datum/i,
    /^Namnförtydligande/i,
    /^Namnfortydligande/i,
    /^Specialitet\s*\(gäller/i,
    /^Handledare\s*,?\s*Kursledare/i,
    /^Kursledare\s*,?\s*Handledare/i,
  ];
  
  const description = valueAfter(/Beskrivning av kursen/i, descriptionStopPatterns);

  // Delmål (försök rubrikfält först, annars fallback från hela texten)
  const delmalText = valueAfter(/Delmål som intyget avser/i, [
    /Kursens ämne/i,
    /Kursens amne/i,
    /Beskrivning av kursen/i,
  ]);
  console.warn('[Bilaga 10 Parser] delmalText:', delmalText);
  
  // Använd extractDelmalCodes direkt från common.ts istället för extractCommon
  // eftersom extractDelmalCodes är mer robust och hanterar alla varianter
  let rawDelmalCodes: string[] | undefined;
  if (delmalText) {
    rawDelmalCodes = extractDelmalCodes(delmalText);
    console.warn('[Bilaga 10 Parser] rawDelmalCodes från delmalText:', rawDelmalCodes);
  }
  // Fallback till base.delmalCodes om inget hittades
  if (!rawDelmalCodes || rawDelmalCodes.length === 0) {
    rawDelmalCodes = extractDelmalCodes(raw);
    console.warn('[Bilaga 10 Parser] rawDelmalCodes från hela texten:', rawDelmalCodes);
  }
  
  // Normalisera och sortera delmål för 2021
  const delmalCodes = rawDelmalCodes && rawDelmalCodes.length > 0 
    ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) 
    : undefined;
  console.warn('[Bilaga 10 Parser] delmalCodes (normaliserade):', delmalCodes);

  // Personnummer (rubrikfält eller fallback)
  const pnrText = valueAfter(/Personnummer/i) || lines.join(" ");
  const personnummer =
    (pnrText.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) || [])[0] || base.personnummer;

  // Specialitet som ansökan avser
  const specialtyHeaderRaw = valueAfter(/Specialitet som ansökan avser/i, [
    /Delmål som intyget avser/i,
    /Kursens ämne/i,
  ]);
  const specialtyHeader = specialtyHeaderRaw?.trim() || undefined;

  // Intygare (handledare/kursledare)
  const supervisorName = valueAfter(/Namnförtydligande/i);
  // För handledare: leta efter "Specialitet (gäller endast handledare)" eller bara "Specialitet"
  // OBS: "Specialitet" ska INTE matcha "Specialitet som ansökan avser"
  const supervisorSpeciality = 
    valueAfter(/Specialitet\s*\(gäller\s+endast\s+handledare\)/i) ||
    valueAfter(/Specialitet\s*\(galler\s+endast\s+handledare\)/i) ||
    (() => {
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
  const supervisorSite = valueAfter(/Tjänsteställe/i) || valueAfter(/Tjanstestalle/i);

  // Datum (ofta "Ort och datum") → lägg i period.endISO så mapAndSaveKurs kan använda som certificateDate
  const placeDateRaw = valueAfter(/Ort och datum/i) || "";
  const dateFromPlace = placeDateRaw ? extractDates(placeDateRaw).startISO : undefined;
  let period = base.period;
  if (dateFromPlace && !period?.endISO) {
    period = { ...(period || {}), endISO: dateFromPlace };
  }

  // Kryssrutor handledare/kursledare
  // Leta efter rader som innehåller "Handledare" eller "Kursledare" med checkbox-tecken
  const markRe = /(☒|✓|✗|☑|\bx\b|\bX\b)/i;
  const handledLine = lines.find((l) => {
    const lower = l.toLowerCase();
    return /handledare/i.test(lower) && !/kursledare/i.test(lower) && markRe.test(l);
  });
  const kursledLine = lines.find((l) => {
    const lower = l.toLowerCase();
    return /kursledare/i.test(lower) && !/handledare/i.test(lower) && markRe.test(l);
  });
  
  let signingRole: "handledare" | "kursledare" | undefined;
  if (handledLine && !kursledLine) {
    signingRole = "handledare";
  } else if (kursledLine && !handledLine) {
    signingRole = "kursledare";
  } else {
    // Heuristik: om handledare-fält verkar ifyllda → handledare
    if (supervisorSpeciality || supervisorSite) {
      signingRole = "handledare";
    } else {
      signingRole = "kursledare"; // Default
    }
  }

  // Om vi fick åtminstone titel/subject eller beskrivning så anser vi att rubrik-parsning lyckades
  const ok = Boolean(subject || description || supervisorName || personnummer);
  if (!ok) return null;

  // Validera och förbättra parsning för tomma fält
  let finalSupervisorSite = supervisorSite;
  
  // Om Tjänsteställe saknas men andra fält är ifyllda, leta extra noga
  if (!finalSupervisorSite) {
    // Räkna igenom alla rubriker i texten och matcha mot obligatoriska fält
    const foundRubrics = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const n = norm(line);
      
      // Identifiera rubriker
      if (n.includes("tjanstestalle") || n.includes("tjanstestalle")) {
        foundRubrics.add("tjanstestalle");
        // Om vi hittar rubriken men inte har värdet, försök hämta det
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (nextLine && !isLabelLine(nextLine) && !shouldIgnoreLine(nextLine)) {
            // Ta BARA nästa rad (inte flera rader) och stanna där
            // Stoppa också om raden innehåller "FS" eller "HSLF" (för att undvika "FS 2021:81 (1)")
            const trimmed = nextLine.trim();
            // Om raden innehåller "FS" eller "HSLF", ta bara delen före det
            const fsMatch = trimmed.match(/^(.+?)(?:\s+FS\s+|\s+HSLF)/i);
            const candidate = fsMatch ? fsMatch[1].trim() : trimmed;
            if (candidate && candidate.length > 2) {
              finalSupervisorSite = candidate;
              break;
            }
          }
        }
      }
    }
    
    // Om fortfarande tomt, försök smart matching: om alla andra fält är ifyllda,
    // leta efter rader som ser ut som rubriker men inte matchade något annat fält
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
      
      // Räkna antal ifyllda fält
      const filledCount = Object.values(filledFields).filter(Boolean).length;
      
      // Om de flesta fält är ifyllda, leta extra noga efter Tjänsteställe
      if (filledCount >= 5) {
        // Leta efter rader som innehåller "tjänst" eller liknande men inte matchade andra fält
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const n = norm(line);
          
          // Om raden innehåller "tjänst" eller "ställe" men inte är en känd rubrik för andra fält
          if (
            (n.includes("tjanst") || n.includes("stalle")) &&
            !n.includes("specialitet") &&
            !n.includes("namnfortydligande") &&
            !n.includes("ort och datum")
          ) {
            // Kolla om nästa rad ser ut som ett värde
            if (i + 1 < lines.length) {
              const nextLine = lines[i + 1];
              if (nextLine && !shouldIgnoreLine(nextLine) && !isLabelLine(nextLine)) {
                const candidate = nextLine.trim();
                if (candidate && candidate.length > 2 && candidate.length < 100) {
                  finalSupervisorSite = candidate;
                  break;
                }
              }
            }
          }
        }
        
        // Om fortfarande tomt, leta efter rader EFTER "Namnförtydligande" eller "Specialitet"
        // som inte matchade något annat fält
        if (!finalSupervisorSite) {
          const supervisorNameIdx = lines.findIndex((l) => /namnfortydligande/i.test(l));
          const supervisorSpecialityIdx = lines.findIndex((l) => 
            /specialitet\s*\(galler\s+endast\s+handledare\)/i.test(l) ||
            /specialitet/i.test(l)
          );
          
          // Leta efter rader efter dessa rubriker som kan vara Tjänsteställe
          const searchStartIdx = Math.max(supervisorNameIdx, supervisorSpecialityIdx);
          if (searchStartIdx >= 0) {
            for (let i = searchStartIdx + 1; i < lines.length; i++) {
              const line = lines[i];
              if (!line) break;
              if (isLabelLine(line)) break; // Stoppa vid nästa rubrik
              
              if (shouldIgnoreLine(line)) continue; // Hoppa över rader som ska ignoreras
              
              const n = norm(line);
              // Om raden ser ut som ett värde (inte för kort, inte för lång, inte bara siffror)
              if (
                line.length > 2 &&
                line.length < 100 &&
                !/^\d+$/.test(line) &&
                !n.includes("ort och datum") &&
                !n.includes("intygsutfardande")
              ) {
                // Detta kan vara Tjänsteställe
                finalSupervisorSite = line.trim();
                break;
              }
            }
          }
        }
      }
    }
  }

  return {
    personnummer,
    delmalCodes,
    period,
    type: "KURS",
    fullName: fullName || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    specialtyHeader: specialtyHeader || undefined,
    courseTitle: subject || undefined,
    subject: subject || undefined,
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: finalSupervisorSite || undefined,
    signingRole,
  };
}

/**
 * Stöd för manuellt annoterad OCR-text där:
 * - R<n> = rubrikrad (samma som i app-fönstret) - alla icke-X-rader tills nästa R är värdet
 * - S    = checkbox ikryssad (S Handledare eller S Kursledare)
 * - X    = rad som alltid ska ignoreras
 * - T<n> = explicit text kopplad till rubriken R<n> (används om användaren markerat det)
 * - Allt utan R/S/X/T = ignoreras (kan behövas för OCR-identifiering)
 *
 * Regler:
 * 1. Efter en R-rad samlas alla icke-X-rader tills nästa R-rad (eller S-rad)
 * 2. X-rader ignoreras helt
 * 3. S-rad betyder checkbox ikryssad (S Handledare eller S Kursledare)
 * 4. Obligatoriska fält valideras och smart matching används om något saknas
 */
function parseByAnnotatedMarkers(raw: string): ParsedKurs2021 | null {
  // Normalisera OCR-fel: "Fömamn" -> "Förnamn", "Eftemamn" -> "Efternamn"
  const normalizedRaw = raw
    .replace(/\bFömamn\b/gi, "Förnamn")
    .replace(/\bEftemamn\b/gi, "Efternamn");
  
  const lines = normalizedRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Kontrollera om det finns tillräckligt med R/S/X-markeringar
  const rCount = lines.filter((l) => /^[Rr]\d*\s/.test(l)).length;
  const sCount = lines.filter((l) => /^[Ss]\s/.test(l)).length;
  const xCount = lines.filter((l) => /^[xX]\b/.test(l)).length;
  if (rCount < 6 && xCount < 3 && sCount === 0) return null;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  // Mappa: rubrik-text → värde (kan vara flerradigt)
  const rubricToValue = new Map<string, string>();
  
  // S-rad: checkbox ikryssad
  let signingRole: "handledare" | "kursledare" | undefined;

  // Obligatoriska fält för Bilaga 10
  const requiredFields = [
    { variants: ["Kurs"], key: "kurs" },
    { variants: ["Förnamn", "Fornamn"], key: "fornamn" },
    { variants: ["Efternamn"], key: "efternamn" },
    { variants: ["Specialitet som ansökan avser", "Specialitet som ansokan avser"], key: "specialitet" },
    { variants: ["Personnummer", "Person nummer"], key: "personnummer" },
    { variants: ["Delmål som intyget avser", "Delmal som intyget avser"], key: "delmal" },
    { variants: ["Kursens ämne", "Kursens amne"], key: "kursensamne" },
    { variants: ["Beskrivning av kursen"], key: "beskrivning" },
    { variants: ["Namnförtydligande", "Namnfortydligande"], key: "namnfortydligande" },
    { variants: ["Specialitet"], key: "handledarspecialitet" },
    { variants: ["Tjänsteställe", "Tjanstestalle"], key: "tjanstestalle" },
  ];

  // Hjälpfunktion för att kontrollera om en rad ska ignoreras (inklusive HSLF- FS-mönster)
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

    // Matcha S-rad (checkbox ikryssad)
    const sMatch = /^[Ss]\s+(.*)$/.exec(line);
    if (sMatch) {
      const sText = sMatch[1].trim().toLowerCase();
      if (sText.includes("handledare") && !sText.includes("kursledare")) {
        signingRole = "handledare";
      } else if (sText.includes("kursledare") && !sText.includes("handledare")) {
        signingRole = "kursledare";
      }
      continue;
    }

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
          if (nextLine && !/^[Rr](?:\d+)?\s/.test(nextLine) && !/^[Ss]\s/.test(nextLine) && !/^[xX]\b/.test(nextLine)) {
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

      // För övriga rubriker: samla alla icke-X-rader tills nästa R-rad eller S-rad
      const valueLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (!nextLine) continue;

        // Stoppa vid nästa R-rad eller S-rad
        if (/^[Rr](?:\d+)?\s/.test(nextLine) || /^[Ss]\s/.test(nextLine)) break;

        // Ignorera X-rader
        if (/^[xX]\b/.test(nextLine)) continue;
        
        // Ignorera HSLF- FS-rader
        if (shouldIgnoreLineAnnotated(nextLine)) continue;

        // Om det är en T-rad med samma ID (om R hade ID), använd den och stoppa
        const rIdMatch = /^[Rr](\d+)\s/.exec(line);
        if (rIdMatch) {
          const tMatch = /^[Tt](\d+)\s*(.*)$/.exec(nextLine);
          if (tMatch && tMatch[1] === rIdMatch[1]) {
            valueLines.push(tMatch[2].trim());
            break;
          }
        }

        // Annars: lägg till alla icke-X, icke-R, icke-S, icke-T rader
        if (!/^[Rr](?:\d+)?\s/.test(nextLine) && !/^[Ss]\s/.test(nextLine) && !/^[Tt]\d+\b/.test(nextLine)) {
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

    // Matcha T-rad (explicit text-värde) - kan användas om användaren markerat det
    const tMatch = /^[Tt](\d*)\s*(.*)$/.exec(line);
    if (tMatch) {
      // T-rader hanteras ovan när vi hittar motsvarande R-rad
      continue;
    }
    
    // Allt utan R/S/X/T ignoreras (kan behövas för OCR-identifiering)
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

  // Smart matching: om ett obligatoriskt fält saknas, försök hitta det via fuzzy matching
  const smartMatchMissingField = (fieldKey: string, fieldVariants: string[]): string | undefined => {
    // Försök hitta via partiell matchning i alla rubricToValue-nycklar
    const nKey = norm(fieldKey);
    for (const [rubricNorm, value] of rubricToValue.entries()) {
      // Om rubrik-nyckeln liknar det vi letar efter
      if (rubricNorm.includes(nKey) || nKey.includes(rubricNorm)) {
        return value;
      }
    }
    
    // Försök hitta via variant-matchning
    for (const variant of fieldVariants) {
      const nVariant = norm(variant);
      for (const [rubricNorm, value] of rubricToValue.entries()) {
        // Partiell matchning (t.ex. "fornamn" matchar "fornamn" eller "fornamnnamn")
        if (rubricNorm.length > 0 && (
          rubricNorm.includes(nVariant.substring(0, Math.min(5, nVariant.length))) ||
          nVariant.includes(rubricNorm.substring(0, Math.min(5, rubricNorm.length)))
        )) {
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

  // Extrahera fält baserat på rubriker med smart matching
  let courseTitle = findValueByRubric(["Kursens ämne", "Kursens amne"]);
  if (!courseTitle) {
    courseTitle = smartMatchMissingField("kursensamne", ["Kursens ämne", "Kursens amne"]);
  }
  
  let description = findValueByRubric(["Beskrivning av kursen"]);
  if (!description) {
    description = smartMatchMissingField("beskrivning", ["Beskrivning av kursen"]);
  }
  
  // Personnummer
  let pnrValue = findValueByRubric(["Personnummer", "Person nummer"]);
  if (!pnrValue) {
    pnrValue = smartMatchMissingField("personnummer", ["Personnummer", "Person nummer"]);
  }
  const personnummer = pnrValue 
    ? (pnrValue.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) || [])[0]?.replace(/\s+/g, "")
    : base.personnummer;

  // Delmål
  let delmalValue = findValueByRubric(["Delmål som intyget avser", "Delmal som intyget avser"]);
  if (!delmalValue) {
    delmalValue = smartMatchMissingField("delmal", ["Delmål som intyget avser", "Delmal som intyget avser"]);
  }
  const rawDelmalCodes = delmalValue 
    ? extractCommon(delmalValue).delmalCodes 
    : base.delmalCodes;
  // Normalisera och sortera delmål för 2021
  const delmalCodes = rawDelmalCodes ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) : undefined;

  // Specialitet som ansökan avser
  let specialtyHeaderRaw = findValueByRubric(["Specialitet som ansökan avser", "Specialitet som ansokan avser"]);
  if (!specialtyHeaderRaw) {
    specialtyHeaderRaw = smartMatchMissingField("specialitet", ["Specialitet som ansökan avser", "Specialitet som ansokan avser"]);
  }
  const specialtyHeader = specialtyHeaderRaw?.trim() || undefined;

  // Handledare/Kursledare
  let supervisorName = findValueByRubric(["Namnförtydligande", "Namnfortydligande"]);
  if (!supervisorName) {
    supervisorName = smartMatchMissingField("namnfortydligande", ["Namnförtydligande", "Namnfortydligande"]);
  }
  
  // För handledare: leta efter "Specialitet (gäller endast handledare)" eller bara "Specialitet"
  // OBS: "Specialitet" ska INTE matcha "Specialitet som ansökan avser"
  let supervisorSpeciality = 
    findValueByRubric(["Specialitet (gäller endast handledare)", "Specialitet (galler endast handledare)"]) ||
    (() => {
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
  if (!supervisorSpeciality) {
    supervisorSpeciality = smartMatchMissingField("handledarspecialitet", [
      "Specialitet (gäller endast handledare)",
      "Specialitet (galler endast handledare)",
      "Specialitet"
    ]);
  }
  
  // Tjänsteställe: bara FÖLJANDE RAD ska inkluderas
  let supervisorSite = (() => {
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
              if (nextLine && !/^[Rr](?:\d+)?\s/.test(nextLine) && !/^[Ss]\s/.test(nextLine) && !/^[xX]\b/.test(nextLine)) {
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
  
  if (!supervisorSite) {
    supervisorSite = smartMatchMissingField("tjanstestalle", ["Tjänsteställe", "Tjanstestalle"]);
  }

  // Datum (ofta "Ort och datum")
  const placeDateRaw = findValueByRubric(["Ort och datum", "Ort och datum"]);
  const dateFromPlace = placeDateRaw ? extractDates(placeDateRaw).startISO : undefined;
  let period = base.period;
  if (dateFromPlace && !period?.endISO) {
    period = { ...(period || {}), endISO: dateFromPlace };
  }

  // Kryssrutor handledare/kursledare - använd S-rad om den finns
  // Om ingen S-rad hittades, använd heuristik baserat på fält
  if (!signingRole) {
    if (supervisorSpeciality || supervisorSite) {
      signingRole = "handledare";
    } else {
      signingRole = "kursledare"; // Default
    }
  }

  // Validera och förbättra parsning för tomma fält
  let finalSupervisorSite = supervisorSite;
  
  // Om Tjänsteställe saknas men andra fält är ifyllda, leta extra noga
  if (!finalSupervisorSite) {
    // Räkna antal ifyllda fält
    const filledFields = {
      firstName: !!firstName,
      lastName: !!lastName,
      personnummer: !!personnummer,
      specialtyHeader: !!specialtyHeader,
      courseTitle: !!courseTitle,
      description: !!description,
      supervisorName: !!supervisorName,
      supervisorSpeciality: !!supervisorSpeciality,
    };
    
    const filledCount = Object.values(filledFields).filter(Boolean).length;
    
    // Om de flesta fält är ifyllda, leta extra noga efter Tjänsteställe
    if (filledCount >= 5) {
      // Räkna igenom alla rubriker i rubricToValue och se om någon kan vara Tjänsteställe
      for (const [rubricNorm, value] of rubricToValue.entries()) {
        // Om rubriken innehåller "tjänst" eller "ställe" men inte matchade andra fält
        if (
          (rubricNorm.includes("tjanst") || rubricNorm.includes("stalle")) &&
          !rubricNorm.includes("specialitet") &&
          !rubricNorm.includes("namnfortydligande") &&
          !rubricNorm.includes("ort") &&
          value &&
          value.length > 2 &&
          value.length < 100
        ) {
          finalSupervisorSite = value.trim();
          break;
        }
      }
      
      // Om fortfarande tomt, leta i råtexten efter rader som kan vara Tjänsteställe
      if (!finalSupervisorSite) {
        // Hitta index för Namnförtydligande och Specialitet
        let supervisorNameIdx = -1;
        let supervisorSpecialityIdx = -1;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/^[Rr](?:\d+)?\s/.test(line)) {
            const rMatch = /^[Rr](?:\d+)?\s+(.*)$/.exec(line);
            if (rMatch) {
              const rubricText = rMatch[1].trim();
              const n = norm(rubricText);
              if (n.includes("namnfortydligande")) {
                supervisorNameIdx = i;
              } else if (n.includes("specialitet") && !n.includes("ansokan")) {
                supervisorSpecialityIdx = i;
              }
            }
          }
        }
        
        // Leta efter rader efter dessa rubriker som kan vara Tjänsteställe
        const searchStartIdx = Math.max(supervisorNameIdx, supervisorSpecialityIdx);
        if (searchStartIdx >= 0) {
          // Hitta nästa R-rad efter searchStartIdx
          let nextRIdx = -1;
          for (let i = searchStartIdx + 1; i < lines.length; i++) {
            if (/^[Rr](?:\d+)?\s/.test(lines[i])) {
              nextRIdx = i;
              break;
            }
          }
          
          // Om vi hittade en nästa R-rad, kolla raderna mellan dem
          const endIdx = nextRIdx >= 0 ? nextRIdx : lines.length;
          for (let i = searchStartIdx + 1; i < endIdx; i++) {
            const line = lines[i];
            if (!line) continue;
            
            // Ignorera X-rader, R-rader, S-rader, T-rader
            if (/^[xX]\b/.test(line) || /^[Rr](?:\d+)?\s/.test(line) || /^[Ss]\s/.test(line) || /^[Tt]\d+\b/.test(line)) {
              continue;
            }
            
            // Ignorera HSLF- FS-rader (stoppa vid HSLF för Tjänsteställe)
            if (shouldIgnoreLineAnnotated(line)) {
              // Om det är HSLF, stoppa här (men inkludera inte HSLF-raden)
              if (/^HSLF/i.test(line.trim())) break;
              continue;
            }
            
            // Om raden ser ut som ett värde (inte för kort, inte för lång)
            if (line.length > 2 && line.length < 100 && !/^\d+$/.test(line)) {
              const n = norm(line);
              // Om raden inte innehåller kända stoppord
              if (
                !n.includes("ort och datum") &&
                !n.includes("intygsutfardande") &&
                !n.includes("namnteckning")
              ) {
                // Detta kan vara Tjänsteställe
                finalSupervisorSite = line.trim();
                break;
              }
            }
          }
        }
      }
    }
  }

  // Returnera i format som ScanIntygModal redan hanterar
  return {
    personnummer,
    delmalCodes,
    period,
    type: "KURS",
    fullName: fullName || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    specialtyHeader: specialtyHeader || undefined,
    courseTitle: courseTitle || undefined,
    subject: courseTitle || undefined,
    description: description || undefined,
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: finalSupervisorSite || undefined,
    signingRole,
  };
}

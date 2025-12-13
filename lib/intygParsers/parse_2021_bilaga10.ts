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

    // Annars: ta nästa rad (såvida det inte är en annan rubrik eller stopp-mönster)
    // För beskrivningar kan det vara flera rader, så vi tar alla tills nästa rubrik
    const isDescription = labelRe.source.includes("Beskrivning");
    
    if (isDescription) {
      // För beskrivningar: ta alla rader tills nästa rubrik/stopp
      const out: string[] = [];
      for (let i = idx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (!l) break;
        if (isLabelLine(l)) break;
        if (stopRes.some((re) => re.test(l))) break;
        out.push(l);
      }
      return out.join("\n").trim() || undefined;
    } else {
      // För övriga fält: ta bara nästa rad
      if (idx + 1 >= lines.length) return undefined;
      const nextLine = lines[idx + 1];
      if (!nextLine) return undefined;
      if (isLabelLine(nextLine)) return undefined;
      if (stopRes.some((re) => re.test(nextLine))) return undefined;
      return nextLine.trim() || undefined;
    }
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

  // Specialitet som ansökan avser
  const specialtyHeaderRaw = valueAfter(/Specialitet som ansökan avser/i, [
    /Delmål som intyget avser/i,
    /Kursens ämne/i,
  ]);
  const specialtyHeader = specialtyHeaderRaw?.trim() || undefined;

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
    specialtyHeader: specialtyHeader || undefined,
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
 * - X    = rad som alltid ska ignoreras (t.ex. huvudrubrik, bilagenummer)
 * - R<n> = rubrikrad (samma som i app-fönstret) - nästa icke-X-rad är värdet
 * - T<n> = explicit text kopplad till rubriken R<n> (används om användaren markerat det)
 *
 * Regler:
 * 1. Efter en R-rad kommer värdet på nästa rad (såvida det inte är en X-rad)
 * 2. Om nästa rad är X, hoppa över den och ta nästa icke-X-rad
 * 3. Rubrikerna (R) matchar rubrikerna i app-fönstret
 */
function parseByAnnotatedMarkers(raw: string): ParsedKurs2021 | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Kontrollera om det finns tillräckligt med R/T/X-markeringar
  const rtCount = lines.filter((l) => /^[rRtT]\d+\b/.test(l)).length;
  const xCount = lines.filter((l) => /^[xX]\b/.test(l)).length;
  if (rtCount < 6 && xCount < 3) return null;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  // Mappa: rubrik-text → värde
  const rubricToValue = new Map<string, string>();

  // Iterera sekventiellt genom raderna
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Ignorera X-rader helt
    if (/^[xX]\b/.test(line)) continue;

    // Matcha R-rad (rubrik)
    const rMatch = /^[Rr](\d+)\s*(.*)$/.exec(line);
    if (rMatch) {
      const rubricText = rMatch[2].trim();
      if (!rubricText) continue;

      // Hitta nästa icke-X-rad som värde
      let value: string | undefined = undefined;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (!nextLine) continue;

        // Ignorera X-rader
        if (/^[xX]\b/.test(nextLine)) continue;

        // Ignorera nya R-rader (ny rubrik = stopp)
        if (/^[Rr]\d+\b/.test(nextLine)) break;

        // Om det är en T-rad med samma ID, använd den
        const tMatch = /^[Tt](\d+)\s*(.*)$/.exec(nextLine);
        if (tMatch && tMatch[1] === rMatch[1]) {
          value = tMatch[2].trim();
          break;
        }

        // Annars: första icke-X, icke-R rad är värdet
        if (!/^[RrTt]\d+\b/.test(nextLine)) {
          value = nextLine;
          break;
        }
      }

      // Om vi hittade ett värde, spara det
      if (value) {
        rubricToValue.set(norm(rubricText), value);
      }
      continue;
    }

    // Matcha T-rad (explicit text-värde) - kan användas om användaren markerat det
    const tMatch = /^[Tt](\d+)\s*(.*)$/.exec(line);
    if (tMatch) {
      // T-rader hanteras ovan när vi hittar motsvarande R-rad
      continue;
    }
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
  const courseTitle = findValueByRubric(["Kursens ämne", "Kursens amne"]);
  const description = findValueByRubric(["Beskrivning av kursen", "Beskrivning av kursen"]);
  
  // Personnummer
  const pnrValue = findValueByRubric(["Personnummer", "Person nummer"]);
  const personnummer = pnrValue 
    ? (pnrValue.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) || [])[0]?.replace(/\s+/g, "")
    : base.personnummer;

  // Delmål
  const delmalValue = findValueByRubric(["Delmål som intyget avser", "Delmal som intyget avser"]);
  const delmalCodes = delmalValue 
    ? extractCommon(delmalValue).delmalCodes 
    : base.delmalCodes;

  // Specialitet som ansökan avser
  const specialtyHeaderRaw = findValueByRubric(["Specialitet som ansökan avser", "Specialitet som ansokan avser"]);
  const specialtyHeader = specialtyHeaderRaw?.trim() || undefined;

  // Handledare/Kursledare
  const supervisorName = findValueByRubric(["Namnförtydligande", "Namnfortydligande"]);
  const supervisorSpeciality = findValueByRubric(["Specialitet"]);
  const supervisorSite = findValueByRubric(["Tjänsteställe", "Tjanstestalle", "Tjänstestalle"]);

  // Datum (ofta "Ort och datum")
  const placeDateRaw = findValueByRubric(["Ort och datum", "Ort och datum"]);
  const dateFromPlace = placeDateRaw ? extractDates(placeDateRaw).startISO : undefined;
  let period = base.period;
  if (dateFromPlace && !period?.endISO) {
    period = { ...(period || {}), endISO: dateFromPlace };
  }

  // Kryssrutor handledare/kursledare
  // Specialfall: X efter R10 (eller liknande) betyder att checkboxen är ikryssad, inte att den ska ignoreras
  // Sök efter R-rad som markerar checkbox-fältet, och kolla om nästa rad är X (dvs ikryssad)
  let signingRole: "handledare" | "kursledare" | undefined;
  
  // Försök hitta R-rad för handledare/kursledare checkbox
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rMatch = /^[Rr](\d+)\s*(.*)$/.exec(line);
    if (!rMatch) continue;
    
    const rubricText = rMatch[2].trim().toLowerCase();
    const isHandledareRubric = rubricText.includes("handledare") && !rubricText.includes("kursledare");
    const isKursledareRubric = rubricText.includes("kursledare") && !rubricText.includes("handledare");
    
    if (isHandledareRubric || isKursledareRubric) {
      // Kolla nästa rad - om det är X betyder det att checkboxen är ikryssad
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (/^[xX]\b/.test(nextLine)) {
          // X-rad efter R = checkbox ikryssad
          signingRole = isHandledareRubric ? "handledare" : "kursledare";
          break;
        }
      }
    }
  }
  
  // Fallback: försök hitta via text-värde
  if (!signingRole) {
    const checkboxValue = findValueByRubric([
      "Handledare", "Kursledare", 
      "Jag intygar som handledare", "Jag intygar som kursledare"
    ]);
    
    if (checkboxValue) {
      const lower = checkboxValue.toLowerCase();
      if (lower.includes("kursled") && !lower.includes("handled")) {
        signingRole = "kursledare";
      } else if (lower.includes("handled") && !lower.includes("kursled")) {
        signingRole = "handledare";
      }
    }
  }

  // Heuristik: om handledare-fält verkar ifyllda → handledare
  if (!signingRole) {
    if (supervisorSpeciality || supervisorSite) {
      signingRole = "handledare";
    } else {
      signingRole = "kursledare"; // Default
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
    supervisorSite: supervisorSite || undefined,
    signingRole,
  };
}

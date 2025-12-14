// lib/intygParsers/common.ts
import { extractDates, splitClinicAndPeriod } from "@/lib/dateExtract";

// Vanlig svensk personnummer-match (med/utan bindestreck)
const PNR = /\b(\d{6}|\d{8})[- ]?\d{4}\b/;

// Helper för att extrahera period från zon-text (t.ex. "270101-270401" eller "2025-01-01 - 2025-04-01")
export function extractPeriodFromZoneText(periodText: string): { startISO?: string; endISO?: string } | undefined {
  if (!periodText || !periodText.trim()) return undefined;
  
  // Använd extractDates som är robust och hanterar olika datumformat
  const dates = extractDates(periodText);
  if (dates.startISO || dates.endISO) {
    return dates;
  }
  
  return undefined;
}

// Delmålkoder: a1..a7, b1.., c1.. (2015) samt STa1..STa7, STb1.., STc1.. (2021)
export function extractDelmalCodes(text: string): string[] {
  const res = new Set<string>();
  const re = /\b(ST?[abc][0-9]{1,2})\b/gi; // fångar a1, b2, c5, STa3, STb2...
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) res.add(m[1].toUpperCase());
  return Array.from(res);
}

/**
 * Normalisera och sortera delmål för 2021:
 * - Normalisera alla varianter (a1, A1, sta1, Sta1, STA1) till STa1-format (ST stora, typ liten, nummer)
 * - Sortera i ordning: STa1-STa7, STb1-STb4, STc1-STc14
 * - Exkludera delmål utanför detta (t.ex. STc19)
 */
export function normalizeAndSortDelmalCodes2021(codes: string[]): string[] {
  const validCodes = new Set<string>();
  
  // Definiera giltiga delmål för 2021 (med liten bokstav för typen)
  const validDelmal = new Set<string>();
  // STa1-STa7
  for (let i = 1; i <= 7; i++) validDelmal.add(`STa${i}`);
  // STb1-STb4
  for (let i = 1; i <= 4; i++) validDelmal.add(`STb${i}`);
  // STc1-STc14
  for (let i = 1; i <= 14; i++) validDelmal.add(`STc${i}`);
  
  // Normalisera varje kod
  for (const code of codes) {
    // Ta bort alla separerare
    const cleaned = code.trim();
    
    // Matcha olika format: a1, A1, sta1, Sta1, STA1, STa1, etc.
    const match = cleaned.match(/^ST?([abcABC])(\d+)$/i);
    if (match) {
      const letter = match[1].toLowerCase(); // Alltid liten bokstav
      const number = parseInt(match[2], 10);
      const normalized = `ST${letter}${number}`;
      
      // Kontrollera om det är ett giltigt delmål
      if (validDelmal.has(normalized)) {
        validCodes.add(normalized);
      }
    }
  }
  
  // Sortera i ordning: STa1-STa7, STb1-STb4, STc1-STc14
  const sorted = Array.from(validCodes).sort((a, b) => {
    // Extrahera bokstav och nummer
    const aMatch = a.match(/^ST([abc])(\d+)$/);
    const bMatch = b.match(/^ST([abc])(\d+)$/);
    if (!aMatch || !bMatch) return 0;
    
    const aLetter = aMatch[1];
    const bLetter = bMatch[1];
    const aNum = parseInt(aMatch[2], 10);
    const bNum = parseInt(bMatch[2], 10);
    
    // Först sortera på bokstav (a < b < c)
    if (aLetter !== bLetter) {
      return aLetter.localeCompare(bLetter);
    }
    
    // Sedan på nummer
    return aNum - bNum;
  });
  
  return sorted;
}

export function extractPersonnummer(text: string): string | undefined {
  const m = PNR.exec(text.replace(/\s+/g, " "));
  return m?.[0]?.replace(/\s+/g, "") ?? undefined;
}

export function extractFullNameBlock(text: string): { fullName?: string, firstName?: string, lastName?: string } {
  // Normalisera OCR-fel: "Fömamn" -> "Förnamn", "Eftemamn" -> "Efternamn"
  const normalizedText = text
    .replace(/\bFömamn\b/gi, "Förnamn")
    .replace(/\bEftemamn\b/gi, "Efternamn");
  
  // Heuristik: leta efter block med "Efternamn" + "Förnamn" på samma område
  // eller rader som "Fröberg Andreas".
  // OBS: fullName ska vara "Förnamn Efternamn" (förnamn först)
  const lines = normalizedText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const i = lines.findIndex(l => /efternamn/i.test(l) && /förnamn/i.test(l));
  if (i >= 0 && lines[i+1]) {
    const parts = lines[i+1].split(/\s+/);
    if (parts.length >= 2) {
      const lastName = parts[0];
      const firstName = parts.slice(1).join(" ");
      // fullName: förnamn först
      return { fullName: `${firstName} ${lastName}`.trim(), firstName, lastName };
    }
  }
  // fallback: första rad som ser ut som "Efternamn Förnamn"
  const m = normalizedText.match(/\n([A-ZÅÄÖ][a-zåäö]+)\s+([A-ZÅÄÖ][a-zåäö]+)\b/);
  if (m) {
    const lastName = m[1];
    const firstName = m[2];
    // fullName: förnamn först
    return { fullName: `${firstName} ${lastName}`, firstName, lastName };
  }
  return {};
}

export function extractSpecialty(text: string): string | undefined {
  // Fältet heter ofta "Specialitet som ansökan avser"
  const m = text.match(/specialitet\s+som\s+ansökan\s+avser\s*:?\s*([^\n]+)/i);
  return m?.[1]?.trim();
}

export function extractSubjectAfterLabel(text: string, labelRegex: RegExp): string | undefined {
  // Hämtar "ämnesrad" efter en label (rubrikform) – tar nästa 1–2 rader
  const idx = text.search(labelRegex);
  if (idx < 0) return undefined;
  const seg = text.slice(idx).split(/\r?\n/).slice(1, 3).join(" ").trim();
  return squeeze(seg);
}

export function extractBlockAfterLabel(text: string, labelRegex: RegExp): string | undefined {
  // Hämtar större fritextfält (beskrivning). Tar rader tills nästa tomrad eller nästa kända label.
  const labelsStop = /(Ort och datum|Namnteckning|Namnförtydligande|Specialitet|Tjänsteställe|Bilaga nr)/i;
  const idx = text.search(labelRegex);
  if (idx < 0) return undefined;
  const rest = text.slice(idx).split(/\r?\n/).slice(1);
  const buff: string[] = [];
  for (const line of rest) {
    if (!line.trim()) break;
    if (labelsStop.test(line)) break;
    buff.push(line);
  }
  return squeeze(buff.join("\n"));
}

export function extractClinicAndPeriodFromLine(line: string): { clinic?: string, period?: {startISO?: string; endISO?: string} } {
  if (!line) return {};
  const { clean, startISO, endISO } = splitClinicAndPeriod(line);
  const period = (startISO || endISO) ? { startISO, endISO } : undefined;
  return { clinic: clean || undefined, period };
}

export function fallbackPeriod(text: string): { startISO?: string; endISO?: string } | undefined {
  const { startISO, endISO } = extractDates(text);
  if (startISO || endISO) return { startISO, endISO };
  return undefined;
}

function squeeze(s?: string): string | undefined {
  if (!s) return undefined;
  return s.replace(/\s{2,}/g, " ").replace(/^\s+|\s+$/g, "");
}

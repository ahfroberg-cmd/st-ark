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

export function extractPersonnummer(text: string): string | undefined {
  const m = PNR.exec(text.replace(/\s+/g, " "));
  return m?.[0]?.replace(/\s+/g, "") ?? undefined;
}

export function extractFullNameBlock(text: string): { fullName?: string, firstName?: string, lastName?: string } {
  // Heuristik: leta efter block med "Efternamn" + "Förnamn" på samma område
  // eller rader som "Fröberg Andreas".
  // OBS: fullName ska vara "Förnamn Efternamn" (förnamn först)
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
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
  const m = text.match(/\n([A-ZÅÄÖ][a-zåäö]+)\s+([A-ZÅÄÖ][a-zåäö]+)\b/);
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

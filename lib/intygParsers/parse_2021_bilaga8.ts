// lib/intygParsers/parse_2021_bilaga8.ts
import type { ParsedIntyg } from "./types";
import type { OcrWord } from "@/lib/ocr";
import {
  extractDelmalCodes, extractPersonnummer, extractFullNameBlock,
  extractSpecialty, extractBlockAfterLabel, extractSubjectAfterLabel,
  extractClinicAndPeriodFromLine, fallbackPeriod, normalizeAndSortDelmalCodes2021
} from "./common";

export function parse_2021_bilaga8(text: string, words?: OcrWord[]): ParsedIntyg {
  const kind = "2021-B8-AUSK";
  const rawDelmalCodes = extractDelmalCodes(text);
  // Normalisera och sortera delmål för 2021
  const delmalCodes = rawDelmalCodes.length > 0 ? normalizeAndSortDelmalCodes2021(rawDelmalCodes) : undefined;
  const { fullName, firstName, lastName } = extractFullNameBlock(text);
  const personnummer = extractPersonnummer(text);
  const specialtyHeader = extractSpecialty(text);

  const clinicLine = matchLine(text, /(Tjänstgöringsställe|Auskultation)/i);
  const { clinic, period } = extractClinicAndPeriodFromLine(clinicLine);
  const description = extractBlockAfterLabel(text, /Beskrivning av auskultationen/i);

  return { kind, fullName, firstName, lastName, personnummer, specialtyHeader,
    delmalCodes, clinic, period: period ?? fallbackPeriod(text), description };
}

function matchLine(text: string, re: RegExp): string {
  const m = text.split(/\r?\n/).find(l => re.test(l));
  return m ?? "";
}

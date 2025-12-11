// lib/intygParsers/parse_2015_bilaga3.ts
import type { ParsedIntyg } from "./types";
import type { OcrWord } from "@/lib/ocr";
import {
  extractDelmalCodes, extractPersonnummer, extractFullNameBlock,
  extractSpecialty, extractSubjectAfterLabel, extractBlockAfterLabel,
  extractClinicAndPeriodFromLine, fallbackPeriod
} from "./common";

export function parse_2015_bilaga3(text: string, words?: OcrWord[]): ParsedIntyg {
  const kind = "2015-B3-AUSK";
  const delmalCodes = extractDelmalCodes(text);
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

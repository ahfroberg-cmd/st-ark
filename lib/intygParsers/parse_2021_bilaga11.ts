// lib/intygParsers/parse_2021_bilaga11.ts
import type { ParsedIntyg } from "./types";
import type { OcrWord } from "@/lib/ocr";
import {
  extractDelmalCodes, extractPersonnummer, extractFullNameBlock,
  extractSpecialty, extractSubjectAfterLabel, extractBlockAfterLabel, fallbackPeriod
} from "./common";

export function parse_2021_bilaga11(text: string, words?: OcrWord[]): ParsedIntyg {
  const kind = "2021-B11-UTV";
  const delmalCodes = extractDelmalCodes(text);
  const { fullName, firstName, lastName } = extractFullNameBlock(text);
  const personnummer = extractPersonnummer(text);
  const specialtyHeader = extractSpecialty(text);

  const subject = extractSubjectAfterLabel(text, /Utvecklingsarbetets ämne/i);
  const description = extractBlockAfterLabel(text, /Beskrivning av ST-läkarens deltagande/i);
  const period = fallbackPeriod(text);

  return { kind, fullName, firstName, lastName, personnummer, specialtyHeader, delmalCodes, subject, description, period };
}

// lib/intygParsers/parse_2015_bilaga6.ts
import type { ParsedIntyg } from "./types";
import {
  extractDelmalCodes, extractPersonnummer, extractFullNameBlock,
  extractSpecialty, extractSubjectAfterLabel, extractBlockAfterLabel, fallbackPeriod
} from "./common";

export function parse_2015_bilaga6(text: string): ParsedIntyg {
  const kind = "2015-B6-UTV";
  const delmalCodes = extractDelmalCodes(text);
  const { fullName, firstName, lastName } = extractFullNameBlock(text);
  const personnummer = extractPersonnummer(text);
  const specialtyHeader = extractSpecialty(text);

  const subject = extractSubjectAfterLabel(text, /Utvecklingsarbetets ämne/i);
  const description = extractBlockAfterLabel(text, /Beskrivning/i);
  const period = fallbackPeriod(text);

  return { kind, fullName, firstName, lastName, personnummer, specialtyHeader, delmalCodes, subject, description, period };
}

// lib/intygParsers/parse_2021_bilaga9.ts
import type { ParsedIntyg } from "./types";
import {
  extractDelmalCodes, extractPersonnummer, extractFullNameBlock,
  extractSpecialty, extractBlockAfterLabel, extractClinicAndPeriodFromLine, fallbackPeriod
} from "./common";

export function parse_2021_bilaga9(text: string): ParsedIntyg {
  const kind = "2021-B9-KLIN";
  const delmalCodes = extractDelmalCodes(text);
  const { fullName, firstName, lastName } = extractFullNameBlock(text);
  const personnummer = extractPersonnummer(text);
  const specialtyHeader = extractSpecialty(text);

  const clinicLine = matchLine(text, /(Tjänstgöringsställe|klinisk tjänstgöring)/i);
  const { clinic, period } = extractClinicAndPeriodFromLine(clinicLine);
  const description = extractBlockAfterLabel(text, /Beskrivning av den kliniska tjänstgöringen/i);

  return { kind, fullName, firstName, lastName, personnummer, specialtyHeader,
    delmalCodes, clinic, period: period ?? fallbackPeriod(text), description };
}

function matchLine(text: string, re: RegExp): string {
  const m = text.split(/\r?\n/).find(l => re.test(l));
  return m ?? "";
}

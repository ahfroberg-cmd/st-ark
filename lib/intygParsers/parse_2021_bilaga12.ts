// lib/intygParsers/parse_2021_bilaga12.ts
import type { ParsedIntyg } from "./types";
import type { OcrWord } from "@/lib/ocr";
import {
  extractPersonnummer, extractFullNameBlock, extractSpecialty,
  extractBlockAfterLabel
} from "./common";

export function parse_2021_bilaga12(text: string, words?: OcrWord[]): ParsedIntyg {
  const kind = "2021-B12-STa3";
  const { fullName, firstName, lastName } = extractFullNameBlock(text);
  const personnummer = extractPersonnummer(text);
  const specialtyHeader = extractSpecialty(text);

  const description = extractBlockAfterLabel(text, /Utbildningsaktiviteter som sökanden genomfört/i);
  const verification = extractBlockAfterLabel(text, /Hur det kontrollerats/i);

  return {
    kind, fullName, firstName, lastName, personnummer, specialtyHeader,
    subject: undefined,
    description: [description, verification].filter(Boolean).join("\n\n") || undefined
  };
}

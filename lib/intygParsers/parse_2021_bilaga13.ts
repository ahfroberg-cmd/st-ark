// lib/intygParsers/parse_2021_bilaga13.ts
import type { ParsedIntyg } from "./types";
import type { OcrWord } from "@/lib/ocr";
import {
  extractDelmalCodes,
  extractPersonnummer,
  extractFullNameBlock,
  extractSpecialty,
  extractBlockAfterLabel,
  fallbackPeriod,
} from "./common";

/**
 * HSLF-FS 2021:8 – Bilaga 13
 * "Delmål för specialistläkare från tredjeland"
 * Vi extraherar namn, personnummer, specialitet, delmåls-koder,
 * samt två större textblock:
 *  - Utbildningsaktiviteter som sökanden genomfört
 *  - Hur uppfyllelse kontrollerats
 */
export function parse_2021_bilaga13(text: string, words?: OcrWord[]): ParsedIntyg {
  const kind = "2021-B13-TREDJELAND";

  const delmalCodes = extractDelmalCodes(text);
  const { fullName, firstName, lastName } = extractFullNameBlock(text);
  const personnummer = extractPersonnummer(text);
  const specialtyHeader = extractSpecialty(text);

  const activities = extractBlockAfterLabel(text, /Utbildningsaktiviteter som sökanden genomfört/i);
  const verification = extractBlockAfterLabel(text, /Hur det kontrollerats/i);

  const description = [activities, verification].filter(Boolean).join("\n\n") || undefined;
  const period = fallbackPeriod(text); // om datum råkar finnas i fri text

  return {
    kind,
    fullName,
    firstName,
    lastName,
    personnummer,
    specialtyHeader,
    delmalCodes,
    description,
    period,
  };
}

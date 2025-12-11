// lib/intygParsers/parse_2021_bilaga9.ts
import type { ParsedIntyg } from "./types";
import type { OcrWord } from "@/lib/ocr";
import {
  extractDelmalCodes, extractPersonnummer, extractFullNameBlock,
  extractSpecialty, extractBlockAfterLabel, extractClinicAndPeriodFromLine, 
  fallbackPeriod, extractPeriodFromZoneText
} from "./common";
import { extractZonesFromWords, zones_2021_B9_KLIN } from "@/lib/ocr";

export function parse_2021_bilaga9(text: string, words?: OcrWord[]): ParsedIntyg {
  const kind = "2021-B9-KLIN";
  
  // Använd zonlogik om words finns (direktfotograferat dokument)
  if (words && words.length > 0) {
    // Zoner är definierade för 1057×1496 px (A4-format för 2021-intyg)
    const zones = extractZonesFromWords(words, zones_2021_B9_KLIN, { width: 1057, height: 1496 });
    
    // Kombinera förnamn och efternamn
    const firstName = zones.applicantFirstName?.trim() || "";
    const lastName = zones.applicantLastName?.trim() || "";
    const fullName = `${lastName} ${firstName}`.trim() || undefined;
    
    // Extrahera personnummer från zon
    const personnummer = zones.personnummer?.trim().replace(/\s+/g, "") || undefined;
    
    // Extrahera delmål från zon
    const delmalCodes = extractDelmalCodes(zones.delmal || "");
    
    // Extrahera period från period-zon
    const period = extractPeriodFromZoneText(zones.period || "");
    
    // Extrahera klinik från clinic-zon
    const clinic = zones.clinic?.trim() || undefined;
    
    // Beskrivning från description-zon
    const description = zones.description?.trim() || undefined;
    
    // Handledare-information
    const supervisorName = zones.supervisorNamePrinted?.trim() || undefined;
    const supervisorSpeciality = zones.supervisorSpecialty?.trim() || undefined;
    const supervisorSite = zones.supervisorSite?.trim() || undefined;
    
    // Specialitet
    const specialtyHeader = zones.specialty?.trim() || undefined;
    
    return {
      kind,
      fullName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      personnummer,
      specialtyHeader,
      delmalCodes: delmalCodes.length > 0 ? delmalCodes : undefined,
      clinic,
      period: period || fallbackPeriod(text),
      description,
      supervisorName,
      supervisorSpeciality,
      supervisorSite,
    };
  }
  
  // Fallback till smart logik om inga words finns (bakåtkompatibilitet)
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

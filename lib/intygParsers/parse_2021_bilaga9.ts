// lib/intygParsers/parse_2021_bilaga9.ts
import type { ParsedIntyg } from "./types";
import type { OcrWord } from "@/lib/ocr";
import {
  extractDelmalCodes, extractPersonnummer, extractFullNameBlock,
  extractSpecialty, extractBlockAfterLabel, extractClinicAndPeriodFromLine, 
  fallbackPeriod, extractPeriodFromZoneText
} from "./common";
import { extractZonesFromWords, zones_2021_B9_KLIN } from "@/lib/ocr";

export function parse_2021_bilaga9(text: string, words?: OcrWord[], zonesFromImage?: Record<string, string>): ParsedIntyg {
  const kind = "2021-B9-KLIN";

  // 1) Rubrik-baserad parsing (funkar väldigt bra för OCR.space-texter där rubrikerna ligger på egna rader)
  // Kör först och använd den om vi får en "hög" träffsäkerhet.
  const headingParsed = parseByHeadings(text);
  if (headingParsed) return headingParsed;
  
  // Använd zonlogik om words finns (direktfotograferat dokument) eller om zonesFromImage finns (OpenCV-baserad)
  let zones: Record<string, string> = {};
  
  if (zonesFromImage) {
    // Använd OpenCV-baserade zoner direkt
    zones = zonesFromImage;
  } else if (words && words.length > 0) {
    // Zoner är definierade för 1057×1496 px (A4-format för 2021-intyg)
    zones = extractZonesFromWords(words, zones_2021_B9_KLIN, { width: 1057, height: 1496 });
  }
  
  if (Object.keys(zones).length > 0) {
    
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

function parseByHeadings(raw: string): ParsedIntyg | null {
  const kind = "2021-B9-KLIN";
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");

  const isLabel = (line: string, labels: string[]) => {
    const nl = norm(line);
    return labels.some((x) => nl === norm(x) || nl.startsWith(norm(x)));
  };

  const findLabelIndex = (labels: string[], start = 0) => {
    for (let i = Math.max(0, start); i < lines.length; i++) {
      if (isLabel(lines[i], labels)) return i;
    }
    return -1;
  };

  const takeValueAfter = (idx: number, stopLabels: string[] = []) => {
    if (idx < 0) return undefined;
    // Inline: "Efternamn: Fröberg"
    const line = lines[idx];
    for (const lab of stopLabels) {
      // no-op: stopLabels används nedan
      void lab;
    }
    const parts = line.split(/:\s*/);
    if (parts.length >= 2) {
      const v = parts.slice(1).join(":").trim();
      if (v) return v;
    }
    // Next non-empty, but not another label
    for (let j = idx + 1; j < lines.length; j++) {
      const v = lines[j].trim();
      if (!v) continue;
      if (stopLabels.length && stopLabels.some((lab) => isLabel(v, [lab]))) return undefined;
      return v;
    }
    return undefined;
  };

  const labelEfternamn = ["Efternamn"];
  const labelFornamn = ["Förnamn", "Fornamn", "Fömamn", "Fomamn"];
  const labelPersonnummer = ["Personnummer"];
  const labelSpecialitet = ["Specialitet som ansökan avser", "Specialitet som ansokan avser"];
  const labelDelmal = ["Delmål som intyget avser", "Delmal som intyget avser"];
  const labelClinic = [
    "Tjänstgöringsställe för klinisk tjänstgöring",
    "Tjanstgoringsstalle for klinisk tjanstgoring",
    "Tjänstgöringsställe",
    "Tjanstgoringsstalle",
  ];
  const labelDescBlock = [
    "Beskrivning av den kliniska tjänstgöringen",
    "Beskrivning av den kliniska tjanstgoringen",
  ];
  const labelDesc = ["Beskrivning"];
  const labelPeriod = ["Period"];
  const labelSupervisorName = ["Namnförtydligande", "Namnfortydligande"];
  const labelSupervisorSpec = ["Specialitet"];
  const labelSupervisorSite = ["Tjänsteställe", "Tjanstestalle"];
  const labelOrtDatum = ["Ort och datum", "Ort o datum"];

  // Snabb sanity: om vi inte ens ser några av rubrikerna, kör inte.
  const hasAny =
    findLabelIndex(labelEfternamn) >= 0 ||
    findLabelIndex(labelFornamn) >= 0 ||
    findLabelIndex(labelDelmal) >= 0 ||
    findLabelIndex(labelClinic) >= 0;
  if (!hasAny) return null;

  // Personnummer: välj första matchen i texten (brukar vara sökanden)
  const personnummer = extractPersonnummer(lines.join("\n"));

  const lastName = takeValueAfter(findLabelIndex(labelEfternamn));
  const firstName = takeValueAfter(findLabelIndex(labelFornamn));
  const fullName =
    `${(lastName || "").trim()} ${(firstName || "").trim()}`.trim() || undefined;

  const specialtyHeader = takeValueAfter(findLabelIndex(labelSpecialitet));

  // Delmål: samla rader efter label tills nästa stora label
  const delIdx = findLabelIndex(labelDelmal);
  let delmalCodes: string[] | undefined = undefined;
  if (delIdx >= 0) {
    const stop = [
      ...labelClinic,
      ...labelDescBlock,
      ...labelPeriod,
      ...labelSupervisorName,
      "Intygsutfärdande",
      "Namnteckning",
      "Bilaga",
    ];
    const buff: string[] = [];
    for (let i = delIdx + 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) break;
      if (stop.some((s) => isLabel(l, [s]) || norm(l).includes(norm(s)))) break;
      buff.push(l);
    }
    const codes = extractDelmalCodes(buff.join(" "));
    if (codes.length) delmalCodes = codes;
  }

  const clinic = takeValueAfter(findLabelIndex(labelClinic));

  // Description: från "Beskrivning av ..." eller "Beskrivning" tills Period/handledare
  let description: string | undefined = undefined;
  const descIdx = findLabelIndex(labelDescBlock);
  const descStart = descIdx >= 0 ? descIdx : findLabelIndex(labelDesc);
  if (descStart >= 0) {
    const stop = [
      ...labelPeriod,
      ...labelSupervisorName,
      ...labelOrtDatum,
      "Intygsutfärdande",
      "Namnteckning",
      "Bilaga",
    ];
    const buff: string[] = [];
    for (let i = descStart + 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) break;
      // skip om OCR har en extra "Beskrivning"-rubrik efter blockrubriken
      if (isLabel(l, labelDesc) && i === descStart + 1) continue;
      if (stop.some((s) => isLabel(l, [s]) || norm(l).includes(norm(s)))) break;
      // undvik att bara fånga repetitiva rubriker
      if (isLabel(l, labelDescBlock)) continue;
      buff.push(l);
    }
    const cleaned = buff.join("\n").trim();
    if (cleaned) description = cleaned;
  }

  // Period: efter label Period – plocka nästa rad med datum och kör extractPeriodFromZoneText
  let period = undefined as { startISO?: string; endISO?: string } | undefined;
  const pIdx = findLabelIndex(labelPeriod);
  if (pIdx >= 0) {
    let candidate: string | undefined;
    for (let i = pIdx + 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      // hittat datumlik rad
      if (/\d{2,4}\D?\d{2}\D?\d{2}/.test(l)) {
        candidate = l;
        break;
      }
      if (isLabel(l, [...labelSupervisorName, ...labelOrtDatum])) break;
    }
    if (candidate) {
      period = extractPeriodFromZoneText(candidate) || undefined;
    }
  }

  // Supervisor: leta efter Namnförtydligande och ta rader efter
  const supIdx = findLabelIndex(labelSupervisorName);
  const supervisorName = supIdx >= 0 ? takeValueAfter(supIdx) : undefined;
  const supervisorSpeciality =
    supIdx >= 0 ? takeValueAfter(findLabelIndex(labelSupervisorSpec, supIdx + 1)) : undefined;
  const supervisorSite =
    supIdx >= 0 ? takeValueAfter(findLabelIndex(labelSupervisorSite, supIdx + 1)) : undefined;

  // Confidence: vi kräver minst 4 tydliga träffar innan vi “tar över”
  const score =
    (fullName ? 1 : 0) +
    (personnummer ? 1 : 0) +
    (specialtyHeader ? 1 : 0) +
    (clinic ? 1 : 0) +
    (period?.startISO || period?.endISO ? 1 : 0) +
    (delmalCodes?.length ? 1 : 0) +
    (supervisorName ? 1 : 0);

  if (score < 4) return null;

  return {
    kind,
    fullName,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    personnummer: personnummer || undefined,
    specialtyHeader: specialtyHeader || undefined,
    delmalCodes,
    clinic: clinic || undefined,
    period: period || fallbackPeriod(raw),
    description: description || extractBlockAfterLabel(raw, /Beskrivning av den kliniska tjänstgöringen/i),
    supervisorName: supervisorName || undefined,
    supervisorSpeciality: supervisorSpeciality || undefined,
    supervisorSite: supervisorSite || undefined,
  };
}

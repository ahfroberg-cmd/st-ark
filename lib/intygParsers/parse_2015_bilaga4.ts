import { extractCommon, normalizeOcrText } from "../fieldExtract";

export type ParsedKlinisk2015 = ReturnType<typeof extractCommon> & {
  type: "PLACEMENT";
  clinic?: string;
  description?: string;
  // Extra från intygsbotten
  supervisorName?: string;
  supervisorSpeciality?: string;
  supervisorSite?: string;
  cityDateRaw?: string; // t.ex. "Göteborg 2019-09-13"
  // Extra från header
  firstName?: string;
  lastName?: string;
  specialtyHeader?: string;
};

export function parse_2015_bilaga4(raw: string): ParsedKlinisk2015 {
  const text = raw;                          // behåll originalet för UI
  const t = normalizeOcrText(raw);           // normaliserat för regex
  const base = extractCommon(text);

  // 1) Beskrivning = från "Beskrivning..." till före "Intygande"
  const desc = sliceBetween(text,
    /Beskrivning av den kliniska tjänstgöringen/i,
    /Intygande/i
  )?.trim();

  // 2) Tjänstgöringsställe (tolerant mot OCR-varianter)
  const clinicNorm = (t.match(/tjanstgoringsstal{1,2}e.*?:\s*(.+?)(?: ort och datum| beskrivning| intygande|$)/i) || [])[1];
  const clinic = cleanupLine(clinicNorm);

  // 3) Handledare-blocket längst ned
  const supervisorSpeciality = cleanupLine((t.match(/handledare .*? specialitet\s*([a-z ]{2,40})/i) || [])[1]);
  const supervisorSite       = cleanupLine((t.match(/tjanstestalle\s*([^]+?) ort och datum/i) || [])[1]);
  const cityDateRaw          = cleanupLine((t.match(/ort och datum\s*([^\n]+?)\s+(namnfor tydligande|namnfortydligande|$)/i) || [])[1]);
  const supervisorName       = cleanupLine(
    (t.match(/namnfor tydligande\s*([^\n]+)/i) || [])[1] ||
    (t.match(/namnfortydligande\s*([^\n]+)/i) || [])[1]
  );

  // 4) Header: Efternamn/Förnamn/Specialitet som ansökan avser
  const lastName        = cleanupLine((t.match(/\befternamn\s*([^\n]+)/i) || [])[1]);
  const firstName       = cleanupLine((t.match(/\bfornamn\s*([^\n]+)/i) || [])[1]);
  const specialtyHeader = cleanupLine((t.match(/specialitet som ansokan avser\s*([^\n]+)/i) || [])[1]);

  return {
    ...base,
    type: "PLACEMENT",
    clinic,
    description: cleanupMultiline(desc),
    supervisorName,
    supervisorSpeciality,
    supervisorSite,
    cityDateRaw,
    firstName,
    lastName,
    specialtyHeader,
  };
}

function sliceBetween(src: string, startRx: RegExp, endRx: RegExp): string | undefined {
  const s = src.search(startRx);
  if (s < 0) return undefined;
  const after = src.slice(s);
  const e = after.search(endRx);
  return e < 0 ? after.replace(startRx, "") : after.slice(0, e).replace(startRx, "");
}

function cleanupLine(s?: string) { return s?.replace(/\s+/g, " ").trim() || undefined; }
function cleanupMultiline(s?: string) {
  if (!s) return undefined;
  return s
    .replace(/\s+\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

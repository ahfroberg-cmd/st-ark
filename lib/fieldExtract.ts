export type ExtractedCommon = {
  personnummer?: string;
  period?: { startISO?: string; endISO?: string };
  delmalCodes?: string[];
};

export function extractCommon(raw: string): ExtractedCommon {
  const t = normalizeOcrText(raw);

  // Personnummer: 10 eller 12 siffror, tillåt -, +, mellanslag
  const personnummer = (t.match(/\b(\d{6}|\d{8})[-+ ]?\d{4}\b/) || [])[0];

  // Period: stöd för 180301–180731, 2018-03-01 – 2018-07-31, 2018.03.01—2018.07.31
  const period = extractFlexiblePeriod(t);

  // Delmål: STa1/STb2/STc3 samt a1/b2/c3, tolerera kommatecken och mellanslag
  const delmal = Array.from(new Set([
    ...Array.from(t.matchAll(/\bST[abc]\d+\b/gi)).map(m => m[0].toUpperCase()),
    ...Array.from(t.matchAll(/\b([abc])\s?(\d+)\b/gi)).map(m => (m[1] + m[2]).toLowerCase()),
  ]));

  return { personnummer, period, delmalCodes: delmal };
}

/** Normalisera vanliga OCR-avvikelser: streck, whitespace, punkt-/kolontecken */
export function normalizeOcrText(s: string): string {
  return s
    .normalize("NFKC")
    // Normalisera OCR-fel: "Fömamn" -> "Förnamn", "Eftemamn" -> "Efternamn"
    .replace(/\bFömamn\b/gi, "Förnamn")
    .replace(/\bEftemamn\b/gi, "Efternamn")
    .replace(/\bfömamn\b/gi, "Förnamn")
    .replace(/\beftemamn\b/gi, "Efternamn")
    // unify dashes (minus, en-dash, em-dash → "-")
    .replace(/[-–—]/g, "-")
    // kolon/punktvarianter i rubriker
    .replace(/[：]/g, ":")
    // flera whitespace → ett
    .replace(/\s+/g, " ")
    .trim();
}


/** Plocka period robust från flera format */
export function extractFlexiblePeriod(t: string): { startISO?: string; endISO?: string } {
  // 2018-03-01 - 2018-07-31 | 2018.03.01 - 2018.07.31 | 180301-180731
  const rx = /\b(\d{2}(?:\d{2})?)[.\-\/]?(\d{2})[.\-\/]?(\d{2})\s*-\s*(\d{2}(?:\d{2})?)[.\-\/]?(\d{2})[.\-\/]?(\d{2})\b/;
  const m = t.match(rx);
  if (!m) return {};
  const s = makeISO(m[1], m[2], m[3]);
  const e = makeISO(m[4], m[5], m[6]);
  return { startISO: s, endISO: e };
}

function makeISO(y: string, mo: string, d: string): string {
  // y kan vara 2 eller 4 siffror
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${mo}-${d}`;
}

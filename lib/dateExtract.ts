// lib/dateExtract.ts
// Robust datumextraktion och städning av "Tjänstgöringsställe".

// Tillåt kombinationer av ., -, / och MELLANSLAG mellan komponenterna.
// Exempel som stöds: 2018-03-02, 2018.03.02, 2018. 03. 02, 2018 03 02, 3/2-18, 03-02-2018, 3. 2. 2018
const SEP = "[.\\/\\-\\s]+";                        // minst en separator (punkt/streck/slash/space)
const RANGE = "(?:[–—\\-−]|till|to)";               // en-dash, em-dash, minus, eller ord
const YMD = String.raw`\b(\d{4})${SEP}(\d{1,2})${SEP}(\d{1,2})\b`;
const DMY = String.raw`\b(\d{1,2})${SEP}(\d{1,2})${SEP}(\d{2,4})\b`;
const DATE_TOKEN = `(?:${YMD}|${DMY})`;

export function extractDates(text: string): { startISO?: string; endISO?: string } {
  const results: string[] = [];
  const re = new RegExp(DATE_TOKEN, "g");

  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const iso = toIsoFromMatch(m);
    if (iso) results.push(iso);
  }
  return { startISO: results[0], endISO: results[1] };
}

/** Flytta datum/intervallet ur en klinikrad och lämna endast själva stället. */
export function splitClinicAndPeriod(line: string): {
  clean: string;
  startISO?: string;
  endISO?: string;
} {
  let s = line || "";

  // 1) Försök först hitta ett intervall "datum RANGE datum"
  const intervalRe = new RegExp(`(${DATE_TOKEN})\\s*${RANGE}\\s*(${DATE_TOKEN})`, "i");
  const mi = intervalRe.exec(s);
  if (mi) {
    const startISO = toIsoFromMatch(mi as unknown as RegExpExecArray, /*groupIndexOffset*/1);
    const endISO   = toIsoFromMatch(mi as unknown as RegExpExecArray, /*groupIndexOffset*/0, /*second*/ true);
    // Ta bort hela matchen ur kliniksträngen
    const cleaned = tidyClinic(s.replace(mi[0], " "));
    return { clean: cleaned, startISO, endISO };
  }

  // 2) Annars: plocka ut upp till två datum var som helst och ta bort dem från strängen
  const dates = extractDates(s);
  const anyDate = new RegExp(DATE_TOKEN, "g");
  const cleaned = tidyClinic(s.replace(anyDate, " ").replace(new RegExp(`\\s*${RANGE}\\s*`, "g"), " "));
  return { clean: cleaned, startISO: dates.startISO, endISO: dates.endISO };
}

// ---- Hjälpare ----
function toIsoFromMatch(m: RegExpExecArray, groupIndexOffset = 0, second = false): string | undefined {
  // Match-strukturen kan vara YMD eller DMY pga alternation; hitta vilka grupper som slog.
  // Vi itererar över grupperna tre och tre och plockar den första tripeln som inte är undefined.
  // För intervallmatchningen finns två datum; 'second' styr om vi tar den andra tripeln.
  const triples: Array<[number, number, number]> = [];
  const vals = m.slice(1); // hoppa över index 0 (hela matchen)
  for (let i = 0; i + 2 < vals.length; i += 3) {
    const a = vals[i], b = vals[i + 1], c = vals[i + 2];
    if (a !== undefined && b !== undefined && c !== undefined) {
      triples.push([Number(a), Number(b), Number(c)]);
    }
  }
  if (!triples.length) return undefined;

  const idx = second ? 1 : 0;
  const [x, y, z] = triples[idx] ?? triples[0];

  // Försök avgöra om det var YMD (a=YYYY) eller DMY (c=YY/YYYY)
  let year: number, month: number, day: number;
  if (String(x).length === 4) {
    // YMD
    year = x; month = y; day = z;
  } else {
    // DMY
    day = x; month = y; year = z;
    if (year < 100) year += year < 50 ? 2000 : 1900;
  }

  if (!validYMD(year, month, day)) return undefined;
  return toISO(year, month, day);
}

function tidyClinic(x: string): string {
  return x
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[.,;:–—\-−]+\s*$/g, "")  // ta bort avslutande skiljetecken
    .trim();
}

function validYMD(y: number, m: number, d: number): boolean {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
  const mdays = [31, (isLeap(y) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= mdays[m - 1];
}
function isLeap(y: number) { return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0); }
function toISO(y: number, m: number, d: number) {
  return `${y.toString().padStart(4,"0")}-${m.toString().padStart(2,"0")}-${d.toString().padStart(2,"0")}`;
}

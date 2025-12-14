export type IntygKind =
  | "2015-B3-AUSK"
  | "2015-B4-KLIN"
  | "2015-B5-KURS"
  | "2015-B6-UTV"
  | "2015-B7-SKRIFTLIGT"
  | "2021-B5-ANS"
  | "2021-B6-FULLST"
  | "2021-B7-UPPN"
  | "2021-B8-AUSK"
  | "2021-B9-KLIN"
  | "2021-B10-KURS"
  | "2021-B11-UTV"
  | "2021-B12-STa3"
  | "2021-B13-TREDJELAND"
  | null;

type Detected = { kind: IntygKind; reason: string };

function asciiSoft(s: string) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[åÅ]/g, "a")
    .replace(/[äÄ]/g, "a")
    .replace(/[öÖ]/g, "o")
    .replace(/[-–—]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function score(has: boolean, pts = 1) { return has ? pts : 0; }

function best(cands: Array<{ kind: IntygKind; sc: number; why: string }>): Detected {
  cands.sort((a, b) => b.sc - a.sc);
  const top = cands[0];
  return { kind: (top?.sc || 0) > 0 ? top.kind : null, reason: top ? top.why : "no candidates" };
}

export function detectIntygKind(raw: string): Detected {
  const s = asciiSoft(raw);
  const has = (re: RegExp) => re.test(s);
  const incl = (t: string) => s.includes(t);

  // Grova markörer
  const is2015 = has(/\bsosfs\s*2015[:\s]*8\b/) || has(/\b2015:8\b/);
  const is2021 = has(/\b2021-2-7212\b/) || has(/\bbilaga\s+\d{1,2}\b/);

  // Bilaganummer om tryckt
  const mBil = s.match(/\bbilaga\s+(\d{1,2})\b/);
  const bilNum = mBil ? parseInt(mBil[1], 10) : null;

  // Vanliga nyckelord (ASCII-mappade)
  const kAUSK = has(/\bauskultation\b/);
  const kB8 = has(/\bbilaga\s+8\b/i);
  const kKLIN = has(/\bklinisk[a]?\s+tjanstgor/);
  const kKURS = has(/\bkurs(?!plan)\b/);
  const kUTV  = has(/\bkvalitets[- ]?|\butvecklingsarbet|\bdeltagande\s+i\s+utvecklingsarbete/);
  const kSKR  = has(/\bskriftligt\s+arbete\b|\bvetenskapligt\s+arbete\b/);
  const kSTa3 = has(/\bsta?\s*3\b|\bst a\s*3\b/);
  const kTL   = has(/\btredje\s*land\b|\btredjeland\b|\beu\/ees.*utanf/);

  if (is2015) {
    const cands = [
      { kind: "2015-B7-SKRIFTLIGT", sc: score(kSKR, 3) + score(has(/\btitel\b/)) + score(has(/\bhandledare\b/)), why: "2015 + (skriftligt arbete)" },
      { kind: "2015-B4-KLIN",       sc: score(kKLIN, 2) + score(has(/\bbeskrivning\s+av\s+(den\s+)?(kliniska\s+)?tjanstgor/)), why: "2015 + (klinisk tjänstgöring)" },
      { kind: "2015-B5-KURS",       sc: score(kKURS, 2) + score(has(/\bintygas?\b|\bkurstid\b/)), why: "2015 + (kurs)" },
      { kind: "2015-B6-UTV",        sc: score(kUTV, 2) + score(has(/\bsyfte\b|\bmetod\b|\bresultat\b/)), why: "2015 + (kvalitets-/utvecklingsarbete)" },
      { kind: "2015-B3-AUSK",       sc: score(kAUSK, 2), why: "2015 + (auskultation)" },
    ];
    return best(cands);
  }

  if (is2021) {
    // Direkt via bilaga-numret om OCR plockat det
    if (bilNum) {
      const map: Record<number, IntygKind> = {
        5: "2021-B5-ANS",
        6: "2021-B6-FULLST",
        7: "2021-B7-UPPN",
        8: "2021-B8-AUSK",
        9: "2021-B9-KLIN",
        10: "2021-B10-KURS",
        11: "2021-B11-UTV",
        12: "2021-B12-STa3",
        13: "2021-B13-TREDJELAND",
      };
      const byNo = map[bilNum] ?? null;
      if (byNo) return { kind: byNo, reason: `2021 + bilaga ${bilNum}` };
    }

    // Nyckelordsfallback
    const cands = [
      { kind: "2021-B8-AUSK",        sc: score(kAUSK, 3) + score(kB8, 2), why: "2021 + (auskultation + bilaga 8)" },
      { kind: "2021-B9-KLIN",        sc: score(kKLIN, 3) + score(has(/\bbeskrivning\s+av\s+(den\s+)?(kliniska\s+)?tjanstgor/)), why: "2021 + (klinisk tjänstgöring)" },
      { kind: "2021-B10-KURS",       sc: score(kKURS, 3) + score(has(/\bintygas?\b|\bkurstid\b/)), why: "2021 + (kurs)" },
      { kind: "2021-B11-UTV",        sc: score(kUTV, 3) + score(has(/\bdeltagande\s+i\s+utvecklingsarbete/)), why: "2021 + (deltagande i utvecklingsarbete)" },
      { kind: "2021-B12-STa3",       sc: score(kSTa3, 3), why: "2021 + (ST a3)" },
      { kind: "2021-B13-TREDJELAND", sc: score(kTL, 3),  why: "2021 + (tredjeland)" },
      // admin-blad (om du faktiskt vill att de ska auto-klassas)
      { kind: "2021-B5-ANS",         sc: score(has(/\bansokan\b/)) + score(has(/\bspecialistkompetens\b/)), why: "2021 + (ansökan)" },
      { kind: "2021-B6-FULLST",      sc: score(has(/\bfullstandighet\b/)) + score(has(/\bkontroll\b/)),    why: "2021 + (fullständighet)" },
      { kind: "2021-B7-UPPN",        sc: score(has(/\buppnad\s+specialistkompetens\b/)),                    why: "2021 + (uppnådd specialistkompetens)" },
    ];
    return best(cands);
  }

  // Om år saknas i OCR, gissa enbart på nyckelord
  const generic = best([
    { kind: "2015-B7-SKRIFTLIGT", sc: score(kSKR, 2), why: "generic (skriftligt arbete)" },
    { kind: "2015-B4-KLIN",       sc: score(kKLIN, 2), why: "generic (klinisk tjänstgöring)" },
    { kind: "2015-B5-KURS",       sc: score(kKURS, 2), why: "generic (kurs)" },
    { kind: "2015-B6-UTV",        sc: score(kUTV, 2),  why: "generic (kvalitets-/utvecklingsarbete)" },
    { kind: "2015-B3-AUSK",       sc: score(kAUSK, 2), why: "generic (auskultation)" },
    { kind: "2021-B12-STa3",      sc: score(kSTa3, 2), why: "generic (ST a3)" },
    { kind: "2021-B13-TREDJELAND",sc: score(kTL,  2),  why: "generic (tredjeland)" },
  ]);

  return generic;
}

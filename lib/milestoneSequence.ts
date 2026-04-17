// Milestone ordering to keep codes in consistent “follow after each other” order.
//
// Expected examples:
//  - BT: BT1, BT2 … (first)
//  - 2015: a1, a2, b1, b2, c1, c2 … (A then B then C, numbers ascending within each letter)
//  - 2021: STa1, STa2, STb1, STb2, STc1, STc2 … (after plain a/b/c codes when both exist, e.g. METIS)
//  - Unknown codes last, lexicographically
export function sortMilestoneIds(ids: string[]): string[] {
  const norm = (v: string) => String(v ?? "").trim();
  const compact = (raw: string) =>
    norm(raw).toUpperCase().replace(/[\s\-_]+/g, "");

  const letterRank: Record<string, number> = { A: 1, B: 2, C: 3 };

  const key = (raw: string) => {
    const up = compact(raw);

    // BT: always “BT” + number
    const bt = up.match(/^BT0*(\d+)$/i);
    if (bt) {
      return { cat: 0, letter: 0, num: parseInt(bt[1], 10) || 0, raw: up };
    }

    // 2015: letter + number (a1, b2, c3) — before ST* so lists like a1 + STa1 stay readable
    const ab = up.match(/^([ABC])(\d+)$/i);
    if (ab) {
      const letter = ab[1].toUpperCase();
      return { cat: 1, letter: letterRank[letter] ?? 99, num: parseInt(ab[2], 10) || 0, raw: up };
    }

    // 2021: ST + letter + number (STa1, STb2, STc3…)
    const st = up.match(/^ST([ABC])(\d+)$/i);
    if (st) {
      const letter = st[1].toUpperCase();
      return { cat: 2, letter: letterRank[letter] ?? 99, num: parseInt(st[2], 10) || 0, raw: up };
    }

    return { cat: 9, letter: 99, num: 0, raw: up };
  };

  return [...(ids || [])].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka.cat !== kb.cat) return ka.cat - kb.cat;
    if (ka.letter !== kb.letter) return ka.letter - kb.letter;
    if (ka.num !== kb.num) return ka.num - kb.num;
    return ka.raw.localeCompare(kb.raw);
  });
}


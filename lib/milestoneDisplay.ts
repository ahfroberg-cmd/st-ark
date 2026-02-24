export function displayMilestoneCode(code: unknown, goalsVersion?: unknown): string {
  const raw = String(code ?? "").trim();
  const v = String(goalsVersion ?? "");

  // BT: alltid versalt "BT" + nummer (t.ex. "BT1") oavsett målversion
  {
    const m = raw.match(/^BT\s*[-_\s]*0*(\d+)\b/i);
    if (m) return `BT${parseInt(m[1], 10) || 0}`;
  }

  // 2021: "ST" + gemen bokstav + siffra (t.ex. "STa1")
  if (v.includes("2021")) {
    const m1 = raw.match(/^ST([abc])\s*(\d+)$/i);
    if (m1) return `ST${m1[1].toLowerCase()}${m1[2]}`;

    const m2 = raw.match(/^([abc])\s*(\d+)$/i);
    if (m2) return `ST${m2[1].toLowerCase()}${m2[2]}`;

    const m3 = raw.match(/^([ABC])\s*(\d+)$/);
    if (m3) return `ST${m3[1].toLowerCase()}${m3[2]}`;
  }

  // 2015: gemener (t.ex. "a1", "b2", "c3")
  if (v.includes("2015")) {
    const m = raw.match(/^([abc])\s*(\d+)$/i);
    if (m) return `${m[1].toLowerCase()}${m[2]}`;
  }

  // Fallback: returnera gemener om det matchar mönstret
  const fallback = raw.match(/^([abc])\s*(\d+)$/i);
  if (fallback) return `${fallback[1].toLowerCase()}${fallback[2]}`;

  return raw;
}

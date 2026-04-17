export function displayMilestoneCode(code: unknown, goalsVersion?: unknown): string {
  const raw = String(code ?? "").trim();
  const compact = raw.replace(/[\s\-_]+/g, "");
  const v = String(goalsVersion ?? "");

  // BT: alltid versalt "BT" + nummer (t.ex. "BT1") oavsett målversion
  {
    const m = compact.match(/^BT0*(\d+)$/i);
    if (m) return `BT${parseInt(m[1], 10) || 0}`;
  }

  // 2021: "ST" + gemen bokstav + siffra (t.ex. "STa1")
  if (v.includes("2021")) {
    const m1 = compact.match(/^ST([abc])(\d+)$/i);
    if (m1) return `ST${m1[1].toLowerCase()}${m1[2]}`;

    const m2 = compact.match(/^([abc])(\d+)$/i);
    if (m2) return `ST${m2[1].toLowerCase()}${m2[2]}`;
  }

  // 2015: gemener (t.ex. "a1", "b2", "c3")
  if (v.includes("2015")) {
    const m =
      compact.match(/^([abc])(\d+)$/i) ||
      compact.match(/^ST([abc])(\d+)$/i);
    if (m) return `${m[1].toLowerCase()}${m[2]}`;
  }

  // Fallback: returnera gemener om det matchar mönstret
  const fallback =
    compact.match(/^([abc])(\d+)$/i) ||
    compact.match(/^ST([abc])(\d+)$/i);
  if (fallback) return `${fallback[1].toLowerCase()}${fallback[2]}`;

  return raw;
}

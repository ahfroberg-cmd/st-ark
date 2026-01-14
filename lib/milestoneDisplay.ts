export function displayMilestoneCode(code: unknown, goalsVersion?: unknown): string {
  const raw = String(code ?? "").trim();
  const v = String(goalsVersion ?? "");

  if (v.includes("2021")) {
    const m1 = raw.match(/^ST([abc])\s*(\d+)$/i);
    if (m1) return `ST${m1[1].toLowerCase()}${m1[2]}`;

    const m2 = raw.match(/^([abc])\s*(\d+)$/i);
    if (m2) return `ST${m2[1].toLowerCase()}${m2[2]}`;

    const m3 = raw.match(/^([ABC])\s*(\d+)$/);
    if (m3) return `ST${m3[1].toLowerCase()}${m3[2]}`;
  }

  return raw;
}

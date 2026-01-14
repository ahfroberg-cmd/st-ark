// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

export type MilestoneRequirements = {
  klin: boolean;
  kurs: boolean;
  arb: boolean;
};

export function milestoneRequires(m: any): MilestoneRequirements {
  const codeRaw = String(m?.code ?? m?.id ?? "");
  const codeNorm = codeRaw.trim().toUpperCase().replace(/\s+/g, "");
  const is2021 = codeNorm.startsWith("ST");

  // Hantera två format för sections:
  // 1. Array (A/B-delmål): [{ title: "Utbildningsaktiviteter", items: [...] }]
  // 2. Object (C-delmål): { utbildningsaktiviteter: [...] }
  let hay = "";

  const sections = m?.sections;
  if (Array.isArray(sections)) {
    // Format 1: Array med title/items
    const ua = sections.find((s) =>
      String(s?.title ?? "")
        .trim()
        .toLowerCase()
        .includes("utbildningsaktiviteter")
    );
    const rawItems: string[] = Array.isArray(ua?.items)
      ? ua.items.map((x: any) => String(x ?? ""))
      : [];
    const rawText = typeof ua?.text === "string" ? ua.text : "";
    hay = (rawItems.join("\n") + "\n" + rawText).toLowerCase();
  } else if (sections && typeof sections === "object") {
    // Format 2: Object med utbildningsaktiviteter som nyckel
    const ua = sections.utbildningsaktiviteter;
    if (Array.isArray(ua)) {
      hay = ua.map((x: any) => String(x ?? "")).join("\n").toLowerCase();
    } else if (typeof ua === "string") {
      hay = ua.toLowerCase();
    }
  }

  const kurs = /\bkurs(er)?\b/.test(hay) || (is2021 && codeNorm === "STA3");
  const klin = /(klinisk\s+tjänstgöring|klinisk\s+tjanstgoring|auskultation)/.test(hay);

  // Särskild önskan: 2021 STa2 och STa3 ska ha "Arb".
  const arb = is2021 && (codeNorm === "STA2" || codeNorm === "STA3");

  // Om vi inte kan tolka kraven säkert: visa båda (fail-open), för att inte råka dölja något.
  if (!kurs && !klin && !arb) return { klin: true, kurs: true, arb: true };

  return { klin, kurs, arb };
}

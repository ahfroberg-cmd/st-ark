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

  const sections: any[] = Array.isArray(m?.sections) ? m.sections : [];

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

  const hay = (rawItems.join("\n") + "\n" + rawText).toLowerCase();

  const kurs = /\bkurs(er)?\b/.test(hay);
  const klin = /(klinisk\s+tjänstgöring|klinisk\s+tjanstgoring|auskultation)/.test(hay);

  // Särskild önskan: 2021 STa2 och STa3 ska ha "Arb".
  const arb = is2021 && (codeNorm === "STA2" || codeNorm === "STA3");

  // Om vi inte kan tolka kraven säkert: visa båda (fail-open), för att inte råka dölja något.
  if (!kurs && !klin && !arb) return { klin: true, kurs: true, arb: true };

  return { klin, kurs, arb };
}

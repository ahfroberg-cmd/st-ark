// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

export type MilestoneRequirements = {
  klin: boolean;
  kurs: boolean;
};

export function milestoneRequires(m: any): MilestoneRequirements {
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

  // Om vi inte kan tolka kraven säkert: visa båda (fail-open), för att inte råka dölja något.
  if (!kurs && !klin) return { klin: true, kurs: true };

  return { klin, kurs };
}

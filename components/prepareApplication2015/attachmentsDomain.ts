"use client";

import type { Course, Placement } from "@/lib/types";

export type AttachGroup =
  | "Uppnådd specialistkompetens"
  | "Auskultationer"
  | "Kliniska tjänstgöringar under handledning"
  | "Kurser"
  | "Utvecklingsarbete"
  | "Vetenskapligt arbete"
  | "Uppfyllda kompetenskrav för specialistläkare från tredjeland"
  | "Uppnådd specialistkompetens för specialistläkare från tredjeland"
  | "Svensk doktorsexamen"
  | "Utländsk doktorsexamen"
  | "Utländsk tjänstgöring"
  | "Individuellt utbildningsprogram";

export type PresetKey =
  | "intyg"
  | "svDoc"
  | "foreignDocEval"
  | "foreignService"
  | "thirdCountry"
  | "individProg";

export type AttachmentItem = {
  id: string;
  type: AttachGroup;
  label: string;
  date?: string;
  preset?: PresetKey;
};

export const GROUP_ORDER: AttachGroup[] = [
  "Uppnådd specialistkompetens",
  "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
  "Uppnådd specialistkompetens för specialistläkare från tredjeland",
  "Auskultationer",
  "Kliniska tjänstgöringar under handledning",
  "Kurser",
  "Utvecklingsarbete",
  "Vetenskapligt arbete",
  "Svensk doktorsexamen",
  "Utländsk doktorsexamen",
  "Utländsk tjänstgöring",
  "Individuellt utbildningsprogram",
];

type Swatch = { bg: string; bd: string; pill: string; pillBd: string };

const GREY_BG = "hsl(220 14% 95%/.96)";
const GREY_BD = "hsl(220 12% 75%/.96)";
const GREY_PILL = "hsl(220 16% 98%/.96)";
const GREY_PILLBD = "hsl(220 10% 86%/.96)";

export const GROUP_COLORS: Record<AttachGroup, Swatch> = {
  "Uppnådd specialistkompetens": {
    bg: "hsl(12 35% 94%/.96)",
    bd: "hsl(12 25% 75%/.96)",
    pill: "hsl(12 40% 98%/.96)",
    pillBd: "hsl(12 23% 85%/.96)",
  },
  "Auskultationer": {
    bg: "hsl(30 35% 94%/.96)",
    bd: "hsl(30 25% 75%/.96)",
    pill: "hsl(30 40% 98%/.96)",
    pillBd: "hsl(30 23% 85%/.96)",
  },
  "Kliniska tjänstgöringar under handledning": {
    bg: "hsl(222 30% 94%/.96)",
    bd: "hsl(222 22% 72%/.96)",
    pill: "hsl(222 35% 98%/.96)",
    pillBd: "hsl(222 20% 84%/.96)",
  },
  "Kurser": {
    bg: "hsl(190 30% 94%/.96)",
    bd: "hsl(190 22% 72%/.96)",
    pill: "hsl(190 35% 98%/.96)",
    pillBd: "hsl(190 20% 84%/.96)",
  },
  "Utvecklingsarbete": {
    bg: "hsl(95 25% 94%/.96)",
    bd: "hsl(95 20% 72%/.96)",
    pill: "hsl(95 30% 98%/.96)",
    pillBd: "hsl(95 18% 84%/.96)",
  },
  "Vetenskapligt arbete": {
    bg: "hsl(265 25% 94%/.96)",
    bd: "hsl(265 20% 72%/.96)",
    pill: "hsl(265 30% 98%/.96)",
    pillBd: "hsl(265 18% 84%/.96)",
  },
  "Uppfyllda kompetenskrav för specialistläkare från tredjeland": {
    bg: "hsl(160 30% 94%/.96)",
    bd: "hsl(160 22% 72%/.96)",
    pill: "hsl(160 35% 98%/.96)",
    pillBd: "hsl(160 20% 84%/.96)",
  },
  "Uppnådd specialistkompetens för specialistläkare från tredjeland": {
    bg: "hsl(160 30% 94%/.96)",
    bd: "hsl(160 22% 72%/.96)",
    pill: "hsl(160 35% 98%/.96)",
    pillBd: "hsl(160 20% 84%/.96)",
  },
  "Svensk doktorsexamen": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Utländsk doktorsexamen": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Utländsk tjänstgöring": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Individuellt utbildningsprogram": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
};

function ts(iso?: string) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function classifyPlacement(p: any): { group: AttachGroup; labelFrom: string } {
  const t = `${p?.type ?? p?.kind ?? p?.category ?? ""}`.toLowerCase();
  const text = `${p?.clinic ?? ""} ${p?.note ?? ""}`.toLowerCase();

  if (t.includes("ausk") || text.includes("auskult")) {
    return { group: "Auskultationer", labelFrom: p.clinic || "—" };
  }
  if (t.includes("kvalit") || t.includes("utveck") || text.includes("kvalit")) {
    return { group: "Utvecklingsarbete", labelFrom: p.clinic || p.note || "—" };
  }
  if (t.includes("vetenskap") || text.includes("vetenskap")) {
    return { group: "Vetenskapligt arbete", labelFrom: p.clinic || p.note || "—" };
  }
  return { group: "Kliniska tjänstgöringar under handledning", labelFrom: p.clinic || "—" };
}

function pickPlacementDate(p: Placement): string {
  const raw: any = (p as any).endDate || (p as any).startDate || "";
  return raw ? String(raw).slice(0, 10) : "";
}

function pickCourseDate(c: Course): string {
  const raw: any = (c as any).certificateDate || (c as any).endDate || (c as any).startDate || "";
  return raw ? String(raw).slice(0, 10) : "";
}

export function getBilagaName(type: AttachGroup): string {
  const bilagaMap: Record<AttachGroup, string> = {
    "Uppnådd specialistkompetens": "SOSFS-bilaga 2",
    "Uppfyllda kompetenskrav för specialistläkare från tredjeland": "SOSFS-bilaga 8a",
    "Uppnådd specialistkompetens för specialistläkare från tredjeland": "SOSFS-bilaga 8b",
    Auskultationer: "SOSFS-bilaga 3",
    "Kliniska tjänstgöringar under handledning": "SOSFS-bilaga 4",
    Kurser: "SOSFS-bilaga 5",
    Utvecklingsarbete: "SOSFS-bilaga 6",
    "Vetenskapligt arbete": "SOSFS-bilaga 7",
    "Svensk doktorsexamen": "Övriga handlingar",
    "Utländsk doktorsexamen": "Övriga handlingar",
    "Utländsk tjänstgöring": "Övriga handlingar",
    "Individuellt utbildningsprogram": "Övriga handlingar",
  };
  return bilagaMap[type] || "";
}

export function formatAttachmentLabel(item: AttachmentItem): string {
  const type = item.type;
  const currentLabel = item.label || "";
  if (type === "Vetenskapligt arbete") return "Vetenskapligt arbete";
  if (type === "Utvecklingsarbete") return "Kvalitets- och förbättringsarbete";
  if (type === "Kliniska tjänstgöringar under handledning") {
    const name = currentLabel.trim();
    return name && name !== "—" ? `Klinisk tjänstgöring: ${name}` : type;
  }
  if (type === "Kurser") {
    const name = currentLabel.trim();
    return name && name !== "—" ? `Kurs: ${name}` : type;
  }
  if (type === "Auskultationer") {
    const name = currentLabel.trim();
    return name && name !== "—" ? `Auskultation: ${name}` : type;
  }
  return currentLabel || type;
}

export function getBilagaNumber(type: AttachGroup): { num: number; sub: string } {
  const bilagaName = getBilagaName(type);
  if (!bilagaName || bilagaName === "Övriga handlingar") return { num: 9999, sub: "" };
  const match = bilagaName.match(/bilaga\s+(\d+)([a-z]?)/i);
  if (!match) return { num: 9999, sub: "" };
  return { num: parseInt(match[1], 10), sub: (match[2] || "").toLowerCase() };
}

export function sortByBilagaNumber(a: AttachmentItem, b: AttachmentItem): number {
  const numA = getBilagaNumber(a.type);
  const numB = getBilagaNumber(b.type);
  if (numA.num !== numB.num) return numA.num - numB.num;
  if (numA.sub !== numB.sub) return numA.sub.localeCompare(numB.sub);
  const ta = ts(a.date);
  const tb = ts(b.date);
  if (ta !== tb) return ta - tb;
  return (a.label || "").localeCompare(b.label || "", "sv");
}

export function colorsFor(type: AttachGroup) {
  const s = GROUP_COLORS[type] ?? GROUP_COLORS["Kliniska tjänstgöringar under handledning"];
  return { cardBg: s.bg, cardBd: s.bd, pillBg: s.pill, pillBd: s.pillBd };
}

export function buildDefaultAttachmentsFor2015(args: {
  placements: Placement[];
  courses: Course[];
}): AttachmentItem[] {
  const { placements, courses } = args;
  const items: AttachmentItem[] = [];

  for (const p of placements) {
    const { group, labelFrom } = classifyPlacement(p as any);
    items.push({
      id: `pl-${(p as any).id ?? `${p.startDate ?? ""}-${p.endDate ?? ""}-${labelFrom}`}`,
      type: group,
      label: labelFrom || "—",
      date: pickPlacementDate(p),
    });
  }

  for (const c of courses) {
    if ((c as any).showOnTimeline === false) continue;
    const label = (c as any).title || (c as any).name || (c as any).provider || "Kurs";
    const date = pickCourseDate(c);
    if (!label && !date) continue;
    items.push({
      id: `cr-${(c as any).id ?? `${c.startDate ?? ""}-${c.endDate ?? ""}-${label}`}`,
      type: "Kurser",
      label,
      date,
    });
  }

  return items.slice().sort(sortByBilagaNumber);
}

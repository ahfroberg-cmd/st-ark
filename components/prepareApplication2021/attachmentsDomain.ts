import type { Course, Placement } from "@/lib/types";

export type AttachGroup =
  | "Fullgjord specialiseringstjänstgöring"
  | "Uppnådd specialistkompetens"
  | "Auskultationer"
  | "Kliniska tjänstgöringar under handledning"
  | "Kurser"
  | "Utvecklingsarbete"
  | "Vetenskapligt arbete"
  | "Delmål STa3"
  | "Medicinsk vetenskap"
  | "Delmål för specialistläkare från tredjeland"
  | "Svensk doktorsexamen"
  | "Utländsk doktorsexamen"
  | "Utländsk tjänstgöring"
  | "Individuellt utbildningsprogram för specialistläkare från tredjeland";

export const GROUP_ORDER: AttachGroup[] = [
  "Fullgjord specialiseringstjänstgöring",
  "Uppnådd specialistkompetens",
  "Auskultationer",
  "Kliniska tjänstgöringar under handledning",
  "Kurser",
  "Utvecklingsarbete",
  "Vetenskapligt arbete",
  "Delmål STa3",
  "Medicinsk vetenskap",
  "Delmål för specialistläkare från tredjeland",
  "Svensk doktorsexamen",
  "Utländsk doktorsexamen",
  "Utländsk tjänstgöring",
  "Individuellt utbildningsprogram för specialistläkare från tredjeland",
];

export type PresetKey =
  | "fullgjordST"
  | "intyg"
  | "sta3"
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

function ts(iso?: string) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export function classifyPlacement(p: any): { group: AttachGroup; labelFrom: string } {
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

export function buildDefaultAttachmentsFor2021(args: {
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

  return items.slice().sort((a, b) => {
    if (a.type === "Fullgjord specialiseringstjänstgöring" && b.type !== "Fullgjord specialiseringstjänstgöring") return -1;
    if (b.type === "Fullgjord specialiseringstjänstgöring" && a.type !== "Fullgjord specialiseringstjänstgöring") return 1;

    const numA = a.type === "Fullgjord specialiseringstjänstgöring" ? { num: 1, sub: "" } :
      a.type === "Uppnådd specialistkompetens" ? { num: 7, sub: "" } :
      a.type === "Auskultationer" ? { num: 8, sub: "" } :
      a.type === "Kliniska tjänstgöringar under handledning" ? { num: 9, sub: "a" } :
      a.type === "Vetenskapligt arbete" ? { num: 9, sub: "b" } :
      a.type === "Kurser" ? { num: 10, sub: "" } :
      a.type === "Utvecklingsarbete" ? { num: 11, sub: "" } :
      a.type === "Delmål STa3" || a.type === "Medicinsk vetenskap" || a.type === "Delmål för specialistläkare från tredjeland" ? { num: 13, sub: "" } :
      { num: 9999, sub: "" };
    const numB = b.type === "Fullgjord specialiseringstjänstgöring" ? { num: 1, sub: "" } :
      b.type === "Uppnådd specialistkompetens" ? { num: 7, sub: "" } :
      b.type === "Auskultationer" ? { num: 8, sub: "" } :
      b.type === "Kliniska tjänstgöringar under handledning" ? { num: 9, sub: "a" } :
      b.type === "Vetenskapligt arbete" ? { num: 9, sub: "b" } :
      b.type === "Kurser" ? { num: 10, sub: "" } :
      b.type === "Utvecklingsarbete" ? { num: 11, sub: "" } :
      b.type === "Delmål STa3" || b.type === "Medicinsk vetenskap" || b.type === "Delmål för specialistläkare från tredjeland" ? { num: 13, sub: "" } :
      { num: 9999, sub: "" };

    if (numA.num !== numB.num) return numA.num - numB.num;
    if (numA.sub !== numB.sub) return numA.sub.localeCompare(numB.sub);

    const ta = ts(a.date);
    const tb = ts(b.date);
    if (ta !== tb) return ta - tb;
    return (a.label || "").localeCompare(b.label || "", "sv");
  });
}

export type Swatch = { bg: string; bd: string; pill: string; pillBd: string };

const GREY_BG = "hsl(220 14% 95%/.96)";
const GREY_BD = "hsl(220 12% 75%/.96)";
const GREY_PILL = "hsl(220 16% 98%/.96)";
const GREY_PILLBD = "hsl(220 10% 86%/.96)";

export const GROUP_COLORS: Record<AttachGroup, Swatch> = {
  "Fullgjord specialiseringstjänstgöring": { bg: "hsl(12 35% 94%/.96)", bd: "hsl(12 25% 75%/.96)", pill: "hsl(12 40% 98%/.96)", pillBd: "hsl(12 23% 85%/.96)" },
  "Uppnådd specialistkompetens": { bg: "hsl(12 35% 94%/.96)", bd: "hsl(12 25% 75%/.96)", pill: "hsl(12 40% 98%/.96)", pillBd: "hsl(12 23% 85%/.96)" },
  "Auskultationer": { bg: "hsl(30 35% 94%/.96)", bd: "hsl(30 25% 75%/.96)", pill: "hsl(30 40% 98%/.96)", pillBd: "hsl(30 23% 85%/.96)" },
  "Kliniska tjänstgöringar under handledning": { bg: "hsl(222 30% 94%/.96)", bd: "hsl(222 22% 72%/.96)", pill: "hsl(222 35% 98%/.96)", pillBd: "hsl(222 20% 84%/.96)" },
  Kurser: { bg: "hsl(190 30% 94%/.96)", bd: "hsl(190 22% 72%/.96)", pill: "hsl(190 35% 98%/.96)", pillBd: "hsl(190 20% 84%/.96)" },
  Utvecklingsarbete: { bg: "hsl(95 25% 94%/.96)", bd: "hsl(95 20% 72%/.96)", pill: "hsl(95 30% 98%/.96)", pillBd: "hsl(95 18% 84%/.96)" },
  "Vetenskapligt arbete": { bg: "hsl(265 25% 94%/.96)", bd: "hsl(265 20% 72%/.96)", pill: "hsl(265 30% 98%/.96)", pillBd: "hsl(265 18% 84%/.96)" },
  "Delmål STa3": { bg: "hsl(200 30% 94%/.96)", bd: "hsl(200 22% 72%/.96)", pill: "hsl(200 35% 98%/.96)", pillBd: "hsl(200 20% 84%/.96)" },
  "Medicinsk vetenskap": { bg: "hsl(200 30% 94%/.96)", bd: "hsl(200 22% 72%/.96)", pill: "hsl(200 35% 98%/.96)", pillBd: "hsl(200 20% 84%/.96)" },
  "Delmål för specialistläkare från tredjeland": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Svensk doktorsexamen": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Utländsk doktorsexamen": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Utländsk tjänstgöring": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Individuellt utbildningsprogram för specialistläkare från tredjeland": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
};

export function getBilagaName2021(type: AttachGroup): string {
  const bilagaMap: Record<string, string> = {
    "Fullgjord specialiseringstjänstgöring": "HSLF-FS 2021:8 - Bilaga 6",
    "Uppnådd specialistkompetens": "HSLF-FS 2021:8 - Bilaga 7",
    Auskultationer: "HSLF-FS 2021:8 - Bilaga 8",
    "Kliniska tjänstgöringar under handledning": "HSLF-FS 2021:8 - Bilaga 9",
    "Vetenskapligt arbete": "HSLF-FS 2021:8 - Bilaga 9",
    Kurser: "HSLF-FS 2021:8 - Bilaga 10",
    Utvecklingsarbete: "HSLF-FS 2021:8 - Bilaga 11",
    "Delmål STa3": "HSLF-FS 2021:8 - Bilaga 12",
    "Medicinsk vetenskap": "HSLF-FS 2021:8 - Bilaga 12",
    "Delmål för specialistläkare från tredjeland": "HSLF-FS 2021:8 - Bilaga 13",
    "Svensk doktorsexamen": "Övriga handlingar",
    "Utländsk doktorsexamen": "Övriga handlingar",
    "Utländsk tjänstgöring": "Övriga handlingar",
    "Individuellt utbildningsprogram för specialistläkare från tredjeland": "Övriga handlingar",
  };
  return bilagaMap[type] || "";
}

export function formatAttachmentLabel2021(item: AttachmentItem): string {
  const type = item.type;
  const currentLabel = item.label || "";
  if (type === "Vetenskapligt arbete") return "Vetenskapligt arbete";
  if (type === "Utvecklingsarbete") return "Kvalitets- och förbättringsarbete";

  if (type === "Kliniska tjänstgöringar under handledning") {
    const name = currentLabel.trim();
    if (name && name !== "—") return `Klinisk tjänstgöring: ${name}`;
    return type;
  }
  if (type === "Kurser") {
    const name = currentLabel.trim();
    if (name && name !== "—") return `Kurs: ${name}`;
    return type;
  }
  if (type === "Auskultationer") {
    const name = currentLabel.trim();
    if (name && name !== "—") return `Auskultation: ${name}`;
    return type;
  }
  return currentLabel || type;
}

export function getBilagaNumber2021(type: AttachGroup): { num: number; sub: string } {
  const bilagaName = getBilagaName2021(type);
  if (!bilagaName || bilagaName === "Övriga handlingar") return { num: 9999, sub: "" };
  const match = bilagaName.match(/Bilaga\s+(\d+)/i);
  if (match) return { num: parseInt(match[1], 10), sub: "" };
  return { num: 9999, sub: "" };
}

export function sortByBilagaNumber2021(a: AttachmentItem, b: AttachmentItem): number {
  const numA = getBilagaNumber2021(a.type);
  const numB = getBilagaNumber2021(b.type);
  if (numA.num !== numB.num) return numA.num - numB.num;
  return GROUP_ORDER.indexOf(a.type) - GROUP_ORDER.indexOf(b.type);
}

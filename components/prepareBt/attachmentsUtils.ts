import type { AttachKey } from "./modalTypes";

type Swatch = { bg: string; bd: string; pill: string; pillBd: string };

const BT_GROUP_COLORS: Record<AttachKey, Swatch> = {
  "Delmål i bastjänstgöringen": {
    bg: "hsl(190 30% 94%/.96)",
    bd: "hsl(190 22% 72%/.96)",
    pill: "hsl(190 35% 98%/.96)",
    pillBd: "hsl(190 20% 84%/.96)",
  },
  "Fullgjord bastjänstgöring": {
    bg: "hsl(222 30% 94%/.96)",
    bd: "hsl(222 22% 72%/.96)",
    pill: "hsl(222 35% 98%/.96)",
    pillBd: "hsl(222 20% 84%/.96)",
  },
  "Uppnådd baskompetens": {
    bg: "hsl(12 35% 94%/.96)",
    bd: "hsl(12 25% 75%/.96)",
    pill: "hsl(12 40% 98%/.96)",
    pillBd: "hsl(12 23% 85%/.96)",
  },
  "Tjänstgöring före legitimation": {
    bg: "hsl(48 85% 93%/.96)",
    bd: "hsl(48 70% 75%/.96)",
    pill: "hsl(48 90% 98%/.96)",
    pillBd: "hsl(48 60% 86%/.96)",
  },
  "Utländsk tjänstgöring": {
    bg: "hsl(220 14% 95%/.96)",
    bd: "hsl(220 12% 75%/.96)",
    pill: "hsl(220 16% 98%/.96)",
    pillBd: "hsl(220 10% 86%/.96)",
  },
};

export function colorsForBt(key: string | AttachKey) {
  const raw = String(key).trim();
  let kind: AttachKey | string = raw.includes(":") ? raw.split(":")[0].trim() : raw;

  if (/^Intyg tjänstgöring före legitimation\b/i.test(raw)) {
    kind = "Tjänstgöring före legitimation";
  } else if (/^Utländsk tjänstgöring\b/i.test(raw)) {
    kind = "Utländsk tjänstgöring";
  }

  const sw = BT_GROUP_COLORS[kind as AttachKey] ?? BT_GROUP_COLORS["Delmål i bastjänstgöringen"];
  return { cardBg: sw.bg, cardBd: sw.bd, pillBg: sw.pill, pillBd: sw.pillBd };
}

export function normalizeAndSortAttachments(list: string[], btPlacements: any[]): AttachKey[] {
  const filtered = list.filter((x) => x && x !== "Delmål i bastjänstgöringen");

  const isBTPlacement = (x: string) => x.startsWith("Delmål i bastjänstgöringen: Klinisk tjänstgöring — ");
  const isSavedBtCert = (x: string) => x.startsWith("Delmål i bastjänstgöringen: Intyg delmål i BT ");
  const isFullgjord = (x: string) => x === "Fullgjord bastjänstgöring";
  const isBaskomp = (x: string) => x === "Uppnådd baskompetens";
  const isPrelicense = (x: string) =>
    x.startsWith("Tjänstgöring före legitimation:") || /^Intyg tjänstgöring före legitimation\b/.test(x);
  const isForeign = (x: string) => x.startsWith("Utländsk tjänstgöring:");

  const btMap = new Map<string, number>();
  for (const pl of btPlacements) {
    const label =
      `Delmål i bastjänstgöringen: Klinisk tjänstgöring — ` +
      String((pl as any).clinic || (pl as any).note || "Klinisk tjänstgöring");
    const t = new Date((pl as any).endDate || (pl as any).startDate || 0).getTime();
    btMap.set(label, t);
  }
  const a1 = filtered.filter(isBTPlacement).sort((a, b) => (btMap.get(a) ?? 0) - (btMap.get(b) ?? 0));

  const num = (s: string) => Number(s.match(/\d+/)?.[0] ?? 0);
  const a2 = filtered.filter(isSavedBtCert).sort((a, b) => num(a) - num(b));
  const a3 = filtered.filter(isFullgjord);
  const a4 = filtered.filter(isBaskomp);
  const a5 = filtered.filter(isPrelicense);
  const a6 = filtered.filter(isForeign);

  return [...a1, ...a2, ...a3, ...a4, ...a5, ...a6] as AttachKey[];
}

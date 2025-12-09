// lib/goals-common.ts

/**
 * Gemensam informationskälla för A- och B-delmål som är lika mellan specialiteter.
 *
 * Arkitektur:
 * - Canonical text för A- och B-delmål ligger i JSON-filerna:
 *     public/goals/2015/common.json
 *     public/goals/2021/common.json
 * - Den här modulen importerar båda JSON-filerna vid build och bygger ett uppslagsverk
 *   där varje delmål kan nås via både sin id-nyckel (t.ex. "A1", "STa1") och sin kod.
 *
 * Du lägger bara till/ändrar delmål i respektive common.json när fler specialiteter tillkommer.
 */

import common2015 from "../public/goals/2015/common.json";
import common2021 from "../public/goals/2021/common.json";

export type CommonMilestone = {
  id?: string;
  code?: string;
  title?: string;
  description?: string;
  sections?: Array<
    | { title?: string; text?: string }
    | { title?: string; items?: string[] }
  >;
};

type CommonJson = {
  version?: string;
  milestones: CommonMilestone[];
};

/**
 * Normalisera en nyckel för uppslag: trim, versaler, ta bort mellanslag.
 */
function normKey(x: unknown): string {
  return String(x ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * Bygg ett index över alla gemensamma delmål.
 *
 * Varje delmål registreras med flera alias:
 *  - id (t.ex. "A1", "STa1")
 *  - code
 *  - versalvariant utan mellanslag
 *  - A1 <-> STa1, B3 <-> STb3 osv.
 */
function buildIndex(...sources: CommonJson[]): Record<string, CommonMilestone> {
  const index: Record<string, CommonMilestone> = {};

  const add = (m: CommonMilestone) => {
    if (!m) return;
    const baseId = (m.id || m.code || "").toString();
    if (!baseId) return;

    const code = (m.code || baseId).toString();

    const norm: CommonMilestone = {
      ...m,
      id: baseId,
      code,
    };

    const keys = new Set<string>();

    const idKey = baseId;
    const codeKey = code;
    const upperId = normKey(baseId);
    const upperCode = normKey(code);

    keys.add(idKey);
    keys.add(codeKey);
    keys.add(upperId);
    keys.add(upperCode);

    // Alias A1 <-> STa1, B2 <-> STb2, C3 <-> STc3
    const m1 = upperCode.match(/^ST([ABC])(\d+)$/);
    if (m1) {
      const ab = `${m1[1]}${m1[2]}`; // STa1 -> A1
      keys.add(ab);
      keys.add(normKey(ab));
    }
    const m2 = upperCode.match(/^([ABC])(\d+)$/);
    if (m2) {
      const st = `ST${m2[1]}${m2[2]}`; // A1 -> STa1
      keys.add(st);
      keys.add(normKey(st));
    }

    for (const k of keys) {
      index[k] = norm;
    }
  };

  for (const src of sources) {
    if (!src || !Array.isArray(src.milestones)) continue;
    for (const m of src.milestones) {
      add(m);
    }
  }

  return index;
}

/**
 * Gemensam uppslagskarta för A- och B-delmål.
 *
 * Nycklar:
 *   - id (t.ex. "A1", "STa1")
 *   - code
 *   - versaler utan mellanslag
 *   - alias mellan A/B- och ST-varianter (A1 <-> STa1, B3 <-> STb3)
 *
 * Krav:
 *   - För målversion 2015 ska A- och B-delmålen (A1–A6, B1–B5) hämtas från common2015.
 *   - För målversion 2021 ska STa/STb/STc-mål fortsatt hämtas från common2021.
 *
 * Lösning:
 *   - Bygg två separata index (2015 respektive 2021).
 *   - Starta med 2021-indexet.
 *   - Skriv sedan bara över nycklar som ser ut som A/B-koder (A1..A6, B1..B5) med 2015-varianten.
 */
const COMMON_2015_INDEX: Record<string, CommonMilestone> = buildIndex(
  common2015 as CommonJson
);
const COMMON_2021_INDEX: Record<string, CommonMilestone> = buildIndex(
  common2021 as CommonJson
);

export const COMMON_AB_MILESTONES: Record<string, CommonMilestone> = (() => {
  const index: Record<string, CommonMilestone> = {
    ...COMMON_2021_INDEX,
  };

  for (const [key, value] of Object.entries(COMMON_2015_INDEX)) {
    const kNorm = normKey(key);
    if (/^[AB]\d+$/i.test(kNorm)) {
      index[key] = value;
    }
  }

  return index;
})();


/**
 * Slår samman en befintlig milestone med COMMON_AB_MILESTONES om träff finns.
 * Fält i `common` ersätter/kompletterar fält i `base`.
 *
 * Hanterar också både
 *   - sections som färdig array [{ title, items/text }, ...]
 *   - sections som objekt { kompetenskrav: [...], utbildningsaktiviteter: [...], intyg: [...], allmannaRad: [...] }
 * och normaliserar till en array som UI:t förväntar sig.
 */
export function mergeWithCommon<T extends { id?: string; code?: string }>(
  base: T | null
): (T & CommonMilestone) | null {
  if (!base) return null;

  // Lokal helper för att normalisera sections till arrayformatet
  const normalizeSections = (value: any): CommonMilestone["sections"] | undefined => {
    if (!value) return undefined;

    // Redan i rätt format
    if (Array.isArray(value)) {
      return value as CommonMilestone["sections"];
    }

    // Nytt format: objekt med nycklar
    if (typeof value === "object") {
      const src: any = value;
      const out: CommonMilestone["sections"] = [];

      if (Array.isArray(src.kompetenskrav) && src.kompetenskrav.length > 0) {
        out.push({
          title: "Kompetenskrav",
          items: src.kompetenskrav,
        });
      }

      if (Array.isArray(src.utbildningsaktiviteter) && src.utbildningsaktiviteter.length > 0) {
        out.push({
          title: "Utbildningsaktiviteter",
          items: src.utbildningsaktiviteter,
        });
      }

      if (Array.isArray(src.intyg) && src.intyg.length > 0) {
        out.push({
          title: "Intyg",
          items: src.intyg,
        });
      }

      if (Array.isArray(src.allmannaRad) && src.allmannaRad.length > 0) {
        out.push({
          title: "Allmänna råd",
          items: src.allmannaRad,
        });
      }

      return out.length > 0 ? out : undefined;
    }

    return undefined;
  };

  const idKey = (base.id ?? "").toString();
  const codeKey = (base.code ?? "").toString();
  const common =
    COMMON_AB_MILESTONES[idKey] ??
    COMMON_AB_MILESTONES[codeKey] ??
    null;

  // Börja med bas-milestonen
  const merged: any = { ...(base as any) };

  // Lägg på ev. gemensam A/B-text
  if (common) {
    if (common.title) {
      merged.title = common.title;
    }
    if (common.description) {
      merged.description = common.description;
    }
    if (Array.isArray(common.sections)) {
      // A- och B-delmål: använd de fördefinierade sektionerna
      merged.sections = common.sections;
    }
  }

  // Normalisera sections oavsett om de kommer från base eller common
  const norm = normalizeSections(merged.sections);
  if (norm) {
    merged.sections = norm;
  } else if ("sections" in merged) {
    // Om något konstigt låg där innan, men inte gick att normalisera – ta bort
    delete merged.sections;
  }

  return merged as T & CommonMilestone;
}


// lib/goals.ts
// Robust loader som returnerar GoalsCatalog med kompletta delmål
// (id, code, group, title, sections, sourceUrl). Klarar olika JSON-upplägg.

export type GoalsSections = {
  kompetenskrav?: string | string[];
  utbildningsaktiviteter?: string | string[];
  intyg?: string | string[];
  allmannaRad?: string | string[];
};

export type GoalsMilestone = {
  id: string;
  code: string;
  group: "A" | "B" | "C";
  title: string;
  description?: string;
  sections?: GoalsSections;
  sourceUrl?: string;
};

export type GoalsCatalog = {
  specialty: string;
  version: "2015" | "2021";
  milestones: GoalsMilestone[];
  /** Uppslag både via id och normaliserad kod (lowercase, utan mellanslag). */
  index: Record<string, GoalsMilestone>;
};

type AnyJson = any;

let _cache: Record<string, GoalsCatalog> = {};

/** Normalisera kod för indexering/sök (inte för visning). */
export function normalizeGoalCode(code: string): string {
  return (code ?? "").toString().trim().replace(/\s+/g, "").toLowerCase();
}

/** Gissa grupp A/B/C från kod om saknas i rådata. */
function guessGroup(code: string): "A" | "B" | "C" {
  const raw = (code ?? "").toString();
  // Ta bort ev. "ST" i början innan A/B/C
  const m = raw.replace(/^st/i, "").match(/^[abc]/i);
  return (m ? m[0].toUpperCase() : "A") as "A" | "B" | "C";
}

/** Ladda rå JSON från public/ via fetch, med stöd för version/specialitet. Fallback: require(). */
async function tryLoadRawJsonAsync(
  version?: "2015" | "2021",
  specialtyRaw?: string
): Promise<AnyJson | null> {
  const specSlug = (specialtyRaw ?? "Psykiatri").trim().toLowerCase().replace(/\s+/g, "");
  const canFetch = typeof window !== "undefined" && typeof fetch !== "undefined";
  const abs = (p: string) =>
    typeof window !== "undefined" ? new URL(p, window.location.origin).toString() : p;

  if (canFetch) {
    const candidates = [
      `/goals/${version ?? "2015"}/${specSlug}.json`,
      `/goals/${specSlug}.json`,
      `/goals/2015/${specSlug}.json`,
      `/goals/2021/${specSlug}.json`,
    ];
    for (const path of candidates) {
      try {
        const res = await fetch(abs(path), { cache: "no-store" });
        if (res.ok) return await res.json();
      } catch {}
    }
  }

  // Fallback till bundlade filer
  try { return require("@/lib/psykiatri.json"); } catch {}
  try { return require("@/lib/psykiatri_sv.json"); } catch {}
  try { return require("@/lib/lexicon/psykiatri.json"); } catch {}
  try { return require("@/lib/lexicon/psykiatri_sv.json"); } catch {}

  return null;
}


/** Platta ut olika JSON-strukturer till en ren lista av GoalsMilestone. */
function toMilestoneArray(
  x: AnyJson,
  version: "2015" | "2021",
  specialty: string
): GoalsMilestone[] {
  if (!x) return [];

  // Vanlig struktur i dina filer: { specialty, version, milestones: [...] }
  if (x.milestones && Array.isArray(x.milestones)) {
    return x.milestones.map(normalizeOne).filter(Boolean) as GoalsMilestone[];
  }

  // Om filen innehåller flera versioner/specialiteter i ett objekt:
  // { specialties: { Psykiatri: { "2015":{milestones:[...]}, "2021":{...} } } } – hantera här vid behov.
  if (x.specialties) {
    const keys = Object.keys(x.specialties);
    const key = keys.find(k => k.toLowerCase() === specialty.toLowerCase()) ?? keys[0];
    const bucket = x.specialties[key]?.[version];
    if (bucket?.milestones) {
      return bucket.milestones.map(normalizeOne).filter(Boolean) as GoalsMilestone[];
    }
  }


  // { Psykiatri: { "2015": { milestones:[...] }, "2021":{...} } }
  {
    const keys = Object.keys(x);
    const key = keys.find(k => k.toLowerCase() === specialty.toLowerCase());
    if (key && x[key]?.[version]?.milestones) {
      return x[key][version].milestones.map(normalizeOne).filter(Boolean) as GoalsMilestone[];
    }
  }


  // Direkt array [ ... ] (t.ex. blandad form)
  if (Array.isArray(x)) {
    return x.map(normalizeOne).filter(Boolean) as GoalsMilestone[];
  }

  // Objekt med versionsnycklar
  if (x["2015"]?.milestones || x["2021"]?.milestones) {
    const bucket = x[version];
    if (bucket?.milestones) {
      return bucket.milestones.map(normalizeOne).filter(Boolean) as GoalsMilestone[];
    }
  }

  return [];

  /** Normalisera ett rått delmålsobjekt till GoalsMilestone. */
  function normalizeOne(it: any): GoalsMilestone | null {
    if (!it || typeof it !== "object") {
      // Om posten är en sträng – skapa minimal post
      if (typeof it === "string") {
        const codeStr = it.trim();
        return {
          id: codeStr,
          code: codeStr,
          group: guessGroup(codeStr),
          title: codeStr.toUpperCase(),
        };
      }
      return null;
    }

    const rawCode = (it.code ?? it.kod ?? it.id ?? "").toString().trim();
    if (!rawCode) return null;

    const id: string = (it.id ?? rawCode).toString();
    const group: "A" | "B" | "C" = (it.group ? String(it.group).toUpperCase() : guessGroup(rawCode)) as any;
    const title: string = (it.title ?? it.label ?? it.namn ?? rawCode).toString();

    const sections: GoalsSections | undefined = it.sections
      ? {
          kompetenskrav: it.sections.kompetenskrav,
          utbildningsaktiviteter: it.sections.utbildningsaktiviteter,
          intyg: it.sections.intyg,
          allmannaRad: it.sections.allmannaRad,
        }
      : undefined;

    const description: string | undefined =
      (typeof it.description === "string" && it.description) ||
      (typeof it.beskrivning === "string" && it.beskrivning) ||
      undefined;

    const sourceUrl: string | undefined = it.sourceUrl || it.kallaUrl || undefined;

    return { id, code: rawCode, group, title, description, sections, sourceUrl };
  }
}

/** Publik loader: returnerar alltid GoalsCatalog. */
export async function loadGoals(
  versionRaw?: string,
  specialtyRaw?: string
): Promise<GoalsCatalog> {
  const version: "2015" | "2021" =
    versionRaw?.includes("2021")
      ? "2021"
      : versionRaw?.includes("2015")
      ? "2015"
      : (versionRaw === "2021" || versionRaw === "2015" ? (versionRaw as any) : "2015");

  const specialty = (specialtyRaw ?? "Psykiatri").trim();
  const cacheKey = `${version}|${specialty}`;
  if (_cache[cacheKey]) return _cache[cacheKey];

  const raw = await tryLoadRawJsonAsync(version, specialty);
  const milestones = toMilestoneArray(raw, version, specialty);

  // Bygg index via både id och normaliserad kod
  const index: Record<string, GoalsMilestone> = {};
  for (const m of milestones) {
    index[m.id] = m;
    index[normalizeGoalCode(m.code)] = m;
  }

  const out: GoalsCatalog = { specialty, version, milestones, index };
  _cache[cacheKey] = out;
  return out;
}

export default { loadGoals, normalizeGoalCode };

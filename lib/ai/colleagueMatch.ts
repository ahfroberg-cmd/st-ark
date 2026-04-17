/** Matchning av placering/kursnamn mot användarens sökfras (synonymer, delsträng, ord). */

export function normalizePlacementKey(s: string): string {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("sv-SE");
}

function significantTokens(s: string): string[] {
  return normalizePlacementKey(s)
    .split(/[^a-zåäö0-9]+/i)
    .filter((t) => t.length >= 2);
}

/**
 * True om radens namn (och ev. alt-namn) motsvarar användarens sökterm.
 */
export function placementNameMatches(
  query: string,
  placementName: string,
  placementNameAlt?: string
): boolean {
  const q = normalizePlacementKey(query);
  const n = normalizePlacementKey(placementName);
  const a = placementNameAlt ? normalizePlacementKey(placementNameAlt) : "";
  if (!q) return false;
  if (!n && !a) return false;
  if (n === q || a === q) return true;
  if (n && (n.includes(q) || q.includes(n))) return true;
  if (a && (a.includes(q) || q.includes(a))) return true;

  const qt = significantTokens(q);
  if (qt.length === 0) return false;
  const combined = [n, a].filter(Boolean).join(" ");
  const nt = new Set(significantTokens(combined));
  if (nt.size === 0) return false;
  return qt.every((t) =>
    [...nt].some((x) => x === t || x.includes(t) || t.includes(x))
  );
}

/**
 * True om kollegans namn matchar t.ex. "Cecilia", "cecilias", "Anna-Karin".
 */
export function colleagueNameMatches(filter: string, colleagueName: string): boolean {
  let f = normalizePlacementKey(filter).replace(/\s+/g, " ");
  const c = normalizePlacementKey(colleagueName);
  if (!f || !c) return false;
  if (!/\s/.test(f) && f.length >= 4 && f.endsWith("s")) {
    f = f.slice(0, -1);
  }
  if (c === f) return true;
  const first = (c.split(/\s+/)[0] || "").replace(/s$/, "");
  if (first && (first === f || first.startsWith(f) || f.startsWith(first))) return true;
  return c.includes(f) || f.includes(first);
}

export function courseNameMatches(
  query: string,
  courseName: string,
  courseNameAlt?: string
): boolean {
  return placementNameMatches(query, courseName, courseNameAlt);
}

/**
 * Heuristik för att särskilja privata vårdval i listor (namn börjar ofta med varumärke).
 * Används för optgroup "… (privata vårdval)" — inte juridiskt ägarbesked.
 */
const PRIVATE_NAME_PATTERNS: RegExp[] = [
  /^Capio\b/i,
  /^Aleris\b/i,
  /^Praktikertjänst\b/i,
  /^Kry\b/i,
  /^Doktor24\b/i,
  /^Min doktor\b/i,
  /^Mindoktor\b/i,
  /^Vårdcentralen Hjärtat/i,
  /^Mindpark\b/i,
  /^Bokskogens\b/i,
  /^MediCheck/i,
  /^Serafim\b/i,
  /^Livio\b/i,
  /^Carlanderska\b/i,
  /^Citydoc/i,
  /^ISO[\s-]?kliniken/i,
  /^Wästerläkarna\b/i,
  /^Vårdcentralen Aroma\b/i,
];

export function isPrivateVardcentralName(name: string): boolean {
  const n = String(name || "").trim();
  return PRIVATE_NAME_PATTERNS.some((re) => re.test(n));
}

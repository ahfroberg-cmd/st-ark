type StartAnchorOptions = {
  goalsVersion: unknown;
  btStartDate: unknown;
  stStartDate: unknown;
  isValidISO: (iso: string) => boolean;
};

export function normalizeDateAnchor(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return null;
}

export function pickTrainingStartAnchorISO(options: StartAnchorOptions): string | null {
  const { goalsVersion, btStartDate, stStartDate, isValidISO } = options;
  const goals = String(goalsVersion || "").trim();
  const is2021 = goals === "2021";
  const btISO = normalizeDateAnchor(btStartDate);
  const stISO = normalizeDateAnchor(stStartDate);
  const btValid = !!btISO && isValidISO(btISO);
  const stValid = !!stISO && isValidISO(stISO);

  if (is2021) {
    if (btValid && stValid) return btISO! <= stISO! ? btISO! : stISO!;
    if (btValid) return btISO!;
    if (stValid) return stISO!;
    return null;
  }

  if (stValid) return stISO!;
  if (btValid) return btISO!;
  return null;
}

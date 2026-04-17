export interface CursorItem {
  id: string;
  title: string;
  startDate?: string;
}

export interface CursorSelectionRule {
  everyN: number;
  startAt?: number;
  afterTitle?: string;
}

export interface CursorSelectionResult {
  selected: CursorItem[];
  skipped: CursorItem[];
  anchorFound: boolean;
  reason?: string;
}

function normalizeSv(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sortItems(items: CursorItem[]): CursorItem[] {
  return [...items].sort((a, b) => {
    const da = String(a.startDate || "");
    const db = String(b.startDate || "");
    if (da !== db) return da.localeCompare(db);
    return a.title.localeCompare(b.title, "sv", { sensitivity: "base" });
  });
}

export function selectItemsByCursorRule(
  items: CursorItem[],
  rule: CursorSelectionRule
): CursorSelectionResult {
  const sorted = sortItems(items);
  if (sorted.length === 0) {
    return { selected: [], skipped: [], anchorFound: false, reason: "no_items" };
  }
  const step = Math.max(1, Number(rule.everyN || 1));
  const startAt = Math.max(0, Number(rule.startAt || 0));

  let anchorIndex = -1;
  if (rule.afterTitle) {
    const q = normalizeSv(rule.afterTitle);
    anchorIndex = sorted.findIndex((i) => normalizeSv(i.title).includes(q));
    if (anchorIndex < 0) {
      return { selected: [], skipped: sorted, anchorFound: false, reason: "anchor_not_found" };
    }
  }
  const base = anchorIndex >= 0 ? anchorIndex + 1 : 0;

  const selected: CursorItem[] = [];
  const skipped: CursorItem[] = [];
  for (let idx = base; idx < sorted.length; idx += 1) {
    const rel = idx - base;
    const take = rel >= startAt && ((rel - startAt) % step === 0);
    if (take) selected.push(sorted[idx]);
    else skipped.push(sorted[idx]);
  }
  return {
    selected,
    skipped,
    anchorFound: anchorIndex >= 0 || !rule.afterTitle,
  };
}

export function normalizeSv(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ORDINAL_WORDS: Record<string, number> = {
  forsta: 1,
  forst: 1,
  andra: 2,
  tredje: 3,
  fjarde: 4,
  femte: 5,
  sjatte: 6,
  sjunde: 7,
  attonde: 8,
  nionde: 9,
  tionde: 10,
  elfte: 11,
  tolfte: 12,
};

export function parsePositionFromEnd(text: string): number | null {
  const norm = normalizeSv(text);
  const compact = norm.replace(/[\s-]+/g, "");

  if (/(nast\s*-?\s*sista|nastsista)/.test(norm)) return 2;

  const numericLast = norm.match(/\b(\d{1,2})\s*(?::\s*)?(?:a|e)?\s*sista\b/);
  if (numericLast) {
    const n = Number(numericLast[1]);
    if (Number.isFinite(n) && n >= 1) return n;
  }

  const numericFromEnd =
    norm.match(/\b(?:nr|nummer)\s*(\d{1,2})\s+fran\s+slutet\b/) ||
    norm.match(/\b(\d{1,2})\s*(?::\s*)?(?:a|e)?\s+fran\s+slutet\b/);
  if (numericFromEnd) {
    const n = Number(numericFromEnd[1]);
    if (Number.isFinite(n) && n >= 1) return n;
  }

  const wordFromEnd = norm.match(
    /\b(forsta|forst|andra|tredje|fjarde|femte|sjatte|sjunde|attonde|nionde|tionde|elfte|tolfte)\s+fran\s+slutet\b/
  );
  if (wordFromEnd) {
    const n = ORDINAL_WORDS[wordFromEnd[1]];
    if (Number.isFinite(n) && n >= 1) return n;
  }

  const compoundWordLast = compact.match(
    /(forsta|forst|andra|tredje|fjarde|femte|sjatte|sjunde|attonde|nionde|tionde|elfte|tolfte)sista/
  );
  if (compoundWordLast) {
    const n = ORDINAL_WORDS[compoundWordLast[1]];
    if (Number.isFinite(n) && n >= 1) return n;
  }

  if (/\b(senaste|sista)\b/.test(norm)) return 1;

  return null;
}

export function detectPositionFromEnd(text: string): number {
  return parsePositionFromEnd(text) || 1;
}

export function hasOrdinalFromEndMention(text: string): boolean {
  return parsePositionFromEnd(text) !== null;
}

export function hasNoGapIntent(text: string): boolean {
  const norm = normalizeSv(text);
  return (
    /(utan\s+glapp|inget\s+glapp|inga\s+glapp|inte\s+blir\s+nagot\s+glapp)/.test(norm) ||
    /(fyll(?:er)?\s+glapp(?:et)?|glapp(?:et)?\s+fyll(?:s|er)?|glapp(?:et)?\s+forsvinner)/.test(norm) ||
    /moter?\s+nasta(?:\s+placering)?/.test(norm) ||
    /till\s+nasta\s+placering/.test(norm)
  );
}

export function hasUndoIntent(text: string): boolean {
  const norm = normalizeSv(text);
  return /(angra|aterstall|andra tillbaka|gor ogjort|undo)/.test(norm);
}

export function stripUndoPrefix(text: string): string {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const norm = normalizeSv(raw);
  if (!hasUndoIntent(norm)) return raw;

  const splitters = [
    /\b(?:och\s+sedan|sen\s+|sedan\s+|och\s+)\b/i,
    /[.]\s+/,
    /[,;]\s+/,
  ];
  for (const splitter of splitters) {
    const parts = raw.split(splitter).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const idx = parts.findIndex((p) => hasUndoIntent(p));
    if (idx >= 0 && idx + 1 < parts.length) {
      const rest = parts.slice(idx + 1).join(". ").trim();
      if (rest) return rest;
    }
  }

  const removedLead = raw.replace(
    /^(?:\s*(?:angra|ångra|aterstall|återställ|gor ogjort|gör ogjort|undo)[^,.]*(?:[,.]\s*|\s+och\s+|\s+sen(?:dan)?\s+)*)/i,
    ""
  );
  const trimmed = removedLead.trim();
  if (trimmed) return trimmed;
  if (/\b(och|sen|sedan|,|;|\.)\b/i.test(norm)) return "";
  return "";
}

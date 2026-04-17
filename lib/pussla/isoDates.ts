export function isValidISO(dateISO: string) {
  if (!dateISO) return false;
  const d = new Date(dateISO + "T00:00:00");
  return !isNaN(d.getTime());
}

export function normalizeISODateOnlyGlobal(v: any): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = s.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
  }
  return null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateToISO(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isoToDateSafe(iso: string) {
  return new Date(iso + "T00:00:00");
}

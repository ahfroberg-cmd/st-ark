export function normalizeIsoDateInput(value: unknown): string {
  return String(value || "").slice(0, 10);
}

export function isIsoDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

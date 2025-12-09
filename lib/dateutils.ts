// lib/dateutils.ts

/** Konvertera ISO-sträng "YYYY-MM-DD" till Date (utan tidszon). */
export function parseISO(s?: string | null): Date | null {
  return s ? new Date(`${s}T00:00:00`) : null;
}

/** Intern hjälpare: säkra att vi har ett giltigt Date-objekt. */
function asDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  // Anta ISO "YYYY-MM-DD" vid sträng
  const d = new Date(`${input}T00:00:00`);
  if (isNaN(d.getTime())) {
    // Sista skydd: försök direktkonstruktion (om input redan innehåller tid)
    const d2 = new Date(input);
    if (isNaN(d2.getTime())) {
      throw new TypeError(`Invalid date input: ${String(input)}`);
    }
    return d2;
  }
  return d;
}

/** Konvertera Date (eller ISO-sträng) till YYYY-MM-DD */
export function toISO(d: Date | string): string {
  const date = asDate(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lägg till antal dagar. Returnerar nytt Date-objekt. */
export function addDays(d: Date | string, days: number): Date {
  const base = asDate(d);
  const nd = new Date(base);
  nd.setDate(nd.getDate() + days);
  return nd;
}

/** Lägg till antal månader. Returnerar nytt Date-objekt. */
export function addMonths(d: Date | string, months: number): Date {
  const base = asDate(d);
  const nd = new Date(base);
  // Behåll dagdelen så gott det går (Date fixar själv över-/underflöde)
  nd.setMonth(nd.getMonth() + months);
  return nd;
}

/** Närmaste söndag på eller efter angivet datum. Returnerar Date. */
export function nextSundayOnOrAfter(d: Date | string): Date {
  const base = asDate(d);
  const dow = base.getDay(); // 0 = söndag
  if (dow === 0) return new Date(base);
  return addDays(base, 7 - dow);
}

/** Antal dagar inkl. båda ändar mellan två ISO-datum. */
export function daysBetweenInclusive(a?: string | null, b?: string | null): number {
  const da = parseISO(a ?? undefined);
  const db = parseISO(b ?? undefined);
  if (!da || !db) return 0;
  const ms = db.getTime() - da.getTime();
  if (Number.isNaN(ms)) return 0;
  // +1 för inklusiv räkning
  return Math.floor(ms / 86400000) + 1;
}

/** FTE-dagar för ett intervall och en sysselsättningsgrad (0–100). */
export function fteDays(start?: string | null, end?: string | null, attendance?: number | null): number {
  const d = daysBetweenInclusive(start ?? undefined, end ?? undefined);
  const pct = Math.min(Math.max(attendance ?? 100, 0), 100) / 100;
  return Math.max(0, Math.round(d * pct));
}

/** Omvandla dagar → månader (12 mån = 365 dgr). */
export function monthsFromDays(days: number): number {
  return (days * 12) / 365;
}

/** Formattera som "123 dgr≈4,1 mån". (Mellanslag läggs i UI vid behov.) */
export function fmtDaysMonths(days: number): string {
  return `${days} dgr≈${monthsFromDays(days).toLocaleString("sv-SE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })} mån`;
}

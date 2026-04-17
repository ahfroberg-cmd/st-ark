"use client";

function dateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function halfMidDateISO(year: number, month0: number, half: 0 | 1): string {
  if (!Number.isFinite(year) || !Number.isFinite(month0)) {
    return dateToISO(new Date());
  }
  const day = half === 0 ? 7 : 21;
  const d = new Date(year, month0, day);
  const targetMonth = month0;
  let iterations = 0;
  while (d.getMonth() !== targetMonth && iterations < 35) {
    d.setDate(d.getDate() - 1);
    iterations++;
  }
  return dateToISO(d);
}

export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((+d - +start) / 86400000);
}

export function daysInYear(year: number): number {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

export function addMonths(d: Date, months: number): Date {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const whole = Math.trunc(months);
  const frac = months - whole;
  const base = new Date(y, m + whole, day);
  if (frac !== 0) {
    const next = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());
    const diffMs = +next - +base;
    base.setTime(+base + diffMs * frac);
  }
  return base;
}

export function nextSundayOnOrAfter(d: Date): Date {
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const w = res.getDay();
  const add = (7 - w) % 7;
  res.setDate(res.getDate() + add);
  return res;
}

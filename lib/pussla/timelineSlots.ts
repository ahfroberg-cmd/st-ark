import { isValidISO } from "@/lib/pussla/isoDates";

export const SLOT_COLUMNS_PER_YEAR = 24;

export function slotToYearMonthHalf(startYear: number, slot: number) {
  const yearOffset = Math.floor(slot / SLOT_COLUMNS_PER_YEAR);
  const inYear = slot % SLOT_COLUMNS_PER_YEAR;
  const month0 = Math.floor(inYear / 2);
  const half = (inYear % 2) as 0 | 1;
  return { year: startYear + yearOffset, month0, half };
}

export function dateToSlot(
  startYear: number,
  dISO: string,
  mode: "start" | "end" = "start"
) {
  if (!isValidISO(dISO)) return Number.POSITIVE_INFINITY;
  const d = new Date(dISO + "T00:00:00");
  let y = d.getFullYear();
  let m0 = d.getMonth();
  const day = d.getDate();

  if (mode === "end") {
    if (day <= 7) {
      return (y - startYear) * SLOT_COLUMNS_PER_YEAR + m0 * 2 + 0;
    }
    if (day <= 22) {
      return (y - startYear) * SLOT_COLUMNS_PER_YEAR + m0 * 2 + 1;
    }
    m0 += 1;
    if (m0 >= 12) {
      m0 = 0;
      y += 1;
    }
    return (y - startYear) * SLOT_COLUMNS_PER_YEAR + m0 * 2 + 0;
  }

  if (day <= 7) {
    return (y - startYear) * SLOT_COLUMNS_PER_YEAR + m0 * 2 + 0;
  }
  if (day <= 22) {
    return (y - startYear) * SLOT_COLUMNS_PER_YEAR + m0 * 2 + 1;
  }
  m0 += 1;
  if (m0 >= 12) {
    m0 = 0;
    y += 1;
  }
  return (y - startYear) * SLOT_COLUMNS_PER_YEAR + m0 * 2 + 0;
}

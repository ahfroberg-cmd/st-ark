import { normalizeDateAnchor, pickTrainingStartAnchorISO } from "@/lib/pussla/startAnchors";

type CombinedMonthsOptions = {
  goalsVersion: unknown;
  btStartDate: unknown;
  stStartDate: unknown;
  stEndDate: unknown;
  stEndISO: unknown;
  totalPlanMonths: number;
  isValidISO: (iso: string) => boolean;
  monthDiffExact: (startISO?: string, endISO?: string) => number;
};

export function computeTotalCombinedMonths(options: CombinedMonthsOptions): number {
  const {
    goalsVersion,
    btStartDate,
    stStartDate,
    stEndDate,
    stEndISO,
    totalPlanMonths,
    isValidISO,
    monthDiffExact,
  } = options;

  const goals = String(goalsVersion || "");
  if (!goals.includes("2021")) return totalPlanMonths || 60;

  const startISO = pickTrainingStartAnchorISO({
    goalsVersion: "2021",
    btStartDate,
    stStartDate,
    isValidISO,
  });
  if (!startISO) return totalPlanMonths || 66;

  const stEndManual = normalizeDateAnchor(stEndDate);
  if (stEndManual && isValidISO(stEndManual)) {
    const months = monthDiffExact(startISO, stEndManual);
    return months > 0 ? months : totalPlanMonths || 66;
  }

  const stEndCalc = normalizeDateAnchor(stEndISO);
  if (stEndCalc && isValidISO(stEndCalc)) {
    const months = monthDiffExact(startISO, stEndCalc);
    return months > 0 ? months : totalPlanMonths || 66;
  }

  return totalPlanMonths || 66;
}

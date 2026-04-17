export function normalizePlacementMonths(inputMonths: number): {
  months: number;
  lengthSlots: number;
} {
  const months = Math.max(0.5, Math.min(120, inputMonths));
  return {
    months,
    lengthSlots: Math.round(months * 2),
  };
}

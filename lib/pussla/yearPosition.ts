export function computeYearPercent(date: Date, year: number): number {
  const startOfYear = new Date(year, 0, 1);
  const startOfNextYear = new Date(year + 1, 0, 1);
  const msInDay = 24 * 60 * 60 * 1000;

  const dayIndex = Math.floor((date.getTime() - startOfYear.getTime()) / msInDay);
  const daysInYearLocal = Math.max(
    1,
    Math.floor((startOfNextYear.getTime() - startOfYear.getTime()) / msInDay)
  );
  const frac = Math.min(Math.max(dayIndex / daysInYearLocal, 0), 1);
  return frac * 100;
}

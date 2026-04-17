type ActivityLike = {
  id: string;
};

type FindEarliestActivityYearInput<T extends ActivityLike> = {
  activities: T[];
  displayDatesForActivity: (activity: T) => { startISO: string; endISO: string };
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
};

export function findEarliestActivityYear<T extends ActivityLike>(
  input: FindEarliestActivityYearInput<T>
): number | null {
  const { activities, displayDatesForActivity, isValidISO, isoToDateSafe } = input;
  let earliestYear = Number.POSITIVE_INFINITY;

  for (const activity of activities) {
    const { startISO } = displayDatesForActivity(activity);
    if (!isValidISO(startISO)) continue;
    const year = isoToDateSafe(startISO).getFullYear();
    if (!Number.isFinite(year)) continue;
    earliestYear = Math.min(earliestYear, year);
  }

  if (!Number.isFinite(earliestYear)) return null;
  if (earliestYear < 1990 || earliestYear > 2100) return null;
  return earliestYear;
}

import {
  mergeLockedActivitiesWithDraft,
  mergeLockedCoursesWithDraft,
  pickDraftOnlyActivities,
  pickDraftOnlyCourses,
} from "@/lib/pussla/timelineMerge";
import { computeTimelineYearBounds } from "@/lib/pussla/timelineBounds";
import { normalizeDateAnchor, pickTrainingStartAnchorISO } from "@/lib/pussla/startAnchors";

type RowLike = Record<string, any>;

type EffectiveYearOptions = {
  profile: RowLike | null | undefined;
  fallbackStartYear: number;
  isValidISO: (iso: string) => boolean;
  placements?: RowLike[];
  courses?: RowLike[];
};

export function computeEffectiveStartYear(options: EffectiveYearOptions): number {
  const { profile, fallbackStartYear, isValidISO, placements = [], courses = [] } = options;
  if (!profile) return fallbackStartYear;
  const pickISO = pickTrainingStartAnchorISO({
    goalsVersion: profile?.goalsVersion,
    btStartDate: profile?.btStartDate,
    stStartDate: profile?.stStartDate,
    isValidISO,
  });
  if (!pickISO) return fallbackStartYear;
  const profileYear = new Date(`${pickISO}T00:00:00`).getFullYear();
  const profileValid = Number.isFinite(profileYear) && profileYear >= 1990 && profileYear <= 2100;

  let earliestDataYear = Number.POSITIVE_INFINITY;
  const pushYear = (isoRaw: unknown) => {
    const iso = normalizeDateAnchor(isoRaw);
    if (!iso || !isValidISO(iso)) return;
    const y = new Date(`${iso}T00:00:00`).getFullYear();
    if (!Number.isFinite(y) || y < 1990 || y > 2100) return;
    earliestDataYear = Math.min(earliestDataYear, y);
  };

  for (const p of placements || []) {
    pushYear(p?.startDate ?? p?.start_date);
    pushYear(p?.endDate ?? p?.end_date);
  }
  for (const c of courses || []) {
    pushYear(c?.startDate ?? c?.start_date);
    pushYear(c?.certificateDate ?? c?.certificate_date);
    pushYear(c?.endDate ?? c?.end_date);
  }

  const dataValid = Number.isFinite(earliestDataYear);
  if (profileValid && dataValid) return Math.min(profileYear, earliestDataYear);
  if (profileValid) return profileYear;
  if (dataValid) return earliestDataYear;
  return fallbackStartYear;
}

type ComposeOptions = {
  lockedActivities: RowLike[];
  lockedCourses: RowLike[];
  draftActivities: RowLike[];
  draftCourses: RowLike[];
  profile: RowLike;
  stStartISO: string | null | undefined;
  effectiveStartYear: number;
  totalYearsNeeded: number;
  lsAbove: number;
  lsBelow: number;
  maxExtraYears: number;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  dateToSlot: (startYear: number, iso: string, edge: "start" | "end") => number;
  slotToYearMonthHalf: (startYear: number, slot: number) => { year: number; month0: number; half: number };
  mondayNearestTo: (year: number, month0: number, day: number) => Date;
  dateToISO: (date: Date) => string;
};

export function composeHydratedTimelineState(options: ComposeOptions): {
  allActivities: RowLike[];
  allCourses: RowLike[];
  nextAbove: number;
  nextBelow: number;
} {
  const mergedActs = mergeLockedActivitiesWithDraft({
    lockedActivities: options.lockedActivities,
    draftActivities: options.draftActivities,
    profile: options.profile,
    stStartISO: options.stStartISO,
    effectiveStartYear: options.effectiveStartYear,
    isValidISO: options.isValidISO,
    dateToSlot: options.dateToSlot,
    slotToYearMonthHalf: options.slotToYearMonthHalf,
    mondayNearestTo: options.mondayNearestTo,
    dateToISO: options.dateToISO,
  });

  const mergedCourses = mergeLockedCoursesWithDraft(
    options.lockedCourses,
    options.draftCourses
  );

  const draftOnlyActs = pickDraftOnlyActivities(options.draftActivities, mergedActs);
  const draftOnlyCourses = pickDraftOnlyCourses(options.draftCourses, mergedCourses);
  const allActivities = [...mergedActs, ...draftOnlyActs];
  const allCourses = [...mergedCourses, ...draftOnlyCourses];

  const { nextAbove, nextBelow } = computeTimelineYearBounds({
    activities: allActivities,
    courses: allCourses,
    effectiveStartYear: options.effectiveStartYear,
    totalYearsNeeded: options.totalYearsNeeded,
    lsAbove: options.lsAbove,
    lsBelow: options.lsBelow,
    maxExtraYears: options.maxExtraYears,
    isValidISO: options.isValidISO,
    isoToDateSafe: options.isoToDateSafe,
    slotToYearMonthHalf: options.slotToYearMonthHalf,
  });

  return { allActivities, allCourses, nextAbove, nextBelow };
}

/**
 * Klinikens förväntade volymer handledning per år (Dashboard → IUP → Handledning).
 * Lagras som systemrad i clinic_activity_templates med titel IUP_HANDLEDNING_CONFIG_TITLE.
 */

export const IUP_HANDLEDNING_CONFIG_TITLE = "__config__:iup-handledning-expectations";

const PREFIX = "__iup_handledning_expectations_json__:";

export type IupHandledningExpectationsPerYear = {
  /** Huvudhandledarsamtal */
  mainSupervisorMeetings: number;
  /** Progressionsbedömningar */
  progressAssessments: number;
  /** Studierektorssamtal */
  directorMeetings: number;
  /** Specialistkollegium */
  specialistCollegium: number;
};

export const DEFAULT_IUP_HANDLEDNING_EXPECTATIONS: IupHandledningExpectationsPerYear = {
  mainSupervisorMeetings: 9,
  progressAssessments: 6,
  directorMeetings: 2,
  specialistCollegium: 1,
};

const KEYS = [
  "mainSupervisorMeetings",
  "progressAssessments",
  "directorMeetings",
  "specialistCollegium",
] as const;

export function clampHandledningExpectation(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(52, Math.round(n)));
}

function normalizeExpectations(
  raw: Partial<Record<(typeof KEYS)[number], unknown>>
): IupHandledningExpectationsPerYear {
  const out = { ...DEFAULT_IUP_HANDLEDNING_EXPECTATIONS };
  for (const k of KEYS) {
    const v = raw[k];
    const num = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(num)) out[k] = clampHandledningExpectation(num);
  }
  return out;
}

export function parseIupHandledningConfig(rows: string[]): IupHandledningExpectationsPerYear | null {
  for (const raw of rows || []) {
    const value = String(raw || "").trim();
    if (!value.startsWith(PREFIX)) continue;
    try {
      const parsed = JSON.parse(value.slice(PREFIX.length));
      if (!parsed || typeof parsed !== "object") return null;
      return normalizeExpectations(parsed as Partial<IupHandledningExpectationsPerYear>);
    } catch {
      return null;
    }
  }
  return null;
}

export function encodeIupHandledningConfig(e: IupHandledningExpectationsPerYear): string[] {
  const n = normalizeExpectations(e);
  return [`${PREFIX}${JSON.stringify(n)}`];
}

/**
 * Förväntat antal tillfällen under ett tidsintervall (linjär fördelning över året).
 * Ex. per år 6 → 3 på 6 månader.
 */
export function expectedCountForWindowMonths(perYear: number, windowMonths: number): number {
  const y = clampHandledningExpectation(perYear);
  const w = Math.max(0, Math.min(24, windowMonths));
  return Math.round((y * w) / 12 * 10) / 10;
}

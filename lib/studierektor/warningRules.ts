import { isValidISODate } from "@/lib/studierektor/dateUtils";
import type { WarningActivityKind, WarningRuleType } from "@/lib/studierektor/warningRuleTypes";

type WarningRuleLike = {
  type: WarningRuleType;
  params: {
    activityKind?: WarningActivityKind;
  };
};

export function medianFinite(nums: number[]): number | null {
  const arr = nums.filter((n) => Number.isFinite(n));
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function meanFinite(nums: number[]): number | null {
  const arr = nums.filter((n) => Number.isFinite(n));
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function monthsLeftFromEndISO(endISO: string): number | null {
  const todayISO = new Date().toISOString().slice(0, 10);
  if (!endISO || !isValidISODate(endISO)) return null;
  return Math.round(
    (new Date(`${endISO}T00:00:00`).getTime() - new Date(`${todayISO}T00:00:00`).getTime()) /
      (1000 * 60 * 60 * 24 * 30.4375)
  );
}

export function warningRuleHeadline(rule: WarningRuleLike): string {
  if (rule.type === "milestone_overall") return "Delmål totalt (hela ST-tiden)";
  if (rule.type === "milestone_activity") {
    const kind = rule.params.activityKind || "placering";
    const k = kind === "kurs" ? "kurser" : kind === "arbete" ? "arbeten" : "kliniska tjänstgöringar";
    return `Delmål för ${k}`;
  }
  return "Obligatoriska kliniska tjänstgöringar";
}

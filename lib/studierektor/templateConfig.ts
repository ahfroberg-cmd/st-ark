import type {
  WarningActivityKind,
  WarningRule,
  WarningRuleType,
} from "@/lib/studierektor/warningRuleTypes";

export const TIMELINE_WARNING_CONFIG_PREFIX = "__timeline_warning_rules_json__:";
export const SUGGESTED_PERIOD_MONTHS_PREFIX = "__suggested_period_months__:";
export const ALTERNATIVE_PREFIX = "__alternativ__:";
type WarningRuleLike = WarningRule;

export function parseSuggestedPeriodMonths(rows: string[]): number | null {
  for (const raw of rows || []) {
    const value = String(raw || "").trim();
    if (!value.startsWith(SUGGESTED_PERIOD_MONTHS_PREFIX)) continue;
    const parsed = Number(value.slice(SUGGESTED_PERIOD_MONTHS_PREFIX.length).trim().replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function parseTemplateAlternatives(rows: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rows || []) {
    const value = String(raw || "").trim();
    if (!value.startsWith(ALTERNATIVE_PREFIX)) continue;
    const title = value.slice(ALTERNATIVE_PREFIX.length).trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

export function parseTimelineWarningRules(rows: string[]): WarningRuleLike[] {
  for (const raw of rows || []) {
    const value = String(raw || "").trim();
    if (!value.startsWith(TIMELINE_WARNING_CONFIG_PREFIX)) continue;
    try {
      const parsed = JSON.parse(value.slice(TIMELINE_WARNING_CONFIG_PREFIX.length));
      if (!Array.isArray(parsed?.rules)) return [];
      return parsed.rules
        .map((r: any) => ({
          id: String(r?.id || crypto.randomUUID()),
          type: r?.type as WarningRuleType,
          enabled: r?.enabled !== false,
          params: {
            monthsLeftThreshold: Number(r?.params?.monthsLeftThreshold ?? 6),
            minProgressPercent: Number(r?.params?.minProgressPercent ?? 70),
            activityKind: r?.params?.activityKind as WarningActivityKind,
            placementTemplateTitle: String(r?.params?.placementTemplateTitle || ""),
            minMonths: Number(r?.params?.minMonths ?? 6),
          },
        }))
        .filter(
          (r: WarningRuleLike) =>
            r.type === "milestone_overall" || r.type === "milestone_activity" || r.type === "mandatory_placement"
        );
    } catch {
      return [];
    }
  }
  return [];
}

export function encodeTimelineWarningRules(rules: WarningRuleLike[]): string[] {
  return [
    `${TIMELINE_WARNING_CONFIG_PREFIX}${JSON.stringify({
      rules: rules.map((r) => ({
        id: r.id,
        type: r.type,
        enabled: r.enabled,
        params: r.params,
      })),
    })}`,
  ];
}

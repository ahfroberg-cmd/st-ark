const COURSE_GROUPS_CONFIG_PREFIX = "__course_groups_config_json__:";
const REQUIRED_ROW_PREFIX = "__required__:";
const RECOMMENDED_ROW_PREFIX = "__recommended__:";
const SUGGESTED_PERIOD_MONTHS_PREFIX = "__suggested_period_months__:";
const COURSE_GROUP_PREFIX = "__course_group__:";
const UTBILDNINGSMOMENT_INSTANCE_TYPE_PREFIX = "__utb_moment_typ__:";
const REQUIREMENT_LEVEL_PREFIX = "__kravniva__:";
const ALTERNATIVE_PREFIX = "__alternativ__:";

export function splitTemplateSuggestedRows(rows: string[]): { required: string[]; recommended: string[] } {
  const required: string[] = [];
  const recommended: string[] = [];
  for (const raw of rows || []) {
    const value = String(raw || "").trim();
    if (!value) continue;
    if (value.startsWith(COURSE_GROUP_PREFIX)) continue;
    if (value.startsWith(REQUIREMENT_LEVEL_PREFIX)) continue;
    if (value.startsWith(UTBILDNINGSMOMENT_INSTANCE_TYPE_PREFIX)) continue;
    if (value.startsWith(SUGGESTED_PERIOD_MONTHS_PREFIX)) continue;
    if (value.startsWith(ALTERNATIVE_PREFIX)) continue;
    if (value.startsWith(RECOMMENDED_ROW_PREFIX)) {
      const cleaned = value.slice(RECOMMENDED_ROW_PREFIX.length).trim();
      if (cleaned) recommended.push(cleaned);
      continue;
    }
    if (value.startsWith(REQUIRED_ROW_PREFIX)) {
      const cleaned = value.slice(REQUIRED_ROW_PREFIX.length).trim();
      if (cleaned) required.push(cleaned);
      continue;
    }
    required.push(value);
  }
  return { required, recommended };
}

export function getTemplateSuggestedPeriodMonths(rows: string[]): number | null {
  for (const raw of rows || []) {
    const value = String(raw || "").trim();
    if (!value.startsWith(SUGGESTED_PERIOD_MONTHS_PREFIX)) continue;
    const parsed = Number(value.slice(SUGGESTED_PERIOD_MONTHS_PREFIX.length).trim().replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function getCourseTemplateGroup(rows: string[]): string {
  for (const raw of rows || []) {
    const value = String(raw || "").trim();
    if (!value.startsWith(COURSE_GROUP_PREFIX)) continue;
    return value.slice(COURSE_GROUP_PREFIX.length).trim();
  }
  return "";
}

export function parseCourseGroupsConfig(rows: string[]): string[] {
  for (const raw of rows || []) {
    const value = String(raw || "").trim();
    if (!value.startsWith(COURSE_GROUPS_CONFIG_PREFIX)) continue;
    const payload = value.slice(COURSE_GROUPS_CONFIG_PREFIX.length);
    try {
      const parsed = JSON.parse(payload);
      if (!Array.isArray(parsed?.groups)) return [];
      return parsed.groups.map((x: unknown) => String(x || "").trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

export function shiftIsoDays(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function nearestSundayISO(targetIso: string): string {
  const base = new Date(`${targetIso}T00:00:00`);
  const day = base.getDay(); // 0 = Sunday
  const prevOffset = day;
  const nextOffset = day === 0 ? 0 : 7 - day;
  const prev = new Date(base);
  prev.setDate(base.getDate() - prevOffset);
  const next = new Date(base);
  next.setDate(base.getDate() + nextOffset);
  const prevDist = Math.abs(base.getTime() - prev.getTime());
  const nextDist = Math.abs(next.getTime() - base.getTime());
  const pick = nextDist < prevDist ? next : prev;
  const mm = String(pick.getMonth() + 1).padStart(2, "0");
  const dd = String(pick.getDate()).padStart(2, "0");
  return `${pick.getFullYear()}-${mm}-${dd}`;
}

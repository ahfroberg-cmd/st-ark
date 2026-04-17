/**
 * Klinikens standardlista för bedömningsinstrument i progressionsbedömningar
 * (Dashboard → IUP → Handledning, högerkolumn).
 * Lagras som systemrad i clinic_activity_templates med titel IUP_PROGRESSION_INSTRUMENTS_CONFIG_TITLE.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const IUP_PROGRESSION_INSTRUMENTS_CONFIG_TITLE = "__config__:iup-progression-instruments";

const PREFIX = "__iup_progression_instruments_json__:";

/** Samma fördefinierade instrument som i ST-läkarens IUP (Progression → instrument). */
export const DEFAULT_PROGRESSION_INSTRUMENTS: readonly string[] = [
  "Medsittning/Sit-in",
  "Mini-CEX",
  "360 grader",
  "Case-based discussion (CBD)",
  "Direct Observation of Procedural Skills (DOPS)",
];

export type IupProgressionInstrumentsClinicConfig = {
  /** Delmängd av DEFAULT_PROGRESSION_INSTRUMENTS som studierektorn valt. */
  selectedPredefined: string[];
  /** Klinikens egna tillägg. */
  customSuggestions: string[];
};

export function defaultClinicProgressionInstrumentsConfig(): IupProgressionInstrumentsClinicConfig {
  return {
    selectedPredefined: [...DEFAULT_PROGRESSION_INSTRUMENTS],
    customSuggestions: [],
  };
}

/** Ordning: valda fördefinierade i standardordning, därefter egna (utan dubbletter). */
export function mergeProgressionInstrumentsSynthesis(
  selectedPredefined: string[],
  customSuggestions: string[]
): string[] {
  const predefinedOrder = DEFAULT_PROGRESSION_INSTRUMENTS.filter((p) => selectedPredefined.includes(p));
  const custom = (customSuggestions || [])
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  const seen = new Set(predefinedOrder.map((x) => x.toLowerCase()));
  const out = [...predefinedOrder];
  for (const c of custom) {
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

export function synthesisFromClinicConfig(cfg: IupProgressionInstrumentsClinicConfig | null): string[] {
  if (!cfg) return [...DEFAULT_PROGRESSION_INSTRUMENTS];
  return mergeProgressionInstrumentsSynthesis(cfg.selectedPredefined, cfg.customSuggestions);
}

export function parseIupProgressionInstrumentsConfig(
  rows: string[]
): IupProgressionInstrumentsClinicConfig | null {
  for (const raw of rows || []) {
    const value = String(raw || "").trim();
    if (!value.startsWith(PREFIX)) continue;
    try {
      const parsed = JSON.parse(value.slice(PREFIX.length));
      const selectedRaw = Array.isArray(parsed?.selectedPredefined)
        ? parsed.selectedPredefined.map((x: unknown) => String(x || "").trim()).filter(Boolean)
        : [];
      const customSuggestions = Array.isArray(parsed?.customSuggestions)
        ? parsed.customSuggestions.map((x: unknown) => String(x || "").trim()).filter(Boolean)
        : [];
      const validSelected = DEFAULT_PROGRESSION_INSTRUMENTS.filter((p) => selectedRaw.includes(p));
      return {
        selectedPredefined:
          validSelected.length > 0 ? validSelected : [...DEFAULT_PROGRESSION_INSTRUMENTS],
        customSuggestions,
      };
    } catch {
      return null;
    }
  }
  return null;
}

export function encodeIupProgressionInstrumentsConfig(
  cfg: IupProgressionInstrumentsClinicConfig
): string[] {
  let selected = DEFAULT_PROGRESSION_INSTRUMENTS.filter((p) =>
    (cfg.selectedPredefined || []).includes(p)
  );
  if (selected.length === 0) selected = [...DEFAULT_PROGRESSION_INSTRUMENTS];
  const custom = Array.from(
    new Set((cfg.customSuggestions || []).map((s) => String(s || "").trim()).filter(Boolean))
  );
  const payload: IupProgressionInstrumentsClinicConfig = {
    selectedPredefined: selected,
    customSuggestions: custom,
  };
  return [`${PREFIX}${JSON.stringify(payload)}`];
}

/**
 * Hämtar den sammanslagna standardlistan för inloggad användares klinik (första membership).
 */
export async function fetchClinicProgressionInstrumentsSynthesis(
  supabase: SupabaseClient
): Promise<string[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return [...DEFAULT_PROGRESSION_INSTRUMENTS];
    const { data: membershipRows } = await supabase
      .from("clinic_memberships")
      .select("clinic_id")
      .eq("user_id", user.id)
      .limit(1);
    const clinicId =
      Array.isArray(membershipRows) && membershipRows[0]?.clinic_id
        ? String(membershipRows[0].clinic_id)
        : "";
    if (!clinicId) return [...DEFAULT_PROGRESSION_INSTRUMENTS];
    const { data: cfgRows } = await supabase
      .from("clinic_activity_templates")
      .select("suggested_rows")
      .eq("clinic_id", clinicId)
      .eq("title", IUP_PROGRESSION_INSTRUMENTS_CONFIG_TITLE)
      .order("updated_at", { ascending: false })
      .limit(1);
    const cfgRow = Array.isArray(cfgRows) ? cfgRows[0] : null;
    const parsed = parseIupProgressionInstrumentsConfig(
      Array.isArray((cfgRow as { suggested_rows?: string[] })?.suggested_rows)
        ? (cfgRow as { suggested_rows: string[] }).suggested_rows
        : []
    );
    return synthesisFromClinicConfig(parsed);
  } catch {
    return [...DEFAULT_PROGRESSION_INSTRUMENTS];
  }
}

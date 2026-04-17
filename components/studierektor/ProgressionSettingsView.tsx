"use client";

import type {
  WarningActivityKind,
  WarningRule,
  WarningRuleType,
} from "@/lib/studierektor/warningRuleTypes";

export default function ProgressionSettingsView({
  warningRules,
  setWarningRules,
  saveWarningRules,
  newRuleType,
  setNewRuleType,
  newRuleMonthsThreshold,
  setNewRuleMonthsThreshold,
  newRuleMinProgress,
  setNewRuleMinProgress,
  newRuleActivityKind,
  setNewRuleActivityKind,
}: {
  warningRules: WarningRule[];
  setWarningRules: (next: WarningRule[]) => void;
  saveWarningRules: (nextRules: WarningRule[]) => Promise<boolean>;
  newRuleType: WarningRuleType;
  setNewRuleType: (next: WarningRuleType) => void;
  newRuleMonthsThreshold: number;
  setNewRuleMonthsThreshold: (next: number) => void;
  newRuleMinProgress: number;
  setNewRuleMinProgress: (next: number) => void;
  newRuleActivityKind: WarningActivityKind;
  setNewRuleActivityKind: (next: WarningActivityKind) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-300 bg-white p-3">
        <div className="mb-2 text-sm font-semibold text-slate-900">Lägg till regel</div>
        <div className="grid gap-2 md:grid-cols-2">
          <select
            value={newRuleType}
            onChange={(e) => setNewRuleType(e.target.value as WarningRuleType)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="milestone_overall">Delmålsuppfyllnad generellt</option>
            <option value="milestone_activity">Delmålsuppfyllnad per aktivitetstyp</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span>Varning när ≤</span>
            <input
              type="number"
              min={0}
              value={newRuleMonthsThreshold}
              onChange={(e) => setNewRuleMonthsThreshold(Number(e.target.value || 0))}
              className="w-20 rounded border border-slate-300 px-2 py-1"
            />
            <span>mån kvar</span>
          </label>
          {newRuleType === "milestone_activity" && (
            <select
              value={newRuleActivityKind}
              onChange={(e) => setNewRuleActivityKind(e.target.value as WarningActivityKind)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="placering">Kliniska tjänstgöringar</option>
              <option value="kurs">Kurser</option>
              <option value="arbete">Arbeten</option>
            </select>
          )}
          {newRuleType !== "mandatory_placement" && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span>Min progress %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={newRuleMinProgress}
                onChange={(e) => setNewRuleMinProgress(Number(e.target.value || 0))}
                className="w-20 rounded border border-slate-300 px-2 py-1"
              />
            </label>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={async () => {
              const newRule: WarningRule = {
                id: crypto.randomUUID(),
                type: newRuleType,
                enabled: true,
                params:
                  newRuleType === "milestone_overall"
                    ? {
                        monthsLeftThreshold: newRuleMonthsThreshold,
                        minProgressPercent: newRuleMinProgress,
                      }
                    : newRuleType === "milestone_activity"
                      ? {
                          monthsLeftThreshold: newRuleMonthsThreshold,
                          minProgressPercent: newRuleMinProgress,
                          activityKind: newRuleActivityKind,
                        }
                      : {},
              };
              const next = [...warningRules, newRule];
              setWarningRules(next);
              await saveWarningRules(next);
            }}
            className="rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Lägg till
          </button>
        </div>
      </div>

      {warningRules
        .filter((rule) => rule.type !== "mandatory_placement")
        .map((rule) => (
          <div key={rule.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">
                {rule.type === "milestone_overall"
                  ? "Delmålsuppfyllnad generellt"
                  : rule.type === "milestone_activity"
                    ? `Delmålsuppfyllnad (${rule.params.activityKind || "placering"})`
                    : "Obligatoriska kliniska tjänstgöringar"}
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={async (e) => {
                      const next = warningRules.map((r) =>
                        r.id === rule.id ? { ...r, enabled: e.target.checked } : r,
                      );
                      setWarningRules(next);
                      await saveWarningRules(next);
                    }}
                  />
                  Aktiv
                </label>
                {rule.type !== "mandatory_placement" && (
                  <button
                    type="button"
                    onClick={async () => {
                      const next = warningRules.filter((r) => r.id !== rule.id);
                      setWarningRules(next);
                      await saveWarningRules(next);
                    }}
                    className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    Ta bort
                  </button>
                )}
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {rule.type !== "mandatory_placement"
                ? `Tröskel: ≤ ${rule.params.monthsLeftThreshold ?? 6} månader kvar • Min progress: ${rule.params.minProgressPercent ?? 70}%`
                : "Regeln summerar alla SR-definierade kliniska tjänstgöringar med minimumtid och jämför mot kvarvarande ST-tid samt planerad framtid i tidslinjen."}
            </div>
          </div>
        ))}

      {warningRules
        .filter((rule) => rule.type === "mandatory_placement")
        .map((rule) => (
          <div key={rule.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900">
                {rule.type === "milestone_overall"
                  ? "Delmålsuppfyllnad generellt"
                  : rule.type === "milestone_activity"
                    ? `Delmålsuppfyllnad (${rule.params.activityKind || "placering"})`
                    : "Obligatoriska kliniska tjänstgöringar"}
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={async (e) => {
                      const next = warningRules.map((r) =>
                        r.id === rule.id ? { ...r, enabled: e.target.checked } : r,
                      );
                      setWarningRules(next);
                      await saveWarningRules(next);
                    }}
                  />
                  Aktiv
                </label>
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Regeln summerar alla SR-definierade kliniska tjänstgöringar med minimumtid och jämför mot kvarvarande ST-tid samt planerad framtid i tidslinjen.
            </div>
          </div>
        ))}
    </div>
  );
}

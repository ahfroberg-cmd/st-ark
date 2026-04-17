"use client";

import { useCallback, useState } from "react";
import {
  DEFAULT_PROGRESSION_INSTRUMENTS,
  mergeProgressionInstrumentsSynthesis,
  type IupProgressionInstrumentsClinicConfig,
} from "@/lib/dashboard/iupProgressionInstruments";

export type IupProgressionInstrumentsConfigPanelProps = {
  value: IupProgressionInstrumentsClinicConfig;
  onChange: (next: IupProgressionInstrumentsClinicConfig) => void;
  onSave: (next: IupProgressionInstrumentsClinicConfig) => void | Promise<void>;
  saving: boolean;
  disabled?: boolean;
};

export default function IupProgressionInstrumentsConfigPanel({
  value,
  onChange,
  onSave,
  saving,
  disabled,
}: IupProgressionInstrumentsConfigPanelProps) {
  const [newCustom, setNewCustom] = useState("");

  const synthesis = mergeProgressionInstrumentsSynthesis(
    value.selectedPredefined,
    value.customSuggestions
  );

  const togglePredefined = useCallback(
    (name: string, checked: boolean) => {
      const set = new Set(value.selectedPredefined);
      if (checked) set.add(name);
      else set.delete(name);
      let nextSel = DEFAULT_PROGRESSION_INSTRUMENTS.filter((p) => set.has(p));
      if (nextSel.length === 0) nextSel = [...DEFAULT_PROGRESSION_INSTRUMENTS];
      onChange({ ...value, selectedPredefined: nextSel });
    },
    [value, onChange]
  );

  const addCustom = useCallback(() => {
    const t = newCustom.trim();
    if (!t) return;
    if (value.customSuggestions.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setNewCustom("");
      return;
    }
    onChange({ ...value, customSuggestions: [...value.customSuggestions, t] });
    setNewCustom("");
  }, [newCustom, value, onChange]);

  const removeCustom = useCallback(
    (title: string) => {
      onChange({
        ...value,
        customSuggestions: value.customSuggestions.filter((x) => x !== title),
      });
    },
    [value, onChange]
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Standard för progressionsbedömningar – instrument
        </h3>
      </div>

      <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 text-xs font-semibold text-slate-700">1) Fördefinierade förslag</div>
        <div className="grid gap-2">
          {DEFAULT_PROGRESSION_INSTRUMENTS.map((name) => {
            const checked = value.selectedPredefined.includes(name);
            return (
              <label
                key={name}
                className="inline-flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => togglePredefined(name, e.target.checked)}
                />
                <span>{name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 text-xs font-semibold text-slate-700">2) Egna instrument</div>
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            value={newCustom}
            disabled={disabled}
            onChange={(e) => setNewCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              addCustom();
            }}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
            placeholder="Namn på instrument"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={addCustom}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Lägg till
          </button>
        </div>
        <div className="space-y-1">
          {value.customSuggestions.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
              Inga egna instrument ännu.
            </div>
          )}
          {value.customSuggestions.map((title) => (
            <div
              key={title}
              className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5"
            >
              <span className="text-sm text-slate-700">{title}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeCustom(title)}
                className="text-xs font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50"
              >
                Ta bort
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 text-xs font-semibold text-slate-700">3) Förhandsgranskning för ST-läkare</div>
        <div className="flex flex-wrap gap-2">
          {synthesis.length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
              Inga instrument valda.
            </div>
          ) : (
            synthesis.map((title) => (
              <div
                key={title}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
              >
                {title}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void onSave(value)}
          disabled={disabled || saving}
          className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {saving ? "Sparar..." : "Spara instrument"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { IupHandledningExpectationsPerYear } from "@/lib/dashboard/iupHandledningExpectations";
import { clampHandledningExpectation } from "@/lib/dashboard/iupHandledningExpectations";

type FieldKey = keyof IupHandledningExpectationsPerYear;

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "mainSupervisorMeetings", label: "Huvudhandledarsamtal" },
  { key: "progressAssessments", label: "Progressionsbedömningar" },
  { key: "directorMeetings", label: "Studierektorssamtal" },
  { key: "specialistCollegium", label: "Specialistkollegium" },
];

export type IupHandledningTabProps = {
  value: IupHandledningExpectationsPerYear;
  onChange: (next: IupHandledningExpectationsPerYear) => void;
  /** Anropas med aktuella värden (inkl. fält som inte blur:ats än). */
  onSave: (expectations: IupHandledningExpectationsPerYear) => void | Promise<void>;
  saving: boolean;
  disabled?: boolean;
};

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

export default function IupHandledningTab({ value, onChange, onSave, saving, disabled }: IupHandledningTabProps) {
  const [editingKey, setEditingKey] = useState<FieldKey | null>(null);
  const [editingText, setEditingText] = useState("");

  const displayFor = (key: FieldKey): string => {
    if (editingKey === key) return editingText;
    const n = value[key];
    return n === 0 ? "" : String(n);
  };

  /** Slår ihop ev. pågående redigering med `value` (samma som efter blur). */
  const commitPending = (): IupHandledningExpectationsPerYear => {
    if (editingKey == null) return value;
    const raw = digitsOnly(editingText);
    const n = raw === "" ? 0 : clampHandledningExpectation(Number(raw));
    return { ...value, [editingKey]: n };
  };

  const commitField = (key: FieldKey, text: string) => {
    const raw = digitsOnly(text);
    const n = raw === "" ? 0 : clampHandledningExpectation(Number(raw));
    onChange({ ...value, [key]: n });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Handledning – mål per år</h3>
      </div>

      <div className="grid max-w-md grid-cols-1 gap-4">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="block text-xs font-semibold text-slate-800" htmlFor={`iup-hh-${key}`}>
              {label} <span className="font-normal text-slate-500">(per år)</span>
            </label>
            <input
              id={`iup-hh-${key}`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              disabled={disabled}
              value={displayFor(key)}
              onFocus={() => {
                setEditingKey(key);
                setEditingText(value[key] === 0 ? "" : String(value[key]));
              }}
              onChange={(e) => {
                setEditingText(digitsOnly(e.target.value));
              }}
              onBlur={() => {
                if (editingKey === key) {
                  commitField(key, editingText);
                  setEditingKey(null);
                }
              }}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            const next = commitPending();
            onChange(next);
            setEditingKey(null);
            void onSave(next);
          }}
          disabled={disabled || saving}
          className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {saving ? "Sparar..." : "Spara handledning"}
        </button>
      </div>
    </div>
  );
}

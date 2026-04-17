"use client";

import React, { useCallback, useEffect, useState } from "react";

export function LabeledInputLocal({
  label,
  value,
  onCommit,
  inputMode,
}: {
  label: string;
  value?: string;
  onCommit: (v: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const [local, setLocal] = useState<string>(value ?? "");
  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  const handleBlur = useCallback(() => {
    if ((value ?? "") !== local) onCommit(local);
  }, [local, value, onCommit]);

  return (
    <div className="min-w-0">
      <label className="mb-1 block text-sm text-slate-700">{label}</label>
      <input
        type="text"
        value={local}
        onInput={(e) => {
          const v = (e.target as HTMLInputElement).value;
          setLocal(v);
          if ((value ?? "") !== v) onCommit(v);
        }}
        onBlur={handleBlur}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px]
                   focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
      />
    </div>
  );
}

export function ReadonlyInput({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0" title={value || "Ändra på profilsidan"}>
      <label className="mb-1 block text-sm text-slate-700">{label}</label>
      <div
        className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-[14px] text-slate-700"
        aria-readonly="true"
        role="textbox"
      >
        <span className="whitespace-normal break-words">{value || "—"}</span>
      </div>
    </div>
  );
}

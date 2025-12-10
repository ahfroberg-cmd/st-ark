// components/MobileIup/InstrumentsModal.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  instruments: string[];
  onSave: (instruments: string[]) => void;
  onClose: () => void;
};

export default function InstrumentsModal({
  open,
  instruments,
  onSave,
  onClose,
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");

  const handleRequestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleAdd = useCallback(() => {
    const name = input.trim();
    if (!name) return;
    if (instruments.includes(name)) {
      setInput("");
      return;
    }
    onSave([...instruments, name]);
    setInput("");
  }, [input, instruments, onSave]);

  const handleRemove = useCallback(
    (name: string) => {
      const ok = window.confirm(
        `Vill du ta bort bedömningsinstrumentet "${name}"?`
      );
      if (!ok) return;
      onSave(instruments.filter((i) => i !== name));
    },
    [instruments, onSave]
  );

  useEffect(() => {
    if (!open) setInput("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[135] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-extrabold">Bedömningsinstrument</h2>
          <button
            type="button"
            onClick={handleRequestClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-px"
          >
            Stäng
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-2 block text-base font-semibold text-slate-800">
              Lägg till bedömningsinstrument
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                className="h-12 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                placeholder="Instrumentnamn..."
              />
              <button
                type="button"
                onClick={handleAdd}
                className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-5 py-3 text-base font-semibold text-white hover:bg-sky-700 active:translate-y-px"
              >
                Lägg till
              </button>
            </div>
          </div>

          <div className="max-h-[260px] overflow-auto rounded-xl border border-slate-200 bg-white">
            {instruments.length === 0 ? (
              <div className="px-4 py-4 text-base text-slate-500">
                Inga bedömningsinstrument tillagda ännu.
              </div>
            ) : (
              instruments.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                >
                  <span className="text-base text-slate-800">{name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(name)}
                    className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 active:translate-y-px"
                  >
                    Ta bort
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


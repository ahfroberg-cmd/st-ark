"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/db";
import CalendarDatePicker from "@/components/CalendarDatePicker";

type PlacementRow = {
  id: any;
  clinic?: string;
  note?: string;
  startDate?: string;
  endDate?: string;
  attendance?: number;
  percent?: number;
  ftePercent?: number;
  scopePercent?: number;
  omfattning?: number;
  phase?: string;
};

function fmtDate(iso?: string): string {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

function fmtPeriod(p: PlacementRow): string {
  const a = fmtDate(p.startDate);
  const b = fmtDate(p.endDate);
  if (a && b) return `${a} – ${b}`;
  if (a && !b) return a;
  if (!a && b) return b;
  return "Okänd period";
}

function pickPercent(p: PlacementRow): number {
  const v =
    p.attendance ??
    p.percent ??
    p.ftePercent ??
    p.scopePercent ??
    p.omfattning ??
    100;
  const n = Number(v);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(200, n));
}

export default function MobilePlacements() {
  const [rows, setRows] = useState<PlacementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<any | null>(null);
  const [editing, setEditing] = useState<PlacementRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const anyDb: any = db as any;
        const list =
          ((await anyDb.placements?.toArray?.()) as PlacementRow[] | undefined) ??
          [];
        if (!cancelled) {
          const sorted = [...list].sort((a, b) =>
            fmtDate(a.startDate).localeCompare(fmtDate(b.startDate))
          );
          setRows(sorted);
        }
      } catch (e) {
        console.error("Kunde inte läsa placeringar:", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSelect(row: PlacementRow) {
    setSelectedId(row.id);
    setEditing({
      ...row,
      startDate: fmtDate(row.startDate),
      endDate: fmtDate(row.endDate),
    });
  }

  function handleNew() {
    // Försök följa samma id-typ som befintliga rader (nummer eller sträng)
    const sampleId = rows[0]?.id;
    let newId: any;

    if (typeof sampleId === "number") {
      let max = 0;
      for (const r of rows) {
        if (typeof r.id === "number" && r.id > max) {
          max = r.id;
        }
      }
      newId = max + 1;
    } else if (typeof sampleId === "string") {
      if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        newId = (crypto as any).randomUUID();
      } else {
        newId = String(Date.now());
      }
    } else {
      // fallback om det inte finns några rader eller okänd typ
      newId = Date.now();
    }

    const draft: PlacementRow = {
      id: newId,
      clinic: "",
      note: "",
      startDate: "",
      endDate: "",
      attendance: 100,
      phase: "",
    };
    setSelectedId(draft.id);
    setEditing(draft);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const anyDb: any = db as any;

      const isExisting = rows.some((r) => r.id === editing.id);

      const attendance = pickPercent(editing);
      const patch: PlacementRow = {
        id: editing.id,
        clinic: editing.clinic ?? "",
        note: editing.note ?? "",
        startDate: fmtDate(editing.startDate),
        endDate: fmtDate(editing.endDate),
        attendance,
        phase: editing.phase ?? "",
      };

      if (isExisting) {
        const id = editing.id;
        const updatePatch = { ...patch };
        delete (updatePatch as any).id;
        await anyDb.placements?.update?.(id, updatePatch);
        setRows((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
        );
      } else {
        // Ny rad: behåll id och skicka in hela patch (med id) till add
        const insertPatch: PlacementRow = { ...patch };
        await anyDb.placements?.add?.(insertPatch);
        setRows((prev) => [...prev, insertPatch]);
        setSelectedId(insertPatch.id);
        setEditing({ ...insertPatch });
      }
    } catch (e) {
      console.error("Kunde inte spara placering:", e);
      window.alert("Kunde inte spara ändringar för tjänstgöringen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Kliniska tjänstgöringar
          </h2>
          <button
            type="button"
            onClick={handleNew}
            className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm active:translate-y-px"
          >
            Ny tjänstgöring
          </button>
        </div>

        {loading ? (
          <div className="py-2 text-sm text-slate-500">Laddar …</div>
        ) : rows.length === 0 ? (
          <div className="py-2 text-sm text-slate-500">
            Inga tjänstgöringar registrerade.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {rows.map((p) => {
              const active = p.id === selectedId;
              return (
                <li key={String(p.id)}>
                  <button
                    type="button"
                    onClick={() => handleSelect(p)}
                    className={[
                      "flex w-full flex-col items-start px-2 py-2 text-left text-sm",
                      active
                        ? "bg-emerald-50"
                        : "hover:bg-slate-50 active:bg-slate-100",
                    ].join(" ")}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="font-medium text-slate-900">
                        {p.clinic || "Klinik saknas"}
                      </div>
                      {p.phase && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          {p.phase}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {fmtPeriod(p)} · {pickPercent(p)} %
                    </div>
                    {p.note && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {p.note}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editing && (
        <PlacementEditPopup
          placement={editing}
          onSave={handleSave}
          onClose={() => {
            setEditing(null);
            setSelectedId(null);
          }}
          saving={saving}
          onUpdate={setEditing}
        />
      )}
    </div>
  );
}

// Placement edit popup component
function PlacementEditPopup({
  placement,
  onSave,
  onClose,
  saving,
  onUpdate,
}: {
  placement: PlacementRow;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  onUpdate: (p: PlacementRow) => void;
}) {
  const overlayRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-emerald-50 px-5 py-4">
          <h2 className="text-xl font-extrabold text-emerald-900">
            {placement.clinic || "Ny tjänstgöring"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-px"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Klinik / enhet
              </label>
              <input
                type="text"
                value={placement.clinic ?? ""}
                onChange={(e) =>
                  onUpdate({ ...placement, clinic: e.target.value })
                }
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <CalendarDatePicker
                  value={placement.startDate ?? ""}
                  onChange={(v) =>
                    onUpdate({ ...placement, startDate: v })
                  }
                  label="Startdatum"
                />
              </div>
              <div className="space-y-1">
                <CalendarDatePicker
                  value={placement.endDate ?? ""}
                  onChange={(v) =>
                    onUpdate({ ...placement, endDate: v })
                  }
                  label="Slutdatum"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Tjänstgöringsgrad (%)
              </label>
              <input
                type="number"
                min={0}
                max={200}
                step={5}
                value={pickPercent(placement)}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  onUpdate({ ...placement, attendance: v });
                }}
                className="h-12 w-32 rounded-lg border border-slate-300 bg-white px-3 text-right text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Kommentar / notering
              </label>
              <textarea
                rows={4}
                value={placement.note ?? ""}
                onChange={(e) =>
                  onUpdate({ ...placement, note: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:translate-y-px"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:translate-y-px disabled:opacity-50"
          >
            {saving ? "Sparar..." : "Spara"}
          </button>
        </footer>
      </div>
    </div>
  );
}


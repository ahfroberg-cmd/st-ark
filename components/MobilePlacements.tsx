"use client";

import React, { useEffect, useState, useRef } from "react";
import { db } from "@/lib/db";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import MilestonePicker from "@/components/MilestonePicker";
import { loadGoals, type GoalsCatalog } from "@/lib/goals";
import type { Profile } from "@/lib/types";

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
  type?: string;
  kind?: string;
  category?: string;
  milestones?: string[];
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

function getPlacementTypeLabel(p: PlacementRow): string | null {
  // Kolla type, kind, category först, sedan phase
  const typeStr = (p.type || p.kind || p.category || p.phase || "").toLowerCase();
  const clinicStr = (p.clinic || "").toLowerCase();
  const noteStr = (p.note || "").toLowerCase();
  const combinedStr = `${typeStr} ${clinicStr} ${noteStr}`;
  
  if (combinedStr.includes("auskult")) return "Auskultation";
  if (combinedStr.includes("vetenskap") || combinedStr.includes("forskning") || combinedStr.includes("skriftlig")) return "Vetenskapligt arbete";
  if (combinedStr.includes("förbättring") || combinedStr.includes("kvalitet") || combinedStr.includes("utveckling")) return "Förbättringsarbete";
  
  return null;
}

function formatClinicName(p: PlacementRow): string {
  const typeLabel = getPlacementTypeLabel(p);
  const clinicName = p.clinic || "Klinik saknas";
  if (typeLabel) {
    return `${typeLabel}: ${clinicName}`;
  }
  return clinicName;
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

/** Kontrollera om två datumintervall överlappar */
function datesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  if (!start1 || !end1 || !start2 || !end2) return false;
  return start1 <= end2 && start2 <= end1;
}

/** Hitta närmaste tillgängliga datum efter en given datum */
function findNextAvailableDate(
  targetDate: string,
  existingPlacements: PlacementRow[],
  currentPlacementId: any,
  isStartDate: boolean
): string {
  if (!targetDate) return targetDate;

  // Sortera placeringar efter startdatum
  const sorted = [...existingPlacements]
    .filter((p) => p.id !== currentPlacementId && p.startDate && p.endDate)
    .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));

  if (isStartDate) {
    // För startdatum: hitta första tillgängliga datum efter alla överlappande
    let candidate = targetDate;
    let changed = false;

    for (const p of sorted) {
      const start = p.startDate || "";
      const end = p.endDate || "";

      if (datesOverlap(candidate, candidate, start, end)) {
        // Överlappar - flytta till dagen efter slutet
        const endDate = new Date(end + "T00:00:00");
        endDate.setDate(endDate.getDate() + 1);
        const year = endDate.getFullYear();
        const month = String(endDate.getMonth() + 1).padStart(2, "0");
        const day = String(endDate.getDate()).padStart(2, "0");
        candidate = `${year}-${month}-${day}`;
        changed = true;
      }
    }

    return changed ? candidate : targetDate;
  } else {
    // För slutdatum: hitta första tillgängliga datum före alla överlappande
    let candidate = targetDate;
    let changed = false;

    for (const p of sorted) {
      const start = p.startDate || "";
      const end = p.endDate || "";

      if (datesOverlap(candidate, candidate, start, end)) {
        // Överlappar - flytta till dagen före starten
        const startDate = new Date(start + "T00:00:00");
        startDate.setDate(startDate.getDate() - 1);
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, "0");
        const day = String(startDate.getDate()).padStart(2, "0");
        candidate = `${year}-${month}-${day}`;
        changed = true;
      }
    }

    return changed ? candidate : targetDate;
  }
}

export default function MobilePlacements() {
  const [rows, setRows] = useState<PlacementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<any | null>(null);
  const [editing, setEditing] = useState<PlacementRow | null>(null);
  const [originalEditing, setOriginalEditing] = useState<PlacementRow | null>(null);
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
    const editData = {
      ...row,
      startDate: fmtDate(row.startDate),
      endDate: fmtDate(row.endDate),
      milestones: row.milestones || [],
    };
    setEditing(editData);
    setOriginalEditing(JSON.parse(JSON.stringify(editData)));
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
      type: "Klinisk tjänstgöring",
      kind: "Klinisk tjänstgöring",
      category: "Klinisk tjänstgöring",
      milestones: [],
    };
    setSelectedId(draft.id);
    setEditing(draft);
    setOriginalEditing(JSON.parse(JSON.stringify(draft)));
  }

  const isDirty = React.useMemo(() => {
    if (!editing || !originalEditing) return false;
    return JSON.stringify(editing) !== JSON.stringify(originalEditing);
  }, [editing, originalEditing]);

  async function handleSave() {
    if (!editing || !isDirty) return;
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
        type: editing.type ?? editing.kind ?? editing.category ?? "",
        kind: editing.type ?? editing.kind ?? editing.category ?? "",
        category: editing.type ?? editing.kind ?? editing.category ?? "",
        milestones: editing.milestones || [],
      };

      if (isExisting) {
        const id = editing.id;
        const updatePatch = { ...patch };
        delete (updatePatch as any).id;
        await anyDb.placements?.update?.(id, updatePatch);
        setRows((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
        );
        setOriginalEditing(JSON.parse(JSON.stringify(patch)));
      } else {
        // Ny rad: behåll id och skicka in hela patch (med id) till add
        const insertPatch: PlacementRow = { ...patch };
        await anyDb.placements?.add?.(insertPatch);
        setRows((prev) => [...prev, insertPatch]);
        setSelectedId(insertPatch.id);
        setEditing({ ...insertPatch });
        setOriginalEditing(JSON.parse(JSON.stringify(insertPatch)));
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
          <h2 className="text-base font-semibold text-slate-900">
            Kliniska tjänstgöringar, auskultationer, arbeten
          </h2>
          <button
            type="button"
            onClick={handleNew}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm active:translate-y-px whitespace-nowrap"
          >
            + Lägg till
          </button>
        </div>

        {loading ? (
          <div className="py-2 text-sm text-slate-900">Laddar …</div>
        ) : rows.length === 0 ? (
          <div className="py-2 text-sm text-slate-900">
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
                        {formatClinicName(p)}
                      </div>
                      {p.phase && !getPlacementTypeLabel(p) && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-900">
                          {p.phase}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-900">
                      {fmtPeriod(p)} · {pickPercent(p)} %
                    </div>
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
            setOriginalEditing(null);
            setSelectedId(null);
          }}
          saving={saving}
          onUpdate={setEditing}
          isDirty={isDirty}
          allPlacements={rows}
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
  isDirty,
  allPlacements,
}: {
  placement: PlacementRow;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  onUpdate: (p: PlacementRow) => void;
  isDirty: boolean;
  allPlacements: PlacementRow[];
}) {
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const [milestonePickerOpen, setMilestonePickerOpen] = useState(false);

  // Förhindra scroll på body när popup är öppen
  React.useEffect(() => {
    if (true) { // Popup är alltid öppen när den renderas
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  const [goals, setGoals] = useState<GoalsCatalog | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const milestonesSet = new Set(placement.milestones || []);

  useEffect(() => {
    (async () => {
      const p = await db.profile.get("default");
      setProfile(p ?? null);
      if (p?.goalsVersion && (p.specialty || (p as any).speciality)) {
        try {
          const g = await loadGoals(
            p.goalsVersion,
            p.specialty || (p as any).speciality || ""
          );
          setGoals(g);
        } catch (e) {
          console.error("Kunde inte ladda mål:", e);
        }
      }
    })();
  }, []);

  function handleToggleMilestone(milestoneId: string) {
    const current = placement.milestones || [];
    const set = new Set(current);
    if (set.has(milestoneId)) {
      set.delete(milestoneId);
    } else {
      set.add(milestoneId);
    }
    onUpdate({ ...placement, milestones: Array.from(set) });
  }

  function sortMilestoneIds(ids: string[]): string[] {
    return [...ids].sort((a, b) => {
      const aNorm = String(a).toLowerCase().replace(/^st/, "");
      const bNorm = String(b).toLowerCase().replace(/^st/, "");
      return aNorm.localeCompare(bNorm);
    });
  }

  return (
    <>
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
          className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between border-b border-slate-200 bg-emerald-50 px-5 py-4">
            <h2 className="text-xl font-extrabold text-emerald-900">
              {placement.clinic || "Ny tjänstgöring"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="space-y-4 text-sm">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">
                  Typ
                </label>
                <select
                  value={placement.type || placement.kind || placement.category || placement.phase || "Klinisk tjänstgöring"}
                  onChange={(e) => {
                    const typeValue = e.target.value;
                    onUpdate({ ...placement, type: typeValue, kind: typeValue, category: typeValue });
                  }}
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                >
                  <option value="Klinisk tjänstgöring">Klinisk tjänstgöring</option>
                  <option value="Vetenskapligt arbete">Vetenskapligt arbete</option>
                  <option value="Förbättringsarbete">Förbättringsarbete</option>
                  <option value="Auskultation">Auskultation</option>
                  <option value="Forskning">Forskning</option>
                  <option value="Tjänstledighet">Tjänstledighet</option>
                  <option value="Föräldraledighet">Föräldraledighet</option>
                  <option value="Annan ledighet">Annan ledighet</option>
                  <option value="Sjukskriven">Sjukskriven</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">
                  Klinik / enhet
                </label>
                <input
                  type="text"
                  value={placement.clinic ?? ""}
                  onChange={(e) =>
                    onUpdate({ ...placement, clinic: e.target.value })
                  }
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <CalendarDatePicker
                    value={placement.startDate ?? ""}
                    onChange={(v) => {
                      const adjusted = findNextAvailableDate(
                        v,
                        allPlacements,
                        placement.id,
                        true
                      );
                      onUpdate({ ...placement, startDate: adjusted });
                    }}
                    label="Startdatum"
                  />
                </div>
                <div className="space-y-2">
                  <CalendarDatePicker
                    value={placement.endDate ?? ""}
                    onChange={(v) => {
                      const adjusted = findNextAvailableDate(
                        v,
                        allPlacements,
                        placement.id,
                        false
                      );
                      onUpdate({ ...placement, endDate: adjusted });
                    }}
                    label="Slutdatum"
                />
              </div>
            </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">
                Tjänstgöringsgrad (%)
              </label>
                <select
                  value={pickPercent(placement)}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                    onUpdate({ ...placement, attendance: v });
                }}
                  className="h-12 w-32 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                >
                  {Array.from({ length: 21 }, (_, i) => i * 5).map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMilestonePickerOpen(true)}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
                  >
                    Delmål
                  </button>
                  <div className="flex items-center gap-1 flex-wrap">
                    {placement.milestones && placement.milestones.length > 0 ? (
                      sortMilestoneIds(placement.milestones).map((m: string) => (
                        <span
                          key={m}
                          className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-900"
                        >
                          {String(m).trim().split(/\s|–|-|:|\u2013/)[0].toLowerCase()}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-900 text-sm">—</span>
                    )}
                  </div>
                </div>
            </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">
                Kommentar / notering
              </label>
              <textarea
                  rows={4}
                  value={placement.note ?? ""}
                onChange={(e) =>
                    onUpdate({ ...placement, note: e.target.value })
                }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
              </div>
            </div>
            </div>

          <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
            >
              Avbryt
            </button>
              <button
                type="button"
              onClick={onSave}
              disabled={saving || !isDirty}
              className="inline-flex items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Spara
              </button>
          </footer>
            </div>
          </div>

      {milestonePickerOpen && goals && (
        <MilestonePicker
          open={true}
          title="Välj delmål"
          goals={goals}
          checked={milestonesSet}
          onToggle={handleToggleMilestone}
          onClose={() => setMilestonePickerOpen(false)}
        />
      )}
    </>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/db";
import CalendarDatePicker from "@/components/CalendarDatePicker";

type CourseRow = {
  id: any;
  title?: string;
  courseName?: string;
  provider?: string;
  site?: string;
  city?: string;
  startDate?: string;
  endDate?: string;
  certificateDate?: string;
  note?: string;
};

function fmtDate(iso?: string): string {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

function fmtPeriod(c: CourseRow): string {
  const cert = fmtDate(c.certificateDate);
  if (cert) return cert;

  const a = fmtDate(c.startDate);
  const b = fmtDate(c.endDate);
  if (a && b) return `${a} – ${b}`;
  if (a && !b) return a;
  if (!a && b) return b;
  return "Okänt datum";
}

export default function MobileCourses() {
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<any | null>(null);
  const [editing, setEditing] = useState<CourseRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const anyDb: any = db as any;
        const list =
          ((await anyDb.courses?.toArray?.()) as CourseRow[] | undefined) ??
          [];
        if (!cancelled) {
          const sorted = [...list].sort((a, b) =>
            fmtDate(
              a.certificateDate || a.endDate || a.startDate
            ).localeCompare(
              fmtDate(b.certificateDate || b.endDate || b.startDate)
            )
          );
          setRows(sorted);
        }
      } catch (e) {
        console.error("Kunde inte läsa kurser:", e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function label(c: CourseRow): string {
    return c.title || c.courseName || "Kurs";
  }

  function handleSelect(c: CourseRow) {
    setSelectedId(c.id);
    setEditing({
      ...c,
      startDate: fmtDate(c.startDate),
      endDate: fmtDate(c.endDate),
      certificateDate: fmtDate(c.certificateDate),
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

    const draft: CourseRow = {
      id: newId,
      title: "",
      courseName: "",
      provider: "",
      site: "",
      city: "",
      startDate: "",
      endDate: "",
      certificateDate: "",
      note: "",
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

      const patch: CourseRow = {
        id: editing.id,
        title: editing.title ?? editing.courseName ?? "",
        courseName: editing.courseName ?? "",
        provider: editing.provider ?? "",
        site: editing.site ?? "",
        city: editing.city ?? "",
        startDate: fmtDate(editing.startDate),
        endDate: fmtDate(editing.endDate),
        certificateDate: fmtDate(editing.certificateDate),
        note: editing.note ?? "",
      };

      if (isExisting) {
        const id = editing.id;
        const updatePatch = { ...patch };
        delete (updatePatch as any).id;
        await anyDb.courses?.update?.(id, updatePatch);
        setRows((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
        );
      } else {
        // Ny rad: behåll id och skicka in hela patch (med id) till add
        const insertPatch: CourseRow = { ...patch };
        await anyDb.courses?.add?.(insertPatch);
        setRows((prev) => [...prev, insertPatch]);
        setSelectedId(insertPatch.id);
        setEditing({ ...insertPatch });
      }
    } catch (e) {
      console.error("Kunde inte spara kurs:", e);
      window.alert("Kunde inte spara ändringar för kursen.");
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Kurser</h2>
          <button
            type="button"
            onClick={handleNew}
            className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm active:translate-y-px"
          >
            Ny kurs
          </button>
        </div>

        {loading ? (
          <div className="py-2 text-sm text-slate-500">Laddar …</div>
        ) : rows.length === 0 ? (
          <div className="py-2 text-sm text-slate-500">
            Inga kurser registrerade.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {rows.map((c) => {
              const active = c.id === selectedId;
              return (
                <li key={String(c.id)}>
                  <button
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={[
                      "flex w-full flex-col items-start px-2 py-2 text-left text-sm",
                      active
                        ? "bg-emerald-50"
                        : "hover:bg-slate-50 active:bg-slate-100",
                    ].join(" ")}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="font-medium text-slate-900">
                        {label(c)}
                      </div>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {fmtPeriod(c)}
                      {c.city && ` · ${c.city}`}
                    </div>
                    {c.note && (
                      <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {c.note}
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
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">
            Detaljer
          </h3>

          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Titel
              </label>
              <input
                type="text"
                value={editing.title ?? editing.courseName ?? ""}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, title: e.target.value } : prev
                  )
                }
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Anordnare
              </label>
              <input
                type="text"
                value={editing.provider ?? ""}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, provider: e.target.value } : prev
                  )
                }
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">
                  Ort
                </label>
                <input
                  type="text"
                  value={editing.city ?? ""}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, city: e.target.value } : prev
                    )
                  }
                  className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
              <div className="space-y-1">
                <CalendarDatePicker
                  value={editing.startDate ?? ""}
                  onChange={(v) =>
                    setEditing((prev) =>
                      prev ? { ...prev, startDate: v } : prev
                    )
                  }
                  label="Start"
                />
              </div>
              <div className="space-y-1">
                <CalendarDatePicker
                  value={editing.certificateDate ?? ""}
                  onChange={(v) =>
                    setEditing((prev) =>
                      prev ? { ...prev, certificateDate: v } : prev
                    )
                  }
                  label="Slut / intygsdatum"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Kommentar / notering
              </label>
              <textarea
                rows={3}
                value={editing.note ?? ""}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, note: e.target.value } : prev
                  )
                }
                className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
              >
                {saving ? "Sparar …" : "Spara ändringar"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}


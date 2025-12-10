"use client";

import React, { useEffect, useState, useRef } from "react";
import { db } from "@/lib/db";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import MilestonePicker from "@/components/MilestonePicker";
import { loadGoals, type GoalsCatalog } from "@/lib/goals";
import type { Profile } from "@/lib/types";

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
  milestones?: string[];
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
  const [originalEditing, setOriginalEditing] = useState<CourseRow | null>(null);
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
    const editData = {
      ...c,
      startDate: fmtDate(c.startDate),
      endDate: fmtDate(c.endDate),
      certificateDate: fmtDate(c.certificateDate),
      milestones: c.milestones || [],
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
        milestones: editing.milestones || [],
      };

      if (isExisting) {
        const id = editing.id;
        const updatePatch = { ...patch };
        delete (updatePatch as any).id;
        await anyDb.courses?.update?.(id, updatePatch);
        setRows((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
        );
        setOriginalEditing(JSON.parse(JSON.stringify(patch)));
      } else {
        // Ny rad: behåll id och skicka in hela patch (med id) till add
        const insertPatch: CourseRow = { ...patch };
        await anyDb.courses?.add?.(insertPatch);
        setRows((prev) => [...prev, insertPatch]);
        setSelectedId(insertPatch.id);
        setEditing({ ...insertPatch });
        setOriginalEditing(JSON.parse(JSON.stringify(insertPatch)));
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
          <h2 className="text-lg font-semibold text-slate-900">Kurser</h2>
          <button
            type="button"
            onClick={handleNew}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 text-base font-semibold text-white shadow-sm active:translate-y-px"
          >
            + Lägg till
          </button>
        </div>

        {loading ? (
          <div className="py-2 text-sm text-slate-900">Laddar …</div>
        ) : rows.length === 0 ? (
          <div className="py-2 text-sm text-slate-900">
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
                    <div className="mt-0.5 text-xs text-slate-900">
                      {fmtPeriod(c)}
                      {c.city && ` · ${c.city}`}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editing && (
        <CourseEditPopup
          course={editing}
          onSave={handleSave}
          onClose={() => {
            setEditing(null);
            setOriginalEditing(null);
            setSelectedId(null);
          }}
          saving={saving}
          onUpdate={setEditing}
          isDirty={isDirty}
        />
      )}
    </div>
  );
}

// Course edit popup component
function CourseEditPopup({
  course,
  onSave,
  onClose,
  saving,
  onUpdate,
  isDirty,
}: {
  course: CourseRow;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  onUpdate: (c: CourseRow) => void;
  isDirty: boolean;
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
  const milestonesSet = new Set(course.milestones || []);

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
    const current = course.milestones || [];
    const set = new Set(current);
    if (set.has(milestoneId)) {
      set.delete(milestoneId);
    } else {
      set.add(milestoneId);
    }
    onUpdate({ ...course, milestones: Array.from(set) });
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
          className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between border-b border-slate-200 bg-emerald-50 px-5 py-4">
            <h2 className="text-xl font-extrabold text-emerald-900">
              {course.title || course.courseName || "Ny kurs"}
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
                  Titel
                </label>
                <input
                  type="text"
                  value={course.title ?? course.courseName ?? ""}
                  onChange={(e) =>
                    onUpdate({ ...course, title: e.target.value })
                  }
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">
                  Anordnare
                </label>
                <input
                  type="text"
                  value={course.provider ?? ""}
                  onChange={(e) =>
                    onUpdate({ ...course, provider: e.target.value })
                  }
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-900">
                    Ort
                  </label>
                  <input
                    type="text"
                    value={course.city ?? ""}
                    onChange={(e) =>
                      onUpdate({ ...course, city: e.target.value })
                    }
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                  />
                </div>
                <div className="space-y-2">
                  <CalendarDatePicker
                    value={course.startDate ?? ""}
                    onChange={(v) =>
                      onUpdate({ ...course, startDate: v })
                    }
                    label="Start"
                  />
                </div>
                <div className="space-y-2">
                  <CalendarDatePicker
                    value={course.certificateDate ?? ""}
                    onChange={(v) =>
                      onUpdate({ ...course, certificateDate: v })
                    }
                    label="Slut / intygsdatum"
                  />
                </div>
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
                    {course.milestones && course.milestones.length > 0 ? (
                      sortMilestoneIds(course.milestones).map((m: string) => (
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
                  value={course.note ?? ""}
                  onChange={(e) =>
                    onUpdate({ ...course, note: e.target.value })
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

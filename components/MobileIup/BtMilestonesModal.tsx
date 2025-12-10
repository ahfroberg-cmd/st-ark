// components/MobileIup/BtMilestonesModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { Profile, Achievement, Placement, Course } from "@/lib/types";
import { btMilestones, type BtMilestone } from "@/lib/goals-bt";

type Props = {
  open: boolean;
  onClose: () => void;
};

type BtRow = { code: string; klinCount: number; kursCount: number };

export default function BtMilestonesModal({ open, onClose }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [achAll, setAchAll] = useState<Achievement[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showDone, setShowDone] = useState(true);
  const [showOngoing, setShowOngoing] = useState(true);
  const [showPlanned, setShowPlanned] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [listTitle, setListTitle] = useState("");
  const [listItems, setListItems] = useState<{ id: string; line1: string; line2?: string }[]>([]);

  const is2021 = profile?.goalsVersion === "2021";
  const todayIso = new Date().toISOString().slice(0, 10);

  // Load data
  useEffect(() => {
    if (!open) return;
    (async () => {
      const p = await db.profile.get("default");
      setProfile(p ?? null);

      try {
        const [aAll, placs, crs] = await Promise.all([
          db.achievements.toArray(),
          db.placements.toArray(),
          db.courses.toArray(),
        ]);
        setAchAll(aAll);
        setPlacements(placs);
        setCourses(crs);
      } catch {
        setAchAll([]);
        setPlacements([]);
        setCourses([]);
      }
    })();
  }, [open]);

  // Prevent body scroll
  useEffect(() => {
    if (open || detailId || listOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, detailId, listOpen]);

  // Helper functions
  const normalizeBtCode = (x: unknown) => {
    const s = String(x ?? "").trim();
    const m = s.match(/^BT[\s\-_]*([0-9]+)/i);
    return m ? "BT" + m[1] : null;
  };

  const classifyActivity = (
    startDate?: string | null,
    endDate?: string | null
  ): "done" | "ongoing" | "planned" | null => {
    const s = (startDate ?? "").trim();
    const e = (endDate ?? "").trim();

    if (!s && !e) return null;

    if (e && e < todayIso) return "done";
    if (s && s > todayIso) return "planned";
    if (s && (!e || e >= todayIso) && s <= todayIso) return "ongoing";

    return null;
  };

  const statusAllowed = (
    status: "done" | "ongoing" | "planned" | null
  ): boolean => {
    if (!status) return false;
    if (status === "done") return showDone;
    if (status === "ongoing") return showOngoing;
    if (status === "planned") return showPlanned;
    return false;
  };

  // Calculate BT rows
  const btRows = useMemo((): BtRow[] => {
    const klin: Record<string, number> = {};
    const kurs: Record<string, number> = {};

    // 1) Achievements med kopplad BT-kod
    for (const a of achAll as any[]) {
      const cand = [a.goalId, a.milestoneId, a.id, a.code, a.milestone].filter(Boolean);
      for (const c of cand) {
        const code = normalizeBtCode(c);
        if (!code) continue;

        if (a.placementId) {
          const pl = placements.find((p) => p.id === a.placementId);
          const st = classifyActivity(pl?.startDate, pl?.endDate);
          if (statusAllowed(st)) {
            klin[code] = (klin[code] ?? 0) + 1;
          }
        }

        if (a.courseId) {
          const cr = courses.find((c0) => c0.id === a.courseId);
          const st = classifyActivity((cr as any)?.startDate, (cr as any)?.endDate);
          if (statusAllowed(st)) {
            kurs[code] = (kurs[code] ?? 0) + 1;
          }
        }
      }
    }

    // 2) Direktkopplingar från placeringar/kurser (utan achievements)
    const scan = (obj: any, isPlacement: boolean) => {
      const status = classifyActivity(obj?.startDate, obj?.endDate);
      if (!statusAllowed(status)) return;

      const arrs = [
        obj?.btMilestones,
        obj?.btGoals,
        obj?.milestones,
        obj?.goals,
        obj?.goalIds,
        obj?.milestoneIds,
      ];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          const code = normalizeBtCode(v);
          if (!code) continue;
          if (isPlacement) klin[code] = (klin[code] ?? 0) + 1;
          else kurs[code] = (kurs[code] ?? 0) + 1;
        }
      }
    };

    for (const p of placements as any[]) scan(p, true);
    for (const c of courses as any[]) scan(c, false);

    const sortNum = (code: string) => Number(code.replace(/[^\d]/g, "")) || 0;

    return btMilestones
      .map((m) => {
        const code = m.id.toUpperCase().replace(/\s|_|-/g, "");
        return {
          code,
          klinCount: klin[code] ?? 0,
          kursCount: kurs[code] ?? 0,
        };
      })
      .sort((a, b) => sortNum(a.code) - sortNum(b.code));
  }, [achAll, placements, courses, showDone, showOngoing, showPlanned]);

  // Visa alla BT-delmål, även om de inte har kopplingar ännu
  const hasAnyBt = btRows.length > 0;

  // UI actions
  const openDetail = (id: string) => {
    setDetailId(id);
  };

  const openList = (code: string) => {
    const codeNorm = code.toUpperCase().replace(/\s|_|-/g, "");

    const objHasBtCode = (obj: any, codeNorm: string) => {
      const arrs = [
        obj?.btMilestones,
        obj?.btGoals,
        obj?.milestones,
        obj?.goals,
        obj?.goalIds,
        obj?.milestoneIds,
      ];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          const found = normalizeBtCode(v);
          if (found && found.toUpperCase() === codeNorm) return true;
        }
      }
      return false;
    };

    const placRefs: any[] = [];
    const courseRefs: any[] = [];

    for (const a of achAll as any[]) {
      const cand = [a.goalId, a.milestoneId, a.id, a.code, a.milestone].filter(Boolean);
      const hasMatch = cand.some((c) => {
        const found = normalizeBtCode(c);
        return found && found.toUpperCase() === codeNorm;
      });
      if (!hasMatch) continue;

      if (a.placementId) {
        const pl = placements.find((p) => p.id === a.placementId);
        if (pl && objHasBtCode(pl, codeNorm)) {
          placRefs.push(a);
        }
      }

      if (a.courseId) {
        const cr = courses.find((c0) => c0.id === a.courseId);
        if (cr && objHasBtCode(cr, codeNorm)) {
          courseRefs.push(a);
        }
      }
    }

    for (const p of placements as any[]) {
      if (objHasBtCode(p, codeNorm)) {
        const st = classifyActivity(p?.startDate, p?.endDate);
        if (statusAllowed(st)) {
          placRefs.push({ placementId: p.id });
        }
      }
    }

    for (const c of courses as any[]) {
      if (objHasBtCode(c, codeNorm)) {
        const st = classifyActivity((c as any)?.startDate, (c as any)?.endDate);
        if (statusAllowed(st)) {
          courseRefs.push({ courseId: c.id });
        }
      }
    }

    const buildItemsPlac = (arr: any[]) =>
      arr
        .map((a) => {
          const r = placements.find((p) => p.id === a.placementId);
          if (!r) return null;
          return {
            id: (r as Placement).id,
            line1: (r as any).clinic || (r as any).title || "Klinisk tjänstgöring",
            line2: `${(r as Placement).startDate || ""}${
              (r as Placement).endDate ? ` – ${(r as Placement).endDate}` : ""
            }${(r as any).attendance ? ` · ${(r as any).attendance}%` : ""}`,
          };
        })
        .filter(Boolean) as { id: string; line1: string; line2?: string }[];

    const buildItemsCourse = (arr: any[]) =>
      arr
        .map((a) => {
          const r = courses.find((c) => c.id === a.courseId);
          if (!r) return null;
          return {
            id: (r as Course).id,
            line1: (r as any).title || (r as any).provider || "Kurs",
            line2: [(r as any).city, (r as any).certificateDate].filter(Boolean).join(" · "),
          };
        })
        .filter(Boolean) as { id: string; line1: string; line2?: string }[];

    const buildItemsAll = (arr: any[]) => {
      return [
        ...buildItemsPlac(arr.filter((a) => a.placementId)),
        ...buildItemsCourse(arr.filter((a) => a.courseId)),
      ];
    };

    const m = btMilestones.find((x) => x.id.toUpperCase() === codeNorm);
    const titleCode = m?.title ?? codeNorm;

    setListTitle(`${titleCode} – Utbildningsaktiviteter`);
    setListItems(buildItemsAll([...placRefs, ...courseRefs]));
    setListOpen(true);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className="w-full max-w-[980px] max-h-[90vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="border-b border-slate-200 px-5 py-4 flex items-center justify-between bg-sky-50">
            <h2 className="text-xl font-extrabold text-sky-900">BT-delmål</h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px shrink-0"
              title="Stäng"
            >
              ✕
            </button>
          </header>

          {/* Utbildningsaktiviteter */}
          <div className="border-b border-slate-200 px-5 py-3">
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-slate-900">
                Utbildningsaktiviteter:
              </span>
              <div className="flex items-center gap-4 flex-wrap">
                <label className="inline-flex items-center gap-2 text-[13px] text-slate-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 border-slate-400 text-sky-600 focus:ring-sky-300"
                    checked={showDone}
                    onChange={() => setShowDone((v) => !v)}
                  />
                  <span>Genomförda</span>
                </label>

                <label className="inline-flex items-center gap-2 text-[13px] text-slate-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 border-slate-400 text-sky-600 focus:ring-sky-300"
                    checked={showOngoing}
                    onChange={() => setShowOngoing((v) => !v)}
                  />
                  <span>Pågående</span>
                </label>

                <label className="inline-flex items-center gap-2 text-[13px] text-slate-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 border-slate-400 text-sky-600 focus:ring-sky-300"
                    checked={showPlanned}
                    onChange={() => setShowPlanned((v) => !v)}
                  />
                  <span>Planerade</span>
                </label>
              </div>
            </div>
          </div>

          {/* Body */}
          <section className="flex-1 overflow-y-auto p-5">
            {!is2021 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                BT-delmål är endast tillgängliga för målversion 2021.
              </div>
            ) : btRows.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                Inga BT-delmål hittades.
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {btRows.map((row) => {
                  const m = btMilestones.find((x) => x.id.toUpperCase() === row.code.toUpperCase());
                  const total = (row.klinCount ?? 0) + (row.kursCount ?? 0);

                  return (
                    <article key={row.code} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openDetail(row.code)}
                        className="dm-row flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                        title="Visa information om delmålet"
                      >
                        <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-900 shrink-0">
                          {row.code.toLowerCase()}
                        </span>
                        <span className="truncate text-[12px] text-slate-900">
                          {(m?.title ?? "BT-delmål").length > 50
                            ? (m?.title ?? "BT-delmål").slice(0, 50) + "..."
                            : m?.title ?? "BT-delmål"}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openList(row.code)}
                          className={
                            total > 0
                              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                              : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                          }
                          title={total > 0 ? "Visa intyg (alla kopplingar)" : "Inga kopplade intyg ännu"}
                        >
                          <span>Intyg</span>
                          <span className="min-w-[1.2ch] text-right">{total}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Detail view for BT milestone */}
      {detailId && /^BT\d+$/i.test(String(detailId)) && (() => {
        const id = String(detailId).toUpperCase();
        const m = btMilestones.find((x) => x.id === id) as BtMilestone | undefined;
        return (
          <div
            className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDetailId(null);
            }}
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between border-b border-slate-200 bg-sky-50 px-5 py-4 gap-4">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 shrink-0">
                    {id.toLowerCase()}
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-sky-900 break-words">
                    {m?.title ?? "BT-delmål"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailId(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px"
                  title="Stäng"
                >
                  ✕
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                {m ? (
                  <div className="prose prose-slate max-w-none text-[14px] leading-relaxed text-slate-900">
                    <ul className="list-disc space-y-2 pl-5 text-slate-900">
                      {m.bullets.map((b, i) => (
                        <li key={i} className="text-slate-900">{b}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-slate-900">Information saknas för {id}.</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* List view for intyg */}
      {listOpen && (
        <div
          className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-3"
          onClick={(e) => {
            if (e.target === e.currentTarget) setListOpen(false);
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-[13px] font-semibold text-slate-900">{listTitle}</div>
              <button
                type="button"
                onClick={() => setListOpen(false)}
                className="inline-flex h-[36px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                title="Stäng"
              >
                Stäng
              </button>
            </header>
            <div className="max-h-[60vh] overflow-auto px-4 py-3">
              {listItems.length > 0 ? (
                <ul className="space-y-1.5">
                  {listItems.map((it) => (
                    <li
                      key={it.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]"
                    >
                      <div className="font-semibold text-slate-900">{it.line1}</div>
                      {it.line2 && <div className="text-[11px] text-slate-900">{it.line2}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                  Det finns ännu inget registrerat för detta delmål.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

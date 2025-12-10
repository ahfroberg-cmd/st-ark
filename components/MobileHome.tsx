// components/MobileHome.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import type { Profile, Placement, Achievement } from "@/lib/types";
import { loadGoals, type GoalsCatalog } from "@/lib/goals";
import { btMilestones } from "@/lib/goals-bt";
import { COMMON_AB_MILESTONES } from "@/lib/goals-common";

type MobileHomeProps = {
  onOpenScan?: () => void;
  onProfileLoaded?: (hasProfile: boolean) => void;
};

/** Approximativ månadsdiff i månader (kan vara decimal) mellan två ISO-datum */
function monthDiffExact(startISO?: string, endISO?: string): number {
  const s = new Date((startISO || "") + "T00:00:00");
  const e = new Date((endISO || "") + "T00:00:00");
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const ms = e.getTime() - s.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  return Math.max(0, days / 30.4375);
}

/** Använd procentfält på ett robust sätt */
function pickPercent(p: any): number {
  const v = Number(
    p?.attendance ??
      p?.percent ??
      p?.ftePercent ??
      p?.scopePercent ??
      p?.omfattning ??
      100
  );
  return Number.isFinite(v) && v > 0 ? Math.min(100, Math.max(0, v)) : 100;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lägg till ett flytande antal månader (approx) till ett datum */
function addMonthsApprox(base: Date, months: number): Date {
  const days = months * 30.4375;
  const ms = base.getTime() + days * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

function normalizeGoalsVersion(v: any): "2015" | "2021" {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("2015")) return "2015";
  if (s.includes("2021")) return "2021";
  return "2021";
}

export default function MobileHome({ onOpenScan, onProfileLoaded }: MobileHomeProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [goals, setGoals] = useState<GoalsCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Planerad total tid (BT+ST eller ST) – samma logik som i PusslaDinST
  const [planMonths, setPlanMonths] = useState<number>(60);
  const [stEndISO, setStEndISO] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        const profArr = await (db as any).profile?.toArray?.();
        const prof = (Array.isArray(profArr) ? profArr[0] : null) as Profile | null;

        const pls =
          ((await (db as any).placements?.toArray?.()) ?? []) as Placement[];
        const crs =
          ((await (db as any).courses?.toArray?.()) ?? []) as any[];
        const ach =
          ((await (db as any).achievements?.toArray?.()) ?? []) as Achievement[];

        if (!live) return;

        setProfile(prof ?? null);
        setPlacements(pls);
        setCourses(crs);
        setAchievements(ach);

        // Ladda goals-katalog för att räkna ST-delmål
        if (prof?.goalsVersion && (prof.specialty || (prof as any).speciality)) {
          try {
            const g = await loadGoals(
              prof.goalsVersion,
              prof.specialty || (prof as any).speciality || ""
            );
            if (live) setGoals(g);
          } catch {
            // ignore
          }
        }

        // Planerad total tid
        const gv = normalizeGoalsVersion((prof as any)?.goalsVersion);
        const fromProfile = Number((prof as any)?.stTotalMonths);
        if (Number.isFinite(fromProfile) && fromProfile > 0) {
          setPlanMonths(fromProfile);
        } else {
          setPlanMonths(gv === "2021" ? 66 : 60);
        }

        // Meddela föräldern om profilstatus
        if (onProfileLoaded) {
          onProfileLoaded(!!prof);
        }
      } catch {
        // ignore
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, []);

  // Registrerad tid motsvarande heltid (endast placements)
  const workedFteMonths = useMemo(() => {
    if (!placements || placements.length === 0) return 0;

    const today = todayISO();

    return placements.reduce((acc, p: any) => {
      const start = p.startDate || p.startISO || p.start || "";
      const end = p.endDate || p.endISO || p.end || today;
      const months = monthDiffExact(start, end);
      const frac = pickPercent(p) / 100;
      return acc + months * frac;
    }, 0);
  }, [placements]);

  const progressPct = useMemo(() => {
    if (!planMonths || planMonths <= 0) return 0;
    const raw = (workedFteMonths / planMonths) * 100;
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, raw));
  }, [workedFteMonths, planMonths]);

  // Beräkna totala antalet delmål som ska uppfyllas
  const totalMilestones = useMemo(() => {
    const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
    if (gv === "2021") {
      // 18 BT-delmål + 2x7 a-delmål + 2x4 b-delmål + 2x12 c-delmål = 18+14+8+24 = 64
      return 64;
    } else {
      // 2015: 50 delmål
      return 50;
    }
  }, [profile]);

  // Beräkna uppfyllda delmål
  const fulfilledMilestones = useMemo(() => {
    const fulfilled = new Set<string>();
    const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
    const is2021 = gv === "2021";

    // Normalisera BT-kod
    const normalizeBtCode = (x: unknown) => {
      const s = String(x ?? "").trim();
      const m = s.match(/^BT[\s\-_]*([0-9]+)/i);
      return m ? "BT" + m[1] : null;
    };

    // Normalisera ST-milestone ID
    const normalizeStId = (x: unknown): string | null => {
      const s = String(x ?? "").trim();
      if (!s) return null;
      return s.toUpperCase().replace(/\s+/g, "");
    };

    // 1) BT-delmål (endast för 2021)
    if (is2021) {
      // Från achievements
      for (const a of achievements) {
        const cand = [a.goalId, a.milestoneId, a.id, (a as any).code, (a as any).milestone].filter(Boolean);
        for (const c of cand) {
          const code = normalizeBtCode(c);
          if (code) fulfilled.add(code);
        }
      }

    // Från placements och courses (endast genomförda)
    const today = todayISO();
    for (const p of placements as any[]) {
      const end = p.endDate || p.endISO || p.end || "";
      if (!end || end >= today) continue; // Bara genomförda
      const arrs = [
        p?.btMilestones,
        p?.btGoals,
        p?.milestones,
        p?.goals,
        p?.goalIds,
        p?.milestoneIds,
      ];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          const code = normalizeBtCode(v);
          if (code) fulfilled.add(code);
        }
      }
    }

    for (const c of courses as any[]) {
      const cert = c.certificateDate || "";
      const end = c.endDate || "";
      const date = cert || end;
      if (!date || date >= today) continue; // Bara genomförda
      const arrs = [
        c?.btMilestones,
        c?.btGoals,
        c?.milestones,
        c?.goals,
        c?.goalIds,
        c?.milestoneIds,
      ];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          const code = normalizeBtCode(v);
          if (code) fulfilled.add(code);
        }
      }
    }
    }

    // 2) ST-delmål
    // För 2021: Varje ST-delmål kan uppfyllas av både kurs och klinisk tjänstgöring (2 uppfyllelser)
    // För 2015: Varje ST-delmål räknas bara en gång
    const stMilestoneIdsFromPlacements = new Set<string>();
    const stMilestoneIdsFromCourses = new Set<string>();
    const stMilestoneIdsFromAchievements = new Set<string>();

    // Från achievements
    for (const a of achievements) {
      const id = normalizeStId(a.milestoneId);
      if (id && !normalizeBtCode(id)) {
        stMilestoneIdsFromAchievements.add(id);
      }
    }

    // Från placements (endast genomförda)
    const today = todayISO();
    for (const p of placements as any[]) {
      const end = p.endDate || p.endISO || p.end || "";
      if (!end || end >= today) continue; // Bara genomförda
      const arr = p?.milestones || p?.goals || p?.goalIds || p?.milestoneIds || [];
      for (const v of arr as any[]) {
        const id = normalizeStId(v);
        if (id && !normalizeBtCode(id)) {
          stMilestoneIdsFromPlacements.add(id);
        }
      }
    }

    // Från courses (endast genomförda)
    for (const c of courses as any[]) {
      const cert = c.certificateDate || "";
      const end = c.endDate || "";
      const date = cert || end;
      if (!date || date >= today) continue; // Bara genomförda
      const arr = c?.milestones || c?.goals || c?.goalIds || c?.milestoneIds || [];
      for (const v of arr as any[]) {
        const id = normalizeStId(v);
        if (id && !normalizeBtCode(id)) {
          stMilestoneIdsFromCourses.add(id);
        }
      }
    }

    // Kombinera alla ST-delmål
    const allStMilestoneIds = new Set<string>();
    for (const id of stMilestoneIdsFromAchievements) allStMilestoneIds.add(id);
    for (const id of stMilestoneIdsFromPlacements) allStMilestoneIds.add(id);
    for (const id of stMilestoneIdsFromCourses) allStMilestoneIds.add(id);

    if (is2021 && goals && Array.isArray((goals as any).milestones)) {
      // För 2021: Räkna ST-delmål från goals-katalogen
      const allSt = (goals as any).milestones as any[];
      const hasStc = allSt.some((m: any) =>
        /^STc\d+$/i.test(String((m as any).code ?? (m as any).id ?? ""))
      );

      if (hasStc) {
        // Hämta alla ST-delmål (STa, STb, STc)
        const stMilestones = allSt.filter((m: any) => {
          const code = String((m as any).code ?? (m as any).id ?? "").toUpperCase();
          return /^ST[ABC]\d+$/i.test(code);
        });

        // Lägg till gemensamma STa/STb om de saknas
        const existingKeys = new Set(
          stMilestones.map((m: any) =>
            String((m as any).code ?? (m as any).id ?? "")
              .toUpperCase()
              .replace(/\s+/g, "")
          )
        );

        Object.values(COMMON_AB_MILESTONES).forEach((cm: any) => {
          const codeRaw = String(cm.code ?? cm.id ?? "");
          if (/^ST[AB]\d+$/i.test(codeRaw)) {
            const codeKey = codeRaw.toUpperCase().replace(/\s+/g, "");
            if (!existingKeys.has(codeKey)) {
              stMilestones.push(cm);
            }
          }
        });

        // För varje ST-delmål: räkna om det är uppfyllt av klinisk tjänstgöring (1) och/eller kurs (1)
        for (const m of stMilestones) {
          const code = String((m as any).code ?? (m as any).id ?? "").toUpperCase().replace(/\s+/g, "");
          const hasPlacement = stMilestoneIdsFromPlacements.has(code) || stMilestoneIdsFromAchievements.has(code);
          const hasCourse = stMilestoneIdsFromCourses.has(code) || stMilestoneIdsFromAchievements.has(code);
          
          if (hasPlacement) fulfilled.add(`${code}-klin`);
          if (hasCourse) fulfilled.add(`${code}-kurs`);
        }
      } else {
        // Fallback: räkna bara en gång per delmål
        for (const id of allStMilestoneIds) {
          fulfilled.add(id);
        }
      }
    } else {
      // För 2015: räkna bara en gång per delmål
      for (const id of allStMilestoneIds) {
        fulfilled.add(id);
      }
    }

    return fulfilled.size;
  }, [profile, achievements, placements, courses, goals]);

  const milestoneProgressPct = useMemo(() => {
    if (!totalMilestones || totalMilestones <= 0) return 0;
    const raw = (fulfilledMilestones / totalMilestones) * 100;
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, raw));
  }, [fulfilledMilestones, totalMilestones]);

  // Ladda ST-slutdatum från profil (används som fallback om stEndDate inte finns)
  useEffect(() => {
    if (profile && (profile as any)?.stEndDate) {
      setStEndISO((profile as any).stEndDate);
    }
  }, [profile]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setImporting(true);
    try {
      const txt = await f.text();
      const data = JSON.parse(txt);

      const p = data.profile ?? data?.Profile ?? data?.prof ?? null;
      const placementsData = data.placements ?? data?.Placements ?? [];
      const courses = data.courses ?? data?.Courses ?? [];
      const achievements = data.achievements ?? data?.Achievements ?? [];

      if (p) await (db as any).profile?.put?.({ id: "default", ...(p.id ? p : { ...p, id: "default" }) });
      if (Array.isArray(placementsData)) for (const pl of placementsData) { try { await (db as any).placements?.put?.(pl); } catch {} }
      if (Array.isArray(courses))    for (const c of courses)    { try { await (db as any).courses?.put?.(c); } catch {} }
      if (Array.isArray(achievements))for (const a of achievements){ try { await (db as any).achievements?.put?.(a); } catch {} }

      // Ladda om data
      const profArr = await (db as any).profile?.toArray?.();
      const prof = (Array.isArray(profArr) ? profArr[0] : null) as Profile | null;
      const pls = ((await (db as any).placements?.toArray?.()) ?? []) as Placement[];
      const crs = ((await (db as any).courses?.toArray?.()) ?? []) as any[];
      const ach = ((await (db as any).achievements?.toArray?.()) ?? []) as Achievement[];
      
      setProfile(prof ?? null);
      setPlacements(pls);
      setCourses(crs);
      setAchievements(ach);

      // Ladda goals-katalog för att räkna ST-delmål
      if (prof?.goalsVersion && (prof.specialty || (prof as any).speciality)) {
        try {
          const g = await loadGoals(
            prof.goalsVersion,
            prof.specialty || (prof as any).speciality || ""
          );
          setGoals(g);
        } catch {
          // ignore
        }
      }

      // Meddela föräldern om profilstatus
      if (onProfileLoaded) {
        onProfileLoaded(!!prof);
      }
    } catch (err) {
      console.error(err);
      window.alert("Kunde inte läsa JSON-filen.");
    } finally {
      setImporting(false);
    }
  }

  function pickFile() {
    fileRef.current?.click();
  }

  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
  const totalLabel = gv === "2021" ? "Total tid för BT + ST" : "Total tid för ST";

  // Om ingen profil finns, visa filuppladdningssidan
  if (!loading && !profile) {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-center text-3xl font-extrabold tracking-tight">
            <span className="text-sky-700">ST</span>
            <span className="text-emerald-700">ARK</span>
          </h1>
          <p className="mb-6 text-center text-sm text-slate-900">
            Ladda upp din JSON-fil med sparad data för att komma igång.
          </p>

          <button
            type="button"
            onClick={pickFile}
            disabled={importing}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-500 bg-emerald-50 px-4 py-6 text-sm font-semibold text-emerald-900 shadow-sm active:translate-y-px disabled:opacity-60"
          >
            <span className="text-lg">📁</span>
            <span>{importing ? "Laddar fil…" : "Ladda upp JSON-fil"}</span>
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFile}
          />

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-900">
            <div className="mb-2 font-semibold text-slate-700">💡 Tips</div>
            <p>
              För att skapa en ny profil och börja från början, använd laptopversionen av ST-ARK. 
              På mobilen kan du sedan ladda upp din JSON-fil för att fortsätta arbeta.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Översikt */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Översikt</h2>
          {profile && (
            <span className="text-xs text-slate-900">
              {profile.specialty || (profile as any).speciality || "Specialitet ej angiven"}
              {profile.goalsVersion && (
                <span className="ml-1">
                  , {profile.goalsVersion === "2021" ? "HSLF-FS 2021:8" : "SOSFS 2015:8"}
                </span>
              )}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-4 text-sm text-slate-900">Laddar …</div>
        ) : (
          <>
            {/* Progressbar - Andel av planerad tid */}
            <div className="mb-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-900">
                  Andel av planerad tid
                </span>
                <span className="font-semibold text-slate-900">
                  {progressPct.toFixed(0)} %
                </span>
              </div>
              <div className="mt-1 h-4 rounded-full bg-slate-200">
                <div
                  className="h-4 rounded-full bg-emerald-500 transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Progressbar - Delmålsuppfyllelse */}
            <div className="mb-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-900">
                  Delmålsuppfyllelse
                </span>
                <span className="font-semibold text-slate-900">
                  {milestoneProgressPct.toFixed(0)} %
                </span>
              </div>
              <div className="mt-1 h-4 rounded-full bg-slate-200">
                <div
                  className="h-4 rounded-full bg-emerald-500 transition-[width] duration-300"
                  style={{ width: `${milestoneProgressPct}%` }}
                />
              </div>
            </div>

            <div className="mt-1 text-sm text-slate-900">
              <div>
                <span className="font-medium text-slate-900">Slutdatum för ST:</span>{" "}
                <span className="font-semibold text-slate-900">
                  {(profile as any)?.stEndDate ?? stEndISO ?? "—"}
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Snabbgenvägar */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={onOpenScan}
          className="flex w-full items-center justify-between rounded-2xl border border-emerald-500 bg-emerald-50 px-4 py-4 text-left shadow-sm active:translate-y-px"
        >
          <div>
            <div className="text-lg font-semibold text-emerald-900">Scanna intyg</div>
            <div className="mt-1 text-sm font-normal text-emerald-800">
              Lägg till nya tjänstgöringar och kurser direkt från intyg.
            </div>
          </div>
          <span className="ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400 bg-white text-lg font-semibold text-emerald-900">
            +
          </span>
        </button>  
        
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-sm font-medium text-slate-900">Kliniska tjänstgöringar</div>
            {(() => {
              const today = todayISO();
              const ongoing = placements.filter((p: any) => {
                const start = p.startDate || "";
                const end = p.endDate || "";
                return start && end && start <= today && end >= today;
              });
              const upcoming = placements.filter((p: any) => {
                const start = p.startDate || "";
                return start && start > today;
              }).sort((a: any, b: any) => (a.startDate || "").localeCompare(b.startDate || ""));
              
              return (
                <div className="mt-2 space-y-2 text-xs text-slate-900">
                  {ongoing.length > 0 && (
                    <div>
                      <div className="font-medium">Pågående:</div>
                      <div className="mt-0.5 break-words font-semibold">{ongoing[0].clinic || "Klinik saknas"}</div>
                      <div className="text-slate-600">{ongoing[0].startDate || ""} – {ongoing[0].endDate || ""}</div>
                    </div>
                  )}
                  {upcoming.length > 0 && (
                    <div>
                      <div className="font-medium">Nästa:</div>
                      <div className="mt-0.5 break-words font-semibold">{upcoming[0].clinic || "Klinik saknas"}</div>
                      <div className="text-slate-600">{upcoming[0].startDate || ""} – {upcoming[0].endDate || ""}</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-sm font-medium text-slate-900">Kurser</div>
            {(() => {
              const today = todayISO();
              const completed = courses.filter((c: any) => {
                const cert = c.certificateDate || "";
                const end = c.endDate || "";
                const date = cert || end;
                return date && date <= today;
              }).sort((a: any, b: any) => {
                const dateA = a.certificateDate || a.endDate || "";
                const dateB = b.certificateDate || b.endDate || "";
                return dateB.localeCompare(dateA);
              });
              const upcoming = courses.filter((c: any) => {
                const start = c.startDate || "";
                return start && start > today;
              }).sort((a: any, b: any) => (a.startDate || "").localeCompare(b.startDate || ""));
              
              return (
                <div className="mt-2 space-y-2 text-xs text-slate-900">
                  {completed.length > 0 && (
                    <div>
                      <div className="font-medium">Senast genomförda:</div>
                      <div className="mt-0.5 break-words font-semibold">{completed[0].title || completed[0].courseName || "Kurs"}</div>
                      <div className="text-slate-600">
                        {completed[0].certificateDate || (completed[0].startDate && completed[0].endDate ? `${completed[0].startDate} – ${completed[0].endDate}` : completed[0].endDate || completed[0].startDate || "")}
                      </div>
                    </div>
                  )}
                  {upcoming.length > 0 && (
                    <div>
                      <div className="font-medium">Nästa:</div>
                      <div className="mt-0.5 break-words font-semibold">{upcoming[0].title || upcoming[0].courseName || "Kurs"}</div>
                      <div className="text-slate-600">{upcoming[0].startDate || ""} – {upcoming[0].endDate || ""}</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </section>
    </div>
  );
}

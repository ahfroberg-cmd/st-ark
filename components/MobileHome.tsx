// components/MobileHome.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { Profile, Placement } from "@/lib/types";

type MobileHomeProps = {
  onOpenScan?: () => void;
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

export default function MobileHome({ onOpenScan }: MobileHomeProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);

  // Planerad total tid (BT+ST eller ST) – samma logik som i PusslaDinST
  const [planMonths, setPlanMonths] = useState<number>(60);
  const [restAttendance, setRestAttendance] = useState<number>(100); // tjänstgöring på X %
  const [stEndISO, setStEndISO] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        const profArr = await (db as any).profile?.toArray?.();
        const prof = (Array.isArray(profArr) ? profArr[0] : null) as Profile | null;

        const pls =
          ((await (db as any).placements?.toArray?.()) ?? []) as Placement[];

        if (!live) return;

        setProfile(prof ?? null);
        setPlacements(pls);

        // Planerad total tid
        const gv = normalizeGoalsVersion((prof as any)?.goalsVersion);
        const fromProfile = Number((prof as any)?.stTotalMonths);
        if (Number.isFinite(fromProfile) && fromProfile > 0) {
          setPlanMonths(fromProfile);
        } else {
          setPlanMonths(gv === "2021" ? 66 : 60);
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

  // Beräkna ST-slutdatum vid tjänstgöring på X %
  useEffect(() => {
    const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
    const totalPlanMonths = Math.max(0, planMonths);
    const restFrac = Math.max(0, Math.min(1, (restAttendance || 0) / 100));

    if (!totalPlanMonths || restFrac <= 0) {
      setStEndISO(null);
      return;
    }

    const remainingFte = Math.max(0, totalPlanMonths - workedFteMonths);
    if (remainingFte === 0) {
      // All planerad FTE uppnådd – visa idag
      setStEndISO(todayISO());
      return;
    }

    const remainingCalendarMonths = remainingFte / restFrac;
    const endDate = addMonthsApprox(new Date(), remainingCalendarMonths);
    setStEndISO(fmtISO(endDate));
  }, [profile, planMonths, workedFteMonths, restAttendance]);

  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
  const totalLabel = gv === "2021" ? "Total tid för BT + ST" : "Total tid för ST";

  return (
    <div className="space-y-4">
      {/* ST-översikt */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">ST-översikt</h2>
          {profile && (
            <span className="text-xs text-slate-500">
              {profile.specialty || (profile as any).speciality || "Specialitet ej angiven"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-4 text-sm text-slate-500">Laddar …</div>
        ) : (
          <>
            {/* Progressbar */}
            <div className="mb-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-600">
                  Andel av planerad tid
                </span>
                <span className="font-semibold text-slate-900">
                  {progressPct.toFixed(0)} %
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="mt-1 space-y-2 text-sm">
              <div>
                <span className="font-medium">Registrerad tid motsvarande heltid:</span>{" "}
                <span className="font-semibold">
                  {workedFteMonths.toFixed(1)} mån
                </span>
              </div>

              <div>
                <span className="font-medium">{totalLabel}:</span>{" "}
                <span className="font-semibold">
                  {planMonths} mån
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  Slutdatum för ST vid tjänstgöring på
                </span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={5}
                  value={restAttendance}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    setRestAttendance(Math.max(0, Math.min(200, v)));
                  }}
                  className="h-8 w-16 rounded-lg border border-slate-300 px-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
                <span>%:</span>
                <span className="font-semibold">
                  {stEndISO ?? "—"}
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
          className="flex w-full items-center justify-between rounded-2xl border border-emerald-500 bg-emerald-50 px-4 py-3 text-left text-sm font-semibold text-emerald-900 shadow-sm active:translate-y-px"
        >
          <div>
            <div>Scanna intyg</div>
            <div className="text-xs font-normal text-emerald-800">
              Lägg till nya tjänstgöringar och kurser direkt från intyg.
            </div>
          </div>
          <span className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400 bg-white text-xs">
            +
          </span>
        </button>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-slate-500">Kliniska tjänstgöringar</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {placements.length}
            </div>
          </div>
          {/* Här kan du senare lägga motsv. för kurser, handledning osv */}
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-slate-500">Profil</div>
            <div className="mt-1 text-xs text-slate-700">
              {profile?.name || "Namn saknas"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

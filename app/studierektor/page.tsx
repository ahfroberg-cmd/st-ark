// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { useRef, useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { validateJsonFile, safeJsonParse } from "@/lib/validation";
import dynamic from "next/dynamic";
import { loadGoals, type GoalsCatalog, type GoalsMilestone } from "@/lib/goals";
import { btMilestones } from "@/lib/goals-bt";
import { mergeWithCommon, COMMON_AB_MILESTONES } from "@/lib/goals-common";
import { milestoneRequires } from "@/lib/milestoneRequirements";
import { displayMilestoneCode } from "@/lib/milestoneDisplay";

const AboutModal = dynamic(() => import("@/components/AboutModal"), { ssr: false });

interface SupervisorStudent {
  id: string;
  name: string;
  personnummer: string;
  specialty: string;
  goalsVersion: "2015" | "2021";
  importedAt: string;
  lastUpdated: string;
  profile: any;
  placements: any[];
  courses: any[];
  achievements: any[];
  timeline?: any[];  // IUP-data (id="iup" innehåller planning, planningExtra, etc.)
  iupMilestonePlans?: any[];  // Delmålsplaner
}

function DelmalReadonly({
  student,
}: {
  student: SupervisorStudent;
}) {
  const [goals, setGoals] = useState<GoalsCatalog | null>(null);
  const [tab, setTab] = useState<"st" | "bt">("st");
  const [showDone, setShowDone] = useState(true);
  const [showOngoing, setShowOngoing] = useState(true);
  const [showPlanned, setShowPlanned] = useState(true);

  const [planPopupOpen, setPlanPopupOpen] = useState(false);
  const [planPopupMilestoneId, setPlanPopupMilestoneId] = useState<string | null>(null);

  const [listOpen, setListOpen] = useState(false);
  const [listTitle, setListTitle] = useState("");
  const [listItems, setListItems] = useState<{ id: string; line1: string; line2?: string }[]>([]);

  const placements = student.placements || [];
  const courses = student.courses || [];
  const achievements = student.achievements || [];
  const iupMilestonePlans = student.iupMilestonePlans || [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await loadGoals(student.goalsVersion, student.specialty);
        if (!cancelled) setGoals(g);
      } catch {
        if (!cancelled) setGoals(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student.goalsVersion, student.specialty]);

  const planByMilestone = useMemo(() => {
    const map: Record<string, { text: string; updatedAt?: string }> = {};
    for (const row of iupMilestonePlans as any[]) {
      const mid = String(row?.milestoneId ?? row?.id ?? "");
      if (!mid) continue;
      const text = String(row?.planText ?? row?.text ?? "");
      const updatedAt = row?.updatedAt ? String(row.updatedAt) : undefined;
      map[mid] = { text, updatedAt };
    }
    return map;
  }, [iupMilestonePlans]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const classifyActivity = useCallback(
    (startISO?: string, endISO?: string): "planned" | "ongoing" | "done" | null => {
      const s = (startISO || "").slice(0, 10);
      const e = (endISO || "").slice(0, 10);
      if (!s && !e) return null;
      if (s && s > todayIso) return "planned";
      if (e && e < todayIso) return "done";
      return "ongoing";
    },
    [todayIso]
  );

  const statusAllowed = useCallback(
    (st: "planned" | "ongoing" | "done" | null): boolean => {
      if (!st) return false;
      if (st === "done") return showDone;
      if (st === "ongoing") return showOngoing;
      return showPlanned;
    },
    [showDone, showOngoing, showPlanned]
  );

  const normKey = useCallback((v: any) => {
    return String(v ?? "")
      .trim()
      .split("-")[0]
      .toUpperCase()
      .replace(/\s|_/g, "");
  }, []);

  const stAliasesFor = useCallback(
    (mid: string) => {
      const midNorm = normKey(mid);
      const aliases = new Set<string>();
      if (!midNorm) return aliases;
      aliases.add(midNorm);

      const m1 = midNorm.match(/^ST([ABC])(\d+)$/);
      if (m1) aliases.add(`${m1[1]}${m1[2]}`);

      const m2 = midNorm.match(/^([ABC])(\d+)$/);
      if (m2) aliases.add(`ST${m2[1]}${m2[2]}`);

      return aliases;
    },
    [normKey]
  );

  const courseStatus = useCallback(
    (cr: any): "planned" | "ongoing" | "done" | null => {
      const s = cr?.startDate;
      const e = cr?.endDate;
      if (s || e) return classifyActivity(s, e);
      const cert = cr?.certificateDate || cr?.endDate || cr?.startDate;
      if (!cert) return null;
      return String(cert).slice(0, 10) < todayIso ? "done" : "planned";
    },
    [classifyActivity, todayIso]
  );

  const isArbPlacement = useCallback((pl: any): boolean => {
    const t = String(pl?.type ?? "").trim().toLowerCase();
    return t === "vetenskapligt arbete" || t === "förbättringsarbete";
  }, []);

  const countsForSt = useCallback(
    (mid: string) => {
      let klin = 0;
      let kurs = 0;
      let arb = 0;

      const aliases = stAliasesFor(mid);
      if (aliases.size === 0) return { klin, kurs, arb };

      const matchKey = (v: any) => {
        const k = normKey(v);
        return !!k && aliases.has(k);
      };

      const countedPlac = new Set<string>();
      const countedCourse = new Set<string>();

      for (const a of achievements as any[]) {
        const cand = [a.milestoneId, a.goalId, a.id, a.code, a.milestone];
        if (!cand.some(matchKey)) continue;

        if (a.placementId) {
          const pl = placements.find((p: any) => p.id === a.placementId);
          const st = classifyActivity(pl?.startDate, pl?.endDate);
          if (pl && statusAllowed(st) && !countedPlac.has(pl.id)) {
            countedPlac.add(pl.id);
            if (isArbPlacement(pl)) arb += 1;
            else klin += 1;
          }
        }

        if (a.courseId) {
          const cr = courses.find((c: any) => c.id === a.courseId);
          const st = courseStatus(cr);
          if (cr && statusAllowed(st) && !countedCourse.has(cr.id)) {
            countedCourse.add(cr.id);
            kurs += 1;
          }
        }
      }

      for (const pl of placements as any[]) {
        if (countedPlac.has(pl.id)) continue;
        const st = classifyActivity(pl?.startDate, pl?.endDate);
        if (!statusAllowed(st)) continue;

        const arrs = [pl.milestones, pl.goals, pl.goalIds, pl.milestoneIds];
        if (arrs.some((arr) => arr && (arr as any[]).some(matchKey))) {
          countedPlac.add(pl.id);
          if (isArbPlacement(pl)) arb += 1;
          else klin += 1;
        }
      }

      for (const cr of courses as any[]) {
        if (countedCourse.has(cr.id)) continue;
        const st = courseStatus(cr);
        if (!statusAllowed(st)) continue;

        const arrs = [cr.milestones, cr.goals, cr.goalIds, cr.milestoneIds];
        if (arrs.some((arr) => arr && (arr as any[]).some(matchKey))) {
          countedCourse.add(cr.id);
          kurs += 1;
        }
      }

      return { klin, kurs, arb };
    },
    [achievements, placements, courses, classifyActivity, statusAllowed, normKey, stAliasesFor, courseStatus, isArbPlacement]
  );

  const getPlanningStatus = useCallback(
    (mid: string) => {
      const entry = planByMilestone[mid];
      const planText = entry?.text ?? "";
      const hasPlan = planText.trim().length > 0;

      if (!hasPlan) {
        return { text: "Inväntar planering", color: "text-red-600", italic: true };
      }

      if (entry?.updatedAt) {
        try {
          const d = new Date(entry.updatedAt);
          const formatted = d.toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
          return { text: `Planering uppdaterad: ${formatted}`, color: "text-slate-900", italic: true };
        } catch {
          return { text: "Planering uppdaterad", color: "text-slate-900", italic: true };
        }
      }

      return { text: "Planering uppdaterad", color: "text-slate-900", italic: true };
    },
    [planByMilestone]
  );

  const stGroups = useMemo(() => {
    const groups: Record<"A" | "B" | "C", GoalsMilestone[]> = { A: [], B: [], C: [] };
    if (!goals) return groups;

    const all: GoalsMilestone[] = (goals.milestones || []) as any;

    const withCommon = all.map((m) => mergeWithCommon(m));

    const pickLetter = (m: any): "A" | "B" | "C" | null => {
      const raw = String(m?.code ?? m?.id ?? "");
      const k = raw.toUpperCase().replace(/\s|_/g, "");
      const noSt = k.startsWith("ST") ? k.slice(2) : k;
      const ch = noSt.slice(0, 1);
      if (ch === "A" || ch === "B" || ch === "C") return ch;
      return null;
    };

    for (const m of withCommon) {
      const letter = pickLetter(m);
      if (!letter) continue;
      groups[letter].push(m as any);
    }

    if (student.goalsVersion === "2015") {
      const commons = Object.values(COMMON_AB_MILESTONES as any) as any[];
      for (const m of commons) {
        const letter = pickLetter(m);
        if (letter === "A" || letter === "B") {
          if (!groups[letter].some((x) => String((x as any).id) === String(m.id))) {
            groups[letter].push(m as any);
          }
        }
      }
    }

    if (student.goalsVersion === "2021") {
      const commons = Object.values(COMMON_AB_MILESTONES as any) as any[];
      for (const m of commons) {
        const rawId = String((m as any)?.id ?? (m as any)?.code ?? "").toUpperCase().replace(/\s+/g, "");
        if (!/^ST[ABC]\d+$/i.test(rawId)) continue;
        const letter = pickLetter(m);
        if (!letter) continue;
        if (!groups[letter].some((x) => String((x as any).id).toUpperCase() === String((m as any).id).toUpperCase())) {
          groups[letter].push(m as any);
        }
      }
    }

    return groups;
  }, [goals, student.goalsVersion]);

  const btRows = useMemo(() => {
    if (student.goalsVersion !== "2021") return [] as { code: string; klinCount: number; kursCount: number }[];

    const klin: Record<string, number> = {};
    const kurs: Record<string, number> = {};

    const normalizeBtCode = (v: any): string => {
      const s = String(v ?? "").toUpperCase().replace(/\s|_|-/g, "");
      const m = s.match(/^(BT\d+)/);
      return m ? m[1] : "";
    };

    const objHasBtCode = (obj: any, codeNorm: string) => {
      const arrs = [obj?.btMilestones, obj?.btGoals, obj?.milestones, obj?.goals, obj?.goalIds, obj?.milestoneIds];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const x of arr as any[]) {
          const c = normalizeBtCode(x);
          if (c && c === codeNorm) return true;
        }
      }
      return false;
    };

    for (const a of achievements as any[]) {
      const cand = [a.goalId, a.milestoneId, a.id, a.code, a.milestone].filter(Boolean);
      for (const c of cand) {
        const code = normalizeBtCode(c);
        if (!code) continue;

        if (a.placementId) {
          const pl = placements.find((p: any) => p.id === a.placementId);
          const st = classifyActivity(pl?.startDate, pl?.endDate);
          if (pl && statusAllowed(st)) klin[code] = (klin[code] ?? 0) + 1;
        }

        if (a.courseId) {
          const cr = courses.find((c0: any) => c0.id === a.courseId);
          const st = courseStatus(cr);
          if (cr && statusAllowed(st)) kurs[code] = (kurs[code] ?? 0) + 1;
        }
      }
    }

    for (const p of placements as any[]) {
      const st = classifyActivity(p?.startDate, p?.endDate);
      if (!statusAllowed(st)) continue;
      for (const m of btMilestones as any[]) {
        const code = String(m.id).toUpperCase().replace(/\s|_|-/g, "");
        if (objHasBtCode(p, code)) klin[code] = (klin[code] ?? 0) + 1;
      }
    }

    for (const c of courses as any[]) {
      const st = courseStatus(c);
      if (!statusAllowed(st)) continue;
      for (const m of btMilestones as any[]) {
        const code = String(m.id).toUpperCase().replace(/\s|_|-/g, "");
        if (objHasBtCode(c, code)) kurs[code] = (kurs[code] ?? 0) + 1;
      }
    }

    const sortNum = (code: string) => Number(code.replace(/[^\d]/g, "")) || 0;
    return (btMilestones as any[])
      .map((m) => {
        const code = String(m.id).toUpperCase().replace(/\s|_|-/g, "");
        return {
          code,
          klinCount: klin[code] ?? 0,
          kursCount: kurs[code] ?? 0,
        };
      })
      .sort((a, b) => sortNum(a.code) - sortNum(b.code));
  }, [student.goalsVersion, achievements, placements, courses, classifyActivity, statusAllowed, courseStatus]);

  const openMilestonePlan = useCallback((mid: string) => {
    setPlanPopupMilestoneId(mid);
    setPlanPopupOpen(true);
  }, []);

  const openList = useCallback(
    (kind: "klin" | "kurs" | "arb" | "intyg", m: any) => {
      const midRaw = String(m?.id ?? m?.code ?? "");

      const buildItemsPlac = (arr: any[]) =>
        (arr
          .map((a) => {
            const r = placements.find((p: any) => p.id === a.placementId);
            if (!r) return null;
            return {
              id: String(r.id),
              line1: r.clinic || r.title || "Klinisk tjänstgöring",
              line2: `${r.startDate || ""}${r.endDate ? ` – ${r.endDate}` : ""}${r.attendance ? ` · ${r.attendance}%` : ""}`,
            };
          })
          .filter(Boolean) as { id: string; line1: string; line2?: string }[]);

      const buildItemsCourse = (arr: any[]) =>
        (arr
          .map((a) => {
            const r = courses.find((c: any) => c.id === a.courseId);
            if (!r) return null;
            return {
              id: String(r.id),
              line1: r.title || r.provider || "Kurs",
              line2: [r.city, r.certificateDate || r.endDate || r.startDate].filter(Boolean).join(" · "),
            };
          })
          .filter(Boolean) as { id: string; line1: string; line2?: string }[]);

      const isBt = /^BT\d+$/i.test(String(midRaw));
      if (isBt) {
        const code = String(midRaw).toUpperCase().replace(/\s|_|-/g, "");

        const objHasBtCode = (obj: any, codeNorm: string) => {
          const arrs = [obj?.btMilestones, obj?.btGoals, obj?.milestones, obj?.goals, obj?.goalIds, obj?.milestoneIds];
          for (const arr of arrs) {
            if (!arr) continue;
            for (const x of arr as any[]) {
              const cand = String(x ?? "").toUpperCase().replace(/\s|_|-/g, "");
              if (cand === codeNorm) return true;
            }
          }
          return false;
        };

        const placMatches = (placements as any[])
          .filter((p) => objHasBtCode(p, code))
          .filter((p) => statusAllowed(classifyActivity(p?.startDate, p?.endDate)))
          .map((p) => ({ placementId: p.id }));
        const courseMatches = (courses as any[])
          .filter((c) => objHasBtCode(c, code))
          .filter((c) => statusAllowed(courseStatus(c)))
          .map((c) => ({ courseId: c.id }));

        const items = [...buildItemsPlac(placMatches), ...buildItemsCourse(courseMatches)];
        setListTitle(`${code} – Utbildningsmoment`);
        setListItems(items);
        setListOpen(true);
        return;
      }

      const aliases = stAliasesFor(midRaw);
      const matchKey = (v: any) => {
        const k = normKey(v);
        return !!k && aliases.has(k);
      };

      const placRefs: any[] = [];
      const courseRefs: any[] = [];
      const seenPlac = new Set<string>();
      const seenCourse = new Set<string>();

      for (const a of achievements as any[]) {
        const cand = [a.milestoneId, a.goalId, a.id, a.code, a.milestone];
        if (!cand.some(matchKey)) continue;

        if (a.placementId) {
          const pl = placements.find((p: any) => p.id === a.placementId);
          const st = classifyActivity(pl?.startDate, pl?.endDate);
          if (pl && statusAllowed(st) && !seenPlac.has(pl.id)) {
            seenPlac.add(pl.id);
            placRefs.push({ placementId: pl.id });
          }
        }

        if (a.courseId) {
          const cr = courses.find((c: any) => c.id === a.courseId);
          const st = courseStatus(cr);
          if (cr && statusAllowed(st) && !seenCourse.has(cr.id)) {
            seenCourse.add(cr.id);
            courseRefs.push({ courseId: cr.id });
          }
        }
      }

      for (const pl of placements as any[]) {
        if (seenPlac.has(pl.id)) continue;
        const st = classifyActivity(pl?.startDate, pl?.endDate);
        if (!statusAllowed(st)) continue;
        const arrs = [pl.milestones, pl.goals, pl.goalIds, pl.milestoneIds];
        if (arrs.some((arr) => arr && (arr as any[]).some(matchKey))) {
          seenPlac.add(pl.id);
          placRefs.push({ placementId: pl.id });
        }
      }

      for (const cr of courses as any[]) {
        if (seenCourse.has(cr.id)) continue;
        const st = courseStatus(cr);
        if (!statusAllowed(st)) continue;
        const arrs = [cr.milestones, cr.goals, cr.goalIds, cr.milestoneIds];
        if (arrs.some((arr) => arr && (arr as any[]).some(matchKey))) {
          seenCourse.add(cr.id);
          courseRefs.push({ courseId: cr.id });
        }
      }

      const klinPlacRefs = placRefs.filter((x: any) => {
        if (!x?.placementId) return false;
        const pl = placements.find((p: any) => p.id === x.placementId);
        return pl && !isArbPlacement(pl);
      });
      const arbPlacRefs = placRefs.filter((x: any) => {
        if (!x?.placementId) return false;
        const pl = placements.find((p: any) => p.id === x.placementId);
        return !!pl && isArbPlacement(pl);
      });

      const rawCode = String(m?.code ?? midRaw);
      const titleCode = displayMilestoneCode(rawCode, student.goalsVersion);

      if (kind === "klin") {
        setListTitle(`${titleCode} – Kliniska tjänstgöringar`);
        setListItems(klinPlacRefs.length > 0 ? buildItemsPlac(klinPlacRefs) : []);
        setListOpen(true);
        return;
      }

      if (kind === "kurs") {
        setListTitle(`${titleCode} – Kurser`);
        setListItems(courseRefs.length > 0 ? buildItemsCourse(courseRefs) : []);
        setListOpen(true);
        return;
      }

      setListTitle(`${titleCode} – Arbeten`);
      setListItems(arbPlacRefs.length > 0 ? buildItemsPlac(arbPlacRefs) : []);
      setListOpen(true);
    },
    [
      achievements,
      placements,
      courses,
      classifyActivity,
      statusAllowed,
      courseStatus,
      stAliasesFor,
      normKey,
      student.goalsVersion,
      isArbPlacement,
    ]
  );

  const selectedMilestone = useMemo(() => {
    if (!planPopupMilestoneId || !goals) return null;
    const mid = String(planPopupMilestoneId);
    const midNorm = mid.toUpperCase().replace(/\s+/g, "");
    const is2021 = student.goalsVersion === "2021";
    const isAb2015 = !is2021 && /^[AB]\d+$/i.test(midNorm);

    let base: any = null;
    if (isAb2015) {
      base = (COMMON_AB_MILESTONES as any)[midNorm] ?? (COMMON_AB_MILESTONES as any)[midNorm.toLowerCase()] ?? null;
    } else {
      base = (goals.milestones || []).find((m: any) => m.id === mid || m.code === mid) ?? null;
      if (!base) {
        base = (COMMON_AB_MILESTONES as any)[midNorm] ?? (COMMON_AB_MILESTONES as any)[midNorm.toLowerCase()] ?? null;
      }
    }

    return base ? mergeWithCommon(base) : null;
  }, [planPopupMilestoneId, goals, student.goalsVersion]);

  const planTextForSelected = useMemo(() => {
    if (!planPopupMilestoneId) return "";
    return planByMilestone[planPopupMilestoneId]?.text ?? "";
  }, [planPopupMilestoneId, planByMilestone]);

  const hasAnySt = useMemo(() => {
    return stGroups.A.length + stGroups.B.length + stGroups.C.length > 0;
  }, [stGroups]);

  const is2021 = student.goalsVersion === "2021";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {is2021 ? (
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="milestone-tab-studierektor"
                checked={tab === "st"}
                onChange={() => setTab("st")}
                className="h-4 w-4.5 border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm font-medium text-slate-900">ST-delmål</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="milestone-tab-studierektor"
                checked={tab === "bt"}
                onChange={() => setTab("bt")}
                className="h-4 w-4.5 border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-sm font-medium text-slate-900">BT-delmål</span>
            </label>
          </div>
        ) : (
          <div className="text-sm font-medium text-slate-900">ST-delmål</div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={showDone} onChange={() => setShowDone((v) => !v)} />
            <span>Genomförda</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={showOngoing} onChange={() => setShowOngoing((v) => !v)} />
            <span>Pågående</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={showPlanned} onChange={() => setShowPlanned((v) => !v)} />
            <span>Planerade</span>
          </label>
        </div>
      </div>

      {!goals ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
          Inga mål inlästa – kontrollera specialitet och målversion.
        </div>
      ) : tab === "bt" ? (
        student.goalsVersion !== "2021" ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
            BT-delmål är endast tillgängliga för målversion 2021.
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {btRows.map((row) => {
              const m = (btMilestones as any[]).find((x: any) => String(x.id).toUpperCase() === String(row.code).toUpperCase());
              const total = (row.klinCount ?? 0) + (row.kursCount ?? 0);
              return (
                <article key={row.code} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openMilestonePlan(row.code)}
                    className="dm-row flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                    title="Visa information om delmålet"
                  >
                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-900 shrink-0">
                      {row.code}
                    </span>
                    <span className="min-w-0 flex-1 text-[12px] text-slate-900 line-clamp-2 break-words">
                      {m?.title ?? "BT-delmål"}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openList("intyg", { code: row.code })}
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
            {btRows.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                Inga BT-delmål matchar sökningen.
              </div>
            )}
          </div>
        )
      ) : !hasAnySt ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
          Inga delmål matchar sökningen.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <section>
            <h3 className="mb-2 text-[12px] font-semibold text-slate-900">Delmål A</h3>
            <div className="mb-4 space-y-1.5">
              {stGroups.A.map((m: any) => {
                const { klin, kurs, arb } = countsForSt(m.id);
                const status = getPlanningStatus(m.id);
                const req = milestoneRequires(m);
                return (
                  <article key={m.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openMilestonePlan(m.id)}
                      className="dm-row flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                    >
                      <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-900 shrink-0">
                        {(() => {
                          const code = String((m.code ?? "")).includes("-") ? String((m.code ?? "")).split("-")[0] : String((m.code ?? ""));
                          return displayMilestoneCode(code, student.goalsVersion);
                        })()}
                      </span>
                      <span className="truncate text-[12px] text-slate-900 flex-1">{String(m.title || "").length > 50 ? String(m.title).slice(0, 50) + "..." : String(m.title || "")}</span>
                      <span className={`text-[11px] ${status.color} ${status.italic ? "italic" : ""} shrink-0 ml-auto`}>{status.text}</span>
                    </button>

                    <div className="grid grid-flow-col auto-cols-max gap-1.5 min-w-[112px] justify-end">
                      {req.klin && (
                        <button
                          type="button"
                          onClick={() => openList("klin", m)}
                          className={
                            klin > 0
                              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                              : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                          }
                        >
                          <span>Klin</span>
                          <span className="min-w-[1.2ch] text-right">{klin}</span>
                        </button>
                      )}
                      {req.kurs && (
                        <button
                          type="button"
                          onClick={() => openList("kurs", m)}
                          className={
                            kurs > 0
                              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                              : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                          }
                        >
                          <span>Kurs</span>
                          <span className="min-w-[1.2ch] text-right">{kurs}</span>
                        </button>
                      )}
                      {req.arb && (
                        <button
                          type="button"
                          onClick={() => openList("arb", m)}
                          className={
                            arb > 0
                              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                              : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                          }
                        >
                          <span>Arb</span>
                          <span className="min-w-[1.2ch] text-right">{arb}</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <h3 className="mb-2 text-[12px] font-semibold text-slate-900">Delmål B</h3>
            <div className="space-y-1.5">
              {stGroups.B.map((m: any) => {
                const { klin, kurs, arb } = countsForSt(m.id);
                const status = getPlanningStatus(m.id);
                const req = milestoneRequires(m);
                return (
                  <article key={m.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openMilestonePlan(m.id)}
                      className="dm-row flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                    >
                      <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-900 shrink-0">
                        {(() => {
                          const code = String((m.code ?? "")).includes("-") ? String((m.code ?? "")).split("-")[0] : String((m.code ?? ""));
                          return displayMilestoneCode(code, student.goalsVersion);
                        })()}
                      </span>
                      <span className="truncate text-[12px] text-slate-900 flex-1">{String(m.title || "").length > 50 ? String(m.title).slice(0, 50) + "..." : String(m.title || "")}</span>
                      <span className={`text-[11px] ${status.color} ${status.italic ? "italic" : ""} shrink-0 ml-auto`}>{status.text}</span>
                    </button>

                    <div className="grid grid-flow-col auto-cols-max gap-1.5 min-w-[112px] justify-end">
                      {req.klin && (
                        <button
                          type="button"
                          onClick={() => openList("klin", m)}
                          className={
                            klin > 0
                              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                              : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                          }
                        >
                          <span>Klin</span>
                          <span className="min-w-[1.2ch] text-right">{klin}</span>
                        </button>
                      )}
                      {req.kurs && (
                        <button
                          type="button"
                          onClick={() => openList("kurs", m)}
                          className={
                            kurs > 0
                              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                              : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                          }
                        >
                          <span>Kurs</span>
                          <span className="min-w-[1.2ch] text-right">{kurs}</span>
                        </button>
                      )}
                      {req.arb && (
                        <button
                          type="button"
                          onClick={() => openList("arb", m)}
                          className={
                            arb > 0
                              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                              : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                          }
                        >
                          <span>Arb</span>
                          <span className="min-w-[1.2ch] text-right">{arb}</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[12px] font-semibold text-slate-900">Delmål C</h3>
            <div className="space-y-1.5">
              {stGroups.C.map((m: any) => {
                const { klin, kurs, arb } = countsForSt(m.id);
                const status = getPlanningStatus(m.id);
                const req = milestoneRequires(m);
                return (
                  <article key={m.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openMilestonePlan(m.id)}
                      className="dm-row flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                    >
                      <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-900 shrink-0">
                        {(() => {
                          const code = String((m.code ?? "")).includes("-") ? String((m.code ?? "")).split("-")[0] : String((m.code ?? ""));
                          return displayMilestoneCode(code, student.goalsVersion);
                        })()}
                      </span>
                      <span className="truncate text-[12px] text-slate-900 flex-1">{String(m.title || "").length > 50 ? String(m.title).slice(0, 50) + "..." : String(m.title || "")}</span>
                      <span className={`text-[11px] ${status.color} ${status.italic ? "italic" : ""} shrink-0 ml-auto`}>{status.text}</span>
                    </button>

                    <div className="grid grid-flow-col auto-cols-max gap-1.5 min-w-[112px] justify-end">
                      {req.klin && (
                        <button
                          type="button"
                          onClick={() => openList("klin", m)}
                          className={
                            klin > 0
                              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                              : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                          }
                        >
                          <span>Klin</span>
                          <span className="min-w-[1.2ch] text-right">{klin}</span>
                        </button>
                      )}
                      {req.kurs && (
                        <button
                          type="button"
                          onClick={() => openList("kurs", m)}
                          className={
                            kurs > 0
                              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                              : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                          }
                        >
                          <span>Kurs</span>
                          <span className="min-w-[1.2ch] text-right">{kurs}</span>
                        </button>
                      )}
                      {req.arb && (
                        <button
                          type="button"
                          onClick={() => openList("arb", m)}
                          className={
                            arb > 0
                              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                              : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                          }
                        >
                          <span>Arb</span>
                          <span className="min-w-[1.2ch] text-right">{arb}</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {planPopupOpen && planPopupMilestoneId && (
        <div
          className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPlanPopupOpen(false);
              setPlanPopupMilestoneId(null);
            }
          }}
        >
          <div
            className="w-full max-w-xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-black bg-white px-5 py-4 gap-4">
              <div className="min-w-0 flex-1 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 shrink-0">
                  {selectedMilestone
                    ? displayMilestoneCode(String((selectedMilestone as any)?.code ?? planPopupMilestoneId), student.goalsVersion)
                    : String(planPopupMilestoneId)}
                </span>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
                  {selectedMilestone ? String((selectedMilestone as any)?.title ?? "Delmål") : "Delmål"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPlanPopupOpen(false);
                  setPlanPopupMilestoneId(null);
                }}
                className="inline-flex h-[36px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              >
                Stäng
              </button>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-5 py-5 space-y-4">
              <div>
                <div className="mb-1 text-[13px] font-semibold text-slate-900">Planerade metoder och bedömningsinstrument</div>
                {planTextForSelected.trim().length > 0 ? (
                  <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-900">
                    {planTextForSelected}
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                    Ingen planering angiven.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {listOpen && (
        <div
          className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-3"
          onClick={(e) => {
            if (e.target === e.currentTarget) setListOpen(false);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
            <div className="max-h-[60vh] overflow-auto overscroll-contain touch-pan-y px-4 py-3">
              {listItems.length > 0 ? (
                <ul className="space-y-1.5">
                  {listItems.map((it) => (
                    <li key={it.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
                      <div className="font-semibold text-slate-900">{it.line1}</div>
                      {it.line2 && <div className="text-[11px] text-slate-900">{it.line2}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                  Inget kopplat.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

 const MONTH_NAMES = [
   "Jan",
   "Feb",
   "Mar",
   "Apr",
   "Maj",
   "Jun",
   "Jul",
   "Aug",
   "Sep",
   "Okt",
   "Nov",
   "Dec",
 ];

 const OUTSIDE_BG_CELL =
   "bg-[repeating-linear-gradient(135deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_8px)]";
 const INSIDE_BG_CELL = "bg-white";
 const OUTSIDE_BG_LANE =
   "bg-[repeating-linear-gradient(135deg,#eef2f7,#eef2f7_6px,#e6ebf2_6px,#e6ebf2_8px)]";
 const INSIDE_BG_LANE = "bg-slate-100";

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("sv-SE");
  } catch {
    return "-";
  }
}

function isZeroAttendancePlacementType(v: any): boolean {
  const t = String(v ?? "")
    .trim()
    .toLowerCase();
  return t.includes("ledighet") || t.includes("föräld") || t.includes("sjuk");
}

function fteDaysBetween(startISO: string, endISO: string, attendancePct: number): number {
  if (!startISO || !endISO) return 0;
  try {
    const s = new Date(`${startISO.slice(0, 10)}T00:00:00`);
    const e = new Date(`${endISO.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    if (e.getTime() < s.getTime()) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    const days = Math.floor((e.getTime() - s.getTime()) / msPerDay) + 1;
    const att = Number.isFinite(attendancePct) ? Math.max(0, Math.min(100, attendancePct)) : 100;
    return days * (att / 100);
  } catch {
    return 0;
  }
}

 function isValidISODate(s: string | undefined | null): s is string {
   if (!s) return false;
   if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
   const d = new Date(s + "T00:00:00");
   return !isNaN(d.getTime());
 }

 function toISODate(y: number, m1: number, d: number) {
   const yy = String(y).padStart(4, "0");
   const mm = String(m1).padStart(2, "0");
   const dd = String(d).padStart(2, "0");
   return `${yy}-${mm}-${dd}`;
 }

 function normalizeToISODate(v: unknown): string | null {
   if (!v) return null;
   if (typeof v === "string") {
     const s: any = String(v).trim();
     if (!s) return null;
     // YYYY-MM-DD
     if (isValidISODate(s)) return s;
     // YYYY-MM-DDTHH:mm...
     if (s.length >= 10 && isValidISODate(s.slice(0, 10))) return s.slice(0, 10);
     // DD/MM/YYYY or DD-MM-YYYY
     const m1 = s.match(/^\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*$/);
     if (m1) {
       const d = Number(m1[1]);
       const m = Number(m1[2]);
       const y = Number(m1[3]);
       if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return toISODate(y, m, d);
     }
     // YYYY/MM/DD
     const m2 = s.match(/^\s*(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*$/);
     if (m2) {
       const y = Number(m2[1]);
       const m = Number(m2[2]);
       const d = Number(m2[3]);
       if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return toISODate(y, m, d);
     }
     // Fallback: Date.parse
     const parsed = new Date(s);
     if (!isNaN(parsed.getTime())) {
       return toISODate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
     }
     return null;
   }
   if (v instanceof Date) {
     if (isNaN(v.getTime())) return null;
     return toISODate(v.getFullYear(), v.getMonth() + 1, v.getDate());
   }
   if (typeof v === "number") {
     const d = new Date(v);
     if (!isNaN(d.getTime())) return toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate());
   }
   return null;
 }

 function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

 function daysInYear(y: number) {
   const start = new Date(y, 0, 1);
   const end = new Date(y + 1, 0, 1);
   return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
 }

 function dayOfYear(d: Date) {
   const start = new Date(d.getFullYear(), 0, 1);
   return Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
 }

 function dateToSlotSnapped(startYear: number, dISO: string, mode: "start" | "end" = "start"): number {
   if (!isValidISODate(dISO)) return Number.POSITIVE_INFINITY;
   const d = new Date(dISO + "T00:00:00");
   let y = d.getFullYear();
   let m0 = d.getMonth();
   const day = d.getDate();

   // Samma gränser som i planera-st:
   // 1–7 => H1, 8–22 => H2, 23–EOM => nästa månads H1
   if (day <= 7) {
     return (y - startYear) * 24 + m0 * 2 + 0;
   }
   if (day <= 22) {
     return (y - startYear) * 24 + m0 * 2 + 1;
   }
   m0 += 1;
   if (m0 >= 12) {
     m0 = 0;
     y += 1;
   }
   return (y - startYear) * 24 + m0 * 2 + 0;
 }

 function clamp(n: number, min: number, max: number) {
   return Math.max(min, Math.min(max, n));
 }

 function plannedTotalMonths(profile: any, goalsVersion: "2015" | "2021"): number {
   const fromProfile = Number(profile?.stTotalMonths);
   if (Number.isFinite(fromProfile) && fromProfile > 0) return fromProfile;
   return goalsVersion === "2021" ? 66 : 60;
 }

function calculateMonths(startDate: string, endDate: string, attendance: number = 100): number {
  if (!startDate || !endDate) return 0;
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.round(months * (attendance / 100) * 10) / 10;
  } catch {
    return 0;
  }
}

function ActivityDetailPopup({
  activity,
  onClose,
  goalsVersion,
}: {
  activity: any;
  onClose: () => void;
  goalsVersion: string;
}) {
  const isSession = activity?.__type === "supervision" || activity?.__type === "assessment";

  if (isSession) {
    const isSupervision = activity?.__type === "supervision";
    const title =
      activity?.title ||
      activity?.name ||
      (isSupervision ? "Handledarsamtal" : "Progressionsbedömning");
    const dateISO = activity?.dateISO || activity?.date || activity?.iso;

    const fieldValue = (v: any) => {
      if (v == null || v === "") return null;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      return JSON.stringify(v);
    };

    const knownKeys = new Set([
      "__type",
      "id",
      "_id",
      "dateISO",
      "date",
      "iso",
      "title",
      "name",
      "note",
      "notes",
      "summary",
      "assessment",
      "kind",
      "type",
      // möten
      "focus",
      "actions",
      "nextDateISO",
      "discussed",
      // bedömningar
      "phase",
      "level",
      "instrument",
      "strengths",
      "development",
    ]);

    const extraEntries = Object.entries(activity || {}).filter(([k, v]) => {
      if (v == null || v === "") return false;
      return !knownKeys.has(k);
    });

    const meetingFocus = fieldValue(activity?.focus);
    const meetingDiscussed = fieldValue(activity?.discussed);
    const meetingSummary = fieldValue(activity?.summary || activity?.note || activity?.notes);
    const meetingActions = fieldValue(activity?.actions);
    const meetingNextDateISO = fieldValue(activity?.nextDateISO);

    const assessmentPhase = fieldValue(activity?.phase);
    const assessmentInstrument = fieldValue(activity?.instrument);
    const assessmentLevel = fieldValue(activity?.level);
    const assessmentSummary = fieldValue(activity?.summary || activity?.note || activity?.notes);
    const assessmentStrengths = fieldValue(activity?.strengths);
    const assessmentDevelopment = fieldValue(activity?.development);

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div
          className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="border-b border-black bg-white px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-600">
                  {isSupervision ? "Handledarsamtal" : "Progressionsbedömning"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
              >
                Stäng
              </button>
            </div>
          </div>

          <div className="max-h-[calc(80vh-80px)] overflow-y-auto p-5 space-y-4">
            <div>
              <p className="text-sm text-slate-500">Datum</p>
              <p className="font-medium text-slate-900">{formatDate(dateISO)}</p>
            </div>

            {isSupervision ? (
              <>
                {meetingFocus && (
                  <div>
                    <p className="text-sm text-slate-500">Fokus</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{meetingFocus}</p>
                  </div>
                )}
                {meetingDiscussed && (
                  <div>
                    <p className="text-sm text-slate-500">Diskuterat</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{meetingDiscussed}</p>
                  </div>
                )}
                {meetingSummary && (
                  <div>
                    <p className="text-sm text-slate-500">Sammanfattning</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{meetingSummary}</p>
                  </div>
                )}
                {meetingActions && (
                  <div>
                    <p className="text-sm text-slate-500">Åtgärder</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{meetingActions}</p>
                  </div>
                )}
                {meetingNextDateISO && (
                  <div>
                    <p className="text-sm text-slate-500">Nästa datum</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{formatDate(meetingNextDateISO)}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {(assessmentInstrument || assessmentLevel) && (
                  <div>
                    <p className="text-sm text-slate-500">Instrument</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentInstrument || "—"}</p>
                  </div>
                )}
                {assessmentLevel && (
                  <div>
                    <p className="text-sm text-slate-500">Nivå</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentLevel}</p>
                  </div>
                )}
                {assessmentPhase && (
                  <div>
                    <p className="text-sm text-slate-500">Fas</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentPhase}</p>
                  </div>
                )}
                {assessmentSummary && (
                  <div>
                    <p className="text-sm text-slate-500">Sammanfattning</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentSummary}</p>
                  </div>
                )}
                {assessmentStrengths && (
                  <div>
                    <p className="text-sm text-slate-500">Styrkor</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentStrengths}</p>
                  </div>
                )}
                {assessmentDevelopment && (
                  <div>
                    <p className="text-sm text-slate-500">Utvecklingsområden</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentDevelopment}</p>
                  </div>
                )}
              </>
            )}

            {extraEntries.length > 0 && (
              <div>
                <p className="text-sm text-slate-500">Övrigt</p>
                <div className="mt-2 space-y-2">
                  {extraEntries.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-2 gap-4">
                      <p className="text-sm text-slate-600 break-words">{k}</p>
                      <p className="text-sm text-slate-900 break-words">
                        {typeof v === "string" || typeof v === "number" || typeof v === "boolean"
                          ? String(v)
                          : JSON.stringify(v)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const milestones = activity.milestones || activity.stMilestones || [];
  const btMilestones = activity.btMilestones || [];
  
  // Beräkna månader om möjligt
  const months = activity.startDate && activity.endDate 
    ? calculateMonths(activity.startDate, activity.endDate, activity.attendance ?? 100)
    : null;

  // Avgör om det är en kurs eller placering
  const isCourse = !!(activity.title || activity.name || activity.kind || activity.certificateDate);

  const chipLabel = (m: unknown) =>
    String(m)
      .trim()
      .split(/\s|–|-|:|\u2013/)[0]
      .toLowerCase();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div 
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header med färgad bakgrund */}
        <div 
          className="border-b border-black bg-white px-5 py-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {activity.clinic || activity.label || activity.title || activity.name || "Aktivitet"}
              </h3>
              <p className="text-sm text-slate-600">
                {activity.type || activity.kind || (isCourse ? "Kurs" : "Klinisk tjänstgöring")}
                {activity.phase && <span className="ml-2 font-medium">• {activity.phase}</span>}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
            >
              Stäng
            </button>
          </div>
        </div>
        
        <div className="max-h-[calc(80vh-80px)] overflow-y-auto p-5 space-y-4">
          {/* Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Start</p>
              <p className="font-medium text-slate-900">{formatDate(activity.startDate)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{isCourse ? "Intygsdatum" : "Slut"}</p>
              <p className="font-medium text-slate-900">
                {formatDate(activity.certificateDate || activity.endDate)}
              </p>
            </div>
          </div>

          {/* Sysselsättningsgrad & Månader (bara för placeringar) */}
          {!isCourse && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Sysselsättningsgrad</p>
                <p className="font-medium text-slate-900">{activity.attendance ?? 100}%</p>
              </div>
              {months !== null && (
                <div>
                  <p className="text-sm text-slate-500">Tjänstgöringstid</p>
                  <p className="font-medium text-slate-900">{months.toFixed(1)} mån</p>
                </div>
              )}
            </div>
          )}

          {/* Handledare */}
          {activity.supervisor && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Handledare</p>
                <p className="font-medium text-slate-900">{activity.supervisor}</p>
              </div>
              {activity.supervisorSpeciality && (
                <div>
                  <p className="text-sm text-slate-500">Specialitet</p>
                  <p className="font-medium text-slate-900">{activity.supervisorSpeciality}</p>
                </div>
              )}
            </div>
          )}

          {/* Verksamhetschef */}
          {activity.operationsManager && (
            <div>
              <p className="text-sm text-slate-500">Verksamhetschef</p>
              <p className="font-medium text-slate-900">{activity.operationsManager}</p>
            </div>
          )}

          {/* Studierektor */}
          {activity.studyDirector && (
            <div>
              <p className="text-sm text-slate-500">Studierektor</p>
              <p className="font-medium text-slate-900">{activity.studyDirector}</p>
            </div>
          )}

          {/* BT-delmål */}
          {goalsVersion === "2021" && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">BT-delmål</p>
              <div className="flex items-center gap-1 flex-wrap">
                {btMilestones.length > 0 ? (
                  (btMilestones as any[]).map((m: any) => (
                    <button
                      key={`bt-${String(m)}`}
                      type="button"
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
                    >
                      {chipLabel(m)}
                    </button>
                  ))
                ) : (
                  <span className="text-slate-400 text-sm">—</span>
                )}
              </div>
            </div>
          )}

          {/* ST-delmål */}
          {milestones.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">ST-delmål</p>
              <div className="flex items-center gap-1 flex-wrap">
                {(milestones as any[]).map((m: any) => (
                  <button
                    key={`st-${String(m)}`}
                    type="button"
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
                  >
                    {chipLabel(m)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Anordnare (för kurser) */}
          {activity.organizer && (
            <div>
              <p className="text-sm text-slate-500">Anordnare</p>
              <p className="font-medium text-slate-900">{activity.organizer}</p>
            </div>
          )}

          {/* Kursledare (för kurser) */}
          {activity.courseLeader && (
            <div>
              <p className="text-sm text-slate-500">Kursledare</p>
              <p className="font-medium text-slate-900">{activity.courseLeader}</p>
            </div>
          )}

          {/* Anteckningar */}
          {(activity.note || activity.notes) && (
            <div>
              <p className="text-sm text-slate-500">Anteckningar</p>
              <p className="text-slate-900 whitespace-pre-wrap">{activity.note || activity.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentDetailModal({
  student,
  onClose,
}: {
  student: SupervisorStudent;
  onClose: () => void;
}) {
  const [mainTab, setMainTab] = useState<"utbildningsmoment" | "delmal" | "planering">("utbildningsmoment");
  const [umTab, setUmTab] = useState<"lista" | "tidslinje">("lista");
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [goalsCatalog, setGoalsCatalog] = useState<GoalsCatalog | null>(null);
  const [progressDetailOpen, setProgressDetailOpen] = useState<"time" | "milestones" | null>(null);
  const [hoveredTimeAct, setHoveredTimeAct] = useState<{
    id: string;
    label: string;
    startDate: string;
    endDate: string;
    days: number;
    attendance: number;
    hue: number;
    phase: "bt" | "st";
    anchorX: number;
    anchorTop: number;
  } | null>(null);
  const [hoveredSupervisionId, setHoveredSupervisionId] = useState<string | null>(null);
  const [hoveredAssessmentId, setHoveredAssessmentId] = useState<string | null>(null);
  const [laneWidthByYear, setLaneWidthByYear] = useState<Record<number, number>>({});
  const [chipWidthById, setChipWidthById] = useState<Record<string, number>>({});
  
  const placements = student.placements || [];
  const courses = student.courses || [];
  const achievements = student.achievements || [];
  const profile = student.profile || {};
  const goalsVersion = student.goalsVersion;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await loadGoals(student.goalsVersion, student.specialty);
        if (!cancelled) setGoalsCatalog(g);
      } catch {
        if (!cancelled) setGoalsCatalog(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [student.goalsVersion, student.specialty]);

  const placementHueById = useMemo(() => {
    const m = new Map<string, number>();
    (placements || []).forEach((p: any, i: number) => {
      const id = String(p?.id ?? "");
      if (!id) return;
      const hue = (p as any)?.hue ?? (210 + i * 30) % 360;
      m.set(id, hue);
    });
    return m;
  }, [placements]);
  
  // IUP-data från timeline (id="iup")
  const timelineArr = Array.isArray(student.timeline)
    ? student.timeline
    : student.timeline
    ? [student.timeline]
    : [];
  const iupData =
    timelineArr.find((t: any) => String(t?.id ?? "").toLowerCase() === "iup") || {};
  const iupPlanning = iupData.planning || {};
  const iupPlanningExtra = iupData.planningExtra || [];
  const iupPlanningHidden = iupData.planningHidden || [];
  const iupMeetings =
    iupData.meetings ||
    iupData.supervisionMeetings ||
    iupData.supervisionSessions ||
    iupData.handledartraffar ||
    [];
  const iupAssessments =
    iupData.assessments ||
    iupData.assessmentSessions ||
    iupData.progressAssessments ||
    iupData.progressionsbedömningar ||
    [];
  
  // Handledarträffar och progressionsbedömningar från profilen
  const supervisorMeetings =
    profile.supervisorMeetings ||
    profile.handledartraffar ||
    profile.meetings ||
    profile.iup?.meetings ||
    profile.iup?.supervisionSessions ||
    [];
  const progressAssessments =
    profile.progressAssessments ||
    profile.progressionsbedömningar ||
    profile.assessments ||
    profile.iup?.assessments ||
    profile.iup?.assessmentSessions ||
    [];

  const supervisionSessions = (iupMeetings.length > 0 ? iupMeetings : supervisorMeetings)
    .map((m: any, i: number) => ({
      ...m,
      id: String(m.id || m._id || `meeting-${i}`),
      dateISO: normalizeToISODate(m.dateISO || m.date || m.iso) || "",
      __type: "supervision" as const,
    }))
    .filter((s: any) => isValidISODate(s.dateISO));

  const assessmentSessions = (iupAssessments.length > 0 ? iupAssessments : progressAssessments)
    .map((a: any, i: number) => ({
      ...a,
      id: String(a.id || a._id || `assessment-${i}`),
      dateISO: normalizeToISODate(a.dateISO || a.date || a.iso) || "",
      __type: "assessment" as const,
    }))
    .filter((s: any) => isValidISODate(s.dateISO));
  
  const totalMonths = placements.reduce((sum: number, p: any) => 
    sum + calculateMonths(p.startDate, p.endDate, p.attendance), 0);
  const targetMonths = 60;
  const progress = Math.min(100, Math.round((totalMonths / targetMonths) * 100));

  // Beräkna tidslinje-data
  const allActivities = [...placements, ...courses].sort((a, b) => {
    const dateA = new Date(a.startDate || a.certificateDate || "").getTime();
    const dateB = new Date(b.startDate || b.certificateDate || "").getTime();
    return dateA - dateB;
  });

  const years = Array.from(new Set(allActivities.map(a => {
    const d = new Date(a.startDate || a.certificateDate || "");
    return d.getFullYear();
  }).filter(y => !isNaN(y)))).sort();

  const minYear = years[0] || new Date().getFullYear();
  const maxYear = years[years.length - 1] || new Date().getFullYear();

  const timelineYears: number[] = [];
  
  const profileBtStartISO = normalizeToISODate(profile?.btStartDate);
  const profileStStartISO = normalizeToISODate(profile?.stStartDate);
  const profileStartISO = goalsVersion === "2021" ? (profileBtStartISO || profileStStartISO) : profileStStartISO;
  const startYearForSlots = profileStartISO ? new Date(profileStartISO + "T00:00:00").getFullYear() : minYear;

  const visibleStartSlot = profileStartISO ? dateToSlotSnapped(startYearForSlots, profileStartISO, "start") : null;

  const profileEndISO = (() => {
    const raw = (profile?.stEndDate || profile?.stEndISO || "") as string;
    const normalized = normalizeToISODate(raw);
    if (normalized) return normalized;
    // Om saknas: beräkna 5 år (60 månader) från ST-start (eller profilStart om ST-start saknas)
    const base = profileStStartISO || profileStartISO;
    const months = plannedTotalMonths(profile, goalsVersion);
    return base ? addMonthsISO(base, months) : null;
  })();

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const btEndISO = useMemo(() => {
    if (goalsVersion !== "2021") return null;
    if (!profileBtStartISO) return null;
    const manual = normalizeToISODate(profile?.btEndDate);
    const btEnd = manual || addMonthsISO(profileBtStartISO, 24);
    return isValidISODate(btEnd) ? btEnd : null;
  }, [goalsVersion, profileBtStartISO, profile]);

  const isPlacementBTPhase = useMemo(() => {
    if (goalsVersion !== "2021") return (_p: any) => false;
    if (!profileBtStartISO || !btEndISO) return (_p: any) => false;

    const btStartMs = new Date(profileBtStartISO + "T00:00:00").getTime();
    const btEndMs = new Date(btEndISO + "T00:00:00").getTime();

    return (p: any) => {
      if (p?.phase === "BT") return true;
      if (p?.phase === "ST") return false;
      const ref = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
      if (!ref) return false;
      const refMs = new Date(ref + "T00:00:00").getTime();
      if (!Number.isFinite(refMs) || !Number.isFinite(btStartMs) || !Number.isFinite(btEndMs)) return false;
      return refMs >= btStartMs && refMs < btEndMs;
    };
  }, [goalsVersion, profileBtStartISO, btEndISO]);

  const pickPercent = useCallback((p: any): number => {
    const v = Number(p?.attendance ?? p?.percent ?? p?.sysselsättning ?? 100);
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 100;
  }, []);

  const workedCombinedFteDays = useMemo(() => {
    if (!placements || placements.length === 0) return 0;
    const today = todayISO;

    if (goalsVersion !== "2021") {
      const stStart = profileStStartISO;
      if (!stStart) return 0;

      return (placements as any[]).reduce((acc, p) => {
        if (isZeroAttendancePlacementType(p?.type)) return acc;
        const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
        if (!start) return acc;
        const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || today) || today;
        const end = endRaw > today ? today : endRaw;
        const days = fteDaysBetween(start, end, pickPercent(p));
        return acc + days;
      }, 0);
    }

    const btStart = profileBtStartISO;
    if (!btStart) return 0;

    const btStartMs = new Date(btStart + "T00:00:00").getTime();

    return (placements as any[]).reduce((acc, p) => {
      if (isZeroAttendancePlacementType(p?.type)) return acc;
      const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
      if (!start) return acc;
      const startMs = new Date(start + "T00:00:00").getTime();
      if (!Number.isFinite(startMs) || startMs < btStartMs) return acc;
      const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || today) || today;
      const end = endRaw > today ? today : endRaw;
      const days = fteDaysBetween(start, end, pickPercent(p));
      return acc + days;
    }, 0);
  }, [placements, goalsVersion, profileStStartISO, profileBtStartISO, todayISO, pickPercent]);

  const totalCombinedDays = useMemo(() => {
    if (!profileEndISO) return 0;
    if (goalsVersion !== "2021") {
      const stStart = profileStStartISO;
      if (!stStart) return 0;
      return fteDaysBetween(stStart, profileEndISO, 100);
    }
    const btStart = profileBtStartISO;
    if (!btStart) return 0;
    return fteDaysBetween(btStart, profileEndISO, 100);
  }, [goalsVersion, profileBtStartISO, profileStStartISO, profileEndISO]);

  const progressPct = useMemo(() => {
    if (!totalCombinedDays || totalCombinedDays <= 0) return 0;
    const raw = (workedCombinedFteDays / totalCombinedDays) * 100;
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, raw));
  }, [workedCombinedFteDays, totalCombinedDays]);

  const timeDetails = useMemo(() => {
    if (!profileEndISO) {
      return {
        bt: { worked: 0, total: 0 },
        st: { worked: 0, total: 0 },
      };
    }

    if (goalsVersion === "2021" && profileBtStartISO && btEndISO) {
      const totalBtDays = fteDaysBetween(profileBtStartISO, btEndISO, 100);
      const totalStDays = fteDaysBetween(profileBtStartISO, profileEndISO, 100);

      let btDays = 0;
      let stDays = 0;

      const btStartMs = new Date(profileBtStartISO + "T00:00:00").getTime();
      for (const p of placements as any[]) {
        if (isZeroAttendancePlacementType(p?.type)) continue;
        const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
        if (!start) continue;
        const startMs = new Date(start + "T00:00:00").getTime();
        if (!Number.isFinite(startMs) || startMs < btStartMs) continue;

        const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || todayISO) || todayISO;
        const end = endRaw > todayISO ? todayISO : endRaw;
        const days = fteDaysBetween(start, end, pickPercent(p));

        stDays += days;
        if (isPlacementBTPhase(p)) btDays += days;
      }

      return {
        bt: { worked: btDays, total: totalBtDays },
        st: { worked: stDays, total: totalStDays },
      };
    }

    const stStart = profileStStartISO;
    if (!stStart) {
      return {
        bt: { worked: 0, total: 0 },
        st: { worked: 0, total: 0 },
      };
    }

    let stDays = 0;
    for (const p of placements as any[]) {
      if (isZeroAttendancePlacementType(p?.type)) continue;
      const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
      if (!start) continue;
      const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || todayISO) || todayISO;
      const end = endRaw > todayISO ? todayISO : endRaw;
      const days = fteDaysBetween(start, end, pickPercent(p));
      stDays += days;
    }

    const totalStDays = fteDaysBetween(stStart, profileEndISO, 100);
    return {
      bt: { worked: 0, total: 0 },
      st: { worked: stDays, total: totalStDays },
    };
  }, [profileEndISO, goalsVersion, profileBtStartISO, btEndISO, placements, todayISO, pickPercent, isPlacementBTPhase, profileStStartISO]);

  const timeByActivity = useMemo(() => {
    const result: {
      bt: Array<{ id: string; label: string; days: number; attendance: number; hue: number; startDate: string; endDate: string }>;
      st: Array<{ id: string; label: string; days: number; attendance: number; hue: number; startDate: string; endDate: string }>;
    } = { bt: [], st: [] };

    const today = todayISO;

    for (const p of placements as any[]) {
      if (isZeroAttendancePlacementType(p?.type)) continue;
      const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
      if (!start) continue;
      const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || today) || today;
      const end = endRaw > today ? today : endRaw;
      const percent = pickPercent(p);
      const days = fteDaysBetween(start, end, percent);
      if (days <= 0) continue;

      const label = p?.clinic || p?.title || p?.type || "Aktivitet";
      const idStr = String(p?.id ?? "");
      const fallbackHue =
        ((idStr
          .split("")
          .reduce((acc, ch) => (acc + ch.charCodeAt(0)) % 360, 0) * 37) % 360);
      const hue = placementHueById.get(idStr) ?? (p as any)?.hue ?? fallbackHue;

      const item = {
        id: String(p?.id ?? ""),
        label,
        days,
        attendance: percent,
        hue,
        startDate: start,
        endDate: end,
      };

      if (goalsVersion === "2021" && profileBtStartISO) {
        const btStartMs = new Date(profileBtStartISO + "T00:00:00").getTime();
        const startMs = new Date(start + "T00:00:00").getTime();
        if (!Number.isFinite(startMs) || startMs < btStartMs) continue;
        result.st.push(item);
        if (isPlacementBTPhase(p)) result.bt.push(item);
      } else {
        result.st.push(item);
      }
    }

    result.bt.sort((a, b) => a.startDate.localeCompare(b.startDate));
    result.st.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return result;
  }, [placements, todayISO, pickPercent, goalsVersion, profileBtStartISO, isPlacementBTPhase, placementHueById]);

  const milestoneDetails = useMemo(() => {
    const today = todayISO;
    const is2021 = goalsVersion === "2021";

    const normalizeBtCode = (x: unknown) => {
      const s = String(x ?? "").trim();
      const m = s.match(/^BT[\s\-_]*([0-9]+)/i);
      return m ? "BT" + m[1] : null;
    };

    const normalizeStId = (x: unknown): string | null => {
      const s = String(x ?? "").trim();
      if (!s) return null;
      return s.split("-")[0].toUpperCase().replace(/\s|_/g, "");
    };

    const addWithAliases = (set: Set<string>, id: string) => {
      const code = id.toUpperCase().replace(/\s|_/g, "");
      set.add(code);
      const m1 = code.match(/^ST([ABC])(\d+)$/i);
      if (m1) set.add(`${m1[1].toUpperCase()}${m1[2]}`);
      const m2 = code.match(/^([ABC])(\d+)$/i);
      if (m2) set.add(`ST${m2[1].toUpperCase()}${m2[2]}`);
    };

    const stFromPlacements = new Set<string>();
    const stFromCourses = new Set<string>();

    for (const a of achievements as any[]) {
      const cand = [a.milestoneId, a.goalId, a.id, a.code, a.milestone].filter(Boolean);
      for (const c of cand) {
        const id = normalizeStId(c);
        if (!id || normalizeBtCode(id)) continue;
        if (!(/^ST[ABC]\d+$/i.test(id) || /^[ABC]\d+$/i.test(id))) continue;
        if (a.placementId) {
          const pl = (placements as any[]).find((p) => String(p?.id) === String(a.placementId));
          const end = normalizeToISODate(pl?.endDate || pl?.endISO || pl?.end || "");
          if (end && end < today) addWithAliases(stFromPlacements, id);
        }
        if (a.courseId) {
          const cr = (courses as any[]).find((x) => String(x?.id) === String(a.courseId));
          const date = normalizeToISODate(cr?.certificateDate || cr?.endDate || "");
          if (date && date < today) addWithAliases(stFromCourses, id);
        }
      }
    }

    for (const p of placements as any[]) {
      const end = normalizeToISODate(p?.endDate || p?.endISO || p?.end || "");
      if (!end || end >= today) continue;
      const arrs = [p?.milestones, p?.goals, p?.goalIds, p?.milestoneIds];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          const id = normalizeStId(v);
          if (id && !normalizeBtCode(id)) addWithAliases(stFromPlacements, id);
        }
      }
    }

    for (const c of courses as any[]) {
      const date = normalizeToISODate(c?.certificateDate || c?.endDate || "");
      if (!date || date >= today) continue;
      const arrs = [c?.milestones, c?.goals, c?.goalIds, c?.milestoneIds];
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          const id = normalizeStId(v);
          if (id && !normalizeBtCode(id)) addWithAliases(stFromCourses, id);
        }
      }
    }

    let totalStKlin = 0;
    let totalStKurs = 0;
    let fulfilledStKlin = 0;
    let fulfilledStKurs = 0;

    if (goalsCatalog && Array.isArray((goalsCatalog as any).milestones)) {
      const allMilestones = (goalsCatalog as any).milestones as any[];
      const stMilestonesForCount: any[] = allMilestones.filter((m: any) => {
        const code = normalizeStId((m as any).code ?? (m as any).id ?? "");
        if (!code) return false;
        return /^ST[ABC]\d+$/i.test(code) || /^[ABC]\d+$/i.test(code);
      });

      const existingKeys = new Set(
        stMilestonesForCount
          .map((m: any) => normalizeStId((m as any).code ?? (m as any).id ?? ""))
          .filter(Boolean) as string[]
      );

      const commonCandidates = Object.values(COMMON_AB_MILESTONES) as any[];
      for (const cm of commonCandidates) {
        const code = normalizeStId((cm as any).code ?? (cm as any).id ?? "");
        if (!code) continue;
        const ok = is2021 ? /^ST[AB]\d+$/i.test(code) : /^[AB]\d+$/i.test(code);
        if (!ok) continue;
        if (!existingKeys.has(code)) {
          existingKeys.add(code);
          stMilestonesForCount.push(cm);
        }
      }

      const hasAnyAlias = (set: Set<string>, code: string): boolean => {
        const k = code.toUpperCase().replace(/\s|_/g, "");
        if (set.has(k)) return true;
        const m1 = k.match(/^ST([ABC])(\d+)$/i);
        if (m1 && set.has(`${m1[1].toUpperCase()}${m1[2]}`)) return true;
        const m2 = k.match(/^([ABC])(\d+)$/i);
        if (m2 && set.has(`ST${m2[1].toUpperCase()}${m2[2]}`)) return true;
        return false;
      };

      for (const m of stMilestonesForCount) {
        const code = normalizeStId((m as any).code ?? (m as any).id ?? "");
        if (!code) continue;
        const req = milestoneRequires(m);
        const hasKlinReq = !!(req.klin || req.arb);
        const hasKursReq = !!req.kurs;
        const isFulfilledByPlacement = hasAnyAlias(stFromPlacements, code);
        const isFulfilledByCourse = hasAnyAlias(stFromCourses, code);
        if (hasKlinReq) {
          totalStKlin++;
          if (isFulfilledByPlacement) fulfilledStKlin++;
        }
        if (hasKursReq) {
          totalStKurs++;
          if (isFulfilledByCourse) fulfilledStKurs++;
        }
      }
    }

    const hasCalculatedTotals = totalStKlin > 0 || totalStKurs > 0;
    const totalStParts = hasCalculatedTotals ? totalStKlin + totalStKurs : (is2021 ? 46 : 50);
    const fulfilledStParts = hasCalculatedTotals ? fulfilledStKlin + fulfilledStKurs : stFromPlacements.size + stFromCourses.size;
    const totalStMilestones = hasCalculatedTotals ? Math.max(totalStKlin, totalStKurs) : (is2021 ? 23 : 50);
    const stFulfilledMilestones = hasCalculatedTotals ? (fulfilledStKlin + fulfilledStKurs) / 2 : fulfilledStParts;

    return {
      bt: { fulfilled: 0, total: is2021 ? 18 : 0 },
      st: {
        fulfilled: fulfilledStParts,
        total: totalStParts,
        fulfilledMilestones: stFulfilledMilestones,
        totalMilestones: totalStMilestones,
      },
    };
  }, [todayISO, goalsVersion, achievements, placements, courses, goalsCatalog]);

  const milestoneProgressPct = useMemo(() => {
    const total = Number((milestoneDetails as any)?.st?.total ?? 0);
    const fulfilled = Number((milestoneDetails as any)?.st?.fulfilled ?? 0);
    if (!total || total <= 0) return 0;
    const raw = (fulfilled / total) * 100;
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, raw));
  }, [milestoneDetails]);

  const endBoundarySlot = profileEndISO
    ? dateToSlotSnapped(startYearForSlots, profileEndISO, "end")
    : (visibleStartSlot != null ? visibleStartSlot + 120 : null);

  const btStartSlot = profileBtStartISO ? dateToSlotSnapped(startYearForSlots, profileBtStartISO, "start") : null;
  const btEndSlot = (() => {
    if (goalsVersion !== "2021") return null;
    if (!profileBtStartISO) return null;
    const manual = normalizeToISODate(profile?.btEndDate);
    const btEndISO = manual || addMonthsISO(profileBtStartISO, 24);
    return isValidISODate(btEndISO) ? dateToSlotSnapped(startYearForSlots, btEndISO, "end") : null;
  })();
  const stStartSlot = profileStStartISO ? dateToSlotSnapped(startYearForSlots, profileStStartISO, "start") : null;
  const stEndSlot = profileEndISO ? dateToSlotSnapped(startYearForSlots, profileEndISO, "end") : null;

  const timelineStartYear = startYearForSlots;
  const timelineEndYear = (() => {
    if (endBoundarySlot == null || !Number.isFinite(endBoundarySlot)) return maxYear;
    // endBoundarySlot är en "kant"; för att inkludera rätt slutår tar vi slot-1
    const lastSlot = Math.max(0, endBoundarySlot - 1);
    return startYearForSlots + Math.floor(lastSlot / 24);
  })();

  for (let y = timelineStartYear; y <= timelineEndYear; y++) timelineYears.push(y);
 
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{student.name}</h2>
              <p className="text-sm text-slate-600">Målversion {student.goalsVersion}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMainTab("utbildningsmoment")}
                  className={
                    mainTab === "utbildningsmoment"
                      ? "rounded-lg border border-slate-300 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900"
                      : "rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                  }
                >
                  Utbildningsmoment
                </button>
                <button
                  type="button"
                  onClick={() => setMainTab("delmal")}
                  className={
                    mainTab === "delmal"
                      ? "rounded-lg border border-slate-300 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900"
                      : "rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                  }
                >
                  Delmål
                </button>
                <button
                  type="button"
                  onClick={() => setMainTab("planering")}
                  className={
                    mainTab === "planering"
                      ? "rounded-lg border border-slate-300 bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-900"
                      : "rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                  }
                >
                  Planering
                </button>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex max-h-[calc(90vh-80px)] flex-col">
          <div className="flex-1 overflow-y-auto p-6">
          {mainTab === "utbildningsmoment" ? (
            <div className="space-y-6">
              {/* Undermeny för Lista/Tidslinje */}
              <div className="flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 w-fit">
                <button
                  type="button"
                  onClick={() => setUmTab("lista")}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    umTab === "lista" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => setUmTab("tidslinje")}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    umTab === "tidslinje" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Tidslinje
                </button>
              </div>

              {umTab === "lista" ? (
              <>
              <div className="grid gap-4 md:grid-cols-3">
                {/* Vänster: Klinisk tjänstgöring */}
                <div className="md:col-span-2 rounded-xl border bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <div className="font-semibold">Klinisk tjänstgöring, arbeten, ledighet</div>
                  </div>
                  <div className="max-h-[40vh] overflow-auto">
                    <table className="w-full text-sm select-none">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Moment</th>
                          <th className="px-3 py-2 text-center">Start</th>
                          <th className="px-3 py-2 text-center">Slut</th>
                          <th className="px-3 py-2 text-center w-14">Syss.%</th>
                          <th className="px-2 py-2 text-center w-24 whitespace-nowrap">Mån</th>
                        </tr>
                      </thead>
                      <tbody className="cursor-default">
                        {[...placements]
                          .sort((a: any, b: any) => new Date(a.startDate || "").getTime() - new Date(b.startDate || "").getTime())
                          .map((p: any, i: number) => {
                            const months = calculateMonths(p.startDate, p.endDate, p.attendance);
                            const isSelected = selectedActivity?.id === p.id;
                            const hue = placementHueById.get(String(p?.id ?? "")) ?? (p as any)?.hue ?? (210 + i * 30) % 360;
                            return (
                              <tr
                                key={p.id || i}
                                className={`border-t ${isSelected ? "bg-slate-200 hover:bg-slate-300 text-slate-900 ring-1 ring-slate-300" : "hover:bg-slate-50"}`}
                                onClick={() => setSelectedActivity(p)}
                              >
                                <td className="px-3 py-1.5">
                                  <span className="inline-flex items-center">
                                    <span
                                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[12px] leading-5"
                                      style={{
                                        backgroundColor: `hsl(${hue} 28% 88%)`,
                                        border: `1px solid hsl(${hue} 30% 72%)`,
                                      }}
                                    >
                                      <span className="text-slate-900">
                                        {p.clinic || p.label || p.type || "Placering"}
                                      </span>
                                    </span>
                                    {p.phase === "BT" && (
                                      <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-black bg-white text-[10px] leading-4 text-slate-900">
                                        BT
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-center">{formatDate(p.startDate)}</td>
                                <td className="px-3 py-1.5 text-center">{formatDate(p.endDate)}</td>
                                <td className="px-3 py-1.5 text-center">{p.attendance ?? 100}</td>
                                <td className="px-2 py-1.5 text-center">{months.toFixed(1)}</td>
                              </tr>
                            );
                          })}
                        {placements.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-3 text-slate-500">Inga aktiviteter.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Höger: Kurser */}
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <div className="font-semibold">Kurser</div>
                  </div>
                  <div className="max-h-[40vh] overflow-auto">
                    <table className="w-full text-sm select-none">
                      <thead className="sticky top-0 bg-slate-50 text-left">
                        <tr>
                          <th className="px-3 py-2">Kursnamn</th>
                          <th className="px-3 py-2 text-left">Intygsdatum</th>
                        </tr>
                      </thead>
                      <tbody className="cursor-default">
                        {[...courses]
                          .sort((a: any, b: any) => (a.endDate || a.certificateDate || "").localeCompare(b.endDate || b.certificateDate || ""))
                          .map((c: any, i: number) => {
                            const isSelected = selectedActivity?.id === c.id;
                            return (
                              <tr
                                key={c.id || i}
                                className={`border-t ${isSelected ? "bg-slate-200 hover:bg-slate-300 text-slate-900 shadow-[inset_0_0_0_1px_rgba(100,116,139,1)]" : "hover:bg-slate-50"}`}
                                onClick={() => setSelectedActivity(c)}
                              >
                                <td className="px-3 py-1.5">
                                  <span className="inline-flex items-center">
                                    <span>{c.title || c.name || "—"}</span>
                                    {c.phase === "BT" && (
                                      <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-black bg-white text-[10px] leading-4 text-slate-900">
                                        BT
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5">{c.endDate || c.certificateDate || "—"}</td>
                              </tr>
                            );
                          })}
                        {courses.length === 0 && (
                          <tr><td colSpan={2} className="px-3 py-3 text-slate-500">Inga kurser.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Handledarträffar & Progressionsbedömningar */}
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                {/* Handledarträffar */}
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <div className="font-semibold">Handledarträffar</div>
                  </div>
                  <div className="max-h-[30vh] overflow-auto">
                    <table className="w-full text-sm select-none">
                      <thead className="sticky top-0 bg-slate-50 text-left">
                        <tr>
                          <th className="px-3 py-2">Datum</th>
                          <th className="px-3 py-2">Fokus</th>
                          <th className="px-3 py-2">Diskuterat</th>
                        </tr>
                      </thead>
                      <tbody className="cursor-default">
                        {(iupMeetings.length > 0 ? iupMeetings : supervisorMeetings)
                          .slice()
                          .sort((a: any, b: any) => (a.dateISO || a.date || "").localeCompare(b.dateISO || b.date || ""))
                          .map((m: any, i: number) => (
                            <tr
                              key={m.id || i}
                              className={`border-t cursor-pointer ${
                                selectedActivity?.__type === "supervision" && (selectedActivity?.id === (m.id || i))
                                  ? "bg-slate-200 hover:bg-slate-300 text-slate-900 ring-1 ring-slate-300"
                                  : "hover:bg-slate-50"
                              }`}
                              onClick={() => {
                                setSelectedActivity({
                                  ...m,
                                  id: String(m.id || i),
                                  __type: "supervision",
                                  dateISO: normalizeToISODate(m.dateISO || m.date || m.iso) || (m.dateISO || m.date || m.iso),
                                  title: m.focus || m.title || "Handledarsamtal",
                                  note: m.summary || m.note || m.notes || "",
                                });
                              }}
                            >
                              <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(m.dateISO || m.date)}</td>
                              <td className="px-3 py-1.5">{m.focus || "—"}</td>
                              <td className="px-3 py-1.5 truncate max-w-[200px]">{m.discussed || m.note || m.notes || "—"}</td>
                            </tr>
                          ))}
                        {iupMeetings.length === 0 && supervisorMeetings.length === 0 && (
                          <tr><td colSpan={3} className="px-3 py-3 text-slate-500">Inga handledarträffar.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Progressionsbedömningar */}
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <div className="font-semibold">Progressionsbedömningar</div>
                  </div>
                  <div className="max-h-[30vh] overflow-auto">
                    <table className="w-full text-sm select-none">
                      <thead className="sticky top-0 bg-slate-50 text-left">
                        <tr>
                          <th className="px-3 py-2">Datum</th>
                          <th className="px-3 py-2">Instrument</th>
                          <th className="px-3 py-2">Nivå</th>
                        </tr>
                      </thead>
                      <tbody className="cursor-default">
                        {(iupAssessments.length > 0 ? iupAssessments : progressAssessments)
                          .slice()
                          .sort((a: any, b: any) => (a.dateISO || a.date || "").localeCompare(b.dateISO || b.date || ""))
                          .map((a: any, i: number) => (
                            <tr
                              key={a.id || i}
                              className={`border-t cursor-pointer ${
                                selectedActivity?.__type === "assessment" && (selectedActivity?.id === (a.id || i))
                                  ? "bg-slate-200 hover:bg-slate-300 text-slate-900 ring-1 ring-slate-300"
                                  : "hover:bg-slate-50"
                              }`}
                              onClick={() => {
                                const instrument = a.instrument || "";
                                const level = a.level || a.assessment || a.bedömning || "";
                                const composedTitle = [instrument, level].filter(Boolean).join(" • ") || "Progressionsbedömning";

                                setSelectedActivity({
                                  ...a,
                                  id: String(a.id || i),
                                  __type: "assessment",
                                  dateISO: normalizeToISODate(a.dateISO || a.date || a.iso) || (a.dateISO || a.date || a.iso),
                                  title: composedTitle,
                                  note: a.summary || a.note || a.notes || "",
                                });
                              }}
                            >
                              <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(a.dateISO || a.date)}</td>
                              <td className="px-3 py-1.5">{a.instrument || "—"}</td>
                              <td className="px-3 py-1.5">{a.level || a.assessment || a.bedömning || "—"}</td>
                            </tr>
                          ))}
                        {iupAssessments.length === 0 && progressAssessments.length === 0 && (
                          <tr><td colSpan={3} className="px-3 py-3 text-slate-500">Inga progressionsbedömningar.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Genomförd tid och delmålsuppfyllnad */}
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                {/* Genomförd tid */}
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <button
                      type="button"
                      className="font-semibold text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0 text-left"
                      onClick={() => setProgressDetailOpen("time")}
                    >
                      Genomförd tid
                    </button>
                    <button
                      type="button"
                      className="font-semibold text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0"
                      onClick={() => setProgressDetailOpen("time")}
                    >
                      {progressPct.toFixed(0)} %
                    </button>
                  </div>
                  <div className="p-3">
                    <div 
                      className="h-4 w-full rounded-full bg-slate-200 cursor-pointer"
                      onClick={() => setProgressDetailOpen("time")}
                    >
                      <div
                        className="h-4 rounded-full transition-[width] duration-300 bg-emerald-500/80"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Delmålsuppfyllnad */}
                <div className="rounded-xl border bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <button
                      type="button"
                      className="font-semibold text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0 text-left"
                      onClick={() => setProgressDetailOpen("milestones")}
                    >
                      Delmålsuppfyllnad
                    </button>
                    <button
                      type="button"
                      className="font-semibold text-slate-900 cursor-pointer hover:text-slate-500 bg-transparent border-0 p-0"
                      onClick={() => setProgressDetailOpen("milestones")}
                    >
                      {milestoneProgressPct.toFixed(0)} %
                    </button>
                  </div>
                  <div className="p-3">
                    <div 
                      className="h-4 w-full rounded-full bg-slate-200 cursor-pointer"
                      onClick={() => setProgressDetailOpen("milestones")}
                    >
                      <div
                        className="h-4 rounded-full transition-[width] duration-300 bg-emerald-500/80"
                        style={{ width: `${milestoneProgressPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              </>
              ) : (
              /* Tidslinjevy - exakt planera-st grid (2 lanes, 24 halvmånader) */
              <div className="relative rounded-xl">
                <div className="pointer-events-none absolute inset-0 z-0 rounded-xl border border-slate-200" />
                <div className="relative z-10 space-y-0">
                {/* Sticky månadsrad */}
                <div className="grid grid-cols-[72px_1fr] items-end sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-slate-200">
                  <div className="pr-1" />
                  <div className="relative">
                    <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] text-xs text-slate-700">
                      {MONTH_NAMES.map((m, idx) => (
                        <div
                          key={m}
                          className={`col-span-2 text-center font-medium pb-1 ${idx === 0 ? "border-l border-slate-300" : ""} ${idx === MONTH_NAMES.length - 1 ? "border-r border-slate-300" : ""}`}
                        >
                          {m}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              {years.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Inga aktiviteter med datum att visa.</p>
              ) : (
                timelineYears.map((year, yearIdx) => {
                  const rowStart = new Date(year, 0, 1);
                  const rowEnd = new Date(year, 11, 31, 23, 59, 59);

                  // Placeringar som överlappar året
                  const yearPlacements = placements
                    .map((p: any, i: number) => ({
                      ...p,
                      __hue: p.hue ?? (210 + i * 30) % 360,
                      __type: "placement",
                    }))
                    .filter((p: any) => {
                      const s = new Date(p.startDate || "");
                      const e = new Date(p.endDate || "");
                      if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
                      return !(e < rowStart || s > rowEnd);
                    });

                  // Kurser som hör till året (som i planera-st: normalt år = slutdatum/intygsdatum)
                  const yearCourses = courses
                    .map((c: any, i: number) => ({
                      ...c,
                      __hue: c.hue ?? (120 + i * 25) % 360,
                      __type: "course",
                    }))
                    .filter((c: any) => {
                      const endISO = c.endDate || c.certificateDate || "";
                      const d = new Date(endISO);
                      if (isNaN(d.getTime())) return false;
                      return d.getFullYear() === year;
                    });

                  const isFirst = yearIdx === 0;
                  const isLast = yearIdx === years.length - 1;

                  return (
                    <div key={year} className="grid grid-cols-[72px_1fr] items-stretch">
                      {/* År */}
                      <div className="pr-1 py-1 text-right font-semibold select-none flex items-center justify-end">
                        <span>{year}</span>
                      </div>

                      {/* Års-kort */}
                      <div
                        className="st-row relative isolate bg-white"
                        style={{
                          height: "2.6rem",
                          backgroundImage:
                            "linear-gradient(to right, rgba(148,163,184,.35) 1px, transparent 1px)",
                          backgroundSize: "calc(100% / 24) 100%",
                          backgroundRepeat: "repeat-x",
                          backgroundPosition: "0 0",
                          borderTopLeftRadius: isFirst ? "2px" : "0px",
                          borderTopRightRadius: isFirst ? "2px" : "0px",
                          borderBottomLeftRadius: isLast ? "2px" : "0px",
                          borderBottomRightRadius: isLast ? "2px" : "0px",
                          overflow: "visible",
                        }}
                      >
                        {/* Månadslinjer */}
                        <div className="pointer-events-none absolute inset-0" style={{ zIndex: 10 }}>
                          {Array.from({ length: 13 }, (_, monthIdx) => {
                            const leftPercent = (monthIdx / 12) * 100;
                            return (
                              <div
                                key={`month-line-${monthIdx}`}
                                style={{
                                  position: "absolute",
                                  left: `${leftPercent}%`,
                                  top: 0,
                                  bottom: "3px",
                                  width: "2px",
                                  backgroundColor: "rgba(100,116,139,.85)",
                                }}
                              />
                            );
                          })}
                        </div>

                        <div
                          className="grid grid-cols-[repeat(24,minmax(0,1fr))]"
                          style={{ gridTemplateRows: "1.75rem 0.75rem" }}
                        >
                          {/* Rad 1: celler */}
                          {Array.from({ length: 24 }, (_, i) => {
                            const globalSlot = (year - startYearForSlots) * 24 + i;
                            const outside =
                              (visibleStartSlot != null && globalSlot < visibleStartSlot) ||
                              (endBoundarySlot != null && globalSlot >= endBoundarySlot);
                            const monthIndex = Math.floor(i / 2);
                            const insideCls = monthIndex % 2 ? "bg-slate-50" : INSIDE_BG_CELL;
                            const isFirstCol = i === 0;
                            const isLastCol = i === 23;
                            const isFirstHalfOfMonth = i % 2 === 0;
                            return (
                              <div
                                key={`cell1-${i}`}
                                className={[
                                  "relative z-0 h-7 border-t border-slate-300",
                                  isFirstCol ? "border-l border-slate-300" : "",
                                  isLastCol ? "border-r border-slate-300" : "",
                                  !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
                                  outside ? OUTSIDE_BG_CELL : insideCls,
                                ].join(" ")}
                                style={{ gridRowStart: 1 }}
                              />
                            );
                          })}

                          {/* Rad 2: kurs-lane celler */}
                          {Array.from({ length: 24 }, (_, i) => {
                            const globalSlot = (year - startYearForSlots) * 24 + i;
                            const outside =
                              (visibleStartSlot != null && globalSlot < visibleStartSlot) ||
                              (endBoundarySlot != null && globalSlot >= endBoundarySlot);
                            const monthIndex = Math.floor(i / 2);
                            const isFirstCol = i === 0;
                            const isLastCol = i === 23;
                            const isFirstHalfOfMonth = i % 2 === 0;
                            return (
                              <div
                                key={`lane-${i}`}
                                className={[
                                  "h-3 w-full transition",
                                  outside ? OUTSIDE_BG_LANE : (monthIndex % 2 ? "bg-slate-200" : INSIDE_BG_LANE),
                                  "border-y border-slate-300",
                                  isFirstCol ? "border-l border-slate-300" : "",
                                  isLastCol ? "border-r border-slate-300" : "",
                                  !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
                                ].join(" ")}
                                style={{ gridRowStart: 2 }}
                              />
                            );
                          })}
                        </div>

                        {/* Overlay: aktiviteter + kurser */}
                        <div
                          className="pointer-events-none absolute inset-0 z-[60] grid grid-cols-[repeat(24,minmax(0,1fr))] rounded-[2px]"
                          style={{ gridTemplateRows: "1.9rem 0.75rem", overflow: "visible" }}
                        >
                          {/* Placeringar */}
                          <div className="contents z-40">
                            {yearPlacements.map((p: any, idx: number) => {
                              const startISO = String(p.startDate || "");
                              const endISO = String(p.endDate || "");
                              if (!isValidISODate(startISO) || !isValidISODate(endISO)) return null;
                              const startSlot = dateToSlotSnapped(startYearForSlots, startISO, "start");
                              const endSlot = dateToSlotSnapped(startYearForSlots, endISO, "end");
                              if (!Number.isFinite(startSlot) || !Number.isFinite(endSlot)) return null;

                              const rowStartSlot = (year - startYearForSlots) * 24;
                              const rowEndSlot = rowStartSlot + 24;
                              const s0 = Math.max(startSlot, rowStartSlot);
                              const s1 = Math.min(endSlot, rowEndSlot);
                              if (s1 <= s0) return null;
                              const startCol = s0 - rowStartSlot;
                              const span = s1 - s0;

                              const label = p.label || p.clinic || p.type || "Placering";

                              return (
                                <div
                                  key={(p.id || idx) + "@" + year}
                                  className={[
                                    "relative pointer-events-auto h-7 select-none rounded-lg px-2 text-[11px] shadow border transition overflow-hidden",
                                    "cursor-pointer hover:shadow-lg hover:-translate-y-[1px]",
                                    "z-[65] border-slate-200",
                                  ].join(" ")}
                                  style={{
                                    gridRowStart: 1,
                                    gridColumnStart: startCol + 1,
                                    gridColumnEnd: startCol + 1 + span,
                                    transform: "translateX(1.5px)",
                                    marginRight: "-1px",
                                    backgroundColor: `hsl(${p.__hue} 28% 88%)`,
                                    border: `1.5px solid hsl(${p.__hue} 35% 50%)`,
                                  }}
                                  title={label}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedActivity(p);
                                  }}
                                >
                                  <span className="block w-full truncate text-slate-900">{label}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Kurser i lane */}
                          <div
                            ref={(el) => {
                              if (el) {
                                const w = el.clientWidth || el.offsetWidth || 0;
                                if (laneWidthByYear[year] !== w) {
                                  setLaneWidthByYear((prev) => ({ ...prev, [year]: w }));
                                }
                              }
                            }}
                            className="relative pointer-events-none z-[120]"
                            style={{ gridRowStart: 2, gridColumn: "1 / -1", height: "0.75rem", overflow: "visible" }}
                          >
                            {/* Handledarsamtal (trianglar) */}
                            {supervisionSessions
                              .filter((s: any) => {
                                const d = new Date(s.dateISO + "T00:00:00");
                                return !isNaN(d.getTime()) && d.getFullYear() === year;
                              })
                              .map((s: any) => {
                                const d = new Date(s.dateISO + "T00:00:00");
                                const total = Math.max(1, daysInYear(year) - 1);
                                const pct = clamp((dayOfYear(d) / total) * 100, 0, 100);
                                const isHovered = hoveredSupervisionId === s.id;
                                return (
                                  <button
                                    key={s.id + "@" + year}
                                    type="button"
                                    className="pointer-events-auto absolute"
                                    style={{
                                      left: `${pct}%`,
                                      bottom: "2.4rem",
                                      transform: isHovered ? "translate(-50%, -1px)" : "translate(-50%, 0)",
                                    }}
                                    onMouseEnter={() => setHoveredSupervisionId(s.id)}
                                    onMouseLeave={() =>
                                      setHoveredSupervisionId((prev) => (prev === s.id ? null : prev))
                                    }
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setSelectedActivity({
                                        ...s,
                                        __type: "supervision",
                                        dateISO: normalizeToISODate((s as any).dateISO || (s as any).date || (s as any).iso) || ((s as any).dateISO || (s as any).date || (s as any).iso),
                                        title: (s as any).focus || (s as any).title || "Handledarsamtal",
                                        note: (s as any).summary || (s as any).note || (s as any).notes || "",
                                      });
                                    }}
                                    title={s.title && String(s.title).trim() ? `${s.title} (${s.dateISO})` : s.dateISO}
                                  >
                                    <span
                                      aria-hidden="true"
                                      style={{
                                        position: "relative",
                                        display: "block",
                                        width: 0,
                                        height: 0,
                                      }}
                                    >
                                      <span
                                        style={{
                                          position: "absolute",
                                          left: "50%",
                                          transform: "translateX(-50%)",
                                          width: 0,
                                          height: 0,
                                          borderLeft: "7px solid transparent",
                                          borderRight: "7px solid transparent",
                                          borderBottom: "11px solid #064e3b",
                                        }}
                                      />
                                      <span
                                        style={{
                                          position: "absolute",
                                          left: "50%",
                                          transform: "translateX(-50%) translateY(1px)",
                                          width: 0,
                                          height: 0,
                                          borderLeft: "6px solid transparent",
                                          borderRight: "6px solid transparent",
                                          borderBottom: isHovered
                                            ? "9px solid #34d399"
                                            : "9px solid #059669",
                                        }}
                                      />
                                    </span>
                                  </button>
                                );
                              })}

                            {/* Progressionsbedömningar (stjärnor) */}
                            {assessmentSessions
                              .filter((a: any) => {
                                const d = new Date(a.dateISO + "T00:00:00");
                                return !isNaN(d.getTime()) && d.getFullYear() === year;
                              })
                              .map((a: any) => {
                                const d = new Date(a.dateISO + "T00:00:00");
                                const total = Math.max(1, daysInYear(year) - 1);
                                const pct = clamp((dayOfYear(d) / total) * 100, 0, 100);
                                const isHovered = hoveredAssessmentId === a.id;
                                const baseColor = "#f59e0b";
                                const hoverColor = "#facc15";
                                const strokeColor = "#d97706";
                                return (
                                  <button
                                    key={a.id + "@assess@" + year}
                                    type="button"
                                    className="pointer-events-auto absolute"
                                    style={{
                                      left: `${pct}%`,
                                      bottom: "1.6rem",
                                      transform: isHovered
                                        ? "translate(-50%, -1px) scale(1.05)"
                                        : "translate(-50%, 0) scale(1)",
                                    }}
                                    onMouseEnter={() => setHoveredAssessmentId(a.id)}
                                    onMouseLeave={() =>
                                      setHoveredAssessmentId((prev) => (prev === a.id ? null : prev))
                                    }
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const instrument = (a as any).instrument || "";
                                      const level = (a as any).level || (a as any).assessment || (a as any).bedömning || "";
                                      const composedTitle = [instrument, level].filter(Boolean).join(" • ") || "Progressionsbedömning";
                                      setSelectedActivity({
                                        ...a,
                                        __type: "assessment",
                                        dateISO: normalizeToISODate((a as any).dateISO || (a as any).date || (a as any).iso) || ((a as any).dateISO || (a as any).date || (a as any).iso),
                                        title: composedTitle,
                                        note: (a as any).summary || (a as any).note || (a as any).notes || "",
                                      });
                                    }}
                                    title={a.title && String(a.title).trim() ? `${a.title} (${a.dateISO})` : a.dateISO}
                                  >
                                    <svg
                                      aria-hidden="true"
                                      width={16}
                                      height={16}
                                      viewBox="0 0 24 24"
                                      style={{ display: "block" }}
                                    >
                                      <path
                                        d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
                                        fill={isHovered ? hoverColor : baseColor}
                                        stroke={strokeColor}
                                        strokeWidth={1.3}
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                );
                              })}

                            {yearCourses.map((c: any, idx: number) => {
                              const endISO = c.endDate || c.certificateDate || "";
                              if (!isValidISODate(endISO)) return null;
                              const courseSlot = dateToSlotSnapped(startYearForSlots, endISO, "end");
                              if (!Number.isFinite(courseSlot)) return null;
                              const rowStartSlot = (year - startYearForSlots) * 24;
                              const col = courseSlot - rowStartSlot;
                              if (col < 0 || col >= 24) return null;
                              const title = c.title || c.name || "Kurs";

                              const laneW = laneWidthByYear[year] || 0;
                              const trueCenterPx = ((col + 0.5) / 24) * laneW;
                              const measured = chipWidthById[String(c.id)] || 0;
                              const half = Math.max(1, measured / 2);
                              const clampedCenterPx = laneW > 0
                                ? clamp(trueCenterPx, half, Math.max(half, laneW - half))
                                : trueCenterPx;
                              const sel = !!(selectedActivity && (selectedActivity.id || selectedActivity._id) === (c.id || c._id));

                              return (
                                <div
                                  key={(c.id || idx) + "@" + year}
                                  ref={(el) => {
                                    if (el) {
                                      const w = el.offsetWidth || 0;
                                      const idKey = String(c.id);
                                      if (w) {
                                        setChipWidthById((prev) => (prev[idKey] === w ? prev : { ...prev, [idKey]: w }));
                                      }
                                    }
                                  }}
                                  className={`absolute z-[70] top-1/2 -translate-y-1/2 pointer-events-auto select-none rounded-full px-2 h-5 flex items-center text-[10.5px] border cursor-pointer shadow-sm transition-transform transition-colors ${
                                    sel
                                      ? "text-white bg-sky-600 border-sky-800 hover:bg-sky-500 hover:border-sky-700 hover:shadow-md"
                                      : "text-white bg-sky-700 border-sky-900 hover:bg-sky-600 hover:border-sky-800 hover:shadow-md"
                                  }`}
                                  style={{
                                    left: `${clampedCenterPx}px`,
                                    transform: "translate(-50%, -50%)",
                                  }}
                                  title={title}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedActivity(c);
                                  }}
                                >
                                  <span className="max-w-[24ch] truncate">{title}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Plan-markörer: samma utseende som i Pussla din ST */}
                        <div className="pointer-events-none absolute inset-0 z-[250]">
                          {(() => {
                            const rowStartSlot = (year - startYearForSlots) * 24;
                            const rowEndSlot = rowStartSlot + 24;
                            const greenSlot = goalsVersion === "2021" ? (btStartSlot ?? stStartSlot) : stStartSlot;

                            const renderLine = (slot: number | null, color: string, key: string, transform: string, title: string) => {
                              if (slot == null || !Number.isFinite(slot)) return null;
                              if (slot < rowStartSlot || slot > rowEndSlot) return null;
                              const pct = ((slot - rowStartSlot) / 24) * 100;
                              if (pct < 0 || pct > 100) return null;
                              return (
                                <div
                                  key={key}
                                  className="absolute"
                                  style={{
                                    top: 0,
                                    height: "1.75rem",
                                    left: `${pct}%`,
                                    width: 0,
                                    borderLeft: `3.5px solid ${color}`,
                                    transform,
                                  }}
                                  title={title}
                                />
                              );
                            };

                            const todayLine = (() => {
                              const today = new Date();
                              const yearToday = today.getFullYear();
                              if (yearToday !== year) return null;
                              const startOfYear = new Date(yearToday, 0, 1);
                              const startOfNextYear = new Date(yearToday + 1, 0, 1);
                              const msInDay = 24 * 60 * 60 * 1000;
                              const dayIndex = Math.floor((today.getTime() - startOfYear.getTime()) / msInDay);
                              const daysInYear = Math.max(1, Math.floor((startOfNextYear.getTime() - startOfYear.getTime()) / msInDay));
                              const frac = Math.min(Math.max(dayIndex / daysInYear, 0), 1);
                              const pct = frac * 100;
                              if (pct < 0 || pct > 100) return null;
                              const todayISO = new Date().toISOString().slice(0, 10);
                              return (
                                <div
                                  key={`today-${year}`}
                                  className="absolute"
                                  style={{
                                    top: 0,
                                    height: "1.75rem",
                                    left: `${pct}%`,
                                    width: 0,
                                    borderLeft: "3.5px solid #2563eb",
                                    transform: "translateX(0)",
                                  }}
                                  title={`Idag (${todayISO})`}
                                />
                              );
                            })();

                            return (
                              <>
                                {renderLine(greenSlot, "#0f766e", `bnd-green-${year}`, "translateX(-0.25px)", goalsVersion === "2021" && btStartSlot != null ? "BT start" : "ST start")}
                                {goalsVersion === "2021"
                                  ? renderLine(btEndSlot, "#ca8a04", `bnd-yellow-${year}`, "translateX(-0.25px)", "Sista datum för färdig BT")
                                  : null}
                                {renderLine(stEndSlot, "#b91c1c", `bnd-red-${year}`, "translateX(-0.75px)", "ST slut")}
                                {todayLine}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Legend – identisk med Pussla din ST (inkl. startposition på x-axeln) */}
              <div className="grid grid-cols-[72px_1fr] items-start mb-4">
                <div className="pr-1" />
                <div className="mt-2 ml-[10px] flex flex-wrap items-center gap-4 text-xs text-slate-700">
                  {goalsVersion === "2021" ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#0f766e" }} />
                        <span>= BT start</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#ca8a04" }} />
                        <span>= BT slut</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#b91c1c" }} />
                        <span>= ST slut</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#2563eb" }} />
                        <span>= Idag</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#0f766e" }} />
                        <span>= ST start</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#b91c1c" }} />
                        <span>= ST slut</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#2563eb" }} />
                        <span>= Idag</span>
                      </div>
                    </>
                  )}

                  <div className="w-20" />

                  <div className="flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      style={{
                        display: "inline-block",
                        width: 0,
                        height: 0,
                        borderLeft: "5px solid transparent",
                        borderRight: "5px solid transparent",
                        borderBottom: "8px solid #059669",
                      }}
                    />
                    <span>= Möte med huvudhandledare</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" style={{ display: "block" }}>
                      <path
                        d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
                        fill="#f59e0b"
                        stroke="#d97706"
                        strokeWidth={1.3}
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>= Progressionsbedömning</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      ) : mainTab === "delmal" ? (
        <DelmalReadonly student={student} />
      ) : (
        /* Planering - visa IUP-planeringsinnehåll (read-only) */
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Planering (från IUP)</h3>

          {/* Övergripande mål */}
          <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Övergripande mål med utbildningen</label>
                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                  {iupPlanning.overallGoals || "—"}
                </div>
              </div>

              {/* Fördefinierade planeringsrubriker */}
              <div className="grid gap-4 md:grid-cols-2">
                {(
                  [
                    ["clinicalService", "Kliniska tjänstgöringar"],
                    ["courses", "Kurser"],
                    ["supervisionMeetings", "Handledarsamtal"],
                    ["theoreticalStudies", "Teoretiska studier"],
                    ["researchWork", "Vetenskapligt arbete"],
                    ["journalClub", "Journal club"],
                    ["congresses", "Kongresser"],
                    ["qualityWork", "Kvalitetsarbete"],
                    ["patientSafety", "Patientsäkerhetsarbete"],
                    ["leadership", "Ledarskap"],
                    ["supervisingStudents", "Handledning av studenter/underläkare"],
                    ["teaching", "Undervisning"],
                    ["formativeAssessments", "Formativa bedömningar"],
                  ] as const
                )
                  .map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">{label}</label>
                      <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap min-h-[2.5rem]">
                        {iupPlanning[key] || "—"}
                      </div>
                    </div>
                  ))}

                {/* Dynamiskt tillagda rubriker */}
                {iupPlanningExtra.map((sec: any) => (
                  <div key={sec.id}>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">{sec.title}</label>
                    <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap min-h-[2.5rem]">
                      {sec.content || "—"}
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(iupPlanning).length === 0 && iupPlanningExtra.length === 0 && (
                <div className="text-sm text-slate-500">Ingen planering har registrerats i IUP ännu.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Aktivitets-detalj-popup */}
      {selectedActivity && (
        <ActivityDetailPopup
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          goalsVersion={goalsVersion}
        />
      )}

      {progressDetailOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
          onClick={() => {
            setProgressDetailOpen(null);
            setHoveredTimeAct(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <header className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="m-0 text-lg font-extrabold text-slate-900">
                  {progressDetailOpen === "time" ? "Genomförd tid" : "Delmålsuppfyllelse"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setProgressDetailOpen(null);
                    setHoveredTimeAct(null);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
                >
                  Stäng
                </button>
              </header>

              <div className="p-6">
                {progressDetailOpen === "time" ? (
                  <div className="space-y-4">
                    {hoveredTimeAct && (
                      <div
                        className="fixed px-2 py-1 rounded shadow-lg border text-xs whitespace-nowrap pointer-events-none"
                        style={(() => {
                          const tooltipW = 260;
                          const tooltipH = 78;
                          const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
                          const x = Math.max(8, Math.min(hoveredTimeAct.anchorX - tooltipW / 2, vw - tooltipW - 8));
                          const y = hoveredTimeAct.anchorTop - tooltipH - 10;
                          return {
                            left: x,
                            top: y,
                            width: tooltipW,
                            backgroundColor: `hsl(${hoveredTimeAct.hue} 30% 95%)`,
                            borderColor: `hsl(${hoveredTimeAct.hue} 40% 70%)`,
                            zIndex: 10001,
                          } as any;
                        })()}
                      >
                        <div className="font-semibold text-slate-800">{hoveredTimeAct.label}</div>
                        <div className="text-slate-600">{hoveredTimeAct.startDate} – {hoveredTimeAct.endDate}</div>
                        <div className="text-slate-600">Sysselsättning: {Math.round(hoveredTimeAct.attendance)}%</div>
                        <div className="text-slate-600">Dagar motsv heltid: {Math.round(hoveredTimeAct.days)}</div>
                        <div className="text-slate-600">
                          Del av {hoveredTimeAct.phase === "bt" ? "BT" : "ST"}: {(
                            hoveredTimeAct.phase === "bt"
                              ? (timeDetails.bt.total > 0 ? ((hoveredTimeAct.days / timeDetails.bt.total) * 100).toFixed(1).replace(".", ",") : "0")
                              : (timeDetails.st.total > 0 ? ((hoveredTimeAct.days / timeDetails.st.total) * 100).toFixed(1).replace(".", ",") : "0")
                          )}%
                        </div>
                      </div>
                    )}

                    {goalsVersion === "2021" ? (
                      <>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-700">BT (Bastjänstgöring)</span>
                            <span className="text-sm text-slate-600">
                              {timeDetails.bt.total > 0 ? `${((timeDetails.bt.worked / timeDetails.bt.total) * 100).toFixed(0)}%` : "0%"}
                            </span>
                          </div>
                          <div className="h-6 w-full rounded-full bg-slate-200 overflow-hidden flex">
                            {timeByActivity.bt.map((act) => {
                              const barWidth = timeDetails.bt.total > 0 ? (act.days / timeDetails.bt.total) * 100 : 0;
                              return (
                                <div
                                  key={act.id}
                                  className="h-6 transition-[width] duration-300 cursor-pointer"
                                  style={{
                                    width: `${Math.min(100, barWidth)}%`,
                                    backgroundColor: `hsl(${act.hue} 45% 65%)`,
                                  }}
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const anchorX = rect.left + rect.width / 2;
                                    const anchorTop = rect.top;
                                    setHoveredTimeAct({ ...act, phase: "bt", anchorX, anchorTop });
                                  }}
                                  onMouseLeave={() => setHoveredTimeAct(null)}
                                />
                              );
                            })}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">Genomförda dagar: {Math.round(timeDetails.bt.worked)} dagar</div>
                          <div className="text-xs text-slate-600">Totalt antal dagar från startdatum till slutdatum: {Math.round(timeDetails.bt.total)} dagar</div>
                        </div>

                        <div className="relative">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-700">ST (Specialiseringstjänstgöring)</span>
                            <span className="text-sm text-slate-600">
                              {timeDetails.st.total > 0 ? `${((timeDetails.st.worked / timeDetails.st.total) * 100).toFixed(0)}%` : "0%"}
                            </span>
                          </div>
                          <div className="h-6 w-full rounded-full bg-slate-200 overflow-hidden flex">
                            {timeByActivity.st.map((act) => {
                              const barWidth = timeDetails.st.total > 0 ? (act.days / timeDetails.st.total) * 100 : 0;
                              return (
                                <div
                                  key={act.id}
                                  className="h-6 transition-[width] duration-300 cursor-pointer"
                                  style={{
                                    width: `${Math.min(100, barWidth)}%`,
                                    backgroundColor: `hsl(${act.hue} 45% 65%)`,
                                  }}
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const anchorX = rect.left + rect.width / 2;
                                    const anchorTop = rect.top;
                                    setHoveredTimeAct({ ...act, phase: "st", anchorX, anchorTop });
                                  }}
                                  onMouseLeave={() => setHoveredTimeAct(null)}
                                />
                              );
                            })}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">Genomförda dagar: {Math.round(timeDetails.st.worked)} dagar</div>
                          <div className="text-xs text-slate-600">Totalt antal dagar från startdatum till slutdatum: {Math.round(timeDetails.st.total)} dagar</div>
                        </div>
                      </>
                    ) : (
                      <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-700">ST (Specialiseringstjänstgöring)</span>
                          <span className="text-sm text-slate-600">
                            {timeDetails.st.total > 0 ? `${((timeDetails.st.worked / timeDetails.st.total) * 100).toFixed(0)}%` : "0%"}
                          </span>
                        </div>
                        <div className="h-6 w-full rounded-full bg-slate-200 overflow-hidden flex">
                          {timeByActivity.st.map((act) => {
                            const barWidth = timeDetails.st.total > 0 ? (act.days / timeDetails.st.total) * 100 : 0;
                            return (
                              <div
                                key={act.id}
                                className="h-6 transition-[width] duration-300 cursor-pointer"
                                style={{
                                  width: `${Math.min(100, barWidth)}%`,
                                  backgroundColor: `hsl(${act.hue} 45% 65%)`,
                                }}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const anchorX = rect.left + rect.width / 2;
                                  const anchorTop = rect.top;
                                  setHoveredTimeAct({ ...act, phase: "st", anchorX, anchorTop });
                                }}
                                onMouseLeave={() => setHoveredTimeAct(null)}
                              />
                            );
                          })}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">Genomförda dagar: {Math.round(timeDetails.st.worked)} dagar</div>
                        <div className="text-xs text-slate-600">Totalt antal dagar från startdatum till slutdatum: {Math.round(timeDetails.st.total)} dagar</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {goalsVersion === "2021" ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-700">BT-delmål</span>
                            <span className="text-sm text-slate-600">0%</span>
                          </div>
                          <div className="h-6 w-full rounded-full bg-slate-200">
                            <div className="h-6 rounded-full bg-sky-500 transition-[width] duration-300" style={{ width: "0%" }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-700">ST-delmål</span>
                            <span className="text-sm text-slate-600">
                              {milestoneDetails.st.total > 0
                                ? `${((milestoneDetails.st.fulfilled / milestoneDetails.st.total) * 100).toFixed(0)}%`
                                : "0%"}
                            </span>
                          </div>
                          <div className="h-6 w-full rounded-full bg-slate-200">
                            <div
                              className="h-6 rounded-full bg-emerald-500/80 transition-[width] duration-300"
                              style={{
                                width: `${milestoneDetails.st.total > 0 ? Math.min(100, (milestoneDetails.st.fulfilled / milestoneDetails.st.total) * 100) : 0}%`,
                              }}
                            />
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            Utbildningsaktiviteter som uppfyller unika delmål: {String((milestoneDetails as any)?.st?.fulfilledMilestones ?? "").replace(".", ",")} av {(milestoneDetails as any)?.st?.totalMilestones}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-700">ST-delmål</span>
                          <span className="text-sm text-slate-600">
                            {milestoneDetails.st.total > 0
                              ? `${((milestoneDetails.st.fulfilled / milestoneDetails.st.total) * 100).toFixed(0)}%`
                              : "0%"}
                          </span>
                        </div>
                        <div className="h-6 w-full rounded-full bg-slate-200">
                          <div
                            className="h-6 rounded-full bg-emerald-500/80 transition-[width] duration-300"
                            style={{
                              width: `${milestoneDetails.st.total > 0 ? Math.min(100, (milestoneDetails.st.fulfilled / milestoneDetails.st.total) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Utbildningsaktiviteter som uppfyller unika delmål: {String((milestoneDetails as any)?.st?.fulfilledMilestones ?? "").replace(".", ",")} av {(milestoneDetails as any)?.st?.totalMilestones}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

          </div>
    </div>
  );
}

function calculateProgress(student: SupervisorStudent): number {
  const placements = student.placements || [];
  const todayISO = new Date().toISOString().slice(0, 10);
  let workedFteDays = 0;

  for (const p of placements as any[]) {
    const s = String(p?.startDate || "").slice(0, 10);
    const e = String(p?.endDate || "").slice(0, 10);
    if (!s || !e) continue;

    const attendanceRaw = typeof p?.attendance === "number" ? p.attendance : 100;
    const attendance = isZeroAttendancePlacementType(p?.type) ? 0 : attendanceRaw;

    // Genomfört t.o.m. idag (klipp framtiden)
    const workedEnd = e < todayISO ? e : todayISO;
    if (workedEnd >= s) {
      workedFteDays += fteDaysBetween(s, workedEnd, attendance);
    }
  }

  const profile: any = student.profile || {};
  const goalsVersion = student.goalsVersion;
  const profileBtStartISO = normalizeToISODate(profile?.btStartDate);
  const profileStStartISO = normalizeToISODate(profile?.stStartDate);

  const profileEndISO = (() => {
    const raw = (profile?.stEndDate || profile?.stEndISO || "") as string;
    const normalized = normalizeToISODate(raw);
    if (normalized) return normalized;
    const base = profileStStartISO || (goalsVersion === "2021" ? profileBtStartISO : null);
    const months = plannedTotalMonths(profile, goalsVersion);
    return base ? addMonthsISO(base, months) : null;
  })();

  const remainingCalendarDays = (() => {
    if (!profileEndISO || !isValidISODate(profileEndISO)) return 0;
    const t0 = new Date(todayISO + "T00:00:00").getTime();
    const t1 = new Date(profileEndISO + "T00:00:00").getTime();
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) return 0;
    if (t1 <= t0) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((t1 - t0) / msPerDay));
  })();

  const denom = workedFteDays + remainingCalendarDays;
  if (denom <= 0) return 0;
  const pct = (workedFteDays / denom) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

function mainSupervisorLabel(student: SupervisorStudent): string {
  const p: any = student.profile || {};
  return (
    p.mainSupervisor ||
    p.primarySupervisor ||
    p.huvudhandledare ||
    p.huvudHandledare ||
    p.supervisor ||
    p.handledare ||
    "-"
  );
}

function placementLabel(pl: any): string {
  return String(pl?.clinic || pl?.label || pl?.title || pl?.type || "-");
}

function getOngoingPlacement(student: SupervisorStudent): any | null {
  const today = new Date();
  const placements = student.placements || [];
  const ongoing = placements
    .map((p: any) => {
      const s = p?.startDate ? new Date(String(p.startDate)) : null;
      const e = p?.endDate ? new Date(String(p.endDate)) : null;
      return { p, s, e };
    })
    .filter(({ s, e }) => s && !Number.isNaN(s.getTime()) && e && !Number.isNaN(e.getTime()))
    .filter(({ s, e }) => (s as Date) <= today && today <= (e as Date))
    .sort((a, b) => (a.s as Date).getTime() - (b.s as Date).getTime());
  return ongoing.length ? ongoing[ongoing.length - 1].p : null;
}

function getNextPlacement(student: SupervisorStudent): any | null {
  const today = new Date();
  const placements = student.placements || [];
  const upcoming = placements
    .map((p: any) => {
      const s = p?.startDate ? new Date(String(p.startDate)) : null;
      return { p, s };
    })
    .filter(({ s }) => s && !Number.isNaN((s as Date).getTime()))
    .filter(({ s }) => (s as Date) > today)
    .sort((a, b) => (a.s as Date).getTime() - (b.s as Date).getTime());
  return upcoming.length ? upcoming[0].p : null;
}

function getStudentStartISO(student: SupervisorStudent): string | null {
  const profile: any = student.profile || {};
  const bt = normalizeToISODate(profile?.btStartDate);
  const st = normalizeToISODate(profile?.stStartDate);
  const start = student.goalsVersion === "2021" ? (bt || st) : st;
  return start || null;
}

function getStudentPlannedEndISO(student: SupervisorStudent): string | null {
  const profile: any = student.profile || {};
  const raw = (profile?.stEndDate || profile?.stEndISO || "") as string;
  const normalized = normalizeToISODate(raw);
  if (normalized) return normalized;
  const stStart = normalizeToISODate(profile?.stStartDate);
  const base = stStart || getStudentStartISO(student);
  const months = plannedTotalMonths(profile, student.goalsVersion);
  return base ? addMonthsISO(base, months) : null;
}

function idHashU32(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

function spreadStudentColors(students: SupervisorStudent[]): Map<string, string> {
  const items = (students || [])
    .map((s) => ({ id: String(s.id || ""), h: idHashU32(String(s.id || "")) }))
    .filter((x) => !!x.id)
    .sort((a, b) => a.h - b.h);

  const n = items.length;
  const step = n > 0 ? 360 / n : 360;
  const offset = 12;
  const out = new Map<string, string>();

  for (let i = 0; i < n; i++) {
    const hue = (offset + i * step) % 360;
    out.set(items[i].id, `hsl(${hue} 70% 45%)`);
  }
  return out;
}

export default function StudierektorPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const overallTimelineMonthGridRef = useRef<HTMLDivElement | null>(null);
  const [hideImportZone, setHideImportZone] = useState<boolean>(false);

  const [aboutOpen, setAboutOpen] = useState(false);

  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SupervisorStudent | null>(null);
  const [overallTimelineOpen, setOverallTimelineOpen] = useState(false);
  const [overallTimelineView, setOverallTimelineView] = useState<"computedEnd" | "linearMonths">(
    "linearMonths"
  );
  const [infoToast, setInfoToast] = useState<{ title: string; message: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [nameChangePrompt, setNameChangePrompt] = useState<{
    existingName: string;
    newName: string;
    personnummer: string;
    pendingData: any;
  } | null>(null);

  useEffect(() => {
    if (!infoToast) return;
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    toastTimerRef.current = window.setTimeout(() => {
      setInfoToast(null);
      toastTimerRef.current = null;
    }, 8000);

    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [infoToast]);

  const students = useLiveQuery(
    () => db.supervisorStudents.toArray() as Promise<SupervisorStudent[]>,
    [],
    []
  );

  const overallTimeline = useMemo(() => {
    const colorById = spreadStudentColors(students || []);
    const arr = (students || []).map((s) => {
      const startISO = getStudentStartISO(s);
      const endISO = getStudentPlannedEndISO(s);
      return {
        id: s.id,
        name: s.name,
        startISO,
        endISO,
        color: colorById.get(String(s.id || "")) || "hsl(210 70% 45%)",
      };
    });

    const starts = arr
      .map((x) => (isValidISODate(x.startISO) ? x.startISO : null))
      .filter(Boolean) as string[];
    const ends = arr
      .map((x) => (isValidISODate(x.endISO) ? x.endISO : null))
      .filter(Boolean) as string[];

    const minStart = starts.length ? starts.slice().sort()[0] : null;
    const maxEnd = ends.length ? ends.slice().sort()[ends.length - 1] : null;
    const minEnd = ends.length ? ends.slice().sort()[0] : null;

    const todayYear = new Date().getFullYear();
    const computedStartYearForSlots = minEnd ? new Date(minEnd + "T00:00:00").getFullYear() - 1 : null;
    const startYearForSlots =
      computedStartYearForSlots != null ? Math.min(computedStartYearForSlots, todayYear) : todayYear;
    const visibleStartSlot = startYearForSlots != null ? 0 : null;
    const endBoundarySlot =
      startYearForSlots != null && maxEnd
        ? dateToSlotSnapped(startYearForSlots, maxEnd, "end")
        : null;

    const markers = arr
      .filter((x) => isValidISODate(x.endISO) && startYearForSlots != null)
      .map((x) => {
        const slot = dateToSlotSnapped(startYearForSlots as number, x.endISO as string, "end");
        return {
          ...x,
          slot,
        };
      })
      .filter((x: any) => typeof x.slot === "number" && Number.isFinite(x.slot))
      .sort((a: any, b: any) => (a.endISO as string).localeCompare(b.endISO as string));

    const startYear = startYearForSlots;
    const endYear = (() => {
      if (!maxEnd) return Math.max(startYearForSlots as number, todayYear);
      const y = new Date(maxEnd + "T00:00:00").getFullYear();
      return Math.max(startYearForSlots as number, y, todayYear);
    })();
    const years: number[] = [];
    if (startYear != null && endYear != null) {
      for (let y = startYear; y <= endYear; y++) years.push(y);
    }

    return {
      minStart,
      maxEnd,
      startYearForSlots,
      visibleStartSlot,
      endBoundarySlot,
      years,
      markers,
    };
  }, [students]);

  const overallTimelineLinear = useMemo(() => {
    const cellW = 32;
    const rowH = 32;

    const colorById = spreadStudentColors(students || []);
    const safeMonthStart = (iso: string): string | null => {
      if (!isValidISODate(iso)) return null;
      return iso.slice(0, 7) + "-01";
    };

    const addMonthsISO = (iso: string, delta: number): string | null => {
      if (!isValidISODate(iso)) return null;
      const d = new Date(iso + "T00:00:00");
      if (Number.isNaN(d.getTime())) return null;
      d.setMonth(d.getMonth() + delta);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${d.getFullYear()}-${mm}-${dd}`;
    };

    const monthKey = (iso: string): number => {
      const d = new Date(iso + "T00:00:00");
      return d.getFullYear() * 12 + d.getMonth();
    };

    const daysInMonth = (year: number, month0: number): number => {
      const d = new Date(year, month0 + 1, 0);
      const n = d.getDate();
      return Number.isFinite(n) && n > 0 ? n : 30;
    };

    const MONTH_SHORT = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Maj",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Okt",
      "Nov",
      "Dec",
    ];

    const toMonthShort = (k: number): string => MONTH_SHORT[k % 12] || "";

    const rows = (students || []).map((s) => {
      const startISO = getStudentStartISO(s);
      const endISO = getStudentPlannedEndISO(s);
      return {
        id: s.id,
        name: s.name,
        startISO: isValidISODate(startISO) ? startISO : null,
        endISO: isValidISODate(endISO) ? endISO : null,
        color: colorById.get(String(s.id || "")) || "hsl(210 70% 45%)",
        placements: Array.isArray((s as any)?.placements) ? ((s as any).placements as any[]) : [],
      };
    });

    const startMonths = rows
      .map((r) => (r.startISO ? safeMonthStart(r.startISO) : null))
      .filter(Boolean) as string[];
    const endMonths = rows
      .map((r) => (r.endISO ? safeMonthStart(r.endISO) : null))
      .filter(Boolean) as string[];

    const minMonthISO = startMonths.length ? startMonths.slice().sort()[0] : null;
    const maxMonthISO = endMonths.length ? endMonths.slice().sort()[endMonths.length - 1] : null;

    if (!minMonthISO || !maxMonthISO) {
      return {
        ok: false as const,
        reason:
          "Saknar start/slutdatum för att rita månadsgrid. Kontrollera att profilerna innehåller ST-startdatum och planerat slutdatum.",
      };
    }

    const minKey = monthKey(minMonthISO);
    const maxKey = monthKey(maxMonthISO);
    const monthKeys: number[] = [];
    for (let k = minKey; k <= maxKey; k++) monthKeys.push(k);

    const todayMarkerX = (() => {
      const today = new Date();
      if (Number.isNaN(today.getTime())) return null;
      const tKey = today.getFullYear() * 12 + today.getMonth();
      if (tKey < minKey || tKey > maxKey) return null;
      const idx = tKey - minKey;
      const dim = daysInMonth(today.getFullYear(), today.getMonth());
      const frac = dim > 0 ? (Math.max(1, Math.min(dim, today.getDate())) - 1) / dim : 0;
      return (idx + frac) * cellW;
    })();

    const placementBarsByStudent = new Map<
      string,
      Array<{ left: number; width: number; label: string; bg: string; title: string }>
    >();

    for (const r of rows) {
      const bars: Array<{ left: number; width: number; label: string; bg: string; title: string }> = [];
      for (const p of r.placements) {
        const start = normalizeToISODate(p?.startDate || p?.startISO || p?.start || "");
        if (!start) continue;
        const endRaw = normalizeToISODate(p?.endDate || p?.endISO || p?.end || "");
        const end = endRaw || start;

        const sKey = monthKey(start.slice(0, 7) + "-01");
        const eKey = monthKey(end.slice(0, 7) + "-01");
        const leftIdx = Math.max(0, sKey - minKey);
        const rightIdx = Math.min(monthKeys.length - 1, eKey - minKey);
        if (rightIdx < 0 || leftIdx > monthKeys.length - 1) continue;
        const widthMonths = Math.max(1, rightIdx - leftIdx + 1);

        const label = String(p?.clinic || p?.title || p?.type || "Placering");
        bars.push({
          left: leftIdx * cellW,
          width: widthMonths * cellW,
          label,
          bg: r.color,
          title: `${r.name} – ${label}: ${formatDate(start)} – ${formatDate(end)}`,
        });
      }
      placementBarsByStudent.set(String(r.id), bars);
    }

    return {
      ok: true as const,
      cellW,
      rowH,
      monthKeys,
      monthLabels: monthKeys.map(toMonthShort),
      rows,
      placementBarsByStudent,
      todayMarkerX,
    };
  }, [students]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setImporting(true);
    const errors: string[] = [];
    
    try {
      for (const file of Array.from(files)) {
        try {
          const fileValidation = validateJsonFile(file);
          if (!fileValidation.valid) {
            errors.push(`${file.name}: ${fileValidation.error}`);
            continue;
          }

          const txt = await file.text();
          const parseResult = safeJsonParse(txt);
          if (!parseResult.success || !parseResult.data) {
            errors.push(`${file.name}: ${parseResult.error || "Kunde inte tolka JSON"}`);
            continue;
          }

          const data = parseResult.data;
          const profile = data.profile ?? data?.Profile ?? data?.prof ?? null;
          const placements = data.placements ?? data?.Placements ?? [];
          const courses = data.courses ?? data?.Courses ?? [];
          const achievements = data.achievements ?? data?.Achievements ?? [];
          const rawTimeline = data.timeline ?? data?.Timeline ?? data?.TIMELINE ?? [];
          const timeline = Array.isArray(rawTimeline)
            ? rawTimeline
            : rawTimeline
            ? [rawTimeline]
            : [];
          const iupMilestonePlans = data.iupMilestonePlans ?? [];

          if (!profile) {
            errors.push(`${file.name}: Ingen profil hittades i filen`);
            continue;
          }

          const name = profile.name || profile.fullName || "Okänd";
          const personnummer = profile.personnummer || profile.personalNumber || profile.pnr || "";
          const specialty = profile.specialty || profile.speciality || "Ej angiven";
          const goalsVersion = profile.goalsVersion === "2015" ? "2015" : "2021";

          // Kolla om personnummer redan finns
          const existingByPnr = personnummer 
            ? (students || []).find((s: SupervisorStudent) => s.personnummer === personnummer)
            : null;

          if (existingByPnr && existingByPnr.name !== name) {
            // Samma personnummer men annat namn - fråga om namnbyte
            setNameChangePrompt({
              existingName: existingByPnr.name,
              newName: name,
              personnummer,
              pendingData: {
                id: existingByPnr.id,
                personnummer,
                specialty,
                goalsVersion,
                importedAt: existingByPnr.importedAt,
                lastUpdated: new Date().toISOString(),
                profile,
                placements,
                courses,
                achievements,
                timeline,
                iupMilestonePlans,
              }
            });
            continue;
          }

          const studentData: SupervisorStudent = {
            id: existingByPnr?.id || uid(),
            name,
            personnummer,
            specialty,
            goalsVersion,
            importedAt: existingByPnr?.importedAt || new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            profile,
            placements,
            courses,
            achievements,
            timeline,
            iupMilestonePlans,
          };

          await db.supervisorStudents.put(studentData);

          if (existingByPnr) {
            setInfoToast({
              title: "Fil ersatte befintlig",
              message: `Personnummer ${personnummer} fanns redan. Data uppdaterades från \"${file.name}\".`,
            });
          }
        } catch (err) {
          errors.push(`${file.name}: ${err instanceof Error ? err.message : "Okänt fel"}`);
        }
      }

      if (errors.length > 0) {
        alert(`Några filer kunde inte importeras:\n\n${errors.join("\n")}`);
      }
    } finally {
      setImporting(false);
    }
  }, [students]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const deleteStudent = async (id: string) => {
    if (!confirm("Är du säker på att du vill ta bort denna ST-läkare?")) return;
    await db.supervisorStudents.delete(id);
  };

  const handleNameChange = async (useName: "existing" | "new") => {
    if (!nameChangePrompt) return;
    const { pendingData, existingName, newName } = nameChangePrompt;
    const finalName = useName === "existing" ? existingName : newName;
    await db.supervisorStudents.put({ ...pendingData, name: finalName });
    setInfoToast({
      title: "Fil ersatte befintlig",
      message: `Personnummer ${nameChangePrompt.personnummer} fanns redan. Data uppdaterades och namn sattes till \"${finalName}\".`,
    });
    setNameChangePrompt(null);
  };

  const saveList = async () => {
    const allStudents = await db.supervisorStudents.toArray();
    const exportData = {
      exportedAt: new Date().toISOString(),
      students: allStudents,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studierektor-lista-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadList = async (file: File) => {
    try {
      const txt = await file.text();
      const data = JSON.parse(txt);
      if (data.students && Array.isArray(data.students)) {
        for (const student of data.students) {
          await db.supervisorStudents.put(student);
        }
      }
    } catch (err) {
      alert("Kunde inte läsa sparfilen.");
    }
  };

  const handleOverallTimelineMonthGridWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = overallTimelineMonthGridRef.current;
    if (!el) return;

    const dx = e.deltaX;
    const dy = e.deltaY;
    const wantsHorizontal = Math.abs(dx) > Math.abs(dy) || e.shiftKey;

    if (wantsHorizontal) {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.shiftKey ? dy : dx;
      el.scrollLeft += delta;
    }
  };

  useEffect(() => {
    if (!overallTimelineOpen) return;
    if (overallTimelineView !== "linearMonths") return;
    const el = overallTimelineMonthGridRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const dx = e.deltaX;
      const dy = e.deltaY;
      const wantsHorizontal = Math.abs(dx) > Math.abs(dy) || e.shiftKey;
      if (!wantsHorizontal) return;

      // Viktigt i Safari: om man är vid kanten och fortsätter scrolla horisontellt
      // kan browsern tolka det som back/forward. Blockera detta här.
      const delta = e.shiftKey ? dy : dx;
      const atLeft = el.scrollLeft <= 0;
      const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;

      if ((atLeft && delta < 0) || (atRight && delta > 0)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      el.scrollLeft += delta;
    };

    // Native listener med passive:false för att preventDefault ska fungera i Safari
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel as any);
    };
  }, [overallTimelineOpen, overallTimelineView]);

  return (
    <div className="min-h-screen bg-slate-50">
      {infoToast && (
        <div className="fixed right-4 top-4 z-[80] w-[min(420px,calc(100vw-2rem))] rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{infoToast.title}</p>
              <p className="mt-1 text-sm text-slate-700">{infoToast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setInfoToast(null)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50"
            >
              Stäng
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="select-none caret-transparent text-4xl font-extrabold tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
            >
              <span className="text-sky-700">ST</span>
              <span className="text-emerald-700">ARK</span>
            </button>
            <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              Studierektor / Huvudhandledare
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOverallTimelineOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
            >
              Övergripande tidslinje
            </button>
            <button
              onClick={saveList}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-sky-700 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 active:translate-y-px"
              title="Spara listan som JSON-fil"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-2-2Zm0 2v3H7V5h10ZM7 10h10v9H7v-9Z"/>
              </svg>
              Spara
            </button>
            <button
              onClick={() => setAboutOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
            >
              Om
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Mina ST-läkare</h1>
          {hideImportZone && (
            <button
              type="button"
              onClick={() => setHideImportZone(false)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
            >
              Visa import
            </button>
          )}
        </div>

        {/* Drop zone */}
        {!hideImportZone && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`relative mb-6 rounded-xl border-2 border-dashed p-8 text-center transition ${
              dragOver
                ? "border-sky-500 bg-sky-50"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setHideImportZone(true);
              }}
              className="absolute right-3 top-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              Dölj
            </button>

            <p className="text-slate-600">
              Dra och släpp JSON-filer här, eller{" "}
              <button
                onClick={() => fileRef.current?.click()}
                className="font-semibold text-sky-600 hover:text-sky-700"
              >
                klicka för att välja filer
              </button>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Du kan ladda upp flera filer samtidigt
            </p>
          </div>
        )}

        {/* Student list */}
        {students && students.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Namn
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Målversion
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Huvudhandledare
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Pågående placering
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Slutdatum placering
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Nästa placering
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                    Senast uppdaterad
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {students.map((student: SupervisorStudent) => {
                  const progress = calculateProgress(student);
                  const ongoing = getOngoingPlacement(student);
                  const nextPl = getNextPlacement(student);
                  const ongoingEnd = ongoing?.endDate ? String(ongoing.endDate) : "";
                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {student.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {student.goalsVersion}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {mainSupervisorLabel(student)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {ongoing ? placementLabel(ongoing) : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {ongoingEnd ? formatDate(ongoingEnd) : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {nextPl ? placementLabel(nextPl) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-slate-200">
                            <div
                              className="h-2 rounded-full bg-emerald-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-600">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(student.lastUpdated).toLocaleDateString("sv-SE")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStudent(student.id);
                          }}
                          className="rounded-md border px-2 py-1 text-[12px] hover:bg-slate-50"
                          aria-label="Ta bort"
                          title="Ta bort"
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-600">
              Inga ST-läkare har lagts till ännu.
            </p>
          </div>
        )}
      </main>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        multiple
        className="hidden"
        onChange={onFileChange}
      />

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {/* Student-detalj-popup */}
      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      {overallTimelineOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOverallTimelineOpen(false);
          }}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black bg-white px-6 py-4">
              <div className="text-base font-bold text-slate-900">Övergripande tidslinje</div>
              <button
                type="button"
                onClick={() => setOverallTimelineOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
              >
                Stäng
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 w-fit">
                <button
                  type="button"
                  onClick={() => setOverallTimelineView("linearMonths")}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    overallTimelineView === "linearMonths"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Översikt
                </button>
                <button
                  type="button"
                  onClick={() => setOverallTimelineView("computedEnd")}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    overallTimelineView === "computedEnd"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Slutdatum
                </button>
              </div>

              {overallTimelineView === "linearMonths" ? (
                overallTimelineLinear.ok ? (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div
                      ref={overallTimelineMonthGridRef}
                      className="overflow-x-auto overscroll-x-contain pb-4"
                      style={{ overscrollBehaviorX: "contain" }}
                    >
                      <div className="min-w-max pb-1">
                        <div
                          className="grid"
                          style={{
                            gridTemplateColumns: `max-content ${
                              overallTimelineLinear.monthKeys.length * overallTimelineLinear.cellW
                            }px`,
                          }}
                        >
                          <div className="sticky left-0 z-20 bg-white border-b border-slate-200 border-r-2 border-slate-300 px-3 text-sm font-semibold text-slate-700 h-[56px] flex items-center whitespace-nowrap">
                            ST-läkare
                          </div>
                          <div className="border-b border-slate-200 bg-white">
                            <div className="relative">
                              <div
                                className="grid text-[11px] text-slate-700"
                                style={{
                                  gridTemplateColumns: `repeat(${overallTimelineLinear.monthKeys.length}, ${
                                    overallTimelineLinear.cellW
                                  }px)`,
                                }}
                              >
                                {(() => {
                                  const keys = overallTimelineLinear.monthKeys as number[];
                                  const segs: Array<{ year: number; start: number; len: number }> = [];
                                  for (let i = 0; i < keys.length; ) {
                                    const y = Math.floor(keys[i] / 12);
                                    let j = i;
                                    while (j < keys.length && Math.floor(keys[j] / 12) === y) j++;
                                    segs.push({ year: y, start: i, len: j - i });
                                    i = j;
                                  }
                                  return segs.map((s) => (
                                    <div
                                      key={`y-${s.year}-${s.start}`}
                                      className="h-6 flex items-center justify-center font-semibold text-slate-700"
                                      style={{ gridColumn: `${s.start + 1} / span ${s.len}` }}
                                    >
                                      {s.year}
                                    </div>
                                  ));
                                })()}
                              </div>

                              <div
                                className="grid text-[11px] text-slate-600"
                                style={{
                                  gridTemplateColumns: `repeat(${overallTimelineLinear.monthKeys.length}, ${
                                    overallTimelineLinear.cellW
                                  }px)`,
                                }}
                              >
                                {overallTimelineLinear.monthKeys.map((k: number, idx: number) => {
                                  const lab = (overallTimelineLinear.monthLabels as string[])[idx] || "";
                                  const isYearStart = k % 12 === 0;
                                  return (
                                    <div
                                      key={`m-${k}`}
                                      className={`h-8 flex items-end justify-center pb-1 ${
                                        idx === 0
                                          ? ""
                                          : `border-l ${
                                              isYearStart ? "border-slate-400 border-l-2" : "border-slate-200"
                                            }`
                                      }`}
                                    >
                                      {lab}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {overallTimelineLinear.rows
                            .slice()
                            .sort((a: any, b: any) =>
                              String(a.name || "").localeCompare(String(b.name || ""))
                            )
                            .map((r: any) => {
                              const bars =
                                overallTimelineLinear.placementBarsByStudent.get(String(r.id)) || [];
                              return (
                                <Fragment key={String(r.id)}>
                                  <div className="sticky left-0 z-10 bg-white border-b border-slate-200 border-r-2 border-slate-300 px-3 text-sm text-slate-900 h-[32px] flex items-center whitespace-nowrap">
                                    {r.name}
                                  </div>
                                  <div
                                    className="relative border-b border-slate-200 bg-white"
                                    style={{ height: overallTimelineLinear.rowH }}
                                  >
                                    {typeof overallTimelineLinear.todayMarkerX === "number" && (
                                      <div
                                        className="pointer-events-none absolute inset-y-0 z-0"
                                        style={{ left: overallTimelineLinear.todayMarkerX, width: 0 }}
                                        aria-hidden="true"
                                      >
                                        <div
                                          style={{
                                            position: "absolute",
                                            left: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: 0,
                                            borderLeft: "3px solid #2563eb",
                                            transform: "translateX(-1px)",
                                          }}
                                          title={`Idag (${new Date().toISOString().slice(0, 10)})`}
                                        />
                                      </div>
                                    )}
                                    <div
                                      className="absolute inset-0 grid"
                                      style={{
                                        gridTemplateColumns: `repeat(${overallTimelineLinear.monthKeys.length}, ${
                                          overallTimelineLinear.cellW
                                        }px)`,
                                      }}
                                    >
                                      {overallTimelineLinear.monthKeys.map((k: number, idx: number) => {
                                        const isYearStart = k % 12 === 0;
                                        return (
                                          <div
                                            key={`${r.id}-${k}`}
                                            className={
                                              idx === 0
                                                ? ""
                                                : `border-l ${
                                                    isYearStart ? "border-slate-300 border-l-2" : "border-slate-100"
                                                  }`
                                            }
                                          />
                                        );
                                      })}
                                    </div>

                                    {bars.map((b: any, idx: number) => (
                                      <div
                                        key={`${r.id}-bar-${idx}`}
                                        className="absolute top-1/2 -translate-y-1/2 h-[18px] rounded-md px-2 text-[11px] font-semibold text-white overflow-hidden whitespace-nowrap"
                                        style={{ left: b.left, width: b.width, backgroundColor: b.bg }}
                                        title={b.title}
                                      >
                                        {b.label}
                                      </div>
                                    ))}
                                  </div>
                                </Fragment>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                    {overallTimelineLinear.reason}
                  </div>
                )
              ) : overallTimeline.minStart && overallTimeline.maxEnd ? (
                <>
                  {/* Tidslinje – samma grid-design som planera-st */}
                  <div className="space-y-0 rounded-xl border border-slate-200 overflow-hidden">
                    {/* Sticky månadsrad */}
                    <div className="grid grid-cols-[80px_1fr] items-end sticky top-0 z-10 backdrop-blur bg-white/80 border-b border-slate-200">
                      <div className="pr-2" />
                      <div className="relative">
                        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] text-xs text-slate-700">
                          {MONTH_NAMES.map((m, idx) => (
                            <div
                              key={m}
                              className={`col-span-2 text-center font-medium pb-1 ${
                                idx === 0 ? "border-l border-slate-300" : ""
                              } ${
                                idx === MONTH_NAMES.length - 1 ? "border-r border-slate-300" : ""
                              }`}
                            >
                              {m}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {overallTimeline.years.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-slate-600">Inget att visa.</div>
                    ) : (
                      overallTimeline.years.map((year, yearIdx) => {
                        const isFirst = yearIdx === 0;
                        const isLast = yearIdx === overallTimeline.years.length - 1;
                        const rowStartSlot = (year - (overallTimeline.startYearForSlots as number)) * 24;
                        const rowEndSlot = rowStartSlot + 24;

                        return (
                          <div key={year} className="grid grid-cols-[80px_1fr] items-stretch">
                            <div className="pr-2 py-1 text-right font-semibold select-none flex items-center justify-end">
                              <span>{year}</span>
                            </div>

                            <div
                              className="st-row relative isolate bg-white"
                              style={{
                                height: "2.6rem",
                                backgroundImage:
                                  "linear-gradient(to right, rgba(148,163,184,.35) 1px, transparent 1px)",
                                backgroundSize: "calc(100% / 24) 100%",
                                backgroundRepeat: "repeat-x",
                                backgroundPosition: "0 0",
                                borderTopLeftRadius: isFirst ? "2px" : "0px",
                                borderTopRightRadius: isFirst ? "2px" : "0px",
                                borderBottomLeftRadius: isLast ? "2px" : "0px",
                                borderBottomRightRadius: isLast ? "2px" : "0px",
                                overflow: "visible",
                              }}
                            >
                              {/* Månadslinjer */}
                              <div className="pointer-events-none absolute inset-0" style={{ zIndex: 10 }}>
                                {Array.from({ length: 13 }, (_, monthIdx) => {
                                  const leftPercent = (monthIdx / 12) * 100;
                                  return (
                                    <div
                                      key={`month-line-${monthIdx}`}
                                      style={{
                                        position: "absolute",
                                        left: `${leftPercent}%`,
                                        top: 0,
                                        bottom: "3px",
                                        width: "2px",
                                        backgroundColor: "rgba(100,116,139,.85)",
                                      }}
                                    />
                                  );
                                })}
                              </div>

                              <div
                                className="grid grid-cols-[repeat(24,minmax(0,1fr))]"
                                style={{ gridTemplateRows: "1.75rem 0.75rem" }}
                              >
                                {Array.from({ length: 24 }, (_, i) => {
                                  const monthIndex = Math.floor(i / 2);
                                  const insideCls = monthIndex % 2 ? "bg-slate-50" : INSIDE_BG_CELL;
                                  const isFirstCol = i === 0;
                                  const isLastCol = i === 23;
                                  const isFirstHalfOfMonth = i % 2 === 0;
                                  return (
                                    <div
                                      key={`cell1-${year}-${i}`}
                                      className={[
                                        "relative z-0 h-7 border-t border-slate-300",
                                        isFirstCol ? "border-l border-slate-300" : "",
                                        isLastCol ? "border-r border-slate-300" : "",
                                        !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
                                        insideCls,
                                      ].join(" ")}
                                      style={{ gridRowStart: 1 }}
                                    />
                                  );
                                })}

                                {Array.from({ length: 24 }, (_, i) => {
                                  const monthIndex = Math.floor(i / 2);
                                  const isFirstCol = i === 0;
                                  const isLastCol = i === 23;
                                  const isFirstHalfOfMonth = i % 2 === 0;
                                  return (
                                    <div
                                      key={`lane-${year}-${i}`}
                                      className={[
                                        "h-3 w-full transition",
                                        monthIndex % 2 ? "bg-slate-200" : INSIDE_BG_LANE,
                                        "border-y border-slate-300",
                                        isFirstCol ? "border-l border-slate-300" : "",
                                        isLastCol ? "border-r border-slate-300" : "",
                                        !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
                                      ].join(" ")}
                                      style={{ gridRowStart: 2 }}
                                    />
                                  );
                                })}
                              </div>

                              {/* Overlay: slutdatum-markörer */}
                              <div
                                className="pointer-events-none absolute inset-0 z-[60] grid grid-cols-[repeat(24,minmax(0,1fr))] rounded-[2px]"
                                style={{ gridTemplateRows: "1.9rem 0.75rem", overflow: "visible" }}
                              >
                                {overallTimeline.markers
                                  .filter((m: any) => m.slot >= rowStartSlot && m.slot < rowEndSlot)
                                  .map((m: any) => {
                                    const col = m.slot - rowStartSlot;
                                    return (
                                      <div
                                        key={`m-${year}-${m.id}`}
                                        className="relative"
                                        style={{ gridColumnStart: col + 1, gridRowStart: 1 }}
                                      >
                                        <div
                                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-[3px] rounded"
                                          style={{ backgroundColor: m.color }}
                                          title={`${m.name} – ${formatDate(String(m.endISO || ""))}`}
                                        />
                                      </div>
                                    );
                                  })}
                              </div>

                              {/* Overlay: Idag-markör */}
                              {(() => {
                                const today = new Date();
                                const yearToday = today.getFullYear();
                                if (yearToday !== year) return null;
                                const startOfYear = new Date(yearToday, 0, 1);
                                const startOfNextYear = new Date(yearToday + 1, 0, 1);
                                const msInDay = 24 * 60 * 60 * 1000;
                                const dayIndex = Math.floor((today.getTime() - startOfYear.getTime()) / msInDay);
                                const daysInYear = Math.max(
                                  1,
                                  Math.floor((startOfNextYear.getTime() - startOfYear.getTime()) / msInDay)
                                );
                                const frac = Math.min(Math.max(dayIndex / daysInYear, 0), 1);
                                const pct = frac * 100;
                                if (pct < 0 || pct > 100) return null;
                                const todayISO = new Date().toISOString().slice(0, 10);
                                return (
                                  <div
                                    className="pointer-events-none absolute inset-0 z-[70]"
                                    aria-hidden="true"
                                  >
                                    <div
                                      className="absolute"
                                      style={{
                                        top: 0,
                                        height: "1.75rem",
                                        left: `${pct}%`,
                                        width: 0,
                                        borderLeft: "3.5px solid #2563eb",
                                        transform: "translateX(0)",
                                      }}
                                      title={`Idag (${todayISO})`}
                                    />
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    {overallTimeline.markers.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <span
                          className="inline-block h-3 w-3 rounded-sm"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-sm font-semibold text-slate-900 flex-1 min-w-0 truncate">
                          {m.name}
                        </span>
                        <span className="text-sm text-slate-700 shrink-0">
                          Beräknat slutdatum: {formatDate(String(m.endISO || ""))}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  Saknar start/slutdatum för att rita tidslinjen. Kontrollera att profilerna innehåller ST-startdatum och planerat slutdatum.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Namnbyte-dialog */}
      {nameChangePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Namnbyte upptäckt</h3>
            <p className="mb-4 text-slate-600">
              Personnummer <strong>{nameChangePrompt.personnummer}</strong> finns redan i listan med namnet{" "}
              <strong>{nameChangePrompt.existingName}</strong>, men den nya filen har namnet{" "}
              <strong>{nameChangePrompt.newName}</strong>.
            </p>
            <p className="mb-6 text-slate-600">Vilket namn ska användas?</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleNameChange("existing")}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                {nameChangePrompt.existingName}
              </button>
              <button
                onClick={() => handleNameChange("new")}
                className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                {nameChangePrompt.newName}
              </button>
            </div>
            <button
              onClick={() => setNameChangePrompt(null)}
              className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

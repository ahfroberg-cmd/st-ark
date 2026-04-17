"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadGoals, type GoalsCatalog, type GoalsMilestone } from "@/lib/goals";
import { btMilestones } from "@/lib/goals-bt";
import { mergeWithCommon, COMMON_AB_MILESTONES } from "@/lib/goals-common";
import { milestoneRequires } from "@/lib/milestoneRequirements";
import { displayMilestoneCode } from "@/lib/milestoneDisplay";
import type { SupervisorStudent } from "@/lib/mappers/studentData";

export default function DelmalReadonly({
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
        const rawId = String((m as any)?.id ?? (m as any)?.code ?? "").toUpperCase().replace(/\s+/g, "");
        if (/^ST[ABC]\d+$/i.test(rawId)) continue;
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

// components/MilestoneOverviewModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { Profile, Achievement, Placement, Course } from "@/lib/types";
import { loadGoals, type GoalsCatalog, type GoalsMilestone } from "@/lib/goals";
import { btMilestones, type BtMilestone } from "@/lib/goals-bt";
import { mergeWithCommon, COMMON_AB_MILESTONES } from "@/lib/goals-common";


/** Trim av rubriker utan flimmer */
function TitleTrimmer({ text, className }: { text: string; className?: string }) {
  const maxLength = 80;
  const display = text.length > maxLength ? text.slice(0, maxLength).trimEnd() + "..." : text;
  return (
    <span className={className} title={text}>
      {display}
    </span>
  );
}

type Props = { open: boolean; onClose: () => void; initialTab: "st" | "bt"; title?: string };
type TabKey = "st" | "bt";

/** Panel för delmål – kan ligga i egen modal eller inuti IUP-fliken */
export function MilestoneOverviewPanel({ open, onClose, initialTab, title }: Props) {
  console.log("[MilestoneOverviewPanel] Rendered with initialTab:", initialTab, "open:", open);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [goals, setGoals] = useState<GoalsCatalog | null>(null);
  const [achAll, setAchAll] = useState<Achievement[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [showDone, setShowDone] = useState(true);
  
  // Always sync tab with initialTab when it changes
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const [showOngoing, setShowOngoing] = useState(true);
  const [showPlanned, setShowPlanned] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailPlanText, setDetailPlanText] = useState<string>("");
  const [detailDirty, setDetailDirty] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailSelectedSuggestions, setDetailSelectedSuggestions] = useState<Record<string, boolean>>({});
  const [planByMilestone, setPlanByMilestone] = useState<Record<string, string>>({});

  // Lista (Klin/Kurs/Intyg)
  const [listOpen, setListOpen] = useState(false);

  const [listTitle, setListTitle] = useState("");
  const [listItems, setListItems] = useState<{ id: string; line1: string; line2?: string }[]>([]);
  const [listKind, setListKind] = useState<"klin" | "kurs" | "intyg">("intyg");

  // Popup "Inget kopplat"
  const [notMetOpen, setNotMetOpen] = useState(false);

  // Always sync tab with initialTab
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  
  // Also set tab when opening (in case initialTab hasn't changed)
  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  // Förhindra scroll på body när popup är öppen
  useEffect(() => {
    if (open || detailId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, detailId]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const p = await db.profile.get("default");
      setProfile(p ?? null);

      const spec = p?.specialty ?? (p as any)?.speciality ?? "";
      if (p?.goalsVersion && spec) {
        try {
          const g = await loadGoals(p.goalsVersion, spec);
          setGoals(g);
        } catch {
          setGoals(null);
        }
      } else {
        setGoals(null);
      }

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

      // Försök läsa in tidigare sparade planer för delmål (om tabell finns)
      try {
        const anyDb = db as any;
        const table =
          anyDb.iupMilestonePlans ??
          anyDb.milestonePlans ??
          (typeof anyDb.table === "function" ? anyDb.table("iupMilestonePlans") : null);
        if (table && typeof table.toArray === "function") {
          const rows = await table.toArray();
          const map: Record<string, string> = {};
          for (const row of rows as any[]) {
            const mid = String((row as any).milestoneId ?? (row as any).id ?? "");
            if (!mid) continue;
            const text = String((row as any).planText ?? (row as any).text ?? "");
            map[mid] = text;
          }
          setPlanByMilestone(map);
        } else {
          setPlanByMilestone({});
        }
      } catch {
        setPlanByMilestone({});
      }

      setTab("st");
      setQ("");
      setDetailId(null);
      setDetailPlanText("");
      setDetailDirty(false);
      setDetailSaving(false);
      setDetailSelectedSuggestions({});
      setListOpen(false);
      setNotMetOpen(false);
      setListTitle("");
      setListItems([]);
      setListKind("intyg");
    })();
  }, [open]);


  const is2021 = (profile?.goalsVersion ?? "") === "2021";

  // ====== ST datakällor/filtrering ======
  const codeNum = (code: string) => {
    const m = code.match(/(\d+)\s*$/i);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  };

  const allSt = useMemo(() => {
    if (!goals) return [] as GoalsMilestone[];

    // Bas: alla delmål i specialitetens egen katalog
    const baseArr: GoalsMilestone[] = Array.isArray((goals as any).milestones)
      ? ((goals as any).milestones as GoalsMilestone[])
      : [];

    // Om katalogen innehåller STc-delmål (2021) kompletterar vi med STa/STb från COMMON_AB_MILESTONES
    const hasStc = baseArr.some((m: any) =>
      /^STc\d+$/i.test(String((m as any).code ?? (m as any).id ?? ""))
    );

    // 2021: använd specialitetens STa/STb/STc + komplettera med gemensamma STa/STb vid behov
    if (hasStc) {
      const arr: GoalsMilestone[] = [...baseArr];

      const existingKeys = new Set(
        arr
          .map((m: any) =>
            String((m as any).code ?? (m as any).id ?? "")
              .toUpperCase()
              .replace(/\s+/g, "")
          )
          .filter(Boolean)
      );

      Object.values(COMMON_AB_MILESTONES).forEach((cm: any) => {
        const codeRaw = String(cm.code ?? cm.id ?? "");
        const codeKey = codeRaw.toUpperCase().replace(/\s+/g, "");

        // 2021-varianten av gemensamma A/B: STa1, STb3 osv
        if (!/^ST[AB]\d+$/i.test(codeRaw)) return;
        if (existingKeys.has(codeKey)) return;

        arr.push(cm as GoalsMilestone);
      });

      return arr;
    }

    // 2015: ersätt A- och B-delmål med gemensamma från COMMON_AB_MILESTONES (t.ex. Medarbetarskap, Etik, Palliativ vård m.m.)
    const withoutAb = baseArr.filter((m: any) => {
      const rawGroup = String((m as any).group ?? "").toUpperCase();
      const codeRaw = String((m as any).code ?? (m as any).id ?? "")
        .toUpperCase()
        .replace(/\s+/g, "");

      // Släng bort allt som tydligt är A- eller B-delmål
      if (rawGroup === "A" || rawGroup === "B") return false;
      if (/^[AB]\d+$/i.test(codeRaw)) return false;

      return true;
    });

    const commonAb = (Object.values(COMMON_AB_MILESTONES) as any[]).filter((cm) => {
      const codeRaw = String(cm.code ?? cm.id ?? "");
      const key = codeRaw.toUpperCase().replace(/\s+/g, "");
      // 2015-varianten: alla A1..A6, B1..B5 där koden börjar med A/B + siffra
      return /^[AB]\d+/i.test(key);
    }) as GoalsMilestone[];

    return [...withoutAb, ...commonAb];
  }, [goals]);




  const qlc = q.trim().toLowerCase();
  const filteredSt = useMemo(() => {
    if (!qlc) return allSt;
    const hit = (m: GoalsMilestone) =>
      m.title.toLowerCase().includes(qlc) ||
      m.code.toLowerCase().includes(qlc) ||
      (typeof m.description === "string" && m.description.toLowerCase().includes(qlc)) ||
      (m.sections &&
        (() => {
          try {
            return JSON.stringify(m.sections).toLowerCase().includes(qlc);
          } catch {
            return false;
          }
        })());
    return allSt.filter(hit);
  }, [allSt, qlc]);

    const groups = useMemo(() => {
    const res: Record<"A" | "B" | "C", GoalsMilestone[]> = { A: [], B: [], C: [] };
    const seen: Record<"A" | "B" | "C", Set<string>> = {
      A: new Set<string>(),
      B: new Set<string>(),
      C: new Set<string>(),
    };

    const determineGroup = (m: GoalsMilestone): "A" | "B" | "C" | undefined => {
      const code = (m.code || "").toLowerCase();
      const rawGroup = ((m as any).group ?? "").toString().toLowerCase();
      let g: "A" | "B" | "C" | undefined;

      if (rawGroup === "a" || rawGroup === "b" || rawGroup === "c") {
        g = rawGroup.toUpperCase() as "A" | "B" | "C";
      } else if (rawGroup === "sta" || rawGroup === "stb" || rawGroup === "stc") {
        const letter = rawGroup[2];
        g = letter.toUpperCase() as "A" | "B" | "C";
      } else if (rawGroup.startsWith("st") && rawGroup.length >= 3) {
        const letter = rawGroup[2];
        if (letter === "a" || letter === "b" || letter === "c") {
          g = letter.toUpperCase() as "A" | "B" | "C";
        }
      } else if (code.startsWith("sta")) {
        g = "A";
      } else if (code.startsWith("stb")) {
        g = "B";
      } else if (code.startsWith("stc")) {
        g = "C";
      } else if (/^a\d+/.test(code)) {
        g = "A";
      } else if (/^b\d+/.test(code)) {
        g = "B";
      } else if (/^c\d+/.test(code)) {
        g = "C";
      }

      return g;
    };


    const resolveForDisplay = (m: GoalsMilestone): GoalsMilestone => {
      const raw = String((m.code ?? m.id) ?? "");
      const key = raw.toUpperCase().replace(/\s+/g, "");
      const isCommonAB2015 = !is2021 && /^[AB]\d+/i.test(key);

      if (!isCommonAB2015) return m;

      const commonByKey =
        (COMMON_AB_MILESTONES as any)[key] ??
        (COMMON_AB_MILESTONES as any)[key.toLowerCase()];

      if (!commonByKey) {
        const commonByCode = Object.values(COMMON_AB_MILESTONES as any).find((cm: any) => {
          const codeRaw = String(cm?.code ?? cm?.id ?? "");
          const codeKey = codeRaw.toUpperCase().replace(/\s+/g, "");
          return codeKey === key;
        }) as GoalsMilestone | undefined;
        if (!commonByCode) return m;

        return {
          ...m,
          title: commonByCode.title ?? m.title,
          sections: (commonByCode as any).sections ?? (m as any).sections,
          group: (commonByCode as any).group ?? (m as any).group,
        } as GoalsMilestone;
      }

      return {
        ...m,
        title: (commonByKey as any).title ?? m.title,
        sections: (commonByKey as any).sections ?? (m as any).sections,
        group: (commonByKey as any).group ?? (m as any).group,
      } as GoalsMilestone;
    };


    for (const m of filteredSt) {
      const display = resolveForDisplay(m);
      const g = determineGroup(display);
      if (!g) continue;

      const keyNorm = String((display as any).id ?? (display as any).code ?? "")
        .toUpperCase()
        .replace(/\s+/g, "");
      if (!keyNorm) continue;
      if (seen[g].has(keyNorm)) continue;
      seen[g].add(keyNorm);

      res[g].push(display);
    }

    const cmp = (a: GoalsMilestone, b: GoalsMilestone) => {
      const na = codeNum(a.code);
      const nb = codeNum(b.code);
      if (na !== nb) return na - nb;
      return a.code.localeCompare(b.code, "sv");
    };
    (["A", "B", "C"] as const).forEach((g) => res[g].sort(cmp));
    return res;
  }, [filteredSt, is2021]);






  // ====== BT rader (visa ALLA BT-mål, med counts från data) ======
  type BtRow = { code: string; klinCount: number; kursCount: number };

  const normalizeBtCode = (x: unknown) => {
    const s = String(x ?? "").trim();
    const m = s.match(/^BT[\s\-_]*([0-9]+)/i);
    return m ? "BT" + m[1] : null;
  };

  const todayIso = new Date().toISOString().slice(0, 10);

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
          // Använd any här så vi slipper krav på startDate/endDate i Course-typen
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

    const filtered = btMilestones.filter((m) => {
      if (!q.trim()) return true;
      const hay = (m.id + " " + m.title + " " + m.bullets.join(" ")).toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });

    const sortNum = (code: string) => Number(code.replace(/[^\d]/g, "")) || 0;

    return filtered
      .map((m) => {
        const code = m.id.toUpperCase().replace(/\s|_|-/g, "");
        return {
          code,
          klinCount: klin[code] ?? 0,
          kursCount: kurs[code] ?? 0,
        };
      })
      .sort((a, b) => sortNum(a.code) - sortNum(b.code));
  }, [achAll, placements, courses, q, showDone, showOngoing, showPlanned]);


  // ====== UI actions ======
  const countsFor = (mid: string) => {
    let p = 0;
    let c = 0;

    // Normalisera så att "a3", "A3-medicinsk-vetenskap" osv blir samma nyckel
    const norm = (v: any) =>
      String(v ?? "")
        .trim()
        .split("-")[0]
        .toUpperCase()
        .replace(/\s|_/g, "");

    const midNorm = norm(mid);
    if (!midNorm) return { p, c };

    // Alias STa1 <-> A1, STb3 <-> B3, osv
    const aliases = new Set<string>([midNorm]);

    const m1 = midNorm.match(/^ST([ABC])(\d+)$/);
    if (m1) aliases.add(`${m1[1]}${m1[2]}`);

    const m2 = midNorm.match(/^([ABC])(\d+)$/);
    if (m2) aliases.add(`ST${m2[1]}${m2[2]}`);

    const matchKey = (v: any) => {
      const k = norm(v);
      return !!k && aliases.has(k);
    };

    // Kurser kan sakna startDate/endDate → använd certificateDate
    const courseStatus = (cr: any) => {
      const s = cr?.startDate;
      const e = cr?.endDate;
      if (s || e) return classifyActivity(s, e);

      const cert = cr?.certificateDate;
      if (!cert) return null;

      return cert < todayIso ? "done" : "planned";
    };

    const countedPlac = new Set<string>();
    const countedCourse = new Set<string>();

    // 1) Räknas via achievements
    for (const a of achAll as any[]) {
      const cand = [a.milestoneId, a.goalId, a.id, a.code, a.milestone];
      if (!cand.some(matchKey)) continue;

      if (a.placementId) {
        const pl = placements.find((p) => p.id === a.placementId);
        const st = classifyActivity(pl?.startDate, pl?.endDate);
        if (pl && statusAllowed(st) && !countedPlac.has(pl.id)) {
          countedPlac.add(pl.id);
          p += 1;
        }
      }

      if (a.courseId) {
        const cr = courses.find((c) => c.id === a.courseId);
        const st = courseStatus(cr);
        if (cr && statusAllowed(st) && !countedCourse.has(cr.id)) {
          countedCourse.add(cr.id);
          c += 1;
        }
      }
    }

    // 2) Direkt från placeringar (utan achievements)
    for (const pl of placements as any[]) {
      if (countedPlac.has(pl.id)) continue;
      const st = classifyActivity(pl?.startDate, pl?.endDate);
      if (!statusAllowed(st)) continue;

      const arrs = [pl.milestones, pl.goals, pl.goalIds, pl.milestoneIds];
      if (arrs.some((arr) => arr && arr.some(matchKey))) {
        countedPlac.add(pl.id);
        p += 1;
      }
    }

    // 3) Direkt från kurser (utan achievements)
    for (const cr of courses as any[]) {
      if (countedCourse.has(cr.id)) continue;
      const st = courseStatus(cr);
      if (!statusAllowed(st)) continue;

      const arrs = [cr.milestones, cr.goals, cr.goalIds, cr.milestoneIds];
      if (arrs.some((arr) => arr && arr.some(matchKey))) {
        countedCourse.add(cr.id);
        c += 1;
      }
    }

    return { p, c };
  };




  const openDetail = (id: string) => {
    setDetailId(id);
    const existing = planByMilestone[id] ?? "";
    setDetailPlanText(existing);
    setDetailDirty(false);
    setDetailSaving(false);
    setDetailSelectedSuggestions({});
  };

  const handleCloseDetail = () => {
    if (detailDirty) {
      const ok = window.confirm("Du har osparade ändringar. Vill du stänga utan att spara?");
      if (!ok) return;
    }
    setDetailId(null);
  };

  const savePlanForMilestone = async (mid: string, text: string) => {
    try {
      setDetailSaving(true);
      const anyDb = db as any;
      const table =
        anyDb.iupMilestonePlans ??
        anyDb.milestonePlans ??
        (typeof anyDb.table === "function" ? anyDb.table("iupMilestonePlans") : null);
      if (table && typeof table.put === "function") {
        const row: any = {
          id: `${(profile as any)?.id ?? "default"}::${mid}`,
          profileId: (profile as any)?.id ?? "default",
          milestoneId: mid,
          planText: text,
          updatedAt: new Date().toISOString(),
        };
        await table.put(row);
      }
      setPlanByMilestone((prev) => ({ ...prev, [mid]: text }));
      setDetailDirty(false);
    } finally {
      setDetailSaving(false);
    }
  };

  const handleSaveDetail = async (mid: string) => {
    await savePlanForMilestone(mid, detailPlanText);
  };



  function openList(kind: "intyg" | "klin" | "kurs", m: { id?: string; code?: string }) {
    const idOrCode = (m as any)?.id ?? (m as any)?.code ?? "";
    const isBt = /^BT\d+$/i.test(String(idOrCode));

    // --- Builders för listobjekt ---
    const buildItemsPlac = (arr: any[]) =>
      (arr
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
        .filter(Boolean) as { id: string; line1: string; line2?: string }[]);

    const buildItemsCourse = (arr: any[]) =>
      (arr
        .map((a) => {
          const r = courses.find((c) => c.id === a.courseId);
          if (!r) return null;
          return {
            id: (r as Course).id,
            line1: (r as any).title || (r as any).provider || "Kurs",
            line2: [(r as any).city, (r as any).certificateDate].filter(Boolean).join(" · "),
          };
        })
        .filter(Boolean) as { id: string; line1: string; line2?: string }[]);

    const buildItemsAll = (arr: any[]) => {
      const both = [
        ...buildItemsPlac(arr.filter((a) => a.placementId)),
        ...buildItemsCourse(arr.filter((a) => a.courseId)),
      ];
      return both;
    };

    // === BT: alltid "Intyg" (samlad lista), öppna även om tomt ===
    if (isBt) {
      const code = String(idOrCode).toUpperCase().replace(/\s|_|-/g, "");

      // Hjälpare: kolla om BT-kod finns i ett objekt (placement/kurs) i någon känd property
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
            const cand = String(v ?? "").toUpperCase().replace(/\s|_|-/g, "");
            if (cand === codeNorm) return true;
          }
        }
        return false;
      };

      const btPlacementStatus = (pl: any) =>
        classifyActivity(pl?.startDate, pl?.endDate);

      const btCourseStatus = (cr: any) => {
        const s = cr?.startDate;
        const e = cr?.endDate;
        if (s || e) return classifyActivity(s, e);

        const cert = cr?.certificateDate;
        if (!cert) return null;

        return cert < todayIso ? "done" : "planned";
      };

      // 1) Träffar via achievements (om sådana finns registrerade)
      const achMatches = (achAll as any[]).filter((a) => {
        const cand = [a.goalId, a.milestoneId, a.id, a.code, a.milestone].filter(Boolean);
        const hit = cand.some((c) =>
          String(c).toUpperCase().replace(/\s|_|-/g, "") === code
        );
        if (!hit) return false;

        if (a.placementId) {
          const pl = placements.find((p) => p.id === a.placementId);
          const st = btPlacementStatus(pl);
          return !!pl && statusAllowed(st);
        }

        if (a.courseId) {
          const cr = courses.find((c) => c.id === a.courseId);
          const st = btCourseStatus(cr);
          return !!cr && statusAllowed(st);
        }

        return false;
      });

      // 2) Träffar direkt på placeringar/kurser (om inget achievement skapats)
      const placMatches = (placements as any[])
        .filter((p) => objHasBtCode(p, code))
        .filter((p) => statusAllowed(btPlacementStatus(p)))
        .map((p) => ({ placementId: p.id }));
      const courseMatches = (courses as any[])
        .filter((c) => objHasBtCode(c, code))
        .filter((c) => statusAllowed(btCourseStatus(c)))
        .map((c) => ({ courseId: c.id }));


      // 3) Sammanfoga och deduplicera (kan annars bli dubbletter mellan achievements och direktskanning)
      const keyOf = (x: any) => (x.placementId ? `P:${x.placementId}` : `C:${x.courseId}`);
      const mergedMap = new Map<string, any>();
      [...achMatches, ...placMatches, ...courseMatches].forEach((x: any) => {
        const k = keyOf(x);
        if (!mergedMap.has(k)) mergedMap.set(k, x);
      });
      const merged = Array.from(mergedMap.values());

      // 4) Bygg list-items
      const items =
        merged.length > 0
          ? [
              ...buildItemsPlac(merged.filter((a: any) => a.placementId)),
              ...buildItemsCourse(merged.filter((a: any) => a.courseId)),
            ]
          : [];

      setListKind("intyg");
      setListTitle(`${code} – Utbildningsmoment`);
      setListItems(items);
      setListOpen(true);
      return;
    }

    // === ST: separera Klin / Kurs, med samma logik som countsFor ===
    const norm = (v: any) =>
      String(v ?? "")
        .trim()
        .split("-")[0]
        .toUpperCase()
        .replace(/\s|_/g, "");

    const idNorm = norm(idOrCode);
    const aliases = new Set<string>();
    if (idNorm) {
      aliases.add(idNorm);

      // STa1 ↔ A1 osv
      const m1 = idNorm.match(/^ST([ABC])(\d+)$/);
      if (m1) aliases.add(`${m1[1]}${m1[2]}`);
      const m2 = idNorm.match(/^([ABC])(\d+)$/);
      if (m2) aliases.add(`ST${m2[1]}${m2[2]}`);
    }

    const matchKey = (v: any) => {
      const k = norm(v);
      return !!k && aliases.has(k);
    };

    const courseStatus = (cr: any) => {
      if (!cr) return null;
      const s = cr.startDate;
      const e = cr.endDate;
      if (s || e) return classifyActivity(s, e);
      const cert = cr.certificateDate;
      if (!cert) return null;
      return cert < todayIso ? "done" : "planned";
    };

    const mFull =
      goals?.milestones.find((x) => {
        const idK = norm(x.id);
        const codeK = norm(x.code);
        return aliases.has(idK) || aliases.has(codeK);
      }) ?? ((m as any) as GoalsMilestone | undefined);



    const titleCode = String(((mFull as any)?.code ?? idOrCode) || "").toUpperCase();

    const seenPlac = new Set<string>();
    const seenCourse = new Set<string>();
    const placRefs: any[] = [];
    const courseRefs: any[] = [];

    // 1) Via achievements
    for (const a of achAll as any[]) {
      const cand = [a.milestoneId, a.goalId, a.id, a.code, a.milestone];
      if (!cand.some(matchKey)) continue;

      if (a.placementId) {
        const pl = placements.find((p) => p.id === a.placementId);
        const st = classifyActivity(pl?.startDate, pl?.endDate);
        if (!pl || !statusAllowed(st)) continue;
        if (!seenPlac.has(pl.id)) {
          seenPlac.add(pl.id);
          placRefs.push({ placementId: pl.id });
        }
      }

      if (a.courseId) {
        const cr = courses.find((c) => c.id === a.courseId);
        const st = courseStatus(cr);
        if (!cr || !statusAllowed(st)) continue;
        if (!seenCourse.has(cr.id)) {
          seenCourse.add(cr.id);
          courseRefs.push({ courseId: cr.id });
        }
      }

    }

    // 2) Direkt från placeringar (utan achievements), med datumfilter
    for (const pl of placements as any[]) {
      if (seenPlac.has(pl.id)) continue;
      const st = classifyActivity(pl?.startDate, pl?.endDate);
      if (!statusAllowed(st)) continue;

      const arrs = [pl.milestones, pl.goals, pl.goalIds, pl.milestoneIds];
      let hit = false;
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          if (matchKey(v)) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) {
        seenPlac.add(pl.id);
        placRefs.push({ placementId: pl.id });
      }
    }

    // 3) Direkt från kurser (utan achievements)
    for (const cr of courses as any[]) {
      if (seenCourse.has(cr.id)) continue;

      const arrs = [cr.milestones, cr.goals, cr.goalIds, cr.milestoneIds];
      let hit = false;
      for (const arr of arrs) {
        if (!arr) continue;
        for (const v of arr as any[]) {
          if (matchKey(v)) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (!hit) continue;

      const st = courseStatus(cr);
      if (!statusAllowed(st)) continue;

      seenCourse.add(cr.id);
      courseRefs.push({ courseId: cr.id });
    }



    if (kind === "klin") {
      setListKind("klin");
      setListTitle(`${titleCode} – Kliniska tjänstgöringar/Arbeten`);
      setListItems(placRefs.length > 0 ? buildItemsPlac(placRefs) : []);
      setListOpen(true);
      return;
    }

    if (kind === "kurs") {
      setListKind("kurs");
      setListTitle(`${titleCode} – Kurser`);
      setListItems(courseRefs.length > 0 ? buildItemsCourse(courseRefs) : []);
      setListOpen(true);
      return;
    }

    // Fallback om ST når "intyg" som kind av misstag
    setListKind(kind);
    setListTitle(`${titleCode} – Utbildningsaktiviteter`);
    setListItems(buildItemsAll([...placRefs, ...courseRefs]));
    setListOpen(true);
  }


  if (!open) return null;

  const hasAnySt = !!goals && (groups.A.length + groups.B.length + groups.C.length > 0);
  const hasAnyBt = is2021 && btMilestones.length > 0;

  // Use initialTab directly for BT check - this is the source of truth
  const isBtTab = initialTab === "bt";
  
  // Debug logging
  useEffect(() => {
    if (open) {
      console.log("[MilestoneOverviewPanel] open:", open, "tab:", tab, "initialTab:", initialTab, "isBtTab:", isBtTab);
    }
  }, [open, tab, initialTab, isBtTab]);

  return (
      <div className="w-full max-w-[980px] max-h-[85vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <header className={`border-b border-slate-200 px-5 py-4 flex items-center justify-between ${isBtTab ? "bg-sky-50" : "bg-emerald-50"}`}>
          <h2 className={`text-xl font-extrabold ${isBtTab ? "text-sky-900" : "text-emerald-900"}`}>
            {title ?? (isBtTab ? "BT-delmål" : "ST-delmål")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px shrink-0"
            title="Stäng"
          >
            ✕
          </button>
        </header>

        {/* Utbildningsaktiviteter - under header */}
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
          {!goals ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
              {profile ? 'Inga mål inlästa – välj målversion och specialitet under "Profil".' : "Laddar mål…"}
            </div>
          ) : initialTab === "bt" ? (
            // BT-delmål tab
            !is2021 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                BT-delmål är endast tillgängliga för målversion 2021.
                </div>
            ) : !hasAnyBt ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                Inga BT-delmål hittades i data ännu.
              </div>
            ) : (
              <BtList btRows={btRows} openDetail={openDetail} openList={openList} />
            )
          ) : is2021 ? (
            // ST-delmål tab for 2021
            !(hasAnySt) ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                Inga delmål matchar sökningen.
              </div>
            ) : (
              <StGrid groups={groups} countsFor={countsFor} openDetail={openDetail} openList={openList} />
            )
          ) : !hasAnySt ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
              Inga delmål matchar sökningen.
            </div>
          ) : (
            <StGrid groups={groups} countsFor={countsFor} openDetail={openDetail} openList={openList} />
          )}
        </section>


        {/* Detalj (ST) */}
        {detailId && !/^BT\d+$/i.test(String(detailId)) && goals && (() => {
          const mid = String(detailId);
          const midNorm = mid.toUpperCase().replace(/\s+/g, "");
          const isAb2015 = !is2021 && /^[AB]\d+$/i.test(midNorm);

          let base: GoalsMilestone | null = null;

          if (isAb2015) {
            // 2015: A- och B-delmål ska hämtas enbart från COMMON_AB_MILESTONES
            const commonByKey =
              (COMMON_AB_MILESTONES as any)[midNorm] ??
              (COMMON_AB_MILESTONES as any)[midNorm.toLowerCase()];
            if (commonByKey) {
              base = commonByKey as GoalsMilestone;
            } else {
              const commonByCode = Object.values(COMMON_AB_MILESTONES as any).find((cm: any) => {
                const codeRaw = String(cm?.code ?? cm?.id ?? "");
                const codeKey = codeRaw.toUpperCase().replace(/\s+/g, "");
                return codeKey === midNorm;
              }) as GoalsMilestone | undefined;
              if (commonByCode) {
                base = commonByCode;
              }
            }
          } else {
            // 1) Försök hitta i specialitetens egna mål
            base =
              (goals.milestones.find((m) => m.id === mid || m.code === mid) as GoalsMilestone | undefined) ??
              null;

            // 2) Om inte hittat (t.ex. gemensamma STa/STb) – försök i COMMON_AB_MILESTONES
            if (!base) {
              const commonByKey =
                (COMMON_AB_MILESTONES as any)[midNorm] ??
                (COMMON_AB_MILESTONES as any)[midNorm.toLowerCase()];
              if (commonByKey) {
                base = commonByKey as GoalsMilestone;
              } else {
                const commonByCode = Object.values(COMMON_AB_MILESTONES as any).find((cm: any) => {
                  const codeRaw = String(cm?.code ?? cm?.id ?? "");
                  const codeKey = codeRaw.toUpperCase().replace(/\s+/g, "");
                  return codeKey === midNorm;
                }) as GoalsMilestone | undefined;
                if (commonByCode) {
                  base = commonByCode;
                }
              }
            }
          }

          const m = mergeWithCommon(base);

          const suggestionItems: string[] = [

            "Klinisk tjänstgöring",
            "Auskultation",
            "Självständigt skriftligt arbete",
            "Kvalitets-/förbättringsarbete",
            "Kurs/er",
            "Handledning av studenter/AT/BT/underläkare",
            "Undervisning för studenter/AT/BT/underläkare",
            "Deltagande i reflektionsgrupp",
            "Journal Club",
            "Deltagande i kurs/kongress",
            "Återkoppling till kliniken efter kurs/kongress",
            "Leda och delta i APT",
            "Kontinuerlig uppföljning av huvudhandledare",
            "Mini Clinical Evaluation Exercise (Mini-CEX)",
            "Case-based discussion (CBD)",
            "Medsittning",
            "360-gradersbedömning",
            "ST-kollegium",
          ];

          const toggleSuggestion = (s: string) => {
            setDetailSelectedSuggestions((prev) => ({
              ...prev,
              [s]: !prev[s],
            }));
          };

          const addSelectedSuggestions = () => {
            const selected = suggestionItems.filter((s) => detailSelectedSuggestions[s]);
            if (!selected.length) return;
            const trimmed = detailPlanText.replace(/\s+$/g, "");
            const prefix = trimmed.length > 0 ? trimmed + "\n" : "";
            const next = prefix + selected.join("\n");
            setDetailPlanText(next);
            setDetailDirty(true);
            setDetailSelectedSuggestions({});
          };

          const initialTextForMid = planByMilestone[mid] ?? "";

          return (
            <div
              className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  handleCloseDetail();
                }
              }}
            >
              <div
                className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="flex items-center justify-between border-b border-slate-200 bg-emerald-50 px-5 py-4 gap-4">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 shrink-0">
                      {String((m as any)?.code ?? detailId).toLowerCase()}
                      </span>
                    <h3 className="text-base sm:text-lg font-extrabold text-emerald-900 break-words">
                      {String((m as any)?.title ?? "Delmål")}
                      </h3>
                  </div>

                    <button
                      type="button"
                      onClick={handleCloseDetail}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px"
                      title="Stäng"
                    >
                    ✕
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5">

                  {m ? (
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">

                      {/* Vänster: beskrivning från målfilen */}
                      <div className="space-y-4">
                        {typeof (m as any).description === "string" &&
                        (m as any).description.trim().length > 0 ? (
                          <p className="text-[14px] leading-relaxed text-slate-900">
                            {(m as any).description}
                          </p>
                        ) : null}

                        {Array.isArray((m as any).sections) && (m as any).sections.length > 0 ? (
                          <div className="space-y-4">
                            {(m as any).sections.map(
                              (sec: { title?: string; items?: any[]; text?: string }, idx: number) => (
                                <section key={idx}>
                                  {sec.title ? (
                                    <div className="mb-1 text-[13px] font-semibold text-slate-900">
                                      {sec.title}
                                    </div>
                                  ) : null}
                                  {Array.isArray(sec.items) ? (
                                    <ul className="list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-slate-900">
                                      {sec.items.map((it, i) => (
                                        <li key={i} className="text-slate-900">{typeof it === "string" ? it : String(it)}</li>
                                      ))}
                                    </ul>
                                  ) : sec.text ? (
                                    <p className="text-[14px] leading-relaxed text-slate-900">
                                      {sec.text}
                                    </p>
                                  ) : null}
                                </section>
                              )
                            )}
                          </div>
                        ) : !((m as any).description) ? (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                            Ingen beskrivning hittades i målfilen.
                          </div>
                        ) : null}
                      </div>

                      {/* Höger: plan + förslag */}
                      <div className="space-y-3">
                        <div>
                          <div className="mb-1 text-[13px] font-semibold text-slate-900">
                            Planerade metoder och bedömningsinstrument
                          </div>
                          <textarea
                            value={detailPlanText}
                            onChange={(e) => {
                              const value = e.target.value;
                              setDetailPlanText(value);
                              setDetailDirty(value !== initialTextForMid);
                            }}
                            className="w-full rounded-lg border border-slate-300 px-2 py-2 text-[13px] leading-relaxed text-slate-900 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            style={{ minHeight: 120, resize: "vertical" }}
                          />
                        </div>

                        <div className="flex h-full flex-col">
                          <div className="mb-1 text-[13px] font-semibold text-slate-900">
                            Förslag
                          </div>
                          <div className="max-h-[120px] flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">

                            <ul className="space-y-1.5 text-[13px] text-slate-900">
                              {suggestionItems.map((s) => (
                                <li key={s} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300"
                                    checked={!!detailSelectedSuggestions[s]}
                                    onChange={() => toggleSuggestion(s)}
                                  />
                                  <span className="leading-snug text-slate-900">{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={addSelectedSuggestions}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                            >
                              Lägg till markerade
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                      Information saknas för det valda delmålet.
                    </div>
                  )}
                </div>

                                {/* Åtgärdsknapparna är flyttade till headern */}

              </div>
            </div>
          );
        })()}



        {/* Detalj (BT) */}
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
                className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
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

        {/* Lista (Intyg/Klin/Kurs) – öppnas alltid, även om tom */}
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
                    {listKind === "intyg" && "Det finns ännu inget registrerat för detta delmål."}
                    {listKind === "klin" && "Det finns ännu inga registrerade kliniska placeringar för detta delmål."}
                    {listKind === "kurs" && "Det finns ännu inga registrerade kurser för detta delmål."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Popup: inget kopplat – (behålls om du vill visa separat varning på andra ställen) */}
        {notMetOpen && (
          <div
            className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-3"
            onClick={(e) => {
              if (e.target === e.currentTarget) setNotMetOpen(false);
            }}
          >
            <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <header className="flex items-center justify-between border-b px-4 py-3">
                <div className="text-[13px] font-semibold text-slate-900">Ingen data</div>
                <button
                  type="button"
                  onClick={() => setNotMetOpen(false)}
                  className="inline-flex h-[36px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                  title="Stäng"
                >
                  Stäng
                </button>
              </header>
              <div className="px-4 py-3 text-[13px] text-slate-700">
                Det finns inget att visa.
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

export default function MilestoneOverviewModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<"st" | "bt">("st");

  if (!open) return null;

  return (
    <div className="flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden">
      {/* Radio buttons for BT/ST selection */}
      <div className="flex items-center gap-4 border-b border-slate-200 bg-white px-5 py-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="milestone-tab"
            value="st"
            checked={tab === "st"}
            onChange={() => setTab("st")}
            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-semibold text-slate-900">ST-delmål</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="milestone-tab"
            value="bt"
            checked={tab === "bt"}
            onChange={() => setTab("bt")}
            className="h-4 w-4 text-sky-600 focus:ring-sky-500"
          />
          <span className="text-sm font-semibold text-slate-900">BT-delmål</span>
        </label>
        <div className="ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100 active:translate-y-px"
            title="Stäng"
          >
            ✕
          </button>
        </div>
      </div>

      <MilestoneOverviewPanel open={open} onClose={onClose} initialTab={tab} />
    </div>
  );
}



/* ==================== Delkomponenter ==================== */


function StGrid({
  groups,
  countsFor,
  openDetail,
  openList,
}: {
  groups: Record<"A" | "B" | "C", GoalsMilestone[]>;
  countsFor: (milestoneId: string) => { p: number; c: number };
  openDetail: (id: string) => void;
  openList: (kind: "klin" | "kurs", m: GoalsMilestone) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
      {/* Kolumn 1: Delmål A + B */}
      <section>
        <h3 className="mb-2 text-[12px] font-semibold text-slate-900">Delmål A</h3>
        <div className="mb-4 space-y-1.5">
          {groups.A.map((m) => {
            const { p, c } = countsFor(m.id);
            return (
              <article key={m.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDetail(m.id)}
                  className="dm-row flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                  title="Visa information om delmålet"
                >
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-900 shrink-0">
                    {(
                      (m.code ?? "").includes("-")
                        ? (m.code ?? "").split("-")[0]
                        : (m.code ?? "")
                    ).toLowerCase()}
                  </span>
                  <span className="truncate text-[12px] text-slate-900">
                    {m.title.length > 50 ? m.title.slice(0, 50) + "..." : m.title}
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Klin-piller */}
                  <button
                    type="button"
                    onClick={() => openList("klin", m)}
                    className={
                      p > 0
                        ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                        : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                    }
                    title={p > 0 ? "Visa kopplade kliniska placeringar" : "Inga kopplade kliniska placeringar"}
                  >
                    <span>Klin</span>
                    <span className="min-w-[1.2ch] text-right">{p}</span>
                  </button>

                  {/* Kurs-piller */}
                  <button
                    type="button"
                    onClick={() => openList("kurs", m)}
                    className={
                      c > 0
                        ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                        : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                    }
                    title={c > 0 ? "Visa kopplade kurser" : "Inga kopplade kurser"}
                  >
                    <span>Kurs</span>
                    <span className="min-w-[1.2ch] text-right">{c}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <h3 className="mb-2 text-[12px] font-semibold text-slate-900">Delmål B</h3>
        <div className="space-y-1.5">
          {groups.B.map((m) => {
            const { p, c } = countsFor(m.id);
            return (
              <article key={m.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDetail(m.id)}
                  className="dm-row flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                  title="Visa information om delmålet"
                >
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-900 shrink-0">
                    {(
                      (m.code ?? "").includes("-")
                        ? (m.code ?? "").split("-")[0]
                        : (m.code ?? "")
                    ).toLowerCase()}
                  </span>
                  <span className="truncate text-[12px] text-slate-900">
                    {m.title.length > 50 ? m.title.slice(0, 50) + "..." : m.title}
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Klin-piller */}
                  <button
                    type="button"
                    onClick={() => openList("klin", m)}
                    className={
                      p > 0
                        ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                        : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                    }
                    title={p > 0 ? "Visa kopplade kliniska placeringar" : "Inga kopplade kliniska placeringar"}
                  >
                    <span>Klin</span>
                    <span className="min-w-[1.2ch] text-right">{p}</span>
                  </button>

                  {/* Kurs-piller */}
                  <button
                    type="button"
                    onClick={() => openList("kurs", m)}
                    className={
                      c > 0
                        ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                        : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                    }
                    title={c > 0 ? "Visa kopplade kurser" : "Inga kopplade kurser"}
                  >
                    <span>Kurs</span>
                    <span className="min-w-[1.2ch] text-right">{c}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Kolumn 2: Delmål C */}
      <section>
        <h3 className="mb-2 text-[12px] font-semibold text-slate-900">Delmål C</h3>
        <div className="space-y-1.5">
          {groups.C.map((m) => {
            const { p, c } = countsFor(m.id);
            return (
              <article key={m.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDetail(m.id)}
                  className="dm-row flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                  title="Visa information om delmålet"
                >
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-900 shrink-0">
                    {(
                      (m.code ?? "").includes("-")
                        ? (m.code ?? "").split("-")[0]
                        : (m.code ?? "")
                    ).toLowerCase()}
                  </span>
                  <span className="truncate text-[12px] text-slate-900">
                    {m.title.length > 50 ? m.title.slice(0, 50) + "..." : m.title}
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Klin-piller */}
                  <button
                    type="button"
                    onClick={() => openList("klin", m)}
                    className={
                      p > 0
                        ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                        : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                    }
                    title={p > 0 ? "Visa kopplade kliniska placeringar" : "Inga kopplade kliniska placeringar"}
                  >
                    <span>Klin</span>
                    <span className="min-w-[1.2ch] text-right">{p}</span>
                  </button>

                  {/* Kurs-piller */}
                  <button
                    type="button"
                    onClick={() => openList("kurs", m)}
                    className={
                      c > 0
                        ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
                        : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
                    }
                    title={c > 0 ? "Visa kopplade kurser" : "Inga kopplade kurser"}
                  >
                    <span>Kurs</span>
                    <span className="min-w-[1.2ch] text-right">{c}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function BtList({
  btRows,
  openDetail,
  openList,
}: {
  btRows: { code: string; klinCount: number; kursCount: number }[];
  openDetail: (id: string) => void;
  openList: (kind: "intyg", m: { code: string }) => void;
}) {
  return (
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
                {(m?.title ?? "BT-delmål").length > 50 ? (m?.title ?? "BT-delmål").slice(0, 50) + "..." : (m?.title ?? "BT-delmål")}
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
    </div>
  );
}

// components/MilestoneOverviewModal.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { usePlacements, useCourses, useAchievements } from "@/lib/hooks/useSupabaseData";
import type { Profile, Achievement, Placement, Course } from "@/lib/types";
import { loadGoals, type GoalsCatalog, type GoalsMilestone } from "@/lib/goals";
import { btMilestones, type BtMilestone } from "@/lib/goals-bt";
import { COMMON_AB_MILESTONES } from "@/lib/goals-common";
import { milestoneRequires } from "@/lib/milestoneRequirements";
import { displayMilestoneCode } from "@/lib/milestoneDisplay";
import { registerModal, unregisterModal } from "@/lib/modalEscHandler";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import { normalizeSupabaseData } from "@/components/milestoneOverview/dataNormalization";
import {
  buildBtRows,
  countMilestoneActivities,
} from "@/components/milestoneOverview/activityMetrics";
import {
  buildMilestoneListPayload,
  type MilestoneListItem,
  type MilestoneListKind,
} from "@/components/milestoneOverview/listDomain";
import { useMilestoneDetailState } from "@/components/milestoneOverview/useMilestoneDetailState";
import { StMilestoneDetailModal } from "@/components/milestoneOverview/StMilestoneDetailModal";

const IUP_GOAL_SUGGESTIONS_CONFIG_TITLE = "__config__:iup-goal-suggestions";
const IUP_GOAL_SUGGESTIONS_CONFIG_PREFIX = "__iup_goal_suggestions_config_json__:";
const DEFAULT_MILESTONE_SUGGESTIONS: string[] = [
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

function parseIupGoalSuggestionsConfig(rows: string[]): { byMilestone: Record<string, string[]>; optionPool: string[] } | null {
  for (const raw of rows || []) {
    const value = String(raw || "").trim();
    if (!value.startsWith(IUP_GOAL_SUGGESTIONS_CONFIG_PREFIX)) continue;
    try {
      const parsed = JSON.parse(value.slice(IUP_GOAL_SUGGESTIONS_CONFIG_PREFIX.length));
      const byMilestoneSource = parsed?.byMilestone;
      const byMilestone: Record<string, string[]> = {};
      if (byMilestoneSource && typeof byMilestoneSource === "object" && !Array.isArray(byMilestoneSource)) {
        for (const [k, arr] of Object.entries(byMilestoneSource as Record<string, unknown>)) {
          const key = String(k || "").trim().toUpperCase();
          if (!key || !Array.isArray(arr)) continue;
          byMilestone[key] = Array.from(new Set(arr.map((x) => String(x || "").trim()).filter(Boolean)));
        }
      }
      const optionPool: string[] = Array.isArray(parsed?.optionPool)
        ? Array.from(
            new Set(parsed.optionPool.map((x: unknown) => String(x || "").trim()).filter(Boolean))
          ) as string[]
        : [];
      return { byMilestone, optionPool };
    } catch {
      return null;
    }
  }
  return null;
}

function mergePlanTextWithSuggestions(planText: string, suggestions: string[]): string {
  const planLines = String(planText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const suggestionLines = (suggestions || []).map((s) => String(s || "").trim()).filter(Boolean);
  const merged = Array.from(new Set([...planLines, ...suggestionLines]));
  return merged.join("\n");
}


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

type Props = { 
  open: boolean; 
  onClose: () => void; 
  initialTab: "st" | "bt"; 
  title?: string;
  hideHeader?: boolean; // Hide the colored header (for laptop version)
  embedded?: boolean;
  onDirtyChange?: (dirty: boolean) => void; // Callback när planeringen ändras
};
type TabKey = "st" | "bt";

/** Panel för delmål – kan ligga i egen modal eller inuti IUP-fliken */
export function MilestoneOverviewPanel({ open, onClose, initialTab, title, hideHeader, embedded, onDirtyChange }: Props) {
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

  const { placements: placementsRaw } = usePlacements();
  const { courses: coursesRaw } = useCourses();
  const { achievements: achievementsRaw } = useAchievements();

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeSupabaseData({
      placementsRaw,
      coursesRaw,
      achievementsRaw,
    });
    setPlacements(normalized.placements);
    setCourses(normalized.courses);
    setAchAll(normalized.achievements);
  }, [open, placementsRaw, coursesRaw, achievementsRaw]);

  const [planByMilestone, setPlanByMilestone] = useState<Record<string, string>>({});
  const [planDatesByMilestone, setPlanDatesByMilestone] = useState<Record<string, string>>({});
  const [srGoalSuggestionsByMilestone, setSrGoalSuggestionsByMilestone] = useState<Record<string, string[]>>({});
  const [srGoalSuggestionPool, setSrGoalSuggestionPool] = useState<string[]>(DEFAULT_MILESTONE_SUGGESTIONS);

  // Lista (Klin/Kurs/Intyg)
  const [listOpen, setListOpen] = useState(false);

  const [listTitle, setListTitle] = useState("");
  const [listItems, setListItems] = useState<MilestoneListItem[]>([]);
  const [listKind, setListKind] = useState<MilestoneListKind>("intyg");

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
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      // Ladda profil från Supabase
      let p: Profile | null = null;
      let authUserId = "";
      try {
        const { data: { user } } = await supabase.auth.getUser();
        authUserId = String(user?.id || "");
        if (user?.id) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
          if (profileData) {
            p = {
              id: profileData.id,
              name: profileData.name || "",
              specialty: profileData.specialty || "",
              goalsVersion: profileData.goals_version || "2021",
              btStartDate: profileData.bt_start_date || "",
              btEndDate: profileData.bt_end_date || "",
              stStartDate: profileData.st_start_date || "",
              stTotalMonths: profileData.st_total_months ?? 66,
            } as Profile;
          }
        }
      } catch (err) {
        console.error("[MilestoneOverviewPanel] Failed to load profile:", err);
      }
      setProfile(p ?? null);

      // Ladda studierektorns valda delmålsförslag för kliniken.
      if (authUserId) {
        try {
          const { data: membershipRows } = await supabase
            .from("clinic_memberships")
            .select("clinic_id")
            .eq("user_id", authUserId)
            .limit(1);
          const clinicId = Array.isArray(membershipRows) && membershipRows[0]?.clinic_id
            ? String(membershipRows[0].clinic_id)
            : "";
          if (clinicId) {
            const { data: cfgRows } = await supabase
              .from("clinic_activity_templates")
              .select("suggested_rows")
              .eq("clinic_id", clinicId)
              .eq("title", IUP_GOAL_SUGGESTIONS_CONFIG_TITLE)
              .order("updated_at", { ascending: false })
              .limit(1);
            const cfg = Array.isArray(cfgRows) ? cfgRows[0] : null;
            const parsed = parseIupGoalSuggestionsConfig(
              Array.isArray((cfg as any)?.suggested_rows) ? (cfg as any).suggested_rows : []
            );
            if (parsed) {
              setSrGoalSuggestionsByMilestone(parsed.byMilestone || {});
              const mergedPool = Array.from(
                new Set([...(parsed.optionPool || []), ...DEFAULT_MILESTONE_SUGGESTIONS])
              );
              setSrGoalSuggestionPool(mergedPool.length > 0 ? mergedPool : DEFAULT_MILESTONE_SUGGESTIONS);
            } else {
              setSrGoalSuggestionsByMilestone({});
              setSrGoalSuggestionPool(DEFAULT_MILESTONE_SUGGESTIONS);
            }
          }
        } catch {
          setSrGoalSuggestionsByMilestone({});
          setSrGoalSuggestionPool(DEFAULT_MILESTONE_SUGGESTIONS);
        }
      }

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

      // Data laddas nu via hooks istället för direkt här
      // setAchAll, setPlacements, setCourses anropas i separat useEffect

      // Ladda milestone plans från Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: rows } = await supabase
            .from("milestone_plans")
            .select("*")
            .eq("user_id", user.id);
          const map: Record<string, string> = {};
          const dateMap: Record<string, string> = {};
          for (const row of (rows || []) as any[]) {
            const mid = String(row.milestone_id ?? "");
            if (!mid) continue;
            map[mid] = String(row.plan_text ?? "");
            const updatedAt = String(row.updated_at ?? "");
            if (updatedAt) {
              dateMap[mid] = updatedAt;
            }
          }
          setPlanByMilestone(map);
          setPlanDatesByMilestone(dateMap);
        } else {
          setPlanByMilestone({});
          setPlanDatesByMilestone({});
        }
      } catch {
        setPlanByMilestone({});
        setPlanDatesByMilestone({});
      }

      setTab("st");
      setQ("");
      setDetailId(null);
      setDetailPlanText("");
      setDetailDirty(false);
      setDetailSelectedSuggestions({});
      setListOpen(false);
      setNotMetOpen(false);
      setListTitle("");
      setListItems([]);
      setListKind("intyg");
    })();
  }, [open]);
  
  const getConfiguredSuggestionsForMilestone = useCallback(
    (milestoneId: string): string[] => {
      const key = String(milestoneId || "").trim();
      if (!key) return [];
      const toKey = (v: unknown) => String(v || "").trim().toUpperCase().replace(/\s+/g, "");
      const toGrouped = (v: unknown) => toKey(v).replace(/^ST(?=[ABC]\d+)/, "");

      const candidates = new Set<string>();
      candidates.add(toKey(key));
      candidates.add(toGrouped(key));

      const goalMatch = (Array.isArray(goals?.milestones) ? goals!.milestones : []).find(
        (m: any) => String(m?.id || "") === key || String(m?.code || "") === key
      );
      if (goalMatch) {
        candidates.add(toKey((goalMatch as any)?.id));
        candidates.add(toKey((goalMatch as any)?.code));
        candidates.add(toGrouped((goalMatch as any)?.id));
        candidates.add(toGrouped((goalMatch as any)?.code));
      }

      const out: string[] = [];
      for (const [rawKey, values] of Object.entries(srGoalSuggestionsByMilestone || {})) {
        const sourceExact = toKey(rawKey);
        const sourceGrouped = toGrouped(rawKey);
        if (!candidates.has(sourceExact) && !candidates.has(sourceGrouped)) continue;
        for (const v of Array.isArray(values) ? values : []) {
          const txt = String(v || "").trim();
          if (txt && !out.includes(txt)) out.push(txt);
        }
      }
      return out;
    },
    [goals, srGoalSuggestionsByMilestone]
  );

  const {
    detailId,
    setDetailId,
    detailPlanText,
    setDetailPlanText,
    detailDirty,
    setDetailDirty,
    detailSaving,
    showCloseConfirm,
    detailSelectedSuggestions,
    setDetailSelectedSuggestions,
    openDetail,
    handleRequestCloseDetail,
    handleConfirmCloseDetail,
    handleSaveAndCloseDetail,
    handleCancelCloseDetail,
    handleSaveDetail,
    toggleSuggestion,
    addSelectedSuggestions,
  } = useMilestoneDetailState({
    planByMilestone,
    setPlanByMilestone,
    setPlanDatesByMilestone,
    getConfiguredSuggestionsForMilestone,
    mergePlanTextWithSuggestions,
    onDirtyChange,
  });

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
  const todayIso = new Date().toISOString().slice(0, 10);

  const btRows = useMemo(
    () =>
      buildBtRows({
        achievements: achAll,
        placements,
        courses,
        query: q,
        todayIso,
        showDone,
        showOngoing,
        showPlanned,
      }),
    [achAll, placements, courses, q, todayIso, showDone, showOngoing, showPlanned]
  );

  // ====== UI actions ======
  const countsFor = useCallback(
    (mid: string) =>
      countMilestoneActivities({
        mid,
        achievements: achAll,
        placements,
        courses,
        todayIso,
        showDone,
        showOngoing,
        showPlanned,
      }),
    [achAll, placements, courses, todayIso, showDone, showOngoing, showPlanned]
  );
  // Registrera detaljvyn för planering i modalRegistry när den öppnas
  const detailOverlayRef = useRef<HTMLDivElement | null>(null);
  const handleCloseBtDetail = useCallback(() => {
    setDetailId(null);
  }, [setDetailId]);
  
  useEffect(() => {
    if (!detailId || !detailOverlayRef.current) {
      // Avregistrera om detaljvyn stängs
      if (detailOverlayRef.current) {
        unregisterModal(detailOverlayRef.current);
        detailOverlayRef.current = null;
      }
      return;
    }
    // Registrera detaljvyn när den öppnas
    const element = detailOverlayRef.current;
    // Använd rätt close-handler beroende på om det är ST eller BT
    const isBt = /^BT\d+$/i.test(String(detailId));
    const closeHandler = isBt ? handleCloseBtDetail : handleRequestCloseDetail;
    registerModal(element, closeHandler);
    return () => {
      unregisterModal(element);
    };
  }, [detailId, handleRequestCloseDetail, handleCloseBtDetail]);

  function openList(kind: MilestoneListKind, m: { id?: string; code?: string }) {
    const payload = buildMilestoneListPayload({
      kind,
      milestone: m,
      goals,
      goalsVersion: (profile as any)?.goalsVersion,
      achievements: achAll,
      placements,
      courses,
      todayIso,
      showDone,
      showOngoing,
      showPlanned,
    });
    setListKind(payload.kind);
    setListTitle(payload.title);
    setListItems(payload.items);
    setListOpen(true);
  }


  if (!open) return null;

  const hasAnySt = !!goals && (groups.A.length + groups.B.length + groups.C.length > 0);
  const hasAnyBt = is2021 && btMilestones.length > 0;

  // Use tab state for BT check - this reflects the current selection
  const isBtTab = tab === "bt";

  return (
    <>
      <UnsavedChangesDialog
        open={showCloseConfirm}
        title="Osparade ändringar"
        message="Du har osparade ändringar i planeringen för detta delmål. Vill du stänga utan att spara?"
        onCancel={handleCancelCloseDetail}
        onDiscard={handleConfirmCloseDetail}
        onSaveAndClose={handleSaveAndCloseDetail}
      />
      <div className={embedded ? "w-full max-w-[980px] rounded-2xl bg-white shadow-2xl flex flex-col" : "w-full max-w-[980px] max-h-[85vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden"}>

          {/* Header - only show if not hidden (for laptop version) */}
          {!hideHeader && (
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
          )}

        {/* Utbildningsaktiviteter - på samma rad som ST-delmål/BT-delmål knapparna */}
        <div className="px-5 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Vänster: Radioknappar för ST-delmål/BT-delmål (endast för 2021) */}
            {is2021 && (
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer" data-info="Växlar till vyn för ST-delmål (specialiseringstjänstgöring) där du kan se alla ST-delmål, planera hur de ska uppfyllas och se vilka aktiviteter som är kopplade till varje delmål.">
                  <input
                    type="radio"
                    name="milestone-tab"
                    value="st"
                    checked={tab === "st"}
                    onChange={() => setTab("st")}
                    className="h-4 w-4.5 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-900">ST-delmål</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer" data-info="Växlar till vyn för BT-delmål (bastjänstgöring) där du kan se alla BT-delmål, planera hur de ska uppfyllas och se vilka aktiviteter som är kopplade till varje delmål.">
                  <input
                    type="radio"
                    name="milestone-tab"
                    value="bt"
                    checked={tab === "bt"}
                    onChange={() => setTab("bt")}
                    className="h-4 w-4.5 border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-sm font-medium text-slate-900">BT-delmål</span>
                </label>
              </div>
            )}
            
            {/* Höger: Utbildningsaktiviteter med kryssrutor på samma rad */}
            <div 
              className="flex items-center gap-3 flex-wrap"
              data-info="Här kan du filtrera vilka utbildningsaktiviteter som ska visas för varje delmål. Genomförda aktiviteter är aktiviteter som har ett slutdatum som ligger i det förflutna. Pågående aktiviteter är aktiviteter som har startat men inte avslutats ännu. Planerade aktiviteter är aktiviteter med ett startdatum i framtiden. Du kan välja en eller flera av dessa alternativ för att visa relevanta aktiviteter för varje delmål. Aktiviteterna kan vara kliniska tjänstgöringar, kurser eller andra utbildningsmoment som är kopplade till delmålen."
            >
              <span className="text-[13px] font-semibold text-slate-900">
                Utbildningsaktiviteter:
              </span>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-[13px] text-slate-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 border-slate-400 text-sky-600 focus:ring-sky-300"
                    checked={showDone}
                    onChange={() => setShowDone((v) => !v)}
                    data-info="Visa genomförda utbildningsaktiviteter. Dessa är aktiviteter (kliniska tjänstgöringar eller kurser) som har ett slutdatum som ligger i det förflutna och som är kopplade till delmålen."
                  />
                  <span data-info="Visa genomförda utbildningsaktiviteter. Dessa är aktiviteter (kliniska tjänstgöringar eller kurser) som har ett slutdatum som ligger i det förflutna och som är kopplade till delmålen.">Genomförda</span>
                </label>
                <label className="inline-flex items-center gap-2 text-[13px] text-slate-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 border-slate-400 text-sky-600 focus:ring-sky-300"
                    checked={showOngoing}
                    onChange={() => setShowOngoing((v) => !v)}
                    data-info="Visa pågående utbildningsaktiviteter. Dessa är aktiviteter som har startat men inte avslutats ännu, dvs. de har ett startdatum i det förflutna men inget slutdatum eller ett slutdatum i framtiden."
                  />
                  <span data-info="Visa pågående utbildningsaktiviteter. Dessa är aktiviteter som har startat men inte avslutats ännu, dvs. de har ett startdatum i det förflutna men inget slutdatum eller ett slutdatum i framtiden.">Pågående</span>
                </label>
                <label className="inline-flex items-center gap-2 text-[13px] text-slate-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4 border-slate-400 text-sky-600 focus:ring-sky-300"
                    checked={showPlanned}
                    onChange={() => setShowPlanned((v) => !v)}
                    data-info="Visa planerade utbildningsaktiviteter. Dessa är aktiviteter med ett startdatum i framtiden som är kopplade till delmålen och som planeras att genomföras."
                  />
                  <span data-info="Visa planerade utbildningsaktiviteter. Dessa är aktiviteter med ett startdatum i framtiden som är kopplade till delmålen och som planeras att genomföras.">Planerade</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <section
          className={
            embedded
              ? "flex-1 p-5 overscroll-contain touch-pan-y"
              : "flex-1 overflow-y-auto p-5 overscroll-contain touch-pan-y"
          }
        >
          {!goals ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
              {profile ? 'Inga mål inlästa – välj målversion och specialitet under "Profil".' : "Laddar mål…"}
            </div>
          ) : tab === "bt" ? (
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
          ) : (
            // ST-delmål tab (default)
            !(hasAnySt) ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                Inga delmål matchar sökningen.
              </div>
            ) : (
              <StGrid 
                groups={groups} 
                countsFor={countsFor} 
                openDetail={openDetail} 
                openList={openList}
                planByMilestone={planByMilestone}
                planDatesByMilestone={planDatesByMilestone}
                goalsVersion={(profile as any)?.goalsVersion}
              />
            )
          )}
        </section>


        {/* Detalj (ST) */}
        {detailId && !/^BT\d+$/i.test(String(detailId)) && goals && (
          <StMilestoneDetailModal
            detailId={detailId}
            is2021={is2021}
            goals={goals}
            goalsVersion={(profile as any)?.goalsVersion}
            planByMilestone={planByMilestone}
            srGoalSuggestionsByMilestone={srGoalSuggestionsByMilestone}
            srGoalSuggestionPool={srGoalSuggestionPool}
            defaultSuggestions={DEFAULT_MILESTONE_SUGGESTIONS}
            detailPlanText={detailPlanText}
            detailDirty={detailDirty}
            detailSaving={detailSaving}
            detailSelectedSuggestions={detailSelectedSuggestions}
            setDetailPlanText={setDetailPlanText}
            setDetailDirty={setDetailDirty}
            handleRequestCloseDetail={handleRequestCloseDetail}
            handleSaveDetail={handleSaveDetail}
            toggleSuggestion={toggleSuggestion}
            addSelectedSuggestions={addSelectedSuggestions}
            mergePlanTextWithSuggestions={mergePlanTextWithSuggestions}
            overlayRef={detailOverlayRef}
          />
        )}



        {/* Detalj (BT) */}
        {detailId && /^BT\d+$/i.test(String(detailId)) && (() => {
          const id = String(detailId).toUpperCase();
          const m = btMilestones.find((x) => x.id === id) as BtMilestone | undefined;
          return (
            <div
              ref={detailOverlayRef}
              className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  // BT-delmål har inga ändringar, så vi kan stänga direkt
                  handleCloseBtDetail();
                }
              }}
            >
              <div
                className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 gap-4">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 shrink-0">
                      {id.toLowerCase()}
                    </span>
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
                      {m?.title ?? "BT-delmål"}
                    </h3>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-5 py-5">
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

                {/* Footer med Stäng (BT har ingen plan-text, så bara Stäng) */}
                <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
                  <button
                    type="button"
                    onClick={() => setDetailId(null)}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
                  >
                    Stäng
                  </button>
                </footer>
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
              <div className="max-h-[60vh] overflow-auto overscroll-contain touch-pan-y px-4 py-3">
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
                    {listKind === "klin" && "Det finns ännu inga registrerade kliniska tjänstgöringar för detta delmål."}
                    {listKind === "kurs" && "Det finns ännu inga registrerade kurser för detta delmål."}
                    {listKind === "arb" && "Det finns ännu inga registrerade arbeten för detta delmål."}
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
        </>
      );
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function MilestoneOverviewModal({ open, onClose }: ModalProps) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const p = null;
      setProfile(p ?? null);
    })();
  }, [open]);

  const is2021 = (profile?.goalsVersion ?? "") === "2021";

  // Beräkna default-tab baserat på om idag är mellan BT-start och BT-slut
  const defaultTab = useMemo<"st" | "bt">(() => {
    if (!is2021) return "st";
    
    const btStart = (profile as any)?.btStartDate;
    if (!btStart || !/^\d{4}-\d{2}-\d{2}$/.test(btStart)) return "st";
    
    // Beräkna BT-slut: manuellt satt eller 24 månader efter BT-start
    const btEndManual = (profile as any)?.btEndDate;
    let btEnd: string;
    if (btEndManual && /^\d{4}-\d{2}-\d{2}$/.test(btEndManual)) {
      btEnd = btEndManual;
    } else {
      try {
        const btDate = new Date(btStart + "T00:00:00");
        btDate.setMonth(btDate.getMonth() + 24);
        const mm = String(btDate.getMonth() + 1).padStart(2, "0");
        const dd = String(btDate.getDate()).padStart(2, "0");
        btEnd = `${btDate.getFullYear()}-${mm}-${dd}`;
      } catch {
        return "st";
      }
    }
    
    // Jämför idag med BT-period
    const today = new Date().toISOString().slice(0, 10);
    if (today >= btStart && today <= btEnd) {
      return "bt";
    }
    
    return "st";
  }, [is2021, profile]);

  if (!open) return null;

  return (
    <div className="flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden">
      <MilestoneOverviewPanel open={open} onClose={onClose} initialTab={defaultTab} hideHeader={true} />
    </div>
  );
}



/* ==================== Delkomponenter ==================== */


function StGrid({
  groups,
  countsFor,
  openDetail,
  openList,
  planByMilestone,
  planDatesByMilestone,
  goalsVersion,
}: {
  groups: Record<"A" | "B" | "C", GoalsMilestone[]>;
  countsFor: (milestoneId: string) => { klin: number; kurs: number; arb: number };
  openDetail: (id: string) => void;
  openList: (kind: "klin" | "kurs" | "arb", m: GoalsMilestone) => void;
  planByMilestone: Record<string, string>;
  planDatesByMilestone: Record<string, string>;
  goalsVersion?: unknown;
}) {
  
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };
  
  const getPlanningStatus = (milestoneId: string) => {
    const planText = planByMilestone[milestoneId] ?? "";
    const hasPlan = planText.trim().length > 0;
    
    if (!hasPlan) {
      return { text: "Inväntar planering", color: "text-red-600", italic: true };
    }
    
    const dateStr = planDatesByMilestone[milestoneId];
    if (dateStr) {
      const formattedDate = formatDate(dateStr);
      return { text: `Planering uppdaterad: ${formattedDate}`, color: "text-slate-900", italic: true };
    }
    
    return { text: "Planering uppdaterad", color: "text-slate-900", italic: true };
  };

  const renderCountBadge = (
    kind: "klin" | "kurs" | "arb",
    label: "Klin" | "Kurs" | "Arb",
    count: number,
    enabled: boolean,
    m: GoalsMilestone,
    info: string,
    titleWhenHas: string,
    titleWhenEmpty: string
  ) => {
    if (!enabled) {
      return (
        <span
          aria-hidden="true"
          className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-[10px] font-normal opacity-0 select-none"
        >
          <span>{label}</span>
          <span className="min-w-[1.2ch] text-right">0</span>
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => openList(kind, m)}
        className={
          count > 0
            ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-normal text-slate-900 hover:bg-emerald-100 hover:border-emerald-300"
            : "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-slate-100 px-2.5 py-1 text-[10px] font-normal text-slate-700 hover:bg-slate-200"
        }
        title={count > 0 ? titleWhenHas : titleWhenEmpty}
        data-info={info}
      >
        <span>{label}</span>
        <span className="min-w-[1.2ch] text-right">{count}</span>
      </button>
    );
  };

  const renderMilestoneCountBadges = (
    m: GoalsMilestone,
    req: ReturnType<typeof milestoneRequires>,
    klin: number,
    kurs: number,
    arb: number
  ) => {
    const hasArbColumn = !!req.arb;
    return (
      <div
        className={
          hasArbColumn
            ? "grid grid-cols-3 gap-1.5 min-w-[172px] justify-items-end"
            : "grid grid-cols-2 gap-1.5 min-w-[112px] justify-items-end"
        }
      >
        {hasArbColumn &&
          renderCountBadge(
            "arb",
            "Arb",
            arb,
            !!req.arb,
            m,
            "Visar antalet arbeten (t.ex. förbättringsarbete eller vetenskapligt arbete) som är kopplade till detta delmål. Klicka för att se en lista över alla kopplade arbeten.",
            "Visa kopplade arbeten",
            "Inga kopplade arbeten"
          )}

        {renderCountBadge(
          "klin",
          "Klin",
          klin,
          !!req.klin,
          m,
          "Visar antalet kliniska tjänstgöringar som är kopplade till detta delmål. Klicka för att se en lista över alla kopplade aktiviteter med deras perioder och detaljer.",
          "Visa kopplade kliniska tjänstgöringar",
          "Inga kopplade kliniska tjänstgöringar"
        )}

        {renderCountBadge(
          "kurs",
          "Kurs",
          kurs,
          !!req.kurs,
          m,
          "Visar antalet kurser som är kopplade till detta delmål. Klicka för att se en lista över alla kopplade kurser med deras perioder och detaljer. Dessa är kurser från tidslinjen som har markerats som relevanta för att uppfylla delmålet.",
          "Visa kopplade kurser",
          "Inga kopplade kurser"
        )}
      </div>
    );
  };
  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Kolumn 1: Delmål A + B */}
      <section>
        <h3 className="mb-2 text-[12px] font-semibold text-slate-900">Delmål A</h3>
        <div className="mb-4 space-y-1.5">
          {groups.A.map((m) => {
            const { klin, kurs, arb } = countsFor(m.id);
            const status = getPlanningStatus(m.id);
            const req = milestoneRequires(m);
            return (
              <article key={m.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDetail(m.id)}
                  className="dm-row flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                  title="Visa information om delmålet"
                  data-info="Öppnar en detaljvy för detta delmål där du kan planera hur delmålet ska uppfyllas enligt din IUP. Du kan ange vilka aktiviteter, kurser och metoder som ska användas för att uppfylla delmålet, samt ange planerade datum. Planeringen sparas och kan användas i rapporter."
                >
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-900 shrink-0">
                    {(() => {
                      const code = (m.code ?? "").includes("-")
                        ? (m.code ?? "").split("-")[0]
                        : (m.code ?? "");
                      return displayMilestoneCode(code, goalsVersion);
                    })()}
                  </span>
                  <span className="truncate text-[12px] text-slate-900 flex-1">
                    {m.title.length > 50 ? m.title.slice(0, 50) + "..." : m.title}
                  </span>
                  {/* Planeringsstatus - inuti knappen längst till höger */}
                  <span className={`text-[11px] ${status.color} ${status.italic ? "italic" : ""} shrink-0 ml-auto`}>
                    {status.text}
                  </span>
                </button>

                {renderMilestoneCountBadges(m, req, klin, kurs, arb)}
              </article>
            );
          })}
        </div>

        <h3 className="mb-2 text-[12px] font-semibold text-slate-900">Delmål B</h3>
        <div className="space-y-1.5">
          {groups.B.map((m) => {
            const { klin, kurs, arb } = countsFor(m.id);
            const status = getPlanningStatus(m.id);
            const req = milestoneRequires(m);
            return (
              <article key={m.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDetail(m.id)}
                  className="dm-row flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                  title="Visa information om delmålet"
                  data-info="Öppnar en detaljvy för detta delmål där du kan planera hur delmålet ska uppfyllas enligt din IUP. Du kan ange vilka aktiviteter, kurser och metoder som ska användas för att uppfylla delmålet, samt ange planerade datum. Planeringen sparas och kan användas i rapporter."
                >
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-900 shrink-0">
                    {(() => {
                      const code = (m.code ?? "").includes("-")
                        ? (m.code ?? "").split("-")[0]
                        : (m.code ?? "");
                      return displayMilestoneCode(code, goalsVersion);
                    })()}
                  </span>
                  <span className="truncate text-[12px] text-slate-900 flex-1">
                    {m.title.length > 50 ? m.title.slice(0, 50) + "..." : m.title}
                  </span>
                  {/* Planeringsstatus - inuti knappen längst till höger */}
                  <span className={`text-[11px] ${status.color} ${status.italic ? "italic" : ""} shrink-0 ml-auto`}>
                    {status.text}
                  </span>
                </button>

                {renderMilestoneCountBadges(m, req, klin, kurs, arb)}
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
            const { klin, kurs, arb } = countsFor(m.id);
            const status = getPlanningStatus(m.id);
            const req = milestoneRequires(m);
            return (
              <article key={m.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDetail(m.id)}
                  className="dm-row flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-slate-900 hover:bg-slate-100"
                  title="Visa information om delmålet"
                  data-info="Öppnar en detaljvy för detta delmål där du kan planera hur delmålet ska uppfyllas enligt din IUP. Du kan ange vilka aktiviteter, kurser och metoder som ska användas för att uppfylla delmålet, samt ange planerade datum. Planeringen sparas och kan användas i rapporter."
                >
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-900 shrink-0">
                    {(() => {
                      const code = (m.code ?? "").includes("-")
                        ? (m.code ?? "").split("-")[0]
                        : (m.code ?? "");
                      return displayMilestoneCode(code, goalsVersion);
                    })()}
                  </span>
                  <span className="truncate text-[12px] text-slate-900 flex-1">
                    {m.title.length > 50 ? m.title.slice(0, 50) + "..." : m.title}
                  </span>
                  {/* Planeringsstatus - inuti knappen längst till höger */}
                  <span className={`text-[11px] ${status.color} ${status.italic ? "italic" : ""} shrink-0 ml-auto`}>
                    {status.text}
                  </span>
                </button>

                {renderMilestoneCountBadges(m, req, klin, kurs, arb)}
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
    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
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
              data-info="Öppnar en detaljvy för detta BT-delmål där du kan planera hur delmålet ska uppfyllas enligt din IUP. Du kan ange vilka aktiviteter, kurser och metoder som ska användas för att uppfylla delmålet, samt ange planerade datum. Planeringen sparas och kan användas i rapporter."
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
                data-info="Visar antalet intyg som är kopplade till detta BT-delmål. Klicka för att se en lista över alla kopplade intyg. Dessa är intyg som har skapats för att bekräfta att delmålet har uppfyllts."
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

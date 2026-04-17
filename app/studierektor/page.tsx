// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadGoals, type GoalsCatalog } from "@/lib/goals";
import {
  type SupervisorStudent,
} from "@/lib/mappers/studentData";
import {
  addStCompleteDeclined,
  loadStCompleteDeclinedIds,
} from "@/lib/studierektor/stCompleteDeclined";
import {
  type ProgressionPeriodMode,
  type ProgressionScopeMode,
} from "@/lib/studierektor/progression";
import {
  formatDate,
  fteDaysBetween,
  isValidISODate,
  isZeroAttendancePlacementType,
  normalizeToISODate,
  dateToMarkerSlot,
  dateToSlotSnapped,
  toISODate,
  uid,
} from "@/lib/studierektor/dateUtils";
import {
  encodeTimelineWarningRules,
} from "@/lib/studierektor/templateConfig";
import {
  ACHIEVEMENT_COLUMNS,
  COURSE_COLUMNS,
  IUP_SETTINGS_COLUMNS,
  PLACEMENT_COLUMNS,
  PROFILE_COLUMNS,
  saveClinicActivityTemplateConfig,
  getClinicFormRow,
} from "@/lib/repositories/starkRepository";
import type {
  WarningActivityKind,
  WarningRule,
  WarningRuleType,
} from "@/lib/studierektor/warningRuleTypes";
import type { TimelineSubtab } from "@/lib/studierektor/timelineTypes";
import type {
  ContactField,
  NetworkClinic,
  NetworkDataScope,
  NetworkGroup,
  NetworkGroupTab,
  NetworkInviteMode,
  NetworkParticipant,
  NetworkShareMode,
} from "@/lib/studierektor/networkTypes";

import {
  studierektorUppdateringarHasUnread,
} from "@/components/studierektor/UppfoljningModal";
import OverallTimelineOverviewTab from "@/components/studierektor/OverallTimelineOverviewTab";
import ProgressionSlutdatumView from "@/components/studierektor/ProgressionSlutdatumView";
import ProgressionSettingsView from "@/components/studierektor/ProgressionSettingsView";
import ProgressionMotSluttidToolbar from "@/components/studierektor/ProgressionMotSluttidToolbar";
import ProgressionMotSluttidTable, {
  type ProgressionTableSortKey,
} from "@/components/studierektor/ProgressionMotSluttidTable";
import NameChangePromptModal, {
  type NameChangePromptData,
} from "@/components/studierektor/NameChangePromptModal";
import TimelineTabView from "@/components/studierektor/TimelineTabView";
import { StudierektorPageChrome } from "@/components/studierektor/StudierektorPageChrome";
import { StudierektorPageModals } from "@/components/studierektor/StudierektorPageModals";
import { useAutoDismissInfoToast } from "@/components/studierektor/hooks/useAutoDismissInfoToast";
import { useStudentFileImport } from "@/components/studierektor/hooks/useStudentFileImport";
import { useStudentFileImportHandlers } from "@/components/studierektor/hooks/useStudentFileImportHandlers";
import { useNameChangePrompt } from "@/components/studierektor/hooks/useNameChangePrompt";
import { useStudentListPersistence } from "@/components/studierektor/hooks/useStudentListPersistence";
import { useOverallTimelineModalScrollGuard } from "@/components/studierektor/hooks/useOverallTimelineModalScrollGuard";
import { useSortedStudents } from "@/components/studierektor/hooks/useSortedStudents";
import { useFormerStActions } from "@/components/studierektor/hooks/useFormerStActions";
import { useStCompleteOfferDetection } from "@/components/studierektor/hooks/useStCompleteOfferDetection";
import { useStudierektorProfile } from "@/components/studierektor/hooks/useStudierektorProfile";
import { useClinicStudentsData } from "@/components/studierektor/hooks/useClinicStudentsData";
import { useOverallTimelineSummary } from "@/components/studierektor/hooks/useOverallTimelineSummary";
import { useOverallTimelineLinear } from "@/components/studierektor/hooks/useOverallTimelineLinear";
import { useProgressionRows } from "@/components/studierektor/hooks/useProgressionRows";
import { useWholeGroupProgressionStats } from "@/components/studierektor/hooks/useWholeGroupProgressionStats";
import { useSortedProgressionRows } from "@/components/studierektor/hooks/useSortedProgressionRows";
import { useNetworkOrchestration } from "@/components/studierektor/hooks/useNetworkOrchestration";
import { useNetworkPreferencesStorage } from "@/components/studierektor/hooks/useNetworkPreferencesStorage";
import { useNetworkSideEffects } from "@/components/studierektor/hooks/useNetworkSideEffects";
import {
  calculateProgress,
  mainSupervisorLabel,
  placementLabel,
  getStudentPhaseLabel,
  getOngoingPlacement,
  getNextPlacement,
  getStudentStartISO,
  getStudentPlannedEndISO,
  spreadStudentColors,
  evaluateRulePassForRow,
} from "@/lib/studierektor/studierektorPageStudentUtils";
import type { StudentSortColumn } from "@/lib/studierektor/studierektorStudentListColumns";
import { StudierektorStudentListMain } from "@/components/studierektor/StudierektorStudentListMain";

type OverallTimelinePrimaryTab = "overview" | "progression" | "settings";
const NETWORK_PREFS_STORAGE_KEY = "stark_sr_network_prefs_v1";
interface PlacementTemplateOption {
  title: string;
  suggestedMinMonths?: number;
  alternatives: string[];
}

const TIMELINE_WARNING_CONFIG_TITLE = "__config__:timeline-warning-rules";


export default function StudierektorPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const overallTimelineModalRef = useRef<HTMLDivElement | null>(null);
  const overallTimelineMonthGridRef = useRef<HTMLDivElement | null>(null);
  const overallTimelineHoverCollapseTimerRef = useRef<number | null>(null);
  const [hideImportZone, setHideImportZone] = useState<boolean>(false);

  const [aboutOpen, setAboutOpen] = useState(false);

  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SupervisorStudent | null>(null);
  const [overallTimelineOpen, setOverallTimelineOpen] = useState(false);
  const [overallTimelinePrimaryTab, setOverallTimelinePrimaryTab] = useState<OverallTimelinePrimaryTab>(
    "overview"
  );
  const [timelineSubtab, setTimelineSubtab] = useState<TimelineSubtab>("months");
  const [progressionPeriodMode, setProgressionPeriodMode] = useState<ProgressionPeriodMode>("last_year");
  const [progressionScopeMode, setProgressionScopeMode] = useState<ProgressionScopeMode>("completed");
  const [progressionTableSort, setProgressionTableSort] = useState<{
    key: ProgressionTableSortKey;
    dir: "asc" | "desc";
  }>({ key: "name", dir: "asc" });
  const [progressionDetailStudentId, setProgressionDetailStudentId] = useState<string | null>(null);
  const [wholeGroupModalOpen, setWholeGroupModalOpen] = useState(false);
  const [clinicRegionContext, setClinicRegionContext] = useState<{
    regionLabel: string;
    peerClinicCount: number | null;
  } | null>(null);
  const [overallTimelineShowAllActivities, setOverallTimelineShowAllActivities] = useState(false);
  const [overallTimelineHoveredBarId, setOverallTimelineHoveredBarId] = useState<string | null>(null);
  const [goHomeWarnOpen, setGoHomeWarnOpen] = useState(false);
  const [infoToast, setInfoToast] = useState<{ title: string; message: string } | null>(null);
  const [nameChangePrompt, setNameChangePrompt] = useState<NameChangePromptData | null>(null);

  useAutoDismissInfoToast(infoToast, setInfoToast, 8000);

  const [students, setStudents] = useState<SupervisorStudent[]>([]);
  const [formerStudents, setFormerStudents] = useState<SupervisorStudent[]>([]);
  /** Innehållet under rubriken växlar mellan nuvarande och tidigare ST-läkare (ingen separat popup). */
  const [showFormerStudentList, setShowFormerStudentList] = useState(false);
  const [stCompleteOffer, setStCompleteOffer] = useState<{ studentId: string; name: string } | null>(null);
  const [reloadStudentsTick, setReloadStudentsTick] = useState(0);
  const [clinicLoading, setClinicLoading] = useState(true);
  const [clinicName, setClinicName] = useState<string>("");
  const [clinicId, setClinicId] = useState<string>("");
  const [clinicMembers, setClinicMembers] = useState<{ user_id: string; role: string; name: string }[]>([]);
  const [warningRules, setWarningRules] = useState<WarningRule[]>([]);
  const [placementTemplateOptions, setPlacementTemplateOptions] = useState<PlacementTemplateOption[]>([]);
  const [newRuleType, setNewRuleType] = useState<WarningRuleType>("milestone_overall");
  const [newRuleMonthsThreshold, setNewRuleMonthsThreshold] = useState(6);
  const [newRuleMinProgress, setNewRuleMinProgress] = useState(70);
  const [newRuleActivityKind, setNewRuleActivityKind] = useState<WarningActivityKind>("placering");
  const [newRulePlacementTitle, setNewRulePlacementTitle] = useState("");
  const [newRulePlacementMinMonths, setNewRulePlacementMinMonths] = useState(6);
  const [studentSort, setStudentSort] = useState<{ column: StudentSortColumn; direction: "asc" | "desc" }>({
    column: "name",
    direction: "asc",
  });
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [uppfoljningOpen, setUppfoljningOpen] = useState(false);
  const [followupStorageBump, setFollowupStorageBump] = useState(0);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [networkClinics, setNetworkClinics] = useState<NetworkClinic[]>([]);
  const [networkSearchQuery, setNetworkSearchQuery] = useState("");
  const [networkLoadingClinics, setNetworkLoadingClinics] = useState(false);
  const [networkCurrentUserId, setNetworkCurrentUserId] = useState("");
  const [networkGroups, setNetworkGroups] = useState<NetworkGroup[]>([
    { id: "grp_local", name: "Regionalt nätverk", clinicIds: [], adminUserIds: [], memberUserIds: [] },
  ]);
  const [networkNewGroupName, setNetworkNewGroupName] = useState("");
  const [networkSelectedClinicIds, setNetworkSelectedClinicIds] = useState<string[]>([]);
  const [networkGroupOpen, setNetworkGroupOpen] = useState(false);
  const [networkActiveGroupId, setNetworkActiveGroupId] = useState<string | null>(null);
  const [networkGroupTab, setNetworkGroupTab] = useState<NetworkGroupTab>("group");
  const [networkParticipants, setNetworkParticipants] = useState<NetworkParticipant[]>([]);
  const [networkParticipantsLoading, setNetworkParticipantsLoading] = useState(false);
  const [networkInviteMode, setNetworkInviteMode] = useState<NetworkInviteMode>("hospital");
  const [networkInviteRegion, setNetworkInviteRegion] = useState("");
  const [networkInviteHospital, setNetworkInviteHospital] = useState("");
  const [networkInviteClinicId, setNetworkInviteClinicId] = useState("");
  const [networkInviteUserId, setNetworkInviteUserId] = useState("");
  const [networkGroupRename, setNetworkGroupRename] = useState("");
  const [networkSelectedMemberId, setNetworkSelectedMemberId] = useState("");
  const [networkShareMode, setNetworkShareMode] = useState<NetworkShareMode>("group");
  const [networkShareScopes, setNetworkShareScopes] = useState<NetworkDataScope[]>(["activities", "iup_headers"]);
  const [networkSelectedGroupIdsForSharing, setNetworkSelectedGroupIdsForSharing] = useState<string[]>(["grp_local"]);
  const [networkRequestTarget, setNetworkRequestTarget] = useState("");
  const [networkShowName, setNetworkShowName] = useState(true);
  const [networkShowContact, setNetworkShowContact] = useState(true);
  const [networkContactFields, setNetworkContactFields] = useState<ContactField[]>([
    "email",
    "mobile",
  ]);
  const [menyOpen, setMenyOpen] = useState(false);
  const [logoutWarnOpen, setLogoutWarnOpen] = useState(false);

  // Visa alltid "Mina ST-läkare" efter inloggning / ny session, även om man loggade ut på tidigare-listan.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setShowFormerStudentList(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!clinicId) {
      setClinicRegionContext(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getClinicFormRow(clinicId);
        if (cancelled) return;
        const h = (data as any)?.hospitals;
        const embedded = Array.isArray(h) ? h[0] : h;
        const region = String(embedded?.region || "").trim();
        const regionLabel = region || "Okänd region";
        let peerClinicCount: number | null = null;
        if (region) {
          const { data: hosp } = await supabase.from("hospitals").select("id").eq("region", region);
          const ids = (hosp || []).map((x: any) => x.id).filter(Boolean);
          if (ids.length) {
            const { count, error } = await supabase
              .from("clinics")
              .select("id", { count: "exact", head: true })
              .in("hospital_id", ids);
            if (!error && typeof count === "number") peerClinicCount = count;
          }
        }
        setClinicRegionContext({ regionLabel, peerClinicCount });
      } catch {
        if (!cancelled) setClinicRegionContext({ regionLabel: "Okänd region", peerClinicCount: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  const [groupGoalsCatalogs, setGroupGoalsCatalogs] = useState<Map<string, GoalsCatalog>>(new Map());

  useEffect(() => {
    if (!students.length) {
      setGroupGoalsCatalogs(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const keys = new Map<string, { gv: string; sp: string }>();
      for (const st of students) {
        const gv = String(st.goalsVersion || "2015");
        const sp = String(st.specialty || "").trim() || "Psykiatri";
        const key = `${gv}|${sp}`;
        if (!keys.has(key)) keys.set(key, { gv, sp });
      }
      const next = new Map<string, GoalsCatalog>();
      for (const [key, { gv, sp }] of keys) {
        try {
          const g = await loadGoals(gv, sp);
          if (!cancelled && g) next.set(key, g);
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setGroupGoalsCatalogs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [students]);

  const toggleStudentSort = useCallback((column: StudentSortColumn) => {
    setStudentSort((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      const defaultDirection = column === "stEndDate" || column === "progress" || column === "lastUpdated" ? "desc" : "asc";
      return { column, direction: defaultDirection };
    });
  }, []);

  const sortIndicator = useCallback(
    (column: StudentSortColumn) => {
      if (studentSort.column !== column) return "↕";
      return studentSort.direction === "asc" ? "↑" : "↓";
    },
    [studentSort]
  );

  const studentColorById = useMemo(() => spreadStudentColors(students || []), [students]);

  const harOlästaUppdateringar = useMemo(
    () => studierektorUppdateringarHasUnread(students ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- oläst bygger på localStorage; bump/modal ska trigga omräkning utan att `students` ändras
    [students, uppfoljningOpen, followupStorageBump]
  );
  const filteredNetworkClinics = useMemo(() => {
    const q = networkSearchQuery.trim().toLowerCase();
    if (!q) return networkClinics;
    return networkClinics.filter((c) =>
      [c.name, c.region, c.hospitalName].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [networkClinics, networkSearchQuery]);

  const {
    activeNetworkGroup,
    isActiveNetworkGroupAdmin,
    activeNetworkGroupMembers,
    deleteNetworkGroupById,
    leaveNetworkGroupById,
    networkModalModel,
    networkGroupModalModel,
  } = useNetworkOrchestration({
    networkGroups,
    networkActiveGroupId,
    networkCurrentUserId,
    networkParticipants,
    clinicId,
    clinicName,
    clinicRegionContext,
    networkGroupOpen,
    networkInviteRegion,
    networkInviteMode,
    networkInviteHospital,
    networkInviteClinicId,
    networkInviteUserId,
    networkSelectedMemberId,
    networkGroupRename,
    networkNewGroupName,
    setNetworkGroups,
    setNetworkSelectedGroupIdsForSharing,
    setNetworkActiveGroupId,
    setNetworkInviteUserId,
    setNetworkSelectedMemberId,
    setInfoToast,
    setNetworkGroupTab,
    setNetworkGroupOpen,
    setNetworkOpen,
    setNetworkNewGroupName,
    setNetworkShareScopes,
    setNetworkContactFields,
    setNetworkGroupRename,
  });

  useNetworkSideEffects({
    networkCurrentUserId,
    setNetworkCurrentUserId,
    setNetworkGroups,
    networkGroupOpen,
    networkActiveGroupId,
    networkGroups,
    setNetworkGroupOpen,
    setNetworkActiveGroupId,
    networkOpen,
    setNetworkLoadingClinics,
    setNetworkClinics,
    setNetworkParticipantsLoading,
    setNetworkParticipants,
    activeNetworkGroup,
    networkSelectedMemberId,
    setNetworkSelectedMemberId,
  });

  useNetworkPreferencesStorage({
    storageKey: NETWORK_PREFS_STORAGE_KEY,
    networkGroups,
    setNetworkGroups,
    networkSelectedGroupIdsForSharing,
    setNetworkSelectedGroupIdsForSharing,
    networkSelectedClinicIds,
    setNetworkSelectedClinicIds,
    networkShareMode,
    setNetworkShareMode,
    networkShareScopes,
    setNetworkShareScopes,
    networkRequestTarget,
    setNetworkRequestTarget,
    networkShowName,
    setNetworkShowName,
    networkShowContact,
    setNetworkShowContact,
    networkContactFields,
    setNetworkContactFields,
  });

  const { sortedStudents, sortedFormerStudents } = useSortedStudents({
    students,
    formerStudents,
    studentSort,
    mainSupervisorLabel,
    getOngoingPlacement,
    placementLabel,
    getStudentPhaseLabel,
    getStudentPlannedEndISO,
    getNextPlacement,
    calculateProgress,
  });

  const {
    formerActionBusy,
    handleFlyttaTillTidigareFromCard,
    handleReactivateFormer,
    handleStCompleteJa,
  } = useFormerStActions({
    selectedStudent,
    setSelectedStudent,
    students,
    stCompleteOffer,
    setStCompleteOffer,
    setReloadStudentsTick,
  });

  useStCompleteOfferDetection({
    students,
    clinicLoading,
    stCompleteOffer,
    setStCompleteOffer,
    getStudentPlannedEndISO,
  });

  const handleStCompleteNej = useCallback(() => {
    if (stCompleteOffer) addStCompleteDeclined(stCompleteOffer.studentId);
    setStCompleteOffer(null);
  }, [stCompleteOffer]);

  const showFlyttaTillTidigareForSelected = useMemo(() => {
    if (!selectedStudent || selectedStudent.formerStLakare) return false;
    const end = getStudentPlannedEndISO(selectedStudent);
    const today = new Date().toISOString().slice(0, 10);
    return !!(end && end < today && loadStCompleteDeclinedIds().has(selectedStudent.id));
  }, [selectedStudent]);

  const {
    srProfileOpen,
    setSrProfileOpen,
    srProfile,
    setSrProfile,
    srProfileSaving,
    saveSrProfile,
  } = useStudierektorProfile();

  useClinicStudentsData({
    reloadStudentsTick,
    timelineWarningConfigTitle: TIMELINE_WARNING_CONFIG_TITLE,
    setClinicId,
    setClinicName,
    setClinicMembers,
    setStudents,
    setFormerStudents,
    setWarningRules,
    setPlacementTemplateOptions,
    setClinicLoading,
  });

  const overallTimeline = useOverallTimelineSummary({
    students,
    spreadStudentColors,
    getStudentStartISO,
    getStudentPlannedEndISO,
    isValidISODate,
    dateToSlotSnapped,
    dateToMarkerSlot,
  });

  const overallTimelineLinear = useOverallTimelineLinear({
    students,
    spreadStudentColors,
    getStudentStartISO,
    getStudentPlannedEndISO,
    isValidISODate,
    normalizeToISODate,
    dateToSlotSnapped,
    formatDate,
  });

  const saveWarningRules = useCallback(
    async (nextRules: WarningRule[]) => {
      if (!clinicId) return false;
      const payload = {
        clinic_id: clinicId,
        type: "annan",
        title: TIMELINE_WARNING_CONFIG_TITLE,
        description: "Systemkonfiguration för varningsregler i övergripande tidslinje",
        suggested_milestones: [] as string[],
        suggested_rows: encodeTimelineWarningRules(nextRules),
        is_metis: false,
        is_active: false,
      };
      const { error } = await saveClinicActivityTemplateConfig(
        clinicId,
        TIMELINE_WARNING_CONFIG_TITLE,
        payload
      );
      return !error;
    },
    [clinicId]
  );

  useEffect(() => {
    if (warningRules.some((r) => r.type === "mandatory_placement")) return;
    setWarningRules((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "mandatory_placement",
        enabled: false,
        params: {},
      },
    ]);
  }, [warningRules]);

  const computeProgressTimelineStatus = useCallback(
    (student: SupervisorStudent | null, endISOInput: string) => {
      const endISO = String(endISOInput || "");
      const isValidEnd = isValidISODate(endISO);
      const todayISO = new Date().toISOString().slice(0, 10);
      const monthsDelta = isValidEnd
        ? Math.round(
            (new Date(`${endISO}T00:00:00`).getTime() -
              new Date(`${todayISO}T00:00:00`).getTime()) /
              (1000 * 60 * 60 * 24 * 30.4375)
          )
        : null;

      if (isValidEnd && monthsDelta != null && monthsDelta < 0) {
        return {
          status: "ok" as const,
          statusLabel: "Färdig med ST",
          statusClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
          riskReasons: [] as string[],
          timeText: "Färdig med ST",
        };
      }

      const overallProgress = student ? calculateProgress(student) : 0;
      const activityProgress = (kind: WarningActivityKind): number => {
        if (!student) return 0;
        if (kind === "kurs") {
          const list = Array.isArray(student.courses) ? student.courses : [];
          if (list.length === 0) return 0;
          const done = list.filter((c: any) => (c?.milestones || []).length > 0 || c?.fulfillsStGoals).length;
          return Math.round((done / list.length) * 100);
        }
        const placements = Array.isArray(student.placements) ? student.placements : [];
        const filtered =
          kind === "arbete"
            ? placements.filter((p: any) => String(p?.type || "").toLowerCase().includes("arbete"))
            : placements;
        if (filtered.length === 0) return 0;
        const done = filtered.filter((p: any) => (p?.milestones || []).length > 0 || p?.fulfillsStGoals).length;
        return Math.round((done / filtered.length) * 100);
      };

      let status: "ok" | "risk" | "late" =
        monthsDelta == null
          ? "risk"
          : monthsDelta < 0
          ? "late"
          : monthsDelta <= 6
          ? "risk"
          : "ok";
      const riskReasons: string[] = [];
      if (monthsDelta == null) riskReasons.push("Okänt slutdatum.");
      else if (monthsDelta < 0) riskReasons.push("Slutdatum har passerat.");
      else if (monthsDelta <= 6) riskReasons.push(`Endast ${monthsDelta} månader kvar.`);

      for (const rule of warningRules.filter((r) => r.enabled)) {
        const threshold = Number(rule.params.monthsLeftThreshold ?? 6);
        const inWindow = monthsDelta != null && monthsDelta <= threshold;
        if (!inWindow) continue;
        if (rule.type === "milestone_overall") {
          const min = Number(rule.params.minProgressPercent ?? 70);
          if (overallProgress < min) {
            if (status === "ok") status = "risk";
            riskReasons.push(`Generell delmålsprogress ${overallProgress}% < ${min}%.`);
          }
        } else if (rule.type === "milestone_activity") {
          const kind = rule.params.activityKind || "placering";
          const min = Number(rule.params.minProgressPercent ?? 70);
          const kindProgress = activityProgress(kind);
          if (kindProgress < min) {
            if (status === "ok") status = "risk";
            riskReasons.push(`Progress (${kind}) ${kindProgress}% < ${min}%.`);
          }
        } else if (rule.type === "mandatory_placement") {
          if (!student) continue;
          const mandatoryTemplates = placementTemplateOptions.filter((t) => Number(t.suggestedMinMonths || 0) > 0);
          if (mandatoryTemplates.length === 0) continue;
          const requiredTotalMonths = mandatoryTemplates.reduce(
            (acc, t) => acc + Number(t.suggestedMinMonths || 0),
            0
          );
          const placements = Array.isArray(student.placements) ? student.placements : [];
          const sumMonths = placements
            .filter((p: any) => {
              const label = String(p?.clinic || p?.title || "").toLowerCase();
              return mandatoryTemplates.some((t) => label.includes(String(t.title || "").toLowerCase()));
            })
            .reduce((acc: number, p: any) => {
              const s = normalizeToISODate(p?.startDate || "");
              const e = normalizeToISODate(p?.endDate || p?.startDate || "");
              if (!s || !e) return acc;
              const spanDays =
                Math.max(
                  1,
                  Math.round(
                    (new Date(`${e}T00:00:00`).getTime() -
                      new Date(`${s}T00:00:00`).getTime()) /
                      (1000 * 60 * 60 * 24)
                  ) + 1
                );
              return acc + spanDays / 30.4375;
            }, 0);
          if (sumMonths < requiredTotalMonths) {
            const missing = requiredTotalMonths - sumMonths;
            if (monthsDelta != null && missing > Math.max(0, monthsDelta)) status = "late";
            else if (status === "ok") status = "risk";
            riskReasons.push(
              `Obligatoriska tjänstgöringar: ${sumMonths.toFixed(1)} av ${requiredTotalMonths.toFixed(
                1
              )} mån (saknas ${missing.toFixed(1)} mån).`
            );
          }
        }
      }

      const statusLabel = status === "late" ? "Förlängning" : status === "risk" ? "Risk" : "I fas";
      const statusClass =
        status === "late"
          ? "bg-red-100 text-red-800 border-red-200"
          : status === "risk"
          ? "bg-amber-100 text-amber-800 border-amber-200"
          : "bg-emerald-100 text-emerald-800 border-emerald-200";
      const timeText =
        monthsDelta == null
          ? "Tid kvar: okänd"
          : monthsDelta >= 0
          ? `Tid kvar: ${monthsDelta} mån`
          : `Avvikelse: +${Math.abs(monthsDelta)} mån`;

      return { status, statusLabel, statusClass, riskReasons, timeText };
    },
    [warningRules, placementTemplateOptions]
  );

  const progressionRows = useProgressionRows({
    students,
    getStudentPlannedEndISO,
    computeProgressTimelineStatus,
    calculateProgress,
    normalizeToISODate,
    isValidISODate,
    placementTemplateOptions,
  });

  const toggleProgressionSort = useCallback((key: ProgressionTableSortKey) => {
    setProgressionTableSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    );
  }, []);

  const sortedProgressionRows = useSortedProgressionRows({
    progressionRows,
    progressionTableSort,
    progressionPeriodMode,
    progressionScopeMode,
  });

  const wholeGroupProgressionStats = useWholeGroupProgressionStats({
    progressionRows,
    warningRules,
    groupGoalsCatalogs,
    evaluateRulePassForRow,
  });

  const overviewTabView = (
    <OverallTimelineOverviewTab
      overallTimelineLinear={overallTimelineLinear}
      overallTimelineShowAllActivities={overallTimelineShowAllActivities}
      setOverallTimelineShowAllActivities={setOverallTimelineShowAllActivities}
      overallTimelineMonthGridRef={overallTimelineMonthGridRef}
      overallTimelineHoveredBarId={overallTimelineHoveredBarId}
      setOverallTimelineHoveredBarId={setOverallTimelineHoveredBarId}
      overallTimelineHoverCollapseTimerRef={overallTimelineHoverCollapseTimerRef}
    />
  );

  const progressionSubtabProgressionView = (
    <div className="space-y-4">
      <ProgressionMotSluttidToolbar
        onOpenWholeGroup={() => setWholeGroupModalOpen(true)}
        progressionPeriodMode={progressionPeriodMode}
        setProgressionPeriodMode={setProgressionPeriodMode}
        progressionScopeMode={progressionScopeMode}
        setProgressionScopeMode={setProgressionScopeMode}
      />
      <ProgressionMotSluttidTable
        rows={sortedProgressionRows}
        progressionPeriodMode={progressionPeriodMode}
        progressionScopeMode={progressionScopeMode}
        progressionTableSort={progressionTableSort}
        onToggleSort={toggleProgressionSort}
        onOpenDetail={setProgressionDetailStudentId}
      />
    </div>
  );

  const progressionSubtabSlutdatumView = (
    <ProgressionSlutdatumView overallTimeline={overallTimeline} />
  );

  const progressionSubtabSettingsView = (
    <ProgressionSettingsView
      warningRules={warningRules}
      setWarningRules={setWarningRules}
      saveWarningRules={saveWarningRules}
      newRuleType={newRuleType}
      setNewRuleType={setNewRuleType}
      newRuleMonthsThreshold={newRuleMonthsThreshold}
      setNewRuleMonthsThreshold={setNewRuleMonthsThreshold}
      newRuleMinProgress={newRuleMinProgress}
      setNewRuleMinProgress={setNewRuleMinProgress}
      newRuleActivityKind={newRuleActivityKind}
      setNewRuleActivityKind={setNewRuleActivityKind}
    />
  );

  const timelineTabView = (
    <TimelineTabView
      timelineSubtab={timelineSubtab}
      setTimelineSubtab={setTimelineSubtab}
      overviewView={overviewTabView}
      slutdatumView={progressionSubtabSlutdatumView}
    />
  );

  const { handleFiles } = useStudentFileImport({
    students,
    setStudents,
    setImporting,
    setNameChangePrompt,
    setInfoToast,
  });

  const { onFileChange, onDrop, onDragOver, onDragLeave } = useStudentFileImportHandlers({
    handleFiles,
    setDragOver,
  });

  const { handleNameChange } = useNameChangePrompt({
    nameChangePrompt,
    setNameChangePrompt,
    setStudents,
    setInfoToast,
  });

  const { saveList } = useStudentListPersistence({
    students,
    setStudents,
  });

  const onGoHomeSaveAndContinue = useCallback(async () => {
    await saveList();
    setGoHomeWarnOpen(false);
    router.push("/");
  }, [saveList, router]);

  const onGoHomeContinueWithoutSave = useCallback(() => {
    setGoHomeWarnOpen(false);
    router.push("/");
  }, [router]);

  const onLogoutConfirm = useCallback(async () => {
    const { supabase: sb } = await import("@/lib/supabase");
    await sb.auth.signOut();
    window.location.href = "/auth";
  }, []);

  useOverallTimelineModalScrollGuard({
    overallTimelineOpen,
    overallTimelineModalRef,
    overallTimelineMonthGridRef,
  });

  return (
    <div className="min-h-screen bg-slate-100">
      <StudierektorPageChrome
        infoToast={infoToast}
        setInfoToast={setInfoToast}
        clinicName={clinicName}
        onGoHomeClick={() => setGoHomeWarnOpen(true)}
        onOpenDashboard={() => setDashboardOpen(true)}
        onOpenOverallTimeline={() => setOverallTimelineOpen(true)}
        onOpenNetwork={() => setNetworkOpen(true)}
        onOpenUppfoljning={() => setUppfoljningOpen(true)}
        onOpenMeny={() => setMenyOpen(true)}
        harOlästaUppdateringar={harOlästaUppdateringar}
      />

      <StudierektorStudentListMain
        clinicLoading={clinicLoading}
        showFormerStudentList={showFormerStudentList}
        setShowFormerStudentList={setShowFormerStudentList}
        formerStudentCount={formerStudents.length}
        sortedFormerStudents={sortedFormerStudents}
        studentCount={students?.length ?? 0}
        sortedStudents={sortedStudents}
        toggleStudentSort={toggleStudentSort}
        sortIndicator={sortIndicator}
        setSelectedStudent={setSelectedStudent}
        setDashboardOpen={setDashboardOpen}
        computeProgressTimelineStatus={computeProgressTimelineStatus}
      />

      <StudierektorPageModals
        fileRef={fileRef}
        onFileChange={onFileChange}
        networkOpen={networkOpen}
        setNetworkOpen={setNetworkOpen}
        networkNewGroupName={networkNewGroupName}
        setNetworkNewGroupName={setNetworkNewGroupName}
        networkModalModel={networkModalModel}
        networkGroups={networkGroups}
        networkCurrentUserId={networkCurrentUserId}
        deleteNetworkGroupById={deleteNetworkGroupById}
        leaveNetworkGroupById={leaveNetworkGroupById}
        networkShareScopes={networkShareScopes}
        networkShareMode={networkShareMode}
        setNetworkShareMode={setNetworkShareMode}
        networkSelectedGroupIdsForSharing={networkSelectedGroupIdsForSharing}
        networkRequestTarget={networkRequestTarget}
        setNetworkRequestTarget={setNetworkRequestTarget}
        networkShowName={networkShowName}
        setNetworkShowName={setNetworkShowName}
        networkShowContact={networkShowContact}
        setNetworkShowContact={setNetworkShowContact}
        networkContactFields={networkContactFields}
        srProfile={srProfile}
        onSaveNetworkSettings={networkModalModel.saveSettings}
        networkGroupModalModel={networkGroupModalModel}
        networkGroupOpen={networkGroupOpen}
        setNetworkGroupOpen={setNetworkGroupOpen}
        isActiveNetworkGroupAdmin={isActiveNetworkGroupAdmin}
        networkGroupTab={networkGroupTab}
        setNetworkGroupTab={setNetworkGroupTab}
        clinicName={clinicName}
        clinicRegionContext={clinicRegionContext}
        networkSelectedMemberId={networkSelectedMemberId}
        setNetworkSelectedMemberId={setNetworkSelectedMemberId}
        networkGroupRename={networkGroupRename}
        setNetworkGroupRename={setNetworkGroupRename}
        networkInviteMode={networkInviteMode}
        setNetworkInviteMode={setNetworkInviteMode}
        setNetworkInviteHospital={setNetworkInviteHospital}
        setNetworkInviteClinicId={setNetworkInviteClinicId}
        networkInviteRegion={networkInviteRegion}
        setNetworkInviteRegion={setNetworkInviteRegion}
        networkInviteHospital={networkInviteHospital}
        networkInviteClinicId={networkInviteClinicId}
        networkInviteUserId={networkInviteUserId}
        setNetworkInviteUserId={setNetworkInviteUserId}
        networkParticipantsLoading={networkParticipantsLoading}
        goHomeWarnOpen={goHomeWarnOpen}
        setGoHomeWarnOpen={setGoHomeWarnOpen}
        onGoHomeSaveAndContinue={onGoHomeSaveAndContinue}
        onGoHomeContinueWithoutSave={onGoHomeContinueWithoutSave}
        srProfileOpen={srProfileOpen}
        setSrProfileOpen={setSrProfileOpen}
        setSrProfile={setSrProfile}
        srProfileSaving={srProfileSaving}
        onSaveSrProfile={saveSrProfile}
        aboutOpen={aboutOpen}
        setAboutOpen={setAboutOpen}
        uppfoljningOpen={uppfoljningOpen}
        setUppfoljningOpen={setUppfoljningOpen}
        students={students}
        studentColorById={studentColorById}
        onFollowupStorageChanged={() => setFollowupStorageBump((n) => n + 1)}
        clinicMembers={clinicMembers}
        dashboardOpen={dashboardOpen}
        setDashboardOpen={setDashboardOpen}
        stCompleteOffer={stCompleteOffer}
        onStCompleteNej={handleStCompleteNej}
        onStCompleteJa={handleStCompleteJa}
        selectedStudent={selectedStudent}
        setSelectedStudent={setSelectedStudent}
        showFlyttaTillTidigareForSelected={showFlyttaTillTidigareForSelected}
        onFlyttaTillTidigareFromCard={handleFlyttaTillTidigareFromCard}
        onReactivateFormer={handleReactivateFormer}
        formerActionBusy={formerActionBusy}
        overallTimelineOpen={overallTimelineOpen}
        setOverallTimelineOpen={setOverallTimelineOpen}
        overallTimelineModalRef={overallTimelineModalRef}
        overallTimelinePrimaryTab={overallTimelinePrimaryTab}
        setOverallTimelinePrimaryTab={setOverallTimelinePrimaryTab}
        timelineTabView={timelineTabView}
        progressionSubtabProgressionView={progressionSubtabProgressionView}
        progressionSubtabSettingsView={progressionSubtabSettingsView}
        progressionDetailStudentId={progressionDetailStudentId}
        setProgressionDetailStudentId={setProgressionDetailStudentId}
        progressionRows={progressionRows}
        warningRules={warningRules}
        getStudentStartISO={getStudentStartISO}
        getStudentPlannedEndISO={getStudentPlannedEndISO}
        wholeGroupModalOpen={wholeGroupModalOpen}
        setWholeGroupModalOpen={setWholeGroupModalOpen}
        wholeGroupProgressionStats={wholeGroupProgressionStats}
        nameChangePrompt={nameChangePrompt}
        onNameChangeExisting={() => handleNameChange("existing")}
        onNameChangeNew={() => handleNameChange("new")}
        onNameChangeCancel={() => setNameChangePrompt(null)}
        logoutWarnOpen={logoutWarnOpen}
        setLogoutWarnOpen={setLogoutWarnOpen}
        onLogoutConfirm={onLogoutConfirm}
        menyOpen={menyOpen}
        setMenyOpen={setMenyOpen}
      />
    </div>
  );
}

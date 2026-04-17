// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearStoredApiKey,
  hasStoredApiKey,
} from "@/lib/ai/localKeyVault";
import { redactContactInfoText } from "@/lib/ai/piiRedaction";
import { placementNameMatches } from "@/lib/ai/colleagueMatch";



import type { GoalsCatalog } from "@/lib/goals";
import { loadGoals } from "@/lib/goals";
import { btMilestones } from "@/lib/goals-bt";
import { COMMON_AB_MILESTONES } from "@/lib/goals-common";
import { milestoneRequires } from "@/lib/milestoneRequirements";
import { displayMilestoneCode } from "@/lib/milestoneDisplay";
import { sortMilestoneIds } from "@/lib/milestoneSequence";
import { exportCertificate, exportSta3Certificate } from "@/lib/exporters";
import { logAudit } from "@/lib/audit";
import { getSessionUser, supabase } from "@/lib/supabase";
import { perfMark, perfMeasure } from "@/lib/perf";
import {
  deleteAchievementsByUserAndCourse,
  deleteAchievementsByUserAndPlacement,
  deleteCourseForUser,
  deletePlacementForUser,
  fetchClinicActivityTemplateSuggestedRowsByTitle,
  fetchClinicMembershipForUser,
  fetchProfileById,
  getAuthenticatedUserId,
  IUP_SETTINGS_COLUMNS,
  insertAchievementRows,
  insertActivityDocumentRow,
  insertTimelineVersionRow,
  listAchievementsByUserId,
  listActiveClinicActivityTemplatesByClinicId,
  listActivityDocumentsForUser,
  listCoursesByUserId,
  listPlacementsByUserId,
  updateProfileSnakeCase,
  upsertIupSettingsOnUserId,
} from "@/lib/repositories/starkRepository";
import { isCourseDirty, isPlacementDirty } from "@/lib/pussla/dirtyComparators";
import {
  buildUpdatedPlacementNote,
  resolveMatchingUtbildningsmoment,
} from "@/lib/pussla/utbildningsmomentPlacement";
import {
  getEffectiveBtWindow,
  isIsoInBtWindow,
  isPlacementInBtWindow,
} from "@/lib/pussla/btPhase";
import { ensureUserId, resolveUserId } from "@/lib/pussla/auth";
import {
  mapAchievementRow,
  buildCourseSupabaseRecord,
  buildPlacementSupabaseRecord,
  mapCourseRowForDb,
  mapCourseRowForList,
  mapPlacementRowForDb,
  mapPlacementRowForList,
  upsertById,
} from "@/lib/pussla/entitySync";
import { saveEntityRow } from "@/lib/pussla/supabaseCrud";
import { mapPusslaProfileRow } from "@/lib/pussla/profileMapper";
import {
  mapLockedCoursesToTimeline,
  mapLockedPlacementsToActivities,
} from "@/lib/pussla/lockedTimeline";
import {
  inferPlacementPhaseByProfileBt,
} from "@/lib/pussla/timelineMerge";
import { sanitizeTimelineDrafts } from "@/lib/pussla/draftSanitizers";
import {
  getCourseTemplateGroup,
  getTemplateSuggestedPeriodMonths,
  nearestSundayISO,
  parseCourseGroupsConfig,
  splitTemplateSuggestedRows,
  shiftIsoDays,
} from "@/lib/pussla/templateDateHelpers";
import { resolvePendingScanSelection } from "@/lib/pussla/scanSelection";
import { fetchLockedTimelineRows } from "@/lib/pussla/lockedFetch";
import {
  getCourseStartISOForAgent as resolveCourseStartISOForAgent,
  getPlacementEndISOForAgent as resolvePlacementEndISOForAgent,
  getPlacementStartISOForAgent as resolvePlacementStartISOForAgent,
} from "@/lib/pussla/agentDateResolvers";
import { ensureProfile } from "@/lib/pussla/ensureProfile";
import {
  courseTitleMatchesAgent,
  courseTouchesMonthYearForAgent,
  normalizeCourseTitleForAgent,
} from "@/lib/pussla/agentCourseMatchers";
import { sanitizeStMilestonesForGoals } from "@/lib/pussla/milestoneSanitizers";
import {
  computeEducationalGaps,
  findPlacementToRightInActivities,
  wouldOverlapInActivities,
} from "@/lib/pussla/timelineMath";
import { pickTrainingStartAnchorISO } from "@/lib/pussla/startAnchors";
import { computeTotalCombinedMonths } from "@/lib/pussla/planDuration";
import {
  computeMondayDatesForActivity,
  displayDatesForActivity as resolveDisplayDatesForActivity,
  resolveLengthSlotsForExactEndDate,
} from "@/lib/pussla/activityTimelineDates";
import {
  isLeaveType as isLeave,
  isPlacementZeroAttendance,
  isZeroAttendanceType,
} from "@/lib/pussla/attendanceTypes";
import { phaseForCourseDatesCore } from "@/lib/pussla/coursePhase";
import {
  dateToISO,
  isValidISO,
  isoToDateSafe,
  normalizeISODateOnlyGlobal,
} from "@/lib/pussla/isoDates";
import { computePlacementPhaseFromBtWindow } from "@/lib/pussla/placementPhase";
import {
  SLOT_COLUMNS_PER_YEAR,
  dateToSlot,
  slotToYearMonthHalf,
} from "@/lib/pussla/timelineSlots";
import { roundToAnchorsWithDeps } from "@/lib/pussla/roundToAnchors";
import { computeActivityOverlaps } from "@/lib/pussla/overlapWarnings";
import { computeProjectedStEndISO } from "@/lib/pussla/stEndProjection";
import { pointerToGlobalDelta } from "@/lib/pussla/dragGrid";
import {
  resolveMovedPlacementPhase,
} from "@/lib/pussla/placementFactory";
import { findEarliestActivityYear } from "@/lib/pussla/timelineYears";
import {
  computeMoveStartNoOverlap,
  adjustResizeLeftNoOverlap,
  adjustResizeRightNoOverlap,
} from "@/lib/pussla/placementDragMath";
import { buildDraggedCourse } from "@/lib/pussla/courseDragModel";
import { computeCourseDragDate } from "@/lib/pussla/courseDragGrid";
import {
  applyMovePlacement,
  applyResizeLeftPlacement,
  applyResizeRightPlacement,
} from "@/lib/pussla/placementDragUpdates";
import {
  applyActivityDatesFromSlots,
  applyCourseDatesFromSlots,
} from "@/lib/pussla/formDatesFromSlots";
import {
  buildCourseRegistrationPath,
  buildPlacementRegistrationPath,
} from "@/lib/pussla/timelineNavigation";
import {
  canBuildPreview,
  showPreviewFromBlob,
  toErrorMessage,
} from "@/lib/pussla/previewState";
import {
  colleagueItemDisplayName,
  colleagueItemTypeLabel,
  colleagueTargetDisplayName,
} from "@/lib/pussla/colleagueDisplay";
import {
  buildPlacementPatchFromAgentFields,
  resolvePlacementDatePatchFromAgentFields,
} from "@/lib/pussla/agentPlacementUpdate";
import { buildCoursePatchFromAgentFields } from "@/lib/pussla/agentCourseUpdate";
import {
  buildIupSettingsUpsertPayload,
  normalizeIupSettings,
} from "@/lib/pussla/iupSettingsPayload";
import { resolveSupabaseUserId } from "@/lib/pussla/supabaseAuth";
import {
  buildBtGoalsPreviewBlob,
  buildCoursePreviewBlob,
  buildGroupedPlacementPreviewBlob,
  buildPlacementPreviewBlob,
} from "@/lib/pussla/previewController";
import { inferPhaseByBTRuntime } from "@/lib/pussla/phaseInference";
import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";
import { getCourseDisplayTitle, toMilestoneIds } from "@/lib/pussla/previewFormatters";
import {
  composeHydratedTimelineState,
  computeEffectiveStartYear,
} from "@/lib/pussla/timelineHydration";
import {
  addMonths,
  dayOfYear,
  daysInYear,
  halfMidDateISO,
  nextSundayOnOrAfter,
} from "@/lib/pussla/timelineDateMath";
import {
  mondayNearestTo,
  mondayOnOrAfter,
  sundayBeforeAnchor,
  sundayNearestTo,
  sundayOnOrBefore,
} from "@/lib/pussla/timelineAnchors";
import {
  getMetisCourseGoals,
  getMetisCoursesForSpecialty,
  mapMetisGoalsToMilestoneIds,
  usesMetisCourses,
} from "@/lib/pussla/metisCourses";
import {
  getDocumentTargetKey,
  normalizeGlobalFolderId,
  parseDocumentTargetFromKey,
} from "@/lib/pussla/documentsWorkspace";
import PusslaModalAndOverlayStack from "@/components/pussla/PusslaModalAndOverlayStack";
import PusslaPrimarySurface from "@/components/pussla/PusslaPrimarySurface";
import {
  groupedMembersForDraft,
  type ActivityLike,
  type IntygGroupConfig,
} from "@/lib/pussla/intygGroupHelpers";
import TimelineYearRow from "@/components/pussla/TimelineYearRow";
import { useApplyPlacementDates } from "@/components/pussla/hooks/useApplyPlacementDates";
import { useOverlapSuggestion } from "@/components/pussla/hooks/useOverlapSuggestion";
import { useBtEndDateChange } from "@/components/pussla/hooks/useBtEndDateChange";
import { usePlacementDetailFieldActions } from "@/components/pussla/hooks/usePlacementDetailFieldActions";
import { usePlacementNoteActions } from "@/components/pussla/hooks/usePlacementNoteActions";
import { usePlacementPeriodSuggestionDialog } from "@/components/pussla/hooks/usePlacementPeriodSuggestionDialog";
import { useProgressHoverTooltip } from "@/components/pussla/hooks/useProgressHoverTooltip";
import { useSuggestionsPopup } from "@/components/pussla/hooks/useSuggestionsPopup";
import { usePusslaDocumentsAndAuxWorkspace } from "@/components/pussla/hooks/usePusslaDocumentsAndAuxWorkspace";
import { useTimelineLaneInteraction } from "@/components/pussla/hooks/useTimelineLaneInteraction";
import { useAgentTimelineMutationActions } from "@/components/pussla/hooks/useAgentTimelineMutationActions";
import { useAgentPlanningSummaryActions } from "@/components/pussla/hooks/useAgentPlanningSummaryActions";
import { useAgentSelectionPatchActions } from "@/components/pussla/hooks/useAgentSelectionPatchActions";
import { usePusslaAgentWorkspace } from "@/components/pussla/hooks/usePusslaAgentWorkspace";
import { useAiAgentSettingsWorkspace } from "@/components/pussla/hooks/useAiAgentSettingsWorkspace";
import { useColleagueCopyWorkspace } from "@/components/pussla/hooks/useColleagueCopyWorkspace";
import { usePusslaDetailPanelInteractions } from "@/components/pussla/hooks/usePusslaDetailPanelInteractions";
import { useHemklinikWorkspace } from "@/components/pussla/hooks/useHemklinikWorkspace";
import { usePusslaLegacyMilestoneProgress } from "@/components/pussla/hooks/usePusslaLegacyMilestoneProgress";
import { usePusslaIupTimelineWorkspace } from "@/components/pussla/hooks/usePusslaIupTimelineWorkspace";
import { usePusslaListsWorkspace } from "@/components/pussla/hooks/usePusslaListsWorkspace";
import { usePusslaMilestoneDetails } from "@/components/pussla/hooks/usePusslaMilestoneDetails";
import { usePusslaTimeProgressCore } from "@/components/pussla/hooks/usePusslaTimeProgressCore";
import { usePusslaTimeProgressSections } from "@/components/pussla/hooks/usePusslaTimeProgressSections";
import { useSelectedColleagueWorkspace } from "@/components/pussla/hooks/useSelectedColleagueWorkspace";
import { useTemplateChangeNotificationsWorkspace } from "@/components/pussla/hooks/useTemplateChangeNotificationsWorkspace";
import { usePusslaPreviewAndRegistration } from "@/components/pussla/hooks/usePusslaPreviewAndRegistration";
import { usePusslaTimelineCoreOrchestration } from "@/components/pussla/hooks/usePusslaTimelineCoreOrchestration";
import { usePusslaTimelineDragRuntime } from "@/components/pussla/hooks/usePusslaTimelineDragRuntime";







/**
 * Pussla din ST – tidslinje med persistens + registrering
 * - Draft: sparas i localStorage
 * - Låsta objekt från DB (Placeringar/Kurser) där showOnTimeline = true
 * - "Registrera" → förifyllt formulär på rätt sida
 * - "Lås upp" → varning → timeline-ändringar skriver tillbaka till DB
 */

// ---- visuella konstanter för plan-gränser ----
const START_LINE_COLOR = "#0f766e"; // mörkt, lite grågrönt (teal-700-ish) — BT-start
const MID_LINE_COLOR   = "#ca8a04"; // gul (amber-600) — ST-start
const END_LINE_COLOR   = "#b91c1c"; // modern röd (red-700) — ST-slut
const TODAY_LINE_COLOR = "#2563eb"; // blå linje — Idag

const OUTSIDE_BG_CELL =
  "bg-[repeating-linear-gradient(135deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_8px)]"; // diskret diagonalskuggning
const INSIDE_BG_CELL = "bg-white";
const OUTSIDE_BG_LANE =
  "bg-[repeating-linear-gradient(135deg,#eef2f7,#eef2f7_6px,#e6ebf2_6px,#e6ebf2_8px)]";
// lite mörkare grundfärg i kurs-lane
const INSIDE_BG_LANE = "bg-slate-100";

const COURSE_GROUPS_CONFIG_TITLE = "__config__:course-groups";
const PLACEMENT_GROUPS_CONFIG_TITLE = "__config__:placement-groups";

// ---- typer (lokala) ----
type ActivityType =
  | "Klinisk tjänstgöring"
  | "Vetenskapligt arbete"
  | "Förbättringsarbete"
  | "Auskultation"
  | "Forskning"
  | "Tjänstledighet"
  | "Föräldraledighet"
  | "Annan ledighet"
  | "Sjukskriven";

interface Activity {
  id: string;
  type: ActivityType;
  label?: string;          // Placering/Titel/Beskrivning enligt typ
  startSlot: number;       // global halvmånads-slot (0 = startåret Jan H1)
  lengthSlots: number;     // i halvmånader
  hue: number;
  phase?: "BT" | "ST";     // ← NYTT: fas

  // Formulärfält (sparas lokalt, används i listan/popup)
  attendance?: number;     // Sysselsättningsgrad %
  supervisor?: string;
  supervisorSpeciality?: string;
  supervisorSite?: string;
  note?: string;           // Beskrivning
  leaveSubtype?: string;   // Endast "Annan ledighet"
  exactStartISO?: string;  // EXAKT valt startdatum (förändras inte av snapping)
  exactEndISO?: string;    // EXAKT valt slutdatum (förändras inte av snapping)
  milestones?: string[];   // ST-delmål
  btMilestones?: string[]; // BT-delmål

  // Koppling mot DB (för radering/synk), men utan låslogik
  linkedPlacementId?: string;
  intygGroup?: number | null;
  intygGroupConfig?: IntygGroupConfig | null;
}




type CourseKind = "Kurs" | "Konferens" | "Annat" | "Utbildningsmoment";
interface TLcourse {
  id: string;
  title: string;
  kind: CourseKind;

  // Formulärfält
  city?: string;
  courseLeaderName?: string;
  startDate?: string;
  endDate?: string;   // (2015) slut = punkt för kurs i tidslinjen
  certificateDate?: string;
  note?: string;
  courseTitle?: string; // För "Annan kurs" - den anpassade kursens titel
  addToPlacement?: boolean; // Lägg till delmål+beskrivning från utbildningsmoment till överlappande KT
  addToPlacementTargetId?: string; // Vald klinisk tjänstgöring, "__ongoing__" = pågående vid datum

  // Om kursen ska visas som intervall (psykoterapi-logiken) i tidslinjen
  showAsInterval?: boolean;

  // Fas + BT/ST-delmål
  phase?: "BT" | "ST";
  btMilestones?: string[];
  fulfillsStGoals?: boolean;
  milestones?: string[];
  btAssessment?: string;

  // Koppling mot DB (för radering/synk), men utan låslogik
  linkedCourseId?: string;
}


type SupervisionSession = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  title?: string;
};

type AssessmentSession = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  title?: string;
};

type ActivityDocument = {
  id: string;
  user_id: string;
  title: string;
  activity_kind: "placement" | "course" | null;
  activity_id: string | null;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};
const ACTIVITY_DOCUMENT_COLUMNS =
  "id,user_id,title,activity_kind,activity_id,file_path,mime_type,size_bytes,created_at";






// ---- verktyg ----

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
const COLS = 24;

const slotsPerYear = () => SLOT_COLUMNS_PER_YEAR;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const uid = () => Math.random().toString(36).slice(2, 10);
const nextHue = (i: number) => (i * 37) % 360;

// ---- tolerant jämförelse för att ersätta draft med låst DB-post ----

// ---- tolerant jämförelse för att ersätta draft med låst DB-post ----

// =================== /Varningskomponent för glapp ======================


export default function PusslaDinST({
  initialStartYear,
  initialCourses,
}: {
  initialStartYear?: number;
  initialCourses?: TLcourse[];
}) {

const router = useRouter();
// Gör profilens datum-state tillgängligt innan useEffect nedan
const [stStartISO, setStStartISO] = useState<string | null>(null);
const [stEndISO, setStEndISO] = useState<string | null>(null);
const [authUser, setAuthUser] = useState<any>(null);

// Profil (för intyg) – MÅSTE deklareras före alla hooks/effects som använder 'profile' eller 'setProfile'
const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    // CLEANUP: Rensa localStorage draft för att undvika stale state som skriver över DB-datum
    try {
      const draftKey = 'timeline_draft_v2';
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        localStorage.removeItem(draftKey);
      }
    } catch (e) {
      // ignore localStorage access issues
    }

    getSessionUser().then((user) => {
      if (!mounted) return;
      setAuthUser(user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const [profileRefreshTick, setProfileRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const profUid = await resolveUserId({
          authUserId: authUser?.id,
          getSessionUser,
          onResolvedUser: (user) => {
            if (user?.id && !cancelled) setAuthUser(user as any);
          },
        });
        if (!profUid || cancelled) {
          setProfile(null);
          setStStartISO(null);
          setStEndISO(null);
          return;
        }

        const { data: remoteProfile, error } = await fetchProfileById(profUid);
        if (cancelled || error || !remoteProfile) return;

        const mappedProfile = mapPusslaProfileRow(remoteProfile as any) as any;

        setProfile(mappedProfile);
        setStStartISO(
          normalizeISODateOnlyGlobal(mappedProfile.stStartDate) ||
            normalizeISODateOnlyGlobal(mappedProfile.btStartDate) ||
            null
        );
        setStEndISO(
          normalizeISODateOnlyGlobal(mappedProfile.stEndDate) ||
            normalizeISODateOnlyGlobal(mappedProfile.stEndISO) ||
            null
        );
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, profileRefreshTick]);

  useEffect(() => {
    function onProfileSaved() {
      setProfileRefreshTick((prev) => prev + 1);
    }

    window.addEventListener("profile_saved", onProfileSaved);
    return () => {
      window.removeEventListener("profile_saved", onProfileSaved);
    };
  }, []);




  // Synka år när profilens datum dyker upp (2021 → BT-år, annars ST-år)
useEffect(() => {
  const y = computeEffectiveStartYear({
    profile: profile as any,
    fallbackStartYear: startYear,
    isValidISO,
  });
  if (Number.isFinite(y) && y !== startYear) setStartYear(y);
}, [profile, stStartISO]);



  const [startYear, setStartYear] = useState<number>(
  initialStartYear ?? new Date().getFullYear()
);


  const [yearsAbove, setYearsAbove] = useState<number>(0);
  const [yearsBelow, setYearsBelow] = useState<number>(0);

  // Draft-data i tidslinjen (lokal) + länkade från DB (locked)
  const [activities, setActivities] = useState<Activity[]>([]);
  const [courses, setCourses] = useState<TLcourse[]>(initialCourses ?? []);

  // valt objekt
const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
const selectedPlacement = activities.find(a => a.id === selectedPlacementId) || null;

const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
const selectedCourse = courses.find(c => c.id === selectedCourseId) || null;
const selectedPlacementIdRef = useRef<string | null>(selectedPlacementId);
const selectedCourseIdRef = useRef<string | null>(selectedCourseId);

useEffect(() => {
  selectedPlacementIdRef.current = selectedPlacementId;
}, [selectedPlacementId]);

useEffect(() => {
  selectedCourseIdRef.current = selectedCourseId;
}, [selectedCourseId]);


// tabellrad hover – stängs av när man hovrar "Intyg"
const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);


  // vilket kort är aktivt (för gråmarkering av det andra)
  const activeCard: "placement" | "course" | null =
    selectedPlacementId ? "placement" : (selectedCourseId ? "course" : null);

  // ===== Gemensamt formulär under tidslinjen =====
  type Lane = "placement" | "course";
  const [activeLane, setActiveLane] = useState<Lane>("placement");

  // Total planlängd (mån) styr slutdatum: 2015→60, 2021→66. Kan justeras men ej < 0.
  const [totalPlanMonths, setTotalPlanMonths] = useState<number>(60);
  const [restAttendance, setRestAttendance] = useState<number>(100); // “resten av ST:n” sysselsättningsgrad %

  const persistProfilePatch = useCallback(
    async (patch: Record<string, any>) => {
      try {
        setProfile((prev: any) => {
          const base = prev && typeof prev === "object" ? prev : {};
          return { ...base, ...patch };
        });

        const uid = await resolveUserId({
          authUserId: authUser?.id,
          getSessionUser,
          onResolvedUser: (user) => {
            if (user?.id) setAuthUser(user as any);
          },
        });
        if (!uid) return;

        const fieldMap: Record<string, string> = {
          stTotalMonths: "st_total_months",
          stEndAttendance: "st_end_attendance",
          stEndISO: "st_end_iso",
          btStartDate: "bt_start_date",
          btEndDate: "bt_end_date",
          stStartDate: "st_start_date",
          homeClinic: "home_clinic",
          goalsVersion: "goals_version",
          personalNumber: "personal_number",
          postalCode: "postal_code",
          phoneHome: "phone_home",
          phoneWork: "phone_work",
          supervisorWorkplace: "supervisor_workplace",
          studyDirector: "study_director",
          studyDirectorWorkplace: "study_director_workplace",
          medDegreeCountry: "med_degree_country",
          medDegreeDate: "med_degree_date",
          licenseCountry: "license_country",
          licenseDate: "license_date",
          hasForeignLicense: "has_foreign_license",
          foreignLicenses: "foreign_licenses",
          hasPriorSpecialist: "has_prior_specialist",
          priorSpecialties: "prior_specialties",
          isThirdCountrySpecialist: "is_third_country_specialist",
          btMode: "bt_mode",
        };

        const supabasePatch: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const [k, v] of Object.entries(patch)) {
          supabasePatch[fieldMap[k] || k] = v;
        }

        await updateProfileSnakeCase(uid, supabasePatch);
      } catch {
        /* ignore */
      }
    },
    [authUser?.id]
  );

  // Initiera planlängd från profil en gång, och undvik att skriva över manuella ändringar.
  const totalPlanMonthsInitializedRef = useRef(false);
  useEffect(() => {
    const gv = String((profile as any)?.goalsVersion || "").trim();
    const raw = (profile as any)?.stTotalMonths;
    const fromProfile = Number(raw);

    if (Number.isFinite(fromProfile) && fromProfile > 0) {
      if (fromProfile !== totalPlanMonths) setTotalPlanMonths(fromProfile);
      totalPlanMonthsInitializedRef.current = true;
      return;
    }

    // Fallback bara vid första init, så senare profilpatchar (t.ex. stEndISO)
    // inte återställer användarens val.
    if (!totalPlanMonthsInitializedRef.current) {
      setTotalPlanMonths(gv === "2021" ? 66 : 60);
      totalPlanMonthsInitializedRef.current = true;
    }
  }, [(profile as any)?.stTotalMonths, (profile as any)?.goalsVersion, totalPlanMonths]);

useEffect(() => {
  const raw = Number((profile as any)?.stEndAttendance);
  if (!Number.isFinite(raw) || raw <= 0) return;
  const next = Math.max(5, Math.min(100, Math.round(raw / 5) * 5));
  setRestAttendance(next);
}, [profile]);

  // View mode för 2021: BT eller ST
  const [viewMode, setViewMode] = useState<"bt" | "st">("st");
  
  // Data från databas för progress-beräkningar
  const [dbPlacements, setDbPlacements] = useState<any[]>([]);
  const [dbCourses, setDbCourses] = useState<any[]>([]);
  const [dbAchievements, setDbAchievements] = useState<any[]>([]);

  useEffect(() => {
    const y = computeEffectiveStartYear({
      profile: profile as any,
      fallbackStartYear: startYear,
      isValidISO,
      placements: dbPlacements as any[],
      courses: dbCourses as any[],
    });
    if (Number.isFinite(y) && y !== startYear) setStartYear(y);
  }, [profile, stStartISO, dbPlacements, dbCourses, startYear]);
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

const [courseGroupsOrder, setCourseGroupsOrder] = useState<string[]>([]);
const [placementGroupsOrder, setPlacementGroupsOrder] = useState<string[]>([]);

  // Live-uppdatera data från Supabase för progress-beräkningar
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const liveUid = await resolveUserId({
          authUserId: authUser?.id,
          getSessionUser,
          onResolvedUser: (user) => {
            if (user?.id) setAuthUser(user as any);
          },
        });
        if (!liveUid || cancelled) return;

        const [remotePlacementsRes, remoteCoursesRes, remoteAchievementsRes] = await Promise.all([
          listPlacementsByUserId(liveUid),
          listCoursesByUserId(liveUid),
          listAchievementsByUserId(liveUid),
        ]);

        const pls = remotePlacementsRes.error
          ? []
          : (remotePlacementsRes.data || []).map((p: any) => mapPlacementRowForDb(p));

        const crs = remoteCoursesRes.error
          ? []
          : (remoteCoursesRes.data || []).map((c: any) => mapCourseRowForDb(c));

        const ach = remoteAchievementsRes.error
          ? []
          : (remoteAchievementsRes.data || []).map((a: any) => mapAchievementRow(a));

        const prof = profile as any;
        let g: GoalsCatalog | null = null;
        if (prof?.goalsVersion && (prof.specialty || prof.speciality)) {
          try {
            g = await loadGoals(prof.goalsVersion, prof.specialty || prof.speciality);
          } catch {
            g = null;
          }
        }

        if (cancelled) return;
        setDbPlacements(pls);
        setDbCourses(crs);
        setDbAchievements(ach);
        setGoalsCatalog(g ?? null);
      } catch {
        if (cancelled) return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, profile]);

  // Bestäm förinställning för viewMode baserat på dagens datum
  useEffect(() => {
    const gv = String((profile as any)?.goalsVersion || "").trim();
    if (gv !== "2021") return;
    
    const btStart = (profile as any)?.btStartDate;
    if (!btStart) return;
    
    // Beräkna BT-slutdatum
    const btEndManual = (profile as any)?.btEndDate;
    let btEnd: string;
    if (btEndManual && /^\d{4}-\d{2}-\d{2}$/.test(btEndManual)) {
      btEnd = btEndManual;
    } else {
      try {
        const btDate = new Date(btStart + "T00:00:00");
        btDate.setMonth(btDate.getMonth() + 12);
        const mm = String(btDate.getMonth() + 1).padStart(2, "0");
        const dd = String(btDate.getDate()).padStart(2, "0");
        btEnd = `${btDate.getFullYear()}-${mm}-${dd}`;
      } catch {
        return;
      }
    }
    
    const today = todayISO();
    // Om dagens datum ligger inom BT-fasen, sätt till BT, annars ST
    if (today >= btStart && today < btEnd) {
      setViewMode("bt");
    } else {
      setViewMode("st");
    }
  }, [profile]);

  // Hjälpfunktioner för progress-beräkningar
  function todayISO() {
    const d = new Date();
    const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  }

  const monthDiffExact = (startISO?: string, endISO?: string): number => {
    if (!startISO || !endISO) return 0;
    const s = new Date(startISO + "T00:00:00");
    const e = new Date(endISO + "T00:00:00");
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const ms = e.getTime() - s.getTime();
    const days = ms / (1000 * 60 * 60 * 24);
    return Math.max(0, days / 30.4375);
  };

  const pickPercent = (p: any): number => {
    const v = Number(p?.attendance ?? p?.percent ?? p?.sysselsättning ?? 100);
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 100;
  };

  const clampRangeToWindow = (
    rangeStartRaw: unknown,
    rangeEndRaw: unknown,
    windowStartRaw: unknown,
    windowEndRaw: unknown
  ): { startISO: string; endISO: string } | null => {
    const rangeStart = normalizeISODateOnlyGlobal(rangeStartRaw);
    const rangeEnd = normalizeISODateOnlyGlobal(rangeEndRaw);
    const windowStart = normalizeISODateOnlyGlobal(windowStartRaw);
    const windowEnd = normalizeISODateOnlyGlobal(windowEndRaw);
    if (!rangeStart || !rangeEnd || !windowStart || !windowEnd) return null;
    if (!isValidISO(rangeStart) || !isValidISO(rangeEnd) || !isValidISO(windowStart) || !isValidISO(windowEnd)) return null;

    const startISO = rangeStart < windowStart ? windowStart : rangeStart;
    const endISO = rangeEnd > windowEnd ? windowEnd : rangeEnd;
    if (startISO > endISO) return null;

    return { startISO, endISO };
  };

  const workedWindowEndISO = useMemo(() => {
    const today = todayISO();
    const end = normalizeISODateOnlyGlobal(stEndISO);
    if (end && isValidISO(end) && end < today) return end;
    return today;
  }, [stEndISO]);

  useEffect(() => {
    const gvRaw = (profile as any)?.goalsVersion;

    setActivities((prev) => {
      let changed = false;
      const next = prev.map((a: any) => {
        const current = Array.isArray(a?.milestones) ? (a.milestones as unknown[]) : [];
        const sanitized = sanitizeStMilestonesForGoals(current, gvRaw);
        const same =
          current.length === sanitized.length &&
          current.every((v: any, i: number) => String(v) === String(sanitized[i]));
        if (same) return a;
        changed = true;
        return { ...a, milestones: sanitized };
      });
      return changed ? next : prev;
    });

    setCourses((prev) => {
      let changed = false;
      const next = prev.map((c: any) => {
        const current = Array.isArray(c?.milestones) ? (c.milestones as unknown[]) : [];
        const sanitized = sanitizeStMilestonesForGoals(current, gvRaw);
        const same =
          current.length === sanitized.length &&
          current.every((v: any, i: number) => String(v) === String(sanitized[i]));
        if (same) return c;
        changed = true;
        return { ...c, milestones: sanitized };
      });
      return changed ? next : prev;
    });
  }, [(profile as any)?.goalsVersion]);

  const normalizeISODateOnly = (v: any): string | null => {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // Acceptera ISO med tidsdel och plocka datumdelen
    if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = s.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    }
    return null;
  };

  // Beräkna BT-slutdatum
  const btEndISO = useMemo(() => {
    const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
    if (gv !== "2021") return null;
    
    const btStart = (profile as any)?.btStartDate;
    if (!btStart) return null;
    
    const btEndManual = (profile as any)?.btEndDate;
    const manualISO = normalizeISODateOnly(btEndManual);
    if (manualISO) return manualISO;
    
    try {
      const btDate = new Date(btStart + "T00:00:00");
      btDate.setDate(btDate.getDate() + 365);
      return dateToISO(nextSundayOnOrAfter(btDate));
    } catch {
      return null;
    }
  }, [profile]);

  // Hjälpfunktion: avgör om en tjänstgöring är BT-fasad
  const isPlacementBTPhase = useMemo(() => {
    const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
    if (gv !== "2021") return () => false;
    
    const btStart = (profile as any)?.btStartDate;
    if (!btStart || !btEndISO) return () => false;
    
    return (p: any) => {
      if (p.phase === "BT") return true;
      if (p.phase === "ST") return false;
      
      const refDate = p.startDate || p.startISO || p.start || "";
      if (!refDate) return false;
      
      const refMs = new Date(refDate + "T00:00:00").getTime();
      const btStartMs = new Date(btStart + "T00:00:00").getTime();
      const btEndMs = new Date(btEndISO + "T00:00:00").getTime();
      
      if (!Number.isFinite(refMs) || !Number.isFinite(btStartMs) || !Number.isFinite(btEndMs)) {
        return false;
      }
      
      return refMs >= btStartMs && refMs < btEndMs;
    };
  }, [profile, btEndISO]);

  // Registrerad tid för BT-läge
  const workedBtFteMonths = useMemo(() => {
    const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
    if (gv !== "2021") return 0;
    
    const today = todayISO();
    const isBT = isPlacementBTPhase;
    
    return activities.reduce((acc, p: any) => {
      if (!isBT(p)) return acc;

      if (isPlacementZeroAttendance(p)) return acc;
      
      const d = displayDatesForActivity(p);
      const start = d.startISO || p.startDate || p.startISO || p.start || "";
      if (!start) return acc;

      const end = d.endISO || p.endDate || p.endISO || p.end || today;
      const endDate = end > today ? today : end;
      
      const months = monthDiffExact(start, endDate);
      const frac = pickPercent(p) / 100;
      return acc + months * frac;
    }, 0);
  }, [activities, profile, isPlacementBTPhase]);

  // Registrerad tid för ST-läge
  const workedStFteMonths = useMemo(() => {
    const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
    const today = todayISO();
    
    if (gv !== "2021") {
      return activities.reduce((acc, p: any) => {
        if (isPlacementZeroAttendance(p)) return acc;
        const d = displayDatesForActivity(p);
        const start = d.startISO || p.startDate || p.startISO || p.start || "";
        const end = d.endISO || p.endDate || p.endISO || p.end || today;
        const months = monthDiffExact(start, end);
        const frac = pickPercent(p) / 100;
        return acc + months * frac;
      }, 0);
    }
    
    const isBT = isPlacementBTPhase;
    
    return activities.reduce((acc, p: any) => {
      if (isPlacementZeroAttendance(p)) return acc;
      const d = displayDatesForActivity(p);
      const start = d.startISO || p.startDate || p.startISO || p.start || "";
      if (!start) return acc;
      
      const end = d.endISO || p.endDate || p.endISO || p.end || today;
      const months = monthDiffExact(start, end);
      const frac = pickPercent(p) / 100;
      
      if (!isBT(p)) {
        return acc + months * frac;
      }
      
      if (p.fulfillsStGoals) {
        return acc + months * frac;
      }
      
      return acc;
    }, 0);
  }, [activities, profile, isPlacementBTPhase]);

  // Total tid från BT-start till ST-slut (för 2021) eller ST-start till ST-slut (för 2015)
  const totalCombinedMonths = useMemo(() => {
    return computeTotalCombinedMonths({
      goalsVersion: (profile as any)?.goalsVersion || undefined,
      btStartDate: (profile as any)?.btStartDate,
      stStartDate: stStartISO || (profile as any)?.stStartDate,
      stEndDate: (profile as any)?.stEndDate,
      stEndISO,
      totalPlanMonths,
      isValidISO,
      monthDiffExact,
    });
  }, [profile, stStartISO, stEndISO, totalPlanMonths]);

  const { workedCombinedFteDays, totalCombinedDays, progressPct } = usePusslaTimeProgressCore({
    activities: activities as any[],
    profile,
    stStartISO,
    stEndISO,
    workedWindowEndISO,
    isValidISO,
    isPlacementZeroAttendance,
    displayDatesForActivity: (activity: any) => displayDatesForActivity(activity),
    clampRangeToWindow,
    pickPercent,
  });

  // Legacy delmålsberäkningar (behålls för bakåtkompatibel logik)
  const { totalMilestones, fulfilledMilestones } = usePusslaLegacyMilestoneProgress({
    profile,
    dbAchievements: dbAchievements as any[],
    dbPlacements: dbPlacements as any[],
    dbCourses: dbCourses as any[],
    goalsCatalog,
    todayISO,
  });

  // Behåll (legacy) beräkningar men undvik "unused"-varningar.
  void totalMilestones;
  void fulfilledMilestones;

  // Beräkningar för detaljvy: BT/ST-tid och färgade aktivitetsegment
  const { timeDetails, timeByActivity } = usePusslaTimeProgressSections({
    profile,
    btEndISO,
    stStartISO,
    stEndISO,
    activities: activities as any[],
    workedWindowEndISO,
    isZeroAttendanceType,
    displayDatesForActivity: (activity: any) => displayDatesForActivity(activity),
    clampRangeToWindow,
  });

  // Beräkningar för detaljvy: BT/ST delmål separat
  const milestoneDetails = usePusslaMilestoneDetails({
    profile,
    dbAchievements: dbAchievements as any[],
    dbPlacements: dbPlacements as any[],
    dbCourses: dbCourses as any[],
    goalsCatalog,
    todayISO,
  });

  // Procentsatsen på huvudvyn ska matcha popupen: ST-rutor (klin/arb + kurs)
  const milestoneProgressPct = useMemo(() => {
    const total = Number((milestoneDetails as any)?.st?.total ?? 0);
    const fulfilled = Number((milestoneDetails as any)?.st?.fulfilled ?? 0);
    if (!total || total <= 0) return 0;
    const raw = (fulfilled / total) * 100;
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(100, raw));
  }, [milestoneDetails]);

  const { listPlac, setListPlac, listCourses, setListCourses, refreshLists } = usePusslaListsWorkspace({
    authUserId: authUser?.id,
    getSessionUser,
    setAuthUser,
    resolveUserId,
    listPlacementsByUserId,
    listCoursesByUserId,
    mapPlacementRowForList,
    mapCourseRowForList,
  });

// Skanna-intyg modal (öppnas via knappen i rubriken)
  const [scanOpen, setScanOpen] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [btModalOpen, setBtModalOpen] = useState(false);
  const [milestoneOverviewOpen, setMilestoneOverviewOpen] = useState(false);
   const [iupOpen, setIupOpen] = useState(false);
  const [iupInitialTab, setIupInitialTab] = useState<
    "handledning" | "progression" | "planering" | "delmal" | "rapport" | null
  >(null);
  const [iupInitialMeetingId, setIupInitialMeetingId] = useState<string | null>(null);
  const [iupInitialAssessmentId, setIupInitialAssessmentId] =
    useState<string | null>(null);
  const [iupInitialDirectorMeetingId, setIupInitialDirectorMeetingId] = useState<string | null>(null);
  const [iupInitialSpecialistCollegiumId, setIupInitialSpecialistCollegiumId] = useState<string | null>(null);
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);
  const {
    supervisionSessions,
    setSupervisionSessions,
    hoveredSupervisionId,
    setHoveredSupervisionId,
    assessmentSessions,
    setAssessmentSessions,
    hoveredAssessmentId,
    setHoveredAssessmentId,
    directorMeetingSessions,
    setDirectorMeetingSessions,
    hoveredDirectorMeetingId,
    setHoveredDirectorMeetingId,
    specialistCollegiumSessions,
    setSpecialistCollegiumSessions,
    hoveredSpecialistCollegiumId,
    setHoveredSpecialistCollegiumId,
    showSupervisionOnTimeline,
    setShowSupervisionOnTimeline,
    showAssessmentsOnTimeline,
    setShowAssessmentsOnTimeline,
    showDirectorMeetingsOnTimeline,
    setShowDirectorMeetingsOnTimeline,
    showSpecialistCollegiumsOnTimeline,
    setShowSpecialistCollegiumsOnTimeline,
  } = usePusslaIupTimelineWorkspace();





// Wrappers som använder aktuellt component-state
const phaseForSlots = (startSlot: number, lengthSlots: number) => {
  // För 2015-spåret finns ingen BT-fas – allt är ST
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
  if (gv !== "2021") return "ST";

  const btStartISO: string | null = (profile as any)?.btStartDate ?? null;
  const btEndEffISO: string | null = btEndISO ?? (profile as any)?.btEndDate ?? null;
  if (!btStartISO || !btEndEffISO) return "ST";

  void lengthSlots;
  return computePlacementPhaseFromBtWindow({
    startYear,
    startSlot,
    btStartISO,
    btEndISO: btEndEffISO,
    slotToYearMonthHalf,
    mondayNearestTo,
    dateToISO,
  });
};

const {
  placementPeriodSuggestionDialog,
  setPlacementPeriodSuggestionDialog,
  closePlacementPeriodSuggestionDialog,
  applyPlacementPeriodSuggestion,
} = usePlacementPeriodSuggestionDialog({
  startYear,
  isValidISO,
  dateToSlot,
  resolveLengthSlotsForExactEnd,
  phaseForSlots,
  setActivities: setActivities as any,
});

const {
  overlapWarning,
  overlapSuggestion,
  setOverlapWarning,
  setOverlapSuggestion,
  clearOverlapState,
  applyOverlapSuggestion,
} = useOverlapSuggestion({
  selectedPlacement: selectedPlacement ? ({ id: selectedPlacement.id } as any) : null,
  startYear,
  isValidISO,
  dateToSlot,
  resolveLengthSlotsForExactEnd,
  phaseForSlots,
  setActivities: setActivities as any,
});

const applyPlacementDates = useApplyPlacementDates({
  selectedPlacement: selectedPlacement as any,
  activities: activities as any,
  startYear,
  isValidISO,
  dateToISO,
  dateToSlot,
  roundToAnchors,
  slotToYearMonthHalf,
  mondayNearestTo,
  sundayBeforeAnchor,
  resolveLengthSlotsForExactEnd,
  phaseForSlots,
  setActivities: setActivities as any,
  setOverlapWarning,
  setOverlapSuggestion,
});

const phaseForCourseDates = (startISO?: string) => {
  // För 2015-spåret finns ingen BT-fas – allt är ST
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
  if (gv !== "2021") return "ST";

  const prof: any = profile || {};
  const btStartISO: string | null = prof?.btStartDate || null;
  const btEndManual: string | null = prof?.btEndDate || null;

  // Effektivt BT-slut: manuellt fält (om angivet) annars 24 månader efter BT-start
  let btEndISO: string | null = btEndManual;
  if (btStartISO && !btEndManual && isValidISO(btStartISO)) {
    try {
      const d = isoToDateSafe(btStartISO);
      btEndISO = dateToISO(addMonths(d, 24));
    } catch {
      btEndISO = null;
    }
  }

  return phaseForCourseDatesCore(
    btStartISO,
    btEndISO,
    startISO,
    isValidISO
  );
};




// 2021/2015-val beräknas först när profil finns
const is2021 = useMemo(
  () => normalizeGoalsVersion((profile as any)?.goalsVersion) === "2021",
  [profile]
);

// Ingen automatisk phasning av kurser vid profiländringar
useEffect(() => {
  // medvetet tomt: behåll befintlig c.phase
}, [profile, startYear]);





const [settingsOpen, setSettingsOpen] = useState(false);
const [saveInfoOpen, setSaveInfoOpen] = useState(false);
const [reportOpen, setReportOpen] = useState(false);
const [profileOpen, setProfileOpen] = useState(false);
const [aboutOpen, setAboutOpen] = useState(false);
const {
  aiAgentMenuOpen,
  setAiAgentMenuOpen,
  aiAgentEnabled,
  setAiAgentEnabled,
  aiAgentMenuTab,
  setAiAgentMenuTab,
  aiAgentConfirmMode,
  setAiAgentConfirmMode,
  aiAgentProvider,
  setAiAgentProvider,
  aiAgentModels,
  setAiAgentModels,
  aiAgentModelOptions,
  aiAgentModelsLoading,
  aiAgentUnlockedKeys,
  setAiAgentUnlockedKeys,
  aiAgentActivationPromptOpen,
  setAiAgentActivationPromptOpen,
  aiAgentPassphrase,
  setAiAgentPassphrase,
  aiAgentNewApiKey,
  setAiAgentNewApiKey,
  aiAgentNewPassphrase,
  setAiAgentNewPassphrase,
  aiAgentReplaceKeyMode,
  setAiAgentReplaceKeyMode,
  aiAgentMsg,
  setAiAgentMsg,
  aiAgentInfoOpen,
  setAiAgentInfoOpen,
  aiAgentInfoTab,
  setAiAgentInfoTab,
  saveAiAgentKey,
  unlockAiAgent,
  lockAiAgent,
} = useAiAgentSettingsWorkspace({ authUserId: authUser?.id });
const {
  popupFor: forslagPopupFor,
  setPopupFor: setForslagPopupFor,
  tab: forslagTab,
  setTab: setForslagTab,
} = useSuggestionsPopup({ selectedPlacementId, selectedCourseId });
const {
  updatePlacementSupervisor,
  updatePlacementSupervisorSpeciality,
  updatePlacementSupervisorSite,
  updatePlacementBtAssessment,
} = usePlacementDetailFieldActions({
  selectedPlacement: selectedPlacement as any,
  setActivities: setActivities as any,
});
const onBtEndChange = useBtEndDateChange({
  isValidISO,
  setProfile,
  authUserId: authUser?.id,
  getSessionUser,
  setAuthUser,
  resolveUserId,
  updateProfileSnakeCase,
});
const { createProgressHoverEnterHandler, clearProgressHover } = useProgressHoverTooltip({
  setHoveredTimeAct: setHoveredTimeAct as any,
});
const {
  updatePlacementNote,
  appendPlacementStudierektorRow,
  appendPlacementColleagueDescription,
  closePlacementSuggestions,
  togglePlacementSuggestions,
} = usePlacementNoteActions({
  selectedPlacement: selectedPlacement as any,
  setActivities: setActivities as any,
  forslagPopupFor,
  setForslagPopupFor,
});
const [activitiesTableOpen, setActivitiesTableOpen] = useState(true);
const {
  hemklinikOpen,
  setHemklinikOpen,
  hemklinikTab,
  setHemklinikTab,
  hemklinikMessages,
  hemklinikSentMessages,
  hemklinikMailbox,
  hemklinikComposeRecipients,
  setHemklinikComposeRecipients,
  hemklinikComposeText,
  setHemklinikComposeText,
  hemklinikComposeSending,
  hemklinikComposeOpen,
  setHemklinikComposeOpen,
  hemklinikRecipientPickerOpen,
  setHemklinikRecipientPickerOpen,
  hemklinikSuggestions,
  hemklinikColleagues,
  hemklinikLoading,
  hemklinikSuggestionDetail,
  setHemklinikSuggestionDetail,
  hemklinikContactDetail,
  setHemklinikContactDetail,
  hemklinikMailboxRows,
  hemklinikSelectedMessage,
  hemklinikPrimaryContacts,
  colleaguePlacementDescriptions,
  colleagueCourseDescriptions,
  sendHemklinikMessage,
  removeHemklinikMessage,
  dismissHemklinikSuggestion,
  switchHemklinikMailbox,
  handleOpenHemklinikMessage,
} = useHemklinikWorkspace();
const {
  activityTemplateChangeQueue,
  activityTemplateChangeOpen,
  setActivityTemplateChangeOpen,
  templateChangeCurrent,
  acknowledgeTemplateChangeNotice,
  handleTemplateDeletedChangeActivity,
  handleTemplateDeletedRemoveActivity,
} = useTemplateChangeNotificationsWorkspace({
  authUserId: authUser?.id,
  activities: activities as any[],
  courses: courses as any[],
  selectedPlacementId,
  selectedCourseId,
  setSelectedPlacementId,
  setSelectedCourseId,
  setActivities: (updater: any) => setActivities(updater),
  setCourses: (updater: any) => setCourses(updater),
});
const {
  selectedColleague,
  setSelectedColleague,
  colleagueData,
  colleagueLoading,
  colleagueActivityDetail,
  setColleagueActivityDetail,
} = useSelectedColleagueWorkspace();
const [colleagueCopiedToast, setColleagueCopiedToast] = useState(false);
const [colleagueMilestoneCopyDialog, setColleagueMilestoneCopyDialog] = useState<{show:boolean;type:'add'|'replace'|'select'|'confirm'|'ask'|null;placements?:any[];selectedPlacement?:any}>({show:false,type:null});
const [colleagueDescCopyDialog, setColleagueDescCopyDialog] = useState<{show:boolean;type:'add'|'replace'|'select'|'confirm'|'ask'|null;placements?:any[];selectedPlacement?:any}>({show:false,type:null});
const [colleagueWarningDialog, setColleagueWarningDialog] = useState<{show:boolean;message:string}>({show:false,message:''});
const [colleagueMainTab, setColleagueMainTab] = useState<'utbildningsmoment'|'kontaktuppgifter'>('utbildningsmoment');
const {
  colleagueFormatDate,
  colleagueCalculateMonths,
  colleagueBirthDate,
  colleagueActivityKind,
  handleApplyColleagueMilestones,
  handleApplyColleagueDescription,
  handleRequestCopyColleagueMilestones,
  handleRequestCopyColleagueDescription,
} = useColleagueCopyWorkspace({
  colleagueActivityDetail,
  colleagueData,
  profile,
  activities,
  courses,
  setActivities,
  setCourses,
  setColleagueCopiedToast,
  setColleagueMilestoneCopyDialog,
  setColleagueDescCopyDialog,
  setColleagueWarningDialog,
});

const [goHomeWarnOpen, setGoHomeWarnOpen] = useState(false);
const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

// Visa: 'both' | 'BT' | 'ST'
const [viewPhase, setViewPhase] = useState<'both' | 'BT' | 'ST'>('both');





const [goals, setGoals] = useState<GoalsCatalog | null>(null);
const [achievements, setAchievements] = useState<any[]>([]);

useEffect(() => {
  (async () => {
    try {
      const prof = profile as any;
      const spec: "psykiatri" | "allmanmedicin" = (prof?.speciality || prof?.specialty || "psykiatri");
      const ver = (prof?.goalsVersion || "st_2021");
      const g = await loadGoals(ver, spec);
      setGoals(g);
    } catch { /* ignore */ }

    try {
      let achUid = authUser?.id;
      if (!achUid) {
        const user = await getSessionUser();
        achUid = user?.id;
      }
      if (achUid) {
        const { data: remoteAchievements, error } = await listAchievementsByUserId(achUid);

        if (!error && Array.isArray(remoteAchievements)) {
          setAchievements(remoteAchievements.map((a: any) => mapAchievementRow(a)));
        } else {
          setAchievements([]);
        }
      } else {
        setAchievements([]);
      }
    } catch {
      setAchievements([]);
    }
  })();
}, [authUser?.id, profile]);




  // MilestonePicker (Välj delmål)
const [milestonePicker, setMilestonePicker] = useState<{ open: boolean; mode: "course" | "placement" | null }>({
  open: false,
  mode: null,
});
// BT-MilestonePicker (BT-delmål)
const [btMilestonePicker, setBtMilestonePicker] = useState<{ open: boolean; mode: "course" | "placement" | null }>({
  open: false,
  mode: null,
});

// States för att öppna enskilda delmål från detaljrutan (read-only)
const [stMilestoneDetail, setStMilestoneDetail] = useState<string | null>(null);
const [btMilestoneDetail, setBtMilestoneDetail] = useState<string | null>(null);




  // beräkna längd (5 år + ev. perioder som inte räknas som tjänstgöring, t.ex. ledighet och forskning)
  const extraLeaveSlots = useMemo(
    () =>
      activities
        .filter((a) => isZeroAttendanceType(a.type))
        .reduce((acc, a) => acc + (Number.isFinite(a.lengthSlots) ? a.lengthSlots : 0), 0),
    [activities]
  );
  // Baseras helt på användarens totalPlanMonths (ex. 60 för 2015, 66 för 2021)
  const baseSlots = Math.max(0, totalPlanMonths) * 2;
  const totalSlots = baseSlots + extraLeaveSlots;





// Globala slots för grön/röd gräns (för radexpansion + korrekt randning)
const hasValidStStartISO = typeof stStartISO === "string" && isValidISO(stStartISO);
const hasValidStEndISO = typeof stEndISO === "string" && isValidISO(stEndISO);

const startBoundarySlotGlobal = hasValidStStartISO
  ? dateToSlot(startYear, stStartISO as string, "start")
  : 0;
const endBoundarySlotGlobal = hasValidStEndISO
  ? dateToSlot(startYear, stEndISO as string, "end")
  : (hasValidStStartISO ? startBoundarySlotGlobal + baseSlots : totalSlots);

// Antal år som behövs: visa exakt från startår till slutår (inget extra)
const endYearFromEndSlot = Number.isFinite(endBoundarySlotGlobal)
  ? slotToYearMonthHalf(startYear, endBoundarySlotGlobal as number).year
  : startYear;
const totalYearsNeeded = Math.min(200, Math.max(1, endYearFromEndSlot - startYear + 1));
const visibleYearCount = totalYearsNeeded;


  // ---- SR-mallar (placeringar + kurser) ----
  const [srPlacementTemplates, setSrPlacementTemplates] = useState<{id:string;title:string;description:string;suggested_milestones:string[];suggested_rows:string[]}[]>([]);
  const [srCourseTemplates, setSrCourseTemplates] = useState<{id:string;title:string;description:string;suggested_milestones:string[];suggested_rows:string[];is_metis:boolean}[]>([]);
  const [srUtbildningsmomentTemplates, setSrUtbildningsmomentTemplates] = useState<{id:string;title:string;description:string;track_completions:boolean;suggested_milestones:string[];suggested_rows:string[]}[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const uid = await getAuthenticatedUserId();
        if (!uid) return;
        const { data: mem } = await fetchClinicMembershipForUser(uid);
        const clinicId = mem?.clinic_id;
        if (!clinicId) return;
        const { data } = await listActiveClinicActivityTemplatesByClinicId(String(clinicId));
        const { data: groupConfigRow } = await fetchClinicActivityTemplateSuggestedRowsByTitle(
          String(clinicId),
          COURSE_GROUPS_CONFIG_TITLE
        );
        const { data: placementGroupConfigRow } = await fetchClinicActivityTemplateSuggestedRowsByTitle(
          String(clinicId),
          PLACEMENT_GROUPS_CONFIG_TITLE
        );
        if (data) {
          const notConfigRow = (r: any) => !String(r?.title || "").trim().startsWith("__config__:");
          setSrPlacementTemplates(
            data
              .filter(notConfigRow)
              .filter((r: any) => r.type === "placering")
              .map((r: any) => ({
                id: r.id,
                title: r.title,
                description: r.description || "",
                suggested_milestones: r.suggested_milestones || [],
                suggested_rows: r.suggested_rows || [],
              }))
          );
          setSrCourseTemplates(
            data
              .filter(notConfigRow)
              .filter((r: any) => r.type === "kurs")
              .map((r: any) => ({
                id: r.id,
                title: r.title,
                description: r.description || "",
                suggested_milestones: r.suggested_milestones || [],
                suggested_rows: r.suggested_rows || [],
                is_metis: r.is_metis || false,
              }))
          );
          setSrUtbildningsmomentTemplates(
            data
              .filter(notConfigRow)
              .filter((r: any) => r.type === "annan")
              .map((r: any) => ({
                id: r.id,
                title: r.title,
                description: r.description || "",
                track_completions: r.track_completions || false,
                suggested_milestones: r.suggested_milestones || [],
                suggested_rows: r.suggested_rows || [],
              }))
          );
        }
        const dbGroupOrder = parseCourseGroupsConfig(
          Array.isArray((groupConfigRow as any)?.suggested_rows)
            ? ((groupConfigRow as any).suggested_rows as string[])
            : []
        );
        if (dbGroupOrder.length > 0) {
          setCourseGroupsOrder(dbGroupOrder);
        }
        const dbPlacementGroupOrder = parseCourseGroupsConfig(
          Array.isArray((placementGroupConfigRow as any)?.suggested_rows)
            ? ((placementGroupConfigRow as any).suggested_rows as string[])
            : []
        );
        if (dbPlacementGroupOrder.length > 0) {
          setPlacementGroupsOrder(dbPlacementGroupOrder);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // ---- LOKAL DRAFT-STATE ----
const [typeDraft, setTypeDraft] = useState<ActivityType>("Klinisk tjänstgöring");
const [labelDraft, setLabelDraft] = useState<string>("");
const [monthsDraft, setMonthsDraft] = useState<number>(1);

const [courseTypeDraft, setCourseTypeDraft] = useState<CourseKind>("Kurs");
const [courseTitleDraft, setCourseTitleDraft] = useState<string>("");
const [courseDateDraft, setCourseDateDraft] = useState<string>("");

// ---- Övrigt UI-state ----


// Dismissade glapp – sparas inte längre i Dexie
const [dismissedGaps, setDismissedGaps] = useState<string[]>([]);


// NYTT: Varningsmarkeringar per rad (ingen popup)
const [btstWarnActIds, setBtstWarnActIds] = useState<Set<string>>(new Set());
const [btstWarnCourseIds, setBtstWarnCourseIds] = useState<Set<string>>(new Set());

// NYTT: Liten popup-meny vid dubbelklick (placering)
const [certMenu, setCertMenu] = useState<{
  open: boolean;
  x: number;
  y: number;
  kind: "placement" | "course" | null;
  placement: Activity | null;
  course: TLcourse | null;
}>({
  open: false,
  x: 0,
  y: 0,
  kind: null,
  placement: null,
  course: null,
});

const [documentsOpen, setDocumentsOpen] = useState(false);
const [documentsFolderKey, setDocumentsFolderKey] = useState<string>("global:");
const [documents, setDocuments] = useState<ActivityDocument[]>([]);
const [documentsLoading, setDocumentsLoading] = useState(false);
const [documentsUploading, setDocumentsUploading] = useState(false);
const [documentsSidebarWidth, setDocumentsSidebarWidth] = useState(260);
const [documentsShowDates, setDocumentsShowDates] = useState(true);
const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null);
const [dragOverFolderKey, setDragOverFolderKey] = useState<string | null>(null);
const [documentsPlacementsOpen, setDocumentsPlacementsOpen] = useState(true);
const [documentsCoursesOpen, setDocumentsCoursesOpen] = useState(true);
const [documentsCustomFolders, setDocumentsCustomFolders] = useState<string[]>([]);
const [newDocumentsFolderName, setNewDocumentsFolderName] = useState("");
const [editingFolderKey, setEditingFolderKey] = useState<string | null>(null);
const [editingFolderValue, setEditingFolderValue] = useState("");
const [documentsUploadDragActive, setDocumentsUploadDragActive] = useState(false);
const documentsUploadInputRef = useRef<HTMLInputElement | null>(null);
const documentsUploadDropzoneRef = useRef<HTMLDivElement | null>(null);
const [searchOpen, setSearchOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
const [dirty, setDirty] = useState(false);


  const {
    laneWidthByYear,
    onLaneElement,
    getChipWidth,
    setChipWidth,
    setHover,
    courseHoverSpot,
    updateCourseHoverSpot,
    clearCourseHoverSpotForCell,
  } = useTimelineLaneInteraction();


  // ---- overlap-hjalp for placeringar ----
  const wouldOverlap = (id: string | null, startSlot: number, lengthSlots: number) =>
    wouldOverlapInActivities(activities as any[], id, startSlot, lengthSlots);

  /** Nasta placering till hoger (min startSlot >= nuvarande blocks exklusiva slut). */
  const findPlacementToRight = (targetId: string): Activity | null =>
    (findPlacementToRightInActivities(activities as any[], targetId) as Activity | null);

  const {
    restoreBaseline,
    savePlacementToDb,
    saveCourseToDb,
    addActivityAt,
    updateSelectedPlacement,
    onTypeChange,
    onLabelChange,
    onMonthsChange,
    createCourseAt,
    createPlacementFromDateRange,
    createCourseFromDateRange,
    updateSelectedCourse,
  } = usePusslaTimelineCoreOrchestration({
    activities: activities as any[],
    courses: courses as any[],
    profile,
    stStartISO,
    startYear,
    computeEducationalGaps,
    normalizeGoalsVersion,
    isoToDateSafe,
    dateToISO,
    addMonths,
    slotToYearMonthHalf,
    mondayNearestTo,
    sundayNearestTo,
    setDismissedGaps,
    setBtstWarnActIds,
    setBtstWarnCourseIds,
    profileRefreshTick,
    totalYearsNeeded,
    authUserId: authUser?.id,
    isValidISO,
    getSessionUser,
    fetchProfileById,
    mapPusslaProfileRow,
    ensureProfile: ensureProfile as any,
    normalizeISODateOnlyGlobal,
    setProfile,
    setStStartISO,
    setStEndISO,
    resolveUserId: resolveUserId as any,
    setAuthUser: setAuthUser as any,
    fetchLockedTimelineRows: fetchLockedTimelineRows as any,
    computeEffectiveStartYear: computeEffectiveStartYear as any,
    setStartYear,
    mapLockedPlacementsToActivities: mapLockedPlacementsToActivities as any,
    mapLockedCoursesToTimeline: mapLockedCoursesToTimeline as any,
    phaseForCourseDates: phaseForCourseDates as any,
    dateToSlot,
    nextHue,
    inferPlacementPhaseByProfileBt: inferPlacementPhaseByProfileBt as any,
    sanitizeTimelineDrafts: sanitizeTimelineDrafts as any,
    composeHydratedTimelineState: composeHydratedTimelineState as any,
    slotsPerYear,
    resolvePendingScanSelection: resolvePendingScanSelection as any,
    setSelectedPlacementId,
    setSelectedCourseId,
    setActiveLane,
    setActivities: setActivities as any,
    setCourses: setCourses as any,
    setYearsAbove,
    setYearsBelow,
    selectedPlacementId,
    selectedCourseId,
    selectedPlacement: selectedPlacement as any,
    selectedCourse: selectedCourse as any,
    setDirty,
    isPlacementDirty: isPlacementDirty as any,
    isCourseDirty: isCourseDirty as any,
    authUser,
    sundayBeforeAnchor,
    isPlacementInBtWindow,
    getEffectiveBtWindow,
    sanitizeStMilestonesForGoals,
    buildPlacementSupabaseRecord,
    buildCourseSupabaseRecord,
    ensureUserId,
    saveEntityRow,
    supabase,
    mapPlacementRowForList,
    mapPlacementRowForDb,
    mapCourseRowForList,
    mapCourseRowForDb,
    upsertById,
    perfMark,
    perfMeasure,
    setOverlapWarning,
    setListPlac: setListPlac as any,
    setDbPlacements: setDbPlacements as any,
    setListCourses: setListCourses as any,
    setDbCourses: setDbCourses as any,
    isIsoInBtWindow,
    logAudit,
    uid,
    wouldOverlap,
    switchActivity: ((newPlacementId: string | null, newCourseId: string | null) =>
      switchActivity(newPlacementId, newCourseId)) as any,
    computePhaseByEndSlot: computePhaseByEndSlot as any,
    mapMetisGoalsToMilestoneIds: mapMetisGoalsToMilestoneIds as any,
    selectedCourseIdRef: selectedCourseIdRef as any,
    btEndISO,
    todayISO,
    setTypeDraft: setTypeDraft as any,
    setLabelDraft,
    setMonthsDraft,
    dirty,
  });






  const { dragPlacementRef, dragCourseRef } = usePusslaTimelineDragRuntime({
    activeCard,
    selectedCourseId,
    selectedPlacementId,
    setCourses: (updater: any) => setCourses(updater as any),
    setActivities: (updater: any) => setActivities(updater as any),
    setActiveLane,
    computePhaseByEndSlot,
    computeMondayDates: (activity: any) => computeMondayDates(activity as Activity),
    applyCourseDatesFromSlots,
    applyActivityDatesFromSlots,
    profile,
    btEndISO,
    startYear,
    slotToYearMonthHalf,
    mondayNearestTo,
    dateToISO,
    wouldOverlap,
    visibleYearCount,
    slotsPerYear,
    pointerToGlobalDelta,
    clamp,
    computeMoveStartNoOverlap,
    applyMovePlacement,
    resolveMovedPlacementPhase,
    adjustResizeLeftNoOverlap,
    applyResizeLeftPlacement,
    phaseForSlots,
    adjustResizeRightNoOverlap,
    applyResizeRightPlacement,
    computeCourseDragDate,
    totalYearsNeeded,
    daysInYear,
    phaseForCourseDates,
    buildDraggedCourse,
    activities: activities as any[],
    courses: courses as any[],
  });


  // sync drafts med valt objekt — ÄNDRAT: lyssna även på activities/cour



  // sync drafts med valt objekt — ÄNDRAT: lyssna även på activities/courses för live-uppdatering
  useEffect(() => {
    if (!selectedPlacementId) return;
    const a = activities.find(x => x.id === selectedPlacementId);
    if (!a) return;
    setTypeDraft(a.type);
    setLabelDraft(a.label || "");
    setMonthsDraft(Math.max(0.5, a.lengthSlots / 2)); // följer live
  }, [selectedPlacementId, activities]);

  useEffect(() => {
    if (!selectedCourseId) return;
    const c = courses.find(x => x.id === selectedCourseId);
    if (!c) return;
    setCourseTypeDraft(c.kind);
    setCourseTitleDraft(c.title);
    setCourseDateDraft(c.certificateDate || ""); // följer live
  }, [selectedCourseId, courses]);

  function computePhaseByEndSlot(startSlot: number, lengthSlots: number): "BT" | "ST" {
    try {
      const dummyActivity: any = {
        id: "_phase",
        type: "Kurs",
        label: "",
        startSlot,
        lengthSlots: Math.max(1, lengthSlots),
      };
      const { startISO, endISO } = computeMondayDates(dummyActivity);
      return inferPhaseByBTRuntime({
        startISO,
        endISO,
        profile,
        isValidISO,
        isoToDateSafe,
        dateToISO,
      });
    } catch {
      return "ST";
    }
  }

  // minus-knappar (yttersta år)
  function yearHasCourse(y: number) {
    return courses.some((c) => {
      const cert = c.certificateDate || "";
      return isValidISO(cert) && new Date(cert + "T00:00:00").getFullYear() === y;
    });
  }
  function yearHasActivity(y: number) {
    const yStart = (y - startYear) * slotsPerYear();
    const yEnd = yStart + slotsPerYear();
    return activities.some(a => a.startSlot < yEnd && (a.startSlot + a.lengthSlots) > yStart);
  }
  function yearHasData(y: number) { return yearHasCourse(y) || yearHasActivity(y); }

  const activitiesByYear = useMemo(() => {
    const map = new Map<number, Activity[]>();
    const YEAR_MIN = 1900;
    const YEAR_MAX = 2200;
    const MAX_SPAN_YEARS = 20;
    for (const a of activities) {
      const a0 = a?.startSlot;
      const len = a?.lengthSlots;
      if (!Number.isFinite(a0) || !Number.isFinite(len)) continue;
      const endSlot = (a0 as number) + Math.max(1, len as number) - 1;
      const y0 = slotToYearMonthHalf(startYear, a0 as number).year;
      const y1 = slotToYearMonthHalf(startYear, endSlot).year;
      if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
      if (y0 < YEAR_MIN || y0 > YEAR_MAX) continue;
      if (y1 < YEAR_MIN || y1 > YEAR_MAX) continue;
      const from = Math.min(y0, y1);
      const to = Math.max(y0, y1);
      if (to - from > MAX_SPAN_YEARS) continue;
      for (let y = from; y <= to; y++) {
        const arr = map.get(y);
        if (arr) arr.push(a);
        else map.set(y, [a]);
      }
    }
    return map;
  }, [activities, startYear]);

  function renderYearRow(rowIndex: number) {
    return (
      <TimelineYearRow
        key={rowIndex}
        rowIndex={rowIndex}
        startYear={startYear}
        totalYearsNeeded={totalYearsNeeded}
        totalSlots={totalSlots}
        baseSlots={baseSlots}
        stStartISO={stStartISO}
        stEndISO={stEndISO}
        profile={profile}
        courses={courses}
        dragCourse={dragCourseRef.current ? { id: dragCourseRef.current.id, year: dragCourseRef.current.year } : null}
        isValidISO={isValidISO}
        dateToSlot={dateToSlot}
        isoToDateSafe={isoToDateSafe}
        cols={COLS}
        monthNames={MONTH_NAMES}
        insideBgCell={INSIDE_BG_CELL}
        outsideBgCell={OUTSIDE_BG_CELL}
        insideBgLane={INSIDE_BG_LANE}
        outsideBgLane={OUTSIDE_BG_LANE}
        selectedPlacementId={selectedPlacementId}
        selectedCourseId={selectedCourseId}
        dirty={dirty}
        closeDetailPanel={closeDetailPanel}
        clearSelection={() => {
          setSelectedPlacementId(null);
          setSelectedCourseId(null);
        }}
        addActivityAt={addActivityAt}
        createCourseAt={(iso, kind) => createCourseAt(iso, kind as CourseKind)}
        setHover={setHover}
        updateCourseHoverSpot={updateCourseHoverSpot}
        clearCourseHoverSpotForCell={clearCourseHoverSpotForCell}
        slotToYearMonthHalf={slotToYearMonthHalf}
        dateToISO={dateToISO}
        startLineColor={START_LINE_COLOR}
        midLineColor={MID_LINE_COLOR}
        endLineColor={END_LINE_COLOR}
        todayLineColor={TODAY_LINE_COLOR}
        addMonths={addMonths}
        courseHoverSpot={courseHoverSpot}
        activitiesForYear={activitiesByYear.get(startYear + rowIndex) ?? []}
        switchActivity={switchActivity}
        setActiveLane={setActiveLane}
        dragPlacementRef={dragPlacementRef}
        laneWidthByYear={laneWidthByYear}
        onLaneElement={onLaneElement}
        showSpecialistCollegiumsOnTimeline={showSpecialistCollegiumsOnTimeline}
        showDirectorMeetingsOnTimeline={showDirectorMeetingsOnTimeline}
        showSupervisionOnTimeline={showSupervisionOnTimeline}
        showAssessmentsOnTimeline={showAssessmentsOnTimeline}
        specialistCollegiumSessions={specialistCollegiumSessions}
        directorMeetingSessions={directorMeetingSessions}
        supervisionSessions={supervisionSessions}
        assessmentSessions={assessmentSessions}
        hoveredSpecialistCollegiumId={hoveredSpecialistCollegiumId}
        hoveredDirectorMeetingId={hoveredDirectorMeetingId}
        hoveredSupervisionId={hoveredSupervisionId}
        hoveredAssessmentId={hoveredAssessmentId}
        setHoveredSpecialistCollegiumId={setHoveredSpecialistCollegiumId}
        setHoveredDirectorMeetingId={setHoveredDirectorMeetingId}
        setHoveredSupervisionId={setHoveredSupervisionId}
        setHoveredAssessmentId={setHoveredAssessmentId}
        setIupInitialTab={setIupInitialTab}
        setIupInitialSpecialistCollegiumId={setIupInitialSpecialistCollegiumId}
        setIupInitialDirectorMeetingId={setIupInitialDirectorMeetingId}
        setIupInitialMeetingId={setIupInitialMeetingId}
        setIupInitialAssessmentId={setIupInitialAssessmentId}
        setIupOpen={setIupOpen}
        dayOfYear={dayOfYear}
        daysInYear={daysInYear}
        clamp={clamp}
        hoveredCourseId={hoveredCourseId}
        dragCourseRef={dragCourseRef}
        getChipWidth={getChipWidth}
        setChipWidth={setChipWidth}
        getCourseDisplayTitle={getCourseDisplayTitle}
        setHoveredCourseId={setHoveredCourseId}
        setCertMenu={setCertMenu}
        openPreviewForBtGoals={openPreviewForBtGoals}
        setCourseForModal={setCourseForModal}
        setCourseModalOpen={setCourseModalOpen}
      />
    );
  }

// Overlap-info (bara som varning under kort)
const overlaps = useMemo(() => {
  return computeActivityOverlaps(activities as any[], (activity) => computeMondayDates(activity as Activity));
}, [activities, startYear]);

  // Registrera: start = MÅNDAG vid halvgräns, slut = SÖNDAGEN före nästa halvgräns
  function computeMondayDates(a: Activity) {
    return computeMondayDatesForActivity(a as any, {
      startYear,
      slotToYearMonthHalf,
      mondayNearestTo,
      sundayBeforeAnchor,
      dateToISO,
    });
  }

  /** Halvmånadslängd så att rutnätets slut (computeMondayDates) matchar önskat slutdatum — inte dateToSlot(...,"end") som kan avvika. */
  function resolveLengthSlotsForExactEnd(
    startSlot: number,
    desiredEndISO: string
  ): { lengthSlots: number; grid: { startISO: string; endISO: string } } {
    return resolveLengthSlotsForExactEndDate(startSlot, desiredEndISO, {
      isValidISO,
      dateToSlot,
      startYear,
      computeDates: (activity) => computeMondayDates(activity as Activity),
    });
  }

  function displayDatesForActivity(a: Activity) {
    return resolveDisplayDatesForActivity(a as any, {
      isValidISO,
      computeDates: (activity) => computeMondayDates(activity as Activity),
    });
  }

  // Sakerhetsnat: om timeline innehåller aktiviteter och profil saknar tydligt startankare,
  // ankra året till tidigaste aktivitet.
  useEffect(() => {
    if (!activities || activities.length === 0) return;
    const profileAnchorISO = pickTrainingStartAnchorISO({
      goalsVersion: (profile as any)?.goalsVersion,
      btStartDate: (profile as any)?.btStartDate,
      stStartDate: stStartISO || (profile as any)?.stStartDate,
      isValidISO,
    });
    if (profileAnchorISO) return;
    const earliestYear = findEarliestActivityYear({
      activities,
      displayDatesForActivity: (activity) => displayDatesForActivity(activity as Activity),
      isValidISO,
      isoToDateSafe,
    });
    if (typeof earliestYear === "number" && earliestYear !== startYear) {
      setStartYear(earliestYear);
    }
  }, [activities, startYear, profile, stStartISO]);

// Beräkna FTE och projicerat ST-slut — SLOT-BASERAT och helt lokalt
useEffect(() => {
  // Välj rätt startdatum för beräkning: 2021 → BT-start, annars ST-start
  const baseISO = pickTrainingStartAnchorISO({
    goalsVersion: (profile as any)?.goalsVersion,
    btStartDate: (profile as any)?.btStartDate,
    stStartDate: stStartISO || (profile as any)?.stStartDate,
    isValidISO,
  });
  const projected = computeProjectedStEndISO({
    activities,
    startYear,
    totalPlanMonths,
    restAttendance,
    baseISO,
    displayDatesForActivity: (activity) => displayDatesForActivity(activity as Activity),
    isZeroAttendanceType: (type) => isZeroAttendanceType(type as ActivityType),
    isValidISO,
    isoToDateSafe,
    dateToISO,
    dateToSlot,
    slotToYearMonthHalf,
    sundayBeforeAnchor,
  });
  if (!projected.shouldUpdate) return;
  setStEndISO(projected.stEndISO);
}, [activities, restAttendance, totalPlanMonths, stStartISO, profile, startYear]);

useEffect(() => {
  const iso = typeof stEndISO === "string" ? stEndISO : "";
  if (!iso) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;

  if ((profile as any)?.stEndISO === iso) return;
  void persistProfilePatch({ stEndISO: iso });
}, [stEndISO, profile, persistProfilePatch]);






  // Avrunda ISO till närmaste månads-/halvmånads-linje enligt 7/22-regeln
function roundToAnchors(iso: string, which: "start" | "end") {
  return roundToAnchorsWithDeps(iso, which, {
    isValidISO,
    mondayNearestTo,
    sundayBeforeAnchor,
    dateToISO,
  });
}


  // Popup-state
  const [courseModalOpen, setCourseModalOpen] = useState(false);
const [courseForModal, setCourseForModal] = useState<any>(null);
const [sta3Open, setSta3Open] = useState(false);

const [intygGroupModalOpen, setIntygGroupModalOpen] = useState(false);
  const {
    previewOpen,
    previewUrl,
    setPreviewOpen,
    closePreview,
    handleRegisterActivity,
    handleRegisterActivityById,
    handleRegisterCourse,
    handleRegisterCourseById,
    openPreviewForPlacement,
    openPreviewForPlacementFromGroupModal,
    openPreviewForBtGoals,
    openPreviewForCourse,
  } = usePusslaPreviewAndRegistration({
    activities: activities as any[],
    courses: courses as any[],
    selectedPlacementId,
    selectedCourseId,
    displayDatesForActivity: displayDatesForActivity as any,
    router,
    buildPlacementRegistrationPath,
    buildCourseRegistrationPath,
    getCourseDisplayTitle: getCourseDisplayTitle as any,
    canBuildPreview,
    profile,
    buildPlacementPreviewBlob,
    isZeroAttendanceType: (type: string) => isZeroAttendanceType(type as ActivityType),
    showPreviewFromBlob,
    toErrorMessage,
    alertFn: (message: string) => alert(message),
    buildGroupedPlacementPreviewBlob,
    buildBtGoalsPreviewBlob,
    buildCoursePreviewBlob,
  });


// STa3 – listor + fält till modalen
const [sta3Placements, setSta3Placements] = useState<Array<{ id:string; title:string; period?:string }>>([]);
const [sta3Courses, setSta3Courses] = useState<Array<{ id:string; title:string; period?:string }>>([]);
const [sta3Other, setSta3Other] = useState<string>("");
const [sta3HowVerified, setSta3HowVerified] = useState<string>("");

// Radens data → modalen
const [sta3ResearchTitle, setSta3ResearchTitle] = useState<string>("");
const [sta3SupervisorName, setSta3SupervisorName] = useState<string>("");
const [sta3SupervisorSpec, setSta3SupervisorSpec] = useState<string>("");
const [sta3SupervisorSite, setSta3SupervisorSite] = useState<string>("");


// --- ändringsflagga för panelen ---
const [showCloseConfirm, setShowCloseConfirm] = useState(false);
// Pending switch när användaren försöker byta aktivitet med dirty=true
const [pendingSwitchPlacementId, setPendingSwitchPlacementId] = useState<string | null>(null);
const [pendingSwitchCourseId, setPendingSwitchCourseId] = useState<string | null>(null);
// Delete confirmation dialog
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const [deleteConfirmConfig, setDeleteConfirmConfig] = useState<{
  message: string;
  onConfirm: () => void;
} | null>(null);

  const getPlacementStartISOForAgent = (a: Activity): string =>
    resolvePlacementStartISOForAgent(a as any, isValidISO, computeMondayDates);

  const getPlacementEndISOForAgent = (a: Activity): string =>
    resolvePlacementEndISOForAgent(a as any, isValidISO, computeMondayDates);

  const getCourseStartISOForAgent = (c: TLcourse): string =>
    resolveCourseStartISOForAgent(c as any, isValidISO);
  const {
    deletePlacementByMonthYearForAgent,
    extendLastPlacementForAgent,
    shiftPlacementFromEndForAgent,
    transformAllPlacementsDurationForAgent,
    shiftAllCoursesForAgent,
    rebalanceCoursesPerHalfYearForAgent,
    planTimelineDistributionForAgent,
    deleteSelectedPlacementForAgent,
    deleteSelectedCourseForAgent,
    deleteCourseByMonthYearForAgent,
    convertCourseToUtbildningsmomentForAgent,
  } = useAgentTimelineMutationActions({
    activities: activities as any[],
    courses: courses as any[],
    selectedPlacementId,
    selectedCourseId,
    selectedPlacementIdRef: selectedPlacementIdRef as any,
    selectedCourseIdRef: selectedCourseIdRef as any,
    authUserId: authUser?.id,
    getSessionUser,
    supabase,
    startYear,
    getPlacementStartISOForAgent,
    getPlacementEndISOForAgent,
    getCourseStartISOForAgent,
    isValidISO,
    dateToSlot,
    findPlacementToRight,
    computeMondayDates,
    computePhaseByEndSlot,
    wouldOverlap,
    setActivities,
    setCourses,
    setSelectedPlacementId,
    setSelectedCourseId,
    setActiveLane,
    setDirty,
    refreshLists,
    logAudit,
    saveCourseToDb,
    totalPlanMonths,
    stStartISO,
    stEndISO,
    todayISO,
    normalizeCourseTitleForAgent,
    courseTouchesMonthYearForAgent,
    courseTitleMatchesAgent,
  });
  const {
    inferPhaseFromDateForAgent,
    setAllProfilePhoneNumbersForAgent,
    planStFromSrTemplatesForAgent,
    planCoursesCoverCourseMilestonesForAgent,
    syncCoursesMilestonesForAgent,
    summarizeGoalCatalogForAgent,
    summarizeAppSectionsForAgent,
    summarizeRoleViewsForAgent,
  } = useAgentPlanningSummaryActions({
    persistProfilePatch,
    setProfileOpen,
    normalizeGoalsVersion,
    profile,
    btEndISO,
    isValidISO,
    srPlacementTemplates: srPlacementTemplates as any[],
    srCourseTemplates: srCourseTemplates as any[],
    srUtbildningsmomentTemplates: srUtbildningsmomentTemplates as any[],
    activities: activities as any[],
    getPlacementEndISOForAgent,
    stStartISO,
    todayISO,
    stEndISO,
    totalPlanMonths,
    createPlacementFromDateRange,
    createCourseFromDateRange,
    resolveSupabaseUserId,
    supabase,
    IUP_SETTINGS_COLUMNS,
    uid,
    upsertIupSettingsOnUserId,
    setSupervisionSessions: setSupervisionSessions as any,
    setAssessmentSessions: setAssessmentSessions as any,
    setActiveLane,
    setCourses,
    setDirty,
    usesMetisCourses,
    goalsCatalog,
    COMMON_AB_MILESTONES,
    milestoneRequires,
    courses: courses as any[],
    mapMetisGoalsToMilestoneIds,
    getMetisCourseGoals,
    getMetisCoursesForSpecialty,
    sanitizeStMilestonesForGoals,
    displayMilestoneCode,
    redactContactInfoText,
    iupOpen,
    iupInitialTab,
    hemklinikOpen,
    hemklinikColleagues: hemklinikColleagues as any[],
    hemklinikSuggestions: hemklinikSuggestions as any[],
    forslagPopupFor,
    forslagTab,
    scanOpen,
    btModalOpen,
    prepareOpen,
    reportOpen,
    previewOpen,
    milestoneOverviewOpen,
    colleaguePlacementDescriptions: colleaguePlacementDescriptions as any[],
    colleagueCourseDescriptions: colleagueCourseDescriptions as any[],
    selectedColleague: selectedColleague as any,
    hemklinikMessages: hemklinikMessages as any[],
    hemklinikSentMessages: hemklinikSentMessages as any[],
    colleagueData: colleagueData as any,
  });

  const {
    selectPlacementForAgent,
    selectCourseForAgent,
    updateSelectedPlacementForAgent,
    updateSelectedCourseForAgent,
  } = useAgentSelectionPatchActions({
    activities: activities as any[],
    courses: courses as any[],
    getPlacementEndISOForAgent,
    setSelectedPlacementId,
    setSelectedCourseId,
    setActiveLane,
    selectedCourseIdRef: selectedCourseIdRef as any,
    selectedPlacementIdRef: selectedPlacementIdRef as any,
    selectedPlacement: selectedPlacement as any,
    profile,
    sanitizeStMilestonesForGoals,
    toMilestoneIds,
    buildPlacementPatchFromAgentFields,
    resolvePlacementDatePatchFromAgentFields,
    getPlacementStartISOForAgent,
    startYear,
    isValidISO,
    dateToSlot,
    wouldOverlap,
    updateSelectedPlacement,
    selectedCourseId,
    buildCoursePatchFromAgentFields,
    updateSelectedCourse,
  });

  const {
    executeAgentAction,
    getAgentContextSummary,
    captureAgentUiSnapshot,
    restoreAgentUiSnapshot,
  } = usePusslaAgentWorkspace({
    startYear,
    activities: activities as any[],
    courses: courses as any[],
    selectedPlacementId,
    selectedCourseId,
    selectedPlacementIdRef: selectedPlacementIdRef as any,
    selectedCourseIdRef: selectedCourseIdRef as any,
    activeLane,
    iupOpen,
    iupInitialTab,
    hemklinikOpen,
    scanOpen,
    btModalOpen,
    prepareOpen,
    milestoneOverviewOpen,
    courseModalOpen,
    sta3Open,
    previewOpen,
    profileOpen,
    aboutOpen,
    reportOpen,
    settingsOpen,
    supervisionSessions: supervisionSessions as any[],
    assessmentSessions: assessmentSessions as any[],
    directorMeetingSessions: directorMeetingSessions as any[],
    specialistCollegiumSessions: specialistCollegiumSessions as any[],
    profile,
    btEndISO,
    dirty,
    setActivities: setActivities as any,
    setCourses: setCourses as any,
    setSelectedPlacementId,
    setSelectedCourseId,
    setActiveLane,
    setIupOpen,
    setIupInitialTab: setIupInitialTab as any,
    setHemklinikOpen,
    setScanOpen,
    setBtModalOpen,
    setPrepareOpen,
    setMilestoneOverviewOpen,
    setCourseModalOpen,
    setSta3Open,
    setPreviewOpen,
    setProfileOpen,
    setAboutOpen,
    setReportOpen,
    setSettingsOpen,
    setSupervisionSessions: setSupervisionSessions as any,
    setAssessmentSessions: setAssessmentSessions as any,
    setDirectorMeetingSessions: setDirectorMeetingSessions as any,
    setSpecialistCollegiumSessions: setSpecialistCollegiumSessions as any,
    setDirty,
    setPendingSwitchPlacementId,
    setPendingSwitchCourseId,
    getSessionUser,
    insertTimelineVersionRow,
    authUserId: authUser?.id,
    refreshLists,
    logAudit,
    getPlacementStartISOForAgent: getPlacementStartISOForAgent as any,
    getPlacementEndISOForAgent: getPlacementEndISOForAgent as any,
    selectedPlacement: selectedPlacement as any,
    selectedCourse: selectedCourse as any,
    supabase: supabase as any,
    IUP_SETTINGS_COLUMNS,
    normalizeIupSettings,
    upsertIupSettingsOnUserId,
    buildIupSettingsUpsertPayload,
    inferPhaseFromDateForAgent,
    uid,
    createPlacementFromDateRange,
    createCourseFromDateRange,
    selectPlacementForAgent,
    selectCourseForAgent,
    updateSelectedPlacementForAgent,
    updateSelectedCourseForAgent,
    savePlacementToDb,
    saveCourseToDb,
    setAllProfilePhoneNumbersForAgent,
    extendLastPlacementForAgent,
    shiftPlacementFromEndForAgent,
    transformAllPlacementsDurationForAgent,
    shiftAllCoursesForAgent,
    rebalanceCoursesPerHalfYearForAgent,
    planTimelineDistributionForAgent,
    deleteSelectedPlacementForAgent,
    deleteSelectedCourseForAgent,
    deletePlacementByMonthYearForAgent,
    deleteCourseByMonthYearForAgent,
    convertCourseToUtbildningsmomentForAgent,
    planStFromSrTemplatesForAgent,
    planCoursesCoverCourseMilestonesForAgent,
    syncCoursesMilestonesForAgent,
    summarizeGoalCatalogForAgent,
    summarizeAppSectionsForAgent,
    summarizeRoleViewsForAgent,
    colleaguePlacementDescriptions: colleaguePlacementDescriptions as any[],
    colleagueCourseDescriptions: colleagueCourseDescriptions as any[],
    srPlacementTemplates: srPlacementTemplates as any[],
    srCourseTemplates: srCourseTemplates as any[],
    srUtbildningsmomentTemplates: srUtbildningsmomentTemplates as any[],
    stStartISO,
    stEndISO,
    goalsCatalog,
    usesMetisCourses,
    redactContactInfoText,
  });

// ===== Osparade ändringar: använd UnsavedChangesDialog =====
const {
  closeDetailPanel,
  handleConfirmClose,
  handleSaveAndClose,
  handleCancelClose,
  requestDeletePlacement,
  requestDeleteCourse,
  switchActivity,
} = usePusslaDetailPanelInteractions({
  dirty,
  setShowCloseConfirm,
  setDirty,
  setSelectedPlacementId,
  setSelectedCourseId,
  restoreBaseline,
  pendingSwitchPlacementId,
  pendingSwitchCourseId,
  setPendingSwitchPlacementId,
  setPendingSwitchCourseId,
  selectedPlacement: selectedPlacement as any,
  selectedCourse: selectedCourse as any,
  savePlacementToDb,
  saveCourseToDb,
  authUserId: authUser?.id,
  getSessionUser,
  deletePlacementForUser,
  deleteCourseForUser,
  setActivities: (updater: any) => setActivities(updater as any),
  setCourses: (updater: any) => setCourses(updater as any),
  refreshLists,
  setShowDeleteConfirm,
  setDeleteConfirmConfig,
  logAudit,
  selectedPlacementId,
  selectedCourseId,
  saveInfoOpen,
  scanOpen,
  aboutOpen,
  profileOpen,
  reportOpen,
  iupOpen,
  previewOpen,
  sta3Open,
  courseModalOpen,
  btModalOpen,
  prepareOpen,
  showCloseConfirm,
  showDeleteConfirm,
  aiAgentActivationPromptOpen,
  aiAgentInfoOpen,
  setSaveInfoOpen,
});

  const {
    openDocumentsFor,
    uploadDocumentForTarget,
    downloadDocument,
    runCertificateForCertMenu,
    persistTimelineToDb,
    persistIntygGroupModal,
    searchHits,
    runSearchHit,
    documentsFolderOptions,
    visibleDocuments,
    moveDocumentToFolder,
    commitInlineFolderRename,
    selectedFolderMeta,
    uploadDocumentsFromList,
  } = usePusslaDocumentsAndAuxWorkspace({
    authUserId: authUser?.id,
    getSessionUser,
    setAuthUser,
    resolveUserId,
    setDocumentsLoading,
    listActivityDocumentsForUser,
    activityDocumentColumns: ACTIVITY_DOCUMENT_COLUMNS,
    setDocuments: (docsOrUpdater: any) => setDocuments(docsOrUpdater as any),
    documentsFolderKey,
    parseDocumentTargetFromKey,
    getDocumentTargetKey,
    setDocumentsUploading,
    uploadToStorage: (path: string, targetFile: File, options: any) =>
      supabase.storage.from("activity-documents").upload(path, targetFile, options),
    insertActivityDocumentRow,
    setDocumentsOpen,
    createSignedUrl: (path: string, expiresInSec: number) =>
      supabase.storage.from("activity-documents").createSignedUrl(path, expiresInSec),
    documentsOpen,
    setDocumentsSidebarWidth,
    setDocumentsUploadDragActive,
    documentsUploadDropzoneRef,
    certMenu,
    profile,
    activities: activities as any[],
    courses: courses as any[],
    displayDatesForActivity: displayDatesForActivity as any,
    getCourseDisplayTitle: getCourseDisplayTitle as any,
    openPreviewForBtGoals: openPreviewForBtGoals as any,
    openPreviewForPlacement: openPreviewForPlacement as any,
    setSta3Placements: setSta3Placements as any,
    setSta3Courses: setSta3Courses as any,
    setSta3ResearchTitle: setSta3ResearchTitle as any,
    setSta3SupervisorName: setSta3SupervisorName as any,
    setSta3SupervisorSpec: setSta3SupervisorSpec as any,
    setSta3SupervisorSite: setSta3SupervisorSite as any,
    setSta3Open,
    setCourseForModal: setCourseForModal as any,
    setCourseModalOpen,
    normalizeGlobalFolderId,
    documentsCustomFolders,
    setDocumentsCustomFolders,
    selectedPlacementId,
    searchQuery,
    isValidISO,
    computeMondayDates: computeMondayDates as any,
    isLeave: isLeave as any,
    isZeroAttendanceType: isZeroAttendanceType as any,
    setActivities: (updater: any) => setActivities(updater as any),
    setCourses: (updater: any) => setCourses(updater as any),
    setAchievements: (rows: any) => setAchievements(rows as any),
    setDbAchievements: (rows: any) => setDbAchievements(rows as any),
    deleteAchievementsByUserAndPlacement,
    deleteAchievementsByUserAndCourse,
    insertAchievementRows,
    listAchievementsByUserId,
    mapAchievementRow,
    groupedMembersForDraft: groupedMembersForDraft as any,
    updatePlacementById: async (placementId: string, payload: any) =>
      supabase.from("placements").update(payload).eq("id", placementId),
    setSearchOpen,
    setIupOpen,
    setHemklinikOpen,
    switchActivity,
    documents: documents as any[],
    editingFolderValue,
    setDocumentsFolderKey,
    setEditingFolderKey,
    setEditingFolderValue,
    updateDocumentTarget: async (
      docId: string,
      target: { kind: "placement" | "course" | null; id: string | null }
    ) =>
      supabase
        .from("activity_documents")
        .update({
          activity_kind: target.kind,
          activity_id: target.id,
        })
        .eq("id", docId),
    persistRenamedGlobalFolderIds: async (currentFolderId: string, cleanedFolderId: string) =>
      supabase
        .from("activity_documents")
        .update({ activity_id: cleanedFolderId })
        .is("activity_kind", null)
        .eq("activity_id", currentFolderId),
    alertFn: (message: string) => alert(message),
  });

  // UI
  return (
      <>
<PusslaPrimarySurface
  setGoHomeWarnOpen={setGoHomeWarnOpen}
  is2021={is2021}
  setBtModalOpen={setBtModalOpen}
  setPrepareOpen={setPrepareOpen}
  setIupInitialTab={setIupInitialTab}
  setIupInitialMeetingId={setIupInitialMeetingId}
  setIupInitialAssessmentId={setIupInitialAssessmentId}
  setIupOpen={setIupOpen}
  setHemklinikOpen={setHemklinikOpen}
  openDocumentsFor={openDocumentsFor as any}
  setSettingsOpen={setSettingsOpen}
  searchQuery={searchQuery}
  setSearchQuery={setSearchQuery}
  setSearchOpen={setSearchOpen}
  monthNames={MONTH_NAMES}
  selectedPlacementId={selectedPlacementId}
  selectedCourseId={selectedCourseId}
  closeDetailPanel={closeDetailPanel}
  visibleYearCount={visibleYearCount}
  renderYearRow={renderYearRow}
  profile={profile}
  startLineColor={START_LINE_COLOR}
  midLineColor={MID_LINE_COLOR}
  endLineColor={END_LINE_COLOR}
  todayLineColor={TODAY_LINE_COLOR}
  showSupervisionOnTimeline={showSupervisionOnTimeline}
  showDirectorMeetingsOnTimeline={showDirectorMeetingsOnTimeline}
  showAssessmentsOnTimeline={showAssessmentsOnTimeline}
  showSpecialistCollegiumsOnTimeline={showSpecialistCollegiumsOnTimeline}
  detailPanelProps={{
    selectedPlacement,
    selectedCourse,
    profile,
    startYear,
    isValidISO,
    slotToYearMonthHalf,
    mondayNearestTo,
    dateToISO,
    sundayBeforeAnchor,
    normalizeGoalsVersion,
    isoToDateSafe,
    addMonths,
    dateToSlot,
    srPlacementTemplates,
    placementGroupsOrder,
    getCourseTemplateGroup,
    sanitizeStMilestonesForGoals,
    getTemplateSuggestedPeriodMonths,
    nearestSundayISO,
    shiftIsoDays,
    roundToAnchors,
    setPlacementPeriodSuggestionDialog,
    applyPlacementDates,
    isLeave,
    updatePlacementSupervisor,
    updatePlacementSupervisorSpeciality,
    updatePlacementSupervisorSite,
    updatePlacementNote,
    updatePlacementBtAssessment,
    colleaguePlacementDescriptions,
    splitTemplateSuggestedRows,
    placementNameMatches,
    forslagPopupFor,
    forslagTab,
    setForslagTab,
    closePlacementSuggestions,
    appendPlacementStudierektorRow,
    appendPlacementColleagueDescription,
    colleagueFormatDate,
    togglePlacementSuggestions,
    dirty,
    setActivities,
    setBtMilestonePicker,
    setMilestonePicker,
    sortMilestoneIds,
    displayMilestoneCode,
    setBtMilestoneDetail,
    setStMilestoneDetail,
    savePlacementToDb,
    closeDetailPanel,
    requestDeletePlacement,
    setIntygGroupModalOpen,
    setCourses,
    setDirty,
    updateSelectedCourse,
    usesMetisCourses,
    srUtbildningsmomentTemplates,
    srCourseTemplates,
    courseGroupsOrder,
    mapMetisGoalsToMilestoneIds,
    getMetisCoursesForSpecialty,
    getEffectiveBtWindow,
    isPlacementInBtWindow,
    isIsoInBtWindow,
    activities,
    courses,
    getCourseDisplayTitle,
    resolveMatchingUtbildningsmoment,
    buildUpdatedPlacementNote,
    hemklinikSuggestions,
    setForslagPopupFor,
    saveCourseToDb,
    requestDeleteCourse,
  }}
  listAndSummaryProps={{
    activitiesTableOpen,
    setActivitiesTableOpen,
    startYear,
    activities,
    dismissedGaps,
    setDismissedGaps,
    selectedPlacementId,
    displayDatesForActivity,
    isZeroAttendanceType: isZeroAttendanceType as any,
    switchActivity: switchActivity as any,
    setCertMenu,
    openPreviewForBtGoals: openPreviewForBtGoals as any,
    profile,
    courses,
    getCourseDisplayTitle,
    setSta3Placements,
    setSta3Courses,
    setSta3ResearchTitle,
    setSta3SupervisorName,
    setSta3SupervisorSpec,
    setSta3SupervisorSite,
    setSta3Open,
    openPreviewForPlacement: openPreviewForPlacement as any,
    isLeave: isLeave as any,
    btstWarnActIds: btstWarnActIds as any,
    selectedCourseId,
    btstWarnCourseIds: btstWarnCourseIds as any,
    setCourseForModal,
    setCourseModalOpen,
    totalPlanMonths,
    setTotalPlanMonths,
    persistProfilePatch,
    restAttendance,
    setRestAttendance,
    stEndISO,
    progressPct,
    milestoneProgressPct,
    setProgressDetailOpen,
    isValidISO,
    isoToDateSafe: isoToDateSafe as any,
    addMonths,
    dateToISO,
    onBtEndChange,
    progressDetailOpen,
    timeDetails,
    timeByActivity,
    hoveredTimeAct,
    createProgressHoverEnterHandler,
    clearProgressHover,
    milestoneDetails,
    setIupOpen,
    setIupInitialTab,
    overlapWarning,
    overlapSuggestion,
    clearOverlapState,
    applyOverlapSuggestion,
    placementPeriodSuggestionDialog,
    closePlacementPeriodSuggestionDialog,
    applyPlacementPeriodSuggestion,
  }}
  workflowModalsProps={{
    milestoneOverviewOpen,
    setMilestoneOverviewOpen,
    scanOpen,
    setScanOpen,
    refreshLists,
    profile,
    saveInfoOpen,
    setSaveInfoOpen,
    activities,
    courses,
    reportOpen,
    setReportOpen,
    profileOpen,
    setProfileOpen,
    aboutOpen,
    setAboutOpen,
    prepareOpen,
    setPrepareOpen,
    btModalOpen,
    setBtModalOpen,
    courseModalOpen,
    setCourseModalOpen,
    courseForModal,
    toMilestoneIds,
  }}
  documentsCenterProps={{
    documentsOpen,
    setDocumentsOpen,
    setScanOpen,
    documentsSidebarWidth,
    documentsFolderOptions,
    documentsFolderKey,
    setDocumentsFolderKey,
    draggedDocumentId,
    setDraggedDocumentId,
    dragOverFolderKey,
    setDragOverFolderKey,
    documents: documents as any[],
    moveDocumentToFolder: moveDocumentToFolder as any,
    editingFolderKey,
    setEditingFolderKey,
    editingFolderValue,
    setEditingFolderValue,
    commitInlineFolderRename,
    parseDocumentTargetFromKey,
    setDocumentsCustomFolders: setDocumentsCustomFolders as any,
    setDocuments: setDocuments as any,
    getDocumentTargetKey: getDocumentTargetKey as any,
    newDocumentsFolderName,
    setNewDocumentsFolderName,
    normalizeGlobalFolderId: normalizeGlobalFolderId as any,
    documentsPlacementsOpen,
    setDocumentsPlacementsOpen,
    documentsCoursesOpen,
    setDocumentsCoursesOpen,
    documentsShowDates,
    setDocumentsShowDates,
    selectedFolderMeta,
    documentsUploadInputRef,
    documentsUploadDropzoneRef,
    documentsUploading,
    documentsUploadDragActive,
    setDocumentsUploadDragActive,
    uploadDocumentsFromList: uploadDocumentsFromList as any,
    documentsLoading,
    visibleDocuments: visibleDocuments as any[],
    downloadDocument: downloadDocument as any,
  }}
  assistantSettingsProps={{
    searchOpen,
    searchQuery,
    setSearchQuery,
    searchHits: searchHits as any[],
    runSearchHit,
    setSearchOpen,
    settingsOpen,
    aiAgentEnabled,
    setSettingsOpen,
    setAiAgentEnabled,
    setAiAgentActivationPromptOpen,
    setProfileOpen,
    setAboutOpen,
    setSaveInfoOpen,
    setLogoutConfirmOpen,
    aiAgentMenuOpen,
    aiAgentProvider,
    aiAgentModels,
    aiAgentModelOptions,
    aiAgentModelsLoading,
    aiAgentConfirmMode,
    aiAgentNewApiKey,
    aiAgentNewPassphrase,
    aiAgentPassphrase,
    aiAgentReplaceKeyMode,
    aiAgentMsg,
    hasStoredApiKey,
    aiAgentUnlockedKeys,
    setAiAgentMenuOpen,
    setAiAgentProvider,
    setAiAgentModels,
    setAiAgentNewApiKey,
    setAiAgentNewPassphrase,
    setAiAgentPassphrase,
    saveAiAgentKey,
    unlockAiAgent,
    lockAiAgent,
    setAiAgentReplaceKeyMode,
    setAiAgentMsg,
    clearStoredApiKey,
    setAiAgentUnlockedKeys,
    setAiAgentConfirmMode,
    aiAgentActivationPromptOpen,
    setAiAgentMenuTab: setAiAgentMenuTab as any,
    aiAgentInfoOpen,
    aiAgentInfoTab: aiAgentInfoTab as any,
    setAiAgentInfoTab: setAiAgentInfoTab as any,
    setAiAgentInfoOpen,
  }}
  colleagueWorkspaceProps={{
    selectedColleague,
    setSelectedColleague,
    colleagueData,
    colleagueLoading,
    colleagueMainTab,
    setColleagueMainTab,
    colleagueActivityDetail,
    setColleagueActivityDetail,
    colleagueFormatDate,
    colleagueCalculateMonths,
    colleagueBirthDate,
    displayMilestoneCode,
    sortMilestoneIds,
    colleagueCopiedToast,
    onRequestCopyMilestones: handleRequestCopyColleagueMilestones,
    onRequestCopyDescription: handleRequestCopyColleagueDescription,
  }}
  colleagueCopyDialogsProps={{
    colleagueMilestoneCopyDialog,
    setColleagueMilestoneCopyDialog,
    colleagueDescCopyDialog,
    setColleagueDescCopyDialog,
    colleagueWarningDialog,
    setColleagueWarningDialog,
    colleagueActivityDetail,
    colleagueFormatDate,
    colleagueActivityKind,
    colleagueItemTypeLabel,
    colleagueItemDisplayName,
    colleagueTargetDisplayName,
    onApplyMilestones: handleApplyColleagueMilestones,
    onApplyDescription: handleApplyColleagueDescription,
  }}
/>

<PusslaModalAndOverlayStack
  iupOpen={iupOpen}
  setIupOpen={setIupOpen}
  setIupInitialTab={setIupInitialTab}
  iupInitialTab={iupInitialTab}
  iupInitialMeetingId={iupInitialMeetingId}
  iupInitialAssessmentId={iupInitialAssessmentId}
  iupInitialDirectorMeetingId={iupInitialDirectorMeetingId}
  iupInitialSpecialistCollegiumId={iupInitialSpecialistCollegiumId}
  setIupInitialMeetingId={setIupInitialMeetingId}
  setIupInitialAssessmentId={setIupInitialAssessmentId}
  setIupInitialDirectorMeetingId={setIupInitialDirectorMeetingId}
  setIupInitialSpecialistCollegiumId={setIupInitialSpecialistCollegiumId}
  setSupervisionSessions={setSupervisionSessions as any}
  setAssessmentSessions={setAssessmentSessions as any}
  setDirectorMeetingSessions={setDirectorMeetingSessions as any}
  setSpecialistCollegiumSessions={setSpecialistCollegiumSessions as any}
  showSupervisionOnTimeline={showSupervisionOnTimeline}
  showAssessmentsOnTimeline={showAssessmentsOnTimeline}
  showDirectorMeetingsOnTimeline={showDirectorMeetingsOnTimeline}
  showSpecialistCollegiumsOnTimeline={showSpecialistCollegiumsOnTimeline}
  setShowSupervisionOnTimeline={setShowSupervisionOnTimeline}
  setShowAssessmentsOnTimeline={setShowAssessmentsOnTimeline}
  setShowDirectorMeetingsOnTimeline={setShowDirectorMeetingsOnTimeline}
  setShowSpecialistCollegiumsOnTimeline={setShowSpecialistCollegiumsOnTimeline}
  previewOpen={previewOpen}
  previewUrl={previewUrl}
  onClosePreview={closePreview}
  intygGroupModalOpen={intygGroupModalOpen}
  setIntygGroupModalOpen={setIntygGroupModalOpen}
  selectedPlacement={selectedPlacement}
  selectedCourseId={selectedCourseId}
  activities={activities}
  sortMilestoneIds={sortMilestoneIds}
  displayMilestoneCode={displayMilestoneCode}
  profileGoalsVersion={(profile as any)?.goalsVersion}
  persistIntygGroupModal={persistIntygGroupModal}
  openPreviewForPlacementFromGroupModal={openPreviewForPlacementFromGroupModal}
  milestonePicker={milestonePicker}
  setMilestonePicker={setMilestonePicker}
  btMilestonePicker={btMilestonePicker}
  setBtMilestonePicker={setBtMilestonePicker}
  goals={goals}
  selectedCourse={selectedCourse}
  sanitizeStMilestonesForGoals={sanitizeStMilestonesForGoals}
  setCourses={setCourses as any}
  setActivities={setActivities as any}
  btMilestoneDetail={btMilestoneDetail}
  setBtMilestoneDetail={setBtMilestoneDetail}
  btMilestones={btMilestones}
  stMilestoneDetail={stMilestoneDetail}
  setStMilestoneDetail={setStMilestoneDetail}
  sta3Open={sta3Open}
  setSta3Open={setSta3Open}
  sta3Placements={sta3Placements}
  sta3Courses={sta3Courses}
  sta3Other={sta3Other}
  setSta3Other={setSta3Other}
  sta3HowVerified={sta3HowVerified}
  setSta3HowVerified={setSta3HowVerified}
  profile={profile}
  sta3ResearchTitle={sta3ResearchTitle}
  sta3SupervisorName={sta3SupervisorName}
  sta3SupervisorSpec={sta3SupervisorSpec}
  sta3SupervisorSite={sta3SupervisorSite}
  hemklinikOpen={hemklinikOpen}
  setHemklinikOpen={setHemklinikOpen}
  hemklinikTab={hemklinikTab}
  setHemklinikTab={setHemklinikTab}
  hemklinikLoading={hemklinikLoading}
  setHemklinikComposeOpen={setHemklinikComposeOpen}
  hemklinikMailbox={hemklinikMailbox}
  setHemklinikMailbox={switchHemklinikMailbox}
  hemklinikMessages={hemklinikMessages}
  hemklinikSentMessages={hemklinikSentMessages}
  hemklinikMailboxRows={hemklinikMailboxRows}
  hemklinikSelectedMessage={hemklinikSelectedMessage}
  onOpenMailboxMessage={handleOpenHemklinikMessage}
  onRemoveHemklinikMessage={removeHemklinikMessage}
  hemklinikSuggestions={hemklinikSuggestions}
  setHemklinikSuggestionDetail={setHemklinikSuggestionDetail}
  onDismissHemklinikSuggestion={dismissHemklinikSuggestion}
  hemklinikColleagues={hemklinikColleagues}
  hemklinikPrimaryContacts={hemklinikPrimaryContacts}
  setHemklinikContactDetail={setHemklinikContactDetail}
  setColleagueMainTab={setColleagueMainTab}
  setColleagueActivityDetail={setColleagueActivityDetail}
  setSelectedColleague={setSelectedColleague}
  hemklinikContactDetail={hemklinikContactDetail}
  hemklinikComposeOpen={hemklinikComposeOpen}
  setHemklinikRecipientPickerOpen={setHemklinikRecipientPickerOpen}
  hemklinikComposeRecipients={hemklinikComposeRecipients}
  setHemklinikComposeText={setHemklinikComposeText}
  hemklinikComposeText={hemklinikComposeText}
  onSendHemklinikMessage={sendHemklinikMessage}
  hemklinikComposeSending={hemklinikComposeSending}
  hemklinikRecipientPickerOpen={hemklinikRecipientPickerOpen}
  setHemklinikComposeRecipients={setHemklinikComposeRecipients as any}
  hemklinikSuggestionDetail={hemklinikSuggestionDetail}
  activityTemplateChangeOpen={activityTemplateChangeOpen}
  templateChangeCurrent={templateChangeCurrent}
  activityTemplateChangeQueueLength={activityTemplateChangeQueue.length}
  handleTemplateDeletedRemoveActivity={handleTemplateDeletedRemoveActivity}
  handleTemplateDeletedChangeActivity={handleTemplateDeletedChangeActivity}
  acknowledgeTemplateChangeNotice={acknowledgeTemplateChangeNotice}
  setActivityTemplateChangeOpen={setActivityTemplateChangeOpen}
  certMenu={certMenu}
  getCourseDisplayTitle={getCourseDisplayTitle}
  openDocumentsFor={openDocumentsFor}
  runCertificateForCertMenu={runCertificateForCertMenu}
  setCertMenu={setCertMenu}
  adapter={
    {
      executeAction: executeAgentAction,
      getContextSummary: getAgentContextSummary,
      captureSnapshot: captureAgentUiSnapshot,
      restoreSnapshot: restoreAgentUiSnapshot,
    } as any
  }
  aiAgentEnabled={aiAgentEnabled}
  aiAgentProvider={aiAgentProvider}
  aiAgentModels={aiAgentModels}
  aiAgentUnlockedKeys={aiAgentUnlockedKeys}
  aiAgentConfirmMode={aiAgentConfirmMode}
  setAiAgentProvider={setAiAgentProvider}
  setAiAgentModels={setAiAgentModels}
  goHomeWarnOpen={goHomeWarnOpen}
  setGoHomeWarnOpen={setGoHomeWarnOpen}
  setSaveInfoOpen={setSaveInfoOpen}
  onGoHome={() => router.push("/")}
  showCloseConfirm={showCloseConfirm}
  pendingSwitchPlacementId={pendingSwitchPlacementId}
  pendingSwitchCourseId={pendingSwitchCourseId}
  handleCancelClose={handleCancelClose}
  handleConfirmClose={handleConfirmClose}
  handleSaveAndClose={handleSaveAndClose}
  showDeleteConfirm={showDeleteConfirm}
  deleteConfirmConfig={deleteConfirmConfig as any}
  setShowDeleteConfirm={setShowDeleteConfirm}
  setDeleteConfirmConfig={setDeleteConfirmConfig}
  logoutConfirmOpen={logoutConfirmOpen}
  setLogoutConfirmOpen={setLogoutConfirmOpen}
  onConfirmLogout={async () => {
    setLogoutConfirmOpen(false);
    await supabase.auth.signOut();
    router.push("/auth");
  }}
/>


{/* NYTT: Liten popup för BT-intyg / ST-intyg vid dubbelklick på rad */}





      {/* Överlapp ej möjligt: varningsblock borttaget enligt specifikation */}
    </>
  );
}

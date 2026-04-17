"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Dispatch, KeyboardEvent, SetStateAction } from 'react';
import { useStudierektorClinic } from '@/lib/hooks/useStudierektorData';
import {
  clearPlacementLabelsByIds,
  createSupervisorAssignment,
  deleteSupervisorAssignmentsForStudent,
  deleteClinicMetisTemplatesByClinicId,
  deleteClinicActivityTemplateById,
  deleteSrActivitySuggestionById,
  fetchProfileById,
  getAuthenticatedUserId,
  getClinicActivityTemplateById,
  getClinicChiefVerificationRow,
  getClinicFormRow,
  getClinicIdForCurrentUserRole,
  getIupInstrumentsForUser,
  insertActivityTemplateChangeNotifications,
  insertClinicActivityTemplates,
  insertSrActivitySuggestions,
  insertSrMessages,
  listClinicMembershipsByClinicId,
  listClinicActivityTemplatesByClinicId,
  listCourseTitlesByUserIdForSuggest,
  listCoursesForTemplateScanByUserIds,
  listPlacementsForSuggestByUserId,
  listPlacementsForTemplateScanByUserIds,
  listSupervisorAssignments,
  listSupervisorAssignmentsByClinicId,
  listHandledSentSuggestions,
  listPendingSentSuggestions,
  listReadSentMessages,
  listSentMessagesByPair,
  listSentSuggestionsByPair,
  listUnreadSentMessages,
  renameCoursesTitleByIds,
  renamePlacementsClinicTitleByIds,
  resetCoursesTitleByIds,
  saveClinicActivityTemplate,
  saveClinicActivityTemplateConfig,
  updateClinicActivityTemplateById,
  updateClinicChiefFields,
} from '@/lib/repositories/starkRepository';
import CalendarDatePicker from './CalendarDatePicker';
import dynamic from 'next/dynamic';
import type { GoalsCatalog, GoalsMilestone } from '@/lib/goals';
import { loadGoals, normalizeGoalCode } from '@/lib/goals';
import { COMMON_AB_MILESTONES, mergeWithCommon } from '@/lib/goals-common';
import { displayMilestoneCode } from '@/lib/milestoneDisplay';
import { sortMilestoneIds } from '@/lib/milestoneSequence';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import ProfileContactDetailModal from './ProfileContactDetailModal';
import IupHandledningTab from './dashboard/iup/IupHandledningTab';
import {
  DEFAULT_IUP_HANDLEDNING_EXPECTATIONS,
  IUP_HANDLEDNING_CONFIG_TITLE,
  encodeIupHandledningConfig,
  parseIupHandledningConfig,
} from '@/lib/dashboard/iupHandledningExpectations';
import IupProgressionInstrumentsConfigPanel from './dashboard/iup/IupProgressionInstrumentsConfigPanel';
import {
  DEFAULT_PROGRESSION_INSTRUMENTS,
  defaultClinicProgressionInstrumentsConfig,
  encodeIupProgressionInstrumentsConfig,
  IUP_PROGRESSION_INSTRUMENTS_CONFIG_TITLE,
  mergeProgressionInstrumentsSynthesis,
  parseIupProgressionInstrumentsConfig,
  type IupProgressionInstrumentsClinicConfig,
} from '@/lib/dashboard/iupProgressionInstruments';
const DesktopMilestonePicker = dynamic(() => import('@/components/DesktopMilestonePicker'), { ssr: false });

type MessageTarget = { userId: string; name: string } | null;
type SuggestTarget = { userId: string; name: string } | null;
type SuggestType = 'placement' | 'course' | 'sr_meeting' | 'progression_assessment';
type GroupSuggestType = 'kurs' | 'konferens' | 'annan';
type DashTab = 'st-lakare' | 'aktiviteter' | 'iup' | 'huvudhandledare' | 'klinik';
type ActTemplTab = 'placering' | 'kurs' | 'annan';

interface ActivityTemplate {
  id: string;
  type: ActTemplTab;
  title: string;
  description: string;
  suggested_milestones: string[];
  suggested_rows: string[];
  is_metis: boolean;
  is_active: boolean;
  track_completions: boolean;
}

interface ActiveItem {
  id: string;
  kind: 'message' | 'suggestion';
  activityType?: string;
  recipientId: string;
  recipientName: string;
  date: string;
  status: string;
  summary: string;
}

interface SentMessage {
  id: string;
  message_text: string;
  channel: string;
  read: boolean;
  created_at: string;
}

interface SentSuggestion {
  id: string;
  activity_type: string;
  activity_data: Record<string, string>;
  status: string;
  created_at: string;
}

interface SupervisorAssignment {
  st_lakare_id: string;
  supervisor_id: string;
}

type AffectedActivitiesByUser = Record<
  string,
  { placementIds: string[]; courseIds: string[]; dates: string[] }
>;

/** Kompakta tabellceller (ST-läkare, huvudhandledare, utbildningsaktiviteter). */
const DASH_TBL_TH = 'px-3 py-1.5 text-xs font-semibold text-slate-900';
const DASH_TBL_TD = 'px-3 py-1.5 align-middle text-xs text-slate-800';
const DASH_TBL_TD_STRONG = 'px-3 py-1.5 align-middle text-xs font-semibold text-slate-900';

/** Förnamn för sortering när bara `profile.name` finns (första ordet, svensk locale). */
function sortKeyFirstNameFromDisplayName(displayName: string): string {
  const t = String(displayName || '').trim();
  if (!t) return '\uFFFF';
  return (t.split(/\s+/)[0] || t).trim();
}

/** Svaga pastellfärger för grupp-rubriker under Dashboard → Aktiviteter (kurser / utbildningsmoment). */
const ACTIVITY_TEMPLATE_GROUP_HEADER_STYLES = [
  'border-sky-200/60 bg-sky-50/90 text-sky-900/85',
  'border-violet-200/60 bg-violet-50/90 text-violet-900/80',
  'border-teal-200/60 bg-teal-50/85 text-teal-900/85',
  'border-amber-200/60 bg-amber-50/80 text-amber-950/75',
  'border-rose-200/60 bg-rose-50/90 text-rose-900/80',
  'border-cyan-200/60 bg-cyan-50/80 text-cyan-950/80',
  'border-indigo-200/60 bg-indigo-50/90 text-indigo-900/80',
  'border-emerald-200/60 bg-emerald-50/90 text-emerald-900/85',
] as const;

/** Hindrar parallella METIS-seeds (t.ex. React Strict Mode) som annars kan dubbelinfoga mallar. */
const metisSeedInFlightByClinic = new Map<string, Promise<void>>();

/** Kliniker där METIS-seed redan körts klart (överlever React Strict Mode-remount). */
const metisSeedCompletedForClinic = new Set<string>();

function runMetisSeedSingleFlight(clinicId: string, seed: () => Promise<void>): Promise<void> {
  const existing = metisSeedInFlightByClinic.get(clinicId);
  if (existing) return existing;
  const p = (async () => {
    try {
      await seed();
    } finally {
      metisSeedInFlightByClinic.delete(clinicId);
    }
  })();
  metisSeedInFlightByClinic.set(clinicId, p);
  return p;
}

const AUTO_PLACEMENT_FALLBACK = 'Klinisk tjänstgöring ej planerad aktuellt datum';
const REQUIRED_ROW_PREFIX = '__required__:';
const RECOMMENDED_ROW_PREFIX = '__recommended__:';
/** Helhetskrav för mallen (placering/kurs/utbildningsmoment), inte per föreslaget moment. */
const REQUIREMENT_LEVEL_PREFIX = '__kravniva__:';
const ALTERNATIVE_PREFIX = '__alternativ__:';
type TemplateRequirementLevel = 'obligatorisk' | 'rekommenderad' | 'valfri';
const SUGGESTED_PERIOD_MONTHS_PREFIX = '__suggested_period_months__:';
const COURSE_GROUP_PREFIX = '__course_group__:';
const COURSE_SUBGROUP_PREFIX = '__course_subgroup__:';
const COURSE_GROUPS_CONFIG_TITLE = '__config__:course-groups';
const COURSE_GROUPS_CONFIG_PREFIX = '__course_groups_config_json__:';
const UTBILDNINGSMOMENT_GROUPS_CONFIG_TITLE = '__config__:utbildningsmoment-groups';
const PLACEMENT_GROUPS_CONFIG_TITLE = '__config__:placement-groups';
const IUP_PLANNING_CONFIG_TITLE = '__config__:iup-planning';
const IUP_GOAL_SUGGESTIONS_CONFIG_TITLE = '__config__:iup-goal-suggestions';
const IUP_PLANNING_CONFIG_PREFIX = '__iup_planning_config_json__:';
const IUP_GOAL_SUGGESTIONS_CONFIG_PREFIX = '__iup_goal_suggestions_config_json__:';
/** Legacy: fanns i äldre mallar; ignoreras/strips vid redigering. */
const UTBILDNINGSMOMENT_TYPES_CONFIG_TITLE = '__config__:utbildningsmoment-typer';
const UTBILDNINGSMOMENT_INSTANCE_TYPE_PREFIX = '__utb_moment_typ__:';

const IUP_PLANNING_BASE_SECTIONS: { key: string; label: string }[] = [
  { key: 'clinicalService', label: 'Kliniska tjänstgöringar' },
  { key: 'courses', label: 'Kurser' },
  { key: 'supervisionMeetings', label: 'Handledarsamtal' },
  { key: 'theoreticalStudies', label: 'Teoretiska studier' },
  { key: 'practicalMoments', label: 'Praktiska moment' },
  { key: 'researchWork', label: 'Vetenskapligt arbete' },
  { key: 'journalClub', label: 'Journal club' },
  { key: 'congresses', label: 'Kongresser' },
  { key: 'qualityWork', label: 'Kvalitetsarbete' },
  { key: 'patientSafety', label: 'Patientsäkerhetsarbete' },
  { key: 'leadership', label: 'Ledarskap' },
  { key: 'supervisingStudents', label: 'Handledning av studenter/underläkare' },
  { key: 'teaching', label: 'Undervisning' },
  { key: 'formativeAssessments', label: 'Formativa bedömningar' },
];

type IupGoalGroupId = 'A' | 'B' | 'C' | 'STa' | 'STb' | 'STc' | 'other';

function getIupGoalGroupIdFromCode(codeRaw: string, version: '2015' | '2021'): IupGoalGroupId {
  const code = String(codeRaw || '').trim();
  if (version === '2021') {
    if (/^STA\d+/i.test(code)) return 'STa';
    if (/^STB\d+/i.test(code)) return 'STb';
    if (/^STC\d+/i.test(code)) return 'STc';
    return 'other';
  }
  if (/^A\d+/i.test(code)) return 'A';
  if (/^B\d+/i.test(code)) return 'B';
  if (/^C\d+/i.test(code)) return 'C';
  return 'other';
}

function iupGoalGroupLabel(id: IupGoalGroupId): string {
  switch (id) {
    case 'A':
      return 'Delmål a';
    case 'B':
      return 'Delmål b';
    case 'C':
      return 'Delmål c';
    case 'STa':
      return 'Delmål STa';
    case 'STb':
      return 'Delmål STb';
    case 'STc':
      return 'Delmål STc';
    default:
      return 'Övriga delmål';
  }
}

function iupDashboardCanonMilestoneId(m: { id?: string; code?: string }, version: '2015' | '2021'): string {
  const code = displayMilestoneCode(String(m.code || m.id || ''), version);
  return String(m.id || code).toUpperCase();
}

/**
 * Samma datakälla som IUP → Delmål (MilestoneOverviewModal): specialty + common A/B/STa/STb
 * och mergeWithCommon så beskrivningar/sektioner slås upp från common.json.
 */
function buildIupDelmalMilestonesForDashboard(
  goals: GoalsCatalog | null,
  version: '2015' | '2021'
): GoalsMilestone[] {
  if (!goals) return [];
  const baseArr: GoalsMilestone[] = Array.isArray(goals.milestones) ? goals.milestones : [];

  const hasStc = baseArr.some((m) =>
    /^STc\d+$/i.test(String(m.code ?? m.id ?? ''))
  );

  let mergedList: GoalsMilestone[];

  if (hasStc) {
    const arr = [...baseArr];
    const existingKeys = new Set(
      arr
        .map((m) =>
          String(m.code ?? m.id ?? '')
            .toUpperCase()
            .replace(/\s+/g, '')
        )
        .filter(Boolean)
    );
    Object.values(COMMON_AB_MILESTONES).forEach((cm) => {
      const codeRaw = String(cm.code ?? cm.id ?? '');
      if (!/^ST[AB]\d+$/i.test(codeRaw)) return;
      const codeKey = codeRaw.toUpperCase().replace(/\s+/g, '');
      if (existingKeys.has(codeKey)) return;
      arr.push(cm as GoalsMilestone);
    });
    mergedList = arr;
  } else {
    const withoutAb = baseArr.filter((m) => {
      const rawGroup = String(m.group ?? '').toUpperCase();
      const codeRaw = String(m.code ?? m.id ?? '')
        .toUpperCase()
        .replace(/\s+/g, '');
      if (rawGroup === 'A' || rawGroup === 'B') return false;
      if (/^[AB]\d+$/i.test(codeRaw)) return false;
      return true;
    });
    const commonAb = Object.values(COMMON_AB_MILESTONES).filter((cm) => {
      const codeRaw = String(cm.code ?? cm.id ?? '');
      const key = codeRaw.toUpperCase().replace(/\s+/g, '');
      return /^[AB]\d+/i.test(key);
    }) as GoalsMilestone[];
    mergedList = [...withoutAb, ...commonAb];
  }

  const out: GoalsMilestone[] = [];
  for (const m of mergedList) {
    const enriched = mergeWithCommon(m);
    if (enriched) out.push(enriched as GoalsMilestone);
  }
  return out;
}

const DEFAULT_MILESTONE_SUGGESTIONS: string[] = [
  'Klinisk tjänstgöring',
  'Auskultation',
  'Självständigt skriftligt arbete',
  'Kvalitets-/förbättringsarbete',
  'Kurs/er',
  'Handledning av studenter/AT/BT/underläkare',
  'Undervisning för studenter/AT/BT/underläkare',
  'Deltagande i reflektionsgrupp',
  'Journal Club',
  'Deltagande i kurs/kongress',
  'Återkoppling till kliniken efter kurs/kongress',
  'Leda och delta i APT',
  'Kontinuerlig uppföljning av huvudhandledare',
  'Mini Clinical Evaluation Exercise (Mini-CEX)',
  'Case-based discussion (CBD)',
  'Medsittning',
  '360-gradersbedömning',
  'ST-kollegium',
];

function parseIupPlanningConfig(rows: string[]): { selectedBaseKeys: string[]; suggestedTitles: string[] } | null {
  for (const raw of rows || []) {
    const value = String(raw || '').trim();
    if (!value.startsWith(IUP_PLANNING_CONFIG_PREFIX)) continue;
    try {
      const parsed = JSON.parse(value.slice(IUP_PLANNING_CONFIG_PREFIX.length));
      const selectedBaseKeys = Array.isArray(parsed?.selectedBaseKeys)
        ? parsed.selectedBaseKeys.map((x: unknown) => String(x || '').trim()).filter(Boolean)
        : [];
      const suggestedTitles = Array.isArray(parsed?.suggestedTitles)
        ? parsed.suggestedTitles.map((x: unknown) => String(x || '').trim()).filter(Boolean)
        : [];
      return { selectedBaseKeys, suggestedTitles };
    } catch {
      return null;
    }
  }
  return null;
}

function encodeIupPlanningConfig(selectedBaseKeys: string[], suggestedTitles: string[]): string[] {
  const payload = JSON.stringify({
    selectedBaseKeys: Array.from(new Set((selectedBaseKeys || []).map((x) => String(x || '').trim()).filter(Boolean))),
    suggestedTitles: Array.from(new Set((suggestedTitles || []).map((x) => String(x || '').trim()).filter(Boolean))),
  });
  return [`${IUP_PLANNING_CONFIG_PREFIX}${payload}`];
}

function parseIupGoalSuggestionsConfig(
  rows: string[]
): {
  byMilestone: Record<string, string[]>;
  optionPool: string[];
} | null {
  for (const raw of rows || []) {
    const value = String(raw || '').trim();
    if (!value.startsWith(IUP_GOAL_SUGGESTIONS_CONFIG_PREFIX)) continue;
    try {
      const parsed = JSON.parse(value.slice(IUP_GOAL_SUGGESTIONS_CONFIG_PREFIX.length));
      const byMilestoneSource = parsed?.byMilestone;
      const byMilestone: Record<string, string[]> = {};
      if (byMilestoneSource && typeof byMilestoneSource === 'object' && !Array.isArray(byMilestoneSource)) {
        for (const [k, arr] of Object.entries(byMilestoneSource as Record<string, unknown>)) {
          const key = String(k || '').trim().toUpperCase();
          if (!key || !Array.isArray(arr)) continue;
          byMilestone[key] = Array.from(
            new Set(arr.map((x) => String(x || '').trim()).filter(Boolean))
          );
        }
      }
      const optionPool: string[] = Array.isArray(parsed?.optionPool)
        ? (Array.from(
            new Set(parsed.optionPool.map((x: unknown) => String(x || '').trim()).filter(Boolean))
          ) as string[])
        : [];
      return {
        byMilestone,
        optionPool,
      };
    } catch {
      return null;
    }
  }
  return null;
}

function encodeIupGoalSuggestionsConfig(params: {
  byMilestone: Record<string, string[]>;
  optionPool: string[];
}): string[] {
  const { byMilestone, optionPool } = params;
  const normalizedByMilestone = Object.fromEntries(
    Object.entries(byMilestone || {})
      .map(([k, arr]) => [
        String(k || '').trim().toUpperCase(),
        Array.from(new Set((Array.isArray(arr) ? arr : []).map((x) => String(x || '').trim()).filter(Boolean))),
      ])
      .filter(([k, arr]) => k && arr.length > 0)
  );
  const payload = JSON.stringify({
    byMilestone: normalizedByMilestone,
    optionPool: Array.from(new Set((optionPool || []).map((x) => String(x || '').trim()).filter(Boolean))),
  });
  return [`${IUP_GOAL_SUGGESTIONS_CONFIG_PREFIX}${payload}`];
}

function splitSuggestedRows(rows: string[]): { required: string[]; recommended: string[] } {
  const required: string[] = [];
  const recommended: string[] = [];
  for (const raw of rows || []) {
    const value = String(raw || '').trim();
    if (!value) continue;
    if (value.startsWith(REQUIREMENT_LEVEL_PREFIX)) {
      continue;
    }
    if (value.startsWith(UTBILDNINGSMOMENT_INSTANCE_TYPE_PREFIX)) {
      continue;
    }
    if (value.startsWith(SUGGESTED_PERIOD_MONTHS_PREFIX)) {
      continue;
    }
    if (value.startsWith(COURSE_GROUP_PREFIX)) {
      continue;
    }
    if (value.startsWith(COURSE_SUBGROUP_PREFIX)) {
      continue;
    }
    if (value.startsWith(ALTERNATIVE_PREFIX)) {
      continue;
    }
    if (value.startsWith(RECOMMENDED_ROW_PREFIX)) {
      const cleaned = value.slice(RECOMMENDED_ROW_PREFIX.length).trim();
      if (cleaned) recommended.push(cleaned);
      continue;
    }
    if (value.startsWith(REQUIRED_ROW_PREFIX)) {
      const cleaned = value.slice(REQUIRED_ROW_PREFIX.length).trim();
      if (cleaned) required.push(cleaned);
      continue;
    }
    required.push(value);
  }
  return { required, recommended };
}

function normalizeAlternativeTitleKey(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function getTemplateAlternatives(rows: string[]): string[] {
  const alternatives: string[] = [];
  const seen = new Set<string>();
  for (const raw of rows || []) {
    const value = String(raw || '').trim();
    if (!value.startsWith(ALTERNATIVE_PREFIX)) continue;
    const title = value.slice(ALTERNATIVE_PREFIX.length).trim();
    const key = normalizeAlternativeTitleKey(title);
    if (!title || seen.has(key)) continue;
    seen.add(key);
    alternatives.push(title);
  }
  return alternatives;
}

function stripAlternativesFromRows(rows: string[]): string[] {
  return (rows || []).filter((raw) => !String(raw || '').trim().startsWith(ALTERNATIVE_PREFIX));
}

function withTemplateAlternatives(rows: string[], alternatives: string[]): string[] {
  const cleaned = stripAlternativesFromRows(rows || []);
  const seen = new Set<string>();
  const normalized = alternatives
    .map((value) => String(value || '').trim())
    .filter((value) => {
      const key = normalizeAlternativeTitleKey(value);
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return [...cleaned, ...normalized.map((value) => `${ALTERNATIVE_PREFIX}${value}`)];
}

function getSuggestedPeriodMonths(rows: string[]): string {
  for (const raw of rows || []) {
    const value = String(raw || '').trim();
    if (!value.startsWith(SUGGESTED_PERIOD_MONTHS_PREFIX)) continue;
    return value.slice(SUGGESTED_PERIOD_MONTHS_PREFIX.length).trim();
  }
  return '';
}

function stripRequirementLevelFromRows(rows: string[]): string[] {
  return (rows || []).filter((raw) => !String(raw || '').trim().startsWith(REQUIREMENT_LEVEL_PREFIX));
}

function getTemplateRequirementLevel(rows: string[]): TemplateRequirementLevel {
  for (const raw of rows || []) {
    const value = String(raw || '').trim();
    if (!value.startsWith(REQUIREMENT_LEVEL_PREFIX)) continue;
    const v = value.slice(REQUIREMENT_LEVEL_PREFIX.length).trim().toLowerCase();
    if (v === 'obligatorisk' || v === 'rekommenderad' || v === 'valfri') {
      return v as TemplateRequirementLevel;
    }
  }
  return 'obligatorisk';
}

function withTemplateRequirementLevel(
  rows: string[],
  level: TemplateRequirementLevel
): string[] {
  const cleaned = stripRequirementLevelFromRows(rows || []);
  return [...cleaned, `${REQUIREMENT_LEVEL_PREFIX}${level}`];
}

function templateRequirementLevelLabel(level: TemplateRequirementLevel): string {
  switch (level) {
    case 'rekommenderad':
      return 'Rekommenderad';
    case 'valfri':
      return 'Valfri';
    default:
      return 'Obligatorisk';
  }
}

/** Bakgrund-/kantfärg för kravnivå-pill i aktivitetsmall-tabeller */
function templateRequirementLevelPillClass(level: TemplateRequirementLevel): string {
  switch (level) {
    case 'rekommenderad':
      return 'border-amber-300 bg-amber-100 text-amber-950';
    case 'valfri':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    default:
      return 'border-sky-400 bg-sky-100 text-sky-950';
  }
}

function stripUtbildningsmomentInstanceType(rows: string[]): string[] {
  return (rows || []).filter(
    (r) => !String(r || '').trim().startsWith(UTBILDNINGSMOMENT_INSTANCE_TYPE_PREFIX)
  );
}

function withSuggestedPeriodMonths(rows: string[], monthsValue: string): string[] {
  const cleanedRows = (rows || []).filter(
    (raw) => !String(raw || '').trim().startsWith(SUGGESTED_PERIOD_MONTHS_PREFIX)
  );
  const months = String(monthsValue || '').trim();
  if (!months) return cleanedRows;
  return [...cleanedRows, `${SUGGESTED_PERIOD_MONTHS_PREFIX}${months}`];
}

function getCourseTemplateGroup(rows: string[]): string {
  for (const raw of rows || []) {
    const value = String(raw || '').trim();
    if (!value.startsWith(COURSE_GROUP_PREFIX)) continue;
    return value.slice(COURSE_GROUP_PREFIX.length).trim();
  }
  return '';
}

function withCourseTemplateGroup(rows: string[], groupValue: string): string[] {
  const cleanedRows = (rows || []).filter(
    (raw) => !String(raw || '').trim().startsWith(COURSE_GROUP_PREFIX)
  );
  const group = String(groupValue || '').trim();
  if (!group) return cleanedRows;
  return [...cleanedRows, `${COURSE_GROUP_PREFIX}${group}`];
}

function getCourseTemplateSubgroup(rows: string[]): string {
  for (const raw of rows || []) {
    const value = String(raw || '').trim();
    if (!value.startsWith(COURSE_SUBGROUP_PREFIX)) continue;
    return value.slice(COURSE_SUBGROUP_PREFIX.length).trim();
  }
  return '';
}

function withCourseTemplateSubgroup(rows: string[], subgroupValue: string): string[] {
  const cleanedRows = (rows || []).filter(
    (raw) => !String(raw || '').trim().startsWith(COURSE_SUBGROUP_PREFIX)
  );
  const subgroup = String(subgroupValue || '').trim();
  if (!subgroup) return cleanedRows;
  return [...cleanedRows, `${COURSE_SUBGROUP_PREFIX}${subgroup}`];
}

function encodeSuggestedRows(required: string[], recommended: string[]): string[] {
  return [
    ...required.map((r) => `${REQUIRED_ROW_PREFIX}${r}`),
    ...recommended.map((r) => `${RECOMMENDED_ROW_PREFIX}${r}`),
  ];
}

function parseCourseGroupsConfig(
  rows: string[]
): {
  groups: string[];
  subgroupsByGroup: Record<string, string[]>;
  templateGroupingByTitle: Record<string, { group: string; subgroup?: string }>;
} | null {
  for (const raw of rows || []) {
    const value = String(raw || '').trim();
    if (!value.startsWith(COURSE_GROUPS_CONFIG_PREFIX)) continue;
    const payload = value.slice(COURSE_GROUPS_CONFIG_PREFIX.length);
    try {
      const parsed = JSON.parse(payload);
      const groups = Array.isArray(parsed?.groups)
        ? parsed.groups.map((x: unknown) => String(x || '').trim()).filter(Boolean)
        : [];
      const subgroupsByGroup: Record<string, string[]> = {};
      const source = parsed?.subgroupsByGroup;
      if (source && typeof source === 'object' && !Array.isArray(source)) {
        for (const [group, subgroups] of Object.entries(source as Record<string, unknown>)) {
          const key = String(group || '').trim();
          if (!key || !Array.isArray(subgroups)) continue;
          subgroupsByGroup[key] = subgroups.map((x) => String(x || '').trim()).filter(Boolean);
        }
      }
      const templateGroupingByTitle: Record<string, { group: string; subgroup?: string }> = {};
      const mapSource = parsed?.templateGroupingByTitle;
      if (mapSource && typeof mapSource === 'object' && !Array.isArray(mapSource)) {
        for (const [titleKey, value] of Object.entries(mapSource as Record<string, unknown>)) {
          const key = String(titleKey || '').trim().toLowerCase();
          if (!key || !value || typeof value !== 'object' || Array.isArray(value)) continue;
          const group = String((value as { group?: unknown }).group || '').trim();
          const subgroup = String((value as { subgroup?: unknown }).subgroup || '').trim();
          if (!group) continue;
          templateGroupingByTitle[key] = subgroup ? { group, subgroup } : { group };
        }
      }
      return { groups, subgroupsByGroup, templateGroupingByTitle };
    } catch {
      return null;
    }
  }
  return null;
}

function encodeCourseGroupsConfig(
  groups: string[],
  subgroupsByGroup: Record<string, string[]>,
  templateGroupingByTitle: Record<string, { group: string; subgroup?: string }>
): string[] {
  const payload = JSON.stringify({
    groups: groups.map((x) => String(x || '').trim()).filter(Boolean),
    subgroupsByGroup: Object.fromEntries(
      Object.entries(subgroupsByGroup || {}).map(([k, arr]) => [
        String(k || '').trim(),
        (Array.isArray(arr) ? arr : []).map((x) => String(x || '').trim()).filter(Boolean),
      ])
    ),
    templateGroupingByTitle: Object.fromEntries(
      Object.entries(templateGroupingByTitle || {}).map(([titleKey, value]) => {
        const key = String(titleKey || '').trim().toLowerCase();
        const group = String(value?.group || '').trim();
        const subgroup = String(value?.subgroup || '').trim();
        return [key, subgroup ? { group, subgroup } : { group }];
      })
    ),
  });
  return [`${COURSE_GROUPS_CONFIG_PREFIX}${payload}`];
}

function courseTemplateTitleKey(title: string): string {
  return String(title || '').trim().toLowerCase();
}

function activityTemplateTypeForGroupEditorScope(
  scope: 'kurs' | 'moment' | 'placering' | null
): 'kurs' | 'annan' | 'placering' | null {
  if (scope === 'kurs') return 'kurs';
  if (scope === 'moment') return 'annan';
  if (scope === 'placering') return 'placering';
  return null;
}

function expandMetisMilestones(milestones: string[]): string[] {
  return Array.from(
    new Set(
      milestones.flatMap((milestone) => {
        const normalized = String(milestone || '').trim();
        if (!normalized) return [];
        if (/^ST/i.test(normalized)) return [normalized];
        return [normalized, `ST${normalized}`];
      })
    )
  );
}

const ACTIVITY_TEMPLATE_MILESTONE_PILLS_PER_ROW = 8;

function partitionMilestonesForDisplayLines(ordered: string[]): { preSt: string[]; st: string[] } {
  const preSt: string[] = [];
  const st: string[] = [];
  for (const m of ordered) {
    const up = String(m).toUpperCase().trim();
    if (up.startsWith('ST')) st.push(m);
    else preSt.push(m);
  }
  return { preSt, st };
}

function chunkMilestones(ids: string[], chunkSize: number): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    rows.push(ids.slice(i, i + chunkSize));
  }
  return rows;
}

function ActivityTemplateMilestonePills({ milestones }: { milestones: string[] }) {
  if (!milestones.length) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const ordered = sortMilestoneIds(milestones);
  const { preSt, st } = partitionMilestonesForDisplayLines(ordered);

  const renderChunkRows = (ids: string[], keyPrefix: string) => {
    const rows = chunkMilestones(ids, ACTIVITY_TEMPLATE_MILESTONE_PILLS_PER_ROW);
    return rows.map((chunk, ri) => (
      <div key={`${keyPrefix}-${ri}`} className="flex flex-wrap gap-0.5">
        {chunk.map((m) => {
          const normalized = String(m).toUpperCase().trim();
          const is2021 = normalized.startsWith('ST');
          return (
            <span
              key={`${keyPrefix}-${ri}-${m}`}
              className="inline-flex max-w-full truncate rounded-full border border-slate-200 bg-white px-1.5 py-0 text-[10px] font-medium text-slate-700"
            >
              {displayMilestoneCode(m, is2021 ? '2021' : '2015')}
            </span>
          );
        })}
      </div>
    ));
  };

  return (
    <div className="space-y-0.5">
      {preSt.length > 0 ? <div className="space-y-0.5">{renderChunkRows(preSt, 'pre')}</div> : null}
      {st.length > 0 ? (
        <div
          className={
            preSt.length > 0
              ? 'mt-1.5 space-y-0.5 border-t border-slate-100 pt-1.5'
              : 'space-y-0.5'
          }
        >
          {renderChunkRows(st, 'st')}
        </div>
      ) : null}
    </div>
  );
}

export default function StudierektorDashboard() {
  const { clinic, members, invitations, loading, sendInvitation, cancelInvitation, removeMember, reloadData } = useStudierektorClinic();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteHhEmail, setInviteHhEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [cancelInviteDialog, setCancelInviteDialog] = useState<{id: string; email: string} | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [deleteConfirmConfig, setDeleteConfirmConfig] = useState<{
    title?: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Meddelande-popup
  const [messageTarget, setMessageTarget] = useState<MessageTarget>(null);
  const [messageText, setMessageText] = useState('');
  const [messageChannel, setMessageChannel] = useState<'st_ark' | 'email'>('st_ark');
  const [messageSending, setMessageSending] = useState(false);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [sentMessagesLoading, setSentMessagesLoading] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [messageHistoryOpen, setMessageHistoryOpen] = useState(false);

  // Föreslå aktivitet-popup
  const [suggestTarget, setSuggestTarget] = useState<SuggestTarget>(null);
  const [suggestType, setSuggestType] = useState<SuggestType>('placement');
  const [suggestSending, setSuggestSending] = useState(false);

  // Placering
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestStart, setSuggestStart] = useState('');
  const [suggestEnd, setSuggestEnd] = useState('');
  const [suggestNote, setSuggestNote] = useState('');

  // Kurs
  const [recipientCourses, setRecipientCourses] = useState<{id: string; title: string; courseTitle?: string}[]>([]);
  const [recipientCoursesLoading, setRecipientCoursesLoading] = useState(false);
  const [suggestCourseSelected, setSuggestCourseSelected] = useState('');
  const [suggestCourseCustom, setSuggestCourseCustom] = useState('');
  const [suggestCourseStart, setSuggestCourseStart] = useState('');
  const [suggestCourseEnd, setSuggestCourseEnd] = useState('');
  const [suggestCourseNote, setSuggestCourseNote] = useState('');

  // Studierektorsmöte
  const [suggestMeetingDate, setSuggestMeetingDate] = useState('');
  const [suggestMeetingFocus, setSuggestMeetingFocus] = useState('');
  const [suggestMeetingNote, setSuggestMeetingNote] = useState('');

  // Progressionsbedömning
  const [recipientInstruments, setRecipientInstruments] = useState<string[]>([...DEFAULT_PROGRESSION_INSTRUMENTS]);
  const [recipientInstrumentsLoading, setRecipientInstrumentsLoading] = useState(false);
  const [suggestAssessmentDate, setSuggestAssessmentDate] = useState('');
  const [suggestAssessmentInstrument, setSuggestAssessmentInstrument] = useState('');
  const [suggestAssessmentInstrumentOther, setSuggestAssessmentInstrumentOther] = useState('');
  const [suggestAssessmentLevel, setSuggestAssessmentLevel] = useState('');
  const [suggestAssessmentNote, setSuggestAssessmentNote] = useState('');
  const [activePlacementLabel, setActivePlacementLabel] = useState('');
  const [suggestSendAsEmail, setSuggestSendAsEmail] = useState(false);

  // Aktivitetsförslag-historik
  const [sentSuggestions, setSentSuggestions] = useState<SentSuggestion[]>([]);
  const [sentSuggestionsLoading, setSentSuggestionsLoading] = useState(false);
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<string | null>(null);
  const [suggestionHistoryOpen, setSuggestionHistoryOpen] = useState(false);

  // Dashboard-flik
  const [dashTab, setDashTab] = useState<DashTab>('st-lakare');
  const [actTemplTab, setActTemplTab] = useState<ActTemplTab>('placering');
  const [iupTab, setIupTab] = useState<'planering' | 'handledning' | 'delmal'>('planering');
  const [iupPlanningSelectedBaseKeys, setIupPlanningSelectedBaseKeys] = useState<string[]>(
    IUP_PLANNING_BASE_SECTIONS.map((x) => x.key)
  );
  const [iupPlanningSuggestedTitles, setIupPlanningSuggestedTitles] = useState<string[]>(
    IUP_PLANNING_BASE_SECTIONS.map((x) => x.label)
  );
  const [iupPlanningNewSuggestion, setIupPlanningNewSuggestion] = useState('');
  const [iupGoalSuggestionsByMilestone, setIupGoalSuggestionsByMilestone] = useState<Record<string, string[]>>({});
  const [iupGoalOptionPool, setIupGoalOptionPool] = useState<string[]>(DEFAULT_MILESTONE_SUGGESTIONS);
  const [iupGoalNewOption, setIupGoalNewOption] = useState('');
  const [iupGoalVersion, setIupGoalVersion] = useState<'2015' | '2021'>('2021');
  const [iupGoalSearch, setIupGoalSearch] = useState('');
  const [iupGoalDetail, setIupGoalDetail] = useState<string | null>(null);
  const [iupSavingPlanning, setIupSavingPlanning] = useState(false);
  const [iupSavingGoals, setIupSavingGoals] = useState(false);
  const [iupHandledningExpectations, setIupHandledningExpectations] = useState(DEFAULT_IUP_HANDLEDNING_EXPECTATIONS);
  const [iupSavingHandledning, setIupSavingHandledning] = useState(false);
  const [iupProgressionInstrumentsConfig, setIupProgressionInstrumentsConfig] =
    useState<IupProgressionInstrumentsClinicConfig>(defaultClinicProgressionInstrumentsConfig);
  const [iupSavingProgressionInstruments, setIupSavingProgressionInstruments] = useState(false);

  const iupEditorProgressionSynthesis = useMemo(
    () =>
      mergeProgressionInstrumentsSynthesis(
        iupProgressionInstrumentsConfig.selectedPredefined,
        iupProgressionInstrumentsConfig.customSuggestions
      ),
    [iupProgressionInstrumentsConfig]
  );

  // Aktivitetsmallar
  const [activityTemplates, setActivityTemplates] = useState<ActivityTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ActivityTemplate | null>(null);
  const [templAddOpen, setTemplAddOpen] = useState(false);
  const [trackCompletionsInfoOpen, setTrackCompletionsInfoOpen] = useState(false);
  const [templForm, setTemplForm] = useState<Omit<ActivityTemplate, 'id'>>({type: 'placering', title: '', description: '', suggested_milestones: [], suggested_rows: [], is_metis: false, is_active: true, track_completions: false});
  const [templMilestones2015, setTemplMilestones2015] = useState<string[]>([]);
  const [templMilestones2021, setTemplMilestones2021] = useState<string[]>([]);
  const [templMilestoneInput, setTemplMilestoneInput] = useState('');
  const [templRequiredRowInput, setTemplRequiredRowInput] = useState('');
  const [templRecommendedRowInput, setTemplRecommendedRowInput] = useState('');
  const [templSuggestedPeriodMonths, setTemplSuggestedPeriodMonths] = useState('');
  const [templRequirementLevel, setTemplRequirementLevel] = useState<TemplateRequirementLevel>('obligatorisk');
  const [templAlternatives, setTemplAlternatives] = useState<string[]>(['']);
  const [templCourseGroup, setTemplCourseGroup] = useState('');
  const placementAlternativeOptions = useMemo(() => {
    const currentId = editingTemplate?.id || '';
    const currentTitle = String(templForm.title || '').trim();
    const byKey = new Map<string, string>();
    for (const t of activityTemplates) {
      if (t.type !== 'placering') continue;
      if (currentId && String(t.id) === currentId) continue;
      const title = String(t.title || '').trim();
      if (!title) continue;
      const key = normalizeAlternativeTitleKey(title);
      if (!byKey.has(key)) byKey.set(key, title);
    }
    if (currentTitle) {
      const key = normalizeAlternativeTitleKey(currentTitle);
      if (!byKey.has(key)) byKey.set(key, currentTitle);
    }
    return Array.from(byKey.values()).sort((a, b) =>
      a.localeCompare(b, 'sv-SE', { sensitivity: 'base' })
    );
  }, [activityTemplates, editingTemplate?.id, templForm.title]);
  const [templCourseSubgroup, setTemplCourseSubgroup] = useState('');
  const [courseGroups, setCourseGroups] = useState<string[]>([]);
  const [courseSubgroupsByGroup, setCourseSubgroupsByGroup] = useState<Record<string, string[]>>({});
  const [courseTemplateGroupingByTitle, setCourseTemplateGroupingByTitle] = useState<
    Record<string, { group: string; subgroup?: string }>
  >({});
  const [momentGroups, setMomentGroups] = useState<string[]>([]);
  const [momentSubgroupsByGroup, setMomentSubgroupsByGroup] = useState<Record<string, string[]>>({});
  const [momentTemplateGroupingByTitle, setMomentTemplateGroupingByTitle] = useState<
    Record<string, { group: string; subgroup?: string }>
  >({});
  const [placementGroups, setPlacementGroups] = useState<string[]>([]);
  const [placementSubgroupsByGroup, setPlacementSubgroupsByGroup] = useState<Record<string, string[]>>({});
  const [placementTemplateGroupingByTitle, setPlacementTemplateGroupingByTitle] = useState<
    Record<string, { group: string; subgroup?: string }>
  >({});
  const [courseGroupsConfigHydrated, setCourseGroupsConfigHydrated] = useState(false);
  const [momentGroupsConfigHydrated, setMomentGroupsConfigHydrated] = useState(false);
  const [placementGroupsConfigHydrated, setPlacementGroupsConfigHydrated] = useState(false);
  const [editorClinicId, setEditorClinicId] = useState('');
  /** null = stängt; separata gruppkonfigurationer per aktivitetstyp. */
  const [groupEditorScope, setGroupEditorScope] = useState<null | 'kurs' | 'moment' | 'placering'>(null);
  const [subgroupEditorGroup, setSubgroupEditorGroup] = useState<string | null>(null);
  const [newCourseGroupName, setNewCourseGroupName] = useState('');
  const [newSubgroupName, setNewSubgroupName] = useState('');
  const [renamingGroupKey, setRenamingGroupKey] = useState<string | null>(null);
  const [renamingGroupInput, setRenamingGroupInput] = useState('');
  const [renamingSubgroupCtx, setRenamingSubgroupCtx] = useState<{ group: string; name: string } | null>(null);
  const [renamingSubgroupInput, setRenamingSubgroupInput] = useState('');
  const groupRenameInputRef = useRef<HTMLInputElement>(null);
  const subgroupRenameInputRef = useRef<HTMLInputElement>(null);
  const [templMilestonePickerOpen, setTemplMilestonePickerOpen] = useState(false);
  const [templMilestonePickerTab, setTemplMilestonePickerTab] = useState<'2015' | '2021'>('2021');
  const [templMilestoneDetail, setTemplMilestoneDetail] = useState<string | null>(null);
  const [srGoals, setSrGoals] = useState<GoalsCatalog | null>(null);
  const [srGoals2015, setSrGoals2015] = useState<GoalsCatalog | null>(null);
  const [srGoals2021, setSrGoals2021] = useState<GoalsCatalog | null>(null);
  const [srForSpecialty, setSrForSpecialty] = useState<string>('');

  const templateGrupCtx = useMemo(() => {
    if (actTemplTab === 'annan') {
      return {
        groups: momentGroups,
        setGroups: setMomentGroups,
        subgroupsByGroup: momentSubgroupsByGroup,
        setSubgroupsByGroup: setMomentSubgroupsByGroup,
        setTemplateGroupingByTitle: setMomentTemplateGroupingByTitle,
      } as const;
    }
    if (actTemplTab === 'kurs') {
      return {
        groups: courseGroups,
        setGroups: setCourseGroups,
        subgroupsByGroup: courseSubgroupsByGroup,
        setSubgroupsByGroup: setCourseSubgroupsByGroup,
        setTemplateGroupingByTitle: setCourseTemplateGroupingByTitle,
      } as const;
    }
    if (actTemplTab === 'placering') {
      return {
        groups: placementGroups,
        setGroups: setPlacementGroups,
        subgroupsByGroup: placementSubgroupsByGroup,
        setSubgroupsByGroup: setPlacementSubgroupsByGroup,
        setTemplateGroupingByTitle: setPlacementTemplateGroupingByTitle,
      } as const;
    }
    return null;
  }, [
    actTemplTab,
    momentGroups,
    courseGroups,
    placementGroups,
    momentSubgroupsByGroup,
    courseSubgroupsByGroup,
    placementSubgroupsByGroup,
  ]);

  const groupEditorCtx = useMemo(() => {
    if (groupEditorScope === 'moment') {
      return {
        groups: momentGroups,
        setGroups: setMomentGroups,
        subgroupsByGroup: momentSubgroupsByGroup,
        setSubgroupsByGroup: setMomentSubgroupsByGroup,
      } as const;
    }
    if (groupEditorScope === 'kurs') {
      return {
        groups: courseGroups,
        setGroups: setCourseGroups,
        subgroupsByGroup: courseSubgroupsByGroup,
        setSubgroupsByGroup: setCourseSubgroupsByGroup,
      } as const;
    }
    if (groupEditorScope === 'placering') {
      return {
        groups: placementGroups,
        setGroups: setPlacementGroups,
        subgroupsByGroup: placementSubgroupsByGroup,
        setSubgroupsByGroup: setPlacementSubgroupsByGroup,
      } as const;
    }
    return null;
  }, [
    groupEditorScope,
    momentGroups,
    courseGroups,
    placementGroups,
    momentSubgroupsByGroup,
    courseSubgroupsByGroup,
    placementSubgroupsByGroup,
  ]);

  useEffect(() => {
    if (!groupEditorScope) {
      setRenamingGroupKey(null);
      setRenamingGroupInput('');
      setRenamingSubgroupCtx(null);
      setRenamingSubgroupInput('');
    }
  }, [groupEditorScope]);

  useEffect(() => {
    if (!renamingGroupKey) return;
    const id = requestAnimationFrame(() => {
      groupRenameInputRef.current?.focus();
      groupRenameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [renamingGroupKey]);

  useEffect(() => {
    if (!renamingSubgroupCtx) return;
    const id = requestAnimationFrame(() => {
      subgroupRenameInputRef.current?.focus();
      subgroupRenameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [renamingSubgroupCtx]);

  // Ladda delmålskatalog baserat på SR:s specialitet - både 2015 och 2021
  useEffect(() => {
    (async () => {
      try {
        const userId = await getAuthenticatedUserId();
        if (!userId) return;
        const { data: prof } = await fetchProfileById(userId);
        const spec = prof?.sr_for_specialty || prof?.specialty || 'psykiatri';
        setSrForSpecialty(spec);
        const ver = (prof as any)?.goals_version || 'st_2021';
        const g = await loadGoals(ver, spec);
        setSrGoals(g);
        
        // Ladda båda versionerna för aktivitetsmallar
        const [g2015, g2021] = await Promise.all([
          loadGoals('st_2015', spec),
          loadGoals('st_2021', spec)
        ]);
        setSrGoals2015(g2015);
        setSrGoals2021(g2021);
      } catch { /* ignore */ }
    })();
  }, []);

  // Aktiva meddelandenoteringar
  const [activeItems, setActiveItems] = useState<ActiveItem[]>([]);
  const [activeItemsLoading, setActiveItemsLoading] = useState(false);
  
  // Arkiv för lästa/hanterade meddelanden
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveItems, setArchiveItems] = useState<ActiveItem[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<string>(''); // Filter by ST-läkare user_id

  const isTemplatesTableMissing = (err: any): boolean => {
    const msg = String(err?.message || '').toLowerCase();
    const details = String(err?.details || '').toLowerCase();
    const code = String(err?.code || '').toLowerCase();
    return (
      msg.includes('clinic_activity_templates') ||
      msg.includes('relation') && msg.includes('does not exist') ||
      details.includes('clinic_activity_templates') ||
      code === '42p01' ||
      code === 'pgrst205'
    );
  };

  useEffect(() => {
    if (!templAddOpen) setTrackCompletionsInfoOpen(false);
  }, [templAddOpen]);

  const openActivityTemplateEditor = useCallback((t: ActivityTemplate) => {
    setEditingTemplate(t);
    setTemplRequirementLevel(getTemplateRequirementLevel(t.suggested_rows || []));
    const templateAlternatives = getTemplateAlternatives(t.suggested_rows || []);
    setTemplAlternatives(templateAlternatives.length > 0 ? [...templateAlternatives, ''] : ['']);
    setTemplForm({
      type: t.type,
      title: t.title,
      description: t.description,
      suggested_milestones: [...t.suggested_milestones],
      suggested_rows: stripUtbildningsmomentInstanceType(
        stripAlternativesFromRows(stripRequirementLevelFromRows(t.suggested_rows || []))
      ),
      track_completions: t.track_completions || false,
      is_metis: t.is_metis,
      is_active: t.is_active,
    });
    const milestones2015: string[] = [];
    const milestones2021: string[] = [];
    for (const m of t.suggested_milestones) {
      const normalized = String(m).toUpperCase().trim();
      if (normalized.startsWith('ST')) milestones2021.push(m);
      else milestones2015.push(m);
    }
    setTemplMilestones2015(sortMilestoneIds(milestones2015));
    setTemplMilestones2021(sortMilestoneIds(milestones2021));
    setTemplMilestoneInput('');
    setTemplRequiredRowInput('');
    setTemplRecommendedRowInput('');
    setTemplSuggestedPeriodMonths(getSuggestedPeriodMonths(t.suggested_rows || []));
    const titleKey = courseTemplateTitleKey(t.title);
    const fallbackGrouping =
      t.type === 'annan'
        ? momentTemplateGroupingByTitle[titleKey]
        : t.type === 'placering'
          ? placementTemplateGroupingByTitle[titleKey]
          : courseTemplateGroupingByTitle[titleKey];
    setTemplCourseGroup(
      getCourseTemplateGroup(t.suggested_rows || []) || fallbackGrouping?.group || ''
    );
    setTemplCourseSubgroup(
      getCourseTemplateSubgroup(t.suggested_rows || []) || fallbackGrouping?.subgroup || ''
    );
    setTemplAddOpen(true);
  }, [courseTemplateGroupingByTitle, momentTemplateGroupingByTitle, placementTemplateGroupingByTitle]);

  const openDeleteConfirm = useCallback((config: {
    title?: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  }) => {
    setDeleteConfirmConfig(config);
  }, []);

  // Grupp-skicka
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupMode, setGroupMode] = useState<'message' | 'suggestion'>('message');
  const [groupMessage, setGroupMessage] = useState('');
  const [groupMessageAlsoEmail, setGroupMessageAlsoEmail] = useState(false);
  const [groupSuggestType, setGroupSuggestType] = useState<GroupSuggestType | ''>('');
  const [groupSuggestTitle, setGroupSuggestTitle] = useState('');
  const [groupSuggestStart, setGroupSuggestStart] = useState('');
  const [groupSuggestEnd, setGroupSuggestEnd] = useState('');
  const [groupSuggestNote, setGroupSuggestNote] = useState('');
  const [groupCheckedIds, setGroupCheckedIds] = useState<string[]>([]);
  const [groupSending, setGroupSending] = useState(false);
  const [assignments, setAssignments] = useState<SupervisorAssignment[]>([]);
  const [assignDialog, setAssignDialog] = useState<{ stUserId: string; stName: string } | null>(null);
  const [assignSupervisorId, setAssignSupervisorId] = useState<string>('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [hhDetailOpen, setHhDetailOpen] = useState<{ userId: string; name: string } | null>(null);
  const [hhDetailProfile, setHhDetailProfile] = useState<any>(null);
  const [hhDetailLoading, setHhDetailLoading] = useState(false);
  const [clinicForm, setClinicForm] = useState<{
    clinicName: string;
    sjukhusLabel: string;
    regionLabel: string;
    facilityType: '' | 'sjukhus' | 'vardcentral';
    stChef: string;
    verksamhetschef: string;
    orgHome: string;
  }>({
    clinicName: '',
    sjukhusLabel: '',
    regionLabel: '',
    facilityType: '',
    stChef: '',
    verksamhetschef: '',
    orgHome: '',
  });
  const [clinicSaving, setClinicSaving] = useState(false);
  const [clinicDirty, setClinicDirty] = useState(false);

  const showFeedback = (type: 'ok' | 'err', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadAssignments = useCallback(async () => {
    try {
      const clinicId = await getClinicIdForCurrentUserRole('studierektor');
      if (!clinicId) {
        setAssignments([]);
        return;
      }
      const { data, error } = await listSupervisorAssignmentsByClinicId(clinicId);
      if (error) throw error;
      setAssignments((data || []) as SupervisorAssignment[]);
    } catch (err) {
      console.error('Failed to load supervisor assignments (with clinic_id filter):', {
        message: (err as any)?.message,
        code: (err as any)?.code,
        details: (err as any)?.details,
        hint: (err as any)?.hint,
        raw: err,
      });
      const msg = String((err as any)?.message || err || '').toLowerCase();
      if (msg.includes('404') || msg.includes('not found')) {
        showFeedback('err', 'Kunde inte hämta huvudhandledartilldelningar: tabellen `supervisor_assignments` saknas. Kör `supabase/update_roles_system.sql`.');
      }

      // Fallback: försök läsa utan clinic_id-filter (hjälper om kolumn/typschema eller RLS
      // gör clinic_id-filter problematiskt).
      try {
        const { data: data2, error: error2 } = await listSupervisorAssignments();
        if (error2) throw error2;
        setAssignments((data2 || []) as SupervisorAssignment[]);
      } catch (err2) {
        console.error('Failed to load supervisor assignments (fallback):', {
          message: (err2 as any)?.message,
          code: (err2 as any)?.code,
          details: (err2 as any)?.details,
          hint: (err2 as any)?.hint,
          raw: err2,
        });
        const msg2 = String((err2 as any)?.message || err2 || '').toLowerCase();
        if (msg2.includes('404') || msg2.includes('not found')) {
          showFeedback('err', 'Kunde inte hämta huvudhandledartilldelningar: tabellen `supervisor_assignments` saknas. Kör `supabase/update_roles_system.sql`.');
        }
        setAssignments([]);
      }
    }
  }, []);

  const loadClinicForm = useCallback(async () => {
    try {
      const clinicId = await getClinicIdForCurrentUserRole('studierektor');
      if (!clinicId) return;
      const { data: row } = await getClinicFormRow(clinicId);
      const h = (row as any)?.hospitals;
      const embedded = Array.isArray(h) ? h[0] : h;
      const sjukhusLabel =
        embedded?.name != null && String(embedded.name).trim() !== ''
          ? String(embedded.name)
          : '';
      const regionLabel = embedded?.region != null ? String(embedded.region).trim() : '';
      const rawFt = String((embedded as any)?.facility_type || '').toLowerCase();
      const facilityType: '' | 'sjukhus' | 'vardcentral' =
        rawFt === 'vardcentral' ? 'vardcentral' : rawFt === 'sjukhus' ? 'sjukhus' : '';
      setClinicForm({
        clinicName: String((row as any)?.name || ''),
        sjukhusLabel,
        regionLabel,
        facilityType,
        stChef: String((row as any)?.st_chief || ''),
        verksamhetschef: String((row as any)?.verksamhetschef || ''),
        orgHome: String((row as any)?.org_home || (row as any)?.name || ''),
      });
    } catch {
      setClinicForm((prev) => ({
        ...prev,
        clinicName: clinic?.name || prev.clinicName,
        orgHome: clinic?.name || prev.orgHome,
      }));
    }
  }, [clinic?.name]);

  const saveClinicForm = async (silent = false) => {
    setClinicSaving(true);
    try {
      const clinicId = await getClinicIdForCurrentUserRole('studierektor');
      if (!clinicId) throw new Error('Kunde inte hitta klinik');

      const normalizedStChef = String(clinicForm.stChef || '').trim();
      const normalizedVerksamhetschef = String(clinicForm.verksamhetschef || '').trim();
      const normalizedOrgHome = String(clinicForm.orgHome || '').trim();

      const { error } = await updateClinicChiefFields(
        clinicId,
        normalizedStChef || null,
        normalizedVerksamhetschef || null,
        normalizedOrgHome || null
      );
      if (error) throw error;

      // Verifiera att värden faktiskt gick igenom.
      const { data: verifyRow, error: verifyErr } = await getClinicChiefVerificationRow(clinicId);
      if (verifyErr) throw verifyErr;
      if (verifyRow == null) {
        throw new Error(
          'Kunde inte läsa klinik efter sparning (RLS saknar SELECT på clinics). Kör supabase/fix_clinic_save_and_template_columns.sql.'
        );
      }
      const normalize = (v: unknown) => String(v ?? '').trim();
      const stChiefSaved = normalize((verifyRow as any)?.st_chief);
      const verksamhetschefSaved = normalize((verifyRow as any)?.verksamhetschef);
      const stChiefExpected = normalizedStChef;
      const verksamhetschefExpected = normalizedVerksamhetschef;
      if (stChiefSaved !== stChiefExpected || verksamhetschefSaved !== verksamhetschefExpected) {
        throw new Error('Verifiering misslyckades: klinikuppgifter uppdaterades inte som förväntat.');
      }
      setClinicDirty(false);
      await reloadData();
      await loadClinicForm();
      if (!silent) showFeedback('ok', 'Klinikuppgifter sparade.');
    } catch (err: any) {
      if (!silent) {
        showFeedback(
          'err',
          `Kunde inte spara klinikuppgifter. Kör SQL: supabase/fix_clinic_save_and_template_columns.sql. (${err?.message || 'okänt fel'})`
        );
      }
    } finally {
      setClinicSaving(false);
    }
  };

  // Ladda skickade meddelanden när meddelandepopupen öppnas
  useEffect(() => {
    if (!messageTarget) {
      setSentMessages([]);
      setExpandedMessageId(null);
      setMessageHistoryOpen(false);
      return;
    }
    let cancelled = false;
    setSentMessagesLoading(true);
    (async () => {
      try {
        const userId = await getAuthenticatedUserId();
        if (!userId || cancelled) return;
        const { data } = await listSentMessagesByPair(userId, messageTarget.userId);
        if (!cancelled) setSentMessages(data || []);
      } finally {
        if (!cancelled) setSentMessagesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [messageTarget]);

  // Ladda ST-läkarens kurser när kurs-typ väljs
  useEffect(() => {
    if (!suggestTarget || suggestType !== 'course') return;
    let cancelled = false;
    setRecipientCoursesLoading(true);
    (async () => {
      try {
        const { data } = await listCourseTitlesByUserIdForSuggest(suggestTarget.userId);
        if (!cancelled) {
          const mapped = (data || []).map((c: any) => ({
            id: c.id,
            title: c.title || '',
            courseTitle: c.course_title || undefined,
          }));
          setRecipientCourses(mapped);
        }
      } finally {
        if (!cancelled) setRecipientCoursesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [suggestTarget, suggestType]);

  // Ladda ST-läkarens instrument när progressionsbedömning väljs
  useEffect(() => {
    if (!suggestTarget || suggestType !== 'progression_assessment') return;
    let cancelled = false;
    setRecipientInstrumentsLoading(true);
    (async () => {
      try {
        const { data } = await getIupInstrumentsForUser(suggestTarget.userId);
        if (!cancelled) {
          const loaded = data?.instruments;
          setRecipientInstruments(
            Array.isArray(loaded) && loaded.length > 0 ? loaded : [...iupEditorProgressionSynthesis]
          );
        }
      } finally {
        if (!cancelled) setRecipientInstrumentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [suggestTarget, suggestType, iupEditorProgressionSynthesis]);

  // Ladda skickade aktivitetsförslag när förslagspopupen öppnas
  useEffect(() => {
    if (!suggestTarget) {
      setSentSuggestions([]);
      setExpandedSuggestionId(null);
      setSuggestionHistoryOpen(false);
      return;
    }
    let cancelled = false;
    setSentSuggestionsLoading(true);
    (async () => {
      try {
        const userId = await getAuthenticatedUserId();
        if (!userId || cancelled) return;
        const { data } = await listSentSuggestionsByPair(userId, suggestTarget.userId);
        if (!cancelled) setSentSuggestions(data || []);
      } finally {
        if (!cancelled) setSentSuggestionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [suggestTarget]);

  // Auto-detect aktiv placering för progressionsbedömning
  useEffect(() => {
    if (!suggestTarget || suggestType !== 'progression_assessment' || !suggestAssessmentDate) {
      setActivePlacementLabel('');
      setSuggestAssessmentLevel('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await listPlacementsForSuggestByUserId(suggestTarget.userId);
        if (cancelled || !data) return;
        const date = suggestAssessmentDate;
        const active = data.find((p: any) => {
          const s = p.start_date || '';
          const e = p.end_date || '';
          return s && date >= s && (!e || date <= e);
        });
        if (!cancelled) {
          const label = active ? (active.clinic || active.title || AUTO_PLACEMENT_FALLBACK) : AUTO_PLACEMENT_FALLBACK;
          setActivePlacementLabel(label);
          setSuggestAssessmentLevel(label);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [suggestTarget, suggestType, suggestAssessmentDate]);

  // Ladda aktivitetsmallar
  const loadTemplates = useCallback(async (): Promise<void> => {
    setTemplatesLoading(true);
    try {
      const clinicId = await getClinicIdForCurrentUserRole('studierektor');
      if (!clinicId) return;
      setEditorClinicId(clinicId);
      const { data, error } = await listClinicActivityTemplatesByClinicId(clinicId);
      if (error) {
        if (isTemplatesTableMissing(error)) {
          showFeedback('err', 'Databastabellen för aktivitetsmallar saknas. Kör SQL-migrationen `supabase/create_clinic_activity_templates.sql`.');
          setActivityTemplates([]);
          return;
        }
        showFeedback('err', `Kunde inte ladda aktivitetsmallar: ${error.message}`);
        setActivityTemplates([]);
        return;
      }
      if (data) {
        const configRows = data.filter((r: any) => String(r?.title || '').trim() === COURSE_GROUPS_CONFIG_TITLE);
        const configRow =
          configRows.length > 1
            ? [...configRows].sort(
                (a: any, b: any) =>
                  new Date(String(b?.updated_at || b?.created_at || 0)).getTime() -
                  new Date(String(a?.updated_at || a?.created_at || 0)).getTime()
              )[0]
            : configRows[0];
        const momentConfigRows = data.filter(
          (r: any) => String(r?.title || '').trim() === UTBILDNINGSMOMENT_GROUPS_CONFIG_TITLE
        );
        const momentConfigRow =
          momentConfigRows.length > 1
            ? [...momentConfigRows].sort(
                (a: any, b: any) =>
                  new Date(String(b?.updated_at || b?.created_at || 0)).getTime() -
                  new Date(String(a?.updated_at || a?.created_at || 0)).getTime()
              )[0]
            : momentConfigRows[0];
        const placementConfigRows = data.filter(
          (r: any) => String(r?.title || '').trim() === PLACEMENT_GROUPS_CONFIG_TITLE
        );
        const placementConfigRow =
          placementConfigRows.length > 1
            ? [...placementConfigRows].sort(
                (a: any, b: any) =>
                  new Date(String(b?.updated_at || b?.created_at || 0)).getTime() -
                  new Date(String(a?.updated_at || a?.created_at || 0)).getTime()
              )[0]
            : placementConfigRows[0];

        const annanTitleKeysForMigration = new Set<string>(
          data
            .filter(
              (r: any) =>
                String(r?.type || '').trim() === 'annan' && String(r?.title || '').trim()
            )
            .map((r: any) => courseTemplateTitleKey(String(r.title || '')))
        );
        const placeringTitleKeysForMigration = new Set<string>(
          data
            .filter(
              (r: any) =>
                String(r?.type || '').trim() === 'placering' && String(r?.title || '').trim()
            )
            .map((r: any) => courseTemplateTitleKey(String(r.title || '')))
        );

        let parsedCourseConfig: ReturnType<typeof parseCourseGroupsConfig> | null = null;
        if (configRow) {
          parsedCourseConfig = parseCourseGroupsConfig(configRow.suggested_rows || []);
          if (parsedCourseConfig) {
            setCourseGroups(parsedCourseConfig.groups);
            setCourseSubgroupsByGroup(parsedCourseConfig.subgroupsByGroup);
          }
        } else {
          setCourseGroups([]);
          setCourseSubgroupsByGroup({});
          setCourseTemplateGroupingByTitle({});
        }

        if (momentConfigRow) {
          const parsedMoment = parseCourseGroupsConfig(momentConfigRow.suggested_rows || []);
          if (parsedMoment) {
            setMomentGroups(parsedMoment.groups);
            setMomentSubgroupsByGroup(parsedMoment.subgroupsByGroup);
            setMomentTemplateGroupingByTitle(parsedMoment.templateGroupingByTitle || {});
          }
        } else {
          setMomentGroups([]);
          setMomentSubgroupsByGroup({});
          if (parsedCourseConfig && !momentConfigRow) {
            const full = { ...(parsedCourseConfig.templateGroupingByTitle || {}) };
            const momentPart: Record<string, { group: string; subgroup?: string }> = {};
            for (const tk of annanTitleKeysForMigration) {
              if (full[tk]) {
                momentPart[tk] = full[tk];
                delete full[tk];
              }
            }
            setMomentTemplateGroupingByTitle(momentPart);
          } else {
            setMomentTemplateGroupingByTitle({});
          }
        }

        if (placementConfigRow) {
          const parsedPlacement = parseCourseGroupsConfig(placementConfigRow.suggested_rows || []);
          if (parsedPlacement) {
            setPlacementGroups(parsedPlacement.groups);
            setPlacementSubgroupsByGroup(parsedPlacement.subgroupsByGroup);
            setPlacementTemplateGroupingByTitle(parsedPlacement.templateGroupingByTitle || {});
          }
        } else {
          setPlacementGroups([]);
          setPlacementSubgroupsByGroup({});
          if (parsedCourseConfig && !placementConfigRow) {
            const full = { ...(parsedCourseConfig.templateGroupingByTitle || {}) };
            const placementPart: Record<string, { group: string; subgroup?: string }> = {};
            for (const tk of placeringTitleKeysForMigration) {
              if (full[tk]) {
                placementPart[tk] = full[tk];
              }
            }
            setPlacementTemplateGroupingByTitle(placementPart);
          } else {
            setPlacementTemplateGroupingByTitle({});
          }
        }

        if (configRow && parsedCourseConfig) {
          if (momentConfigRow && placementConfigRow) {
            setCourseTemplateGroupingByTitle(parsedCourseConfig.templateGroupingByTitle || {});
          } else {
            const full = { ...(parsedCourseConfig.templateGroupingByTitle || {}) };
            if (!momentConfigRow) {
              for (const tk of annanTitleKeysForMigration) {
                delete full[tk];
              }
            }
            if (!placementConfigRow) {
              for (const tk of placeringTitleKeysForMigration) {
                delete full[tk];
              }
            }
            setCourseTemplateGroupingByTitle(full);
          }
        }
        const iupPlanningConfigRows = data.filter(
          (r: any) => String(r?.title || '').trim() === IUP_PLANNING_CONFIG_TITLE
        );
        const iupPlanningConfigRow =
          iupPlanningConfigRows.length > 1
            ? [...iupPlanningConfigRows].sort(
                (a: any, b: any) =>
                  new Date(String(b?.updated_at || b?.created_at || 0)).getTime() -
                  new Date(String(a?.updated_at || a?.created_at || 0)).getTime()
              )[0]
            : iupPlanningConfigRows[0];
        if (iupPlanningConfigRow) {
          const parsedPlanningConfig = parseIupPlanningConfig(iupPlanningConfigRow.suggested_rows || []);
          if (parsedPlanningConfig) {
            const selectedBaseKeys = parsedPlanningConfig.selectedBaseKeys.length
              ? parsedPlanningConfig.selectedBaseKeys
              : IUP_PLANNING_BASE_SECTIONS.map((x) => x.key);
            setIupPlanningSelectedBaseKeys([...selectedBaseKeys]);
            const mergedSuggestedTitles = Array.from(
              new Set([
                ...IUP_PLANNING_BASE_SECTIONS.map((x) => x.label),
                ...parsedPlanningConfig.suggestedTitles,
              ])
            );
            setIupPlanningSuggestedTitles(mergedSuggestedTitles);
          }
        }

        const iupGoalConfigRows = data.filter(
          (r: any) => String(r?.title || '').trim() === IUP_GOAL_SUGGESTIONS_CONFIG_TITLE
        );
        const iupGoalConfigRow =
          iupGoalConfigRows.length > 1
            ? [...iupGoalConfigRows].sort(
                (a: any, b: any) =>
                  new Date(String(b?.updated_at || b?.created_at || 0)).getTime() -
                  new Date(String(a?.updated_at || a?.created_at || 0)).getTime()
              )[0]
            : iupGoalConfigRows[0];
        if (iupGoalConfigRow) {
          const parsedGoalConfig = parseIupGoalSuggestionsConfig(iupGoalConfigRow.suggested_rows || []);
          if (parsedGoalConfig) {
            setIupGoalSuggestionsByMilestone(parsedGoalConfig.byMilestone || {});
            const mergedPool = Array.from(new Set([...DEFAULT_MILESTONE_SUGGESTIONS, ...(parsedGoalConfig.optionPool || [])]));
            setIupGoalOptionPool(mergedPool);
          }
        }

        const iupHandledningConfigRows = data.filter(
          (r: any) => String(r?.title || '').trim() === IUP_HANDLEDNING_CONFIG_TITLE
        );
        const iupHandledningConfigRow =
          iupHandledningConfigRows.length > 1
            ? [...iupHandledningConfigRows].sort(
                (a: any, b: any) =>
                  new Date(String(b?.updated_at || b?.created_at || 0)).getTime() -
                  new Date(String(a?.updated_at || a?.created_at || 0)).getTime()
              )[0]
            : iupHandledningConfigRows[0];
        if (iupHandledningConfigRow) {
          const parsedHandledning = parseIupHandledningConfig(iupHandledningConfigRow.suggested_rows || []);
          if (parsedHandledning) setIupHandledningExpectations(parsedHandledning);
        }

        const iupProgressionConfigRows = data.filter(
          (r: any) => String(r?.title || '').trim() === IUP_PROGRESSION_INSTRUMENTS_CONFIG_TITLE
        );
        const iupProgressionConfigRow =
          iupProgressionConfigRows.length > 1
            ? [...iupProgressionConfigRows].sort(
                (a: any, b: any) =>
                  new Date(String(b?.updated_at || b?.created_at || 0)).getTime() -
                  new Date(String(a?.updated_at || a?.created_at || 0)).getTime()
              )[0]
            : iupProgressionConfigRows[0];
        if (iupProgressionConfigRow) {
          const parsedProgression = parseIupProgressionInstrumentsConfig(
            iupProgressionConfigRow.suggested_rows || []
          );
          if (parsedProgression) setIupProgressionInstrumentsConfig(parsedProgression);
        }

        const visibleRows = data.filter((r: any) => {
          const title = String(r?.title || '').trim();
          return !title.startsWith('__config__:');
        });
        setActivityTemplates(
          visibleRows.map((r: any) => ({
            id: r.id, type: r.type, title: r.title, description: r.description || '',
            suggested_milestones: r.suggested_milestones || [], suggested_rows: r.suggested_rows || [],
            is_metis: r.is_metis || false, is_active: r.is_active !== false, track_completions: r.track_completions || false,
          }))
        );
      }
      setCourseGroupsConfigHydrated(true);
      setMomentGroupsConfigHydrated(true);
      setPlacementGroupsConfigHydrated(true);
    } finally { setTemplatesLoading(false); }
  }, []);

  // METIS-kursdata för auto-seed
  const METIS_VUXEN: [string, string[]][] = [
    ["Akutpsykiatri", ["c2","c3","b1","a2"]],
    ["Psykiatrisk diagnostik", ["c1","c2","b1","a2"]],
    ["Psykiatrisk juridik", ["c10","c13","b1","a2","a6"]],
    ["Psykofarmakologi", ["c4"]],
    ["Suicidologi", ["c3","b1","a2"]],
    ["Levnadsvanor vid psykisk sjukdom", ["b1","b2","a2"]],
    ["Beroendelära", ["c6","c13","b1","b2","b3","a2"]],
    ["Affektiva sjukdomar", ["c1","c4","b1","a2"]],
    ["BUP för vuxenpsykiatriker", ["c8","b1","b3","b4"]],
    ["Konsultationspsykiatri och psykosomatik", ["c10","b1","a2"]],
    ["Neuropsykiatri", ["c2","c8","c11","b1"]],
    ["Personlighetssyndrom", ["c1","b1","a2"]],
    ["Psykossjukdomar", ["c1","c4","b1","b2","a2"]],
    ["Ätstörningar", ["c2","c8","b1","b3","a2"]],
    ["OCD- och relaterade syndrom", ["c1","b1","a2"]],
    ["Ångest-, trauma- och stressrelaterade syndrom", ["c1","b1","a2"]],
    ["Äldrepsykiatri", ["c7","b1","b3","a2"]],
    ["Kritisk läkemedelsvärdering inom psykofarmakologi", ["c4","b3","a5"]],
    ["Medicinsk vetenskap", ["b1","a2"]],
    ["Psykiatrisk neurovetenskap", ["c1"]],
    ["Psykiatri & samhälle", ["c13","b1","b2","b4","a2"]],
    ["Rättspsykiatri", ["c10","c13","b1","a2","a6"]],
    ["Sexualmedicin och könsdysfori", ["c2","b1","a2"]],
    ["Transkulturell psykiatri", ["c2","c13","b1","a2"]],
  ];
  const METIS_BUP: [string, string[]][] = [
    ["BUP Akutpsykiatri", ["c1","c5","c8","c9","a2","a6","b1","b2","b3"]],
    ["Grundläggande barn- och ungdomspsykiatrisk bedömning och diagnostik", ["c3","c4","a2","b1"]],
    ["BUP Suicidologi", ["c1","c3","c8","a2","a6","b1","b2"]],
    ["BUP Utvecklingspsykologi", ["c4","a2","b1"]],
    ["BUP Ångest- och tvångssyndrom", ["c3","c5","a2","b2","b3"]],
    ["BUP Juridik", ["c8","a2","a6"]],
    ["BUP Substansbrukssyndrom", ["c1","c3","c5","c9","a2","b1","b2"]],
    ["BUP Psykofarmakologi", ["c3","c5","a2","b3"]],
    ["BUP Depression", ["c1","c3","c5","c8","a2","a6","b1","b2","b3"]],
    ["BUP Neuropsykiatri", ["c3","c4","c5","a2","b1","b2","b3"]],
    ["BUP Pediatrik", ["c4","c11","a2","b1","b2"]],
    ["BUP Normbrytande beteende", ["c3","c4","c8","c9","c12","a2","a6","b2"]],
    ["BUP Bipolärt syndrom och psykos", ["c1","c3","c5","c8","a2","a6","b1","b2","b3"]],
    ["BUP Trauma och migration", ["c3","c5","c8","a2","b1","b2"]],
    ["Ätstörningar", ["c3","c10","b1","b3","a2"]],
  ];

  const seedMetisCourses = useCallback(async (clinicId: string, srForSpecialty: string): Promise<boolean> => {
    const spec = srForSpecialty.toLowerCase();
    const isPsych = spec.includes('psykiatri') || spec.includes('bup') || spec.includes('rattspsykiatri') || spec.includes('beroendemedicin');
    if (!isPsych) return true;
    const isBup = spec.includes('bup') || spec.includes('barn') || spec.includes('ungdom');
    const list = isBup ? METIS_BUP : METIS_VUXEN;

    const { error: deleteError } = await deleteClinicMetisTemplatesByClinicId(clinicId);

    if (deleteError) {
      if (isTemplatesTableMissing(deleteError)) {
        showFeedback('err', 'Kan inte uppdatera METIS-kurser: tabellen `clinic_activity_templates` saknas. Kör migrationen `supabase/create_clinic_activity_templates.sql`.');
        return false;
      }
      showFeedback('err', `Kunde inte rensa gamla METIS-kurser: ${deleteError.message}`);
      return false;
    }

    const rowsToInsert = list.map(([title, milestones]) => ({
        clinic_id: clinicId,
        type: 'kurs' as const,
        title,
        description: '',
        suggested_milestones: expandMetisMilestones(milestones),
        suggested_rows: [] as string[],
        is_metis: true,
        is_active: true,
      }));

    const { error } = await insertClinicActivityTemplates(rowsToInsert as unknown as Record<string, unknown>[]);
    if (error) {
      if (isTemplatesTableMissing(error)) {
        showFeedback('err', 'Kan inte lägga till METIS-kurser: tabellen `clinic_activity_templates` saknas. Kör migrationen `supabase/create_clinic_activity_templates.sql`.');
        return false;
      }
      showFeedback('err', `METIS-seed misslyckades: ${error.message}`);
      return false;
    }
    // Silent success: avoid noisy toast on automatic METIS restore.
    await loadTemplates();
    return true;
  }, [loadTemplates]);

  useEffect(() => {
    if (dashTab === 'aktiviteter' || dashTab === 'iup') {
      loadTemplates();
    }
  }, [dashTab, loadTemplates]);

  useEffect(() => {
    const fromTemplates = Array.from(
      new Set(
        (activityTemplates || [])
          .filter((t) => t.type === 'kurs')
          .map((t) => getCourseTemplateGroup(t.suggested_rows || []))
          .filter(Boolean)
      )
    );
    if (fromTemplates.length === 0) return;
    setCourseGroups((prev) => {
      const merged = [...prev];
      for (const g of fromTemplates) if (!merged.includes(g)) merged.push(g);
      return merged;
    });
  }, [activityTemplates]);

  useEffect(() => {
    const fromTemplates = Array.from(
      new Set(
        (activityTemplates || [])
          .filter((t) => t.type === 'annan')
          .map((t) => getCourseTemplateGroup(t.suggested_rows || []))
          .filter(Boolean)
      )
    );
    if (fromTemplates.length === 0) return;
    setMomentGroups((prev) => {
      const merged = [...prev];
      for (const g of fromTemplates) if (!merged.includes(g)) merged.push(g);
      return merged;
    });
  }, [activityTemplates]);

  useEffect(() => {
    const fromTemplates = Array.from(
      new Set(
        (activityTemplates || [])
          .filter((t) => t.type === 'placering')
          .map((t) => getCourseTemplateGroup(t.suggested_rows || []))
          .filter(Boolean)
      )
    );
    if (fromTemplates.length === 0) return;
    setPlacementGroups((prev) => {
      const merged = [...prev];
      for (const g of fromTemplates) if (!merged.includes(g)) merged.push(g);
      return merged;
    });
  }, [activityTemplates]);

  useEffect(() => {
    if (!courseGroupsConfigHydrated) return;
    if (!editorClinicId) return;
    const timer = window.setTimeout(async () => {
      const payload = {
        clinic_id: editorClinicId,
        type: 'annan' as const,
        title: COURSE_GROUPS_CONFIG_TITLE,
        description: 'Systemkonfiguration för kursgrupper',
        suggested_milestones: [] as string[],
        suggested_rows: encodeCourseGroupsConfig(
          courseGroups,
          courseSubgroupsByGroup,
          courseTemplateGroupingByTitle
        ),
        is_metis: false,
        is_active: false,
        track_completions: false,
      };
      const { error } = await saveClinicActivityTemplateConfig(
        editorClinicId,
        COURSE_GROUPS_CONFIG_TITLE,
        payload
      );
      if (error) {
        showFeedback('err', `Kunde inte autospara kursgrupper: ${error.message}`);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    courseGroupsConfigHydrated,
    editorClinicId,
    courseGroups,
    courseSubgroupsByGroup,
    courseTemplateGroupingByTitle,
  ]);

  useEffect(() => {
    if (!momentGroupsConfigHydrated) return;
    if (!editorClinicId) return;
    const timer = window.setTimeout(async () => {
      const payload = {
        clinic_id: editorClinicId,
        type: 'annan' as const,
        title: UTBILDNINGSMOMENT_GROUPS_CONFIG_TITLE,
        description: 'Systemkonfiguration för utbildningsmoment-grupper',
        suggested_milestones: [] as string[],
        suggested_rows: encodeCourseGroupsConfig(
          momentGroups,
          momentSubgroupsByGroup,
          momentTemplateGroupingByTitle
        ),
        is_metis: false,
        is_active: false,
        track_completions: false,
      };
      const { error } = await saveClinicActivityTemplateConfig(
        editorClinicId,
        UTBILDNINGSMOMENT_GROUPS_CONFIG_TITLE,
        payload
      );
      if (error) {
        showFeedback('err', `Kunde inte autospara utbildningsmoment-grupper: ${error.message}`);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    momentGroupsConfigHydrated,
    editorClinicId,
    momentGroups,
    momentSubgroupsByGroup,
    momentTemplateGroupingByTitle,
  ]);

  useEffect(() => {
    const fromTemplates: Record<string, string[]> = {};
    for (const t of activityTemplates || []) {
      if (t.type !== 'kurs') continue;
      const group = getCourseTemplateGroup(t.suggested_rows || []);
      const subgroup = getCourseTemplateSubgroup(t.suggested_rows || []);
      if (!group || !subgroup) continue;
      if (!fromTemplates[group]) fromTemplates[group] = [];
      if (!fromTemplates[group].includes(subgroup)) fromTemplates[group].push(subgroup);
    }
    if (Object.keys(fromTemplates).length === 0) return;
    setCourseSubgroupsByGroup((prev) => {
      const next: Record<string, string[]> = { ...prev };
      for (const [group, subs] of Object.entries(fromTemplates)) {
        const existing = next[group] || [];
        next[group] = Array.from(new Set([...existing, ...subs]));
      }
      return next;
    });
  }, [activityTemplates]);

  useEffect(() => {
    const fromTemplates: Record<string, string[]> = {};
    for (const t of activityTemplates || []) {
      if (t.type !== 'annan') continue;
      const group = getCourseTemplateGroup(t.suggested_rows || []);
      const subgroup = getCourseTemplateSubgroup(t.suggested_rows || []);
      if (!group || !subgroup) continue;
      if (!fromTemplates[group]) fromTemplates[group] = [];
      if (!fromTemplates[group].includes(subgroup)) fromTemplates[group].push(subgroup);
    }
    if (Object.keys(fromTemplates).length === 0) return;
    setMomentSubgroupsByGroup((prev) => {
      const next: Record<string, string[]> = { ...prev };
      for (const [group, subs] of Object.entries(fromTemplates)) {
        const existing = next[group] || [];
        next[group] = Array.from(new Set([...existing, ...subs]));
      }
      return next;
    });
  }, [activityTemplates]);

  useEffect(() => {
    const fromTemplates: Record<string, string[]> = {};
    for (const t of activityTemplates || []) {
      if (t.type !== 'placering') continue;
      const group = getCourseTemplateGroup(t.suggested_rows || []);
      const subgroup = getCourseTemplateSubgroup(t.suggested_rows || []);
      if (!group || !subgroup) continue;
      if (!fromTemplates[group]) fromTemplates[group] = [];
      if (!fromTemplates[group].includes(subgroup)) fromTemplates[group].push(subgroup);
    }
    if (Object.keys(fromTemplates).length === 0) return;
    setPlacementSubgroupsByGroup((prev) => {
      const next: Record<string, string[]> = { ...prev };
      for (const [group, subs] of Object.entries(fromTemplates)) {
        const existing = next[group] || [];
        next[group] = Array.from(new Set([...existing, ...subs]));
      }
      return next;
    });
  }, [activityTemplates]);

  useEffect(() => {
    if (!placementGroupsConfigHydrated) return;
    if (!editorClinicId) return;
    const timer = window.setTimeout(async () => {
      const payload = {
        clinic_id: editorClinicId,
        type: 'annan' as const,
        title: PLACEMENT_GROUPS_CONFIG_TITLE,
        description: 'Systemkonfiguration för grupper – kliniska tjänstgöringar',
        suggested_milestones: [] as string[],
        suggested_rows: encodeCourseGroupsConfig(
          placementGroups,
          placementSubgroupsByGroup,
          placementTemplateGroupingByTitle
        ),
        is_metis: false,
        is_active: false,
        track_completions: false,
      };
      const { error } = await saveClinicActivityTemplateConfig(
        editorClinicId,
        PLACEMENT_GROUPS_CONFIG_TITLE,
        payload
      );
      if (error) {
        showFeedback('err', `Kunde inte autospara grupper för kliniska tjänstgöringar: ${error.message}`);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    placementGroupsConfigHydrated,
    editorClinicId,
    placementGroups,
    placementSubgroupsByGroup,
    placementTemplateGroupingByTitle,
  ]);

  // Auto-seed METIS efter att templates har laddats - only once per session
  const [metisSeeded, setMetisSeeded] = useState(false);
  useEffect(() => {
    if (dashTab !== 'aktiviteter' || templatesLoading || metisSeeded) return;

    (async () => {
      try {
        const userId = await getAuthenticatedUserId();
        if (!userId) return;
        const { data: prof } = await fetchProfileById(userId);
        if (!prof?.sr_for_specialty) return;
        const clinicId = await getClinicIdForCurrentUserRole('studierektor');
        if (!clinicId) return;
        if (metisSeedCompletedForClinic.has(clinicId)) {
          setMetisSeeded(true);
          return;
        }
        await runMetisSeedSingleFlight(clinicId, async () => {
          const ok = await seedMetisCourses(clinicId, String(prof.sr_for_specialty));
          if (!ok) throw new Error('metis-seed-failed');
        });
        metisSeedCompletedForClinic.add(clinicId);
        setMetisSeeded(true);
      } catch { /* ignore */ }
    })();
  }, [dashTab, templatesLoading, metisSeeded, seedMetisCourses]);

  const saveTemplate = async (templ: Omit<ActivityTemplate, 'id'>, existingId?: string): Promise<boolean> => {
    try {
      const clinicId = await getClinicIdForCurrentUserRole('studierektor');
      if (!clinicId) { showFeedback('err', 'Kunde inte hitta din klinik. Kontrollera att du är registrerad som studierektor.'); return false; }

      if (existingId) {
        const oldTemplate = activityTemplates.find((x) => x.id === existingId) || null;
        const payload = { ...templ, updated_at: new Date().toISOString() };
        const { error, usedTrackFallback } = await saveClinicActivityTemplate(payload, existingId);
        if (!error && usedTrackFallback) { showFeedback('ok', 'Mall uppdaterad. (Kör add_track_completions_column.sql för att aktivera "Redovisa utbildningsmoment samlat".)'); loadTemplates(); return true; }
        if (error) {
          if (isTemplatesTableMissing(error)) {
            showFeedback('err', 'Kan inte spara: tabellen `clinic_activity_templates` saknas. Kör migrationen `supabase/create_clinic_activity_templates.sql`.');
            return false;
          }
          showFeedback('err', `Kunde inte spara: ${error.message}`);
          return false;
        }
        const oldTitle = String(oldTemplate?.title || '').trim();
        const newTitle = String(templ.title || '').trim();
        const oldType = (oldTemplate?.type || templ.type) as ActTemplTab;
        if (oldTemplate && oldTitle && newTitle && oldTitle !== newTitle) {
          await propagateTemplateRename(clinicId, oldType, oldTitle, newTitle);
        }
      } else {
        const payload = { ...templ, clinic_id: clinicId };
        const { error, usedTrackFallback } = await saveClinicActivityTemplate(payload);
        if (!error && usedTrackFallback) { showFeedback('ok', 'Mall tillagd. (Kör add_track_completions_column.sql för att aktivera "Redovisa utbildningsmoment samlat".)'); loadTemplates(); return true; }
        if (error) {
          if (isTemplatesTableMissing(error)) {
            showFeedback('err', 'Kan inte lägga till: tabellen `clinic_activity_templates` saknas. Kör migrationen `supabase/create_clinic_activity_templates.sql`.');
            return false;
          }
          showFeedback('err', `Kunde inte lägga till: ${error.message}`);
          return false;
        }
      }
      showFeedback('ok', existingId ? 'Mall uppdaterad.' : 'Mall tillagd.');
      loadTemplates();
      return true;
    } catch (e: any) {
      showFeedback('err', `Fel: ${e?.message || 'Okänt fel'}`);
      return false;
    }
  };

  const synchronizePlacementAlternatives = useCallback(
    async (params: {
      clinicId: string;
      currentTemplateId?: string;
      currentTitle: string;
      previousTitle?: string;
      selectedAlternativeTitles: string[];
    }) => {
      const currentTitle = String(params.currentTitle || '').trim();
      if (!currentTitle) return;
      const { data, error } = await listClinicActivityTemplatesByClinicId(params.clinicId);
      if (error) {
        showFeedback('err', `Kunde inte synka alternativ: ${error.message}`);
        return;
      }
      const rows = Array.isArray(data) ? data : [];
      const templates = rows
        .filter((row) => String((row as { type?: string } | null)?.type || '') === 'placering')
        .map((row) => ({
          id: String((row as { id?: string } | null)?.id || ''),
          title: String((row as { title?: string } | null)?.title || '').trim(),
          suggested_rows: Array.isArray((row as { suggested_rows?: unknown } | null)?.suggested_rows)
            ? ((row as { suggested_rows?: unknown[] } | null)?.suggested_rows || []).map((v) => String(v || ''))
            : [],
        }))
        .filter((row) => row.id && row.title);

      const selectedKeySet = new Set(
        params.selectedAlternativeTitles
          .map((value) => normalizeAlternativeTitleKey(value))
          .filter((value) => value.length > 0)
      );
      const currentTitleKey = normalizeAlternativeTitleKey(currentTitle);
      const previousTitleKey = normalizeAlternativeTitleKey(params.previousTitle || '');
      const currentTemplate = params.currentTemplateId
        ? templates.find((t) => t.id === params.currentTemplateId)
        : templates.find((t) => normalizeAlternativeTitleKey(t.title) === currentTitleKey);
      const currentTemplateId = currentTemplate?.id || '';
      if (!currentTemplateId) return;

      const updates: Array<{ id: string; suggested_rows: string[] }> = [];
      for (const template of templates) {
        if (template.id === currentTemplateId) continue;
        const templateKey = normalizeAlternativeTitleKey(template.title);
        const shouldContainCurrent = selectedKeySet.has(templateKey);
        const currentAlternatives = getTemplateAlternatives(template.suggested_rows);
        const nextSet = new Set(
          currentAlternatives
            .map((value) => normalizeAlternativeTitleKey(value))
            .filter((value) => value.length > 0)
        );
        if (previousTitleKey) nextSet.delete(previousTitleKey);
        if (shouldContainCurrent) nextSet.add(currentTitleKey);
        else nextSet.delete(currentTitleKey);

        const normalizedCurrent = new Set(
          currentAlternatives
            .map((value) => normalizeAlternativeTitleKey(value))
            .filter((value) => value.length > 0)
        );
        if (
          nextSet.size === normalizedCurrent.size &&
          Array.from(nextSet).every((value) => normalizedCurrent.has(value))
        ) {
          continue;
        }

        const keyToDisplay = new Map<string, string>();
        for (const value of currentAlternatives) {
          const key = normalizeAlternativeTitleKey(value);
          if (!keyToDisplay.has(key)) keyToDisplay.set(key, value);
        }
        if (!keyToDisplay.has(currentTitleKey)) keyToDisplay.set(currentTitleKey, currentTitle);
        const finalAlternatives = Array.from(nextSet).map(
          (key) => keyToDisplay.get(key) || currentTitle
        );
        updates.push({
          id: template.id,
          suggested_rows: withTemplateAlternatives(template.suggested_rows, finalAlternatives),
        });
      }

      for (const update of updates) {
        const { error: updateError } = await updateClinicActivityTemplateById(update.id, {
          suggested_rows: update.suggested_rows,
          updated_at: new Date().toISOString(),
        });
        if (updateError) {
          showFeedback('err', `Kunde inte synka alternativ: ${updateError.message}`);
          return;
        }
      }
    },
    [showFeedback]
  );

  const saveCourseGroupingForTemplate = useCallback(
    async (
      templateId: string,
      baseRows: string[],
      groupValue: string,
      subgroupValue: string
    ): Promise<boolean> => {
      const existing = activityTemplates.find((x) => x.id === templateId);
      const level = existing
        ? getTemplateRequirementLevel(existing.suggested_rows || [])
        : 'obligatorisk';
      let nextRows = withCourseTemplateSubgroup(
        withCourseTemplateGroup(baseRows, groupValue),
        subgroupValue
      );
      nextRows = withTemplateRequirementLevel(stripRequirementLevelFromRows(nextRows), level);
      const { error } = await updateClinicActivityTemplateById(templateId, {
        suggested_rows: nextRows,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        showFeedback('err', `Kunde inte spara kursgrupp: ${error.message}`);
        return false;
      }

      const { data: verifyRow, error: verifyErr } = await getClinicActivityTemplateById(templateId);
      if (verifyErr) {
        showFeedback('err', `Kunde inte verifiera kursgrupp: ${verifyErr.message}`);
        return false;
      }
      const verifiedRows = Array.isArray((verifyRow as any)?.suggested_rows)
        ? ((verifyRow as any).suggested_rows as string[])
        : [];
      const verifiedGroup = getCourseTemplateGroup(verifiedRows);
      const verifiedSubgroup = getCourseTemplateSubgroup(verifiedRows);
      const expectedGroup = String(groupValue || '').trim();
      const expectedSubgroup = String(subgroupValue || '').trim();
      if (verifiedGroup !== expectedGroup || verifiedSubgroup !== expectedSubgroup) {
        showFeedback('err', 'Verifiering misslyckades: kursgrupp sparades inte korrekt.');
        return false;
      }

      setActivityTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, suggested_rows: verifiedRows } : t))
      );
      return true;
    },
    [activityTemplates]
  );

  const renameGroupInEditor = useCallback(
    async (oldName: string, rawNew: string) => {
      const newName = String(rawNew || '').trim();
      if (!newName || newName === oldName) {
        setRenamingGroupKey(null);
        setRenamingGroupInput('');
        return;
      }
      if (!groupEditorCtx || !groupEditorScope) {
        setRenamingGroupKey(null);
        setRenamingGroupInput('');
        return;
      }
      if (!groupEditorCtx.groups.includes(oldName)) {
        setRenamingGroupKey(null);
        setRenamingGroupInput('');
        return;
      }
      if (groupEditorCtx.groups.includes(newName)) {
        showFeedback('err', 'Det finns redan en grupp med det namnet.');
        requestAnimationFrame(() => groupRenameInputRef.current?.focus());
        return;
      }
      setRenamingGroupKey(null);
      setRenamingGroupInput('');
      const templType = activityTemplateTypeForGroupEditorScope(groupEditorScope);
      if (!templType) return;

      const toPersist: { id: string; suggested_rows: string[] }[] = [];
      for (const t of activityTemplates) {
        if (t.type !== templType) continue;
        if (getCourseTemplateGroup(t.suggested_rows || []) !== oldName) continue;
        const level = getTemplateRequirementLevel(t.suggested_rows || []);
        let nextRows = stripRequirementLevelFromRows(t.suggested_rows || []);
        nextRows = withCourseTemplateGroup(nextRows, newName);
        nextRows = withCourseTemplateSubgroup(nextRows, getCourseTemplateSubgroup(t.suggested_rows || []));
        nextRows = withTemplateRequirementLevel(nextRows, level);
        toPersist.push({ id: t.id, suggested_rows: nextRows });
      }

      groupEditorCtx.setGroups((prev) => prev.map((x) => (x === oldName ? newName : x)));
      groupEditorCtx.setSubgroupsByGroup((prev) => {
        const subs = prev[oldName];
        const { [oldName]: _removed, ...rest } = prev;
        return subs !== undefined ? { ...rest, [newName]: subs } : rest;
      });

      const patchTitleMap = (
        setter: Dispatch<SetStateAction<Record<string, { group: string; subgroup?: string }>>>
      ) => {
        setter((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            const v = next[k];
            if (v?.group === oldName) {
              next[k] = v.subgroup ? { group: newName, subgroup: v.subgroup } : { group: newName };
            }
          }
          return next;
        });
      };
      if (groupEditorScope === 'kurs') patchTitleMap(setCourseTemplateGroupingByTitle);
      else if (groupEditorScope === 'moment') patchTitleMap(setMomentTemplateGroupingByTitle);
      else if (groupEditorScope === 'placering') patchTitleMap(setPlacementTemplateGroupingByTitle);

      setActivityTemplates((prev) =>
        prev.map((t) => {
          const u = toPersist.find((x) => x.id === t.id);
          return u ? { ...t, suggested_rows: u.suggested_rows } : t;
        })
      );

      if (templCourseGroup === oldName) setTemplCourseGroup(newName);
      if (subgroupEditorGroup === oldName) setSubgroupEditorGroup(newName);
      setRenamingSubgroupCtx((prev) =>
        prev && prev.group === oldName ? { group: newName, name: prev.name } : prev
      );

      for (const row of toPersist) {
        const { error } = await updateClinicActivityTemplateById(row.id, {
          suggested_rows: row.suggested_rows,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          showFeedback('err', `Kunde inte spara omdöpt grupp: ${error.message}`);
          await loadTemplates();
          return;
        }
      }
    },
    [
      groupEditorCtx,
      groupEditorScope,
      activityTemplates,
      showFeedback,
      loadTemplates,
      templCourseGroup,
      subgroupEditorGroup,
    ]
  );

  const renameSubgroupInEditor = useCallback(
    async (parentGroup: string, oldSg: string, rawNew: string) => {
      const newSg = String(rawNew || '').trim();
      if (!newSg || newSg === oldSg) {
        setRenamingSubgroupCtx(null);
        setRenamingSubgroupInput('');
        return;
      }
      if (!groupEditorCtx || !groupEditorScope) {
        setRenamingSubgroupCtx(null);
        setRenamingSubgroupInput('');
        return;
      }
      const subList = groupEditorCtx.subgroupsByGroup[parentGroup] || [];
      if (!subList.includes(oldSg)) {
        setRenamingSubgroupCtx(null);
        setRenamingSubgroupInput('');
        return;
      }
      if (subList.includes(newSg)) {
        showFeedback('err', 'Det finns redan en undergrupp med det namnet.');
        requestAnimationFrame(() => subgroupRenameInputRef.current?.focus());
        return;
      }
      setRenamingSubgroupCtx(null);
      setRenamingSubgroupInput('');
      const templType = activityTemplateTypeForGroupEditorScope(groupEditorScope);
      if (!templType) return;

      const toPersist: { id: string; suggested_rows: string[] }[] = [];
      for (const t of activityTemplates) {
        if (t.type !== templType) continue;
        if (getCourseTemplateGroup(t.suggested_rows || []) !== parentGroup) continue;
        if (getCourseTemplateSubgroup(t.suggested_rows || []) !== oldSg) continue;
        const level = getTemplateRequirementLevel(t.suggested_rows || []);
        let nextRows = stripRequirementLevelFromRows(t.suggested_rows || []);
        nextRows = withCourseTemplateGroup(nextRows, parentGroup);
        nextRows = withCourseTemplateSubgroup(nextRows, newSg);
        nextRows = withTemplateRequirementLevel(nextRows, level);
        toPersist.push({ id: t.id, suggested_rows: nextRows });
      }

      groupEditorCtx.setSubgroupsByGroup((prev) => {
        const arr = [...(prev[parentGroup] || [])];
        const ix = arr.indexOf(oldSg);
        if (ix < 0) return prev;
        arr[ix] = newSg;
        return { ...prev, [parentGroup]: arr };
      });

      const patchSubgroupInMap = (
        setter: Dispatch<SetStateAction<Record<string, { group: string; subgroup?: string }>>>
      ) => {
        setter((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            const v = next[k];
            if (v?.group === parentGroup && v.subgroup === oldSg) {
              next[k] = { group: parentGroup, subgroup: newSg };
            }
          }
          return next;
        });
      };
      if (groupEditorScope === 'kurs') patchSubgroupInMap(setCourseTemplateGroupingByTitle);
      else if (groupEditorScope === 'moment') patchSubgroupInMap(setMomentTemplateGroupingByTitle);
      else if (groupEditorScope === 'placering') patchSubgroupInMap(setPlacementTemplateGroupingByTitle);

      setActivityTemplates((prev) =>
        prev.map((t) => {
          const u = toPersist.find((x) => x.id === t.id);
          return u ? { ...t, suggested_rows: u.suggested_rows } : t;
        })
      );

      if (templCourseGroup === parentGroup && templCourseSubgroup === oldSg) {
        setTemplCourseSubgroup(newSg);
      }

      for (const row of toPersist) {
        const { error } = await updateClinicActivityTemplateById(row.id, {
          suggested_rows: row.suggested_rows,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          showFeedback('err', `Kunde inte spara omdöpt undergrupp: ${error.message}`);
          await loadTemplates();
          return;
        }
      }
    },
    [
      groupEditorCtx,
      groupEditorScope,
      activityTemplates,
      showFeedback,
      loadTemplates,
      templCourseGroup,
      templCourseSubgroup,
    ]
  );

  const formatDateRange = (start?: string | null, end?: string | null) => {
    const s = String(start || '').slice(0, 10);
    const e = String(end || '').slice(0, 10);
    if (s && e && s !== e) return `${s} – ${e}`;
    return s || e || 'okänt datum';
  };

  const collectAffectedActivities = async (
    clinicId: string,
    type: ActTemplTab,
    title: string
  ): Promise<AffectedActivitiesByUser> => {
    const out: AffectedActivitiesByUser = {};
    const t = String(title || '').trim();
    if (!clinicId || !t) return out;

    const { data: clinicMembers } = await listClinicMembershipsByClinicId(clinicId);
    const stIds = (clinicMembers || [])
      .filter((m: any) => String(m.role || '') === 'st_lakare')
      .map((m: any) => String(m.user_id || ''))
      .filter(Boolean);
    if (stIds.length === 0) return out;

    if (type === 'placering') {
      const { data: rows } = await listPlacementsForTemplateScanByUserIds(stIds);
      for (const r of rows || []) {
        const clinicTitle = String((r as any).clinic || '').trim();
        const titleField = String((r as any).title || '').trim();
        if (clinicTitle !== t && titleField !== t) continue;
        const uid = String((r as any).user_id || '');
        if (!uid) continue;
        if (!out[uid]) out[uid] = { placementIds: [], courseIds: [], dates: [] };
        out[uid].placementIds.push(String((r as any).id || ''));
        out[uid].dates.push(formatDateRange((r as any).start_date, (r as any).end_date));
      }
      return out;
    }

    const { data: courseRows } = await listCoursesForTemplateScanByUserIds(stIds);
    for (const r of courseRows || []) {
      const rowTitle = String((r as any).title || '').trim();
      const kind = String((r as any).kind || '');
      const isMoment = kind === 'Utbildningsmoment';
      if (type === 'annan' && !isMoment) continue;
      if (type === 'kurs' && isMoment) continue;
      if (rowTitle !== t) continue;
      const uid = String((r as any).user_id || '');
      if (!uid) continue;
      if (!out[uid]) out[uid] = { placementIds: [], courseIds: [], dates: [] };
      out[uid].courseIds.push(String((r as any).id || ''));
      out[uid].dates.push(
        formatDateRange(
          (r as any).start_date || (r as any).certificate_date,
          (r as any).end_date || (r as any).certificate_date
        )
      );
    }
    return out;
  };

  const insertTemplateChangeNotifications = async (
    clinicId: string,
    type: ActTemplTab,
    changeType: 'deleted' | 'renamed',
    oldTitle: string,
    newTitle: string | null,
    affected: AffectedActivitiesByUser
  ) => {
    const rows = Object.entries(affected)
      .filter(([, v]) => v.placementIds.length > 0 || v.courseIds.length > 0)
      .map(([userId, v]) => ({
        user_id: userId,
        clinic_id: clinicId,
        change_type: changeType,
        activity_type: type,
        old_title: oldTitle,
        new_title: newTitle,
        details: {
          placement_ids: v.placementIds,
          course_ids: v.courseIds,
          dates: Array.from(new Set(v.dates.filter(Boolean))),
        },
      }));
    if (rows.length === 0) return;
    await insertActivityTemplateChangeNotifications(rows as Record<string, unknown>[]);
  };

  const propagateTemplateDeletion = async (clinicId: string, type: ActTemplTab, oldTitle: string) => {
    const affected = await collectAffectedActivities(clinicId, type, oldTitle);
    const allPlacementIds = Array.from(
      new Set(Object.values(affected).flatMap((x) => x.placementIds).filter(Boolean))
    );
    const allCourseIds = Array.from(
      new Set(Object.values(affected).flatMap((x) => x.courseIds).filter(Boolean))
    );
    if (allPlacementIds.length > 0) {
      await clearPlacementLabelsByIds(allPlacementIds);
    }
    if (allCourseIds.length > 0) {
      await resetCoursesTitleByIds(allCourseIds);
    }
    await insertTemplateChangeNotifications(clinicId, type, 'deleted', oldTitle, null, affected);
    return affected;
  };

  const propagateTemplateRename = async (
    clinicId: string,
    type: ActTemplTab,
    oldTitle: string,
    newTitle: string
  ) => {
    const affected = await collectAffectedActivities(clinicId, type, oldTitle);
    const allPlacementIds = Array.from(
      new Set(Object.values(affected).flatMap((x) => x.placementIds).filter(Boolean))
    );
    const allCourseIds = Array.from(
      new Set(Object.values(affected).flatMap((x) => x.courseIds).filter(Boolean))
    );
    if (allPlacementIds.length > 0) {
      await renamePlacementsClinicTitleByIds(allPlacementIds, newTitle);
    }
    if (allCourseIds.length > 0) {
      await renameCoursesTitleByIds(allCourseIds, newTitle);
    }
    await insertTemplateChangeNotifications(clinicId, type, 'renamed', oldTitle, newTitle, affected);
  };

  const requestDeleteTemplate = async (template: ActivityTemplate) => {
    try {
      const clinicId = await getClinicIdForCurrentUserRole('studierektor');
      if (!clinicId) return;

      const affected = await collectAffectedActivities(clinicId, template.type, template.title);
      const impactedUserIds = Object.keys(affected).filter((uid) => {
        const v = affected[uid];
        return (v.placementIds.length + v.courseIds.length) > 0;
      });
      const impactedNames = impactedUserIds
        .map((uid) => members.find((m: any) => String(m.user_id) === uid)?.profile?.name || uid)
        .filter(Boolean);
      const impactedText = impactedNames.length
        ? `\n\nFöljande ST-läkare har lagt in utbildningsaktivitet i sin planering:\n${impactedNames.join('\n')}\n\nVill du ta bort den?`
        : '';

      openDeleteConfirm({
        title: 'Ta bort',
        message: `Är du säker på att du vill ta bort ${template.title}?${impactedText}`,
        confirmLabel: 'Ta bort',
        onConfirm: async () => {
          await deleteClinicActivityTemplateById(template.id);
          if (template.type === 'kurs') {
            const key = courseTemplateTitleKey(template.title);
            setCourseTemplateGroupingByTitle((prev) => {
              if (!prev[key]) return prev;
              const { [key]: _, ...rest } = prev;
              return rest;
            });
          }
          if (template.type === 'annan') {
            const key = courseTemplateTitleKey(template.title);
            setMomentTemplateGroupingByTitle((prev) => {
              if (!prev[key]) return prev;
              const { [key]: _, ...rest } = prev;
              return rest;
            });
          }
          if (template.type === 'placering') {
            const key = courseTemplateTitleKey(template.title);
            setPlacementTemplateGroupingByTitle((prev) => {
              if (!prev[key]) return prev;
              const { [key]: _, ...rest } = prev;
              return rest;
            });
          }
          await propagateTemplateDeletion(clinicId, template.type, template.title);
          await loadTemplates();
          setDeleteConfirmConfig(null);
        },
      });
    } catch {
      openDeleteConfirm({
        title: 'Ta bort',
        message: `Är du säker på att du vill ta bort ${template.title}?`,
        confirmLabel: 'Ta bort',
        onConfirm: async () => {
          await deleteClinicActivityTemplateById(template.id);
          if (template.type === 'kurs') {
            const key = courseTemplateTitleKey(template.title);
            setCourseTemplateGroupingByTitle((prev) => {
              if (!prev[key]) return prev;
              const { [key]: _, ...rest } = prev;
              return rest;
            });
          }
          if (template.type === 'annan') {
            const key = courseTemplateTitleKey(template.title);
            setMomentTemplateGroupingByTitle((prev) => {
              if (!prev[key]) return prev;
              const { [key]: _, ...rest } = prev;
              return rest;
            });
          }
          if (template.type === 'placering') {
            const key = courseTemplateTitleKey(template.title);
            setPlacementTemplateGroupingByTitle((prev) => {
              if (!prev[key]) return prev;
              const { [key]: _, ...rest } = prev;
              return rest;
            });
          }
          await loadTemplates();
          setDeleteConfirmConfig(null);
        },
      });
    }
  };

  const toggleTemplateActive = async (t: ActivityTemplate) => {
    await updateClinicActivityTemplateById(t.id, { is_active: !t.is_active });
    loadTemplates();
  };

  // Ladda aktiva (oslästa/ej bekräftade) meddelanden och förslag
  const loadActiveItems = useCallback(async () => {
    setActiveItemsLoading(true);
    try {
      const userId = await getAuthenticatedUserId();
      if (!userId) return;
      const [msgRes, sugRes] = await Promise.all([
        listUnreadSentMessages(userId),
        listPendingSentSuggestions(userId),
      ]);
      const allMembers = [...(members || [])];
      const nameById = Object.fromEntries(allMembers.map(m => [m.user_id, m.profile?.name || '']));
      const items: ActiveItem[] = [];
      for (const m of msgRes.data || []) {
        items.push({
          id: m.id, kind: 'message',
          recipientId: m.recipient_id,
          recipientName: nameById[m.recipient_id] || m.recipient_id,
          date: m.created_at, status: 'unread',
          summary: String(m.message_text || '').slice(0, 60),
        });
      }
      for (const s of sugRes.data || []) {
        const d = s.activity_data || {};
        const preview = d.title || d.focus || d.summary || s.activity_type;
        items.push({
          id: s.id, kind: 'suggestion', activityType: s.activity_type,
          recipientId: s.recipient_id,
          recipientName: nameById[s.recipient_id] || s.recipient_id,
          date: s.created_at, status: 'pending',
          summary: String(preview).slice(0, 60),
        });
      }
      items.sort((a, b) => b.date.localeCompare(a.date));
      setActiveItems(items);
    } finally {
      setActiveItemsLoading(false);
    }
  }, [members]);

  useEffect(() => { loadActiveItems(); }, [loadActiveItems]);
  useEffect(() => { loadAssignments(); }, [loadAssignments]);
  useEffect(() => {
    if (dashTab === 'klinik') void loadClinicForm();
  }, [dashTab, loadClinicForm]);
  useEffect(() => {
    if (!hhDetailOpen?.userId) {
      setHhDetailProfile(null);
      return;
    }
    let cancelled = false;
    setHhDetailLoading(true);
    (async () => {
      try {
        const { data, error } = await fetchProfileById(hhDetailOpen.userId);
        if (error) throw error;
        if (!cancelled) setHhDetailProfile(data || null);
      } catch (err) {
        if (!cancelled) setHhDetailProfile(null);
      } finally {
        if (!cancelled) setHhDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hhDetailOpen]);

  // Ladda arkiverade (lästa/hanterade) meddelanden och förslag
  const loadArchiveItems = useCallback(async () => {
    setArchiveLoading(true);
    try {
      const userId = await getAuthenticatedUserId();
      if (!userId) return;
      const items: ActiveItem[] = [];
      
      // Lästa meddelanden
      const { data: msgs } = await listReadSentMessages(userId, 100);
      if (msgs) {
        for (const m of msgs) {
          const mem = members.find(x => x.user_id === m.recipient_id);
          if (mem) {
            items.push({
              id: m.id, kind: 'message', recipientId: m.recipient_id, recipientName: mem.profile.name,
              summary: m.message_text?.slice(0, 60) || '', date: m.created_at, status: 'read',
            });
          }
        }
      }
      
      // Hanterade förslag
      const { data: suggs } = await listHandledSentSuggestions(userId, 100);
      if (suggs) {
        for (const s of suggs) {
          const mem = members.find(x => x.user_id === s.recipient_id);
          if (mem) {
            items.push({
              id: s.id, kind: 'suggestion', activityType: s.activity_type, recipientId: s.recipient_id,
              recipientName: mem.profile.name, summary: s.status === 'accepted' ? 'Accepterat' : 'Avvisat',
              date: s.created_at, status: s.status,
            });
          }
        }
      }
      
      items.sort((a, b) => b.date.localeCompare(a.date));
      setArchiveItems(items);
    } finally {
      setArchiveLoading(false);
    }
  }, [members]);

  const assignSupervisorToSt = async () => {
    if (!assignDialog?.stUserId || !assignSupervisorId) return;
    setAssignSaving(true);
    try {
      const userId = await getAuthenticatedUserId();
      if (!userId) throw new Error('Not authenticated');
      const clinicId = await getClinicIdForCurrentUserRole('studierektor');
      if (!clinicId) throw new Error('Kunde inte hitta klinik');

      const { error: delErr } = await deleteSupervisorAssignmentsForStudent(
        clinicId,
        assignDialog.stUserId
      );
      if (delErr) throw delErr;

      const { error: insErr } = await createSupervisorAssignment({
        clinic_id: clinicId,
        supervisor_id: assignSupervisorId,
        st_lakare_id: assignDialog.stUserId,
        assigned_by: userId,
      });
      if (insErr) throw insErr;

      await loadAssignments();
      const supervisorName = members.find((m) => m.user_id === assignSupervisorId)?.profile?.name || 'huvudhandledare';
      showFeedback('ok', `Huvudhandledare tilldelad: ${supervisorName}`);
      setAssignDialog(null);
      setAssignSupervisorId('');
    } catch (err: any) {
      showFeedback('err', `Kunde inte tilldela huvudhandledare: ${err?.message || 'okänt fel'}`);
    } finally {
      setAssignSaving(false);
    }
  };

  // Initiera kryssade ST-läkare när grupp-popupen öppnas
  useEffect(() => {
    if (groupOpen) {
      const stIds = (members || []).filter(m => m.role === 'st_lakare').map(m => m.user_id);
      setGroupCheckedIds(stIds);
      setGroupMessageAlsoEmail(false);
    }
  }, [groupOpen, members]);

  useEffect(() => {
    if (!groupSuggestStart || !groupSuggestEnd) return;
    if (groupSuggestEnd < groupSuggestStart) {
      setGroupSuggestEnd(groupSuggestStart);
    }
  }, [groupSuggestStart, groupSuggestEnd]);

  const handleGroupSend = async () => {
    if (groupSending) return;
    const targets = (members || []).filter(m => m.role === 'st_lakare' && groupCheckedIds.includes(m.user_id));
    if (targets.length === 0) { showFeedback('err', 'Välj minst en ST-läkare.'); return; }
    const userId = await getAuthenticatedUserId();
    if (!userId) { showFeedback('err', 'Inte inloggad.'); return; }
    const clinicId = await getClinicIdForCurrentUserRole('studierektor');
    if (!clinicId) { showFeedback('err', 'Hittade inte kliniktillhörighet.'); return; }
    setGroupSending(true);
    try {
      if (groupMode === 'message') {
        if (!groupMessage.trim()) { showFeedback('err', 'Skriv ett meddelande.'); return; }
        const inserts = targets.map(t => ({
          sender_id: userId, recipient_id: t.user_id, clinic_id: clinicId,
          message_text: groupMessage.trim(), channel: groupMessageAlsoEmail ? 'email' : 'st_ark', read: false,
        }));
        const { error } = await insertSrMessages(inserts);
        if (error) throw error;
        showFeedback('ok', `Meddelande skickat till ${targets.length} ST-läkare.`);
        loadActiveItems();
      } else {
        if (!groupSuggestType) { showFeedback('err', 'Välj typ av förslag.'); return; }
        const typeLabels: Record<string, string> = { kurs: 'Kurs', konferens: 'Konferens', annan: 'Annan aktivitet' };
        const activityData: Record<string, string> = { title: groupSuggestTitle.trim() || typeLabels[groupSuggestType] };
        if (groupSuggestStart) activityData.startDate = groupSuggestStart;
        if (groupSuggestEnd) {
          const end =
            groupSuggestStart && groupSuggestEnd < groupSuggestStart ? groupSuggestStart : groupSuggestEnd;
          activityData.endDate = end;
        }
        if (groupSuggestNote.trim()) activityData.note = groupSuggestNote.trim();
        const inserts = targets.map(t => ({
          sender_id: userId, recipient_id: t.user_id, clinic_id: clinicId,
          activity_type: groupSuggestType, activity_data: activityData,
        }));
        const { error } = await insertSrActivitySuggestions(inserts);
        if (error) throw error;
        showFeedback('ok', `Förslag skickat till ${targets.length} ST-läkare.`);
        loadActiveItems();
      }
      setGroupOpen(false);
      setGroupMessage(''); setGroupMessageAlsoEmail(false); setGroupSuggestTitle(''); setGroupSuggestStart('');
      setGroupSuggestEnd(''); setGroupSuggestNote(''); setGroupSuggestType('');
    } catch (err) {
      showFeedback('err', 'Fel: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGroupSending(false);
    }
  };

  const resetSuggestForm = useCallback(() => {
    setSuggestTitle('');
    setSuggestStart('');
    setSuggestEnd('');
    setSuggestNote('');
    setSuggestCourseSelected('');
    setSuggestCourseCustom('');
    setSuggestCourseStart('');
    setSuggestCourseEnd('');
    setSuggestCourseNote('');
    setSuggestMeetingDate('');
    setSuggestMeetingFocus('');
    setSuggestMeetingNote('');
    setSuggestAssessmentDate('');
    setSuggestAssessmentInstrument('');
    setSuggestAssessmentInstrumentOther('');
    setSuggestAssessmentLevel('');
    setSuggestAssessmentNote('');
    setActivePlacementLabel('');
    setSuggestSendAsEmail(false);
  }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteEmail.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      await sendInvitation(trimmed, 'st_lakare');
      setInviteEmail('');
      showFeedback('ok', `Inbjudan skickad till ${trimmed} som ST-läkare`);
    } catch (err) {
      showFeedback('err', 'Kunde inte skicka inbjudan: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSending(false);
    }
  };

  const handleSendInviteHh = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteHhEmail.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      await sendInvitation(trimmed, 'huvudhandledare');
      setInviteHhEmail('');
      showFeedback('ok', `Inbjudan skickad till ${trimmed} som ST-huvudhandledare`);
    } catch (err) {
      showFeedback('err', 'Kunde inte skicka inbjudan: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSending(false);
    }
  };

  const handleCancelInvite = async () => {
    if (!cancelInviteDialog) return;
    
    try {
      await cancelInvitation(cancelInviteDialog.id);
      setCancelInviteDialog(null);
    } catch (err) {
      alert('Kunde inte avbryta inbjudan');
      setCancelInviteDialog(null);
    }
  };

  const handleRemoveMember = async (userId: string, name: string) => {
    openDeleteConfirm({
      title: 'Ta bort',
      message: `Är du säker på att du vill ta bort ${name} från gruppen?`,
      confirmLabel: 'Ta bort',
      onConfirm: async () => {
        try {
          await removeMember(userId);
          showFeedback('ok', `${name} borttagen från gruppen`);
        } catch {
          showFeedback('err', 'Kunde inte ta bort medlem');
        }
        setDeleteConfirmConfig(null);
      },
    });
  };

  const handleSendMessage = async () => {
    if (!messageTarget || !messageText.trim()) return;
    setMessageSending(true);
    try {
      const senderId = await getAuthenticatedUserId();
      if (!senderId) throw new Error('Ej inloggad');
      const clinicId = await getClinicIdForCurrentUserRole('studierektor');
      if (!clinicId) throw new Error('Ingen klinik');
      const { error } = await insertSrMessages({
        sender_id: senderId,
        recipient_id: messageTarget.userId,
        clinic_id: clinicId,
        message_text: messageText.trim(),
        channel: messageChannel,
      });

      if (error) throw error;

      showFeedback('ok', `Meddelande skickat till ${messageTarget.name} via ${messageChannel === 'st_ark' ? 'ST-ARK' : 'E-post'}`);
      setMessageTarget(null);
      setMessageText('');
      setMessageChannel('st_ark');
      setMessageHistoryOpen(false);
      loadActiveItems();
    } catch (err) {
      showFeedback('err', 'Kunde inte skicka meddelande: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setMessageSending(false);
    }
  };

  const handleSendSuggestion = async () => {
    if (!suggestTarget) return;
    setSuggestSending(true);
    try {
      const senderId = await getAuthenticatedUserId();
      if (!senderId) throw new Error('Ej inloggad');
      const clinicId = await getClinicIdForCurrentUserRole('studierektor');
      if (!clinicId) throw new Error('Ingen klinik');

      let activityData: Record<string, string> = {};

      if (suggestType === 'placement') {
        if (suggestTitle.trim()) activityData.title = suggestTitle.trim();
        if (suggestStart) activityData.startDate = suggestStart;
        if (suggestEnd) {
          const end = suggestStart && suggestEnd < suggestStart ? suggestStart : suggestEnd;
          activityData.endDate = end;
        }
        if (suggestNote.trim()) activityData.note = suggestNote.trim();
      } else if (suggestType === 'course') {
        const effectiveTitle = suggestCourseSelected === 'Annan kurs' ? 'Annan kurs' : suggestCourseSelected;
        if (effectiveTitle) activityData.title = effectiveTitle;
        if (suggestCourseSelected === 'Annan kurs' && suggestCourseCustom.trim()) {
          activityData.courseTitle = suggestCourseCustom.trim();
        }
        if (suggestCourseStart) activityData.startDate = suggestCourseStart;
        if (suggestCourseEnd) {
          const end =
            suggestCourseStart && suggestCourseEnd < suggestCourseStart
              ? suggestCourseStart
              : suggestCourseEnd;
          activityData.endDate = end;
        }
        if (suggestCourseNote.trim()) activityData.note = suggestCourseNote.trim();
      } else if (suggestType === 'sr_meeting') {
        if (suggestMeetingDate) activityData.dateISO = suggestMeetingDate;
        if (suggestMeetingFocus.trim()) activityData.focus = suggestMeetingFocus.trim();
        if (suggestMeetingNote.trim()) activityData.note = suggestMeetingNote.trim();
      } else if (suggestType === 'progression_assessment') {
        if (suggestAssessmentDate) activityData.dateISO = suggestAssessmentDate;
        const instrument = suggestAssessmentInstrument === 'Annan' ? 'Annan' : suggestAssessmentInstrument;
        if (instrument) activityData.instrument = instrument;
        if (suggestAssessmentInstrument === 'Annan' && suggestAssessmentInstrumentOther.trim()) {
          activityData.instrumentOther = suggestAssessmentInstrumentOther.trim();
        }
        if (suggestAssessmentLevel.trim()) activityData.level = suggestAssessmentLevel.trim();
        if (suggestAssessmentNote.trim()) activityData.note = suggestAssessmentNote.trim();
      }
      if (suggestSendAsEmail) activityData.sendAsEmail = 'true';

      const { error } = await insertSrActivitySuggestions({
        sender_id: senderId,
        recipient_id: suggestTarget.userId,
        clinic_id: clinicId,
        activity_type: suggestType,
        activity_data: activityData,
      });

      if (error) throw error;

      const typeLabels: Record<SuggestType, string> = {
        placement: 'Klinisk tjänstgöring',
        course: 'Kurs',
        sr_meeting: 'Studierektorsmöte',
        progression_assessment: 'Progressionsbedömning',
      };
      showFeedback('ok', `Aktivitetsförslag (${typeLabels[suggestType]}) skickat till ${suggestTarget.name}`);
      setSuggestTarget(null);
      setSuggestType('placement');
      setSuggestionHistoryOpen(false);
      resetSuggestForm();
      loadActiveItems();
    } catch (err) {
      showFeedback('err', 'Kunde inte skicka förslag: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSuggestSending(false);
    }
  };

  const iupPlanningSelectedBaseLabels = useMemo(
    () =>
      IUP_PLANNING_BASE_SECTIONS
        .filter((sec) => iupPlanningSelectedBaseKeys.includes(sec.key))
        .map((sec) => sec.label),
    [iupPlanningSelectedBaseKeys]
  );

  const iupPlanningCustomSuggestions = useMemo(
    () =>
      iupPlanningSuggestedTitles.filter(
        (title) => !IUP_PLANNING_BASE_SECTIONS.some((sec) => sec.label === title)
      ),
    [iupPlanningSuggestedTitles]
  );

  const iupPlanningPreviewTitles = useMemo(
    () => [...iupPlanningSelectedBaseLabels, ...iupPlanningCustomSuggestions],
    [iupPlanningCustomSuggestions, iupPlanningSelectedBaseLabels]
  );

  const toggleIupPlanningBaseSection = useCallback((key: string, label: string, checked: boolean) => {
    if (checked) {
      setIupPlanningSelectedBaseKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      setIupPlanningSuggestedTitles((prev) => (prev.includes(label) ? prev : [...prev, label]));
      return;
    }
    setIupPlanningSelectedBaseKeys((prev) => prev.filter((k) => k !== key));
  }, []);

  const addIupPlanningSuggestion = useCallback(() => {
    const next = iupPlanningNewSuggestion.trim();
    if (!next) return;
    setIupPlanningSuggestedTitles((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setIupPlanningNewSuggestion('');
  }, [iupPlanningNewSuggestion]);

  const removeIupPlanningSuggestion = useCallback((title: string) => {
    setIupPlanningSuggestedTitles((prev) => prev.filter((t) => t !== title));
  }, []);

  const saveIupPlanningConfig = useCallback(async () => {
    if (!editorClinicId) {
      showFeedback('err', 'Kunde inte hitta klinik för IUP-konfiguration.');
      return;
    }
    setIupSavingPlanning(true);
    try {
      const payload = {
        clinic_id: editorClinicId,
        type: 'annan' as const,
        title: IUP_PLANNING_CONFIG_TITLE,
        description: 'Systemkonfiguration för IUP planering',
        suggested_milestones: [] as string[],
        suggested_rows: encodeIupPlanningConfig(
          [...iupPlanningSelectedBaseKeys],
          iupPlanningSuggestedTitles
        ),
        is_metis: false,
        is_active: false,
        track_completions: false,
      };
      const { error } = await saveClinicActivityTemplateConfig(editorClinicId, IUP_PLANNING_CONFIG_TITLE, payload);
      if (error) {
        showFeedback('err', `Kunde inte spara IUP-planering: ${error.message}`);
        return;
      }
      showFeedback('ok', 'IUP-planering sparad.');
    } finally {
      setIupSavingPlanning(false);
    }
  }, [editorClinicId, iupPlanningSelectedBaseKeys, iupPlanningSuggestedTitles]);

  const saveIupGoalSuggestionsConfig = useCallback(async () => {
    if (!editorClinicId) {
      showFeedback('err', 'Kunde inte hitta klinik för IUP-konfiguration.');
      return;
    }
    setIupSavingGoals(true);
    try {
      const payload = {
        clinic_id: editorClinicId,
        type: 'annan' as const,
        title: IUP_GOAL_SUGGESTIONS_CONFIG_TITLE,
        description: 'Systemkonfiguration för IUP delmål-förslag',
        suggested_milestones: [] as string[],
        suggested_rows: encodeIupGoalSuggestionsConfig({
          byMilestone: iupGoalSuggestionsByMilestone,
          optionPool: iupGoalOptionPool,
        }),
        is_metis: false,
        is_active: false,
        track_completions: false,
      };
      const { error } = await saveClinicActivityTemplateConfig(editorClinicId, IUP_GOAL_SUGGESTIONS_CONFIG_TITLE, payload);
      if (error) {
        showFeedback('err', `Kunde inte spara IUP delmål: ${error.message}`);
        return;
      }
      showFeedback('ok', 'IUP delmålsförslag sparade.');
    } finally {
      setIupSavingGoals(false);
    }
  }, [
    editorClinicId,
    iupGoalSuggestionsByMilestone,
    iupGoalOptionPool,
  ]);

  const saveIupHandledningConfig = useCallback(
    async (expectations: typeof DEFAULT_IUP_HANDLEDNING_EXPECTATIONS) => {
      if (!editorClinicId) {
        showFeedback('err', 'Kunde inte hitta klinik för IUP-konfiguration.');
        return;
      }
      setIupSavingHandledning(true);
      try {
        const payload = {
          clinic_id: editorClinicId,
          type: 'annan' as const,
          title: IUP_HANDLEDNING_CONFIG_TITLE,
          description: 'Systemkonfiguration för IUP handledning (förväntade tillfällen per år)',
          suggested_milestones: [] as string[],
          suggested_rows: encodeIupHandledningConfig(expectations),
          is_metis: false,
          is_active: false,
          track_completions: false,
        };
        const { error } = await saveClinicActivityTemplateConfig(editorClinicId, IUP_HANDLEDNING_CONFIG_TITLE, payload);
        if (error) {
          showFeedback('err', `Kunde inte spara IUP handledning: ${error.message}`);
          return;
        }
        showFeedback('ok', 'IUP handledning sparad.');
      } finally {
        setIupSavingHandledning(false);
      }
    },
    [editorClinicId]
  );

  const saveIupProgressionInstrumentsConfig = useCallback(
    async (cfg: IupProgressionInstrumentsClinicConfig) => {
      if (!editorClinicId) {
        showFeedback('err', 'Kunde inte hitta klinik för IUP-konfiguration.');
        return;
      }
      setIupSavingProgressionInstruments(true);
      try {
        const payload = {
          clinic_id: editorClinicId,
          type: 'annan' as const,
          title: IUP_PROGRESSION_INSTRUMENTS_CONFIG_TITLE,
          description: 'Systemkonfiguration för IUP progressionsbedömningar (bedömningsinstrument)',
          suggested_milestones: [] as string[],
          suggested_rows: encodeIupProgressionInstrumentsConfig(cfg),
          is_metis: false,
          is_active: false,
          track_completions: false,
        };
        const { error } = await saveClinicActivityTemplateConfig(
          editorClinicId,
          IUP_PROGRESSION_INSTRUMENTS_CONFIG_TITLE,
          payload
        );
        if (error) {
          showFeedback('err', `Kunde inte spara IUP-instrument: ${error.message}`);
          return;
        }
        showFeedback('ok', 'IUP bedömningsinstrument sparade.');
      } finally {
        setIupSavingProgressionInstruments(false);
      }
    },
    [editorClinicId]
  );

  const iupGoalsForSelectedVersion = useMemo(() => {
    const src = iupGoalVersion === '2015' ? srGoals2015 : srGoals2021;
    const rows = buildIupDelmalMilestonesForDashboard(src, iupGoalVersion);
    return rows
      .filter((m) => !!(m.id || m.code))
      .sort((a, b) =>
        displayMilestoneCode(String(a.code || a.id || ''), iupGoalVersion).localeCompare(
          displayMilestoneCode(String(b.code || b.id || ''), iupGoalVersion),
          'sv',
          { sensitivity: 'base', numeric: true }
        )
      );
  }, [iupGoalVersion, srGoals2015, srGoals2021]);

  const filteredIupGoalsForSelectedVersion = useMemo(() => {
    const q = iupGoalSearch.trim().toLowerCase();
    return iupGoalsForSelectedVersion.filter((m) => {
      const code = displayMilestoneCode(String(m.code || m.id || ''), iupGoalVersion);
      const title = String(m.title || '');
      if (!q) return true;
      return code.toLowerCase().includes(q) || title.toLowerCase().includes(q);
    });
  }, [iupGoalSearch, iupGoalVersion, iupGoalsForSelectedVersion]);

  const groupedFilteredIupGoals = useMemo(() => {
    const initialOrder: IupGoalGroupId[] =
      iupGoalVersion === '2021' ? ['STa', 'STb', 'STc', 'other'] : ['A', 'B', 'C', 'other'];
    const groups = new Map<IupGoalGroupId, typeof filteredIupGoalsForSelectedVersion>();
    for (const k of initialOrder) groups.set(k, []);
    for (const m of filteredIupGoalsForSelectedVersion) {
      const code = displayMilestoneCode(String(m.code || m.id || ''), iupGoalVersion);
      const groupId = getIupGoalGroupIdFromCode(code, iupGoalVersion);
      const arr = groups.get(groupId) || [];
      arr.push(m);
      groups.set(groupId, arr);
    }
    return initialOrder
      .map((id) => ({ id, label: iupGoalGroupLabel(id), items: groups.get(id) || [] }))
      .filter((g) => g.items.length > 0);
  }, [filteredIupGoalsForSelectedVersion, iupGoalVersion]);

  const iupGoalAllCatalogIdsForVersion = useMemo(() => {
    return iupGoalsForSelectedVersion
      .map((m) => iupDashboardCanonMilestoneId(m, iupGoalVersion))
      .filter(Boolean);
  }, [iupGoalsForSelectedVersion, iupGoalVersion]);

  const iupGoalOverviewRows = useMemo(() => {
    const ver = iupGoalVersion;
    const q = iupGoalSearch.trim().toLowerCase();
    const rows: { id: string; code: string; title: string }[] = [];
    for (const m of iupGoalsForSelectedVersion) {
      const id = iupDashboardCanonMilestoneId(m, ver);
      const code = displayMilestoneCode(String(m.code || m.id || ''), ver);
      const title = String(m.title || '');
      if (q && !code.toLowerCase().includes(q) && !title.toLowerCase().includes(q)) continue;
      rows.push({ id, code, title: title || 'Delmål' });
    }
    return rows.sort((a, b) =>
      a.code.localeCompare(b.code, 'sv', { sensitivity: 'base', numeric: true })
    );
  }, [
    iupGoalSearch,
    iupGoalVersion,
    iupGoalsForSelectedVersion,
  ]);

  const iupGoalDetailMilestone = useMemo(() => {
    if (!iupGoalDetail) return null;
    return (
      iupGoalsForSelectedVersion.find(
        (m) => iupDashboardCanonMilestoneId(m, iupGoalVersion) === iupGoalDetail
      ) || null
    );
  }, [iupGoalDetail, iupGoalVersion, iupGoalsForSelectedVersion]);

  useEffect(() => {
    if (iupGoalOverviewRows.length === 0) {
      if (iupGoalDetail) setIupGoalDetail(null);
      return;
    }
    if (iupGoalDetail && !iupGoalAllCatalogIdsForVersion.includes(iupGoalDetail)) {
      setIupGoalDetail(null);
    }
  }, [iupGoalAllCatalogIdsForVersion, iupGoalDetail, iupGoalOverviewRows]);

  const iupGoalSelectedSuggestions = useMemo(() => {
    if (!iupGoalDetail) return [] as string[];
    return iupGoalSuggestionsByMilestone[iupGoalDetail] || [];
  }, [iupGoalDetail, iupGoalSuggestionsByMilestone]);

  const iupGoalSelectedPredefinedSuggestions = useMemo(
    () => iupGoalSelectedSuggestions.filter((opt) => iupGoalOptionPool.includes(opt)),
    [iupGoalOptionPool, iupGoalSelectedSuggestions]
  );

  const iupGoalSelectedCustomSuggestions = useMemo(
    () => iupGoalSelectedSuggestions.filter((opt) => !iupGoalOptionPool.includes(opt)),
    [iupGoalOptionPool, iupGoalSelectedSuggestions]
  );

  const toggleIupGoalPredefinedSuggestion = useCallback(
    (option: string, checked: boolean) => {
      if (!iupGoalDetail) return;
      setIupGoalSuggestionsByMilestone((prev) => {
        const current = prev[iupGoalDetail] || [];
        const next = checked
          ? (current.includes(option) ? current : [...current, option])
          : current.filter((x) => x !== option);
        return { ...prev, [iupGoalDetail]: next };
      });
    },
    [iupGoalDetail]
  );

  const addIupGoalCustomSuggestion = useCallback(() => {
    if (!iupGoalDetail) return;
    const next = iupGoalNewOption.trim();
    if (!next) return;
    setIupGoalSuggestionsByMilestone((prev) => {
      const current = prev[iupGoalDetail] || [];
      if (current.includes(next)) return prev;
      return { ...prev, [iupGoalDetail]: [...current, next] };
    });
    setIupGoalNewOption('');
  }, [iupGoalDetail, iupGoalNewOption]);

  const removeIupGoalCustomSuggestion = useCallback(
    (option: string) => {
      if (!iupGoalDetail) return;
      setIupGoalSuggestionsByMilestone((prev) => {
        const current = prev[iupGoalDetail] || [];
        return { ...prev, [iupGoalDetail]: current.filter((x) => x !== option) };
      });
    },
    [iupGoalDetail]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="mt-4 text-slate-600">Laddar...</p>
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="flex items-center justify-center py-16 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Ingen klinik hittades</h2>
          <p className="text-slate-600 mb-4">
            Du har inte tillgång till studierektorfunktionen. Kontakta en administratör för att få tillgång.
          </p>
        </div>
      </div>
    );
  }

  const stLakare = members
    .filter((m) => m.role === 'st_lakare')
    .slice()
    .sort((a, b) => {
      const ka = sortKeyFirstNameFromDisplayName(a.profile?.name || '');
      const kb = sortKeyFirstNameFromDisplayName(b.profile?.name || '');
      const byFirst = ka.localeCompare(kb, 'sv', { sensitivity: 'base' });
      if (byFirst !== 0) return byFirst;
      return String(a.profile?.name || '').localeCompare(String(b.profile?.name || ''), 'sv', {
        sensitivity: 'base',
      });
    });
  const huvudhandledare = members.filter(m => m.role === 'huvudhandledare');
  const assignmentBySt = new Map<string, string>(
    assignments.map((a) => [String(a.st_lakare_id), String(a.supervisor_id)])
  );

  const supervisedStNamesBySupervisorId = (() => {
    const map = new Map<string, Map<string, string>>();
    for (const a of assignments) {
      const supId = String(a.supervisor_id || "");
      const stId = String(a.st_lakare_id || "");
      if (!supId || !stId) continue;
      const stMember = stLakare.find((m) => m.user_id === stId);
      const name = String(stMember?.profile?.name || "").trim() || "Namn saknas";
      if (!map.has(supId)) map.set(supId, new Map());
      map.get(supId)!.set(stId, name);
    }
    const out = new Map<string, string[]>();
    for (const [supId, stMap] of map) {
      const names = [...stMap.values()].sort((x, y) =>
        x.localeCompare(y, "sv", { sensitivity: "base" })
      );
      out.set(supId, names);
    }
    return out;
  })();

  const fallbackSupervisorNameById = (() => {
    const out = new Map<string, string>();
    for (const hh of huvudhandledare) {
      const id = String(hh.user_id || '');
      const directName = String(hh?.profile?.name || '').trim();
      if (directName) {
        out.set(id, directName);
        continue;
      }

      // Fallback 1: namn från tilldelade ST-läkares "supervisor"-fält i profil.
      const linkedStIds = assignments
        .filter((a) => String(a.supervisor_id || '') === id)
        .map((a) => String(a.st_lakare_id || ''))
        .filter(Boolean);
      const supervisorNames = Array.from(
        new Set(
          stLakare
            .filter((m) => linkedStIds.includes(String(m.user_id || '')))
            .map((m) => String((m as any)?.profile?.supervisor || '').trim())
            .filter(Boolean)
        )
      );
      if (supervisorNames.length > 0) {
        out.set(id, supervisorNames[0]);
        continue;
      }

      // Fallback 2: e-post om namn saknas.
      const email = String(hh?.profile?.email || '').trim();
      if (email) {
        out.set(id, email);
        continue;
      }

      // Fallback 3: kort user-id.
      out.set(id, id ? `Användare ${id.slice(0, 8)}` : 'Namn saknas');
    }
    return out;
  })();

  return (
    <div className="-mx-6">
      {/* Fliknavigation */}
      <div className="border-b border-black">
        <nav className="flex gap-1 bg-slate-50 px-6 pt-2">
          {([
            {id:'st-lakare' as DashTab,label:'ST-läkare'},
            {id:'huvudhandledare' as DashTab,label:'Huvudhandledare'},
            {id:'aktiviteter' as DashTab,label:'Utbildningsaktiviteter'},
            {id:'iup' as DashTab,label:'IUP'},
            {id:'klinik' as DashTab,label:'Klinik'},
          ]).map(t=>(
            <button key={t.id} type="button" onClick={()=>setDashTab(t.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:outline-none ${
                dashTab===t.id?'bg-white text-slate-900 border-x border-t border-slate-200 -mb-px':'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}>{t.label}</button>
          ))}
        </nav>
      </div>

      {dashTab === 'st-lakare' && (
      <div className="space-y-6 mt-6 px-6">
      {/* Inbjudningsformulär */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Bjud in ST-läkare</h2>
          <form onSubmit={handleSendInvite} className="flex gap-3 flex-wrap">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="E-postadress"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            />
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:translate-y-px disabled:opacity-50"
            >
              {sending ? 'Skickar...' : 'Skicka inbjudan'}
            </button>
          </form>

          {/* Feedback-meddelande */}
          {feedback && (
            <div className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${
              feedback.type === 'ok' ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {feedback.msg}
            </div>
          )}

          {/* Pågående inbjudningar */}
          {invitations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Pågående inbjudningar</h3>
              <div className="space-y-2">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{inv.email}</p>
                      <p className="text-xs text-slate-500">
                        Skickad {new Date(inv.created_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                    <button
                      onClick={() => setCancelInviteDialog({id: inv.id, email: inv.email})}
                      className="text-sm text-red-600 hover:text-red-700 font-semibold"
                    >
                      Avbryt
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ST-läkare lista */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">ST-läkare ({stLakare.length})</h2>
            {stLakare.length > 0 && (
              <button
                onClick={() => setGroupOpen(true)}
                className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-colors"
              >
                Skicka till gruppen
              </button>
            )}
          </div>

          {stLakare.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 mb-4">Inga ST-läkare i gruppen ännu</p>
              <p className="text-sm text-slate-400">Bjud in ST-läkare via formuläret ovan</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-left">
                  <tr>
                    <th className={`${DASH_TBL_TH} text-left`}>ST-läkare</th>
                    <th className={`${DASH_TBL_TH} text-left`}>Huvudhandledare</th>
                    <th className={`${DASH_TBL_TH} text-left`}>Kommunikation</th>
                    <th className={`${DASH_TBL_TH} w-[1%] whitespace-nowrap text-right`}>
                      <span className="sr-only">Åtgärder</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stLakare.map((member) => {
                    const profile = member.profile;
                    const assignedSupervisorId = assignmentBySt.get(String(member.user_id)) || '';
                    const assignedHh = assignedSupervisorId
                      ? huvudhandledare.find((h) => String(h.user_id) === String(assignedSupervisorId))
                      : undefined;
                    const assignedSupervisorDisplay = assignedSupervisorId
                      ? fallbackSupervisorNameById.get(String(assignedSupervisorId)) ||
                        String(assignedHh?.profile?.name || '').trim() ||
                        'Huvudhandledare'
                      : '';
                    const hasAssignment = Boolean(assignedSupervisorId);
                    const stDashBtn =
                      'inline-flex max-w-full items-center justify-center rounded-lg border px-2.5 py-1 text-left text-xs font-semibold transition-colors';
                    const stCommBtn =
                      'inline-flex shrink-0 items-center rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap';
                    return (
                      <tr
                        key={member.user_id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Kontaktuppgifter ${profile.name || 'ST-läkare'}`}
                        className="cursor-pointer bg-white transition-colors hover:bg-slate-100 has-[button:hover]:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          setHhDetailOpen({
                            userId: member.user_id,
                            name: profile.name || 'ST-läkare',
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return;
                          if ((e.target as HTMLElement).closest('button')) return;
                          e.preventDefault();
                          setHhDetailOpen({
                            userId: member.user_id,
                            name: profile.name || 'ST-läkare',
                          });
                        }}
                      >
                        <td className={DASH_TBL_TD_STRONG}>{profile.name || 'Namn saknas'}</td>
                        <td className={DASH_TBL_TD}>
                          <button
                            type="button"
                            className={`${stDashBtn} ${
                              hasAssignment
                                ? 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100'
                                : 'border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                            onClick={() => {
                              setAssignDialog({
                                stUserId: member.user_id,
                                stName: profile.name || 'ST-läkare',
                              });
                              setAssignSupervisorId(assignedSupervisorId);
                            }}
                          >
                            <span className="truncate">
                              {hasAssignment ? assignedSupervisorDisplay : 'Tilldela'}
                            </span>
                          </button>
                        </td>
                        <td className={DASH_TBL_TD}>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className={`${stCommBtn} border-sky-200 bg-white text-sky-800 hover:bg-sky-50`}
                              onClick={() => {
                                setMessageTarget({
                                  userId: member.user_id,
                                  name: profile.name || 'ST-läkare',
                                });
                              }}
                            >
                              Meddelande
                            </button>
                            <button
                              type="button"
                              className={`${stCommBtn} border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50`}
                              onClick={() => {
                                setSuggestTarget({
                                  userId: member.user_id,
                                  name: profile.name || 'ST-läkare',
                                });
                              }}
                            >
                              Föreslå aktivitet
                            </button>
                          </div>
                        </td>
                        <td className={`${DASH_TBL_TD} text-right whitespace-nowrap`}>
                          <button
                            type="button"
                            onClick={() => {
                              handleRemoveMember(
                                member.user_id,
                                profile.name || 'denna läkare'
                              );
                            }}
                            className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700"
                          >
                            Ta bort
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {assignDialog && (
          <div className="fixed inset-0 z-[420] bg-black/60 flex items-center justify-center p-4" onClick={() => setAssignDialog(null)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-900">Tilldela huvudhandledare</h3>
              <p className="mt-1 text-sm text-slate-600">
                Välj huvudhandledare för <span className="font-semibold">{assignDialog.stName}</span>.
              </p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Huvudhandledare</label>
                <select
                  value={assignSupervisorId}
                  onChange={(e) => setAssignSupervisorId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                >
                  <option value="">Välj…</option>
                  {huvudhandledare.map((h) => (
                    <option key={h.user_id} value={h.user_id}>
                      {fallbackSupervisorNameById.get(h.user_id) || h.profile?.name || 'Namn saknas'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignDialog(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={assignSupervisorToSt}
                  disabled={!assignSupervisorId || assignSaving}
                  className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {assignSaving ? 'Sparar…' : 'Spara'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Avbryt inbjudan-dialog */}
        {cancelInviteDialog && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4" onClick={() => setCancelInviteDialog(null)}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-3">Avbryt inbjudan</h3>
            <p className="text-slate-700 mb-6">
              Vill du avbryta inbjudan till <span className="font-semibold">{cancelInviteDialog.email}</span>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCancelInviteDialog(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Avbryt
              </button>
              <button
                onClick={handleCancelInvite}
                className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Ja, avbryt inbjudan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meddelande-popup */}
      {messageTarget && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4" onClick={() => setMessageTarget(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">Meddelande</h3>
              <button
                onClick={() => setMessageTarget(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Stäng
              </button>
            </div>
            <div className="border-b border-black" />
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700">Till: <span className="font-semibold">{messageTarget.name}</span></p>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
              <div className="flex items-end justify-between gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={messageChannel === 'email'}
                    onChange={(e) => setMessageChannel(e.target.checked ? 'email' : 'st_ark')}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                  />
                  <span>Skicka även som e-post</span>
                </label>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || messageSending}
                  className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {messageSending ? 'Skickar...' : 'Skicka'}
                </button>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setMessageHistoryOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
                >
                  <span>Historik</span>
                  <svg className={`h-4 w-4 text-slate-500 transition-transform ${messageHistoryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" /></svg>
                </button>
                {messageHistoryOpen && (
                  <div className="mt-3">
                    {sentMessagesLoading ? (
                      <p className="text-xs text-slate-500">Laddar...</p>
                    ) : sentMessages.length === 0 ? (
                      <p className="text-xs text-slate-400">Ingen historik ännu.</p>
                    ) : (
                      <div className="space-y-2">
                        {sentMessages.map((msg) => (
                          <div key={msg.id} className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedMessageId(expandedMessageId === msg.id ? null : msg.id)}
                              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 transition-colors"
                            >
                              <span className="text-xs text-slate-600 flex-1 truncate mr-2">
                                {msg.message_text.slice(0, 60)}{msg.message_text.length > 60 ? '…' : ''}
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${msg.read ? 'bg-slate-200 text-slate-500' : 'bg-sky-100 text-sky-700'}`}>
                                  {msg.read ? 'Läst' : 'Oläst'}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {new Date(msg.created_at).toLocaleDateString('sv-SE')}
                                </span>
                                <svg className={`h-4 w-4 text-slate-400 transition-transform ${expandedMessageId === msg.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" /></svg>
                              </span>
                            </button>
                            {expandedMessageId === msg.id && (
                              <div className="px-3 pb-3 pt-1 border-t border-slate-200 bg-white">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message_text}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {msg.channel === 'st_ark' ? 'ST-ARK' : 'E-post'} · {new Date(msg.created_at).toLocaleString('sv-SE')}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Meddelanden och förslag ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Skickade meddelanden &amp; förslag</h2>
          <button onClick={() => { loadArchiveItems(); setArchiveOpen(true); }} 
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Se lästa och hanterade
          </button>
        </div>
        {activeItemsLoading ? (
          <p className="text-sm text-slate-500">Laddar...</p>
        ) : activeItems.length === 0 ? (
          <p className="text-sm text-slate-400">Inga aktiva olästa meddelanden eller obekräftade förslag.</p>
        ) : (
          <div className="space-y-2">
            {activeItems.map((item) => {
              const typeLabel: Record<string, string> = {
                placement: 'Klinisk tjänstgöring', course: 'Kurs',
                sr_meeting: 'Studierektorsmöte', progression_assessment: 'Progressionsbedömning',
                kurs: 'Kurs', konferens: 'Konferens', annan: 'Annan aktivitet',
              };
              return (
                <div key={item.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${item.kind === 'message' ? 'bg-sky-500' : 'bg-emerald-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {item.kind === 'message' ? 'Meddelande' : `Förslag: ${typeLabel[item.activityType || ''] || item.activityType}`}
                      {' '}→ <span className="text-slate-600">{item.recipientName}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">{item.summary}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      item.status === 'unread' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                    }`}>{item.status === 'unread' ? 'Oläst' : 'Väntar'}</span>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(item.date).toLocaleDateString('sv-SE')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grupp-skicka-popup */}
      {groupOpen && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4" onClick={() => setGroupOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Skicka till gruppen</h3>

            {/* Meddelande / Förslag toggle */}
            <div className="flex gap-2 mb-4">
              {(['message', 'suggestion'] as const).map((m) => (
                <button key={m} type="button"
                  onClick={() => setGroupMode(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    groupMode === m
                      ? m === 'suggestion'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-sky-600 bg-sky-50 text-sky-700'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                  {m === 'message' ? 'Meddelande' : 'Förslag'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {groupMode === 'message' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Meddelande</label>
                    <textarea value={groupMessage} onChange={(e) => setGroupMessage(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={groupMessageAlsoEmail}
                      onChange={(e) => setGroupMessageAlsoEmail(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600"
                    />
                    <span>Skicka även som e-post</span>
                  </label>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Typ av förslag</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([['kurs','Kurs'],['konferens','Konferens'],['annan','Annan aktivitet']] as const).map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setGroupSuggestType(v)}
                          className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors text-center ${
                            groupSuggestType === v ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                          }`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  {groupSuggestType && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Titel / Namn</label>
                        <input type="text" value={groupSuggestTitle} onChange={(e) => setGroupSuggestTitle(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Start</label>
                          <CalendarDatePicker value={groupSuggestStart} onChange={(newStart) => {
                            setGroupSuggestStart(newStart);
                            if (newStart && groupSuggestEnd && newStart > groupSuggestEnd) {
                              setGroupSuggestEnd(newStart);
                            }
                          }} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Slut</label>
                          <CalendarDatePicker
                            value={groupSuggestEnd}
                            onChange={(v) =>
                              setGroupSuggestEnd(
                                v && groupSuggestStart && v < groupSuggestStart ? groupSuggestStart : v
                              )
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Anteckning (valfritt)</label>
                        <textarea value={groupSuggestNote} onChange={(e) => setGroupSuggestNote(e.target.value)}
                          rows={2}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ST-läkare checklista */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700">Mottagare (ST-läkare)</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setGroupCheckedIds(stLakare.map(m => m.user_id))}
                      className="text-xs text-sky-600 hover:underline">Alla</button>
                    <button type="button" onClick={() => setGroupCheckedIds([])}
                      className="text-xs text-slate-500 hover:underline">Ingen</button>
                  </div>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {stLakare.map((m) => (
                    <label key={m.user_id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox"
                        checked={groupCheckedIds.includes(m.user_id)}
                        onChange={(e) => setGroupCheckedIds(prev =>
                          e.target.checked ? [...prev, m.user_id] : prev.filter(id => id !== m.user_id)
                        )}
                        className="h-4 w-4 rounded border-slate-300 text-sky-600"
                      />
                      <span className="text-sm text-slate-700">{m.profile.name || m.user_id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setGroupOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Avbryt</button>
              <button onClick={handleGroupSend} disabled={groupSending}
                className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
                {groupSending ? 'Skickar...' : `Skicka till ${groupCheckedIds.length} ST-läkare`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Föreslå aktivitet-popup */}
      {suggestTarget && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4" onClick={() => { setSuggestTarget(null); resetSuggestForm(); }}>
          <div
            className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">Föreslå aktivitet</h3>
              <button
                onClick={() => { setSuggestTarget(null); resetSuggestForm(); }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Stäng
              </button>
            </div>
            <div className="border-b border-black" />
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700">Till: <span className="font-semibold">{suggestTarget.name}</span></p>
              <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'placement', label: 'Klinisk tjänstgöring' },
                    { value: 'course', label: 'Kurs' },
                    { value: 'sr_meeting', label: 'Studierektorsmöte' },
                    { value: 'progression_assessment', label: 'Progressionsbedömning' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setSuggestType(opt.value); resetSuggestForm(); }}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors text-left ${
                        suggestType === opt.value
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
              </div>

              {/* ─── PLACERING ─── */}
              {suggestType === 'placement' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Placering</label>
                    <input
                      type="text"
                      value={suggestTitle}
                      onChange={(e) => setSuggestTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Start</label>
                      <CalendarDatePicker
                        value={suggestStart}
                        onChange={(v) => {
                          setSuggestStart(v);
                          if (v && suggestEnd && v > suggestEnd) setSuggestEnd(v);
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Slut</label>
                      <CalendarDatePicker
                        value={suggestEnd}
                        onChange={(v) =>
                          setSuggestEnd(v && suggestStart && v < suggestStart ? suggestStart : v)
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Anteckning (valfritt)</label>
                    <textarea value={suggestNote} onChange={(e) => setSuggestNote(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                  </div>
                </>
              )}

              {/* ─── KURS ─── */}
              {suggestType === 'course' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kurs</label>
                    {recipientCoursesLoading ? (
                      <p className="text-xs text-slate-500">Laddar kurser...</p>
                    ) : (
                      <select
                        value={suggestCourseSelected}
                        onChange={(e) => { setSuggestCourseSelected(e.target.value); setSuggestCourseCustom(''); }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="" disabled>Välj kurs…</option>
                        {recipientCourses.map((c) => (
                          <option key={c.id} value={c.courseTitle && c.title === 'Annan kurs' ? c.courseTitle : c.title}>
                            {c.title === 'Annan kurs' && c.courseTitle ? c.courseTitle : c.title}
                          </option>
                        ))}
                        <option value="Annan kurs">Annan kurs</option>
                      </select>
                    )}
                  </div>
                  {suggestCourseSelected === 'Annan kurs' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Kursens titel</label>
                      <input type="text" value={suggestCourseCustom} onChange={(e) => setSuggestCourseCustom(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Start</label>
                      <CalendarDatePicker
                        value={suggestCourseStart}
                        onChange={(v) => {
                          setSuggestCourseStart(v);
                          if (v && suggestCourseEnd && v > suggestCourseEnd) setSuggestCourseEnd(v);
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Slut</label>
                      <CalendarDatePicker
                        value={suggestCourseEnd}
                        onChange={(v) =>
                          setSuggestCourseEnd(
                            v && suggestCourseStart && v < suggestCourseStart ? suggestCourseStart : v
                          )
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Anteckning (valfritt)</label>
                    <textarea value={suggestCourseNote} onChange={(e) => setSuggestCourseNote(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                  </div>
                </>
              )}

              {/* ─── STUDIEREKTORSMÖTE ─── */}
              {suggestType === 'sr_meeting' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Datum</label>
                    <CalendarDatePicker value={suggestMeetingDate} onChange={setSuggestMeetingDate} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fokus / rubrik</label>
                    <input type="text" value={suggestMeetingFocus} onChange={(e) => setSuggestMeetingFocus(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Anteckning</label>
                    <textarea value={suggestMeetingNote} onChange={(e) => setSuggestMeetingNote(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                  </div>
                </>
              )}

              {/* ─── PROGRESSIONSBEDÖMNING ─── */}
              {suggestType === 'progression_assessment' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Datum</label>
                    <CalendarDatePicker value={suggestAssessmentDate} onChange={setSuggestAssessmentDate} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Instrument</label>
                    {recipientInstrumentsLoading ? (
                      <p className="text-xs text-slate-500">Laddar instrument...</p>
                    ) : (
                      <select
                        value={suggestAssessmentInstrument}
                        onChange={(e) => { setSuggestAssessmentInstrument(e.target.value); setSuggestAssessmentInstrumentOther(''); }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="" disabled>Välj instrument…</option>
                        {recipientInstruments.map((inst) => (
                          <option key={inst} value={inst}>{inst}</option>
                        ))}
                        <option value="Annan">Annan</option>
                      </select>
                    )}
                  </div>
                  {suggestAssessmentInstrument === 'Annan' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Instrumentets namn</label>
                      <input type="text" value={suggestAssessmentInstrumentOther} onChange={(e) => setSuggestAssessmentInstrumentOther(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Placering</label>
                    <input type="text" value={suggestAssessmentLevel} readOnly
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Anteckning</label>
                    <textarea value={suggestAssessmentNote} onChange={(e) => setSuggestAssessmentNote(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                  </div>
                </>
              )}

              <div className="flex items-end justify-between gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={suggestSendAsEmail}
                    onChange={(e) => setSuggestSendAsEmail(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span>Skicka även som e-post</span>
                </label>
                <button
                  onClick={handleSendSuggestion}
                  disabled={suggestSending}
                  className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {suggestSending ? 'Skickar...' : 'Skicka förslag'}
                </button>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSuggestionHistoryOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
                >
                  <span>Historik</span>
                  <svg className={`h-4 w-4 text-slate-500 transition-transform ${suggestionHistoryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" /></svg>
                </button>
                {suggestionHistoryOpen && (
                  <div className="mt-3">
                    {sentSuggestionsLoading ? (
                      <p className="text-xs text-slate-500">Laddar...</p>
                    ) : sentSuggestions.length === 0 ? (
                      <p className="text-xs text-slate-400">Ingen historik ännu.</p>
                    ) : (
                      <div className="space-y-2">
                        {sentSuggestions.map((sug) => {
                          const d = sug.activity_data || {};
                          const typeLabel: Record<string, string> = {
                            placement: 'Klinisk tjänstgöring',
                            course: 'Kurs',
                            sr_meeting: 'Studierektorsmöte',
                            progression_assessment: 'Progressionsbedömning'
                          };
                          const statusLabel: Record<string, string> = {
                            pending: 'Väntar', accepted: 'Accepterat', dismissed: 'Avfärdat'
                          };
                          const statusCls: Record<string, string> = {
                            pending: 'bg-amber-100 text-amber-700',
                            accepted: 'bg-emerald-100 text-emerald-700',
                            dismissed: 'bg-slate-200 text-slate-500'
                          };
                          const preview = d.title || d.focus || d.summary || typeLabel[sug.activity_type] || sug.activity_type;
                          const isExpanded = expandedSuggestionId === sug.id;
                          return (
                            <div key={sug.id} className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setExpandedSuggestionId(isExpanded ? null : sug.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 transition-colors"
                              >
                                <span className="text-xs text-slate-600 flex-1 truncate mr-2">
                                  <span className="font-medium">{typeLabel[sug.activity_type] || sug.activity_type}:</span> {String(preview).slice(0, 50)}
                                </span>
                                <span className="flex items-center gap-2 shrink-0">
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusCls[sug.status] || 'bg-slate-200 text-slate-500'}`}>
                                    {statusLabel[sug.status] || sug.status}
                                  </span>
                                  <span className="text-xs text-slate-400">{new Date(sug.created_at).toLocaleDateString('sv-SE')}</span>
                                  <svg className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" /></svg>
                                </span>
                              </button>
                              {isExpanded && (
                                <div className="px-3 pb-3 pt-1 border-t border-slate-200 bg-white space-y-2">
                                  <div className="space-y-1">
                                    {d.title && <p className="text-xs text-slate-600"><span className="font-medium">Titel:</span> {d.title}</p>}
                                    {d.dateISO && <p className="text-xs text-slate-600"><span className="font-medium">Datum:</span> {new Date(d.dateISO).toLocaleDateString('sv-SE')}</p>}
                                    {d.startDate && <p className="text-xs text-slate-600"><span className="font-medium">Start:</span> {new Date(d.startDate).toLocaleDateString('sv-SE')}</p>}
                                    {d.endDate && <p className="text-xs text-slate-600"><span className="font-medium">Slut:</span> {new Date(d.endDate).toLocaleDateString('sv-SE')}</p>}
                                    {d.focus && <p className="text-xs text-slate-600"><span className="font-medium">Fokus:</span> {d.focus}</p>}
                                    {d.level && <p className="text-xs text-slate-600"><span className="font-medium">Nivå:</span> {d.level}</p>}
                                    {d.instrument && <p className="text-xs text-slate-600"><span className="font-medium">Instrument:</span> {d.instrument}</p>}
                                    {d.summary && <p className="text-xs text-slate-600"><span className="font-medium">Sammanfattning:</span> {d.summary}</p>}
                                    {d.strengths && <p className="text-xs text-slate-600"><span className="font-medium">Styrkor:</span> {d.strengths}</p>}
                                    {d.development && <p className="text-xs text-slate-600"><span className="font-medium">Utvecklingsområden:</span> {d.development}</p>}
                                    {d.note && <p className="text-xs text-slate-600"><span className="font-medium">Anteckning:</span> {d.note}</p>}
                                  </div>
                                  {(sug.status === 'accepted' || sug.status === 'dismissed') && (
                                    <button
                                      onClick={() => {
                                        openDeleteConfirm({
                                          title: 'Ta bort',
                                          message: 'Är du säker på att du vill ta bort detta aktivitetsförslag?',
                                          confirmLabel: 'Ta bort',
                                          onConfirm: async () => {
                                            const { error } = await deleteSrActivitySuggestionById(sug.id);
                                            if (error) {
                                              showFeedback('err', 'Kunde inte ta bort förslaget.');
                                            } else {
                                              showFeedback('ok', 'Förslag borttaget.');
                                              setSentSuggestions(prev => prev.filter(s => s.id !== sug.id));
                                            }
                                            setDeleteConfirmConfig(null);
                                          },
                                        });
                                      }}
                                      className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                                    >
                                      Ta bort
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
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
      )}

      {dashTab === 'huvudhandledare' && (
        <div className="space-y-6 mt-6 px-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Bjud in ST-huvudhandledare</h2>
            <form onSubmit={handleSendInviteHh} className="flex gap-3 flex-wrap">
              <input
                type="email"
                value={inviteHhEmail}
                onChange={(e) => setInviteHhEmail(e.target.value)}
                placeholder="E-postadress"
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              />
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-6 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:translate-y-px disabled:opacity-50"
              >
                {sending ? 'Skickar...' : 'Skicka inbjudan'}
              </button>
            </form>
            {feedback && (
              <div
                className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${
                  feedback.type === 'ok'
                    ? 'border border-green-200 bg-green-50 text-green-800'
                    : 'border border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {feedback.msg}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Huvudhandledare ({huvudhandledare.length})
            </h2>
            {huvudhandledare.length === 0 ? (
              <p className="text-sm text-slate-500">Inga huvudhandledare registrerade ännu.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[520px] text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-left">
                    <tr>
                      <th className={`${DASH_TBL_TH} text-left`}>Huvudhandledare</th>
                      <th className={`${DASH_TBL_TH} text-left`}>Huvudhandledare för</th>
                      <th className={`${DASH_TBL_TH} w-[1%] whitespace-nowrap text-right`}>
                        <span className="sr-only">Åtgärder</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {huvudhandledare.map((member) => {
                      const profile = member.profile;
                      const stNames = supervisedStNamesBySupervisorId.get(member.user_id) || [];
                      const stLabel =
                        stNames.length === 0
                          ? "—"
                          : stNames.join(", ");
                      const displayName =
                        fallbackSupervisorNameById.get(member.user_id) || profile.name || "Namn saknas";
                      return (
                        <tr
                          key={member.user_id}
                          className="cursor-pointer bg-white transition-colors hover:bg-slate-100"
                          onClick={() =>
                            setHhDetailOpen({
                              userId: member.user_id,
                              name: displayName,
                            })
                          }
                        >
                          <td className={DASH_TBL_TD_STRONG}>{displayName}</td>
                          <td className={DASH_TBL_TD}>
                            {stNames.length === 0 ? (
                              <span className="italic text-slate-400">Ingen ST-läkare tilldelad ännu</span>
                            ) : (
                              <span>{stLabel}</span>
                            )}
                          </td>
                          <td className={`${DASH_TBL_TD} text-right whitespace-nowrap`}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveMember(
                                  member.user_id,
                                  profile.name || "denna huvudhandledare"
                                );
                              }}
                              className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700"
                            >
                              Ta bort
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {dashTab === 'klinik' && (
        <div className="space-y-6 mt-6 px-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Klinik</h2>
            {clinicForm.facilityType === 'vardcentral' ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                    <input
                      type="text"
                      value={clinicForm.regionLabel || '—'}
                      readOnly
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vårdcentral</label>
                    <input
                      type="text"
                      value={clinicForm.sjukhusLabel || '—'}
                      readOnly
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Klinik</label>
                  <input
                    type="text"
                    value={clinicForm.clinicName}
                    readOnly
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                  <input
                    type="text"
                    value={clinicForm.regionLabel || '—'}
                    readOnly
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sjukhus</label>
                    <input
                      type="text"
                      value={clinicForm.sjukhusLabel || '—'}
                      readOnly
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Klinik</label>
                    <input
                      type="text"
                      value={clinicForm.clinicName}
                      readOnly
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                    />
                  </div>
                </div>
              </>
            )}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Chefer</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ST-chef</label>
                <input
                  type="text"
                  value={clinicForm.stChef}
                  onChange={(e) => {
                    setClinicForm((p) => ({ ...p, stChef: e.target.value }));
                    setClinicDirty(true);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Verksamhetschef</label>
                <input
                  type="text"
                  value={clinicForm.verksamhetschef}
                  onChange={(e) => {
                    setClinicForm((p) => ({ ...p, verksamhetschef: e.target.value }));
                    setClinicDirty(true);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  void saveClinicForm(false);
                }}
                disabled={clinicSaving}
                className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {clinicSaving ? 'Sparar...' : 'Spara klinikuppgifter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Aktiviteter-fliken ─── */}
      {dashTab === 'aktiviteter' && (
      <div className="space-y-6 mt-6 px-6">

        {/* Sub-flikar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {([['placering','Kliniska tjänstgöringar'],['kurs','Kurser'],['annan','Utbildningsmoment']] as [ActTemplTab,string][]).map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setActTemplTab(v)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    actTemplTab===v ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}>{l}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {actTemplTab === 'placering' && (
                <button
                  type="button"
                  onClick={() => setGroupEditorScope('placering')}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Redigera grupper
                </button>
              )}
              {actTemplTab === 'annan' && (
                <button
                  type="button"
                  onClick={() => setGroupEditorScope('moment')}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Redigera grupper
                </button>
              )}
              {actTemplTab === 'kurs' && (
                <button
                  type="button"
                  onClick={() => setGroupEditorScope('kurs')}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Redigera grupper
                </button>
              )}
              <button
                type="button"
                onClick={()=>{ 
                  setTemplRequirementLevel('obligatorisk');
                  setTemplAlternatives(['']);
                  setTemplForm({type:actTemplTab,title:'',description:'',suggested_milestones:[],suggested_rows:[],is_metis:actTemplTab==='kurs'&&false,is_active:true,track_completions:false}); 
                  setTemplMilestones2015([]);
                  setTemplMilestones2021([]);
                  setTemplMilestoneInput(''); 
                  setTemplRequiredRowInput('');
                  setTemplRecommendedRowInput('');
                  setTemplSuggestedPeriodMonths('');
                  setTemplCourseGroup('');
                  setTemplCourseSubgroup('');
                  setEditingTemplate(null); 
                  setTemplAddOpen(true); 
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-600 bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Lägg till
              </button>
            </div>
          </div>

          <div className="p-6">
            {templatesLoading ? (
              <p className="text-sm text-slate-500">Laddar...</p>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const rawForTab = activityTemplates.filter((t) => t.type === actTemplTab);
                  const byId = new Map(rawForTab.map((t) => [String(t.id), t]));
                  let visibleTemplates = Array.from(byId.values());
                  if (actTemplTab === 'kurs') {
                    const byTitle = new Map<string, ActivityTemplate>();
                    for (const t of visibleTemplates) {
                      const k = courseTemplateTitleKey(t.title);
                      if (!byTitle.has(k)) byTitle.set(k, t);
                    }
                    visibleTemplates = Array.from(byTitle.values());
                  }
                  return visibleTemplates;
                })().length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8">
                    Inga {actTemplTab === 'placering' ? 'kliniska tjänstgöringar' : actTemplTab === 'kurs' ? 'kurser' : 'utbildningsmoment'} ännu. Klicka “Lägg till” för att börja.
                  </p>
                ) : (
                  (() => {
                    const rawForTab = activityTemplates.filter((t) => t.type === actTemplTab);
                    const byId = new Map(rawForTab.map((t) => [String(t.id), t]));
                    let visibleTemplates = Array.from(byId.values());
                    if (actTemplTab === 'kurs') {
                      const byTitle = new Map<string, ActivityTemplate>();
                      for (const t of visibleTemplates) {
                        const k = courseTemplateTitleKey(t.title);
                        if (!byTitle.has(k)) byTitle.set(k, t);
                      }
                      visibleTemplates = Array.from(byTitle.values());
                    }
                    const showRekMinTidColumn = actTemplTab === 'placering';
                    const showSamlatColumn = actTemplTab === 'annan';
                    /** table-fixed på alla flikar så kolumner linjerar mellan grupper/undergrupper */
                    const courseTableFixed = true;
                    const renderTableHead = () => (
                      <thead className="border-b border-slate-200 bg-slate-50 text-left">
                        <tr>
                          <th
                            className={`${DASH_TBL_TH} text-left ${
                              courseTableFixed ? 'w-[28%]' : ''
                            }`}
                          >
                            Titel
                          </th>
                          <th
                            className={`${DASH_TBL_TH} text-left ${
                              courseTableFixed ? 'w-[12%]' : 'w-[9rem]'
                            }`}
                          >
                            Kravnivå
                          </th>
                          {showRekMinTidColumn ? (
                            <th className={`${DASH_TBL_TH} w-[19rem] text-left pl-8`}>
                              Alternativ
                            </th>
                          ) : null}
                          {showRekMinTidColumn ? (
                            <th className={`${DASH_TBL_TH} w-[7rem] whitespace-nowrap text-left pl-0`}>
                              Rek. min. tid
                            </th>
                          ) : null}
                          {showSamlatColumn ? (
                            <th
                              className={`${DASH_TBL_TH} w-[11.5rem] min-w-[11.5rem] whitespace-nowrap text-left pr-5`}
                            >
                              Redovisas samlat
                            </th>
                          ) : null}
                          <th
                            className={`${DASH_TBL_TH} text-left ${
                              courseTableFixed ? 'w-[50%] min-w-0' : 'min-w-[12rem]'
                            } ${showSamlatColumn ? 'pl-4' : ''}`}
                          >
                            Delmål
                          </th>
                          <th
                            className={`${DASH_TBL_TH} whitespace-nowrap text-right ${
                              courseTableFixed ? 'w-[10%]' : 'w-[1%]'
                            }`}
                          >
                            <span className="sr-only">Åtgärder</span>
                          </th>
                        </tr>
                      </thead>
                    );
                    const renderTemplateRow = (
                      t: ActivityTemplate,
                      isPlacementTab: boolean,
                      showRekMinCol: boolean,
                      showSamlatCol: boolean
                    ) => {
                      const months = getSuggestedPeriodMonths(t.suggested_rows || []);
                      const level = getTemplateRequirementLevel(t.suggested_rows || []);
                      const alternatives = getTemplateAlternatives(t.suggested_rows || []);
                      return (
                        <tr
                          key={t.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openActivityTemplateEditor(t)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openActivityTemplateEditor(t);
                            }
                          }}
                          className={`cursor-pointer bg-white transition-colors hover:bg-slate-100 ${
                            !t.is_active ? 'opacity-60' : ''
                          }`}
                        >
                          <td className={`${DASH_TBL_TD} ${courseTableFixed ? 'min-w-0' : ''}`}>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-900">
                                <span className="break-words">{t.title}</span>
                                {!t.is_active && (
                                  <span className="shrink-0 rounded-full bg-slate-200/80 px-1 py-0 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                                    Inaktiv
                                  </span>
                                )}
                              </div>
                              {t.description ? (
                                <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                                  {t.description}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className={`${DASH_TBL_TD} ${courseTableFixed ? 'min-w-0' : ''}`}>
                            <span
                              className={`inline-flex rounded-full border px-1.5 py-0 text-[10px] font-medium ${templateRequirementLevelPillClass(level)}`}
                            >
                              {templateRequirementLevelLabel(level)}
                            </span>
                          </td>
                          {showRekMinCol ? (
                            <td className={`${DASH_TBL_TD} ${courseTableFixed ? 'min-w-0 pl-8' : 'pl-8'}`}>
                              {alternatives.length > 0 ? (
                                <span className="block whitespace-pre-line break-words text-[11px] leading-4 text-slate-700">
                                  {alternatives.length > 2 ? alternatives.join('\n') : alternatives.join(', ')}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          ) : null}
                          {showRekMinCol ? (
                            <td className={`${DASH_TBL_TD} whitespace-nowrap pl-0`}>
                              {isPlacementTab && months ? `${months} mån` : '—'}
                            </td>
                          ) : null}
                          {showSamlatCol ? (
                            <td className={`${DASH_TBL_TD} whitespace-nowrap text-slate-700 pr-5`}>
                              {t.track_completions ? 'Ja' : 'Nej'}
                            </td>
                          ) : null}
                          <td
                            className={`${DASH_TBL_TD} ${courseTableFixed ? 'min-w-0' : ''} ${
                              showSamlatCol ? 'pl-4' : ''
                            }`}
                          >
                            <ActivityTemplateMilestonePills milestones={t.suggested_milestones || []} />
                          </td>
                          <td className={`${DASH_TBL_TD} text-right whitespace-nowrap ${courseTableFixed ? 'min-w-0' : ''}`}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void requestDeleteTemplate(t);
                              }}
                              className="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                            >
                              Ta bort
                            </button>
                          </td>
                        </tr>
                      );
                    };
                    const titleGroupingForTab =
                      actTemplTab === 'kurs'
                        ? courseTemplateGroupingByTitle
                        : actTemplTab === 'annan'
                          ? momentTemplateGroupingByTitle
                          : placementTemplateGroupingByTitle;
                    const groupOrder =
                      actTemplTab === 'kurs'
                        ? courseGroups
                        : actTemplTab === 'annan'
                          ? momentGroups
                          : placementGroups;
                    const subgroupsByGroupForSort =
                      actTemplTab === 'kurs'
                        ? courseSubgroupsByGroup
                        : actTemplTab === 'annan'
                          ? momentSubgroupsByGroup
                          : placementSubgroupsByGroup;
                    const isPlacementGroupedTab = actTemplTab === 'placering';
                    const groupIndex = new Map<string, number>();
                    groupOrder.forEach((g, i) => groupIndex.set(g, i));
                    const subgroupRankInGroup = (groupName: string, rawSub: string) => {
                      const s = String(rawSub || '').trim();
                      if (!s) return -1;
                      const list = subgroupsByGroupForSort[groupName] || [];
                      const ix = list.indexOf(s);
                      return ix >= 0 ? ix : 10_000;
                    };
                    const grouped = visibleTemplates
                      .map((t) => ({
                        ...t,
                        __group:
                          getCourseTemplateGroup(t.suggested_rows || []) ||
                          titleGroupingForTab[courseTemplateTitleKey(t.title)]?.group ||
                          'Övrigt',
                        __subgroup:
                          getCourseTemplateSubgroup(t.suggested_rows || []) ||
                          titleGroupingForTab[courseTemplateTitleKey(t.title)]?.subgroup ||
                          '',
                      }))
                      .sort((a, b) => {
                        const ai = groupIndex.has(a.__group) ? Number(groupIndex.get(a.__group)) : 9999;
                        const bi = groupIndex.has(b.__group) ? Number(groupIndex.get(b.__group)) : 9999;
                        if (ai !== bi) return ai - bi;
                        if (a.__group !== b.__group) return a.__group.localeCompare(b.__group, 'sv');
                        const sa = subgroupRankInGroup(a.__group, String((a as any).__subgroup || ''));
                        const sb = subgroupRankInGroup(b.__group, String((b as any).__subgroup || ''));
                        if (sa !== sb) return sa - sb;
                        if (a.__subgroup !== b.__subgroup) {
                          return String(a.__subgroup || '').localeCompare(String(b.__subgroup || ''), 'sv');
                        }
                        return String(a.title || '').localeCompare(String(b.title || ''), 'sv');
                      });

                    const buckets = new Map<string, typeof grouped>();
                    for (const t of grouped) {
                      if (!buckets.has(t.__group)) buckets.set(t.__group, []);
                      buckets.get(t.__group)!.push(t);
                    }
                    const groupsInOrder = Array.from(buckets.keys());

                    return groupsInOrder.map((groupName, groupIdx) => {
                      const items = buckets.get(groupName) || [];
                      const subgroupBuckets = new Map<string, typeof items>();
                      for (const it of items) {
                        const subgroup = String((it as any).__subgroup || '').trim();
                        const key = subgroup || '__none__';
                        if (!subgroupBuckets.has(key)) subgroupBuckets.set(key, []);
                        subgroupBuckets.get(key)!.push(it);
                      }
                      const configuredSubgroupOrder = subgroupsByGroupForSort[groupName] || [];
                      const keysWithTemplates = Array.from(subgroupBuckets.keys());
                      const namedInData = keysWithTemplates.filter((k) => k !== '__none__');
                      const subgroupOrder: string[] = [];
                      if (subgroupBuckets.has('__none__')) {
                        subgroupOrder.push('__none__');
                      }
                      for (const name of configuredSubgroupOrder) {
                        if (subgroupBuckets.has(name)) {
                          subgroupOrder.push(name);
                        }
                      }
                      const configuredSubSet = new Set(configuredSubgroupOrder);
                      subgroupOrder.push(
                        ...namedInData
                          .filter((k) => !configuredSubSet.has(k))
                          .sort((a, b) => a.localeCompare(b, 'sv'))
                      );
                      const groupHeaderClass =
                        ACTIVITY_TEMPLATE_GROUP_HEADER_STYLES[
                          groupIdx % ACTIVITY_TEMPLATE_GROUP_HEADER_STYLES.length
                        ];
                      return (
                        <div key={`group-${groupName}`} className="col-span-full space-y-2">
                          <div
                            className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${groupHeaderClass}`}
                          >
                            {groupName}
                          </div>
                          <div className="ml-3 border-l-2 border-slate-200/70 pl-4 sm:ml-5 sm:pl-5 space-y-2">
                            {subgroupOrder.map((subKey) => {
                              const subgroupItems = subgroupBuckets.get(subKey) || [];
                              return (
                                <div key={`${groupName}-${subKey}`} className="space-y-1">
                                  {subKey !== '__none__' && (
                                    <div className="px-1 text-[11px] font-medium text-slate-500">
                                      {subKey}
                                    </div>
                                  )}
                                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table
                                      className={`w-full min-w-[720px] text-xs ${courseTableFixed ? 'table-fixed' : ''}`}
                                    >
                                      {renderTableHead()}
                                      <tbody className="divide-y divide-slate-100">
                                        {subgroupItems.map((t) =>
                                          renderTemplateRow(
                                            t,
                                            isPlacementGroupedTab,
                                            isPlacementGroupedTab,
                                            showSamlatColumn
                                          )
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            )}
          </div>
        </div>

      </div>
      )}

      {/* ─── IUP-fliken ─── */}
      {dashTab === 'iup' && (
        <div className="space-y-6 mt-6 px-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                {([
                  ['planering', 'Planering'],
                  ['handledning', 'Handledning'],
                  ['delmal', 'Delmål'],
                ] as const).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setIupTab(v)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      iupTab === v ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="text-xs text-slate-500">
                Styr standardförslag för ST-läkarens IUP
              </div>
            </div>

            <div className="p-6">
              {iupTab === 'planering' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Standard för IUP Planering</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      ST-läkaren kan fortfarande lägga till och ta bort på sin egen sida.
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 text-xs font-semibold text-slate-700">1) Basrubriker</div>
                      <p className="mb-3 text-xs text-slate-500">
                        Välj vilka fördefinierade rubriker som ska vara förvalda i ST-läkarens planering.
                      </p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {IUP_PLANNING_BASE_SECTIONS.map((sec) => {
                          const checked = iupPlanningSelectedBaseKeys.includes(sec.key);
                          return (
                            <label
                              key={sec.key}
                              className="inline-flex items-center gap-2 text-sm text-slate-700"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                checked={checked}
                                onChange={(e) => toggleIupPlanningBaseSection(sec.key, sec.label, e.target.checked)}
                              />
                              <span>{sec.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-2 text-xs font-semibold text-slate-700">2) Extra rubrikförslag</div>
                      <p className="mb-3 text-xs text-slate-500">
                        Lägg till egna rubriker som förslag. De visas som tillval för ST-läkaren.
                      </p>
                      <div className="mb-3 flex gap-2">
                        <input
                          type="text"
                          value={iupPlanningNewSuggestion}
                          onChange={(e) => setIupPlanningNewSuggestion(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            addIupPlanningSuggestion();
                          }}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          placeholder="Skriv rubrikförslag"
                        />
                        <button
                          type="button"
                          onClick={addIupPlanningSuggestion}
                          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Lägg till
                        </button>
                      </div>
                      <div className="space-y-1">
                        {iupPlanningCustomSuggestions.length === 0 && (
                          <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                            Inga extra rubriker ännu.
                          </div>
                        )}
                        {iupPlanningCustomSuggestions.map((title) => (
                          <div key={title} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                            <span className="text-sm text-slate-700">{title}</span>
                            <button
                              type="button"
                              onClick={() => removeIupPlanningSuggestion(title)}
                              className="text-xs font-semibold text-slate-500 hover:text-red-600"
                            >
                              Ta bort
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-700">3) Förhandsgranskning för ST-läkare</div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {iupPlanningPreviewTitles.length === 0 ? (
                        <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                          Inga rubriker valda ännu.
                        </div>
                      ) : (
                        iupPlanningPreviewTitles.map((title) => (
                          <div key={title} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {title}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveIupPlanningConfig()}
                      disabled={iupSavingPlanning}
                      className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                    >
                      {iupSavingPlanning ? 'Sparar...' : 'Spara planering'}
                    </button>
                  </div>
                </div>
              )}

              {iupTab === 'handledning' && (
                <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
                  <IupHandledningTab
                    value={iupHandledningExpectations}
                    onChange={setIupHandledningExpectations}
                    onSave={saveIupHandledningConfig}
                    saving={iupSavingHandledning}
                    disabled={!editorClinicId}
                  />
                  <IupProgressionInstrumentsConfigPanel
                    value={iupProgressionInstrumentsConfig}
                    onChange={setIupProgressionInstrumentsConfig}
                    onSave={saveIupProgressionInstrumentsConfig}
                    saving={iupSavingProgressionInstruments}
                    disabled={!editorClinicId}
                  />
                </div>
              )}

              {iupTab === 'delmal' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIupGoalVersion('2015')}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        iupGoalVersion === '2015' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Målversion 2015
                    </button>
                    <button
                      type="button"
                      onClick={() => setIupGoalVersion('2021')}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        iupGoalVersion === '2021' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Målversion 2021
                    </button>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-700">Välj delmål att redigera</div>
                    <input
                      type="text"
                      value={iupGoalSearch}
                      onChange={(e) => setIupGoalSearch(e.target.value)}
                      placeholder="Sök delmål..."
                      className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <div className="space-y-2 pr-0.5">
                      {groupedFilteredIupGoals.length === 0 ? (
                        <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                          Inga delmål matchar sökningen eller katalogen är inte laddad ännu.
                        </div>
                      ) : (
                        groupedFilteredIupGoals.map((group) => (
                          <div key={`${iupGoalVersion}-${group.id}`} className="mb-2">
                            <div className="mb-1 rounded bg-slate-200/90 px-2 py-1 text-[11px] font-semibold text-slate-700">
                              {group.label} ({group.items.length})
                            </div>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              {group.items.map((m) => {
                                const code = displayMilestoneCode(String(m.code || m.id || ''), iupGoalVersion);
                                const id = iupDashboardCanonMilestoneId(m, iupGoalVersion);
                                const selectedCount = (iupGoalSuggestionsByMilestone[id] || []).length;
                                return (
                                  <button
                                    key={`${iupGoalVersion}-${id}`}
                                    type="button"
                                    onClick={() => setIupGoalDetail(id)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-left hover:bg-slate-50"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-semibold text-slate-800">{code}</span>
                                      <span className="shrink-0 text-[11px] text-slate-500">{selectedCount} förslag</span>
                                    </div>
                                    <div className="mt-0.5 line-clamp-2 text-sm text-slate-700">
                                      {String(m.title || 'Delmål')}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {iupGoalDetail && (
                    <div
                      className="fixed inset-0 z-[760] grid place-items-center bg-black/50 p-4"
                      onClick={() => setIupGoalDetail(null)}
                    >
                      <div
                        className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Delmålsplanering
                            </div>
                            <div className="text-base font-semibold text-slate-900">
                              {displayMilestoneCode(iupGoalDetail, iupGoalVersion)} {iupGoalDetailMilestone?.title ? `- ${String(iupGoalDetailMilestone.title)}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIupGoalDetail(null)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Stäng
                          </button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-5">
                          <div className="grid gap-4 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1.2fr)]">
                            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                              {typeof (iupGoalDetailMilestone as any)?.description === 'string' &&
                              String((iupGoalDetailMilestone as any)?.description || '').trim() ? (
                                <p className="text-sm leading-relaxed text-slate-800">
                                  {String((iupGoalDetailMilestone as any)?.description || '')}
                                </p>
                              ) : null}
                              {Array.isArray((iupGoalDetailMilestone as any)?.sections) &&
                              (iupGoalDetailMilestone as any)?.sections.length > 0 ? (
                                <div className="space-y-3">
                                  {(iupGoalDetailMilestone as any).sections.map((sec: any, idx: number) => (
                                    <section key={`sr-goal-sec-${idx}`} className="space-y-1">
                                      {sec?.title ? (
                                        <div className="text-sm font-semibold text-slate-800">{String(sec.title)}</div>
                                      ) : null}
                                      {Array.isArray(sec?.items) ? (
                                        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                                          {sec.items.map((it: any, i: number) => (
                                            <li key={`sr-goal-it-${idx}-${i}`}>{String(it || '')}</li>
                                          ))}
                                        </ul>
                                      ) : typeof sec?.text === 'string' && sec.text.trim() ? (
                                        <p className="text-sm text-slate-700">{String(sec.text)}</p>
                                      ) : null}
                                    </section>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                                  Ingen detaljbeskrivning hittades för detta delmål.
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="mb-2 text-xs font-semibold text-slate-700">
                                  1) Välj bland fördefinierade förslag
                                </div>
                                <div className="space-y-1">
                                  {iupGoalOptionPool.map((opt) => {
                                    const selected = iupGoalSelectedPredefinedSuggestions.includes(opt);
                                    return (
                                      <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                          type="checkbox"
                                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                          checked={selected}
                                          onChange={(e) => toggleIupGoalPredefinedSuggestion(opt, e.target.checked)}
                                        />
                                        <span>{opt}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <div className="mb-2 text-xs font-semibold text-slate-700">
                                  2) Skriv egna förslag
                                </div>
                                <div className="mb-2 flex gap-2">
                                  <input
                                    type="text"
                                    value={iupGoalNewOption}
                                    onChange={(e) => setIupGoalNewOption(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key !== 'Enter') return;
                                      e.preventDefault();
                                      addIupGoalCustomSuggestion();
                                    }}
                                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    placeholder="Skriv eget förslag"
                                  />
                                  <button
                                    type="button"
                                    onClick={addIupGoalCustomSuggestion}
                                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                                  >
                                    Lägg till
                                  </button>
                                </div>
                                <div className="space-y-1">
                                  {iupGoalSelectedCustomSuggestions.length === 0 ? (
                                    <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                                      Inga egna förslag tillagda för detta delmål.
                                    </div>
                                  ) : (
                                    iupGoalSelectedCustomSuggestions.map((opt) => (
                                      <div
                                        key={`custom-${iupGoalDetail}-${opt}`}
                                        className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5"
                                      >
                                        <span className="text-sm text-slate-700">{opt}</span>
                                        <button
                                          type="button"
                                          onClick={() => removeIupGoalCustomSuggestion(opt)}
                                          className="text-xs font-semibold text-slate-500 hover:text-red-600"
                                        >
                                          Ta bort
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <div className="mb-2 text-xs font-semibold text-slate-700">
                                  3) Sammanställning (1 + 2)
                                </div>
                                <div className="space-y-1">
                                  {iupGoalSelectedSuggestions.length === 0 ? (
                                    <div className="rounded border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                                      Inga förslag valda än för detta delmål.
                                    </div>
                                  ) : (
                                    iupGoalSelectedSuggestions.map((opt) => (
                                      <div
                                        key={`summary-${iupGoalDetail}-${opt}`}
                                        className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                                      >
                                        {opt}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveIupGoalSuggestionsConfig()}
                      disabled={iupSavingGoals}
                      className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                    >
                      {iupSavingGoals ? 'Sparar...' : 'Spara delmålsförslag'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Formulär-popup för aktivitetsmallar - flyttad utanför tab-conditional */}
      {templAddOpen && (
        <div className="fixed inset-0 z-[700] bg-black/60 flex items-center justify-center p-4" onClick={()=>setTemplAddOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">{editingTemplate?'Redigera':'Lägg till'} {actTemplTab==='placering'?'klinisk tjänstgöring':actTemplTab==='kurs'?'kurs':'utbildningsmoment'}</h3>
              <button
                onClick={()=>setTemplAddOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Stäng
              </button>
            </div>
            <div className="border-b border-black" />
            <div className="p-6 space-y-4 overflow-y-auto min-h-0">
              <div className="rounded-xl shadow-sm border border-slate-200 bg-white p-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">{actTemplTab==='placering'?'Placering':'Titel'} *</label>
                <input type="text" value={templForm.title} onChange={e=>setTemplForm(f=>({...f,title:e.target.value}))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="rounded-xl shadow-sm border border-slate-200 bg-white p-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Kravnivå</label>
                <select
                  value={templRequirementLevel}
                  onChange={(e) =>
                    setTemplRequirementLevel(e.target.value as TemplateRequirementLevel)
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="obligatorisk">Obligatorisk</option>
                  <option value="rekommenderad">Rekommenderad</option>
                  <option value="valfri">Valfri</option>
                </select>
                {actTemplTab === 'placering' && templRequirementLevel !== 'valfri' ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-slate-500">
                      Välj alternativa kliniska tjänstgöringar som kan uppfylla samma krav.
                    </p>
                    {templAlternatives.map((selected, idx) => (
                      <div key={`templ-alt-${idx}`} className="space-y-1">
                        <label className="block text-xs font-medium text-slate-600">
                          {idx === 0 ? 'Alternativ' : `Alternativ ${idx + 1}`}
                        </label>
                        <select
                          value={selected}
                          onChange={(e) => {
                            const value = e.target.value;
                            setTemplAlternatives((prev) => {
                              const next = [...prev];
                              next[idx] = value;
                              const cleaned = next.filter((x) => String(x || '').trim().length > 0);
                              return cleaned.length === next.length ? [...cleaned, ''] : [...cleaned, ''];
                            });
                          }}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="">Välj klinisk tjänstgöring</option>
                          {placementAlternativeOptions.map((title) => (
                            <option key={title} value={title}>
                              {title}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              {actTemplTab === 'placering' && (
                <div className="rounded-xl shadow-sm border border-slate-200 bg-white p-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Föreslagen tjänstgöringsperiod minimum
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={templSuggestedPeriodMonths}
                      onChange={(e) => setTemplSuggestedPeriodMonths(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <span className="shrink-0 text-sm text-slate-600">månader</span>
                  </div>
                </div>
              )}
              {templateGrupCtx && (
                <div className="rounded-xl shadow-sm border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="block text-sm font-medium text-slate-700">Gruppera</label>
                  </div>
                  <select
                    value={templCourseGroup}
                    onChange={(e) => {
                      const nextGroup = e.target.value;
                      setTemplCourseGroup(nextGroup);
                      const subs = templateGrupCtx.subgroupsByGroup[nextGroup] || [];
                      const nextSubgroup = subs.includes(templCourseSubgroup) ? templCourseSubgroup : '';
                      if (!subs.includes(templCourseSubgroup)) setTemplCourseSubgroup('');
                      setTemplForm((f) => {
                        const nextRows = withCourseTemplateSubgroup(
                          withCourseTemplateGroup(f.suggested_rows, nextGroup),
                          nextSubgroup
                        );
                        if (editingTemplate?.id) {
                          void saveCourseGroupingForTemplate(
                            editingTemplate.id,
                            nextRows,
                            nextGroup,
                            nextSubgroup
                          );
                        }
                        return {
                          ...f,
                          suggested_rows: nextRows,
                        };
                      });
                      const titleKey = courseTemplateTitleKey(editingTemplate?.title || templForm.title);
                      if (titleKey) {
                        templateGrupCtx.setTemplateGroupingByTitle((prev) => {
                          if (!nextGroup) {
                            const { [titleKey]: _, ...rest } = prev;
                            return rest;
                          }
                          return {
                            ...prev,
                            [titleKey]: nextSubgroup
                              ? { group: nextGroup, subgroup: nextSubgroup }
                              : { group: nextGroup },
                          };
                        });
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Ingen grupp</option>
                    {templateGrupCtx.groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  {templCourseGroup && (templateGrupCtx.subgroupsByGroup[templCourseGroup] || []).length > 0 && (
                    <div className="mt-3">
                      <label className="mb-1 block text-sm font-medium text-slate-700">Undergrupp</label>
                      <select
                        value={templCourseSubgroup}
                        onChange={(e) => {
                          const nextSubgroup = e.target.value;
                          setTemplCourseSubgroup(nextSubgroup);
                          setTemplForm((f) => {
                            const nextRows = withCourseTemplateSubgroup(
                              withCourseTemplateGroup(f.suggested_rows, templCourseGroup),
                              nextSubgroup
                            );
                            if (editingTemplate?.id) {
                              void saveCourseGroupingForTemplate(
                                editingTemplate.id,
                                nextRows,
                                templCourseGroup,
                                nextSubgroup
                              );
                            }
                            return {
                              ...f,
                              suggested_rows: nextRows,
                            };
                          });
                          const titleKey = courseTemplateTitleKey(editingTemplate?.title || templForm.title);
                          if (titleKey) {
                            templateGrupCtx.setTemplateGroupingByTitle((prev) => {
                              if (!templCourseGroup) {
                                const { [titleKey]: _, ...rest } = prev;
                                return rest;
                              }
                              return {
                                ...prev,
                                [titleKey]: nextSubgroup
                                  ? { group: templCourseGroup, subgroup: nextSubgroup }
                                  : { group: templCourseGroup },
                              };
                            });
                          }
                        }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="">Ingen undergrupp</option>
                        {(templateGrupCtx.subgroupsByGroup[templCourseGroup] || []).map((sg) => (
                          <option key={sg} value={sg}>
                            {sg}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {templCourseGroup &&
                    (templateGrupCtx.subgroupsByGroup[templCourseGroup] || []).length === 0 && (
                      <div className="mt-3">
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Undergrupp (valfritt)
                        </label>
                        <input
                          type="text"
                          value={templCourseSubgroup}
                          onChange={(e) => {
                            const nextSubgroup = e.target.value;
                            setTemplCourseSubgroup(nextSubgroup);
                            setTemplForm((f) => {
                              const nextRows = withCourseTemplateSubgroup(
                                withCourseTemplateGroup(f.suggested_rows, templCourseGroup),
                                nextSubgroup
                              );
                              if (editingTemplate?.id) {
                                void saveCourseGroupingForTemplate(
                                  editingTemplate.id,
                                  nextRows,
                                  templCourseGroup,
                                  nextSubgroup
                                );
                              }
                              return {
                                ...f,
                                suggested_rows: nextRows,
                              };
                            });
                            const titleKey = courseTemplateTitleKey(editingTemplate?.title || templForm.title);
                            if (titleKey) {
                              templateGrupCtx.setTemplateGroupingByTitle((prev) => {
                                if (!templCourseGroup) {
                                  const { [titleKey]: _, ...rest } = prev;
                                  return rest;
                                }
                                return {
                                  ...prev,
                                  [titleKey]: nextSubgroup.trim()
                                    ? { group: templCourseGroup, subgroup: nextSubgroup.trim() }
                                    : { group: templCourseGroup },
                                };
                              });
                            }
                          }}
                          placeholder="Skriv undergrupp"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    )}
                </div>
              )}
              <div className="rounded-xl shadow-sm border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Förslag på delmål</label>
                  <button type="button" onClick={()=>setTemplMilestonePickerOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                    Välj delmål
                  </button>
                </div>
                {templMilestones2015.length === 0 && templMilestones2021.length === 0 ? (
                  <p className="text-xs text-slate-400">Inga delmål valda.</p>
                ) : (
                  <div className="space-y-3">
                    {templMilestones2015.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-600 mb-1.5">Målversion 2015</div>
                        <div className="flex flex-wrap gap-1.5">
                          {sortMilestoneIds(templMilestones2015).map((m,i)=>(
                            <button
                              key={i}
                              type="button"
                              onClick={() => setTemplMilestoneDetail(m)}
                              className="inline-flex items-center rounded-full border border-slate-300 bg-white text-slate-700 text-xs px-2 py-0.5 cursor-pointer hover:bg-slate-50 transition"
                              title={`Klicka för detaljer: ${m}`}
                            >
                              {displayMilestoneCode(m, '2015')}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {templMilestones2021.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-600 mb-1.5">Målversion 2021</div>
                        <div className="flex flex-wrap gap-1.5">
                          {sortMilestoneIds(templMilestones2021).map((m,i)=>(
                            <button
                              key={i}
                              type="button"
                              onClick={() => setTemplMilestoneDetail(m)}
                              className="inline-flex items-center rounded-full border border-slate-300 bg-white text-slate-700 text-xs px-2 py-0.5 cursor-pointer hover:bg-slate-50 transition"
                              title={`Klicka för detaljer: ${m}`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {actTemplTab === 'placering' && (
                <div className="rounded-xl shadow-sm border border-slate-200 bg-white p-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Föreslagna moment</label>
                  {(() => {
                    const grouped = splitSuggestedRows(templForm.suggested_rows);
                    return (
                      <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Obligatoriska</label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={templRequiredRowInput}
                            onChange={e=>setTemplRequiredRowInput(e.target.value)}
                            onKeyDown={e=>{
                              if(e.key==='Enter'&&templRequiredRowInput.trim()){
                                const nextRequired = [...grouped.required, templRequiredRowInput.trim()];
                                setTemplForm(f=>({...f,suggested_rows:encodeSuggestedRows(nextRequired, grouped.recommended)}));
                                setTemplRequiredRowInput('');
                                e.preventDefault();
                              }
                            }}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                          <button
                            type="button"
                            onClick={()=>{
                              if(templRequiredRowInput.trim()){
                                const nextRequired = [...grouped.required, templRequiredRowInput.trim()];
                                setTemplForm(f=>({...f,suggested_rows:encodeSuggestedRows(nextRequired, grouped.recommended)}));
                                setTemplRequiredRowInput('');
                              }
                            }}
                            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Lägg till
                          </button>
                        </div>
                        {grouped.required.length > 0 ? (
                          <div className="space-y-1">
                            {grouped.required.map((r,i)=>(
                              <div key={`req-${i}`} className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1">
                                <span className="flex-1 text-slate-700">{r}</span>
                                <button type="button" onClick={()=>{
                                  const nextRequired = grouped.required.filter((_,j)=>j!==i);
                                  setTemplForm(f=>({...f,suggested_rows:encodeSuggestedRows(nextRequired, grouped.recommended)}));
                                }}
                                  className="text-slate-400 hover:text-slate-700 font-bold">×</button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">Inga obligatoriska moment tillagda.</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Rekommenderade</label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={templRecommendedRowInput}
                            onChange={e=>setTemplRecommendedRowInput(e.target.value)}
                            onKeyDown={e=>{
                              if(e.key==='Enter'&&templRecommendedRowInput.trim()){
                                const nextRecommended = [...grouped.recommended, templRecommendedRowInput.trim()];
                                setTemplForm(f=>({...f,suggested_rows:encodeSuggestedRows(grouped.required, nextRecommended)}));
                                setTemplRecommendedRowInput('');
                                e.preventDefault();
                              }
                            }}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                          <button
                            type="button"
                            onClick={()=>{
                              if(templRecommendedRowInput.trim()){
                                const nextRecommended = [...grouped.recommended, templRecommendedRowInput.trim()];
                                setTemplForm(f=>({...f,suggested_rows:encodeSuggestedRows(grouped.required, nextRecommended)}));
                                setTemplRecommendedRowInput('');
                              }
                            }}
                            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Lägg till
                          </button>
                        </div>
                        {grouped.recommended.length > 0 ? (
                          <div className="space-y-1">
                            {grouped.recommended.map((r,i)=>(
                              <div key={`rec-${i}`} className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1">
                                <span className="flex-1 text-slate-700">{r}</span>
                                <button type="button" onClick={()=>{
                                  const nextRecommended = grouped.recommended.filter((_,j)=>j!==i);
                                  setTemplForm(f=>({...f,suggested_rows:encodeSuggestedRows(grouped.required, nextRecommended)}));
                                }}
                                  className="text-slate-400 hover:text-slate-700 font-bold">×</button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">Inga rekommenderade moment tillagda.</p>
                        )}
                      </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {actTemplTab === 'annan' && (
                <div className="rounded-xl shadow-sm border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-2">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={templForm.track_completions || false}
                        onChange={(e) =>
                          setTemplForm((f) => ({ ...f, track_completions: e.target.checked }))
                        }
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600"
                      />
                      <span className="text-sm text-slate-700">
                        Redovisa utbildningsmoment samlat
                      </span>
                    </label>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        aria-expanded={trackCompletionsInfoOpen}
                        aria-label="Information om redovisning av antal genomförda moment"
                        onClick={() => setTrackCompletionsInfoOpen((v) => !v)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 bg-white text-[11px] font-serif font-bold italic leading-none text-slate-600 shadow-sm hover:border-slate-500 hover:bg-slate-50"
                      >
                        i
                      </button>
                      {trackCompletionsInfoOpen && (
                        <>
                          <button
                            type="button"
                            aria-label="Stäng information"
                            className="fixed inset-0 z-[705] cursor-default bg-transparent"
                            onClick={() => setTrackCompletionsInfoOpen(false)}
                          />
                          <div
                            role="tooltip"
                            className="absolute right-0 bottom-full z-[706] mb-2 w-[min(calc(100vw-3rem),17.5rem)] rounded-lg border border-slate-200 bg-white p-3 text-left text-xs leading-snug text-slate-700 shadow-lg"
                          >
                            <p className="font-semibold text-slate-900">Så här visas det för ST-läkaren</p>
                            <p className="mt-2">
                              När den här rutan är ikryssad räknar ST-ARK ihop alla genomförda tillfällen som
                              hör till samma utbildningsmoment. I ST-läkarens vy, under{' '}
                              <strong>Utbildningsmoment</strong>, visas då en enda rad för den typen av moment.
                            </p>
                            <p className="mt-2">
                              Antalet genomförda tillfällen redovisas med antal i stället för att varje tillfälle
                              får en egen rad. Det minskar upprepning i listan när samma aktivitet registreras
                              många gånger, till exempel upprepade praktiska moment.
                            </p>
                            <p className="mt-2 text-slate-600">
                              Om rutan inte är ikryssad visas varje registrering som en separat rad.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end bg-white">
              <button onClick={async()=>{ 
                if(!templForm.title.trim()){alert('Ange en titel.');return;}
                // Combine 2015 and 2021 milestones into one array
                const combinedMilestones = [
                  ...sortMilestoneIds(templMilestones2015),
                  ...sortMilestoneIds(templMilestones2021),
                ];
                const templateTitle = String(templForm.title || '').trim();
                const cleanedAlternatives =
                  templRequirementLevel === 'valfri'
                    ? []
                    : Array.from(
                        new Set(
                          templAlternatives
                            .map((value) => String(value || '').trim())
                            .filter(
                              (value) =>
                                value.length > 0 &&
                                normalizeAlternativeTitleKey(value) !==
                                  normalizeAlternativeTitleKey(templateTitle)
                            )
                        )
                      );
                let nextSuggestedRows = templForm.suggested_rows;
                if (actTemplTab === 'placering') {
                  nextSuggestedRows = withSuggestedPeriodMonths(
                    nextSuggestedRows,
                    templSuggestedPeriodMonths
                  );
                  nextSuggestedRows = withCourseTemplateSubgroup(
                    withCourseTemplateGroup(nextSuggestedRows, templCourseGroup),
                    templCourseSubgroup
                  );
                } else if (actTemplTab === 'kurs' || actTemplTab === 'annan') {
                  nextSuggestedRows = withCourseTemplateSubgroup(
                    withCourseTemplateGroup(nextSuggestedRows, templCourseGroup),
                    templCourseSubgroup
                  );
                }
                nextSuggestedRows = withTemplateRequirementLevel(
                  nextSuggestedRows,
                  templRequirementLevel
                );
                if (actTemplTab === 'placering') {
                  nextSuggestedRows = withTemplateAlternatives(nextSuggestedRows, cleanedAlternatives);
                } else {
                  nextSuggestedRows = stripAlternativesFromRows(nextSuggestedRows);
                }
                if (actTemplTab === 'annan') {
                  nextSuggestedRows = stripUtbildningsmomentInstanceType(nextSuggestedRows);
                }
                const templateToSave = {
                  ...templForm,
                  suggested_milestones: combinedMilestones,
                  suggested_rows: nextSuggestedRows,
                };
                const previousTitleKey = courseTemplateTitleKey(editingTemplate?.title || '');
                const nextTitleKey = courseTemplateTitleKey(templateToSave.title || '');
                const success = await saveTemplate(templateToSave,editingTemplate?.id); 
                if (success) { 
                  if (actTemplTab === 'placering') {
                    const clinicId = await getClinicIdForCurrentUserRole('studierektor');
                    if (clinicId) {
                      await synchronizePlacementAlternatives({
                        clinicId,
                        currentTemplateId: editingTemplate?.id,
                        currentTitle: templateToSave.title,
                        previousTitle: editingTemplate?.title,
                        selectedAlternativeTitles: cleanedAlternatives,
                      });
                      await loadTemplates();
                    }
                  }
                  if (actTemplTab === 'kurs' && nextTitleKey) {
                    setCourseTemplateGroupingByTitle((prev) => {
                      const nextMap = { ...prev };
                      if (previousTitleKey && previousTitleKey !== nextTitleKey) {
                        delete nextMap[previousTitleKey];
                      }
                      if (templCourseGroup) {
                        nextMap[nextTitleKey] = templCourseSubgroup
                          ? { group: templCourseGroup, subgroup: templCourseSubgroup }
                          : { group: templCourseGroup };
                      } else {
                        delete nextMap[nextTitleKey];
                      }
                      return nextMap;
                    });
                  }
                  if (actTemplTab === 'annan' && nextTitleKey) {
                    setMomentTemplateGroupingByTitle((prev) => {
                      const nextMap = { ...prev };
                      if (previousTitleKey && previousTitleKey !== nextTitleKey) {
                        delete nextMap[previousTitleKey];
                      }
                      if (templCourseGroup) {
                        nextMap[nextTitleKey] = templCourseSubgroup
                          ? { group: templCourseGroup, subgroup: templCourseSubgroup }
                          : { group: templCourseGroup };
                      } else {
                        delete nextMap[nextTitleKey];
                      }
                      return nextMap;
                    });
                  }
                  if (actTemplTab === 'placering' && nextTitleKey) {
                    setPlacementTemplateGroupingByTitle((prev) => {
                      const nextMap = { ...prev };
                      if (previousTitleKey && previousTitleKey !== nextTitleKey) {
                        delete nextMap[previousTitleKey];
                      }
                      if (templCourseGroup) {
                        nextMap[nextTitleKey] = templCourseSubgroup
                          ? { group: templCourseGroup, subgroup: templCourseSubgroup }
                          : { group: templCourseGroup };
                      } else {
                        delete nextMap[nextTitleKey];
                      }
                      return nextMap;
                    });
                  }
                  setTemplAddOpen(false); 
                  setEditingTemplate(null);
                  setTemplMilestones2015([]);
                  setTemplMilestones2021([]);
                  setTemplSuggestedPeriodMonths('');
                  setTemplCourseGroup('');
                  setTemplCourseSubgroup('');
                }
              }}
                className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                {editingTemplate?'Spara ändringar':'Lägg till'}
              </button>
            </div>
          </div>
        </div>
      )}

      {groupEditorScope && groupEditorCtx && (
        <div
          className="fixed inset-0 z-[720] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setGroupEditorScope(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-base font-bold text-slate-900">
                {groupEditorScope === 'kurs'
                  ? 'Redigera grupper – kurser'
                  : groupEditorScope === 'moment'
                    ? 'Redigera grupper – utbildningsmoment'
                    : 'Redigera grupper – kliniska tjänstgöringar'}
              </h3>
              <button
                type="button"
                onClick={() => setGroupEditorScope(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Stäng
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCourseGroupName}
                  onChange={(e) => setNewCourseGroupName(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Nytt gruppnamn"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextName = String(newCourseGroupName || '').trim();
                    if (!nextName) return;
                    groupEditorCtx.setGroups((prev) => {
                      if (prev.includes(nextName)) return prev;
                      return [...prev, nextName];
                    });
                    setNewCourseGroupName('');
                  }}
                  className="rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  Lägg till
                </button>
              </div>
              <div className="space-y-2">
                {groupEditorCtx.groups.map((g, idx) => (
                  <div key={g} className="flex items-start justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="min-w-0 flex-1 pr-2">
                      {renamingGroupKey === g ? (
                        <input
                          ref={groupRenameInputRef}
                          type="text"
                          value={renamingGroupInput}
                          onChange={(e) => setRenamingGroupInput(e.target.value)}
                          onBlur={(e) => void renameGroupInEditor(g, e.target.value)}
                          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setRenamingGroupKey(null);
                              setRenamingGroupInput('');
                            }
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void renameGroupInEditor(g, e.currentTarget.value);
                            }
                          }}
                          onClick={(ev) => ev.stopPropagation()}
                          className="w-full max-w-[14rem] rounded border border-sky-400 bg-white px-1.5 py-0.5 text-sm text-slate-900 outline-none ring-1 ring-sky-300"
                          aria-label="Gruppnamn"
                        />
                      ) : (
                        <span
                          className="block cursor-default select-none text-sm text-slate-800"
                          title="Dubbelklicka för att byta namn"
                          onDoubleClick={(ev) => {
                            ev.preventDefault();
                            setRenamingGroupKey(g);
                            setRenamingGroupInput(g);
                          }}
                        >
                          {g}
                        </span>
                      )}
                      {(() => {
                        const subs = groupEditorCtx.subgroupsByGroup[g] || [];
                        if (subs.length === 0) return null;
                        const preview = subs.slice(0, 3).join(", ");
                        const rest = subs.length > 3 ? ` +${subs.length - 3}` : "";
                        return (
                          <div className="mt-0.5 truncate text-[11px] text-slate-500" title={subs.join(", ")}>
                            {preview}
                            {rest}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSubgroupEditorGroup(g);
                          setNewSubgroupName('');
                          setRenamingSubgroupCtx(null);
                          setRenamingSubgroupInput('');
                        }}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        Undergrupper
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          groupEditorCtx.setGroups((prev) => {
                            const next = [...prev];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            return next;
                          })
                        }
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === groupEditorCtx.groups.length - 1}
                        onClick={() =>
                          groupEditorCtx.setGroups((prev) => {
                            const next = [...prev];
                            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                            return next;
                          })
                        }
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-40"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          groupEditorCtx.setGroups((prev) => {
                            const next = prev.filter((x) => x !== g);
                            groupEditorCtx.setSubgroupsByGroup((curr) => {
                              const copy = { ...curr };
                              delete copy[g];
                              return copy;
                            });
                            if (templCourseGroup === g) setTemplCourseGroup('');
                            return next;
                          })
                        }
                        className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                {groupEditorCtx.groups.length === 0 && (
                  <p className="text-xs text-slate-500">Inga grupper ännu.</p>
                )}
              </div>

              {subgroupEditorGroup && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">
                      Undergrupper: {subgroupEditorGroup}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSubgroupEditorGroup(null);
                        setRenamingSubgroupCtx(null);
                        setRenamingSubgroupInput('');
                      }}
                      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                    >
                      Stäng
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubgroupName}
                      onChange={(e) => setNewSubgroupName(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                      placeholder="Ny undergrupp"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextName = String(newSubgroupName || '').trim();
                        if (!nextName || !subgroupEditorGroup) return;
                        groupEditorCtx.setSubgroupsByGroup((prev) => {
                          const list = prev[subgroupEditorGroup] || [];
                          if (list.includes(nextName)) return prev;
                          return { ...prev, [subgroupEditorGroup]: [...list, nextName] };
                        });
                        setNewSubgroupName('');
                      }}
                      className="rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                    >
                      Lägg till
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {(groupEditorCtx.subgroupsByGroup[subgroupEditorGroup] || []).map((sg, sidx) => {
                      const subList = groupEditorCtx.subgroupsByGroup[subgroupEditorGroup] || [];
                      return (
                        <div
                          key={sg}
                          className="flex items-center justify-between gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                        >
                          {renamingSubgroupCtx &&
                          renamingSubgroupCtx.group === subgroupEditorGroup &&
                          renamingSubgroupCtx.name === sg ? (
                            <input
                              ref={subgroupRenameInputRef}
                              type="text"
                              value={renamingSubgroupInput}
                              onChange={(e) => setRenamingSubgroupInput(e.target.value)}
                              onBlur={(e) =>
                                void renameSubgroupInEditor(subgroupEditorGroup, sg, e.target.value)
                              }
                              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setRenamingSubgroupCtx(null);
                                  setRenamingSubgroupInput('');
                                }
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void renameSubgroupInEditor(
                                    subgroupEditorGroup,
                                    sg,
                                    e.currentTarget.value
                                  );
                                }
                              }}
                              onClick={(ev) => ev.stopPropagation()}
                              className="min-w-0 flex-1 rounded border border-sky-400 bg-white px-1 py-0.5 text-xs text-slate-900 outline-none ring-1 ring-sky-300"
                              aria-label="Undergruppsnamn"
                            />
                          ) : (
                            <span
                              className="min-w-0 flex-1 cursor-default select-none truncate text-slate-700"
                              title="Dubbelklicka för att byta namn"
                              onDoubleClick={(ev) => {
                                ev.preventDefault();
                                if (!subgroupEditorGroup) return;
                                setRenamingSubgroupCtx({ group: subgroupEditorGroup, name: sg });
                                setRenamingSubgroupInput(sg);
                              }}
                            >
                              {sg}
                            </span>
                          )}
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              disabled={sidx === 0}
                              onClick={() =>
                                groupEditorCtx.setSubgroupsByGroup((prev) => {
                                  const list = [...(prev[subgroupEditorGroup] || [])];
                                  if (sidx <= 0 || sidx >= list.length) return prev;
                                  [list[sidx - 1], list[sidx]] = [list[sidx], list[sidx - 1]];
                                  return { ...prev, [subgroupEditorGroup]: list };
                                })
                              }
                              className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-700 disabled:opacity-40"
                              aria-label="Flytta upp"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={sidx >= subList.length - 1}
                              onClick={() =>
                                groupEditorCtx.setSubgroupsByGroup((prev) => {
                                  const list = [...(prev[subgroupEditorGroup] || [])];
                                  if (sidx < 0 || sidx >= list.length - 1) return prev;
                                  [list[sidx + 1], list[sidx]] = [list[sidx], list[sidx + 1]];
                                  return { ...prev, [subgroupEditorGroup]: list };
                                })
                              }
                              className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-700 disabled:opacity-40"
                              aria-label="Flytta ned"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                groupEditorCtx.setSubgroupsByGroup((prev) => {
                                  const list = (prev[subgroupEditorGroup] || []).filter((x) => x !== sg);
                                  const next = { ...prev, [subgroupEditorGroup]: list };
                                  if (templCourseSubgroup === sg) setTemplCourseSubgroup('');
                                  return next;
                                })
                              }
                              className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {(groupEditorCtx.subgroupsByGroup[subgroupEditorGroup] || []).length === 0 && (
                      <p className="text-[11px] text-slate-500">Inga undergrupper ännu.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delmålsväljare för aktivitetsmallar - 2015 */}
      {templMilestonePickerOpen && templMilestonePickerTab === '2015' && srGoals2015 && (
        <DesktopMilestonePicker
          open={true}
          title="Välj delmål för mallen (2015)"
          goals={srGoals2015}
          checked={new Set(templMilestones2015)}
          onToggle={(milestoneId) => {
            setTemplMilestones2015(prev =>
              prev.includes(milestoneId) ? prev.filter(id => id !== milestoneId) : [...prev, milestoneId]
            );
          }}
          onClose={() => setTemplMilestonePickerOpen(false)}
          zIndex={9999}
        />
      )}

      {/* Delmålsväljare för aktivitetsmallar - 2021 */}
      {templMilestonePickerOpen && templMilestonePickerTab === '2021' && srGoals2021 && (
        <DesktopMilestonePicker
          open={true}
          title="Välj delmål för mallen (2021)"
          goals={srGoals2021}
          checked={new Set(templMilestones2021)}
          onToggle={(milestoneId) => {
            setTemplMilestones2021(prev =>
              prev.includes(milestoneId) ? prev.filter(id => id !== milestoneId) : [...prev, milestoneId]
            );
          }}
          onClose={() => setTemplMilestonePickerOpen(false)}
          zIndex={9999}
        />
      )}

      {/* Tab selector overlay for milestone picker */}
      {templMilestonePickerOpen && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex gap-2 bg-white rounded-lg shadow-lg border border-slate-300 p-2">
          <button
            onClick={() => setTemplMilestonePickerTab('2015')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              templMilestonePickerTab === '2015'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Målversion 2015
          </button>
          <button
            onClick={() => setTemplMilestonePickerTab('2021')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              templMilestonePickerTab === '2021'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Målversion 2021
          </button>
        </div>
      )}

      {/* Enskild delmålsdetalj-modal - exakt som PusslaDinST */}
      {templMilestoneDetail && (() => {
        // Normalisera milestone ID - samma logik som PusslaDinST
        const normalizeCode = (raw: string): string => {
          const base = String(raw ?? "").trim().split(/\s|–|-|:|\u2013/)[0];
          const up = base.toUpperCase().replace(/\s+/g, "");
          const m = up.match(/^ST([ABC])(\d+)$/) || up.match(/^([ABC])(\d+)$/) || up.match(/^ST([ABC])([A-Z])(\d+)$/);
          if (m) {
            if (m.length === 3) {
              // ST(A)1 or A1 format
              const letter = m[1].toUpperCase();
              const num = parseInt(m[2], 10) || 0;
              return `${letter}${num}`;
            } else if (m.length === 4) {
              // ST(A)(A)1 format - handle STa1
              const letter = m[2].toUpperCase();
              const num = parseInt(m[3], 10) || 0;
              return `${letter}${num}`;
            }
          }
          return up;
        };

        // Determine which goals catalog to use based on milestone format
        const normalized = templMilestoneDetail.toUpperCase().trim();
        const is2021 = normalized.startsWith('ST');
        const activeGoals = is2021 ? srGoals2021 : srGoals2015;
        
        if (!activeGoals) return null;

        const normalizedId = normalizeCode(templMilestoneDetail);
        const lookupKey = normalizeGoalCode(templMilestoneDetail);
        const m =
          (activeGoals as any)?.index?.[lookupKey] ??
          activeGoals.milestones.find((x: any) => {
            const idK = normalizeCode(x.id);
            const codeK = normalizeCode(x.code || "");
            return idK === normalizedId || codeK === normalizedId;
          });

        if (!m) return null;

        const toText = (v: unknown) =>
          typeof v === "string"
            ? v
            : v == null
            ? ""
            : Array.isArray(v)
            ? v.join("\n")
            : String(v);

        const sections = [
          { key: "kompetenskrav", title: "Kompetenskrav", text: toText(m.sections?.kompetenskrav) },
          { key: "utbildningsaktiviteter", title: "Utbildningsaktiviteter", text: toText(m.sections?.utbildningsaktiviteter) },
          { key: "intyg", title: "Intyg", text: toText(m.sections?.intyg) },
          { key: "allmannaRad", title: "Allmänna råd", text: toText(m.sections?.allmannaRad) },
        ] as const;

        const visible = sections.filter(s => s.text.trim().length > 0);
        const titleCode = String(m.code || m.id || "").toUpperCase();

        return (
          <div
            className="fixed inset-0 z-[10000] grid place-items-center bg-black/40 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setTemplMilestoneDetail(null);
            }}
          >
            <div
              className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 gap-4">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 shrink-0">
                    {displayMilestoneCode(titleCode, is2021 ? '2021' : '2015')}
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
                    {m.title}
                  </h3>
                </div>
                <button onClick={() => setTemplMilestoneDetail(null)} className="text-slate-400 hover:text-slate-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                {visible.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                    Ingen beskrivning hittades i målfilen.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {visible.map((s) => (
                      <article key={s.key} className="border border-slate-200 rounded-xl p-3 bg-white">
                        <div className="font-bold mb-1.5 text-slate-900">{s.title}</div>
                        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-900 leading-relaxed">
                          {s.text}
                        </pre>
                      </article>
                    ))}
                  </div>
                )}

                {m.sourceUrl && (
                  <div className="text-xs mt-3 text-slate-600">
                    Källa:{" "}
                    <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                      målbeskrivningen
                    </a>
                  </div>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => setTemplMilestoneDetail(null)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
                >
                  Stäng
                </button>
              </footer>
            </div>
          </div>
        );
      })()}

      {/* Arkiv-modal för lästa/hanterade meddelanden och förslag */}
      {archiveOpen && (
        <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-4" onClick={() => setArchiveOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="border-b border-black px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Lästa och hanterade meddelanden</h2>
              <button
                type="button"
                onClick={() => setArchiveOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Stäng
              </button>
            </div>
            
            <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
              <label className="block text-sm font-medium text-slate-700 mb-1">Filtrera på ST-läkare</label>
              <select value={archiveFilter} onChange={e => setArchiveFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">Alla ST-läkare</option>
                {stLakare.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.profile.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {archiveLoading ? (
                <p className="text-sm text-slate-500">Laddar...</p>
              ) : archiveItems.filter(item => !archiveFilter || item.recipientId === archiveFilter).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Inga lästa/hanterade meddelanden eller förslag.</p>
              ) : (
                <div className="space-y-2">
                  {archiveItems.filter(item => !archiveFilter || item.recipientId === archiveFilter).map((item) => {
                    const typeLabel: Record<string, string> = {
                      placement: 'Placering', course: 'Kurs',
                      sr_meeting: 'Studierektorsmöte', progression_assessment: 'Progressionsbedömning',
                      kurs: 'Kurs', konferens: 'Konferens', annan: 'Annan aktivitet',
                    };
                    const statusLabel: Record<string, string> = {
                      read: 'Läst', accepted: 'Accepterat', rejected: 'Avvisat',
                    };
                    return (
                      <div key={item.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <span className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${item.kind === 'message' ? 'bg-slate-400' : item.status === 'accepted' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {item.kind === 'message' ? 'Meddelande' : `Förslag: ${typeLabel[item.activityType || ''] || item.activityType}`}
                            {' '}→ <span className="text-slate-600">{item.recipientName}</span>
                          </p>
                          <p className="text-xs text-slate-500 truncate">{item.summary}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            item.status === 'read' ? 'bg-slate-100 text-slate-600' : 
                            item.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>{statusLabel[item.status] || item.status}</span>
                          <p className="text-xs text-slate-400 mt-0.5">{new Date(item.date).toLocaleDateString('sv-SE')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ProfileContactDetailModal
        open={!!hhDetailOpen}
        onClose={() => setHhDetailOpen(null)}
        loading={hhDetailLoading}
        profile={hhDetailProfile}
        nameFallback={hhDetailOpen?.name}
      />

      <DeleteConfirmDialog
        open={!!deleteConfirmConfig}
        title={deleteConfirmConfig?.title || 'Ta bort'}
        message={deleteConfirmConfig?.message || 'Är du säker på att du vill ta bort detta?'}
        confirmLabel={deleteConfirmConfig?.confirmLabel || 'Ta bort'}
        onCancel={() => setDeleteConfirmConfig(null)}
        onConfirm={() => {
          void deleteConfirmConfig?.onConfirm();
        }}
      />
    </div>
  );
}

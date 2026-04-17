"use client";

import { useCallback } from "react";
import { getTemplateSuggestedPeriodMonths } from "@/lib/pussla/templateDateHelpers";

export function useAgentPlanningSummaryActions(params: {
  persistProfilePatch: any;
  setProfileOpen: any;
  normalizeGoalsVersion: any;
  profile: any;
  btEndISO: string | null;
  isValidISO: any;
  srPlacementTemplates: any[];
  srCourseTemplates: any[];
  srUtbildningsmomentTemplates: any[];
  activities: any[];
  getPlacementEndISOForAgent: any;
  stStartISO: string | null;
  todayISO: () => string;
  stEndISO: string | null;
  totalPlanMonths: number;
  createPlacementFromDateRange: any;
  createCourseFromDateRange: any;
  resolveSupabaseUserId: any;
  supabase: any;
  IUP_SETTINGS_COLUMNS: string;
  uid: () => string;
  upsertIupSettingsOnUserId: any;
  setSupervisionSessions: any;
  setAssessmentSessions: any;
  setActiveLane: any;
  setCourses: any;
  setDirty: any;
  usesMetisCourses: any;
  goalsCatalog: any;
  COMMON_AB_MILESTONES: any;
  milestoneRequires: any;
  courses: any[];
  mapMetisGoalsToMilestoneIds: any;
  getMetisCourseGoals: any;
  getMetisCoursesForSpecialty: any;
  sanitizeStMilestonesForGoals: any;
  displayMilestoneCode: any;
  redactContactInfoText: any;
  iupOpen: boolean;
  iupInitialTab: string | null;
  hemklinikOpen: boolean;
  hemklinikColleagues: any[];
  hemklinikSuggestions: any[];
  forslagPopupFor: string | null;
  forslagTab: string | null;
  scanOpen: boolean;
  btModalOpen: boolean;
  prepareOpen: boolean;
  reportOpen: boolean;
  previewOpen: boolean;
  milestoneOverviewOpen: boolean;
  colleaguePlacementDescriptions: any[];
  colleagueCourseDescriptions: any[];
  selectedColleague: any;
  hemklinikMessages: any[];
  hemklinikSentMessages: any[];
  colleagueData: any;
}) {
  const addMonthsISOForAgent = useCallback((iso: string, months: number): string => {
    const d = new Date(`${iso}T12:00:00`);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  }, []);

  const addDaysISOForAgent = useCallback((iso: string, days: number): string => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }, []);

  const inferPhaseFromDateForAgent = useCallback(
    (iso: string): "BT" | "ST" => {
      const goalsVersion = params.normalizeGoalsVersion((params.profile as any)?.goalsVersion);
      const btStart = String((params.profile as any)?.btStartDate || "");
      const btEnd = String((params.profile as any)?.btEndDate || params.btEndISO || "");
      if (goalsVersion === "2021" && params.isValidISO(btStart) && params.isValidISO(btEnd) && params.isValidISO(iso)) {
        if (iso >= btStart && iso < btEnd) return "BT";
      }
      return "ST";
    },
    [params]
  );

  const setAllProfilePhoneNumbersForAgent = useCallback(
    async (phoneNumber: string): Promise<{ ok: boolean; message: string }> => {
      const normalized = String(phoneNumber || "").trim();
      if (!normalized) return { ok: false, message: "Ange ett telefonnummer." };
      await params.persistProfilePatch({ mobile: normalized, phoneHome: normalized, phoneWork: normalized });
      params.setProfileOpen(true);
      return { ok: true, message: `Klart. Jag fyllde i ${normalized} i alla telefonnummer i profilen.` };
    },
    [params]
  );

  const planStFromSrTemplatesForAgent = useCallback(
    async (options: {
      includePlacements?: boolean;
      includeCourses?: boolean;
      includeUtbildningsmoment?: boolean;
      monthlySupervision?: number;
      assessmentsPerTerm?: number;
    }): Promise<{ ok: boolean; message: string }> => {
      const includePlacements = options.includePlacements !== false;
      const includeCourses = options.includeCourses !== false;
      const includeUtbildningsmoment = options.includeUtbildningsmoment !== false;
      const monthlySupervision = Math.max(1, Math.min(8, Number(options.monthlySupervision || 1)));
      const assessmentsPerTerm = Math.max(1, Math.min(8, Number(options.assessmentsPerTerm || 2)));
      const placementTemplates = includePlacements
        ? (() => {
            const byTitle = new Map<string, { title: string; suggestedMonths: number | null }>();
            for (const t of params.srPlacementTemplates) {
              const title = String(t.title || "").trim();
              if (!title || byTitle.has(title)) continue;
              byTitle.set(title, {
                title,
                suggestedMonths: getTemplateSuggestedPeriodMonths(Array.isArray(t.suggested_rows) ? t.suggested_rows : []),
              });
            }
            return [...byTitle.values()];
          })()
        : [];
      const courseTemplates = [
        ...(includeCourses
          ? params.srCourseTemplates.map((t) => ({ title: String(t.title || "").trim(), kind: "Kurs" }))
          : []),
        ...(includeUtbildningsmoment
          ? params.srUtbildningsmomentTemplates.map((t) => ({ title: String(t.title || "").trim(), kind: "Utbildningsmoment" }))
          : []),
      ].filter((t) => t.title);
      if (placementTemplates.length === 0 && courseTemplates.length === 0) {
        return {
          ok: false,
          message: "Hittade inga aktiva mallar från studierektor (placeringar/kurser/utbildningsmoment).",
        };
      }
      const latestPlacementEnd = [...params.activities]
        .map((a) => params.getPlacementEndISOForAgent(a))
        .filter((iso) => params.isValidISO(iso))
        .sort()
        .slice(-1)[0];
      const fallbackStart = params.isValidISO(String(params.stStartISO || "")) ? String(params.stStartISO) : params.todayISO();
      const usePlacementAnchoredStart = includePlacements && placementTemplates.length > 0 && Boolean(latestPlacementEnd);
      const planStart = usePlacementAnchoredStart ? addDaysISOForAgent(String(latestPlacementEnd), 1) : fallbackStart;
      const planEnd = params.isValidISO(String(params.stEndISO || ""))
        ? String(params.stEndISO)
        : addMonthsISOForAgent(planStart, Math.max(12, Number(params.totalPlanMonths || 60)));
      if (!params.isValidISO(planStart) || !params.isValidISO(planEnd) || planEnd <= planStart) {
        return { ok: false, message: "Kunde inte beräkna giltigt planeringsintervall för ST." };
      }

      const totalMonths = Math.max(
        1,
        (new Date(`${planEnd}T00:00:00`).getFullYear() - new Date(`${planStart}T00:00:00`).getFullYear()) * 12 +
          (new Date(`${planEnd}T00:00:00`).getMonth() - new Date(`${planStart}T00:00:00`).getMonth()) +
          1
      );
      let createdPlacements = 0;
      let createdCourses = 0;
      const issues: string[] = [];

      if (placementTemplates.length > 0) {
        const segmentMonths = Math.max(1, Math.floor(totalMonths / placementTemplates.length));
        let cursor = planStart;
        for (let i = 0; i < placementTemplates.length; i += 1) {
          const isLast = i === placementTemplates.length - 1;
          const tpl = placementTemplates[i];
          const suggestedMonths = Number(tpl.suggestedMonths || 0);
          const monthsToUse =
            Number.isFinite(suggestedMonths) && suggestedMonths > 0
              ? Math.max(1, Math.round(suggestedMonths))
              : segmentMonths;
          const rawEnd = addDaysISOForAgent(addMonthsISOForAgent(cursor, monthsToUse), -1);
          const segmentEnd = isLast ? (rawEnd > planEnd ? planEnd : rawEnd) : (rawEnd > planEnd ? planEnd : rawEnd);
          if (segmentEnd < cursor) break;
          const res = await params.createPlacementFromDateRange(tpl.title, cursor, segmentEnd, "Klinisk tjänstgöring");
          if (res.ok) createdPlacements += 1;
          else issues.push(`Placering "${tpl.title}": ${res.message}`);
          cursor = addDaysISOForAgent(segmentEnd, 1);
          if (cursor > planEnd) break;
        }
      }

      if (courseTemplates.length > 0) {
        const stepMonths = Math.max(1, Math.floor(totalMonths / (courseTemplates.length + 1)));
        for (let i = 0; i < courseTemplates.length; i += 1) {
          const start = addMonthsISOForAgent(planStart, stepMonths * (i + 1));
          if (start >= planEnd) break;
          const end = addDaysISOForAgent(start, 4);
          const finalEnd = end > planEnd ? planEnd : end;
          const tpl = courseTemplates[i];
          const res = await params.createCourseFromDateRange(tpl.title, start, finalEnd, tpl.kind);
          if (res.ok) createdCourses += 1;
          else issues.push(`${tpl.kind} "${tpl.title}": ${res.message}`);
        }
      }

      const monthAnchors: string[] = [];
      const cur = new Date(`${planStart}T12:00:00`);
      cur.setDate(1);
      const end = new Date(`${planEnd}T12:00:00`);
      while (cur <= end) {
        monthAnchors.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
        cur.setMonth(cur.getMonth() + 1);
      }

      const generatedMeetingDates: string[] = [];
      for (const ym of monthAnchors) {
        const [y, m] = ym.split("-").map(Number);
        for (let i = 0; i < monthlySupervision; i += 1) {
          const day = 8 + i * Math.max(7, Math.floor(20 / monthlySupervision));
          const iso = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(28, day)).padStart(2, "0")}`;
          if (iso >= planStart && iso <= planEnd) generatedMeetingDates.push(iso);
        }
      }

      const generatedAssessmentDates: string[] = [];
      {
        const c = new Date(`${planStart}T12:00:00`);
        c.setDate(1);
        while (c <= new Date(`${planEnd}T12:00:00`)) {
          const termStartMonth = c.getMonth();
          const y = c.getFullYear();
          for (let i = 0; i < assessmentsPerTerm; i += 1) {
            const monthOffset = Math.floor(((i + 1) * 6) / (assessmentsPerTerm + 1));
            const d = new Date(Date.UTC(y, termStartMonth + monthOffset, 12));
            const iso = d.toISOString().slice(0, 10);
            if (iso >= planStart && iso <= planEnd) generatedAssessmentDates.push(iso);
          }
          c.setMonth(c.getMonth() + 6);
        }
      }

      try {
        const userId = await params.resolveSupabaseUserId(params.supabase as any);
        if (userId) {
          const { data: existing } = await params.supabase
            .from("iup_settings")
            .select(params.IUP_SETTINGS_COLUMNS)
            .eq("user_id", userId)
            .maybeSingle();
          const existingMeetings = Array.isArray(existing?.meetings) ? existing.meetings : [];
          const existingAssessments = Array.isArray(existing?.assessments) ? existing.assessments : [];
          const meetingKey = (m: any) => `${String(m?.dateISO || "").slice(0, 10)}|${String(m?.focus || "").trim().toLowerCase()}`;
          const assessmentKey = (a: any) => `${String(a?.dateISO || "").slice(0, 10)}|${String(a?.instrument || "").trim().toLowerCase()}`;
          const mergedMeetings = [...existingMeetings];
          const seenMeeting = new Set(mergedMeetings.map(meetingKey));
          generatedMeetingDates.forEach((dateISO) => {
            const entry = { id: params.uid(), dateISO, focus: "Handledarträff", summary: "", actions: "" };
            const key = meetingKey(entry);
            if (!seenMeeting.has(key)) {
              seenMeeting.add(key);
              mergedMeetings.push(entry);
            }
          });
          const mergedAssessments = [...existingAssessments];
          const seenAssessments = new Set(mergedAssessments.map(assessmentKey));
          generatedAssessmentDates.forEach((dateISO) => {
            const entry = {
              id: params.uid(),
              dateISO,
              phase: inferPhaseFromDateForAgent(dateISO),
              level: "",
              instrument: "Progressionsbedömning",
              summary: "",
              strengths: "",
              development: "",
            };
            const key = assessmentKey(entry);
            if (!seenAssessments.has(key)) {
              seenAssessments.add(key);
              mergedAssessments.push(entry);
            }
          });
          await params.upsertIupSettingsOnUserId({
            user_id: userId,
            meetings: mergedMeetings,
            assessments: mergedAssessments,
            director_meetings: existing?.director_meetings || [],
            specialist_collegiums: (existing as any)?.specialist_collegiums || [],
            planning: existing?.planning || null,
            planning_extra: existing?.planning_extra || [],
            instruments: existing?.instruments || [],
            planning_hidden: existing?.planning_hidden || [],
            show_meetings_on_timeline: existing?.show_meetings_on_timeline ?? true,
            show_assessments_on_timeline: existing?.show_assessments_on_timeline ?? true,
            show_director_meetings_on_timeline: existing?.show_director_meetings_on_timeline ?? true,
            show_specialist_collegiums_on_timeline: existing?.show_specialist_collegiums_on_timeline ?? true,
            updated_at: new Date().toISOString(),
          });
          params.setSupervisionSessions(
            mergedMeetings.filter((m: any) => m && m.id && m.dateISO).map((m: any) => ({ id: String(m.id), dateISO: String(m.dateISO), title: String(m.focus || "") }))
          );
          params.setAssessmentSessions(
            mergedAssessments.filter((a: any) => a && a.id && a.dateISO).map((a: any) => ({ id: String(a.id), dateISO: String(a.dateISO), title: String(a.level || a.instrument || "") }))
          );
        }
      } catch (e) {
        issues.push(`IUP-upplägg kunde inte sparas: ${String((e as any)?.message || e)}`);
      }

      params.setActiveLane("placement");
      const parts = [
        `Planering klar i intervallet ${planStart} till ${planEnd}.`,
        `Skapade ${createdPlacements} placeringar från studierektors mallar.`,
        `Skapade ${createdCourses} kurser/utbildningsmoment från mallar.`,
        `Lade in handledarträffar (${monthlySupervision}/månad) och ${assessmentsPerTerm} progressionsbedömningar per termin i IUP.`,
      ];
      if (issues.length > 0) parts.push(`Vissa steg behövde hoppas över:\n- ${issues.slice(0, 5).join("\n- ")}`);
      return { ok: true, message: parts.join("\n") };
    },
    [params, addDaysISOForAgent, addMonthsISOForAgent, inferPhaseFromDateForAgent]
  );

  const planCoursesCoverCourseMilestonesForAgent = useCallback(
    async (options?: { targetCount?: number }): Promise<{ ok: boolean; message: string }> => {
      const targetCount = Math.max(1, Math.min(40, Number(options?.targetCount ?? 10)));
      const specialty = (params.profile as any)?.specialty || (params.profile as any)?.speciality;
      if (!params.usesMetisCourses(specialty)) {
        return {
          ok: false,
          message: "Smart täckning mot kursdelmål finns för METIS-psykiatri. Välj psykiatrispecialitet i profilen, eller be om planering från studierektorsmallar (plan_st_from_sr_templates).",
        };
      }
      if (!params.goalsCatalog || !Array.isArray((params.goalsCatalog as any).milestones)) {
        return { ok: false, message: "Saknar laddad delmålskatalog. Kontrollera specialitet och målversion i profilen och ladda om sidan." };
      }
      const gv = params.normalizeGoalsVersion((params.profile as any)?.goalsVersion);
      const is2021 = gv === "2021";
      const normalizeStIdLocal = (x: unknown): string | null => {
        const s = String(x ?? "").trim();
        if (!s) return null;
        return s.toUpperCase().replace(/\s+/g, "");
      };
      const hasAnyAlias = (set: Set<string>, code: string): boolean => {
        if (set.has(code)) return true;
        const m1 = code.match(/^ST([ABC])(\d+)$/i);
        if (m1 && set.has(`${m1[1].toUpperCase()}${m1[2]}`)) return true;
        const m2 = code.match(/^([ABC])(\d+)$/i);
        if (m2 && set.has(`ST${m2[1].toUpperCase()}${m2[2]}`)) return true;
        return false;
      };
      const allMilestones = (params.goalsCatalog as any).milestones as any[];
      const stMilestonesForCount: any[] = allMilestones.filter((m: any) => {
        const code = normalizeStIdLocal((m as any).code ?? (m as any).id ?? "");
        if (!code) return false;
        return /^ST[ABC]\d+$/i.test(code) || /^[ABC]\d+$/i.test(code);
      });
      const existingKeys = new Set(stMilestonesForCount.map((m: any) => normalizeStIdLocal((m as any).code ?? (m as any).id ?? "")).filter(Boolean) as string[]);
      for (const cm of Object.values(params.COMMON_AB_MILESTONES) as any[]) {
        const code = normalizeStIdLocal((cm as any).code ?? (cm as any).id ?? "");
        if (!code) continue;
        const okAb = is2021 ? /^ST[AB]\d+$/i.test(code) : /^[AB]\d+$/i.test(code);
        if (!okAb) continue;
        if (!existingKeys.has(code)) {
          existingKeys.add(code);
          stMilestonesForCount.push(cm);
        }
      }
      const requiredKursCodes: string[] = [];
      for (const m of stMilestonesForCount) {
        const code = normalizeStIdLocal((m as any).code ?? (m as any).id ?? "");
        if (!code) continue;
        const req = params.milestoneRequires(m);
        if (!req.kurs) continue;
        requiredKursCodes.push(code);
      }
      const uniqueRequiredKurs = [...new Set(requiredKursCodes)];
      if (uniqueRequiredKurs.length === 0) {
        return { ok: false, message: "Hittade inga delmål i katalogen som uttryckligen kräver kurs — kan inte planera automatiskt." };
      }
      const covered = new Set<string>();
      for (const c of params.courses) {
        for (const id of params.mapMetisGoalsToMilestoneIds(String(c.title || ""), params.profile)) {
          const n = normalizeStIdLocal(id);
          if (n) covered.add(n);
        }
        for (const v of (c.milestones || []) as unknown[]) {
          const n = normalizeStIdLocal(v);
          if (n) covered.add(n);
        }
      }
      let uncovered = uniqueRequiredKurs.filter((code) => !hasAnyAlias(covered, code));
      if (uncovered.length === 0) {
        return { ok: true, message: "Alla kursrelaterade delmål i katalogen verkar redan täckas av befintliga kurser på tidslinjen. Inget nytt lades till." };
      }
      const goalsMap = params.getMetisCourseGoals(specialty);
      const candidateTitles = params.getMetisCoursesForSpecialty(specialty).filter((t: string) => goalsMap[t]?.length);
      const selected: string[] = [];
      while (uncovered.length > 0 && selected.length < targetCount) {
        let bestTitle: string | null = null;
        let bestGain = 0;
        for (const title of candidateTitles) {
          if (selected.includes(title)) continue;
          const provides = params.mapMetisGoalsToMilestoneIds(title, params.profile).map((x: any) => normalizeStIdLocal(x)).filter(Boolean) as string[];
          const provSet = new Set(provides);
          let gain = 0;
          for (const u of uncovered) if (hasAnyAlias(provSet, u)) gain += 1;
          if (gain > bestGain) {
            bestGain = gain;
            bestTitle = title;
          }
        }
        if (!bestTitle || bestGain === 0) break;
        selected.push(bestTitle);
        const provSet = new Set(
          params.mapMetisGoalsToMilestoneIds(bestTitle, params.profile).map((x: any) => normalizeStIdLocal(x)).filter(Boolean) as string[]
        );
        uncovered = uncovered.filter((u) => !hasAnyAlias(provSet, u));
      }
      if (selected.length === 0) {
        return { ok: false, message: "Kunde inte matcha återstående kursdelmål mot METIS-kurslistan. Kontrollera specialitet och målversion." };
      }
      const padPool = candidateTitles.filter((t: string) => !selected.includes(t));
      while (selected.length < targetCount && padPool.length > 0) selected.push(padPool.shift()!);
      const fallbackStart = params.isValidISO(String(params.stStartISO || "")) ? String(params.stStartISO) : params.todayISO();
      const planEnd = params.isValidISO(String(params.stEndISO || ""))
        ? String(params.stEndISO)
        : addMonthsISOForAgent(fallbackStart, Math.max(12, Number(params.totalPlanMonths || 60)));
      const planStart = fallbackStart;
      if (!params.isValidISO(planStart) || !params.isValidISO(planEnd) || planEnd <= planStart) {
        return { ok: false, message: "Saknar giltigt ST-intervall. Ange ST-start och ST-slut i profilen." };
      }
      const totalMonths = Math.max(
        1,
        (new Date(`${planEnd}T00:00:00`).getFullYear() - new Date(`${planStart}T00:00:00`).getFullYear()) * 12 +
          (new Date(`${planEnd}T00:00:00`).getMonth() - new Date(`${planStart}T00:00:00`).getMonth()) +
          1
      );
      let created = 0;
      const issues: string[] = [];
      const nSel = selected.length;
      if (nSel > 0) {
        const stepMonths = Math.max(1, Math.floor(totalMonths / (nSel + 1)));
        for (let i = 0; i < nSel; i += 1) {
          const start = addMonthsISOForAgent(planStart, stepMonths * (i + 1));
          if (start >= planEnd) break;
          const end = addDaysISOForAgent(start, 4);
          const finalEnd = end > planEnd ? planEnd : end;
          const res = await params.createCourseFromDateRange(selected[i], start, finalEnd, "Kurs");
          if (res.ok) created += 1;
          else issues.push(`${selected[i]}: ${res.message}`);
        }
      }
      const stillUncovered = uncovered.length;
      const parts = [
        `Lade in ${created} av ${nSel} METIS-kurser jämnt i intervallet ${planStart}–${planEnd}.`,
        `Val: ${selected.join(", ")}`,
        stillUncovered > 0
          ? `Obs: ${stillUncovered} kursdelmål i katalogen täcks inte av denna uppsättning enligt METIS-matrisen — komplettera vid behov.`
          : "Enligt METIS-matrisen täcker valda kurser de kurskrävande delmål som hittades i katalogen.",
      ];
      if (issues.length > 0) parts.push(`Kunde inte skapa vissa kurser: ${issues.slice(0, 4).join("; ")}`);
      params.setActiveLane("course");
      return { ok: true, message: parts.join("\n") };
    },
    [params, addMonthsISOForAgent, addDaysISOForAgent]
  );

  const syncCoursesMilestonesForAgent = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const gvRaw = (params.profile as any)?.goalsVersion;
    if (!Array.isArray(params.courses) || params.courses.length === 0) return { ok: false, message: "Inga kurser finns att synka." };
    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    const nextCourses = params.courses.map((c) => {
      if (c.kind !== "Kurs") {
        skipped += 1;
        return c;
      }
      const current: string[] = Array.isArray(c.milestones) ? c.milestones : [];
      let computed: string[] = [];
      const computedFromMetis = params.mapMetisGoalsToMilestoneIds(String(c.title || ""), params.profile);
      if (computedFromMetis.length > 0) computed = computedFromMetis;
      else {
        const tmpl = params.srCourseTemplates.find((t) => t.title === c.title);
        if (tmpl?.suggested_milestones && Array.isArray(tmpl.suggested_milestones)) computed = tmpl.suggested_milestones;
      }
      if (!computed || computed.length === 0) {
        skipped += 1;
        return c;
      }
      const sanitized = params.sanitizeStMilestonesForGoals(computed, gvRaw);
      const same = current.length === sanitized.length && current.every((v, i) => String(v) === String(sanitized[i]));
      if (same) {
        unchanged += 1;
        return c;
      }
      updated += 1;
      return { ...c, milestones: sanitized };
    });
    if (updated === 0) {
      return { ok: true, message: `Inga kurser behövde uppdateras (oförändrade: ${unchanged}, matchade ej/ej Kurs: ${skipped}).` };
    }
    params.setCourses(nextCourses);
    params.setDirty(true);
    params.setActiveLane("course");
    return { ok: true, message: `Synkade delmål på ${updated} kurser (oförändrade: ${unchanged}, matchade ej/ej Kurs: ${skipped}).` };
  }, [params]);

  const summarizeGoalCatalogForAgent = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!params.goalsCatalog || !Array.isArray((params.goalsCatalog as any).milestones)) {
      return { ok: false, message: "Saknar laddad delmålskatalog i appen. Kontrollera specialitet/målversion i profilen och ladda om sidan." };
    }
    const goalsVersion = params.normalizeGoalsVersion((params.profile as any)?.goalsVersion);
    const is2021 = goalsVersion === "2021";
    const normalizeCode = (x: unknown): string => String(x ?? "").trim().toUpperCase().replace(/\s+/g, "");
    const toText = (v: unknown): string =>
      typeof v === "string" ? v : v == null ? "" : Array.isArray(v) ? v.map((x) => String(x ?? "")).join("\n") : String(v);
    const allMilestones = [...((params.goalsCatalog as any).milestones as any[])];
    const seenCodes = new Set(allMilestones.map((m: any) => normalizeCode((m as any)?.code ?? (m as any)?.id ?? "")).filter(Boolean));
    for (const cm of Object.values(params.COMMON_AB_MILESTONES) as any[]) {
      const code = normalizeCode((cm as any)?.code ?? (cm as any)?.id ?? "");
      if (!code) continue;
      const includeAb = is2021 ? /^ST[AB]\d+$/i.test(code) : /^[AB]\d+$/i.test(code);
      if (!includeAb) continue;
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        allMilestones.push(cm);
      }
    }
    const stMilestones = allMilestones
      .filter((m: any) => {
        const code = normalizeCode((m as any)?.code ?? (m as any)?.id ?? "");
        if (!code) return false;
        return /^ST[ABC]\d+$/i.test(code) || /^[ABC]\d+$/i.test(code);
      })
      .sort((a: any, b: any) =>
        String((a as any)?.code ?? (a as any)?.id ?? "").localeCompare(String((b as any)?.code ?? (b as any)?.id ?? ""), "sv", {
          numeric: true,
          sensitivity: "base",
        })
      );
    if (stMilestones.length === 0) return { ok: false, message: "Hittade inga ST-delmål i den laddade katalogen." };
    const blocks: string[] = [];
    for (const m of stMilestones) {
      const codeRaw = String((m as any)?.code ?? (m as any)?.id ?? "").trim();
      const code = params.displayMilestoneCode(codeRaw, (params.profile as any)?.goalsVersion);
      const title = String((m as any)?.title ?? "").trim() || "Delmål";
      const description = String((m as any)?.description ?? "").trim();
      const sectionArray = Array.isArray((m as any)?.sections) ? ((m as any).sections as Array<{ title?: string; items?: unknown[]; text?: unknown }>) : [];
      const sectionsObj = (m as any)?.sections && !Array.isArray((m as any)?.sections) && typeof (m as any)?.sections === "object"
        ? ((m as any).sections as Record<string, unknown>)
        : null;
      const sectionParts: string[] = [];
      if (sectionArray.length > 0) {
        sectionArray.forEach((sec) => {
          const secTitle = String(sec?.title ?? "").trim();
          const items = Array.isArray(sec?.items) ? sec.items.map((x) => String(x ?? "").trim()).filter(Boolean).join("; ") : "";
          const text = toText(sec?.text).trim();
          const body = [items, text].filter(Boolean).join(" ");
          if (!body) return;
          sectionParts.push(`${secTitle || "Sektion"}: ${body}`);
        });
      } else if (sectionsObj) {
        const legacy = [
          ["Kompetenskrav", toText(sectionsObj.kompetenskrav).trim()],
          ["Utbildningsaktiviteter", toText(sectionsObj.utbildningsaktiviteter).trim()],
          ["Intyg", toText(sectionsObj.intyg).trim()],
          ["Allmänna råd", toText((sectionsObj as any).allmannaRad).trim()],
        ] as const;
        for (const [label, text] of legacy) if (text) sectionParts.push(`${label}: ${text}`);
      }
      const req = params.milestoneRequires(m);
      const reqSummary = `Krav: klin=${req.klin ? "ja" : "nej"}, kurs=${req.kurs ? "ja" : "nej"}, arb=${req.arb ? "ja" : "nej"}`;
      const sourceUrl = String((m as any)?.sourceUrl ?? "").trim();
      blocks.push(
        [
          `## ${code} ${title}`.trim(),
          description ? `Beskrivning: ${description}` : null,
          reqSummary,
          sectionParts.length > 0 ? sectionParts.join("\n") : "Infosida: saknar sektionstext i katalogen.",
          sourceUrl ? `Källa: ${sourceUrl}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
    const header = `Gick igenom ${stMilestones.length} delmål från appens katalog (målversion ${goalsVersion}).`;
    const maxChars = 60_000;
    let body = `${header}\n\n${blocks.join("\n\n---\n\n")}`;
    if (body.length > maxChars) {
      body = body.slice(0, maxChars) + "\n\n[Texten kapades av längdbegränsning. Be om specifikt delmål eller ett mindre urval.]";
    }
    return { ok: true, message: body };
  }, [params]);

  const summarizeAppSectionsForAgent = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const sections = [
      `Tidslinje placeringar: ${params.activities.length}`,
      `Tidslinje kurser/utbildningsmoment: ${params.courses.length}`,
      `IUP: ${params.iupOpen ? "öppen" : "stängd"} (flik: ${params.iupInitialTab || "handledning"})`,
      `Hemklinik: ${params.hemklinikOpen ? "öppen" : "stängd"} (kollegor: ${params.hemklinikColleagues.length}, förslag: ${params.hemklinikSuggestions.length})`,
      `Förslag-popup: ${params.forslagPopupFor || "ingen"} (${params.forslagTab})`,
      `Skanna intyg: ${params.scanOpen ? "öppen" : "stängd"}`,
      `BT-intyg: ${params.btModalOpen ? "öppen" : "stängd"}`,
      `Specialistansökan: ${params.prepareOpen ? "öppen" : "stängd"}`,
      `Rapport: ${params.reportOpen ? "öppen" : "stängd"}`,
      `Förhandsvisning: ${params.previewOpen ? "öppen" : "stängd"}`,
      `Delmålsöversikt: ${params.milestoneOverviewOpen ? "öppen" : "stängd"}`,
      `SR-mallar: placering=${params.srPlacementTemplates.length}, kurs=${params.srCourseTemplates.length}, utbildningsmoment=${params.srUtbildningsmomentTemplates.length}`,
      `Kollegbeskrivningar: placering=${params.colleaguePlacementDescriptions.length}, kurs=${params.colleagueCourseDescriptions.length}`,
      `Målkatalog laddad: ${Array.isArray((params.goalsCatalog as any)?.milestones) ? "ja" : "nej"}`,
    ];
    const body = ["Omfattande appgenomgång (behörighetsstyrd, utan kontaktuppgifter):", ...sections.map((s, i) => `${i + 1}. ${s}`)].join("\n");
    return { ok: true, message: params.redactContactInfoText(body, { redactAddressLikeLines: true }) };
  }, [params]);

  const summarizeRoleViewsForAgent = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const role = String((params.profile as any)?.role || "okänd");
    const roleCounts = params.hemklinikColleagues.reduce(
      (acc, row) => {
        const r = String((row as any)?.role || "").trim();
        if (r === "st_lakare") acc.st += 1;
        else if (r === "huvudhandledare") acc.hh += 1;
        else if (r === "studierektor") acc.sr += 1;
        return acc;
      },
      { st: 0, hh: 0, sr: 0 }
    );
    const selectedColleagueRole = params.selectedColleague ? String(params.selectedColleague.role || "okänd") : "ingen";
    const roleSummary = [
      `Aktiv inloggningsroll: ${role}`,
      `Klinikmedlemmar i laddad hemklinik-data: ST-läkare=${roleCounts.st}, huvudhandledare=${roleCounts.hh}, studierektor=${roleCounts.sr}`,
      `Vald kollega i jämförelsevyn: ${params.selectedColleague ? params.selectedColleague.name : "ingen"} (${selectedColleagueRole})`,
      `Inkomna SR-meddelanden: ${params.hemklinikMessages.length}`,
      `Skickade meddelanden: ${params.hemklinikSentMessages.length}`,
      `Aktivitetsförslag: ${params.hemklinikSuggestions.length}`,
      `Kollegdetalj laddad: ${params.colleagueData ? "ja" : "nej"}`,
      "Kontaktinformation är maskad och inte tillgänglig via agent-sammanfattning.",
    ];
    return {
      ok: true,
      message: params.redactContactInfoText(roleSummary.join("\n"), {
        redactAddressLikeLines: true,
      }),
    };
  }, [params]);

  return {
    addMonthsISOForAgent,
    addDaysISOForAgent,
    inferPhaseFromDateForAgent,
    setAllProfilePhoneNumbersForAgent,
    planStFromSrTemplatesForAgent,
    planCoursesCoverCourseMilestonesForAgent,
    syncCoursesMilestonesForAgent,
    summarizeGoalCatalogForAgent,
    summarizeAppSectionsForAgent,
    summarizeRoleViewsForAgent,
  };
}

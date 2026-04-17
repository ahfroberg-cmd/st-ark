"use client";

import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { supabase } from "@/lib/supabase";
import { perfMark, perfMeasure } from "@/lib/perf";
import { listClinicActivityTemplatesByClinicId, listStudentPackByIds } from "@/lib/repositories/starkRepository";
import { buildSupervisorStudent, type SupervisorStudent } from "@/lib/mappers/studentData";
import {
  parseSuggestedPeriodMonths,
  parseTemplateAlternatives,
  parseTimelineWarningRules,
} from "@/lib/studierektor/templateConfig";
import type { WarningRule, WarningRuleType } from "@/lib/studierektor/warningRuleTypes";

export function useClinicStudentsData({
  reloadStudentsTick,
  timelineWarningConfigTitle,
  setClinicId,
  setClinicName,
  setClinicMembers,
  setStudents,
  setFormerStudents,
  setWarningRules,
  setPlacementTemplateOptions,
  setClinicLoading,
}: {
  reloadStudentsTick: number;
  timelineWarningConfigTitle: string;
  setClinicId: (id: string) => void;
  setClinicName: (name: string) => void;
  setClinicMembers: Dispatch<SetStateAction<{ user_id: string; role: string; name: string }[]>>;
  setStudents: Dispatch<SetStateAction<SupervisorStudent[]>>;
  setFormerStudents: Dispatch<SetStateAction<SupervisorStudent[]>>;
  setWarningRules: Dispatch<SetStateAction<WarningRule[]>>;
  setPlacementTemplateOptions: Dispatch<SetStateAction<any[]>>;
  setClinicLoading: (value: boolean) => void;
}) {
  useEffect(() => {
    let cancelled = false;

    async function getAuthUserId(): Promise<string | null> {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) return data.session.user.id;
      try {
        const at = sessionStorage.getItem("temp_access_token");
        const rt = sessionStorage.getItem("temp_refresh_token");
        if (at && rt) {
          const { data: rd, error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
          if (!error && rd.session?.user?.id) {
            sessionStorage.removeItem("temp_access_token");
            sessionStorage.removeItem("temp_refresh_token");
            return rd.session.user.id;
          }
        }
      } catch {}
      return null;
    }

    async function loadClinicStudents() {
      try {
        const userId = await getAuthUserId();
        if (!userId || cancelled) return;

        const { data: membership } = await supabase
          .from("clinic_memberships")
          .select("clinic_id, clinics(*)")
          .eq("user_id", userId)
          .eq("role", "studierektor")
          .single();

        if (!membership || cancelled) return;
        setClinicId(membership.clinic_id);

        if (membership.clinics) {
          setClinicName((membership.clinics as any).name || "");
        }

        const { data: rowsWithFormer, error: membersErr } = await supabase
          .from("clinic_memberships")
          .select("id, user_id, role, former_st_lakare")
          .eq("clinic_id", membership.clinic_id);

        let allMemberRows: { id: string; user_id: string; role: string; former_st_lakare?: boolean | null }[];

        if (membersErr) {
          console.warn("[Studierektor] clinic_memberships med former_st_lakare misslyckades, fallback:", membersErr.message);
          const { data: rowsBasic, error: basicErr } = await supabase
            .from("clinic_memberships")
            .select("id, user_id, role")
            .eq("clinic_id", membership.clinic_id);
          if (basicErr || cancelled) {
            if (basicErr) console.error("[Studierektor] clinic_memberships:", basicErr);
            if (!cancelled) {
              setStudents([]);
              setFormerStudents([]);
            }
            setClinicLoading(false);
            return;
          }
          allMemberRows = (rowsBasic || []).map((r: any) => ({
            ...r,
            former_st_lakare: false,
          }));
        } else if (cancelled) {
          return;
        } else {
          allMemberRows = rowsWithFormer || [];
        }

        const allUserIds = Array.from(new Set(allMemberRows.map((r) => r.user_id)));
        const { data: allMemberProfiles } = await supabase.from("profiles").select("id, name").in("id", allUserIds);

        if (!cancelled) {
          const profileMap = new Map((allMemberProfiles || []).map((p: any) => [p.id, p.name || "Okänd"]));
          setClinicMembers(
            allMemberRows.map((r) => ({
              user_id: r.user_id,
              role: r.role,
              name: profileMap.get(r.user_id) || "Okänd",
            }))
          );
        }

        const memberRows = allMemberRows.filter((r) => r.role === "st_lakare");
        if (memberRows.length === 0 || cancelled) {
          if (!cancelled) {
            setStudents([]);
            setFormerStudents([]);
          }
          setClinicLoading(false);
          return;
        }

        const stUserIds = memberRows.map((r) => r.user_id);

        const loadStart = perfMark("studierektor.loadStudents");
        const [studentPack, templatesRes] = await Promise.all([
          listStudentPackByIds(stUserIds),
          listClinicActivityTemplatesByClinicId(membership.clinic_id),
        ]);
        const [profilesRes, placementsRes, coursesRes, achievementsRes, timelineRes, milestonePlansRes, iupSettingsRes] = studentPack;
        perfMeasure("studierektor.loadStudents", loadStart, { count: stUserIds.length });

        if (cancelled) return;

        const profiles = profilesRes.data || [];
        const allPlacements = placementsRes.data || [];
        const allCourses = coursesRes.data || [];
        const allAchievements = achievementsRes.data || [];
        const allTimelines = timelineRes.data || [];
        const allMilestonePlans = milestonePlansRes.data || [];
        const allIupSettings = iupSettingsRes.data || [];
        const allTemplates = templatesRes.data || [];

        const warningConfigRow = allTemplates.find((t: any) => String(t?.title || "").trim() === timelineWarningConfigTitle);
        const parsedRulesRaw: WarningRule[] = parseTimelineWarningRules(
          Array.isArray((warningConfigRow as any)?.suggested_rows) ? ((warningConfigRow as any).suggested_rows as string[]) : []
        ) as WarningRule[];
        const hasMandatoryToggle = parsedRulesRaw.some((r) => r.type === "mandatory_placement");
        const parsedRules: WarningRule[] = hasMandatoryToggle
          ? parsedRulesRaw
          : [
              ...parsedRulesRaw,
              {
                id: crypto.randomUUID(),
                type: "mandatory_placement" as WarningRuleType,
                enabled: false,
                params: {},
              },
            ];
        if (!cancelled) setWarningRules(parsedRules);
        const placementTemplates = allTemplates
          .filter((t: any) => String(t?.type || "") === "placering")
          .map((t: any) => ({
            title: String(t?.title || "").trim(),
            suggestedMinMonths: parseSuggestedPeriodMonths(Array.isArray(t?.suggested_rows) ? t.suggested_rows : []) || undefined,
            alternatives: parseTemplateAlternatives(Array.isArray(t?.suggested_rows) ? t.suggested_rows : []),
          }))
          .filter((t: { title: string }) => t.title.length > 0);
        if (!cancelled) setPlacementTemplateOptions(placementTemplates);

        const loaded: SupervisorStudent[] = profiles.map((p: any) => {
          const userTimelines = allTimelines.filter((t: any) => t.user_id === p.id);
          const latestVersion = userTimelines[0];
          return buildSupervisorStudent({
            profileRow: p,
            placements: allPlacements.filter((pl: any) => pl.user_id === p.id),
            courses: allCourses.filter((c: any) => c.user_id === p.id),
            achievements: allAchievements.filter((a: any) => a.user_id === p.id),
            milestonePlans: allMilestonePlans.filter((mp: any) => mp.user_id === p.id),
            iupSettings: allIupSettings.find((s: any) => s.user_id === p.id) || null,
            timelineVersionData: latestVersion?.version_data,
          });
        });

        const byUserId = new Map(loaded.map((s) => [s.id, s]));
        const attach = (row: { id: string; user_id: string; former_st_lakare?: boolean | null }) => {
          const base = byUserId.get(row.user_id);
          if (!base) return null;
          return {
            ...base,
            formerStLakare: !!row.former_st_lakare,
            clinicMembershipId: row.id,
          } as SupervisorStudent;
        };

        const activeList = memberRows
          .filter((r: any) => !r.former_st_lakare)
          .map((r: any) => attach(r))
          .filter(Boolean) as SupervisorStudent[];
        const formerList = memberRows
          .filter((r: any) => r.former_st_lakare)
          .map((r: any) => attach(r))
          .filter(Boolean) as SupervisorStudent[];

        if (!cancelled) {
          setStudents(activeList);
          setFormerStudents(formerList);
        }
      } catch (err) {
        console.error("[Studierektor] Failed to load clinic data:", err);
      } finally {
        if (!cancelled) setClinicLoading(false);
      }
    }

    loadClinicStudents();
    return () => {
      cancelled = true;
    };
  }, [
    reloadStudentsTick,
    setClinicId,
    setClinicLoading,
    setClinicMembers,
    setClinicName,
    setFormerStudents,
    setPlacementTemplateOptions,
    setStudents,
    setWarningRules,
    timelineWarningConfigTitle,
  ]);
}

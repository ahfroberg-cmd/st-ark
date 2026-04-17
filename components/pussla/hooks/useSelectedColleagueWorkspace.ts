"use client";

import { useEffect, useState } from "react";
import {
  fetchIupSettingsRowByUserId,
  fetchProfileForEditor,
  listAchievementsByUserId,
  listCoursesByUserId,
  listPlacementsByUserId,
  listRecentTimelineVersionsForUser,
} from "@/lib/repositories/starkRepository";

export function useSelectedColleagueWorkspace() {
  const [selectedColleague, setSelectedColleague] = useState<{
    userId: string;
    name: string;
    specialty: string;
    goalsVersion: string;
    role: "st_lakare" | "huvudhandledare" | "studierektor";
    email?: string;
    mobile?: string;
    phoneWork?: string;
  } | null>(null);
  const [colleagueData, setColleagueData] = useState<any>(null);
  const [colleagueLoading, setColleagueLoading] = useState(false);
  const [colleagueActivityDetail, setColleagueActivityDetail] = useState<any>(null);

  useEffect(() => {
    if (!selectedColleague) return;
    setColleagueLoading(true);
    (async () => {
      try {
        const userId = selectedColleague.userId;

        const [profileRes, placementsRes, coursesRes, achievementsRes, timelineListRes, iupSettingsRes] =
          await Promise.all([
            fetchProfileForEditor(userId),
            listPlacementsByUserId(userId),
            listCoursesByUserId(userId),
            listAchievementsByUserId(userId),
            listRecentTimelineVersionsForUser(userId, 1),
            fetchIupSettingsRowByUserId(userId),
          ]);
        const timelineRes = {
          data: (timelineListRes.data && timelineListRes.data[0]) || null,
          error: timelineListRes.error,
        };

        if (profileRes.error) console.error("Error fetching colleague profile:", profileRes.error);
        if (placementsRes.error) console.error("Error fetching colleague placements:", placementsRes.error);
        if (coursesRes.error) console.error("Error fetching colleague courses:", coursesRes.error);
        if (achievementsRes.error) console.error("Error fetching colleague achievements:", achievementsRes.error);
        if (timelineRes.error) console.error("Error fetching colleague timeline:", timelineRes.error);
        if (iupSettingsRes.error) console.error("Error fetching colleague iup_settings:", iupSettingsRes.error);

        const rawProfile = (profileRes.data || {}) as Record<string, any>;
        const mappedProfile = {
          ...rawProfile,
          personalNumber: rawProfile.personal_number || "",
          address: rawProfile.address || "",
          postalCode: rawProfile.postal_code || "",
          city: rawProfile.city || "",
          email: rawProfile.email || "",
          mobile: rawProfile.mobile || "",
          phoneHome: rawProfile.phone_home || "",
          phoneWork: rawProfile.phone_work || "",
          goalsVersion: rawProfile.goals_version || "2021",
          shareColleagueEducation: rawProfile.share_colleague_education ?? true,
          shareColleagueContact: rawProfile.share_colleague_contact ?? true,
        };

        const mappedPlacements = (placementsRes.data || []).map((p: any) => ({
          id: p.id,
          type: p.type || "",
          clinic: p.clinic || "",
          title: p.title || "",
          startDate: p.start_date || "",
          endDate: p.end_date || "",
          attendance: p.attendance ?? 100,
          supervisor: p.supervisor || "",
          supervisorSpeciality: p.supervisor_specialty || "",
          supervisorSite: p.supervisor_site || "",
          note: p.note || "",
          notes: p.note || "",
          btAssessment: p.bt_assessment || "",
          btMilestones: p.bt_milestones || [],
          milestones: p.milestones || [],
          fulfillsStGoals: !!p.fulfills_st_goals,
          phase: p.phase,
          operationsManager: p.operations_manager || p.manager || "",
          studyDirector: p.study_director || "",
        }));

        const mappedCourses = (coursesRes.data || []).map((c: any) => ({
          id: c.id,
          title: c.title || "",
          name: c.title || "",
          kind: c.kind || "Kurs",
          city: c.city || "",
          organizer: c.organizer || c.provider || "",
          courseLeader: c.course_leader_name || "",
          courseLeaderName: c.course_leader_name || "",
          startDate: c.start_date || "",
          endDate: c.end_date || "",
          certificateDate: c.certificate_date || "",
          note: c.note || "",
          notes: c.note || "",
          courseTitle: c.course_title || undefined,
          btAssessment: c.bt_assessment || "",
          btMilestones: c.bt_milestones || [],
          milestones: c.milestones || [],
          fulfillsStGoals: !!c.fulfills_st_goals,
          phase: c.phase,
          showAsInterval: !!c.show_as_interval,
        }));

        setColleagueData({
          profile: mappedProfile,
          placements: mappedProfile.shareColleagueEducation ? mappedPlacements : [],
          courses: mappedProfile.shareColleagueEducation ? mappedCourses : [],
          achievements: achievementsRes.data || [],
          timeline: timelineRes.data || null,
          iupSettings: iupSettingsRes.data || {},
          canShareEducation: mappedProfile.shareColleagueEducation !== false,
          canShareContact: mappedProfile.shareColleagueContact !== false,
        });
      } catch (err) {
        console.error("Error fetching colleague data:", err);
        setColleagueData(null);
      } finally {
        setColleagueLoading(false);
      }
    })();
  }, [selectedColleague]);

  return {
    selectedColleague,
    setSelectedColleague,
    colleagueData,
    colleagueLoading,
    colleagueActivityDetail,
    setColleagueActivityDetail,
  };
}

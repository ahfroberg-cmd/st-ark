import { useEffect, useMemo } from "react";
import type { Achievement, Course, Placement, Profile } from "@/lib/types";
import {
  useAchievements,
  useCourses,
  usePlacements,
  useProfile,
} from "@/lib/hooks/useSupabaseData";
import { supabase } from "@/lib/supabase";

function mapProfile(input: any): Profile | null {
  if (!input) return null;
  return {
    name: input.name ?? "",
    specialty: input.specialty ?? input.speciality ?? "",
    speciality: input.speciality ?? input.specialty ?? "",
    goalsVersion: String(input.goals_version ?? input.goalsVersion ?? "2021") as
      | "2015"
      | "2021",
    startDate: input.st_start_date ?? input.startDate ?? "",
    email: input.email ?? "",
    mobile: input.mobile ?? "",
    phoneHome: input.phone_home ?? input.phoneHome ?? "",
    phoneWork: input.phone_work ?? input.phoneWork ?? "",
    supervisor: input.supervisor ?? "",
    supervisorWorkplace: input.supervisor_workplace ?? input.supervisorWorkplace ?? "",
    homeClinic: input.home_clinic ?? input.homeClinic ?? "",
    locked: Boolean(input.locked),
    // Keep passthrough fields expected by existing mobile views.
    ...(input || {}),
  };
}

function mapPlacement(input: any): Placement {
  return {
    id: String(input.id),
    clinic: input.clinic ?? input.title ?? "",
    startDate: input.start_date ?? input.startDate ?? "",
    endDate: input.end_date ?? input.endDate ?? "",
    attendance: Number(input.attendance ?? 100),
    supervisor: input.supervisor ?? "",
    note: input.note ?? "",
    ...(input || {}),
  } as Placement;
}

function mapCourse(input: any): Course {
  return {
    id: String(input.id),
    title: input.title ?? input.course_title ?? "",
    city: input.city ?? input.site ?? "",
    certificateDate: input.certificate_date ?? input.certificateDate ?? "",
    startDate: input.start_date ?? input.startDate ?? "",
    endDate: input.end_date ?? input.endDate ?? "",
    note: input.note ?? "",
    ...(input || {}),
  } as Course;
}

function mapAchievement(input: any): Achievement {
  return {
    id: String(input.id),
    placementId: input.placement_id ?? input.placementId ?? undefined,
    courseId: input.course_id ?? input.courseId ?? undefined,
    milestoneId: input.milestone_id ?? input.milestoneId ?? input.goal_id ?? "",
    goalId: input.goal_id ?? input.goalId ?? undefined,
    code: input.code ?? undefined,
    milestone: input.milestone ?? undefined,
    date: input.achieved_date ?? input.date ?? "",
    ...(input || {}),
  } as Achievement;
}

export function useMobileProfile() {
  const { profile, loading, error, reloadProfile } = useProfile();
  const mapped = useMemo(() => mapProfile(profile), [profile]);
  return { profile: mapped, loading, error, reloadProfile };
}

export function useMobileData() {
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    reloadProfile,
  } = useProfile();
  const {
    placements,
    loading: placementsLoading,
    error: placementsError,
    reloadPlacements,
  } = usePlacements();
  const {
    courses,
    loading: coursesLoading,
    error: coursesError,
    reloadCourses,
  } = useCourses();
  const {
    achievements,
    loading: achievementsLoading,
    error: achievementsError,
    reloadAchievements,
  } = useAchievements();

  const mapped = useMemo(
    () => ({
      profile: mapProfile(profile),
      placements: (placements || []).map(mapPlacement),
      courses: (courses || []).map(mapCourse),
      achievements: (achievements || []).map(mapAchievement),
    }),
    [profile, placements, courses, achievements]
  );

  useEffect(() => {
    const userId = String((profile as any)?.id || "").trim();
    if (!userId) return;
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const debounceReload = (key: string, fn: () => void) => {
      const existing = debounceTimers.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        debounceTimers.delete(key);
        fn();
      }, 250);
      debounceTimers.set(key, timer);
    };

    const channel = supabase
      .channel(`mobile-data-sync:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => {
          debounceReload("profiles", reloadProfile);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "placements", filter: `user_id=eq.${userId}` },
        () => {
          debounceReload("placements", reloadPlacements);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "courses", filter: `user_id=eq.${userId}` },
        () => {
          debounceReload("courses", reloadCourses);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "achievements", filter: `user_id=eq.${userId}` },
        () => {
          debounceReload("achievements", reloadAchievements);
        }
      )
      .subscribe();

    return () => {
      debounceTimers.forEach((t) => clearTimeout(t));
      debounceTimers.clear();
      supabase.removeChannel(channel);
    };
  }, [profile, reloadProfile, reloadPlacements, reloadCourses, reloadAchievements]);

  return {
    ...mapped,
    loading:
      profileLoading || placementsLoading || coursesLoading || achievementsLoading,
    errors: {
      profile: profileError,
      placements: placementsError,
      courses: coursesError,
      achievements: achievementsError,
    },
    reloadAll: async () => {
      await Promise.all([
        reloadProfile(),
        reloadPlacements(),
        reloadCourses(),
        reloadAchievements(),
      ]);
    },
  };
}


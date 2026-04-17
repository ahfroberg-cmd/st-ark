import { useEffect, useState, useCallback } from 'react'
import {
  deleteAchievementForUser,
  deleteCourseForUser,
  deletePlacementForUser,
  fetchProfileById,
  getAuthenticatedUserId,
  listAchievementsByUserId,
  listCoursesByUserId,
  listPlacementsByUserId,
  saveAchievementForUser,
  saveCourseForUser,
  savePlacementForUser,
  upsertProfile,
} from "@/lib/repositories/starkRepository";

export interface Profile {
  id: string
  user_id?: string
  name?: string
  email?: string
  specialty?: string
  goals_version?: string
  st_start_date?: string
  bt_ext_assessor_name?: string
  bt_ext_assessor_spec?: string
  bt_ext_assessor_workplace?: string
  created_at?: string
  updated_at?: string
}

export interface Placement {
  id: string
  user_id: string
  type?: string
  clinic?: string
  supervisor?: string
  supervisor_speciality?: string
  supervisor_site?: string
  start_date?: string
  end_date?: string
  certificate_date?: string
  milestones?: string[]
  bt_milestones?: string[]
  note?: string
  show_on_timeline?: boolean
  fulfills_st_goals?: boolean
  created_at?: string
  updated_at?: string
}

export interface Course {
  id: string
  user_id: string
  title?: string
  course_title?: string
  site?: string
  start_date?: string
  end_date?: string
  certificate_date?: string
  milestones?: string[]
  note?: string
  show_on_timeline?: boolean
  show_as_interval?: boolean
  bt_assessment?: string
  created_at?: string
  updated_at?: string
}

export interface Achievement {
  id: string
  user_id: string
  milestone_id?: string
  achieved_date?: string
  note?: string
  created_at?: string
  updated_at?: string
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const userId = await getAuthenticatedUserId()
      if (!userId) {
        setProfile(null)
        return
      }

      const { data, error: fetchError } = await fetchProfileById(userId)

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setProfile(null)
        } else {
          throw fetchError
        }
      } else {
        setProfile(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const saveProfile = useCallback(async (updates: Partial<Profile>) => {
    try {
      const userId = await getAuthenticatedUserId()
      if (!userId) throw new Error('Not authenticated')

      const { data, error: upsertError } = await upsertProfile(userId, updates)

      if (upsertError) throw upsertError

      setProfile(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
      throw err
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  return { profile, loading, error, saveProfile, reloadProfile: loadProfile }
}

export function usePlacements() {
  const [placements, setPlacements] = useState<Placement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPlacements = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const userId = await getAuthenticatedUserId()
      if (!userId) {
        setPlacements([])
        return
      }

      const { data, error: fetchError } = await listPlacementsByUserId(userId)

      if (fetchError) throw fetchError

      setPlacements(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load placements')
      setPlacements([])
    } finally {
      setLoading(false)
    }
  }, [])

  const savePlacement = useCallback(async (placement: Partial<Placement>) => {
    try {
      const userId = await getAuthenticatedUserId()
      if (!userId) throw new Error('Not authenticated')

      const { data, error: saveError } = await savePlacementForUser(userId, placement)
      if (saveError) throw saveError

      if (placement.id) {
        setPlacements(prev => prev.map(p => p.id === data.id ? data : p))
      } else {
        setPlacements(prev => [...prev, data])
      }
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save placement')
      throw err
    }
  }, [])

  const deletePlacement = useCallback(async (id: string) => {
    try {
      const userId = await getAuthenticatedUserId()
      if (!userId) throw new Error('Not authenticated')

      const { error: deleteError } = await deletePlacementForUser(userId, id)

      if (deleteError) throw deleteError

      setPlacements(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete placement')
      throw err
    }
  }, [])

  useEffect(() => {
    loadPlacements()
  }, [loadPlacements])

  return { placements, loading, error, savePlacement, deletePlacement, reloadPlacements: loadPlacements }
}

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCourses = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const userId = await getAuthenticatedUserId()
      if (!userId) {
        setCourses([])
        return
      }

      const { data, error: fetchError } = await listCoursesByUserId(userId)

      if (fetchError) throw fetchError

      setCourses(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses')
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [])

  const saveCourse = useCallback(async (course: Partial<Course>) => {
    try {
      const userId = await getAuthenticatedUserId()
      if (!userId) throw new Error('Not authenticated')

      const { data, error: saveError } = await saveCourseForUser(userId, course)
      if (saveError) throw saveError

      if (course.id) {
        setCourses(prev => prev.map(c => c.id === data.id ? data : c))
      } else {
        setCourses(prev => [...prev, data])
      }
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save course')
      throw err
    }
  }, [])

  const deleteCourse = useCallback(async (id: string) => {
    try {
      const userId = await getAuthenticatedUserId()
      if (!userId) throw new Error('Not authenticated')

      const { error: deleteError } = await deleteCourseForUser(userId, id)

      if (deleteError) throw deleteError

      setCourses(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete course')
      throw err
    }
  }, [])

  useEffect(() => {
    loadCourses()
  }, [loadCourses])

  // Enkel event-buss för att trigga omladdning när andra delar av appen
  // skapar/uppdaterar kurser via egen Supabase-logik.
  useEffect(() => {
    if (typeof window === "undefined") return
    const handler = () => {
      loadCourses()
    }
    window.addEventListener("stark:reload-courses", handler)
    return () => {
      window.removeEventListener("stark:reload-courses", handler)
    }
  }, [loadCourses])

  return { courses, loading, error, saveCourse, deleteCourse, reloadCourses: loadCourses }
}

export function useAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAchievements = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const userId = await getAuthenticatedUserId()
      if (!userId) {
        setAchievements([])
        return
      }

      const { data, error: fetchError } = await listAchievementsByUserId(userId)

      if (fetchError) throw fetchError

      setAchievements(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load achievements')
      setAchievements([])
    } finally {
      setLoading(false)
    }
  }, [])

  const saveAchievement = useCallback(async (achievement: Partial<Achievement>) => {
    try {
      const userId = await getAuthenticatedUserId()
      if (!userId) throw new Error('Not authenticated')

      const { data, error: saveError } = await saveAchievementForUser(userId, achievement)
      if (saveError) throw saveError

      if (achievement.id) {
        setAchievements(prev => prev.map(a => a.id === data.id ? data : a))
      } else {
        setAchievements(prev => [...prev, data])
      }
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save achievement')
      throw err
    }
  }, [])

  const deleteAchievement = useCallback(async (id: string) => {
    try {
      const userId = await getAuthenticatedUserId()
      if (!userId) throw new Error('Not authenticated')

      const { error: deleteError } = await deleteAchievementForUser(userId, id)

      if (deleteError) throw deleteError

      setAchievements(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete achievement')
      throw err
    }
  }, [])

  useEffect(() => {
    loadAchievements()
  }, [loadAchievements])

  return { achievements, loading, error, saveAchievement, deleteAchievement, reloadAchievements: loadAchievements }
}

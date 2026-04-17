import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchIupSettingsRowByUserId,
  fetchProfileById,
  listAchievementsByUserId,
  listCoursesByUserId,
  listPlacementsByUserId,
  listRecentTimelineVersionsForUser,
} from "@/lib/repositories/starkRepository";

export interface ClinicMember {
  user_id: string
  role: 'st_lakare' | 'huvudhandledare' | 'studierektor'
  profile: {
    id: string
    name: string
    email: string
    supervisor?: string
    specialty: string
    goals_version: string
    bt_start_date: string | null
    st_start_date: string | null
    st_end_date: string | null
  }
}

export interface Invitation {
  id: string
  clinic_id: string
  email: string
  status: 'pending' | 'accepted' | 'expired'
  token: string
  created_at: string
  expires_at: string
}

async function getAuthenticatedUserId() {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user?.id) {
    return data.session.user.id
  }

  try {
    const accessToken = sessionStorage.getItem('temp_access_token')
    const refreshToken = sessionStorage.getItem('temp_refresh_token')

    if (accessToken && refreshToken) {
      const { data: restoredData, error: restoredError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (!restoredError && restoredData.session?.user?.id) {
        sessionStorage.removeItem('temp_access_token')
        sessionStorage.removeItem('temp_refresh_token')
        return restoredData.session.user.id
      }
    }
  } catch {}

  return null
}

export function useStudierektorClinic() {
  const [clinic, setClinic] = useState<any>(null)
  const [members, setMembers] = useState<ClinicMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const normalizeRole = (role: unknown): 'st_lakare' | 'huvudhandledare' | 'studierektor' | '' => {
    const r = String(role || '').trim().toLowerCase()
    if (r === 'st_lakare' || r === 'st') return 'st_lakare'
    if (
      r === 'huvudhandledare' ||
      r === 'supervisor' ||
      r === 'handledare' ||
      r === 'main_supervisor' ||
      r === 'head_supervisor'
    ) return 'huvudhandledare'
    if (r === 'studierektor' || r === 'study_director' || r === 'studierektor_admin') return 'studierektor'
    return ''
  }

  const loadClinicData = useCallback(async () => {
    let resolvedClinic: any = null
    try {
      setLoading(true)
      setError(null)

      const userId = await getAuthenticatedUserId()
      if (!userId) {
        setClinic(null)
        setMembers([])
        setInvitations([])
        return
      }

      // Hämta användarens klinik-membership och normalisera roll lokalt
      const { data: myMembershipRows, error: membershipError } = await supabase
        .from('clinic_memberships')
        .select('clinic_id, role')
        .eq('user_id', userId)
        .limit(20)

      if (membershipError) {
        throw membershipError
      }

      const srMembership = (myMembershipRows || []).find(
        (row: any) => normalizeRole(row?.role) === 'studierektor'
      ) as any
      const fallbackMembership = (myMembershipRows || [])[0] as any
      const effectiveMembership = srMembership?.clinic_id ? srMembership : fallbackMembership
      if (!effectiveMembership?.clinic_id) {
        setClinic(null)
        setMembers([])
        setInvitations([])
        return
      }

      const clinicId = String(effectiveMembership.clinic_id || '')
      let clinicObj: any = { id: clinicId, name: '' }
      try {
        const { data: clinicRow } = await supabase
          .from('clinics')
          .select('id,name')
          .eq('id', clinicId)
          .maybeSingle()
        if (clinicRow) {
          clinicObj = clinicRow
        }
      } catch {
        // ignore: clinic name is optional for dashboard access
      }
      setClinic(clinicObj)
      resolvedClinic = clinicObj

      const { data: clinicMemberRows, error: membersError } = await supabase
        .from('clinic_memberships')
        .select('user_id, role')
        .eq('clinic_id', clinicId)

      if (membersError) throw membersError

      const memberUserIds = Array.from(new Set((clinicMemberRows || []).map((row) => row.user_id).filter(Boolean)))

      let profilesById = new Map<string, any>()
      if (memberUserIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email, supervisor, specialty, goals_version, bt_start_date, st_start_date')
          .in('id', memberUserIds)

        if (profilesError) throw profilesError

        profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]))
      }

      setMembers(
        (clinicMemberRows || []).map((row) => {
          const profile = profilesById.get(row.user_id)

          return {
            user_id: row.user_id,
            role: (normalizeRole(row.role) || 'st_lakare') as ClinicMember['role'],
            profile: {
              id: profile?.id || row.user_id,
              name: profile?.name || '',
              email: profile?.email || '',
              supervisor: profile?.supervisor || '',
              specialty: profile?.specialty || '',
              goals_version: profile?.goals_version || '',
              bt_start_date: profile?.bt_start_date || null,
              st_start_date: profile?.st_start_date || null,
              st_end_date: null,
            },
          }
        }) as ClinicMember[]
      )

      // Hämta pågående inbjudningar
      const { data: invites, error: invitesError } = await supabase
        .from('invitations')
        .select('id,clinic_id,email,status,token,created_at,expires_at')
        .eq('clinic_id', clinicId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (invitesError) throw invitesError

      setInvitations(invites || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clinic data')
      if (!resolvedClinic) {
        setClinic(null)
      }
      setMembers([])
      setInvitations([])
    } finally {
      setLoading(false)
    }
  }, [])

  const sendInvitation = useCallback(async (email: string, role: 'st_lakare' | 'huvudhandledare' = 'st_lakare', name?: string) => {
    try {
      const userId = await getAuthenticatedUserId()
      if (!userId) throw new Error('Not authenticated')

      // Hämta användarens klinik + kliniknamn
      const { data: membership } = await supabase
        .from('clinic_memberships')
        .select('clinic_id')
        .eq('user_id', userId)
        .in('role', ['studierektor', 'study_director'])
        .limit(1)
        .maybeSingle()

      if (!membership) throw new Error('No clinic found')

      let clinicName = 'kliniken'
      try {
        const { data: clinicRow } = await supabase
          .from('clinics')
          .select('name')
          .eq('id', (membership as any).clinic_id)
          .maybeSingle()
        clinicName = String((clinicRow as any)?.name || 'kliniken')
      } catch {
        // ignore
      }
      const normalizedEmail = email.toLowerCase().trim()

      // Generera token
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      
      // Skapa inbjudan
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 dagar giltighetstid

      const insertPayload: any = {
          clinic_id: membership.clinic_id,
          email: normalizedEmail,
          role,
          status: 'pending',
          token,
          expires_at: expiresAt.toISOString(),
          invited_by: userId,
        }
      if (name && name.trim()) {
        insertPayload.name = name.trim()
      }

      const { data, error } = await supabase
        .from('invitations')
        .insert(insertPayload)
        .select()
        .single()

      if (error) throw error

      // Kolla om e-posten tillhör en redan registrerad användare
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle()

      const existingUser = !!existingProfile

      // Skicka inbjudningsmail
      const inviteLink = `${window.location.origin}/accept-invite?token=${token}`
      try {
        await fetch('/api/send-invitation-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            clinicName,
            role,
            inviteLink,
            existingUser,
          }),
        })
      } catch (emailErr) {
        console.error('Could not send invitation email:', emailErr)
      }

      await loadClinicData()
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation')
      throw err
    }
  }, [loadClinicData])

  const cancelInvitation = useCallback(async (invitationId: string) => {
    try {
      const userId = await getAuthenticatedUserId()
      if (!userId) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId)

      if (error) throw error

      await loadClinicData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation')
      throw err
    }
  }, [loadClinicData])

  const removeMember = useCallback(async (userId: string) => {
    try {
      const currentUserId = await getAuthenticatedUserId()
      if (!currentUserId) throw new Error('Not authenticated')

      // Hämta användarens klinik
      const { data: membership } = await supabase
        .from('clinic_memberships')
        .select('clinic_id')
        .eq('user_id', currentUserId)
        .in('role', ['studierektor', 'study_director'])
        .limit(1)
        .maybeSingle()

      if (!membership) throw new Error('No clinic found')

      const { error } = await supabase
        .from('clinic_memberships')
        .delete()
        .eq('clinic_id', membership.clinic_id)
        .eq('user_id', userId)

      if (error) throw error

      await loadClinicData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
      throw err
    }
  }, [loadClinicData])

  useEffect(() => {
    loadClinicData()
  }, [loadClinicData])

  return {
    clinic,
    members,
    invitations,
    loading,
    error,
    sendInvitation,
    cancelInvitation,
    removeMember,
    reloadData: loadClinicData,
  }
}

// Hook för att hämta en specifik ST-läkares data
export function useStLakareData(userId: string | null) {
  const [profile, setProfile] = useState<any>(null)
  const [placements, setPlacements] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [achievements, setAchievements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setPlacements([])
      setCourses([])
      setAchievements([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadData() {
      try {
        if (!userId) return
        setLoading(true)

        const uid = userId
        const [profileRes, placementsRes, coursesRes, achievementsRes] = await Promise.all([
          fetchProfileById(uid),
          listPlacementsByUserId(uid),
          listCoursesByUserId(uid),
          listAchievementsByUserId(uid),
        ])

        if (cancelled) return

        setProfile(profileRes.data)
        setPlacements(placementsRes.data || [])
        setCourses(coursesRes.data || [])
        setAchievements(achievementsRes.data || [])
      } catch (err) {
        console.error('Failed to load ST-läkare data:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [userId])

  return { profile, placements, courses, achievements, loading }
}

type TimelineListItem = {
  id: string
  source: 'timeline_version' | 'placement' | 'course' | 'supervision' | 'assessment'
  kind: string
  title: string
  startDate: string
  endDate?: string
  note?: string
}

type MeetingItem = {
  id: string
  dateISO: string
  title: string
  note?: string
}

type DirectorMeetingItem = {
  id: string
  dateISO: string
  title: string
  note?: string
}

type AssessmentItem = {
  id: string
  dateISO: string
  title: string
  instrument?: string
  note?: string
}

const normalizeISODate = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const v = value.trim()
  if (!v) return ''
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

const mapMeetings = (iupSettings: any, profile: any): MeetingItem[] => {
  const iupMeetings = Array.isArray(iupSettings?.meetings) ? iupSettings.meetings : []
  const fallbackMeetings =
    profile?.supervisorMeetings ||
    profile?.handledartraffar ||
    profile?.meetings ||
    profile?.iup?.meetings ||
    profile?.iup?.supervisionSessions ||
    []
  const source = iupMeetings.length > 0 ? iupMeetings : fallbackMeetings
  return (Array.isArray(source) ? source : [])
    .map((m: any, i: number) => {
      const dateISO = normalizeISODate(m?.dateISO || m?.date || m?.iso)
      if (!dateISO) return null
      return {
        id: String(m?.id || m?._id || `meeting-${i}`),
        dateISO,
        title: String(m?.focus || m?.title || 'Handledarsamtal'),
        note: String(m?.summary || m?.note || m?.notes || ''),
      } as MeetingItem
    })
    .filter(Boolean) as MeetingItem[]
}

const mapAssessments = (iupSettings: any, profile: any): AssessmentItem[] => {
  const iupAssessments = Array.isArray(iupSettings?.assessments) ? iupSettings.assessments : []
  const fallbackAssessments =
    profile?.progressAssessments ||
    profile?.progressionsbedömningar ||
    profile?.assessments ||
    profile?.iup?.assessments ||
    profile?.iup?.assessmentSessions ||
    []
  const source = iupAssessments.length > 0 ? iupAssessments : fallbackAssessments
  return (Array.isArray(source) ? source : [])
    .map((a: any, i: number) => {
      const dateISO = normalizeISODate(a?.dateISO || a?.date || a?.iso)
      if (!dateISO) return null
      return {
        id: String(a?.id || a?._id || `assessment-${i}`),
        dateISO,
        title: String(a?.title || a?.focus || 'Progressionsbedömning'),
        instrument: String(a?.instrument || a?.tool || ''),
        note: String(a?.summary || a?.note || a?.notes || ''),
      } as AssessmentItem
    })
    .filter(Boolean) as AssessmentItem[]
}

const mapDirectorMeetings = (iupSettings: any): DirectorMeetingItem[] => {
  const src = Array.isArray(iupSettings?.director_meetings)
    ? iupSettings.director_meetings
    : Array.isArray(iupSettings?.directorMeetings)
      ? iupSettings.directorMeetings
      : []
  return src
    .map((m: any, i: number) => {
      const dateISO = normalizeISODate(m?.dateISO || m?.date || m?.iso)
      if (!dateISO) return null
      return {
        id: String(m?.id || m?._id || `director-meeting-${i}`),
        dateISO,
        title: String(m?.focus || m?.title || 'Studierektorsmöte'),
        note: String(m?.summary || m?.note || m?.notes || ''),
      } as DirectorMeetingItem
    })
    .filter(Boolean) as DirectorMeetingItem[]
}

const mapTimelineVersionEntries = (timelineRows: any[]): TimelineListItem[] => {
  if (!Array.isArray(timelineRows) || timelineRows.length === 0) return []
  const versionData = timelineRows[0]?.version_data
  const rawEntries = Array.isArray(versionData)
    ? versionData
    : Array.isArray(versionData?.timeline)
      ? versionData.timeline
      : versionData?.timeline
        ? [versionData.timeline]
        : []
  return rawEntries
    .map((item: any, i: number) => {
      const startDate = normalizeISODate(
        item?.startDate || item?.start_date || item?.dateISO || item?.date || item?.certificateDate
      )
      if (!startDate) return null
      const endDate = normalizeISODate(item?.endDate || item?.end_date || '')
      const kind = String(item?.kind || item?.type || 'Aktivitet')
      const title = String(item?.title || item?.courseTitle || item?.course_title || item?.clinic || kind)
      return {
        id: String(item?.id || `timeline-entry-${i}`),
        source: 'timeline_version' as const,
        kind,
        title,
        startDate,
        endDate: endDate || undefined,
        note: String(item?.note || item?.description || ''),
      } as TimelineListItem
    })
    .filter(Boolean) as TimelineListItem[]
}

export function useStudierektorStOverview(userId: string | null) {
  const [profile, setProfile] = useState<any>(null)
  const [placements, setPlacements] = useState<any[]>([])
  const [courses, setCourses] = useState<any[]>([])
  const [achievements, setAchievements] = useState<any[]>([])
  const [meetings, setMeetings] = useState<MeetingItem[]>([])
  const [directorMeetings, setDirectorMeetings] = useState<DirectorMeetingItem[]>([])
  const [assessments, setAssessments] = useState<AssessmentItem[]>([])
  const [timelineFromVersion, setTimelineFromVersion] = useState<TimelineListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setPlacements([])
      setCourses([])
      setAchievements([])
      setMeetings([])
      setDirectorMeetings([])
      setAssessments([])
      setTimelineFromVersion([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadOverview() {
      try {
        if (!userId) return
        setLoading(true)
        setError(null)

        const uid = userId
        const [profileRes, placementsRes, coursesRes, achievementsRes, iupRes, timelineRes] = await Promise.all([
          fetchProfileById(uid),
          listPlacementsByUserId(uid),
          listCoursesByUserId(uid),
          listAchievementsByUserId(uid),
          fetchIupSettingsRowByUserId(uid),
          listRecentTimelineVersionsForUser(uid, 10),
        ])

        if (cancelled) return

        const p = profileRes.data || null
        const iup = iupRes.data || null

        setProfile(p)
        setPlacements(placementsRes.data || [])
        setCourses(coursesRes.data || [])
        setAchievements(achievementsRes.data || [])
        setMeetings(mapMeetings(iup, p))
        setDirectorMeetings(mapDirectorMeetings(iup))
        setAssessments(mapAssessments(iup, p))
        setTimelineFromVersion(mapTimelineVersionEntries(timelineRes.data || []))
      } catch (err) {
        console.error('Failed to load studierektor ST overview:', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load ST overview')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadOverview()
    return () => {
      cancelled = true
    }
  }, [userId])

  return {
    profile,
    placements,
    courses,
    achievements,
    meetings,
    directorMeetings,
    assessments,
    timelineFromVersion,
    loading,
    error,
  }
}

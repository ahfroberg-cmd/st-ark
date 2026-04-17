import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface TimelineVersion {
  id: string
  user_id: string
  version_name: string
  version_data: any
  created_at: string
  updated_at: string
}

export function useTimelineVersions() {
  const [versions, setVersions] = useState<TimelineVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadVersions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setVersions([])
        return
      }

      const { data, error: fetchError } = await supabase
        .from('timeline_versions')
        .select('id,user_id,version_name,version_data,created_at,updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setVersions(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions')
      setVersions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const saveVersion = useCallback(async (versionName: string, versionData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: insertError } = await supabase
        .from('timeline_versions')
        .insert({
          user_id: user.id,
          version_name: versionName,
          version_data: versionData,
        })
        .select()
        .single()

      if (insertError) throw insertError

      setVersions(prev => [data, ...prev])
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save version')
      throw err
    }
  }, [])

  const deleteVersion = useCallback(async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: deleteError } = await supabase
        .from('timeline_versions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (deleteError) throw deleteError

      setVersions(prev => prev.filter(v => v.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete version')
      throw err
    }
  }, [])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  return { versions, loading, error, saveVersion, deleteVersion, reloadVersions: loadVersions }
}

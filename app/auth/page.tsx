'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchProfileRedirectInfoById } from '@/lib/repositories/starkRepository'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function AuthPageInner() {
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email')
  const [email, setEmail] = useState(emailParam || '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null)
  const router = useRouter()

  function isMeaningfulProfileError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false
    const rec = err as Record<string, unknown>
    return Boolean(
      rec.message ||
      rec.code ||
      rec.details ||
      rec.hint
    )
  }

  async function redirectAfterAuth(userId: string) {
    console.log('[redirectAfterAuth] Starting redirect for userId:', userId)
    
    try {
      const pendingToken = sessionStorage.getItem('pending_invite_token')
      if (pendingToken) {
        console.log('[redirectAfterAuth] Found pending invite token, redirecting to accept-invite')
        router.replace(`/accept-invite?token=${pendingToken}`)
        return
      }
    } catch {}

    console.log('[redirectAfterAuth] Fetching profile from database...')
    const { data: profile, error: profileError } = await fetchProfileRedirectInfoById(userId)

    console.log('[redirectAfterAuth] Profile query result:', { profile, error: profileError })

    if (profileError && isMeaningfulProfileError(profileError)) {
      console.error('[redirectAfterAuth] Profile error:', profileError)
      setMessage({ type: 'error', text: 'Kunde inte läsa användarprofil efter inloggning.' })
      return
    }

    if (profileError) {
      // Some Supabase client errors are surfaced as empty objects in dev;
      // treat those as non-fatal and continue with profile setup fallback.
      console.warn('[redirectAfterAuth] Non-fatal profile error object:', profileError)
    }

    if (!profile) {
      console.log('[redirectAfterAuth] No profile found, redirecting to profile setup')
      router.replace('/profile?setup=1')
      return
    }

    const studierektorNeedsSetup =
      profile.role === 'studierektor' &&
      !String((profile as any).name || '').trim()

    console.log('[redirectAfterAuth] Profile check:', {
      role: profile.role,
      name: profile.name,
      studierektorNeedsSetup
    })

    if (studierektorNeedsSetup) {
      console.log('[redirectAfterAuth] Studierektor needs setup, redirecting to studierektor-profile')
      window.location.href = '/studierektor-profile?setup=1'
      return
    }

    console.log('[redirectAfterAuth] Redirecting based on role:', profile.role)
    switch (profile.role) {
      case 'superadmin':
        window.location.href = '/admin'
        return
      case 'studierektor':
        window.location.href = '/studierektor'
        return
      case 'huvudhandledare':
        window.location.href = '/handledare'
        return
      case 'st_lakare':
      default:
        window.location.href = '/planera-st'
        return
    }
  }

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [emailParam])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      const userId = data?.session?.user?.id
      if (!userId) return
      console.log('[useEffect] Found existing session, redirecting...')
      await redirectAfterAuth(userId)
    })
    return () => {
      mounted = false
    }
  }, [])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setMessage({ type: 'error', text: 'Du behöver bekräfta din e-post först. Kolla din inkorg (och skräppost).' })
      } else if (error.message.includes('Invalid login credentials')) {
        setMessage({ type: 'error', text: 'Fel e-postadress eller lösenord.' })
      } else {
        setMessage({ type: 'error', text: error.message })
      }
    } else {
      const userId = data.user?.id
      const session = data.session

      if (!userId) {
        setMessage({ type: 'error', text: 'Inloggningen lyckades men ingen användarsession hittades.' })
        setLoading(false)
        return
      }

      try {
        if (session?.access_token && session?.refresh_token) {
          sessionStorage.setItem('temp_access_token', session.access_token)
          sessionStorage.setItem('temp_refresh_token', session.refresh_token)
        }
      } catch {}

      // Vänta lite så sessionen hinner sparas
      await new Promise(resolve => setTimeout(resolve, 100))
      await redirectAfterAuth(userId)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Logga in</h1>
          <p className="text-sm text-slate-500 mt-1">Välkommen tillbaka till ST-ARK</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              E-post
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              placeholder="din.epost@exempel.se"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Lösenord
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              placeholder="Ditt lösenord"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-200 text-center space-y-3">
          <p className="text-sm text-slate-600">
            Har du inget konto?
          </p>
          <button
            onClick={() => router.push('/auth/signup')}
            className="w-full bg-white text-sky-600 border border-sky-200 py-2.5 rounded-lg text-sm font-medium hover:bg-sky-50 transition"
          >
            Skapa nytt konto
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.reload()
            }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Logga ut (om du är inloggad)
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-slate-500">Laddar...</div>}>
      <AuthPageInner />
    </Suspense>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchProfileRedirectInfoById } from '@/lib/repositories/starkRepository'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function ConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const code = searchParams.get('code')
        const tokenHash = searchParams.get('token_hash')
        const token = searchParams.get('token')
        const type = searchParams.get('type') || 'signup'
        const email = searchParams.get('email')
        const hash = typeof window !== 'undefined' ? window.location.hash : ''
        const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            if (!cancelled) setStatus('error')
            return
          }
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            if (!cancelled) setStatus('error')
            return
          }
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change' | 'email',
          })
          if (error) {
            if (!cancelled) setStatus('error')
            return
          }
        } else if (token && email) {
          const { error } = await supabase.auth.verifyOtp({
            token,
            type: type as 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change' | 'email',
            email,
          })
          if (error) {
            if (!cancelled) setStatus('error')
            return
          }
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) setStatus('error')
          return
        }

        if (!cancelled) setStatus('success')

        try {
          const pendingToken = sessionStorage.getItem('pending_invite_token')
          if (pendingToken) {
            setTimeout(() => router.replace(`/accept-invite?token=${pendingToken}`), 1500)
            return
          }
        } catch {}

        const { data: profile } = await fetchProfileRedirectInfoById(user.id)

        if (profile?.role === 'studierektor') {
          const needsSetup = !String((profile as any).name || '').trim()

          setTimeout(
            () => router.replace(needsSetup ? '/studierektor-profile?setup=1' : '/studierektor'),
            1500
          )
          return
        }

        setTimeout(() => router.replace('/profile?setup=1'), 1500)
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm text-center">
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-5 animate-pulse">
              <svg className="w-8 h-8 text-sky-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Verifierar...</h1>
            <p className="text-sm text-slate-500">Vi bekräftar din e-postadress.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-green-800 mb-2">E-post bekräftad!</h1>
            <p className="text-sm text-slate-600">Ditt konto är aktiverat. Du skickas vidare om en stund...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-red-800 mb-2">Något gick fel</h1>
            <p className="text-sm text-slate-600 mb-6">
              Verifieringslänken kan ha gått ut. Försök registrera dig igen eller logga in om du redan har bekräftat.
            </p>
            <div className="space-y-2">
              <Link
                href="/auth"
                className="block w-full bg-sky-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-sky-700 transition"
              >
                Logga in
              </Link>
              <Link
                href="/auth/signup"
                className="block w-full bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
              >
                Registrera igen
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

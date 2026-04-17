'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function SignUpPageInner() {
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email')
  const [email, setEmail] = useState(emailParam || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'check-email'>('form')
  const [error, setError] = useState('')

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [emailParam])

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken.')
      return
    }

    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte.')
      return
    }

    setLoading(true)

    console.log('Attempting signup with:', email)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })

    console.log('Signup response:', { data, error: signUpError })

    if (signUpError) {
      console.error('Signup error:', signUpError)
      if (signUpError.message.includes('already registered')) {
        setError('Den här e-postadressen har redan ett konto. Försök logga in istället.')
      } else if (signUpError.message.toLowerCase().includes('email rate limit exceeded')) {
        setError('För många verifieringsmail har skickats. Använd dev-länkgeneratorn nedan för att testa verifieringssidan lokalt.')
      } else {
        setError(signUpError.message)
      }
      setLoading(false)
      return
    }

    console.log('Signup successful, showing check-email step')
    setStep('check-email')
    setLoading(false)
  }

  if (step === 'check-email') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-sky-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Bekräfta din e-post</h1>
          <p className="text-sm text-slate-600 mb-2">
            Vi har skickat ett verifieringsmail till:
          </p>
          <p className="text-sm font-medium text-slate-900 mb-4">{email}</p>
          <p className="text-sm text-slate-500 mb-6">
            Klicka på länken i mailet för att aktivera ditt konto. Kolla även skräpposten om du inte hittar det.
          </p>
          <Link
            href="/auth"
            className="inline-block w-full bg-sky-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-sky-700 transition"
          >
            Tillbaka till inloggningen
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Skapa konto</h1>
          <p className="text-sm text-slate-500 mt-1">Registrera dig för att använda ST-ARK</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 mb-1">
              E-post
            </label>
            <input
              id="signup-email"
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
            <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 mb-1">
              Lösenord
            </label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              placeholder="Minst 6 tecken"
            />
          </div>

          <div>
            <label htmlFor="signup-confirm" className="block text-sm font-medium text-slate-700 mb-1">
              Bekräfta lösenord
            </label>
            <input
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              placeholder="Skriv lösenordet igen"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Skapar konto...' : 'Skapa konto'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-600">
            Har du redan ett konto?{' '}
            <Link href="/auth" className="text-sky-600 font-medium hover:text-sky-700 hover:underline">
              Logga in
            </Link>
          </p>
          {process.env.NODE_ENV !== 'production' && (
            <p className="mt-3 text-xs text-slate-500">
              Behöver du testa verifieringslänken utan mail?{' '}
              <Link href="/auth/dev-verification" className="text-sky-600 hover:underline">
                Öppna dev-verktyget
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-slate-500">Laddar...</div>}>
      <SignUpPageInner />
    </Suspense>
  )
}

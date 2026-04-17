'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function DevVerificationPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ actionLink: string | null; redirectTo: string | null } | null>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/dev/generate-verification-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json?.error || 'Kunde inte generera verifieringslänk.')
      } else {
        setResult({
          actionLink: json?.actionLink || null,
          redirectTo: json?.redirectTo || null,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okänt fel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Dev: verifieringslänk</h1>
          <p className="text-sm text-slate-500 mt-1">
            Generera en färsk signup-länk utan att skicka mail.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label htmlFor="dev-email" className="block text-sm font-medium text-slate-700 mb-1">
              E-post
            </label>
            <input
              id="dev-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="din.epost@exempel.se"
            />
          </div>

          <div>
            <label htmlFor="dev-password" className="block text-sm font-medium text-slate-700 mb-1">
              Lösenord
            </label>
            <input
              id="dev-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Minst 6 tecken"
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
            className="w-full bg-sky-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? 'Genererar...' : 'Generera verifieringslänk'}
          </button>
        </form>

        {result?.actionLink && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-800">Verifieringslänk skapad</p>
            <a
              href={result.actionLink}
              className="block w-full text-center bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700"
            >
              Öppna verifieringslänk
            </a>
            <textarea
              readOnly
              value={result.actionLink}
              className="w-full h-28 rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-700"
            />
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-slate-200 text-center">
          <Link href="/auth/signup" className="text-sm text-sky-600 hover:underline">
            Tillbaka till vanlig registrering
          </Link>
        </div>
      </div>
    </div>
  )
}

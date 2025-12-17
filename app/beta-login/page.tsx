//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BetaLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Kontrollera om användaren redan är inloggad
    if (typeof window !== "undefined") {
      const isAuthenticated = sessionStorage.getItem("beta_authenticated") === "true";
      if (isAuthenticated) {
        router.push("/");
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Hämta lösenordet från API (lagrat i miljövariabel på servern)
      const response = await fetch("/api/beta-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Spara autentisering i sessionStorage
        sessionStorage.setItem("beta_authenticated", "true");
        router.push("/");
      } else {
        setError(data.error || "Felaktigt lösenord");
      }
    } catch (err) {
      setError("Ett fel uppstod. Försök igen.");
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitting(true);
    setContactError("");
    setContactSuccess(false);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setContactError(data.error || "Ett fel uppstod");
        return;
      }

      setContactSuccess(true);
      setContactForm({ name: "", email: "", message: "" });
    } catch (error) {
      console.error("Kontaktformulär fel:", error);
      setContactError("Ett fel uppstod när meddelandet skulle skickas");
    } finally {
      setContactSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-emerald-50 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="text-sky-700">ST</span>
            <span className="text-emerald-700">ARK</span>
          </h1>
          <p className="mt-2 text-sm font-semibold text-sky-600">Beta-version</p>
        </div>

        {/* Beskrivning */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-lg font-bold text-amber-900">Välkommen till ST-ARK Beta</h2>
          <p className="mb-3 text-sm text-amber-800">
            ST-ARK är ett verktyg för dokumentation och planering av läkarnas specialiseringstjänstgöring. 
            Applikationen hjälper dig att planera, dokumentera och följa upp din ST-utbildning.
          </p>
          <div className="rounded border border-amber-300 bg-white p-3">
            <p className="text-xs font-semibold text-amber-900">⚠️ Under utveckling</p>
            <p className="mt-1 text-xs text-amber-800">
              Denna version är under utveckling med ett begränsat antal testanvändare. Om du vill bidra till testning eller få meddelande om när appen finns tillgänglig:{" "}
              <button
                type="button"
                onClick={() => setShowContactForm(!showContactForm)}
                className="font-semibold text-sky-600 underline hover:text-sky-700"
              >
                fyll i din e-postadress i formuläret
              </button>
            </p>
          </div>
        </div>

        {/* Inloggningsformulär */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-semibold text-slate-700">
              Lösenord för testning
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="h-[44px] w-full rounded-lg border border-slate-300 px-4 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              placeholder="Ange lösenord"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? "Loggar in..." : "Logga in"}
          </button>
        </form>

        {/* Kontaktformulär */}
        {showContactForm && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-base font-bold text-slate-900">Kontakta oss</h3>
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Namn
                </label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  required
                  className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  E-postadress
                </label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  required
                  className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Meddelande
                </label>
                <textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  required
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              {contactError && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                  {contactError}
                </div>
              )}
              {contactSuccess && (
                <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-700">
                  Meddelandet har skickats! Du får svar så snart som möjligt.
                </div>
              )}
              <button
                type="submit"
                disabled={contactSubmitting}
                className="w-full inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
              >
                {contactSubmitting ? "Skickar..." : "Skicka meddelande"}
              </button>
            </form>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-500">
          För frågor eller feedback, kontakta utvecklaren via kontaktformuläret.
        </p>
      </div>
    </div>
  );
}

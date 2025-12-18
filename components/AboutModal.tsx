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

import React, { useState, useEffect } from "react";
import { aboutContent } from "@/lib/aboutContent";

type TabId = "instruction" | "about" | "contact" | "download" | "privacy" | "license";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AboutModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<TabId>("instruction");
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState("");

  const handleRequestClose = () => {
    setContactForm({ name: "", email: "", message: "" });
    setContactSuccess(false);
    setContactError("");
    onClose();
  };

  // ESC för att stänga
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleRequestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleRequestClose]);

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

      // Om mailto-länk finns (fallback), öppna den, annars visa success-meddelande
      if (data.mailtoLink) {
        window.location.href = data.mailtoLink;
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleRequestClose();
      }}
    >
      <div
        className="w-full max-w-[980px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        data-modal-panel
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-lg font-extrabold">Om</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRequestClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            >
              Stäng
            </button>
          </div>
        </header>

        {/* Tabs */}
        <nav className="flex gap-1 border-b bg-slate-50 px-2 pt-2">
          {[
            { id: "instruction", label: "Instruktion" },
            { id: "about", label: "Upphov och syfte" },
            { id: "download", label: "Ladda ned projektet" },
            { id: "privacy", label: "Integritet och dataskydd" },
            { id: "license", label: "Licensvillkor" },
            { id: "contact", label: "Kontakt" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as TabId)}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:outline-none ${
                tab === t.id
                  ? "bg-white text-slate-900 border-x border-t border-slate-200 -mb-px"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <section className="max-h-[75vh] overflow-auto p-4">
          {tab === "instruction" && (
            <div className="space-y-4">
              <p className="text-slate-700">{aboutContent.instruction.text}</p>
            </div>
          )}

          {tab === "about" && (
            <div className="space-y-4 text-slate-700">
              {aboutContent.about.paragraphs.map((paragraph, index) => (
                <p key={index}>
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {tab === "contact" && (
            <div className="space-y-4">
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
                    className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                    className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
                >
                  {contactSubmitting ? "Skickar..." : "Skicka meddelande"}
                </button>
              </form>
            </div>
          )}

          {tab === "download" && (
            <div className="space-y-4 text-slate-700">
              <p>{aboutContent.download.intro}</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-2 text-sm font-extrabold text-slate-900">
                  {aboutContent.download.steps.title}
                </h3>
                <ol className="list-decimal space-y-2 pl-5">
                  {aboutContent.download.steps.items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ol>
                <div className="mt-3 rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm">
                  {aboutContent.download.steps.exampleText}
                </div>
              </div>
              <div className="mt-4">
                <a
                  href={aboutContent.download.githubZipUrl}
                  download
                  className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
                >
                  Ladda ned projektet (ZIP)
                </a>
              </div>
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-4 text-slate-700">
              {aboutContent.privacy.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          )}

          {tab === "license" && (
            <div className="space-y-4 text-slate-700">
              <p>{aboutContent.license.intro}</p>
              <ul className="list-disc space-y-2 pl-5">
                {aboutContent.license.points.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
              <p>
                Den fullständiga licenstexten finns i filen{" "}
                <a
                  href={aboutContent.license.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:text-sky-700 underline"
                >
                  LICENSE
                </a>{" "}
                i projektets rotkatalog.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

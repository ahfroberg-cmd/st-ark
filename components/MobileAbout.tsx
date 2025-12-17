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

import React, { useState, useRef } from "react";
import { aboutContent } from "@/lib/aboutContent";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function MobileAbout({ open, onClose }: Props) {
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState("");
  const overlayRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleRequestClose = () => {
    setContactForm({ name: "", email: "", message: "" });
    setContactSuccess(false);
    setContactError("");
    onClose();
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
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-sky-50 px-5 py-4">
          <h1 className="text-xl font-extrabold text-sky-900">Om</h1>
          <button
            onClick={handleRequestClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px shrink-0"
          >
            ✕
          </button>
        </header>

        {/* Content - Scrollbar lista med sektioner */}
        <div className="flex-1 overflow-y-auto">
          {/* Instruktion */}
          <section className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-3">Instruktion</h2>
            <p className="text-slate-700">{aboutContent.instruction.text}</p>
          </section>

          {/* Upphov och syfte */}
          <section className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-3">Upphov och syfte</h2>
            <div className="max-h-[300px] overflow-y-auto space-y-3 text-slate-700">
              {aboutContent.about.paragraphs.map((paragraph, index) => (
                <p key={index}>
                  {paragraph}
                </p>
              ))}
            </div>
          </section>

          {/* Integritet och dataskydd */}
          <section className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-3">Integritet och dataskydd</h2>
            <div className="space-y-3 text-slate-700">
              {aboutContent.privacy.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>

          {/* Licensvillkor */}
          <section className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-3">Licensvillkor</h2>
            <div className="space-y-3 text-slate-700">
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
          </section>

          {/* Kontakt */}
          <section className="px-5 py-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-3">Kontakt</h2>
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
                  className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
          </section>

        </div>
      </div>
    </div>
  );
}

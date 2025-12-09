// ============================ app/page.tsx ============================
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";

export default function HomePage() {
  const router = useRouter();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function pickFile() {
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setImporting(true);
    try {
      const txt = await f.text();
      const data = JSON.parse(txt);

      const p = data.profile ?? data?.Profile ?? data?.prof ?? null;
      const placements = data.placements ?? data?.Placements ?? [];
      const courses = data.courses ?? data?.Courses ?? [];
      const achievements = data.achievements ?? data?.Achievements ?? [];

      if (p) await (db as any).profile?.put?.({ id: "default", ...(p.id ? p : { ...p, id: "default" }) });
      if (Array.isArray(placements)) for (const pl of placements) { try { await (db as any).placements?.put?.(pl); } catch {} }
      if (Array.isArray(courses))    for (const c of courses)    { try { await (db as any).courses?.put?.(c); } catch {} }
      if (Array.isArray(achievements))for (const a of achievements){ try { await (db as any).achievements?.put?.(a); } catch {} }

      router.replace("/planera-st");
    } catch (err) {
      console.error(err);
      alert("Kunde inte läsa JSON-filen.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-[100dvh] max-w-[960px] flex-col items-center justify-center px-6 py-10 text-slate-900">
      {/* Om-knapp uppe till höger */}
      <button
        onClick={() => setAboutOpen(true)}
        className="absolute right-6 top-6 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
      >
        Om
      </button>

      <h1 className="mb-2 text-center text-7xl font-extrabold tracking-tight">
  <span className="text-sky-700">ST</span>
  <span className="text-emerald-700">ARK</span>
</h1>

      <p className="mb-8 max-w-[640px] text-center text-slate-600">
        Välj att starta en ny arbetsyta eller fortsätta på tidigare arbete genom att ladda upp en JSON-fil.
      </p>

      <div className="grid w-full max-w-[720px] grid-cols-1 gap-4 md:grid-cols-2">
        {/* 1) Ny arbetsyta (tidigare “session”) */}
        <button
          onClick={() => router.push("/profile?setup=1")}
          className="h-[140px] rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-lg"
        >
          <div className="text-lg font-extrabold">Ny arbetsyta</div>
          <p className="mt-1 text-slate-600">Fyll i profil och börja planera din ST.</p>
        </button>

        {/* 2) Fortsätt tidigare arbete */}
        <button
          onClick={pickFile}
          className="h-[140px] rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-lg disabled:opacity-60"
          disabled={importing}
        >
          <div className="text-lg font-extrabold">Fortsätt tidigare arbete</div>
          <p className="mt-1 text-slate-600">Ladda upp din JSON-fil och fortsätt i tidslinjen.</p>
          {importing && <div className="mt-3 text-sm text-slate-500">Laddar…</div>}
        </button>
      </div>

      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />

      {/* About modal */}
      {aboutOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setAboutOpen(false)}>
          <div
            className="max-h-[90dvh] w-full max-w-[720px] overflow-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-extrabold">Om ST-ark</h2>
              <button
                onClick={() => setAboutOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-semibold hover:bg-slate-50"
              >
                Stäng
              </button>
            </div>
            <p className="leading-relaxed text-slate-700">
              Allt lagras lokalt i din webbläsare (IndexedDB). Ingen inloggning, ingen server. För att flytta eller
              säkerhetskopiera: Exportera/Importera JSON.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

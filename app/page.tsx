// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchProfileById, getAuthenticatedUserId } from "@/lib/repositories/starkRepository";
import dynamic from "next/dynamic";
import { getDefaultRouteForRole } from "@/lib/routing/roleRoutes";

const AboutModal = dynamic(() => import("@/components/AboutModal"), { ssr: false });

export default function HomePage() {
  const router = useRouter();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    let mounted = true;
    getAuthenticatedUserId().then(async (userId) => {
      if (!mounted) return;
      if (!userId) {
        router.replace("/auth");
        return;
      }
      const { data: profile } = await fetchProfileById(userId);
      if (!mounted) return;
      
      if (!profile) {
        router.replace("/profile?setup=1");
        return;
      }

      const studierektorNeedsSetup =
        profile.role === "studierektor" &&
        !String((profile as any).name || "").trim();

      if (studierektorNeedsSetup) {
        router.replace("/studierektor-profile?setup=1");
        return;
      }

      // Redirecta baserat på roll
      router.replace(getDefaultRouteForRole(String(profile.role || "st_lakare")));
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  if (isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent"></div>
          <p className="text-sm text-slate-600">Laddar...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-[100dvh] max-w-[960px] flex-col items-center justify-center px-6 py-10 text-slate-900">
      {/* Om-knapp uppe till höger */}
      <button
        onClick={() => setAboutOpen(true)}
        className="absolute right-6 top-6 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
        data-info="Öppnar informationsfönster med instruktioner, information om projektet, kontaktuppgifter, integritetspolicy och licensvillkor."
      >
        Om
      </button>

      <button
        onClick={() => router.push("/")}
        className="mb-2 select-none caret-transparent text-center text-7xl font-extrabold tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span className="text-sky-700">ST</span>
        <span className="text-emerald-700">ARK</span>
      </button>

      <p className="mb-8 max-w-[640px] text-center text-slate-600">
        Logga in eller skapa konto för att börja. All data sparas i ditt konto.
      </p>

      <div className="grid w-full max-w-[720px] grid-cols-1 gap-4 md:grid-cols-2">
        <button
          onClick={() => router.push("/auth")}
          className="min-h-[140px] rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-lg flex flex-col"
        >
          <div className="text-lg font-extrabold">Logga in / Skapa konto</div>
          <p className="mt-1 text-slate-600">Skapa användare och spara allt direkt i Supabase.</p>
        </button>

        <button
          onClick={() => router.push("/studierektor")}
          className="min-h-[140px] rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-lg flex flex-col"
        >
          <div className="text-lg font-extrabold">Studierektor/<br />Handledare</div>
          <p className="mt-1 text-slate-600">Följ flera ST-läkare samtidigt.</p>
        </button>
      </div>

      {/* About modal */}
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </main>
  );
}

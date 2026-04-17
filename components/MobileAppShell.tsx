// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { exportAll, downloadJson } from "@/lib/backup";
import { supabase } from "@/lib/supabase";
import MobileHome from "./MobileHome";
import MobilePlacements from "./MobilePlacements";
import MobileCourses from "./MobileCourses";
import MobileProfile from "./MobileProfile";
import MobileIup from "./MobileIup";
import MobileAbout from "./MobileAbout";
import { useMobileProfile } from "@/lib/hooks/useMobileData";
import MobileRoleWorkspace from "./MobileRoleWorkspace";
import MobileHemklinik from "./MobileHemklinik";

const ScanIntygModal = dynamic(
  () => import("@/components/ScanIntygModal"),
  { ssr: false }
);


type TabKey =
  | "home"
  | "placements"
  | "courses"
  | "iup"
  | "hemklinik"
  | "role"
  | "sr-st-lakare"
  | "sr-handledare"
  | "sr-klinik";

const BASE_TABS: { id: Exclude<TabKey, "role">; label: string; info: string }[] = [
  { id: "home",       label: "Hem", info: "Växlar till startsidan där du kan se en översikt över din utbildning, tidslinje och snabbåtkomst till viktiga funktioner som att skanna intyg eller förbereda ansökningar." },
  { id: "placements", label: "Tjänstgöring", info: "Växlar till vyn för klinisk tjänstgöring där du kan se, lägga till och redigera alla dina kliniska tjänstgöringar, auskultationer, arbeten och ledighet." },
  { id: "courses",    label: "Kurser", info: "Växlar till vyn för kurser där du kan se, lägga till och redigera alla dina kurser och utbildningsmoment." },
  { id: "iup",        label: "IUP", info: "Växlar till IUP-vyn (Individuell utbildningsplan) där du kan hantera planering, handledarsamtal, progressionsbedömningar och delmål." },
  { id: "hemklinik",  label: "Hemklinik", info: "Växlar till hemklinik med kommunikation, kollegor och aktivitetsförslag." },
];

export default function MobileAppShell() {
  const { profile } = useMobileProfile();
  const role = String((profile as any)?.role || "st_lakare");
  const isStRole = role === "st_lakare";
  const roleTab =
    role === "studierektor"
      ? ({
          id: "role" as const,
          label: "Klinik",
          info: "Växlar till mobil klinikvy för studierektor med medlemmar och inbjudningar.",
        })
      : role === "huvudhandledare"
      ? ({
          id: "role" as const,
          label: "ST-läkare",
          info: "Växlar till mobil handledarvy med tilldelade ST-läkare.",
        })
      : null;
  const studierektorTabs =
    role === "studierektor"
      ? [
          { id: "sr-st-lakare" as const, label: "ST-läkare", info: "Visa och öppna ST-läkare." },
          { id: "sr-handledare" as const, label: "Handledare", info: "Huvudhandledare och inbjudningar." },
          { id: "sr-klinik" as const, label: "Klinik", info: "Klinikmedlemmar och väntande inbjudningar." },
        ]
      : null;
  const tabs = isStRole ? BASE_TABS : studierektorTabs ? studierektorTabs : roleTab ? [roleTab] : BASE_TABS;
  const [tab, setTab] = useState<TabKey>(
    isStRole ? "home" : role === "studierektor" ? "sr-st-lakare" : "role"
  );
  const [scanOpen, setScanOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    // Rollstyrd mobilnavigering:
    // ST-läkare använder full ST-flikrad, övriga roller går direkt till rollarbetsyta.
    if (isStRole) {
      if (
        tab === "role" ||
        tab === "sr-st-lakare" ||
        tab === "sr-handledare" ||
        tab === "sr-klinik"
      ) {
        setTab("home");
      }
      return;
    }
    if (role === "studierektor") {
      if (!["sr-st-lakare", "sr-handledare", "sr-klinik"].includes(tab)) {
        setTab("sr-st-lakare");
      }
      return;
    }
    if (tab !== "role") setTab("role");
  }, [isStRole, role, tab]);

  async function handleExport() {
    setExporting(true);
    try {
      const bundle = await exportAll();
      
      // Hämta namn från profilen
      const profileName = bundle.profile?.name || 
                         (bundle.profile?.firstName && bundle.profile?.lastName 
                           ? `${bundle.profile.firstName} ${bundle.profile.lastName}`.trim()
                           : "Användare");
      
      // Gör namnet filsystem-säkert (ersätt specialtecken med bindestreck)
      const safeName = profileName
        .replace(/[^a-zA-Z0-9åäöÅÄÖ\s-]/g, '') // Ta bort ogiltiga tecken
        .replace(/\s+/g, '-') // Ersätt mellanslag med bindestreck
        .replace(/-+/g, '-') // Ta bort dubbla bindestreck
        .replace(/^-|-$/g, ''); // Ta bort bindestreck i början/slutet
      
      // Datum i format YYMMDD
      const dateStr = new Date().toISOString().slice(0, 10);
      const d = dateStr.slice(2, 4) + dateStr.slice(5, 7) + dateStr.slice(8, 10);
      
      const filename = `ST-ARK-${safeName}-${d}.json`;
      await downloadJson(bundle, filename);
    } catch (e) {
      console.error(e);
      alert("Kunde inte spara filen.");
    } finally {
      setExporting(false);
    }
  }

  async function handleLogout() {
    const ok = window.confirm("Logga ut?");
    if (!ok) return;
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="text-sky-700">ST</span>
          <span className="text-emerald-700">ARK</span>
        </h1>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:translate-y-px"
          >
            Meny
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 z-20 min-w-[180px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleExport();
                }}
                disabled={exporting}
                className={
                  isStRole
                    ? "block w-full rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-left text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 disabled:opacity-60"
                    : "block w-full rounded-lg border border-sky-300 bg-sky-100 px-3 py-2 text-left text-sm font-semibold text-sky-800 hover:bg-sky-200 disabled:opacity-60"
                }
              >
                {exporting ? "Sparar..." : "Spara"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileOpen(true);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Profil
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setAboutOpen(true);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Om
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                Logga ut
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-3 pb-16">
        {isStRole && tab === "home" && (
          <MobileHome
            onOpenScan={() => setScanOpen(true)}
            onProfileLoaded={undefined}
          />
        )}

        {isStRole && tab === "placements" && <MobilePlacements />}

        {isStRole && tab === "courses" && <MobileCourses />}

        {isStRole && tab === "iup" && <MobileIup />}

        {isStRole && tab === "hemklinik" && <MobileHemklinik />}

        {role === "studierektor" && (
          <MobileRoleWorkspace
            forcedStudierektorTab={
              tab === "sr-handledare"
                ? "huvudhandledare"
                : tab === "sr-klinik"
                ? "klinik"
                : "st-lakare"
            }
          />
        )}
        {!isStRole && role !== "studierektor" && <MobileRoleWorkspace />}
        {isStRole && tab === "role" && <MobileRoleWorkspace />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-stretch justify-between">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={[
                  "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium",
                  active
                    ? "text-emerald-700"
                    : "text-slate-900 hover:text-slate-700",
                ].join(" ")}
                data-info={t.info}
              >
                <span
                  className={[
                    "mb-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px]",
                    active
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-300 bg-slate-50",
                  ].join(" ")}
                >
                  {t.label[0]}
                </span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {isStRole && (
        <ScanIntygModal
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onSaved={undefined}
          goalsVersion={profile?.goalsVersion}
        />
      )}

      <MobileProfile
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      <MobileAbout
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />
    </div>
  );
}

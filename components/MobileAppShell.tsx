"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { exportAll, downloadJson } from "@/lib/backup";
import MobileHome from "./MobileHome";
import MobilePlacements from "./MobilePlacements";
import MobileCourses from "./MobileCourses";
import MobileProfile from "./MobileProfile";
import MobileIup from "./MobileIup";

const ScanIntygModal = dynamic(
  () => import("@/components/ScanIntygModal"),
  { ssr: false }
);


type TabKey = "home" | "placements" | "courses" | "iup";

const TABS: { id: TabKey; label: string }[] = [
  { id: "home",       label: "Hem" },
  { id: "placements", label: "Tjänstgöring" },
  { id: "courses",    label: "Kurser" },
  { id: "iup",        label: "IUP" },
];

export default function MobileAppShell() {
  const [tab, setTab] = useState<TabKey>("home");
  const [scanOpen, setScanOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const bundle = await exportAll();
      const d = new Date().toISOString().slice(0, 10);
      await downloadJson(bundle, `st-intyg-backup-${d}.json`);
    } catch (e) {
      console.error(e);
      alert("Kunde inte spara filen.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <span className="text-sky-700">ST</span>
          <span className="text-emerald-700">ARK</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-700 bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 active:translate-y-px disabled:opacity-50"
            title="Spara (JSON-backup)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-2-2Zm0 2v3H7V5h10ZM7 10h10v9H7v-9Z"/>
            </svg>
            {exporting ? "Sparar..." : "Spara"}
          </button>
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:translate-y-px"
          >
            Profil
          </button>
          <button
            type="button"
            onClick={() => {
              // TODO: Implementera Om-modal
            }}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:translate-y-px"
          >
            Om
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-3 pb-16">
        {tab === "home" && (
          <MobileHome
            onOpenScan={() => setScanOpen(true)}
            onProfileLoaded={setHasProfile}
          />
        )}

        {tab === "placements" && <MobilePlacements />}

        {tab === "courses" && <MobileCourses />}

        {tab === "iup" && <MobileIup />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-stretch justify-between">
          {TABS.map((t) => {
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

      <ScanIntygModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onSaved={undefined}
        goalsVersion={undefined}
      />

      <MobileProfile
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </div>
  );
}

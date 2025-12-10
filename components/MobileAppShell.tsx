"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import MobileHome from "./MobileHome";
import MobilePlacements from "./MobilePlacements";
import MobileCourses from "./MobileCourses";

const ScanIntygModal = dynamic(
  () => import("@/components/ScanIntygModal"),
  { ssr: false }
);

const IupModal = dynamic(
  () => import("@/components/IupModal"),
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
  const [iupOpen, setIupOpen] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  const title =
    tab === "home"
      ? hasProfile === false
        ? "Ladda upp fil"
        : "ST-översikt"
      : tab === "placements"
      ? "Kliniska tjänstgöringar"
      : tab === "courses"
      ? "Kurser"
      : "IUP & bedömningar";

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 active:translate-y-px"
          title="Profil"
        >
          P
        </button>
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

        {tab === "iup" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Här hanteras handledarsamtal och progressionsbedömningar.
            </div>
            <button
              type="button"
              onClick={() => setIupOpen(true)}
              className="w-full rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm active:translate-y-px"
            >
              Öppna IUP
            </button>
          </div>
        )}
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
                    : "text-slate-500 hover:text-slate-700",
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

      <IupModal
        open={iupOpen}
        onClose={() => setIupOpen(false)}
      />
    </div>
  );
}

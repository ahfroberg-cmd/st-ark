"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { db } from "@/lib/db";
import PusslaDinST from "@/components/PusslaDinST";

const WelcomeModal = dynamic(() => import("@/components/WelcomeModal"), { ssr: false });

function PlaneraSTPageInner() {
  const params = useSearchParams();
  const startParam = params.get("start");
  const startYear = startParam ? Number(startParam) : undefined;
  const initialStartYear =
    Number.isFinite(startYear) && startYear! >= 1990 && startYear! <= 2100
      ? (startYear as number)
      : undefined;

  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [goalsVersion, setGoalsVersion] = useState<"2015" | "2021" | null>(null);

  // Kolla om välkomstmeddelandet ska visas första gången
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkWelcome = async () => {
      try {
        // Kolla om användaren redan har sett välkomstmeddelandet
        const hasSeenWelcome = localStorage.getItem("st-ark-welcome-seen") === "true";
        if (hasSeenWelcome) return;

        // Kolla om det finns en profil i databasen (dvs användaren har sparat sin första profil)
        const profile = await db.profile.get("default");
        if (profile) {
          // Spara goalsVersion för att visa rätt text
          const gv = (profile as any)?.goalsVersion;
          if (gv === "2015" || gv === "2021") {
            setGoalsVersion(gv);
          } else {
            // Default till 2021 om inget anges
            setGoalsVersion("2021");
          }
          
          // Det finns en profil, visa välkomstmeddelandet första gången
          const timer = setTimeout(() => {
            setWelcomeOpen(true);
          }, 500); // Vänta lite så att sidan har laddats klart
          return () => clearTimeout(timer);
        }
      } catch (error) {
        console.error("Error checking welcome modal:", error);
      }
    };

    checkWelcome();
  }, []);

  return (
    <main className="p-4 md:p-6">
      <PusslaDinST initialStartYear={initialStartYear} />
      <WelcomeModal 
        open={welcomeOpen} 
        onClose={() => setWelcomeOpen(false)}
        goalsVersion={goalsVersion}
      />
    </main>
  );
}

export default function PlaneraSTPage() {
  return (
    <Suspense fallback={null}>
      <PlaneraSTPageInner />
    </Suspense>
  );
}

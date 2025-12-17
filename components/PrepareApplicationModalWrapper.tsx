// components/PrepareApplicationModalWrapper.tsx
"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/db";
import type { Profile } from "@/lib/types";
import dynamic from "next/dynamic";

// Dynamiska imports för de två versionerna
const PrepareApplicationModal2015 = dynamic(
  () => import("@/components/PrepareApplicationModal2015"),
  { ssr: false }
);

const PrepareApplicationModal2021 = dynamic(
  () => import("@/components/PrepareApplicationModal2021"),
  { ssr: false }
);

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PrepareApplicationModalWrapper({ open, onClose }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (open) {
      // Hämta profil från databasen
      (async () => {
        try {
          const p = await (db as any).profile?.get?.("default");
          setProfile(p || null);
        } catch (err) {
          console.error("Kunde inte hämta profil:", err);
          setProfile(null);
        }
      })();
    }
  }, [open]);

  // Bestäm vilken version som ska användas baserat på profilens goalsVersion
  const goalsVersion = profile?.goalsVersion?.toString() || "";
  const is2021 = goalsVersion.includes("2021");

  if (is2021) {
    return <PrepareApplicationModal2021 open={open} onClose={onClose} />;
  }

  return <PrepareApplicationModal2015 open={open} onClose={onClose} />;
}

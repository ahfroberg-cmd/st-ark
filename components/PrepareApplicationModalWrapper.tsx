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

type Props = { open: boolean; onClose: () => void };

export default function PrepareApplicationModalWrapper({ open, onClose }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const p = await db.profile.get("default");
        setProfile(p ?? null);
      } catch (err) {
        console.error("Kunde inte ladda profil:", err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // Bestäm om det är 2015 eller 2021
  // Om goalsVersion är "2015" eller saknas helt (default), använd 2015
  // Annars använd 2021
  const goalsVersionStr = (profile?.goalsVersion || "").toString().toLowerCase();
  const is2015 = goalsVersionStr === "2015" || (!profile?.goalsVersion && !loading);

  if (loading) {
    return null; // eller en loading-indikator
  }

  if (is2015) {
    return <PrepareApplicationModal2015 open={open} onClose={onClose} />;
  }

  return <PrepareApplicationModal2021 open={open} onClose={onClose} />;
}


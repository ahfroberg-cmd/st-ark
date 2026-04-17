// components/PrepareApplicationModalWrapper.tsx
"use client";

import React, { useEffect, useState } from "react";
import type { Profile } from "@/lib/types";
import dynamic from "next/dynamic";
import { useProfile } from "@/lib/hooks/useSupabaseData";

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
  const { profile: hookProfile } = useProfile();

  useEffect(() => {
    if (open) {
      setProfile((hookProfile as any) || null);
    }
  }, [open, hookProfile]);

  // Bestäm vilken version som ska användas baserat på profilens goalsVersion
  const goalsVersion = ((profile as any)?.goalsVersion ?? (profile as any)?.goals_version ?? "").toString();
  const is2021 = goalsVersion.includes("2021");

  if (is2021) {
    return <PrepareApplicationModal2021 open={open} onClose={onClose} />;
  }

  return <PrepareApplicationModal2015 open={open} onClose={onClose} />;
}

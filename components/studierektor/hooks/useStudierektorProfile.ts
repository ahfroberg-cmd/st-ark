"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SPECIALTIES } from "@/lib/swedishSpecialties";
import {
  fetchProfileSrContactFields,
  upsertProfilePayload,
} from "@/lib/repositories/starkRepository";
import type { StudierektorProfileData } from "@/components/studierektor/StudierektorProfileModal";

export function useStudierektorProfile() {
  const [srProfileOpen, setSrProfileOpen] = useState(false);
  const [srProfile, setSrProfile] = useState<StudierektorProfileData>({
    name: "",
    sr_specialty: "",
    sr_for_specialty: "",
    email: "",
    mobile: "",
    phone_work: "",
    address: "",
    postal_code: "",
    city: "",
    personal_number: "",
  });
  const [srProfileSaving, setSrProfileSaving] = useState(false);

  const toSpecialtySlug = useCallback((s: string) => {
    const raw = String(s || "").trim().toLowerCase();
    const noDia = raw
      .replace(/[å]/g, "a")
      .replace(/[ä]/g, "a")
      .replace(/[ö]/g, "o")
      .replace(/[Å]/g, "a")
      .replace(/[Ä]/g, "a")
      .replace(/[Ö]/g, "o");
    return noDia
      .replace(/&/g, "och")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\u00c0-\u024f-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }, []);

  const matchSpecialtyLabel = useCallback(
    (value: string) => {
      const vSlug = toSpecialtySlug(value);
      const found = SPECIALTIES.find((s) => toSpecialtySlug(s) === vSlug);
      return found || value || "";
    },
    [toSpecialtySlug]
  );

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) return;
        const { data: prof } = await fetchProfileSrContactFields(user.id);
        if (prof) {
          const p: StudierektorProfileData = {
            name: prof.name || "",
            sr_specialty: (prof as any).sr_specialty || "",
            sr_for_specialty: matchSpecialtyLabel((prof as any).sr_for_specialty || ""),
            email: (prof as any).email || "",
            mobile: (prof as any).mobile || "",
            phone_work: (prof as any).phone_work || "",
            address: (prof as any).address || "",
            postal_code: (prof as any).postal_code || "",
            city: (prof as any).city || "",
            personal_number: (prof as any).personal_number || "",
          };
          setSrProfile(p);
          if (!p.name || !p.sr_for_specialty) setSrProfileOpen(true);
        } else {
          setSrProfileOpen(true);
        }
      } catch {
        // ignore
      }
    })();
  }, [matchSpecialtyLabel]);

  const saveSrProfile = useCallback(async () => {
    setSrProfileSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;
      await upsertProfilePayload({
        id: user.id,
        name: srProfile.name,
        sr_specialty: srProfile.sr_specialty,
        sr_for_specialty: srProfile.sr_for_specialty,
        email: srProfile.email,
        mobile: srProfile.mobile,
        phone_work: srProfile.phone_work,
        address: srProfile.address,
        postal_code: srProfile.postal_code,
        city: srProfile.city,
        personal_number: srProfile.personal_number,
      });
      setSrProfileOpen(false);
    } catch {
      // ignore
    } finally {
      setSrProfileSaving(false);
    }
  }, [srProfile]);

  return {
    srProfileOpen,
    setSrProfileOpen,
    srProfile,
    setSrProfile,
    srProfileSaving,
    saveSrProfile,
  };
}

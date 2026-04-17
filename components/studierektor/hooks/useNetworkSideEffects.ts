"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Dispatch, SetStateAction } from "react";
import type {
  NetworkClinic,
  NetworkGroup,
  NetworkParticipant,
} from "@/lib/studierektor/networkTypes";

export function useNetworkSideEffects({
  networkCurrentUserId,
  setNetworkCurrentUserId,
  setNetworkGroups,
  networkGroupOpen,
  networkActiveGroupId,
  networkGroups,
  setNetworkGroupOpen,
  setNetworkActiveGroupId,
  networkOpen,
  setNetworkLoadingClinics,
  setNetworkClinics,
  setNetworkParticipantsLoading,
  setNetworkParticipants,
  activeNetworkGroup,
  networkSelectedMemberId,
  setNetworkSelectedMemberId,
}: {
  networkCurrentUserId: string;
  setNetworkCurrentUserId: (id: string) => void;
  setNetworkGroups: Dispatch<SetStateAction<NetworkGroup[]>>;
  networkGroupOpen: boolean;
  networkActiveGroupId: string | null;
  networkGroups: NetworkGroup[];
  setNetworkGroupOpen: (open: boolean) => void;
  setNetworkActiveGroupId: (id: string | null) => void;
  networkOpen: boolean;
  setNetworkLoadingClinics: (loading: boolean) => void;
  setNetworkClinics: (rows: NetworkClinic[]) => void;
  setNetworkParticipantsLoading: (loading: boolean) => void;
  setNetworkParticipants: (rows: NetworkParticipant[]) => void;
  activeNetworkGroup: NetworkGroup | null;
  networkSelectedMemberId: string;
  setNetworkSelectedMemberId: (id: string) => void;
}) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled && user?.id) setNetworkCurrentUserId(user.id);
      } catch {
        if (!cancelled) setNetworkCurrentUserId("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setNetworkCurrentUserId]);

  useEffect(() => {
    if (!networkCurrentUserId) return;
    setNetworkGroups((prev) =>
      prev.map((g) => {
        const hasAdmins = (g.adminUserIds?.length ?? 0) > 0;
        const hasMembers = (g.memberUserIds?.length ?? 0) > 0;
        if (!hasAdmins && !hasMembers && g.id.startsWith("grp_")) {
          return {
            ...g,
            adminUserIds: [networkCurrentUserId],
            memberUserIds: [networkCurrentUserId],
          };
        }
        return {
          ...g,
          adminUserIds: Array.isArray(g.adminUserIds) ? g.adminUserIds : [],
          memberUserIds: Array.isArray(g.memberUserIds) ? g.memberUserIds : [],
        };
      }),
    );
  }, [networkCurrentUserId, setNetworkGroups]);

  useEffect(() => {
    if (networkGroupOpen && networkActiveGroupId && !networkGroups.some((g) => g.id === networkActiveGroupId)) {
      setNetworkGroupOpen(false);
      setNetworkActiveGroupId(null);
    }
  }, [networkGroupOpen, networkActiveGroupId, networkGroups, setNetworkActiveGroupId, setNetworkGroupOpen]);

  useEffect(() => {
    if (!networkOpen) return;
    let cancelled = false;
    const loadNetworkClinics = async () => {
      setNetworkLoadingClinics(true);
      try {
        const { data, error } = await supabase
          .from("clinics")
          .select("id,name,hospital_id,hospitals(name,region,facility_type)")
          .order("name", { ascending: true });
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        const mapped: NetworkClinic[] = rows.map((row: any) => {
          const hosp = row?.hospitals ?? {};
          return {
            id: String(row?.id ?? ""),
            name: String(row?.name ?? "Okänd klinik"),
            region: String(hosp?.region ?? "Okänd region"),
            hospitalName: String(hosp?.name ?? ""),
            facilityType: String(hosp?.facility_type ?? ""),
          };
        });
        if (!cancelled) {
          setNetworkClinics(mapped.filter((r) => r.id));
        }
      } catch {
        if (!cancelled) setNetworkClinics([]);
      } finally {
        if (!cancelled) setNetworkLoadingClinics(false);
      }
    };
    loadNetworkClinics();
    return () => {
      cancelled = true;
    };
  }, [networkOpen, setNetworkClinics, setNetworkLoadingClinics]);

  useEffect(() => {
    if (!networkGroupOpen) return;
    let cancelled = false;
    const loadParticipants = async () => {
      setNetworkParticipantsLoading(true);
      try {
        const { data, error } = await supabase
          .from("clinic_memberships")
          .select(
            "user_id,role,clinic_id,profiles(id,name,email,mobile,phone_work,sr_for_specialty),clinics(id,name,hospitals(name,region,facility_type))",
          )
          .in("role", ["studierektor", "studierektor_admin"]);
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        const byUser = new Map<string, NetworkParticipant>();
        for (const row of rows as any[]) {
          const profileRaw = Array.isArray(row?.profiles) ? row.profiles[0] : row?.profiles;
          const clinicRaw = Array.isArray(row?.clinics) ? row.clinics[0] : row?.clinics;
          const hosp = Array.isArray(clinicRaw?.hospitals) ? clinicRaw.hospitals[0] : clinicRaw?.hospitals;
          const userId = String(row?.user_id ?? "");
          if (!userId) continue;
          const role = String(row?.role ?? "");
          const srFor = String(profileRaw?.sr_for_specialty ?? "");
          if (!role.includes("studierektor") && !srFor) continue;
          if (byUser.has(userId)) continue;
          byUser.set(userId, {
            userId,
            name: String(profileRaw?.name ?? "Okänd studierektor"),
            clinicId: String(row?.clinic_id ?? ""),
            clinicName: String(clinicRaw?.name ?? ""),
            region: String(hosp?.region ?? "Okänd region"),
            hospitalName: String(hosp?.name ?? ""),
            facilityType: String(hosp?.facility_type ?? ""),
            email: String(profileRaw?.email ?? ""),
            mobile: String(profileRaw?.mobile ?? ""),
            phoneWork: String(profileRaw?.phone_work ?? ""),
          });
        }
        if (!cancelled) setNetworkParticipants(Array.from(byUser.values()));
      } catch {
        if (!cancelled) setNetworkParticipants([]);
      } finally {
        if (!cancelled) setNetworkParticipantsLoading(false);
      }
    };
    loadParticipants();
    return () => {
      cancelled = true;
    };
  }, [networkGroupOpen, setNetworkParticipants, setNetworkParticipantsLoading]);

  useEffect(() => {
    if (!networkGroupOpen || !activeNetworkGroup) return;
    if (!networkSelectedMemberId) return;
    if (!activeNetworkGroup.memberUserIds.includes(networkSelectedMemberId)) {
      setNetworkSelectedMemberId("");
    }
  }, [networkGroupOpen, activeNetworkGroup, networkSelectedMemberId, setNetworkSelectedMemberId]);
}

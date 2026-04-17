"use client";

import { useMemo } from "react";
import type {
  NetworkClinicRegionContext,
  NetworkGroup,
  NetworkParticipant,
} from "@/lib/studierektor/networkTypes";

export function useNetworkGroupSelectors({
  networkGroups,
  networkActiveGroupId,
  networkCurrentUserId,
  networkParticipants,
  clinicId,
  clinicName,
  clinicRegionContext,
}: {
  networkGroups: NetworkGroup[];
  networkActiveGroupId: string | null;
  networkCurrentUserId: string;
  networkParticipants: NetworkParticipant[];
  clinicId: string;
  clinicName: string;
  clinicRegionContext: NetworkClinicRegionContext | null;
}) {
  const activeNetworkGroup = useMemo(
    () => networkGroups.find((g) => g.id === networkActiveGroupId) || null,
    [networkGroups, networkActiveGroupId],
  );

  const isActiveNetworkGroupAdmin = useMemo(() => {
    if (!activeNetworkGroup || !networkCurrentUserId) return false;
    return activeNetworkGroup.adminUserIds.includes(networkCurrentUserId);
  }, [activeNetworkGroup, networkCurrentUserId]);

  const activeNetworkGroupMembers = useMemo(() => {
    if (!activeNetworkGroup) return [];
    const byId = new Map(networkParticipants.map((p) => [p.userId, p]));
    const out: NetworkParticipant[] = [];
    for (const userId of activeNetworkGroup.memberUserIds) {
      const fromDb = byId.get(userId);
      if (fromDb) {
        out.push(fromDb);
        continue;
      }
      if (userId === networkCurrentUserId) {
        out.push({
          userId,
          name: "Du",
          clinicId: clinicId || "",
          clinicName: clinicName || "",
          region: clinicRegionContext?.regionLabel || "",
          hospitalName: "",
          facilityType: "",
          email: "",
          mobile: "",
          phoneWork: "",
        });
        continue;
      }
      out.push({
        userId,
        name: "Studierektor",
        clinicId: "",
        clinicName: "",
        region: "",
        hospitalName: "",
        facilityType: "",
        email: "",
        mobile: "",
        phoneWork: "",
      });
    }
    return out;
  }, [activeNetworkGroup, networkParticipants, networkCurrentUserId, clinicId, clinicName, clinicRegionContext]);

  return { activeNetworkGroup, isActiveNetworkGroupAdmin, activeNetworkGroupMembers };
}

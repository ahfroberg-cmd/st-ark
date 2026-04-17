"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { NetworkGroup } from "@/lib/studierektor/networkTypes";

export function useNetworkGroupMutations({
  networkCurrentUserId,
  setNetworkGroups,
  setNetworkSelectedGroupIdsForSharing,
  setNetworkActiveGroupId,
}: {
  networkCurrentUserId: string;
  setNetworkGroups: Dispatch<SetStateAction<NetworkGroup[]>>;
  setNetworkSelectedGroupIdsForSharing: Dispatch<SetStateAction<string[]>>;
  setNetworkActiveGroupId: Dispatch<SetStateAction<string | null>>;
}) {
  const deleteNetworkGroupById = useCallback(
    (groupId: string) => {
      setNetworkGroups((prev) => prev.filter((g) => g.id !== groupId));
      setNetworkSelectedGroupIdsForSharing((prev) => prev.filter((id) => id !== groupId));
      setNetworkActiveGroupId((current) => (current === groupId ? null : current));
    },
    [setNetworkActiveGroupId, setNetworkGroups, setNetworkSelectedGroupIdsForSharing],
  );

  const leaveNetworkGroupById = useCallback(
    (groupId: string) => {
      if (!networkCurrentUserId) return;
      const uid = networkCurrentUserId;
      setNetworkGroups((prev) => {
        const group = prev.find((x) => x.id === groupId);
        if (!group) return prev;
        const newMembers = group.memberUserIds.filter((id) => id !== uid);
        const newAdmins = group.adminUserIds.filter((id) => id !== uid);
        let finalAdmins = newAdmins;
        if (newMembers.length > 0 && finalAdmins.length === 0) {
          finalAdmins = [newMembers[0]];
        }
        if (newMembers.length === 0) {
          return prev.filter((x) => x.id !== groupId);
        }
        return prev.map((x) =>
          x.id === groupId ? { ...x, memberUserIds: newMembers, adminUserIds: finalAdmins } : x,
        );
      });
      setNetworkSelectedGroupIdsForSharing((prev) => prev.filter((id) => id !== groupId));
      setNetworkActiveGroupId((current) => (current === groupId ? null : current));
    },
    [
      networkCurrentUserId,
      setNetworkActiveGroupId,
      setNetworkGroups,
      setNetworkSelectedGroupIdsForSharing,
    ],
  );

  return { deleteNetworkGroupById, leaveNetworkGroupById };
}

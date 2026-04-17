"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  ContactField,
  NetworkDataScope,
  NetworkGroup,
  NetworkGroupTab,
} from "@/lib/studierektor/networkTypes";

export function useNetworkModalModel({
  networkNewGroupName,
  networkCurrentUserId,
  setNetworkGroups,
  setNetworkSelectedGroupIdsForSharing,
  setNetworkActiveGroupId,
  setNetworkGroupRename,
  setNetworkGroupTab,
  setNetworkGroupOpen,
  setNetworkOpen,
  setNetworkNewGroupName,
  setNetworkShareScopes,
  setNetworkContactFields,
  setNetworkSelectedMemberId,
  setInfoToast,
}: {
  networkNewGroupName: string;
  networkCurrentUserId: string;
  setNetworkGroups: Dispatch<SetStateAction<NetworkGroup[]>>;
  setNetworkSelectedGroupIdsForSharing: Dispatch<SetStateAction<string[]>>;
  setNetworkActiveGroupId: (id: string | null) => void;
  setNetworkGroupRename: (name: string) => void;
  setNetworkGroupTab: (tab: NetworkGroupTab) => void;
  setNetworkGroupOpen: (open: boolean) => void;
  setNetworkOpen: (open: boolean) => void;
  setNetworkNewGroupName: (name: string) => void;
  setNetworkShareScopes: Dispatch<SetStateAction<NetworkDataScope[]>>;
  setNetworkContactFields: Dispatch<SetStateAction<ContactField[]>>;
  setNetworkSelectedMemberId: (id: string) => void;
  setInfoToast: (v: { title: string; message: string } | null) => void;
}) {
  const createGroup = useCallback(() => {
    const trimmed = networkNewGroupName.trim();
    if (!trimmed) return;
    const id = `grp_${Math.random().toString(36).slice(2, 10)}`;
    const admins = networkCurrentUserId ? [networkCurrentUserId] : [];
    const members = networkCurrentUserId ? [networkCurrentUserId] : [];
    setNetworkGroups((prev) => [
      ...prev,
      { id, name: trimmed, clinicIds: [], adminUserIds: admins, memberUserIds: members },
    ]);
    setNetworkSelectedGroupIdsForSharing((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setNetworkActiveGroupId(id);
    setNetworkGroupRename(trimmed);
    setNetworkGroupTab("group");
    setNetworkGroupOpen(true);
    setNetworkOpen(false);
    setNetworkNewGroupName("");
  }, [
    networkCurrentUserId,
    networkNewGroupName,
    setNetworkActiveGroupId,
    setNetworkGroupOpen,
    setNetworkGroupRename,
    setNetworkGroupTab,
    setNetworkGroups,
    setNetworkNewGroupName,
    setNetworkOpen,
    setNetworkSelectedGroupIdsForSharing,
  ]);

  const toggleScope = useCallback(
    (scope: NetworkDataScope) => {
      setNetworkShareScopes((prev) =>
        prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
      );
    },
    [setNetworkShareScopes],
  );

  const toggleGroupShare = useCallback(
    (groupId: string) => {
      setNetworkSelectedGroupIdsForSharing((prev) =>
        prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
      );
    },
    [setNetworkSelectedGroupIdsForSharing],
  );

  const toggleContactField = useCallback(
    (field: ContactField) => {
      setNetworkContactFields((prev) =>
        prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
      );
    },
    [setNetworkContactFields],
  );

  const openGroup = useCallback(
    (group: NetworkGroup) => {
      setNetworkActiveGroupId(group.id);
      setNetworkGroupRename(group.name);
      setNetworkSelectedMemberId("");
      const admin = !!networkCurrentUserId && group.adminUserIds.includes(networkCurrentUserId);
      setNetworkGroupTab(admin ? "admin" : "group");
      setNetworkGroupOpen(true);
    },
    [
      networkCurrentUserId,
      setNetworkActiveGroupId,
      setNetworkGroupOpen,
      setNetworkGroupRename,
      setNetworkGroupTab,
      setNetworkSelectedMemberId,
    ],
  );

  const saveSettings = useCallback(() => {
    setInfoToast({
      title: "Nätverk uppdaterat",
      message: "Inställningarna för delning och synlighet har sparats.",
    });
    setNetworkOpen(false);
  }, [setInfoToast, setNetworkOpen]);

  return { createGroup, toggleScope, toggleGroupShare, toggleContactField, openGroup, saveSettings };
}

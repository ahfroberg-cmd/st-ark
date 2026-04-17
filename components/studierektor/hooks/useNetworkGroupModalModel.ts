"use client";

import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  NetworkClinicOption,
  NetworkGroup,
  NetworkInviteMode,
  NetworkParticipant,
} from "@/lib/studierektor/networkTypes";

export function useNetworkGroupModalModel({
  networkGroupOpen,
  activeNetworkGroup,
  activeNetworkGroupMembers,
  networkCurrentUserId,
  networkParticipants,
  networkInviteRegion,
  networkInviteMode,
  networkInviteHospital,
  networkInviteClinicId,
  networkInviteUserId,
  networkSelectedMemberId,
  networkGroupRename,
  setNetworkGroups,
  setNetworkInviteUserId,
  setNetworkSelectedMemberId,
  setInfoToast,
}: {
  networkGroupOpen: boolean;
  activeNetworkGroup: NetworkGroup | null;
  activeNetworkGroupMembers: NetworkParticipant[];
  networkCurrentUserId: string;
  networkParticipants: NetworkParticipant[];
  networkInviteRegion: string;
  networkInviteMode: NetworkInviteMode;
  networkInviteHospital: string;
  networkInviteClinicId: string;
  networkInviteUserId: string;
  networkSelectedMemberId: string;
  networkGroupRename: string;
  setNetworkGroups: Dispatch<SetStateAction<NetworkGroup[]>>;
  setNetworkInviteUserId: (v: string) => void;
  setNetworkSelectedMemberId: (v: string) => void;
  setInfoToast: (v: { title: string; message: string } | null) => void;
}): {
  currentGroup: NetworkGroup;
  currentMembers: NetworkParticipant[];
  viewerIsMember: boolean;
  regionOptions: string[];
  hospitalOptions: string[];
  clinicOptions: NetworkClinicOption[];
  inviteCandidates: NetworkParticipant[];
  inviteTarget: NetworkParticipant | null;
  addMember: () => void;
  removeMember: (userId: string) => void;
  promoteAdmin: (userId: string) => void;
  renameGroup: () => void;
} | null {
  const currentGroup = activeNetworkGroup;
  const currentMembers = activeNetworkGroupMembers;

  const viewerIsMember = useMemo(
    () => !!networkCurrentUserId && !!currentGroup?.memberUserIds?.includes(networkCurrentUserId),
    [networkCurrentUserId, currentGroup],
  );

  const regionOptions = useMemo(
    () =>
      Array.from(new Set(networkParticipants.map((p) => p.region).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "sv"),
      ),
    [networkParticipants],
  );

  const regionFilteredParticipants = useMemo(
    () =>
      networkInviteRegion
        ? networkParticipants.filter((p) => p.region === networkInviteRegion)
        : networkParticipants,
    [networkInviteRegion, networkParticipants],
  );

  const hospitalOptions = useMemo(
    () =>
      Array.from(
        new Set(
          regionFilteredParticipants
            .filter((p) => !/vardcentral|vårdcentral/i.test(p.facilityType || ""))
            .map((p) => p.hospitalName)
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "sv")),
    [regionFilteredParticipants],
  );

  const clinicOptions = useMemo(
    () =>
      regionFilteredParticipants
        .filter((p) => {
          const isVc = /vardcentral|vårdcentral/i.test(p.facilityType || "");
          if (networkInviteMode === "vardcentral") return isVc;
          return !isVc && (!networkInviteHospital || p.hospitalName === networkInviteHospital);
        })
        .map((p) => ({ clinicId: p.clinicId, clinicName: p.clinicName }))
        .filter((v, idx, arr) => !!v.clinicId && arr.findIndex((x) => x.clinicId === v.clinicId) === idx)
        .sort((a, b) => a.clinicName.localeCompare(b.clinicName, "sv")),
    [networkInviteHospital, networkInviteMode, regionFilteredParticipants],
  );

  const inviteCandidates = useMemo(
    () =>
      regionFilteredParticipants.filter((p) => {
        if (!p.userId || currentGroup?.memberUserIds?.includes(p.userId)) return false;
        if (networkInviteClinicId && p.clinicId !== networkInviteClinicId) return false;
        if (networkInviteMode === "hospital") {
          if (/vardcentral|vårdcentral/i.test(p.facilityType || "")) return false;
          if (networkInviteHospital && p.hospitalName !== networkInviteHospital) return false;
        } else if (!/vardcentral|vårdcentral/i.test(p.facilityType || "")) {
          return false;
        }
        return true;
      }),
    [
      currentGroup,
      networkInviteClinicId,
      networkInviteHospital,
      networkInviteMode,
      regionFilteredParticipants,
    ],
  );

  const inviteTarget = useMemo(
    () => inviteCandidates.find((p) => p.userId === networkInviteUserId) || null,
    [inviteCandidates, networkInviteUserId],
  );

  const addMember = useCallback(() => {
    if (!inviteTarget || !currentGroup) return;
    setNetworkGroups((prev) =>
      prev.map((g) =>
        g.id !== currentGroup.id
          ? g
          : {
              ...g,
              memberUserIds: g.memberUserIds.includes(inviteTarget.userId)
                ? g.memberUserIds
                : [...g.memberUserIds, inviteTarget.userId],
              clinicIds: g.clinicIds.includes(inviteTarget.clinicId)
                ? g.clinicIds
                : [...g.clinicIds, inviteTarget.clinicId].filter(Boolean),
            },
      ),
    );
    setNetworkInviteUserId("");
  }, [currentGroup, inviteTarget, setNetworkGroups, setNetworkInviteUserId]);

  const removeMember = useCallback(
    (userId: string) => {
      if (!userId || !currentGroup) return;
      setNetworkGroups((prev) =>
        prev.map((g) =>
          g.id !== currentGroup.id
            ? g
            : {
                ...g,
                memberUserIds: g.memberUserIds.filter((id: string) => id !== userId),
                adminUserIds: g.adminUserIds.filter((id: string) => id !== userId),
              },
        ),
      );
      if (networkSelectedMemberId === userId) setNetworkSelectedMemberId("");
    },
    [currentGroup, networkSelectedMemberId, setNetworkGroups, setNetworkSelectedMemberId],
  );

  const promoteAdmin = useCallback(
    (userId: string) => {
      if (!userId || !currentGroup) return;
      setNetworkGroups((prev) =>
        prev.map((g) =>
          g.id !== currentGroup.id
            ? g
            : {
                ...g,
                adminUserIds: g.adminUserIds.includes(userId) ? g.adminUserIds : [...g.adminUserIds, userId],
              },
        ),
      );
    },
    [currentGroup, setNetworkGroups],
  );

  const renameGroup = useCallback(() => {
    const trimmed = networkGroupRename.trim();
    if (!trimmed || !currentGroup) return;
    setNetworkGroups((prev) => prev.map((g) => (g.id === currentGroup.id ? { ...g, name: trimmed } : g)));
    setInfoToast({ title: "Grupp uppdaterad", message: "Gruppnamnet har sparats." });
  }, [currentGroup, networkGroupRename, setInfoToast, setNetworkGroups]);

  if (!networkGroupOpen || !currentGroup) return null;

  return {
    currentGroup,
    currentMembers,
    viewerIsMember,
    regionOptions,
    hospitalOptions,
    clinicOptions,
    inviteCandidates,
    inviteTarget,
    addMember,
    removeMember,
    promoteAdmin,
    renameGroup,
  };
}

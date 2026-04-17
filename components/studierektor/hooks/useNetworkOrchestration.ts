"use client";

import type { Dispatch, SetStateAction } from "react";
import type {
  ContactField,
  NetworkClinicRegionContext,
  NetworkDataScope,
  NetworkGroup,
  NetworkGroupTab,
  NetworkInviteMode,
  NetworkParticipant,
} from "@/lib/studierektor/networkTypes";
import { useNetworkGroupModalModel } from "@/components/studierektor/hooks/useNetworkGroupModalModel";
import { useNetworkGroupMutations } from "@/components/studierektor/hooks/useNetworkGroupMutations";
import { useNetworkGroupSelectors } from "@/components/studierektor/hooks/useNetworkGroupSelectors";
import { useNetworkModalModel } from "@/components/studierektor/hooks/useNetworkModalModel";

export function useNetworkOrchestration({
  networkGroups,
  networkActiveGroupId,
  networkCurrentUserId,
  networkParticipants,
  clinicId,
  clinicName,
  clinicRegionContext,
  networkGroupOpen,
  networkInviteRegion,
  networkInviteMode,
  networkInviteHospital,
  networkInviteClinicId,
  networkInviteUserId,
  networkSelectedMemberId,
  networkGroupRename,
  networkNewGroupName,
  setNetworkGroups,
  setNetworkSelectedGroupIdsForSharing,
  setNetworkActiveGroupId,
  setNetworkInviteUserId,
  setNetworkSelectedMemberId,
  setInfoToast,
  setNetworkGroupTab,
  setNetworkGroupOpen,
  setNetworkOpen,
  setNetworkNewGroupName,
  setNetworkShareScopes,
  setNetworkContactFields,
  setNetworkGroupRename,
}: {
  networkGroups: NetworkGroup[];
  networkActiveGroupId: string | null;
  networkCurrentUserId: string;
  networkParticipants: NetworkParticipant[];
  clinicId: string;
  clinicName: string;
  clinicRegionContext: NetworkClinicRegionContext | null;
  networkGroupOpen: boolean;
  networkInviteRegion: string;
  networkInviteMode: NetworkInviteMode;
  networkInviteHospital: string;
  networkInviteClinicId: string;
  networkInviteUserId: string;
  networkSelectedMemberId: string;
  networkGroupRename: string;
  networkNewGroupName: string;
  setNetworkGroups: Dispatch<SetStateAction<NetworkGroup[]>>;
  setNetworkSelectedGroupIdsForSharing: Dispatch<SetStateAction<string[]>>;
  setNetworkActiveGroupId: Dispatch<SetStateAction<string | null>>;
  setNetworkInviteUserId: (v: string) => void;
  setNetworkSelectedMemberId: (v: string) => void;
  setInfoToast: (v: { title: string; message: string } | null) => void;
  setNetworkGroupTab: (tab: NetworkGroupTab) => void;
  setNetworkGroupOpen: (open: boolean) => void;
  setNetworkOpen: (open: boolean) => void;
  setNetworkNewGroupName: (name: string) => void;
  setNetworkShareScopes: Dispatch<SetStateAction<NetworkDataScope[]>>;
  setNetworkContactFields: Dispatch<SetStateAction<ContactField[]>>;
  setNetworkGroupRename: (name: string) => void;
}) {
  const { activeNetworkGroup, isActiveNetworkGroupAdmin, activeNetworkGroupMembers } =
    useNetworkGroupSelectors({
      networkGroups,
      networkActiveGroupId,
      networkCurrentUserId,
      networkParticipants,
      clinicId,
      clinicName,
      clinicRegionContext,
    });

  const { deleteNetworkGroupById, leaveNetworkGroupById } = useNetworkGroupMutations({
    networkCurrentUserId,
    setNetworkGroups,
    setNetworkSelectedGroupIdsForSharing,
    setNetworkActiveGroupId,
  });

  const networkModalModel = useNetworkModalModel({
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
  });

  const networkGroupModalModel = useNetworkGroupModalModel({
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
  });

  return {
    activeNetworkGroup,
    isActiveNetworkGroupAdmin,
    activeNetworkGroupMembers,
    deleteNetworkGroupById,
    leaveNetworkGroupById,
    networkModalModel,
    networkGroupModalModel,
  };
}

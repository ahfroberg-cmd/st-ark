"use client";

import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  ContactField,
  NetworkDataScope,
  NetworkGroup,
  NetworkShareMode,
} from "@/lib/studierektor/networkTypes";

export function useNetworkPreferencesStorage({
  storageKey,
  networkGroups,
  setNetworkGroups,
  networkSelectedGroupIdsForSharing,
  setNetworkSelectedGroupIdsForSharing,
  networkSelectedClinicIds,
  setNetworkSelectedClinicIds,
  networkShareMode,
  setNetworkShareMode,
  networkShareScopes,
  setNetworkShareScopes,
  networkRequestTarget,
  setNetworkRequestTarget,
  networkShowName,
  setNetworkShowName,
  networkShowContact,
  setNetworkShowContact,
  networkContactFields,
  setNetworkContactFields,
}: {
  storageKey: string;
  networkGroups: NetworkGroup[];
  setNetworkGroups: Dispatch<SetStateAction<NetworkGroup[]>>;
  networkSelectedGroupIdsForSharing: string[];
  setNetworkSelectedGroupIdsForSharing: (ids: string[]) => void;
  networkSelectedClinicIds: string[];
  setNetworkSelectedClinicIds: (ids: string[]) => void;
  networkShareMode: NetworkShareMode;
  setNetworkShareMode: (mode: NetworkShareMode) => void;
  networkShareScopes: NetworkDataScope[];
  setNetworkShareScopes: (scopes: NetworkDataScope[]) => void;
  networkRequestTarget: string;
  setNetworkRequestTarget: (target: string) => void;
  networkShowName: boolean;
  setNetworkShowName: (show: boolean) => void;
  networkShowContact: boolean;
  setNetworkShowContact: (show: boolean) => void;
  networkContactFields: ContactField[];
  setNetworkContactFields: (fields: ContactField[]) => void;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (Array.isArray(parsed.groups)) {
        const groups = parsed.groups
          .map((g) => ({
            id: String((g as any)?.id ?? ""),
            name: String((g as any)?.name ?? ""),
            clinicIds: Array.isArray((g as any)?.clinicIds)
              ? (g as any).clinicIds.map((id: unknown) => String(id))
              : [],
            adminUserIds: Array.isArray((g as any)?.adminUserIds)
              ? (g as any).adminUserIds.map((id: unknown) => String(id))
              : [],
            memberUserIds: Array.isArray((g as any)?.memberUserIds)
              ? (g as any).memberUserIds.map((id: unknown) => String(id))
              : [],
          }))
          .filter((g) => g.id && g.name);
        if (groups.length > 0) setNetworkGroups(groups);
      }
      if (Array.isArray(parsed.selectedGroupIds)) {
        setNetworkSelectedGroupIdsForSharing(parsed.selectedGroupIds.map((id: unknown) => String(id)));
      }
      if (Array.isArray(parsed.selectedClinicIds)) {
        setNetworkSelectedClinicIds(parsed.selectedClinicIds.map((id: unknown) => String(id)));
      }
      if (parsed.shareMode === "open" || parsed.shareMode === "group" || parsed.shareMode === "request") {
        setNetworkShareMode(parsed.shareMode);
      }
      if (Array.isArray(parsed.shareScopes)) {
        const scopes = parsed.shareScopes
          .map((s: unknown) => String(s))
          .filter((s): s is NetworkDataScope => s === "activities" || s === "iup_headers");
        if (scopes.length > 0) setNetworkShareScopes(scopes);
      }
      if (typeof parsed.requestTarget === "string") setNetworkRequestTarget(parsed.requestTarget);
      if (typeof parsed.showName === "boolean") setNetworkShowName(parsed.showName);
      if (typeof parsed.showContact === "boolean") setNetworkShowContact(parsed.showContact);
      if (Array.isArray(parsed.contactFields)) {
        const fields = parsed.contactFields
          .map((s: unknown) => String(s))
          .filter((s): s is ContactField => s === "email" || s === "mobile" || s === "phone_work");
        setNetworkContactFields(fields);
      }
    } catch {
      // ignore invalid local storage payload
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      groups: networkGroups,
      selectedGroupIds: networkSelectedGroupIdsForSharing,
      selectedClinicIds: networkSelectedClinicIds,
      shareMode: networkShareMode,
      shareScopes: networkShareScopes,
      requestTarget: networkRequestTarget,
      showName: networkShowName,
      showContact: networkShowContact,
      contactFields: networkContactFields,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [
    networkGroups,
    networkSelectedGroupIdsForSharing,
    networkSelectedClinicIds,
    networkShareMode,
    networkShareScopes,
    networkRequestTarget,
    networkShowName,
    networkShowContact,
    networkContactFields,
  ]);
}

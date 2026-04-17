"use client";

import { useCallback } from "react";

type UpdateProfileSnakeCase = (
  userId: string,
  patch: { bt_end_date: string | null; updated_at: string }
) => Promise<unknown>;

export function useBtEndDateChange(params: {
  isValidISO: (iso: string) => boolean;
  setProfile: React.Dispatch<React.SetStateAction<any>>;
  authUserId?: string;
  getSessionUser: () => Promise<any>;
  setAuthUser: React.Dispatch<React.SetStateAction<any>>;
  resolveUserId: (params: any) => Promise<string | null>;
  updateProfileSnakeCase: UpdateProfileSnakeCase;
}) {
  const {
    isValidISO,
    setProfile,
    authUserId,
    getSessionUser,
    setAuthUser,
    resolveUserId,
    updateProfileSnakeCase,
  } = params;

  return useCallback(
    async (iso: string | null) => {
      const nextISO = iso && isValidISO(iso) ? iso : null;

      setProfile((prev: any) =>
        prev
          ? {
              ...prev,
              btEndDate: nextISO,
            }
          : prev
      );

      const btUid = await resolveUserId({
        authUserId,
        getSessionUser,
        onResolvedUser: (user: any) => {
          if (user?.id) setAuthUser(user as any);
        },
      });
      if (!btUid) return;

      try {
        await updateProfileSnakeCase(btUid, {
          bt_end_date: nextISO,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Kunde inte spara BT-slutdatum:", e);
      }
    },
    [authUserId, getSessionUser, isValidISO, resolveUserId, setAuthUser, setProfile, updateProfileSnakeCase]
  );
}

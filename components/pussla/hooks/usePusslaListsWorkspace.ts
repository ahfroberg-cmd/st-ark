"use client";

import { useCallback, useEffect, useState } from "react";

export function usePusslaListsWorkspace(params: any) {
  const [listPlac, setListPlac] = useState<any[]>([]);
  const [listCourses, setListCourses] = useState<any[]>([]);

  const refreshLists = useCallback(async () => {
    try {
      const uid = await params.resolveUserId({
        authUserId: params.authUserId,
        getSessionUser: params.getSessionUser,
        onResolvedUser: (user: any) => {
          if (user?.id) params.setAuthUser(user as any);
        },
      });
      if (!uid) {
        setListPlac([]);
        setListCourses([]);
        return;
      }

      const { data: remotePlacements, error: placementError } = await params.listPlacementsByUserId(uid);
      if (placementError) {
        setListPlac([]);
      } else {
        setListPlac((remotePlacements || []).map((p: any) => params.mapPlacementRowForList(p)));
      }

      const { data: remoteCourses, error } = await params.listCoursesByUserId(uid);
      if (error) {
        setListCourses([]);
      } else {
        setListCourses((remoteCourses || []).map((c: any) => params.mapCourseRowForList(c)));
      }
    } catch {}
  }, [
    params.authUserId,
    params.getSessionUser,
    params.listCoursesByUserId,
    params.listPlacementsByUserId,
    params.mapCourseRowForList,
    params.mapPlacementRowForList,
    params.resolveUserId,
    params.setAuthUser,
  ]);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  return {
    listPlac,
    setListPlac,
    listCourses,
    setListCourses,
    refreshLists,
  };
}

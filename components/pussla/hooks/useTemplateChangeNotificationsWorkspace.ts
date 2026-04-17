"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  acknowledgeActivityTemplateChangeNotification,
  deleteCoursesForUserByIds,
  deletePlacementsForUserByIds,
  listPendingActivityTemplateChangeNotifications,
} from "@/lib/repositories/starkRepository";

export function useTemplateChangeNotificationsWorkspace(params: {
  authUserId?: string | null;
  activities: any[];
  courses: any[];
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  setSelectedPlacementId: (value: string | null) => void;
  setSelectedCourseId: (value: string | null) => void;
  setActivities: (updater: any) => void;
  setCourses: (updater: any) => void;
}) {
  const [activityTemplateChangeQueue, setActivityTemplateChangeQueue] = useState<any[]>([]);
  const [activityTemplateChangeOpen, setActivityTemplateChangeOpen] = useState(false);

  const acknowledgeTemplateChangeNotice = useCallback(async (id: string) => {
    if (!id) return;
    await acknowledgeActivityTemplateChangeNotification(id);
    setActivityTemplateChangeQueue((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const templateChangeCurrent = useMemo(
    () => (activityTemplateChangeQueue.length > 0 ? activityTemplateChangeQueue[0] : null),
    [activityTemplateChangeQueue]
  );

  useEffect(() => {
    const authUserId = params.authUserId;
    if (!authUserId) return;
    (async () => {
      const { data } = await listPendingActivityTemplateChangeNotifications(authUserId, 20);
      if ((data || []).length > 0) {
        setActivityTemplateChangeQueue((data || []) as any[]);
        setActivityTemplateChangeOpen(true);
      }
    })();
  }, [params.authUserId]);

  const handleTemplateDeletedChangeActivity = useCallback(async () => {
    const n = templateChangeCurrent;
    if (!n) return;
    const details = (n.details || {}) as any;
    const placementIds: string[] = Array.isArray(details.placement_ids) ? details.placement_ids : [];
    const courseIds: string[] = Array.isArray(details.course_ids) ? details.course_ids : [];
    const firstPlacement = placementIds.find((id) => params.activities.some((a: any) => a.id === id));
    const firstCourse = courseIds.find((id) => params.courses.some((c: any) => c.id === id));
    if (firstPlacement) {
      params.setSelectedCourseId(null);
      params.setSelectedPlacementId(firstPlacement);
    } else if (firstCourse) {
      params.setSelectedPlacementId(null);
      params.setSelectedCourseId(firstCourse);
    }
    await acknowledgeTemplateChangeNotice(String(n.id || ""));
  }, [templateChangeCurrent, params, acknowledgeTemplateChangeNotice]);

  const handleTemplateDeletedRemoveActivity = useCallback(async () => {
    const n = templateChangeCurrent;
    if (!n || !params.authUserId) return;
    const details = (n.details || {}) as any;
    const dates: string[] = Array.isArray(details.dates) ? details.dates : [];
    const placementIds: string[] = Array.isArray(details.placement_ids) ? details.placement_ids : [];
    const courseIds: string[] = Array.isArray(details.course_ids) ? details.course_ids : [];
    const datesText = dates.length > 0 ? dates.join(", ") : "okänt datum";
    const ok = window.confirm(
      `Vill du verkligen radera ${String(n.old_title || "aktiviteten")} för datum ${datesText}?`
    );
    if (!ok) return;
    if (placementIds.length > 0) {
      await deletePlacementsForUserByIds(params.authUserId, placementIds);
    }
    if (courseIds.length > 0) {
      await deleteCoursesForUserByIds(params.authUserId, courseIds);
    }
    params.setActivities((prev: any[]) =>
      prev.filter((a: any) => !placementIds.includes(String(a.id || "")))
    );
    params.setCourses((prev: any[]) => prev.filter((c: any) => !courseIds.includes(String(c.id || ""))));
    if (params.selectedPlacementId && placementIds.includes(params.selectedPlacementId)) {
      params.setSelectedPlacementId(null);
    }
    if (params.selectedCourseId && courseIds.includes(params.selectedCourseId)) {
      params.setSelectedCourseId(null);
    }
    await acknowledgeTemplateChangeNotice(String(n.id || ""));
  }, [templateChangeCurrent, params, acknowledgeTemplateChangeNotice]);

  return {
    activityTemplateChangeQueue,
    activityTemplateChangeOpen,
    setActivityTemplateChangeOpen,
    templateChangeCurrent,
    acknowledgeTemplateChangeNotice,
    handleTemplateDeletedChangeActivity,
    handleTemplateDeletedRemoveActivity,
  };
}

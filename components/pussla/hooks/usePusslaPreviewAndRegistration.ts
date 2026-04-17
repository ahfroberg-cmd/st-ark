"use client";

import { useCallback, useState } from "react";

export function usePusslaPreviewAndRegistration(params: any) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleRegisterActivityById = useCallback(
    (id: string) => {
      const a = params.activities.find((x: any) => x.id === id);
      if (!a) return;
      const { startISO, endISO } = params.displayDatesForActivity(a);
      params.router.push(
        params.buildPlacementRegistrationPath({
          activity: a,
          startISO,
          endISO,
        })
      );
    },
    [params]
  );

  const handleRegisterActivity = useCallback(() => {
    const a = params.activities.find((x: any) => x.id === params.selectedPlacementId);
    if (!a) return;
    handleRegisterActivityById(a.id);
  }, [params, handleRegisterActivityById]);

  const handleRegisterCourseById = useCallback(
    (id: string) => {
      const c = params.courses.find((x: any) => x.id === id);
      if (!c) return;
      params.router.push(
        params.buildCourseRegistrationPath({
          course: c,
          displayTitle: params.getCourseDisplayTitle(c),
        })
      );
    },
    [params]
  );

  const handleRegisterCourse = useCallback(() => {
    const c = params.courses.find((x: any) => x.id === params.selectedCourseId);
    if (!c) return;
    handleRegisterCourseById(c.id);
  }, [params, handleRegisterCourseById]);

  const openPreviewForPlacement = useCallback(
    async (a: any) => {
      try {
        if (!params.canBuildPreview(params.profile)) {
          params.alertFn("Profil saknas – kan inte skapa intyget.");
          return;
        }
        const blob = await params.buildPlacementPreviewBlob({
          profile: params.profile,
          placement: a,
          activities: params.activities,
          isZeroAttendanceType: (t: string) => params.isZeroAttendanceType(t),
        });
        params.showPreviewFromBlob({ blob, setPreviewUrl, setPreviewOpen });
      } catch (e) {
        console.error("Fel vid skapande av förhandsvisning:", e);
        params.alertFn(`Kunde inte skapa förhandsvisningen: ${params.toErrorMessage(e)}`);
      }
    },
    [params]
  );

  const openPreviewForPlacementFromGroupModal = useCallback(
    async (payload: { grouped: any[]; config: any; groupNum: number | null }) => {
      try {
        if (!params.canBuildPreview(params.profile)) {
          params.alertFn("Profil saknas – kan inte skapa intyget.");
          return;
        }
        const blob = await params.buildGroupedPlacementPreviewBlob({
          profile: params.profile,
          grouped: payload.grouped,
          config: payload.config,
          groupNum: payload.groupNum,
          selectedPlacementId: params.selectedPlacementId,
          isZeroAttendanceType: (t: string) => params.isZeroAttendanceType(t),
        });
        params.showPreviewFromBlob({ blob, setPreviewUrl, setPreviewOpen });
      } catch (e) {
        console.error("Fel vid skapande av förhandsvisning:", e);
        params.alertFn(`Kunde inte skapa förhandsvisningen: ${params.toErrorMessage(e)}`);
      }
    },
    [params]
  );

  const openPreviewForBtGoals = useCallback(
    async (a: any) => {
      try {
        if (!params.canBuildPreview(params.profile)) {
          params.alertFn("Profil saknas – kan inte skapa intyget.");
          return;
        }
        const blob = await params.buildBtGoalsPreviewBlob({
          profile: params.profile,
          placement: a,
        });
        params.showPreviewFromBlob({ blob, setPreviewUrl, setPreviewOpen });
      } catch (e) {
        console.error(e);
        params.alertFn("Kunde inte skapa förhandsvisningen (Delmål i BT).");
      }
    },
    [params]
  );

  const openPreviewForCourse = useCallback(
    async (c: any) => {
      try {
        if (!params.canBuildPreview(params.profile)) {
          params.alertFn("Profil saknas – kan inte skapa intyget.");
          return;
        }
        const blob = await params.buildCoursePreviewBlob({
          profile: params.profile,
          course: c,
          displayTitle: params.getCourseDisplayTitle(c),
        });
        params.showPreviewFromBlob({ blob, setPreviewUrl, setPreviewOpen });
      } catch (e) {
        console.error(e);
        params.alertFn("Kunde inte skapa förhandsvisningen.");
      }
    },
    [params]
  );

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewOpen(false);
  }, [previewUrl]);

  return {
    previewOpen,
    previewUrl,
    setPreviewOpen,
    closePreview,
    handleRegisterActivity,
    handleRegisterActivityById,
    handleRegisterCourse,
    handleRegisterCourseById,
    openPreviewForPlacement,
    openPreviewForPlacementFromGroupModal,
    openPreviewForBtGoals,
    openPreviewForCourse,
  };
}

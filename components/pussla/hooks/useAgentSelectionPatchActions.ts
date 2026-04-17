"use client";

export function useAgentSelectionPatchActions(params: {
  activities: any[];
  courses: any[];
  getPlacementEndISOForAgent: any;
  setSelectedPlacementId: any;
  setSelectedCourseId: any;
  setActiveLane: any;
  selectedCourseIdRef: any;
  selectedPlacementIdRef: any;
  selectedPlacement: any;
  profile: any;
  sanitizeStMilestonesForGoals: any;
  toMilestoneIds: any;
  buildPlacementPatchFromAgentFields: any;
  resolvePlacementDatePatchFromAgentFields: any;
  getPlacementStartISOForAgent: any;
  startYear: number;
  isValidISO: any;
  dateToSlot: any;
  wouldOverlap: any;
  updateSelectedPlacement: any;
  selectedCourseId: string | null;
  buildCoursePatchFromAgentFields: any;
  updateSelectedCourse: any;
}) {
  function selectPlacementForAgent(query: string): { ok: boolean; message: string } {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return { ok: false, message: "Ange vilken placering som ska väljas." };
    const hit = [...params.activities]
      .sort((a, b) => params.getPlacementEndISOForAgent(b).localeCompare(params.getPlacementEndISOForAgent(a)))
      .find((a) => {
        const label = String(a.label || "").toLowerCase();
        const type = String(a.type || "").toLowerCase();
        return label.includes(q) || type.includes(q);
      });
    if (!hit) return { ok: false, message: `Hittade ingen placering som matchar "${query}".` };
    params.setSelectedPlacementId(hit.id);
    params.setSelectedCourseId(null);
    params.setActiveLane("placement");
    return { ok: true, message: `Valde placering: ${hit.label || hit.type}.` };
  }

  function selectCourseForAgent(query: string): { ok: boolean; message: string } {
    const q = String(query || "")
      .trim()
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/\bsom\s+[äa]r\b[\s\S]*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!q) return { ok: false, message: "Ange vilken kurs som ska väljas." };
    const hit = [...params.courses]
      .sort((a, b) =>
        String(b.endDate || b.certificateDate || "").localeCompare(String(a.endDate || a.certificateDate || ""))
      )
      .find((c) => {
        const title = String(c.title || "")
          .toLowerCase()
          .replace(/\([^)]*\)/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const kind = String(c.kind || "").toLowerCase();
        return title.includes(q) || kind.includes(q);
      });
    if (!hit) return { ok: false, message: `Hittade ingen kurs som matchar "${query}".` };
    params.setSelectedCourseId(hit.id);
    params.selectedCourseIdRef.current = hit.id;
    params.setSelectedPlacementId(null);
    params.selectedPlacementIdRef.current = null;
    params.setActiveLane("course");
    return { ok: true, message: `Valde kurs: ${hit.title || hit.kind}.` };
  }

  function updateSelectedPlacementForAgent(fields: any): { ok: boolean; message: string } {
    if (!params.selectedPlacement) return { ok: false, message: "Ingen vald placering att uppdatera." };
    const next = params.buildPlacementPatchFromAgentFields({
      fields: fields as any,
      goalsVersion: (params.profile as any)?.goalsVersion,
      sanitizeStMilestonesForGoals: params.sanitizeStMilestonesForGoals,
      toMilestoneIds: params.toMilestoneIds,
    }) as any;
    const datePatchResult = params.resolvePlacementDatePatchFromAgentFields({
      fields: fields as any,
      oldStartISO: params.getPlacementStartISOForAgent(params.selectedPlacement),
      oldEndISO: params.getPlacementEndISOForAgent(params.selectedPlacement),
      startYear: params.startYear,
      selectedPlacementId: params.selectedPlacement.id,
      isValidISO: params.isValidISO,
      dateToSlot: params.dateToSlot,
      wouldOverlap: params.wouldOverlap,
    });
    if ("error" in datePatchResult) return { ok: false, message: datePatchResult.error };
    Object.assign(next, datePatchResult.patch);
    params.updateSelectedPlacement(next);
    return { ok: true, message: "Uppdaterade vald placering." };
  }

  function updateSelectedCourseForAgent(fields: any): { ok: boolean; message: string } {
    const selectedForAgent = (() => {
      const id = params.selectedCourseIdRef.current || params.selectedCourseId;
      if (!id) return null;
      return params.courses.find((c) => c.id === id) || null;
    })();
    if (!selectedForAgent) return { ok: false, message: "Ingen vald kurs att uppdatera." };
    const nextResult = params.buildCoursePatchFromAgentFields({
      fields: fields as any,
      goalsVersion: (params.profile as any)?.goalsVersion,
      isValidISO: params.isValidISO,
      sanitizeStMilestonesForGoals: params.sanitizeStMilestonesForGoals,
      toMilestoneIds: params.toMilestoneIds,
    });
    if ("error" in nextResult) return { ok: false, message: nextResult.error };
    const next = nextResult.patch as any;
    params.updateSelectedCourse(next);
    return { ok: true, message: "Uppdaterade vald kurs." };
  }

  return {
    selectPlacementForAgent,
    selectCourseForAgent,
    updateSelectedPlacementForAgent,
    updateSelectedCourseForAgent,
  };
}

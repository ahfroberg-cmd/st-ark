"use client";

import { useCallback } from "react";

type ActivityLike = {
  id: string;
  [key: string]: unknown;
};

type Params = {
  selectedPlacement: { id: string } | null;
  setActivities: React.Dispatch<React.SetStateAction<ActivityLike[]>>;
};

export function usePlacementDetailFieldActions({ selectedPlacement, setActivities }: Params) {
  const updatePlacementField = useCallback(
    (field: string, value: unknown) => {
      const sel = selectedPlacement;
      if (!sel) return;
      setActivities((prev) => prev.map((a) => (a.id === sel.id ? { ...a, [field]: value } : a)));
    },
    [selectedPlacement, setActivities]
  );

  const updatePlacementSupervisor = useCallback(
    (value: string) => updatePlacementField("supervisor", value),
    [updatePlacementField]
  );
  const updatePlacementSupervisorSpeciality = useCallback(
    (value: string) => updatePlacementField("supervisorSpeciality", value),
    [updatePlacementField]
  );
  const updatePlacementSupervisorSite = useCallback(
    (value: string) => updatePlacementField("supervisorSite", value),
    [updatePlacementField]
  );
  const updatePlacementBtAssessment = useCallback(
    (value: string) => updatePlacementField("btAssessment", value),
    [updatePlacementField]
  );

  return {
    updatePlacementField,
    updatePlacementSupervisor,
    updatePlacementSupervisorSpeciality,
    updatePlacementSupervisorSite,
    updatePlacementBtAssessment,
  };
}

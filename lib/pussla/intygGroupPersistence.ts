type GroupMember = {
  id: string;
  linkedPlacementId?: string;
};

export async function persistIntygGroupModalZone(input: {
  draftGroup: number | null;
  config: Record<string, any> | null;
  activities: any[];
  selectedPlacementId: string | null;
  groupedMembersForDraft: (
    base: any,
    activities: any[],
    draftGroup: number | null
  ) => GroupMember[];
  setActivities: (updater: (prev: any[]) => any[]) => void;
  updatePlacementById: (
    placementId: string,
    payload: { intyg_group: number | null; intyg_group_config: Record<string, any> | null; updated_at: string }
  ) => Promise<{ error: any }>;
  alertFn: (message: string) => void;
}): Promise<void> {
  const base = input.activities.find((activity) => activity.id === input.selectedPlacementId);
  if (!base) return;

  const targets = input.groupedMembersForDraft(base, input.activities, input.draftGroup);
  const payloadConfig =
    input.config && Object.keys(input.config).length > 0 ? input.config : null;

  input.setActivities((prev) =>
    prev.map((activity) => {
      if (!targets.some((target) => target.id === activity.id)) return activity;
      return {
        ...activity,
        intygGroup: input.draftGroup,
        intygGroupConfig: payloadConfig,
      };
    })
  );

  for (const target of targets) {
    const linkedId = String(target.linkedPlacementId || "").trim();
    if (!linkedId) continue;
    const { error } = await input.updatePlacementById(linkedId, {
      intyg_group: input.draftGroup,
      intyg_group_config: payloadConfig,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      input.alertFn(`Kunde inte spara intygsgrupp: ${error.message}`);
      return;
    }
  }
}

type TemplateLike = {
  title: string;
  suggested_rows?: string[];
};

type ColleaguePlacementDescription = {
  userId: string;
  colleagueName: string;
  placementName: string;
  placementNameAlt?: string;
  description: string;
  startDate: string;
  endDate: string;
};

type GroupedRows = {
  required: string[];
  recommended: string[];
};

export function buildPlacementNoteSuggestionsContext({
  activityType,
  activityLabel,
  srPlacementTemplates,
  colleaguePlacementDescriptions,
  isLeave,
  splitTemplateSuggestedRows,
  placementNameMatches,
}: {
  activityType: string;
  activityLabel?: string;
  srPlacementTemplates: TemplateLike[];
  colleaguePlacementDescriptions: ColleaguePlacementDescription[];
  isLeave: (t: any) => boolean;
  splitTemplateSuggestedRows: (rows: string[]) => GroupedRows;
  placementNameMatches: (inputName: string, candidateName: string, candidateNameAlt?: string) => boolean;
}) {
  const isNoteType = !(isLeave(activityType as any) && activityType !== "Annan ledighet");

  const matchingTemplate = srPlacementTemplates.find((t) => t.title === activityLabel);
  const rows: string[] =
    matchingTemplate?.suggested_rows?.length
      ? matchingTemplate.suggested_rows
      : srPlacementTemplates.flatMap((t) => t.suggested_rows || []);

  const groupedRows = splitTemplateSuggestedRows(rows);
  const colleagueRows = activityLabel
    ? colleaguePlacementDescriptions.filter((row) =>
        placementNameMatches(String(activityLabel || ""), row.placementName, row.placementNameAlt)
      )
    : [];

  const hasSuggestionSources =
    groupedRows.required.length > 0 || groupedRows.recommended.length > 0 || colleagueRows.length > 0;

  return {
    isNoteType,
    groupedRows,
    colleagueRows,
    hasSuggestionSources,
  };
}

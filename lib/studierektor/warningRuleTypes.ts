export type WarningRuleType =
  | "milestone_overall"
  | "milestone_activity"
  | "mandatory_placement";

export type WarningActivityKind = "placering" | "kurs" | "arbete";

export type WarningRule = {
  id: string;
  type: WarningRuleType;
  enabled: boolean;
  params: {
    monthsLeftThreshold?: number;
    minProgressPercent?: number;
    activityKind?: WarningActivityKind;
    placementTemplateTitle?: string;
    minMonths?: number;
  };
};

type ColleagueItemLike = {
  kind?: string;
  label?: string;
  clinic?: string;
  title?: string;
  courseTitle?: string;
};

export function colleagueItemTypeLabel(itemKind: string): string {
  if (itemKind === "placement") return "Klinisk tjänstgöring";
  if (itemKind === "utbildningsmoment") return "Utbildningsmoment";
  return "Kurs";
}

export function colleagueItemDisplayName(item: ColleagueItemLike, itemKind: string): string {
  if (itemKind === "placement") return item.label || item.clinic || item.title || "";
  return item.title === "Annan" ? item.courseTitle || item.title || "" : item.title || "";
}

export function colleagueTargetDisplayName(target: ColleagueItemLike | null | undefined): string {
  if (!target) return "";
  if (target.kind) {
    return target.title === "Annan"
      ? target.courseTitle || target.title || ""
      : target.title || "";
  }
  return target.label || target.clinic || target.title || "";
}

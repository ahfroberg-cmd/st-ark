export function buildDeleteCollectionMessage(target: "placements" | "courses", removedCount: number): string {
  return target === "courses"
    ? `Tog bort ${removedCount} kurser från vald mängd.`
    : `Tog bort ${removedCount} placeringar från vald mängd.`;
}

export function buildSetCourseKindMessage(changedCount: number): string {
  return `Uppdaterade ${changedCount} kurser till typen Utbildningsmoment.`;
}

export function buildShiftPlacementMonthsMessage(changedCount: number, months: number): string {
  return `Flyttade ${changedCount} placeringar framåt ${months} månad(er).`;
}

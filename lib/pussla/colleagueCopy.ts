export function mergeMilestones(existing: string[], incoming: string[]): string[] {
  return Array.from(new Set([...(existing || []), ...(incoming || [])]));
}

export function replaceMilestones(incoming: string[]): string[] {
  return [...(incoming || [])];
}

export function appendDescription(currentNote: string, description: string): string {
  if (!currentNote) return description;
  if (!description) return currentNote;
  return `${currentNote}\n\n${description}`;
}

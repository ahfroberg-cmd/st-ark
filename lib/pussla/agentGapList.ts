type PlacementLike = {
  label?: string;
};

function addUtcDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildInternalGapMessage(input: {
  placements: PlacementLike[];
  getPlacementStartISOForAgent: (placement: PlacementLike) => string;
  getPlacementEndISOForAgent: (placement: PlacementLike) => string;
}): string {
  const { placements, getPlacementStartISOForAgent, getPlacementEndISOForAgent } = input;
  const sorted = [...placements].sort((a, b) =>
    getPlacementStartISOForAgent(a).localeCompare(getPlacementStartISOForAgent(b))
  );
  const gaps: string[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const left = sorted[index];
    const right = sorted[index + 1];
    const gapStart = addUtcDays(getPlacementEndISOForAgent(left), 1);
    const gapEnd = addUtcDays(getPlacementStartISOForAgent(right), -1);
    if (gapStart <= gapEnd) {
      gaps.push(
        `${gaps.length + 1}. ${gapStart} – ${gapEnd} (mellan "${left.label || "Placering"}" och "${
          right.label || "Placering"
        }")`
      );
    }
  }
  if (gaps.length === 0) return "Inga interna glapp hittades i tidslinjen.";
  return `Interna glapp:\n${gaps.join("\n")}`;
}

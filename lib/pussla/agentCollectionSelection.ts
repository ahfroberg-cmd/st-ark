type AgentCollectionEntity = {
  id: string;
  label: string;
  date: string;
};

type AgentCollectionSelectionOptions = {
  everyN?: number;
  afterQuery?: string;
  matchQuery?: string;
  beforeDate?: string;
  afterDate?: string;
  year?: number;
  month?: number;
  limit?: number;
};

export function buildAgentCollectionSelectionRef(input: {
  target: "placements" | "courses";
  selectedIds: string[];
  nowISO?: string;
}): { target: "placements" | "courses"; ids: string[]; atISO: string } {
  return {
    target: input.target,
    ids: input.selectedIds,
    atISO: input.nowISO || new Date().toISOString(),
  };
}

export function buildAgentCollectionSelectionMessage(input: {
  target: "placements" | "courses";
  selectedCount: number;
  everyN: number;
}): string {
  const targetLabel = input.target === "placements" ? "placeringar" : "kurser";
  const cadenceLabel = input.everyN === 1 ? "alla" : `var ${input.everyN}:e`;
  return `Valde ${input.selectedCount} ${targetLabel} (${cadenceLabel}).`;
}

function normalizeIsoDateInput(value?: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export function buildPlacementCollectionEntities<T extends { id: string; label?: string }>(
  placements: T[],
  getPlacementStartISOForAgent: (placement: T) => string
): AgentCollectionEntity[] {
  return [...placements]
    .sort((a, b) => getPlacementStartISOForAgent(a).localeCompare(getPlacementStartISOForAgent(b)))
    .map((placement) => ({
      id: String(placement.id),
      label: String(placement.label || "Placering"),
      date: getPlacementStartISOForAgent(placement),
    }));
}

export function buildCourseCollectionEntities<T extends { id: string; title?: string; startDate?: string }>(
  courses: T[]
): AgentCollectionEntity[] {
  return [...courses]
    .sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || "")))
    .map((course) => ({
      id: String(course.id),
      label: String(course.title || "Kurs"),
      date: String(course.startDate || "").slice(0, 10),
    }));
}

export function selectAgentCollectionEntities(
  entities: AgentCollectionEntity[],
  options: AgentCollectionSelectionOptions
): { ok: true; selected: AgentCollectionEntity[]; everyN: number } | { ok: false; message: string } {
  const everyN = Math.max(1, Number(options.everyN || 1));
  const limit = Math.max(1, Math.min(100, Number(options.limit || 50)));
  const query = String(options.afterQuery || "").trim().toLowerCase();
  const beforeDate = normalizeIsoDateInput(options.beforeDate || "");
  const afterDate = normalizeIsoDateInput(options.afterDate || "");

  let filtered = entities;
  const match = String(options.matchQuery || "").trim().toLowerCase();
  if (match) filtered = filtered.filter((entity) => entity.label.toLowerCase().includes(match));
  if (Number.isFinite(options.year) && Number(options.year) > 1900) {
    filtered = filtered.filter((entity) => entity.date.slice(0, 4) === String(options.year));
  }
  if (Number.isFinite(options.month) && Number(options.month) >= 1 && Number(options.month) <= 12) {
    filtered = filtered.filter((entity) => Number(entity.date.slice(5, 7)) === Number(options.month));
  }
  if (beforeDate) filtered = filtered.filter((entity) => entity.date < beforeDate);
  if (afterDate) filtered = filtered.filter((entity) => entity.date > afterDate);
  if (filtered.length === 0) {
    return { ok: false, message: "Inga objekt hittades för urvalet." };
  }

  let startIndex = 0;
  if (query) {
    const idx = filtered.findIndex((entity) => entity.label.toLowerCase().includes(query));
    if (idx < 0) return { ok: false, message: `Hittade inget ankare som matchar "${options.afterQuery}".` };
    startIndex = idx + 1;
  }

  const selected = filtered
    .slice(startIndex)
    .filter((_, index) => index % everyN === 0)
    .slice(0, limit);

  return { ok: true, selected, everyN };
}

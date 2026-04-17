export const makeId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const isoToday = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export function monthDiffExact(startISO?: string, endISO?: string) {
  const s = new Date(startISO || "");
  const e = new Date(endISO || "");
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const ms = e.getTime() - s.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  return Math.max(0, days / 30.4375);
}

export function pickPercent(p: any): number {
  const v = Number(p?.percent ?? p?.ftePercent ?? p?.scopePercent ?? p?.omfattning ?? 100);
  return Number.isFinite(v) && v > 0 ? Math.min(100, Math.max(0, v)) : 100;
}

/** Samla BT-delmål från placement – robust, med djupskanning */
export function extractPlacementGoals(pl: any): string[] {
  const BT = (s: string) => /^BT[-_\s]*\d+/i.test(s || "");
  const out = new Set<string>();

  function add(s: unknown) {
    if (typeof s !== "string") return;
    const raw = s.trim();
    if (!BT(raw)) return;
    const norm = raw.replace(/\s+/g, "").replace(/^bt/i, "BT").replace(/[-_]/g, "");
    out.add(norm.toUpperCase());
  }

  function visit(v: any, depth = 0) {
    if (v == null || depth > 4) return;
    if (typeof v === "string") {
      add(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }
    if (typeof v === "object") {
      add((v as any).id as any);
      add((v as any).code as any);
      add((v as any).goalId as any);
      add((v as any).milestoneId as any);
      add((v as any).milestone as any);
      for (const k of Object.keys(v)) {
        add(k);
        visit((v as any)[k], depth + 1);
      }
    }
  }

  visit(pl?.btGoals);
  visit(pl?.btGoalIds);
  visit(pl?.btMilestones);
  visit(pl?.bt_milestones);
  visit(pl?.milestones);
  visit(pl?.goals);
  visit(pl?.goalIds);
  visit(pl?.milestoneIds);
  visit(pl?.meta);
  visit(
    {
      id: (pl as any)?.id,
      phase: (pl as any)?.phase,
      tags: (pl as any)?.tags,
      extra: (pl as any)?.extra,
    },
    0
  );

  return Array.from(out);
}

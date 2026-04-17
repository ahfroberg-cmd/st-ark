import type { PusslaAgentAction } from "@/lib/ai/types";
import { MAX_SUPERVISION_MEETING_DATES_PER_ACTION } from "@/lib/pussla/iupSupervisionLimits";

export const MAX_SUPERVISION_MEETING_DATES_PER_PLAN = MAX_SUPERVISION_MEETING_DATES_PER_ACTION;

/**
 * Slår ihop intilliggande add_iup_supervision_meetings och add_iup_followup (meeting)
 * till en enda batch, kapar till MAX per körning så modellen inte kan lägga 48×N möten.
 */
export function coalesceSupervisionMeetingAdds(actions: PusslaAgentAction[]): {
  actions: PusslaAgentAction[];
  truncatedDates: number;
} {
  const out: PusslaAgentAction[] = [];
  const buf: string[] = [];
  let truncatedDates = 0;

  const flush = () => {
    if (buf.length === 0) return;
    const normalized = buf.map((d) => String(d || "").trim().slice(0, 10));
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const d of normalized) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      if (seen.has(d)) continue;
      seen.add(d);
      uniq.push(d);
    }
    if (uniq.length === 0) {
      buf.length = 0;
      return;
    }
    if (uniq.length > MAX_SUPERVISION_MEETING_DATES_PER_ACTION) {
      truncatedDates += uniq.length - MAX_SUPERVISION_MEETING_DATES_PER_ACTION;
    }
    const capped = uniq.slice(0, MAX_SUPERVISION_MEETING_DATES_PER_ACTION);
    out.push({ type: "add_iup_supervision_meetings", dateISOs: capped });
    buf.length = 0;
  };

  for (const a of actions) {
    if (a.type === "add_iup_supervision_meetings") {
      const list = Array.isArray((a as { dateISOs?: unknown }).dateISOs)
        ? ((a as { dateISOs: unknown[] }).dateISOs as unknown[])
        : [];
      for (const d of list) buf.push(String(d));
      continue;
    }
    if (a.type === "add_iup_followup" && (a as { followupType?: string }).followupType === "meeting") {
      buf.push(String((a as { dateISO?: string }).dateISO || ""));
      continue;
    }
    flush();
    out.push(a);
  }
  flush();

  return { actions: out, truncatedDates };
}

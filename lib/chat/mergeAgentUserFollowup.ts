/**
 * Slår ihop användarens senaste korta svar med föregående agent-instruktion
 * så LLM/planner får full kontext (t.ex. "från 2021" efter handledarsamtalsfråga).
 */
export function mergeAgentUserFollowupInstruction(priorInstruction: string, userText: string): string {
  const t = String(userText || "").trim();
  const p = String(priorInstruction || "").trim();
  if (!p) return t;
  if (!t) return t;
  if (t.length > 160) return t;

  if (/^(och|sen|sedan|gör samma|gor samma|fortsätt|fortsatt|dvs|det vill saga|det vill säga)\b/i.test(t)) {
    return `${p}. ${t}`;
  }

  if (
    /^från\s+\d{4}\b/i.test(t) ||
    /^fran\s+\d{4}\b/i.test(t) ||
    /^till\s+\d{4}\b/i.test(t) ||
    /^år(en)?\s*(\d{4})\b/i.test(t) ||
    /^\d{4}\s*(-|–|till|,)\s*\d{4}\b/.test(t) ||
    /^\d{4}\s*$/i.test(t)
  ) {
    return `${p}. ${t}`;
  }

  return t;
}

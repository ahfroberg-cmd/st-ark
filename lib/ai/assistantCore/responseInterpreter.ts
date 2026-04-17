import type { AgentModelStopReason } from "@/lib/ai/types";

export interface LlmReplyInterpretation {
  assistantReply?: string;
  systemReply?: string;
  showedReply: boolean;
  blockedByStopReason: boolean;
}

function hasCommitmentLanguage(rawReply: string): boolean {
  return /(kommer (nu )?att utföra|kommer att (lägga|köra)|utför dessa steg|jag kommer nu att|nu att utföra|jag utför nu)/i.test(
    rawReply
  );
}

function shouldDropJsonEnvelope(rawReply: string): boolean {
  const looksJsonObject = rawReply.startsWith("{") && rawReply.endsWith("}");
  if (!looksJsonObject) return false;
  try {
    const obj = JSON.parse(rawReply) as any;
    return Boolean(
      obj &&
        typeof obj === "object" &&
        ("action" in obj || "actions" in obj || "reply" in obj)
    );
  } catch {
    return false;
  }
}

export function interpretLlmReply(params: {
  stopReason?: AgentModelStopReason;
  parsedReply?: string;
  llmPlanLength: number;
  simplifyText: (input: string) => string;
}): LlmReplyInterpretation {
  const sr = params.stopReason || "none";
  const reply = String(params.parsedReply || "").trim();
  if (sr === "unsupported" || sr === "unsafe" || sr === "needs_user") {
    return {
      assistantReply: reply ? params.simplifyText(reply) : undefined,
      showedReply: Boolean(reply),
      blockedByStopReason: true,
    };
  }
  if (!reply || params.llmPlanLength > 0) {
    return {
      showedReply: false,
      blockedByStopReason: false,
    };
  }

  const cleaned = shouldDropJsonEnvelope(reply) ? "" : params.simplifyText(reply);
  const commitment = hasCommitmentLanguage(reply);
  const systemReply =
    commitment && params.llmPlanLength === 0
      ? "Inga åtgärder kördes: AI-svaret saknade giltiga actions i JSON. Försök igen med samma mål, eller be om konkreta datum (YYYY-MM-DD) i en lista."
      : undefined;

  return {
    assistantReply: cleaned || undefined,
    systemReply,
    showedReply: Boolean(cleaned),
    blockedByStopReason: false,
  };
}

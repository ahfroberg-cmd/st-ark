import type { ProviderRequest, ProviderResponse } from "@/lib/ai/types";

function fallbackModel(model?: string): string {
  return model?.trim() || "gpt-4o";
}

export async function sendOpenAiChat(req: ProviderRequest): Promise<ProviderResponse> {
  const model = fallbackModel(req.model);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: req.temperature ?? 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI-fel (${response.status}): ${text}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("OpenAI svarade utan text.");
  }

  return { text, raw: data };
}

export async function listOpenAiModels(apiKey?: string): Promise<string[]> {
  if (!apiKey?.trim()) return [];
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) return [];
  const data = await response.json();
  const models: any[] = Array.isArray(data?.data) ? data.data : [];

  // Filtrera bort kända icke-chat-modeller (embeddings/audio/whisper).
  // Vi håller urvalet brett för att "allt tillgängligt" ska kännas rätt,
  // men undviker tydligt inkompatibla kategorier.
  return models
    .map((m) => (typeof m?.id === "string" ? m.id : ""))
    .filter(Boolean)
    .filter((id) => {
      const lower = id.toLowerCase();
      if (lower.includes("embedding")) return false;
      if (lower.includes("audio")) return false;
      if (lower.includes("whisper")) return false;
      if (lower.includes("tts")) return false;
      // Chat-capable: gpt-*/o* (brett antagande)
      if (lower.startsWith("gpt-")) return true;
      if (/^o\d/.test(lower)) return true;
      return false;
    });
}

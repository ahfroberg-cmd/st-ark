import type { ProviderRequest, ProviderResponse } from "@/lib/ai/types";

function fallbackModel(model?: string): string {
  return model?.trim() || "gemini-1.5-pro";
}

export async function sendGeminiChat(req: ProviderRequest): Promise<ProviderResponse> {
  const model = fallbackModel(req.model);
  const systemPrompt = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n")
    .trim();
  const userAndAssistant = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(req.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: {
          temperature: req.temperature ?? 0.2,
        },
        contents: userAndAssistant,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini-fel (${response.status}): ${text}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text)
    .filter(Boolean)
    .join("\n");

  if (!text) throw new Error("Gemini svarade utan text.");
  return { text, raw: data };
}

export async function listGeminiModels(apiKey?: string): Promise<string[]> {
  if (!apiKey?.trim()) return [];
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models?key=" +
    encodeURIComponent(apiKey);
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) return [];
  const data = await response.json();

  const rawModels: any[] = Array.isArray(data?.models)
    ? data.models
    : Array.isArray(data?.candidates)
      ? data.candidates
      : [];

  const ids = rawModels
    .map((m) => {
      const name = typeof m?.name === "string" ? m.name : "";
      // name kan vara "models/gemini-1.5-pro"
      const parts = name.split("/");
      return parts.length > 0 ? parts[parts.length - 1] : name;
    })
    .filter(Boolean)
    .filter((id) => id.toLowerCase().startsWith("gemini-"));

  return Array.from(new Set(ids));
}

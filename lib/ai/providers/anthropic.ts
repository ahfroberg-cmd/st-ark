import type { ProviderRequest, ProviderResponse } from "@/lib/ai/types";

function fallbackModel(model?: string): string {
  return model?.trim() || "claude-3-5-sonnet-latest";
}

export async function sendAnthropicChat(req: ProviderRequest): Promise<ProviderResponse> {
  const model = fallbackModel(req.model);
  const systemPrompt = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n")
    .trim();
  const messages = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": req.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: req.temperature ?? 0.2,
      system: systemPrompt || undefined,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic-fel (${response.status}): ${text}`);
  }

  const data = await response.json();
  const text = Array.isArray(data?.content)
    ? data.content
        .filter((c: any) => c?.type === "text" && typeof c?.text === "string")
        .map((c: any) => c.text)
        .join("\n")
    : "";

  if (!text) throw new Error("Anthropic svarade utan text.");
  return { text, raw: data };
}

export async function listAnthropicModels(apiKey?: string): Promise<string[]> {
  if (!apiKey?.trim()) return [];
  const response = await fetch("https://api.anthropic.com/v1/models", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!response.ok) return [];
  const data = await response.json();
  const models: any[] = Array.isArray(data?.data) ? data.data : [];

  return models
    .map((m) => (typeof m?.id === "string" ? m.id : ""))
    .filter(Boolean)
    .filter((id) => id.toLowerCase().startsWith("claude-"));
}

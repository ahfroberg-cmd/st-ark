import type { ProviderRequest, ProviderResponse } from "@/lib/ai/types";
import { sendAnthropicChat } from "@/lib/ai/providers/anthropic";
import { sendGeminiChat } from "@/lib/ai/providers/gemini";
import { sendOpenAiChat } from "@/lib/ai/providers/openai";
import { listAnthropicModels } from "@/lib/ai/providers/anthropic";
import { listGeminiModels } from "@/lib/ai/providers/gemini";
import { listOpenAiModels } from "@/lib/ai/providers/openai";

export async function sendChatWithProvider(req: ProviderRequest): Promise<ProviderResponse> {
  if (!req.apiKey?.trim()) throw new Error("API-nyckel saknas.");
  switch (req.provider) {
    case "openai":
      return sendOpenAiChat(req);
    case "anthropic":
      return sendAnthropicChat(req);
    case "gemini":
      return sendGeminiChat(req);
    default:
      throw new Error("Okänd AI-provider.");
  }
}

export async function listModelsForProvider(req: {
  provider: "openai" | "anthropic" | "gemini";
  apiKey?: string;
}): Promise<string[]> {
  switch (req.provider) {
    case "openai":
      return listOpenAiModels(req.apiKey);
    case "anthropic":
      return listAnthropicModels(req.apiKey);
    case "gemini":
      return listGeminiModels(req.apiKey);
    default:
      return [];
  }
}

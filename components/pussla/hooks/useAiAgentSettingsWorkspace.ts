"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentConfirmMode } from "@/components/chat/PusslaChatWidget";
import type { AiProvider } from "@/lib/ai/types";
import { storeEncryptedApiKey, unlockApiKey } from "@/lib/ai/localKeyVault";
import { listModelsForProvider } from "@/lib/ai/providerRouter";

const AI_AGENT_ENABLED_KEY = "stark:ai-agent:enabled:v1";
const AI_AGENT_PROVIDER_KEY = "stark:ai-agent:provider:v1";
const AI_AGENT_CONFIRM_MODE_KEY = "stark:ai-agent:confirm-mode:v1";

export function useAiAgentSettingsWorkspace(params: { authUserId?: string | null }) {
  const [aiAgentMenuOpen, setAiAgentMenuOpen] = useState(false);
  const [aiAgentEnabled, setAiAgentEnabled] = useState(true);
  const [aiAgentMenuTab, setAiAgentMenuTab] = useState<"settings" | "history">("settings");
  const [aiAgentHistory, setAiAgentHistory] = useState<
    { role: "user" | "assistant" | "system"; text: string; id?: string }[]
  >([]);
  const [aiAgentConfirmMode, setAiAgentConfirmMode] = useState<AgentConfirmMode>("never");
  const [aiAgentProvider, setAiAgentProvider] = useState<AiProvider>("openai");
  const [aiAgentModels, setAiAgentModels] = useState<Record<AiProvider, string>>({
    openai: "gpt-4o",
    anthropic: "claude-3-5-sonnet-latest",
    gemini: "gemini-1.5-pro",
  });

  const aiAgentModelOptionsFallback: Record<AiProvider, { value: string; label: string }[]> = {
    openai: [
      { value: "gpt-4o", label: "GPT-4o (stark)" },
      { value: "gpt-4o-mini", label: "GPT-4o mini (snabb)" },
    ],
    anthropic: [{ value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet (stark)" }],
    gemini: [
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (stark)" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (snabb)" },
    ],
  };

  const [aiAgentModelOptions, setAiAgentModelOptions] = useState<
    Record<AiProvider, { value: string; label: string }[]>
  >(aiAgentModelOptionsFallback);
  const [aiAgentModelsLoaded, setAiAgentModelsLoaded] = useState<Partial<Record<AiProvider, boolean>>>({});
  const [aiAgentModelsLoading, setAiAgentModelsLoading] = useState(false);
  const [aiAgentUnlockedKeys, setAiAgentUnlockedKeys] = useState<Partial<Record<AiProvider, string>>>({});
  const [aiAgentActivationPromptOpen, setAiAgentActivationPromptOpen] = useState(false);
  const [aiAgentPassphrase, setAiAgentPassphrase] = useState("");
  const [aiAgentNewApiKey, setAiAgentNewApiKey] = useState("");
  const [aiAgentNewPassphrase, setAiAgentNewPassphrase] = useState("");
  const [aiAgentReplaceKeyMode, setAiAgentReplaceKeyMode] = useState(false);
  const [aiAgentMsg, setAiAgentMsg] = useState("");
  const [aiAgentInfoOpen, setAiAgentInfoOpen] = useState(false);
  const [aiAgentInfoTab, setAiAgentInfoTab] = useState<"information" | "säkerhet">("information");

  useEffect(() => {
    if (!aiAgentMenuOpen) return;
    const providers: AiProvider[] = ["openai", "anthropic", "gemini"];

    void (async () => {
      setAiAgentModelsLoading(true);
      try {
        await Promise.all(
          providers.map(async (p) => {
            if (aiAgentModelsLoaded[p]) return;
            const apiKey = aiAgentUnlockedKeys[p];
            if (!apiKey?.trim()) return;
            try {
              const ids = await listModelsForProvider({ provider: p, apiKey });
              const options =
                ids.length > 0
                  ? ids.map((id) => ({ value: id, label: id }))
                  : aiAgentModelOptionsFallback[p];
              setAiAgentModelOptions((prev) => ({ ...prev, [p]: options }));
              if (ids.length > 0) setAiAgentModelsLoaded((prev) => ({ ...prev, [p]: true }));
            } catch {
              // keep fallback list
            }
          })
        );
      } finally {
        setAiAgentModelsLoading(false);
      }
    })();
  }, [
    aiAgentMenuOpen,
    aiAgentUnlockedKeys.openai,
    aiAgentUnlockedKeys.anthropic,
    aiAgentUnlockedKeys.gemini,
    aiAgentModelsLoaded,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      {
        const raw = window.localStorage.getItem(AI_AGENT_ENABLED_KEY);
        setAiAgentEnabled(raw === null ? true : raw === "1");
      }
      const storedProvider = window.localStorage.getItem(AI_AGENT_PROVIDER_KEY) as AiProvider | null;
      if (storedProvider === "openai" || storedProvider === "anthropic" || storedProvider === "gemini") {
        setAiAgentProvider(storedProvider);
      }
      const storedConfirmMode = window.localStorage.getItem(AI_AGENT_CONFIRM_MODE_KEY) as AgentConfirmMode | null;
      if (
        storedConfirmMode === "never" ||
        storedConfirmMode === "destructive" ||
        storedConfirmMode === "all"
      ) {
        setAiAgentConfirmMode(storedConfirmMode);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AI_AGENT_ENABLED_KEY, aiAgentEnabled ? "1" : "0");
  }, [aiAgentEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!aiAgentMenuOpen || aiAgentMenuTab !== "history") return;
    const historyKey = "stark:pussla-chat-history:v1";
    try {
      const raw = window.localStorage.getItem(historyKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        setAiAgentHistory([]);
        return;
      }
      const filtered = parsed
        .filter((x: any) => x && typeof x.text === "string" && x.role)
        .map((x: any) => ({
          role: x.role,
          text: x.text,
          id: x.id,
        }))
        .filter((x: any) => x.role === "user" || x.role === "assistant" || x.role === "system");
      setAiAgentHistory(filtered);
    } catch {
      setAiAgentHistory([]);
    }
  }, [aiAgentMenuOpen, aiAgentMenuTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setAiAgentActivationPromptOpen(true);
    window.addEventListener("stark:ai-agent:request-activation", handler as any);
    return () => {
      window.removeEventListener("stark:ai-agent:request-activation", handler as any);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AI_AGENT_PROVIDER_KEY, aiAgentProvider);
  }, [aiAgentProvider]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AI_AGENT_CONFIRM_MODE_KEY, aiAgentConfirmMode);
  }, [aiAgentConfirmMode]);

  useEffect(() => {
    setAiAgentReplaceKeyMode(false);
  }, [aiAgentProvider]);

  useEffect(() => {
    if (!params.authUserId) return;
    if (!aiAgentEnabled || aiAgentMenuOpen) {
      setAiAgentActivationPromptOpen(false);
      return;
    }
    const unlocked = !!aiAgentUnlockedKeys[aiAgentProvider];
    if (unlocked) setAiAgentActivationPromptOpen(false);
  }, [params.authUserId, aiAgentEnabled, aiAgentProvider, aiAgentUnlockedKeys, aiAgentMenuOpen]);

  const saveAiAgentKey = useCallback(async () => {
    try {
      if (!aiAgentNewApiKey.trim() || !aiAgentNewPassphrase.trim()) {
        setAiAgentMsg("Ange både API-nyckel och lösenord.");
        return;
      }
      await storeEncryptedApiKey({
        provider: aiAgentProvider,
        apiKey: aiAgentNewApiKey.trim(),
        passphrase: aiAgentNewPassphrase,
      });
      setAiAgentUnlockedKeys((prev) => ({ ...prev, [aiAgentProvider]: aiAgentNewApiKey.trim() }));
      setAiAgentNewApiKey("");
      setAiAgentNewPassphrase("");
      setAiAgentReplaceKeyMode(false);
      setAiAgentMsg("Nyckel sparad och AI-agent aktiverad.");
      setAiAgentMenuOpen(false);
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("stark:ai-agent:open"));
        }
      }, 0);
    } catch (err) {
      setAiAgentMsg(err instanceof Error ? err.message : "Kunde inte spara nyckel.");
    }
  }, [aiAgentProvider, aiAgentNewApiKey, aiAgentNewPassphrase]);

  const unlockAiAgent = useCallback(async () => {
    try {
      if (!aiAgentPassphrase.trim()) {
        setAiAgentMsg("Ange lösenord.");
        return;
      }
      const apiKey = await unlockApiKey({
        provider: aiAgentProvider,
        passphrase: aiAgentPassphrase,
      });
      setAiAgentUnlockedKeys((prev) => ({ ...prev, [aiAgentProvider]: apiKey }));
      setAiAgentPassphrase("");
      setAiAgentActivationPromptOpen(false);
      setAiAgentMsg("AI-agent aktiverad.");
      setAiAgentMenuOpen(false);
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("stark:ai-agent:open"));
        }
      }, 0);
    } catch (err) {
      setAiAgentMsg(err instanceof Error ? err.message : "Kunde inte aktivera AI-agent.");
    }
  }, [aiAgentPassphrase, aiAgentProvider]);

  const lockAiAgent = useCallback(() => {
    setAiAgentUnlockedKeys((prev) => ({ ...prev, [aiAgentProvider]: undefined }));
    setAiAgentMsg("Session låst — nyckeln är borttagen ur minnet. Aktivera igen med lösenord när du vill.");
  }, [aiAgentProvider]);

  return {
    aiAgentMenuOpen,
    setAiAgentMenuOpen,
    aiAgentEnabled,
    setAiAgentEnabled,
    aiAgentMenuTab,
    setAiAgentMenuTab,
    aiAgentHistory,
    aiAgentConfirmMode,
    setAiAgentConfirmMode,
    aiAgentProvider,
    setAiAgentProvider,
    aiAgentModels,
    setAiAgentModels,
    aiAgentModelOptions,
    aiAgentModelsLoading,
    aiAgentUnlockedKeys,
    setAiAgentUnlockedKeys,
    aiAgentActivationPromptOpen,
    setAiAgentActivationPromptOpen,
    aiAgentPassphrase,
    setAiAgentPassphrase,
    aiAgentNewApiKey,
    setAiAgentNewApiKey,
    aiAgentNewPassphrase,
    setAiAgentNewPassphrase,
    aiAgentReplaceKeyMode,
    setAiAgentReplaceKeyMode,
    aiAgentMsg,
    setAiAgentMsg,
    aiAgentInfoOpen,
    setAiAgentInfoOpen,
    aiAgentInfoTab,
    setAiAgentInfoTab,
    saveAiAgentKey,
    unlockAiAgent,
    lockAiAgent,
  };
}

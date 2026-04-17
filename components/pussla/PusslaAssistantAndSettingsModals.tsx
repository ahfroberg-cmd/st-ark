"use client";

import SearchModal from "@/components/pussla/SearchModal";
import SettingsMenuModal from "@/components/pussla/SettingsMenuModal";
import AiAgentMenuModal from "@/components/pussla/AiAgentMenuModal";
import AiAgentActivationPromptModal from "@/components/pussla/AiAgentActivationPromptModal";
import AiAgentInfoModal from "@/components/pussla/AiAgentInfoModal";
import type { AiProvider } from "@/lib/ai/types";
import type { AgentConfirmMode } from "@/components/chat/PusslaChatWidget";

export default function PusslaAssistantAndSettingsModals(props: {
  searchOpen: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchHits: any[];
  runSearchHit: (hit: any) => void | Promise<void>;
  setSearchOpen: (value: boolean) => void;
  settingsOpen: boolean;
  aiAgentEnabled: boolean;
  setSettingsOpen: (value: boolean) => void;
  setAiAgentEnabled: (value: boolean) => void;
  setAiAgentActivationPromptOpen: (value: boolean) => void;
  setProfileOpen: (value: boolean) => void;
  setAboutOpen: (value: boolean) => void;
  setSaveInfoOpen: (value: boolean) => void;
  setLogoutConfirmOpen: (value: boolean) => void;
  aiAgentMenuOpen: boolean;
  aiAgentProvider: AiProvider;
  aiAgentModels: Record<AiProvider, string>;
  aiAgentModelOptions: Record<AiProvider, Array<{ value: string; label: string }>>;
  aiAgentModelsLoading: boolean;
  aiAgentConfirmMode: AgentConfirmMode;
  aiAgentNewApiKey: string;
  aiAgentNewPassphrase: string;
  aiAgentPassphrase: string;
  aiAgentReplaceKeyMode: boolean;
  aiAgentMsg: string;
  hasStoredApiKey: (provider: AiProvider) => boolean;
  aiAgentUnlockedKeys: Partial<Record<AiProvider, string>>;
  setAiAgentMenuOpen: (value: boolean) => void;
  setAiAgentProvider: (provider: AiProvider) => void;
  setAiAgentModels: (updater: (prev: Record<AiProvider, string>) => Record<AiProvider, string>) => void;
  setAiAgentNewApiKey: (value: string) => void;
  setAiAgentNewPassphrase: (value: string) => void;
  setAiAgentPassphrase: (value: string) => void;
  saveAiAgentKey: () => void | Promise<void>;
  unlockAiAgent: () => void | Promise<void>;
  lockAiAgent: () => void;
  setAiAgentReplaceKeyMode: (value: boolean) => void;
  setAiAgentMsg: (value: string) => void;
  clearStoredApiKey: (provider: AiProvider) => void;
  setAiAgentUnlockedKeys: (updater: (prev: Partial<Record<AiProvider, string>>) => Partial<Record<AiProvider, string>>) => void;
  setAiAgentConfirmMode: (mode: AgentConfirmMode) => void;
  aiAgentActivationPromptOpen: boolean;
  setAiAgentMenuTab: (value: "settings" | "history") => void;
  aiAgentInfoOpen: boolean;
  aiAgentInfoTab: "information" | "säkerhet";
  setAiAgentInfoTab: (value: "information" | "säkerhet") => void;
  setAiAgentInfoOpen: (value: boolean) => void;
}) {
  return (
    <>
      <SearchModal
        open={props.searchOpen}
        query={props.searchQuery}
        onQueryChange={props.setSearchQuery}
        hits={props.searchHits}
        onRunHit={(hit) => {
          void props.runSearchHit(hit);
        }}
        onClose={() => props.setSearchOpen(false)}
      />

      <SettingsMenuModal
        open={props.settingsOpen}
        onClose={() => props.setSettingsOpen(false)}
        onOpenProfile={() => {
          props.setSettingsOpen(false);
          props.setProfileOpen(true);
        }}
        onOpenAbout={() => {
          props.setSettingsOpen(false);
          props.setAboutOpen(true);
        }}
        onOpenAiAssistant={() => {
          props.setSettingsOpen(false);
          props.setAiAgentMenuTab("settings");
          props.setAiAgentMenuOpen(true);
        }}
        onOpenSave={() => {
          props.setSettingsOpen(false);
          props.setSaveInfoOpen(true);
        }}
        onLogout={() => {
          props.setSettingsOpen(false);
          props.setLogoutConfirmOpen(true);
        }}
      />

      <AiAgentMenuModal
        open={props.aiAgentMenuOpen}
        aiAgentEnabled={props.aiAgentEnabled}
        aiAgentProvider={props.aiAgentProvider}
        aiAgentModel={props.aiAgentModels[props.aiAgentProvider]}
        aiAgentModelOptions={(() => {
          const selected = props.aiAgentModels[props.aiAgentProvider];
          const options = props.aiAgentModelOptions[props.aiAgentProvider] || [];
          const hasSelected = options.some((option) => option.value === selected);
          return hasSelected || !selected ? options : [{ value: selected, label: selected }, ...options];
        })()}
        aiAgentModelsLoading={props.aiAgentModelsLoading}
        aiAgentConfirmMode={props.aiAgentConfirmMode}
        aiAgentNewApiKey={props.aiAgentNewApiKey}
        aiAgentNewPassphrase={props.aiAgentNewPassphrase}
        aiAgentPassphrase={props.aiAgentPassphrase}
        aiAgentReplaceKeyMode={props.aiAgentReplaceKeyMode}
        aiAgentMsg={props.aiAgentMsg}
        hasStoredKey={props.hasStoredApiKey(props.aiAgentProvider)}
        isUnlocked={Boolean(props.aiAgentUnlockedKeys[props.aiAgentProvider])}
        onClose={() => props.setAiAgentMenuOpen(false)}
        onToggleAssistant={() => {
          const next = !props.aiAgentEnabled;
          props.setAiAgentEnabled(next);
          if (!next) props.setAiAgentActivationPromptOpen(false);
        }}
        onProviderChange={(provider) => props.setAiAgentProvider(provider)}
        onModelChange={(model) =>
          props.setAiAgentModels((prev) => ({ ...prev, [props.aiAgentProvider]: model }))
        }
        onNewApiKeyChange={props.setAiAgentNewApiKey}
        onNewPassphraseChange={props.setAiAgentNewPassphrase}
        onPassphraseChange={props.setAiAgentPassphrase}
        onSaveAiAgentKey={() => {
          void props.saveAiAgentKey();
        }}
        onUnlockAiAgent={() => {
          void props.unlockAiAgent();
        }}
        onLockAiAgent={props.lockAiAgent}
        onStartReplaceKey={() => {
          props.setAiAgentReplaceKeyMode(true);
          props.setAiAgentNewApiKey("");
          props.setAiAgentNewPassphrase("");
        }}
        onCancelReplaceKey={() => {
          props.setAiAgentReplaceKeyMode(false);
          props.setAiAgentNewApiKey("");
          props.setAiAgentNewPassphrase("");
        }}
        onClearStoredKey={() => {
          props.clearStoredApiKey(props.aiAgentProvider);
          props.setAiAgentUnlockedKeys((prev) => ({ ...prev, [props.aiAgentProvider]: undefined }));
          props.setAiAgentReplaceKeyMode(false);
          props.setAiAgentMsg("Sparad nyckel borttagen.");
        }}
        onConfirmModeChange={props.setAiAgentConfirmMode}
      />

      <AiAgentActivationPromptModal
        open={props.aiAgentActivationPromptOpen && props.aiAgentEnabled}
        aiAgentProvider={props.aiAgentProvider}
        aiAgentPassphrase={props.aiAgentPassphrase}
        onPassphraseChange={props.setAiAgentPassphrase}
        onActivate={() => {
          void props.unlockAiAgent();
        }}
        onChangeApiCode={() => {
          props.setAiAgentActivationPromptOpen(false);
          props.setAiAgentMenuTab("settings");
          props.setAiAgentMenuOpen(true);
          props.setAiAgentReplaceKeyMode(true);
          props.setAiAgentNewApiKey("");
          props.setAiAgentNewPassphrase("");
          props.setAiAgentPassphrase("");
        }}
        onNotNow={() => props.setAiAgentActivationPromptOpen(false)}
      />

      <AiAgentInfoModal
        open={props.aiAgentInfoOpen}
        tab={props.aiAgentInfoTab}
        onTabChange={props.setAiAgentInfoTab}
        onClose={() => props.setAiAgentInfoOpen(false)}
      />
    </>
  );
}

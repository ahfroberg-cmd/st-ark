"use client";

import PusslaChatWidget, { type AgentConfirmMode } from "@/components/chat/PusslaChatWidget";
import type { AiProvider } from "@/lib/ai/types";
import dynamic from "next/dynamic";

const StudierektorNotificationPopup = dynamic(() => import("@/components/StudierektorNotificationPopup"), {
  ssr: false,
});

export default function PusslaChatAndNotifications(props: {
  adapter: any;
  aiAgentEnabled: boolean;
  aiAgentProvider: AiProvider;
  aiAgentModels: Record<AiProvider, string>;
  aiAgentUnlockedKeys: Partial<Record<AiProvider, string>>;
  aiAgentConfirmMode: AgentConfirmMode;
  setAiAgentProvider: (provider: AiProvider) => void;
  setAiAgentModels: (updater: (prev: Record<AiProvider, string>) => Record<AiProvider, string>) => void;
}) {
  return (
    <>
      <PusslaChatWidget
        adapter={props.adapter}
        enabled={props.aiAgentEnabled}
        provider={props.aiAgentProvider}
        model={props.aiAgentModels[props.aiAgentProvider]}
        apiKey={props.aiAgentUnlockedKeys[props.aiAgentProvider]}
        confirmMode={props.aiAgentConfirmMode}
        onProviderChange={props.setAiAgentProvider}
        onModelChange={(model) =>
          props.setAiAgentModels((prev) => ({ ...prev, [props.aiAgentProvider]: model }))
        }
      />
      <StudierektorNotificationPopup />
    </>
  );
}

"use client";

type AiAssistantEntryModalProps = {
  open: boolean;
  aiAgentEnabled: boolean;
  onClose: () => void;
  onToggleAssistant: () => void;
  onOpenAdvancedSettings: () => void;
};

export default function AiAssistantEntryModal({
  open,
  aiAgentEnabled,
  onClose,
  onToggleAssistant,
  onOpenAdvancedSettings,
}: AiAssistantEntryModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[92] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b-2 border-black px-6 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">AI-assistent</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
            >
              Stäng
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">AI-assistent</span>
            <button
              type="button"
              onClick={onToggleAssistant}
              aria-pressed={aiAgentEnabled}
              role="switch"
              aria-checked={aiAgentEnabled}
              title={aiAgentEnabled ? "AI-assistent på" : "AI-assistent av"}
              className={`inline-flex items-center gap-2 rounded-full border px-2 py-1.5 text-sm font-semibold transition-colors ${
                aiAgentEnabled
                  ? "border-violet-700 bg-violet-700 text-white hover:bg-violet-800"
                  : "border-violet-300 bg-violet-100 text-violet-800 hover:bg-violet-200"
              }`}
            >
              <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  aiAgentEnabled ? "bg-violet-500/60" : "bg-violet-300/70"
                }`}
              >
                <span
                  className={`absolute h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    aiAgentEnabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </span>
              {aiAgentEnabled ? "På" : "Av"}
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenAdvancedSettings}
            className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700"
          >
            Inställningar
          </button>
          <p className="text-xs text-slate-500">
            Här ställer du in API-nyckel, modell, lösenord och hur assistenten ska bekräfta ändringar.
          </p>
        </div>
      </div>
    </div>
  );
}

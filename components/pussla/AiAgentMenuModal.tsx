"use client";

export default function AiAgentMenuModal(props: {
  open: boolean;
  aiAgentEnabled: boolean;
  aiAgentProvider: "openai" | "anthropic" | "gemini";
  aiAgentModel: string;
  aiAgentModelOptions: { value: string; label: string }[];
  aiAgentModelsLoading: boolean;
  aiAgentConfirmMode: "never" | "destructive" | "all";
  aiAgentNewApiKey: string;
  aiAgentNewPassphrase: string;
  aiAgentPassphrase: string;
  aiAgentReplaceKeyMode: boolean;
  aiAgentMsg: string;
  hasStoredKey: boolean;
  isUnlocked: boolean;
  onClose: () => void;
  onToggleAssistant: () => void;
  onProviderChange: (provider: "openai" | "anthropic" | "gemini") => void;
  onModelChange: (model: string) => void;
  onNewApiKeyChange: (value: string) => void;
  onNewPassphraseChange: (value: string) => void;
  onPassphraseChange: (value: string) => void;
  onSaveAiAgentKey: () => void;
  onUnlockAiAgent: () => void;
  onLockAiAgent: () => void;
  onStartReplaceKey: () => void;
  onCancelReplaceKey: () => void;
  onClearStoredKey: () => void;
  onConfirmModeChange: (mode: "never" | "destructive" | "all") => void;
}) {
  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
      onClick={props.onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 pt-5 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-900">AI-assistent</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={props.onToggleAssistant}
                aria-pressed={props.aiAgentEnabled}
                role="switch"
                aria-checked={props.aiAgentEnabled}
                title={props.aiAgentEnabled ? "AI-assistent på" : "AI-assistent av"}
                className={`inline-flex items-center gap-2 rounded-full border px-2 py-1.5 text-sm font-semibold transition-colors ${
                  props.aiAgentEnabled
                    ? "border-violet-700 bg-violet-700 text-white hover:bg-violet-800"
                    : "border-violet-300 bg-violet-100 text-violet-800 hover:bg-violet-200"
                }`}
              >
                <span
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    props.aiAgentEnabled ? "bg-violet-500/60" : "bg-violet-300/70"
                  }`}
                >
                  <span
                    className={`absolute h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      props.aiAgentEnabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </span>
                {props.aiAgentEnabled ? "På" : "Av"}
              </button>
              <button
                type="button"
                onClick={props.onClose}
                className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={props.aiAgentProvider}
                onChange={(e) =>
                  props.onProviderChange(e.target.value as "openai" | "anthropic" | "gemini")
                }
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
              </select>
              <select
                value={props.aiAgentModel}
                onChange={(e) => props.onModelChange(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                aria-label="Välj modell"
                disabled={props.aiAgentModelsLoading}
              >
                {props.aiAgentModelOptions.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">Spara nyckel och aktivera AI-agent</p>
              <p className="mt-1 text-xs text-slate-600">
                {props.isUnlocked
                  ? "Session aktiv — nyckeln finns i minnet så länge sidan är öppen."
                  : props.hasStoredKey
                  ? "Nyckel finns redan sparad krypterat i den här webbläsaren. Du behöver inte klistra in nyckeln igen — ange bara lösenordet nedan, eller vänta på frågan när du laddar om sidan."
                  : "Klistra in API-nyckel och välj ett lösenord. En knapp sparar nyckeln lokalt och aktiverar agenten direkt."}
              </p>

              {(!props.hasStoredKey || props.aiAgentReplaceKeyMode) ? (
                <>
                  <div className="mt-3 space-y-2">
                    <input
                      type="password"
                      value={props.aiAgentNewApiKey}
                      onChange={(e) => props.onNewApiKeyChange(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="API-nyckel"
                      autoComplete="off"
                    />
                    <input
                      type="password"
                      value={props.aiAgentNewPassphrase}
                      onChange={(e) => props.onNewPassphraseChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        props.onSaveAiAgentKey();
                      }}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Lösenord (krypterar nyckeln lokalt)"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={props.onSaveAiAgentKey}
                    className="mt-3 w-full rounded-md border border-sky-700 bg-sky-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"
                  >
                    Spara nyckel och aktivera AI-agent
                  </button>
                  {props.hasStoredKey && props.aiAgentReplaceKeyMode ? (
                    <button
                      type="button"
                      onClick={props.onCancelReplaceKey}
                      className="mt-2 text-[13px] font-medium text-slate-600 underline hover:text-slate-900"
                    >
                      Avbryt byt nyckel
                    </button>
                  ) : null}
                </>
              ) : props.hasStoredKey && !props.isUnlocked ? (
                <>
                  <p className="mt-3 text-xs text-slate-600">
                    Ange samma lösenord som när du sparade nyckeln — inget nytt steg med API-nyckel.
                  </p>
                  <div className="mt-2 space-y-2">
                    <input
                      type="password"
                      value={props.aiAgentPassphrase}
                      onChange={(e) => props.onPassphraseChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        props.onUnlockAiAgent();
                      }}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Lösenord"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={props.onUnlockAiAgent}
                      className="w-full rounded-md border border-emerald-700 bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      Aktivera AI-agent
                    </button>
                  </div>
                </>
              ) : null}

              {props.hasStoredKey && props.isUnlocked && !props.aiAgentReplaceKeyMode ? (
                <button
                  type="button"
                  onClick={props.onStartReplaceKey}
                  className="mt-3 text-[13px] font-medium text-sky-800 underline hover:text-sky-950"
                >
                  Byt API-nyckel
                </button>
              ) : null}

              {props.hasStoredKey || props.isUnlocked ? (
                <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  {props.isUnlocked ? (
                    <button
                      type="button"
                      onClick={props.onLockAiAgent}
                      title="Tar bort den dekrypterade nyckeln ur minnet (t.ex. om du lämnar datorn). Den krypterade kopian finns kvar — aktivera igen med lösenord."
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 sm:w-auto"
                    >
                      Lås session
                    </button>
                  ) : null}
                  {props.hasStoredKey ? (
                    <button
                      type="button"
                      onClick={props.onClearStoredKey}
                      className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 sm:w-auto"
                    >
                      Ta bort sparad nyckel
                    </button>
                  ) : null}
                </div>
              ) : null}
              {props.aiAgentMsg ? <p className="mt-3 text-xs text-slate-600">{props.aiAgentMsg}</p> : null}
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-800">AI-agent frågar innan ändringar</p>
              <input
                type="range"
                min={1}
                max={3}
                step={1}
                value={
                  props.aiAgentConfirmMode === "never"
                    ? 1
                    : props.aiAgentConfirmMode === "destructive"
                    ? 2
                    : 3
                }
                onChange={(e) => {
                  const value = Number(e.target.value);
                  props.onConfirmModeChange(
                    value <= 1 ? "never" : value === 2 ? "destructive" : "all"
                  );
                }}
                className="mt-3 w-full"
              />
              <div className="mt-2 grid grid-cols-3 text-[11px] text-slate-600">
                <span className="text-left">1) Aldrig</span>
                <span className="text-center">2) Vid borttagning</span>
                <span className="text-right">3) Alla ändringar</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Nuvarande:{" "}
                {props.aiAgentConfirmMode === "never"
                  ? "Aldrig"
                  : props.aiAgentConfirmMode === "destructive"
                  ? "Vid ändringar som tar bort information"
                  : "Alla ändringar"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

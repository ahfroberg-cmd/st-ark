"use client";

export default function AiAgentActivationPromptModal(props: {
  open: boolean;
  aiAgentProvider: "openai" | "anthropic" | "gemini";
  aiAgentPassphrase: string;
  onPassphraseChange: (value: string) => void;
  onActivate: () => void;
  onChangeApiCode: () => void;
  onNotNow: () => void;
}) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 pt-5 pb-4">
          <h2 className="text-xl font-bold text-slate-900">Aktivera AI-agent</h2>
        </div>
        <div className="space-y-3 p-6">
          <p className="text-sm text-slate-600">
            Nyckeln finns sparad i din webbläsare. Ange samma lösenord som när du sparade den — du
            behöver inte klistra in API-nyckeln igen.
          </p>
          <input
            type="password"
            value={props.aiAgentPassphrase}
            onChange={(e) => props.onPassphraseChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              props.onActivate();
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={`Lösenord för ${props.aiAgentProvider}`}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={props.onChangeApiCode}
              className="rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
            >
              Ändra API-kod
            </button>
            <button
              type="button"
              onClick={props.onNotNow}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Inte nu
            </button>
            <button
              type="button"
              onClick={props.onActivate}
              className="rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Aktivera
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

export type NameChangePromptData = {
  existingName: string;
  newName: string;
  personnummer: string;
  pendingData: any;
};

export default function NameChangePromptModal({
  prompt,
  onUseExisting,
  onUseNew,
  onCancel,
}: {
  prompt: NameChangePromptData | null;
  onUseExisting: () => void;
  onUseNew: () => void;
  onCancel: () => void;
}) {
  if (!prompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-bold text-slate-900">Namnbyte upptäckt</h3>
        <p className="mb-4 text-slate-600">
          Personnummer <strong>{prompt.personnummer}</strong> finns redan i listan med namnet{" "}
          <strong>{prompt.existingName}</strong>, men den nya filen har namnet <strong>{prompt.newName}</strong>.
        </p>
        <p className="mb-6 text-slate-600">Vilket namn ska användas?</p>
        <div className="flex gap-3">
          <button
            onClick={onUseExisting}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            {prompt.existingName}
          </button>
          <button
            onClick={onUseNew}
            className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            {prompt.newName}
          </button>
        </div>
        <button onClick={onCancel} className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700">
          Avbryt
        </button>
      </div>
    </div>
  );
}

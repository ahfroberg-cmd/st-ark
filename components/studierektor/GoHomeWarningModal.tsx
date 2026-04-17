"use client";

export default function GoHomeWarningModal({
  open,
  onCancel,
  onSaveAndContinue,
  onContinueWithoutSave,
}: {
  open: boolean;
  onCancel: () => void;
  onSaveAndContinue: () => Promise<void> | void;
  onContinueWithoutSave: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] grid place-items-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <header className="border-b px-6 py-3 flex items-center justify-between">
          <h3 className="text-lg font-extrabold m-0">Innan du går vidare</h3>
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          >
            Avbryt
          </button>
        </header>
        <div className="p-6">
          <p className="text-slate-700 mb-6">Om du har gjort ändringar, spara först så att du kan fortsätta senare.</p>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onSaveAndContinue}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
            >
              Spara och gå vidare
            </button>
            <button
              onClick={onContinueWithoutSave}
              className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:border-slate-700 hover:bg-slate-700 active:translate-y-px"
            >
              Gå vidare utan att spara
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

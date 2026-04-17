"use client";

type SettingsMenuModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenAbout: () => void;
  onOpenAiAssistant: () => void;
  onOpenSave: () => void;
  onLogout: () => void;
};

export default function SettingsMenuModal({
  open,
  onClose,
  onOpenProfile,
  onOpenAbout,
  onOpenAiAssistant,
  onOpenSave,
  onLogout,
}: SettingsMenuModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b-2 border-black px-6 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Meny</h2>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
            >
              Stäng
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={onOpenProfile}
                className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700"
              >
                Profil
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onOpenAbout}
                className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700"
              >
                Om
              </button>
              <button
                onClick={onOpenAiAssistant}
                className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-700"
              >
                AI-assistent
              </button>
            </div>
          </div>
        </div>

        <div className="border-t-2 border-black px-6 py-4">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onOpenSave}
              className="rounded-lg border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
            >
              Spara
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Logga ut
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

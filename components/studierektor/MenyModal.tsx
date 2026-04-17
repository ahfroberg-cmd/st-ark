"use client";

export default function MenyModal({
  open,
  onClose,
  onOpenProfile,
  onOpenAbout,
  onOpenLogout,
}: {
  open: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenAbout: () => void;
  onOpenLogout: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 pt-5 pb-4">
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
          <div className="space-y-2">
            <button
              onClick={onOpenProfile}
              className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700"
            >
              Profil
            </button>
            <button
              onClick={onOpenAbout}
              className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-700"
            >
              Om
            </button>
            <button
              onClick={onOpenLogout}
              className="w-full rounded-lg border border-red-600 bg-red-600 px-4 py-3 text-left text-sm font-semibold text-white hover:bg-red-700"
            >
              Logga ut
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

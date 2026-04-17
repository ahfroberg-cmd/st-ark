"use client";

export default function DocumentsModalHeader(props: {
  onScanIntyg: () => void;
  onClose: () => void;
}) {
  const { onScanIntyg, onClose } = props;

  return (
    <div className="border-b border-black px-6 pt-5 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Dokument</h2>
        <div className="inline-flex items-center gap-2">
          <button
            onClick={onScanIntyg}
            className="rounded-lg border border-emerald-700 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            title="Skanna intyg"
          >
            Skanna intyg
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

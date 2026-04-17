"use client";

type Props = {
  open: boolean;
  url: string | null;
  onClose: () => void;
};

export function CertificatePreview({ open, url, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl h-[85vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold">Förhandsvisning av intyg/ansökan</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          {url ? (
            <iframe src={url} className="w-full h-full" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-slate-500">Genererar …</div>
          )}
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <a
            href={url ?? "#"}
            download
            className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50"
            onClick={(e) => {
              if (!url) e.preventDefault();
            }}
          >
            Ladda ned PDF
          </a>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
            title="Stäng förhandsvisningen"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

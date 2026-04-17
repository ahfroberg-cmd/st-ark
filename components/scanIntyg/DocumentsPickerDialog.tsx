"use client";

import type { ExistingAppDocument } from "./useDocumentPickerState";

type FolderOption = {
  key: string;
  name: string;
  date?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  documentsLoading: boolean;
  documentsError: string | null;
  documentsQuery: string;
  setDocumentsQuery: (value: string) => void;
  selectingDocumentPath: string | null;
  pickerFolderKey: string;
  setPickerFolderKey: (value: string) => void;
  pickerPlacementsOpen: boolean;
  setPickerPlacementsOpen: (next: boolean) => void;
  pickerCoursesOpen: boolean;
  setPickerCoursesOpen: (next: boolean) => void;
  pickerShowDates: boolean;
  setPickerShowDates: (next: boolean) => void;
  pickerFolderOptions: {
    globalFolders: FolderOption[];
    placementFolders: FolderOption[];
    courseFolders: FolderOption[];
  };
  pickerFilteredDocuments: ExistingAppDocument[];
  pickerSelectedFolderMeta: {
    title: string;
    subtitle: string;
  };
  loadAvailableDocuments: () => Promise<void>;
  handlePickExistingDocument: (doc: ExistingAppDocument) => Promise<void>;
  isSupportedStoredDocument: (doc: ExistingAppDocument) => boolean;
};

export function DocumentsPickerDialog({
  open,
  onClose,
  documentsLoading,
  documentsError,
  documentsQuery,
  setDocumentsQuery,
  selectingDocumentPath,
  pickerFolderKey,
  setPickerFolderKey,
  pickerPlacementsOpen,
  setPickerPlacementsOpen,
  pickerCoursesOpen,
  setPickerCoursesOpen,
  pickerShowDates,
  setPickerShowDates,
  pickerFolderOptions,
  pickerFilteredDocuments,
  pickerSelectedFolderMeta,
  loadAvailableDocuments,
  handlePickExistingDocument,
  isSupportedStoredDocument,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[82vh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="m-0 text-lg font-semibold text-slate-900">Välj bland dokument</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAvailableDocuments()}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
              disabled={documentsLoading}
            >
              Uppdatera
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
            >
              Stäng
            </button>
          </div>
        </header>
        <div className="grid min-h-[58vh] grid-cols-1 gap-0 md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b bg-slate-50 p-3 md:border-b-0 md:border-r">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mappar</div>
            <div className="mt-2 space-y-1">
              {pickerFolderOptions.globalFolders.map((folder) => (
                <button
                  key={folder.key}
                  type="button"
                  onClick={() => setPickerFolderKey(folder.key)}
                  className={`w-full overflow-hidden rounded-md px-2 py-1.5 text-left text-sm ${
                    pickerFolderKey === folder.key ? "bg-sky-100 text-sky-900" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="block w-full truncate">{folder.name}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="mt-3 flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
              onClick={() => setPickerPlacementsOpen(!pickerPlacementsOpen)}
            >
              <span>{pickerPlacementsOpen ? "▾" : "▸"}</span>
              <span>Placeringar</span>
            </button>
            {pickerPlacementsOpen && (
              <div className="mt-1 space-y-1">
                {pickerFolderOptions.placementFolders.map((folder) => (
                  <button
                    key={folder.key}
                    type="button"
                    onClick={() => setPickerFolderKey(folder.key)}
                    className={`w-full overflow-hidden rounded-md px-2 py-1.5 text-left text-sm ${
                      pickerFolderKey === folder.key ? "bg-sky-100 text-sky-900" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="block w-full truncate">
                      {pickerShowDates && folder.date ? `${folder.name} (${folder.date})` : folder.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="mt-3 flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
              onClick={() => setPickerCoursesOpen(!pickerCoursesOpen)}
            >
              <span>{pickerCoursesOpen ? "▾" : "▸"}</span>
              <span>Kurser</span>
            </button>
            {pickerCoursesOpen && (
              <div className="mt-1 space-y-1">
                {pickerFolderOptions.courseFolders.map((folder) => (
                  <button
                    key={folder.key}
                    type="button"
                    onClick={() => setPickerFolderKey(folder.key)}
                    className={`w-full overflow-hidden rounded-md px-2 py-1.5 text-left text-sm ${
                      pickerFolderKey === folder.key ? "bg-sky-100 text-sky-900" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="block w-full truncate">
                      {pickerShowDates && folder.date ? `${folder.name} (${folder.date})` : folder.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <div className="min-w-0 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-slate-900">{pickerSelectedFolderMeta.title}</div>
                {pickerSelectedFolderMeta.subtitle ? (
                  <div className="truncate text-xs text-slate-500">{pickerSelectedFolderMeta.subtitle}</div>
                ) : null}
              </div>
              <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={pickerShowDates}
                  onChange={(e) => setPickerShowDates(e.target.checked)}
                />
                Visa datum
              </label>
            </div>
            <div className="mb-3">
              <input
                type="text"
                value={documentsQuery}
                onChange={(e) => setDocumentsQuery(e.target.value)}
                placeholder="Sök i vald mapp..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-slate-200 p-2">
              {documentsLoading ? (
                <div className="px-2 py-3 text-sm text-slate-600">Läser in dokument…</div>
              ) : documentsError ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {documentsError}
                </div>
              ) : pickerFilteredDocuments.length === 0 ? (
                <div className="px-2 py-3 text-sm text-slate-600">Inga dokument i vald mapp.</div>
              ) : (
                <div className="space-y-2">
                  {pickerFilteredDocuments.map((doc) => {
                    const title = String(doc.title || "").trim() || fileNameFromPath(doc.file_path) || "Dokument";
                    const created = doc.created_at ? new Date(doc.created_at).toLocaleDateString("sv-SE") : "";
                    const suffix = [formatBytes(doc.size_bytes), created].filter(Boolean).join(" · ");
                    const isPicking = selectingDocumentPath === doc.file_path;
                    const supported = isSupportedStoredDocument(doc);
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => void handlePickExistingDocument(doc)}
                        disabled={!!selectingDocumentPath || !supported}
                        className={`w-full rounded-lg border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
                          supported ? "border-slate-200 bg-white hover:bg-slate-50" : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
                        <div className="text-xs text-slate-600 truncate">{doc.file_path}</div>
                        {suffix ? <div className="mt-0.5 text-[11px] text-slate-500">{suffix}</div> : null}
                        {!supported ? (
                          <div className="mt-1 text-xs text-amber-700">Filtypen kan inte OCR-skannas.</div>
                        ) : null}
                        {isPicking ? <div className="mt-1 text-xs text-sky-700">Hämtar…</div> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fileNameFromPath(path: string) {
  const value = String(path || "");
  const parts = value.split("/");
  return parts[parts.length - 1] || "";
}

function formatBytes(size?: number | null) {
  if (!size || size < 0) return "";
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

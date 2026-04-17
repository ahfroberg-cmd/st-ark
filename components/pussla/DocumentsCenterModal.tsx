"use client";
/* eslint-disable react-hooks/refs */

import type { RefObject } from "react";
import DocumentsModalHeader from "@/components/pussla/DocumentsModalHeader";

type FolderOption = { key: string; name: string; date?: string };
type DocumentRow = {
  id: string;
  title: string;
  mime_type: string;
  created_at: string;
  activity_kind: "placement" | "course" | null;
  activity_id: string | null;
};

export default function DocumentsCenterModal(props: {
  open: boolean;
  onClose: () => void;
  onScanIntyg: () => void;
  documentsSidebarWidth: number;
  documentsFolderOptions: {
    globalFolders: FolderOption[];
    placementFolders: FolderOption[];
    courseFolders: FolderOption[];
  };
  documentsFolderKey: string;
  setDocumentsFolderKey: (key: string) => void;
  draggedDocumentId: string | null;
  setDraggedDocumentId: (id: string | null) => void;
  dragOverFolderKey: string | null;
  setDragOverFolderKey: (key: string | null) => void;
  documents: DocumentRow[];
  moveDocumentToFolder: (doc: DocumentRow, key: string) => Promise<void>;
  editingFolderKey: string | null;
  setEditingFolderKey: (key: string | null) => void;
  editingFolderValue: string;
  setEditingFolderValue: (value: string) => void;
  commitInlineFolderRename: (folderKey: string) => void;
  parseDocumentTargetFromKey: (key: string) => { kind: "placement" | "course" | null; id: string | null };
  setDocumentsCustomFolders: (updater: (prev: string[]) => string[]) => void;
  setDocuments: (updater: (prev: DocumentRow[]) => DocumentRow[]) => void;
  getDocumentTargetKey: (kind: "placement" | "course" | null, id: string | null) => string;
  supabase: any;
  newDocumentsFolderName: string;
  setNewDocumentsFolderName: (value: string) => void;
  normalizeGlobalFolderId: (raw: unknown) => string | null;
  documentsPlacementsOpen: boolean;
  setDocumentsPlacementsOpen: (updater: (prev: boolean) => boolean) => void;
  documentsCoursesOpen: boolean;
  setDocumentsCoursesOpen: (updater: (prev: boolean) => boolean) => void;
  documentsShowDates: boolean;
  setDocumentsShowDates: (show: boolean) => void;
  selectedFolderMeta: { title: string; subtitle: string };
  documentsUploadInputRef: RefObject<HTMLInputElement | null>;
  documentsUploadDropzoneRef: RefObject<HTMLDivElement | null>;
  documentsUploading: boolean;
  documentsUploadDragActive: boolean;
  setDocumentsUploadDragActive: (active: boolean) => void;
  uploadDocumentsFromList: (files: FileList | File[] | null | undefined) => Promise<void>;
  documentsLoading: boolean;
  visibleDocuments: DocumentRow[];
  downloadDocument: (doc: DocumentRow) => Promise<void>;
}) {
  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
      onClick={props.onClose}
    >
      <div className="w-full max-w-6xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <DocumentsModalHeader onScanIntyg={props.onScanIntyg} onClose={props.onClose} />
        <div
          className="grid min-h-[65vh] grid-cols-1 gap-0 p-6 lg:grid-cols-[auto_10px_minmax(0,1fr)]"
          style={{ gridTemplateColumns: `${props.documentsSidebarWidth}px 10px minmax(0,1fr)` }}
        >
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 max-h-[65vh] overflow-auto">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mappar</div>
            </div>
            <div className="space-y-1">
              {props.documentsFolderOptions.globalFolders.map((folder) => (
                <div key={folder.key} className="group">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => props.setDocumentsFolderKey(folder.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        props.setDocumentsFolderKey(folder.key);
                      }
                    }}
                    onDragOver={(e) => {
                      if (!props.draggedDocumentId) return;
                      e.preventDefault();
                      props.setDragOverFolderKey(folder.key);
                    }}
                    onDragLeave={() => {
                      if (props.dragOverFolderKey === folder.key) props.setDragOverFolderKey(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/document-id") || props.draggedDocumentId;
                      const doc = props.documents.find((d) => d.id === id);
                      if (doc) void props.moveDocumentToFolder(doc, folder.key);
                      props.setDragOverFolderKey(null);
                      props.setDraggedDocumentId(null);
                    }}
                    className={`w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm ${
                      props.documentsFolderKey === folder.key
                        ? "bg-sky-100 text-sky-900"
                        : "text-slate-700 hover:bg-slate-100"
                    } ${
                      props.dragOverFolderKey === folder.key
                        ? "ring-1 ring-emerald-400 bg-emerald-50 text-emerald-900"
                        : ""
                    }`}
                  >
                    <span className="inline-flex w-full items-center justify-between gap-2">
                      {props.editingFolderKey === folder.key ? (
                        <input
                          autoFocus
                          value={props.editingFolderValue}
                          onChange={(e) => props.setEditingFolderValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => props.commitInlineFolderRename(folder.key)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              props.commitInlineFolderRename(folder.key);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              props.setEditingFolderKey(null);
                              props.setEditingFolderValue("");
                            }
                          }}
                          className="w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-900"
                        />
                      ) : (
                        <span
                          className="truncate"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            const current = String(props.parseDocumentTargetFromKey(folder.key).id || "").trim();
                            if (!current) return;
                            props.setEditingFolderKey(folder.key);
                            props.setEditingFolderValue(String(folder.name || current));
                          }}
                          title="Dubbelklicka för att byta namn"
                        >
                          {folder.name}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const current = String(props.parseDocumentTargetFromKey(folder.key).id || "").trim();
                            if (!current) return;
                            props.setDocumentsCustomFolders((prev) => prev.filter((x) => x !== current));
                            props.setDocuments((prev) =>
                              prev.map((d) =>
                                !d.activity_kind && String(d.activity_id || "") === current
                                  ? { ...d, activity_id: null }
                                  : d
                              )
                            );
                            if (props.documentsFolderKey === folder.key) {
                              props.setDocumentsFolderKey(props.getDocumentTargetKey(null, null));
                            }
                            void props.supabase
                              .from("activity_documents")
                              .update({ activity_id: null })
                              .is("activity_kind", null)
                              .eq("activity_id", current);
                          }}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                          title="Ta bort mapp"
                        >
                          ×
                        </button>
                        {props.dragOverFolderKey === folder.key && (
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">+</span>
                        )}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
              <div className="mt-2 flex items-center gap-1">
                <input
                  type="text"
                  value={props.newDocumentsFolderName}
                  onChange={(e) => props.setNewDocumentsFolderName(e.target.value)}
                  placeholder="Ny mapp"
                  className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    const name = props.normalizeGlobalFolderId(props.newDocumentsFolderName);
                    if (!name) return;
                    props.setDocumentsCustomFolders((prev) => (prev.includes(name) ? prev : [...prev, name]));
                    props.setNewDocumentsFolderName("");
                  }}
                >
                  Lägg till
                </button>
              </div>
            </div>

            <button
              type="button"
              className="mt-3 flex w-full items-center justify-between gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
              onClick={() => props.setDocumentsPlacementsOpen((v) => !v)}
            >
              <span className="inline-flex items-center gap-1">
                <span>{props.documentsPlacementsOpen ? "▾" : "▸"}</span>
                <span>Placeringar</span>
              </span>
              <label
                className="inline-flex items-center gap-1 text-[11px] normal-case text-slate-600"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={props.documentsShowDates}
                  onChange={(e) => props.setDocumentsShowDates(e.target.checked)}
                />
                Visa datum
              </label>
            </button>
            {props.documentsPlacementsOpen && (
              <div className="mt-1 space-y-1">
                {props.documentsFolderOptions.placementFolders.map((folder) => (
                  <button
                    key={folder.key}
                    type="button"
                    onClick={() => props.setDocumentsFolderKey(folder.key)}
                    onDragOver={(e) => {
                      if (!props.draggedDocumentId) return;
                      e.preventDefault();
                      props.setDragOverFolderKey(folder.key);
                    }}
                    onDragLeave={() => {
                      if (props.dragOverFolderKey === folder.key) props.setDragOverFolderKey(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/document-id") || props.draggedDocumentId;
                      const doc = props.documents.find((d) => d.id === id);
                      if (doc) void props.moveDocumentToFolder(doc, folder.key);
                      props.setDragOverFolderKey(null);
                      props.setDraggedDocumentId(null);
                    }}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                      props.documentsFolderKey === folder.key
                        ? "bg-sky-100 text-sky-900"
                        : "text-slate-700 hover:bg-slate-100"
                    } ${
                      props.dragOverFolderKey === folder.key
                        ? "ring-1 ring-emerald-400 bg-emerald-50 text-emerald-900"
                        : ""
                    }`}
                  >
                    <span className="inline-flex w-full items-center justify-between gap-2">
                      <span className="truncate">
                        {props.documentsShowDates && folder.date ? `${folder.name} (${folder.date})` : folder.name}
                      </span>
                      {props.dragOverFolderKey === folder.key && (
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">+</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="mt-3 flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
              onClick={() => props.setDocumentsCoursesOpen((v) => !v)}
            >
              <span>{props.documentsCoursesOpen ? "▾" : "▸"}</span>
              <span>Kurser</span>
            </button>
            {props.documentsCoursesOpen && (
              <div className="mt-1 space-y-1">
                {props.documentsFolderOptions.courseFolders.map((folder) => (
                  <button
                    key={folder.key}
                    type="button"
                    onClick={() => props.setDocumentsFolderKey(folder.key)}
                    onDragOver={(e) => {
                      if (!props.draggedDocumentId) return;
                      e.preventDefault();
                      props.setDragOverFolderKey(folder.key);
                    }}
                    onDragLeave={() => {
                      if (props.dragOverFolderKey === folder.key) props.setDragOverFolderKey(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/document-id") || props.draggedDocumentId;
                      const doc = props.documents.find((d) => d.id === id);
                      if (doc) void props.moveDocumentToFolder(doc, folder.key);
                      props.setDragOverFolderKey(null);
                      props.setDraggedDocumentId(null);
                    }}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                      props.documentsFolderKey === folder.key
                        ? "bg-sky-100 text-sky-900"
                        : "text-slate-700 hover:bg-slate-100"
                    } ${
                      props.dragOverFolderKey === folder.key
                        ? "ring-1 ring-emerald-400 bg-emerald-50 text-emerald-900"
                        : ""
                    }`}
                  >
                    <span className="inline-flex w-full items-center justify-between gap-2">
                      <span className="truncate">
                        {props.documentsShowDates && folder.date ? `${folder.name} (${folder.date})` : folder.name}
                      </span>
                      {props.dragOverFolderKey === folder.key && (
                        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">+</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div
            className="hidden cursor-col-resize items-stretch justify-center lg:flex"
            onMouseDown={() => {
              const down = (window as any).__docsSidebarResizeDown;
              if (typeof down === "function") down();
            }}
          >
            <div className="w-px bg-slate-300" />
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-3 px-1 py-1">
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-slate-900">{props.selectedFolderMeta.title}</div>
                {props.selectedFolderMeta.subtitle ? (
                  <div className="mt-0.5 truncate text-xs text-slate-500">{props.selectedFolderMeta.subtitle}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => props.documentsUploadInputRef.current?.click()}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                {props.documentsUploading ? "Laddar upp…" : "Välj filer"}
              </button>
            </div>

            <div
              ref={props.documentsUploadDropzoneRef}
              role="button"
              tabIndex={0}
              onClick={() => props.documentsUploadInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  props.documentsUploadInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer?.files?.length) return;
                e.preventDefault();
                e.stopPropagation();
                props.setDocumentsUploadDragActive(true);
              }}
              onDragLeave={(e) => {
                e.stopPropagation();
                props.setDocumentsUploadDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                props.setDocumentsUploadDragActive(false);
                void props.uploadDocumentsFromList(e.dataTransfer?.files);
              }}
              className={`rounded-xl border-2 border-dashed p-4 transition ${
                props.documentsUploadDragActive
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-300 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/60"
              } ${props.documentsUploading ? "cursor-wait opacity-80" : "cursor-pointer"}`}
            >
              <input
                ref={props.documentsUploadInputRef}
                type="file"
                multiple
                className="hidden"
                disabled={props.documentsUploading}
                onChange={(e) => {
                  void props.uploadDocumentsFromList(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">Dra och släpp filer här</div>
                  <div className="mt-0.5 text-xs text-slate-600">eller klicka för att ladda upp till vald mapp</div>
                </div>
                <span className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {props.documentsUploading ? "Laddar upp..." : "Bläddra"}
                </span>
              </div>
            </div>

            <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
              {props.documentsLoading ? (
                <div className="px-4 py-6 text-sm text-slate-500">Laddar dokument…</div>
              ) : props.visibleDocuments.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">Inga dokument i mappen.</div>
              ) : (
                <div className="space-y-2 p-2">
                  {props.visibleDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/document-id", doc.id);
                        e.dataTransfer.effectAllowed = "move";
                        props.setDraggedDocumentId(doc.id);
                      }}
                      onDragEnd={() => {
                        props.setDraggedDocumentId(null);
                        props.setDragOverFolderKey(null);
                      }}
                      className={`cursor-grab active:cursor-grabbing rounded-lg border bg-white p-3 ${
                        props.draggedDocumentId === doc.id
                          ? "border-sky-400 shadow-sm opacity-45"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{doc.title}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {(doc.mime_type || "okänd typ")} •{" "}
                            {doc.created_at ? new Date(doc.created_at).toLocaleString("sv-SE") : "—"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void props.downloadDocument(doc)}
                          className="whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                        >
                          Ladda ned
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

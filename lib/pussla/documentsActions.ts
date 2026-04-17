type DocumentTarget = {
  kind: "placement" | "course" | null;
  id: string | null;
  label: string;
};

type DocumentRow = {
  id: string;
  activity_kind: "placement" | "course" | null;
  activity_id: string | null;
};

export async function openDocumentsForZone(input: {
  target: DocumentTarget;
  getDocumentTargetKey: (kind: "placement" | "course" | null, id: string | null) => string;
  setDocumentsFolderKey: (key: string) => void;
  setDocumentsOpen: (open: boolean) => void;
  loadDocuments: () => Promise<void>;
}): Promise<void> {
  input.setDocumentsFolderKey(input.getDocumentTargetKey(input.target.kind, input.target.id));
  input.setDocumentsOpen(true);
  await input.loadDocuments();
}

export async function moveDocumentToFolderZone<T extends DocumentRow>(input: {
  doc: T;
  nextFolderKey: string;
  parseDocumentTargetFromKey: (
    key: string
  ) => { kind: "placement" | "course" | null; id: string | null };
  updateDocumentTarget: (
    docId: string,
    target: { kind: "placement" | "course" | null; id: string | null }
  ) => Promise<{ error: any }>;
  setDocuments: (updater: (prev: T[]) => T[]) => void;
  alertFn: (message: string) => void;
}): Promise<void> {
  const target = input.parseDocumentTargetFromKey(input.nextFolderKey);
  const { error } = await input.updateDocumentTarget(input.doc.id, target);
  if (error) {
    input.alertFn(`Kunde inte flytta dokument: ${error.message}`);
    return;
  }
  input.setDocuments((prev) =>
    prev.map((row) =>
      row.id === input.doc.id
        ? ({ ...row, activity_kind: target.kind, activity_id: target.id } as T)
        : row
    )
  );
}

export async function uploadDocumentsFromListZone(input: {
  files: FileList | File[] | null | undefined;
  uploadDocumentForTarget: (file: File) => Promise<void>;
}): Promise<void> {
  const list = Array.from(input.files || []).filter(Boolean);
  if (list.length === 0) return;
  for (const file of list) {
    await input.uploadDocumentForTarget(file as File);
  }
}

type ResolveUserInput = {
  authUserId: string | undefined;
  getSessionUser: () => Promise<any>;
  onResolvedUser: (user: any) => void;
};

type DocumentTarget = {
  kind: "placement" | "course" | null;
  id: string | null;
};

export async function loadActivityDocumentsIO(input: {
  authUserId: string | undefined;
  getSessionUser: () => Promise<any>;
  setAuthUser: (user: any) => void;
  resolveUserId: (input: ResolveUserInput) => Promise<string | null>;
  setDocumentsLoading: (loading: boolean) => void;
  listActivityDocumentsForUser: (
    userId: string,
    columns: string
  ) => Promise<{ data: any[] | null; error: any }>;
  activityDocumentColumns: string;
  setDocuments: (docs: any[]) => void;
  alertFn: (message: string) => void;
}): Promise<void> {
  const liveUid = await input.resolveUserId({
    authUserId: input.authUserId,
    getSessionUser: input.getSessionUser,
    onResolvedUser: (user) => {
      if (user?.id) input.setAuthUser(user);
    },
  });
  if (!liveUid) return;

  input.setDocumentsLoading(true);
  try {
    const { data, error } = await input.listActivityDocumentsForUser(
      liveUid,
      input.activityDocumentColumns
    );
    if (error) {
      const message = String(error.message || "");
      if (message.includes("activity_documents")) {
        input.alertFn(
          "Tabellen activity_documents saknas. Kör SQL-filen supabase/create_activity_documents.sql."
        );
      }
      input.setDocuments([]);
      return;
    }
    input.setDocuments((data || []) as any[]);
  } finally {
    input.setDocumentsLoading(false);
  }
}

export async function uploadDocumentForTargetIO(input: {
  file: File;
  authUserId: string | undefined;
  getSessionUser: () => Promise<any>;
  setAuthUser: (user: any) => void;
  resolveUserId: (input: ResolveUserInput) => Promise<string | null>;
  setDocumentsUploading: (uploading: boolean) => void;
  documentsFolderKey: string;
  parseDocumentTargetFromKey: (key: string) => DocumentTarget;
  getDocumentTargetKey: (kind: "placement" | "course" | null, id: string | null) => string;
  uploadToStorage: (
    path: string,
    file: File,
    options: { cacheControl: string; upsert: boolean; contentType: string }
  ) => Promise<{ error: any }>;
  insertActivityDocumentRow: (row: {
    user_id: string;
    title: string;
    activity_kind: "placement" | "course" | null;
    activity_id: string | null;
    file_path: string;
    mime_type: string;
    size_bytes: number;
  }) => Promise<{ error: any }>;
  loadDocuments: () => Promise<void>;
  alertFn: (message: string) => void;
}): Promise<void> {
  const liveUid = await input.resolveUserId({
    authUserId: input.authUserId,
    getSessionUser: input.getSessionUser,
    onResolvedUser: (user) => {
      if (user?.id) input.setAuthUser(user);
    },
  });
  if (!liveUid) return;

  input.setDocumentsUploading(true);
  try {
    const extension = String(input.file.name.split(".").pop() || "bin").toLowerCase();
    const target = input.parseDocumentTargetFromKey(input.documentsFolderKey);
    const key = input.getDocumentTargetKey(target.kind, target.id);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const path = `${liveUid}/${key}/${fileName}`;

    const { error: uploadError } = await input.uploadToStorage(path, input.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: input.file.type || "application/octet-stream",
    });
    if (uploadError) {
      input.alertFn(`Kunde inte ladda upp filen: ${uploadError.message}`);
      return;
    }

    const { error: insertError } = await input.insertActivityDocumentRow({
      user_id: liveUid,
      title: input.file.name,
      activity_kind: target.kind,
      activity_id: target.id,
      file_path: path,
      mime_type: input.file.type || "application/octet-stream",
      size_bytes: input.file.size || 0,
    });
    if (insertError) {
      input.alertFn(`Kunde inte spara dokumentmetadata: ${insertError.message}`);
      return;
    }

    await input.loadDocuments();
  } finally {
    input.setDocumentsUploading(false);
  }
}

export async function downloadActivityDocumentIO(input: {
  documentRow: { title: string; file_path: string };
  createSignedUrl: (path: string, expiresInSec: number) => Promise<{ data: any; error: any }>;
  fetchImpl: (url: string) => Promise<Response>;
  alertFn: (message: string) => void;
}): Promise<void> {
  const { data, error } = await input.createSignedUrl(input.documentRow.file_path, 60);
  if (error || !data?.signedUrl) {
    input.alertFn(`Kunde inte ladda ned dokument: ${error?.message || "okänt fel"}`);
    return;
  }
  const response = await input.fetchImpl(data.signedUrl);
  if (!response.ok) {
    input.alertFn("Kunde inte ladda ned filen.");
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = input.documentRow.title || "dokument";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type DocumentTarget = {
  kind: "placement" | "course" | null;
  id: string | null;
};

type ActivityLike = {
  id: string;
  label?: string;
  type?: string;
  exactStartISO?: string;
  exactEndISO?: string;
  linkedPlacementId?: string;
};

type CourseLike = {
  id: string;
  linkedCourseId?: string;
  endDate?: string;
  certificateDate?: string;
  startDate?: string;
};

type DocumentLike = {
  id: string;
  activity_kind: "placement" | "course" | null;
  activity_id: string | null;
};

export type DocumentsFolderEntry = {
  key: string;
  name: string;
  date?: string;
};

export type DocumentsFolderOptions = {
  globalFolders: DocumentsFolderEntry[];
  placementFolders: DocumentsFolderEntry[];
  courseFolders: DocumentsFolderEntry[];
};

export type SelectedFolderMeta = {
  kind: "global" | "placement" | "course";
  id: string | null;
  title: string;
  subtitle: string;
};

export function normalizeGlobalFolderId(raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "uppladdade filer" || lower === "uploaded-files") return "uploaded-files";
  return value;
}

export function getDocumentTargetKey(
  kind: "placement" | "course" | null,
  id: string | null
): string {
  return kind && id ? `${kind}:${id}` : `global:${String(normalizeGlobalFolderId(id) || "")}`;
}

export function parseDocumentTargetFromKey(key: string): DocumentTarget {
  if (!key) return { kind: null, id: null };
  if (key === "__global__") return { kind: null, id: null };
  if (key.startsWith("global:")) {
    const folder = normalizeGlobalFolderId(key.slice("global:".length));
    return { kind: null, id: folder };
  }
  const [kindRaw, ...rest] = String(key).split(":");
  const kind = kindRaw === "placement" || kindRaw === "course" ? kindRaw : null;
  const id = rest.join(":") || null;
  if (!kind || !id) return { kind: null, id: null };
  return { kind, id };
}

export function buildDocumentsFolderOptions(input: {
  activities: ActivityLike[];
  courses: CourseLike[];
  documents: DocumentLike[];
  documentsCustomFolders: string[];
  getCourseDisplayTitle: (course: CourseLike) => string;
}): DocumentsFolderOptions {
  const globalFolderSet = new Set<string>(
    input.documents
      .filter((doc) => !doc.activity_kind)
      .map((doc) => normalizeGlobalFolderId(doc.activity_id))
      .filter((folder): folder is string => Boolean(folder))
  );
  input.documentsCustomFolders
    .map((folder) => normalizeGlobalFolderId(folder))
    .filter((folder): folder is string => Boolean(folder))
    .forEach((folder) => globalFolderSet.add(folder));

  const globalFolders = Array.from(globalFolderSet)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "sv"))
    .map((name) => ({
      key: getDocumentTargetKey(null, name),
      name: name === "uploaded-files" ? "Uppladdade filer" : name,
    }));

  const rootFolder = {
    key: getDocumentTargetKey(null, null),
    name: "Dokument",
  };
  const withRoot = [rootFolder, ...globalFolders.filter((folder) => folder.key !== rootFolder.key)];

  const placementFolders = input.activities
    .map((activity) => ({
      key: getDocumentTargetKey("placement", String(activity.linkedPlacementId || activity.id)),
      name: activity.label || activity.type || "Placering",
      date: (() => {
        const start = String(activity.exactStartISO || "");
        const end = String(activity.exactEndISO || "");
        return start && end ? `${start}–${end}` : start || end || "";
      })(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));

  const courseFolders = input.courses
    .map((course) => ({
      key: getDocumentTargetKey("course", String(course.linkedCourseId || course.id)),
      name: input.getCourseDisplayTitle(course),
      date: String(course.endDate || course.certificateDate || course.startDate || ""),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));

  return { globalFolders: withRoot, placementFolders, courseFolders };
}

export function filterVisibleDocuments<T extends DocumentLike>(
  documents: T[],
  documentsFolderKey: string
): T[] {
  return documents.filter(
    (doc) =>
      getDocumentTargetKey(
        (doc.activity_kind as "placement" | "course" | null) || null,
        (doc.activity_id as string | null) || null
      ) === documentsFolderKey
  );
}

export function buildSelectedFolderMeta(
  documentsFolderKey: string,
  documentsFolderOptions: DocumentsFolderOptions
): SelectedFolderMeta {
  const target = parseDocumentTargetFromKey(documentsFolderKey);
  if (!target.kind) {
    const id = String(target.id || "").trim();
    const displayName = id ? (id === "uploaded-files" ? "Uppladdade filer" : id) : "Dokument";
    return {
      kind: "global",
      id: id || null,
      title: displayName,
      subtitle: "",
    };
  }

  if (target.kind === "placement") {
    const found = documentsFolderOptions.placementFolders.find(
      (folder) => folder.key === documentsFolderKey
    );
    return {
      kind: "placement",
      id: target.id,
      title: found?.name || "Placering",
      subtitle: found?.date || "",
    };
  }

  const found = documentsFolderOptions.courseFolders.find(
    (folder) => folder.key === documentsFolderKey
  );
  return {
    kind: "course",
    id: target.id,
    title: found?.name || "Kurs",
    subtitle: found?.date || "",
  };
}

export function applyInlineFolderRename<T extends DocumentLike>(input: {
  folderKey: string;
  editingFolderValue: string;
  documentsFolderKey: string;
  documentsCustomFolders: string[];
  documents: T[];
}): {
  shouldClearEditor: boolean;
  currentFolderId: string | null;
  cleanedFolderId: string | null;
  nextDocumentsFolderKey: string;
  nextDocumentsCustomFolders: string[];
  nextDocuments: T[];
} {
  const current = String(parseDocumentTargetFromKey(input.folderKey).id || "").trim();
  if (!current) {
    return {
      shouldClearEditor: true,
      currentFolderId: null,
      cleanedFolderId: null,
      nextDocumentsFolderKey: input.documentsFolderKey,
      nextDocumentsCustomFolders: input.documentsCustomFolders,
      nextDocuments: input.documents,
    };
  }

  const cleaned = String(normalizeGlobalFolderId(input.editingFolderValue) || "").trim();
  if (!cleaned || cleaned === current) {
    return {
      shouldClearEditor: true,
      currentFolderId: current,
      cleanedFolderId: null,
      nextDocumentsFolderKey: input.documentsFolderKey,
      nextDocumentsCustomFolders: input.documentsCustomFolders,
      nextDocuments: input.documents,
    };
  }

  return {
    shouldClearEditor: true,
    currentFolderId: current,
    cleanedFolderId: cleaned,
    nextDocumentsFolderKey:
      input.documentsFolderKey === input.folderKey
        ? getDocumentTargetKey(null, cleaned)
        : input.documentsFolderKey,
    nextDocumentsCustomFolders: input.documentsCustomFolders.map((folder) =>
      folder === current ? cleaned : folder
    ),
    nextDocuments: input.documents.map((doc) =>
      !doc.activity_kind && String(doc.activity_id || "") === current
        ? ({ ...doc, activity_id: cleaned } as T)
        : doc
    ),
  };
}

"use client";

import { useCallback, useMemo } from "react";
import {
  applyInlineFolderRename,
  buildDocumentsFolderOptions,
  buildSelectedFolderMeta,
  filterVisibleDocuments,
} from "@/lib/pussla/documentsWorkspace";
import { moveDocumentToFolderZone, uploadDocumentsFromListZone } from "@/lib/pussla/documentsActions";

export function useDocumentsWorkspaceViewModel(params: {
  activities: any[];
  courses: any[];
  documents: any[];
  documentsCustomFolders: string[];
  documentsFolderKey: string;
  editingFolderValue: string;
  getCourseDisplayTitle: any;
  parseDocumentTargetFromKey: any;
  setDocuments: (updater: any) => void;
  setDocumentsCustomFolders: (folders: string[]) => void;
  setDocumentsFolderKey: (key: string) => void;
  setEditingFolderKey: (key: string | null) => void;
  setEditingFolderValue: (value: string) => void;
  updateDocumentTarget: (docId: string, target: { kind: "placement" | "course" | null; id: string | null }) => Promise<any>;
  persistRenamedGlobalFolderIds: (currentFolderId: string, cleanedFolderId: string) => Promise<any>;
  uploadDocumentForTarget: (file: File) => Promise<void>;
  alertFn: (message: string) => void;
}) {
  const documentsFolderOptions = useMemo(
    () =>
      buildDocumentsFolderOptions({
        activities: params.activities as any[],
        courses: params.courses as any[],
        documents: params.documents as any[],
        documentsCustomFolders: params.documentsCustomFolders,
        getCourseDisplayTitle: params.getCourseDisplayTitle as any,
      }),
    [params.activities, params.courses, params.documents, params.documentsCustomFolders, params.getCourseDisplayTitle]
  );

  const visibleDocuments = useMemo(
    () => filterVisibleDocuments(params.documents as any[], params.documentsFolderKey),
    [params.documents, params.documentsFolderKey]
  );

  const moveDocumentToFolder = useCallback(
    async (doc: any, nextFolderKey: string) => {
      await moveDocumentToFolderZone({
        doc,
        nextFolderKey,
        parseDocumentTargetFromKey: params.parseDocumentTargetFromKey,
        updateDocumentTarget: params.updateDocumentTarget,
        setDocuments: (updater) => params.setDocuments(updater as any),
        alertFn: params.alertFn,
      });
    },
    [params]
  );

  const commitInlineFolderRename = useCallback(
    (folderKey: string) => {
      const rename = applyInlineFolderRename({
        folderKey,
        editingFolderValue: params.editingFolderValue,
        documentsFolderKey: params.documentsFolderKey,
        documentsCustomFolders: params.documentsCustomFolders,
        documents: params.documents,
      });
      params.setDocumentsCustomFolders(rename.nextDocumentsCustomFolders);
      params.setDocuments(rename.nextDocuments as any[]);
      params.setDocumentsFolderKey(rename.nextDocumentsFolderKey);
      params.setEditingFolderKey(null);
      params.setEditingFolderValue("");
      if (rename.currentFolderId && rename.cleanedFolderId) {
        void params.persistRenamedGlobalFolderIds(rename.currentFolderId, rename.cleanedFolderId);
      }
    },
    [params]
  );

  const selectedFolderMeta = useMemo(
    () => buildSelectedFolderMeta(params.documentsFolderKey, documentsFolderOptions),
    [params.documentsFolderKey, documentsFolderOptions]
  );

  const uploadDocumentsFromList = useCallback(
    async (files: FileList | File[] | null | undefined) => {
      await uploadDocumentsFromListZone({
        files,
        uploadDocumentForTarget: params.uploadDocumentForTarget,
      });
    },
    [params.uploadDocumentForTarget]
  );

  return {
    documentsFolderOptions,
    visibleDocuments,
    moveDocumentToFolder,
    commitInlineFolderRename,
    selectedFolderMeta,
    uploadDocumentsFromList,
  };
}

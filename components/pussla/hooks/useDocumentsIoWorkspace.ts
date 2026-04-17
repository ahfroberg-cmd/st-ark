"use client";

import { useCallback, useEffect, type RefObject } from "react";
import {
  downloadActivityDocumentIO,
  loadActivityDocumentsIO,
  uploadDocumentForTargetIO,
} from "@/lib/pussla/documentsIO";
import { openDocumentsForZone } from "@/lib/pussla/documentsActions";
import { setupDocumentsInteractionEffects } from "@/lib/pussla/documentsDnD";

export function useDocumentsIoWorkspace(params: {
  authUserId: string | undefined;
  getSessionUser: any;
  setAuthUser: (user: any) => void;
  resolveUserId: any;
  setDocumentsLoading: (value: boolean) => void;
  listActivityDocumentsForUser: any;
  activityDocumentColumns: string;
  setDocuments: (docs: any[]) => void;
  documentsFolderKey: string;
  parseDocumentTargetFromKey: any;
  getDocumentTargetKey: any;
  setDocumentsUploading: (value: boolean) => void;
  uploadToStorage: (path: string, file: File, options: any) => Promise<any>;
  insertActivityDocumentRow: any;
  setDocumentsFolderKey: (key: string) => void;
  setDocumentsOpen: (open: boolean) => void;
  createSignedUrl: (path: string, expiresInSec: number) => Promise<any>;
  documentsOpen: boolean;
  setDocumentsSidebarWidth: (value: number | ((prev: number) => number)) => void;
  setDocumentsUploadDragActive: (value: boolean) => void;
  documentsUploadDropzoneRef: RefObject<HTMLDivElement | null>;
  alertFn: (message: string) => void;
}) {
  const loadDocuments = useCallback(async () => {
    await loadActivityDocumentsIO({
      authUserId: params.authUserId,
      getSessionUser: params.getSessionUser,
      setAuthUser: params.setAuthUser,
      resolveUserId: params.resolveUserId,
      setDocumentsLoading: params.setDocumentsLoading,
      listActivityDocumentsForUser: params.listActivityDocumentsForUser,
      activityDocumentColumns: params.activityDocumentColumns,
      setDocuments: (docs) => params.setDocuments(docs as any[]),
      alertFn: params.alertFn,
    });
  }, [params]);

  const openDocumentsFor = useCallback(
    async (target: { kind: "placement" | "course" | null; id: string | null; label: string }) => {
      await openDocumentsForZone({
        target,
        getDocumentTargetKey: params.getDocumentTargetKey,
        setDocumentsFolderKey: params.setDocumentsFolderKey,
        setDocumentsOpen: params.setDocumentsOpen,
        loadDocuments,
      });
    },
    [params, loadDocuments]
  );

  const uploadDocumentForTarget = useCallback(
    async (file: File) => {
      await uploadDocumentForTargetIO({
        file,
        authUserId: params.authUserId,
        getSessionUser: params.getSessionUser,
        setAuthUser: params.setAuthUser,
        resolveUserId: params.resolveUserId,
        setDocumentsUploading: params.setDocumentsUploading,
        documentsFolderKey: params.documentsFolderKey,
        parseDocumentTargetFromKey: params.parseDocumentTargetFromKey,
        getDocumentTargetKey: params.getDocumentTargetKey,
        uploadToStorage: params.uploadToStorage,
        insertActivityDocumentRow: params.insertActivityDocumentRow,
        loadDocuments,
        alertFn: params.alertFn,
      });
    },
    [params, loadDocuments]
  );

  const downloadDocument = useCallback(
    async (doc: any) => {
      await downloadActivityDocumentIO({
        documentRow: doc,
        createSignedUrl: params.createSignedUrl,
        fetchImpl: fetch,
        alertFn: params.alertFn,
      });
    },
    [params]
  );

  useEffect(() => {
    if (!params.documentsOpen) return;
    return setupDocumentsInteractionEffects({
      setDocumentsSidebarWidth: params.setDocumentsSidebarWidth,
      setDocumentsUploadDragActive: params.setDocumentsUploadDragActive,
      documentsUploadDropzoneRef: params.documentsUploadDropzoneRef,
      uploadDocumentForTarget,
    });
  }, [params, uploadDocumentForTarget]);

  return { openDocumentsFor, uploadDocumentForTarget, downloadDocument };
}

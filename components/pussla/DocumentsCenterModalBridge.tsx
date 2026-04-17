"use client";

import { supabase } from "@/lib/supabase";
import DocumentsCenterModal from "@/components/pussla/DocumentsCenterModal";

export default function DocumentsCenterModalBridge(props: {
  documentsOpen: boolean;
  setDocumentsOpen: (value: boolean) => void;
  setScanOpen: (value: boolean) => void;
  documentsSidebarWidth: number;
  documentsFolderOptions: any;
  documentsFolderKey: string;
  setDocumentsFolderKey: (value: string) => void;
  draggedDocumentId: string | null;
  setDraggedDocumentId: (value: string | null) => void;
  dragOverFolderKey: string | null;
  setDragOverFolderKey: (value: string | null) => void;
  documents: any[];
  moveDocumentToFolder: (documentId: string, folderKey: string) => void | Promise<void>;
  editingFolderKey: string | null;
  setEditingFolderKey: (value: string | null) => void;
  editingFolderValue: string;
  setEditingFolderValue: (value: string) => void;
  commitInlineFolderRename: (folderKey: string) => void;
  parseDocumentTargetFromKey: (key: string) => any;
  setDocumentsCustomFolders: (updater: any) => void;
  setDocuments: (updater: any) => void;
  getDocumentTargetKey: any;
  newDocumentsFolderName: string;
  setNewDocumentsFolderName: (value: string) => void;
  normalizeGlobalFolderId: any;
  documentsPlacementsOpen: boolean;
  setDocumentsPlacementsOpen: any;
  documentsCoursesOpen: boolean;
  setDocumentsCoursesOpen: any;
  documentsShowDates: boolean;
  setDocumentsShowDates: (value: boolean) => void;
  selectedFolderMeta: any;
  documentsUploadInputRef: any;
  documentsUploadDropzoneRef: any;
  documentsUploading: boolean;
  documentsUploadDragActive: boolean;
  setDocumentsUploadDragActive: (value: boolean) => void;
  uploadDocumentsFromList: (files: FileList | File[]) => void | Promise<void>;
  documentsLoading: boolean;
  visibleDocuments: any[];
  downloadDocument: (documentId: string) => void | Promise<void>;
}) {
  return (
    <DocumentsCenterModal
      open={props.documentsOpen}
      onClose={() => props.setDocumentsOpen(false)}
      onScanIntyg={() => {
        props.setDocumentsOpen(false);
        props.setScanOpen(true);
      }}
      documentsSidebarWidth={props.documentsSidebarWidth}
      documentsFolderOptions={props.documentsFolderOptions}
      documentsFolderKey={props.documentsFolderKey}
      setDocumentsFolderKey={props.setDocumentsFolderKey}
      draggedDocumentId={props.draggedDocumentId}
      setDraggedDocumentId={props.setDraggedDocumentId}
      dragOverFolderKey={props.dragOverFolderKey}
      setDragOverFolderKey={props.setDragOverFolderKey}
      documents={props.documents as any}
      moveDocumentToFolder={props.moveDocumentToFolder as any}
      editingFolderKey={props.editingFolderKey}
      setEditingFolderKey={props.setEditingFolderKey}
      editingFolderValue={props.editingFolderValue}
      setEditingFolderValue={props.setEditingFolderValue}
      commitInlineFolderRename={props.commitInlineFolderRename}
      parseDocumentTargetFromKey={props.parseDocumentTargetFromKey}
      setDocumentsCustomFolders={props.setDocumentsCustomFolders as any}
      setDocuments={(updater) => props.setDocuments(updater as any)}
      getDocumentTargetKey={props.getDocumentTargetKey as any}
      supabase={supabase}
      newDocumentsFolderName={props.newDocumentsFolderName}
      setNewDocumentsFolderName={props.setNewDocumentsFolderName}
      normalizeGlobalFolderId={props.normalizeGlobalFolderId as any}
      documentsPlacementsOpen={props.documentsPlacementsOpen}
      setDocumentsPlacementsOpen={props.setDocumentsPlacementsOpen as any}
      documentsCoursesOpen={props.documentsCoursesOpen}
      setDocumentsCoursesOpen={props.setDocumentsCoursesOpen as any}
      documentsShowDates={props.documentsShowDates}
      setDocumentsShowDates={props.setDocumentsShowDates}
      selectedFolderMeta={props.selectedFolderMeta}
      documentsUploadInputRef={props.documentsUploadInputRef}
      documentsUploadDropzoneRef={props.documentsUploadDropzoneRef}
      documentsUploading={props.documentsUploading}
      documentsUploadDragActive={props.documentsUploadDragActive}
      setDocumentsUploadDragActive={props.setDocumentsUploadDragActive}
      uploadDocumentsFromList={props.uploadDocumentsFromList as any}
      documentsLoading={props.documentsLoading}
      visibleDocuments={props.visibleDocuments as any}
      downloadDocument={props.downloadDocument as any}
    />
  );
}

"use client";

import { useCallback, useEffect } from "react";
import { runCertificateForCertMenuZone } from "@/lib/pussla/certificateMenuActions";
import {
  loadDocumentsCustomFoldersFromStorage,
  saveDocumentsCustomFoldersToStorage,
} from "@/lib/pussla/documentsPreferences";

export function useDocumentsFoldersAndCertMenu(params: {
  certMenu: any;
  profile: any;
  activities: any[];
  courses: any[];
  displayDatesForActivity: any;
  getCourseDisplayTitle: any;
  openPreviewForBtGoals: any;
  openPreviewForPlacement: any;
  setSta3Placements: any;
  setSta3Courses: any;
  setSta3ResearchTitle: any;
  setSta3SupervisorName: any;
  setSta3SupervisorSpec: any;
  setSta3SupervisorSite: any;
  setSta3Open: (open: boolean) => void;
  setCourseForModal: any;
  setCourseModalOpen: (open: boolean) => void;
  normalizeGlobalFolderId: any;
  documentsCustomFolders: string[];
  setDocumentsCustomFolders: (folders: string[]) => void;
  alertFn: (message: string) => void;
}) {
  const runCertificateForCertMenu = useCallback(() => {
    runCertificateForCertMenuZone({
      certMenu: params.certMenu,
      profile: params.profile,
      activities: params.activities as any[],
      courses: params.courses as any[],
      displayDatesForActivity: params.displayDatesForActivity as any,
      getCourseDisplayTitle: params.getCourseDisplayTitle as any,
      openPreviewForBtGoals: params.openPreviewForBtGoals as any,
      openPreviewForPlacement: params.openPreviewForPlacement as any,
      setSta3Placements: params.setSta3Placements as any,
      setSta3Courses: params.setSta3Courses as any,
      setSta3ResearchTitle: params.setSta3ResearchTitle as any,
      setSta3SupervisorName: params.setSta3SupervisorName as any,
      setSta3SupervisorSpec: params.setSta3SupervisorSpec as any,
      setSta3SupervisorSite: params.setSta3SupervisorSite as any,
      setSta3Open: params.setSta3Open,
      setCourseForModal: params.setCourseForModal as any,
      setCourseModalOpen: params.setCourseModalOpen,
      alertFn: params.alertFn,
    });
  }, [params]);

  useEffect(() => {
    const cleaned = loadDocumentsCustomFoldersFromStorage({
      storageKey: "documents_custom_folders_v1",
      normalizeGlobalFolderId: params.normalizeGlobalFolderId,
    });
    if (cleaned.length > 0) params.setDocumentsCustomFolders(cleaned);
  }, [params.normalizeGlobalFolderId, params.setDocumentsCustomFolders]);

  useEffect(() => {
    saveDocumentsCustomFoldersToStorage({
      storageKey: "documents_custom_folders_v1",
      folders: params.documentsCustomFolders,
    });
  }, [params.documentsCustomFolders]);

  return { runCertificateForCertMenu };
}

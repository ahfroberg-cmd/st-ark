"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  listActivityDocumentsWithPathForUser,
  listCoursesBriefForDocumentsPicker,
  listPlacementsBriefForDocumentsPicker,
} from "@/lib/repositories/starkRepository";

export type ExistingAppDocument = {
  id: string;
  title: string | null;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
  activity_kind: string | null;
  activity_id: string | null;
};

type PickerPlacement = {
  id: string;
  name: string;
  date: string;
};

type PickerCourse = {
  id: string;
  name: string;
  date: string;
};

type FolderOption = {
  key: string;
  name: string;
  date?: string;
};

type Args = {
  open: boolean;
  onSelectFile: (file: File, options?: { sourceDocument?: ExistingAppDocument | null }) => void;
  setWarning: (message: string | null) => void;
};

export function useDocumentPickerState({ open, onSelectFile, setWarning }: Args) {
  const [documentPickerOpen, setDocumentPickerOpen] = useState(false);
  const [availableDocuments, setAvailableDocuments] = useState<ExistingAppDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentsQuery, setDocumentsQuery] = useState("");
  const [selectingDocumentPath, setSelectingDocumentPath] = useState<string | null>(null);
  const [documentsCustomFolders, setDocumentsCustomFolders] = useState<string[]>([]);
  const [availablePlacements, setAvailablePlacements] = useState<PickerPlacement[]>([]);
  const [availableCourses, setAvailableCourses] = useState<PickerCourse[]>([]);
  const [pickerFolderKey, setPickerFolderKey] = useState<string>("global:");
  const [pickerPlacementsOpen, setPickerPlacementsOpen] = useState(true);
  const [pickerCoursesOpen, setPickerCoursesOpen] = useState(true);
  const [pickerShowDates, setPickerShowDates] = useState(true);

  const isSupportedStoredDocument = useCallback((doc: ExistingAppDocument) => {
    const mime = String(doc.mime_type || "").toLowerCase();
    if (mime.startsWith("image/") || mime === "application/pdf") return true;
    const p = String(doc.file_path || "").toLowerCase();
    return (
      p.endsWith(".pdf") ||
      p.endsWith(".png") ||
      p.endsWith(".jpg") ||
      p.endsWith(".jpeg") ||
      p.endsWith(".webp") ||
      p.endsWith(".gif")
    );
  }, []);

  const normalizeGlobalFolderId = useCallback((raw: unknown): string | null => {
    const s = String(raw || "").trim();
    if (!s) return null;
    const lower = s.toLowerCase();
    if (lower === "uppladdade filer" || lower === "uploaded-files") return "uploaded-files";
    return s;
  }, []);

  const getDocumentTargetKey = useCallback(
    (kind: "placement" | "course" | null, id: string | null): string =>
      kind && id ? `${kind}:${id}` : `global:${String(normalizeGlobalFolderId(id) || "")}`,
    [normalizeGlobalFolderId]
  );

  const clearDataLists = useCallback(() => {
    setAvailableDocuments([]);
    setAvailablePlacements([]);
    setAvailableCourses([]);
  }, []);

  const loadAvailableDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        setDocumentsError(authError.message || "Kunde inte läsa in användare.");
        clearDataLists();
        return;
      }

      const userId = authData?.user?.id;
      if (!userId) {
        setDocumentsError("Ingen inloggad användare hittades.");
        clearDataLists();
        return;
      }

      const [docsRes, placementsRes, coursesRes] = await Promise.all([
        listActivityDocumentsWithPathForUser(userId),
        listPlacementsBriefForDocumentsPicker(userId),
        listCoursesBriefForDocumentsPicker(userId),
      ]);

      if (docsRes.error) {
        setDocumentsError(docsRes.error.message || "Kunde inte läsa in dokument.");
        clearDataLists();
        return;
      }

      const docs = (docsRes.data || [])
        .filter((d: any) => typeof d?.file_path === "string" && d.file_path.trim().length > 0)
        .map((d: any) => ({
          id: String(d.id),
          title: typeof d.title === "string" ? d.title : null,
          file_path: String(d.file_path),
          mime_type: typeof d.mime_type === "string" ? d.mime_type : null,
          size_bytes: typeof d.size_bytes === "number" ? d.size_bytes : null,
          created_at: typeof d.created_at === "string" ? d.created_at : null,
          activity_kind: typeof d.activity_kind === "string" ? d.activity_kind : null,
          activity_id: typeof d.activity_id === "string" ? d.activity_id : null,
        }));
      setAvailableDocuments(docs);

      const placements = placementsRes.error
        ? []
        : (placementsRes.data || []).map((p: any) => ({
            id: String(p.id),
            name: String(p.clinic || p.type || p.title || "Placering"),
            date: (() => {
              const s = String(p.start_date || "");
              const e = String(p.end_date || "");
              return s && e ? `${s}–${e}` : s || e || "";
            })(),
          }));
      placements.sort((a: PickerPlacement, b: PickerPlacement) => a.name.localeCompare(b.name, "sv"));
      setAvailablePlacements(placements);

      const courses = coursesRes.error
        ? []
        : (coursesRes.data || []).map((c: any) => ({
            id: String(c.id),
            name:
              c.title === "Annan kurs"
                ? String(c.course_title || "Kurs")
                : String(c.title || c.course_title || "Kurs"),
            date: String(c.end_date || c.certificate_date || c.start_date || ""),
          }));
      courses.sort((a: PickerCourse, b: PickerCourse) => a.name.localeCompare(b.name, "sv"));
      setAvailableCourses(courses);
    } catch {
      setDocumentsError("Kunde inte läsa in dokument. Försök igen.");
      clearDataLists();
    } finally {
      setDocumentsLoading(false);
    }
  }, [clearDataLists]);

  useEffect(() => {
    if (!open || !documentPickerOpen) return;
    void loadAvailableDocuments();
  }, [open, documentPickerOpen, loadAvailableDocuments]);

  useEffect(() => {
    if (!open || !documentPickerOpen) return;
    try {
      const raw = window.localStorage.getItem("st_ark.documents.customFolders");
      if (!raw) {
        setDocumentsCustomFolders([]);
        return;
      }
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      const normalized = Array.from(
        new Set(
          list
            .map((x: unknown) => normalizeGlobalFolderId(x))
            .filter((x): x is string => Boolean(x))
        )
      );
      setDocumentsCustomFolders(normalized);
    } catch {
      setDocumentsCustomFolders([]);
    }
  }, [open, documentPickerOpen, normalizeGlobalFolderId]);

  const pickerFolderOptions = useMemo(() => {
    const globalSet = new Set<string>();
    for (const d of availableDocuments) {
      const kind = d.activity_kind === "placement" || d.activity_kind === "course" ? d.activity_kind : null;
      if (kind) continue;
      const folder = normalizeGlobalFolderId(d.activity_id);
      if (folder) globalSet.add(folder);
    }
    documentsCustomFolders
      .map((f) => normalizeGlobalFolderId(f))
      .filter((x): x is string => Boolean(x))
      .forEach((f) => globalSet.add(f));

    const globalFolders = Array.from(globalSet)
      .sort((a, b) => a.localeCompare(b, "sv"))
      .map((name) => ({
        key: getDocumentTargetKey(null, name),
        name: name === "uploaded-files" ? "Uppladdade filer" : name,
      }));

    const rootFolder = {
      key: getDocumentTargetKey(null, null),
      name: "Dokument",
    };
    const withRoot = [rootFolder, ...globalFolders.filter((f) => f.key !== rootFolder.key)];

    const placementFolders = availablePlacements.map((p) => ({
      key: getDocumentTargetKey("placement", p.id),
      name: p.name,
      date: p.date,
    }));
    const courseFolders = availableCourses.map((c) => ({
      key: getDocumentTargetKey("course", c.id),
      name: c.name,
      date: c.date,
    }));

    return { globalFolders: withRoot, placementFolders, courseFolders };
  }, [
    availableCourses,
    availableDocuments,
    availablePlacements,
    documentsCustomFolders,
    getDocumentTargetKey,
    normalizeGlobalFolderId,
  ]);

  const pickerFilteredDocuments = useMemo(() => {
    const q = documentsQuery.trim().toLowerCase();
    return availableDocuments.filter((doc) => {
      const matchesFolder =
        getDocumentTargetKey(
          doc.activity_kind === "placement" || doc.activity_kind === "course"
            ? (doc.activity_kind as "placement" | "course")
            : null,
          doc.activity_id || null
        ) === pickerFolderKey;
      if (!matchesFolder) return false;
      if (!q) return true;
      const title = String(doc.title || "").toLowerCase();
      const path = String(doc.file_path || "").toLowerCase();
      const kind = String(doc.activity_kind || "").toLowerCase();
      return title.includes(q) || path.includes(q) || kind.includes(q);
    });
  }, [availableDocuments, documentsQuery, getDocumentTargetKey, pickerFolderKey]);

  const pickerSelectedFolderMeta = useMemo(() => {
    const g = pickerFolderOptions.globalFolders.find((x) => x.key === pickerFolderKey);
    if (g) return { title: g.name, subtitle: "" };
    const p = pickerFolderOptions.placementFolders.find((x) => x.key === pickerFolderKey);
    if (p) return { title: p.name, subtitle: p.date || "" };
    const c = pickerFolderOptions.courseFolders.find((x) => x.key === pickerFolderKey);
    if (c) return { title: c.name, subtitle: c.date || "" };
    return { title: "Dokument", subtitle: "" };
  }, [pickerFolderKey, pickerFolderOptions]);

  useEffect(() => {
    if (!documentPickerOpen) return;
    const allKeys = [
      ...pickerFolderOptions.globalFolders.map((x) => x.key),
      ...pickerFolderOptions.placementFolders.map((x) => x.key),
      ...pickerFolderOptions.courseFolders.map((x) => x.key),
    ];
    if (allKeys.length === 0) return;
    if (!allKeys.includes(pickerFolderKey)) {
      setPickerFolderKey(allKeys[0]);
    }
  }, [documentPickerOpen, pickerFolderKey, pickerFolderOptions]);

  const fileNameFromPath = useCallback((path: string) => {
    const p = String(path || "");
    const parts = p.split("/");
    return parts[parts.length - 1] || "";
  }, []);

  const handlePickExistingDocument = useCallback(
    async (doc: ExistingAppDocument) => {
      if (!doc?.file_path || selectingDocumentPath) return;
      setSelectingDocumentPath(doc.file_path);
      setWarning(null);
      try {
        const { data, error } = await supabase.storage.from("activity-documents").download(doc.file_path);
        if (error || !data) {
          setWarning(error?.message || "Kunde inte hämta dokument från lagring.");
          return;
        }
        const blob = data;
        const fallbackName = fileNameFromPath(doc.file_path) || "dokument";
        let fileName = String(doc.title || "").trim() || fallbackName;
        if (!/\.[a-z0-9]{2,5}$/i.test(fileName)) {
          const extFromPath = (fallbackName.match(/\.[a-z0-9]{2,5}$/i) || [])[0] || "";
          const extFromMime =
            blob.type === "application/pdf"
              ? ".pdf"
              : blob.type.startsWith("image/")
                ? `.${blob.type.split("/")[1].replace("jpeg", "jpg")}`
                : "";
          fileName = `${fileName}${extFromPath || extFromMime}`;
        }
        const pickedFile = new File([blob], fileName, {
          type: blob.type || doc.mime_type || "application/octet-stream",
        });
        onSelectFile(pickedFile, { sourceDocument: doc });
        setDocumentPickerOpen(false);
      } catch {
        setWarning("Kunde inte läsa dokumentfilen. Försök igen.");
      } finally {
        setSelectingDocumentPath(null);
      }
    },
    [fileNameFromPath, onSelectFile, selectingDocumentPath, setWarning]
  );

  const resetDocumentPickerState = useCallback(() => {
    setDocumentPickerOpen(false);
    setDocumentsError(null);
    setDocumentsQuery("");
    setSelectingDocumentPath(null);
    setAvailablePlacements([]);
    setAvailableCourses([]);
    setPickerFolderKey("global:");
    setPickerPlacementsOpen(true);
    setPickerCoursesOpen(true);
    setPickerShowDates(true);
  }, []);

  return {
    documentPickerOpen,
    setDocumentPickerOpen,
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
    pickerFolderOptions: pickerFolderOptions as {
      globalFolders: FolderOption[];
      placementFolders: FolderOption[];
      courseFolders: FolderOption[];
    },
    pickerFilteredDocuments,
    pickerSelectedFolderMeta,
    isSupportedStoredDocument,
    loadAvailableDocuments,
    handlePickExistingDocument,
    resetDocumentPickerState,
  };
}

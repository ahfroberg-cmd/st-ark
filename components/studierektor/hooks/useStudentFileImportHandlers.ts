"use client";

import { useCallback } from "react";

export function useStudentFileImportHandlers({
  handleFiles,
  setDragOver,
}: {
  handleFiles: (files: FileList | null) => void;
  setDragOver: (value: boolean) => void;
}) {
  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles, setDragOver]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    },
    [setDragOver]
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
    },
    [setDragOver]
  );

  return { onFileChange, onDrop, onDragOver, onDragLeave };
}

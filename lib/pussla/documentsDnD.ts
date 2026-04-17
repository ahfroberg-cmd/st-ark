export function setupDocumentsInteractionEffects(input: {
  setDocumentsSidebarWidth: (width: number) => void;
  setDocumentsUploadDragActive: (active: boolean) => void;
  documentsUploadDropzoneRef: { current: HTMLDivElement | null };
  uploadDocumentForTarget: (file: File) => Promise<void>;
}): () => void {
  let resizing = false;

  const onMove = (event: MouseEvent) => {
    if (!resizing) return;
    const viewportWidth = window.innerWidth;
    const nextWidth = Math.max(
      220,
      Math.min(560, Math.round((event.clientX / viewportWidth) * (viewportWidth - 120)))
    );
    input.setDocumentsSidebarWidth(nextWidth);
  };

  const onUp = () => {
    resizing = false;
    document.body.style.userSelect = "";
  };

  const onDown = () => {
    resizing = true;
    document.body.style.userSelect = "none";
  };

  const isFileDragEvent = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types || []).includes("Files");

  const isInsideDropzone = (x: number, y: number) => {
    const element = input.documentsUploadDropzoneRef.current;
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  const onWindowDragOver = (event: DragEvent) => {
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    input.setDocumentsUploadDragActive(isInsideDropzone(event.clientX, event.clientY));
  };

  const onWindowDragEnter = (event: DragEvent) => {
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    input.setDocumentsUploadDragActive(isInsideDropzone(event.clientX, event.clientY));
  };

  const onWindowDragLeave = (event: DragEvent) => {
    if (!isFileDragEvent(event)) return;
    const outOfWindow =
      event.clientX <= 0 ||
      event.clientY <= 0 ||
      event.clientX >= window.innerWidth ||
      event.clientY >= window.innerHeight;
    if (outOfWindow) input.setDocumentsUploadDragActive(false);
  };

  const onWindowDrop = (event: DragEvent) => {
    if (!isFileDragEvent(event)) return;
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length && isInsideDropzone(event.clientX, event.clientY)) {
      const list = Array.from(files || []).filter(Boolean);
      if (list.length > 0) {
        void (async () => {
          for (const file of list) {
            await input.uploadDocumentForTarget(file as File);
          }
        })();
      }
    }
    input.setDocumentsUploadDragActive(false);
  };

  (window as any).__docsSidebarResizeDown = onDown;
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  window.addEventListener("dragover", onWindowDragOver);
  window.addEventListener("dragenter", onWindowDragEnter);
  window.addEventListener("dragleave", onWindowDragLeave);
  window.addEventListener("drop", onWindowDrop);

  return () => {
    delete (window as any).__docsSidebarResizeDown;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("dragover", onWindowDragOver);
    window.removeEventListener("dragenter", onWindowDragEnter);
    window.removeEventListener("dragleave", onWindowDragLeave);
    window.removeEventListener("drop", onWindowDrop);
    document.body.style.userSelect = "";
    input.setDocumentsUploadDragActive(false);
  };
}

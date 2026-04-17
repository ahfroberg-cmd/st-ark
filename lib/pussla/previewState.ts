export function showPreviewFromBlob(input: {
  blob: Blob;
  setPreviewUrl: (url: string | null) => void;
  setPreviewOpen: (open: boolean) => void;
}): void {
  const { blob, setPreviewUrl, setPreviewOpen } = input;
  const url = URL.createObjectURL(blob);
  setPreviewUrl(url);
  setPreviewOpen(true);
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function canBuildPreview(profile: unknown): boolean {
  return !!profile;
}

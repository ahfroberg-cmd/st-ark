export function loadDocumentsCustomFoldersFromStorage(input: {
  storageKey: string;
  normalizeGlobalFolderId: (raw: unknown) => string | null;
}): string[] {
  try {
    const raw = window.localStorage.getItem(input.storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = Array.from(
      new Set(
        parsed
          .map((value: unknown) => input.normalizeGlobalFolderId(value))
          .filter((value): value is string => Boolean(value))
      )
    );
    return cleaned;
  } catch {
    return [];
  }
}

export function saveDocumentsCustomFoldersToStorage(input: {
  storageKey: string;
  folders: string[];
}): void {
  try {
    window.localStorage.setItem(input.storageKey, JSON.stringify(input.folders));
  } catch {
    // ignore write errors
  }
}

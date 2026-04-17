const ST_COMPLETE_DECLINED_STORAGE_KEY = "st_ark_studierektor_st_complete_declined_v1";

export function loadStCompleteDeclinedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(ST_COMPLETE_DECLINED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

export function saveStCompleteDeclinedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ST_COMPLETE_DECLINED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function addStCompleteDeclined(userId: string) {
  const n = loadStCompleteDeclinedIds();
  n.add(userId);
  saveStCompleteDeclinedIds(n);
}

export function removeStCompleteDeclined(userId: string) {
  const n = loadStCompleteDeclinedIds();
  n.delete(userId);
  saveStCompleteDeclinedIds(n);
}

import { useEffect } from "react";

type Params = {
  dirty: boolean;
  hasSelection: boolean;
  delayMs?: number;
  onAutosave: () => void;
};

export function useDebouncedAutosave({
  dirty,
  hasSelection,
  delayMs = 1200,
  onAutosave,
}: Params) {
  useEffect(() => {
    if (!dirty || !hasSelection) return;
    const timer = window.setTimeout(() => {
      onAutosave();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [dirty, hasSelection, delayMs, onAutosave]);
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Args<TSnapshot> = {
  open: boolean;
  dirty: boolean;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  getSnapshot: () => TSnapshot;
  applySnapshot: (snapshot: TSnapshot) => void;
  onSave: () => Promise<boolean>;
  initDeps: React.DependencyList;
  dirtyDeps: React.DependencyList;
};

export function useModalCloseAndSave<TSnapshot>({
  open,
  dirty,
  setDirty,
  onClose,
  getSnapshot,
  applySnapshot,
  onSave,
  initDeps,
  dirtyDeps,
}: Args<TSnapshot>) {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [baselineReady, setBaselineReady] = useState(false);
  const baselineRef = useRef<TSnapshot | null>(null);
  const baselineSetTimeRef = useRef<number>(0);

  const takeBaseline = useCallback(() => {
    baselineRef.current = getSnapshot();
  }, [getSnapshot]);

  const restoreBaseline = useCallback(() => {
    if (!baselineRef.current) return;
    applySnapshot(baselineRef.current);
  }, [applySnapshot]);

  const handleSaveAll = useCallback(async () => {
    const ok = await onSave();
    if (ok) {
      takeBaseline();
      setDirty(false);
    }
  }, [onSave, setDirty, takeBaseline]);

  const handleRequestClose = useCallback(() => {
    if (!dirty) {
      onClose();
      return;
    }
    setShowCloseConfirm(true);
  }, [dirty, onClose]);

  const handleConfirmClose = useCallback(() => {
    restoreBaseline();
    setDirty(false);
    setShowCloseConfirm(false);
    onClose();
  }, [onClose, restoreBaseline, setDirty]);

  const handleCancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  const handleSaveAndClose = useCallback(async () => {
    await handleSaveAll();
    setShowCloseConfirm(false);
    onClose();
  }, [handleSaveAll, onClose]);

  useEffect(() => {
    if (open) {
      setShowCloseConfirm(false);
      setBaselineReady(false);
      baselineRef.current = null;
      baselineSetTimeRef.current = 0;
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setBaselineReady(false);
      baselineRef.current = null;
      return;
    }
    const timer = setTimeout(() => {
      takeBaseline();
      setBaselineReady(true);
      setDirty(false);
      baselineSetTimeRef.current = Date.now();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ...initDeps]);

  useEffect(() => {
    if (!open || !baselineReady || !baselineRef.current) return;
    const timeSinceBaseline = Date.now() - baselineSetTimeRef.current;
    if (timeSinceBaseline < 500) {
      setDirty(false);
      return;
    }

    const timer = setTimeout(() => {
      const baseline = baselineRef.current;
      if (!baseline) return;
      const cur = getSnapshot();
      try {
        setDirty(JSON.stringify(cur) !== JSON.stringify(baseline));
      } catch {
        // ignore
      }
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, baselineReady, ...dirtyDeps]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (showCloseConfirm) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void handleSaveAll();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true, passive: false });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, showCloseConfirm, dirty, handleSaveAll]);

  return {
    showCloseConfirm,
    handleRequestClose,
    handleConfirmClose,
    handleCancelClose,
    handleSaveAndClose,
    handleSaveAll,
  };
}

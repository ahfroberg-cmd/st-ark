"use client";

import { useEffect, useRef } from "react";

type InfoToast = { title: string; message: string } | null;

export function useAutoDismissInfoToast(
  infoToast: InfoToast,
  setInfoToast: (value: InfoToast) => void,
  delayMs = 8000
) {
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!infoToast) return;
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    toastTimerRef.current = window.setTimeout(() => {
      setInfoToast(null);
      toastTimerRef.current = null;
    }, delayMs);

    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [delayMs, infoToast, setInfoToast]);
}

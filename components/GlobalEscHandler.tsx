"use client";

import { useEffect } from "react";
import { setupGlobalEscHandler, teardownGlobalEscHandler } from "@/lib/modalEscHandler";

export default function GlobalEscHandler() {
  useEffect(() => {
    setupGlobalEscHandler();

    const blockCaretBrowsing = (e: KeyboardEvent) => {
      if (e.key !== "F7") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    const preventBackdropCloseOnTextSelection = (e: MouseEvent) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.classList?.contains("fixed") || !target.classList?.contains("inset-0")) return;

      // Om text är markerad och klicket landar på backdrop: blockera stängning
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", blockCaretBrowsing, { capture: true, passive: false });
    window.addEventListener("click", preventBackdropCloseOnTextSelection, { capture: true, passive: false });

    return () => {
      window.removeEventListener("keydown", blockCaretBrowsing, { capture: true });
      window.removeEventListener("click", preventBackdropCloseOnTextSelection, { capture: true });
      teardownGlobalEscHandler();
    };
  }, []);

  return null;
}

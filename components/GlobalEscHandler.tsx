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

    window.addEventListener("keydown", blockCaretBrowsing, { capture: true, passive: false });

    return () => {
      window.removeEventListener("keydown", blockCaretBrowsing, { capture: true });
      teardownGlobalEscHandler();
    };
  }, []);

  return null;
}

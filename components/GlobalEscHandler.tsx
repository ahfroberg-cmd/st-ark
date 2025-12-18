"use client";

import { useEffect } from "react";
import { setupGlobalEscHandler, teardownGlobalEscHandler } from "@/lib/modalEscHandler";

export default function GlobalEscHandler() {
  useEffect(() => {
    setupGlobalEscHandler();
    return () => {
      teardownGlobalEscHandler();
    };
  }, []);

  return null;
}

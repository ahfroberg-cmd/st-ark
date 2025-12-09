"use client";
import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const url = "/sw.js";
      navigator.serviceWorker.register(url).catch(console.error);
    }
  }, []);
  return null;
}

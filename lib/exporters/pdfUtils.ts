// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { rgb } from "pdf-lib";

export async function fetchPublicPdf(path: string): Promise<ArrayBuffer> {
  const url =
    typeof window !== "undefined"
      ? new URL(path, window.location.origin).toString()
      : path;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Kunde inte läsa PDF från ${url} (HTTP ${res.status})`);
  }
  return await res.arrayBuffer();
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const safe = new Uint8Array(bytes as any);
  const buf = safe.buffer.slice(safe.byteOffset, safe.byteOffset + safe.byteLength);
  const blob = new Blob([buf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.target = "_blank"; // robust för Safari/iOS
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function toPdfBlob(bytes: Uint8Array) {
  const safe = new Uint8Array(bytes as any);
  const buf = safe.buffer.slice(safe.byteOffset, safe.byteOffset + safe.byteLength);
  return new Blob([buf], { type: "application/pdf" });
}

export function drawText(opts: {
  page: any;
  text: string;
  x: number;
  y: number;
  size: number;
  font: any;
}) {
  opts.page.drawText(opts.text ?? "", {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: rgb(0, 0, 0),
  });
}

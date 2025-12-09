// lib/imageClean.ts
import { loadOpenCV } from "./opencv";

/**
 * Laddar en File till HTMLImageElement (stabilare än createImageBitmap i iOS/WebKit).
 */
async function fileToHTMLImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = url;
    await img.decode().catch(() => Promise.resolve()); // vissa browsers kastar inte decode() korrekt
    return img;
  } finally {
    // OBS: vi kan inte alltid revoka direkt – canvas läser från url.
    // Vi revokar i call-site efter draw.
  }
}

/**
 * Downscale till max-bredd 2200px för snabbare CV (kan justeras).
 */
function drawImageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const MAX_W = 2200;
  const scale = img.naturalWidth > MAX_W ? MAX_W / img.naturalWidth : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * Minimal och robust tvätt:
 *  - gråskala
 *  - adaptive threshold
 *  - inga konturer/warp (kan inte fastna)
 */
export async function cleanDocumentImage(file: File): Promise<Blob> {
  const cv = await loadOpenCV();

  const img = await fileToHTMLImage(file);
  const canvas = drawImageToCanvas(img);
  // nu kan vi släppa blob-urlen
  try { URL.revokeObjectURL(img.src); } catch {}

  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  const bin = new cv.Mat();
  cv.adaptiveThreshold(
    gray, bin, 255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY,
    31, 15
  );

  cv.imshow(canvas, bin);

  src.delete();
  gray.delete();
  bin.delete();

  return new Promise((resolve) => canvas.toBlob(b => resolve(b!), "image/png"));
}

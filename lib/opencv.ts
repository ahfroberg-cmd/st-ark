// lib/opencv.ts
let cvPromise: Promise<void> | null = null;

export async function loadOpenCV(): Promise<typeof globalThis.cv> {
  if (typeof window === "undefined") {
    throw new Error("OpenCV can only be loaded in the browser.");
  }

  if ((window as any).cv && (window as any).cv.Mat) {
    return (window as any).cv;
  }

  if (!cvPromise) {
    cvPromise = new Promise<void>((resolve, reject) => {
      const existing = Array.from(document.scripts).some(s => s.src.endsWith("/opencv.js"));
      if (!existing) {
        const script = document.createElement("script");
        script.src = "/opencv.js";
        script.async = true;
        script.onload = () => { /* väntar på cv.Mat nedan */ };
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
      }

      const start = Date.now();
      (function waitForCv() {
        const cv = (window as any).cv;
        if (cv && cv.Mat) {
          resolve();
          return;
        }
        if (Date.now() - start > 15000) {
          reject(new Error("OpenCV timed out waiting for cv.Mat (15s). Check /opencv.js."));
          return;
        }
        setTimeout(waitForCv, 50);
      })();
    });
  }

  await cvPromise;
  return (window as any).cv;
}

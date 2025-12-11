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
      // Försök först lokal fil, sedan CDN
      const tryLoad = (src: string) => {
        const existing = Array.from(document.scripts).some(s => s.src === src || s.src.endsWith("/opencv.js"));
        if (existing) {
          // Script finns redan, vänta bara på att det laddas
          const start = Date.now();
          (function waitForCv() {
            const cv = (window as any).cv;
            if (cv && cv.Mat) {
              resolve();
              return;
            }
            if (Date.now() - start > 15000) {
              reject(new Error("OpenCV timed out waiting for cv.Mat (15s)."));
              return;
            }
            setTimeout(waitForCv, 50);
          })();
          return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => {
          // Vänta på cv.Mat
          const start = Date.now();
          (function waitForCv() {
            const cv = (window as any).cv;
            if (cv && cv.Mat) {
              resolve();
              return;
            }
            if (Date.now() - start > 15000) {
              reject(new Error("OpenCV timed out waiting for cv.Mat (15s)."));
              return;
            }
            setTimeout(waitForCv, 50);
          })();
        };
        script.onerror = (err) => {
          // Om lokal fil misslyckas, försök CDN
          if (src === "/opencv.js") {
            console.warn("[OpenCV] Lokal fil /opencv.js hittades inte, försöker CDN...");
            tryLoad("https://docs.opencv.org/4.10.0/opencv.js");
          } else {
            reject(new Error(`OpenCV failed to load from ${src}`));
          }
        };
        document.head.appendChild(script);
      };

      // Försök först lokal fil
      tryLoad("/opencv.js");
    });
  }

  await cvPromise;
  return (window as any).cv;
}

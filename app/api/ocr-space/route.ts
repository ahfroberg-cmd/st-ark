export const runtime = "nodejs";

type OcrWord = {
  text: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence?: number;
};

type OcrResult = {
  text: string;
  words?: OcrWord[];
  width?: number;
  height?: number;
};

export async function POST(req: Request) {
  try {
    const apiKey =
      process.env.OCR_SPACE_API_KEY ||
      process.env.OCR_SPACE_KEY ||
      // fallback om någon redan har lagt in den som NEXT_PUBLIC tidigare
      process.env.NEXT_PUBLIC_OCR_SPACE_API_KEY ||
      "";

    if (!apiKey.trim()) {
      return Response.json(
        { error: "OCR_SPACE_API_KEY saknas på servern." },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const langRaw = String(form.get("lang") || "swe+eng");

    // OCR.space stödjer ett språk per request
    const ocrLang = langRaw.includes("swe") ? "swe" : (langRaw.split("+")[0] || "eng");

    if (!(file instanceof File)) {
      return Response.json({ error: "Ingen fil skickades (field: file)." }, { status: 400 });
    }

    const apiUrl = "https://api.ocr.space/parse/image";
    const fd = new FormData();
    fd.append("apikey", apiKey.trim());
    fd.append("language", ocrLang);
    fd.append("isOverlayRequired", "true"); // för word-koordinater
    fd.append("detectOrientation", "true");
    fd.append("scale", "true");
    fd.append("OCREngine", "2");

    // OCR.space: multipart file upload (field name: file)
    fd.append("file", file, file.name || "upload.jpg");

    const resp = await fetch(apiUrl, { method: "POST", body: fd as any });
    const json = await resp.json().catch(() => null);

    if (!resp.ok) {
      const msg = json?.ErrorMessage
        ? String(json.ErrorMessage)
        : `OCR.space API error: ${resp.status}`;
      return Response.json({ error: msg }, { status: 502 });
    }

    if (json?.ErrorMessage) {
      return Response.json(
        { error: Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join(", ") : String(json.ErrorMessage) },
        { status: 502 }
      );
    }

    const parsed = json?.ParsedResults?.[0];
    const text = String(parsed?.ParsedText || "").trim();

    const words: OcrWord[] = [];
    const lines = parsed?.TextOverlay?.Lines;
    if (Array.isArray(lines)) {
      for (const line of lines) {
        const wds = line?.Words;
        if (!Array.isArray(wds)) continue;
        for (const w of wds) {
          if (!w?.WordText) continue;
          const left = Number(w.Left || 0);
          const top = Number(w.Top || 0);
          const width = Number(w.Width || 0);
          const height = Number(w.Height || 0);
          words.push({
            text: String(w.WordText),
            x1: left,
            y1: top,
            x2: left + width,
            y2: top + height,
          });
        }
      }
    }

    const out: OcrResult = {
      text,
      words: words.length ? words : undefined,
      width: typeof parsed?.ImageWidth === "number" ? parsed.ImageWidth : undefined,
      height: typeof parsed?.ImageHeight === "number" ? parsed.ImageHeight : undefined,
    };

    return Response.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}



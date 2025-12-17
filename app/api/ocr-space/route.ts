export const runtime = "nodejs";

import { MAX_OCR_FILE_SIZE, ALLOWED_OCR_FILE_TYPES, ALLOWED_OCR_FILE_EXTENSIONS } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

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
    // Rate limiting: max 10 requests per minut per IP
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(`ocr:${clientIp}`, 10, 60000); // 10 requests per minut
    
    if (!rateLimit.allowed) {
      return Response.json(
        {
          error: "För många förfrågningar. Försök igen senare.",
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetTime / 1000)),
          },
        }
      );
    }

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
    
    // Validera fil på serversidan
    if (!(file instanceof File)) {
      return Response.json({ error: "Ingen fil skickades (field: file)." }, { status: 400 });
    }
    
    // Kontrollera filstorlek
    if (file.size > MAX_OCR_FILE_SIZE) {
      return Response.json(
        { error: `Filen är för stor. Maximal storlek är ${MAX_OCR_FILE_SIZE / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }
    
    // Kontrollera filtyp
    const isValidType = ALLOWED_OCR_FILE_TYPES.includes(file.type);
    const isValidExtension = ALLOWED_OCR_FILE_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!isValidType && !isValidExtension) {
      return Response.json(
        { error: `Ogiltig filtyp. Tillåtna format: ${ALLOWED_OCR_FILE_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // OCR.space stödjer ett språk per request (3-bokstavskoder).
    // Normalisera och mappa vanliga varianter, och fallbacka till eng.
    const normalizeOcrSpaceLang = (raw: string): string => {
      const s = String(raw || "").trim().toLowerCase();
      const primary = s.includes("swe") || s === "sv" || s.startsWith("sv+")
        ? "swe"
        : (s.split("+")[0] || "eng");

      const map: Record<string, string> = {
        sv: "swe",
        se: "swe",
        swe: "swe",
        en: "eng",
        eng: "eng",
      };
      const candidate = map[primary] || primary;

      // OCR.space language list (subset; ok att utöka senare)
      const allowed = new Set([
        "eng",
        "swe",
        "dan",
        "nor",
        "fin",
        "ger",
        "fre",
        "spa",
        "ita",
        "por",
        "pol",
        "dut",
      ]);

      return allowed.has(candidate) ? candidate : "eng";
    };

    const ocrLang = normalizeOcrSpaceLang(langRaw);

    const apiUrl = "https://api.ocr.space/parse/image";

    async function callOcrSpace(language: string) {
      const fd = new FormData();
      fd.append("apikey", apiKey.trim());
      fd.append("language", language);
      fd.append("isOverlayRequired", "true"); // för word-koordinater
      fd.append("detectOrientation", "true");
      fd.append("scale", "true");
      fd.append("OCREngine", "2");
      // OCR.space: multipart file upload (field name: file)
      fd.append("file", file, file.name || "upload.jpg");

      const resp = await fetch(apiUrl, { method: "POST", body: fd as any });
      const json = await resp.json().catch(() => null);
      return { resp, json };
    }

    let { resp, json } = await callOcrSpace(ocrLang);

    // Om OCR.space klagar på language, prova eng som fallback
    const errorMsgRaw =
      json?.ErrorMessage
        ? (Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join(", ") : String(json.ErrorMessage))
        : "";
    const isLangError =
      errorMsgRaw.includes("E201") ||
      errorMsgRaw.toLowerCase().includes("language");

    if ((!resp.ok || json?.ErrorMessage) && isLangError && ocrLang !== "eng") {
      const retry = await callOcrSpace("eng");
      resp = retry.resp;
      json = retry.json;
    }

    if (!resp.ok) {
      const errorMsgRaw = json?.ErrorMessage
        ? (Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join(", ") : String(json.ErrorMessage))
        : "";
      
      // 403 = ogiltig API-nyckel eller gräns nådd
      if (resp.status === 403) {
        const msg = errorMsgRaw || "OCR.space API-nyckel är ogiltig eller användningsgränsen är nådd. Kontrollera OCR_SPACE_API_KEY i miljövariabler.";
        console.error("[OCR.space] 403 Forbidden:", msg);
        return Response.json({ error: msg }, { status: 403 });
      }
      
      const msg = errorMsgRaw || `OCR.space API error: ${resp.status}`;
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

    const out: OcrResult & { usedLanguage?: string } = {
      text,
      words: words.length ? words : undefined,
      width: typeof parsed?.ImageWidth === "number" ? parsed.ImageWidth : undefined,
      height: typeof parsed?.ImageHeight === "number" ? parsed.ImageHeight : undefined,
    };
    // Debug/hjälp (klienten ignorerar okända fält)
    out.usedLanguage = ocrLang;

    return Response.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}



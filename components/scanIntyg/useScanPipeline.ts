"use client";

import { useCallback } from "react";
import { ocrImage } from "@/lib/ocr";
import { detectIntygKind, type IntygKind } from "@/lib/intygDetect";
import { validateOcrFile } from "@/lib/validation";
import { parse_2015_bilaga4 } from "@/lib/intygParsers/parse_2015_bilaga4";
import { extractDates, splitClinicAndPeriod } from "@/lib/dateExtract";
import { getParser } from "@/lib/intygParsers/registry";

type Args = {
  file: File | null;
  goalsVersion?: "2015" | "2021";
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setWarning: React.Dispatch<React.SetStateAction<string | null>>;
  setOcrText: React.Dispatch<React.SetStateAction<string>>;
  setKind: React.Dispatch<React.SetStateAction<IntygKind | null>>;
  setParsed: React.Dispatch<any>;
  setStep: React.Dispatch<React.SetStateAction<"upload" | "review">>;
};

function asciiSoft(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-–—]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function preCleanRawOcr(s: string) {
  if (!s) return "";
  let out = s;
  out = out.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ");
  out = out.replace(/[|【】\[\]<>]/g, " ");
  out = out.replace(/[{}©@£$∞§≈±´`+·•†‡°^~“”"‘’'_#®™✓✔︎=]+/g, " ");
  out = out.replace(/[-–—]\s*([A-ZÅÄÖ])/g, "\n- $1");
  out = out
    .split("\n")
    .map((l) => l.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  out = out
    .replace(/[ÉÈÊéèê]([bcdfghjklmnpqrstvwxz])/gi, (_m, p1) => "ä" + p1)
    .replace(/([aeiouyåäö])([ÉÈÊéèê])/gi, (_m, p1) => p1 + "ö")
    .replace(/([fFmMsStT])([ÉÈÊéèê])/g, (_m, p1) => p1 + "å")
    .replace(/[ÉÈÊéèê]/g, "ä");
  return out.trim();
}

function enforceBulletBreaks(s: string) {
  if (!s) return s;
  let out = s;
  out = out.replace(/\r\n?/g, "\n");
  out = out.replace(/[ \t]+\n/g, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
  return out.trim();
}

function normalizeDateGuess(s: string): string | null {
  const value = s.trim();
  if (!value) return null;

  let m = value.match(/^(\d{4})[.\-\/ ]?(\d{1,2})[.\-\/ ]?(\d{1,2})$/);
  if (m) {
    const [, Y, Mraw, Draw] = m;
    return `${Y}-${Mraw.padStart(2, "0")}-${Draw.padStart(2, "0")}`;
  }

  m = value.match(/^(\d{1,2})[.\-\/ ](\d{1,2})[.\-\/ ](\d{4})$/);
  if (m) {
    let [, d, mo] = m;
    const y = m[3];
    if (d.length === 1) d = `0${d}`;
    if (mo.length === 1) mo = `0${mo}`;
    return `${y}-${mo}-${d}`;
  }

  m = value.match(/^(\d{1,2})[.\-\/ ](\d{1,2})[.\-\/ ](\d{2})$/);
  if (m) {
    let [, d, mo] = m;
    const yy = m[3];
    if (d.length === 1) d = `0${d}`;
    if (mo.length === 1) mo = `0${mo}`;
    const yearNum = parseInt(yy, 10);
    const year = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
    return `${year}-${mo}-${d}`;
  }

  m = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) {
    const [, yy, mo, dd] = m;
    const yearNum = parseInt(yy, 10);
    const year = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
    return `${year}-${mo}-${dd}`;
  }

  m = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) {
    const [, Y, M, D] = m;
    return `${Y}-${M}-${D}`;
  }

  return null;
}

function extractDatesFromLine(line: string) {
  let cleaned = line;
  let startISO: string | null = null;
  let endISO: string | null = null;
  const tokens = cleaned.match(/[\d./\-]+/g) ?? [];
  const dates: { iso: string; raw: string }[] = [];
  for (const tok of tokens) {
    const iso = normalizeDateGuess(tok);
    if (iso) dates.push({ iso, raw: tok });
  }
  if (dates.length > 0) {
    startISO = dates[0].iso;
    if (dates.length > 1) endISO = dates[1].iso;
    for (const d of dates) cleaned = cleaned.replace(d.raw, " ");
  }
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return { startISO, endISO, cleaned };
}

function extractDelmalCodesFromOcrText(raw: string): string[] {
  const s0 = String(raw || "");
  const s = s0
    .replace(/\b(ST)?([abc])\s*[lI]\b/gi, (_m, p1, p2) => `${p1 ?? ""}${p2}1`)
    .replace(/\b([abc])\s*[lI]\b/gi, (_m, p1) => `${p1}1`);
  const out: string[] = [];
  const re = /\b(?:ST\s*)?([abc])\s*(\d{1,2})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const grp = String(m[1] || "").toUpperCase();
    const num = String(m[2] || "").trim();
    if (grp && num) out.push(`${grp}${num}`);
  }
  const uniq = Array.from(new Set(out));
  uniq.sort((a, b) => {
    const ma = a.match(/^([ABC])(\d{1,2})$/);
    const mb = b.match(/^([ABC])(\d{1,2})$/);
    if (!ma || !mb) return a.localeCompare(b);
    if (ma[1] !== mb[1]) return ma[1].localeCompare(mb[1]);
    return Number(ma[2]) - Number(mb[2]);
  });
  return uniq;
}

async function renderPdfFirstPageToPngBlob(pdfFile: File): Promise<Blob> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (pdfjs?.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const data = await pdfFile.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kunde inte skapa canvas-context för PDF.");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Kunde inte konvertera PDF-sida till bild."));
    }, "image/png");
  });
}

export function useScanPipeline({
  file,
  goalsVersion,
  setBusy,
  setWarning,
  setOcrText,
  setKind,
  setParsed,
  setStep,
}: Args) {
  const handleScan = useCallback(async () => {
    if (!file) return;

    const fileValidation = validateOcrFile(file);
    if (!fileValidation.valid) {
      setWarning(fileValidation.error || "Ogiltig fil.");
      setBusy(false);
      return;
    }

    setBusy(true);
    setWarning(null);

    try {
      const isPdf = /pdf$/i.test(file.name) || file.type === "application/pdf";
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ocr-timeout")), 70000)
      );
      const ocrInput: Blob = isPdf ? await renderPdfFirstPageToPngBlob(file) : file;
      const ocrResult = await Promise.race([ocrImage(ocrInput, "swe+eng"), timeout]);
      const { text, width, height } = ocrResult;

      if (width && height) {
        const expectedAspectRatio = 1057 / 1496;
        const actualAspectRatio = width / height;
        if (Math.abs(actualAspectRatio - expectedAspectRatio) > 0.15) {
          setWarning(
            "Bilden verkar inte ha rätt proportioner. Se till att du fotograferat hela dokumentet rakt ovanifrån för bästa resultat."
          );
        }
      }

      const content = preCleanRawOcr(text || "");
      setOcrText(content);

      let det = detectIntygKind(content);
      let k = det?.kind ?? null;
      const softContent = asciiSoft(content);
      const looksLike2015B4 =
        softContent.includes("klinisk tjanstgoring under handledning") &&
        softContent.includes("tjanstgoringsstalle och period") &&
        softContent.includes("uppfyllda kompetenskrav");
      if (looksLike2015B4) {
        k = "2015-B4-KLIN";
        det = { kind: "2015-B4-KLIN" as IntygKind } as any;
      }

      const is2015Form = /\bsosfs\s*2015:8\b/.test(softContent) || /\b2015:8\b/.test(softContent);
      if (is2015Form && k && k.startsWith("2021")) {
        switch (k) {
          case "2021-B9-KLIN":
            k = "2015-B4-KLIN";
            break;
          case "2021-B8-AUSK":
            k = "2015-B3-AUSK";
            break;
          case "2021-B10-KURS":
            k = "2015-B5-KURS";
            break;
          case "2021-B11-UTV":
            k = "2015-B6-UTV";
            break;
          case "2021-B12-STa3":
            k = "2015-B7-SKRIFTLIGT";
            break;
          default:
            break;
        }
        if (det && k) det = { ...det, kind: k as IntygKind };
      }

      setKind(k);

      const detectedVersion =
        k && (k.startsWith("2015") || k.startsWith("2021"))
          ? (k.slice(0, 4) as "2015" | "2021")
          : undefined;
      if (goalsVersion && detectedVersion && goalsVersion !== detectedVersion) {
        setWarning(
          `Detta intyg verkar vara för målbeskrivningen ${detectedVersion}, men din profil är inställd på ${goalsVersion}. Du kan inte läsa in detta intyg i den här målversionen.`
        );
        setParsed(null);
        setBusy(false);
        return;
      }

      const noDatesKinds = new Set<IntygKind>(["2015-B7-SKRIFTLIGT", "2015-B6-UTV", "2021-B11-UTV"]);
      const dates = extractDates(content);
      let p: any = {};
      const parser = getParser(k || undefined);

      console.log("[ScanIntygModal] ====== PARSER ANROP ======");
      console.log("[ScanIntygModal] Detected kind:", k);
      console.log("[ScanIntygModal] Parser function:", parser ? "FINNS" : "SAKNAS");
      console.log("[ScanIntygModal] OCR content length:", content.length);
      console.log("[ScanIntygModal] OCR content first 500 chars:", content.substring(0, 500));

      if (parser) {
        try {
          p = parser(content);
          console.log("[ScanIntygModal] Parser resultat:", JSON.stringify(p, null, 2));
        } catch (error) {
          console.error("[ScanIntygModal] Parser error:", error);
          p = {};
        }
      } else if (k === "2015-B4-KLIN") {
        p = parse_2015_bilaga4(content);
      } else {
        setWarning("Kunde inte identifiera intygsmallen automatiskt. Du kan fylla fälten manuellt.");
        p = {};
      }

      if (k === "2021-B11-UTV" && (p as any)?.subject && !(p as any)?.clinic) {
        (p as any).clinic = (p as any).subject;
      }

      if (k === "2021-B10-KURS" && (p as any)?.courseTitle) {
        const courseTitle = (p as any).courseTitle.trim();
        const predefinedCourses = [
          "Akutpsykiatri",
          "Psykiatrisk diagnostik",
          "Psykiatrisk juridik",
          "Psykofarmakologi",
          "Suicidologi",
          "Levnadsvanor vid psykisk sjukdom",
          "Beroendelära",
          "Affektiva sjukdomar",
          "BUP för vuxenpsykiatriker",
          "Konsultationspsykiatri och psykosomatik",
          "Neuropsykiatri",
          "Personlighetssyndrom",
          "Psykossjukdomar",
          "Ätstörningar",
          "OCD- och relaterade syndrom",
          "Ångest-, trauma- och stressrelaterade syndrom",
          "Äldrepsykiatri",
          "Kritisk läkemedelsvärdering inom psykofarmakologi",
          "Medicinsk vetenskap",
          "Psykiatrisk neurovetenskap",
          "Psykiatri & samhälle",
          "Rättspsykiatri",
          "Sexualmedicin och könsdysfori",
          "Transkulturell psykiatri",
          "Psykoterapi",
          "Ledarskap",
          "Handledning",
          "Palliativ medicin",
        ];
        const matchedCourse = predefinedCourses.find(
          (predefined) =>
            predefined.toLowerCase() === courseTitle.toLowerCase() ||
            courseTitle.toLowerCase().includes(predefined.toLowerCase()) ||
            predefined.toLowerCase().includes(courseTitle.toLowerCase())
        );
        if (matchedCourse) {
          (p as any).title = matchedCourse;
          if (matchedCourse.toLowerCase() !== courseTitle.toLowerCase()) {
            (p as any).courseTitle = courseTitle;
          }
        } else {
          (p as any).title = "Annan kurs";
          (p as any).courseTitle = courseTitle;
        }
      }

      if (k && !noDatesKinds.has(k)) {
        if (dates.startISO && !p.period?.startISO) p.period = { ...(p.period ?? {}), startISO: dates.startISO };
        if (dates.endISO && !p.period?.endISO) p.period = { ...(p.period ?? {}), endISO: dates.endISO };
      } else if (p.period) {
        delete p.period;
      }

      if (p?.description) p.description = enforceBulletBreaks(p.description);

      const existingDelmal = Array.isArray((p as any)?.delmalCodes)
        ? ((p as any).delmalCodes as any[]).map((x) => String(x || "").trim()).filter(Boolean)
        : typeof (p as any)?.delmalCodes === "string"
          ? String((p as any).delmalCodes)
              .split(/[\s,;]+/)
              .map((x) => x.trim())
              .filter(Boolean)
          : [];
      if (existingDelmal.length === 0) {
        const found = extractDelmalCodesFromOcrText(content);
        if (found.length > 0) (p as any).delmalCodes = found;
      }

      const clinicRaw = p?.clinic ?? "";
      if (clinicRaw) {
        const lines = clinicRaw
          .replace(/\r\n?/g, "\n")
          .split("\n")
          .map((l: string) => l.trim())
          .filter(Boolean);
        let working = lines.length > 0 ? lines[lines.length - 1] : "";
        if (working) {
          const lower = working.toLowerCase();
          let cutPos = -1;
          let cutLen = 0;
          const idxKlin1 = lower.lastIndexOf("tjänstgöringen");
          if (idxKlin1 >= 0) {
            cutPos = idxKlin1;
            cutLen = "tjänstgöringen".length;
          }
          const idxKlin2 = lower.lastIndexOf("tjanstgoringen");
          if (idxKlin2 >= 0 && idxKlin2 + "tjanstgoringen".length > cutPos + cutLen) {
            cutPos = idxKlin2;
            cutLen = "tjanstgoringen".length;
          }
          const idxParen = working.lastIndexOf(")");
          if (idxParen >= 0 && idxParen + 1 > cutPos + cutLen) {
            cutPos = idxParen;
            cutLen = 1;
          }
          if (cutPos >= 0) working = working.slice(cutPos + cutLen).trim();
          if (/\d/.test(working)) {
            const split = splitClinicAndPeriod(working);
            if (split.startISO && !p.period?.startISO) p.period = { ...(p.period ?? {}), startISO: split.startISO };
            if (split.endISO && !p.period?.endISO) p.period = { ...(p.period ?? {}), endISO: split.endISO };
            working = split.clean || working;
          }
          if (/\d/.test(working)) {
            const d2 = extractDatesFromLine(working);
            if (d2.startISO && !p.period?.startISO) p.period = { ...(p.period ?? {}), startISO: d2.startISO };
            if (d2.endISO && !p.period?.endISO) p.period = { ...(p.period ?? {}), endISO: d2.endISO };
            working = d2.cleaned;
          }
          working = working
            .replace(/\b\d{6}\b/g, " ")
            .replace(/\b\d{8}\b/g, " ")
            .replace(/\b\d{2}[.\-\/]\d{2}[.\-\/]\d{2,4}\b/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();
          p.clinic = working.trim();
        }
      }

      setParsed(p);
      setStep("review");
    } catch (e) {
      console.error("[OCR ERROR]", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "ocr-timeout") {
        setWarning("OCR tog för lång tid (timeout). Prova igen om en stund eller med en mindre/tydligare bild.");
      } else if (/OCR_SPACE_API_KEY/i.test(msg)) {
        setWarning(`OCR.space är inte konfigurerat på servern: ${msg} (lägg in OCR_SPACE_API_KEY i Vercel).`);
      } else {
        setWarning(`OCR.space misslyckades: ${msg}`);
      }
    } finally {
      setBusy(false);
    }
  }, [file, goalsVersion, setBusy, setKind, setOcrText, setParsed, setStep, setWarning]);

  return { handleScan };
}

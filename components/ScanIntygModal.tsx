//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
"use client";

import React, { useRef, useState, useEffect } from "react";
import { ocrImage } from "@/lib/ocr";
import { detectIntygKind, type IntygKind } from "@/lib/intygDetect";
import { validateOcrFile } from "@/lib/validation";

// 2015
import { parse_2015_bilaga3 } from "@/lib/intygParsers/parse_2015_bilaga3";
import { parse_2015_bilaga4 } from "@/lib/intygParsers/parse_2015_bilaga4";
import { parse_2015_bilaga5 } from "@/lib/intygParsers/parse_2015_bilaga5";
import { parse_2015_bilaga6 } from "@/lib/intygParsers/parse_2015_bilaga6";
import { parse_2015_bilaga7 } from "@/lib/intygParsers/parse_2015_bilaga7";
// 2021
import { parse_2021_bilaga8 } from "@/lib/intygParsers/parse_2021_bilaga8";
import { parse_2021_bilaga9 } from "@/lib/intygParsers/parse_2021_bilaga9";
import { parse_2021_bilaga10 } from "@/lib/intygParsers/parse_2021_bilaga10";
import { parse_2021_bilaga11 } from "@/lib/intygParsers/parse_2021_bilaga11";
import { parse_2021_bilaga12 } from "@/lib/intygParsers/parse_2021_bilaga12";
import { parse_2021_bilaga13 } from "@/lib/intygParsers/parse_2021_bilaga13";

import { mapAndSaveKurs, mapAndSavePlacement2015 } from "@/lib/intygMap";
import { db } from "@/lib/db";
import { extractDates, splitClinicAndPeriod } from "@/lib/dateExtract";
import { getParser, labelsFor, kindHasDates } from "@/lib/intygParsers/registry";
import CalendarDatePicker from "@/components/CalendarDatePicker";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  goalsVersion?: "2015" | "2021";
};

type Step = "upload" | "review";

let lastOcrRaw = "";

export default function ScanIntygModal({
  open,
  onClose,
  onSaved,
  goalsVersion,
}: Props) {

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [kind, setKind] = useState<IntygKind | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [gdprModalOpen, setGdprModalOpen] = useState(false);

  const visible = open ? "" : "hidden";
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetAll() {
    setStep("upload");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    setBusy(false);
    setOcrText("");
    setKind(null);
    setParsed(null);
    setWarning(null);
    setTipsOpen(false);
  }

  function handleClose() {
    onClose();
    resetAll();
  }

  // ESC för att stänga
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSelectFile(f: File | null) {
    if (!f) return;
    
    // Validera fil innan bearbetning
    const fileValidation = validateOcrFile(f);
    if (!fileValidation.valid) {
      setWarning(fileValidation.error || "Ogiltig fil.");
      return;
    }
    
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setFile(f);
    setParsed(null);
    setKind(null);
    setOcrText("");
    setWarning(null);
    setStep("upload");
  }

  async function handleScan() {
    if (!file) return;
    
    // Validera fil igen innan OCR (extra säkerhet)
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

      // === Rollback-beteende: PDF-OCR av är stabilitetsskäl. ===
      if (isPdf) {
        setWarning(
          "PDF-OCR är avstängt i denna version. Ladda upp en bild/foto av intyget i stället."
        );
        setBusy(false);
        return;
      }

      // OCR (bild) — OCR.space ParsedText (utan zon-/Tesseract-fallback)
      const ocrTimeoutMs = 25000; // 25s max
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ocr-timeout")), ocrTimeoutMs)
      );

      const ocrResult = await Promise.race([
        ocrImage(file, "swe+eng"),
        timeout,
      ]);

      const { text, width, height } = ocrResult;
      lastOcrRaw = text || "";

      // Validera bildstorlek/aspect ratio (hjälper användaren ta bättre foto)
      if (width && height) {
        const expectedAspectRatio = 1057 / 1496; // A4-format
        const actualAspectRatio = width / height;
        
        if (Math.abs(actualAspectRatio - expectedAspectRatio) > 0.15) {
          setWarning(
            "Bilden verkar inte ha rätt proportioner. Se till att du fotograferat hela dokumentet rakt ovanifrån för bästa resultat."
          );
        }
      }

      let content = preCleanRawOcr(lastOcrRaw);
      setOcrText(content);


      // Klassning
      let det = detectIntygKind(content);
      let k = det?.kind ?? null;

      const softContent = asciiSoft(content);

      // Hård detektion av SOSFS 2015:8 Bilaga 4 (Klinisk tjänstgöring) om OCR missar sidfoten
      const looksLike2015_B4 =
        softContent.includes("klinisk tjanstgoring under handledning") &&
        softContent.includes("tjanstgoringsstalle och period") &&
        softContent.includes("uppfyllda kompetenskrav");

      if (looksLike2015_B4) {
        k = "2015-B4-KLIN";
        det = { kind: "2015-B4-KLIN" as IntygKind } as any;
      }

      // Korrigera felaktig 2021-klassning om formuläret tydligt är SOSFS 2015:8
      const is2015Form =
        /\bsosfs\s*2015:8\b/.test(softContent) ||
        /\b2015:8\b/.test(softContent);

      if (is2015Form && k && k.startsWith("2021")) {
        switch (k) {
          case "2021-B9-KLIN":
            // Klinisk tjänstgöring – Bilaga 4
            k = "2015-B4-KLIN";
            break;
          case "2021-B8-AUSK":
            // Auskultation – Bilaga 3
            k = "2015-B3-AUSK";
            break;
          case "2021-B10-KURS":
            // Kurs – Bilaga 5
            k = "2015-B5-KURS";
            break;
          case "2021-B11-UTV":
            // Kvalitets-/utvecklingsarbete – Bilaga 6
            k = "2015-B6-UTV";
            break;
          case "2021-B12-STa3":
            // Självständigt skriftligt arbete – Bilaga 7
            k = "2015-B7-SKRIFTLIGT";
            break;
          default:
            break;
        }
        if (det && k) {
          det = { ...det, kind: k as IntygKind };
        }
      }

      setKind(k);

      // Versionkontroll mot profilens målversion (om angiven)
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

      // Typer utan datum
      const noDatesKinds = new Set<IntygKind>([
        "2015-B7-SKRIFTLIGT",
        "2015-B6-UTV",
        "2021-B11-UTV",
      ]);

      // Datum från OCR
      const dates = extractDates(content);

      // Parser via registry (OCR.space ParsedText som källa)
      let p: any = {};
      const parser = getParser(k || undefined);
      
      // Debug: alltid logga, även i production
      console.log('[ScanIntygModal] ====== PARSER ANROP ======');
      console.log('[ScanIntygModal] Detected kind:', k);
      console.log('[ScanIntygModal] Parser function:', parser ? 'FINNS' : 'SAKNAS');
      console.log('[ScanIntygModal] OCR content length:', content.length);
      console.log('[ScanIntygModal] OCR content first 500 chars:', content.substring(0, 500));
      
      if (parser) {
        console.log('[ScanIntygModal] Anropar parser för kind:', k);
        try {
          p = parser(content);
          console.log('[ScanIntygModal] Parser resultat:', JSON.stringify(p, null, 2));
        } catch (error) {
          console.error('[ScanIntygModal] Parser error:', error);
          p = {};
        }
      } else if (k === "2015-B4-KLIN") {
        // Fallback för säkerhets skull om registry saknas
        p = parse_2015_bilaga4(content);
      } else {
        setWarning(
          "Kunde inte identifiera intygsmallen automatiskt. Du kan fylla fälten manuellt."
        );
        p = {};
      }

      // För Bilaga 11: mappa subject till clinic så att "Utvecklingsarbetets ämne" visas korrekt
      if (k === "2021-B11-UTV" && (p as any)?.subject && !(p as any)?.clinic) {
        (p as any).clinic = (p as any).subject;
      }

      // För Bilaga 10: matcha courseTitle mot förbestämda kurser
      if (k === "2021-B10-KURS" && (p as any)?.courseTitle) {
        const courseTitle = (p as any).courseTitle.trim();
        // Lista över alla förbestämda kurser (METIS + övriga)
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
        
        // Matcha courseTitle mot förbestämda kurser (case-insensitive, partial match)
        const matchedCourse = predefinedCourses.find(
          (predefined) => 
            predefined.toLowerCase() === courseTitle.toLowerCase() ||
            courseTitle.toLowerCase().includes(predefined.toLowerCase()) ||
            predefined.toLowerCase().includes(courseTitle.toLowerCase())
        );
        
        if (matchedCourse) {
          // Om matchning hittades, sätt title till den matchade kursen
          // Men behåll courseTitle för att visa i "Kursens titel" om "Annan kurs" väljs
          (p as any).title = matchedCourse;
          // Behåll courseTitle om det skiljer sig från den matchade kursen
          if (matchedCourse.toLowerCase() !== courseTitle.toLowerCase()) {
            (p as any).courseTitle = courseTitle;
          }
        } else {
          // Om ingen matchning hittades, sätt title till "Annan kurs" och behåll courseTitle
          (p as any).title = "Annan kurs";
          (p as any).courseTitle = courseTitle;
        }
      }


      // Endast för mallar med datum
      if (k && !noDatesKinds.has(k)) {
        if (dates.startISO && !p.period?.startISO) {
          p.period = { ...(p.period ?? {}), startISO: dates.startISO };
        }
        if (dates.endISO && !p.period?.endISO) {
          p.period = { ...(p.period ?? {}), endISO: dates.endISO };
        }
      } else {
        // Säkerställ att period inte följer med
        if (p.period) delete p.period;
      }

      // Beskrivnings-bullets
      if (p?.description) p.description = enforceBulletBreaks(p.description);

      // Clinic: ta sista raden, kapa rubrikdelen och flytta ut datum till period
      {
        const clinicRaw = p?.clinic ?? "";
        if (clinicRaw) {
          // Om flera rader finns i fältet: ta den nedersta icke-tomma raden
          const lines = clinicRaw
            .replace(/\r\n?/g, "\n")
            .split("\n")
            .map((l: string) => l.trim())
            .filter(Boolean);

          let working = lines.length > 0 ? lines[lines.length - 1] : "";

          if (working) {
            // 1) Kapa känd rubrikdel på samma rad, t.ex.
            // "Tjänstgöringsställe och period (...) för den kliniska tjänstgöringen Psykos 280113 280415"
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

            if (cutPos >= 0) {
              working = working.slice(cutPos + cutLen).trim();
            }

            // 2) Flytta ut datum via splitClinicAndPeriod (t.ex. "Psykos 280113 280415")
            if (/\d/.test(working)) {
              const split = splitClinicAndPeriod(working);
              if (split.startISO && !p.period?.startISO) {
                p.period = { ...(p.period ?? {}), startISO: split.startISO };
              }
              if (split.endISO && !p.period?.endISO) {
                p.period = { ...(p.period ?? {}), endISO: split.endISO };
              }
              working = split.clean || working;
            }

            // 3) Sista städning: ta bort kvarvarande datum i texten och fyll ev. period
            if (/\d/.test(working)) {
              const d2 = extractDatesFromLine(working);
              if (d2.startISO && !p.period?.startISO) {
                p.period = { ...(p.period ?? {}), startISO: d2.startISO };
              }
              if (d2.endISO && !p.period?.endISO) {
                p.period = { ...(p.period ?? {}), endISO: d2.endISO };
              }
              working = d2.cleaned;
            }

            // 4) Ta bort kvarvarande datumtoken (t.ex. 280113, 20130128, 28.01.13) ur kliniknamnet
            working = working
              // rena 6-siffriga och 8-siffriga tal
              .replace(/\b\d{6}\b/g, " ")
              .replace(/\b\d{8}\b/g, " ")
              // datum med separatorer, t.ex. 28-01-13, 28/01/2013, 28.01.13
              .replace(/\b\d{2}[.\-\/]\d{2}[.\-\/]\d{2,4}\b/g, " ")
              .replace(/\s{2,}/g, " ")
              .trim();

            p.clinic = working.trim();
          }
        }
      }




      setParsed(p);
      setStep("review");
    } catch (e) {
      console.error("[OCR ERROR]", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "ocr-timeout") {
        setWarning("OCR tog för lång tid (timeout). Prova igen med en tydligare bild.");
      } else if (/OCR_SPACE_API_KEY/i.test(msg)) {
        setWarning(
          `OCR.space är inte konfigurerat på servern: ${msg} (lägg in OCR_SPACE_API_KEY i Vercel).`
        );
      } else {
        setWarning(`OCR.space misslyckades: ${msg}`);
      }
    } finally {
      setBusy(false);
    }
  }

  // Funktion för att kontrollera överlappande datum
  async function checkOverlappingDates(): Promise<{ hasOverlap: boolean; overlappingItems: string[] }> {
    const anyDb: any = db as any;
    const overlappingItems: string[] = [];

    // Hämta datum från parsed
    const parsedPeriod = (parsed as any)?.period;
    let startISO: string = (parsedPeriod?.startISO as string | undefined) || "";
    let endISO: string = (parsedPeriod?.endISO as string | undefined) || "";

    // Om inget intervall är angivet, använd certificateDate som punktdatum
    if (!startISO && !endISO) {
      const certRaw = (parsed as any)?.certificateDate || "";
      const certISO = typeof certRaw === "string" && certRaw ? certRaw : "";
      if (certISO) {
        startISO = certISO;
        endISO = certISO;
      }
    }

    // Om bara ena änden finns, spegla den
    if (startISO && !endISO) {
      endISO = startISO;
    } else if (!startISO && endISO) {
      startISO = endISO;
    }

    if (!startISO || !endISO) {
      return { hasOverlap: false, overlappingItems: [] };
    }

    // Hjälpfunktion för att kontrollera om två datumintervall överlappar
    const datesOverlap = (
      start1: string,
      end1: string,
      start2: string,
      end2: string
    ): boolean => {
      return start1 <= end2 && start2 <= end1;
    };

    // Kontrollera kurser
    if (anyDb?.courses?.toArray) {
      const allCourses = await anyDb.courses.toArray();
      for (const course of allCourses) {
        if (!course.showOnTimeline) continue;
        
        const courseStart = course.startDate || course.endDate || course.certificateDate || "";
        const courseEnd = course.endDate || course.startDate || course.certificateDate || "";
        
        if (courseStart && courseEnd && datesOverlap(startISO, endISO, courseStart, courseEnd)) {
          const title = course.title || "Kurs";
          overlappingItems.push(`${title} (${courseStart} - ${courseEnd})`);
        }
      }
    }

    // Kontrollera placeringar
    if (anyDb?.placements?.toArray) {
      const allPlacements = await anyDb.placements.toArray();
      for (const placement of allPlacements) {
        if (!placement.showOnTimeline) continue;
        
        const placementStart = placement.startDate || placement.endDate || placement.certificateDate || "";
        const placementEnd = placement.endDate || placement.startDate || placement.certificateDate || "";
        
        if (placementStart && placementEnd && datesOverlap(startISO, endISO, placementStart, placementEnd)) {
          const type = placement.type || "Placering";
          const clinic = placement.clinic || placement.title || "";
          const label = clinic ? `${type}: ${clinic}` : type;
          overlappingItems.push(`${label} (${placementStart} - ${placementEnd})`);
        }
      }
    }

    return {
      hasOverlap: overlappingItems.length > 0,
      overlappingItems,
    };
  }

  async function handleSave() {
    if (!parsed) return;
    setBusy(true);

    try {
      // För Bilaga 10 och 11: kontrollera att datum är valt
      if (kind === "2021-B10-KURS" || kind === "2021-B11-UTV") {
        const hasStartDate = !!(parsed as any)?.period?.startISO;
        const hasEndDate = !!(parsed as any)?.period?.endISO;
        
        if (!hasStartDate && !hasEndDate) {
          setWarning(
            "Du måste ange datum för placering i tidslinjen innan du kan spara intyget."
          );
          setBusy(false);
          return; // Stoppa sparandet och stäng inte fönstret
        }
      }

      // Kontrollera överlappande datum innan sparandet
      const overlapCheck = await checkOverlappingDates();
      if (overlapCheck.hasOverlap) {
        const itemsList = overlapCheck.overlappingItems.join("\n");
        setWarning(
          `Det finns redan aktiviteter på tidslinjen med överlappande datum:\n\n${itemsList}\n\nVänligen kontrollera datumen innan du sparar.`
        );
        setBusy(false);
        return; // Stoppa sparandet och stäng inte fönstret
      }

      let createdKind: "placement" | "course" | null = null;
      let createdId: string | number | null = null;

      const anyDb: any = db as any;

      // Plocka ut delmålskoder från parsed.delmalCodes (komma-separerat eller array)
      const rawDelmal = Array.isArray((parsed as any)?.delmalCodes)
        ? (parsed as any).delmalCodes
        : typeof (parsed as any)?.delmalCodes === "string"
        ? String((parsed as any).delmalCodes)
            .split(/[,\s;]+/)
            .map((x) => x.trim())
            .filter(Boolean)
        : [];

      const milestoneCodes: string[] = (rawDelmal as string[])
        .map((x) => x.trim())
        .filter(Boolean);

      async function ensurePlacementOnTimeline() {
        if (!anyDb?.placements?.toArray) return;

        const all = await anyDb.placements.toArray();
        if (!all || !all.length) return;

        // Försök först hitta en placering som ännu inte visas i tidslinjen
        const hidden = all.filter((p: any) => !p.showOnTimeline);

        const parsedCert = (parsed as any)?.certificateDate || "";
        const parsedClinic = (parsed as any)?.clinic || "";

        // Enkel scoring för att hitta "rätt" post (den som nyss skapats)
        const scorePlacement = (p: any): number => {
          let s = 0;
          if (!p.showOnTimeline) s += 1;
          if (parsedCert && String(p.certificateDate || "") === parsedCert) s += 4;
          if (
            parsedClinic &&
            typeof p.clinic === "string" &&
            p.clinic === parsedClinic
          ) {
            s += 2;
          }
          return s;
        };

        const candidates = hidden.length > 0 ? hidden : all;
        let last = candidates[0];
        let bestScore = scorePlacement(last);

        for (const p of candidates.slice(1)) {
          const sc = scorePlacement(p);
          if (sc > bestScore) {
            bestScore = sc;
            last = p;
          }
        }

        createdKind = "placement";
        createdId = last.id;

        const extraGoals: any = {};
        if (milestoneCodes.length > 0) {
          extraGoals.milestones = milestoneCodes;
          extraGoals.fulfillsStGoals = true;
        }

        // Härled "Typ" utifrån intygsmallen
        let typeFromKind: string | undefined;
        switch (kind) {
          // Auskultation
          case "2015-B3-AUSK":
          case "2021-B8-AUSK":
            typeFromKind = "Auskultation";
            break;

          // Klinisk tjänstgöring
          case "2015-B4-KLIN":
          case "2021-B9-KLIN":
            typeFromKind = "Klinisk tjänstgöring";
            break;

          // Utvecklings-/förbättringsarbete
          case "2015-B6-UTV":
          case "2021-B11-UTV":
            typeFromKind = "Förbättringsarbete";
            break;

          // Skriftligt / vetenskapligt arbete
          case "2015-B7-SKRIFTLIGT":
          case "2021-B12-STa3":
            typeFromKind = "Vetenskapligt arbete";
            break;

          default:
            typeFromKind = last.type;
        }

        // Utgå från datumen i modalen (parsed.period)
        const parsedPeriod = (parsed as any)?.period;
        let startISO: string =
          (parsedPeriod?.startISO as string | undefined) || "";
        let endISO: string =
          (parsedPeriod?.endISO as string | undefined) || "";

        // Om inget intervall är angivet i modalen – använd intygsdatum som punktdatum
        const certRaw =
          (parsed as any)?.certificateDate ||
          (last as any).certificateDate ||
          "";
        const certISO =
          typeof certRaw === "string" && certRaw ? certRaw : "";

        if (!startISO && !endISO && certISO) {
          startISO = certISO;
          endISO = certISO;
        }

        // Om bara ena änden finns, spegla den
        if (startISO && !endISO) {
          endISO = startISO;
        } else if (!startISO && endISO) {
          startISO = endISO;
        }

        // Sista fallback om något fortfarande saknas: ta ev. befintliga datum på posten
        if (!startISO) {
          startISO =
            (last as any).startDate ||
            (last as any).endDate ||
            (last as any).certificateDate ||
            "";
        }
        if (!endISO) {
          endISO =
            (last as any).endDate ||
            (last as any).startDate ||
            (last as any).certificateDate ||
            "";
        }

        try {
          await anyDb.placements.update(last.id, {
            showOnTimeline: true,
            type: typeFromKind || last.type || "",
            clinic: parsed?.clinic ?? last.clinic ?? "",
            supervisor: parsed?.supervisorName ?? last.supervisor ?? "",
            supervisorSpeciality:
              parsed?.supervisorSpeciality ?? last.supervisorSpeciality ?? "",
            supervisorSite:
              parsed?.supervisorSite ?? last.supervisorSite ?? "",
            startDate: startISO,
            endDate: endISO,
            note:
              parsed?.description ??
              (parsed as any)?.notes ??
              last.note ??
              "",
            ...extraGoals,
          });
        } catch {
          // tyst fel – vi har åtminstone posten sparad
        }
      }

      async function ensureCourseOnTimeline() {
        if (!anyDb?.courses?.toArray) return;
        const all = await anyDb.courses.toArray();
        if (!all || !all.length) return;

        const parsedCert = (parsed as any)?.certificateDate || "";
        const parsedTitleRaw =
          ((parsed as any)?.title || (parsed as any)?.courseTitle || (parsed as any)?.subject || "").trim();

        // Försök först hitta en kurs som ännu inte visas i tidslinjen
        const hidden = all.filter((c: any) => !c.showOnTimeline);

        const scoreCourse = (c: any): number => {
          let s = 0;
          if (!c.showOnTimeline) s += 1;
          if (parsedCert && String(c.certificateDate || "") === parsedCert) s += 4;
          if (
            parsedTitleRaw &&
            typeof c.title === "string" &&
            c.title.trim() === parsedTitleRaw
          ) {
            s += 2;
          }
          return s;
        };

        // Prioritera:
        // 1) Kurser som inte visas i tidslinjen
        // 2) Med samma intygsdatum som det tolkade intyget
        let candidates = hidden.length > 0 ? hidden : all;
        const certMatches = parsedCert
          ? candidates.filter(
              (c: any) => String(c.certificateDate || "") === parsedCert
            )
          : [];
        if (certMatches.length > 0) {
          candidates = certMatches;
        }

        let last = candidates[0];
        let bestScore = scoreCourse(last);

        for (const c of candidates.slice(1)) {
          const sc = scoreCourse(c);
          if (sc > bestScore) {
            bestScore = sc;
            last = c;
          }
        }


        createdKind = "course";
        createdId = last.id;

        const extraGoals: any = {};
        if (milestoneCodes.length > 0) {
          extraGoals.milestones = milestoneCodes;
          extraGoals.fulfillsStGoals = true;
        }

        // För 2015: matcha kursens titel mot förinställda kurser
        let finalTitle = parsedTitleRaw || last.title || "";
        let finalCourseTitle = "";
        
        if (goalsVersion === "2015" && parsedTitleRaw) {
          // Lista över alla förinställda kurser (METIS + övriga)
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
          
          // Normalisera för jämförelse (ta bort diakritiska tecken, gör små bokstäver)
          const normalize = (s: string) => s
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
          
          const normalizedParsed = normalize(parsedTitleRaw);
          
          // Hitta match (exakt match eller delvis match)
          const exactMatch = predefinedCourses.find(c => normalize(c) === normalizedParsed);
          const partialMatch = predefinedCourses.find(c => 
            normalize(c).includes(normalizedParsed) || normalizedParsed.includes(normalize(c))
          );
          
          if (exactMatch) {
            finalTitle = exactMatch;
          } else if (partialMatch) {
            finalTitle = partialMatch;
          } else {
            // Ingen match → välj "Annan kurs" och spara titeln i courseTitle
            finalTitle = "Annan kurs";
            finalCourseTitle = parsedTitleRaw;
          }
        }
        
        try {
          await anyDb.courses.update(last.id, {
            showOnTimeline: true,
            title: finalTitle,
            courseTitle: finalCourseTitle || (last as any)?.courseTitle || undefined,
            site:
              (parsed as any)?.clinic ??
              (last as any).site ??
              (last as any).clinic ??
              "",
            startDate:
              (parsed as any)?.period?.startISO ??
              last.startDate ??
              last.endDate ??
              last.certificateDate ??
              "",
            endDate:
              (parsed as any)?.period?.endISO ??
              last.endDate ??
              last.startDate ??
              last.certificateDate ??
              "",
            certificateDate:
              (parsed as any)?.certificateDate ??
              (parsed as any)?.period?.endISO ??
              last.certificateDate ??
              last.endDate ??
              last.startDate ??
              "",
            note:
              (parsed as any)?.description ??
              (parsed as any)?.notes ??
              last.note ??
              "",
            // För 2021: spara signingRole och relaterade fält
            signingRole: (parsed as any)?.signingRole ?? (last as any).signingRole ?? undefined,
            supervisorName: (parsed as any)?.supervisorName ?? (last as any).supervisorName ?? undefined,
            supervisorSite: (parsed as any)?.supervisorSite ?? (last as any).supervisorSite ?? undefined,
            supervisorSpeciality: (parsed as any)?.supervisorSpeciality ?? (parsed as any)?.supervisorSpeciality ?? (last as any).supervisorSpeciality ?? undefined,
            // För kompatibilitet: spara även som courseLeader-fält
            courseLeaderName:
              (parsed as any)?.supervisorName ??
              (last as any).courseLeaderName ??
              "",
            courseLeaderSpeciality:
              (parsed as any)?.supervisorSpeciality ??
              (last as any).courseLeaderSpeciality ??
              "",
            courseLeaderSite:
              (parsed as any)?.supervisorSite ??
              (last as any).courseLeaderSite ??
              "",
            ...extraGoals,
          });
        } catch {
          // tyst fel
        }
      }


      switch (kind) {
        // 2021 – kurs
        case "2021-B10-KURS":
          await mapAndSaveKurs({
            ...parsed,
            showOnTimeline: !!(parsed as any)?.showOnTimeline,
            showAsInterval: !!(parsed as any)?.showAsInterval,
          });
          await ensureCourseOnTimeline();
          break;

        // 2015 – kurs
        case "2015-B5-KURS":
          await mapAndSaveKurs(parsed);
          await ensureCourseOnTimeline();
          break;

        // 2021 – utvecklingsarbete (Bilaga 11)
        case "2021-B11-UTV":
          // Mappa subject till clinic för att spara "Utvecklingsarbetets ämne"
          await mapAndSavePlacement2015({
            ...parsed,
            clinic: (parsed as any)?.subject || (parsed as any)?.clinic,
          });
          await ensurePlacementOnTimeline();
          break;

        // 2021 – auskultation (Bilaga 8)
        case "2021-B8-AUSK":
          await mapAndSavePlacement2015(parsed);
          await ensurePlacementOnTimeline();
          break;

        // 2021 – klinisk tjänstgöring (Bilaga 9)
        case "2021-B9-KLIN":
          await mapAndSavePlacement2015(parsed);
          await ensurePlacementOnTimeline();
          break;

        // 2015 – klinisk tjänstgöring / auskultation / utvecklings- och skriftligt arbete
        case "2015-B3-AUSK":
        case "2015-B4-KLIN":
        case "2015-B6-UTV":
        case "2015-B7-SKRIFTLIGT":
          await mapAndSavePlacement2015(parsed);
          await ensurePlacementOnTimeline();
          break;

        default:
          setWarning(
            "Sparfunktion saknas för vald intygsmall i denna version."
          );
          setBusy(false);
          return;
      }

      // Trigga tidslinje-sync så att blocket dyker upp i PusslaDinST
      try {
        if (typeof window !== "undefined") {
          try {
            window.localStorage?.setItem(
              "timeline_sync",
              String(Date.now())
            );
          } catch {
            // ignore
          }
          try {
            window.dispatchEvent(new Event("timeline_sync"));
          } catch {
            // ignore
          }

          // Signalera vilken post som ska väljas i tidslinjen
          if (createdKind && createdId != null) {
            try {
              window.dispatchEvent(
                new CustomEvent("timeline_select_from_scan", {
                  detail: {
                    kind: createdKind,
                    dbId: createdId,
                  },
                })
              );
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore helt om något går fel här
      }

      onSaved?.();
      handleClose();
    } finally {
      setBusy(false);
    }
  }

  function removeFile() {
    if (!file) return;
    const ok = confirm("Vill du ta bort vald bild?");
    if (!ok) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    setParsed(null);
    setKind(null);
    setOcrText("");
  }

  const fileChosen = Boolean(file);
  const canScan = fileChosen && !busy;

  const baseMeta = labelsFor(kind);
  let titleLabel = baseMeta.title;
  let clinicLabel = baseMeta.clinicLabel;
  let descriptionLabel = baseMeta.descriptionLabel;

  // Justera rubriker beroende på intygsmall
  switch (kind) {
    // SOSFS 2015:8 – Bilaga 3 (Auskultation)
    case "2015-B3-AUSK":
      if (!titleLabel) titleLabel = "Auskultation";
      clinicLabel = "Tjänstgöringsställe för auskultationen";
      descriptionLabel = "Beskrivning av auskultationen";
      break;

    // SOSFS 2015:8 – Bilaga 4 (Klinisk tjänstgöring)
    case "2015-B4-KLIN":
      if (!titleLabel)
        titleLabel = "Klinisk tjänstgöring under handledning";
      clinicLabel = "Tjänstgöringsställe för den kliniska tjänstgöringen";
      descriptionLabel = "Beskrivning av den kliniska tjänstgöringen";
      break;

    // SOSFS 2015:8 – Bilaga 5 (Kurs)
    case "2015-B5-KURS":
      titleLabel = "Kursens ämne (rubrikform)";
      clinicLabel = ""; // Ingen plats för 2015 kurser
      descriptionLabel = "Beskrivning av kursen";
      break;

    // SOSFS 2015:8 – Bilaga 6 (Kvalitets- och utvecklingsarbete)
    case "2015-B6-UTV":
      titleLabel = "Kvalitets- och utvecklingsarbete";
      clinicLabel = "Ämne";
      descriptionLabel =
        "Beskrivning av kvalitets- och utvecklingsarbetet";
      break;

    // SOSFS 2015:8 – Bilaga 7 (Självständigt skriftligt arbete)
    case "2015-B7-SKRIFTLIGT":
      titleLabel = "Självständigt skriftligt arbete enligt vetenskapliga principer";
      clinicLabel = "Ämne";
      descriptionLabel =
        "Beskrivning av det självständiga skriftliga arbetet";
      break;

    // HSLF-FS 2021:8 – Bilaga 8 (Auskultation)
    case "2021-B8-AUSK":
      if (!titleLabel) titleLabel = "Auskultation";
      clinicLabel = "Tjänstgöringsställe för auskultationen";
      descriptionLabel = "Beskrivning av auskultationen";
      break;

    // HSLF-FS 2021:8 – Bilaga 9 (Klinisk tjänstgöring)
    case "2021-B9-KLIN":
      if (!titleLabel)
        titleLabel = "Klinisk tjänstgöring under handledning";
      clinicLabel = "Tjänstgöringsställe för den kliniska tjänstgöringen";
      descriptionLabel = "Beskrivning av den kliniska tjänstgöringen";
      break;

    // HSLF-FS 2021:8 – Bilaga 10 (Kurs)
    case "2021-B10-KURS":
      titleLabel = "Kursens ämne (rubrikform)";
      clinicLabel = ""; // Ingen plats för 2021 kurser
      descriptionLabel = "Beskrivning av kursen";
      break;

    // HSLF-FS 2021:8 – Bilaga 11 (Utvecklingsarbete)
    case "2021-B11-UTV":
      titleLabel = "Utvecklingsarbetets ämne (rubrikform)";
      clinicLabel = "Utvecklingsarbetets ämne";
      descriptionLabel =
        "Beskrivning av ST-läkarens deltagande i utvecklingsarbetet";
      break;

    // HSLF-FS 2021:8 – Bilaga 12 (STa3 – medicinsk vetenskap)
    case "2021-B12-STa3":
      titleLabel = "Delmål STa3 – medicinsk vetenskap";
      clinicLabel = "Utbildningsaktiviteter (rubrik/ämne)";
      descriptionLabel = "Samlad beskrivning av det vetenskapliga arbetet";
      break;

    // HSLF-FS 2021:8 – Bilaga 13 (tredjeland)
    case "2021-B13-TREDJELAND":
      titleLabel = "Delmål för specialistläkare från tredjeland";
      clinicLabel = "Utbildningsaktiviteter (rubrik/ämne)";
      descriptionLabel = "Beskrivning av utbildningsaktiviteterna";
      break;
  }

  const isNoDates = !kindHasDates(kind);
  const isCourseKind =
    kind === "2015-B5-KURS" || kind === "2021-B10-KURS";

  const previewTitle =
    isCourseKind ? "Kurs" : titleLabel || "";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="m-0 text-lg font-extrabold">Skanna intyg</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTipsOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
            >
              Tips för bästa resultat
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
            >
              Stäng
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
            {warning && (
              <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-semibold mb-2">Varning:</div>
                <div className="whitespace-pre-line">{warning}</div>
              </div>
            )}

            {/* --- UPLOAD --- */}
            {step === "upload" && (
              <div className="space-y-4">
                {/* Input */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) =>
                    onSelectFile(e.target.files?.[0] ?? null)
                  }
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    onSelectFile(e.target.files?.[0] ?? null)
                  }
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px md:hidden"
                  >
                    Fota intyg
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
                  >
                    Ladda upp bild
                  </button>

                  {previewUrl ? (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-sky-700 underline hover:text-sky-800"
                    >
                      {file?.name ?? "Visa bild"}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-600">
                      Ingen fil vald
                    </span>
                  )}

                  {file && (
                    <button
                      type="button"
                      onClick={removeFile}
                      title="Ta bort"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:translate-y-px"
                    >
                      🗑️
                    </button>
                  )}

                  <div className="ml-auto">
                    <button
                      type="button"
                      onClick={handleScan}
                      disabled={!canScan}
                      className="inline-flex items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy ? "Skannar…" : "Skanna"}
                    </button>
                  </div>
                </div>

                {/* Info om OCR-tjänst */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="m-0">
                    Bilden skickas till OCR-tjänsten{" "}
                    <a
                      href="https://ocr.space"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-700 underline hover:text-sky-800"
                    >
                      ocr.space
                    </a>{" "}
                    för textigenkänning.{" "}
                    <button
                      type="button"
                      onClick={() => setGdprModalOpen(true)}
                      className="text-slate-700 inline"
                    >
                      <span className="text-sky-700 underline hover:text-sky-800 cursor-pointer">Läs mer</span> om GDPR vid användning av tredje parts uppgifter
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* --- REVIEW --- */}
            {step === "review" && (
              <div className="space-y-4">
                <div className="text-base font-semibold text-slate-900">
                  {kind === "2021-B11-UTV"
                    ? "Förhandsgranskning - Utvecklingsarbete"
                    : kind === "2021-B10-KURS" && parsed?.courseTitle
                    ? `Förhandsgranskning – ${parsed.courseTitle}`
                    : kind === "2015-B5-KURS" && parsed?.subject
                    ? `Förhandsgranskning – Kurs: ${parsed.subject}`
                    : titleLabel
                    ? `Förhandsgranskning – ${titleLabel}`
                    : "Förhandsgranskning"}
                </div>

                <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                  {/* Rad 1: Namn | Personnummer */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-900">Namn</label>
                      <input
                        value={parsed?.fullName ?? ""}
                        onChange={(e) =>
                          setParsed((p: any) => ({
                            ...p,
                            fullName: e.target.value,
                          }))
                        }
                        className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-900">
                        Personnummer
                      </label>
                      <input
                        value={parsed?.personnummer ?? ""}
                        onChange={(e) =>
                          setParsed((p: any) => ({
                            ...p,
                            personnummer: e.target.value,
                          }))
                        }
                        className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                      />
                    </div>
                  </div>

                  {/* Rad 2: Specialitet + Tjänstgöringsställe */}
                  <div className={`grid grid-cols-1 gap-3 ${clinicLabel ? "md:grid-cols-2" : ""}`}>
                    <div className="space-y-2">
                      <label className="block text-xs fonDt-medium text-slate-900">
                        Specialitet som ansökan avser
                      </label>
                      <input
                        value={parsed?.specialtyHeader?.trim() ?? ""}
                        onChange={(e) =>
                          setParsed((p: any) => ({
                            ...p,
                            specialtyHeader: e.target.value.trim() || undefined,
                          }))
                        }
                        className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                      />
                    </div>
                    {clinicLabel && (
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-900">
                          {clinicLabel}
                        </label>
                        <input
                          value={parsed?.clinic ?? ""}
                          onChange={(e) =>
                            setParsed((p: any) => ({
                              ...p,
                              clinic: e.target.value,
                            }))
                          }
                          className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                        />
                      </div>
                    )}
                  </div>

                  {/* Rad 3: Delmål */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-900">
                      Delmål (komma-separerade)
                    </label>
                    <input
                      value={(parsed?.delmalCodes ?? []).join(", ")}
                      onChange={(e) =>
                        setParsed((p: any) => ({
                          ...p,
                          delmalCodes: e.target.value
                            .split(",")
                            .map((x: string) => x.trim())
                            .filter(Boolean),
                        }))
                      }
                      className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                    />
                  </div>

                  {/* Rad 4: Start / Slut (eller för 2021 kurser: kryssruta + conditional date pickers) */}
                  {!isNoDates && kind !== "2021-B10-KURS" && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <CalendarDatePicker
                          label="Start"
                          value={parsed?.period?.startISO ?? ""}
                          onChange={(iso) =>
                            setParsed((p: any) => {
                              const currentEnd = p?.period?.endISO || "";
                              // Om slutdatum är tidigare än startdatum, sätt det till samma som startdatum
                              const newEnd = iso && currentEnd && currentEnd < iso ? iso : currentEnd;
                              return {
                                ...p,
                                period: {
                                  ...(p?.period ?? {}),
                                  startISO: iso,
                                  endISO: newEnd || p?.period?.endISO,
                                },
                              };
                            })
                          }
                          align="left"
                        />
                      </div>
                      <div>
                        <CalendarDatePicker
                          label="Slut"
                          value={parsed?.period?.endISO ?? ""}
                          minDate={parsed?.period?.startISO || undefined}
                          onChange={(iso) =>
                            setParsed((p: any) => ({
                              ...p,
                              period: {
                                ...(p?.period ?? {}),
                                endISO: iso,
                              },
                            }))
                          }
                          align="right"
                        />
                      </div>
                    </div>
                  )}
                  {/* För 2021 kurser: alltid visa date pickers */}
                  {kind === "2021-B10-KURS" && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-900">
                        Ange datum för placering i Tidslinjen
                      </label>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <CalendarDatePicker
                            label="Start"
                            value={parsed?.period?.startISO ?? ""}
                            onChange={(iso) =>
                              setParsed((p: any) => {
                                const currentEnd = p?.period?.endISO || "";
                                // Om slutdatum är tidigare än startdatum, sätt det till samma som startdatum
                                const newEnd = iso && currentEnd && currentEnd < iso ? iso : currentEnd;
                                return {
                                  ...p,
                                  period: {
                                    ...(p?.period ?? {}),
                                    startISO: iso,
                                    endISO: newEnd || p?.period?.endISO,
                                  },
                                  showOnTimeline: true,
                                };
                              })
                            }
                            align="left"
                          />
                        </div>
                        <div>
                          <CalendarDatePicker
                            label="Slut"
                            value={parsed?.period?.endISO ?? ""}
                            minDate={parsed?.period?.startISO || undefined}
                            onChange={(iso) =>
                              setParsed((p: any) => ({
                                ...p,
                                period: {
                                  ...(p?.period ?? {}),
                                  endISO: iso,
                                },
                                showOnTimeline: true,
                              }))
                            }
                            align="right"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-900 mb-1">
                            Visa i tidslinjen
                          </label>
                          <select
                            value={(parsed as any)?.showAsInterval ? "interval" : "date"}
                            onChange={(e) =>
                              setParsed((p: any) => ({
                                ...p,
                                showAsInterval: e.target.value === "interval",
                              }))
                            }
                            className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                          >
                            <option value="date">Enbart slutdatum</option>
                            <option value="interval">Start till slut</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* För 2021 utvecklingsarbete: alltid visa date pickers */}
                  {(kind === "2021-B11-UTV" || kind === "2015-B6-UTV" || kind === "2015-B7-SKRIFTLIGT") && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-900">
                        Ange datum för placering i Tidslinjen
                      </label>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <CalendarDatePicker
                            label="Start"
                            value={parsed?.period?.startISO ?? ""}
                            onChange={(iso) =>
                              setParsed((p: any) => {
                                const currentEnd = p?.period?.endISO || "";
                                // Om slutdatum är tidigare än startdatum, sätt det till samma som startdatum
                                const newEnd = iso && currentEnd && currentEnd < iso ? iso : currentEnd;
                                return {
                                  ...p,
                                  period: {
                                    ...(p?.period ?? {}),
                                    startISO: iso,
                                    endISO: newEnd || p?.period?.endISO,
                                  },
                                  showOnTimeline: true,
                                };
                              })
                            }
                            align="left"
                          />
                        </div>
                        <div>
                          <CalendarDatePicker
                            label="Slut"
                            value={parsed?.period?.endISO ?? ""}
                            minDate={parsed?.period?.startISO || undefined}
                            onChange={(iso) =>
                              setParsed((p: any) => ({
                                ...p,
                                period: {
                                  ...(p?.period ?? {}),
                                  endISO: iso,
                                },
                                showOnTimeline: true,
                              }))
                            }
                            align="right"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rad 5: Beskrivning */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-900">
                      {descriptionLabel}
                    </label>
                    <textarea
                      value={parsed?.description ?? ""}
                      onChange={(e) =>
                        setParsed((p: any) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      rows={4}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 whitespace-pre-wrap"
                    />
                  </div>

                  {/* Rad 6: Handledare / Kursledare mm */}
                  {isCourseKind ? (
                    <div className="grid grid-cols-1 gap-3">
                      {/* Kursledare fält - bara för 2015-B5-KURS */}
                      {kind === "2015-B5-KURS" && (
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-slate-900">
                            Kursledare
                          </label>
                          <input
                            value={(parsed as any)?.courseLeader ?? ""}
                            onChange={(e) =>
                              setParsed((p: any) => ({
                                ...p,
                                courseLeader: e.target.value,
                              }))
                            }
                            className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-900">
                          Intygande
                        </label>
                        <div className="mt-1 flex flex-wrap gap-4">
                          <label className="inline-flex items-center gap-1 text-sm text-slate-800">
                            <input
                              type="radio"
                              className="h-4 w-4.5"
                              checked={
                                (parsed?.signingRole ?? "handledare") ===
                                "kursledare"
                              }
                              onChange={() =>
                                setParsed((p: any) => ({
                                  ...p,
                                  signingRole: "kursledare",
                                }))
                              }
                            />
                            <span>Kursledare</span>
                          </label>
                          <label className="inline-flex items-center gap-1 text-sm text-slate-800">
                            <input
                              type="radio"
                              className="h-4 w-4.5"
                              checked={
                                (parsed?.signingRole ?? "handledare") ===
                                "handledare"
                              }
                              onChange={() =>
                                setParsed((p: any) => ({
                                  ...p,
                                  signingRole: "handledare",
                                }))
                              }
                            />
                            <span>Handledare</span>
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-900">
                          Intygandes namn
                        </label>
                        <input
                          value={parsed?.supervisorName ?? ""}
                          onChange={(e) =>
                            setParsed((p: any) => ({
                              ...p,
                              supervisorName: e.target.value,
                            }))
                          }
                          className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                        />
                      </div>
                      {/* Specialitet (gäller endast handledare) - visa endast när Handledare är valt för 2021-B10-KURS */}
                      {(kind !== "2021-B10-KURS" || (parsed?.signingRole ?? "handledare") === "handledare") && (
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-slate-900">
                            Intygandes specialitet
                          </label>
                          <input
                            value={parsed?.supervisorSpeciality ?? ""}
                            onChange={(e) =>
                              setParsed((p: any) => ({
                                ...p,
                                supervisorSpeciality: e.target.value,
                              }))
                            }
                            className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                          />
                        </div>
                      )}
                      {/* Tjänsteställe - alltid synligt för 2021-B10-KURS (bara specialitet döljs vid kursledare) */}
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-900">
                          {kind === "2021-B10-KURS" ? "Tjänsteställe" : "Intygandes tjänsteställe"}
                        </label>
                        <input
                          value={parsed?.supervisorSite ?? ""}
                          onChange={(e) =>
                            setParsed((p: any) => ({
                              ...p,
                              supervisorSite: e.target.value,
                            }))
                          }
                          className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-900">
                          Handledare
                        </label>
                        <input
                          value={parsed?.supervisorName ?? ""}
                          onChange={(e) =>
                            setParsed((p: any) => ({
                              ...p,
                              supervisorName: e.target.value,
                            }))
                          }
                          className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-900">
                          Handledares specialitet
                        </label>
                        <input
                          value={parsed?.supervisorSpeciality ?? ""}
                          onChange={(e) =>
                            setParsed((p: any) => ({
                              ...p,
                              supervisorSpeciality: e.target.value,
                            }))
                          }
                          className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-900">
                          Handledares tjänsteställe
                        </label>
                        <input
                          value={parsed?.supervisorSite ?? ""}
                          onChange={(e) =>
                            setParsed((p: any) => ({
                              ...p,
                              supervisorSite: e.target.value,
                            }))
                          }
                          className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                        />
                      </div>
                    </div>
                  )}

                </div>

              </div>
            )}
        </div>

        {step === "review" && (
          <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                className="text-sm text-sky-700 underline hover:text-sky-800"
                    >
                      {file?.name ?? "Visa bild"}
                    </a>
                  )}
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !parsed}
              className="inline-flex items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Sparar…" : "Spara"}
            </button>
          </footer>
        )}
      </div>

      {/* Tips popup */}
      {tipsOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setTipsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="m-0 text-lg font-semibold text-slate-900">Tips för bästa resultat</h3>
              <button
                type="button"
                onClick={() => setTipsOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
              >
                Stäng
              </button>
            </header>
            <div className="p-6">
              <div className="text-sm text-slate-900">
                <ul className="list-disc list-inside space-y-2">
                  <li>Allra bäst resultat får du vid skanning av dokumentet</li>
                  <li>Om du fotograferar: håll kameran rakt ovanför dokumentet, undvik vinkling</li>
                  <li>Se till att hela dokumentet syns i bilden och beskär så att endast dokumentet syns</li>
                  <li>Fotografera i gott ljus, helst dagsljus eller stark belysning och undvik skuggor och reflektioner</li>
                  <li>Fokusera tydligt – texten ska vara skarp och läsbar</li>
                  <li>Titta igenom resultatet noggrant, det finns risk för fel</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GDPR modal för tredje parts uppgifter */}
      {gdprModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setGdprModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="m-0 text-lg font-semibold text-slate-900">GDPR – Tredje parts personuppgifter</h3>
              <button
                type="button"
                onClick={() => setGdprModalOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
              >
                Stäng
              </button>
            </header>
            <div className="p-6">
              <div className="text-xs text-slate-900 space-y-3">
                <p>
                  Intygen kan innehålla personuppgifter om andra personer, till exempel handledare eller kursledare (namn, specialitet, tjänsteställe).
                </p>
                <p>
                  När du skickar dokumentet till OCR-tjänsten för textigenkänning överförs även dessa personuppgifter till{" "}
                  <a
                    href="https://ocr.space"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 underline hover:text-sky-800"
                  >
                    ocr.space
                  </a>
                  .
                </p>
                <p>
                  Enligt GDPR är du ansvarig för att du har rätt att behandla personuppgifter om andra personer. Genom att använda OCR-funktionen bekräftar du att du har rätt att skicka dokumentet som innehåller dessa uppgifter.
                </p>
                <p>
                  OCR.space raderar alla dokument direkt efter bearbetning och lagrar inga personuppgifter.{" "}
                  <a
                    href="https://ocr.space/privacypolicy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 underline hover:text-sky-800"
                  >
                    Läs mer om hur OCR.space hanterar uppgifter
                  </a>
                  .
                </p>
                <p className="mt-4 pt-3 border-t border-slate-200">
                  <a
                    href="https://www.imy.se/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-700 underline hover:text-sky-800"
                  >
                    Läs mer om GDPR på Integritetsskyddsmyndighetens webbplats
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------- Hjälpfunktioner (rollback: enkla & stabila) ------------------- */

function preCleanRawOcr(s: string) {
  if (!s) return "";
  let out = s;

  // Normalisera radslut, ta bort kontrolltecken
  out = out.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ");

  // Lätta städningar, men bevara å/ä/ö
  out = out.replace(/[|【】\[\]<>]/g, " ");
  out = out.replace(
    /[{}©@£$∞§≈±´`+·•†‡°^~“”"‘’'_#®™✓✔︎=]+/g,
    " "
  );

  // Bryt före "- Versal"
  out = out.replace(/[-–—]\s*([A-ZÅÄÖ])/g, "\n- $1");

  // Komprimera mellanslag men bevara \n
  out = out
    .split("\n")
    .map((l) => l.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  // Enkel é/è/ê → å/ä/ö-heuristik
  out = out
    .replace(
      /[ÉÈÊéèê]([bcdfghjklmnpqrstvwxz])/gi,
      (_m, p1) => "ä" + p1
    )
    .replace(
      /([aeiouyåäö])([ÉÈÊéèê])/gi,
      (_m, p1) => p1 + "ö"
    )
    .replace(
      /([fFmMsStT])([ÉÈÊéèê])/g,
      (_m, p1) => p1 + "å"
    )
    .replace(/[ÉÈÊéèê]/g, "ä");

  return out.trim();
}

function enforceBulletBreaks(s: string) {
  if (!s) return s;
  // Endast normalisera radbrytningar och städa, utan att lägga till nya punkter
  let out = s;

  // Normalisera radslut
  out = out.replace(/\r\n?/g, "\n");

  // Ta bort horisontellt whitespace precis före radslut
  out = out.replace(/[ \t]+\n/g, "\n");

  // Komprimera 3+ tomrader till max 1 tomrad
  out = out.replace(/\n{3,}/g, "\n\n");

  // Trimma högermarginal per rad men behåll radbrytningar
  out = out
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");

  // Sluttrim av hela blocket
  return out.trim();
}

function asciiSoft(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-–—]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

// === B7: kända rubriker/etiketter att bannlysa från fält ===
const B7_HEADINGS = new Set<string>([
  "självständigt skriftligt arbete enligt vetenskapliga principer",
  "intyg",
  "om genomförd utbildningsaktivitet och uppfyllda kompetenskrav",
  "självständigt skriftligt arbete",
  "sökande",
  "efternamn",
  "förnamn",
  "personnummer",
  "specialitet som ansökan avser",
  "delmål som intyget avser",
  "delmål som intyget avser tex a1 b1 c1",
  "ämne för självständigt skriftligt arbete",
  "ämne för självständigt skriftligt arbete i rubrikform",
  "beskrivning av det självständiga skriftliga arbetet",
  "intygande",
  "handledare",
  "specialitet",
  "tjänsteställe",
  "tjanstestalle",
  "ort och datum",
  "namnförtydligande",
  "namnfortydligande",
  "namnteckning",
  "bilaga nr",
]);

function isB7HeadingLine(line: string): boolean {
  const s = asciiSoft(line).replace(/[:.]/g, "").trim();
  if (!s) return false;
  if (B7_HEADINGS.has(s)) return true;
  // startsWith-varianter (lite tolerant för OCR)
  if (s.startsWith("delmål som intyget avser")) return true;
  if (s.startsWith("amne for sjalvstandigt skriftligt arbete")) return true;
  if (
    s.startsWith(
      "beskrivning av det sjalvstandiga skriftliga arbetet"
    )
  )
    return true;
  return false;
}

function isHeadingLikeValue(soft: string): boolean {
  if (!soft) return false;

  const tokens = soft.split(/\s+/).filter(Boolean);
  // tillåt lite fler ord, t.ex. "tjänsteställe ort och datum"
  if (!tokens.length || tokens.length > 6) return false;

  const headingTokens = new Set<string>([
    "kurs",
    "sokande",
    "sökande",
    "namn",
    "specialitet",
    "tjanstestalle",
    "tjanststalle",
    "tjänsteställe",
    "tianstestalle",
    "ort",
    "och",
    "datum",
  ]);

  // rubrikrad om alla ord är rubrik-liknande (inkl “ort och datum”)
  if (tokens.every((t) => headingTokens.has(t))) {
    return true;
  }

  return false;
}



function cleanFieldValue(s: string) {
  const cut = s.split(/\r?\n|\|/)[0];
  const cleaned = cut
    .replace(/^\s*(f[öo]rnamn|efternamn)\s*[:\-]?\s*/i, "")
    .trim();

  const soft = asciiSoft(cleaned);
  if (isHeadingLikeValue(soft)) {
    return "";
  }

  return cleaned;
}


function firstWordOnly(s?: string) {
  if (!s) return s;
  const m = s.trim().match(/^[A-Za-zÅÄÖåäö\-]+/);
  return m ? m[0] : s.trim();
}

function tidyOneLine(s: string) {
  return s
    .replace(/\s+\|/g, " ")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,:;\-–—]+/, "")
    .trim();
}

function extractDatesFromLine(line: string) {
  let cleaned = line;
  let startISO: string | null = null;
  let endISO: string | null = null;

  // Specialfall: "27/1 - 2025" eller "27.1 - 25" → enstaka datum
  const singleWeird = cleaned.match(
    /(\d{1,2})[\/.\-](\d{1,2})\s*[-–—]\s*(\d{2,4})/
  );
  if (singleWeird) {
    let [, d, m, y] = singleWeird;
    if (d.length === 1) d = `0${d}`;
    if (m.length === 1) m = `0${m}`;
    const yearNum = parseInt(y, 10);
    const year =
      y.length === 2 ? (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum) : yearNum;
    startISO = `${year}-${m}-${d}`;
    cleaned = cleaned
      .replace(singleWeird[0], " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return { startISO, endISO, cleaned };
  }

  // Generell token-baserad extraktion av datumliknande bitar
  const tokens = cleaned.match(/[\d./\-]+/g) ?? [];
  const dates: { iso: string; raw: string }[] = [];

  for (const tok of tokens) {
    const iso = normalizeDateGuess(tok);
    if (iso) {
      dates.push({ iso, raw: tok });
    }
  }

  if (dates.length > 0) {
    startISO = dates[0].iso;
    if (dates.length > 1) {
      endISO = dates[1].iso;
    }

    for (const d of dates) {
      cleaned = cleaned.replace(d.raw, " ");
    }

    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
    return { startISO, endISO, cleaned };
  }

  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return { startISO, endISO, cleaned };
}

function ymdToISO(s: string) {
  const m = s.match(
    /(\d{4})[.\-\/ ]?(\d{2})[.\-\/ ]?(\d{2})/
  );
  if (!m) return null;
  const [_, Y, M, D] = m;
  return `${Y}-${M}-${D}`;
}

function sixDigitToISO(s: string) {
  const m = s.match(/(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, yy, mm, dd] = m;
  const yearNum = parseInt(yy, 10);
  const year = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
  return `${year}-${mm}-${dd}`;
}

function normalizeDateGuess(s: string): string | null {
  const value = s.trim();
  if (!value) return null;

  // yyyy-mm-dd, yyyy.mm.dd, yyyy/mm/dd eller "yyyy mm dd" (år-månad-dag)
  let m = value.match(/^(\d{4})[.\-\/ ]?(\d{1,2})[.\-\/ ]?(\d{1,2})$/);
  if (m) {
    const [, Y, Mraw, Draw] = m;
    const M = Mraw.padStart(2, "0");
    const D = Draw.padStart(2, "0");
    return `${Y}-${M}-${D}`;
  }

  // dd.mm.yyyy, dd-mm-yyyy, dd/mm/yyyy, dd mm yyyy (dag-månad-år)
  m = value.match(/^(\d{1,2})[.\-\/ ](\d{1,2})[.\-\/ ](\d{4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (d.length === 1) d = `0${d}`;
    if (mo.length === 1) mo = `0${mo}`;
    return `${y}-${mo}-${d}`;
  }

  // dd.mm.yy, dd-mm-yy, dd/mm/yy, dd mm yy (tvåsiffrigt årtal dag-månad-år)
  m = value.match(/^(\d{1,2})[.\-\/ ](\d{1,2})[.\-\/ ](\d{2})$/);
  if (m) {
    let [, d, mo, yy] = m;
    if (d.length === 1) d = `0${d}`;
    if (mo.length === 1) mo = `0${mo}`;
    const yearNum = parseInt(yy, 10);
    const year = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
    return `${year}-${mo}-${d}`;
  }

  // yy-mm-dd, yy.mm.dd, yy/mm/dd (år-månad-dag)
  m = value.match(/^(\d{2})[.\-\/ ](\d{2})[.\-\/ ](\d{2})$/);
  if (m) {
    let [, yy, mo, dd] = m;
    const yearNum = parseInt(yy, 10);
    const year = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
    return `${year}-${mo}-${dd}`;
  }

  // 6-siffrig yymmdd (utan separatorer) – t.ex. 290301 → 2029-03-01
  m = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (m) {
    const [, yy, mo, dd] = m;
    const yearNum = parseInt(yy, 10);
    const year = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
    return `${year}-${mo}-${dd}`;
  }

  // 8-siffrig yyyymmdd (utan separatorer) – t.ex. 20290301 → 2029-03-01
  m = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) {
    const [, Y, M, D] = m;
    return `${Y}-${M}-${D}`;
  }

  return null;
}



function sliceByHeadings(
  raw: string,
  start: RegExp,
  end: RegExp
): string | null {
  const soft = asciiSoft(raw);
  const s = soft.search(start);
  if (s < 0) return null;
  const tail = soft.slice(s);
  const e = tail.search(end);
  const startIdx = mapNormalizedIndexToOriginal(raw, soft, s);
  const endIdx =
    e < 0
      ? raw.length
      : mapNormalizedIndexToOriginal(raw, soft, s + e);
  return raw.slice(startIdx, endIdx);
}


function mapNormalizedIndexToOriginal(
  original: string,
  normalized: string,
  idx: number
) {
  let acc = 0;
  for (let i = 0; i < original.length; i++) {
    const n = asciiSoft(original[i]);
    acc += Math.max(1, n.length);
    if (acc >= idx) return i;
  }
  return original.length - 1;
}

function tidyName(s: string) {
  let cleaned = s
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Za-zÅÄÖåäö' \-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const soft = asciiSoft(cleaned);
  if (
    /(kliniken|mottagningen|universitetssjukhuset|v[aä]rdcentralen|enheten|^avd\b)/i.test(
      cleaned
    ) ||
    /\bnamn\w*/.test(soft)
  ) {
    return "";
  }
  const tokens = cleaned.split(/\s+/);
  if (tokens.some((t) => t.length >= 2 && t === t.toUpperCase()))
    return "";

  const m = cleaned.match(
    /\b([A-ZÅÄÖ][A-Za-zÅÄÖåäö'\-]*[a-zåäö][A-Za-zÅÄÖåäö'\-]*\s+[A-ZÅÄÖ][A-Za-zÅÄÖåäö'\-]*[a-zåäö][A-Za-zÅÄÖåäö'\-]*(?:\s+[A-ZÅÄÖ][A-Za-zÅÄÖåäö'\-]*[a-zåäö][A-Za-zÅÄÖåäö'\-]*)?)\b/
  );
  return (m ? m[1] : "").trim();
}

function extractNameAfterLabel(scope: string) {
  const lines = scope.replace(/\r\n?/g, "\n").split("\n");
  const norm = lines.map((l) => asciiSoft(l));
  let idx = -1;

  // Leta bakifrån efter rad som innehåller "namnförtydligande"
  for (let i = norm.length - 1; i >= 0; i--) {
    if (/\bnamn[fv]?[öo]rtydligande\b/.test(norm[i])) {
      idx = i;
      break;
    }
  }

  if (idx >= 0) {
    // Försök först plocka namn på samma rad efter etiketten
    const sameMatch = lines[idx].match(
      /namn[fv]?[öo]rtydligande[^\n]*?(?::|\-)?\s*([^\n|]+)/i
    );
    const same = sameMatch?.[1];
    if (same) {
      const nm = tidyName(cleanFieldValue(same));
      if (nm && /\s/.test(nm)) return nm;
    }


    // Titta sedan på de närmaste raderna under etiketten
    for (let k = 1; k <= 4 && idx + k < lines.length; k++) {
      const rawLine = lines[idx + k];
      const softLine = asciiSoft(rawLine);

      // Hoppa över rubriklik text (t.ex. "Tjänsteställe Ort")
      if (isHeadingLikeValue(softLine)) continue;

      const cand = tidyName(cleanFieldValue(rawLine));
      if (cand && /\s/.test(cand)) return cand;
    }
  }

  // Fallback: leta efter ett rimligt namn i slutet av texten,
  // men hoppa över rubriklik text och uppenbara footer-rader.
  const tail = lines.slice(Math.max(0, lines.length - 30));
  for (const line of tail) {
    const softLine = asciiSoft(line);

    // Hoppa över rubriklik text (t.ex. "Tjänsteställe Ort och datum")
    if (isHeadingLikeValue(softLine)) continue;

    // Hoppa över typiska footer-rader, t.ex. "SOSFS 2015:8 Bilaga 3 1 (1)"
    if (
      /sosfs\b/.test(softLine) ||
      /hslf[- ]?fs\b/.test(softLine) ||
      /\bbilaga\b/.test(softLine) ||
      /^\(?\d+\)?(\s*\(\d+\))?$/.test(softLine)
    ) {
      continue;
    }

    const nm = tidyName(cleanFieldValue(line));
    if (nm && /\s/.test(nm)) return nm;
  }

  return null;
}




function sanitizeOrg(s: string) {
  let out = s;
  out = out.replace(/\[[^\]]*\]/g, " ");
  out = out.replace(/\([^)]*\)/g, " ");
  out = out.replace(
    /(\d{4}[.\-\/]\d{2}[.\-\/]\d{2}|\d{6}\s*-\s*\d{6}).*$/i,
    " "
  );
  out = out
    .replace(/\b[A-Z]{2,}\b/g, " ")
    .replace(/\b[0-9O]{1,3}\b/g, " ")
    .replace(
      /\b(?!(av|och|i|vid|en|på|för|med|till)\b)[A-Za-zÅÄÖåäö]{1,2}\b/g,
      " "
    );
  out = out.replace(/[^A-Za-zÅÄÖåäö0-9.,\-–— ]+/g, " ");
  out = out.replace(/\s{2,}/g, " ").trim();
  out = out.replace(/[,.\-–— ]+$/g, "").trim();
  return out;
}

function improveParsedFromOcr(
  raw: string,
  p: any,
  kind: IntygKind | null
) {
  const soft = asciiSoft(raw);
  const out: any = { ...p };
  const original: any = { ...p };


  // ======== NAMN ========
  const mFirst = raw.match(
    /\b[fF][öo]rnamn\s*[:\-]?\s*([^\n|]+)/
  );
  const mLast = raw.match(
    /\b[Ee]fternamn\s*[:\-]?\s*([^\n|]+)/
  );
  const first = mFirst ? cleanFieldValue(mFirst[1]) : "";
  const last = mLast ? cleanFieldValue(mLast[1]) : "";

  const existingFullName = out.fullName ? out.fullName.trim() : "";
  if (!existingFullName) {
    const composed = [first, last].filter(Boolean).join(" ");
    if (composed) {
      out.fullName = composed;
    }
  }

  if (out.fullName) {
    out.fullName = out.fullName
      .replace(/\b(förnamn|fornamn|efternamn)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }


  // ======== SPECIALITET SOM ANSÖKAN AVSER (första ordet) ========
  if (!out.specialtyHeader) {
    const spec = raw.match(
      /specialitet\s+som\s+ans[öo]kan\s+avser\s*[:\-]?\s*([^\n|]+)/i
    );
    if (spec?.[1]) out.specialtyHeader = firstWordOnly(spec[1]);
  }
  if (out.specialtyHeader) {
    out.specialtyHeader = firstWordOnly(out.specialtyHeader);
  }

  // ======== PERSONNUMMER ========
  if (!out.personnummer) {
    const pn = raw.match(
      /\b(\d{6}[-+ ]?\d{4})\b/
    );
    if (pn?.[0]) out.personnummer = pn[0];
  }

  // ======== DELMÅL ========
  // Vi försöker bara förbättra om inget redan satt
  if ((!out.delmalCodes || out.delmalCodes.length === 0) && !out.delmalText) {
    // Plocka ut allt efter rubriken "Delmål som intyget avser"
    let delmalSection = "";

    {
      const m = raw.match(
        /Delm[aå]l\s+som\s+intyget\s+avser[^\n]*\n([\s\S]+?)\n\s*(?:Tj[aä]nstg[öo]ringsst[aä]lle|Ämne\s+f[öo]r|Beskrivning|Utvecklingsarbetets\s+ämne|Kursens\s+ämne|Beskrivning\s+av\s+den\s+kliniska|Tj[aä]nstg[öo]ringsst[aä]lle\s+f[öo]r\s+klinisk)/i
      );
      if (m?.[1]) {
        delmalSection = m[1];
      }
    }

    if (!delmalSection) {
      // fallback: ta raden där rubriken står, men klipp bort själva rubriken
      const m = raw.match(
        /(Delm[aå]l\s+som\s+intyget\s+avser[^\n]*)/i
      );
      if (m?.[1]) {
        const line = m[1];
        const after = line.replace(
          /Delm[aå]l\s+som\s+intyget\s+avser[^\n]*/i,
          ""
        );
        delmalSection = after;
      }
    }

    if (delmalSection) {
      const sectionSoft = asciiSoft(delmalSection);

      // Kandidater kan vara separerade med kommatecken, semikolon, mellanslag etc.
      const rawTokens = sectionSoft
        .replace(/[^a-z0-9 \n]/gi, " ")
        .split(/[\s,;]+/)
        .filter(Boolean);

      const candidates: string[] = [];

      for (const tok of rawTokens) {
        const t = tok.trim();
        if (!t) continue;

        // Tillåt t.ex. a1, b3, c14, sta1, stb2, stc10 osv.
        if (/^(a|b|c)\d{1,2}$/i.test(t)) {
          candidates.push(t.toLowerCase());
          continue;
        }
        if (/^st[abc]\d{1,2}$/i.test(t)) {
          candidates.push(t.toLowerCase());
          continue;
        }
      }

      // Unika koder i ordning
      const seen = new Set<string>();
      const unique = candidates.filter((c) => {
        const key = c.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Bygg upp tillåtna koder beroende på målversion (2015 vs 2021)
      const allowedMap = new Map<string, string>();

      const addAllowed = (code: string) => {
        allowedMap.set(code.toLowerCase(), code.toLowerCase());
      };

      // 2015: a1–a6, b1–b5, c1–c14
      for (let i = 1; i <= 6; i++) addAllowed(`a${i}`);
      for (let i = 1; i <= 5; i++) addAllowed(`b${i}`);
      for (let i = 1; i <= 14; i++) addAllowed(`c${i}`);

      // 2021: sta1–sta7, stb1–stb4, stc1–stc14 (och varianter med versaler)
      for (let i = 1; i <= 7; i++) addAllowed(`sta${i}`);
      for (let i = 1; i <= 4; i++) addAllowed(`stb${i}`);
      for (let i = 1; i <= 14; i++) addAllowed(`stc${i}`);

      const filtered: string[] = [];

      for (const c of unique) {
        const k = c.toLowerCase();

        // Normalisera ev. "sta1" till "sta1", "StA1" etc spelar ingen roll
        if (allowedMap.has(k)) {
          filtered.push(allowedMap.get(k)!);
        }
      }

      if (filtered.length > 0) {
        out.delmalCodes = filtered;
      }
    }
  }

  // ======== TJÄNSTGÖRINGSSTÄLLE / KLINIK + ÄMNE ========
  // Vi försöker bara om clinic saknas.
  if (!out.clinic) {
    // För 2015-intyg finns ofta en rad som börjar med "Tjänstgöringsställe och period"
    const klin2015 = raw.match(
      /(Tj[aä]nstg[öo]ringsst[aä]lle\s+och\s+period[^\n]*\n)([^\n]+)/
    );
    if (klin2015?.[2]) {
      out.clinic = cleanFieldValue(klin2015[2]);
    }

    // 2021: "Tjänstgöringsställe för klinisk tjänstgöring" eller "... för auskultation" osv.
    if (!out.clinic) {
      const klin2021 = raw.match(
        /(Tj[aä]nstg[öo]ringsst[aä]lle\s+f[öo]r\s+(?:klinisk\s+tj[aä]nstg[öo]ring|auskultation)[^\n]*\n)([^\n]+)/
      );
      if (klin2021?.[2]) {
        out.clinic = cleanFieldValue(klin2021[2]);
      }
    }

    // Kursintyg 2015: "Ämne (i rubrikform) och period (datum – datum) för kursen"
    if (!out.clinic) {
      const amne2015 = raw.match(
        /(Ämne\s*\(i\s*rubrikform\)\s*och\s*period[^\n]*\n)([^\n]+)/
      );
      if (amne2015?.[2]) {
        const amne = cleanFieldValue(amne2015[2]);
        out.clinic = amne;
      }
    }

    // Kursintyg 2021: "Kursens ämne (anges i rubrikform)" + beskrivning nedan
    if (!out.clinic) {
      const amne2021 = raw.match(
        /(Kursens\s+ämne\s*\(anges\s+i\s+rubrikform\)[^\n]*\n)([^\n]+)/
      );
      if (amne2021?.[2]) {
        const amne = cleanFieldValue(amne2021[2]);
        out.clinic = amne;
      }
    }

    // Utvecklingsarbete / kvalitetsarbete 2015: "Ämne för kvalitets- och utvecklingsarbete"
    if (!out.clinic) {
      const kval2015 = raw.match(
        /(Ämne\s+f[öo]r\s+kvalitets-\s+och\s+utvecklingsarbete[^\n]*\n)([^\n]+)/
      );
      if (kval2015?.[2]) {
        const amne = cleanFieldValue(kval2015[2]);
        out.clinic = amne;
      }
    }

    // Utvecklingsarbete 2021: "Utvecklingsarbetets ämne"
    if (!out.clinic) {
      const utv2021 = raw.match(
        /(Utvecklingsarbetets\s+ämne[^\n]*\n)([^\n]+)/
      );
      if (utv2021?.[2]) {
        const amne = cleanFieldValue(utv2021[2]);
        out.clinic = amne;
      }
    }

    // Vetenskapligt arbete 2015: "Ämne för självständigt skriftligt arbete"
    if (!out.clinic) {
      const vet2015 = raw.match(
        /(Ämne\s+f[öo]r\s+sj[aä]lvst[aä]ndigt\s+skriftligt\s+arbete[^\n]*\n)([^\n]+)/
      );
      if (vet2015?.[2]) {
        const amne = cleanFieldValue(vet2015[2]);
        out.clinic = amne;
      }
    }

    // Som sista fallback: leta efter en rad med "Ämne" generellt
    if (!out.clinic) {
      const amneGeneric = raw.match(
        /(Ämne[^\n]*\n)([^\n]+)/
      );
      if (amneGeneric?.[2]) {
        const amne = cleanFieldValue(amneGeneric[2]);
        out.clinic = amne;
      }
    }
  }

  if (out.clinic) {
    const subjectSoft = out.clinic ? asciiSoft(out.clinic) : "";
    // Ta bort etiketter som "Ämne ..." eller "Tjänstgöringsställe ..."
    out.clinic = tidyOneLine(
      out.clinic
        .replace(/^ämne\s*f[öo]r\s+/i, "")
        .replace(/^tjänstgöringsställe\s*(för\s+klinisk\s+tjänstgöring)?\s*/i, "")
        .replace(/^tjänstgöringsställe\s*och\s*period\s*/i, "")
        .replace(/^utvecklingsarbetets\s+ämne\s*/i, "")
        .replace(/^ämne\s*f[öo]r\s+självständigt\s+skriftligt\s+arbete\s*/i, "")
    );

    // Om zon-baserad tolkning redan satt en tydlig rubrik, behåll den
    if (subjectSoft.includes("rubrikform")) {
      // låt parsern bestämma
    }
  }

  // ======== BESKRIVNING ========
  if (!out.description) {
    // Beskrivning av kursen/kliniska tjänstgöringen/kvalitetsarbetet osv.
    const desc = raw.match(
      /(Beskrivning\s+av\s+(den\s+kliniska\s+tj[aä]nstg[öo]ringen|kursen|kvalitets-\s+och\s+utvecklingsarbetet|ST-läkarens\s+deltagande\s+i\s+utvecklingsarbetet|det\s+självständiga\s+skriftliga\s+arbetet)[^\n]*\n)([\s\S]+?)\n\s*(?:Intygande|Intygsut|Handledare|Namnteckning)/i
    );
    if (desc?.[3]) {
      const body = desc[3].trim();
      out.description = enforceBulletBreaks(body);
    }
  }

  // ======== PERIOD (DATUM) =========
  // Om period redan är satt (t.ex. via zon-parser), rör inte den.
  if (!out.period) {
    // 0) Zon-baserade start-/slutdatum (t.ex. separata fält i parsern)
    const zStart = (out as any).startDate;
    const zEnd = (out as any).endDate;
    if (zStart || zEnd) {
      const startIso = zStart ? normalizeDateGuess(String(zStart)) : null;
      const endIso = zEnd ? normalizeDateGuess(String(zEnd)) : null;

      if (startIso || endIso) {
        out.period = {
          startISO: startIso,
          endISO: endIso,
        };
      }
    }
  }

  if (!out.period) {
    // Två huvudsakliga källor:
    // 1) "Tjänstgöringsställe och period (datum–datum)"
    // 2) "Ämne ... och period (datum–datum) för kursen"
    const dateSpan =
      raw.match(
        /period\s*\(\s*[\d\wåäöÅÄÖ\.\-–\/ ]+\s*[–-]\s*[\d\wåäöÅÄÖ\.\-–\/ ]+\s*\)/i
      )?.[0] ?? "";

    if (dateSpan) {
      const inner = dateSpan
        .replace(/period\s*\(/i, "")
        .replace(/\)\s*$/, "")
        .trim();

      // Försök separera start och slut med hjälp av "–" eller "-"
      const parts = inner.split(/[–-]/).map((s) => s.trim());
      if (parts.length >= 2) {
        const startRaw = parts[0];
        const endRaw = parts[parts.length - 1];

        const startIso = normalizeDateGuess(startRaw);
        const endIso = normalizeDateGuess(endRaw);

        if (startIso || endIso) {
          out.period = {
            startISO: startIso ?? null,
            endISO: endIso ?? null,
          };
        }
      }
    }
  }

  // Extra försök att hitta period för kursintyg 2015 där perioden står i samma rad
  if (!out.period && out.clinic) {
    const m = out.clinic.match(
      /(.*?)(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}|\d{6}|\d{8})\s*[–-]?\s*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}|\d{6}|\d{8})/
    );
    if (m) {
      const subjectPart = m[1].trim();
      const startIso = normalizeDateGuess(m[2]);
      const endIso = normalizeDateGuess(m[3]);

      if (subjectPart) {
        out.clinic = subjectPart;
      }

      if (startIso || endIso) {
        out.period = {
          startISO: startIso ?? null,
          endISO: endIso ?? null,
        };
      }
    }
  }

  // Om vi fortfarande saknar period, försök hämta första två datum i texten
  if (!out.period) {
    const allDates: string[] = [];
    const dateRegex =
      /(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}|\d{4}-\d{2}-\d{2})/g;

    let m: RegExpExecArray | null;
    while ((m = dateRegex.exec(raw)) !== null) {
      allDates.push(m[1]);
    }

    if (allDates.length >= 2) {
      const startIso = normalizeDateGuess(allDates[0]);
      const endIso = normalizeDateGuess(allDates[1]);
      if (startIso || endIso) {
        out.period = {
          startISO: startIso ?? null,
          endISO: endIso ?? null,
        };
      }
    }
  }


  // ======== HANDLEDARDEL – NAMN, SPECIALITET, TJÄNSTESTÄLLE ========

  // Om vi redan har handledarnamn via zon-parser, låt bli att ändra.
  if (!out.supervisorName) {
    // Försök först med helpern som tittar kring "Namnförtydligande"-raden.
    const nm = extractNameAfterLabel(raw);
    if (nm) {
      out.supervisorName = nm;
    }
  }

  if (!out.supervisorName) {
    // Ofta står namnteckning och namnförtydligande ihop:
    // "Namnteckning | Namnförtydligande"
    const handledarBlock = raw.match(
      /(Namnteckning[^\n]*\n)([^\n]+)\n([^\n]+)/i
    );
    if (handledarBlock) {
      const line2 = handledarBlock[2];
      const line3 = handledarBlock[3];

      const maybeName = cleanFieldValue(line3);
      if (maybeName && !/namnförtydligande/i.test(maybeName)) {
        out.supervisorName = maybeName;
      }
    }
  }

  // Extra fallback: hitta en rad som ser ut som "Handledare\nSpecialitet\nTjänsteställe..."
  if (!out.supervisorName) {
    const lines = raw.split(/\r?\n/);
    for (let i = 0; i < lines.length - 1; i++) {
      const l = lines[i];
      if (/Handledare\s*$/.test(l)) {
        const next = cleanFieldValue(lines[i + 1]);
        if (next && !/specialitet/i.test(next)) {
          out.supervisorName = next;
          break;
        }
      }
    }
  }

  // Specialitet (för handledare/kursledare)
  if (!out.supervisorSpeciality) {
    // Försök först med klassiskt mönster:
    //   Handledare
    //   Specialitet
    //   <värde>
    let specBlock =
      raw.match(
        /Handledare[^\n]*\nSpecialitet[^\n]*\n([^\n]+)/i
      ) ??
      // Fallback om "Specialitet"-raden inte plockas separat av OCR:
      //   Handledare
      //   <värde>
      raw.match(/Handledare[^\n]*\n([^\n]+)/i);

    if (specBlock?.[1]) {
      const candidate = cleanFieldValue(specBlock[1]).trim();

      // Skydda mot att vi råkar fånga rubrikerna själva
      if (
        candidate &&
        !/^Handledare\b/i.test(candidate) &&
        !/^Specialitet\b/i.test(candidate)
      ) {
        out.supervisorSpeciality = firstWordOnly(candidate);
      }
    }
  }

  if (out.supervisorSpeciality) {
    out.supervisorSpeciality = firstWordOnly(out.supervisorSpeciality);
  }

  // Tjänsteställe för handledare

  if (!out.supervisorSite) {
    const siteBlock = raw.match(
      /Tj[aä]nstest[aä]lle[^\n]*\n([^\n]+)/i
    );
    if (siteBlock?.[1]) {
      out.supervisorSite = sanitizeOrg(
        cleanFieldValue(siteBlock[1])
      );
    }
  }

  if (out.supervisorSite) {
    out.supervisorSite = sanitizeOrg(out.supervisorSite);
  }


  // ======== RADIORUTOR KURSLEDARE / HANDLEDARE (KURSINTYG) ========
  // Zonlogik (certifierIsCourseLeader / certifierIsSupervisor) ska ligga först.
  // "Smart" logik används bara om zonerna inte gett något tydligt svar.
  if (kind === "2015-B5-KURS" || kind === "2021-B10-KURS") {
    if (!(out as any).signingRole) {
      const zLeader = (out as any).certifierIsCourseLeader;
      const zSupervisor = (out as any).certifierIsSupervisor;

      const isMarked = (val: unknown): boolean => {
        if (!val) return false;
        const s = asciiSoft(String(val));
        return /\bx\b/.test(s) || /☒|✗|✓/.test(String(val));
      };

      const leaderMarked = isMarked(zLeader);
      const supervisorMarked = isMarked(zSupervisor);

      if (leaderMarked && !supervisorMarked) {
        (out as any).signingRole = "kursledare";
      } else if (supervisorMarked && !leaderMarked) {
        (out as any).signingRole = "handledare";
      } else {
        // Fallback: tolka rå OCR-text runt raden med Kursledare/Handledare
        const lines = raw.replace(/\r\n?/g, "\n").split("\n");
        for (const line of lines) {
          const softLine = asciiSoft(line);
          if (
            !softLine.includes("kursledare") &&
            !softLine.includes("handledare")
          ) {
            continue;
          }

          const xBeforeLeader = /x\s*(kursledare)/.test(softLine);
          const xAfterLeader = /(kursledare)\s*x\b/.test(softLine);
          const xBeforeSupervisor = /x\s*(handledare)/.test(softLine);
          const xAfterSupervisor = /(handledare)\s*x\b/.test(softLine);

          if (
            (xBeforeLeader || xAfterLeader) &&
            !(xBeforeSupervisor || xAfterSupervisor)
          ) {
            (out as any).signingRole = "kursledare";
            break;
          }

          if (
            (xBeforeSupervisor || xAfterSupervisor) &&
            !(xBeforeLeader || xAfterLeader)
          ) {
            (out as any).signingRole = "handledare";
            break;
          }
        }
      }
    }
  }

  // Sista städning: beskrivning för auskultationsintyg ska inte innehålla intygandetext m.m.
  if (
    (kind === "2015-B3-AUSK" || kind === "2021-B8-AUSK") &&
    typeof out.description === "string" &&
    out.description.trim()
  ) {
    const rawLines = out.description
      .replace(/\r\n?/g, "\n")
      .split("\n");

    const kept: string[] = [];

    for (const rawLine of rawLines) {
      const line = tidyOneLine(rawLine);
      if (!line) continue;

      const softLine = asciiSoft(line);

      // Stoppa vid intygandetexten – resten hör till underskriftsdelen
      if (
        softLine.startsWith("intygande") ||
        softLine.includes(
          "sokanden har genomfort utbildningsaktiviteten och uppfyllt kompetenskrav i delmalet/-en"
        )
      ) {
        break;
      }

      // Hoppa över rubriker som tydligt hör till underskriftsdelen
      if (
        /\bhandledare\b/.test(softLine) ||
        /\bspecialitet\b/.test(softLine) ||
        /tjanstestalle/.test(softLine)
      ) {
        continue;
      }

      kept.push(line);
    }

    out.description = kept.join("\n").trim();
  }

  // Sista städning: beskrivning för kursintyg ska inte innehålla intygandetext m.m.
  if (
    (kind === "2015-B5-KURS" || kind === "2021-B10-KURS") &&
    typeof out.description === "string" &&
    out.description.trim()
  ) {
    const rawLines = out.description
      .replace(/\r\n?/g, "\n")
      .split("\n");

    const kept: string[] = [];

    for (const rawLine of rawLines) {
      const line = tidyOneLine(rawLine);
      if (!line) continue;

      const softLine = asciiSoft(line);

      // Stoppa vid intygandetexten – resten hör till underskriftsdelen
      if (softLine.startsWith("intygande")) {
        break;
      }

      // Hoppa över rad med kryssrutor Kursledare/Handledare
      if (
        /\bkursledare\b/.test(softLine) &&
        /\bhandledare\b/.test(softLine)
      ) {
        continue;
      }

      // Hoppa över rubriken för specialitet i intygandedelen
      if (
        softLine.startsWith(
          "specialitet om den intygande personen ar specialistkompetent lakare"
        )
      ) {
        continue;
      }

      kept.push(line);
    }

    out.description = kept.join("\n").trim();
  }

  return out;
}








// --- NYA HJÄLPARE: delmål & beskrivning ---


// Plockar koder som "a1", "b3", "c7", samt "STa3" (ST a3/STa 3 normaliseras till STa3).
// Gör samtidigt OCR-tolerans för vanliga förväxlingar som "aI"/"al" → "a1".
function extractDelmalCodes(text: string): string[] {
  if (!text) return [];
  const out = new Set<string>();

  // Matcha varianter:
  //  - "ST a3", "STa3", "St a 3" osv.  (valfritt ST-prefix i egen grupp)
  //  - "a1", "b12", "c7"
  //  - Tillåt att siffror feltolkas som I/l/|/O i OCR (hanteras nedan)
  //
  //  Exempel som fångas:
  //    "a1, a2, a4, a9, b4, c13, c15"
  //    "ST a3", "STa 3", "STa3"
  const re =
    /\b(ST)?\s*([abc])\s*[- ]?\s*([0-9Il|Oo]{1,2})\b/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const hasST = Boolean(m[1]);
    const letter = (m[2] || "").toLowerCase();
    let rawNum = m[3] || "";

    // Korrigera vanliga OCR-fel: I, l, | → 1 och O/o → 0
    rawNum = rawNum
      .replace(/[Il|]/g, "1")
      .replace(/[Oo]/g, "0");

    // Ta bort inledande nollor, t.ex. "01" -> "1", "00" -> "".
    const num = rawNum.replace(/^0+/, "");

    // Om det bara var nollor (c0, a0, b00 etc) – ignorera helt.
    if (!num) continue;

    const norm = hasST ? `ST${letter}${num}` : `${letter}${num}`;
    out.add(norm);
  }

  return Array.from(out);
}


// Försöker plocka ut beskrivningsstycket mellan "Beskrivning av den kliniska tjänstgöringen"
// och nästa rubrik (Handledare/Underskrift/Bedömning/Intygas/Delmål/Tjänstgöringsställe).
function pickDescriptionSection(raw: string): string | null {
  const sec =
    sliceByHeadings(
      raw,
      /beskrivning\s+av\s+(den\s+)?(kliniska\s+)?tjanstgoringen/,
      /(handledare|underskrift|bed[oö]mning|intygas|delm[aå]l|tjanstgoringsstalle)/
    ) || null;

  if (sec && sec.trim().length > 0) return sec;

  // Fallback: leta efter en block med flera punktlistor nära "beskrivning"
  const soft = asciiSoft(raw);
  const i = soft.indexOf("beskrivning");
  const start = i >= 0 ? Math.max(0, i - 200) : 0;
  const end =
    i >= 0 ? Math.min(raw.length, i + 2000) : Math.min(raw.length, 2000);
  const window = raw.slice(start, end);

  const bulletLines = window
    .split(/\r?\n/)
    .filter((l) => /^\s*[-•]/.test(l))
    .join("\n")
    .trim();

  return bulletLines || null;
}

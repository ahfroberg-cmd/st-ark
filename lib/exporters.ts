// lib/exporters.ts
"use client";

import { PDFDocument, StandardFonts, rgb, PDFName } from "pdf-lib";

// Globala säkerhetsdefinitioner: om någon äldre/annan bundlad kod fortfarande
// refererar till dessa som globala variabler så ser vi till att de alltid finns.
;(globalThis as any).courseLeaderName ??= undefined;
;(globalThis as any).courseLeaderSite ??= undefined;
;(globalThis as any).courseLeaderSpeciality ??= undefined;
;(globalThis as any).courseLeaderSpecialty ??= undefined;
;(globalThis as any).courseLeaderSpec ??= undefined;

;(globalThis as any).supervisorName ??= undefined;
;(globalThis as any).supervisorSite ??= undefined;
;(globalThis as any).supervisorSpeciality ??= undefined;
;(globalThis as any).supervisorSpecialty ??= undefined;
;(globalThis as any).supervisorSpec ??= undefined;
;(globalThis as any).supervisorPn ??= undefined;

// No-op-setters för gamla/globalt förväntade hook-setters
;(globalThis as any).setSupervisorName ??= () => {};
;(globalThis as any).setSupervisorSite ??= () => {};
;(globalThis as any).setSupervisorSpeciality ??= () => {};
;(globalThis as any).setSupervisorSpecialty ??= () => {};
;(globalThis as any).setSupervisorSpec ??= () => {};

;(globalThis as any).setCourseLeaderName ??= () => {};
;(globalThis as any).setCourseLeaderSite ??= () => {};
;(globalThis as any).setCourseLeaderSpeciality ??= () => {};
;(globalThis as any).setCourseLeaderSpecialty ??= () => {};
;(globalThis as any).setCourseLeaderSpec ??= () => {};



// Säkerhetsdefinition: om någon äldre/annat bundlat ställe fortfarande refererar
// till en global courseLeaderName så finns variabeln nu alltid definierad
// och ger ingen Runtime ReferenceError. Den används inte i den aktuella logiken.
const courseLeaderName: any = undefined;


/* =========================================
   Grundtyper
========================================= */

export type GoalsVersion = "2015" | "2021";
export type ActivityType =
  | "PLACERING"
  | "AUSKULTATION"
  | "SKRIFTLIGT_ARBETE"
  | "KVALITETSARBETE"
  | "KURS"
  // === BT (2021) ===
  | "BT_GOALS"
  | "BT_FULLGJORD"
  | "BT_KOMPETENS"
  | "BT_ANSOKAN";


export type Profile = {
  name?: string;
  personalNumber?: string;
  speciality?: string; // stavning 1
  specialty?: string;  // stavning 2 (fallback)
  goalsVersion?: GoalsVersion;
  startDate?: string;
  firstName?: string;
  lastName?: string;
  homeClinic?: string;

  // Huvudhandledare (från profilsidan)
  supervisor?: string;              // HH namn  (mappas från form.supervisor)
  supervisorWorkplace?: string;     // HH tjänsteställe (om "Har annat tjänsteställe" är ikryssad)
};


export type Placement = {
  title?: string;
  site?: string;                // tjänstgöringsställe
  startDate: string;
  endDate: string;
  attendance?: number;

  // Handledare
  supervisor?: string;
  supervisorPn?: string;
  supervisorSpeciality?: string;
  supervisorSpecialty?: string; // fallback
  supervisorSite?: string;

  // Kursledare (NYTT – används på 2015 Kurs-intyg oavsett vem som signerar)
  courseLeaderName?: string;
  courseLeaderSpeciality?: string;
  courseLeaderSite?: string;

  cityDate?: string;
  bilagaNr?: string | number;
  notes?: string;               // beskrivning
  clinic?: string;              // UI-fält som ofta motsvarar title

  // Popup “förbered intyg” kan lägga signer här (behålls som any i koden)
  // signer?: { type: "KURSLEDARE"|"HANDLEDARE"; name?: string; site?: string; speciality?: string; personalNumber?: string };
};


export type ExportInput = {
  goalsVersion: GoalsVersion;
  activityType: ActivityType;
  profile: Profile;
  activity: Placement;
  milestones?: string[];
};

/* =========================================
   Hjälpare
========================================= */

async function fetchPublicPdf(path: string): Promise<ArrayBuffer> {
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

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
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

function drawText(opts: {
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

/* =========================================
   Template-sökvägar
========================================= */

/* ---------- 2021 (HSLF-FS 2021:8) ---------- */
// BT (Bilaga 1–4)
const TEMPLATE_2021_BILAGA_1  = "/pdf/2021/2021-2-7212-bilaga-1.pdf";   // Ansökan om intyg om godkänd BT
const TEMPLATE_2021_BILAGA_2  = "/pdf/2021/2021-2-7212-bilaga-2.pdf";   // Intyg om genomförda delmål i BT
const TEMPLATE_2021_BILAGA_3  = "/pdf/2021/2021-2-7212-bilaga-3.pdf";   // Intyg om fullgjord BT
const TEMPLATE_2021_BILAGA_4  = "/pdf/2021/2021-2-7212-bilaga-4.pdf";   // Intyg om uppnådd baskompetens

// ST (Bilaga 8–12, som du redan hade)
const TEMPLATE_2021_BILAGA_8  = "/pdf/2021/2021-2-7212-bilaga-8.pdf";   // Auskultation
const TEMPLATE_2021_BILAGA_9  = "/pdf/2021/2021-2-7212-bilaga-9.pdf";   // Klinisk tjänstgöring under handledning
const TEMPLATE_2021_BILAGA_10 = "/pdf/2021/2021-2-7212-bilaga-10.pdf";  // Kurs
const TEMPLATE_2021_BILAGA_11 = "/pdf/2021/2021-2-7212-bilaga-11.pdf";  // Förbättringsarbete
const TEMPLATE_2021_BILAGA_12 = "/pdf/2021/2021-2-7212-bilaga-12.pdf";  // Delmål STa3

/* ---------- 2015 (SOSFS 2015:8) ---------- */
const TEMPLATE_2015_PLACERING     = "/pdf/2015/blankett-specialistkompetens-klinisk-tjanstgoring-sosfs20158.pdf";
const TEMPLATE_2015_AUSKULTATION  = "/pdf/2015/blankett-specialistkompetens-auskultation-sosfs20158.pdf";
const TEMPLATE_2015_SKRIFTLIGT    = "/pdf/2015/blankett-specialistkompetens-skriftligt-arbete-sosfs20158.pdf";
const TEMPLATE_2015_KVALITET      = "/pdf/2015/blankett-specialistkompetens-kvalitet-utveckling-sosfs20158.pdf";
const TEMPLATE_2015_KURS          = "/pdf/2015/blankett-specialistkompetens-kurs-sosfs20158.pdf";

/* =========================================
   2021 – Koordinater (egna per bilaga)
========================================= */

/* ---------- 2021 – Auskultation (Bilaga 8) ---------- */
const coords2021Bil8 = {
  efternamn: { x: 76, y: 607 },
  fornamn: { x: 331, y: 607 },
  personnummer: { x: 76, y: 569 },
  specialitet: { x: 253, y: 569 },
  delmal: { x: 76, y: 508 },
  tjstgStalle: { x: 76, y: 450 },
  period: { x: 375, y: 450 },
  beskrivning: { x: 76, y: 418 },
  ortDatum: { x: 105, y: 260 },
  namnfortydligande: { x: 76, y: 143 },
  handledarSpec: { x: 76, y: 105 },
  handledarTjanstestalle: { x: 76, y: 68 },
  bilagaNr: { x: 505, y: 42 },
} as const;

/* ---------- 2021 – Klinisk tjänstgöring (Bilaga 9) ---------- */
const coords2021Bil9 = {
  efternamn: { x: 76, y: 607 },
  fornamn: { x: 331, y: 607 },
  personnummer: { x: 76, y: 569 },
  specialitet: { x: 253, y: 569 },
  delmal: { x: 76, y: 508 },
  tjstgStalle: { x: 76, y: 450 },
  period: { x: 375, y: 450 },
  beskrivning: { x: 76, y: 418 },
  ortDatum: { x: 105, y: 260 },
  namnfortydligande: { x: 76, y: 143 },
  handledarSpec: { x: 76, y: 105 },
  handledarTjanstestalle: { x: 76, y: 68 },
  bilagaNr: { x: 505, y: 42 },
} as const;

/* ---------- 2021 – Kurs (Bilaga 10) ---------- */
const coords2021Bil10 = {
  efternamn: { x: 76, y: 607 },
  fornamn: { x: 331, y: 607 },
  personnummer: { x: 76, y: 569 },
  specialitet: { x: 253, y: 569 },
  delmal: { x: 76, y: 508 },

  // Kursens ämne – vi använder title via values.tjstgStalle (se fill2021Generic)
  tjstgStalle: { x: 76, y: 452 },


  // Beskrivning av kursen
  beskrivning: { x: 76, y: 418 },

  // Kryssrutor – markeras beroende på signer.type
  // (justera x/y efter behov när du testar mot mallen)
  kursledareX: { x: 172, y: 225 },
  handledareX: { x: 80, y: 225 },

  ortDatum: { x: 105, y: 260 },

  // Signaturraden
  namnfortydligande: { x: 76, y: 143 },
  handledarSpec: { x: 76, y: 105 },
  handledarPersonnummer: { x: 355, y: 143 }, // nytt fält (justera vid behov)
  handledarTjanstestalle: { x: 76, y: 68 },

  bilagaNr: { x: 505, y: 42 },
} as const;



/* ---------- 2021 – Förbättringsarbete (Bilaga 11) ---------- */
const coords2021Bil11 = {
  efternamn: { x: 76, y: 607 },
  fornamn: { x: 331, y: 607 },
  personnummer: { x: 76, y: 569 },
  specialitet: { x: 253, y: 569 },
  delmal: { x: 76, y: 508 },
  tjstgStalle: { x: 76, y: 452 }, //=Titel
  beskrivning: { x: 76, y: 418 },
  ortDatum: { x: 105, y: 260 },
  namnfortydligande: { x: 76, y: 143 },
  handledarSpec: { x: 76, y: 105 },
  handledarTjanstestalle: { x: 76, y: 68 },
  bilagaNr: { x: 505, y: 42 },
} as const;

/* ---------- 2021 – Delmål STa3 (Bilaga 12) ---------- */
const coords2021Bil12 = {
  efternamn: { x: 76, y: 607 },
  fornamn: { x: 331, y: 607 },
  personnummer: { x: 76, y: 569 },
  specialitet: { x: 253, y: 569 },

  // STa3 har egen layout – separat yta för aktivitetslista och “Hur det kontrollerats …”
  aktiviteter: { x: 76, y: 498 },
  hurKontrolleratsText: { x: 76, y: 725 },

  ortDatum: { x: 105, y: 260 },
  namnfortydligande: { x: 76, y: 152 },
  handledarSpec: { x: 76, y: 114 },
  handledarTjanstestalle: { x: 76, y: 76 },

  bilagaNr: { x: 505, y: 42 },
} as const;

/* =========================================
   2015 – Koordinater (egna per blankett)
========================================= */

const coords2015Placering = {
  efternamn: { x: 80, y: 637 },
  fornamn: { x: 305, y: 637 },
  personnummer: { x: 80, y: 608 },
  specialitet: { x: 80, y: 566 },
  delmal: { x: 80, y: 538 },
  plats: { x: 80, y: 495 },
  period: { x: 330, y: 495 },
  beskrivning: { x: 80, y: 455 },
  ortDatum: { x: 120, y: 210 },
  handledare: { x: 305, y: 67 },
  handledarSpec: { x: 80, y: 124 },
  handledarTjanstestalle: { x: 80, y: 96 },
  bilagaNr: { x: 505, y: 42 },
} as const;

const coords2015Auskultation = { ...coords2015Placering } as const;
const coords2015Skriftligt   = { ...coords2015Placering } as const;
const coords2015Kvalitet     = { ...coords2015Placering } as const;
const coords2015Kurs = {
  efternamn: { x: 80, y: 637 },
  fornamn: { x: 305, y: 637 },
  personnummer: { x: 80, y: 608 },
  specialitet: { x: 80, y: 566 },
  delmal: { x: 80, y: 538 },
  amne: { x: 80, y: 495 },          
  period: { x: 330, y: 495 },      
  kursledare1: { x: 80, y: 468 },
  beskrivning: { x: 80, y: 425 },

  // Kryssrutor för “Intygas av”
  kursledareX: { x: 78, y: 134 },  
  handledareX: { x: 166,  y: 134 },  

  // Kursledarsektionen (används när kursledare signerar)
  kursledare2: { x: 305, y: 52 },  
  kursledarSpec: { x: 80, y: 107 }, 
  kursledarTjanstestalle: { x: 80, y: 79 }, 

  // Handledarsektionen (används när handledare signerar)
  handledare: { x: 305, y: 52 },
  handledarSpec: { x: 80, y: 107 },
  handledarTjanstestalle: { x: 80, y: 79 },

  ortDatum: { x: 120, y: 210 },
  bilagaNr: { x: 505, y: 42 },
} as const;


/* =========================================
   2021 – generisk fyllare (Bilaga 8/9/10/11)
========================================= */

async function fill2021Generic(
  pdfDoc: PDFDocument,
  coords: Record<string, { x: number; y: number }>,
  profile: Profile,
  activity: Placement,
  delmal: string[]
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

console.log("DEBUG PROFILE IN EXPORT", {
  name: profile.name,
  firstName: profile.firstName,
  lastName: profile.lastName,
  personalNumber: profile.personalNumber,
  speciality: profile.speciality,
  specialty: profile.specialty,
});

const pages = pdfDoc.getPages();
const page1 = pages[0];
const page2 = pages[1] ?? pages[0]; // fallback om mallen skulle vara enkelsidig
const page = page1;
const isCourse2021 =
  (activity as any).activityType === "KURS" &&
  profile.goalsVersion === "2021";



  const size = 11;

  const nameParts = (profile.name ?? "").trim().split(/\s+/);

  // Förnamn
  const fallbackFirst =
    profile.firstName ??
    (profile as any).givenName ??
    (nameParts[0] ?? "");

  // Efternamn
  const fallbackLast =
    profile.lastName ??
    (profile as any).surname ??
    (nameParts.slice(1).join(" ") || "");

  // Personnummer
  const fallbackPn =
    profile.personalNumber ?? "";

  // Specialitet
  const fallbackSpec =
    profile.speciality ??
    profile.specialty ??
    "";

  const profSpecialty = profile.speciality ?? profile.specialty ?? "";

  const site =
  (activity as any).site
  ?? activity.title
  ?? (activity as any).clinic
  ?? profile.homeClinic
  ?? "";

const beskrivning = activity.notes ?? (activity as any).note ?? "";


    // De-dup: om plats (aktivitetens tjänstgöringsställe) = handledarens tjänsteställe,
  // visa bara handledarens tjänsteställe (lämna plats tomt).
  const rawPlats = (activity as any).clinic ?? (activity as any).site ?? "";
  const rawHandledStalle =
    (activity as any).supervisorSite ??
    (activity as any).supervisorWorkplace ??
    "";
  const dedupPlats =
    rawPlats && rawHandledStalle && rawPlats.trim() === rawHandledStalle.trim()
      ? ""
      : rawPlats;

  // Tjänstgöringsställe på intyget – för klinisk tjänstgöring vill vi ha samma som aktivitetens titel
  const tjstgStalleVal =
    (activity as any).title ??
    (activity as any).site ??
    (activity as any).clinic ??
    profile.homeClinic ??
    "";

  // Handledarens namn – används både som handledare och namnförtydligande
  const handledarName =
    (activity as any).supervisor ??
    ((activity as any).signer && (activity as any).signer.name) ??
    "";

   const values: Record<string, string> = {
    // ====== SÖKANDE (TOPPEN AV INTYGET) ======
    efternamn: fallbackLast,
    fornamn: fallbackFirst,
    personnummer: (profile as any).personalNumber ?? "",
    specialitet: profSpecialty,

    // ====== AKTIVITET ======
    titel: (activity as any).title ?? "",
    tjstgStalle: tjstgStalleVal,
    plats: dedupPlats,

    period: isCourse2021
      ? ""
      : ((activity as any).startDate && (activity as any).endDate
          ? `${(activity as any).startDate} – ${(activity as any).endDate}`
          : ""),

    beskrivning:
      ((activity as any).description ??
        (activity as any).desc ??
        (activity as any).notes ??
        (activity as any).note ??
        (activity as any).summary ??
        (activity as any).text ??
        "") as string,

    // ====== SIGNER ======
    handledare: handledarName,
    namnfortydligande: handledarName,
    handledarSpec:
      (activity as any).supervisorSpeciality ??
      (activity as any).supervisorSpecialty ??
      "",
    handledarTjanstestalle: rawHandledStalle,
    handledarPersonnummer:
      (activity as any).supervisorPn ??
      (activity as any).supervisorPersonalNumber ??
      "",

    bilagaNr: "",
  };



  const normalizeAndSortDelmal = (input: string[]): string[] => {
    const items = (input || [])
      .map((d) => String(d ?? "").trim())
      .filter((d) => d.length > 0)
      .map((raw) => {
        // Plocka ut själva koden (före ev. beskrivning), samma princip som i UI
        const base = raw.split(/\s|–|-|:|\u2013/)[0];
        const up = base.toUpperCase().replace(/\s/g, "");

        // Stöd både "A1/B2/C3" och "STa1/STb2/STc3"
        const m =
          up.match(/^ST([ABC])(\d+)$/) ||
          up.match(/^([ABC])(\d+)$/);

        let letter = "";
        let num = 0;

        if (m) {
          letter = m[1];
          num = parseInt(m[2], 10) || 0;
        }

        const groupOrder: Record<string, number> = { A: 0, B: 1, C: 2 };
        const group = groupOrder[letter] ?? 9;

        const print =
          letter && num
            ? `${letter.toLowerCase()}${num}`
            : base.toLowerCase();

        return { raw, base, up, group, num, print };
      });

    items.sort((a, b) => {
      if (a.group !== b.group) return a.group - b.group;
      if (a.num !== b.num) return a.num - b.num;
      return a.print.localeCompare(b.print);
    });

    return items.map((it) => it.print);
  };

  for (const key of Object.keys(coords)) {
    if (key === "delmal") {
      const maxPerLine = 7;

      const sortedDelmal = Array.isArray(delmal)
        ? normalizeAndSortDelmal(delmal as string[])
        : [];

      if (sortedDelmal.length > 0) {
        // Få delmål: en rad
        if (sortedDelmal.length <= maxPerLine) {
          const base = coords.delmal;
          drawText({
            page,
            text: sortedDelmal.join(", "),
            x: base.x,
            y: base.y,
            size,
            font,
          });
        } else {
          // Många delmål: dela upp på flera rader
          const chunks: string[] = [];
          for (let i = 0; i < sortedDelmal.length; i += maxPerLine) {
            chunks.push(sortedDelmal.slice(i, i + maxPerLine).join(", "));
          }
          const base = coords.delmal;
          const lineHeight = 13;
          const firstY = base.y + lineHeight;
          chunks.forEach((line, idx) => {
            const yLine = firstY - idx * lineHeight;
            drawText({ page, text: line, x: base.x, y: yLine, size, font });
          });
        }
      }
      continue;
    }
    if (key === "period" && isCourse2021) {
      // På kursintyget (Bilaga 10) ska ingen periodrad skrivas ut.
      continue;
    }
    const { x, y } = coords[key];
    drawText({ page, text: values[key] ?? "", x, y, size, font });
  }

}


/* =========================================
   2021 – STa3 (Bilaga 12) – egen exporter
========================================= */

export async function exportSta3Certificate(
  input: {
    profile: Profile;
    supervisor: { name: string; speciality: string; site: string };
    activitiesText: string;
    howVerifiedText: string;
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const bytes = await fetchPublicPdf(TEMPLATE_2021_BILAGA_12);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  const page1 = pages[0];                 // framsida (1/2)
  const page2 = pages[1] ?? pages[0];     // baksida  (2/2); fallback om enkel

  const size = 11;

  const prof = input.profile;
  const nameParts = (prof.name ?? "").trim().split(/\s+/);
  const fallbackFirst = prof.firstName ?? (nameParts[0] ?? "");
  const fallbackLast  = prof.lastName  ?? (nameParts.slice(1).join(" ") || "");
  const profSpecialty = prof.speciality ?? prof.specialty ?? "";

  // ===== SIDA 1: persondel + delmål + aktiviteter =====
  drawText({
    page: page1,
    text: fallbackLast,
    x: coords2021Bil12.efternamn.x,
    y: coords2021Bil12.efternamn.y,
    size,
    font,
  });
  drawText({
    page: page1,
    text: fallbackFirst,
    x: coords2021Bil12.fornamn.x,
    y: coords2021Bil12.fornamn.y,
    size,
    font,
  });
  drawText({
    page: page1,
    text: prof.personalNumber ?? "",
    x: coords2021Bil12.personnummer.x,
    y: coords2021Bil12.personnummer.y,
    size,
    font,
  });
  drawText({
    page: page1,
    text: profSpecialty,
    x: coords2021Bil12.specialitet.x,
    y: coords2021Bil12.specialitet.y,
    size,
    font,
  });

  drawText({
    page: page1,
    text: input.activitiesText ?? "",
    x: coords2021Bil12.aktiviteter.x,
    y: coords2021Bil12.aktiviteter.y,
    size,
    font,
  });

  // ===== SIDA 2: hur det kontrollerats + handledarsektion =====
  drawText({
    page: page2,
    text: input.howVerifiedText ?? "",
    x: coords2021Bil12.hurKontrolleratsText.x,
    y: coords2021Bil12.hurKontrolleratsText.y,
    size,
    font,
  });

  drawText({
    page: page2,
    text: input.supervisor.name ?? "",
    x: coords2021Bil12.namnfortydligande.x,
    y: coords2021Bil12.namnfortydligande.y,
    size,
    font,
  });
  drawText({
    page: page2,
    text: input.supervisor.speciality ?? "",
    x: coords2021Bil12.handledarSpec.x,
    y: coords2021Bil12.handledarSpec.y,
    size,
    font,
  });
  drawText({
    page: page2,
    text: input.supervisor.site ?? "",
    x: coords2021Bil12.handledarTjanstestalle.x,
    y: coords2021Bil12.handledarTjanstestalle.y,
    size,
    font,
  });

  const outBytes = await pdfDoc.save();

  const mode = options?.output ?? "download";
  const filename = options?.filename ?? "intyg-sta3-2021.pdf";

  if (mode === "blob") {
    return new Blob([outBytes], { type: "application/pdf" });
  }

  downloadBytes(outBytes, filename);
  return;
}




/* =========================================
   2021 – BT Bilaga 1–4 (stämpla text i mallen)
========================================= */

function drawWrapped(
  page: any,
  font: any,
  text: string,
  x: number,
  yStart: number,
  maxWidth: number,
  size = 11,
  lineHeight = 14
) {
  if (!text) return yStart;
  const words = String(text).split(/\s+/);
  let line = "";
  let y = yStart;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y, size, font });
      y -= lineHeight;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x, y, size, font });
    y -= lineHeight;
  }
  return y;
}

// — Bilaga 1: Ansökan om intyg om godkänd BT
async function fillBt2021Bilaga1(pdfDoc: PDFDocument, profile: any, activity: any) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const page = pages[0];

  // Säkerställ att det finns en sida 2 för bilagenummer (#-rader)
  if (pdfDoc.getPageCount() < 2) {
    pdfDoc.addPage();
  }
  const attPage = pdfDoc.getPages()[1];

  // ========= Datakällor =========
  // Tillåt både activity.applicant.* och platta fält direkt på activity,
  // samt fallbacks till profile.*
  const a: any = (activity as any)?.applicant ?? activity ?? {};
  const p: any = profile ?? {};

  // Hjälpfunktion: splitta hela namnet till förnamn/efternamn om separata fält saknas
  const splitName = (name: string) => {
    const n = String(name || "").trim().replace(/\s+/g, " ");
    if (!n) return { firstName: "", lastName: "" };
    const parts = n.split(" ");
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts.slice(-1).join(" "),
    };
  };

  const baseName =
    a.name ||
    p.name ||
    "";

  const split = splitName(baseName);

  const firstName =
    String(a.firstName ?? p.firstName ?? "").trim() || split.firstName;

  const lastName =
    String(a.lastName ?? p.lastName ?? "").trim() || split.lastName;

  const personalNumber =
    String(a.personalNumber ?? p.personalNumber ?? "").trim();

  const applicantSpec =
    String(
      a.speciality ??
      a.specialty ??
      (activity as any)?.speciality ??
      (activity as any)?.specialty ??
      p.speciality ??
      p.specialty ??
      ""
    ).trim();

  // ========= Sökande – ÖVERSTA BLOCKET =========
  // Samma layout som övriga 2021-blanketter:
  // Efternamn (vänster, rad 1)
  page.drawText(lastName, {
    x: 76,
    y: 607,
    size: 11,
    font,
  });
  // Förnamn (höger, rad 1)
  page.drawText(firstName, {
    x: 331,
    y: 607,
    size: 11,
    font,
  });
  // Personnummer (vänster, rad 2)
  page.drawText(personalNumber, {
    x: 76,
    y: 569,
    size: 11,
    font,
  });
  // Specialitet som ansökan avser (höger, rad 2)
  page.drawText(applicantSpec, {
    x: 253,
    y: 569,
    size: 11,
    font,
  });

  // ========= Övriga personuppgifter längre ned (adress m.m.) =========
  page.drawText(String(a.address ?? p.address ?? ""), {
    x: 76,
    y: 530,
    size: 11,
    font,
  }); // Adress
  page.drawText(String(a.postalCode ?? p.postalCode ?? ""), {
    x: 76,
    y: 491,
    size: 11,
    font,
  }); // Postnr
  page.drawText(String(a.city ?? p.city ?? ""), {
    x: 193,
    y: 491,
    size: 11,
    font,
  }); // Ort
  page.drawText(String(a.mobile ?? p.mobile ?? ""), {
    x: 76,
    y: 452,
    size: 11,
    font,
  }); // Mobil
  page.drawText(String(a.email ?? p.email ?? ""), {
    x: 232,
    y: 452,
    size: 11,
    font,
  }); // E-post
  page.drawText(String(a.workplace ?? p.homeClinic ?? ""), {
    x: 76,
    y: 414,
    size: 11,
    font,
  }); // Arbetsplats
  page.drawText(String(a.phoneWork ?? p.phoneWork ?? ""), {
    x: 375,
    y: 414,
    size: 11,
    font,
  }); // Telefon arbete

  // ========= Läkarexamen =========
  page.drawText(String(a.medDegreeCountry ?? ""), {
    x: 76,
    y: 263,
    size: 11,
    font,
  }); // Land för läkarexamen
  page.drawText(String(a.medDegreeDate ?? ""), {
    x: 384,
    y: 263,
    size: 11,
    font,
  }); // Datum för läkarexamen

  // ========= Legitimation i andra länder (max 3) =========
  const fl = Array.isArray(a.foreignLicenses) ? a.foreignLicenses.slice(0, 3) : [];
  if (fl[0]) {
    page.drawText(String(fl[0].country || ""), {
      x: 76,
      y: 188,
      size: 11,
      font,
    });
    page.drawText(String(fl[0].date || ""), {
      x: 384,
      y: 188,
      size: 11,
      font,
    });
  }
  if (fl[1]) {
    page.drawText(String(fl[1].country || ""), {
      x: 76,
      y: 149,
      size: 11,
      font,
    });
    page.drawText(String(fl[1].date || ""), {
      x: 384,
      y: 149,
      size: 11,
      font,
    });
  }
  if (fl[2]) {
    page.drawText(String(fl[2].country || ""), {
      x: 76,
      y: 110,
      size: 11,
      font,
    });
    page.drawText(String(fl[2].date || ""), {
      x: 384,
      y: 110,
      size: 11,
      font,
    });
  }

  // ========= Bilagor: beräkna löpnummer per kategori och skriv ENDAST siffror =========
  const collapseRanges = (nums: number[]) => {
    const arr = Array.from(
      new Set(
        nums
          .filter((n) => Number.isFinite(n))
          .map((n) => Math.trunc(n as number))
      )
    ).sort((a, b) => a - b);
    if (arr.length === 0) return "";
    const out: string[] = [];
    let start = arr[0];
    let prev = arr[0];
    for (let i = 1; i < arr.length; i++) {
      const n = arr[i];
      if (n === prev + 1) {
        prev = n;
        continue;
      }
      out.push(start === prev ? String(start) : `${start}-${prev}`);
      start = prev = n;
    }
    out.push(start === prev ? String(start) : `${start}-${prev}`);
    return out.join(", ");
  };

  const attLabels: string[] = Array.isArray(activity?.attachments)
    ? (activity.attachments as string[])
    : [];

  const prefixSavedBt = "Delmål i bastjänstgöringen: Intyg delmål i BT ";
  const isSavedBtCert = (x: string) => {
    const s = String(x).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
    return (
      s.startsWith(prefixSavedBt.toLowerCase()) ||
      s.startsWith("intyg delmål i bt") ||
      s.startsWith("delmål i bt") ||
      s.includes("intyg delmål i bt") ||
      s.includes("delmål i bastjänstgöringen")
    );
  };
  const isFullgjord = (x: string) => x === "Fullgjord bastjänstgöring";
  const isBaskomp = (x: string) => x === "Uppnådd baskompetens";
  const isPrelicense = (x: string) =>
    x.startsWith("Tjänstgöring före legitimation:") ||
    /^Intyg tjänstgöring före legitimation\b/.test(x);
  const isForeign = (x: string) => x.startsWith("Utländsk tjänstgöring");

  const numbered = attLabels.map((label, idx) => ({ no: idx + 1, label }));

  const delmalLine = collapseRanges(
    numbered.filter((x) => isSavedBtCert(x.label)).map((x) => x.no)
  );
  const fullgjordLine = collapseRanges(
    numbered.filter((x) => isFullgjord(x.label)).map((x) => x.no)
  );
  const baskompetensLine = collapseRanges(
    numbered.filter((x) => isBaskomp(x.label)).map((x) => x.no)
  );
  const prelicenseLine = collapseRanges(
    numbered.filter((x) => isPrelicense(x.label)).map((x) => x.no)
  );
  const foreignLine = collapseRanges(
    numbered.filter((x) => isForeign(x.label)).map((x) => x.no)
  );

  // ========= Skriv endast numren på dina märken i PDF:en (på SID 2) =========
  attPage.drawText(String(delmalLine || ""), {
    x: 344,
    y: 717.5,
    size: 11,
    font,
  }); // Delmål i BT
  attPage.drawText(String(fullgjordLine || ""), {
    x: 343,
    y: 686.5,
    size: 11,
    font,
  }); // Fullgjord BT
  attPage.drawText(String(baskompetensLine || ""), {
    x: 343,
    y: 655.5,
    size: 11,
    font,
  }); // Uppnådd baskompetens
  attPage.drawText(String(prelicenseLine || ""), {
    x: 358,
    y: 624.5,
    size: 11,
    font,
  }); // Tjänstgöring före legitimation
  attPage.drawText(String(foreignLine || ""), {
    x: 343,
    y: 593.5,
    size: 11,
    font,
  }); // Utländsk tjänstgöring
}





// — Bilaga 2: Intyg om genomförda delmål i BT
// Skriv ENDAST värden i rutor (inga rubriker/kolon). Rättar logiken för
// “Någon annan än huvudhandledare intygar” och skriver även huvudhandledarens
// namn + specialitet (specialitet = sökandens specialitet).
// — Bilaga 2: Intyg om genomförda delmål i BT
// Skriver endast värden in i rutor (utan rubriker/kolon).
// Rätt logik för “Någon annan än huvudhandledare intygar”.
// Skriver huvudhandledarens NAMN + SPECIALITET (specialitet tas från sökanden).
async function fillBt2021Bilaga2(
  pdfDoc: PDFDocument,
  profile: any,
  activity: any,
  milestones: string[]
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // — Sidor
  const pages = pdfDoc.getPages();
  const page1 = pages[0];            // personuppgifter, delmål, aktiviteter
  const page2 = pages[1] ?? pages[0]; // hur kontrollerats + signer (läggs på sida 2 om den finns)

  // ===== Koordinater =====
  // Sida 1: vänsterkolumn (en kolumn för aktiviteter med radbrytning mellan varje)
  const coords1 = {
    efternamn:   { x: 76,  y: 617 },
    fornamn:     { x: 331, y: 617 },
    personnummer:{ x: 76,  y: 578 },
    delmal:      { x: 76,  y: 520, width: 440, lineHeight: 14 },
    aktiviteter: { x: 76,  y: 454, width: 440, lineHeight: 14 },
  } as const;

  // Sida 2: placera “Hur kontrollerats” och intygsutfärdar/handledare
  const coords2 = {
    hurKontrollerats: { x: 76, y: 718, width: 440, lineHeight: 14 },
    signerNamn:       { x: 76, y: 142 },
    signerWork:       { x: 76, y: 68 },
    signerSpec:       { x: 76, y: 105  },
  } as const;

  // ===== Sökande (sida 1) =====
  const nameStr = String(profile?.name || "").trim();
  const parts = nameStr ? nameStr.split(/\s+/) : [];
  const fallbackFirst = parts[0] || "";
  const fallbackLast  = parts.slice(1).join(" ");

  const fornamn = String(profile?.firstName ?? fallbackFirst);
  const efternamn = String(profile?.lastName ?? fallbackLast);
  const pnr = String(profile?.personalNumber ?? "");
  const applicantSpec = String(profile?.speciality ?? profile?.specialty ?? "");

  page1.drawText(efternamn, { x: coords1.efternamn.x, y: coords1.efternamn.y, size: 11, font });
  page1.drawText(fornamn,   { x: coords1.fornamn.x,   y: coords1.fornamn.y,   size: 11, font });
  page1.drawText(pnr,       { x: coords1.personnummer.x, y: coords1.personnummer.y, size: 11, font });

  // ===== Delmål (sida 1) =====
  const ids = Array.isArray(milestones) ? milestones.filter(Boolean) : [];

  if (ids.length > 0) {
    const maxPerLine = 8; // samma logik som ST: bryt efter 8 delmål
    const chunks: string[] = [];

    for (let i = 0; i < ids.length; i += maxPerLine) {
      chunks.push(ids.slice(i, i + maxPerLine).join(", "));
    }

    const base = coords1.delmal;
    const lineHeight = base.lineHeight ?? 14;

    if (chunks.length === 1) {
      // Få delmål: en rad på "grundnivån"
      page1.drawText(chunks[0], {
        x: base.x,
        y: base.y,
        size: 11,
        font,
      });
    } else {
      // Flera delmål: båda raderna ned 4 px, oförändrat radavstånd
      const firstY = base.y + lineHeight;
      chunks.forEach((line, idx) => {
        const yLine = firstY - idx * lineHeight - 4; // båda raderna 4 px lägre
        page1.drawText(line, {
          x: base.x,
          y: yLine,
          size: 11,
          font,
        });
      });
    }
  }



  // ===== Aktiviteter – en kolumn, radbrytning mellan varje (sida 1) =====
    // ===== Aktiviteter – en kolumn, radbrytning mellan varje (sida 1) =====
  const acts = Array.isArray(activity?.activities) ? activity.activities : [];
  const activitiesTextFallback =
    (activity as any)?.activitiesText ??
    (activity as any)?.btActivitiesText ??
    (activity as any)?.activitiesDescription ??
    null;

  // Fallback: enstaka utbildningsaktivitet direkt från activity-objektet
  const singleActivityTitle = String(
    (activity as any)?.activityTitle ??
    (activity as any)?.title ??
    (activity as any)?.clinic ??
    ""
  ).trim();
  const singleStart = String((activity as any)?.startDate || "").slice(0, 10);
  const singleEnd   = String((activity as any)?.endDate   || "").slice(0, 10);

  if (acts.length) {
    const lines: string[] = [];
    for (const a of acts) {
      const title = String(a?.text || a?.title || "").trim();
      const s = String(a?.startDate || "").slice(0, 10);
      const e = String(a?.endDate || "").slice(0, 10);
      const span = (s || e) ? `${s || "?"} – ${e || "?"}` : "";
      const row = [title, span].filter(Boolean).join(" ").trim();
      if (row) lines.push(row);
    }

    let y = coords1.aktiviteter.y;
    const maxWidth = coords1.aktiviteter.width;
    const lineHeight = coords1.aktiviteter.lineHeight;

    const drawOne = (txt: string) => {
      y = drawWrapped(page1, font, txt, coords1.aktiviteter.x, y, maxWidth, 11, lineHeight);
    };

    for (const line of lines) {
      drawOne(line);
    }
  } else if (activitiesTextFallback) {
    const raw = String(activitiesTextFallback ?? "").trim();
    if (raw) {
      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      let y = coords1.aktiviteter.y;
      const maxWidth = coords1.aktiviteter.width;
      const lineHeight = coords1.aktiviteter.lineHeight;

      const drawOne = (txt: string) => {
        y = drawWrapped(page1, font, txt, coords1.aktiviteter.x, y, maxWidth, 11, lineHeight);
      };

      for (const line of lines) {
        drawOne(line);
      }
    }
  } else if (singleActivityTitle) {
    // Sista fallback: använd titel/klinik + datum direkt från activity
    const span = (singleStart || singleEnd)
      ? `${singleStart || "?"} – ${singleEnd || "?"}`
      : "";
    const row = [singleActivityTitle, span].filter(Boolean).join(" ").trim();

    if (row) {
      let y = coords1.aktiviteter.y;
      const maxWidth = coords1.aktiviteter.width;
      const lineHeight = coords1.aktiviteter.lineHeight;

      y = drawWrapped(page1, font, row, coords1.aktiviteter.x, y, maxWidth, 11, lineHeight);
    }
  }




  // ===== HJÄLP: sanering =====
  const sanitize = (s: any) => {
    const t = String(s ?? "").trim();
    if (!t) return "";
    if (/^(huvudhandledare|handledare|name|namn)$/i.test(t)) return "";
    if (/^(hemklinik|tjänsteställe|tjanstestalle|arbetsplats)$/i.test(t)) return "";
    if (/^(specialitet|speciality|specialty)$/i.test(t)) return "";
    return t;
  };

  // ===== Signer/HH-logik (oförändrad kärnlogik, men skrivs på sida 2) =====
  const _signer = (activity as any)?.signer || {};
  const _explicitUseOther =
    _signer?.useOther === true ||
    (activity as any)?.useOtherSigner === true ||
    (activity as any)?.someoneElseCertifies === true ||
    (activity as any)?.someoneElseSigns === true;
  const _hasOtherData = Boolean(
    (_signer?.name && String(_signer?.name).trim()) ||
    (_signer?.speciality && String(_signer?.speciality).trim()) ||
    (_signer?.specialty && String(_signer?.specialty).trim()) ||
    (_signer?.workplace && String(_signer?.workplace).trim()) ||
    (_signer?.site && String(_signer?.site).trim())
  );
  const _useOther = _explicitUseOther && _hasOtherData;

  const _hhNameFromSignerWhenMain = !_useOther ? sanitize(_signer?.name) : "";
  const _hhNameFallback = sanitize(
    (profile as any)?.supervisor ??
    (profile as any)?.supervisorName ??
    (profile as any)?.mainSupervisorName ??
    (profile as any)?.mainSupervisor?.name ??
    (profile as any)?.btSupervisor ??
    (profile as any)?.btSupervisorName ??
    (profile as any)?.huvudhandledare ??
    (profile as any)?.huvudhandledareNamn ??
    (profile as any)?.handledare ??
    (profile as any)?.handledareNamn ??
    (activity as any)?.mainSupervisorName ??
    (activity as any)?.mainSupervisor?.name ??
    (activity as any)?.supervisorName ??
    (activity as any)?.supervisor ??

    ""
  );
  const mainSupervisorName = _hhNameFromSignerWhenMain || _hhNameFallback;

  const mainSupervisorWorkplace = sanitize(
    ((profile as any)?.supervisorWorkplace && String((profile as any)?.supervisorWorkplace).trim())
      ? (profile as any).supervisorWorkplace
      : (
          ((profile as any)?.form?.supervisorWorkplace && String((profile as any)?.form?.supervisorWorkplace).trim())
            ? (profile as any).form.supervisorWorkplace
            : (
                ((profile as any)?.homeClinic && String((profile as any)?.homeClinic).trim())
                  ? (profile as any).homeClinic
                  : (
                      ((profile as any)?.form?.homeClinic && String((profile as any)?.form?.homeClinic).trim())
                        ? (profile as any).form.homeClinic
                        : (
                            ((profile as any)?.arbetsplats && String((profile as any)?.arbetsplats).trim())
                              ? (profile as any).arbetsplats
                              : (
                                  ((profile as any)?.workplace && String((profile as any)?.workplace).trim())
                                    ? (profile as any).workplace
                                    : (
                                        ((profile as any)?.clinic && String((profile as any)?.clinic).trim())
                                          ? (profile as any).clinic
                                          : ((profile as any)?.homeUnit ?? "")
                                      )
                                )
                          )
                    )
              )
        )
  );


  const mainSupervisorSpecialty = sanitize(
    (profile as any)?.supervisorSpecialty ??
    (profile as any)?.supervisorSpeciality ??
    applicantSpec ??
    ""
  );

  const signerType = String(activity?.signer?.type || "").toUpperCase();
  const explicitOther = signerType === "OTHER" || signerType === "ANNAN" || signerType === "ÖVRIG";
  const rawUseOther =
    explicitOther ||
    activity?.otherSigner === true ||
    activity?.someoneElseCertifies === true ||
    activity?.useOtherSigner === true ||
    activity?.signer?.useOther === true;

  const otherName = sanitize(activity?.signer?.name);
  const otherSpec = sanitize(activity?.signer?.speciality ?? activity?.signer?.specialty);
  const otherSite = sanitize(activity?.signer?.workplace ?? activity?.signer?.site ?? activity?.signer?.tjanstestalle);
  const hasOtherData = Boolean(otherName || otherSpec || otherSite);
  const useOther = rawUseOther && hasOtherData;
  const activitySite = sanitize(
    (activity as any)?.supervisorWorkplace ??
    (activity as any)?.supervisorSite ??
    (activity as any)?.supervisorTjanstestalle ??
    (activity as any)?.site ??
    (activity as any)?.tjanstestalle ??
    ""
  );

  const activitySpecialty = sanitize(
    (activity as any)?.supervisorSpecialty ??
    (activity as any)?.supervisorSpeciality ??
    (activity as any)?.supervisorSpec ??
    ""
  );

  // Direkt-fallback från aktiviteten om mainSupervisorName är tomt
  const hhDirect = sanitize(
    (activity as any)?.signerName ??
    (activity as any)?.signer ??
    (activity as any)?.supervisor ??
    (activity as any)?.supervisorName ??
    ""
  );

  const outName = useOther ? otherName : (mainSupervisorName || hhDirect);

  // Tjänsteställe: samma prioritet som i andra modalen:
  // 1) profile.supervisorWorkplace
  // 2) profile.homeClinic
  // 3) activity.mainSupervisor.workplace (om det finns)
  // 4) activitySite (från aktiviteten)
  // 5) mainSupervisorWorkplace (äldre fallback)
  const outSite = useOther
    ? otherSite
    : sanitize(
        (profile as any)?.supervisorWorkplace ||
        (profile as any)?.homeClinic ||
        (activity as any)?.mainSupervisor?.workplace ||
        activitySite ||
        mainSupervisorWorkplace
      );

  const outSpec = useOther ? otherSpec : (activitySpecialty || mainSupervisorSpecialty);



    // ===== HUR KONTROLLERATS (sida 2) =====
  // Prioritera btAssessment som kommer från detaljrutan i PusslaDinST,
  // men behåll bakåtkompatibla fält som fallback.
  const rawCtrl =
    (activity as any)?.btAssessment ??
    (activity as any)?.controlHow ??
    (activity as any)?.howVerifiedText ??
    (activity as any)?.howVerified ??
    (activity as any)?.controlText ??
    "";
  const ctrl = String(rawCtrl).trim();


  drawWrapped(page2, font, ctrl, coords2.hurKontrollerats.x, coords2.hurKontrollerats.y, coords2.hurKontrollerats.width, 11, coords2.hurKontrollerats.lineHeight);

  // ===== SIGNER/HH (sida 2) =====
  if (outName) page2.drawText(outName, { x: coords2.signerNamn.x, y: coords2.signerNamn.y, size: 11, font });
  if (outSite) page2.drawText(outSite, { x: coords2.signerWork.x, y: coords2.signerWork.y, size: 11, font });
  if (outSpec) page2.drawText(outSpec, { x: coords2.signerSpec.x, y: coords2.signerSpec.y, size: 11, font });
}






// — Bilaga 3: Intyg om fullgjord BT
// ENDAST datapunkter (inga rubriker/kolon).
// Sida 1: efternamn, förnamn, personnummer,
//         samt radvis lista över ALLA kliniska BT-tjänstgöringar
//         där VARJE fält är en separat datapunkt:
//         titel | "start – slut" | syss% | månader (FTE).
// (OBS: tjanststalle/period/syssgrad/totalManFte skrivs INTE i Bilaga 3.)
// Sida 2: två kolumner med TITLAR (primärvård / akutsjukvård),
//         samt intygsutfärdare (VC default, annars “annan”).
async function fillBt2021Bilaga3(pdfDoc: PDFDocument, profile: any, activity: any) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Sidor
  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const page2 = pages[1] ?? pages[0];

  // ===== Koordinater (justeras senare) =====
  // Sida 1: toppfält (enbart namn + pnr)
  const coords1 = {
    efternamn:    { x: 76,  y: 617 },
    fornamn:      { x: 331, y: 617 },
    personnummer: { x: 76,  y: 578 },
    totalMonths:   { x: 440, y: 70 },
  } as const;

  // Sida 1: radlista över ALLA BT-tjänstgöringar (separata datapunkter per kolumn)
  const list1 = {
    startY:     475,     // start-Y för första raden
    lineHeight: 22.5,      // radavstånd
    size:       9,       // mindre text
    // Kolumnkoordinater (separata datapunkter)
    title:    { x: 76,  width: 180 },   // titel
    period:   { x: 235, width: 120 },   // "YYYY-MM-DD – YYYY-MM-DD"
    percent:  { x: 348 },               // "xx%"
    months:   { x: 440 },               // antal månader (FTE)

  } as const;

  // Sida 2: kolumner + signer
  const coords2 = {
    primaryCol:   { x: 76,  y: 765, lineHeight: 14, width: 220 },
    acuteCol:     { x: 76,  y: 462, lineHeight: 14, width: 220 },
    signerNamn:   { x: 76,  y: 105 },
    signerWork:   { x: 76,  y: 66  },
  } as const;

  // ===== Namn + pnr =====
  const nameStr = String(profile?.name || "").trim();
  const parts = nameStr ? nameStr.split(/\s+/) : [];
  const fallbackFirst = parts[0] || "";
  const fallbackLast  = parts.slice(1).join(" ");

  const fornamn = String(profile?.firstName ?? fallbackFirst);
  const efternamn = String(profile?.lastName ?? fallbackLast);
  const pnr = String(profile?.personalNumber ?? "");

  page1.drawText(efternamn,    { x: coords1.efternamn.x,    y: coords1.efternamn.y,    size: 11, font });
  page1.drawText(fornamn,      { x: coords1.fornamn.x,      y: coords1.fornamn.y,      size: 11, font });
  page1.drawText(pnr,          { x: coords1.personnummer.x, y: coords1.personnummer.y, size: 11, font });

  // ===== Rows för listor =====
  const rows = Array.isArray(activity?.rows) ? activity.rows : [];
  const parseDate = (s: any) => (typeof s === "string" ? s.slice(0,10) : "");
  const toStr = (v: any) => String(v ?? "").trim();

  // ===== Sida 1: RADLISTA — separata datapunkter per fält =====
  let yRow = list1.startY;

  for (const r of rows) {
    const title   = toStr(r?.clinic || r?.title);
    const s       = parseDate(r?.startDate);
    const e       = parseDate(r?.endDate);
    const period  = `${s}${s && e ? " – " : ""}${e}`;
    const percent = Number.isFinite(+r?.percent)   ? `${+r.percent}%` : "";
    const months  = Number.isFinite(+r?.monthsFte) ? String(+r.monthsFte) : "";

    if (title) {
      page1.drawText(title, { x: list1.title.x, y: yRow, size: list1.size, font });
    }
    if (period) {
      page1.drawText(period, { x: list1.period.x, y: yRow, size: list1.size, font });
    }
    if (percent) {
      page1.drawText(percent, { x: list1.percent.x, y: yRow, size: list1.size, font });
    }
    if (months) {
      page1.drawText(months, { x: list1.months.x, y: yRow, size: list1.size, font });
    }

    yRow -= list1.lineHeight;
  }

  // ===== Sida 1: SUMMA månader (FTE) som EN datapunkt =====
  const sumMonths = rows.reduce((acc, r) => {
    const v = +r?.monthsFte;
    return Number.isFinite(v) ? acc + v : acc;
  }, 0);
  const sumMonthsStr = String(sumMonths);
  page1.drawText(sumMonthsStr, { x: coords1.totalMonths.x, y: coords1.totalMonths.y, size: 11, font });

  // ===== Sida 2: kolumner med TITLAR (primärvård / akutsjukvård) =====
  const primaryTitles = rows.filter(r => r?.primaryCare).map(r => toStr(r?.clinic || r?.title)).filter(Boolean);
  const acuteTitles   = rows.filter(r => r?.acuteCare).map(r => toStr(r?.clinic || r?.title)).filter(Boolean);


  let yP = coords2.primaryCol.y;
  for (const t of primaryTitles) {
    yP = drawWrapped(page2, font, t, coords2.primaryCol.x, yP, coords2.primaryCol.width, 11, coords2.primaryCol.lineHeight);
  }

  let yA = coords2.acuteCol.y;
  for (const t of acuteTitles) {
    yA = drawWrapped(page2, font, t, coords2.acuteCol.x, yA, coords2.acuteCol.width, 11, coords2.acuteCol.lineHeight);
  }

    // ===== Sida 2: intygsutfärdare (VC som standard, eller “annan”) =====
  const sanitize = (s: any) => String(s ?? "").trim();

  // Hjälpare
  const coerceBool = (v: any) => {
    if (typeof v === "string") {
      const x = v.trim().toLowerCase();
      return x === "true" || x === "1" || x === "on" || x === "yes" || x === "ja";
    }
    return !!v;
  };
  const firstNonEmpty = (...vals: any[]) => {
    for (const v of vals) {
      const s = sanitize(v);
      if (s) return s;
    }
    return "";
  };

  // === 1) Tolkning av kryssruta + roll ===
  // Kryssruta: prioritera vanliga fält; första träff används (även om false).
  const otherFlagRaw =
    (activity?.fullgjordBt?.useOtherSigner ??
     activity?.fullgjordBt?.otherSigner ??
     activity?.signer?.useOther ??
     activity?.useOtherSigner ??
     activity?.signer?.checked ??
     activity?.otherSignerChecked ??
     activity?.signer?.isOther ??
     activity?.signer?.other ??
     activity?.otherThanManager ??
     false);

  const checkedByFlag = coerceBool(otherFlagRaw);

  // Roll: allt som INTE är "manager" räknas som "annan" (t.ex. "appointed", "proxy", "deputy", "alt", "delegerad", "annan")
  const roleRaw = firstNonEmpty(
    activity?.signer?.role,
    activity?.fullgjordBt?.signerRole,
    activity?.signerRole,
    activity?.certifierRole
  ).toLowerCase();
  const roleIsOther = !!roleRaw && roleRaw !== "manager";

  // Slutlig tolkning om "annan" ska gälla
  const otherChecked = checkedByFlag || roleIsOther;

  // === 2) Fält för “annan” – stöd för flera källor inkl. appointedSigner ===
  const otherName = firstNonEmpty(
    activity?.fullgjordBt?.otherSignerName,
    activity?.signer?.name,
    activity?.otherSignerName,
    activity?.appointedSigner?.name
  );
  const otherSite = firstNonEmpty(
    activity?.fullgjordBt?.otherSignerWorkplace,
    activity?.fullgjordBt?.otherSignerSite,
    activity?.fullgjordBt?.otherSignerTjanstestalle,
    activity?.signer?.workplace,
    activity?.signer?.site,
    activity?.signer?.tjanstestalle,
    activity?.otherSignerWorkplace,
    activity?.otherSignerSite,
    activity?.otherSignerTjanstestalle,
    activity?.appointedSigner?.workplace
  );
  const hasOtherFields = Boolean(otherName || otherSite);

  // === 3) VC som standard – breda fallbacks för att alltid få ut något ===
  const vcName = firstNonEmpty(
    profile?.verksamhetschef,
    profile?.managerName,
    profile?.manager,
    profile?.verksamhetschefNamn,
    profile?.studyDirector,
    profile?.supervisor
  );
  const vcSite = firstNonEmpty(
    profile?.homeClinic,
    profile?.arbetsplats,
    profile?.workplace,
    profile?.clinic,
    profile?.homeUnit
  );

  // === 4) Beslut enligt krav ===
  // - Om "annan" signaleras (kryss eller roll) OCH minst ett fält finns -> använd “annan”.
  // - Annars -> använd VC.
  const useOther = otherChecked && hasOtherFields;

  const outName = useOther ? otherName : vcName;
  const outSite = useOther ? otherSite : vcSite;

  // === 5) Rita alltid två datapunkter (inga rubriker/kolon) ===
  page2.drawText(outName ?? "", { x: coords2.signerNamn.x, y: coords2.signerNamn.y, size: 11, font });
  page2.drawText(outSite ?? "", { x: coords2.signerWork.x, y: coords2.signerWork.y, size: 11, font });



}




// — Bilaga 4: Intyg om uppnådd baskompetens
// ENDAST datapunkter (inga rubriker/kolon).
// Robust hämtning av "Extern bedömare" från flera möjliga fältnamn.
async function fillBt2021Bilaga4(pdfDoc: PDFDocument, profile: any, activity: any) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const page1 = pages[0];

  // Hjälpare
  const S = (v: any) => String(v ?? "").trim();
  const firstNonEmpty = (...vals: any[]) => {
    for (const v of vals) {
      const s = S(v);
      if (s) return s;
    }
    return "";
  };

  // Koordinater (justera vid behov efter din PDF-mall)
  const coords4 = {
    // Sökande
    efternamn:    { x: 76,  y: 617 },
    fornamn:      { x: 331, y: 617 },
    personnummer: { x: 76,  y: 578 },

    // Extern bedömare (översta signatursektionen)
    extName:      { x: 76,  y: 240 },
    extSpec:      { x: 76,  y: 200 },
    extSite:      { x: 76,  y: 162 },

    // Huvudhandledare (nedre signatursektionen)
    hhName:       { x: 76,  y: 445 },
    hhSpec:       { x: 76,  y: 407 },
    hhSite:       { x: 76,  y: 369 },
  } as const;

  // Sökande – endast värden
  const nameParts = (profile?.name ?? "").trim().split(/\s+/);
  const fallbackFirst = profile?.firstName ?? (nameParts[0] ?? "");
  const fallbackLast  = profile?.lastName  ?? (nameParts.slice(1).join(" ") || "");
  const pnr           = S(profile?.personalNumber);

  page1.drawText(fallbackLast,  { x: coords4.efternamn.x,    y: coords4.efternamn.y,    size: 11, font });
  page1.drawText(fallbackFirst, { x: coords4.fornamn.x,      y: coords4.fornamn.y,      size: 11, font });
  page1.drawText(pnr,           { x: coords4.personnummer.x, y: coords4.personnummer.y, size: 11, font });

  // ======================
  // Extern bedömare – robusta källor
  // ======================
  // Tillåt alternativa fält på activity:
  //  - externAssessor / externalAssessor / extern / external / assessor / externBedomare / externalReviewer
  //  - inbäddat i btCompetence.externAssessor
  let extObj: any =
    activity?.externAssessor ??
    (activity as any)?.externalAssessor ??
    (activity as any)?.extern ??
    (activity as any)?.external ??
    (activity as any)?.assessor ??
    (activity as any)?.externBedomare ??
    (activity as any)?.externalReviewer ??
    (activity as any)?.btCompetence?.externAssessor ??
    null;

  // Fallback: hämta direkt från profilens BT-fält om inget objekt finns
  if (!extObj || (typeof extObj === "object" && Object.keys(extObj).length === 0)) {
    extObj = {
      name: (profile as any)?.btExtAssessorName ?? "",
      speciality:
        (profile as any)?.btExtAssessorSpec ??
        (profile as any)?.btExtAssessorSpeciality ??
        "",
      specialty:
        (profile as any)?.btExtAssessorSpec ??
        (profile as any)?.btExtAssessorSpecialty ??
        "",
      workplace:
        (profile as any)?.btExtAssessorWorkplace ??
        (profile as any)?.btExtAssessorSite ??
        "",
      site:
        (profile as any)?.btExtAssessorWorkplace ??
        (profile as any)?.btExtAssessorSite ??
        "",
    };
  }


  // Namn: stöd även för platta fält (t.ex. externAssessorName)
  const extName = firstNonEmpty(
    (extObj as any)?.name,
    (activity as any)?.externAssessorName,
    (activity as any)?.externalAssessorName,
    (activity as any)?.assessorName,
    (activity as any)?.externBedomareNamn
  );

  // Specialitet: speciality/specialty samt platta alias
  const extSpec = firstNonEmpty(
    (extObj as any)?.speciality,
    (extObj as any)?.specialty,
    (activity as any)?.externAssessorSpeciality,
    (activity as any)?.externAssessorSpecialty,
    (activity as any)?.externalAssessorSpeciality,
    (activity as any)?.externalAssessorSpecialty,
    (activity as any)?.assessorSpeciality,
    (activity as any)?.assessorSpecialty
  );

  // Tjänsteställe/arbetsplats/site
  const extSite = firstNonEmpty(
    (extObj as any)?.workplace,
    (extObj as any)?.site,
    (extObj as any)?.tjanstestalle,
    (activity as any)?.externAssessorWorkplace,
    (activity as any)?.externAssessorSite,
    (activity as any)?.externAssessorTjanstestalle,
    (activity as any)?.externalAssessorWorkplace,
    (activity as any)?.externalAssessorSite,
    (activity as any)?.externalAssessorTjanstestalle,
    (activity as any)?.assessorWorkplace,
    (activity as any)?.assessorSite,
    (activity as any)?.assessorTjanstestalle
  );

  page1.drawText(extName, { x: coords4.extName.x, y: coords4.extName.y, size: 11, font });
  page1.drawText(extSpec, { x: coords4.extSpec.x, y: coords4.extSpec.y, size: 11, font });
  page1.drawText(extSite, { x: coords4.extSite.x, y: coords4.extSite.y, size: 11, font });

  // ======================
  // Huvudhandledare – endast värden, med breda fallbacks
  // ======================
  const main = activity?.mainSupervisor ?? (activity as any)?.btCompetence?.mainSupervisor ?? {};

  const hhName = firstNonEmpty(
    (main as any)?.name,
    profile?.supervisor,
    (profile as any)?.supervisorName,
    (profile as any)?.mainSupervisorName
  );

  const hhSpec = firstNonEmpty(
    (main as any)?.speciality,
    (main as any)?.specialty,
    profile?.speciality,
    profile?.specialty
  );

  const hhSite = firstNonEmpty(
    (main as any)?.workplace,
    (main as any)?.site,
    (main as any)?.tjanstestalle,
    profile?.supervisorWorkplace,
    profile?.homeClinic
  );

  page1.drawText(hhName, { x: coords4.hhName.x, y: coords4.hhName.y, size: 11, font });
  page1.drawText(hhSpec, { x: coords4.hhSpec.x, y: coords4.hhSpec.y, size: 11, font });
  page1.drawText(hhSite, { x: coords4.hhSite.x, y: coords4.hhSite.y, size: 11, font });
}



/* =========================================
   2015 – Generisk fyllare (använder respektive coords)
========================================= */

async function export2015Generic(
  pdfDoc: PDFDocument,
  coords: Record<string, { x: number; y: number }>,
  profile: Profile,
  activity: Placement
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
const page = pages[0];

// Säkerställ att det finns en sida 2 för bilagor (#-lista)
if (pdfDoc.getPageCount() < 2) {
  pdfDoc.addPage();
}
const attPage = pdfDoc.getPages()[1];

  const size = 11;

  const nameParts = (profile.name ?? "").trim().split(/\s+/);

  // Förnamn
  const fallbackFirst =
    profile.firstName ??
    (profile as any).givenName ??
    (nameParts[0] ?? "");

  // Efternamn
  const fallbackLast =
    profile.lastName ??
    (profile as any).surname ??
    (nameParts.slice(1).join(" ") || "");

  // Personnummer
  const fallbackPn =
    profile.personalNumber ?? "";

  // Specialitet
  const fallbackSpec =
    profile.speciality ??
    profile.specialty ??
    "";

  const profSpecialty = profile.speciality ?? profile.specialty ?? "";

const site =
  (activity as any).site
  ?? activity.title
  ?? (activity as any).clinic
  ?? profile.homeClinic
  ?? "";

  const period =
    activity.startDate && activity.endDate
      ? `${activity.startDate.replaceAll("-", "")} – ${activity.endDate.replaceAll("-", "")}`
      : "";

  const values: Record<string, string> = {
  efternamn: fallbackLast,
  fornamn: fallbackFirst,
  personnummer: (profile as any).personalNumber ?? "",
  specialitet: profSpecialty,

  // Aktivitetsspecifikt (undvik dublett mellan titel och plats)
  titel:
    (((activity as any).title ?? "").trim().toLowerCase() ===
     (((activity as any).clinic ?? (activity as any).site ?? "").trim().toLowerCase()))
      ? ""
      : ((activity as any).title ?? ""),
  plats: (activity as any).clinic ?? (activity as any).site ?? "",
  period:
    (activity as any).startDate && (activity as any).endDate
      ? `${(activity as any).startDate} – ${(activity as any).endDate}`
      : "",
  beskrivning:
    ((activity as any).description ??
     (activity as any).desc ??
     (activity as any).notes ??
     (activity as any).note ??
     (activity as any).summary ??
     (activity as any).text ??
     "") as string,


  // Signaturdel (ingen hemklinik för sökande)
  handledare: (activity as any).supervisor ?? "",
  handledarSpec: (activity as any).supervisorSpeciality ?? (activity as any).supervisorSpecialty ?? "",
  handledarTjanstestalle: (activity as any).supervisorSite ?? "",

  // Lämnas tomt – skrivs vid behov i Bilaga 1
  bilagaNr: "",
};


    const normalizeAndSortDelmal = (input: string[]): string[] => {
    const items = (input || [])
      .map((d) => String(d ?? "").trim())
      .filter((d) => d.length > 0)
      .map((raw) => {
        // Plocka ut själva koden (före ev. beskrivning), samma princip som i UI
        const base = raw.split(/\s|–|-|:|\u2013/)[0];
        const up = base.toUpperCase().replace(/\s/g, "");

        // Stöd både "A1/B2/C3" och "STa1/STb2/STc3"
        const m =
          up.match(/^ST([ABC])(\d+)$/) ||
          up.match(/^([ABC])(\d+)$/);

        let letter = "";
        let num = 0;

        if (m) {
          letter = m[1];
          num = parseInt(m[2], 10) || 0;
        }

        const groupOrder: Record<string, number> = { A: 0, B: 1, C: 2 };
        const group = groupOrder[letter] ?? 9;

        const print =
          letter && num
            ? `${letter.toLowerCase()}${num}`
            : base.toLowerCase();

        return { raw, base, up, group, num, print };
      });

    items.sort((a, b) => {
      if (a.group !== b.group) return a.group - b.group;
      if (a.num !== b.num) return a.num - b.num;
      return a.print.localeCompare(b.print);
    });

    return items.map((it) => it.print);
  };

  for (const key of Object.keys(coords)) {
    const { x, y } = coords[key];
    const text = values[key] ?? "";
    page.drawText(text, { x, y, size, font });
  }

  if (Array.isArray(delmalCodes) && delmalCodes.length > 0) {
    const sortedCodes = normalizeAndSortDelmal(delmalCodes);
    page.drawText(sortedCodes.join(", "), { x: delmalPos.x, y: delmalPos.y, size, font });
  }
}


/* =========================================
   Central exporter – väljer template + coords
========================================= */

export async function exportCertificate(
  input: ExportInput,
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const outputMode = options?.output ?? "download";
  const outName = options?.filename;

  const { goalsVersion, activityType, profile, activity, milestones = [] } = input;

  if (goalsVersion === "2021") {
    // STa3 (SKRIFTLIGT_ARBETE) ska skapas via popup → exportSta3Certificate
    if (activityType === "SKRIFTLIGT_ARBETE") {
      throw new Error("STa3-intyg (2021) skapas via 'Förbered intyg för STa3'-popupen.");
    }

    // === BT (Bilaga 1–4) – använd faktiska mallar och stämpla in data ===
    if (
      activityType === "BT_GOALS" ||
      activityType === "BT_FULLGJORD" ||
      activityType === "BT_KOMPETENS" ||
      activityType === "BT_ANSOKAN"
    ) {
      // 1) Välj template
      const templatePath =
        activityType === "BT_ANSOKAN"   ? TEMPLATE_2021_BILAGA_1 :
        activityType === "BT_GOALS"     ? TEMPLATE_2021_BILAGA_2 :
        activityType === "BT_FULLGJORD" ? TEMPLATE_2021_BILAGA_3 :
                                          TEMPLATE_2021_BILAGA_4; // BT_KOMPETENS

      // 2) Ladda & rensa widgets
      const bytes = await fetchPublicPdf(templatePath);
      const pdfDoc = await PDFDocument.load(bytes);

      try {
        const firstPage = pdfDoc.getPages()[0]!;
        // @ts-ignore
        const annots = firstPage.node.get(PDFName.of("Annots"));
        if (annots) {
          // @ts-ignore
          firstPage.node.set(PDFName.of("Annots"), pdfDoc.context.obj([]));
        }
        // @ts-ignore
        const acroForm = pdfDoc.catalog.get(PDFName.of("AcroForm"));
        if (acroForm) {
          // @ts-ignore
          pdfDoc.catalog.set(PDFName.of("AcroForm"), pdfDoc.context.obj({}));
        }
      } catch {}

      // 3) Stämpla respektive intyg
      if (activityType === "BT_ANSOKAN") {
        await fillBt2021Bilaga1(pdfDoc, profile as any, activity as any);
      } else if (activityType === "BT_GOALS") {
        await fillBt2021Bilaga2(pdfDoc, profile as any, activity as any, milestones);
      } else if (activityType === "BT_FULLGJORD") {
        await fillBt2021Bilaga3(pdfDoc, profile as any, activity as any);
      } else {
        await fillBt2021Bilaga4(pdfDoc, profile as any, activity as any); // BT_KOMPETENS
      }

      // 4) Spara/returnera
      const outBytes = await pdfDoc.save();
      if (outputMode === "blob") {
        return new Blob([outBytes], { type: "application/pdf" });
      }
      downloadBytes(outBytes, outName ?? `intyg-${String(activityType).toLowerCase()}-2021.pdf`);
      return;
    }

    // === ST (Bilaga 8–11) – generisk fyllning ===
    let templatePath: string;
    let coords:
      | typeof coords2021Bil8
      | typeof coords2021Bil9
      | typeof coords2021Bil10
      | typeof coords2021Bil11;

    switch (activityType) {
      case "PLACERING":
        templatePath = TEMPLATE_2021_BILAGA_9;
        coords = coords2021Bil9;
        break;
      case "AUSKULTATION":
        templatePath = TEMPLATE_2021_BILAGA_8;
        coords = coords2021Bil8;
        break;
      case "KURS":
        templatePath = TEMPLATE_2021_BILAGA_10;
        coords = coords2021Bil10;
        break;
      case "KVALITETSARBETE":
        templatePath = TEMPLATE_2021_BILAGA_11;
        coords = coords2021Bil11;
        break;
      default:
        throw new Error(`Export ej implementerad för 2021 + ${activityType}`);
    }

    const bytes = await fetchPublicPdf(templatePath);
    const pdfDoc = await PDFDocument.load(bytes);

    // --- Viktigt: ta bort annoteringar (t.ex. checkbox-widgets) så X syns ovanpå ---
    try {
      const firstPage = pdfDoc.getPages()[0]!;
      // @ts-ignore – pdf-lib låg-nivå API
      const annots = firstPage.node.get(PDFName.of("Annots"));
      if (annots) {
        // Töm sidans annoteringar
        // @ts-ignore
        firstPage.node.set(PDFName.of("Annots"), pdfDoc.context.obj([]));
      }
      // Rensa ev. dokument-AcroForm (widgets renderas annars överst)
      // @ts-ignore
      const acroForm = pdfDoc.catalog.get(PDFName.of("AcroForm"));
      if (acroForm) {
        // @ts-ignore
        pdfDoc.catalog.set(PDFName.of("AcroForm"), pdfDoc.context.obj({}));
      }
    } catch {}

    // Anpassningar för 2021-bilagor innan generisk fyllning
    let activityForExport = activity;

    // Bilaga 11 (Förbättringsarbete): ämne = title, ingen period
    if (activityType === "KVALITETSARBETE") {
      activityForExport = { ...activity, site: activity.title ?? "", startDate: "", endDate: "" } as any;
    }

    // Bilaga 10 (Kurs): signer från popup → supervisor-fält
    if (activityType === "KURS") {
      const signer = (activity as any).signer as
        | { type: "KURSLEDARE"; name?: string; site?: string; speciality?: string }
        | { type: "HANDLEDARE"; name?: string; site?: string; speciality?: string; personalNumber?: string }
        | undefined;

      const clName = (activity as any).courseLeaderName ?? "";
      const clSite = (activity as any).courseLeaderSite ?? "";
      const clSpec = (activity as any).courseLeaderSpeciality
                  ?? (activity as any).courseLeaderSpecialty
                  ?? "";

      const isCourseLeaderSigner = signer?.type === "KURSLEDARE";

      activityForExport = {
  ...activity,

  // Viktigt: tala om för fill2021Generic att detta är ett kursintyg
  activityType: "KURS",

  supervisor: isCourseLeaderSigner ? clName : (signer?.name ?? ""),
  supervisorSite: isCourseLeaderSigner ? clSite : (signer?.site ?? ""),
  supervisorSpeciality: isCourseLeaderSigner ? clSpec : ((signer as any)?.speciality ?? ""),
  supervisorSpecialty:  isCourseLeaderSigner ? clSpec : ((signer as any)?.speciality ?? ""),
  supervisorPn: signer?.type === "HANDLEDARE" ? (signer as any).personalNumber ?? "" : "",
} as any;

    }

    await fill2021Generic(pdfDoc, coords, profile, activityForExport, milestones);

    // Efter fyllningen: Bilaga 10 behöver ett kryss på rätt ruta
    if (activityType === "KURS") {
      const pagesForX = pdfDoc.getPages();
      const pageForX = pagesForX[0];
      const signerType = (activity as any).signer?.type;

      const fontX = await pdfDoc.embedFont(StandardFonts.Helvetica);
      if (signerType === "KURSLEDARE" && (coords as any).kursledareX) {
        drawText({ page: pageForX, text: "X", x: (coords as any).kursledareX.x, y: (coords as any).kursledareX.y, size: 11, font: fontX });
      }
      if (signerType === "HANDLEDARE" && (coords as any).handledareX) {
        drawText({ page: pageForX, text: "X", x: (coords as any).handledareX.x, y: (coords as any).handledareX.y, size: 11, font: fontX });
      }
    }

    const outBytes = await pdfDoc.save();
    if (outputMode === "blob") {
      return new Blob([outBytes], { type: "application/pdf" });
    }
    downloadBytes(outBytes, outName ?? `intyg-${activityType.toLowerCase()}-2021.pdf`);
    return;
  } else     if (goalsVersion === "2015") {

    let templatePath: string;
    let coords:
      | typeof coords2015Placering
      | typeof coords2015Auskultation
      | typeof coords2015Skriftligt
      | typeof coords2015Kvalitet
      | typeof coords2015Kurs;

    switch (activityType) {
      case "PLACERING":
        templatePath = TEMPLATE_2015_PLACERING;
        coords = coords2015Placering;
        break;
      case "AUSKULTATION":
        templatePath = TEMPLATE_2015_AUSKULTATION;
        coords = coords2015Auskultation;
        break;
      case "SKRIFTLIGT_ARBETE":
        templatePath = TEMPLATE_2015_SKRIFTLIGT;
        coords = coords2015Skriftligt;
        break;
      case "KVALITETSARBETE":
        templatePath = TEMPLATE_2015_KVALITET;
        coords = coords2015Kvalitet;
        break;
      case "KURS":
        templatePath = TEMPLATE_2015_KURS;
        coords = coords2015Kurs;
        break;
      default:
        throw new Error(`Export ej implementerad för 2015 + ${activityType}`);
    }

    const bytes = await fetchPublicPdf(templatePath);
    const pdfDoc = await PDFDocument.load(bytes);

    // --- Viktigt: ta bort annoteringar (t.ex. checkbox-widgets) så X syns ovanpå ---
    try {
      const firstPage = pdfDoc.getPages()[0]!;
      // @ts-ignore – pdf-lib låg-nivå API
      const annots = firstPage.node.get(PDFName.of("Annots"));
      if (annots) {
        // Töm sidans annoteringar
        // @ts-ignore
        firstPage.node.set(PDFName.of("Annots"), pdfDoc.context.obj([]));
      }
      // Rensa ev. dokument-AcroForm (widgets renderas annars överst)
      // @ts-ignore
      const acroForm = pdfDoc.catalog.get(PDFName.of("AcroForm"));
      if (acroForm) {
        // @ts-ignore
        pdfDoc.catalog.set(PDFName.of("AcroForm"), pdfDoc.context.obj({}));
      }
    } catch {}


// Anpassningar för 2021-bilagor innan generisk fyllning
let activityForExport = activity;

// Bilaga 11 (Förbättringsarbete): ämne = title, ingen period
if (activityType === "KVALITETSARBETE") {
  activityForExport = { ...activity, site: activity.title ?? "", startDate: "", endDate: "" } as any;
}

    // Bilaga 10 (Kurs): signer från popup → supervisor-fält
    // 2015: Om KURSLEDARE signerar ska signaturraden fyllas med kursledarens uppgifter från kurssidan,
    // annars fylls signaturraden med handledarens uppgifter från popupen.
    if (activityType === "KURS") {
      const signer = (activity as any).signer as
        | { type: "KURSLEDARE"; name?: string; site?: string; speciality?: string }
        | { type: "HANDLEDARE"; name?: string; site?: string; speciality?: string; personalNumber?: string }
        | undefined;

      const clNameRaw = (activity as any).courseLeaderName ?? "";
      const clSite = (activity as any).courseLeaderSite ?? "";
      const clSpec = (activity as any).courseLeaderSpeciality
                  ?? (activity as any).courseLeaderSpecialty
                  ?? "";

      const isCourseLeaderSigner = signer?.type === "KURSLEDARE";

      activityForExport = {
        ...activity,

        // Namn på signaturraden:
        supervisor: isCourseLeaderSigner ? clNameRaw : (signer?.name ?? ""),

        // Tjänsteställe på signaturraden:
        supervisorSite: isCourseLeaderSigner ? clSite : (signer?.site ?? ""),

        // Specialitet på signaturraden:
        supervisorSpeciality: isCourseLeaderSigner ? clSpec : ((signer as any)?.speciality ?? ""),
        supervisorSpecialty:  isCourseLeaderSigner ? clSpec : ((signer as any)?.speciality ?? ""),

        // 2015: personnummer används inte på kursintyget
        supervisorPn: signer?.type === "HANDLEDARE" ? (signer as any).personalNumber ?? "" : "",

      } as any;
    }


await fill2021Generic(pdfDoc, coords, profile, activityForExport, milestones);

// Efter fyllningen: Bilaga 10 behöver ett kryss på rätt ruta
if (activityType === "KURS") {
  const pagesForX = pdfDoc.getPages();
  const pageForX = pagesForX[0];

  // Använd samma basobjekt som i 2015-exporten
  const base: any = activityForExport ?? (activity as any);
  const signerType = base.signer?.type;

  const fontX = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const size = 11;

  // === Ämne (titel på kurs) – ritas alltid om det finns ämnestext ===
  if ((coords as any).amne) {
    const subjectCandidates: string[] = [];

    const pushCandidate = (val: unknown) => {
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed) subjectCandidates.push(trimmed);
      }
    };

    pushCandidate(base.title);
    pushCandidate(base.name);
    pushCandidate((base as any).courseTitle);
    pushCandidate((base as any).courseName);
    pushCandidate((base as any).label);
    pushCandidate((base as any).subject);

    const subject = subjectCandidates[0] ?? "";

    if (subject) {
      drawText({
        page: pageForX,
        text: subject,
        x: (coords as any).amne.x,
        y: (coords as any).amne.y,
        size,
        font: fontX,
      });
    }
  }

  // Rita kryss i rutan ”Intygas av”
  if (signerType === "KURSLEDARE" && (coords as any).kursledareX) {
    drawText({
      page: pageForX,
      text: "X",
      x: (coords as any).kursledareX.x,
      y: (coords as any).kursledareX.y,
      size,
      font: fontX,
    });
  }
  if (signerType === "HANDLEDARE" && (coords as any).handledareX) {
    drawText({
      page: pageForX,
      text: "X",
      x: (coords as any).handledareX.x,
      y: (coords as any).handledareX.y,
      size,
      font: fontX,
    });
  }

  // Kursledarens namn – alltid minst EN gång (kursfältet),
  // och en ANDRA gång endast om Kursledare är signer.
  let clName = "";
  if (typeof base.courseLeaderName === "string") {
    clName = base.courseLeaderName.trim();
  }
  if (!clName && signerType === "KURSLEDARE") {
    clName = String(base.signer?.name ?? "").trim();
  }

  // Första förekomsten (visas alltid om coords finns och vi har ett namn):
  if ((coords as any).kursledare1 && clName) {
    drawText({
      page: pageForX,
      text: clName,
      x: (coords as any).kursledare1.x,
      y: (coords as any).kursledare1.y,
      size,
      font: fontX,
    });
  }

  // Andra förekomsten: endast om Kursledare är signer
  if (signerType === "KURSLEDARE" && (coords as any).kursledare2 && clName) {
    drawText({
      page: pageForX,
      text: clName,
      x: (coords as any).kursledare2.x,
      y: (coords as any).kursledare2.y,
      size,
      font: fontX,
    });
  }
}

    const outBytes = await pdfDoc.save();
    if (outputMode === "blob") {
      return new Blob([outBytes], { type: "application/pdf" });
    }
    downloadBytes(outBytes, outName ?? `intyg-${activityType.toLowerCase()}-2015.pdf`);
    return;
  }

  throw new Error(`Okänd målversion: ${goalsVersion}`);
}

async function export2015GenericWithDelmal(

  pdfDoc: PDFDocument,
  coords: Record<string, { x: number; y: number }>,
  profile: Profile,
  activity: Placement,
  delmalCodes: string[]
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];
  const size = 11;

  const nameParts = (profile.name ?? "").trim().split(/\s+/);
  const fallbackFirst = (profile as any).firstName ?? (nameParts[0] ?? "");
  const fallbackLast  = (profile as any).lastName  ?? (nameParts.slice(1).join(" ") || "");
  const profSpecialty = (profile as any).speciality ?? (profile as any).specialty ?? "";

  const delmalPos = (coords as any).delmal ?? { x: 80, y: 545 };

  const values: Record<string, string> = {
    efternamn: fallbackLast,
    fornamn: fallbackFirst,
    personnummer: (profile as any).personalNumber ?? "",
    specialitet: profSpecialty,

    // === 2015 Kurs =========
    // Ämne = Kurstitel (med robust fallback)
    amne:
      (((activity as any).title ?? "").trim() ||
       ((activity as any).name ?? "").trim() ||
       ((activity as any).courseTitle ?? "").trim()) || "",

    // Kursledare – själva namnet ritas i efter-steg (se ovan),
    // men specialitet och tjänsteställe fylls här.
    // Namnet hamnar alltid i mitten (kursledare1),
    // och dessutom längst ned om Kursledare också är signer.
    kursledare1: "",
    kursledare2: "",
    kursledarSpec:
      (activity as any).courseLeaderSpeciality ??
      (activity as any).courseLeaderSpecialty ??
      "",
    kursledarTjanstestalle:
      (activity as any).courseLeaderSite ??
      "",

    // Aktivitetsspecifikt (övriga blanketter)
    titel:
      (((activity as any).title ?? "").trim().toLowerCase() ===
       (((activity as any).clinic ?? (activity as any).site ?? "").trim().toLowerCase()))
        ? ""
        : ((activity as any).title ?? ""),
    plats: (activity as any).clinic ?? (activity as any).site ?? "",
    period:
      (activity as any).startDate && (activity as any).endDate
        ? `${(activity as any).startDate} – ${(activity as any).endDate}`
        : "",

    // Robust beskrivning (fångar notes/note/description/etc.)
    beskrivning:
      ((activity as any).description ??
       (activity as any).desc ??
       (activity as any).notes ??
       (activity as any).note ??
       (activity as any).summary ??
       (activity as any).text ??
       "") as string,

    // Signaturdel – handledare (kan vara tomma om kursledare signerar)
    handledare: (activity as any).supervisor ?? "",
    handledarSpec:
      (activity as any).supervisorSpeciality ??
      (activity as any).supervisorSpecialty ??
      "",
    handledarTjanstestalle: (activity as any).supervisorSite ?? "",

    // Bilaga 1 (lämnas tom)
    bilagaNr: "",
  };




  for (const key of Object.keys(coords)) {
    const { x, y } = coords[key];
    const text = values[key] ?? "";
    page.drawText(text, { x, y, size, font });
  }

  if (Array.isArray(delmalCodes) && delmalCodes.length > 0) {
    const normalizedCodes = delmalCodes.map(d => String(d).toLowerCase());
    // Sortera a/b/c-delmål: a1..aN, b1..bN, c1..cN
    const sortedCodes = [...normalizedCodes].sort((a, b) => {
      const re = /^([abc])(\d+)$/i;
      const ma = re.exec(a);
      const mb = re.exec(b);
      if (ma && mb) {
        const groupOrder: Record<string, number> = { a: 0, b: 1, c: 2 };
        const ga = groupOrder[ma[1].toLowerCase()] ?? 99;
        const gb = groupOrder[mb[1].toLowerCase()] ?? 99;
        if (ga !== gb) return ga - gb;
        const na = parseInt(ma[2], 10);
        const nb = parseInt(mb[2], 10);
        if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
        return a.localeCompare(b);
      }
      return a.localeCompare(b);
    });

    page.drawText(sortedCodes.join(", "), { x: delmalPos.x, y: delmalPos.y, size, font });
  }
}


// ===== BT (2021) – enkla PDF-genereringar för fungerande förhandsvisning =====



// ===== BT (2021) – enkla PDF-genereringar för fungerande förhandsvisning =====
// Dessa gör en ren A4-sida med rubrik + listad nyckelinformation.
// När du vill kan vi byta till exakta mallar/koordinater.

async function exportBt2021(
  kind: "BT_GOALS" | "BT_FULLGJORD" | "BT_KOMPETENS" | "BT_ANSOKAN",
  profile: any,
  activity: any,
  milestones: string[]
): Promise<Blob> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 (pt)
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const lh = 16;

  // Gemensam header
  y = drawHeaderBlock(page, bold, font, y, "Bastjänstgöring (HSLF-FS 2021:8)", lh);
  page.drawText(`Namn: ${profile?.name || ""}`, { x: 40, y, size: 11, font }); y -= lh;
  page.drawText(`Personnummer: ${profile?.personalNumber || ""}`, { x: 40, y, size: 11, font }); y -= lh;
  page.drawText(`Arbetsplats: ${profile?.homeClinic || ""}`, { x: 40, y, size: 11, font }); y -= lh * 2;

  if (kind === "BT_GOALS") {
    page.drawText("Intyg – Delmål i BT", { x: 40, y, size: 14, font: bold }); y -= lh * 1.5;

    const ids = Array.isArray(milestones) ? milestones : [];
    page.drawText(`Delmål: ${ids.join(", ") || "—"}`, { x: 40, y, size: 11, font }); y -= lh;

    const acts = Array.isArray(activity?.activities) ? activity.activities : [];
    if (acts.length) {
      y -= lh * 0.5;
      page.drawText("Aktiviteter:", { x: 40, y, size: 12, font: bold }); y -= lh;
      for (const a of acts) {
        const txt = String(a?.text || "Aktivitet");
        const s = (a?.startDate || "")?.slice?.(0, 10);
        const e = (a?.endDate || "")?.slice?.(0, 10);
        const row = `• ${txt}${s || e ? ` (${s || "?"} – ${e || "?"})` : ""}`;
        page.drawText(row, { x: 48, y, size: 11, font });
        y -= lh;
        if (y < 60) { y = 760; page.addPage(); }
      }
      y -= lh * 0.5;
    }

    const ctrl = String(activity?.controlHow || "").trim();
    if (ctrl) {
      page.drawText("Hur kontrollerat:", { x: 40, y, size: 12, font: bold }); y -= lh;
      page.drawText(ctrl, { x: 48, y, size: 11, font }); y -= lh;
    }

      // --- Intygsutfärdare & huvudhandledare (BT Bilaga 2) ---
  // Regler:
  // - Om "Någon annan än huvudhandledare utfärdar intyg" är ikryssad → använd activity.signer
  // - Annars använd huvudhandledare från profil/aktivitet
  //
  // Vi försöker vara robusta mot olika fältnamn.

  // 1) Huvudhandledare (primary fallback-källa)
  // Huvudhandledare – primärt från profilens "supervisor"
  const mainName =
    (profile as any)?.supervisor ??
    (profile as any)?.form?.supervisor ??
    (activity as any)?.mainSupervisor?.name ??
    (profile as any)?.mainSupervisorName ??
    (profile as any)?.supervisorName ??
    (profile as any)?.handledareName ??
    "";


  // Specialitet för HH = sökandens specialitet (krav), med några toleranta fallbacks
  const mainSpec =
    (profile as any)?.speciality ??
    (profile as any)?.specialty ??
    (activity as any)?.mainSupervisor?.speciality ??
    (activity as any)?.mainSupervisor?.specialty ??
    (profile as any)?.mainSupervisorSpeciality ??
    (profile as any)?.mainSupervisorSpecialty ??
    (profile as any)?.supervisorSpeciality ??
    (profile as any)?.supervisorSpecialty ??
    "";

  // Tjänsteställe – använd "supervisorWorkplace" om angivet, annars hemklinik (krav)
  const mainSite =
    (profile as any)?.supervisorWorkplace && String((profile as any).supervisorWorkplace).trim()
      ? (profile as any).supervisorWorkplace
      : (
          (profile as any)?.form?.supervisorWorkplace && String((profile as any).form.supervisorWorkplace).trim()
            ? (profile as any).form.supervisorWorkplace
            : (
                (activity as any)?.mainSupervisor?.workplace ??
                (profile as any)?.mainSupervisorSite ??
                (profile as any)?.supervisorSite ??
                (profile as any)?.handledareSite ??
                (profile as any)?.homeClinic ??
                ""
              )
        );



  // 2) Alternativ intygsutfärdare (från popupen i modalen)
  const otherSigner = (activity as any)?.signer || {};
  const otherName = otherSigner?.name ?? "";
  const otherSpec =
    otherSigner?.speciality ??
    otherSigner?.specialty ??
    "";
  const otherSite = otherSigner?.workplace ?? otherSigner?.site ?? "";

  // 3) Flagga om "Någon annan än huvudhandledare utfärdar intyg" är ikryssad
  //    (stöd för flera möjliga fält)
  const useOther =
    (activity as any)?.useOtherSigner === true ||
    (activity as any)?.someoneElseSigns === true ||
    (activity as any)?.signer?.useOther === true ||
    // om en explicit roll är satt och inte är "main"
    (((activity as any)?.signer?.role || "").toLowerCase() === "other");

  // 4) Välj källa utifrån flagga
  const chosenName = useOther ? otherName : mainName;
  const chosenSpec = useOther ? otherSpec : mainSpec;
  const chosenSite = useOther ? otherSite : mainSite;

  // 5) Rita ut i mallen (utan rubriker/kolon i själva PDF-rutorna – du ligger redan på rätt plats i mallen)
  //    Här behåller vi rubrikblockets typografi (fet rad) men själva värdefälten är rena värden.
  y -= lh * 0.5;
  page.drawText("Intygsutfärdare", { x: xL, y, size: 11, font: bold }); y -= lh;

  // Namn (måste inte vara tomt – detta var ditt saknade fält)
  page.drawText(`${chosenName || ""}`, { x: xL+12, y, size: 11, font }); y -= lh;

  // Specialitet – exakt en gång, från rätt källa
  page.drawText(`${chosenSpec || ""}`, { x: xL+12, y, size: 11, font }); y -= lh;

  // Tjänsteställe
  page.drawText(`${chosenSite || ""}`, { x: xL+12, y, size: 11, font }); y -= lh;

  // 6) Krav: huvudhandledares namn och specialitet ska också finnas på intyget.
  //    (Du efterfrågade att dessa ska stå med; vi lägger dem direkt under)
  //    Specialitet = samma som sökandens specialitet om huvudhandledar-fält saknas.
  const hhNameOut = mainName || "";
  const hhSpecOut = mainSpec || ((profile as any)?.speciality ?? (profile as any)?.specialty ?? "");

  if (hhNameOut || hhSpecOut) {
    y -= lh * 0.3;
    page.drawText("Huvudhandledare", { x: xL, y, size: 11, font: bold }); y -= lh;
    page.drawText(`${hhNameOut}`, { x: xL+12, y, size: 11, font }); y -= lh;
    page.drawText(`${hhSpecOut}`, { x: xL+12, y, size: 11, font }); y -= lh;
  }


  } else if (kind === "BT_FULLGJORD") {
    page.drawText("Intyg – Fullgjord BT", { x: 40, y, size: 14, font: bold }); y -= lh * 1.5;

    const rows = Array.isArray(activity?.rows) ? activity.rows : [];
    if (rows.length) {
      page.drawText("Kliniska tjänstgöringar:", { x: 40, y, size: 12, font: bold }); y -= lh;
      for (const r of rows) {
        const clinic = String(r?.clinic || "—");
        const s = (r?.startDate || "")?.slice?.(0, 10);
        const e = (r?.endDate || "")?.slice?.(0, 10);
        const pct = Number.isFinite(+r?.percent) ? `${r.percent}%` : "—";
        const mfte = Number.isFinite(+r?.monthsFte) ? `${r.monthsFte} mån helt.` : "—";
        const tags = [
          r?.primaryCare ? "Primärvård" : null,
          r?.acuteCare ? "Akut sjkv." : null,
        ].filter(Boolean).join(", ");
        const row = `• ${clinic} — ${s || "?"} – ${e || "?"}, syss.grad ${pct}, ${mfte}${tags ? `, ${tags}` : ""}`;
        page.drawText(row, { x: 48, y, size: 11, font });
        y -= lh;
        if (y < 60) { y = 760; page.addPage(); }
      }
      y -= lh * 0.5;
    }

    const signer = activity?.signer || {};
    page.drawText("Intygsutfärdare:", { x: 40, y, size: 12, font: bold }); y -= lh;
    if (signer?.role === "manager") {
      page.drawText(`Verksamhetschef: ${signer?.name || ""}`, { x: 48, y, size: 11, font }); y -= lh;
    } else {
      page.drawText(`Utsedd person: ${signer?.name || ""}`, { x: 48, y, size: 11, font }); y -= lh;
    }
    page.drawText(`Tjänsteställe: ${signer?.workplace || ""}`, { x: 48, y, size: 11, font }); y -= lh;

  } else if (kind === "BT_KOMPETENS") {
    page.drawText("Intyg – Uppnådd baskompetens", { x: 40, y, size: 14, font: bold }); y -= lh * 1.5;

    const ext = activity?.externAssessor || {};
    const main = activity?.mainSupervisor || {};
    page.drawText("Extern bedömare:", { x: 40, y, size: 12, font: bold }); y -= lh;
    page.drawText(`Namn: ${ext?.name || ""}`, { x: 48, y, size: 11, font }); y -= lh;
    page.drawText(`Specialitet: ${ext?.specialty || ""}`, { x: 48, y, size: 11, font }); y -= lh;
    page.drawText(`Tjänsteställe: ${ext?.workplace || ""}`, { x: 48, y, size: 11, font }); y -= lh * 1.2;

    page.drawText("Huvudhandledare:", { x: 40, y, size: 12, font: bold }); y -= lh;
    page.drawText(`Namn: ${main?.name || ""}`, { x: 48, y, size: 11, font }); y -= lh;
    page.drawText(`Specialitet: ${main?.specialty || ""}`, { x: 48, y, size: 11, font }); y -= lh;
    page.drawText(`Tjänsteställe: ${main?.workplace || ""}`, { x: 48, y, size: 11, font }); y -= lh;

  } else if (kind === "BT_ANSOKAN") {
    page.drawText("Ansökan om intyg om godkänd BT", { x: 40, y, size: 14, font: bold }); y -= lh * 1.5;

    // --- Personuppgifter + läkarexamen + legitimationer i andra länder ---
    const a = activity?.applicant || {};
    page.drawText("Sökande:", { x: 40, y, size: 12, font: bold }); y -= lh;
    page.drawText(`Namn: ${a?.name || profile?.name || ""}`, { x: 48, y, size: 11, font }); y -= lh;
    page.drawText(`Personnr: ${a?.personalNumber || profile?.personalNumber || ""}`, { x: 48, y, size: 11, font }); y -= lh;
    page.drawText(`Adress: ${a?.address || profile?.address || ""}`, { x: 48, y, size: 11, font }); y -= lh;
    page.drawText(`Postnr/Ort: ${(a?.postalCode || profile?.postalCode || "") + " " + (a?.city || profile?.city || "")}`, { x: 48, y, size: 11, font }); y -= lh;
    page.drawText(`Mobil: ${a?.mobile || profile?.mobile || ""}`, { x: 48, y, size: 11, font }); y -= lh * 1.2;

    page.drawText("Läkarexamen:", { x: 40, y, size: 12, font: bold }); y -= lh;
    page.drawText(`Land: ${a?.licenseCountry || profile?.licenseCountry || profile?.medDegreeCountry || a?.medDegreeCountry || ""}`, { x: 48, y, size: 11, font }); y -= lh;

    page.drawText(`Datum: ${a?.medDegreeDate || ""}`, { x: 48, y, size: 11, font }); y -= lh * 1.2;

    const fl = Array.isArray(a?.foreignLicenses) ? a.foreignLicenses.slice(0, 3) : [];
    page.drawText("Legitimation i andra länder:", { x: 40, y, size: 12, font: bold }); y -= lh;
    if (fl.length === 0) {
      page.drawText("–", { x: 48, y, size: 11, font }); y -= lh * 1.2;
    } else {
      for (let i = 0; i < fl.length; i++) {
        const row = fl[i] || {};
        const ctry = String(row?.country ?? "");
        const dt = String(row?.date ?? "");
        page.drawText(`${i + 1}) ${ctry} – ${dt}`, { x: 48, y, size: 11, font }); y -= lh;
        if (y < 60) { y = 760; page.addPage(); }
      }
      y -= lh * 0.2;
    }

    // --- Bilagor: skriv ENDAST bilagenummer i rätt rad ---
    const sum = activity?.attachmentsSummary || {};
    const drawLine = (label: string, value: string) => {
      page.drawText(`${label} ${value || ""}`, { x: 48, y, size: 11, font });
      y -= lh;
      if (y < 60) { y = 760; page.addPage(); }
    };

    y -= lh * 0.5;
    page.drawText("Bilagor:", { x: 40, y, size: 12, font: bold }); y -= lh;

    // 1) Delmål i BT (samlade, t.ex. "1-5, 8, 9-12")
    drawLine("Delmål i bastjänstgöringen:", String((sum as any)?.delmalLine || ""));

    // 2) Fullgjord BT (exakt en eller flera positioner – skriv numret/numren)
    drawLine("Fullgjord bastjänstgöring:", String((sum as any)?.fullgjordLine || ""));

    // 3) Uppnådd baskompetens
    drawLine("Uppnådd baskompetens:", String((sum as any)?.baskompetensLine || ""));

    // 4) Tjänstgöring före legitimation
    drawLine("Tjänstgöring före legitimation:", String((sum as any)?.prelicenseLine || ""));

    // 5) Utländsk tjänstgöring
    drawLine("Utländsk tjänstgöring:", String((sum as any)?.foreignLine || ""));

  }

  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}

function drawHeaderBlock(
  page: any,
  bold: any,
  font: any,
  y: number,
  title: string,
  lh: number
) {
  page.drawText(title, { x: 40, y, size: 16, font: bold });
  y -= lh * 1.5;
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  page.drawText(`Skapad: ${iso}`, { x: 40, y, size: 10.5, font });
  return y - lh;
}




"use client";

/**
 * Minimal, stabil OCR för BILDER (rollback-version).
 * - Endast Tesseract.js för image/File/Blob/Canvas/URL.
 * - INGEN pdf.js/worker. (ocrPdf returnerar tom text i denna rollback.)
 * - Fungerar bra för fotade intyg (rekommenderat).
 */

export type OcrWord = {
  text: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence?: number;
};

export type OcrResult = {
  text: string;
  /** Enskilda ord med absoluta pixelkoordinater (bildens egna koordinatsystem). */
  words?: OcrWord[];
  /** Bildens bredd i pixlar (om tillgänglig från Tesseract). */
  width?: number;
  /** Bildens höjd i pixlar (om tillgänglig från Tesseract). */
  height?: number;
};

/**
 * En rektangulär zon i bildens koordinatsystem (pixlar, 0,0 uppe till vänster).
 */
export type OcrZone = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Rad från Tesseract-TSV (CLI) för zonbaserad extraktion utanför webappen.
 */
export type TesseractTsvRow = {
  level: number;
  page_num: number;
  block_num: number;
  par_num: number;
  line_num: number;
  word_num: number;
  left: number;
  top: number;
  width: number;
  height: number;
  conf: number;
  text: string;
};

/**
 * Zondefinitioner för SOSFS 2015:8 Bilaga 3 – Auskultation (ausk2015).
 * Koordinaterna är hämtade från ausk2015.png (1128×1584 px).
 */
export const zones_2015_B2_KLIN = {
  // Sökande – samma layout som auskultation 2015
  applicantLastName: { x: 142, y: 360, w: 422, h: 38 },
  applicantFirstName: { x: 568, y: 360, w: 422, h: 38 },
  personnummer: { x: 142, y: 414, w: 290, h: 36 },
  specialty: { x: 142, y: 484, w: 848, h: 46 },

  // Delmål som intyget avser
  delmal: { x: 142, y: 536, w: 848, h: 48 },

  // Tjänstgöringsställe och period för klinisk tjänstgöring
  clinicAndPeriod: { x: 142, y: 616, w: 848, h: 48 },

  // Beskrivning av den kliniska tjänstgöringen
  description: { x: 142, y: 700, w: 848, h: 508 },

  // Handledare – samma rutor som auskultation 2015
  supervisorSpecialty: { x: 142, y: 1314, w: 848, h: 48 },
  supervisorSite: { x: 142, y: 1367, w: 422, h: 47 },
  supervisorPlaceAndDate: { x: 568, y: 1378, w: 422, h: 36 },
  supervisorSignature: { x: 142, y: 1420, w: 422, h: 48 },
  supervisorNamePrinted: { x: 568, y: 1420, w: 422, h: 48 },

  // Bilaganummer
  attachmentNumber: { x: 942, y: 86, w: 44, h: 38 },
} as const;

export type Zones2015B2KlinKey = keyof typeof zones_2015_B2_KLIN;

export const zones_2015_B3_AUSK = {
  applicantLastName: { x: 142, y: 360, w: 422, h: 38 },
  applicantFirstName: { x: 568, y: 360, w: 422, h: 38 },
  personnummer: { x: 142, y: 414, w: 290, h: 36 },
  specialty: { x: 142, y: 484, w: 848, h: 46 },
  delmal: { x: 142, y: 536, w: 848, h: 48 },
  clinicAndPeriod: { x: 142, y: 616, w: 848, h: 48 },
  description: { x: 142, y: 700, w: 848, h: 508 },
  supervisorSpecialty: { x: 142, y: 1314, w: 848, h: 48 },
  supervisorSite: { x: 142, y: 1367, w: 422, h: 47 },
  supervisorPlaceAndDate: { x: 568, y: 1378, w: 422, h: 36 },
  supervisorSignature: { x: 142, y: 1420, w: 422, h: 48 },
  supervisorNamePrinted: { x: 568, y: 1420, w: 422, h: 48 },
  attachmentNumber: { x: 942, y: 86, w: 44, h: 38 },
} as const;

export type Zones2015B3AuskKey = keyof typeof zones_2015_B3_AUSK;

/**
 * Zoner för SOSFS 2015:8 Bilaga 5 – Kurs (kurs2015.png).
 * Layouten delar sökande- och handledardel med övriga 2015-intyg.
 */
export const zones_2015_B5_KURS = {
  // Sökande
  applicantLastName: { x: 142, y: 360, w: 422, h: 38 },
  applicantFirstName: { x: 568, y: 360, w: 422, h: 38 },
  personnummer: { x: 142, y: 414, w: 290, h: 36 },

  // Specialitet och delmål
  specialty: { x: 142, y: 484, w: 848, h: 46 },
  delmal: { x: 142, y: 536, w: 848, h: 48 },

  // Ämne (i rubrikform) och period (datum–datum) för kursen
  courseSubjectAndPeriod: { x: 142, y: 616, w: 848, h: 48 },

  // Kursledare (namn)
  courseLeader: { x: 142, y: 668, w: 848, h: 40 },

  // Beskrivning av kursen
  description: { x: 142, y: 720, w: 848, h: 488 },

  // Intygande – handledare/kursledare
  certifierIsCourseLeader: { x: 142, y: 1220, w: 160, h: 30 },
  certifierIsSupervisor: { x: 322, y: 1220, w: 160, h: 30 },

  supervisorSpecialty: { x: 142, y: 1280, w: 848, h: 40 },
  supervisorSite: { x: 142, y: 1326, w: 422, h: 40 },
  supervisorPlaceAndDate: { x: 568, y: 1326, w: 422, h: 40 },
  supervisorSignature: { x: 142, y: 1372, w: 422, h: 44 },
  supervisorNamePrinted: { x: 568, y: 1372, w: 422, h: 44 },

  // Bilaganummer
  attachmentNumber: { x: 942, y: 86, w: 44, h: 38 },
} as const;

export type Zones2015B5KursKey = keyof typeof zones_2015_B5_KURS;

/**
 * Zoner för SOSFS 2015:8 Bilaga 6 – Kvalitets- och utvecklingsarbete (utvarb2015.png).
 */
export const zones_2015_B6_UTV = {
  // Sökande – samma som övriga 2015-intyg
  applicantLastName: { x: 142, y: 360, w: 422, h: 38 },
  applicantFirstName: { x: 568, y: 360, w: 422, h: 38 },
  personnummer: { x: 142, y: 414, w: 290, h: 36 },

  // Specialitet och delmål
  specialty: { x: 142, y: 484, w: 848, h: 46 },
  delmal: { x: 142, y: 536, w: 848, h: 48 },

  // Ämne för kvalitets- och utvecklingsarbete (rubrik)
  qualitySubject: { x: 142, y: 616, w: 848, h: 48 },

  // Beskrivning av kvalitets- och utvecklingsarbetet
  description: { x: 142, y: 668, w: 848, h: 540 },

  // Handledare
  supervisorSpecialty: { x: 142, y: 1220, w: 848, h: 40 },
  supervisorSite: { x: 142, y: 1266, w: 422, h: 40 },
  supervisorPlaceAndDate: { x: 568, y: 1266, w: 422, h: 40 },
  supervisorSignature: { x: 142, y: 1312, w: 422, h: 44 },
  supervisorNamePrinted: { x: 568, y: 1312, w: 422, h: 44 },

  // Bilaganummer
  attachmentNumber: { x: 942, y: 86, w: 44, h: 38 },
} as const;

export type Zones2015B6UtvKey = keyof typeof zones_2015_B6_UTV;

/**
 * Zoner för SOSFS 2015:8 Bilaga 7 – Självständigt skriftligt arbete (vetarb2015.png).
 * Layouten är parallell med kvalitets- och utvecklingsarbetet 2015.
 */
export const zones_2015_B7_VETARB = {
  // Sökande – samma som övriga 2015-intyg
  applicantLastName: { x: 142, y: 360, w: 422, h: 38 },
  applicantFirstName: { x: 568, y: 360, w: 422, h: 38 },
  personnummer: { x: 142, y: 414, w: 290, h: 36 },

  // Specialitet och delmål
  specialty: { x: 142, y: 484, w: 848, h: 46 },
  delmal: { x: 142, y: 536, w: 848, h: 48 },

  // Ämne för självständigt skriftligt arbete (rubrik)
  workSubject: { x: 142, y: 616, w: 848, h: 48 },

  // Beskrivning av det självständiga skriftliga arbetet
  description: { x: 142, y: 668, w: 848, h: 540 },

  // Handledare
  supervisorSpecialty: { x: 142, y: 1220, w: 848, h: 40 },
  supervisorSite: { x: 142, y: 1266, w: 422, h: 40 },
  supervisorPlaceAndDate: { x: 568, y: 1266, w: 422, h: 40 },
  supervisorSignature: { x: 142, y: 1312, w: 422, h: 44 },
  supervisorNamePrinted: { x: 568, y: 1312, w: 422, h: 44 },

  // Bilaganummer
  attachmentNumber: { x: 942, y: 86, w: 44, h: 38 },
} as const;

export type Zones2015B7VetarbKey = keyof typeof zones_2015_B7_VETARB;


/**
 * Zoner för HSLF-FS 2021:8 Bilaga 8 – Auskultation (ausk2021.png).
 * Koordinaterna är i pixlar (0,0 uppe till vänster).
 */
export const zones_2021_B8_AUSK = {
  // Sökande – översta två raderna
  applicantLastName: { x: 136, y: 400, w: 467, h: 52 },
  applicantFirstName: { x: 608, y: 400, w: 365, h: 52 },
  personnummer: { x: 136, y: 472, w: 321, h: 52 },
  specialty: { x: 460, y: 472, w: 513, h: 52 },

  // Delmål som intyget avser
  delmal: { x: 136, y: 578, w: 467, h: 53 },

  // Tjänstgöringsställe och period (separerade fält i 2021-versionen)
  clinic: { x: 136, y: 688, w: 547, h: 52 },
  period: { x: 688, y: 688, w: 285, h: 52 },

  // Beskrivning av auskultationen
  description: { x: 136, y: 764, w: 837, h: 321 },

  // Handledare – nedre delen av intyget
  supervisorPlaceAndDate: { x: 608, y: 1190, w: 365, h: 52 },
  supervisorNamePrinted: { x: 136, y: 1262, w: 511, h: 52 },
  supervisorPersonnummer: { x: 652, y: 1262, w: 321, h: 52 },
  supervisorSpecialty: { x: 136, y: 1334, w: 837, h: 52 },
  supervisorSite: { x: 136, y: 1406, w: 837, h: 52 },

  // Bilaganummer uppe till höger
  attachmentNumber: { x: 924, y: 86, w: 133, h: 33 },
} as const;

export type Zones2021B8AuskKey = keyof typeof zones_2021_B8_AUSK;

/**
 * Zoner för HSLF-FS 2021:8 Bilaga 9 – Klinisk tjänstgöring under handledning (klin2021.png).
 * Layouten är i praktiken identisk med auskultationsintyget 2021.
 */
export const zones_2021_B9_KLIN = {
  // Sökande
  applicantLastName: { x: 136, y: 400, w: 467, h: 52 },
  applicantFirstName: { x: 608, y: 400, w: 365, h: 52 },
  personnummer: { x: 136, y: 472, w: 321, h: 52 },
  specialty: { x: 460, y: 472, w: 513, h: 52 },

  // Delmål
  delmal: { x: 136, y: 578, w: 467, h: 53 },

  // Tjänstgöringsställe för klinisk tjänstgöring + period
  clinic: { x: 136, y: 688, w: 547, h: 52 },
  period: { x: 688, y: 688, w: 285, h: 52 },

  // Beskrivning av den kliniska tjänstgöringen
  description: { x: 136, y: 764, w: 837, h: 321 },

  // Handledare
  supervisorPlaceAndDate: { x: 608, y: 1190, w: 365, h: 52 },
  supervisorNamePrinted: { x: 136, y: 1262, w: 511, h: 52 },
  supervisorPersonnummer: { x: 652, y: 1262, w: 321, h: 52 },
  supervisorSpecialty: { x: 136, y: 1334, w: 837, h: 52 },
  supervisorSite: { x: 136, y: 1406, w: 837, h: 52 },

  // Bilaganummer
  attachmentNumber: { x: 924, y: 86, w: 133, h: 33 },
} as const;

export type Zones2021B9KlinKey = keyof typeof zones_2021_B9_KLIN;

/**
 * Zoner för HSLF-FS 2021:8 Bilaga 10 – Kurs (kurs2021.png).
 */
export const zones_2021_B10_KURS = {
  // Sökande
  applicantLastName: { x: 136, y: 400, w: 467, h: 52 },
  applicantFirstName: { x: 608, y: 400, w: 365, h: 52 },
  personnummer: { x: 136, y: 472, w: 321, h: 52 },
  specialty: { x: 460, y: 472, w: 513, h: 52 },

  // Delmål
  delmal: { x: 136, y: 578, w: 467, h: 53 },

  // Kursens ämne (i rubrikform)
  courseSubject: { x: 136, y: 656, w: 837, h: 52 },

  // Beskrivning av kursen
  description: { x: 136, y: 730, w: 837, h: 355 },

  // Intygande – radioknappar handledare/kursledare
  certifierIsSupervisor: { x: 136, y: 1120, w: 160, h: 30 },
  certifierIsCourseLeader: { x: 316, y: 1120, w: 160, h: 30 },

  // Handledare/kursledare – nederdel
  supervisorPlaceAndDate: { x: 608, y: 1190, w: 365, h: 52 },
  supervisorNamePrinted: { x: 136, y: 1262, w: 511, h: 52 },
  supervisorPersonnummer: { x: 652, y: 1262, w: 321, h: 52 },
  supervisorSpecialty: { x: 136, y: 1334, w: 837, h: 52 },
  supervisorSite: { x: 136, y: 1406, w: 837, h: 52 },

  // Bilaganummer
  attachmentNumber: { x: 924, y: 86, w: 133, h: 33 },
} as const;

export type Zones2021B10KursKey = keyof typeof zones_2021_B10_KURS;

/**
 * Zoner för HSLF-FS 2021:8 Bilaga 11 – Deltagande i utvecklingsarbete (utvarb2021.png).
 * Layouten följer samma mönster som kursintyget 2021.
 */
export const zones_2021_B11_UTV = {
  // Sökande
  applicantLastName: { x: 136, y: 400, w: 467, h: 52 },
  applicantFirstName: { x: 608, y: 400, w: 365, h: 52 },
  personnummer: { x: 136, y: 472, w: 321, h: 52 },
  specialty: { x: 460, y: 472, w: 513, h: 52 },

  // Delmål
  delmal: { x: 136, y: 578, w: 467, h: 53 },

  // Utvecklingsarbetets ämne (i rubrikform)
  developmentSubject: { x: 136, y: 656, w: 837, h: 52 },

  // Beskrivning av ST-läkarens deltagande i utvecklingsarbetet
  description: { x: 136, y: 730, w: 837, h: 355 },

  // Handledare – nederdel
  supervisorPlaceAndDate: { x: 608, y: 1190, w: 365, h: 52 },
  supervisorNamePrinted: { x: 136, y: 1262, w: 511, h: 52 },
  supervisorPersonnummer: { x: 652, y: 1262, w: 321, h: 52 },
  supervisorSpecialty: { x: 136, y: 1334, w: 837, h: 52 },
  supervisorSite: { x: 136, y: 1406, w: 837, h: 52 },

  // Bilaganummer
  attachmentNumber: { x: 924, y: 86, w: 133, h: 33 },
} as const;

export type Zones2021B11UtvKey = keyof typeof zones_2021_B11_UTV;


/**
 * Utöka en zon med lite marginal så att ord på kanten inte tappas.
 */
function expandZone(zone: OcrZone, padding: number): OcrZone {
  return {
    x: zone.x - padding,
    y: zone.y - padding,
    w: zone.w + padding * 2,
    h: zone.h + padding * 2,
  };
}


/**
 * Kollar om en ord-boundingbox skär en zon (delvis överlapp räcker).
 */
function wordIntersectsZoneBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  zone: OcrZone
): boolean {
  const zx0 = zone.x;
  const zy0 = zone.y;
  const zx1 = zone.x + zone.w;
  const zy1 = zone.y + zone.h;

  const ix0 = Math.max(x0, zx0);
  const iy0 = Math.max(y0, zy0);
  const ix1 = Math.min(x1, zx1);
  const iy1 = Math.min(y1, zy1);

  return ix1 > ix0 && iy1 > iy0;
}

/**
 * Extrahera text ur en zon baserat på Tesseract-TSV-rader.
 * Används främst för offline-skript där du matar in TSV direkt.
 */
export function extractZoneTextFromTsvRows(
  rows: TesseractTsvRow[],
  zone: OcrZone
): string {
  const z = expandZone(zone, 2);

  const words = rows.filter((r) => {
    const t = (r.text ?? "").trim();
    if (!t) return false;
    const x0 = r.left;
    const y0 = r.top;
    const x1 = r.left + r.width;
    const y1 = r.top + r.height;
    return wordIntersectsZoneBox(x0, y0, x1, y1, z);
  });

  if (words.length === 0) {
    return "";
  }

  words.sort((a, b) => {
    const dy = a.top - b.top;
    if (Math.abs(dy) > 8) return dy;
    return a.left - b.left;
  });

  const lines: string[] = [];
  let currentLine: string[] = [];
  let currentY = words[0].top;

  for (const w of words) {
    if (Math.abs(w.top - currentY) > 10) {
      if (currentLine.length > 0) {
        lines.push(currentLine.join(" "));
      }
      currentLine = [];
      currentY = w.top;
    }
    const t = (w.text ?? "").trim();
    if (t) {
      currentLine.push(t);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.join(" "));
  }

  return lines.join("\n").trim();
}

/**
 * Extrahera text ur en zon baserat på OcrWord från ocrImage().
 */
export function extractZoneTextFromWords(
  words: OcrWord[] | undefined,
  zone: OcrZone
): string {
  if (!words || words.length === 0) {
    return "";
  }

  const z = expandZone(zone, 2);

  const items = words
    .map((w) => {
      const t = (w.text ?? "").trim();
      if (!t) return null;
      const x0 = Math.min(w.x1, w.x2);
      const y0 = Math.min(w.y1, w.y2);
      const x1 = Math.max(w.x1, w.x2);
      const y1 = Math.max(w.y1, w.y2);
      if (!wordIntersectsZoneBox(x0, y0, x1, y1, z)) return null;
      return { x0, y0, text: t };
    })
    .filter(
      (
        x
      ): x is {
        x0: number;
        y0: number;
        text: string;
      } => x !== null
    );

  if (items.length === 0) {
    return "";
  }

  items.sort((a, b) => {
    const dy = a.y0 - b.y0;
    if (Math.abs(dy) > 8) return dy;
    return a.x0 - b.x0;
  });

  const lines: string[] = [];
  let currentLine: string[] = [];
  let currentY = items[0].y0;

  for (const w of items) {
    if (Math.abs(w.y0 - currentY) > 10) {
      if (currentLine.length > 0) {
        lines.push(currentLine.join(" "));
      }
      currentLine = [];
      currentY = w.y0;
    }
    const t = (w.text ?? "").trim();
    if (t) {
      currentLine.push(t);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.join(" "));
  }

  return lines.join("\n").trim();
}

/**
 * Skala en zon baserat på faktisk bildstorlek vs förväntad storlek.
 */
function scaleZone(
  zone: OcrZone,
  expectedWidth: number,
  expectedHeight: number,
  actualWidth: number,
  actualHeight: number
): OcrZone {
  const scaleX = actualWidth / expectedWidth;
  const scaleY = actualHeight / expectedHeight;
  
  return {
    x: zone.x * scaleX,
    y: zone.y * scaleY,
    w: zone.w * scaleX,
    h: zone.h * scaleY,
  };
}

/**
 * Beräkna bildstorlek från words (ta max x och y).
 */
function getImageSizeFromWords(words: OcrWord[]): { width: number; height: number } | null {
  if (!words || words.length === 0) return null;
  
  let maxX = 0;
  let maxY = 0;
  
  for (const word of words) {
    const x1 = Math.max(word.x1, word.x2);
    const y1 = Math.max(word.y1, word.y2);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  }
  
  // Lägg till lite marginal (10%)
  return {
    width: Math.ceil(maxX * 1.1),
    height: Math.ceil(maxY * 1.1),
  };
}

/**
 * Extrahera text för ett helt zon-objekt (t.ex. zones_2015_B3_AUSK)
 * och returnera en enkel key->text-karta.
 * Zonerna skalas automatiskt baserat på bildens faktiska storlek.
 */
export function extractZonesFromWords<
  K extends string,
  Z extends Record<K, OcrZone>
>(
  words: OcrWord[] | undefined,
  zones: Z,
  expectedSize?: { width: number; height: number }
): Record<K, string> {
  const result: Record<string, string> = {};

  if (!words || words.length === 0) {
    return result as Record<K, string>;
  }

  // Beräkna faktisk bildstorlek från words
  const actualSize = getImageSizeFromWords(words);
  
  // Om vi har förväntad storlek, skala zonerna
  const shouldScale = expectedSize && actualSize;
  
  (Object.keys(zones) as K[]).forEach((key) => {
    let zone = zones[key];
    
    // Skala zonen om vi har både förväntad och faktisk storlek
    if (shouldScale) {
      zone = scaleZone(
        zone,
        expectedSize!.width,
        expectedSize!.height,
        actualSize!.width,
        actualSize!.height
      );
    }
    
    result[key] = extractZoneTextFromWords(words, zone);
  });

  return result as Record<K, string>;
}


type TesseractModule = {
  recognize: (
    image: string | HTMLCanvasElement | HTMLImageElement | Blob | File,
    lang?: string,
    options?: Record<string, any>
  ) => Promise<{ data: any }>;
};

async function getTesseract(): Promise<TesseractModule> {
  const mod: any = await import("tesseract.js");
  return (mod?.default ?? mod) as TesseractModule;
}

/** OCR för en bild/canvas/blob/url */
export async function ocrImage(
  image: File | Blob | HTMLCanvasElement | HTMLImageElement | string,
  lang = "swe+eng",
  onProgress?: (p: number) => void
): Promise<OcrResult> {
  const T = await getTesseract();

  // Blob/File → blob-URL för maximal kompatibilitet
  let src: any = image;
  let revoke: (() => void) | null = null;
  if (typeof window !== "undefined" && (image instanceof File || image instanceof Blob)) {
    const url = URL.createObjectURL(image);
    src = url;
    revoke = () => URL.revokeObjectURL(url);
  }

  try {
    const { data } = await T.recognize(src, lang, {
      logger: (m: any) => {
        if (m?.status === "recognizing text" && typeof m.progress === "number") {
          onProgress?.(m.progress);
        }
      },
    });

    const rawText = (data?.text || "").trim();

    // DEBUG: Logga vad Tesseract returnerar
    // Försök få blocks/layoutBlocks på olika sätt
    const blocksValue = (data as any)?.blocks;
    const layoutBlocksValue = (data as any)?.layoutBlocks;
    const blocksDirect = (data as any).blocks; // Utan optional chaining
    const layoutBlocksDirect = (data as any).layoutBlocks; // Utan optional chaining
    
    console.log("[OCR DEBUG] Tesseract data-struktur:", JSON.stringify({
      hasData: !!data,
      hasText: !!data?.text,
      textLength: rawText.length,
      hasWords: Array.isArray((data as any)?.words),
      wordsLength: Array.isArray((data as any)?.words) ? (data as any).words.length : 0,
      dataKeys: data ? Object.keys(data) : [],
      hasBlocks: Array.isArray(blocksValue),
      blocksType: blocksValue ? typeof blocksValue : "undefined",
      blocksDirectType: blocksDirect !== undefined ? typeof blocksDirect : "undefined",
      blocksIsArray: Array.isArray(blocksValue),
      blocksLength: Array.isArray(blocksValue) ? blocksValue.length : (blocksValue ? "not array" : 0),
      hasLayoutBlocks: Array.isArray(layoutBlocksValue),
      layoutBlocksType: layoutBlocksValue ? typeof layoutBlocksValue : "undefined",
      layoutBlocksDirectType: layoutBlocksDirect !== undefined ? typeof layoutBlocksDirect : "undefined",
      layoutBlocksIsArray: Array.isArray(layoutBlocksValue),
      layoutBlocksLength: Array.isArray(layoutBlocksValue) ? layoutBlocksValue.length : (layoutBlocksValue ? "not array" : 0),
      hasSymbols: Array.isArray((data as any)?.symbols),
      symbolsLength: Array.isArray((data as any)?.symbols) ? (data as any).symbols.length : 0,
      hasLines: Array.isArray((data as any)?.lines),
      linesLength: Array.isArray((data as any)?.lines) ? (data as any).lines.length : 0,
      hasParagraphs: Array.isArray((data as any)?.paragraphs),
      paragraphsLength: Array.isArray((data as any)?.paragraphs) ? (data as any).paragraphs.length : 0,
      hasHocr: !!(data as any)?.hocr,
      hasTsv: !!(data as any)?.tsv,
      hasBox: !!(data as any)?.box,
    }, null, 2));
    
    // Om blocks/layoutBlocks är objekt men inte arrays, undersök strukturen
    if (blocksDirect !== undefined && blocksDirect !== null && typeof blocksDirect === "object" && !Array.isArray(blocksDirect)) {
      const blockKeys = Object.keys(blocksDirect);
      const firstKey = blockKeys.length > 0 ? blockKeys[0] : null;
      const firstValue = firstKey ? blocksDirect[firstKey] : null;
      console.log("[OCR DEBUG] blocks (objekt, inte array):", JSON.stringify({
        type: typeof blocksDirect,
        isArray: Array.isArray(blocksDirect),
        keys: blockKeys,
        keysLength: blockKeys.length,
        firstKey: firstKey,
        firstValueType: firstValue ? typeof firstValue : null,
        firstValueIsArray: Array.isArray(firstValue),
        firstValueKeys: firstValue && typeof firstValue === "object" ? Object.keys(firstValue) : null,
        firstValueSample: firstValue && typeof firstValue === "object" ? {
          hasParagraphs: Array.isArray(firstValue.paragraphs),
          hasLines: Array.isArray(firstValue.lines),
          hasWords: Array.isArray(firstValue.words),
          hasSymbols: Array.isArray(firstValue.symbols),
        } : null,
        // Försök konvertera till array
        asArray: Object.values(blocksDirect),
        asArrayLength: Object.values(blocksDirect).length,
        firstArrayItem: Object.values(blocksDirect).length > 0 ? Object.values(blocksDirect)[0] : null,
      }, null, 2));
    }
    
    if (layoutBlocksDirect !== undefined && layoutBlocksDirect !== null && typeof layoutBlocksDirect === "object" && !Array.isArray(layoutBlocksDirect)) {
      const layoutKeys = Object.keys(layoutBlocksDirect);
      const firstLayoutKey = layoutKeys.length > 0 ? layoutKeys[0] : null;
      const firstLayoutValue = firstLayoutKey ? layoutBlocksDirect[firstLayoutKey] : null;
      console.log("[OCR DEBUG] layoutBlocks (objekt, inte array):", JSON.stringify({
        type: typeof layoutBlocksDirect,
        isArray: Array.isArray(layoutBlocksDirect),
        keys: layoutKeys,
        keysLength: layoutKeys.length,
        firstKey: firstLayoutKey,
        firstValueType: firstLayoutValue ? typeof firstLayoutValue : null,
        firstValueIsArray: Array.isArray(firstLayoutValue),
        firstValueKeys: firstLayoutValue && typeof firstLayoutValue === "object" ? Object.keys(firstLayoutValue) : null,
        firstValueSample: firstLayoutValue && typeof firstLayoutValue === "object" ? {
          hasParagraphs: Array.isArray(firstLayoutValue.paragraphs),
          hasLines: Array.isArray(firstLayoutValue.lines),
          hasWords: Array.isArray(firstLayoutValue.words),
          hasSymbols: Array.isArray(firstLayoutValue.symbols),
        } : null,
        // Försök konvertera till array
        asArray: Object.values(layoutBlocksDirect),
        asArrayLength: Object.values(layoutBlocksDirect).length,
        firstArrayItem: Object.values(layoutBlocksDirect).length > 0 ? Object.values(layoutBlocksDirect)[0] : null,
      }, null, 2));
    }
    
    // Kolla om TSV faktiskt finns men är tom eller null
    if (data && 'tsv' in data) {
      const tsvValue = (data as any).tsv;
      console.log("[OCR DEBUG] TSV-värde:", JSON.stringify({
        exists: 'tsv' in data,
        type: typeof tsvValue,
        isString: typeof tsvValue === "string",
        length: typeof tsvValue === "string" ? tsvValue.length : null,
        isEmpty: typeof tsvValue === "string" ? tsvValue.trim().length === 0 : null,
        firstChars: typeof tsvValue === "string" && tsvValue.length > 0 ? tsvValue.substring(0, 200) : null,
      }, null, 2));
    }
    
    // Logga blocks/layoutBlocks om de finns men inte är arrays
    if (blocksValue && blocksValue !== null && !Array.isArray(blocksValue)) {
      const blockKeys = Object.keys(blocksValue);
      const firstBlockKey = blockKeys.length > 0 ? blockKeys[0] : null;
      const firstBlockValue = firstBlockKey ? blocksValue[firstBlockKey] : null;
      console.log("[OCR DEBUG] blocks (inte array):", JSON.stringify({
        type: typeof blocksValue,
        keys: blockKeys,
        keysLength: blockKeys.length,
        firstKey: firstBlockKey,
        firstValueType: firstBlockValue ? typeof firstBlockValue : null,
        firstValueIsArray: Array.isArray(firstBlockValue),
        firstValueKeys: firstBlockValue && typeof firstBlockValue === "object" ? Object.keys(firstBlockValue) : null,
        firstValueSample: firstBlockValue && typeof firstBlockValue === "object" ? {
          hasParagraphs: Array.isArray(firstBlockValue.paragraphs),
          hasLines: Array.isArray(firstBlockValue.lines),
          hasWords: Array.isArray(firstBlockValue.words),
        } : null,
      }, null, 2));
    }
    if (layoutBlocksValue && layoutBlocksValue !== null && !Array.isArray(layoutBlocksValue)) {
      const layoutKeys = Object.keys(layoutBlocksValue);
      const firstLayoutKey = layoutKeys.length > 0 ? layoutKeys[0] : null;
      const firstLayoutValue = firstLayoutKey ? layoutBlocksValue[firstLayoutKey] : null;
      console.log("[OCR DEBUG] layoutBlocks (inte array):", JSON.stringify({
        type: typeof layoutBlocksValue,
        keys: layoutKeys,
        keysLength: layoutKeys.length,
        firstKey: firstLayoutKey,
        firstValueType: firstLayoutValue ? typeof firstLayoutValue : null,
        firstValueIsArray: Array.isArray(firstLayoutValue),
        firstValueKeys: firstLayoutValue && typeof firstLayoutValue === "object" ? Object.keys(firstLayoutValue) : null,
        firstValueSample: firstLayoutValue && typeof firstLayoutValue === "object" ? {
          hasParagraphs: Array.isArray(firstLayoutValue.paragraphs),
          hasLines: Array.isArray(firstLayoutValue.lines),
          hasWords: Array.isArray(firstLayoutValue.words),
        } : null,
      }, null, 2));
    }
    
    // Logga blocks/layoutBlocks om de finns men inte är arrays (ta bort duplicerad loggning)
    
    // Logga första blocket i detalj om det finns (efter konvertering)
    const blocksArray = Array.isArray(blocksValue) ? blocksValue : (blocksValue && blocksValue !== null && typeof blocksValue === "object" ? Object.values(blocksValue) : []);
    const layoutBlocksArray = Array.isArray(layoutBlocksValue) ? layoutBlocksValue : (layoutBlocksValue && layoutBlocksValue !== null && typeof layoutBlocksValue === "object" ? Object.values(layoutBlocksValue) : []);
    const firstBlock = blocksArray.length > 0 ? blocksArray[0] : (layoutBlocksArray.length > 0 ? layoutBlocksArray[0] : null);
    
    if (firstBlock && firstBlock !== null && typeof firstBlock === "object") {
      console.log("[OCR DEBUG] Första blocket:", JSON.stringify({
        keys: Object.keys(firstBlock),
        hasParagraphs: Array.isArray(firstBlock?.paragraphs),
        paragraphsLength: Array.isArray(firstBlock?.paragraphs) ? firstBlock.paragraphs.length : 0,
        hasLines: Array.isArray(firstBlock?.lines),
        linesLength: Array.isArray(firstBlock?.lines) ? firstBlock.lines.length : 0,
        hasWords: Array.isArray(firstBlock?.words),
        wordsLength: Array.isArray(firstBlock?.words) ? firstBlock.words.length : 0,
        firstParagraph: Array.isArray(firstBlock?.paragraphs) && firstBlock.paragraphs.length > 0 && firstBlock.paragraphs[0] !== null && typeof firstBlock.paragraphs[0] === "object"
          ? {
              keys: Object.keys(firstBlock.paragraphs[0]),
              hasLines: Array.isArray(firstBlock.paragraphs[0]?.lines),
              linesLength: Array.isArray(firstBlock.paragraphs[0]?.lines) ? firstBlock.paragraphs[0].lines.length : 0,
            }
          : null,
        firstLine: Array.isArray(firstBlock?.lines) && firstBlock.lines.length > 0 && firstBlock.lines[0] !== null && typeof firstBlock.lines[0] === "object"
          ? {
              keys: Object.keys(firstBlock.lines[0]),
              hasWords: Array.isArray(firstBlock.lines[0]?.words),
              wordsLength: Array.isArray(firstBlock.lines[0]?.words) ? firstBlock.lines[0].words.length : 0,
              firstWord: Array.isArray(firstBlock.lines[0]?.words) && firstBlock.lines[0].words.length > 0
                ? firstBlock.lines[0].words[0]
                : null,
            }
          : null,
      }, null, 2));
    }

    // Tesseract.js returnerar data i hierarkisk struktur: blocks -> paragraphs -> lines -> words
    // Vi behöver extrahera alla words från denna struktur
    // Om blocks/layoutBlocks är undefined, kan vi använda TSV-formatet istället
    const extractWordsFromData = (data: any): any[] => {
      const words: any[] = [];
      
      // Om det finns en direkt words-array, använd den
      if (Array.isArray(data?.words)) {
        console.log("[OCR DEBUG] Hittade direkt words-array:", data.words.length);
        return data.words;
      }
      
      // Försök extrahera från TSV-formatet om blocks är undefined
      if (data?.tsv && typeof data.tsv === "string") {
        console.log("[OCR DEBUG] Försöker extrahera words från TSV-format");
        const tsvLines = data.tsv.split("\n");
        // TSV-format: level, page_num, block_num, par_num, line_num, word_num, left, top, width, height, conf, text
        for (let i = 1; i < tsvLines.length; i++) { // Skippa header
          const line = tsvLines[i].trim();
          if (!line) continue;
          const parts = line.split("\t");
          if (parts.length >= 12) {
            const level = parseInt(parts[0], 10);
            const left = parseInt(parts[6], 10);
            const top = parseInt(parts[7], 10);
            const width = parseInt(parts[8], 10);
            const height = parseInt(parts[9], 10);
            const conf = parseFloat(parts[10]);
            const text = parts[11]?.trim();
            
            // Level 5 = word level
            if (level === 5 && text && !isNaN(left) && !isNaN(top) && !isNaN(width) && !isNaN(height)) {
              words.push({
                text: text,
                bbox: {
                  x0: left,
                  y0: top,
                  x1: left + width,
                  y1: top + height,
                },
                confidence: !isNaN(conf) ? conf : undefined,
              });
            }
          }
        }
        if (words.length > 0) {
          console.log("[OCR DEBUG] Extraherade", words.length, "words från TSV");
          return words;
        }
      }
      
      // Försök med layoutBlocks först (kan vara rätt struktur)
      let blocksToProcess: any[] = [];
      if (Array.isArray(data?.layoutBlocks)) {
        console.log("[OCR DEBUG] Använder layoutBlocks:", data.layoutBlocks.length);
        blocksToProcess = data.layoutBlocks;
      } else if (Array.isArray(data?.blocks)) {
        console.log("[OCR DEBUG] Använder blocks:", data.blocks.length);
        blocksToProcess = data.blocks;
      } else if (data?.blocks && data.blocks !== null && typeof data.blocks === "object" && !Array.isArray(data.blocks)) {
        // Om blocks är ett objekt, försök konvertera till array
        console.log("[OCR DEBUG] blocks är objekt, försöker konvertera");
        blocksToProcess = Object.values(data.blocks);
      } else if (data?.layoutBlocks && data.layoutBlocks !== null && typeof data.layoutBlocks === "object" && !Array.isArray(data.layoutBlocks)) {
        // Om layoutBlocks är ett objekt, försök konvertera till array
        console.log("[OCR DEBUG] layoutBlocks är objekt, försöker konvertera");
        blocksToProcess = Object.values(data.layoutBlocks);
      }
      
      // Gå igenom hierarkin: blocks -> paragraphs -> lines -> words
      if (blocksToProcess.length > 0) {
        console.log("[OCR DEBUG] Går igenom blocks:", blocksToProcess.length);
        for (const block of blocksToProcess) {
          // Kolla om block har words direkt
          if (Array.isArray(block?.words)) {
            console.log("[OCR DEBUG] Hittade words på block-nivå:", block.words.length);
            words.push(...block.words);
          }
          
          // Gå igenom paragraphs
          if (Array.isArray(block?.paragraphs)) {
            for (const para of block.paragraphs) {
              // Kolla om paragraph har words direkt
              if (Array.isArray(para?.words)) {
                console.log("[OCR DEBUG] Hittade words på paragraph-nivå:", para.words.length);
                words.push(...para.words);
              }
              
              // Gå igenom lines
              if (Array.isArray(para?.lines)) {
                for (const line of para.lines) {
                  // Kolla om line har words direkt
                  if (Array.isArray(line?.words)) {
                    words.push(...line.words);
                  }
                  // Vissa versioner har symbols istället för words
                  if (Array.isArray(line?.symbols)) {
                    // Gruppera symbols till words baserat på mellanslag
                    const lineWords: any[] = [];
                    let currentWord: any[] = [];
                    for (const sym of line.symbols) {
                      if (sym.text === " ") {
                        if (currentWord.length > 0) {
                          // Skapa ett word från symbols
                          const wordText = currentWord.map(s => s.text).join("");
                          const firstSym = currentWord[0];
                          const lastSym = currentWord[currentWord.length - 1];
                          lineWords.push({
                            text: wordText,
                            bbox: {
                              x0: Math.min(...currentWord.map(s => s.bbox?.x0 ?? s.left ?? 0)),
                              y0: Math.min(...currentWord.map(s => s.bbox?.y0 ?? s.top ?? 0)),
                              x1: Math.max(...currentWord.map(s => s.bbox?.x1 ?? (s.left + s.width) ?? 0)),
                              y1: Math.max(...currentWord.map(s => s.bbox?.y1 ?? (s.top + s.height) ?? 0)),
                            },
                            confidence: currentWord.reduce((sum, s) => sum + (s.confidence ?? s.conf ?? 0), 0) / currentWord.length,
                          });
                          currentWord = [];
                        }
                      } else {
                        currentWord.push(sym);
                      }
                    }
                    // Lägg till sista ordet om det finns
                    if (currentWord.length > 0) {
                      const wordText = currentWord.map(s => s.text).join("");
                      const firstSym = currentWord[0];
                      lineWords.push({
                        text: wordText,
                        bbox: {
                          x0: Math.min(...currentWord.map(s => s.bbox?.x0 ?? s.left ?? 0)),
                          y0: Math.min(...currentWord.map(s => s.bbox?.y0 ?? s.top ?? 0)),
                          x1: Math.max(...currentWord.map(s => s.bbox?.x1 ?? (s.left + s.width) ?? 0)),
                          y1: Math.max(...currentWord.map(s => s.bbox?.y1 ?? (s.top + s.height) ?? 0)),
                        },
                        confidence: currentWord.reduce((sum, s) => sum + (s.confidence ?? s.conf ?? 0), 0) / currentWord.length,
                      });
                    }
                    words.push(...lineWords);
                  }
                }
              }
            }
          }
          
          // Vissa versioner har lines direkt på block-nivå
          if (Array.isArray(block?.lines)) {
            for (const line of block.lines) {
              if (Array.isArray(line?.words)) {
                words.push(...line.words);
              }
            }
          }
        }
      }
      
      // Om inga words hittades, försök med symbols direkt på data-nivå
      if (words.length === 0 && Array.isArray(data?.symbols)) {
        console.log("[OCR DEBUG] Försöker extrahera från symbols-array:", data.symbols.length);
        // Gruppera symbols till words (enklare version)
        let currentWord: any[] = [];
        for (const sym of data.symbols) {
          if (sym.text === " " || sym.text === "\n") {
            if (currentWord.length > 0) {
              const wordText = currentWord.map(s => s.text).join("");
              words.push({
                text: wordText,
                bbox: sym.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
                confidence: currentWord.reduce((sum, s) => sum + (s.confidence ?? s.conf ?? 0), 0) / currentWord.length,
              });
              currentWord = [];
            }
          } else {
            currentWord.push(sym);
          }
        }
      }
      
      console.log("[OCR DEBUG] Totalt antal words extraherade:", words.length);
      return words;
    };

    const rawWords: any[] = extractWordsFromData(data);

    console.log("[OCR DEBUG] rawWords efter extraktion:", JSON.stringify({
      rawWordsLength: rawWords.length,
      firstRawWord: rawWords.length > 0 ? rawWords[0] : null,
      firstRawWordKeys: rawWords.length > 0 ? Object.keys(rawWords[0]) : [],
    }, null, 2));

    const words: OcrWord[] = rawWords
      .map((w: any) => {
        const t = String(w.text ?? "").trim();
        if (!t) return null;

        // Tesseract.js kan ha bbox i olika format
        const bbox: any = w.bbox || w;
        
        // Försök olika sätt att få koordinater
        let x0 = 0;
        let y0 = 0;
        let x1 = 0;
        let y1 = 0;

        if (bbox) {
          // Format 1: bbox.x0, bbox.y0, bbox.x1, bbox.y1
          if (typeof bbox.x0 === "number") {
            x0 = bbox.x0;
            y0 = bbox.y0;
            x1 = bbox.x1;
            y1 = bbox.y1;
          }
          // Format 2: bbox.x, bbox.y, bbox.w, bbox.h
          else if (typeof bbox.x === "number") {
            x0 = bbox.x;
            y0 = bbox.y;
            x1 = bbox.x + (bbox.w || 0);
            y1 = bbox.y + (bbox.h || 0);
          }
          // Format 3: left, top, width, height (direkt på word-objektet)
          else if (typeof w.left === "number") {
            x0 = w.left;
            y0 = w.top;
            x1 = w.left + (w.width || 0);
            y1 = w.top + (w.height || 0);
          }
        }

        const conf =
          typeof w.confidence === "number"
            ? w.confidence
            : typeof w.conf === "number"
            ? w.conf
            : undefined;

        return {
          text: t,
          x1: x0,
          y1: y0,
          x2: x1,
          y2: y1,
          confidence: conf,
        } as OcrWord;
      })
      .filter((w): w is OcrWord => !!w);

    console.log("[OCR DEBUG] OcrWord[] efter mapping:", JSON.stringify({
      wordsLength: words.length,
      firstWord: words.length > 0 ? words[0] : null,
      firstFewWords: words.slice(0, 3),
    }, null, 2));

    const imageSize = (data as any)?.imageSize || {};
    const width =
      typeof imageSize.width === "number" ? imageSize.width : undefined;
    const height =
      typeof imageSize.height === "number" ? imageSize.height : undefined;

    console.log("[OCR DEBUG] Bildstorlek från imageSize:", { width, height, imageSize });

    return {
      text: rawText,
      words,
      width,
      height,
    };
  } finally {
    revoke?.();
  }
}

/** Rollback: PDF-OCR avaktiverad (för att undvika worker/CORS/CSP-strul). */
export async function ocrPdf(
  _file: File | Blob,
  _lang = "swe+eng"
): Promise<OcrResult> {
  // Lämna tom text så flödet inte kraschar, men undvik PDF tills vidare.
  return { text: "" };
}


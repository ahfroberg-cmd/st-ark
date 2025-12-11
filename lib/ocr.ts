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
    console.log("[OCR DEBUG] Tesseract data-struktur:", {
      hasData: !!data,
      hasText: !!data?.text,
      textLength: rawText.length,
      hasWords: Array.isArray((data as any)?.words),
      wordsLength: Array.isArray((data as any)?.words) ? (data as any).words.length : 0,
      dataKeys: data ? Object.keys(data) : [],
      hasBlocks: Array.isArray((data as any)?.blocks),
      blocksLength: Array.isArray((data as any)?.blocks) ? (data as any).blocks.length : 0,
      firstBlock: Array.isArray((data as any)?.blocks) && (data as any).blocks.length > 0 
        ? (data as any).blocks[0] 
        : null,
    });

    // Tesseract.js returnerar data i hierarkisk struktur: blocks -> paragraphs -> lines -> words
    // Vi behöver extrahera alla words från denna struktur
    const extractWordsFromData = (data: any): any[] => {
      const words: any[] = [];
      
      // Om det finns en direkt words-array, använd den
      if (Array.isArray(data?.words)) {
        return data.words;
      }
      
      // Annars, gå igenom hierarkin: blocks -> paragraphs -> lines -> words
      if (Array.isArray(data?.blocks)) {
        for (const block of data.blocks) {
          if (Array.isArray(block?.paragraphs)) {
            for (const para of block.paragraphs) {
              if (Array.isArray(para?.lines)) {
                for (const line of para.lines) {
                  if (Array.isArray(line?.words)) {
                    words.push(...line.words);
                  }
                }
              }
            }
          }
          // Vissa versioner har words direkt på block-nivå
          if (Array.isArray(block?.words)) {
            words.push(...block.words);
          }
        }
      }
      
      return words;
    };

    const rawWords: any[] = extractWordsFromData(data);

    console.log("[OCR DEBUG] rawWords efter extraktion:", {
      rawWordsLength: rawWords.length,
      firstRawWord: rawWords.length > 0 ? rawWords[0] : null,
      firstRawWordKeys: rawWords.length > 0 ? Object.keys(rawWords[0]) : [],
    });

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

    console.log("[OCR DEBUG] OcrWord[] efter mapping:", {
      wordsLength: words.length,
      firstWord: words.length > 0 ? words[0] : null,
    });

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


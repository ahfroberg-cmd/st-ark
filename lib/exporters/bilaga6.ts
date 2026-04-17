"use client";

import { PDFDocument, StandardFonts } from "pdf-lib";

type ProfileLike = {
  name?: string;
  personalNumber?: string;
  speciality?: string;
  specialty?: string;
  firstName?: string;
  lastName?: string;
  homeClinic?: string;
};

const TEMPLATE_2021_BILAGA_6 = "/pdf/2021/2021-2-7212-bilaga-6.pdf";

const coords2021Bil6 = {
  efternamn: { x: 76, y: 614 },
  fornamn: { x: 331, y: 614 },
  personnummer: { x: 76, y: 576 },
  specialitet: { x: 232, y: 576 },
  tjänstgöringsstart_sida1: { x: 76, y: 493 },
  kolumn1_sida1: { x: 76 },
  kolumn2_sida1: { x: 235 },
  kolumn3_sida1: { x: 350 },
  kolumn4_sida1: { x: 438 },
  lineHeight: 22.7,
  tjänstgöringsstart_sida2: { x: 76, y: 700 },
  kolumn1_sida2: { x: 76 },
  kolumn2_sida2: { x: 235 },
  kolumn3_sida2: { x: 350 },
  kolumn4_sida2: { x: 438 },
  summa_månader: { x: 438, y: 247 },
  handledarSpec: { x: 76, y: 105 },
  handledarTjanstestalle: { x: 76, y: 68 },
} as const;

async function fetchPublicPdf(path: string): Promise<ArrayBuffer> {
  const url = typeof window !== "undefined" ? new URL(path, window.location.origin).toString() : path;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Kunde inte läsa PDF från ${url} (HTTP ${res.status})`);
  return await res.arrayBuffer();
}

function drawText({
  page,
  text,
  x,
  y,
  size,
  font,
}: {
  page: any;
  text: string;
  x: number;
  y: number;
  size: number;
  font?: any;
}) {
  page.drawText(String(text ?? ""), { x, y, size, font });
}

function toYYMMDD(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

function monthDiffExact(startISO?: string, endISO?: string) {
  const s = new Date(startISO || "");
  const e = new Date(endISO || "");
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const ms = e.getTime() - s.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  return Math.max(0, days / 30.4375);
}

function toPdfBlob(bytes: Uint8Array) {
  const safe = new Uint8Array(bytes as any);
  const buf = safe.buffer.slice(safe.byteOffset, safe.byteOffset + safe.byteLength);
  return new Blob([buf], { type: "application/pdf" });
}

export async function exportBilaga6CertificateImpl(
  input: {
    profile: ProfileLike;
    placements: Array<{ clinic: string; startDate: string; endDate: string; attendance?: number }>;
    cert?: any;
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const bytes = await fetchPublicPdf(TEMPLATE_2021_BILAGA_6);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const page1 = pages[0];

  let page2 = pages.length > 1 ? pages[1] : null;
  if (!page2 && input.placements.length > 19) {
    const [firstPage] = pdfDoc.getPages();
    const { width, height } = firstPage.getSize();
    page2 = pdfDoc.addPage([width, height]);
  } else if (!page2) {
    page2 = page1;
  }

  const size = 11;
  const prof = input.profile;
  const nameParts = (prof.name ?? "").trim().split(/\s+/);
  const fallbackFirst = prof.firstName ?? (nameParts[0] ?? "");
  const fallbackLast = prof.lastName ?? (nameParts.slice(1).join(" ") || "");
  const profSpecialty = prof.speciality ?? prof.specialty ?? "";

  drawText({ page: page1, text: fallbackLast, x: coords2021Bil6.efternamn.x, y: coords2021Bil6.efternamn.y, size, font });
  drawText({ page: page1, text: fallbackFirst, x: coords2021Bil6.fornamn.x, y: coords2021Bil6.fornamn.y, size, font });
  drawText({ page: page1, text: prof.personalNumber ?? "", x: coords2021Bil6.personnummer.x, y: coords2021Bil6.personnummer.y, size, font });
  drawText({ page: page1, text: profSpecialty, x: coords2021Bil6.specialitet.x, y: coords2021Bil6.specialitet.y, size, font });

  const MAX_PER_PAGE = 19;
  const startY_sida1 = coords2021Bil6.tjänstgöringsstart_sida1.y;
  const startY_sida2 = coords2021Bil6.tjänstgöringsstart_sida2.y;

  const formatMonths = (value: number): string => {
    if (!Number.isFinite(value)) return "";
    const whole = Math.floor(value);
    const frac = value - whole;
    if (Math.abs(frac) < 1e-6) return String(whole);
    if (Math.abs(frac - 0.5) < 1e-6) return `${whole},5`;
    const rounded = Math.round(value * 2) / 2;
    const roundedWhole = Math.floor(rounded);
    const roundedFrac = rounded - roundedWhole;
    if (Math.abs(roundedFrac) < 1e-6) return String(roundedWhole);
    return `${roundedWhole},5`;
  };

  const placementRows = input.placements
    .filter((p: any) => p.startDate && p.endDate)
    .map((p: any) => {
      const clinic = p.clinic || "—";
      const percent = p.attendance || 100;
      const monthsExact = monthDiffExact(p.startDate, p.endDate) * (percent / 100);
      const monthsRounded = Math.round(monthsExact * 2) / 2;
      const period = `${toYYMMDD(p.startDate)} - ${toYYMMDD(p.endDate)}`;
      return { clinic, period, percent, monthsRounded };
    });

  let currentY: number = startY_sida1;
  let currentPage = page1;
  let placementIndex = 0;
  let totalMonths = 0;

  for (const row of placementRows) {
    if (placementIndex === MAX_PER_PAGE) {
      currentPage = page2;
      currentY = startY_sida2;
    }

    const col1X = placementIndex < MAX_PER_PAGE ? coords2021Bil6.kolumn1_sida1.x : coords2021Bil6.kolumn1_sida2.x;
    const col2X = placementIndex < MAX_PER_PAGE ? coords2021Bil6.kolumn2_sida1.x : coords2021Bil6.kolumn2_sida2.x;
    const col3X = placementIndex < MAX_PER_PAGE ? coords2021Bil6.kolumn3_sida1.x : coords2021Bil6.kolumn3_sida2.x;
    const col4X = placementIndex < MAX_PER_PAGE ? coords2021Bil6.kolumn4_sida1.x : coords2021Bil6.kolumn4_sida2.x;

    drawText({ page: currentPage, text: row.clinic, x: col1X, y: currentY, size, font });
    drawText({ page: currentPage, text: row.period, x: col2X, y: currentY, size, font });
    drawText({ page: currentPage, text: String(row.percent), x: col3X, y: currentY, size, font });
    drawText({ page: currentPage, text: formatMonths(row.monthsRounded), x: col4X, y: currentY, size, font });

    totalMonths += row.monthsRounded;
    currentY -= coords2021Bil6.lineHeight;
    placementIndex++;
  }

  if (placementRows.length > 0) {
    const totalRounded = Math.round(totalMonths * 2) / 2;
    drawText({
      page: page2,
      text: formatMonths(totalRounded),
      x: coords2021Bil6.summa_månader.x,
      y: coords2021Bil6.summa_månader.y,
      size,
      font,
    });
  }

  const verksamhetschefName = (prof as any)?.verksamhetschef || (prof as any)?.manager || "";
  const verksamhetschefSite = input.cert?.managerSelf?.workplace || prof.homeClinic || "";

  drawText({
    page: page2,
    text: verksamhetschefName,
    x: coords2021Bil6.handledarSpec.x,
    y: coords2021Bil6.handledarSpec.y,
    size,
    font,
  });
  drawText({
    page: page2,
    text: verksamhetschefSite,
    x: coords2021Bil6.handledarTjanstestalle.x,
    y: coords2021Bil6.handledarTjanstestalle.y,
    size,
    font,
  });

  const outBytes = await pdfDoc.save();
  const outputMode = options?.output ?? "blob";

  if (outputMode === "blob") {
    const safe = new Uint8Array(outBytes as any);
    return toPdfBlob(safe);
  }

  const safeDl = new Uint8Array(outBytes as any);
  const blob = toPdfBlob(safeDl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = options?.filename || "intyg-bilaga6-2021.pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

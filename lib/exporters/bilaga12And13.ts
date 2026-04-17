"use client";

import { PDFDocument, StandardFonts } from "pdf-lib";

type ProfileLike = {
  name?: string;
  personalNumber?: string;
  speciality?: string;
  specialty?: string;
  firstName?: string;
  lastName?: string;
  supervisor?: string;
  supervisorWorkplace?: string;
  homeClinic?: string;
};

const TEMPLATE_2021_BILAGA_12 = "/pdf/2021/2021-2-7212-bilaga-12.pdf";
const TEMPLATE_2021_BILAGA_13 = "/pdf/2021/2021-2-7212-bilaga-13.pdf";

const coords2021Bil12 = {
  efternamn: { x: 76, y: 607 },
  fornamn: { x: 331, y: 607 },
  personnummer: { x: 76, y: 569 },
  specialitet: { x: 253, y: 569 },
  aktiviteter: { x: 76, y: 498 },
  hurKontrolleratsText: { x: 76, y: 725 },
  namnfortydligande: { x: 76, y: 152 },
  handledarSpec: { x: 76, y: 114 },
  handledarTjanstestalle: { x: 76, y: 76 },
} as const;

const coords2021Bil13 = {
  efternamn: { x: 76, y: 614 },
  fornamn: { x: 331, y: 614 },
  personnummer: { x: 76, y: 576 },
  specialitet: { x: 253, y: 576 },
  delmal: { x: 76, y: 520 },
  aktiviteter: { x: 76, y: 457 },
  hurKontrolleratsText: { x: 76, y: 720 },
  namnfortydligande: { x: 76, y: 142 },
  handledarSpec: { x: 76, y: 104 },
  handledarTjanstestalle: { x: 76, y: 66 },
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

function toPdfBlob(bytes: Uint8Array) {
  const safe = new Uint8Array(bytes as any);
  const buf = safe.buffer.slice(safe.byteOffset, safe.byteOffset + safe.byteLength);
  return new Blob([buf], { type: "application/pdf" });
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = toPdfBlob(bytes);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportSta3CertificateImpl(
  input: {
    profile: ProfileLike;
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

  const page1 = pages[0];
  const page2 = pages[1] ?? pages[0];
  const size = 11;

  const prof = input.profile;
  const nameParts = (prof.name ?? "").trim().split(/\s+/);
  const fallbackFirst = prof.firstName ?? (nameParts[0] ?? "");
  const fallbackLast = prof.lastName ?? (nameParts.slice(1).join(" ") || "");
  const profSpecialty = prof.speciality ?? prof.specialty ?? "";

  drawText({ page: page1, text: fallbackLast, x: coords2021Bil12.efternamn.x, y: coords2021Bil12.efternamn.y, size, font });
  drawText({ page: page1, text: fallbackFirst, x: coords2021Bil12.fornamn.x, y: coords2021Bil12.fornamn.y, size, font });
  drawText({ page: page1, text: prof.personalNumber ?? "", x: coords2021Bil12.personnummer.x, y: coords2021Bil12.personnummer.y, size, font });
  drawText({ page: page1, text: profSpecialty, x: coords2021Bil12.specialitet.x, y: coords2021Bil12.specialitet.y, size, font });
  drawText({ page: page1, text: input.activitiesText ?? "", x: coords2021Bil12.aktiviteter.x, y: coords2021Bil12.aktiviteter.y, size, font });
  drawText({ page: page2, text: input.howVerifiedText ?? "", x: coords2021Bil12.hurKontrolleratsText.x, y: coords2021Bil12.hurKontrolleratsText.y, size, font });
  drawText({ page: page2, text: input.supervisor.name ?? "", x: coords2021Bil12.namnfortydligande.x, y: coords2021Bil12.namnfortydligande.y, size, font });
  drawText({ page: page2, text: input.supervisor.speciality ?? "", x: coords2021Bil12.handledarSpec.x, y: coords2021Bil12.handledarSpec.y, size, font });
  drawText({ page: page2, text: input.supervisor.site ?? "", x: coords2021Bil12.handledarTjanstestalle.x, y: coords2021Bil12.handledarTjanstestalle.y, size, font });

  const outBytes = await pdfDoc.save();
  const mode = options?.output ?? "download";
  const filename = options?.filename ?? "intyg-sta3-2021.pdf";
  if (mode === "blob") return toPdfBlob(outBytes);
  downloadBytes(outBytes, filename);
}

export async function exportThirdCountryCertificateImpl(
  input: {
    profile: ProfileLike;
    delmalCodes: string;
    activitiesText: string;
    verificationText: string;
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const bytes = await fetchPublicPdf(TEMPLATE_2021_BILAGA_13);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  const page1 = pages[0];
  const page2 = pages[1] ?? pages[0];
  const size = 11;

  const prof = input.profile;
  const nameParts = (prof.name ?? "").trim().split(/\s+/);
  const fallbackFirst = prof.firstName ?? (nameParts[0] ?? "");
  const fallbackLast = prof.lastName ?? (nameParts.slice(1).join(" ") || "");
  const profSpecialty = prof.speciality ?? prof.specialty ?? "";

  drawText({ page: page1, text: fallbackLast, x: coords2021Bil13.efternamn.x, y: coords2021Bil13.efternamn.y, size, font });
  drawText({ page: page1, text: fallbackFirst, x: coords2021Bil13.fornamn.x, y: coords2021Bil13.fornamn.y, size, font });
  drawText({ page: page1, text: prof.personalNumber ?? "", x: coords2021Bil13.personnummer.x, y: coords2021Bil13.personnummer.y, size, font });
  drawText({ page: page1, text: profSpecialty, x: coords2021Bil13.specialitet.x, y: coords2021Bil13.specialitet.y, size, font });
  drawText({ page: page1, text: input.delmalCodes ?? "", x: coords2021Bil13.delmal.x, y: coords2021Bil13.delmal.y, size, font });
  drawText({ page: page1, text: input.activitiesText ?? "", x: coords2021Bil13.aktiviteter.x, y: coords2021Bil13.aktiviteter.y, size, font });
  drawText({ page: page2, text: input.verificationText ?? "", x: coords2021Bil13.hurKontrolleratsText.x, y: coords2021Bil13.hurKontrolleratsText.y, size, font });

  const supervisorName = (prof as any)?.supervisor || "";
  const supervisorSpeciality = (prof as any)?.specialty || (prof as any)?.speciality || "";
  const supervisorSite = (prof as any)?.supervisorWorkplace || (prof as any)?.homeClinic || "";

  drawText({ page: page2, text: supervisorName, x: coords2021Bil13.namnfortydligande.x, y: coords2021Bil13.namnfortydligande.y, size, font });
  drawText({ page: page2, text: supervisorSpeciality, x: coords2021Bil13.handledarSpec.x, y: coords2021Bil13.handledarSpec.y, size, font });
  drawText({ page: page2, text: supervisorSite, x: coords2021Bil13.handledarTjanstestalle.x, y: coords2021Bil13.handledarTjanstestalle.y, size, font });

  const outBytes = await pdfDoc.save();
  const outputMode = options?.output ?? "download";
  if (outputMode === "blob") return toPdfBlob(outBytes);
  downloadBytes(outBytes, options?.filename ?? "intyg-bilaga13-2021.pdf");
}

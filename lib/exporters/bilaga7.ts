"use client";

import { PDFDocument, StandardFonts, PDFName } from "pdf-lib";

type ProfileLike = {
  name?: string;
  personalNumber?: string;
  speciality?: string;
  specialty?: string;
  firstName?: string;
  lastName?: string;
  homeClinic?: string;
  supervisor?: string;
  supervisorWorkplace?: string;
};

const TEMPLATE_2021_BILAGA_7 = "/pdf/2021/2021-2-7212-bilaga-7.pdf";

const coords2021Bil7 = {
  efternamn: { x: 76, y: 614 },
  fornamn: { x: 331, y: 614 },
  personnummer: { x: 76, y: 576 },
  specialitet: { x: 251, y: 576 },
  mh_namnfortydligande: { x: 76, y: 449 },
  mh_specialitet: { x: 76, y: 410 },
  mh_handledarAr: { x: 430, y: 365 },
  mh_tjanstestalle: { x: 76, y: 371 },
  certifying_namn: { x: 76, y: 244 },
  certifying_spec: { x: 76, y: 204 },
  certifying_tjanstestalle: { x: 76, y: 165 },
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

export async function exportBilaga7CertificateImpl(
  input: {
    profile: ProfileLike;
    applicant: any;
    cert: any;
    placements: any[];
    courses: any[];
    attachments: any[];
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const bytes = await fetchPublicPdf(TEMPLATE_2021_BILAGA_7);
  const pdfDoc = await PDFDocument.load(bytes);

  try {
    const form = pdfDoc.getForm();
    form.flatten();
  } catch {
    try {
      const acroForm = (pdfDoc.catalog as any).get(PDFName.of("AcroForm"));
      if (acroForm) {
        (pdfDoc.catalog as any).set(PDFName.of("AcroForm"), pdfDoc.context.obj({}));
      }
      const pages = pdfDoc.getPages();
      for (const page of pages) {
        try {
          (page.node as any).set(PDFName.of("Annots"), pdfDoc.context.obj([]));
        } catch {}
      }
    } catch {}
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const page2 = pages.length > 1 ? pages[1] : page1;

  const size = 11;
  const prof = input.profile;
  const nameParts = (prof.name ?? "").trim().split(/\s+/);
  const fallbackFirst = prof.firstName ?? (nameParts[0] ?? "");
  const fallbackLast = prof.lastName ?? (nameParts.slice(1).join(" ") || "");
  const profSpecialty = prof.speciality ?? prof.specialty ?? "";

  drawText({ page: page1, text: fallbackLast, x: coords2021Bil7.efternamn.x, y: coords2021Bil7.efternamn.y, size, font });
  drawText({ page: page1, text: fallbackFirst, x: coords2021Bil7.fornamn.x, y: coords2021Bil7.fornamn.y, size, font });
  drawText({ page: page1, text: prof.personalNumber ?? "", x: coords2021Bil7.personnummer.x, y: coords2021Bil7.personnummer.y, size, font });
  drawText({ page: page1, text: profSpecialty, x: coords2021Bil7.specialitet.x, y: coords2021Bil7.specialitet.y, size, font });

  const mhName = input.cert?.mainSupervisor?.name || (prof as any)?.supervisor || "";
  const mhSpec = input.cert?.mainSupervisor?.specialty || profSpecialty;
  const mhYear = input.cert?.mainSupervisor?.trainingYear || "";
  const mhWork = input.cert?.mainSupervisor?.workplace || (prof as any)?.supervisorWorkplace || prof.homeClinic || "";

  drawText({ page: page2, text: mhName, x: coords2021Bil7.mh_namnfortydligande.x, y: coords2021Bil7.mh_namnfortydligande.y, size, font });
  drawText({ page: page2, text: mhSpec, x: coords2021Bil7.mh_specialitet.x, y: coords2021Bil7.mh_specialitet.y, size, font });
  drawText({ page: page2, text: mhYear, x: coords2021Bil7.mh_handledarAr.x, y: coords2021Bil7.mh_handledarAr.y, size, font });
  drawText({ page: page2, text: mhWork, x: coords2021Bil7.mh_tjanstestalle.x, y: coords2021Bil7.mh_tjanstestalle.y, size, font });

  const certName = input.cert?.certifyingSpecialist?.name || "";
  const certSpec = input.cert?.certifyingSpecialist?.specialty || "";
  const certWork = input.cert?.certifyingSpecialist?.workplace || "";

  if (certName || certSpec || certWork) {
    drawText({ page: page2, text: certName, x: coords2021Bil7.certifying_namn.x, y: coords2021Bil7.certifying_namn.y, size, font });
    drawText({ page: page2, text: certSpec, x: coords2021Bil7.certifying_spec.x, y: coords2021Bil7.certifying_spec.y, size, font });
    drawText({ page: page2, text: certWork, x: coords2021Bil7.certifying_tjanstestalle.x, y: coords2021Bil7.certifying_tjanstestalle.y, size, font });
  }

  const outBytes = await pdfDoc.save();
  const outputMode = options?.output ?? "download";

  if (outputMode === "blob") {
    return toPdfBlob(outBytes);
  }

  const blob = toPdfBlob(outBytes);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = options?.filename || "intyg-bilaga7-2021.pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

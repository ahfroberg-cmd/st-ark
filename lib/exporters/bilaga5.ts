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
};

const TEMPLATE_2021_BILAGA_5 = "/pdf/2021/2021-2-7212-bilaga-5.pdf";

const coords2021Bil5 = {
  specialitet: { x: 76, y: 546 },
  efternamn: { x: 76, y: 470 },
  fornamn: { x: 331, y: 470 },
  personnummer: { x: 76, y: 431 },
  address: { x: 231, y: 431 },
  zip: { x: 76, y: 392 },
  city: { x: 193, y: 392 },
  mobile: { x: 76, y: 353 },
  email: { x: 231, y: 353 },
  workplace: { x: 76, y: 297 },
  phoneWork: { x: 374, y: 297 },
  medDegreeCountry: { x: 76, y: 203 },
  medDegreeDate: { x: 384, y: 203 },
  lic1_country: { x: 76, y: 127 },
  lic1_date: { x: 384, y: 127 },
  lic2_country: { x: 76, y: 88 },
  lic2_date: { x: 384, y: 88 },
  lic3_country: { x: 76, y: 49 },
  lic3_date: { x: 384, y: 49 },
  btApprovedDate_sida2: { x: 76, y: 710 },
  prev1_spec: { x: 76, y: 637 },
  prev1_country: { x: 76, y: 598 },
  prev1_date: { x: 382, y: 598 },
  prev2_spec: { x: 76, y: 559 },
  prev2_country: { x: 76, y: 520 },
  prev2_date: { x: 382, y: 520 },
  prev3_spec: { x: 76, y: 481 },
  prev3_country: { x: 76, y: 442 },
  prev3_date: { x: 382, y: 442 },
  prev4_spec: { x: 76, y: 403 },
  prev4_country: { x: 76, y: 364 },
  prev4_date: { x: 382, y: 364 },
  bilaga_fullgjordST_sida2: { x: 370, y: 295 },
  bilaga_uppnadd_sida2: { x: 370, y: 263 },
  bilaga_ausk_sida2: { x: 370, y: 231 },
  bilaga_klinik_sida2: { x: 370, y: 199 },
  bilaga_vet_sida2: { x: 370, y: 167 },
  bilaga_kurser_sida2: { x: 370, y: 135 },
  bilaga_kval_sida2: { x: 370, y: 103 },
  bilaga_sta3_sida2: { x: 370, y: 103 },
  bilaga_third_sida2: { x: 370, y: 69 },
  bilaga_svDoc: { x: 370, y: 717 },
  bilaga_foreignDoc: { x: 370, y: 685 },
  bilaga_foreignServ: { x: 370, y: 653 },
  bilaga_individProg: { x: 370, y: 621 },
  bilaga_paidFee: { x: 385, y: 544 },
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

function toPdfBlob(bytes: Uint8Array) {
  const safe = new Uint8Array(bytes as any);
  const buf = safe.buffer.slice(safe.byteOffset, safe.byteOffset + safe.byteLength);
  return new Blob([buf], { type: "application/pdf" });
}

export async function exportBilaga5CertificateImpl(
  input: {
    profile: ProfileLike;
    applicant: any;
    cert: any;
    placements: any[];
    courses: any[];
    attachments: any[];
    paidFeeDate: string;
    btApprovedDate?: string;
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const bytes = await fetchPublicPdf(TEMPLATE_2021_BILAGA_5);
  const pdfDoc = await PDFDocument.load(bytes);

  try {
    const form = pdfDoc.getForm();
    form.getFields().forEach((f: any) => {
      const name = String(f.getName() || "");
      const ctor = (f as any).constructor?.name;
      const getText = (f as any).getText?.bind(f);
      const val = typeof getText === "function" ? String(getText() ?? "") : "";
      if (ctor === "PDFTextField" && (/(sum|total)/i.test(name) || /^\s*0([.,]0+)?\s*$/.test(val))) {
        (f as any).setText("");
      }
    });
    form.updateFieldAppearances(await pdfDoc.embedFont(StandardFonts.Helvetica));
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
  const page2 = pages[1] ?? page1;
  const page3 = pages.length > 2 ? pages[2] : pages[1] ?? page1;

  const size = 11;
  const prof = input.profile;
  const nameParts = (prof.name ?? "").trim().split(/\s+/);
  const fallbackFirst = prof.firstName ?? (nameParts[0] ?? "");
  const fallbackLast = prof.lastName ?? (nameParts.slice(1).join(" ") || "");
  const profSpecialty = prof.speciality ?? prof.specialty ?? "";
  const safe = (v?: string) => (v == null ? "" : String(v));

  drawText({ page: page1, text: profSpecialty, x: coords2021Bil5.specialitet.x, y: coords2021Bil5.specialitet.y, size, font });
  drawText({ page: page1, text: fallbackLast, x: coords2021Bil5.efternamn.x, y: coords2021Bil5.efternamn.y, size, font });
  drawText({ page: page1, text: fallbackFirst, x: coords2021Bil5.fornamn.x, y: coords2021Bil5.fornamn.y, size, font });
  drawText({ page: page1, text: prof.personalNumber ?? "", x: coords2021Bil5.personnummer.x, y: coords2021Bil5.personnummer.y, size, font });
  drawText({ page: page1, text: safe(input.applicant?.address || (prof as any)?.address), x: coords2021Bil5.address.x, y: coords2021Bil5.address.y, size, font });
  drawText({ page: page1, text: safe(input.applicant?.postalCode || (prof as any)?.postalCode), x: coords2021Bil5.zip.x, y: coords2021Bil5.zip.y, size, font });
  drawText({ page: page1, text: safe(input.applicant?.city || (prof as any)?.city), x: coords2021Bil5.city.x, y: coords2021Bil5.city.y, size, font });
  drawText({ page: page1, text: safe(input.applicant?.mobile || (prof as any)?.mobile), x: coords2021Bil5.mobile.x, y: coords2021Bil5.mobile.y, size, font });
  drawText({ page: page1, text: safe((prof as any)?.email), x: coords2021Bil5.email.x, y: coords2021Bil5.email.y, size, font });
  drawText({ page: page1, text: safe(prof.homeClinic), x: coords2021Bil5.workplace.x, y: coords2021Bil5.workplace.y, size, font });
  drawText({ page: page1, text: safe(input.applicant?.phoneWork || (prof as any)?.phoneWork), x: coords2021Bil5.phoneWork.x, y: coords2021Bil5.phoneWork.y, size, font });
  drawText({ page: page1, text: safe(input.applicant?.medDegreeCountry || (prof as any)?.medDegreeCountry), x: coords2021Bil5.medDegreeCountry.x, y: coords2021Bil5.medDegreeCountry.y, size, font });
  drawText({ page: page1, text: toYYMMDD(input.applicant?.medDegreeDate || (prof as any)?.medDegreeDate), x: coords2021Bil5.medDegreeDate.x, y: coords2021Bil5.medDegreeDate.y, size, font });

  const licenses = Array.isArray(input.applicant?.licenseCountries) ? input.applicant.licenseCountries.slice(0, 3) : [];
  if (licenses[0]) {
    drawText({ page: page1, text: safe(licenses[0].country), x: coords2021Bil5.lic1_country.x, y: coords2021Bil5.lic1_country.y, size, font });
    drawText({ page: page1, text: toYYMMDD(licenses[0].date), x: coords2021Bil5.lic1_date.x, y: coords2021Bil5.lic1_date.y, size, font });
  }
  if (licenses[1]) {
    drawText({ page: page1, text: safe(licenses[1].country), x: coords2021Bil5.lic2_country.x, y: coords2021Bil5.lic2_country.y, size, font });
    drawText({ page: page1, text: toYYMMDD(licenses[1].date), x: coords2021Bil5.lic2_date.x, y: coords2021Bil5.lic2_date.y, size, font });
  }
  if (licenses[2]) {
    drawText({ page: page1, text: safe(licenses[2].country), x: coords2021Bil5.lic3_country.x, y: coords2021Bil5.lic3_country.y, size, font });
    drawText({ page: page1, text: toYYMMDD(licenses[2].date), x: coords2021Bil5.lic3_date.x, y: coords2021Bil5.lic3_date.y, size, font });
  }

  const btApprovedDate = (input as any)?.btApprovedDate || "";
  if (btApprovedDate) {
    drawText({ page: page2, text: toYYMMDD(btApprovedDate), x: coords2021Bil5.btApprovedDate_sida2.x, y: coords2021Bil5.btApprovedDate_sida2.y, size, font });
  }

  if (input.applicant?.hasPreviousSpecialistCert && Array.isArray(input.applicant.previousSpecialties)) {
    const prevs = input.applicant.previousSpecialties.slice(0, 4);
    if (prevs[0]) {
      drawText({ page: page2, text: safe(prevs[0].specialty), x: coords2021Bil5.prev1_spec.x, y: coords2021Bil5.prev1_spec.y, size, font });
      drawText({ page: page2, text: safe(prevs[0].country), x: coords2021Bil5.prev1_country.x, y: coords2021Bil5.prev1_country.y, size, font });
      drawText({ page: page2, text: toYYMMDD(prevs[0].date), x: coords2021Bil5.prev1_date.x, y: coords2021Bil5.prev1_date.y, size, font });
    }
    if (prevs[1]) {
      drawText({ page: page2, text: safe(prevs[1].specialty), x: coords2021Bil5.prev2_spec.x, y: coords2021Bil5.prev2_spec.y, size, font });
      drawText({ page: page2, text: safe(prevs[1].country), x: coords2021Bil5.prev2_country.x, y: coords2021Bil5.prev2_country.y, size, font });
      drawText({ page: page2, text: toYYMMDD(prevs[1].date), x: coords2021Bil5.prev2_date.x, y: coords2021Bil5.prev2_date.y, size, font });
    }
    if (prevs[2]) {
      drawText({ page: page2, text: safe(prevs[2].specialty), x: coords2021Bil5.prev3_spec.x, y: coords2021Bil5.prev3_spec.y, size, font });
      drawText({ page: page2, text: safe(prevs[2].country), x: coords2021Bil5.prev3_country.x, y: coords2021Bil5.prev3_country.y, size, font });
      drawText({ page: page2, text: toYYMMDD(prevs[2].date), x: coords2021Bil5.prev3_date.x, y: coords2021Bil5.prev3_date.y, size, font });
    }
    if (prevs[3]) {
      drawText({ page: page2, text: safe(prevs[3].specialty), x: coords2021Bil5.prev4_spec.x, y: coords2021Bil5.prev4_spec.y, size, font });
      drawText({ page: page2, text: safe(prevs[3].country), x: coords2021Bil5.prev4_country.x, y: coords2021Bil5.prev4_country.y, size, font });
      drawText({ page: page2, text: toYYMMDD(prevs[3].date), x: coords2021Bil5.prev4_date.x, y: coords2021Bil5.prev4_date.y, size, font });
    }
  }

  const numbered = input.attachments.map((a, idx) => ({ ...a, nr: idx + 1 }));
  const bilagaMapSida2: Record<string, { x: number; y: number }> = {
    "Fullgjord specialiseringstjänstgöring": coords2021Bil5.bilaga_fullgjordST_sida2,
    "Uppnådd specialistkompetens": coords2021Bil5.bilaga_uppnadd_sida2,
    Auskultationer: coords2021Bil5.bilaga_ausk_sida2,
    "Kliniska tjänstgöringar under handledning": coords2021Bil5.bilaga_klinik_sida2,
    "Vetenskapligt arbete": coords2021Bil5.bilaga_vet_sida2,
    Kurser: coords2021Bil5.bilaga_kurser_sida2,
    Utvecklingsarbete: coords2021Bil5.bilaga_kval_sida2,
    "Delmål STa3": coords2021Bil5.bilaga_sta3_sida2,
    "Medicinsk vetenskap": coords2021Bil5.bilaga_sta3_sida2,
    "Delmål för specialistläkare från tredjeland": coords2021Bil5.bilaga_third_sida2,
  };

  const bilagaMapSida3: Record<string, { x: number; y: number }> = {
    "Svensk doktorsexamen": coords2021Bil5.bilaga_svDoc,
    "Utländsk doktorsexamen": coords2021Bil5.bilaga_foreignDoc,
    "Utländsk tjänstgöring": coords2021Bil5.bilaga_foreignServ,
    "Individuellt utbildningsprogram för specialistläkare från tredjeland": coords2021Bil5.bilaga_individProg,
  };

  const collapseRanges = (nums: number[]): string => {
    if (nums.length === 0) return "";
    const sorted = Array.from(new Set(nums)).sort((a, b) => a - b);
    const pieces: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const n = sorted[i];
      if (n === prev + 1) {
        prev = n;
        continue;
      }
      if (prev - start >= 2) {
        pieces.push(`${start}-${prev}`);
      } else {
        for (let j = start; j <= prev; j++) pieces.push(String(j));
      }
      start = prev = n;
    }
    if (prev - start >= 2) {
      pieces.push(`${start}-${prev}`);
    } else {
      for (let j = start; j <= prev; j++) pieces.push(String(j));
    }
    return pieces.join(", ");
  };

  const writeBilagaList = (pg: any, type: string, bilagaMap: Record<string, { x: number; y: number }>) => {
    const start = bilagaMap[type];
    if (!start) return;
    const nums = numbered.filter((x) => x.type === type).map((x) => x.nr);
    if (!nums.length) return;
    drawText({ page: pg, text: collapseRanges(nums), x: start.x, y: start.y, size, font });
  };

  Object.keys(bilagaMapSida2).forEach((k) => writeBilagaList(page2, k, bilagaMapSida2));
  Object.keys(bilagaMapSida3).forEach((k) => writeBilagaList(page3, k, bilagaMapSida3));
  drawText({ page: page3, text: toYYMMDD(input.paidFeeDate), x: coords2021Bil5.bilaga_paidFee.x, y: coords2021Bil5.bilaga_paidFee.y, size, font });

  const outBytes = await pdfDoc.save();
  const outputMode = options?.output ?? "download";
  if (outputMode === "blob") return toPdfBlob(outBytes);

  const blob = toPdfBlob(outBytes);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = options?.filename || "ansokan-bilaga5-2021.pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

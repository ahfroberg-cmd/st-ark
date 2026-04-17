// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { PDFDocument, StandardFonts, PDFName } from "pdf-lib";

import {
  coords2015Auskultation,
  coords2015Kurs,
  coords2015Kvalitet,
  coords2015Placering,
  coords2015Skriftligt,
  coords2021Bil10,
  coords2021Bil11,
  coords2021Bil8,
  coords2021Bil9,
} from "./exporters/coordinates";
import {
  fillBt2021Bilaga1,
  fillBt2021Bilaga2,
  fillBt2021Bilaga3,
  fillBt2021Bilaga4,
} from "./exporters/bt2021BilagaFills";
import { export2015GenericWithDelmal, exportBt2021 } from "./exporters/bt2021PreviewPdf";
import { fill2021Generic } from "./exporters/fill2021Generic";
import { downloadBytes, drawText, fetchPublicPdf, toPdfBlob } from "./exporters/pdfUtils";
import {
  TEMPLATE_2015_AUSKULTATION,
  TEMPLATE_2015_KURS,
  TEMPLATE_2015_KVALITET,
  TEMPLATE_2015_PLACERING,
  TEMPLATE_2015_SKRIFTLIGT,
  TEMPLATE_2021_BILAGA_1,
  TEMPLATE_2021_BILAGA_10,
  TEMPLATE_2021_BILAGA_11,
  TEMPLATE_2021_BILAGA_2,
  TEMPLATE_2021_BILAGA_3,
  TEMPLATE_2021_BILAGA_4,
  TEMPLATE_2021_BILAGA_8,
  TEMPLATE_2021_BILAGA_9,
} from "./exporters/templatePaths";
import type { ExportInput, Profile } from "./exporters/types";

export type {
  ActivityType,
  ExportInput,
  GoalsVersion,
  Placement,
  Profile,
} from "./exporters/types";

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
void courseLeaderName;

async function clearPdfFormArtifacts(pdfDoc: PDFDocument) {
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
}

export async function exportBilaga6Certificate(
  input: {
    profile: Profile;
    placements: Array<{ clinic: string; startDate: string; endDate: string; attendance?: number }>;
    cert?: any;
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const { exportBilaga6CertificateImpl } = await import("./exporters/bilaga6");
  return exportBilaga6CertificateImpl(input, options);
}

export async function exportBilaga7Certificate(
  input: {
    profile: Profile;
    applicant: any;
    cert: any;
    placements: any[];
    courses: any[];
    attachments: any[];
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const { exportBilaga7CertificateImpl } = await import("./exporters/bilaga7");
  return exportBilaga7CertificateImpl(input, options);
}

export async function exportBilaga5Certificate(
  input: {
    profile: Profile;
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
  const { exportBilaga5CertificateImpl } = await import("./exporters/bilaga5");
  return exportBilaga5CertificateImpl(input, options);
}

export async function exportSta3Certificate(
  input: {
    profile: Profile;
    supervisor: { name: string; speciality: string; site: string };
    activitiesText: string;
    howVerifiedText: string;
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const { exportSta3CertificateImpl } = await import("./exporters/bilaga12And13");
  return exportSta3CertificateImpl(input, options);
}

export async function exportThirdCountryCertificate(
  input: {
    profile: Profile;
    delmalCodes: string;
    activitiesText: string;
    verificationText: string;
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const { exportThirdCountryCertificateImpl } = await import("./exporters/bilaga12And13");
  return exportThirdCountryCertificateImpl(input, options);
}

export async function exportThirdCountryCertificate2015(
  input: {
    profile: Profile;
    delmalCodes: string;
    activitiesText: string;
    verificationText: string;
    workplaces: Array<{ site: string; startDate: string; endDate: string }>;
    cert?: any;
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const { exportThirdCountryCertificate2015Impl } = await import("./exporters/thirdCountry2015");
  return exportThirdCountryCertificate2015Impl(input, options);
}

export async function exportThirdCountryCertificate2015_8b(
  input: {
    profile: Profile;
    cert?: any;
    delmalCodes?: string;
    activitiesText?: string;
    verificationText?: string;
    workplaces?: Array<{ site: string; startDate: string; endDate: string }>;
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const { exportThirdCountryCertificate2015_8bImpl } = await import("./exporters/thirdCountry2015");
  return exportThirdCountryCertificate2015_8bImpl(input, options);
}

// Behålls av bakåtkompatibilitet med intern kod.
export { export2015GenericWithDelmal, exportBt2021 };

export async function exportCertificate(
  input: ExportInput,
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const outputMode = options?.output ?? "download";
  const outName = options?.filename;

  const { goalsVersion, activityType, profile, activity, milestones = [] } = input;

  if (goalsVersion === "2021") {
    if (activityType === "SKRIFTLIGT_ARBETE") {
      throw new Error("STa3-intyg (2021) skapas via 'Förbered intyg för STa3'-popupen.");
    }

    if (
      activityType === "BT_GOALS" ||
      activityType === "BT_FULLGJORD" ||
      activityType === "BT_KOMPETENS" ||
      activityType === "BT_ANSOKAN"
    ) {
      const templatePath =
        activityType === "BT_ANSOKAN"
          ? TEMPLATE_2021_BILAGA_1
          : activityType === "BT_GOALS"
            ? TEMPLATE_2021_BILAGA_2
            : activityType === "BT_FULLGJORD"
              ? TEMPLATE_2021_BILAGA_3
              : TEMPLATE_2021_BILAGA_4;

      const bytes = await fetchPublicPdf(templatePath);
      const pdfDoc = await PDFDocument.load(bytes);
      await clearPdfFormArtifacts(pdfDoc);

      if (activityType === "BT_ANSOKAN") {
        await fillBt2021Bilaga1(pdfDoc, profile as any, activity as any);
      } else if (activityType === "BT_GOALS") {
        await fillBt2021Bilaga2(pdfDoc, profile as any, activity as any, milestones);
      } else if (activityType === "BT_FULLGJORD") {
        await fillBt2021Bilaga3(pdfDoc, profile as any, activity as any);
      } else {
        await fillBt2021Bilaga4(pdfDoc, profile as any, activity as any);
      }

      const outBytes = await pdfDoc.save();
      if (outputMode === "blob") {
        return toPdfBlob(outBytes);
      }
      downloadBytes(outBytes, outName ?? `intyg-${String(activityType).toLowerCase()}-2021.pdf`);
      return;
    }

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
    await clearPdfFormArtifacts(pdfDoc);

    let activityForExport = activity;

    if (activityType === "KVALITETSARBETE") {
      activityForExport = { ...activity, site: activity.title ?? "", startDate: "", endDate: "" } as any;
    }

    if (activityType === "KURS") {
      const signer = (activity as any).signer as
        | { type: "KURSLEDARE"; name?: string; site?: string; speciality?: string }
        | { type: "HANDLEDARE"; name?: string; site?: string; speciality?: string; personalNumber?: string }
        | undefined;

      const clName = (activity as any).courseLeaderName ?? "";
      const clSite = (activity as any).courseLeaderSite ?? "";
      const clSpec =
        (activity as any).courseLeaderSpeciality ?? (activity as any).courseLeaderSpecialty ?? "";

      const isCourseLeaderSigner = signer?.type === "KURSLEDARE";

      activityForExport = {
        ...activity,
        activityType: "KURS",
        supervisor: isCourseLeaderSigner ? clName : (signer?.name ?? ""),
        supervisorSite: isCourseLeaderSigner ? clSite : (signer?.site ?? ""),
        supervisorSpeciality: isCourseLeaderSigner ? clSpec : ((signer as any)?.speciality ?? ""),
        supervisorSpecialty: isCourseLeaderSigner ? clSpec : ((signer as any)?.speciality ?? ""),
        supervisorPn: signer?.type === "HANDLEDARE" ? (signer as any).personalNumber ?? "" : "",
      } as any;
    }

    await fill2021Generic(pdfDoc, coords, profile, activityForExport, milestones);

    if (activityType === "KURS") {
      const pageForX = pdfDoc.getPages()[0];
      const signerType = (activity as any).signer?.type;
      const fontX = await pdfDoc.embedFont(StandardFonts.Helvetica);

      if (signerType === "KURSLEDARE" && (coords as any).kursledareX) {
        drawText({
          page: pageForX,
          text: "X",
          x: (coords as any).kursledareX.x,
          y: (coords as any).kursledareX.y,
          size: 11,
          font: fontX,
        });
      }
      if (signerType === "HANDLEDARE" && (coords as any).handledareX) {
        drawText({
          page: pageForX,
          text: "X",
          x: (coords as any).handledareX.x,
          y: (coords as any).handledareX.y,
          size: 11,
          font: fontX,
        });
      }
    }

    const outBytes = await pdfDoc.save();
    if (outputMode === "blob") {
      return toPdfBlob(outBytes);
    }
    downloadBytes(outBytes, outName ?? `intyg-${activityType.toLowerCase()}-2021.pdf`);
    return;
  }

  if (goalsVersion === "2015") {
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
    await clearPdfFormArtifacts(pdfDoc);

    let activityForExport = activity;

    if (activityType === "KVALITETSARBETE") {
      activityForExport = { ...activity, site: activity.title ?? "", startDate: "", endDate: "" } as any;
    }

    if (activityType === "KURS") {
      const signer = (activity as any).signer as
        | { type: "KURSLEDARE"; name?: string; site?: string; speciality?: string }
        | { type: "HANDLEDARE"; name?: string; site?: string; speciality?: string; personalNumber?: string }
        | undefined;

      const clNameRaw = (activity as any).courseLeaderName ?? "";
      const clSite = (activity as any).courseLeaderSite ?? "";
      const clSpec =
        (activity as any).courseLeaderSpeciality ?? (activity as any).courseLeaderSpecialty ?? "";

      const isCourseLeaderSigner = signer?.type === "KURSLEDARE";

      activityForExport = {
        ...activity,
        supervisor: isCourseLeaderSigner ? clNameRaw : (signer?.name ?? ""),
        supervisorSite: isCourseLeaderSigner ? clSite : (signer?.site ?? ""),
        supervisorSpeciality: isCourseLeaderSigner ? clSpec : ((signer as any)?.speciality ?? ""),
        supervisorSpecialty: isCourseLeaderSigner ? clSpec : ((signer as any)?.speciality ?? ""),
        supervisorPn: signer?.type === "HANDLEDARE" ? (signer as any).personalNumber ?? "" : "",
      } as any;
    }

    await fill2021Generic(pdfDoc, coords, profile, activityForExport, milestones);

    if (activityType === "KURS") {
      const pageForX = pdfDoc.getPages()[0];
      const base: any = activityForExport ?? (activity as any);
      const signerType = base.signer?.type;

      const fontX = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const size = 11;

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

      let clName = "";
      if (typeof base.courseLeaderName === "string") {
        clName = base.courseLeaderName.trim();
      }
      if (!clName && signerType === "KURSLEDARE") {
        clName = String(base.signer?.name ?? "").trim();
      }

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
      return toPdfBlob(outBytes);
    }
    downloadBytes(outBytes, outName ?? `intyg-${activityType.toLowerCase()}-2015.pdf`);
    return;
  }

  throw new Error(`Okänd målversion: ${goalsVersion}`);
}

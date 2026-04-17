// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { PDFDocument, StandardFonts } from "pdf-lib";

import { toPdfBlob } from "./pdfUtils";
import type { Placement, Profile } from "./types";

export async function export2015GenericWithDelmal(

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

export async function exportBt2021(
  kind: "BT_GOALS" | "BT_FULLGJORD" | "BT_KOMPETENS" | "BT_ANSOKAN",
  profile: any,
  activity: any,
  milestones: string[]
): Promise<Blob> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 (pt)
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const xL = 40;

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
        if (y < 60) break;
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
        if (y < 60) break;
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
        if (y < 60) break;
      }
      y -= lh * 0.2;
    }

    // --- Bilagor: skriv ENDAST bilagenummer i rätt rad ---
    const sum = activity?.attachmentsSummary || {};
    const drawLine = (label: string, value: string) => {
      page.drawText(`${label} ${value || ""}`, { x: 48, y, size: 11, font });
      y -= lh;
      if (y < 60) return;
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
  return toPdfBlob(bytes);
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

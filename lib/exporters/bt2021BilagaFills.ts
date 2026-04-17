// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { PDFDocument, StandardFonts } from "pdf-lib";

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
export async function fillBt2021Bilaga1(pdfDoc: PDFDocument, profile: any, activity: any) {
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
  // Efternamn: Där personnummer var (x: 76, y: 530)
  page.drawText(lastName, {
    x: 76,
    y: 530,
    size: 11,
    font,
  });
  // Förnamn: Återgå till tidigare x-värde (331), men ändra y-värdet till samma som efternamn (530)
  page.drawText(firstName, {
    x: 331,
    y: 530,
    size: 11,
    font,
  });
  // Personnummer: Där mobilnummer var (x: 76, y: 491)
  page.drawText(personalNumber, {
    x: 76,
    y: 491,
    size: 11,
    font,
  });
  // Specialitet som ansökan avser - TAS BORT

  // ========= Övriga personuppgifter längre ned (adress m.m.) =========
  // Utdelningsadress: Samma x-värde som epostadress är nu (232), samma y-värde som mobilnummer är nu (491)
  page.drawText(String(a.address ?? p.address ?? ""), {
    x: 232,
    y: 491,
    size: 11,
    font,
  }); // Utdelningsadress
  // Postnummer
  page.drawText(String(a.postalCode ?? p.postalCode ?? ""), {
    x: 76,
    y: 452,
    size: 11,
    font,
  }); // Postnr
  // Postort: Behåll x-värde (193), ändra y-värde till samma som postnummer (452)
  page.drawText(String(a.city ?? p.city ?? ""), {
    x: 193,
    y: 452,
    size: 11,
    font,
  }); // Ort
  // Mobilnummer: Där hemklinik är nu (x: 76, y: 414)
  page.drawText(String(a.mobile ?? p.mobile ?? ""), {
    x: 76,
    y: 414,
    size: 11,
    font,
  }); // Mobil
  // Epost-adress: Behåll x-värde (232), ändra y-värde till samma som hemklinik är nu (414)
  page.drawText(String(a.email ?? p.email ?? ""), {
    x: 232,
    y: 414,
    size: 11,
    font,
  }); // E-post
  // Hemklinik: Flytta ned 3 pixlar (från y: 359 till y: 356)
  page.drawText(String(a.workplace ?? p.homeClinic ?? ""), {
    x: 76,
    y: 356,
    size: 11,
    font,
  }); // Arbetsplats/Hemklinik
  // Telefon arbetet: Samma y-värde som hemklinik (356), flytta 7 pixlar åt höger (från x: 365 till x: 372)
  page.drawText(String(a.phoneWork ?? p.phoneWork ?? ""), {
    x: 372,
    y: 356,
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
export async function fillBt2021Bilaga2(
  pdfDoc: PDFDocument,
  profile: any,
  activity: any,
  milestones: string[]
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const normalizeAndSortBtDelmal = (input: string[]): string[] => {
    const items = (input || [])
      .map((d) => String(d ?? "").trim())
      .filter((d) => d.length > 0)
      .map((raw) => {
        const up = raw.toUpperCase().replace(/\s+/g, "");
        const m = up.match(/^BT(\d+)$/);
        const num = m ? parseInt(m[1], 10) || 0 : 0;
        return { up, num, raw };
      });

    items.sort((a, b) => {
      const aIsBt = a.up.startsWith("BT");
      const bIsBt = b.up.startsWith("BT");
      if (aIsBt !== bIsBt) return aIsBt ? -1 : 1;
      if (aIsBt && bIsBt && a.num !== b.num) return a.num - b.num;
      return a.up.localeCompare(b.up);
    });

    return items.map((x) => x.up);
  };

  // — Sidor
  const pages = pdfDoc.getPages();
  const page1 = pages[0];            // personuppgifter, delmål, aktiviteter
  // Skapa sida 2 om den inte finns (för "Hur kontrollerats" + signer)
  let page2 = pages[1];
  if (!page2) {
    page2 = pdfDoc.addPage([595.28, 841.89]); // A4
  }

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
  const idsRaw = Array.isArray(milestones) ? milestones.filter(Boolean) : [];
  const ids = normalizeAndSortBtDelmal(idsRaw);

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
    let y: number = coords1.aktiviteter.y;
    const maxWidth = coords1.aktiviteter.width;
    const lineHeight = coords1.aktiviteter.lineHeight;

    const drawOne = (txt: string) => {
      y = drawWrapped(page1, font, txt, coords1.aktiviteter.x, y, maxWidth, 11, lineHeight);
    };

    const isCourseLike = (x: any) =>
      Boolean((x as any)?.certificateDate || (x as any)?.courseLeaderName || (x as any)?.city);
    const kindOrder = (x: any): number => {
      const k = String((x as any)?.kind || "").toLowerCase();
      if (k === "placement") return 0;
      if (k === "course") return 1;
      return isCourseLike(x) ? 1 : 0;
    };
    const dateKey = (x: any): number => {
      const s = String((x as any)?.startDate || "").slice(0, 10);
      const e = String((x as any)?.endDate || "").slice(0, 10);
      const d = e || s;
      const t = new Date(d || 0).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    const sortedActs = [...acts].sort((a, b) => {
      const ka = kindOrder(a);
      const kb = kindOrder(b);
      if (ka !== kb) return ka - kb;
      const da = dateKey(a);
      const db = dateKey(b);
      if (da !== db) return da - db;
      return String(a?.text || a?.title || "").localeCompare(String(b?.text || b?.title || ""), "sv");
    });

    for (const a of sortedActs) {
      const title = String(a?.text || a?.title || "").trim();
      const s = String(a?.startDate || "").slice(0, 10);
      const e = String(a?.endDate || "").slice(0, 10);
      const span = (s || e) ? `${s || "?"} – ${e || "?"}` : "—";

      const actGoalsRaw: string[] =
        (Array.isArray(a?.milestones) ? a.milestones : null) ||
        (Array.isArray(a?.goals) ? a.goals : null) ||
        (Array.isArray(a?.delmal) ? a.delmal : null) ||
        [];
      const actGoals = normalizeAndSortBtDelmal(actGoalsRaw);

      const isCourse = kindOrder(a) === 1;
      const row1 = `${isCourse ? "Kurs" : "Klinisk tjänstgöring"}: ${title || "—"}`;
      const row2 = `Datum: ${span}`;
      const row3 = `Delmål som avses: ${actGoals.join(", ") || "—"}`;

      if (title || s || e || actGoals.length) {
        drawOne(row1);
        drawOne(row2);
        drawOne(row3);
        y -= lineHeight; // tom rad mellan aktiviteter
      }
    }
  } else if (activitiesTextFallback) {
    const raw = String(activitiesTextFallback ?? "").trim();
    if (raw) {
      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      let y: number = coords1.aktiviteter.y;
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
      let y: number = coords1.aktiviteter.y;
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

  // Skriv ut "Hur kontrollerats" om texten finns
  if (ctrl) {
    // Hantera flerradig text (splitta på radbrytningar och rita varje rad)
    const lines = ctrl.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      let y: number = coords2.hurKontrollerats.y;
      const maxWidth = coords2.hurKontrollerats.width;
      const lineHeight = coords2.hurKontrollerats.lineHeight;
      
      for (const line of lines) {
        y = drawWrapped(page2, font, line, coords2.hurKontrollerats.x, y, maxWidth, 11, lineHeight);
      }
    }
  }

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
export async function fillBt2021Bilaga3(pdfDoc: PDFDocument, profile: any, activity: any) {
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
  const sumMonths = rows.reduce((acc: number, r: any) => {
    const v = +r?.monthsFte;
    return Number.isFinite(v) ? acc + v : acc;
  }, 0);
  const sumMonthsStr = String(sumMonths);
  page1.drawText(sumMonthsStr, { x: coords1.totalMonths.x, y: coords1.totalMonths.y, size: 11, font });

  // ===== Sida 2: kolumner med TITLAR (primärvård / akutsjukvård) =====
  const primaryTitles = rows.filter((r: any) => r?.primaryCare).map((r: any) => toStr(r?.clinic || r?.title)).filter(Boolean);
  const acuteTitles   = rows.filter((r: any) => r?.acuteCare).map((r: any) => toStr(r?.clinic || r?.title)).filter(Boolean);


  let yP: number = coords2.primaryCol.y;
  for (const t of primaryTitles) {
    yP = drawWrapped(page2, font, t, coords2.primaryCol.x, yP, coords2.primaryCol.width, 11, coords2.primaryCol.lineHeight);
  }

  let yA: number = coords2.acuteCol.y;
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
export async function fillBt2021Bilaga4(pdfDoc: PDFDocument, profile: any, activity: any) {
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


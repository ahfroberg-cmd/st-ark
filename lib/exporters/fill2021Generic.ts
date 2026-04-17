// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { PDFDocument, StandardFonts } from "pdf-lib";

import type { Placement, Profile } from "./types";
import { drawText } from "./pdfUtils";

export async function fill2021Generic(
  pdfDoc: PDFDocument,
  coords: Record<string, { x: number; y: number }>,
  profile: Profile,
  activity: Placement,
  delmal: string[]
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

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
      : String((activity as any).periodDisplay || "").trim()
        ? String((activity as any).periodDisplay).trim()
        : (activity as any).startDate && (activity as any).endDate
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

  const is2015Goals = profile.goalsVersion === "2015";
  /** 2015-blanketten har bredare rad för delmål; undvik onödig radbrytning vid t.ex. intygsgrupp. */
  const delmalMaxPerLine = is2015Goals ? 22 : 7;

  for (const key of Object.keys(coords)) {
    if (key === "delmal") {
      const sortedDelmal = Array.isArray(delmal)
        ? normalizeAndSortDelmal(delmal as string[])
        : [];

      if (sortedDelmal.length > 0) {
        // Få delmål: en rad
        if (sortedDelmal.length <= delmalMaxPerLine) {
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
          // Många delmål: dela upp på flera rader (första raden samma y som enradfallet)
          const chunks: string[] = [];
          for (let i = 0; i < sortedDelmal.length; i += delmalMaxPerLine) {
            chunks.push(sortedDelmal.slice(i, i + delmalMaxPerLine).join(", "));
          }
          const base = coords.delmal;
          const lineHeight = 13;
          chunks.forEach((line, idx) => {
            const yLine = base.y - idx * lineHeight;
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
    if (key === "period" && !isCourse2021) {
      const periodText = String(values.period ?? "").trim();
      if (!periodText) continue;
      const { x: periodBaseX, y: periodY } = coords.period;
      const textW = font.widthOfTextAtSize(periodText, size);
      const maxRight = 570;
      const c = coords as Record<string, { x: number }>;
      let leftColEnd = 0;
      if (c.plats != null) {
        const platsStr = String(values.plats ?? "").trim();
        leftColEnd = c.plats.x + font.widthOfTextAtSize(platsStr, size) + 10;
      } else if (c.tjstgStalle != null) {
        const tj = String(values.tjstgStalle ?? "").trim();
        leftColEnd = c.tjstgStalle.x + font.widthOfTextAtSize(tj, size) + 10;
      }
      let x = periodBaseX;
      if (periodBaseX + textW > maxRight) {
        x = Math.max(leftColEnd > 0 ? leftColEnd : 200, maxRight - textW);
      }
      drawText({ page, text: periodText, x, y: periodY, size, font });
      continue;
    }
    const { x, y } = coords[key];
    drawText({ page, text: values[key] ?? "", x, y, size, font });
  }

}

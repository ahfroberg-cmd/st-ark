// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { PDFDocument, StandardFonts } from "pdf-lib";

import type { Placement, Profile } from "./types";

export async function export2015Generic(
  pdfDoc: PDFDocument,
  coords: Record<string, { x: number; y: number }>,
  profile: Profile,
  activity: Placement
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
const page = pages[0];

// Säkerställ att det finns en sida 2 för bilagor (#-lista)
if (pdfDoc.getPageCount() < 2) {
  pdfDoc.addPage();
}
const attPage = pdfDoc.getPages()[1];

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

  const period =
    activity.startDate && activity.endDate
      ? `${activity.startDate.replaceAll("-", "")} – ${activity.endDate.replaceAll("-", "")}`
      : "";

  const values: Record<string, string> = {
  efternamn: fallbackLast,
  fornamn: fallbackFirst,
  personnummer: (profile as any).personalNumber ?? "",
  specialitet: profSpecialty,

  // Aktivitetsspecifikt (undvik dublett mellan titel och plats)
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
  beskrivning:
    ((activity as any).description ??
     (activity as any).desc ??
     (activity as any).notes ??
     (activity as any).note ??
     (activity as any).summary ??
     (activity as any).text ??
     "") as string,


  // Signaturdel (ingen hemklinik för sökande)
  handledare: (activity as any).supervisor ?? "",
  handledarSpec: (activity as any).supervisorSpeciality ?? (activity as any).supervisorSpecialty ?? "",
  handledarTjanstestalle: (activity as any).supervisorSite ?? "",

  // Lämnas tomt – skrivs vid behov i Bilaga 1
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

  for (const key of Object.keys(coords)) {
    const { x, y } = coords[key];
    const text = values[key] ?? "";
    page.drawText(text, { x, y, size, font });
  }

}

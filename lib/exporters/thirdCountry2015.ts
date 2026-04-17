"use client";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type ProfileLike = {
  name?: string;
  firstName?: string;
  lastName?: string;
  speciality?: string;
  specialty?: string;
  [key: string]: any;
};

const TEMPLATE_2015_TREDJELAND_8A = "/pdf/2015/blankett-specialistlakare-tredjeland-8a-sosfs20158.pdf";
const TEMPLATE_2015_TREDJELAND_8B = "/pdf/2015/blankett-specialistlakare-tredjeland-8b-sosfs20158.pdf";

async function fetchPublicPdf(path: string): Promise<ArrayBuffer> {
  const url = typeof window !== "undefined" ? new URL(path, window.location.origin).toString() : path;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Kunde inte läsa PDF från ${url} (HTTP ${res.status})`);
  return await res.arrayBuffer();
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const safe = new Uint8Array(bytes as any);
  const buf = safe.buffer.slice(safe.byteOffset, safe.byteOffset + safe.byteLength);
  const blob = new Blob([buf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function toPdfBlob(bytes: Uint8Array) {
  const safe = new Uint8Array(bytes as any);
  const buf = safe.buffer.slice(safe.byteOffset, safe.byteOffset + safe.byteLength);
  return new Blob([buf], { type: "application/pdf" });
}

function normalizePdfFieldKey(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u00e5]/g, "a")
    .replace(/[\u00e4]/g, "a")
    .replace(/[\u00f6]/g, "o")
    .replace(/[^a-z0-9]/g, "");
}

function formatDelmalCodes2015(input: string) {
  const raw = String(input ?? "");
  if (!raw.trim()) return "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((code) => code.replace(/^st\s*/i, "").toLowerCase())
    .join(", ");
}

function splitForPdfLines(text: string, maxLines: number) {
  const s = String(text ?? "").replace(/\r\n/g, "\n");
  if (!s) return { a: "", b: "" };
  const lines = s.split("\n");
  if (lines.length <= maxLines) return { a: s, b: "" };
  const a = lines.slice(0, maxLines).join("\n").trimEnd();
  const b = lines.slice(maxLines).join("\n").trimStart();
  return { a, b };
}

function isLikelySecondPageField(k: string, raw: string) {
  const kk = String(k || "");
  const rr = String(raw || "").toLowerCase();
  return kk.includes("sida2") || kk.includes("page2") || /(?:_|-|\b)2$/.test(kk) || rr.includes("sida 2") || rr.includes("page 2");
}

function fillSequentialTextFieldsByLines(opts: {
  form: any;
  predicate: (normalizedName: string, rawName: string) => boolean;
  text: string;
  maxLinesPerField: number;
}) {
  const fields: any[] = opts.form.getFields?.() ?? [];
  const candidates: Array<{ raw: string; norm: string; field: any }> = [];
  for (const f of fields) {
    const raw = String(f.getName?.() ?? "");
    if (!raw) continue;
    const norm = normalizePdfFieldKey(raw);
    if (!opts.predicate(norm, raw)) continue;
    candidates.push({ raw, norm, field: f });
  }
  if (!candidates.length) return { used: false, overflow: "" };
  candidates.sort((a, b) => {
    const a2 = isLikelySecondPageField(a.norm, a.raw) ? 1 : 0;
    const b2 = isLikelySecondPageField(b.norm, b.raw) ? 1 : 0;
    if (a2 !== b2) return a2 - b2;
    return a.raw.localeCompare(b.raw, "sv");
  });
  let rest = String(opts.text ?? "");
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const s = splitForPdfLines(rest, opts.maxLinesPerField);
    const chunk = s.a;
    rest = s.b;
    try {
      if (typeof c.field.setText === "function") c.field.setText(String(chunk ?? "").replace(/\n/g, "\r\n"));
    } catch {}
    if (!rest) {
      for (let j = i + 1; j < candidates.length; j++) {
        try {
          const f = candidates[j]?.field;
          if (f && typeof f.setText === "function") f.setText("");
        } catch {}
      }
      break;
    }
  }
  return { used: true, overflow: rest };
}

function fillPdfTextFields(
  pdfDoc: any,
  rules: Array<{ test: (k: string, raw: string) => boolean; value: string }>,
  options?: { flatten?: boolean }
) {
  let form: any;
  try {
    form = pdfDoc.getForm();
  } catch {
    return false;
  }
  let anyFilled = false;
  const fields: any[] = form.getFields?.() ?? [];
  for (const f of fields) {
    const rawName = String(f.getName?.() ?? "");
    if (!rawName) continue;
    const k = normalizePdfFieldKey(rawName);
    for (const r of rules) {
      if (!r.test(k, rawName)) continue;
      try {
        if (typeof (f as any).setText === "function") {
          (f as any).setText(String(r.value ?? "").replace(/\n/g, "\r\n"));
          anyFilled = true;
        }
      } catch {}
      break;
    }
  }
  const shouldFlatten = options?.flatten ?? true;
  try {
    if (anyFilled && shouldFlatten) form.flatten();
  } catch {}
  return anyFilled;
}

function fillPdfCheckFields(
  pdfDoc: any,
  rules: Array<{ test: (k: string, raw: string) => boolean; checked: boolean }>,
  options?: { flatten?: boolean }
) {
  let form: any;
  try {
    form = pdfDoc.getForm();
  } catch {
    return false;
  }
  let anyFilled = false;
  const fields: any[] = form.getFields?.() ?? [];
  for (const f of fields) {
    const rawName = String(f.getName?.() ?? "");
    if (!rawName) continue;
    const k = normalizePdfFieldKey(rawName);
    for (const r of rules) {
      if (!r.test(k, rawName)) continue;
      try {
        if (typeof (f as any).check === "function" && typeof (f as any).uncheck === "function") {
          if (r.checked) (f as any).check();
          else (f as any).uncheck();
          anyFilled = true;
        }
      } catch {}
      break;
    }
  }
  const shouldFlatten = options?.flatten ?? true;
  try {
    if (anyFilled && shouldFlatten) form.flatten();
  } catch {}
  return anyFilled;
}

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
    const test = line ? `${line} ${w}` : w;
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

function drawWrappedPreserveNewlines(
  page: any,
  font: any,
  text: string,
  x: number,
  yStart: number,
  maxWidth: number,
  size = 11,
  lineHeight = 14
) {
  const parts = String(text ?? "").split(/\n/);
  let y = yStart;
  for (const p of parts) y = drawWrapped(page, font, p, x, y, maxWidth, size, lineHeight);
  return y;
}

function fillThirdCountryWorkplacesTable2015(form: any, workplaces: Array<{ site: string; startDate: string; endDate: string }>) {
  const fields: any[] = form.getFields?.() ?? [];
  if (!fields.length) return false;
  const rowSite: Record<number, any[]> = {};
  const rowPeriod: Record<number, any[]> = {};
  const add = (m: Record<number, any[]>, row: number, f: any) => {
    if (!m[row]) m[row] = [];
    m[row].push(f);
  };
  for (const f of fields) {
    const rawName = String(f.getName?.() ?? "");
    if (!rawName) continue;
    const k = normalizePdfFieldKey(rawName);
    const m = k.match(/(\d+)/);
    const row = m ? parseInt(m[1], 10) : NaN;
    if (!Number.isFinite(row) || row <= 0) continue;
    if (k.includes("tjanstgoringsstalle") || k.includes("tjanstgoringsstallen") || k.includes("arbetsplats") || k.includes("tjanstgoringstalle")) {
      add(rowSite, row, f);
      continue;
    }
    if (k.includes("period") || k.includes("tjanstgoringsperiod")) {
      add(rowPeriod, row, f);
      continue;
    }
  }
  let any = false;
  workplaces.forEach((w, i) => {
    const row = i + 1;
    const period = `${w.startDate || ""}${w.endDate ? ` – ${w.endDate}` : ""}`.trim();
    const site = String(w.site || "").trim();
    for (const f of rowSite[row] ?? []) {
      try {
        if (typeof f.setText === "function") {
          f.setText(site);
          any = true;
        }
      } catch {}
    }
    for (const f of rowPeriod[row] ?? []) {
      try {
        if (typeof f.setText === "function") {
          f.setText(period);
          any = true;
        }
      } catch {}
    }
  });
  return any;
}

function drawText(opts: { page: any; text: string; x: number; y: number; size: number; font: any }) {
  opts.page.drawText(opts.text ?? "", { x: opts.x, y: opts.y, size: opts.size, font: opts.font, color: rgb(0, 0, 0) });
}

export async function exportThirdCountryCertificate2015Impl(
  input: {
    profile: ProfileLike;
    delmalCodes: string;
    activitiesText: string;
    verificationText: string;
    workplaces: Array<{ site: string; startDate: string; endDate: string }>;
    cert?: any;
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const bytes = await fetchPublicPdf(TEMPLATE_2015_TREDJELAND_8A);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];
  const size = 11;
  const prof = input.profile;
  const nameParts = (prof.name ?? "").trim().split(/\s+/);
  const fallbackFirst = prof.firstName ?? (nameParts[0] ?? "");
  const fallbackLast = prof.lastName ?? (nameParts.slice(1).join(" ") || "");
  const profSpecialty = prof.speciality ?? prof.specialty ?? "";
  const workplaces = (input.workplaces || []).filter((w) => w && (w.site || w.startDate || w.endDate));
  const siteLines = workplaces.map((w) => String(w.site || "—")).join("\n");
  const periodLines = workplaces.map((w) => `${w.startDate || ""}${w.endDate ? ` – ${w.endDate}` : ""}`.trim()).join("\n");
  const delmalCodes2015 = formatDelmalCodes2015(input.delmalCodes ?? "");
  const cert: any = input.cert ?? {};
  const isAppointed = cert?.managerMode === "appointed";
  const vcName = cert?.managerSelf?.name ?? cert?.managerAppointed?.managerName ?? "";
  const vcWork = isAppointed
    ? String((cert?.managerAppointed?.managerWorkplace ?? (cert?.managerAppointed as any)?.managerWorkPlace ?? (cert?.managerAppointed as any)?.managerSite ?? (cert?.managerAppointed as any)?.managerTjanstestalle ?? (cert?.managerAppointed as any)?.managerTjänsteställe ?? "")).trim()
    : String((cert?.managerSelf?.workplace ?? (cert?.managerSelf as any)?.workPlace ?? (cert?.managerSelf as any)?.site ?? (cert?.managerSelf as any)?.tjanstestalle ?? (cert?.managerSelf as any)?.tjänsteställe ?? "")).trim();
  const vcSpec = isAppointed
    ? String((cert?.managerAppointed?.managerSpecialty ?? (cert?.managerAppointed as any)?.managerSpec ?? (cert?.managerAppointed as any)?.managerSpeciality ?? "")).trim()
    : String((cert?.managerSelf?.specialty ?? (cert?.managerSelf as any)?.speciality ?? (cert?.managerSelf as any)?.spec ?? "")).trim();
  const appointedSpecialist =
    cert?.managerAppointed?.specialistName || cert?.managerAppointed?.specialistSpecialty || cert?.managerAppointed?.specialistWorkplace
      ? `${cert?.managerAppointed?.specialistName ?? ""}${cert?.managerAppointed?.specialistSpecialty ? `, ${cert.managerAppointed.specialistSpecialty}` : ""}${cert?.managerAppointed?.specialistWorkplace ? ` (${cert.managerAppointed.specialistWorkplace})` : ""}`.trim()
      : "";
  const appointedText = isAppointed
    ? `Verksamhetschefen har enligt 4 kap. 4 § utsett en läkare med specialistkompetens att bedöma ST-läkarens specialistkompetens.${appointedSpecialist ? ` Utsedd specialist: ${appointedSpecialist}.` : ""}`
    : "";
  const appointedDocName = String(cert?.managerAppointed?.specialistName ?? "").trim();
  const appointedDocWork = String((cert?.managerAppointed?.specialistWorkplace ?? (cert?.managerAppointed as any)?.specialistWorkPlace ?? (cert?.managerAppointed as any)?.specialistSite ?? (cert?.managerAppointed as any)?.specialistTjanstestalle ?? (cert?.managerAppointed as any)?.specialistTjänsteställe ?? cert?.managerAppointed?.managerWorkplace ?? "")).trim();
  const appointedDocSpec = String(cert?.managerAppointed?.specialistSpecialty ?? "").trim();
  const intygDocName = isAppointed ? appointedDocName : vcName;
  const intygDocWork = isAppointed ? appointedDocWork : vcWork;
  const intygDocSpec = isAppointed ? appointedDocSpec : String(vcSpec ?? "").trim();
  const intygDocPn = "";
  const hhName = String(cert?.mainSupervisor?.name ?? "").trim() || String((prof as any)?.supervisor ?? (prof as any)?.huvudhandledare ?? (prof as any)?.supervisorName ?? "").trim();
  const hhWork = String(cert?.mainSupervisor?.workplace ?? "").trim() || String((prof as any)?.supervisorWorkplace ?? (prof as any)?.homeClinic ?? "").trim();
  const hhSpec = String(cert?.mainSupervisor?.specialty ?? cert?.mainSupervisor?.speciality ?? "").trim() || String((prof as any)?.supervisorSpecialty ?? (prof as any)?.supervisorSpeciality ?? profSpecialty ?? "").trim();
  const hhTrainYear = String(cert?.mainSupervisor?.trainingYear ?? "").trim();
  const hhPn = String(cert?.mainSupervisor?.personalNumber ?? "").trim();
  let detailedOverflow = "";
  let usedDetailedFields = false;
  try {
    const form = pdfDoc.getForm();
    const res = fillSequentialTextFieldsByLines({ form, predicate: (k) => k.includes("detaljerad") || k.includes("beskrivning"), text: input.verificationText ?? "", maxLinesPerField: 15 });
    usedDetailedFields = res.used;
    detailedOverflow = res.overflow;
  } catch {}
  try {
    const anyChecks = fillPdfCheckFields(pdfDoc, [{ test: (k) => k === "ja", checked: isAppointed }, { test: (k) => k === "nej", checked: !isAppointed }], { flatten: false });
    try {
      const form = pdfDoc.getForm();
      if (isAppointed) {
        try { form.getTextField("Namnförtydligande").setText(String(vcName ?? "").replace(/\n/g, "\r\n")); } catch {}
        try { form.getTextField("Tjänsteställe").setText(String(vcWork ?? "").replace(/\n/g, "\r\n")); } catch {}
      }
      try { form.getTextField("Namnförtydligande_2").setText(String(intygDocName ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Tjänsteställe_2").setText(String(intygDocWork ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Specialitet").setText(String(intygDocSpec ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Personnummer_2").setText(""); } catch {}
      try { form.getTextField("Namnförtydligande_3").setText(String(hhName ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Tjänsteställe_3").setText(String(hhWork ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Specialitet_2").setText(String(hhSpec ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Handledarutbildning årtal").setText(String(hhTrainYear ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Personnummer_3").setText(String(hhPn ?? "").replace(/\n/g, "\r\n")); } catch {}
    } catch {}
    let workplacesFilledByTable = false;
    try {
      const form = pdfDoc.getForm();
      const anyTable = fillThirdCountryWorkplacesTable2015(form, workplaces);
      if (anyTable) workplacesFilledByTable = true;
    } catch {}
    const anyOtherFilled = fillPdfTextFields(
      pdfDoc,
      [
        { test: (k) => k.includes("studierektor") && (k.includes("efternamn") || k.includes("surname") || k === "lastname"), value: ((prof as any).studyDirector ?? "") },
        { test: (k) => k.includes("studierektor") && (k.includes("fornamn") || k.includes("givenname") || k === "firstname"), value: ((prof as any).studyDirector ?? "") },
        { test: (k) => k.includes("studierektor") && (k.includes("tjanstestalle") || k.includes("tjänsteställe") || k.includes("workplace") || k.includes("site") || k.includes("clinic")), value: String(((prof as any)?.studyDirectorWorkplace && String((prof as any)?.studyDirectorWorkplace).trim()) ? (prof as any)?.studyDirectorWorkplace : String((prof as any).studyDirectorWorkplace ?? (prof as any).homeClinic ?? "")) },
        { test: (k, raw) => (k.includes("efternamn") || k.includes("surname") || k === "lastname") && !k.includes("studierektor") && String(raw).trim() !== "Efternamn", value: fallbackLast },
        { test: (k, raw) => (k.includes("fornamn") || k.includes("givenname") || k === "firstname") && !k.includes("studierektor") && String(raw).trim() !== "Förnamn", value: fallbackFirst },
        { test: (k, raw) => (k.includes("personnummer") || k === "pn" || k.includes("personnr")) && !String(raw).includes("_2") && !String(raw).includes("_3"), value: String((prof as any).personalNumber ?? "") },
        { test: (k, raw) => (k.includes("specialitet") || k.includes("speciality") || k.includes("specialty")) && !String(raw).includes("_2") && !String(raw).includes("_3") && String(raw).trim() !== "Specialitet" && String(raw).trim() !== "Specialitet_2", value: profSpecialty },
        { test: (k) => k.includes("delmal"), value: delmalCodes2015 },
        { test: (k) => k.includes("aktivitet") || k.includes("activities") || k.includes("utbildningsaktiv"), value: input.activitiesText ?? "" },
        { test: (k, raw) => isAppointed && (k.includes("namnfortyd") || k.includes("namnfor")) && !String(raw).includes("_2") && !String(raw).includes("_3") && !/\d$/.test(k), value: vcName },
        { test: (k, raw) => isAppointed && (k.includes("tjanstestalle") || k.includes("tjanstest") || k.includes("tjanstalle")) && (k.includes("namnfortyd") || k.includes("fortyd") || k.includes("chef")) && !String(raw).includes("_2") && !String(raw).includes("_3") && !/\d$/.test(k), value: vcWork },
        { test: (k) => (k.includes("4kap") || k.includes("utsett") || k.includes("bedom") || k.includes("lakare")) && (k.includes("namn") || k.includes("namnfortyd") || k.includes("namnfor")), value: intygDocName },
        { test: (k) => (k.includes("4kap") || k.includes("utsett") || k.includes("bedom") || k.includes("lakare")) && (k.includes("tjanstestalle") || k.includes("tjanstest") || k.includes("tjanstalle") || k.includes("work")), value: intygDocWork },
        { test: (k) => (k.includes("4kap") || k.includes("utsett") || k.includes("bedom") || k.includes("lakare")) && (k.includes("specialitet") || k.includes("speciality") || k.includes("specialty")), value: intygDocSpec },
        { test: (k) => (k.includes("4kap") || k.includes("utsett") || k.includes("bedom") || k.includes("lakare")) && (k.includes("personnummer") || k === "pn" || k.includes("personnr")), value: intygDocPn },
        { test: (k) => !usedDetailedFields && (k.includes("verifier") || k.includes("kontroller") || k.includes("howverified")), value: input.verificationText ?? "" },
        { test: (k, raw) => usedDetailedFields && !!detailedOverflow && (k.includes("verifier") || k.includes("kontroller") || k.includes("howverified")) && isLikelySecondPageField(k, raw), value: detailedOverflow },
        { test: (k) => !workplacesFilledByTable && (k.includes("tjanstgor") || k.includes("workplace") || k.includes("arbetsplats")) && !k.includes("period"), value: siteLines },
        { test: (k) => !workplacesFilledByTable && k.includes("period") && !k.includes("ortdatum"), value: periodLines },
        { test: (k) => k.includes("verksamhetschef") || k.includes("chef") || k.includes("manager"), value: vcName },
        { test: (k) => (k.includes("chef") || k.includes("manager")) && (k.includes("tjanst") || k.includes("work")), value: vcWork },
        { test: (k) => !anyChecks && (k.includes("4kap") || k.includes("utsett") || k.includes("bedom")), value: appointedText },
      ],
      { flatten: false }
    );
    let filled = anyOtherFilled;
    if (workplacesFilledByTable) filled = true;
    if (filled) {
      try {
        const form = pdfDoc.getForm();
        form.flatten();
      } catch {}
    }
    if (!anyOtherFilled) {
      const summary = [
        "Specialistläkare från tredje land (2015) – Bilaga 8a",
        "",
        `Namn: ${[fallbackFirst, fallbackLast].filter(Boolean).join(" ")}`,
        `Personnummer: ${String((prof as any).personalNumber ?? "")}`,
        `Specialitet: ${profSpecialty}`,
        "",
        `Delmål: ${delmalCodes2015}`,
        "",
        "Utbildningsaktiviteter:",
        String(input.activitiesText ?? ""),
        "",
        "Verifiering:",
        String(input.verificationText ?? ""),
        "",
        "Tjänstgöringsställen:",
        siteLines,
        "",
        "Period:",
        periodLines,
        "",
        `Verksamhetschef: ${vcName}${vcWork ? ` (${vcWork})` : ""}`,
        appointedText ? "" : undefined,
        appointedText || undefined,
      ].filter((l) => l !== undefined).join("\n");
      drawWrappedPreserveNewlines(page, font, summary, 40, 760, 520, 10, 12);
    }
  } catch {
    drawText({ page, text: "", x: 0, y: 0, size, font });
  }
  const outBytes = await pdfDoc.save();
  const mode = options?.output ?? "download";
  const filename = options?.filename ?? "intyg-bilaga8a-2015.pdf";
  if (mode === "blob") return toPdfBlob(outBytes);
  downloadBytes(outBytes, filename);
}

export async function exportThirdCountryCertificate2015_8bImpl(
  input: {
    profile: ProfileLike;
    cert?: any;
    delmalCodes?: string;
    activitiesText?: string;
    verificationText?: string;
    workplaces?: Array<{ site: string; startDate: string; endDate: string }>;
  },
  options?: { output?: "download" | "blob"; filename?: string }
): Promise<void | Blob> {
  const bytes = await fetchPublicPdf(TEMPLATE_2015_TREDJELAND_8B);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];
  const size = 11;
  const prof = input.profile;
  const nameParts = (prof.name ?? "").trim().split(/\s+/);
  const fallbackFirst = prof.firstName ?? (nameParts[0] ?? "");
  const fallbackLast = prof.lastName ?? (nameParts.slice(1).join(" ") || "");
  const profSpecialty = prof.speciality ?? prof.specialty ?? "";
  const workplaces = (input.workplaces || []).filter((w) => w && (w.site || w.startDate || w.endDate));
  const siteLines = workplaces.map((w) => String(w.site || "—")).join("\n");
  const periodLines = workplaces.map((w) => `${w.startDate || ""}${w.endDate ? ` – ${w.endDate}` : ""}`.trim()).join("\n");
  const delmalCodes2015 = formatDelmalCodes2015(input.delmalCodes ?? "");
  const firstNonEmptyLocal = (...vals: any[]) => {
    for (const v of vals) {
      const s = String(v ?? "").trim();
      if (s) return s;
    }
    return "";
  };
  const hemklinik = firstNonEmptyLocal((prof as any)?.homeClinic, (prof as any)?.form?.homeClinic, (prof as any)?.hemklinik, (prof as any)?.form?.hemklinik);
  const cert: any = input.cert ?? {};
  const isAppointed = cert?.managerMode === "appointed";
  const vcName = cert?.managerSelf?.name ?? cert?.managerAppointed?.managerName ?? "";
  const vcWork = isAppointed ? cert?.managerAppointed?.managerWorkplace ?? "" : cert?.managerSelf?.workplace ?? "";
  const vcSpec = isAppointed ? cert?.managerAppointed?.managerSpecialty ?? "" : cert?.managerSelf?.specialty ?? cert?.managerSelf?.speciality ?? "";
  const appointedSpecialist =
    cert?.managerAppointed?.specialistName || cert?.managerAppointed?.specialistSpecialty || cert?.managerAppointed?.specialistWorkplace
      ? `${cert?.managerAppointed?.specialistName ?? ""}${cert?.managerAppointed?.specialistSpecialty ? `, ${cert.managerAppointed.specialistSpecialty}` : ""}${cert?.managerAppointed?.specialistWorkplace ? ` (${cert.managerAppointed.specialistWorkplace})` : ""}`.trim()
      : "";
  const appointedText =
    cert?.managerMode === "appointed"
      ? `Verksamhetschefen har enligt 4 kap. 4 § utsett en läkare med specialistkompetens att bedöma ST-läkarens specialistkompetens.${appointedSpecialist ? ` Utsedd specialist: ${appointedSpecialist}.` : ""}`
      : "";
  const appointedDocName = String(cert?.managerAppointed?.specialistName ?? "").trim();
  const appointedDocWork = String((cert?.managerAppointed?.specialistWorkplace ?? (cert?.managerAppointed as any)?.specialistWorkPlace ?? (cert?.managerAppointed as any)?.specialistSite ?? (cert?.managerAppointed as any)?.specialistTjanstestalle ?? (cert?.managerAppointed as any)?.specialistTjänsteställe ?? cert?.managerAppointed?.managerWorkplace ?? "")).trim();
  const appointedDocSpec = String(cert?.managerAppointed?.specialistSpecialty ?? "").trim();
  const intygDocName = isAppointed ? appointedDocName : vcName;
  const intygDocWork = isAppointed ? appointedDocWork : vcWork;
  const intygDocSpec = isAppointed ? appointedDocSpec : String(vcSpec ?? "").trim();
  const intygDocPn = "";
  const hhName = String(cert?.mainSupervisor?.name ?? "").trim() || String((prof as any)?.supervisor ?? (prof as any)?.huvudhandledare ?? (prof as any)?.supervisorName ?? "").trim();
  const hhWork = String(cert?.mainSupervisor?.workplace ?? "").trim() || String((prof as any)?.supervisorWorkplace ?? (prof as any)?.homeClinic ?? "").trim();
  const hhSpec = String(cert?.mainSupervisor?.specialty ?? cert?.mainSupervisor?.speciality ?? "").trim() || String((prof as any)?.supervisorSpecialty ?? (prof as any)?.supervisorSpeciality ?? profSpecialty ?? "").trim();
  const hhTrainYear = String(cert?.mainSupervisor?.trainingYear ?? "").trim();
  const hhPn = String(cert?.mainSupervisor?.personalNumber ?? "").trim();
  let detailedOverflow = "";
  let usedDetailedFields = false;
  try {
    const form = pdfDoc.getForm();
    const res = fillSequentialTextFieldsByLines({ form, predicate: (k) => k.includes("detaljerad") || k.includes("beskrivning"), text: input.verificationText ?? "", maxLinesPerField: 15 });
    usedDetailedFields = res.used;
    detailedOverflow = res.overflow;
  } catch {}
  try {
    let anyChecks = false;
    try {
      anyChecks = fillPdfCheckFields(pdfDoc, [{ test: (k) => k === "ja", checked: isAppointed }, { test: (k) => k === "nej", checked: !isAppointed }], { flatten: false });
    } catch {}
    try {
      const form = pdfDoc.getForm();
      if (isAppointed) {
        try { form.getTextField("Namnförtydligande").setText(String(vcName ?? "").replace(/\n/g, "\r\n")); } catch {}
        try { form.getTextField("Tjänsteställe").setText(String(vcWork ?? "").replace(/\n/g, "\r\n")); } catch {}
      }
      try { form.getTextField("Namnförtydligande_2").setText(String(intygDocName ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Tjänsteställe_2").setText(String(intygDocWork ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Specialitet").setText(String(intygDocSpec ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Personnummer_2").setText(""); } catch {}
      try {
        const srFull = String((prof as any)?.studyDirector ?? "").trim();
        const parts = srFull.split(/\s+/).filter(Boolean);
        const srFirst = parts[0] ?? "";
        const srLast = parts.slice(1).join(" ") ?? "";
        form.getTextField("Förnamn").setText(srFirst);
        form.getTextField("Efternamn").setText(srLast || srFull);
      } catch {}
      try {
        const srWork = String(((prof as any)?.studyDirectorWorkplace && String((prof as any)?.studyDirectorWorkplace).trim()) ? (prof as any)?.studyDirectorWorkplace : hemklinik).trim();
        const norm = (s: string) => s.toLowerCase().replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "").trim();
        const want = (n: string) => {
          const x = norm(n);
          return x.includes("tjanstestalle") && x.includes("stu");
        };
        const f = form.getFields().find((ff: any) => {
          try {
            return want(String(ff?.getName?.() ?? ""));
          } catch {
            return false;
          }
        }) as any;
        if (f?.setText) {
          try { f.setText(srWork); } catch {}
        } else {
          try { form.getTextField("Tjänsteställe stu").setText(srWork); } catch {}
        }
        try {
          const tf = form.getTextField("Tjänsteställe stu") as any;
          if (tf?.updateAppearances) tf.updateAppearances(font);
        } catch {}
      } catch {}
      try { form.getTextField("Namnförtydligande_3").setText(String(hhName ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Tjänsteställe_3").setText(String(hhWork ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Specialitet_2").setText(String(hhSpec ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Handledarutbildning årtal").setText(String(hhTrainYear ?? "").replace(/\n/g, "\r\n")); } catch {}
      try { form.getTextField("Personnummer_3").setText(String(hhPn ?? "").replace(/\n/g, "\r\n")); } catch {}
    } catch {}
    const anyOtherFilled = fillPdfTextFields(
      pdfDoc,
      [
        { test: (_k, raw) => String(raw).trim() === "Tjänsteställe stu", value: String(((prof as any)?.studyDirectorWorkplace && String((prof as any)?.studyDirectorWorkplace).trim()) ? (prof as any)?.studyDirectorWorkplace : hemklinik) },
        { test: (k) => k.includes("studierektor") && (k.includes("efternamn") || k.includes("surname") || k === "lastname"), value: ((prof as any).studyDirector ?? "") },
        { test: (k) => k.includes("studierektor") && (k.includes("fornamn") || k.includes("givenname") || k === "firstname"), value: ((prof as any).studyDirector ?? "") },
        { test: (k) => k.includes("studierektor") && (k.includes("tjanstestalle") || k.includes("tjänsteställe") || k.includes("workplace") || k.includes("site") || k.includes("clinic")), value: String(((prof as any)?.studyDirectorWorkplace && String((prof as any)?.studyDirectorWorkplace).trim()) ? (prof as any)?.studyDirectorWorkplace : hemklinik) },
        { test: (k, raw) => (k.includes("efternamn") || k.includes("surname") || k === "lastname") && !k.includes("studierektor") && String(raw).trim() !== "Efternamn", value: fallbackLast },
        { test: (k, raw) => (k.includes("fornamn") || k.includes("givenname") || k === "firstname") && !k.includes("studierektor") && String(raw).trim() !== "Förnamn", value: fallbackFirst },
        { test: (k, raw) => (k.includes("personnummer") || k === "pn" || k.includes("personnr")) && !String(raw).includes("_2") && !String(raw).includes("_3"), value: String((prof as any).personalNumber ?? "") },
        { test: (k, raw) => (k.includes("specialitet") || k.includes("speciality") || k.includes("specialty")) && !String(raw).includes("_2") && !String(raw).includes("_3") && String(raw).trim() !== "Specialitet" && String(raw).trim() !== "Specialitet_2", value: profSpecialty },
        { test: (k) => k.includes("delmal"), value: delmalCodes2015 },
        { test: (k) => k.includes("aktivitet") || k.includes("activities") || k.includes("utbildningsaktiv"), value: input.activitiesText ?? "" },
        { test: (k, raw) => isAppointed && (k.includes("namnfortyd") || k.includes("namnfor") || k.includes("namnfort")) && !String(raw).includes("_2") && !String(raw).includes("_3") && !/\d$/.test(k), value: vcName },
        { test: (k, raw) => isAppointed && (k.includes("tjanstestalle") || k.includes("tjanstest") || k.includes("tjanstalle")) && (k.includes("namnfortyd") || k.includes("fortyd") || k.includes("namnfor") || k.includes("chef")) && !String(raw).includes("_2") && !String(raw).includes("_3") && !/\d$/.test(k), value: vcWork },
        { test: (k) => (k.includes("4kap") || k.includes("utsett") || k.includes("bedom") || k.includes("lakare")) && (k.includes("namn") || k.includes("namnfortyd") || k.includes("namnfor")), value: intygDocName },
        { test: (k) => (k.includes("4kap") || k.includes("utsett") || k.includes("bedom") || k.includes("lakare")) && (k.includes("tjanstestalle") || k.includes("tjanstest") || k.includes("tjanstalle") || k.includes("work")), value: intygDocWork },
        { test: (k) => (k.includes("4kap") || k.includes("utsett") || k.includes("bedom") || k.includes("lakare")) && (k.includes("specialitet") || k.includes("speciality") || k.includes("specialty")), value: intygDocSpec },
        { test: (k) => (k.includes("4kap") || k.includes("utsett") || k.includes("bedom") || k.includes("lakare")) && (k.includes("personnummer") || k === "pn" || k.includes("personnr")), value: intygDocPn },
        { test: (k) => !usedDetailedFields && (k.includes("verifier") || k.includes("kontroller") || k.includes("howverified")), value: input.verificationText ?? "" },
        { test: (k, raw) => usedDetailedFields && !!detailedOverflow && (k.includes("verifier") || k.includes("kontroller") || k.includes("howverified")) && isLikelySecondPageField(k, raw), value: detailedOverflow },
        { test: (k, raw) => (k.includes("tjanstgor") || k.includes("workplace") || k.includes("arbetsplats")) && !k.includes("period") && String(raw).trim() !== "Tjänsteställe stu", value: siteLines },
        { test: (k) => k.includes("period") && !k.includes("ortdatum"), value: periodLines },
        { test: (k) => k.includes("verksamhetschef") || k.includes("chef") || k.includes("manager"), value: vcName },
        { test: (k) => (k.includes("chef") || k.includes("manager")) && (k.includes("tjanst") || k.includes("work")), value: vcWork },
        { test: (k) => !anyChecks && (k.includes("4kap") || k.includes("utsett") || k.includes("bedom")), value: appointedText },
      ],
      { flatten: false }
    );
    try {
      const form = pdfDoc.getForm();
      form.updateFieldAppearances(font);
      try {
        const tf = form.getTextField("Tjänsteställe stu") as any;
        if (tf?.updateAppearances) tf.updateAppearances(font);
      } catch {}
    } catch {}
    try {
      const form = pdfDoc.getForm();
      form.flatten();
    } catch {}
    if (!anyOtherFilled) {
      const summary = [
        "Specialistläkare från tredje land (2015) – Bilaga 8b",
        "",
        `Namn: ${[fallbackFirst, fallbackLast].filter(Boolean).join(" ")}`,
        `Personnummer: ${String((prof as any).personalNumber ?? "")}`,
        `Specialitet: ${profSpecialty}`,
        "",
        `Delmål: ${delmalCodes2015}`,
        "",
        "Utbildningsaktiviteter:",
        String(input.activitiesText ?? ""),
        "",
        "Verifiering:",
        String(input.verificationText ?? ""),
        "",
        "Tjänstgöringsställen:",
        siteLines,
        "",
        "Period:",
        periodLines,
        "",
        `Verksamhetschef: ${vcName}${vcWork ? ` (${vcWork})` : ""}`,
        appointedText ? "" : undefined,
        appointedText || undefined,
      ].filter((l) => l !== undefined).join("\n");
      drawWrappedPreserveNewlines(page, font, summary, 40, 760, 520, 10, 12);
    }
  } catch {
    drawText({ page, text: "", x: 0, y: 0, size, font });
  }
  const outBytes = await pdfDoc.save();
  const mode = options?.output ?? "download";
  const filename = options?.filename ?? "intyg-bilaga8b-2015.pdf";
  if (mode === "blob") return toPdfBlob(outBytes);
  downloadBytes(outBytes, filename);
}

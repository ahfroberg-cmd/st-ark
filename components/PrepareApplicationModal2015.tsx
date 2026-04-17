// components/PrepareApplicationModal2015.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";

import type { Profile, Placement, Course } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { PDFDocument, StandardFonts, PDFName } from "pdf-lib";
import { fetchClinicContactsForUser } from "@/lib/clinicContacts";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import { registerModal, unregisterModal } from "@/lib/modalEscHandler";
import { AttachmentsTabContent } from "@/components/prepareApplication2015/AttachmentsTabContent";
import {
  colorsFor,
  formatAttachmentLabel,
  getBilagaName,
  GROUP_COLORS,
  sortByBilagaNumber as sortAttachmentsByBilagaNumber,
  type AttachGroup,
  type AttachmentItem,
  type PresetKey,
} from "@/components/prepareApplication2015/attachmentsDomain";
import { CertificatePreview } from "@/components/prepareApplication2015/CertificatePreview";
import { SignersTabContent } from "@/components/prepareApplication2015/SignersTabContent";
import { ThirdCountryTabContent2015 } from "@/components/prepareApplication2015/ThirdCountryTabPanel";
import { useAttachmentsPresetState } from "@/components/prepareApplication2015/useAttachmentsPresetState";
import { useInitialLoad2015 } from "@/components/prepareApplication2015/useInitialLoad2015";
import { useModalCloseAndSave } from "@/components/prepareApplication2015/useModalCloseAndSave";

/** ===================== Typer ===================== */
type LicenseCountry = { id: string; country: string; date: string };
type PriorSpecialty  = { id: string; specialty: string; country: string; date: string };

type Applicant2015 = {
  address: string;
  postalCode: string;
  city: string;
  mobile: string;
  phoneHome: string;
  phoneWork: string;

  medDegreeCountry: string;
  medDegreeDate: string;

  licenseCountries: LicenseCountry[]; // max 3

  hasPreviousSpecialistCert: boolean;
  previousSpecialties: PriorSpecialty[]; // max 3
};

type SupervisorMain = {
  name: string;
  workplace: string;
  specialty: string;
  trainingYear: string; // YYYY
  personalNumber: string;
};

type ManagerMode = "self" | "appointed";
type ManagerSelf = { name: string; workplace: string; specialty: string; personalNumber: string };
type ManagerAppointed = {
  managerName: string;
  managerWorkplace: string;
  managerSpecialty?: string;
  specialistName: string;
  specialistSpecialty: string;
  specialistWorkplace: string;
  specialistPersonalNumber: string;
};

type Certifiers = {
  studyDirector: string;
  studyDirectorWorkplace: string;
  mainSupervisor: SupervisorMain;
  managerMode: ManagerMode;
  managerSelf: ManagerSelf;
  managerAppointed: ManagerAppointed;
};

type Props = { open: boolean; onClose: () => void };

/** ===================== Hjälpare ===================== */
const STORAGE_KEY = "prepare.v2";
const COLORMAP_KEY = "prepare.v2.colormap";

const isoToday = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const makeId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** ===================== PDF-hjälpare (INTYG 2015) ===================== */
async function loadTemplate(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("Kunde inte läsa PDF-mallen: " + path);
  const buf = await res.arrayBuffer();
  return await PDFDocument.load(buf);
}
function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** ===================== STa3 Tab Content - ENDAST för 2021 ===================== */
// STa3 finns inte i 2015-versionen, se PrepareApplicationModal2021.tsx

/** ===================== Komponent ===================== */
export default function PrepareApplicationModal2015({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (open) {
      setDirty(false);
    }
  }, [open]);

  // Hämta huvudhandledare/studierektor från respektive profilsida i hemkliniken
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
        const contacts = await fetchClinicContactsForUser(user.id);
        if (cancelled) return;
        setCert((prev) => ({
          ...prev,
          studyDirector: contacts.studyDirector?.name || prev.studyDirector || "",
          studyDirectorWorkplace:
            contacts.studyDirector?.workplace || prev.studyDirectorWorkplace || contacts.clinicName || "",
          mainSupervisor: {
            ...prev.mainSupervisor,
            name: contacts.mainSupervisor?.name || prev.mainSupervisor.name || "",
            workplace:
              contacts.mainSupervisor?.workplace || prev.mainSupervisor.workplace || contacts.clinicName || "",
            specialty: contacts.mainSupervisor?.specialty || prev.mainSupervisor.specialty || "",
          },
          managerSelf: {
            ...prev.managerSelf,
            name: contacts.verksamhetschef || prev.managerSelf.name || "",
            workplace: prev.managerSelf.workplace || contacts.clinicName || "",
          },
          managerAppointed: {
            ...prev.managerAppointed,
            managerName: contacts.verksamhetschef || prev.managerAppointed.managerName || "",
            managerWorkplace: prev.managerAppointed.managerWorkplace || contacts.clinicName || "",
          },
        }));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const [profile, setProfile] = useState<Profile | null>(null);

  // Detta är alltid 2015-versionen
  const is2015 = true;

  const [tab, setTab] = useState<"signers" | "thirdCountry" | "attachments">("signers");

  // Data från DB
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  // Förhandsvisning av PDF (samma mönster som PrepareBtModal/CoursePrepModal)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function openPreviewFromBlob(blob: Blob) {
    try {
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      alert("Kunde inte skapa förhandsvisningen.");
    }
  }

  // Sökande (2015)
  const [applicant, setApplicant] = useState<Applicant2015>({

    address: "",
    postalCode: "",
    city: "",
    mobile: "",
    phoneHome: "",
    phoneWork: "",
    medDegreeCountry: "",
    medDegreeDate: isoToday(),
    licenseCountries: [{ id: makeId(), country: "", date: isoToday() }],
    hasPreviousSpecialistCert: false,
    previousSpecialties: [{ id: makeId(), specialty: "", country: "", date: isoToday() }],
  });

  // Intygare
  const managerModeChangedRef = useRef(false);

  const [cert, setCert] = useState<Certifiers>({
    studyDirector: "",
    studyDirectorWorkplace: "",
    mainSupervisor: {
      name: "",
      workplace: "",
      specialty: "",
      trainingYear: "",
      personalNumber: "",
    },
    managerMode: "self",
    managerSelf: { name: "", workplace: "", specialty: "", personalNumber: "" },
    managerAppointed: {
      managerName: "",
      managerWorkplace: "",
      managerSpecialty: "",
      specialistName: "",
      specialistSpecialty: "",
      specialistWorkplace: "",
      specialistPersonalNumber: "",
    },
  });

  // Nollställ flaggan varje gång modalen öppnas,
  // så att första valet i rullistan alltid respekteras
  useEffect(() => {
    if (open) {
      managerModeChangedRef.current = false;
    }
  }, [open]);



  // Third country specialist (bilaga 8a/8b) data
  const [thirdCountryDelmalCodes, setThirdCountryDelmalCodes] = useState<string>("");
  const [thirdCountryActivities, setThirdCountryActivities] = useState<string>("");
  const [thirdCountryVerification, setThirdCountryVerification] = useState<string>("");
  const [thirdCountryWorkplaces, setThirdCountryWorkplaces] = useState<Array<{ id: string; site: string; startDate: string; endDate: string }>>([
    { id: makeId(), site: "", startDate: isoToday(), endDate: isoToday() }
  ]);

  const sortByBilagaNumber = useCallback(
    (a: AttachmentItem, b: AttachmentItem) => sortAttachmentsByBilagaNumber(a, b),
    []
  );

  const {
    paidFeeDate,
    setPaidFeeDate,
    presetChecked,
    setPresetChecked,
    presetDates,
    setPresetDates,
    attachments,
    setAttachments,
    userReordered,
    setUserReordered,
    togglePreset,
    updatePresetDate,
  } = useAttachmentsPresetState({
    open,
    profileIsThirdCountrySpecialist: !!profile?.isThirdCountrySpecialist,
    sortByBilagaNumber,
    setDirty,
    isoToday,
  });

  /** ==== Drag & drop: snap ==== */
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [tempOrder, setTempOrder] = useState<AttachmentItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const startYRef = useRef(0);
  const DRAG_THRESHOLD = 4;

  // Säkerställ att tempOrder speglar attachments
  useEffect(() => setTempOrder(attachments), [attachments]);

  // Prefill från Profil: läkarexamensland/datum + legitimation(s)land (max 3) om tomt lokalt
  useEffect(() => {
    if (!open || !profile) return;

    setApplicant((prev) => {
      const next = { ...prev };

      if (!next.medDegreeCountry) {
        next.medDegreeCountry = String((profile as any)?.medDegreeCountry ?? "");
      }
      if (!next.medDegreeDate) {
        next.medDegreeDate = String((profile as any)?.medDegreeDate ?? isoToday());
      }

      // Om inga licensrader ifyllda lokalt: ta från profilens foreignLicenses (max 3)
      const profFL = Array.isArray((profile as any)?.foreignLicenses)
        ? ((profile as any).foreignLicenses as any[]).slice(0, 3)
        : [];

      const hasAnyLocal =
        Array.isArray(prev.licenseCountries) &&
        prev.licenseCountries.some((r) => (r?.country || r?.date));

      if (!hasAnyLocal && profFL.length) {
        next.licenseCountries = profFL.map((r: any) => ({
          id: makeId(),
          country: String(r?.country ?? ""),
          date: String(r?.date ?? ""),
        }));
      }

      return next;
    });
  }, [open, profile]);


  function computeIndexByPointer(clientY: number) {

    const rows = rowRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!rows.length) return null;
    let target = rows.length - 1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (clientY < mid) { target = i; break; }
    }
    return target;
  }

  function onPointerDownCard(i: number, e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startYRef.current = e.clientY;
    setDragIndex(i);
    setDragActive(false);
  }

  function onPointerMoveList(e: React.PointerEvent) {
    if (dragIndex == null) return;
    const dy = e.clientY - startYRef.current;
    if (!dragActive && Math.abs(dy) >= DRAG_THRESHOLD) {
      setDragActive(true);
      document.body.style.userSelect = "none";
    }
    if (!dragActive) return;

    const overIndex = computeIndexByPointer(e.clientY);
    if (overIndex == null || overIndex === dragIndex) {
      if (e.cancelable) e.preventDefault();
      return;
    }

    setTempOrder((curr) => {
      const next = [...curr];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      return next;
    });
    setDragIndex(overIndex);
    startYRef.current = e.clientY;
    if (e.cancelable) e.preventDefault();
  }

    function onPointerUpList() {
    if (dragIndex != null) {
      setAttachments(tempOrder);
      setUserReordered(true);
      setDirty(true);
    }
    setDragIndex(null);
    setDragActive(false);
    document.body.style.userSelect = "";
  }

  useInitialLoad2015({
    open,
    storageKey: STORAGE_KEY,
    isoToday,
    makeId,
    presetChecked,
    presetDates,
    sortByBilagaNumber,
    managerModeChangedRef,
    setProfile,
    setPlacements,
    setCourses,
    setApplicant,
    setCert,
    setAttachments,
    setTempOrder,
    setPaidFeeDate,
    setPresetChecked,
    setPresetDates,
    setThirdCountryDelmalCodes,
    setThirdCountryActivities,
    setThirdCountryVerification,
    setThirdCountryWorkplaces,
  });

  // Sync från Profil -> "Uppgifter om sökande" (överstyr fälten när profil ändras/öppnas)
// Inkluderar: examensland/datum, licensländer, samt TIDIGARE SPECIALITETER (längst ned).
useEffect(() => {
  if (!open || !profile) return;
  const prof = profile as any;

  setApplicant((prev) => {
    // Bygg licenslista (max 3) från profil
    const lic: Array<{ id: string; country: string; date: string }> = [];
    if (prof.licenseCountry) {
      lic.push({
        id: makeId(),
        country: String(prof.licenseCountry),
        date: String(prof.licenseDate || ""),
      });
    }
    if (Array.isArray(prof.foreignLicenses)) {
      for (const r of prof.foreignLicenses) {
        if (lic.length >= 3) break;
        lic.push({
          id: makeId(),
          country: String(r?.country || ""),
          date: String(r?.date || ""),
        });
      }
    }

    // Bygg tidigare specialiteter (max 3) från profil
    const priorListSrc: any[] = Array.isArray(prof.priorSpecialties) ? prof.priorSpecialties : [];
    const priorList = priorListSrc.slice(0, 3).map((r) => ({
      id: makeId(),
      specialty: String((r?.specialty ?? r?.speciality) || ""), // hantera båda stavningarna
      country: String(r?.country || ""),
      date: String(r?.date || ""),
    }));

    return {
      ...prev,
      // Överstyr examensland/datum från profilen (profilmodalen vinner)
      medDegreeCountry: String(prof.medDegreeCountry ?? prev.medDegreeCountry ?? ""),
      medDegreeDate: String(prof.medDegreeDate ?? prev.medDegreeDate ?? ""),

      // Överstyr licensrader om profil har info, annars behåll modalfält
      licenseCountries: lic.length ? lic : (prev.licenseCountries ?? []),

      // Överstyr “Tidigare specialistbevis” nederst med profilens uppgifter
      hasPreviousSpecialistCert:
        Boolean(prof.hasPriorSpecialist) || priorList.length > 0,
      previousSpecialties: priorList.length ? priorList : (prev.previousSpecialties ?? []),
    };
  });
}, [open, profile]);

/** ===================== Validering (lätt) ===================== */

  function validate2015(): boolean {
    if (!profile?.name || !(profile as any).personalNumber || !(profile as any).homeClinic) {
      alert("Komplettera din profil (namn, personnummer, arbetsplats).");
      return false;
    }
    return true;
  }


async function debugDumpFields(pdfDoc: PDFDocument) {
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  // Logga alla fältnamn och typ i konsolen
  console.groupCollapsed("[PDF] Form fields");
  fields.forEach((f, i) => {
    const name = f.getName();
    const ctor = (f as any).constructor?.name ?? "Field";
    console.log(`${i.toString().padStart(2, "0")}  ${name}  (${ctor})`);
  });
  console.groupEnd();
  return fields;
}

// Liten hjälpare: sätt text om fältet finns, annars ignorera.
function trySetText(form: any, name: string, val: string) {
  try { form.getTextField(name).setText(val); } catch {/* ignore */}
}

// Liten hjälpare: sätt checkbox om fältet finns
function trySetCheck(form: any, name: string, on: boolean) {
  try { const cb = form.getCheckBox(name); on ? cb.check() : cb.uncheck(); } catch {/* ignore */}
}



  /** ===================== Utskrift: INTYG (PDF) ===================== */

// Mått & rit-hjälpare
const mmToPt = (mm: number) => (mm * 72) / 25.4; // 1 pt = 1/72", 1" = 25.4 mm

// Normalisera text till PDF-säkra tecken (undvik sidfel p.g.a. ovanliga Unicode-tecken)
function normalizePdfText(input?: string): string {
  const s = (input ?? "")
    // radbrytningar/tabbar → mellanslag (pdf-lib drawText hanterar inte \n)
    .replace(/\r\n|\r|\n|\t/g, " ")
    // hårt mellanslag → vanligt mellanslag
    .replace(/\u00A0/g, " ")
    // olika bindestreck/em-dash → vanligt bindestreck
    .replace(/[‐-‒–—―]/g, "-")
    // typografiska citattecken → raka
    .replace(/[“”„‟]/g, '"')
    .replace(/[’‚‛]/g, "'")
    // punkter/bullets → stjärna
    .replace(/[•·]/g, "*")
    // ta bort kontrolltecken/utanför Latin-1 (Helvetica WinAnsi)
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "");
  // Trimma dubbla mellanslag
  return s.replace(/ {2,}/g, " ").trim();
}

function drawLabel(page: any, font: any, text: string, x: number, y: number, size = 11) {
  const cleaned = normalizePdfText(text);
  if (!cleaned) return;
  page.drawText(cleaned, { x, y, size, font });
}

// (Valfritt) rutnät vid justering
function drawGrid(page: any, stepPt = 20) {
  const { width, height } = page.getSize();
  for (let x = 0; x <= width; x += stepPt) page.drawLine({ start: { x, y: 0 }, end: { x, y: height }, opacity: 0.08, lineWidth: 0.5 });
  for (let y = 0; y <= height; y += stepPt) page.drawLine({ start: { x: 0, y }, end: { x: width, y }, opacity: 0.08, lineWidth: 0.5 });
}


/* ---------- 2015 – Intyg om uppnådd specialistkompetens ---------- */
/* Startvärden – justera x/y tills det sitter perfekt. */
const coordsIntyg2015 = {
  // Sökande
  efternamn:            { x: 76,  y: 655 },
  fornamn:              { x: 303, y: 655 },
  personnummer:         { x: 76,  y: 627 },
  specialitet:          { x: 76,  y: 708 },

  // Ja = verksamhetschefen intygar själv. Nej = verksamhetschefen har utsett specialist.
  vc_yes_center:        { x: 489, y: 522 }, 
  vc_no_center:         { x: 82, y: 496 }, 

  // Signaturrad (den som faktiskt skriver under intyget)
  // Fylls med: appointed => utsedd specialist, self => verksamhetschef
  vc_namnfortydligande: { x: 303, y: 241 },
  vc_personnummer:      { x: 76,  y: 213 },
  vc_specialitet:       { x: 76,  y: 297 },
  vc_tjanstestalle:     { x: 76,  y: 269 },
  vc_ortDatum:          { x: 455, y: 558 },

  // Verksamhetschef – SELF-läge (egen rad/position)
  mgrSelf_namn:         { x: 76,  y: 640 },
  mgrSelf_tjanstestalle:{ x: 455, y: 640 },

  // Verksamhetschef – APPOINTED-läge (placeras på annan rad/position)
  mgrApp_namn:          { x: 76,  y: 455 },
  mgrApp_tjanstestalle: { x: 303, y: 455 },

  // Utsedd specialist (extra rad när appointed är valt)
  sp_namn:              { x: 303,  y: 241 },
  sp_personnummer:      { x: 76, y: 213 },
  sp_specialitet:       { x: 76, y: 297 },
  sp_tjanstestalle:     { x: 76,  y: 269 },

  // (Studierektor – om din mall har det blocket)
  sr_efternamn:         { x: 76,  y: 402 },
  sr_fornamn:           { x: 303, y: 402 },
  sr_tjanstestalle:     { x: 76,  y: 373 },

  // Huvudansvarig handledare
  mh_namnfortydligande: { x: 303, y: 103 },
  mh_personnummer:      { x: 76, y: 74 },
  mh_specialitet:       { x: 76, y: 159 },
  mh_handledarAr:       { x: 430,  y: 159 },
  mh_tjanstestalle:     { x: 76, y: 130 },
  mh_ortDatum:          { x: 455, y: 475 },

} as const;



async function onPrintAnsokan() {
  if (!validate2015()) return;

  const safe = (v?: string) => (v == null ? "" : String(v));
  const toYYMMDD = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = String(d.getFullYear()).slice(-2);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${dd}`;
  };
  const splitName = (full?: string) => {
    const f = safe(full).trim();
    if (!f) return { first: "", last: "" };
    const parts = f.split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: "" };
    const last = parts.pop() as string;
    const first = parts.join(" ");
    return { first, last };
  };
  const monthDiffExact = (startISO?: string, endISO?: string) => {
    const s = new Date(startISO || "");
    const e = new Date(endISO || "");
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const ms = e.getTime() - s.getTime();
    const days = ms / (1000 * 60 * 60 * 24);
    return Math.max(0, days / 30.4375);
  };
  const pickPercent = (p: any) => {
    const v = Number(
      p?.attendance ??
      p?.percent ??
      p?.ftePercent ??
      p?.scopePercent ??
      p?.omfattning ??
      100
    );
    return Number.isFinite(v) && v > 0 ? Math.min(100, Math.max(0, v)) : 100;
  };


  try {
    const templatePath = "/pdf/2015/blankett-bevis-specialistkompetens-sosfs20158.pdf";
    const pdfDoc = await loadTemplate(templatePath);
const form = pdfDoc.getForm();
const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

// 1) Rensa ev. "0" i formulärfält (t.ex. summa/total) och flattena så att annotationer inte ligger över
try {
  form.getFields().forEach((f: any) => {
    const name = String(f.getName() || "");
    const ctor = (f as any).constructor?.name;
    const getText = (f as any).getText?.bind(f);
    const val = typeof getText === "function" ? String(getText() ?? "") : "";

    if (ctor === "PDFTextField" && (/(sum|total)/i.test(name) || /^\s*0([.,]0+)?\s*$/.test(val))) {
      (f as any).setText(""); // rensa nollan
    }
  });
  form.updateFieldAppearances(helv);
  form.flatten(); // lägger text i sidans innehåll och tar bort widget-lagret
} catch { /* ignore */ }

const pages = pdfDoc.getPages();
const page1 = pages[0];
const page2 = pages[1];
const page3 = pages[2];

// 2) Ta bort ALLA annotationer på sida 2 som extra säkerhet (så inget ligger över din vita rektangel)
try {
  (page2 as any).node.set(PDFName.of('Annots'), pdfDoc.context.obj([]));
} catch { /* ignore */ }



    // ====== DATA ======
    const p: any = profile || {};
    const pn = safe(p.personalNumber);
    const spec = safe(p.specialty);
    const { first: firstName, last: lastName } = splitName(p.name);
    const homeClinic = safe(p.homeClinic);

    const addr = safe(
      applicant.address ||
      (profile as any)?.address
    );
    const zip  = safe(
      applicant.postalCode ||
      (profile as any)?.postalCode
    );
    const city = safe(
      applicant.city ||
      (profile as any)?.city
    );
    const phoneHome   = safe(
      applicant.phoneHome ||
      (profile as any)?.phoneHome
    );
    const phoneWork   = safe(
      applicant.phoneWork ||
      (profile as any)?.phoneWork
    );
    const phoneMobile = safe(
      applicant.mobile ||
      (profile as any)?.mobile
    );
    const email = safe((profile as any)?.email);

    const medCountry = safe(
      (profile as any)?.licenseCountry
      || (profile as any)?.medDegreeCountry
      || applicant.medDegreeCountry
    );

    const medDate    = toYYMMDD(
      applicant.medDegreeDate
      || (profile as any)?.medDegreeDate
    );

    


    // ====== RIT-HJÄLP ======
    const draw = (pg: any, txt: string, x: number, y: number, size = 11) => {
  const s = normalizePdfText(txt);
  if (!s) return;
  pg.drawText(s, { x, y, size, font: helv });
};


    // ====== KOORDINATER ======
    const C1 = {
      specialty:   { x: 76,  y: 629 },
      lastName:    { x: 76,  y: 562 },
      firstName:   { x: 303, y: 562 },
      personNum:   { x: 76,  y: 534 },
      address:     { x: 231, y: 534 },
      zip:         { x: 76,  y: 506 },
      city:        { x: 170, y: 506 },
      phoneHome:   { x: 394, y: 506 },
      phoneMobile: { x: 76,  y: 478 },
      email:       { x: 231, y: 478 },
      workplace:   { x: 76,  y: 450 },
      phoneWork:   { x: 394, y: 450 },

      medCountry:  { x: 76,  y: 384 },
      medDate:     { x: 320, y: 384 },

      lic1_country:{ x: 76,  y: 330 },
      lic1_date:   { x: 320, y: 330 },
      lic2_country:{ x: 76,  y: 302 },
      lic2_date:   { x: 320, y: 302 },
      lic3_country:{ x: 76,  y: 274 },
      lic3_date:   { x: 320, y: 274 },

      prev1_spec:  { x: 76,  y: 221 },
      prev1_country:{x: 76, y: 192 },
      prev1_date:  { x: 320, y: 192 },
      prev2_spec:  { x: 76,  y: 164 },
      prev2_country:{x: 76, y: 136 },
      prev2_date:  { x: 320, y: 136 },
      prev3_spec:  { x: 76,  y: 108 },
      prev3_country:{x: 76,  y: 80 },
      prev3_date:  { x: 320,  y: 80 },
    } as const;

const C2 = {
  colClinic:   76,
  colPeriod:   270,
  colPercent:  417,
  colMonths:   485,
  startY:      725,
  rowStep:     20,
  maxRows:     33,
  sumY:        68,
  sumX:        485,
} as const;


    const C3 = {
      lineStep: 16,
      uppnadd:     { x: 76, y: 756 },
      third8a:     { x: 76, y: 703 }, // Bilaga 8a - Uppfyllda kompetenskrav
      third8b:     { x: 76, y: 650 }, // Bilaga 8b - Uppnådd specialistkompetens
      ausk:        { x: 76, y: 597 },
      klinik:      { x: 76, y: 544 },
      kurser:      { x: 76, y: 491 },
      kval:        { x: 76, y: 438 },
      vet:         { x: 76, y: 385 },
      svDoc:       { x: 76, y: 307 },
      foreignDoc:  { x: 76, y: 254 },
      foreignServ: { x: 76, y: 201 },
      individProg: { x: 76, y: 148 },
      paidFee:     { x: 425, y: 146 },
    } as const;

    // ====== SIDA 1 ======
    draw(page1, spec,           C1.specialty.x,   C1.specialty.y);
    draw(page1, lastName,       C1.lastName.x,    C1.lastName.y);
    draw(page1, firstName,      C1.firstName.x,   C1.firstName.y);
    draw(page1, pn,             C1.personNum.x,   C1.personNum.y);
    draw(page1, addr,           C1.address.x,     C1.address.y);
    draw(page1, email,          C1.email.x,       C1.email.y);
    draw(page1, zip,            C1.zip.x,         C1.zip.y);
    draw(page1, city,           C1.city.x,        C1.city.y);
    draw(page1, phoneHome,      C1.phoneHome.x,   C1.phoneHome.y);
    draw(page1, phoneMobile,    C1.phoneMobile.x, C1.phoneMobile.y);
    draw(page1, homeClinic,     C1.workplace.x,   C1.workplace.y);
    draw(page1, phoneWork,      C1.phoneWork.x,   C1.phoneWork.y);

    draw(page1, medCountry,     C1.medCountry.x,  C1.medCountry.y);
    draw(page1, medDate,        C1.medDate.x,     C1.medDate.y);


    const lic = (() => {
      const prof = (profile as any) || {};
      const list: Array<{ country: string; date: string }> = [];
      if (prof.licenseCountry) {
        list.push({ country: String(prof.licenseCountry), date: String(prof.licenseDate || "") });
      }
      if (Array.isArray(prof.foreignLicenses)) {
        for (const r of prof.foreignLicenses) {
          if (list.length >= 3) break;
          list.push({ country: String(r?.country || ""), date: String(r?.date || "") });
        }
      }
      const fromApplicant = (applicant.licenseCountries ?? []).map((r: any) => ({
        country: String(r?.country || ""),
        date: String(r?.date || ""),
      }));
      const effective = list.length ? list : fromApplicant;
      return effective.slice(0, 3);
    })();

    if (lic[0]) { draw(page1, safe(lic[0].country), C1.lic1_country.x, C1.lic1_country.y);
                  draw(page1, toYYMMDD(lic[0].date),C1.lic1_date.x,    C1.lic1_date.y); }
    if (lic[1]) { draw(page1, safe(lic[1].country), C1.lic2_country.x, C1.lic2_country.y);
                  draw(page1, toYYMMDD(lic[1].date),C1.lic2_date.x,    C1.lic2_date.y); }
    if (lic[2]) { draw(page1, safe(lic[2].country), C1.lic3_country.x, C1.lic3_country.y);
                  draw(page1, toYYMMDD(lic[2].date),C1.lic3_date.x,    C1.lic3_date.y); }

    if (applicant.hasPreviousSpecialistCert) {
      const prev = applicant.previousSpecialties?.slice(0, 3) ?? [];
      if (prev[0]) { draw(page1, safe(prev[0].specialty), C1.prev1_spec.x,    C1.prev1_spec.y);
                     draw(page1, safe(prev[0].country),   C1.prev1_country.x, C1.prev1_country.y);
                     draw(page1, toYYMMDD(prev[0].date),  C1.prev1_date.x,    C1.prev1_date.y); }
      if (prev[1]) { draw(page1, safe(prev[1].specialty), C1.prev2_spec.x,    C1.prev2_spec.y);
                     draw(page1, safe(prev[1].country),   C1.prev2_country.x, C1.prev2_country.y);
                     draw(page1, toYYMMDD(prev[1].date),  C1.prev2_date.x,    C1.prev2_date.y); }
      if (prev[2]) { draw(page1, safe(prev[2].specialty), C1.prev3_spec.x,    C1.prev3_spec.y);
                     draw(page1, safe(prev[2].country),   C1.prev3_country.x, C1.prev3_country.y);
                     draw(page1, toYYMMDD(prev[2].date),  C1.prev3_date.x,    C1.prev3_date.y); }
    }

    // ====== SIDA 2 – Tjänsteförteckning ======
    type Row = {
      clinic: string;
      period: string;
      percent: number;
      monthsExact: number;
      monthsRounded: number;
      start: Date;
    };

    const rows: Row[] = placements
      .filter((pl) => pl?.startDate && pl?.endDate)
      .map((pl) => {
        const clinic = safe((pl as any).clinic || (pl as any).note || "-");

        const sISO = safe((pl as any).startDate);
        const eISO = safe((pl as any).endDate || (pl as any).startDate);
        const percent = pickPercent(pl);
        const mExact = monthDiffExact(sISO, eISO) * (percent / 100);

        // Avrunda till närmaste 0,5 månad
        const mRounded = Math.round(mExact * 2) / 2;

        const period = `${toYYMMDD(sISO)} - ${toYYMMDD(eISO)}`;

        return {
          clinic,
          period,
          percent,
          monthsExact: mExact,
          monthsRounded: mRounded,
          start: new Date(sISO || ""),
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const totalRounded = rows.reduce((acc, r) => acc + r.monthsRounded, 0);

    const formatMonths = (value: number): string => {
      if (!Number.isFinite(value)) return "";
      const whole = Math.floor(value);
      const frac = value - whole;

      if (Math.abs(frac) < 1e-6) {
        // Heltal
        return String(whole);
      }
      if (Math.abs(frac - 0.5) < 1e-6) {
        // Halvtal → kommatecken
        return `${whole},5`;
      }
      // Fallback (om något skulle hamna utanför 0 eller 0,5)
      return value.toFixed(1).replace(".", ",");
    };

    const cap = Math.min(C2.maxRows, rows.length);
    for (let i = 0; i < cap; i++) {
      const y = C2.startY - i * C2.rowStep;
      const r = rows[i];
      draw(page2, r.clinic,                  C2.colClinic,  y);
      draw(page2, r.period,                  C2.colPeriod,  y);
      draw(page2, String(r.percent),         C2.colPercent, y);
      draw(page2, formatMonths(r.monthsRounded), C2.colMonths,  y);
    }

    draw(page2, formatMonths(totalRounded), C2.sumX, C2.sumY, 11);




    // ====== SIDA 3 – Bilagor ======
    const numbered = attachments.map((a, idx) => ({ ...a, nr: idx + 1 }));
    const at = {
      "Uppnådd specialistkompetens": C3.uppnadd,
      "Auskultationer":               C3.ausk,
      "Kliniska tjänstgöringar under handledning": C3.klinik,
      "Kurser":                       C3.kurser,
      "Utvecklingsarbete":            C3.kval,
      "Vetenskapligt arbete":         C3.vet,
      "Uppfyllda kompetenskrav för specialistläkare från tredjeland": C3.third8a,
      "Uppnådd specialistkompetens för specialistläkare från tredjeland": C3.third8b,
      "Svensk doktorsexamen":         C3.svDoc,
      "Utländsk doktorsexamen":       C3.foreignDoc,
      "Utländsk tjänstgöring":        C3.foreignServ,
      "Individuellt utbildningsprogram": C3.individProg,
    } as const;

    const writeBilagaList = (pg: any, type: AttachGroup) => {
  const start = (at as any)[type] as { x: number; y: number } | undefined;
  if (!start) return;
  const nums = numbered
    .filter((x) => x.type === type)
    .map((x) => String(x.nr));
  if (!nums.length) return;
  draw(pg, nums.join(", "), start.x, start.y);
};


    (Object.keys(at) as AttachGroup[]).forEach((k) => writeBilagaList(page3, k));

    draw(page3, toYYMMDD(paidFeeDate), C3.paidFee.x, C3.paidFee.y);

      const todayISO = new Date().toISOString().slice(0, 10);

  const bytes = await pdfDoc.save({ useObjectStreams: false });
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  openPreviewFromBlob(blob);

  } catch (e: any) {
    console.error(e);
    alert(e?.message || "Kunde inte skapa PDF.");
  }
}







/** ===================== Baseline och restore ===================== */
const currentSnapshot = useCallback(() => {
  return {
    placements: structuredClone(placements),
    courses: structuredClone(courses),
    applicant: structuredClone(applicant),
    cert: structuredClone(cert),
    attachments: structuredClone(attachments),
    paidFeeDate,
    presetChecked: structuredClone(presetChecked),
    presetDates: structuredClone(presetDates),
    tab,
    userReordered,
    thirdCountryDelmalCodes,
    thirdCountryActivities,
    thirdCountryVerification,
    thirdCountryWorkplaces: structuredClone(thirdCountryWorkplaces),
  };
}, [
  placements,
  courses,
  applicant,
  cert,
  attachments,
  paidFeeDate,
  presetChecked,
  presetDates,
  tab,
  userReordered,
  thirdCountryDelmalCodes,
  thirdCountryActivities,
  thirdCountryVerification,
  thirdCountryWorkplaces,
]);

const applySnapshot = useCallback(
  (b: ReturnType<typeof currentSnapshot>) => {
    setPlacements(b.placements);
    setCourses(b.courses);
    setApplicant(b.applicant);
    setCert(b.cert);
    setAttachments(b.attachments);
    setPaidFeeDate(b.paidFeeDate);
    setPresetChecked(b.presetChecked);
    setPresetDates(b.presetDates);
    setTab(b.tab);
    setUserReordered(b.userReordered);
    setThirdCountryDelmalCodes(b.thirdCountryDelmalCodes);
    setThirdCountryActivities(b.thirdCountryActivities);
    setThirdCountryVerification(b.thirdCountryVerification);
    setThirdCountryWorkplaces(
      b.thirdCountryWorkplaces || [{ id: makeId(), site: "", startDate: isoToday(), endDate: isoToday() }]
    );
  },
  [setAttachments, setPaidFeeDate, setPresetChecked, setPresetDates, setUserReordered]
);

const persistAllChanges = useCallback(async (): Promise<boolean> => {
  const payload = {
    id: "default",
    placements,
    courses,
    applicant,
    cert,
    attachments,
    paidFeeDate,
    presetChecked,
    presetDates,
    tab,
    userReordered,
    // Third country data
    thirdCountryDelmalCodes,
    thirdCountryActivities,
    thirdCountryVerification,
    thirdCountryWorkplaces,
    savedAt: new Date().toISOString(),
    version: 8,
  };
  try {
    // Spara till Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase
        .from("app_drafts")
        .upsert({
          user_id: user.id,
          draft_key: "st_application_2015",
          draft_data: payload,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,draft_key" });
    }
    localStorage.setItem(COLORMAP_KEY, JSON.stringify(GROUP_COLORS));
    return true;
  } catch (err) {
    console.error("Kunde inte spara specialistansökan:", err);
    return false;
  }
}, [placements, courses, applicant, cert, attachments, paidFeeDate, presetChecked, presetDates, tab, userReordered, thirdCountryDelmalCodes, thirdCountryActivities, thirdCountryVerification, thirdCountryWorkplaces]);

const {
  showCloseConfirm,
  handleRequestClose,
  handleConfirmClose,
  handleCancelClose,
  handleSaveAndClose,
  handleSaveAll,
} = useModalCloseAndSave({
  open,
  dirty,
  setDirty,
  onClose,
  getSnapshot: currentSnapshot,
  applySnapshot,
  onSave: persistAllChanges,
  initDeps: [profile, placements.length, courses.length],
  dirtyDeps: [
    placements,
    courses,
    applicant,
    cert,
    attachments,
    paidFeeDate,
    presetChecked,
    presetDates,
    tab,
    userReordered,
    thirdCountryDelmalCodes,
    thirdCountryActivities,
    thirdCountryVerification,
    thirdCountryWorkplaces,
  ],
});

  // Registrera modalen för global ESC-hantering
  useEffect(() => {
    if (!open || !overlayRef.current) return;
    registerModal(overlayRef.current, handleRequestClose);
    return () => {
      if (overlayRef.current) {
        unregisterModal(overlayRef.current);
      }
    };
  }, [open, handleRequestClose]);

  /** ===================== Utskrift: INTYG (PDF) ===================== */

  async function onPrintIntyg() {
    if (!validate2015()) return;

    const safe = (v?: string) => (v == null ? "" : String(v));
    const splitName = (full?: string) => {
      const f = safe(full).trim();
      if (!f) return { first: "", last: "" };
      const parts = f.split(/\s+/);
      if (parts.length === 1) return { first: parts[0], last: "" };
      const last = parts.pop() as string;      // efternamn = sista ordet
      const first = parts.join(" ");           // övriga ord = förnamn/mellannamn
      return { first, last };
    };


    try {
      const templatePath = "/pdf/2015/blankett-uppnadd-specialistkompetens-sosfs20158.pdf";
      const pdfDoc = await loadTemplate(templatePath);
      const form = pdfDoc.getForm();
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Ta bort formulär-annoteringar så att de inte ligger ovanpå våra kryss
      try {
        form.flatten();
      } catch { /* ignore */ }

      // === DATA (definiera innan vi använder dem) ===
      const prof = (profile as any) || {};
      const isAppointed = cert.managerMode === "appointed";

      // === DATA forts. ===
      const spec = safe(prof.specialty);
      const pn = safe(prof.personalNumber);
      const { first: firstName, last: lastName } = splitName(prof.name);
      const homeClinic = safe(prof.homeClinic);

      const vc = isAppointed ? cert.managerAppointed : cert.managerSelf;
      const vcName = safe(isAppointed ? (vc as any).specialistName || (vc as any).managerName : (vc as any).name);
      // Personnummer används inte längre
      const vcSpec = safe(isAppointed ? (vc as any).specialistSpecialty : (vc as any).specialty);
      const vcWork = safe(isAppointed ? (vc as any).specialistWorkplace || (vc as any).managerWorkplace : (vc as any).workplace);

      const mh = cert.mainSupervisor;
      // OBS: huvudhandledarens namn ska INTE delas upp i PDF, skrivs i sin helhet senare
      const mhName = safe(mh.name || (profile as any)?.supervisor);
      // Personnummer används inte längre
      // Förifyll handledarspecialitet från profilen om den inte är ifylld i cert
      const mhSpec = safe(mh.specialty || (profile as any)?.specialty);
      const mhYear = safe(mh.trainingYear);
      const mhWork = safe(mh.workplace || homeClinic);

      const todayISO = new Date().toISOString().slice(0, 10);
      const vcOrtDatum = "";

      const mhOrtDatum = "";

      // === RITA TEXT PÅ EXAKTA KOORDINATER ===
      const page = pdfDoc.getPages()[0];

      const c = coordsIntyg2015;
      const fontSize = 11;

      // (valfritt) slå på rutnät vid justering
      // drawGrid(page, 20);

      // --- Kryssruta: rita X vid Ja/Nej med koordinater ---
      function drawX(page: any, cx: number, cy: number, size = 12, lineWidth = 1.5) {
        const half = size / 2;
        page.drawLine({ start: { x: cx - half, y: cy - half }, end: { x: cx + half, y: cy + half }, lineWidth });
        page.drawLine({ start: { x: cx - half, y: cy + half }, end: { x: cx + half, y: cy - half }, lineWidth });
      }
      // På raden "Verksamhetschefen har enligt ... utsett en läkare med specialistkompetens...":
      // (justerad enligt observerat beteende i appen)
      // - Om managerMode === "self" ska rutan "Ja" kryssas.
      // - Om verksamhetschefen har utsett någon annan (managerMode !== "self") ska rutan "Nej" kryssas.
      if (cert.managerMode === "self") {
        // -> kryss i JA-rutan
        drawX(page, c.vc_yes_center.x, c.vc_yes_center.y);
      } else {
        // -> kryss i NEJ-rutan
        drawX(page, c.vc_no_center.x,  c.vc_no_center.y);
      }

      // --- SÖKANDE ---
      drawLabel(page, helvetica, lastName,            c.efternamn.x,            c.efternamn.y,            fontSize);

      drawLabel(page, helvetica, firstName,           c.fornamn.x,              c.fornamn.y,              fontSize);
      drawLabel(page, helvetica, pn,                  c.personnummer.x,         c.personnummer.y,         fontSize);
      drawLabel(page, helvetica, spec,                c.specialitet.x,          c.specialitet.y,          fontSize);

      // --- VERKSAMHETSCHEF + (ev) UTSEDD SPECIALIST ---

      // 1) Verksamhetschefens namn & tjänsteställe visas i båda lägena
      // Verksamhetschefens namn kommer alltid från profilen (readonly)
      const managerNameFromProfile = safe((profile as any)?.verksamhetschef || "");
      const managerWork = isAppointed ? cert.managerAppointed.managerWorkplace : cert.managerSelf.workplace;

      // --- VERKSAMHETSCHEF + (ev) UTSEDD SPECIALIST ---
      // I self-läge: INGEN separat VC-rad (undvik dublett). Endast signaturraden.
      // I appointed-läge: separat VC-rad + separat rad för utsedd specialist, och signaturraden fylls med specialist.

      if (isAppointed) {
        // Verksamhetschef (appointed) – separat rad
        // Verksamhetschefens namn kommer från profilen (readonly)
        drawLabel(page, helvetica, managerNameFromProfile,      c.mgrApp_namn.x,          c.mgrApp_namn.y,          fontSize);
        drawLabel(page, helvetica, cert.managerAppointed.managerWorkplace || "", c.mgrApp_tjanstestalle.x, c.mgrApp_tjanstestalle.y, fontSize);

        // Ingen signaturrad här – den ritas i blocket "2) Signaturraden ..." nedan.
      } else {

        // SELF-läge: hoppa över separat VC-rad (ingen dublett)

        // Signaturrad = verksamhetschefen (utan PN)
        // Verksamhetschefens namn kommer från profilen (readonly)
        drawLabel(page, helvetica, managerNameFromProfile,           c.vc_namnfortydligande.x, c.vc_namnfortydligande.y, fontSize);
        // Personnummer ska inte fyllas i
        drawLabel(page, helvetica, cert.managerSelf.specialty || "",      c.vc_specialitet.x,       c.vc_specialitet.y,       fontSize);
        drawLabel(page, helvetica, cert.managerSelf.workplace || "",      c.vc_tjanstestalle.x,     c.vc_tjanstestalle.y,     fontSize);
        drawLabel(page, helvetica, vcOrtDatum,                            c.vc_ortDatum.x,          c.vc_ortDatum.y,          fontSize);
      }

      // 2) Signaturraden (vc_*) = den som faktiskt signerar intyget:
      //    appointed => utsedd specialist (signerar), self => verksamhetschef
      const signerName = isAppointed ? (cert.managerAppointed.specialistName || managerNameFromProfile) : managerNameFromProfile;
      // Personnummer ska inte fyllas i
      const signerSpec = isAppointed ? cert.managerAppointed.specialistSpecialty       : cert.managerSelf.specialty;
      const signerWork = isAppointed
        ? (cert.managerAppointed.specialistWorkplace || cert.managerAppointed.managerWorkplace)
        : managerWork;

      // Alltid fyll signaturraden med den som faktiskt signerar (utan personnummer)
      drawLabel(page, helvetica, signerName, c.vc_namnfortydligande.x, c.vc_namnfortydligande.y, fontSize);
      // Personnummer-fältet lämnas tomt
      drawLabel(page, helvetica, signerSpec, c.vc_specialitet.x,       c.vc_specialitet.y,       fontSize);
      drawLabel(page, helvetica, signerWork, c.vc_tjanstestalle.x,     c.vc_tjanstestalle.y,     fontSize);
      drawLabel(page, helvetica, vcOrtDatum, c.vc_ortDatum.x,          c.vc_ortDatum.y,          fontSize);

      // 3) Extra rad för utsedd specialist när appointed är valt (utan personnummer)
      if (isAppointed) {
        drawLabel(page, helvetica, cert.managerAppointed.specialistName,       c.sp_namn.x,         c.sp_namn.y,         fontSize);
        // Personnummer ska inte fyllas i
        drawLabel(page, helvetica, cert.managerAppointed.specialistSpecialty,  c.sp_specialitet.x,  c.sp_specialitet.y,  fontSize);
        drawLabel(page, helvetica, cert.managerAppointed.specialistWorkplace ?? "",      c.sp_tjanstestalle.x, c.sp_tjanstestalle.y, fontSize);
      }

      // --- STUDIEREKTOR ---
      {
        const srFullName = (profile as any)?.studyDirector || "";
        const srWork     = (profile as any)?.studyDirectorWorkplace || (profile as any)?.homeClinic || "";

        if (/\s/.test(srFullName)) {
          const sr = splitName(srFullName);
          // Standard: Efternamn + Förnamn på separata koordinater
          drawLabel(page, helvetica, sr.last || srFullName,  c.sr_efternamn.x,     c.sr_efternamn.y,     fontSize);
          drawLabel(page, helvetica, sr.first || "",         c.sr_fornamn.x,       c.sr_fornamn.y,       fontSize);
        } else {
          // Fallback: inget mellanrum → skriv hela i "efternamn"-fältet
          drawLabel(page, helvetica, srFullName,             c.sr_efternamn.x,     c.sr_efternamn.y,     fontSize);
        }
        drawLabel(page, helvetica, srWork,                   c.sr_tjanstestalle.x, c.sr_tjanstestalle.y, fontSize);
      }

      // --- HUVUDANSVARIG HANDLEDARE ---
      drawLabel(page, helvetica, mhName,              c.mh_namnfortydligande.x, c.mh_namnfortydligande.y, fontSize);
      // Personnummer ska inte fyllas i
      drawLabel(page, helvetica, mhSpec,              c.mh_specialitet.x,       c.mh_specialitet.y,       fontSize);
      drawLabel(page, helvetica, mhYear,              c.mh_handledarAr.x,       c.mh_handledarAr.y,       fontSize);
      drawLabel(page, helvetica, mhWork,              c.mh_tjanstestalle.x,     c.mh_tjanstestalle.y,     fontSize);
      drawLabel(page, helvetica, mhOrtDatum,          c.mh_ortDatum.x,          c.mh_ortDatum.y,          fontSize);

      const bytes = await pdfDoc.save({ useObjectStreams: false });
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      openPreviewFromBlob(blob);

    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Kunde inte skapa PDF.");
    }
  }

/** ===================== Persistens ===================== */
// onSaveAll har flyttats till handleSaveAll (useCallback) ovanför för att kunna användas i useEffect


  if (!open) return null;

  /** ===================== Render ===================== */
  return (
    <>
      <UnsavedChangesDialog
        open={showCloseConfirm}
        onCancel={handleCancelClose}
        onDiscard={handleConfirmClose}
        onSaveAndClose={handleSaveAndClose}
      />
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-3"
        onClick={(e) => {
          if (e.target === overlayRef.current) handleRequestClose();
        }}
      >
      <div
        className="w-full max-w-[980px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        data-modal-panel
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-3">
  <h2 className="m-0 text-lg font-extrabold">
    Förbered ansökan om specialistbevis (SOSFS 2015:8)
  </h2>
  <div className="flex items-center gap-2">
    <button
  disabled={!dirty}
            onClick={() => { void handleSaveAll(); }}
  className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
>
  Spara
</button>

    <button
      onClick={handleRequestClose}
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
    >
      Stäng
    </button>
  </div>
</header>


        {/* Tabs */}
        <nav className="flex gap-1 border-b bg-slate-50 px-2 pt-2">
          {[
            { id: "signers",     label: "Intygande personer", info: "Här anger du vilka personer som ska intyga ansökan: huvudhandledare, studierektor, verksamhetschef och eventuellt utsedd chef. Dessa uppgifter används när intygen genereras." },
            // STa3 finns inte för 2015
            ...(profile?.isThirdCountrySpecialist ? [{ id: "thirdCountry", label: "Specialistläkare från tredjeland", info: "Här kan du skapa intyg för specialistläkare från tredje land. Du anger vilka delmål som uppfyllts, vilka utbildningsaktiviteter som genomförts och hur det har kontrollerats. Detta används för ansökan om specialistkompetens." }] : []),
            { id: "attachments", label: "Ordna bilagor", info: "Här kan du se alla bilagor som ska inkluderas i ansökan och ändra deras ordning genom att dra och släppa. Du kan också lägga till eller ta bort bilagor som ska inkluderas i ansökan." },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:outline-none ${
                tab === t.id
                  ? "bg-white text-slate-900 border-x border-t border-slate-200 -mb-px"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              }`}
              data-info={t.info || t.label}
            >
              {t.label}
            </button>
          ))}
        </nav>

                <section
          className="max-h-[75vh] overflow-auto p-4"
          onChangeCapture={() => setDirty(true)}
        >



          {/* ========== Intygande personer ========== */}
          {tab === "signers" && (
            <SignersTabContent
              profile={profile}
              cert={cert}
              setCert={setCert}
              managerModeChangedRef={managerModeChangedRef}
              setDirty={setDirty}
            />
          )}

          {/* ========== Specialistläkare från tredjeland ========== */}
          {tab === "thirdCountry" && (
              <ThirdCountryTabContent2015
                profile={profile}
                thirdCountryDelmalCodes={thirdCountryDelmalCodes}
                setThirdCountryDelmalCodes={setThirdCountryDelmalCodes}
                thirdCountryActivities={thirdCountryActivities}
                setThirdCountryActivities={setThirdCountryActivities}
                thirdCountryVerification={thirdCountryVerification}
                setThirdCountryVerification={setThirdCountryVerification}
              cert={cert}
              setCert={setCert}
              thirdCountryWorkplaces={thirdCountryWorkplaces}
              setThirdCountryWorkplaces={setThirdCountryWorkplaces}
                onPreview={(blob) => openPreviewFromBlob(blob)}
              />
          )}

          {/* ========== Ordna bilagor ========== */}
          {tab === "attachments" && (
            <AttachmentsTabContent
              tempOrder={tempOrder}
              listRef={listRef}
              rowRefs={rowRefs}
              onPointerMoveList={onPointerMoveList}
              onPointerUpList={onPointerUpList}
              onPointerDownCard={onPointerDownCard}
              dragIndex={dragIndex}
              dragActive={dragActive}
              getBilagaName={getBilagaName}
              formatAttachmentLabel={formatAttachmentLabel}
              colorsFor={colorsFor}
              presetChecked={presetChecked}
              togglePreset={togglePreset}
              presetDates={presetDates}
              updatePresetDate={updatePresetDate}
              profile={profile}
              paidFeeDate={paidFeeDate}
              setPaidFeeDate={setPaidFeeDate}
            />
          )}
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <div />
          <div className="flex items-center gap-2">
            <button
              onClick={onPrintIntyg}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              data-info="Intyg om uppnådd specialistkompetens. Skapar och öppnar en PDF med intyg om uppnådd specialistkompetens enligt SOSFS 2015:8. Detta är huvudintyget som bekräftar att alla delmål och kompetenser är uppnådda. Intyget kan skrivas ut eller sparas och inkluderas som bilaga i ansökan."
            >
              Intyg om uppnådd specialistkompetens
            </button>
            <button
              onClick={onPrintAnsokan}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              data-info="Ansökan om bevis om specialistkompetens. Skapar och öppnar en komplett PDF-ansökan enligt SOSFS 2015:8 med alla bilagor i rätt ordning. Ansökan innehåller alla intyg, aktiviteter och kurser som du har valt att inkludera."
            >
              Ansökan om bevis om specialistkompetens
            </button>
          </div>
        </footer>

        {/* Förhandsvisning av genererad PDF */}
        <CertificatePreview
          open={previewOpen}
          url={previewUrl}
          onClose={() => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            setPreviewOpen(false);
          }}
        />
      </div>
    </div>
    </>
  );
}


/** ======== (valfritt) semantisk grid-helper ======== */
function FragmentRow({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <>
      <div>{left}</div>
      <div>{right}</div>
    </>
  );
}

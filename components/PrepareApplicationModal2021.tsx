// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import React, { useEffect, useMemo, useRef, useState, Fragment, useCallback } from "react";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import { registerModal, unregisterModal } from "@/lib/modalEscHandler";

import type { Profile, Placement, Course } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import { PDFDocument, StandardFonts, PDFName } from "pdf-lib";
import { type GoalsCatalog } from "@/lib/goals";
import { sortMilestoneIds as sortMilestoneIdsBySequence } from "@/lib/milestoneSequence";
import { fetchClinicContactsForUser } from "@/lib/clinicContacts";
import { LabeledInputLocal, ReadonlyInput } from "@/components/prepareApplication2021/InputFields";
import {
  formatAttachmentLabel2021,
  getBilagaName2021,
  GROUP_COLORS,
  sortByBilagaNumber2021,
  type AttachGroup,
  type AttachmentItem,
  type PresetKey,
  type Swatch,
} from "@/components/prepareApplication2021/attachmentsDomain";
import { useAttachmentsPresetState2021 } from "@/components/prepareApplication2021/useAttachmentsPresetState";
import { useInitialLoad2021 } from "@/components/prepareApplication2021/useInitialLoad2021";
import { useModalCloseAndSave } from "@/components/prepareApplication2015/useModalCloseAndSave";
import { Sta3TabContent, ThirdCountryTabContent } from "@/components/prepareApplication2021/TabPanels";




/** ===================== Typer ===================== */
type LicenseCountry = { id: string; country: string; date: string };
type PriorSpecialty  = { id: string; specialty: string; country: string; date: string };

type Applicant2021 = {
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
  previousSpecialties: PriorSpecialty[]; // max 4 (2021)
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
  specialistName: string;
  specialistSpecialty: string;
  specialistWorkplace: string;
  specialistPersonalNumber: string;
};

type Certifiers = {
  // Intygsutfärdande specialistläkare (ny för 2021, ersätter studierektor)
  certifyingSpecialist: {
    name: string;
    specialty: string;
    workplace: string;
  };
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

function stEndDate(placements: Placement[]): string {
  const latest = placements.reduce((acc, p) => {
    const tt = new Date(p.endDate || p.startDate || "").getTime();
    return Number.isNaN(tt) ? acc : Math.max(acc, tt);
  }, -Infinity);
  return latest === -Infinity ? isoToday() : new Date(latest).toISOString().slice(0, 10);
}

const makeId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** ===================== PDF-hjälpare (INTYG 2021) ===================== */
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

/** ===================== Komponent (2021) ===================== */
export default function PrepareApplicationModal2021({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [dirty, setDirty] = useState(false);

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

  // Detta är alltid 2021-versionen
  const is2015 = false;

  const [tab, setTab] = useState<"signers" | "sta3" | "thirdCountry" | "attachments">("signers");

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

  function CertificatePreview({
    open,
    url,
    onClose,
  }: {
    open: boolean;
    url: string | null;
    onClose: () => void;
  }) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-4xl h-[85vh] rounded-xl shadow-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">Förhandsvisning av intyg/ansökan</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            {url ? (
              <iframe src={url} className="w-full h-full" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-500">
                Genererar …
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
            <a
              href={url ?? "#"}
              download
              className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50"
              onClick={(e) => {
                if (!url) e.preventDefault();
              }}
            >
              Ladda ned PDF
            </a>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
              title="Stäng förhandsvisningen"
            >
              Stäng
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Sökande (2021)
  const [applicant, setApplicant] = useState<Applicant2021>({
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
    certifyingSpecialist: {
      name: "",
      specialty: "",
      workplace: "",
    },
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



  // STa3 data
  const [sta3OtherText, setSta3OtherText] = useState<string>("");
  const [sta3HowVerifiedText, setSta3HowVerifiedText] = useState<string>("");

  // Third country specialist (bilaga 13) data
  const [thirdCountryDelmalCodes, setThirdCountryDelmalCodes] = useState<string>("");
  const [thirdCountryActivities, setThirdCountryActivities] = useState<string>("");
  const [thirdCountryVerification, setThirdCountryVerification] = useState<string>("");
  const [thirdCountryMilestones, setThirdCountryMilestones] = useState<Set<string>>(new Set());
  const thirdCountryMilestonesSorted = useMemo(
    () => sortMilestoneIdsBySequence(Array.from(thirdCountryMilestones)),
    [thirdCountryMilestones]
  );
  const [thirdCountryMilestonePickerOpen, setThirdCountryMilestonePickerOpen] = useState(false);
  const [goals, setGoals] = useState<GoalsCatalog | null>(null);

  const sortByBilaga = useCallback(
    (a: AttachmentItem, b: AttachmentItem) => sortByBilagaNumber2021(a, b),
    []
  );

  const {
    paidFeeDate,
    setPaidFeeDate,
    btApprovedDate,
    setBtApprovedDate,
    presetChecked,
    setPresetChecked,
    presetDates,
    setPresetDates,
    attachments,
    setAttachments,
    userReordered,
    setUserReordered,
    tempOrder,
    setTempOrder,
    rebuildWithPresets,
    togglePreset,
    updatePresetDate,
  } = useAttachmentsPresetState2021({
    open,
    isoToday,
    sortByBilaga,
    markDirty: () => setDirty(true),
  });


  /** ==== Drag & drop: snap ==== */
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const startYRef = useRef(0);
  const DRAG_THRESHOLD = 4;

  // Färg-mappning
  const [colorMap] = useState<Record<string, Swatch>>(() => GROUP_COLORS);

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

  useInitialLoad2021({
    open,
    storageKey: STORAGE_KEY,
    isoToday,
    makeId,
    sortByBilaga,
    presetChecked,
    presetDates,
    managerModeChangedRef,
    setPlacements,
    setCourses,
    setApplicant,
    setCert,
    setAttachments,
    setTempOrder,
    setPaidFeeDate,
    setBtApprovedDate,
    setPresetChecked,
    setPresetDates,
    setSta3OtherText,
    setSta3HowVerifiedText,
    setThirdCountryDelmalCodes,
    setThirdCountryMilestones,
    setThirdCountryActivities,
    setThirdCountryVerification,
    setProfile,
    setGoals,
  });




  function colorsFor(type: AttachGroup) {
    const s = colorMap[type] ?? GROUP_COLORS[type];
    return { cardBg: s.bg, cardBd: s.bd, pillBg: s.pill, pillBd: s.pillBd };
  }


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

    // Bygg tidigare specialiteter (max 4 för 2021) från profil
    const priorListSrc: any[] = Array.isArray(prof.priorSpecialties) ? prof.priorSpecialties : [];
    const priorList = priorListSrc.slice(0, 4).map((r) => ({
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

  function validate2021(): boolean {
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


/* ---------- 2021 – Intyg om uppnådd specialistkompetens (TODO: Implementera) ---------- */
/* Startvärden – justera x/y tills det sitter perfekt. */
/* OBS: Denna kod använder fortfarande 2015-koordinater och behöver uppdateras för 2021-templates */
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

  async function onPrintFullgjord() {
    if (!validate2021() || !profile) return;
    try {
      const { exportBilaga6Certificate } = await import("@/lib/exporters");
      
      // Samla alla tjänstgöringar från placements
      const allPlacements = placements
        .filter((p: any) => p.startDate && p.endDate)
        .map((p: any) => ({
          clinic: p.clinic || p.title || (p as any).site || "—",
          startDate: p.startDate || "",
          endDate: p.endDate || "",
          attendance: (p as any).attendance || 100,
        }));

      const blob = await exportBilaga6Certificate(
        {
          profile: profile as any,
          placements: allPlacements,
          cert: cert,
        },
        { output: "blob", filename: "intyg-bilaga6-2021.pdf" }
      );

      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewOpen(true);
      }
    } catch (err) {
      console.error("exportBilaga6Certificate error", err);
      alert("Det gick inte att skapa intyget. Kontrollera uppgifterna och försök igen.");
    }
  }

  async function onPrintIntyg() {
    if (!validate2021() || !profile) return;
    try {
      const { exportBilaga7Certificate } = await import("@/lib/exporters");
      
      const blob = await exportBilaga7Certificate(
        {
          profile: profile as any,
          applicant: applicant,
          cert: cert,
          placements: placements || [],
          courses: courses || [],
          attachments: attachments || [],
        },
        { output: "blob", filename: "intyg-bilaga7-2021.pdf" }
      );

      if (blob && blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewOpen(true);
      } else {
        console.error("exportBilaga7Certificate returned invalid blob:", blob);
        alert("Det gick inte att skapa intyget. Ingen PDF genererades.");
      }
    } catch (err) {
      console.error("exportBilaga7Certificate error", err);
      alert("Det gick inte att skapa intyget. Kontrollera uppgifterna och försök igen. Fel: " + (err instanceof Error ? err.message : String(err)));
    }
  }



  async function onPrintAnsokan() {
    if (!validate2021() || !profile) return;
    try {
      const { exportBilaga5Certificate } = await import("@/lib/exporters");
      
      const blob = await exportBilaga5Certificate(
        {
          profile: profile as any,
          applicant: applicant,
          cert: cert,
          placements: placements,
          courses: courses,
          attachments: attachments,
          paidFeeDate: paidFeeDate,
          btApprovedDate: btApprovedDate,
        },
        { output: "blob", filename: "ansokan-bilaga5-2021.pdf" }
      );

      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewOpen(true);
      }
    } catch (err) {
      console.error("exportBilaga5Certificate error", err);
      alert("Det gick inte att skapa ansökan. Kontrollera uppgifterna och försök igen.");
    }
  }







  const getSnapshot = useCallback(() => {
    return {
      placements: structuredClone(placements),
      courses: structuredClone(courses),
      applicant: structuredClone(applicant),
      cert: structuredClone(cert),
      attachments: structuredClone(attachments),
      paidFeeDate,
      btApprovedDate,
      presetChecked: structuredClone(presetChecked),
      presetDates: structuredClone(presetDates),
      tab,
      userReordered,
      sta3OtherText,
      sta3HowVerifiedText,
      thirdCountryDelmalCodes: thirdCountryMilestonesSorted.join(", "),
      thirdCountryActivities,
      thirdCountryVerification,
    };
  }, [
    placements,
    courses,
    applicant,
    cert,
    attachments,
    paidFeeDate,
    btApprovedDate,
    presetChecked,
    presetDates,
    tab,
    userReordered,
    sta3OtherText,
    sta3HowVerifiedText,
    thirdCountryMilestonesSorted,
    thirdCountryActivities,
    thirdCountryVerification,
  ]);

  const applySnapshot = useCallback(
    (b: ReturnType<typeof getSnapshot>) => {
      setPlacements(b.placements);
      setCourses(b.courses);
      setApplicant(b.applicant);
      setCert(b.cert);
      setAttachments(b.attachments);
      setPaidFeeDate(b.paidFeeDate);
      setBtApprovedDate(b.btApprovedDate ?? isoToday());
      setPresetChecked(b.presetChecked);
      setPresetDates(b.presetDates);
      setTab(b.tab);
      setUserReordered(b.userReordered);
      setSta3OtherText(b.sta3OtherText);
      setSta3HowVerifiedText(b.sta3HowVerifiedText);
      setThirdCountryDelmalCodes(b.thirdCountryDelmalCodes);
      if (b.thirdCountryDelmalCodes) {
        const codes = b.thirdCountryDelmalCodes
          .split(",")
          .map((c: string) => c.trim())
          .filter((c: string) => Boolean(c));
        setThirdCountryMilestones(new Set<string>(codes));
      } else {
        setThirdCountryMilestones(new Set<string>());
      }
      setThirdCountryActivities(b.thirdCountryActivities);
      setThirdCountryVerification(b.thirdCountryVerification);
    },
    []
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
      sta3OtherText,
      sta3HowVerifiedText,
      thirdCountryDelmalCodes: thirdCountryMilestonesSorted.join(", "),
      thirdCountryActivities,
      thirdCountryVerification,
      savedAt: new Date().toISOString(),
      version: 8,
    };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase
          .from("app_drafts")
          .upsert({
            user_id: user.id,
            draft_key: "st_application_2021",
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
    sta3OtherText,
    sta3HowVerifiedText,
    thirdCountryMilestonesSorted,
    thirdCountryActivities,
    thirdCountryVerification,
  ]);

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
    getSnapshot,
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
      btApprovedDate,
      presetChecked,
      presetDates,
      tab,
      userReordered,
      sta3OtherText,
      sta3HowVerifiedText,
      thirdCountryMilestonesSorted,
      thirdCountryActivities,
      thirdCountryVerification,
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
    Förbered ansökan om specialistbevis{is2015 ? " (SOSFS 2015:8)" : ""}
  </h2>
  <div className="flex items-center gap-2">
    <button
  disabled={!dirty}
            onClick={() => { void handleSaveAll(); }}
  className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
  data-info="Spara"
>
  Spara
</button>

    <button
      onClick={handleRequestClose}
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
      data-info="Stäng"
    >
      Stäng
    </button>
  </div>
</header>


        {/* Tabs */}
        <nav className="flex gap-1 border-b bg-slate-50 px-2 pt-2">
          {[
            { id: "signers",     label: "Intygande personer", info: "Här anger du vilka personer som ska intyga ansökan: huvudhandledare, intygsutfärdande specialistläkare, verksamhetschef och eventuellt utsedd chef. Dessa uppgifter används när intygen genereras." },
            { id: "sta3",        label: "Delmål STa3", info: "Här kan du skapa intyg för delmål STa3 (specialiseringstjänstgöring delmål A3). Du anger vilka aktiviteter och kurser som uppfyller delmålet och hur det har kontrollerats. Intyget kan sedan inkluderas som bilaga i ansökan." },
            ...((profile as any)?.isThirdCountrySpecialist ? [{ id: "thirdCountry", label: "Specialistläkare från tredje land", info: "Här kan du skapa intyg för specialistläkare från tredje land. Du anger vilka delmål som uppfyllts, vilka utbildningsaktiviteter som genomförts och hur det har kontrollerats. Detta används för ansökan om specialistkompetens." }] : []),
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
            <div className="grid grid-cols-1 gap-4">
              {/* Huvudansvarig handledare */}
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-extrabold">Huvudansvarig handledare</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ReadonlyInput
                    label="Namn"
                    value={
                      (profile as any)?.supervisor
                        || [ (profile as any)?.supervisorFirstName, (profile as any)?.supervisorLastName ].filter(Boolean).join(" ")
                        || cert.mainSupervisor.name
                        || ""
                    }
                  />

                  <LabeledInputLocal
                    label="Tjänsteställe"
                    value={
                      String(
                        cert.mainSupervisor.workplace ||
                        (profile as any)?.supervisorWorkplace
                          || (profile as any)?.homeClinic
                          || ""
                      )
                    }
                    onCommit={(v) =>
                      setCert((s) => ({
                        ...s,
                        mainSupervisor: { ...s.mainSupervisor, workplace: v },
                      }))
                    }
                  />

                  <LabeledInputLocal
                    label="Specialitet"
                    value={
                      cert.mainSupervisor.specialty ||
                      String((profile as any)?.specialty ?? "")
                    }
                    onCommit={(v) =>
                      setCert((s) => ({
                        ...s,
                        mainSupervisor: { ...s.mainSupervisor, specialty: v },
                      }))
                    }
                  />

                  <LabeledInputLocal
                    label="Årtal för handledarutbildning"
                    value={cert.mainSupervisor.trainingYear}
                    onCommit={(v) =>
                      setCert((s) => ({
                        ...s,
                        mainSupervisor: { ...s.mainSupervisor, trainingYear: v },
                      }))
                    }
                    inputMode="numeric"
                  />
                </div>
              </div>

              {/* Intygsutfärdande specialistläkare */}
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-extrabold">
                  Intygsutfärdande specialistläkare som, utöver huvudhandledare, bedömer att sökanden har uppnått samtliga delmål i målbeskrivningen för specialiteten
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="grid grid-cols-1 gap-2">
                    <label className="text-xs font-semibold text-slate-700">Namn</label>
                    <input
                      type="text"
                      value={cert.certifyingSpecialist.name}
                      onChange={(e) => setCert((prev) => ({
                        ...prev,
                        certifyingSpecialist: { ...prev.certifyingSpecialist, name: e.target.value }
                      }))}
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <label className="text-xs font-semibold text-slate-700">Specialitet</label>
                    <input
                      type="text"
                      value={cert.certifyingSpecialist.specialty}
                      onChange={(e) => setCert((prev) => ({
                        ...prev,
                        certifyingSpecialist: { ...prev.certifyingSpecialist, specialty: e.target.value }
                      }))}
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Tjänsteställe</label>
                    <input
                      type="text"
                      value={cert.certifyingSpecialist.workplace}
                      onChange={(e) => setCert((prev) => ({
                        ...prev,
                        certifyingSpecialist: { ...prev.certifyingSpecialist, workplace: e.target.value }
                      }))}
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>
              </div>

              {/* Verksamhetschef */}
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-extrabold">Verksamhetschef</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ReadonlyInput
                    label="Namn"
                    value={
                      (profile as any)?.verksamhetschef ||
                      (profile as any)?.manager ||
                      cert.managerSelf?.name ||
                      ""
                    }
                  />
                  <ReadonlyInput
                    label="Tjänsteställe"
                    value={String((profile as any)?.homeClinic ?? "")}
                  />
                  <ReadonlyInput
                    label="Specialitet"
                    value={String((profile as any)?.specialty ?? (profile as any)?.speciality ?? "")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========== STa3 ========== */}
          {tab === "sta3" && (
            <Sta3TabContent
              profile={profile}
              sta3OtherText={sta3OtherText}
              setSta3OtherText={setSta3OtherText}
              sta3HowVerifiedText={sta3HowVerifiedText}
              setSta3HowVerifiedText={setSta3HowVerifiedText}
              onPreview={(blob) => openPreviewFromBlob(blob)}
              includeInAttachments={presetChecked.sta3 ?? false}
              onToggleIncludeInAttachments={(checked) => {
                setPresetChecked((prev) => {
                  const next = { ...prev, sta3: checked };
                  rebuildWithPresets(next, presetDates);
                  return next;
                });
              }}
            />
          )}

          {/* ========== Specialistläkare från tredje land ========== */}
          {tab === "thirdCountry" && (
            <ThirdCountryTabContent
              profile={profile}
              goals={goals}
              thirdCountryMilestones={thirdCountryMilestones}
              setThirdCountryMilestones={setThirdCountryMilestones}
              thirdCountryMilestonePickerOpen={thirdCountryMilestonePickerOpen}
              setThirdCountryMilestonePickerOpen={setThirdCountryMilestonePickerOpen}
              thirdCountryActivities={thirdCountryActivities}
              setThirdCountryActivities={setThirdCountryActivities}
              thirdCountryVerification={thirdCountryVerification}
              setThirdCountryVerification={setThirdCountryVerification}
              onPreview={(blob) => openPreviewFromBlob(blob)}
            />
          )}

          {/* ========== Ordna bilagor ========== */}
          {tab === "attachments" && (
            <div className="grid grid-cols-1 gap-4">
              {/* Lista */}
              <div className="rounded-lg border border-slate-200">
                {/* Header med #-kolumn */}
                <div className="grid grid-cols-[48px_1fr] items-center border-b bg-slate-50 px-3 py-2">
                  <div className="pl-1 text-sm font-extrabold text-slate-800">#</div>
                  <h3 className="m-0 text-sm font-extrabold">Bilagor – dra för att ändra ordning</h3>
                </div>

                <div
  ref={listRef}
  onPointerMove={onPointerMoveList}
  onPointerUp={onPointerUpList}
  className="p-2 bg-white"
>

                  {tempOrder.map((a, idx) => (
                    <Fragment key={a.id}>
                      <div ref={(el: HTMLDivElement | null) => { rowRefs.current[idx] = el; }} className="mb-1 grid grid-cols-[48px_1fr] gap-2">
                        {/* #-kolumn */}
                        <div className="flex items-center justify-center">
                          <div className="select-none rounded-md bg-slate-100 px-2 py-[1px] text-[11px] font-bold text-slate-700 tabular-nums">
                            {idx + 1}.
                          </div>
                        </div>

                        {/* Kort med två textfält */}
                        <div
                          onPointerDown={(e) => onPointerDownCard(idx, e)}
                          className={`rounded-xl border p-1.5 shadow-sm transition-all select-none ${
                            dragIndex === idx && dragActive
                              ? "cursor-grabbing bg-white/60 ring-2 ring-sky-400 shadow-md z-20 relative"
                              : "cursor-grab hover:shadow-md"
                          }`}
                          role="button"
                          aria-grabbed={dragIndex === idx && dragActive}
                          title="Dra för att flytta"
                          data-info={`${getBilagaName2021(a.type) || a.type} - ${formatAttachmentLabel2021(a)}. Kan flyttas för att ändra ordning.`}
                          style={{
                            userSelect: "none",
                            WebkitUserSelect: "none",
                            touchAction: (dragActive ? "none" : "auto") as any,
                            ...(() => {
                              const c = colorsFor(a.type);
                              return { backgroundColor: c.cardBg, borderColor: c.cardBd };
                            })(),
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="select-none text-slate-500 leading-none">≡</div>
                            {/* Vänster textfält med ljus bakgrund för bilaganamn */}
                            <span
                              className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold text-slate-700 select-none bg-slate-50"
                              style={{ borderColor: "hsl(220 13% 80%)" }}
                            >
                              {getBilagaName2021(a.type) || a.type}
                            </span>
                            {/* Höger textfält för label */}
                            <span className="min-w-0 grow truncate text-[13px] font-medium text-slate-900 select-none">
                              {formatAttachmentLabel2021(a)}
                            </span>
                            <span className="ml-auto shrink-0 tabular-nums text-[12px] text-slate-700/80 select-none">
                              {a.date || "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Fragment>
                  ))}

                  {tempOrder.length === 0 && !dragActive && (
                    <div className="rounded-xl border border-dashed p-6 text-center text-slate-500">Inga bilagor.</div>
                  )}
                </div>
              </div>

              {/* Lägg till bilaga (i eget kort) */}
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-sm font-extrabold">Lägg till bilaga</div>

                {/* Intyg om fullgjord specialiseringstjänstgöring */}
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_220px] items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-[13px]" data-info="Intyg om fullgjord specialiseringstjänstgöring. Detta intyg bekräftar att du har genomfört hela specialiseringstjänstgöringen enligt kraven. Intyget inkluderas som bilaga i ansökan om specialistkompetens.">
                    <input type="checkbox" checked={presetChecked.fullgjordST ?? true} onChange={() => togglePreset("fullgjordST")} />
                    <span>Intyg om fullgjord specialiseringstjänstgöring</span>
                  </label>
                  <div className="w-[220px]">
                    <CalendarDatePicker
                      value={presetDates.fullgjordST}
                      onChange={(iso) => updatePresetDate("fullgjordST", iso)}
                      align="right"
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                    />
                  </div>
                </div>

                {/* Intyg */}
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_220px] items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-[13px]" data-info="Intyg om uppnådd specialistkompetens. Detta är huvudintyget som bekräftar att du har uppnått alla delmål och kompetenser som krävs för specialistkompetens. Intyget inkluderas som bilaga i ansökan.">
                    <input type="checkbox" checked={presetChecked.intyg} onChange={() => togglePreset("intyg")} />
                    <span>Intyg om uppnådd specialistkompetens</span>
                  </label>
                  <div className="w-[220px]">
                    <CalendarDatePicker
                      value={presetDates.intyg}
                      onChange={(iso) => updatePresetDate("intyg", iso)}
                      align="right"
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                    />
                  </div>
                </div>

                {/* Intyg delmål STa3 */}
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_220px] items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-[13px]" data-info="Intyg delmål STa3. Detta intyg bekräftar att du har uppfyllt delmål STa3 (specialiseringstjänstgöring delmål A3) genom olika aktiviteter och kurser. Intyget skapas i fliken 'Delmål STa3' och kan inkluderas som bilaga i ansökan.">
                    <input type="checkbox" checked={presetChecked.sta3} onChange={() => togglePreset("sta3")} />
                    <span>Intyg delmål STa3</span>
                  </label>
                  <div className="w-[220px]">
                    <CalendarDatePicker
                      value={presetDates.sta3}
                      onChange={(iso) => updatePresetDate("sta3", iso)}
                      align="right"
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                    />
                  </div>
                </div>

                {/* Delmål för specialistläkare från tredjeland (om användaren är specialistläkare från tredjeland) */}
                {(profile as any)?.isThirdCountrySpecialist && (
                  <div className="mb-2 grid grid-cols-[minmax(0,1fr)_220px] items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-[13px]" data-info="Delmål för specialistläkare från tredjeland. Detta intyg bekräftar att du har uppfyllt de delmål som krävs för specialistläkare från tredje land. Intyget skapas i fliken 'Specialistläkare från tredje land' och kan inkluderas som bilaga i ansökan.">
                      <input type="checkbox" checked={presetChecked.thirdCountry} onChange={() => togglePreset("thirdCountry")} />
                      <span>Delmål för specialistläkare från tredjeland</span>
                    </label>
                    <div className="w-[220px]">
                      <CalendarDatePicker
                        value={presetDates.thirdCountry}
                        onChange={(iso) => updatePresetDate("thirdCountry", iso)}
                        align="right"
                        className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                      />
                    </div>
                  </div>
                )}

                {/* Ordning: Svensk doktorsexamen, Bedömning av utländsk doktorsexamen, Utländsk tjänstgöring, Individuellt utbildningsprogram för specialistläkare från tredjeland */}
                {(["svDoc", "foreignDocEval", "foreignService", "individProg"] as PresetKey[]).map(
                  (k) => {
                    // Dölj individProg om användaren inte är specialistläkare från tredjeland
                    if (k === "individProg" && !(profile as any)?.isThirdCountrySpecialist) {
                      return null;
                    }

                    const labels: Record<PresetKey, string> = {
                      fullgjordST: "Intyg om fullgjord specialiseringstjänstgöring",
                      intyg: "Intyg om uppnådd specialistkompetens",
                      sta3: "Intyg delmål STa3",
                      svDoc: "Svensk doktorsexamen",
                      foreignDocEval: "Bedömning av utländsk doktorsexamen",
                      foreignService: "Utländsk tjänstgöring",
                      thirdCountry: "Delmål för specialistläkare från tredjeland",
                      individProg: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
                    };
                    const infoTexts: Record<PresetKey, string> = {
                      fullgjordST: "Intyg om fullgjord specialiseringstjänstgöring. Bekräftar att hela specialiseringstjänstgöringen är genomförd.",
                      intyg: "Intyg om uppnådd specialistkompetens. Huvudintyget som bekräftar att alla delmål och kompetenser är uppnådda.",
                      sta3: "Intyg delmål STa3. Bekräftar att delmål STa3 är uppfyllt.",
                      svDoc: "Svensk doktorsexamen. Dokumentation av din svenska doktorsexamen som bilaga i ansökan.",
                      foreignDocEval: "Bedömning av utländsk doktorsexamen. Dokumentation av bedömning av din utländska doktorsexamen som bilaga i ansökan.",
                      foreignService: "Utländsk tjänstgöring. Dokumentation av utländsk tjänstgöring som kan räknas in i utbildningen.",
                      thirdCountry: "Delmål för specialistläkare från tredjeland. Bekräftar att delmål för tredjelandspecialister är uppfyllda.",
                      individProg: "Individuellt utbildningsprogram för specialistläkare från tredjeland. Dokumentation av ditt individuella utbildningsprogram.",
                    };
                    return (
                      <div key={k} className="mb-2 grid grid-cols-[minmax(0,1fr)_220px] items-center gap-2">
                        <label className="inline-flex items-center gap-2 text-[13px]" data-info={infoTexts[k]}>
                          <input type="checkbox" checked={presetChecked[k]} onChange={() => togglePreset(k)} />
                          <span>{labels[k]}</span>
                        </label>
                        <div className="w-[220px]">
                          <CalendarDatePicker
                            value={presetDates[k]}
                            onChange={(iso) => updatePresetDate(k, iso)}
                            align="right"
                            className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {/* Datum för godkänd BT */}
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="grid grid-cols-[1fr_220px] items-center gap-2">
                  <span className="whitespace-nowrap text-sm text-slate-700">Datum för godkänd BT</span>
                  <div className="w-[220px] justify-self-end">
                    <CalendarDatePicker
                      value={btApprovedDate}
                      onChange={setBtApprovedDate}
                      align="right"
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                    />
                  </div>
                </div>
              </div>

              {/* Datum för betald avgift */}
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="grid grid-cols-[1fr_220px] items-center gap-2">
                  <span className="whitespace-nowrap text-sm text-slate-700">Datum för betald avgift</span>
                  <div className="w-[220px] justify-self-end">
                    <CalendarDatePicker
                      value={paidFeeDate}
                      onChange={setPaidFeeDate}
                      align="right"
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <div />
          <div className="flex items-center gap-2">
            <button
              onClick={onPrintFullgjord}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              data-info="Intyg fullgjord ST. Skapar och öppnar en PDF med intyg om fullgjord specialiseringstjänstgöring. Intyget kan skrivas ut eller sparas och inkluderas som bilaga i ansökan."
            >
              Intyg fullgjord ST
            </button>
            <button
              onClick={onPrintIntyg}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              data-info="Intyg uppnådd ST. Skapar och öppnar en PDF med intyg om uppnådd specialistkompetens. Detta är huvudintyget som bekräftar att alla delmål och kompetenser är uppnådda. Intyget kan skrivas ut eller sparas och inkluderas som bilaga i ansökan."
            >
              Intyg uppnådd ST
            </button>
            <button
              onClick={onPrintAnsokan}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              data-info="Ansökan om bevis om specialistkompetens. Skapar och öppnar en komplett PDF-ansökan med alla bilagor i rätt ordning. Ansökan innehåller alla intyg, aktiviteter och kurser som du har valt att inkludera."
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

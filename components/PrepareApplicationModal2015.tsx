// components/PrepareApplicationModal2015.tsx
"use client";

import React, { useEffect, useRef, useState, Fragment, useCallback, useMemo } from "react";

import { db } from "@/lib/db";
import type { Profile, Placement, Course } from "@/lib/types";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import { PDFDocument, StandardFonts, PDFName } from "pdf-lib";
import type { GoalsCatalog } from "@/lib/goals";
import { loadGoals } from "@/lib/goals";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import { registerModal, unregisterModal } from "@/lib/modalEscHandler";

import dynamic from "next/dynamic";
const DesktopMilestonePicker = dynamic(() => import("@/components/DesktopMilestonePicker"), { ssr: false });

// Import makeId och isoToday om de inte redan är importerade




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

/** === Bilagetyper & ordning (för färg + initial sortering) === */
type AttachGroup =
  | "Uppnådd specialistkompetens"
  | "Auskultationer"
  | "Kliniska tjänstgöringar under handledning"
  | "Kurser"
  | "Utvecklingsarbete"
  | "Vetenskapligt arbete"
  | "Uppfyllda kompetenskrav för specialistläkare från tredjeland"
  | "Uppnådd specialistkompetens för specialistläkare från tredjeland"
  | "Svensk doktorsexamen"
  | "Utländsk doktorsexamen"
  | "Utländsk tjänstgöring"
  | "Individuellt utbildningsprogram";

const GROUP_ORDER: AttachGroup[] = [
  "Uppnådd specialistkompetens",
  "Uppfyllda kompetenskrav för specialistläkare från tredjeland", // Bilaga 8a
  "Uppnådd specialistkompetens för specialistläkare från tredjeland", // Bilaga 8b
  "Auskultationer",
  "Kliniska tjänstgöringar under handledning",
  "Kurser",
  "Utvecklingsarbete",
  "Vetenskapligt arbete",
  "Svensk doktorsexamen",
  "Utländsk doktorsexamen",
  "Utländsk tjänstgöring",
  "Individuellt utbildningsprogram",
];

type PresetKey =
  | "intyg"
  | "svDoc"
  | "foreignDocEval"
  | "foreignService"
  | "thirdCountry"
  | "individProg";

type AttachmentItem = {
  id: string;
  type: AttachGroup;
  label: string;
  date?: string;
  preset?: PresetKey;
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

function ts(iso?: string) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function classifyPlacement(p: any): { group: AttachGroup; labelFrom: string } {
  const t = `${p?.type ?? p?.kind ?? p?.category ?? ""}`.toLowerCase();
  const text = `${p?.clinic ?? ""} ${p?.note ?? ""}`.toLowerCase();

  if (t.includes("ausk") || text.includes("auskult"))
    return { group: "Auskultationer", labelFrom: p.clinic || "—" };

  if (t.includes("kvalit") || t.includes("utveck") || text.includes("kvalit"))
    return { group: "Utvecklingsarbete", labelFrom: p.clinic || p.note || "—" };

  if (t.includes("vetenskap") || text.includes("vetenskap"))
    return { group: "Vetenskapligt arbete", labelFrom: p.clinic || p.note || "—" };

  return { group: "Kliniska tjänstgöringar under handledning", labelFrom: p.clinic || "—" };
}

function stEndDate(placements: Placement[]): string {
  const latest = placements.reduce((acc, p) => {
    const tt = new Date(p.endDate || p.startDate || "").getTime();
    return Number.isNaN(tt) ? acc : Math.max(acc, tt);
  }, -Infinity);
  return latest === -Infinity ? isoToday() : new Date(latest).toISOString().slice(0, 10);
}

/** Bygg initial bilagelista (2015) från sparade placeringar + kurser i DB */
function pickPlacementDate(p: Placement): string {
  // För kliniska tjänstgöringar vill vi alltid visa själva tjänstgöringsperioden,
  // inte något eventuellt intygsdatum. Därför ignoreras certificateDate här.
  const raw: any =
    (p as any).endDate ||
    (p as any).startDate ||
    "";
  return raw ? String(raw).slice(0, 10) : "";
}

function pickCourseDate(c: Course): string {
  // För kurser är intygsdatum primärt, med fallback till eventuell period.
  const raw: any =
    (c as any).certificateDate ||
    (c as any).endDate ||
    (c as any).startDate ||
    "";
  return raw ? String(raw).slice(0, 10) : "";
}



function buildDefaultAttachmentsFor2015(args: {
  placements: Placement[];
  courses: Course[];
}): AttachmentItem[] {
  const { placements, courses } = args;

  const items: AttachmentItem[] = [];

  // Placeringar → grupper enligt classifyPlacement
  for (const p of placements) {
    const { group, labelFrom } = classifyPlacement(p as any);
    items.push({
      id: `pl-${(p as any).id ?? `${p.startDate ?? ""}-${p.endDate ?? ""}-${labelFrom}`}`,
      type: group,
      label: labelFrom || "—",
      date: pickPlacementDate(p),
    });
  }

  // Kurser → "Kurser"
  for (const c of courses) {
    // Ta bara med kurser som faktiskt ska visas på tidslinjen.
    if ((c as any).showOnTimeline === false) continue;

    const label =
      (c as any).title ||
      (c as any).name ||
      (c as any).provider ||
      "Kurs";

    // Datum för kursen (intygsdatum i första hand)
    const date = pickCourseDate(c);

    // Om kursen saknar både label och datum är den troligen ett gammalt/trasigt objekt – hoppa över.
    if (!label && !date) continue;

    items.push({
      id: `cr-${(c as any).id ?? `${c.startDate ?? ""}-${c.endDate ?? ""}-${label}`}`,
      type: "Kurser",
      label,
      date,
    });
  }


  // Sortera enligt bilagnummer + datum + label
  const sorted = items.slice().sort((a, b) => {
    // Hjälpfunktion för att få bilagnummer
    const getBilagaNum = (type: AttachGroup): { num: number; sub: string } => {
      const bilagaMap: Record<string, string> = {
        "Uppnådd specialistkompetens": "SOSFS-bilaga 2",
        "Uppfyllda kompetenskrav för specialistläkare från tredjeland": "SOSFS-bilaga 8a",
        "Uppnådd specialistkompetens för specialistläkare från tredjeland": "SOSFS-bilaga 8b",
        "Auskultationer": "SOSFS-bilaga 3",
        "Kliniska tjänstgöringar under handledning": "SOSFS-bilaga 4",
        "Kurser": "SOSFS-bilaga 5",
        "Utvecklingsarbete": "SOSFS-bilaga 6",
        "Vetenskapligt arbete": "SOSFS-bilaga 7",
        "Svensk doktorsexamen": "",
        "Utländsk doktorsexamen": "",
        "Utländsk tjänstgöring": "",
        "Individuellt utbildningsprogram": "",
      };
      const bilagaName = bilagaMap[type] || "";
      if (!bilagaName) return { num: 9999, sub: "" };
      const match = bilagaName.match(/bilaga\s+(\d+)([a-z]?)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const sub = (match[2] || "").toLowerCase();
        return { num, sub };
      }
      return { num: 9999, sub: "" };
    };

    const numA = getBilagaNum(a.type);
    const numB = getBilagaNum(b.type);

    // Först sortera efter huvudnummer
    if (numA.num !== numB.num) {
      return numA.num - numB.num;
    }

    // Om samma huvudnummer, sortera efter bokstav (8a före 8b)
    if (numA.sub !== numB.sub) {
      return numA.sub.localeCompare(numB.sub);
    }

    // Om samma bilagnummer, sortera efter datum
    const ta = ts(a.date);
    const tb = ts(b.date);
    if (ta !== tb) return ta - tb;

    // Slutligen sortera efter label
    return (a.label || "").localeCompare(b.label || "", "sv");
  });

  return sorted;
}

type Swatch = { bg: string; bd: string; pill: string; pillBd: string };


/* Gemensam grå färg (tidigare "Svensk doktorsexamen") */
const GREY_BG = "hsl(220 14% 95%/.96)";
const GREY_BD = "hsl(220 12% 75%/.96)";
const GREY_PILL = "hsl(220 16% 98%/.96)";
const GREY_PILLBD = "hsl(220 10% 86%/.96)";

const GROUP_COLORS: Record<AttachGroup, Swatch> = {
  "Uppnådd specialistkompetens": { bg: "hsl(12 35% 94%/.96)", bd: "hsl(12 25% 75%/.96)", pill: "hsl(12 40% 98%/.96)", pillBd: "hsl(12 23% 85%/.96)" },

  // Övriga grupper behåller tidigare färger – MEN de fem 'Lägg till bilaga'-typerna får samma grå nedan.
  "Auskultationer":               { bg: "hsl(30 35% 94%/.96)", bd: "hsl(30 25% 75%/.96)", pill: "hsl(30 40% 98%/.96)", pillBd: "hsl(30 23% 85%/.96)" },
"Kliniska tjänstgöringar under handledning": { bg: "hsl(222 30% 94%/.96)", bd: "hsl(222 22% 72%/.96)", pill: "hsl(222 35% 98%/.96)", pillBd: "hsl(222 20% 84%/.96)" },

  "Kurser":                       { bg: "hsl(190 30% 94%/.96)", bd: "hsl(190 22% 72%/.96)", pill: "hsl(190 35% 98%/.96)", pillBd: "hsl(190 20% 84%/.96)" },
  "Utvecklingsarbete":            { bg: "hsl(95 25% 94%/.96)",  bd: "hsl(95 20% 72%/.96)",  pill: "hsl(95 30% 98%/.96)",  pillBd: "hsl(95 18% 84%/.96)"  },
  "Vetenskapligt arbete":         { bg: "hsl(265 25% 94%/.96)", bd: "hsl(265 20% 72%/.96)", pill: "hsl(265 30% 98%/.96)", pillBd: "hsl(265 18% 84%/.96)" },

  // Bilagor för specialistläkare från tredjeland - samma färg för båda
  "Uppfyllda kompetenskrav för specialistläkare från tredjeland": { bg: "hsl(200 35% 94%/.96)", bd: "hsl(200 25% 75%/.96)", pill: "hsl(200 40% 98%/.96)", pillBd: "hsl(200 23% 85%/.96)" },
  "Uppnådd specialistkompetens för specialistläkare från tredjeland": { bg: "hsl(200 35% 94%/.96)", bd: "hsl(200 25% 75%/.96)", pill: "hsl(200 40% 98%/.96)", pillBd: "hsl(200 23% 85%/.96)" },
  
  // Fyra presets med samma grå
  "Svensk doktorsexamen":         { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Utländsk doktorsexamen":       { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Utländsk tjänstgöring":        { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Individuellt utbildningsprogram": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
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
  const blob = new Blob([bytes], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** ===================== Fältkomponent som inte tappar fokus ===================== */
function LabeledInputLocal({
  label,
  value,
  onCommit,
  placeholder,
  inputMode,
}: {
  label: string;
  value?: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const [local, setLocal] = useState<string>(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);

  const handleBlur = useCallback(() => {
    if ((value ?? "") !== local) onCommit(local);
  }, [local, value, onCommit]);

  return (
    <div className="min-w-0">
      <label className="mb-1 block text-sm text-slate-700">{label}</label>
      <input
        type="text"
        value={local}
        onInput={(e) => setLocal((e.target as HTMLInputElement).value)}
        onBlur={handleBlur}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px]
                   focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
      />
    </div>
  );
}

/** ===================== STa3 Tab Content - ENDAST för 2021 ===================== */
// STa3 finns inte i 2015-versionen, se PrepareApplicationModal2021.tsx

/** ===================== ReadonlyInput ===================== */
function ReadonlyInput({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0" title={value || "Ändra på profilsidan"}>
      <label className="mb-1 block text-sm text-slate-700">{label}</label>
      <div
        className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-[14px] text-slate-700"
        aria-readonly="true"
        role="textbox"
      >
        <span className="whitespace-normal break-words">
          {value || "—"}
        </span>
      </div>
    </div>
  );
}

/** ===================== Third Country Tab Content (2015) ===================== */
function ThirdCountryTabContent2015({
  profile,
  thirdCountryDelmalCodes,
  setThirdCountryDelmalCodes,
  thirdCountryActivities,
  setThirdCountryActivities,
  thirdCountryVerification,
  setThirdCountryVerification,
  cert,
  setCert,
  thirdCountryWorkplaces,
  setThirdCountryWorkplaces,
  onPrintIntyg,
  onPreview,
}: {
  profile: Profile | null;
  thirdCountryDelmalCodes: string;
  setThirdCountryDelmalCodes: (v: string) => void;
  thirdCountryActivities: string;
  setThirdCountryActivities: (v: string) => void;
  thirdCountryVerification: string;
  setThirdCountryVerification: (v: string) => void;
  cert: Certifiers;
  setCert: (v: Certifiers | ((prev: Certifiers) => Certifiers)) => void;
  thirdCountryWorkplaces: Array<{ id: string; site: string; startDate: string; endDate: string }>;
  setThirdCountryWorkplaces: (v: Array<{ id: string; site: string; startDate: string; endDate: string }>) => void;
  onPrintIntyg: () => void;
  onPreview: (blob: Blob) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [milestonePickerOpen, setMilestonePickerOpen] = useState(false);
  const [goals, setGoals] = useState<GoalsCatalog | null>(null);

  // Ladda goals när komponenten monteras
  useEffect(() => {
    loadGoals("2015").then(setGoals).catch((err) => {
      console.error("Failed to load goals", err);
    });
  }, []);

  // Konvertera thirdCountryDelmalCodes (komma-separerad sträng) till Set för milestone picker
  const milestoneCheckedSet = useMemo(() => {
    if (!thirdCountryDelmalCodes) return new Set<string>();
    return new Set(
      thirdCountryDelmalCodes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }, [thirdCountryDelmalCodes]);

  // Hantera toggle av delmål
  const handleToggleMilestone = useCallback(
    (milestoneId: string) => {
      const currentSet = new Set(milestoneCheckedSet);
      if (currentSet.has(milestoneId)) {
        currentSet.delete(milestoneId);
      } else {
        currentSet.add(milestoneId);
      }
      // Konvertera tillbaka till komma-separerad sträng
      const codes = Array.from(currentSet).sort().join(", ");
      setThirdCountryDelmalCodes(codes);
    },
    [milestoneCheckedSet, setThirdCountryDelmalCodes]
  );

  const handleGenerate = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const { exportThirdCountryCertificate2015 } = await import("@/lib/exporters");
      
      const blob = await exportThirdCountryCertificate2015(
        {
          profile: profile as any,
          delmalCodes: thirdCountryDelmalCodes,
          activitiesText: thirdCountryActivities,
          verificationText: thirdCountryVerification,
          workplaces: thirdCountryWorkplaces,
          cert: cert,
        },
        { output: "blob", filename: "intyg-bilaga8a-2015.pdf" }
      );

      if (blob instanceof Blob) {
        onPreview(blob);
      }
    } catch (err) {
      console.error("exportThirdCountryCertificate2015 error", err);
      alert("Det gick inte att skapa intyget. Kontrollera uppgifterna och försök igen.");
    } finally {
      setDownloading(false);
    }
  };

  const handleGenerate8b = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const { exportThirdCountryCertificate2015_8b } = await import("@/lib/exporters");
      
      const blob = await exportThirdCountryCertificate2015_8b(
        {
          profile: profile as any,
          cert: cert,
        },
        { output: "blob", filename: "intyg-bilaga8b-2015.pdf" }
      );

      if (blob instanceof Blob) {
        onPreview(blob);
      }
    } catch (err) {
      console.error("exportThirdCountryCertificate2015_8b error", err);
      alert("Det gick inte att skapa intyget. Kontrollera uppgifterna och försök igen.");
    } finally {
      setDownloading(false);
    }
  };
  
  const isAppointed = cert.managerMode === "appointed";

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Första rutan: Uppfyllda kompetenskrav */}
      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-4 text-base font-extrabold text-slate-900">Uppfyllda kompetenskrav</h3>
        
        {/* Delmål */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMilestonePickerOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
              data-info="Välj delmål"
            >
              Välj delmål
            </button>
            <div className="flex items-center gap-1 flex-wrap flex-1">
              {thirdCountryDelmalCodes ? (
                thirdCountryDelmalCodes
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .sort()
                  .map((m: string) => (
                    <span
                      key={m}
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-900"
                    >
                      {String(m).trim().split(/\s|–|-|:|\u2013/)[0].toLowerCase()}
                    </span>
                  ))
              ) : (
                <span className="text-slate-500 text-sm">Inga delmål valda</span>
              )}
            </div>
          </div>
      </div>

        {/* Tjänstgöringsställen */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Tjänstgöringsställe/-n i Sverige
        </label>
          <div className="space-y-3">
            {thirdCountryWorkplaces.slice(0, 6).map((row, idx) => (
              <div key={row.id} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_220px]">
                <div>
                  {idx === 0 && <label className="mb-1 block text-sm text-slate-700">Tjänstgöringsställe</label>}
                  <input
                    type="text"
                    value={row.site}
                    onChange={(e) => {
                      const next = [...thirdCountryWorkplaces];
                      next[idx] = { ...row, site: e.target.value };
                      setThirdCountryWorkplaces(next);
                    }}
                    className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
        />
      </div>
                <div className={idx === 0 ? "self-end w-[220px]" : "self-end w-[220px]"}>
                  {idx === 0 && <label className="mb-1 block text-sm text-slate-700">Start</label>}
                  <CalendarDatePicker
                    value={row.startDate}
                    onChange={(v: string) => {
                      const next = [...thirdCountryWorkplaces];
                      const newStartDate = v;
                      let newEndDate = row.endDate;
                      
                      // Säkerställ att slutdatum alltid är minst lika stort som startdatum
                      if (newStartDate) {
                        if (!newEndDate || newStartDate > newEndDate) {
                          // Om slutdatum saknas eller är tidigare än startdatum, sätt slutdatum till samma som startdatum
                          newEndDate = newStartDate;
                        }
                      }
                      
                      next[idx] = { ...row, startDate: newStartDate, endDate: newEndDate };
                      setThirdCountryWorkplaces(next);
                    }}
                    className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
        />
      </div>
                <div className="self-end w-[220px] grid grid-cols-[1fr_40px] items-end gap-2">
                  <div>
                    {idx === 0 && <label className="mb-1 block text-sm text-slate-700">Slut</label>}
                    <CalendarDatePicker
                      value={row.endDate}
                      onChange={(v: string) => {
                        const next = [...thirdCountryWorkplaces];
                        const newEndDate = v;
                        
                        // Säkerställ att slutdatum alltid är minst lika stort som startdatum
                        if (row.startDate && newEndDate) {
                          if (newEndDate < row.startDate) {
                            // Om slutdatum är tidigare än startdatum, ignorera ändringen
                            return;
                          }
                        }
                        
                        next[idx] = { ...row, endDate: newEndDate };
                        setThirdCountryWorkplaces(next);
                      }}
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                    />
                  </div>
                  {idx > 0 && (
        <button
          type="button"
                      onClick={() => {
                        const next = thirdCountryWorkplaces.filter((_, i) => i !== idx);
                        setThirdCountryWorkplaces(next);
                      }}
                      className="h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"
                      title="Ta bort"
        >
                      –
        </button>
                  )}
                  {idx === 0 && <div className="w-[40px]"></div>}
      </div>
    </div>
            ))}
      </div>
          {thirdCountryWorkplaces.length < 6 && (
            <button
              type="button"
              onClick={() => {
                setThirdCountryWorkplaces([...thirdCountryWorkplaces, { id: makeId(), site: "", startDate: isoToday(), endDate: isoToday() }]);
              }}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              data-info="Lägg till tjänstgöringsställe"
            >
              + Lägg till tjänstgöringsställe
            </button>
          )}
      </div>

        {/* Detaljerad beskrivning */}
        <div className="mb-4">
        <label className="mb-1 block text-sm font-semibold text-slate-900">
            Detaljerad beskrivning av på vilka sätt det kontrollerats att samtliga kompetenskrav i delmålet/-en är uppfyllda (specificering, t.ex. metoder för bedömning). Om intyget avser flera delmål, beskriv dem var för sig.
        </label>
        <textarea
          value={thirdCountryVerification}
          onChange={(e) => setThirdCountryVerification(e.target.value)}
          className="min-h-[200px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
        />
      </div>

        {/* Knapp för intyg om uppfyllda kompetenskrav */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={downloading}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px disabled:opacity-60 disabled:pointer-events-none"
          data-info="Intyg uppfyllda kompetenskrav"
        >
            {downloading ? "Skapar förhandsgranskning…" : "Intyg uppfyllda kompetenskrav"}
        </button>
      </div>
      </div>

      {/* Andra rutan: Uppnådd specialistkompetens */}
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900">Uppnådd specialistkompetens</h3>
          <button
            type="button"
            onClick={handleGenerate8b}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            data-info="Intyg Uppnådd specialistkompetens"
          >
            Intyg Uppnådd specialistkompetens
          </button>
        </div>
      </div>

      {/* DesktopMilestonePicker modal */}
      {milestonePickerOpen && goals && (
        <DesktopMilestonePicker
          open={milestonePickerOpen}
          title="Välj delmål"
          goals={goals}
          checked={milestoneCheckedSet}
          onToggle={handleToggleMilestone}
          onClose={() => setMilestonePickerOpen(false)}
        />
      )}
    </div>
  );
}

/** ===================== Komponent ===================== */
export default function PrepareApplicationModal2015({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [dirty, setDirty] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [baselineReady, setBaselineReady] = useState(false);
  const baselineSetTimeRef = useRef<number>(0);
  useEffect(() => {
    if (open) {
      setDirty(false);
      setShowCloseConfirm(false);
      setBaselineReady(false);
      baselineRef.current = null; // Nollställ baseline när modalen öppnas
      baselineSetTimeRef.current = 0;
    }
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

  // Baseline för dirty-tracking
  const baselineRef = useRef<any>(null);

  // Bilagor/presets
  const [paidFeeDate, setPaidFeeDate] = useState<string>(isoToday());
  const [presetChecked, setPresetChecked] = useState<Record<PresetKey, boolean>>({
    intyg: true,  // default ikryssad
    svDoc: false,
    foreignDocEval: false,
    foreignService: false,
    thirdCountry: true,  // default ikryssad
    individProg: false,
  });
  const [presetDates, setPresetDates] = useState<Record<PresetKey, string>>({
    intyg: isoToday(),
    svDoc: isoToday(),
    foreignDocEval: isoToday(),
    foreignService: isoToday(),
    thirdCountry: isoToday(),
    individProg: isoToday(),
  });
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [userReordered, setUserReordered] = useState(false);

  // Funktionshjälp för att få bilagnamn
  const getBilagaName = (type: AttachGroup): string => {
    const bilagaMap: Record<string, string> = {
      "Uppnådd specialistkompetens": "SOSFS-bilaga 2",
      "Uppfyllda kompetenskrav för specialistläkare från tredjeland": "SOSFS-bilaga 8a",
      "Uppnådd specialistkompetens för specialistläkare från tredjeland": "SOSFS-bilaga 8b",
      "Auskultationer": "SOSFS-bilaga 3",
      "Kliniska tjänstgöringar under handledning": "SOSFS-bilaga 4",
      "Kurser": "SOSFS-bilaga 5",
      "Utvecklingsarbete": "SOSFS-bilaga 6",
      "Vetenskapligt arbete": "SOSFS-bilaga 7",
      "Svensk doktorsexamen": "Övriga handlingar",
      "Utländsk doktorsexamen": "Övriga handlingar",
      "Utländsk tjänstgöring": "Övriga handlingar",
      "Individuellt utbildningsprogram": "Övriga handlingar",
    };
    return bilagaMap[type] || "";
  };

  // Funktionshjälp för att formatera label baserat på typ
  const formatAttachmentLabel = (item: AttachmentItem): string => {
    const type = item.type;
    const currentLabel = item.label || "";

    // För vetenskapligt arbete, bara typnamnet
    if (type === "Vetenskapligt arbete") {
      return "Vetenskapligt arbete";
    }

    // För kvalitets- och utvecklingsarbete
    if (type === "Utvecklingsarbete") {
      return "Kvalitets- och förbättringsarbete";
    }

    // För kliniska tjänstgöringar
    if (type === "Kliniska tjänstgöringar under handledning") {
      const name = currentLabel.trim();
      if (name && name !== "—") {
        return `Klinisk tjänstgöring: ${name}`;
      }
      return type;
    }

    // För kurser
    if (type === "Kurser") {
      const name = currentLabel.trim();
      if (name && name !== "—") {
        return `Kurs: ${name}`;
      }
      return type;
    }

    // För auskultationer
    if (type === "Auskultationer") {
      const name = currentLabel.trim();
      if (name && name !== "—") {
        return `Auskultation: ${name}`;
      }
      return type;
    }

    // För andra, behåll det som är satt nu
    return currentLabel || type;
  };

  // Funktionshjälp för att extrahera bilagnummer för sortering
  // Returnerar { num: number, sub: string } där num är huvudnumret och sub är eventuell bokstav (t.ex. "8a" -> { num: 8, sub: "a" })
  const getBilagaNumber = (type: AttachGroup): { num: number; sub: string } => {
    const bilagaName = getBilagaName(type);
    // "Övriga handlingar" ska också hamna sist
    if (!bilagaName || bilagaName === "Övriga handlingar") return { num: 9999, sub: "" }; // Intyg utan bilagnummer hamnar sist
    
    const match = bilagaName.match(/bilaga\s+(\d+)([a-z]?)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      const sub = (match[2] || "").toLowerCase();
      return { num, sub };
    }
    return { num: 9999, sub: "" };
  };

  // Sorteringsfunktion baserad på bilagnummer
  const sortByBilagaNumber = useCallback((a: AttachmentItem, b: AttachmentItem): number => {
    const numA = getBilagaNumber(a.type);
    const numB = getBilagaNumber(b.type);
    
    // Först sortera efter huvudnummer
    if (numA.num !== numB.num) {
      return numA.num - numB.num;
    }
    
    // Om samma huvudnummer, sortera efter bokstav (8a före 8b)
    if (numA.sub !== numB.sub) {
      return numA.sub.localeCompare(numB.sub);
    }
    
    // Om samma bilagnummer, sortera efter datum
    const ta = new Date(a.date || "").getTime();
    const tb = new Date(b.date || "").getTime();
    if (!isNaN(ta) && !isNaN(tb) && ta !== tb) {
      return ta - tb;
    }
    
    // Slutligen sortera efter label
    return (a.label || "").localeCompare(b.label || "", "sv");
  }, []);

  /** ==== Drag & drop: snap ==== */
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [tempOrder, setTempOrder] = useState<AttachmentItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const startYRef = useRef(0);
  const DRAG_THRESHOLD = 4;

  // Färg-mappning
  const [colorMap] = useState<Record<string, Swatch>>(() => GROUP_COLORS);

  // Säkerställ att tempOrder speglar attachments
  useEffect(() => setTempOrder(attachments), [attachments]);

  // Säkerställ att presets (t.ex. default-intyget och thirdCountry) finns i bilagelistan
  useEffect(() => {
    if (!open) return;

    setAttachments((prev) => {
      const list = [...prev];
      let changed = false;

      // Lägg till "Intyg om uppnådd specialistkompetens" om den är ikryssad men saknas
      if (presetChecked.intyg && !list.some((it) => it.preset === "intyg")) {
        list.push({
        id: "preset-intyg",
        type: "Uppnådd specialistkompetens",
        label: "Uppnådd specialistkompetens",
        date: presetDates.intyg || isoToday(),
        preset: "intyg",
        });
        changed = true;
      }

      // Lägg till thirdCountry bilagor (8a och 8b) om de är ikryssade men saknas
      if (presetChecked.thirdCountry && profile?.isThirdCountrySpecialist) {
        if (!list.some((it) => it.id === "preset-thirdCountry-8a")) {
          list.push({
            id: "preset-thirdCountry-8a",
            type: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
            label: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
            date: presetDates.thirdCountry || isoToday(),
            preset: "thirdCountry",
          });
          changed = true;
        }
        if (!list.some((it) => it.id === "preset-thirdCountry-8b")) {
          list.push({
            id: "preset-thirdCountry-8b",
            type: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
            label: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
            date: presetDates.thirdCountry || isoToday(),
            preset: "thirdCountry",
          });
          changed = true;
        }
      } else {
        // Ta bort thirdCountry bilagor om de är avmarkerade eller om användaren inte är specialist från tredje land
        const filtered = list.filter((it) => it.id !== "preset-thirdCountry-8a" && it.id !== "preset-thirdCountry-8b");
        if (filtered.length !== list.length) {
          list.length = 0;
          list.push(...filtered);
          changed = true;
        }
      }

      if (!changed) return prev;

      return userReordered
        ? list
        : list.slice().sort(sortByBilagaNumber);
    });
  }, [open, presetChecked.intyg, presetChecked.thirdCountry, presetDates.intyg, presetDates.thirdCountry, userReordered, profile?.isThirdCountrySpecialist]);

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

  /** Ladda profil + init-bilagor en gång när modalen öppnas */
  useEffect(() => {
    if (!open) return;

    (async () => {
      // 1) Försök återställa från IndexedDB (fallback till localStorage för migrering)
      let saved: any = null;
      let hadSavedAttachments = false;
      let hadSavedPresetDates = false;
      let savedAttachments: AttachmentItem[] | null = null;

      try {
        // Först försök från IndexedDB
        saved = await (db as any).specialistApplication?.get?.("default");
        
        // Om inte finns i IndexedDB, försök migrera från localStorage
        if (!saved) {
          const savedRaw = localStorage.getItem(STORAGE_KEY);
          if (savedRaw) {
            saved = JSON.parse(savedRaw);
            // Migrera till IndexedDB
            if (saved) {
              saved.id = "default";
              await (db as any).specialistApplication?.put?.(saved);
            }
          }
        }

        if (saved) {

          // Placeringar / kurser / sökande
          if (saved.placements) setPlacements(saved.placements);
          if (saved.courses) setCourses(saved.courses);
          if (saved.applicant) setApplicant(saved.applicant);

          // Intygare (inkl. sparat managerMode)
          if (saved.cert) {
            const savedCert = saved.cert as Partial<Certifiers>;

            setCert((prev) => {
              const nextManagerMode: ManagerMode =
                (savedCert.managerMode as ManagerMode) || prev.managerMode || "self";

              return {
                ...prev,
                ...savedCert,
                managerMode: nextManagerMode,
                // Namn fylls alltid i nu / via profil – ta inte gamla sparade namn
                studyDirector: "",
                mainSupervisor: {
                  ...(savedCert.mainSupervisor || prev.mainSupervisor),
                  name: "",
                },
              };
            });

            const mm = (savedCert.managerMode as ManagerMode) || "self";
            managerModeChangedRef.current = mm !== "self";
          }

          // Bilagor
          if (Array.isArray(saved.attachments) && saved.attachments.length > 0) {
            // Spara användarens lista för ev. framtida logik, men
            // själva bilagelistan kommer alltid att byggas om från
            // aktuella utbildningsaktiviteter när modalen öppnas.
            savedAttachments = saved.attachments as AttachmentItem[];
            setAttachments(saved.attachments);
            setTempOrder(saved.attachments);
          }



          // Datum för betald avgift
          if (typeof saved.paidFeeDate === "string" && saved.paidFeeDate) {
            setPaidFeeDate(saved.paidFeeDate);
          }

          // Preset-kryss
          if (saved.presetChecked) {
            setPresetChecked(saved.presetChecked as Record<PresetKey, boolean>);
          }

          // Preset-datum
          if (saved.presetDates) {
            hadSavedPresetDates = true;
            setPresetDates(saved.presetDates as Record<PresetKey, string>);
          }

          // Third country data
          if (typeof saved.thirdCountryDelmalCodes === "string") {
            setThirdCountryDelmalCodes(saved.thirdCountryDelmalCodes);
          }
          if (typeof saved.thirdCountryActivities === "string") {
            setThirdCountryActivities(saved.thirdCountryActivities);
          }
          if (typeof saved.thirdCountryVerification === "string") {
            setThirdCountryVerification(saved.thirdCountryVerification);
          }
          if (Array.isArray(saved.thirdCountryWorkplaces)) {
            setThirdCountryWorkplaces(saved.thirdCountryWorkplaces);
          }
        }
      } catch (err) {
        console.error("Kunde inte ladda specialistansökan:", err);
        // ignore saved state parse errors
      }

      // 2) Hämta ALLTID färsk profil (och ev. placeringar/kurser) från DB
      const [p, pls, crs] = await Promise.all([
        db.profile.get("default"),
        db.placements.toArray(),
        db.courses.toArray(),
      ]);

      // Profil ska alltid vara den färska från DB
      setProfile(p ?? null);

      // Bygg bilagelista från DB-data (och komplettera ev. sparad lista)
      const allPlacements = (pls || []) as any[];
      const allCourses = (crs || []) as any[];

      // Endast för 2021: filtrera fram ST-fasade eller de som markerats "Uppfyller ST-delmål"
      const gvRaw = String((p as any)?.goalsVersion || "").toLowerCase();
      const is2021 = gvRaw.includes("2021");

      const filteredPlacements = is2021
        ? allPlacements.filter((pl) => {
            const phase = String(pl?.phase || "ST").toUpperCase();
            const fulfills = !!pl?.fulfillsStGoals;
            return phase === "ST" || fulfills;
          })
        : allPlacements;

      const filteredCourses = is2021
        ? allCourses.filter((c) => {
            const phase = String(c?.phase || "ST").toUpperCase();
            const fulfills = !!c?.fulfillsStGoals;
            return phase === "ST" || fulfills;
          })
        : allCourses;

      setPlacements(filteredPlacements as any);
      setCourses(filteredCourses as any);

           const built: AttachmentItem[] = buildDefaultAttachmentsFor2015({
        placements: filteredPlacements as any,
        courses: filteredCourses as any,
      });

      // Bygg ALLTID bilagelistan från färska placeringar/kurser i DB + aktiva presets.
      // Sparad ordning i localStorage används inte längre för utbildningsaktiviteter,
      // så att datum för alla placeringar/kurser uppdateras vid varje öppning.
      {
        const baseList: AttachmentItem[] = built;
        const list: AttachmentItem[] = [];

        // Samma preset-logik som i rebuildWithPresets:
        if (presetChecked.intyg) {
          list.push({
            id: "preset-intyg",
            type: "Uppnådd specialistkompetens",
            label: "Uppnådd specialistkompetens",
            date: presetDates.intyg || isoToday(),
            preset: "intyg",
          });
        }

        list.push(...baseList);

        if (presetChecked.svDoc) {
          list.push({
            id: "preset-svdoc",
            type: "Svensk doktorsexamen",
            label: "Godkänd svensk doktorsexamen",
            date: presetDates.svDoc || isoToday(),
            preset: "svDoc",
          });
        }

        if (presetChecked.foreignDocEval) {
          list.push({
            id: "preset-foreignDocEval",
            type: "Utländsk doktorsexamen",
            label: "Bedömning av utländsk doktorsexamen",
            date: presetDates.foreignDocEval || isoToday(),
            preset: "foreignDocEval",
          });
        }

        if (presetChecked.foreignService) {
          list.push({
            id: "preset-foreignService",
            type: "Utländsk tjänstgöring",
            label: "Intyg om utländsk tjänstgöring",
            date: presetDates.foreignService || isoToday(),
            preset: "foreignService",
          });
        }

        if (presetChecked.thirdCountry && profile?.isThirdCountrySpecialist) {
          // Bilaga 8a
          list.push({
            id: "preset-thirdCountry-8a",
            type: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
            label: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
            date: presetDates.thirdCountry || isoToday(),
            preset: "thirdCountry",
          });
          // Bilaga 8b
          list.push({
            id: "preset-thirdCountry-8b",
            type: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
            label: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
            date: presetDates.thirdCountry || isoToday(),
            preset: "thirdCountry",
          });
        }

        if (presetChecked.individProg && profile?.isThirdCountrySpecialist) {
          list.push({
            id: "preset-individProg",
            type: "Individuellt utbildningsprogram",
            label: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
            date: presetDates.individProg || isoToday(),
            preset: "individProg",
          });
        }

        const finalList = list.slice().sort(sortByBilagaNumber);

        setAttachments(finalList);
        setTempOrder(finalList);
      }







      // Sätt default för ort/datum-fält ENDAST om vi INTE hade sparade datum
      if (!hadSavedPresetDates) {
        setPresetDates({
          intyg: isoToday(),
          svDoc: isoToday(),
          foreignDocEval: isoToday(),
          foreignService: isoToday(),
          thirdCountry: isoToday(),
          individProg: isoToday(),
        });
      }

      // Förifyll intygare med hemklinik om tomt
      setCert((prev) => ({
        ...prev,
        mainSupervisor: {
          ...prev.mainSupervisor,
          // låt namn stå tomt – anges av användaren
          workplace: prev.mainSupervisor.workplace || (p as any)?.homeClinic || "",
          specialty: prev.mainSupervisor.specialty || (p as any)?.specialty || "",
        },
        managerSelf: {
          ...prev.managerSelf,
          workplace: prev.managerSelf.workplace || (p as any)?.homeClinic || "",
          specialty: prev.managerSelf.specialty || (p as any)?.specialty || "",
        },
        managerAppointed: {
          ...prev.managerAppointed,
          managerWorkplace:
            prev.managerAppointed.managerWorkplace || (p as any)?.homeClinic || "",
          managerSpecialty:
            prev.managerAppointed.managerSpecialty || (p as any)?.specialty || "",
        },
      }));

      // === Prefill av ansökningsfält (2015) från Profil om tomma ===
      setApplicant((prev) => {
        const next = { ...prev };
        const prof = (p as any) || {};

        // 1) Examensland/datum om ej redan ifyllda i modalen
        if (!next.medDegreeCountry) {
          next.medDegreeCountry = String(prof.medDegreeCountry ?? "");
        }
        if (!next.medDegreeDate) {
          next.medDegreeDate = String(prof.medDegreeDate ?? isoToday());
        }

        // 2) Licensländer (max 3).
        // Företräde: profile.licenseCountry som rad 1 om saknas,
        // därefter profile.foreignLicenses (behåll datum om finns).
        const alreadyAny =
          Array.isArray(prev.licenseCountries) &&
          prev.licenseCountries.some((r: any) => r?.country || r?.date);

        if (!alreadyAny) {
          const list: any[] = [];

          const licCountry = String(prof.licenseCountry ?? "").trim();
          if (licCountry) {
            list.push({
              id: makeId(),
              country: licCountry,
              date: String(prof.licenseDate ?? "") || isoToday(),
            });
          }

          const fl = Array.isArray(prof.foreignLicenses)
            ? prof.foreignLicenses.slice(0, 3 - list.length)
            : [];

          for (const r of fl) {
            list.push({
              id: makeId(),
              country: String(r?.country ?? ""),
              date: String(r?.date ?? "") || isoToday(),
            });
          }

          if (list.length) {
            next.licenseCountries = list.slice(0, 3);
          }
        }

        return next;
      });
    })();
  }, [open]);




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

  // Ta baseline efter att allt är initierat
  useEffect(() => {
    if (!open) {
      setBaselineReady(false);
      baselineRef.current = null;
      return;
    }
    // Vänta längre för att säkerställa att all data är laddad och stabil
    const timer = setTimeout(() => {
      takeBaseline();
      setBaselineReady(true);
      setDirty(false); // Säkerställ att dirty är false när baseline sätts
      baselineSetTimeRef.current = Date.now(); // Spara när baseline sattes
    }, 300);
    return () => clearTimeout(timer);
  }, [open, profile, placements.length, courses.length]);

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
  const blob = new Blob([bytes], { type: "application/pdf" });
  openPreviewFromBlob(blob);

  } catch (e: any) {
    console.error(e);
    alert(e?.message || "Kunde inte skapa PDF.");
  }
}







  /** ===================== Presets ===================== */
  function rebuildWithPresets(nextChecked: Record<PresetKey, boolean>, nextDates: Record<PresetKey, string>) {
    const base = attachments.filter((x) => !x.preset);
    const list: AttachmentItem[] = [];

    if (nextChecked.intyg) {
      list.push({
        id: "preset-intyg",
        type: "Uppnådd specialistkompetens",
        label: "Uppnådd specialistkompetens",
        date: nextDates.intyg || isoToday(),
        preset: "intyg",
      });
    }

    list.push(...base);

    if (nextChecked.svDoc) {
      list.push({
        id: "preset-svdoc",
        type: "Svensk doktorsexamen",
        label: "Godkänd svensk doktorsexamen",
        date: nextDates.svDoc || isoToday(),
        preset: "svDoc",
      });
    }

    if (nextChecked.foreignDocEval) {
      list.push({
        id: "preset-foreignDocEval",
        type: "Utländsk doktorsexamen",
        label: "Bedömning av utländsk doktorsexamen",
        date: nextDates.foreignDocEval || isoToday(),
        preset: "foreignDocEval",
      });
    }

    if (nextChecked.foreignService) {
      list.push({
        id: "preset-foreignService",
        type: "Utländsk tjänstgöring",
        label: "Intyg om utländsk tjänstgöring",
        date: nextDates.foreignService || isoToday(),
        preset: "foreignService",
      });
    }

    if (nextChecked.thirdCountry && profile?.isThirdCountrySpecialist) {
      // Bilaga 8a
      list.push({
        id: "preset-thirdCountry-8a",
        type: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
        label: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
        date: nextDates.thirdCountry || isoToday(),
        preset: "thirdCountry",
      });
      // Bilaga 8b
      list.push({
        id: "preset-thirdCountry-8b",
        type: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
        label: "Uppnådd specialistkompetens för specialistläkare från tredjeland",
        date: nextDates.thirdCountry || isoToday(),
        preset: "thirdCountry",
      });
    }

    if (nextChecked.individProg && profile?.isThirdCountrySpecialist) {
      list.push({
        id: "preset-individProg",
        type: "Individuellt utbildningsprogram",
        label: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
        date: nextDates.individProg || isoToday(),
        preset: "individProg",
      });
    }

    setAttachments(
      userReordered
        ? list
        : list.slice().sort(sortByBilagaNumber)
    );
    setDirty(true);
  }


  function togglePreset(key: PresetKey) {
  setPresetChecked((prev) => {
    const next = { ...prev, [key]: !prev[key] };
    rebuildWithPresets(next, presetDates);
    return next;
  });
  // Markera att något har ändrats så Spara-knappen aktiveras
  try { (document.getElementById("save-2015") ?? document.getElementById("save-2021"))?.setAttribute("data-disabled", "false"); } catch {}
}


    function updatePresetDate(key: PresetKey, dateISO: string) {
  setPresetDates((prev) => {
    const next = { ...prev, [key]: dateISO };
    setAttachments((list) =>
      list.map((it) => (it.preset === key ? { ...it, date: dateISO } : it))
    );
    return next;
  });
  setDirty(true);
  // Markera att något har ändrats så Spara-knappen aktiveras
  try { (document.getElementById("save-2015") ?? document.getElementById("save-2021"))?.setAttribute("data-disabled", "false"); } catch {}
}



/** ===================== Baseline och restore ===================== */
const currentSnapshot = () => {
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
};

const takeBaseline = () => {
  baselineRef.current = currentSnapshot();
};

const restoreBaseline = () => {
  const b = baselineRef.current;
  if (!b) return;
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
  setThirdCountryWorkplaces(b.thirdCountryWorkplaces || [{ id: makeId(), site: "", startDate: isoToday(), endDate: isoToday() }]);
};

/** Stäng med varning och ev. rollback */
const handleRequestClose = useCallback(() => {
  if (!dirty) {
    onClose();
    return;
  }
  // Visa egen bekräftelsedialog istället för window.confirm()
  setShowCloseConfirm(true);
}, [dirty]);

const handleConfirmClose = useCallback(() => {
  restoreBaseline(); // rulla tillbaka
  setDirty(false);
  setShowCloseConfirm(false);
  onClose();
}, []);

const handleCancelClose = useCallback(() => {
  setShowCloseConfirm(false);
}, []);

/** Spara alla ändringar */
const handleSaveAll = useCallback(async () => {
  // Spara till IndexedDB istället för localStorage
  const payload = {
    id: "default",
    // profile:  ⟵ medvetet utelämnad
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
    await (db as any).specialistApplication?.put?.(payload);
    localStorage.setItem(COLORMAP_KEY, JSON.stringify(GROUP_COLORS));
    takeBaseline(); // Spara ny baseline efter sparning
    setDirty(false); // Sätt dirty till false efter sparning
  } catch (err) {
    console.error("Kunde inte spara specialistansökan:", err);
  }
}, [placements, courses, applicant, cert, attachments, paidFeeDate, presetChecked, presetDates, tab, userReordered, thirdCountryDelmalCodes, thirdCountryActivities, thirdCountryVerification, thirdCountryWorkplaces]);

const handleSaveAndClose = useCallback(async () => {
  await handleSaveAll();
  setShowCloseConfirm(false);
  onClose();
}, [handleSaveAll, onClose]);

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

  /** Cmd/Ctrl+Enter för att spara (ESC hanteras nu av global ESC-handler) */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Om bekräftelsedialogen är öppen, låt den hantera ALLA keyboard events
      if (showCloseConfirm) {
        // UnsavedChangesDialog hanterar keyboard events och stoppar propagation
        return;
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void handleSaveAll();
      }
      // ESC hanteras nu av global ESC-handler som hittar det översta fönstret
    };
    window.addEventListener("keydown", onKey, { capture: true, passive: false });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, dirty, handleSaveAll, showCloseConfirm]);

  /** Uppdatera dirty-status baserat på baseline */
  useEffect(() => {
    if (!open || !baselineReady || !baselineRef.current) return;
    
    // Ignorera dirty-check om baseline just satts (inom 500ms)
    const timeSinceBaseline = Date.now() - baselineSetTimeRef.current;
    if (timeSinceBaseline < 500) {
      setDirty(false);
      return;
    }
    
    // Vänta lite extra för att säkerställa att baseline är helt stabil
    const timer = setTimeout(() => {
      const b = baselineRef.current;
      if (!b) return;
      const cur = currentSnapshot();
      try {
        const isDirty = JSON.stringify(cur) !== JSON.stringify(b);
        setDirty(isDirty);
      } catch {
        // Vid fel, sätt inte dirty automatiskt - låt användarens ändringar sätta det
      }
    }, 100); // Längre delay för att säkerställa att allt är stabilt
    return () => clearTimeout(timer);
  }, [
    open,
    baselineReady,
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
      const vcName = safe(isAppointed ? vc.specialistName || vc.managerName : vc.name);
      // Personnummer används inte längre
      const vcSpec = safe(isAppointed ? vc.specialistSpecialty : vc.specialty);
      const vcWork = safe(isAppointed ? vc.specialistWorkplace || vc.managerWorkplace : vc.workplace);

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
        const srFullName = cert.studyDirector || (profile as any)?.studyDirector || "";
        const srWork     = cert.studyDirectorWorkplace || (profile as any)?.homeClinic || "";

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
      const blob = new Blob([bytes], { type: "application/pdf" });
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
            <div className="grid grid-cols-1 gap-4">
              {/* Studierektor */}
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-extrabold">Studierektor</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ReadonlyInput
  label="Namn"
  value={
    (profile as any)?.studyDirector
      || [ (profile as any)?.studyDirectorFirstName, (profile as any)?.studyDirectorLastName ].filter(Boolean).join(" ")
      || cert.studyDirector
      || ""
  }
/>



                  <ReadonlyInput label="Tjänsteställe" value={(profile as any)?.homeClinic || ""} />
                </div>
              </div>

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

                  <ReadonlyInput
                    label="Tjänsteställe"
                    value={
                      String(
                        (profile as any)?.supervisorWorkplace
                          || (profile as any)?.homeClinic
                          || cert.mainSupervisor.workplace
                          || ""
                      )
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


              {/* Verksamhetschef / utsedd specialist */}
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-extrabold">Verksamhetschef / utsedd specialist</h3>

                <select
                  className="mb-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  value={cert.managerMode}
                  onChange={(e) => {
                    const v = (e.target as HTMLSelectElement).value as ManagerMode;
                    // Markera att användaren nu aktivt valt läge -> init-logik får inte skriva över detta
                    managerModeChangedRef.current = true;
                    setCert((s) => ({
                      ...s,
                      managerMode: v,
                    }));
                    setDirty(true);
                  }}
                >


                  <option value="self">
                    Verksamhetschefen har specialistkompetens och intygar själv ST-läkarens specialistkompetens.
                  </option>
                  <option value="appointed">
                    Verksamhetschefen har utsett en läkare med specialistkompetens att bedöma ST-läkarens
                    specialistkompetens
                  </option>
                </select>

                {cert.managerMode === "self" ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <ReadonlyInput
                      label="Verksamhetschef"
                      value={(profile as any)?.verksamhetschef || ""}
                    />
                    <LabeledInputLocal
                      label="Tjänsteställe"
                      value={cert.managerSelf.workplace || (profile as any)?.homeClinic || ""}
                      onCommit={(v) => setCert((s) => ({ ...s, managerSelf: { ...s.managerSelf, workplace: v } }))}
                    />
                    <LabeledInputLocal
                      label="Specialitet"
                      value={cert.managerSelf.specialty || (profile as any)?.specialty || ""}
                      onCommit={(v) => setCert((s) => ({ ...s, managerSelf: { ...s.managerSelf, specialty: v } }))}
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <ReadonlyInput
                        label="Verksamhetschef"
                        value={(profile as any)?.verksamhetschef || ""}
                      />
                      <LabeledInputLocal
                        label="Verksamhetschefens tjänsteställe"
                        value={cert.managerAppointed.managerWorkplace || (profile as any)?.homeClinic || ""}
                        onCommit={(v) =>
                          setCert((s) => ({ ...s, managerAppointed: { ...s.managerAppointed, managerWorkplace: v } }))
                        }
                      />
                      <LabeledInputLocal
                        label="Verksamhetschefens specialitet"
                        value={cert.managerAppointed.managerSpecialty || (profile as any)?.specialty || ""}
                        onCommit={(v) =>
                          setCert((s) => ({ ...s, managerAppointed: { ...s.managerAppointed, managerSpecialty: v } }))
                        }
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <LabeledInputLocal
                        label="Utsedd specialistläkare"
                        value={cert.managerAppointed.specialistName}
                        onCommit={(v) =>
                          setCert((s) => ({ ...s, managerAppointed: { ...s.managerAppointed, specialistName: v } }))
                        }
                      />
                      <LabeledInputLocal
                        label="Utsedd specialistläkares specialitet"
                        value={cert.managerAppointed.specialistSpecialty}
                        onCommit={(v) =>
                          setCert((s) => ({
                            ...s,
                            managerAppointed: { ...s.managerAppointed, specialistSpecialty: v },
                          }))
                        }
                      />
                      <LabeledInputLocal
                        label="Utsedd specialistläkares tjänsteställe"
                        value={cert.managerAppointed.specialistWorkplace}
                        onCommit={(v) =>
                          setCert((s) => ({
                            ...s,
                            managerAppointed: { ...s.managerAppointed, specialistWorkplace: v },
                          }))
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
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
              onPrintIntyg={onPrintIntyg}
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
                      <div ref={(el) => (rowRefs.current[idx] = el)} className="mb-1 grid grid-cols-[48px_1fr] gap-2">
                        {/* #-kolumn */}
                        <div className="flex items-center justify-center">
                          <div className="select-none rounded-md bg-slate-100 px-2 py-[1px] text-[11px] font-bold text-slate-700 tabular-nums">
                            {idx + 1}.
                          </div>
                        </div>

                        {/* Kort */}
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
                          data-info={`${getBilagaName(a.type) || a.type} - ${formatAttachmentLabel(a)}. Kan flyttas för att ändra ordning.`}
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
                            <span
                              className="shrink-0 rounded-md border px-1.5 py-[1px] text-[11px] font-semibold text-slate-700 select-none"
                              style={(() => { const c = colorsFor(a.type); return { backgroundColor: c.pillBg, borderColor: c.pillBd }; })()}
                            >
                              {getBilagaName(a.type) || a.type}
                            </span>
                            <span className="min-w-0 grow truncate text-[13px] font-medium text-slate-900 select-none">
                              {formatAttachmentLabel(a)}
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

                {/* Intyg */}
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_220px] items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-[13px]" data-info="Intyg om uppnådd specialistkompetens. Detta är huvudintyget som bekräftar att du har uppnått alla delmål och kompetenser som krävs för specialistkompetens enligt SOSFS 2015:8. Intyget inkluderas som bilaga i ansökan.">
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

                {/* Uppfyllda kompetenskrav för specialistläkare från tredjeland - direkt efter "Uppnådd specialistkompetens" */}
                {profile?.isThirdCountrySpecialist && (
                  <div className="mb-2 grid grid-cols-[minmax(0,1fr)_220px] items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-[13px]" data-info="Uppfyllda kompetenskrav för specialistläkare från tredjeland. Detta intyg bekräftar att du har uppfyllt de kompetenskrav som krävs för specialistläkare från tredje land. Intyget skapas i fliken 'Specialistläkare från tredjeland' och kan inkluderas som bilaga i ansökan.">
                      <input type="checkbox" checked={presetChecked.thirdCountry} onChange={() => togglePreset("thirdCountry")} />
                      <span>Uppfyllda kompetenskrav för specialistläkare från tredjeland</span>
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

                {(["svDoc", "foreignDocEval", "foreignService", "individProg"] as PresetKey[]).map(
                  (k) => {
                    // Dölj individProg om användaren inte är specialistläkare från tredjeland
                    if (k === "individProg" && !profile?.isThirdCountrySpecialist) {
                      return null;
                    }

                    const labels: Record<PresetKey, string> = {
                      intyg: "Intyg om uppnådd specialistkompetens",
                      svDoc: "Godkänd svensk doktorsexamen",
                      foreignDocEval: "Bedömning av utländsk doktorsexamen",
                      foreignService: "Intyg om utländsk tjänstgöring",
                      thirdCountry: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
                      individProg: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
                    };
                    const infoTexts: Record<PresetKey, string> = {
                      intyg: "Intyg om uppnådd specialistkompetens. Huvudintyget som bekräftar att alla delmål och kompetenser är uppnådda.",
                      svDoc: "Godkänd svensk doktorsexamen. Dokumentation av din svenska doktorsexamen som bilaga i ansökan.",
                      foreignDocEval: "Bedömning av utländsk doktorsexamen. Dokumentation av bedömning av din utländska doktorsexamen som bilaga i ansökan.",
                      foreignService: "Intyg om utländsk tjänstgöring. Dokumentation av utländsk tjänstgöring som kan räknas in i utbildningen.",
                      thirdCountry: "Uppfyllda kompetenskrav för specialistläkare från tredjeland. Bekräftar att kompetenskrav för tredjelandspecialister är uppfyllda.",
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

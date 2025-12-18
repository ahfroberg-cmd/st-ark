// components/PrepareApplicationModal2021.tsx
//
// Copyright 2024 ST-ARK
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
"use client";

import React, { useEffect, useMemo, useRef, useState, Fragment, useCallback } from "react";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";

import { db } from "@/lib/db";
import type { Profile, Placement, Course } from "@/lib/types";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import { PDFDocument, StandardFonts, PDFName } from "pdf-lib";
import { addMonths, toISO } from "@/lib/dateutils";
import MilestonePicker from "@/components/MilestonePicker";
import { loadGoals, type GoalsCatalog } from "@/lib/goals";




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

/** === Bilagetyper & ordning (för färg + initial sortering) === */
type AttachGroup =
  | "Fullgjord specialiseringstjänstgöring"
  | "Uppnådd specialistkompetens"
  | "Auskultationer"
  | "Kliniska tjänstgöringar under handledning"
  | "Kurser"
  | "Utvecklingsarbete"
  | "Vetenskapligt arbete"
  | "Delmål STa3"
  | "Medicinsk vetenskap"
  | "Delmål för specialistläkare från tredjeland"
  | "Svensk doktorsexamen"
  | "Utländsk doktorsexamen"
  | "Utländsk tjänstgöring"
  | "Individuellt utbildningsprogram för specialistläkare från tredjeland";

const GROUP_ORDER: AttachGroup[] = [
  "Fullgjord specialiseringstjänstgöring",
  "Uppnådd specialistkompetens",
  "Auskultationer",
  "Kliniska tjänstgöringar under handledning",
  "Kurser",
  "Utvecklingsarbete",
  "Vetenskapligt arbete",
  "Delmål STa3",
  "Medicinsk vetenskap",
  "Delmål för specialistläkare från tredjeland",
  "Svensk doktorsexamen",
  "Utländsk doktorsexamen",
  "Utländsk tjänstgöring",
  "Individuellt utbildningsprogram för specialistläkare från tredjeland",
];

type PresetKey =
  | "fullgjordST"
  | "intyg"
  | "sta3"
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

/** Bygg initial bilagelista (2021) från sparade placeringar + kurser i DB */
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



function buildDefaultAttachmentsFor2021(args: {
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


  // Sortera enligt bilagnummer först, sedan datum + label
  // "Fullgjord specialiseringstjänstgöring" ska alltid hamna först
  const sorted = items.slice().sort((a, b) => {
    // Om en av dem är "Fullgjord specialiseringstjänstgöring", den ska alltid hamna först
    if (a.type === "Fullgjord specialiseringstjänstgöring" && b.type !== "Fullgjord specialiseringstjänstgöring") {
      return -1;
    }
    if (b.type === "Fullgjord specialiseringstjänstgöring" && a.type !== "Fullgjord specialiseringstjänstgöring") {
      return 1;
    }
    
    // Först sortera efter bilagnummer
    // "Vetenskapligt arbete" ska ha bilagnummer 9 (samma som "Kliniska tjänstgöringar under handledning")
    // men hamna efter den i sorteringen och före bilaga 10 (Kurser)
    const numA = a.type === "Fullgjord specialiseringstjänstgöring" ? { num: 1, sub: "" } :
                 a.type === "Uppnådd specialistkompetens" ? { num: 7, sub: "" } :
                 a.type === "Auskultationer" ? { num: 8, sub: "" } :
                 a.type === "Kliniska tjänstgöringar under handledning" ? { num: 9, sub: "a" } :
                 a.type === "Vetenskapligt arbete" ? { num: 9, sub: "b" } : // Samma bilagnummer men efter kliniska, före bilaga 10
                 a.type === "Kurser" ? { num: 10, sub: "" } :
                 a.type === "Utvecklingsarbete" ? { num: 11, sub: "" } :
                 a.type === "Delmål STa3" || a.type === "Medicinsk vetenskap" || a.type === "Delmål för specialistläkare från tredjeland" ? { num: 13, sub: "" } :
                 { num: 9999, sub: "" };
    const numB = b.type === "Fullgjord specialiseringstjänstgöring" ? { num: 1, sub: "" } :
                 b.type === "Uppnådd specialistkompetens" ? { num: 7, sub: "" } :
                 b.type === "Auskultationer" ? { num: 8, sub: "" } :
                 b.type === "Kliniska tjänstgöringar under handledning" ? { num: 9, sub: "a" } :
                 b.type === "Vetenskapligt arbete" ? { num: 9, sub: "b" } : // Samma bilagnummer men efter kliniska, före bilaga 10
                 b.type === "Kurser" ? { num: 10, sub: "" } :
                 b.type === "Utvecklingsarbete" ? { num: 11, sub: "" } :
                 b.type === "Delmål STa3" || b.type === "Medicinsk vetenskap" || b.type === "Delmål för specialistläkare från tredjeland" ? { num: 13, sub: "" } :
                 { num: 9999, sub: "" };
    
    if (numA.num !== numB.num) return numA.num - numB.num;
    // Om samma bilagnummer, sortera efter sub (så att "Kliniska" kommer före "Vetenskapligt")
    if (numA.sub !== numB.sub) return numA.sub.localeCompare(numB.sub);

    const ta = ts(a.date);
    const tb = ts(b.date);
    if (ta !== tb) return ta - tb;

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
  "Fullgjord specialiseringstjänstgöring": { bg: "hsl(12 35% 94%/.96)", bd: "hsl(12 25% 75%/.96)", pill: "hsl(12 40% 98%/.96)", pillBd: "hsl(12 23% 85%/.96)" },
  "Uppnådd specialistkompetens": { bg: "hsl(12 35% 94%/.96)", bd: "hsl(12 25% 75%/.96)", pill: "hsl(12 40% 98%/.96)", pillBd: "hsl(12 23% 85%/.96)" },
  "Auskultationer":               { bg: "hsl(30 35% 94%/.96)", bd: "hsl(30 25% 75%/.96)", pill: "hsl(30 40% 98%/.96)", pillBd: "hsl(30 23% 85%/.96)" },
  "Kliniska tjänstgöringar under handledning": { bg: "hsl(222 30% 94%/.96)", bd: "hsl(222 22% 72%/.96)", pill: "hsl(222 35% 98%/.96)", pillBd: "hsl(222 20% 84%/.96)" },
  "Kurser":                       { bg: "hsl(190 30% 94%/.96)", bd: "hsl(190 22% 72%/.96)", pill: "hsl(190 35% 98%/.96)", pillBd: "hsl(190 20% 84%/.96)" },
  "Utvecklingsarbete":            { bg: "hsl(95 25% 94%/.96)",  bd: "hsl(95 20% 72%/.96)",  pill: "hsl(95 30% 98%/.96)",  pillBd: "hsl(95 18% 84%/.96)"  },
  "Vetenskapligt arbete":         { bg: "hsl(265 25% 94%/.96)", bd: "hsl(265 20% 72%/.96)", pill: "hsl(265 30% 98%/.96)", pillBd: "hsl(265 18% 84%/.96)" },
  "Delmål STa3":                  { bg: "hsl(200 30% 94%/.96)", bd: "hsl(200 22% 72%/.96)", pill: "hsl(200 35% 98%/.96)", pillBd: "hsl(200 20% 84%/.96)" },
  "Medicinsk vetenskap":          { bg: "hsl(200 30% 94%/.96)", bd: "hsl(200 22% 72%/.96)", pill: "hsl(200 35% 98%/.96)", pillBd: "hsl(200 20% 84%/.96)" },
  "Delmål för specialistläkare från tredjeland": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Svensk doktorsexamen":         { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Utländsk doktorsexamen":       { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Utländsk tjänstgöring":        { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
  "Individuellt utbildningsprogram för specialistläkare från tredjeland": { bg: GREY_BG, bd: GREY_BD, pill: GREY_PILL, pillBd: GREY_PILLBD },
};

const makeId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** ===================== PDF-hjälpare (INTYG 2021) ===================== */
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

/** ===================== STa3 Tab Content ===================== */
function Sta3TabContent({
  profile,
  placements,
  courses,
  sta3OtherText,
  setSta3OtherText,
  sta3HowVerifiedText,
  setSta3HowVerifiedText,
  onPreview,
  presetChecked,
  presetDates,
  setPresetChecked,
  rebuildWithPresets,
}: {
  profile: Profile | null;
  placements: Placement[];
  courses: Course[];
  sta3OtherText: string;
  setSta3OtherText: (v: string) => void;
  sta3HowVerifiedText: string;
  setSta3HowVerifiedText: (v: string) => void;
  onPreview: (blob: Blob) => void;
  presetChecked: Record<PresetKey, boolean>;
  presetDates: Record<PresetKey, string>;
  setPresetChecked: React.Dispatch<React.SetStateAction<Record<PresetKey, boolean>>>;
  rebuildWithPresets: (nextChecked: Record<PresetKey, boolean>, nextDates: Record<PresetKey, string>) => void;
}) {
  const [autoPlacements, setAutoPlacements] = useState<Array<{ id: string; title: string; period?: string }>>([]);
  const [autoCourses, setAutoCourses] = useState<Array<{ id: string; title: string; period?: string }>>([]);
  const [researchTitle, setResearchTitle] = useState<string>("");
  const [downloading, setDownloading] = useState(false);

  // STa3-detektion
  const isSta3Token = (val: unknown): boolean => {
    const s = String(val ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return s === "STA3" || s === "A3";
  };

  const hasSta3InObj = (obj: any): boolean => {
    if (!obj || typeof obj !== "object") return false;
    const fields = [obj?.milestones, obj?.stMilestones, obj?.goals, obj?.goalIds, obj?.milestoneIds, obj?.codes];
    for (const arr of fields) {
      if (!arr) continue;
      for (const v of arr as any[]) {
        if (isSta3Token(v)) return true;
      }
    }
    return false;
  };

  // Auto-uppsamling av STa3-aktiviteter
  useEffect(() => {
    (async () => {
      try {
        const [achsRaw, placsRaw, crsRaw] = await Promise.all([
          (db as any).achievements?.toArray?.() ?? [],
          (db as any).placements?.toArray?.() ?? [],
          (db as any).courses?.toArray?.() ?? [],
        ]);

        const achs = achsRaw as any[];
        const placs = placsRaw as any[];
        const crs = crsRaw as any[];

        const placementIds = new Set<string>();
        const courseIds = new Set<string>();
        let foundResearch = "";

        for (const ach of achs) {
          const cands = [ach.milestoneId, ach.goalId, ach.code, ach.milestone];
          if (cands.some(isSta3Token)) {
            // Lägg bara till placeringar som INTE är vetenskapligt arbete
            if (ach.placementId) {
              const placement = placs.find((p: any) => String(p.id) === String(ach.placementId));
              if (placement && placement.type !== "Vetenskapligt arbete") {
                placementIds.add(String(ach.placementId));
              } else if (placement && placement.type === "Vetenskapligt arbete") {
                // Om det är vetenskapligt arbete, lägg till som research
                foundResearch = placement.clinic || placement.label || placement.note || "";
              }
            }
            if (ach.courseId) courseIds.add(String(ach.courseId));
          }
        }

        for (const p of placs) {
          // Om det är vetenskapligt arbete med STa3, lägg bara till som research, inte som klinisk tjänstgöring
          if (p.type === "Vetenskapligt arbete" && hasSta3InObj(p)) {
            foundResearch = p.clinic || p.label || p.note || "";
          } else if (hasSta3InObj(p)) {
            // Endast placeringar som INTE är vetenskapligt arbete läggs till i klinisk tjänstgöring
            placementIds.add(String(p.id));
          }
        }
        for (const c of crs) {
          if (hasSta3InObj(c)) courseIds.add(String(c.id));
        }

        const pickedPlacements = placs
          .filter((p: any) => placementIds.has(String(p.id)))
          .map((p: any) => ({
            id: String(p.id),
            title: p.clinic || p.title || "Klinisk tjänstgöring",
            period: `${p.startDate || ""}${p.endDate ? ` – ${p.endDate}` : ""}${p.attendance ? ` · ${p.attendance}%` : ""}`.trim(),
          }));

        const pickedCourses = crs
          .filter((c: any) => courseIds.has(String(c.id)))
          .map((c: any) => ({
            id: String(c.id),
            title: c.title || c.provider || "Kurs",
            period: [c.city, c.certificateDate || c.endDate || c.startDate].filter(Boolean).join(" · "),
          }));

        setAutoPlacements(pickedPlacements);
        setAutoCourses(pickedCourses);
        if (foundResearch) setResearchTitle(foundResearch);
      } catch (err) {
        console.error("STa3 auto-plockning misslyckades:", err);
      }
    })();
  }, []);

  // Använd bara auto-uppsamlade aktiviteter som faktiskt uppfyller STa3-delmålet
  // Om inga hittas, visa tomma listor (inte alla aktiviteter som fallback)
  const listPlacements = autoPlacements;
  const listCourses = autoCourses;

  const handleGenerate = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const { exportSta3Certificate } = await import("@/lib/exporters");
      
      const rawLines: string[] = [];
      if (researchTitle) rawLines.push(`Vetenskapligt arbete: ${researchTitle}`);
      listPlacements.forEach((p) => {
        rawLines.push(`Klinisk tjänstgöring: ${p.title}${p.period ? ` (${p.period})` : ""}`);
      });
      listCourses.forEach((c) => {
        rawLines.push(`Kurs: ${c.title}${c.period ? ` (${c.period})` : ""}`);
      });
      if (sta3OtherText?.trim()) {
        rawLines.push("");
        rawLines.push(sta3OtherText.trim());
      }

      const activitiesBlock = rawLines.filter((line) => line.trim().length > 0).join("\n");
      const howBlock = (sta3HowVerifiedText ?? "").trim();

      if (!activitiesBlock && !howBlock) {
        alert("Lägg till minst en rad under aktiviteter eller hur det kontrollerats innan du skapar intyget.");
        return;
      }

      const supervisorName = (profile as any)?.supervisor || "";
      const supervisorSpeciality = (profile as any)?.specialty || (profile as any)?.speciality || "";
      const supervisorSite = (profile as any)?.supervisorWorkplace || (profile as any)?.homeClinic || "";

      const blob = await exportSta3Certificate(
        {
          profile: profile as any,
          supervisor: {
            name: supervisorName,
            speciality: supervisorSpeciality,
            site: supervisorSite,
          },
          activitiesText: activitiesBlock,
          howVerifiedText: howBlock,
        },
        { output: "blob", filename: "intyg-sta3-2021.pdf" }
      );

      if (blob instanceof Blob) {
        onPreview(blob);
      }
    } catch (err) {
      console.error("exportSta3Certificate error", err);
      alert("Det gick inte att skapa intyget. Kontrollera uppgifterna och försök igen.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Övre sektion */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-3 text-base font-semibold text-slate-900">
          Utbildningsaktiviteter som genomförts för att uppnå delmålet
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1 text-sm font-semibold text-slate-800">Vetenskapligt arbete</div>
              <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900">
                {researchTitle || "—"}
              </div>
            </div>

            <div>
              <div className="mb-1 text-sm font-semibold text-slate-800">
                Klinisk tjänstgöring med godkänt delmål STa3
              </div>
              <div className="rounded-xl border border-slate-200">
                {listPlacements.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">Inget registrerat</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {listPlacements.map((p) => (
                      <li key={p.id} className="px-3 py-2">
                        <div className="text-sm font-medium text-slate-900">{p.title || "—"}</div>
                        {p.period && <div className="text-xs text-slate-600">{p.period}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-sm font-semibold text-slate-800">
              Kurser med godkänt delmål STa3
            </div>
            <div className="rounded-xl border border-slate-200">
              {listCourses.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-500">Inget registrerat</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {listCourses.map((c) => (
                    <li key={c.id} className="px-3 py-2">
                      <div className="text-sm font-medium text-slate-900">{c.title || "—"}</div>
                      {c.period && <div className="text-xs text-slate-600">{c.period}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm text-slate-700">Övriga aktiviteter</label>
          <textarea
            value={sta3OtherText}
            onChange={(e) => setSta3OtherText(e.target.value)}
            className="min-h-[100px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
          />
        </div>
      </div>

      {/* Nedre sektion */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="mb-1 text-base font-semibold text-slate-900">
          Hur det kontrollerats att sökanden uppnått delmålet
        </div>
        <div className="mb-2 text-xs text-slate-600">
          Exempel: bedömningar av kliniskt omhändertagande eller kursexaminationer
        </div>
        <textarea
          value={sta3HowVerifiedText}
          onChange={(e) => setSta3HowVerifiedText(e.target.value)}
          className="min-h-[140px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
        />
      </div>

      {/* Intyg-knappar */}
      <div className="flex items-center justify-end gap-2">
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={presetChecked.sta3 ?? false}
            onChange={(e) => {
              setPresetChecked((prev) => {
                const next = { ...prev, sta3: e.target.checked };
                rebuildWithPresets(next, presetDates);
                return next;
              });
            }}
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Visa i listan över bilagor</span>
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={downloading}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px disabled:opacity-60 disabled:pointer-events-none"
        >
          {downloading ? "Skapar förhandsgranskning…" : "Intyg delmål STa3"}
        </button>
      </div>
    </div>
  );
}

/** ===================== Third Country Tab Content (2021) ===================== */
function ThirdCountryTabContent({
  profile,
  goals,
  thirdCountryMilestones,
  setThirdCountryMilestones,
  thirdCountryMilestonePickerOpen,
  setThirdCountryMilestonePickerOpen,
  thirdCountryActivities,
  setThirdCountryActivities,
  thirdCountryVerification,
  setThirdCountryVerification,
  onPreview,
}: {
  profile: Profile | null;
  goals: GoalsCatalog | null;
  thirdCountryMilestones: Set<string>;
  setThirdCountryMilestones: (v: Set<string>) => void;
  thirdCountryMilestonePickerOpen: boolean;
  setThirdCountryMilestonePickerOpen: (v: boolean) => void;
  thirdCountryActivities: string;
  setThirdCountryActivities: (v: string) => void;
  thirdCountryVerification: string;
  setThirdCountryVerification: (v: string) => void;
  onPreview: (blob: Blob) => void;
}) {
  const [downloading, setDownloading] = useState(false);

  // Konvertera Set till komma-separerad sträng för export
  const milestonesString = useMemo(() => {
    return Array.from(thirdCountryMilestones).join(", ");
  }, [thirdCountryMilestones]);

  const handleGenerate = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const { exportThirdCountryCertificate } = await import("@/lib/exporters");
      
      const blob = await exportThirdCountryCertificate(
        {
          profile: profile as any,
          delmalCodes: milestonesString,
          activitiesText: thirdCountryActivities,
          verificationText: thirdCountryVerification,
        },
        { output: "blob", filename: "intyg-bilaga13-2021.pdf" }
      );

      if (blob instanceof Blob) {
        onPreview(blob);
      }
    } catch (err) {
      console.error("exportThirdCountryCertificate error", err);
      alert("Det gick inte att skapa intyget. Kontrollera uppgifterna och försök igen.");
    } finally {
      setDownloading(false);
    }
  };

  const handleToggleMilestone = (milestoneId: string) => {
    const next = new Set<string>(thirdCountryMilestones);
    if (next.has(milestoneId)) {
      next.delete(milestoneId);
    } else {
      next.add(milestoneId);
    }
    setThirdCountryMilestones(next);
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-lg border border-slate-200 p-3">
        <label className="mb-1 block text-sm font-semibold text-slate-900">
          Delmål som intyget avser
        </label>
        <div className="space-y-2">
          {thirdCountryMilestones.size > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Array.from(thirdCountryMilestones).map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
                >
                  {code}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Inga delmål valda</p>
          )}
          <button
            type="button"
            onClick={() => setThirdCountryMilestonePickerOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px"
          >
            {thirdCountryMilestones.size > 0 ? "Ändra delmål" : "Välj delmål"}
          </button>
        </div>
      </div>

      {goals && (
        <MilestonePicker
          open={thirdCountryMilestonePickerOpen}
          title="Välj delmål för specialistläkare från tredjeland"
          goals={goals}
          checked={thirdCountryMilestones}
          onToggle={handleToggleMilestone}
          onClose={() => setThirdCountryMilestonePickerOpen(false)}
        />
      )}

      <div className="rounded-lg border border-slate-200 p-3">
        <label className="mb-1 block text-sm font-semibold text-slate-900">
          Utbildningsaktiviteter som sökanden genomfört
        </label>
        <textarea
          value={thirdCountryActivities}
          onChange={(e) => setThirdCountryActivities(e.target.value)}
          className="min-h-[200px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
        />
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <label className="mb-1 block text-sm font-semibold text-slate-900">
          Hur det kontrollerats att sökanden uppnått delmålet
        </label>
        <textarea
          value={thirdCountryVerification}
          onChange={(e) => setThirdCountryVerification(e.target.value)}
          className="min-h-[200px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={downloading}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px disabled:opacity-60 disabled:pointer-events-none"
        >
          {downloading ? "Skapar förhandsgranskning…" : "Intyg"}
        </button>
      </div>
    </div>
  );
}

/** ===================== Komponent (2021) ===================== */
export default function PrepareApplicationModal2021({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [dirty, setDirty] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  useEffect(() => {
    if (open) {
      setDirty(false);
      setShowCloseConfirm(false);
    }
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
  const [thirdCountryMilestonePickerOpen, setThirdCountryMilestonePickerOpen] = useState(false);
  const [goals, setGoals] = useState<GoalsCatalog | null>(null);

  // Baseline för dirty-tracking
  const baselineRef = useRef<any>(null);

  // Bilagor/presets
  const [paidFeeDate, setPaidFeeDate] = useState<string>(isoToday());
  const [btApprovedDate, setBtApprovedDate] = useState<string>(isoToday());
  const [presetChecked, setPresetChecked] = useState<Record<PresetKey, boolean>>({
    fullgjordST: true,  // default ikryssad
    intyg: true,  // default ikryssad
    sta3: false,
    svDoc: false,
    foreignDocEval: false,
    foreignService: false,
    thirdCountry: false,
    individProg: false,
  });
  const [presetDates, setPresetDates] = useState<Record<PresetKey, string>>({
    fullgjordST: isoToday(),
    intyg: isoToday(),
    sta3: isoToday(),
    svDoc: isoToday(),
    foreignDocEval: isoToday(),
    foreignService: isoToday(),
    thirdCountry: isoToday(),
    individProg: isoToday(),
  });
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [userReordered, setUserReordered] = useState(false);

  // Funktionshjälp för att få bilagnamn för 2021
  const getBilagaName2021 = (type: AttachGroup): string => {
    const bilagaMap: Record<string, string> = {
      "Fullgjord specialiseringstjänstgöring": "HSLF-FS 2021:8 - Bilaga 6",
      "Uppnådd specialistkompetens": "HSLF-FS 2021:8 - Bilaga 7",
      "Auskultationer": "HSLF-FS 2021:8 - Bilaga 8",
      "Kliniska tjänstgöringar under handledning": "HSLF-FS 2021:8 - Bilaga 9",
      "Vetenskapligt arbete": "HSLF-FS 2021:8 - Bilaga 9", // Samma bilaga som Kliniska tjänstgöringar
      "Kurser": "HSLF-FS 2021:8 - Bilaga 10",
      "Utvecklingsarbete": "HSLF-FS 2021:8 - Bilaga 11",
      "Delmål STa3": "HSLF-FS 2021:8 - Bilaga 12",
      "Medicinsk vetenskap": "HSLF-FS 2021:8 - Bilaga 12",
      "Delmål för specialistläkare från tredjeland": "HSLF-FS 2021:8 - Bilaga 13",
      "Svensk doktorsexamen": "Övriga handlingar",
      "Utländsk doktorsexamen": "Övriga handlingar",
      "Utländsk tjänstgöring": "Övriga handlingar",
      "Individuellt utbildningsprogram för specialistläkare från tredjeland": "Övriga handlingar",
    };
    return bilagaMap[type] || "";
  };

  // Funktionshjälp för att formatera label baserat på typ (liknande 2015)
  const formatAttachmentLabel2021 = (item: AttachmentItem): string => {
    const type = item.type;
    const currentLabel = item.label || "";

    // För vetenskapligt arbete, bara typnamnet
    if (type === "Vetenskapligt arbete") {
      return "Vetenskapligt arbete";
    }

    // För utvecklingsarbete
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
  const getBilagaNumber2021 = (type: AttachGroup): { num: number; sub: string } => {
    const bilagaName = getBilagaName2021(type);
    if (!bilagaName || bilagaName === "Övriga handlingar") return { num: 9999, sub: "" };
    
    const match = bilagaName.match(/Bilaga\s+(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      return { num, sub: "" };
    }
    return { num: 9999, sub: "" };
  };

  // Sorteringsfunktion baserad på bilagnummer
  const sortByBilagaNumber2021 = useCallback((a: AttachmentItem, b: AttachmentItem): number => {
    const numA = getBilagaNumber2021(a.type);
    const numB = getBilagaNumber2021(b.type);
    
    if (numA.num !== numB.num) {
      return numA.num - numB.num;
    }
    
    return GROUP_ORDER.indexOf(a.type) - GROUP_ORDER.indexOf(b.type);
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

  // Säkerställ att presets finns i bilagelistan när de är ikryssade
  useEffect(() => {
    if (!open) return;
    // Vänta tills attachments har laddats innan vi kör rebuildWithPresets
    if (attachments.length === 0) return;
    
    // Använd rebuildWithPresets för att säkerställa att alla ikryssade presets finns i listan
    rebuildWithPresets(presetChecked, presetDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetChecked, presetDates, attachments.length]);

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
                mainSupervisor: {
                  ...(savedCert.mainSupervisor || prev.mainSupervisor),
                  name: "",
                },
                certifyingSpecialist: {
                  name: savedCert.certifyingSpecialist?.name || prev.certifyingSpecialist?.name || "",
                  specialty: savedCert.certifyingSpecialist?.specialty || prev.certifyingSpecialist?.specialty || "",
                  workplace: savedCert.certifyingSpecialist?.workplace || prev.certifyingSpecialist?.workplace || "",
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

          // Datum för godkänd BT
          if (typeof saved.btApprovedDate === "string" && saved.btApprovedDate) {
            setBtApprovedDate(saved.btApprovedDate);
          }

          // Preset-kryss
          if (saved.presetChecked) {
            const savedPresetChecked = saved.presetChecked as Record<PresetKey, boolean>;
            // Säkerställ att alla nycklar finns, inklusive sta3 som kan saknas i äldre sparad data
            setPresetChecked({
              fullgjordST: savedPresetChecked.fullgjordST ?? true,
              intyg: savedPresetChecked.intyg ?? true,
              sta3: savedPresetChecked.sta3 ?? false,
              svDoc: savedPresetChecked.svDoc ?? false,
              foreignDocEval: savedPresetChecked.foreignDocEval ?? false,
              foreignService: savedPresetChecked.foreignService ?? false,
              thirdCountry: savedPresetChecked.thirdCountry ?? false,
              individProg: savedPresetChecked.individProg ?? false,
            });
          }

          // Preset-datum
          if (saved.presetDates) {
            hadSavedPresetDates = true;
            const savedPresetDates = saved.presetDates as Record<PresetKey, string>;
            // Säkerställ att alla nycklar finns, inklusive sta3 som kan saknas i äldre sparad data
            setPresetDates({
              fullgjordST: savedPresetDates.fullgjordST ?? isoToday(),
              intyg: savedPresetDates.intyg ?? isoToday(),
              sta3: savedPresetDates.sta3 ?? isoToday(),
              svDoc: savedPresetDates.svDoc ?? isoToday(),
              foreignDocEval: savedPresetDates.foreignDocEval ?? isoToday(),
              foreignService: savedPresetDates.foreignService ?? isoToday(),
              thirdCountry: savedPresetDates.thirdCountry ?? isoToday(),
              individProg: savedPresetDates.individProg ?? isoToday(),
            });
          }

          // STa3 data
          if (typeof saved.sta3OtherText === "string") {
            setSta3OtherText(saved.sta3OtherText);
          }
          if (typeof saved.sta3HowVerifiedText === "string") {
            setSta3HowVerifiedText(saved.sta3HowVerifiedText);
          }

          // Third country data
          if (typeof saved.thirdCountryDelmalCodes === "string") {
            setThirdCountryDelmalCodes(saved.thirdCountryDelmalCodes);
            // Konvertera från komma-separerad sträng till Set
            if (saved.thirdCountryDelmalCodes) {
              const codes = saved.thirdCountryDelmalCodes.split(",").map((c: string) => c.trim()).filter(Boolean);
              setThirdCountryMilestones(new Set(codes));
            }
          }
          if (typeof saved.thirdCountryActivities === "string") {
            setThirdCountryActivities(saved.thirdCountryActivities);
          }
          if (typeof saved.thirdCountryVerification === "string") {
            setThirdCountryVerification(saved.thirdCountryVerification);
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

      // Ladda goals-katalog för MilestonePicker
      if (p?.goalsVersion && (p.specialty || (p as any).speciality)) {
        try {
          const g = await loadGoals(p.goalsVersion, p.specialty || (p as any).speciality || "");
          setGoals(g);
        } catch {
          setGoals(null);
        }
      } else {
        setGoals(null);
      }

      // Endast för 2021: filtrera fram ST-fasade eller de som markerats "Uppfyller ST-delmål"
      const gvRaw = String((p as any)?.goalsVersion || "").toLowerCase();
      const is2021 = gvRaw.includes("2021");

      // Beräkna BT-slutdatum från profil (btEndDate eller 24 månader efter btStartDate)
      if (p && is2021) {
        const btEndManual = (p as any)?.btEndDate;
        const btStartISO = (p as any)?.btStartDate;
        
        let calculatedBtEnd: string | null = null;
        if (btEndManual && /^\d{4}-\d{2}-\d{2}$/.test(btEndManual)) {
          calculatedBtEnd = btEndManual;
        } else if (btStartISO && /^\d{4}-\d{2}-\d{2}$/.test(btStartISO)) {
          try {
            const btDate = new Date(btStartISO + "T00:00:00");
            const btEndDate = addMonths(btDate, 24);
            calculatedBtEnd = toISO(btEndDate);
          } catch {
            // Ignore
          }
        }
        
        // Sätt BT-godkänd datum om det inte redan är sparat
        if (calculatedBtEnd && !saved?.btApprovedDate) {
          setBtApprovedDate(calculatedBtEnd);
        }
      }

      // Bygg bilagelista från DB-data (och komplettera ev. sparad lista)
      const allPlacements = (pls || []) as any[];
      const allCourses = (crs || []) as any[];

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

           const built: AttachmentItem[] = buildDefaultAttachmentsFor2021({
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
        if (presetChecked.fullgjordST) {
          list.push({
            id: "preset-fullgjordST",
            type: "Fullgjord specialiseringstjänstgöring",
            label: "Intyg om fullgjord specialiseringstjänstgöring",
            date: presetDates.fullgjordST || isoToday(),
            preset: "fullgjordST",
          });
        }

        if (presetChecked.intyg) {
          list.push({
            id: "preset-intyg",
            type: "Uppnådd specialistkompetens",
            label: "Uppnådd specialistkompetens",
            date: presetDates.intyg || isoToday(),
            preset: "intyg",
          });
        }

        if (presetChecked.sta3) {
          list.push({
            id: "preset-sta3",
            type: "Delmål STa3",
            label: "Intyg delmål STa3",
            date: presetDates.sta3 || isoToday(),
            preset: "sta3",
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

        if (presetChecked.thirdCountry) {
          list.push({
            id: "preset-thirdCountry",
            type: "Delmål för specialistläkare från tredjeland",
            label: "Delmål för specialistläkare från tredjeland",
            date: presetDates.thirdCountry || isoToday(),
            preset: "thirdCountry",
          });
        }

        if (presetChecked.individProg) {
          list.push({
            id: "preset-individProg",
            type: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
            label: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
            date: presetDates.individProg || isoToday(),
            preset: "individProg",
          });
        }

        // Säkerställ att "Fullgjord specialiseringstjänstgöring" alltid hamnar först
        const fullgjordST = list.filter((a) => a.type === "Fullgjord specialiseringstjänstgöring");
        const rest = list.filter((a) => a.type !== "Fullgjord specialiseringstjänstgöring");
        
        // Sortera med sortByBilagaNumber2021 istället för GROUP_ORDER för att få korrekt ordning
        const finalList = [...fullgjordST, ...rest.slice().sort(sortByBilagaNumber2021)];

        setAttachments(finalList);
        setTempOrder(finalList);
      }







      // Sätt default för ort/datum-fält ENDAST om vi INTE hade sparade datum
          if (!hadSavedPresetDates) {
            setPresetDates({
              fullgjordST: isoToday(),
              intyg: isoToday(),
              sta3: isoToday(),
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
        },
        managerSelf: {
          ...prev.managerSelf,
          workplace: prev.managerSelf.workplace || (p as any)?.homeClinic || "",
          specialty: prev.managerSelf.specialty || (p as any)?.specialty || (p as any)?.speciality || "",
        },
        managerAppointed: {
          ...prev.managerAppointed,
          managerWorkplace:
            prev.managerAppointed.managerWorkplace || (p as any)?.homeClinic || "",
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


/** ===================== ReadonlyInput ===================== */
function ReadonlyInput({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-sm text-slate-700">{label}</label>
      <div
        className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-[14px] text-slate-700 cursor-help"
        aria-readonly="true"
        role="textbox"
        title="Uppgifterna ändras i Profil"
      >
        <span className="whitespace-normal break-words">
          {value || "—"}
        </span>
      </div>
    </div>
  );
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

  // Ta baseline efter att allt är initierat
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      takeBaseline();
    }, 200);
    return () => clearTimeout(timer);
  }, [open, profile, placements.length, courses.length]);

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







  /** ===================== Presets ===================== */
  function rebuildWithPresets(nextChecked: Record<PresetKey, boolean>, nextDates: Record<PresetKey, string>) {
    // Använd funktionell uppdatering för att få senaste attachments
    setAttachments((currentAttachments) => {
      const base = currentAttachments.filter((x) => !x.preset);
      const list: AttachmentItem[] = [];

      if (nextChecked.fullgjordST) {
        list.push({
          id: "preset-fullgjordST",
          type: "Fullgjord specialiseringstjänstgöring",
          label: "Intyg om fullgjord specialiseringstjänstgöring",
          date: nextDates.fullgjordST || isoToday(),
          preset: "fullgjordST",
        });
      }

      if (nextChecked.intyg) {
        list.push({
          id: "preset-intyg",
          type: "Uppnådd specialistkompetens",
          label: "Uppnådd specialistkompetens",
          date: nextDates.intyg || isoToday(),
          preset: "intyg",
        });
      }

      if (nextChecked.sta3) {
        list.push({
          id: "preset-sta3",
          type: "Delmål STa3",
          label: "Intyg delmål STa3",
          date: nextDates.sta3 || isoToday(),
          preset: "sta3",
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

      if (nextChecked.thirdCountry) {
        list.push({
          id: "preset-thirdCountry",
          type: "Delmål för specialistläkare från tredjeland",
          label: "Delmål för specialistläkare från tredjeland",
          date: nextDates.thirdCountry || isoToday(),
          preset: "thirdCountry",
        });
      }

      if (nextChecked.individProg) {
        list.push({
          id: "preset-individProg",
          type: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
          label: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
          date: nextDates.individProg || isoToday(),
          preset: "individProg",
        });
      }

      // Säkerställ att "Fullgjord specialiseringstjänstgöring" alltid hamnar först
      const fullgjordST = list.filter((a) => a.type === "Fullgjord specialiseringstjänstgöring");
      const rest = list.filter((a) => a.type !== "Fullgjord specialiseringstjänstgöring");
      
      const finalList = userReordered
        ? [...fullgjordST, ...rest] // Alltid först även vid manuell omordning
        : [...fullgjordST, ...rest.slice().sort(sortByBilagaNumber2021)]; // Sortera resten
      
      return finalList;
    });
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
      btApprovedDate,
      presetChecked: structuredClone(presetChecked),
      presetDates: structuredClone(presetDates),
      tab,
      userReordered,
      sta3OtherText,
      sta3HowVerifiedText,
      thirdCountryDelmalCodes: Array.from(thirdCountryMilestones).join(", "), // Konvertera Set till sträng för sparning
      thirdCountryActivities,
      thirdCountryVerification,
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
    setBtApprovedDate(b.btApprovedDate ?? isoToday());
    setPresetChecked(b.presetChecked);
    setPresetDates(b.presetDates);
    setTab(b.tab);
    setUserReordered(b.userReordered);
    setSta3OtherText(b.sta3OtherText);
    setSta3HowVerifiedText(b.sta3HowVerifiedText);
    setThirdCountryDelmalCodes(b.thirdCountryDelmalCodes);
    // Konvertera från sträng till Set
    if (b.thirdCountryDelmalCodes) {
      const codes = b.thirdCountryDelmalCodes.split(",").map((c: string) => c.trim()).filter((c: string) => Boolean(c));
      setThirdCountryMilestones(new Set<string>(codes));
    } else {
      setThirdCountryMilestones(new Set<string>());
    }
    setThirdCountryActivities(b.thirdCountryActivities);
    setThirdCountryVerification(b.thirdCountryVerification);
  };

  /** Stäng med varning och ev. rollback */
  const handleRequestClose = () => {
    if (!dirty) {
      onClose();
      return;
    }
    // Visa egen bekräftelsedialog istället för window.confirm()
    setShowCloseConfirm(true);
  };

  const handleConfirmClose = () => {
    restoreBaseline(); // rulla tillbaka
    setDirty(false);
    setShowCloseConfirm(false);
    onClose();
  };

  const handleSaveAndClose = async () => {
    await handleSaveAll();
    setShowCloseConfirm(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowCloseConfirm(false);
  };

  /** ===================== Persistens ===================== */
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
      // STa3 data
      sta3OtherText,
      sta3HowVerifiedText,
      // Third country data
      thirdCountryDelmalCodes: Array.from(thirdCountryMilestones).join(", "), // Konvertera Set till sträng för sparning
      thirdCountryActivities,
      thirdCountryVerification,
      savedAt: new Date().toISOString(),
      version: 8,
    };
    try {
      await (db as any).specialistApplication?.put?.(payload);
      localStorage.setItem(COLORMAP_KEY, JSON.stringify(GROUP_COLORS));
      takeBaseline(); // Spara ny baseline efter sparning
      setDirty(false);
    } catch (err) {
      console.error("Kunde inte spara specialistansökan:", err);
    }
  }, [placements, courses, applicant, cert, attachments, paidFeeDate, presetChecked, presetDates, tab, userReordered, sta3OtherText, sta3HowVerifiedText, thirdCountryMilestones, thirdCountryActivities, thirdCountryVerification]);

  /** ESC för att stänga, Cmd/Ctrl+Enter för att spara */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { 
      // Om bekräftelsedialogen är öppen, låt den hantera ALLA keyboard events
      if (showCloseConfirm) {
        // UnsavedChangesDialog hanterar keyboard events och stoppar propagation
        return;
      }
      
      if (e.key === "Escape") {
        // Stoppa ESC-eventet helt innan vi gör något annat
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Anropa handleRequestClose direkt - den visar bekräftelsedialogen
        handleRequestClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void handleSaveAll();
      }
    };
    // Använd capture-fas för att fånga ESC innan andra listeners
    // Lägg till listener tidigt i capture-fasen för att säkerställa att vi fångar ESC först
    window.addEventListener("keydown", onKey, { capture: true, passive: false });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, handleRequestClose, showCloseConfirm, handleCancelClose, dirty, handleSaveAll]);

  /** Uppdatera dirty-status baserat på baseline */
  useEffect(() => {
    if (!open || !baselineRef.current) return;
    const b = baselineRef.current;
    const cur = currentSnapshot();
    try {
      const isDirty = JSON.stringify(cur) !== JSON.stringify(b);
      setDirty(isDirty);
    } catch {
      setDirty(true);
    }
  }, [
    open,
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
    thirdCountryMilestones,
    thirdCountryActivities,
    thirdCountryVerification,
  ]);

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
            { id: "signers",     label: "Intygande personer" },
            { id: "sta3",        label: "Delmål STa3" }, // STa3 finns i 2021
            ...((profile as any)?.isThirdCountrySpecialist ? [{ id: "thirdCountry", label: "Specialistläkare från tredje land" }] : []),
            { id: "attachments", label: "Ordna bilagor" },
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
              placements={placements}
              courses={courses}
              sta3OtherText={sta3OtherText}
              setSta3OtherText={setSta3OtherText}
              sta3HowVerifiedText={sta3HowVerifiedText}
              setSta3HowVerifiedText={setSta3HowVerifiedText}
              onPreview={(blob) => openPreviewFromBlob(blob)}
              presetChecked={presetChecked}
              presetDates={presetDates}
              setPresetChecked={setPresetChecked}
              rebuildWithPresets={rebuildWithPresets}
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
                      <div ref={(el) => (rowRefs.current[idx] = el)} className="mb-1 grid grid-cols-[48px_1fr] gap-2">
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
                  <label className="inline-flex items-center gap-2 text-[13px]">
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
                  <label className="inline-flex items-center gap-2 text-[13px]">
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
                  <label className="inline-flex items-center gap-2 text-[13px]">
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
                    <label className="inline-flex items-center gap-2 text-[13px]">
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
                    return (
                      <div key={k} className="mb-2 grid grid-cols-[minmax(0,1fr)_220px] items-center gap-2">
                        <label className="inline-flex items-center gap-2 text-[13px]">
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
            >
              Intyg fullgjord ST
            </button>
            <button
              onClick={onPrintIntyg}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            >
              Intyg uppnådd ST
            </button>
            <button
              onClick={onPrintAnsokan}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
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

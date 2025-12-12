// components/PusslaDinST.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { liveQuery } from "dexie";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import CoursePrepModal from "@/components/CoursePrepModal";
import Sta3PrepModal from "@/components/Sta3PrepModal";
import ReportPrintModal from "@/components/ReportPrintModal";
import IupModal from "@/components/IupModal";


import type { GoalsCatalog } from "@/lib/goals";
import { loadGoals } from "@/lib/goals";
import { btMilestones, type BtMilestone } from "@/lib/goals-bt";
import { exportCertificate, exportSta3Certificate } from "@/lib/exporters";

import dynamic from "next/dynamic";
const ScanIntygModal = dynamic(() => import("@/components/ScanIntygModal"), { ssr: false });
const DesktopMilestonePicker = dynamic(() => import("@/components/DesktopMilestonePicker"), { ssr: false });
const DesktopBtMilestonePicker = dynamic(() => import("@/components/DesktopBtMilestonePicker"), { ssr: false });

const PrepareApplicationModal = dynamic(() => import("@/components/PrepareApplicationModal"), { ssr: false });
const PrepareBtModal = dynamic(() => import("@/components/PrepareBtModal"), { ssr: false });
const ProfileModal = dynamic(() => import("@/components/ProfileModal"), { ssr: false });
const MilestoneOverviewModal = dynamic(
  () => import("@/components/MilestoneOverviewModal"),
  { ssr: false }
);






/**
 * Pussla din ST – tidslinje med persistens + registrering
 * - Draft: sparas i localStorage
 * - Låsta objekt från DB (Placeringar/Kurser) där showOnTimeline = true
 * - "Registrera" → förifyllt formulär på rätt sida
 * - "Lås upp" → varning → timeline-ändringar skriver tillbaka till DB
 */

// ---- visuella konstanter för plan-gränser ----
const START_LINE_COLOR = "#0f766e"; // mörkt, lite grågrönt (teal-700-ish) — BT-start
const MID_LINE_COLOR   = "#ca8a04"; // gul (amber-600) — ST-start
const END_LINE_COLOR   = "#b91c1c"; // modern röd (red-700) — ST-slut
const TODAY_LINE_COLOR = "#2563eb"; // blå linje — Idag

const OUTSIDE_BG_CELL =
  "bg-[repeating-linear-gradient(135deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_8px)]"; // diskret diagonalskuggning
const INSIDE_BG_CELL = "bg-white";
const OUTSIDE_BG_LANE =
  "bg-[repeating-linear-gradient(135deg,#eef2f7,#eef2f7_6px,#e6ebf2_6px,#e6ebf2_8px)]";
// lite mörkare grundfärg i kurs-lane
const INSIDE_BG_LANE = "bg-slate-100";

// ---- typer (lokala) ----
type ActivityType =
  | "Klinisk tjänstgöring"
  | "Vetenskapligt arbete"
  | "Förbättringsarbete"
  | "Auskultation"
  | "Forskning"
  | "Tjänstledighet"
  | "Föräldraledighet"
  | "Annan ledighet"
  | "Sjukskriven";

interface Activity {
  id: string;
  type: ActivityType;
  label?: string;          // Placering/Titel/Beskrivning enligt typ
  startSlot: number;       // global halvmånads-slot (0 = startåret Jan H1)
  lengthSlots: number;     // i halvmånader
  hue: number;
  phase?: "BT" | "ST";     // ← NYTT: fas

  // Formulärfält (sparas lokalt, används i listan/popup)
  attendance?: number;     // Sysselsättningsgrad %
  supervisor?: string;
  supervisorSpeciality?: string;
  supervisorSite?: string;
  note?: string;           // Beskrivning
  leaveSubtype?: string;   // Endast "Annan ledighet"
  exactStartISO?: string;  // EXAKT valt startdatum (förändras inte av snapping)
  exactEndISO?: string;    // EXAKT valt slutdatum (förändras inte av snapping)

  // Koppling mot DB (för radering/synk), men utan låslogik
  linkedPlacementId?: string;
}




type CourseKind = "Kurs" | "Konferens" | "Annat";
interface TLcourse {
  id: string;
  title: string;
  kind: CourseKind;

  // Formulärfält
  city?: string;
  courseLeaderName?: string;
  startDate?: string;
  endDate?: string;   // (2015) slut = punkt för kurs i tidslinjen
  certificateDate?: string;
  note?: string;

  // Om kursen ska visas som intervall (psykoterapi-logiken) i tidslinjen
  showAsInterval?: boolean;

  // Fas + BT/ST-delmål
  phase?: "BT" | "ST";
  btMilestones?: string[];
  fulfillsStGoals?: boolean;
  milestones?: string[];
  btAssessment?: string;

  // Koppling mot DB (för radering/synk), men utan låslogik
  linkedCourseId?: string;
}


type SupervisionSession = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  title?: string;
};

type AssessmentSession = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  title?: string;
};






// ---- verktyg ----

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
const COLS = 24;

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const slotsPerYear = () => 24;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const uid = () => Math.random().toString(36).slice(2, 10);
const nextHue = (i: number) => (i * 37) % 360;

const isLeave = (t: ActivityType) =>
  t === "Tjänstledighet" ||
  t === "Föräldraledighet" ||
  t === "Annan ledighet" ||
  t === "Sjukskriven";

const isZeroAttendanceType = (t: ActivityType) =>
  t === "Forskning" || isLeave(t);



function isValidISO(dateISO: string) {
  if (!dateISO) return false;
  const d = new Date(dateISO + "T00:00:00");
  return !isNaN(d.getTime());
}
function dateToISO(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function isoToDateSafe(iso: string) {
  return new Date(iso + "T00:00:00");
}


// slot helpers
const slotToYearMonthHalf = (startYear: number, slot: number) => {
  const yearOffset = Math.floor(slot / slotsPerYear());
  const inYear = slot % slotsPerYear();
  const month0 = Math.floor(inYear / 2);
  const half = (inYear % 2) as 0 | 1; // 0: början (1:a), 1: mitten (15:e)
  return { year: startYear + yearOffset, month0, half };
};
// Start och slut avrundas olika:
// - mode: "start" → 1–7⇒H1, 8–23⇒H2, 24–EOM⇒nästa månads H1
// - mode: "end"   → 1–14⇒H1, 15–EOM⇒H2 (och EOM→nästa månads H1)
const dateToSlot = (
  startYear: number,
  dISO: string,
  mode: "start" | "end" = "start"
) => {
  if (!isValidISO(dISO)) return Number.POSITIVE_INFINITY;
  const d = new Date(dISO + "T00:00:00");
  let y = d.getFullYear();
  let m0 = d.getMonth();
  const day = d.getDate();

  if (mode === "end") {
    if (day <= 7) {
      return (y - startYear) * slotsPerYear() + m0 * 2 + 0;
    } else if (day <= 22) {
      return (y - startYear) * slotsPerYear() + m0 * 2 + 1;
    } else {
      m0 += 1;
      if (m0 >= 12) { m0 = 0; y += 1; }
      return (y - startYear) * slotsPerYear() + m0 * 2 + 0;
    }
  }

  if (day <= 7) {
    return (y - startYear) * slotsPerYear() + m0 * 2 + 0; // H1
  } else if (day <= 22) {
    return (y - startYear) * slotsPerYear() + m0 * 2 + 1; // H2
  } else {
    m0 += 1; if (m0 >= 12) { m0 = 0; y += 1; }
    return (y - startYear) * slotsPerYear() + m0 * 2 + 0; // H1
  }
};

// Core-funktioner utan beroenden på komponent-state
function phaseForSlotsCore(
  startYear: number,
  btISO: string | null,
  stISO: string | null,
  startSlot: number,
  lengthSlots: number
): "BT" | "ST" {
  if (!btISO || !stISO) return "ST";
  const btSlot = dateToSlot(startYear, btISO, "start");
  const stSlot = dateToSlot(startYear, stISO, "start");
  const a0 = startSlot;
  const a1 = startSlot + Math.max(1, lengthSlots);
  return (a0 >= btSlot && a1 <= stSlot) ? "BT" : "ST";
}

function phaseForCourseDatesCore(
  startYear: number,
  btISO: string | null,
  btEndISO: string | null,
  startISO?: string
): "BT" | "ST" {
  // Kräver kursens startdatum och profilens BT-slut
  if (!startISO || !isValidISO(startISO)) return "ST";
  if (!btEndISO || !isValidISO(btEndISO)) return "ST";

  // Om BT-start saknas eller är ogiltig: behandla kurser som ST
  if (!btISO || !isValidISO(btISO)) return "ST";

  // Jämför faktiska ISO-datum (YYYY-MM-DD) i stället för slots
  const courseStart = startISO;
  const btEnd = btEndISO;

  // Kursen är BT om startdatum är på eller före BT-slut, annars ST
  return courseStart > btEnd ? "ST" : "BT";
}






// måndag PÅ ELLER EFTER given dag i samma månad (alltid framåt)
// exempel: 2 sep (tis) → 8 sep (mån)
function mondayOnOrAfter(year: number, month0: number, day: number) {
  const d = new Date(year, month0, day);
  while (d.getMonth() === month0 && d.getDay() !== 1) {
    d.setDate(d.getDate() + 1);
  }
  if (d.getMonth() !== month0) return new Date(year, month0, 1);
  return d;
}

// söndag NÄRMAST given dag i månad (klampar in i månaden)
// närmaste SÖNDAG inom samma månad, runt given dag
function sundayOnOrBefore(year: number, month0: number, day: number) {
  const target = new Date(year, month0, day);

  // kandidat A: söndag på/efter anchor (stanna om månaden byts)
  const after = new Date(target);
  while (after.getMonth() === month0 && after.getDay() !== 0) {
    after.setDate(after.getDate() + 1);
  }
  const candA = (after.getMonth() === month0 && after.getDay() === 0) ? new Date(after) : null;

  // kandidat B: söndag på/innan anchor (stanna om månaden byts)
  const before = new Date(target);
  while (before.getMonth() === month0 && before.getDay() !== 0) {
    before.setDate(before.getDate() - 1);
  }
  const candB = (before.getMonth() === month0 && before.getDay() === 0) ? new Date(before) : null;

  if (candA && candB) {
    return Math.abs(+candA - +target) <= Math.abs(+candB - +target) ? candA : candB;
  }
  return candA || candB || new Date(year, month0 + 1, 0);
}


// halvmånads mittdatum (7:e / 21:a) – används för kurspills default
const halfMidDateISO = (year: number, month0: number, half: 0 | 1) => {
  const day = half === 0 ? 7 : 21;
  const d = new Date(year, month0, day);
  const targetMonth = month0;
  while (d.getMonth() !== targetMonth) d.setDate(d.getDate() - 1);
  return dateToISO(d);
};
const dayOfYear = (d: Date) => {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((+d - +start) / 86400000);
};
const daysInYear = (year: number) =>
  (new Date(year, 1, 29).getMonth() === 1) ? 366 : 365;

// ---- FTE/kalendertid-hjälpare (synk med Placeringar) ----
function addMonths(d: Date, months: number) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const whole = Math.trunc(months);
  const frac = months - whole;
  // lägg hela månader
  const base = new Date(y, m + whole, day);
  // lägg fraktion som proportion av nästa månad
  if (frac !== 0) {
    const next = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());
    const diffMs = +next - +base;
    base.setTime(+base + diffMs * frac);
  }
  return base;
}

function nextSundayOnOrAfter(d: Date) {
  const res = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const w = res.getDay(); // 0=sön
  const add = (7 - w) % 7;
  res.setDate(res.getDate() + add);
  return res;
}

// ---- tolerant jämförelse för att ersätta draft med låst DB-post ----

// ---- tolerant jämförelse för att ersätta draft med låst DB-post ----

/** Runtime-fasberäkning (används när användaren drar/ändrar) */
/** ENDA styrande fönstret för BT är [BT-start, BT-slut) */
function inferPhaseByBTRuntime(
  startISO?: string,
  endISO?: string,
  prof?: any,
  _stStart?: string | null
): "BT" | "ST" {
  const gv = normalizeGoalsVersion((prof as any)?.goalsVersion);
  if (gv !== "2021") return "ST";

  const btStartISO: string | null = (prof as any)?.btStartDate || null;
  if (!btStartISO || !isValidISO(btStartISO)) return "ST";

  // Slutdatum för BT från profilen (fältet längst ned på sidan),
  // annars automatiskt 24 månader efter BT-start.
  const btEndManual: string | null = (prof as any)?.btEndDate || null;
  let btEndISO: string | null = null;

  if (btEndManual && isValidISO(btEndManual)) {
    btEndISO = btEndManual;
  } else {
    try {
      const btDate = isoToDateSafe(btStartISO);
      const autoEnd = addMonths(btDate, 24);
      btEndISO = dateToISO(autoEnd);
    } catch {
      return "ST";
    }
  }

  if (!btEndISO || !isValidISO(btEndISO)) return "ST";

  const btStartMs = Date.parse(btStartISO + "T00:00:00");
  const btEndMs   = Date.parse(btEndISO + "T00:00:00");

  // För kurser använder vi ENBART slutdatum som referens.
  const refISO = endISO || startISO;
  if (!refISO || !isValidISO(refISO)) return "ST";
  const endMs = Date.parse(refISO + "T00:00:00");

  if (!Number.isFinite(btStartMs) || !Number.isFinite(btEndMs) || !Number.isFinite(endMs)) {
    return "ST";
  }

  // BT om kursens (slut)datum ligger inom BT-fönstret, annars ST.
  return endMs >= btStartMs && endMs < btEndMs ? "BT" : "ST";
}

// Hjälpare: sortera BT-/ST-delmål i fast ordning i detaljrutan
// BT1–BT18, sedan STa1–STc14 (eller a1–c14 i 2015-spåret)
function sortMilestoneIds(ids: string[]): string[] {
  const norm = (v: string) => String(v ?? "").trim();
  const letterRank: Record<string, number> = { A: 1, B: 2, C: 3 };

  const key = (raw: string) => {
    const id = norm(raw);
    const up = id.toUpperCase().replace(/\s/g, "");

    let m = up.match(/^BT(\d+)$/);
    if (m) {
      return { cat: 0, letter: 0, num: parseInt(m[1], 10) || 0, raw: up };
    }

    m = up.match(/^ST([A-Z])(\d+)$/);
    if (m) {
      const letter = m[1];
      return {
        cat: 1,
        letter: letterRank[letter] ?? 99,
        num: parseInt(m[2], 10) || 0,
        raw: up,
      };
    }

    m = up.match(/^([A-Z])(\d+)$/);
    if (m) {
      const letter = m[1];
      return {
        cat: 2,
        letter: letterRank[letter] ?? 99,
        num: parseInt(m[2], 10) || 0,
        raw: up,
      };
    }

    return { cat: 9, letter: 99, num: 0, raw: up };
  };

  return [...(ids || [])].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);

    if (ka.cat !== kb.cat) return ka.cat - kb.cat;
    if (ka.letter !== kb.letter) return ka.letter - kb.letter;
    if (ka.num !== kb.num) return ka.num - kb.num;
    return ka.raw.localeCompare(kb.raw);
  });
}



// Hjälpare: normalisera målversion så exportern får "2015" eller "2021"

function normalizeGoalsVersion(v: any): "2015" | "2021" {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("2015")) return "2015";
  if (s.includes("2021")) return "2021";
  // fallback – om okänt, anta 2021 (hellre nyare blanketter)
  return "2021";
}

// Hämta profil on-demand om den inte finns i state än
async function ensureProfile(cur: any): Promise<any | null> {
  if (cur) return cur;
  try {
    const arr = await (db as any).profile?.toArray?.();
    const p = Array.isArray(arr) ? arr[0] : null;
    return p ?? null;
  } catch {
    return null;
  }
}

const norm = (s?: string) => (s || "").trim().toLowerCase();
const labelsMatch = (a?: string, b?: string) => {
  const A = norm(a), B = norm(b);
  if (!A || !B) return true; // tomt label i draft får matcha
  return A === B;
};
const overlapLen = (a0: number, a1: number, b0: number, b1: number) =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const overlapsWell = (aStart: number, aLen: number, bStart: number, bLen: number) => {
  const a0 = aStart, a1 = aStart + aLen;
  const b0 = bStart, b1 = bStart + bLen;
  const ol = overlapLen(a0, a1, b0, b1);
  const minLen = Math.max(1, Math.min(aLen, bLen));
  return ol >= Math.ceil(minLen * 0.6); // minst ~60% överlapp
};

// ---- localStorage ----
const LS_KEY = "pdst_v1";

function GapWarnings({
  startYear,
  activities,
  dismissedGaps,
  onDismiss,
}: {
  startYear: number;
  activities: any[];      // Activity: { id, title?, type/kind, startSlot, lengthSlots }
  dismissedGaps: string[];
  onDismiss: (id: string) => void;
}) {
  // slot → {year, month0, half} (24 slots/år: 2/ månad)
  const slotToYMH = (startYear: number, slot: number) => {
    const yearOffset = Math.floor(slot / 24);
    const inYear     = slot % 24;
    const month0     = Math.floor(inYear / 2);
    const half       = inYear % 2;
    return { year: startYear + yearOffset, month0, half };
  };
  // Mitten-datum per halva (svenska datum)
  const halfMidDateSV = (year: number, month0: number, half: number) => {
    const day = half === 0 ? 7 : 21;
    const d = new Date(year, month0, day);
    return d.toLocaleDateString("sv-SE");
  };

  // Endast utbildningsaktiviteter (ej kurser/konferenser)
  const isEducational = (a: any) => {
    const t = String(a.type ?? a.kind ?? "").toLowerCase();
    return !(t.includes("kurs") || t.includes("konferens"));
  };

  const indexById = new Map<string, any>();
  activities.forEach(a => indexById.set(a.id, a));


// Sortera i tid och hitta glapp mellan slutet av A och starten av B
const edus = activities
  .filter(isEducational)
  .map(a => ({ id: a.id, start: a.startSlot, end: a.startSlot + a.lengthSlots }))
  .sort((A, B) => A.start - B.start);

function sigOf(aId: string) {
  const a = indexById.get(aId)!;
  return `${a.id}|${a.type}|${a.startSlot}|${a.lengthSlots}`;
}


const gaps: { id: string; fromSlot: number; toSlot: number; leftId: string; rightId: string }[] = [];
for (let i = 0; i < edus.length - 1; i++) {
  const cur = edus[i], nxt = edus[i + 1];
  if (nxt.start > cur.end) {
    const id = `${sigOf(cur.id)}→${sigOf(nxt.id)}`;
    gaps.push({ id, fromSlot: cur.end, toSlot: nxt.start, leftId: cur.id, rightId: nxt.id });
  }
}


  const visible = gaps.filter(g => !dismissedGaps.includes(g.id));
  if (visible.length === 0) return null;

  const slotToSV = (slot: number) => {
    const ymh = slotToYMH(startYear, slot);
    return halfMidDateSV(ymh.year, ymh.month0, ymh.half);
  };
  const labelOf = (id: string) => {
    const a = indexById.get(id);
    const t = String(a?.type ?? a?.kind ?? "").trim();
    const title = String(a?.title ?? "").trim();
    return title || t || id;
  };

  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
      <div className="mb-2 font-semibold">Varning: glapp mellan utbildningsaktiviteter</div>
      <ul className="space-y-1">
        {visible.map(g => (
          <li key={g.id} className="flex items-center justify-between gap-2">
            <span className="text-sm">
              Glapp mellan <span className="font-medium">{labelOf(g.leftId)}</span> och{" "}
              <span className="font-medium">{labelOf(g.rightId)}</span>:
              <span className="ml-1">{slotToSV(g.fromSlot)} → {slotToSV(g.toSlot)}</span>
            </span>
            <button
              onClick={(e) => { e.preventDefault(); onDismiss(g.id); }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
              title="Ta bort och varna inte för detta igen"
            >
              x
            </button>
          </li>
        ))}
      </ul>

    </div>
  );
}

// =================== /Varningskomponent för glapp ======================

export default function PusslaDinST({
  initialStartYear,
  initialCourses,
}: {
  initialStartYear?: number;
  initialCourses?: TLcourse[];
}) {

const router = useRouter();
// Gör profilens datum-state tillgängligt innan useEffect nedan
const [stStartISO, setStStartISO] = useState<string | null>(null);
const [stEndISO, setStEndISO] = useState<string | null>(null);

// Profil (för intyg) – MÅSTE deklareras före alla hooks/effects som använder 'profile' eller 'setProfile'
const [profile, setProfile] = useState<any>(null);



  // Ladda profilens start/slut (sätt INTE startYear här)
  useEffect(() => {
    (async () => {
      try {
        const profArr = await (db as any).profile?.toArray?.();
        const prof = Array.isArray(profArr) ? profArr[0] : null;

        const stISO =
          prof?.stStartDate ||
          (await (db as any).settings?.get?.("st"))?.startDate ||
          null;
        if (typeof stISO === "string" && stISO) {
          setStStartISO(stISO);
        }

        const stEnd =
          prof?.stEndDate ||
          (await (db as any).settings?.get?.("st"))?.endDate ||
          null;
        if (typeof stEnd === "string" && stEnd) {
          setStEndISO(stEnd);
        }
      } catch {
        /* ignore */
      }
    })();
}, []);

// Ladda profil (för intyg)
useEffect(() => {
  (async () => {
    try {
      const arr = await (db as any).profile?.toArray?.();
      setProfile(Array.isArray(arr) ? arr[0] : null);
    } catch { /* ignore */ }
  })();
}, []);




  // Synka år när profilens datum dyker upp (2021 → BT-år, annars ST-år)
useEffect(() => {
  (async () => {
    try {
      const arr = await (db as any).profile?.toArray?.();
      const prof = Array.isArray(arr) ? arr[0] : null;
      const goals = String(prof?.goalsVersion || "").trim();
      const is2021 = goals === "2021";
      const btISO  = prof?.btStartDate as string | undefined;
      const stISO  = stStartISO || (prof?.stStartDate as string | undefined) || undefined;

      const pickISO = (is2021 && btISO) ? btISO : stISO;
      if (!pickISO) return;

      const y = new Date(pickISO + "T00:00:00").getFullYear();
      if (!Number.isNaN(y)) setStartYear(y);

      try { localStorage.setItem("timeline_firstISO", pickISO); } catch {}
    } catch { /* ignore */ }
  })();
}, [stStartISO]);



// Håll bara GRÖN markör (start) i synk med DB via Dexie liveQuery.
// RÖD markör (slut) räknas alltid lokalt här i komponenten.
useEffect(() => {
  let sub: any;
  try {
    const obs = liveQuery(async () => {
      const profArr = await (db as any).profile?.toArray?.();
      const prof = Array.isArray(profArr) ? profArr[0] : null;
      const st = await (db as any).settings?.get?.("st");
      return { startISO: (prof?.stStartDate ?? st?.startDate) ?? null };
    });

    sub = obs.subscribe(
      (val: any) => {
        const s = typeof val?.startISO === "string" && val.startISO ? val.startISO : null;
        setStStartISO(s);
      },
      () => { /* ignore errors */ }
    );
  } catch { /* ignore */ }

  return () => { try { sub?.unsubscribe?.(); } catch {} };
}, []);



  const [startYear, setStartYear] = useState<number>(
  initialStartYear ?? new Date().getFullYear()
);


  const [yearsAbove, setYearsAbove] = useState<number>(0);
  const [yearsBelow, setYearsBelow] = useState<number>(0);

  // Draft-data i tidslinjen (lokal) + länkade från DB (locked)
  const [activities, setActivities] = useState<Activity[]>([]);
  const [courses, setCourses] = useState<TLcourse[]>(initialCourses ?? []);

  // valt objekt
const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
const selectedPlacement = activities.find(a => a.id === selectedPlacementId) || null;

const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
const selectedCourse = courses.find(c => c.id === selectedCourseId) || null;

// tabellrad hover – stängs av när man hovrar "Intyg"
const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);


  // vilket kort är aktivt (för gråmarkering av det andra)
  const activeCard: "placement" | "course" | null =
    selectedPlacementId ? "placement" : (selectedCourseId ? "course" : null);

  // ===== Gemensamt formulär under tidslinjen =====
  type Lane = "placement" | "course";
  const [activeLane, setActiveLane] = useState<Lane>("placement");

  // Total planlängd (mån) styr slutdatum: 2015→60, 2021→66. Kan justeras men ej < 0.
  const [totalPlanMonths, setTotalPlanMonths] = useState<number>(60);
  const [restAttendance, setRestAttendance] = useState<number>(100); // “resten av ST:n” sysselsättningsgrad %

  // Sätt default-värde utifrån målversion när profil laddas
  useEffect(() => {
  const gv = String((profile as any)?.goalsVersion || "").trim();
  const fromProfile = Number((profile as any)?.stTotalMonths);
  if (Number.isFinite(fromProfile) && fromProfile > 0) {
    setTotalPlanMonths(fromProfile);
  } else {
    setTotalPlanMonths(gv === "2021" ? 66 : 60);
  }
}, [profile]);



  // Aktivitetsformulär (Placering/Vetenskap-/Förbättring/Ausk/ledigheter)
  type FormPlacement = {
    type: ActivityType;
    clinic: string;
    startDate: string;
    endDate: string;
    attendance: number;        // %
    supervisor: string;
    note: string;
    leaveSubtype?: string;     // för "Annan ledighet"
  };
  const [formP, setFormP] = useState<FormPlacement>({
    type: "Klinisk tjänstgöring",
    clinic: "",
    startDate: "",
    endDate: "",
    attendance: 100,
    supervisor: "",
    note: "",
    leaveSubtype: "",
  });

  // Kursformulär
  type FormCourse = {
    title: string;
    city: string;
    certificateDate: string;
    startDate?: string; // (2015)
    endDate?: string;   // (2015)
    note: string;
  };
  const todayISO = () => {
    const d = new Date();
    const z = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
  };
  const [formC, setFormC] = useState<FormCourse>({
    title: "",
    city: "",
    certificateDate: todayISO(),
    startDate: "",
    endDate: "",
    note: "",
  });

  
  // Komplett METIS-kurslista (rullista)
const METIS_COURSES = [
  "Akutpsykiatri",
  "Psykiatrisk diagnostik",
  "Psykiatrisk juridik",
  "Psykofarmakologi",
  "Suicidologi",
  "Levnadsvanor vid psykisk sjukdom",
  "Beroendelära",
  "Affektiva sjukdomar",
  "BUP för vuxenpsykiatriker",
  "Konsultationspsykiatri och psykosomatik",
  "Neuropsykiatri",
  "Personlighetssyndrom",
  "Psykossjukdomar",
  "Ätstörningar",
  "OCD- och relaterade syndrom",
  "Ångest-, trauma- och stressrelaterade syndrom",
  "Äldrepsykiatri",
  "Kritisk läkemedelsvärdering inom psykofarmakologi",
  "Medicinsk vetenskap",
  "Psykiatrisk neurovetenskap",
  "Psykiatri & samhälle",
  "Rättspsykiatri",
  "Sexualmedicin och könsdysfori",
  "Transkulturell psykiatri",
  // Flyttat ut ur METIS: Psykoterapi, Ledarskap, Handledning
];

// Automatisk mappning METIS-kurs → delmål (bas-koder a/b/c)
const METIS_COURSE_GOALS: Record<string, string[]> = {
  "Akutpsykiatri": ["c2", "c3", "b1", "a2"],
  "Psykiatrisk diagnostik": ["c1", "c2", "b1", "a2"],
  "Psykiatrisk juridik": ["c10", "c13", "b1", "a2", "a6"],
  "Psykofarmakologi": ["c4"],
  "Suicidologi": ["c3", "b1", "a2"],
  "Levnadsvanor vid psykisk sjukdom": ["b1", "b2", "a2"],
  "Beroendelära": ["c6", "c13", "b1", "b2", "b3", "a2"],

  "Affektiva sjukdomar": ["c1", "c4", "b1", "a2"],
  "BUP för vuxenpsykiatriker": ["c8", "b1", "b3", "b4"],
  "Konsultationspsykiatri och psykosomatik": ["c10", "b1", "a2"],
  "Neuropsykiatri": ["c2", "c8", "c11", "b1"],
  "Personlighetssyndrom": ["c1", "b1", "a2"],
  "Psykossjukdomar": ["c1", "c4", "b1", "b2", "a2"],
  "Ätstörningar": ["c2", "c8", "b1", "b3", "a2"],
  "OCD- och relaterade syndrom": ["c1", "b1", "a2"],
  "Ångest-, trauma- och stressrelaterade syndrom": ["c1", "b1", "a2"],
  "Äldrepsykiatri": ["c7", "b1", "b3", "a2"],

  "Kritisk läkemedelsvärdering inom psykofarmakologi": ["c4", "b3", "a5"],
  "Medicinsk vetenskap": ["b1", "a2"],
  "Psykiatrisk neurovetenskap": ["c1"],
  "Psykiatri & samhälle": ["c13", "b1", "b2", "b4", "a2"],
  "Rättspsykiatri": ["c10", "c13", "b1", "a2", "a6"],
  "Sexualmedicin och könsdysfori": ["c2", "b1", "a2"],
  "Transkulturell psykiatri": ["c2", "c13", "b1", "a2"],
};

function mapMetisGoalsToMilestoneIds(courseTitle: string, profile: any): string[] {
  const baseList = METIS_COURSE_GOALS[courseTitle];
  if (!baseList || baseList.length === 0) return [];

  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion || "2021");

  return baseList.map((code) => {
    const trimmed = String(code ?? "").trim().toLowerCase();
    const match = /^([abc])(\d+)$/.exec(trimmed);
    if (!match) {
      // Fallback: returnera versaler om mönstret inte kändes igen
      return trimmed.toUpperCase();
    }

    const letterLower = match[1].toLowerCase();
    const letterUpper = letterLower.toUpperCase();
    const num = match[2];

    if (gv === "2015") {
      // 2015: A1, B2, C3
      return `${letterUpper}${num}`;
    }
    if (gv === "2021") {
      // 2021: STa1, STb2, STc3
      return `ST${letterLower}${num}`;
    }
    return `${letterUpper}${num}`;
  });
}



  // Listor nedanför formuläret
  const [listPlac, setListPlac] = useState<any[]>([]);
  const [listCourses, setListCourses] = useState<any[]>([]);
  async function refreshLists() {
    try {
      setListPlac(await db.placements.orderBy("startDate").toArray());
      setListCourses(await db.courses.orderBy("certificateDate").toArray());
    } catch {}
  }
  useEffect(() => { refreshLists(); }, []);

// Scan-intyg modal (öppnas via knappen i rubriken)
  const [scanOpen, setScanOpen] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [btModalOpen, setBtModalOpen] = useState(false);
  const [milestoneOverviewOpen, setMilestoneOverviewOpen] = useState(false);
   const [iupOpen, setIupOpen] = useState(false);
  const [iupInitialTab, setIupInitialTab] = useState<
    "handledning" | "planering" | "delmal" | "rapport" | null
  >(null);
  const [iupInitialMeetingId, setIupInitialMeetingId] = useState<string | null>(null);
  const [iupInitialAssessmentId, setIupInitialAssessmentId] =
    useState<string | null>(null);
  const [supervisionSessions, setSupervisionSessions] =
    useState<SupervisionSession[]>([]);
  const [hoveredSupervisionId, setHoveredSupervisionId] = useState<
    string | null
  >(null);
  const [assessmentSessions, setAssessmentSessions] =
    useState<AssessmentSession[]>([]);
  const [hoveredAssessmentId, setHoveredAssessmentId] = useState<
    string | null
  >(null);
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);
  const [showSupervisionOnTimeline, setShowSupervisionOnTimeline] =
    useState<boolean>(true);
  const [showAssessmentsOnTimeline, setShowAssessmentsOnTimeline] =
    useState<boolean>(true);

  


    // Ladda handledningstillfällen från IUP (för handledningstrianglar i kursspåret)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const anyDb: any = db as any;
        const row = (await anyDb.timeline?.get?.("iup")) as
          | {
              meetings?: {
                id?: string;
                dateISO?: string;
                focus?: string;
              }[];
            }
          | undefined;

        if (cancelled) return;

        const next: SupervisionSession[] = Array.isArray(row?.meetings)
          ? (row!.meetings as any[])
              .filter(
                (m) =>
                  m &&
                  typeof (m as any).id === "string" &&
                  (m as any).id &&
                  typeof (m as any).dateISO === "string" &&
                  (m as any).dateISO
              )
              .map((m: any) => ({
                id: String(m.id),
                dateISO: String(m.dateISO),
                title: typeof m.focus === "string" ? m.focus : "",
              }))
          : [];

        setSupervisionSessions(next);
      } catch (e) {
        console.error("Kunde inte läsa handledningstillfällen från IUP:", e);
        if (!cancelled) {
          setSupervisionSessions([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ladda progressionsbedömningar från IUP (för stjärnor i kursspåret)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const anyDb: any = db as any;
        const row = (await anyDb.timeline?.get?.("iup")) as
          | {
              assessments?: {
                id?: string;
                dateISO?: string;
                level?: string;
                instrument?: string;
              }[];
            }
          | undefined;

        if (cancelled) return;

        const next: AssessmentSession[] = Array.isArray(row?.assessments)
          ? (row!.assessments as any[])
              .filter(
                (a) =>
                  a &&
                  typeof (a as any).id === "string" &&
                  (a as any).id &&
                  typeof (a as any).dateISO === "string" &&
                  (a as any).dateISO
              )
              .map((a: any) => ({
                id: String(a.id),
                dateISO: String(a.dateISO),
                title:
                  typeof a.level === "string" && a.level.trim()
                    ? a.level
                    : typeof a.instrument === "string"
                    ? a.instrument
                    : "",
              }))
          : [];

        setAssessmentSessions(next);
      } catch (e) {
        console.error("Kunde inte läsa progressionsbedömningar från IUP:", e);
        if (!cancelled) {
          setAssessmentSessions([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ladda visningsflaggor för handledning/progressionsbedömningar från IUP
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const anyDb: any = db as any;
        const row = (await anyDb.timeline?.get?.("iup")) as
          | {
              showMeetingsOnTimeline?: boolean;
              showAssessmentsOnTimeline?: boolean;
            }
          | undefined;

        if (cancelled) return;

        if (typeof row?.showMeetingsOnTimeline === "boolean") {
          setShowSupervisionOnTimeline(row.showMeetingsOnTimeline);
        } else {
          setShowSupervisionOnTimeline(true);
        }

        if (typeof row?.showAssessmentsOnTimeline === "boolean") {
          setShowAssessmentsOnTimeline(row.showAssessmentsOnTimeline);
        } else {
          setShowAssessmentsOnTimeline(true);
        }
      } catch (e) {
        console.error("Kunde inte läsa visningsflaggor för IUP:", e);
        if (!cancelled) {
          setShowSupervisionOnTimeline(true);
          setShowAssessmentsOnTimeline(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);





// Wrappers som använder aktuellt component-state
const phaseForSlots = (startSlot: number, lengthSlots: number) => {
  // För 2015-spåret finns ingen BT-fas – allt är ST
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
  if (gv !== "2021") return "ST";

  return phaseForSlotsCore(
    startYear,
    (profile as any)?.btStartDate ?? null,
    stStartISO ?? (profile as any)?.stStartDate ?? null,
    startSlot,
    lengthSlots
  );
};

const phaseForCourseDates = (startISO?: string) => {
  // För 2015-spåret finns ingen BT-fas – allt är ST
  const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
  if (gv !== "2021") return "ST";

  const prof: any = profile || {};
  const btStartISO: string | null = prof?.btStartDate || null;
  const btEndManual: string | null = prof?.btEndDate || null;

  // Effektivt BT-slut: manuellt fält (om angivet) annars 24 månader efter BT-start
  let btEndISO: string | null = btEndManual;
  if (btStartISO && !btEndManual && isValidISO(btStartISO)) {
    try {
      const d = isoToDateSafe(btStartISO);
      btEndISO = dateToISO(addMonths(d, 24));
    } catch {
      btEndISO = null;
    }
  }

  return phaseForCourseDatesCore(
    startYear,
    btStartISO,
    btEndISO,
    startISO
  );
};




// 2021/2015-val beräknas först när profil finns
const is2021 = useMemo(
  () => normalizeGoalsVersion((profile as any)?.goalsVersion) === "2021",
  [profile]
);

// Ingen automatisk phasning av kurser vid profiländringar
useEffect(() => {
  // medvetet tomt: behåll befintlig c.phase
}, [profile, startYear]);





const [saveInfoOpen, setSaveInfoOpen] = useState(false);
const [reportOpen, setReportOpen] = useState(false);
const [profileOpen, setProfileOpen] = useState(false);

// Visa: 'both' | 'BT' | 'ST'
const [viewPhase, setViewPhase] = useState<'both' | 'BT' | 'ST'>('both');





const [goals, setGoals] = useState<GoalsCatalog | null>(null);
const [achievements, setAchievements] = useState<any[]>([]);

useEffect(() => {
  (async () => {
    try {
      const profArr = await (db as any).profile?.toArray?.();
      const prof = Array.isArray(profArr) ? profArr[0] : null;
      const spec: "psykiatri" | "allmanmedicin" = (prof?.speciality || "psykiatri");
      const ver = (prof?.goalsVersion || "st_2021");
      const g = await loadGoals(ver, spec);
      setGoals(g);
    } catch { /* ignore */ }

    try {
      const ach = await (db as any).achievements?.toArray?.();
      setAchievements(Array.isArray(ach) ? ach : []);
    } catch {
      setAchievements([]);
    }
  })();
}, []);




  // MilestonePicker (Välj delmål)
const [milestonePicker, setMilestonePicker] = useState<{ open: boolean; mode: "course" | "placement" | null }>({
  open: false,
  mode: null,
});
// BT-MilestonePicker (BT-delmål)
const [btMilestonePicker, setBtMilestonePicker] = useState<{ open: boolean; mode: "course" | "placement" | null }>({
  open: false,
  mode: null,
});

// States för att öppna enskilda delmål från detaljrutan (read-only)
const [stMilestoneDetail, setStMilestoneDetail] = useState<string | null>(null);
const [btMilestoneDetail, setBtMilestoneDetail] = useState<string | null>(null);




  // beräkna längd (5 år + ev. perioder som inte räknas som tjänstgöring, t.ex. ledighet och forskning)
  const extraLeaveSlots = useMemo(
    () =>
      activities
        .filter((a) => isZeroAttendanceType(a.type))
        .reduce((acc, a) => acc + a.lengthSlots, 0),
    [activities]
  );
  // Baseras helt på användarens totalPlanMonths (ex. 60 för 2015, 66 för 2021)
  const baseSlots = Math.max(0, totalPlanMonths) * 2;
  const totalSlots = baseSlots + extraLeaveSlots;





// Globala slots för grön/röd gräns (för radexpansion + korrekt randning)
const startBoundarySlotGlobal = stStartISO ? dateToSlot(startYear, stStartISO, "start") : 0;
const endBoundarySlotGlobal = stEndISO
  ? dateToSlot(startYear, stEndISO, "end")
  : (stStartISO ? startBoundarySlotGlobal + baseSlots : totalSlots);

// Antal år som behövs ska minst täcka röd gräns, inte bara totalSlots
const totalYearsNeeded = Math.max(
  Math.ceil(totalSlots / slotsPerYear()),
  Math.ceil(endBoundarySlotGlobal / slotsPerYear())
);
const visibleYearCount = yearsAbove + totalYearsNeeded + yearsBelow;


  // ---- LOKAL DRAFT-STATE ----
const [typeDraft, setTypeDraft] = useState<ActivityType>("Klinisk tjänstgöring");
const [labelDraft, setLabelDraft] = useState<string>("");
const [monthsDraft, setMonthsDraft] = useState<number>(1);

const [courseTypeDraft, setCourseTypeDraft] = useState<CourseKind>("Kurs");
const [courseTitleDraft, setCourseTitleDraft] = useState<string>("");
const [courseDateDraft, setCourseDateDraft] = useState<string>("");

// ---- Övrigt UI-state ----


// Dismissade glapp – sparas tillsammans med tidslinjen i DB.timeline
const [dismissedGaps, setDismissedGaps] = useState<string[]>([]);


// NYTT: Varningsmarkeringar per rad (ingen popup)
const [btstWarnActIds, setBtstWarnActIds] = useState<Set<string>>(new Set());
const [btstWarnCourseIds, setBtstWarnCourseIds] = useState<Set<string>>(new Set());

// NYTT: Liten popup-meny vid dubbelklick (placering)
const [certMenu, setCertMenu] = useState<{
  open: boolean;
  x: number;
  y: number;
  kind: "placement" | "course" | null;
  placement: Activity | null;
  course: TLcourse | null;
}>({
  open: false,
  x: 0,
  y: 0,
  kind: null,
  placement: null,
  course: null,
});



// Behåll dismiss BARA för glapp som fortfarande existerar oförändrade
// + beräkna vilka intervall som passerar gränsen BT → ST (endast målversion 2021)
useEffect(() => {
  // 1) Rensa dismiss som inte längre gäller
  const currentGapIds = computeEducationalGaps(activities).map(g => g.id);
  setDismissedGaps(prev => prev.filter(id => currentGapIds.includes(id)));

  // 2) Markera rader som korsar BT → ST (ingen alert)
  try {
    const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
    if (gv !== "2021") {
      // Rensa om man byter profil/regelverk
      setBtstWarnActIds(new Set());
      setBtstWarnCourseIds(new Set());
      return;
    }

    const isIso = (s?: string | null): s is string =>
      typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const toMs = (s: string): number => Date.parse(s + "T00:00:00");
    const getIntervalMs = (sISO?: string | null, eISO?: string | null): [number, number] | null => {
      if (!isIso(sISO) && !isIso(eISO)) return null;
      const s = isIso(sISO) ? toMs(sISO) : NaN;
      const e = isIso(eISO) ? toMs(eISO) : NaN;
      const a = Number.isFinite(s) ? s : e;
      const b = Number.isFinite(e) ? e : s;
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      const a0 = Math.min(a, b);
      const a1 = Math.max(a, b) + 86400000; // exklusivt slut
      return [a0, a1];
    };

    // Gräns för BT → ST: samma som gula markören i tidslinjen
    const profAny: any = profile || {};
    const btISO = profAny?.btStartDate as string | undefined;
    const btEndManual = profAny?.btEndDate as string | undefined;

    let boundaryISO: string | null = null;

    if (btISO && isIso(btISO)) {
      // 2021: BT-slut = profilens Slutdatum för BT (eller 24 månader efter BT-start)
      if (btEndManual && isIso(btEndManual)) {
        boundaryISO = btEndManual;
      } else {
        try {
          const btDate = isoToDateSafe(btISO);
          const btEndISO = dateToISO(addMonths(btDate, 24));
          boundaryISO = btEndISO;
        } catch {
          boundaryISO = null;
        }
      }
    } else {
      // Fallback: ST-start (som tidigare logik)
      boundaryISO =
        (typeof stStartISO === "string" && stStartISO) ? stStartISO :
        (typeof profAny?.stStartDate === "string" && profAny.stStartDate) ? profAny.stStartDate :
        null;
    }


    if (!boundaryISO) {
      setBtstWarnActIds(new Set());
      setBtstWarnCourseIds(new Set());
      return;
    }
    const boundaryMs = toMs(boundaryISO);
    if (!Number.isFinite(boundaryMs)) {
      setBtstWarnActIds(new Set());
      setBtstWarnCourseIds(new Set());
      return;
    }


    // Hjälpare för placering → tidsintervall
    const intervalFromActivity = (a: any): [number, number] | null => {
      if (isIso(a.exactStartISO) || isIso(a.exactEndISO) || isIso(a.startDate) || isIso(a.endDate)) {
        return getIntervalMs(a.exactStartISO ?? a.startDate, a.exactEndISO ?? a.endDate);
      }
      if (typeof a.startSlot !== "number" || typeof a.lengthSlots !== "number") return null;

      const s = slotToYearMonthHalf(startYear, a.startSlot);
      const eSlot = a.startSlot + Math.max(1, a.lengthSlots) - 1;
      const e = slotToYearMonthHalf(startYear, eSlot);

      const startD = mondayOnOrAfter(s.year, s.month0, s.half === 0 ? 1 : 15);
      const endBoundaryDay = e.half === 0 ? 15 : 1;
      const endBoundaryMonthRaw = e.month0 + (e.half === 1 ? 1 : 0);
      const endBoundaryYear = e.year + (endBoundaryMonthRaw > 11 ? 1 : 0);
      const endBoundaryMonthNorm = (endBoundaryMonthRaw + 12) % 12;
      const endD = sundayOnOrBefore(endBoundaryYear, endBoundaryMonthNorm, endBoundaryDay);

      const a0 = +startD;
      const a1 = +endD + 86400000; // exklusivt slut
      return [a0, a1];
    };

    const actIds: string[] = [];
    for (const a of Array.isArray(activities) ? activities : []) {
      const pair = intervalFromActivity(a);
      if (!pair) continue;
      const [a0, a1] = pair;
      if (a0 < boundaryMs && a1 - 86400000 > boundaryMs) actIds.push(a.id);


    }

    const courseIds: string[] = [];
    for (const c of Array.isArray(courses) ? courses : []) {
      const pair =
        getIntervalMs((c as any).startDate, (c as any).endDate) ??
        getIntervalMs((c as any).certificateDate, (c as any).certificateDate);
      if (!pair) continue;
      const [a0, a1] = pair;
      if (a0 < boundaryMs && a1 - 86400000 > boundaryMs) courseIds.push((c as any).id);


    }

    setBtstWarnActIds(new Set(actIds));
    setBtstWarnCourseIds(new Set(courseIds));
  } catch {
    // Tyst fel
    setBtstWarnActIds(new Set());
    setBtstWarnCourseIds(new Set());
  }
}, [activities, courses, profile, stStartISO, startYear]);






// Kurs-lane-mått per år (px)
const laneRefs = useRef<Record<number, HTMLDivElement | null>>({});
const [laneWidthByYear, setLaneWidthByYear] = useState<Record<number, number>>({});

// Kurs-pill-bredd per kurs-id (px)
const chipWidthsRef = useRef<Record<string, number>>({});
const [, forceRerender] = useState(0); // för att trigga ommålning när vi mätt

useEffect(() => {
  function updateLaneWidths() {
    const next: Record<number, number> = {};
    for (const k of Object.keys(laneRefs.current)) {
      const y = Number(k);
      const el = laneRefs.current[y];
      if (el) next[y] = el.clientWidth || el.offsetWidth || 0;
    }
    setLaneWidthByYear(prev => {
      // undvik onödiga renders
      const same =
        Object.keys(prev).length === Object.keys(next).length &&
        Object.keys(prev).every(key => prev[key as any] === next[key as any]);
      return same ? prev : next;
    });
  }
  updateLaneWidths();
  window.addEventListener("resize", updateLaneWidths);
  return () => window.removeEventListener("resize", updateLaneWidths);
}, []);



  // Kolumn-hover (för både rad 1 och kurs-lane)
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);

  // ---- drag states ----
  type PlacementDrag = {
    id: string; mode: "move" | "resize-left" | "resize-right";
    startCol: number; rowLeft: number; rowTop: number;
    colWidth: number; rowHeight: number; startRowIndex: number;
    startSlot: number; lengthSlots: number;
  };
  const dragPlacementRef = useRef<PlacementDrag | null>(null);

  type CourseDrag = {
  id: string;
  year: number;
  rowLeft: number;
  rowTop: number;
  rowWidth: number;
  rowHeight: number;
  daysInYear: number;
  mode: "start" | "end" | "move";
  startDayIndex?: number;
};
const dragCourseRef = useRef<CourseDrag | null>(null);


  // undvik att första tomma rendern skriver över LS
  const hydratedRef = useRef(false);
  const pendingScanSelectionRef = useRef<{ kind: "placement" | "course"; dbId: string | number } | null>(null);

// --- NYTT: minns senast beräknade slut-ISO så vi inte skriver i onödan
const lastEndRef = useRef<string | null>(null);



  /// Vi beräknar röd markör lokalt och behöver inte hämta den från DB längre.
// (Behåll gärna kvar funktionen om du använder den någon annanstans, annars bort med den.)


   // ---- ladda från DB + localStorage + lyssna på kryss-signal ----
  useEffect(() => {
    async function load() {
      try {
        const profLocal = await ensureProfile(profile);

                // 1) Låsta placeringar som ska synas
        const dbPlac = await db.placements.toArray();
        const lockedPlac = dbPlac.filter((p: any) => !!p.showOnTimeline);
        const lockedActs: Activity[] = lockedPlac.map((p: any, i: number) => {
          // Normalisera datum till rena ISO-datumsträngar (YYYY-MM-DD)
          const startISO: string =
            typeof p.startDate === "string"
              ? p.startDate
              : p.startDate instanceof Date
              ? dateToISO(p.startDate)
              : "";
          const endISO: string =
            typeof p.endDate === "string"
              ? p.endDate
              : p.endDate instanceof Date
              ? dateToISO(p.endDate)
              : "";

          // Grundberäkning av slots utifrån ISO-datum (om de är satta)
          let start = startISO ? dateToSlot(startYear, startISO, "start") : 0;
          let endBoundary = endISO ? dateToSlot(startYear, endISO, "end") : start;

          // Fallback om datumet är ogiltigt och ger NaN/∞ → lägg blocket i startåret med längd 1
          if (!Number.isFinite(start)) {
            start = 0;
          }
          if (!Number.isFinite(endBoundary)) {
            endBoundary = start;
          }

          let len = Math.max(1, endBoundary - start);
          if (!Number.isFinite(len) || len <= 0) {
            len = 1;
          }

          // EXTRA SKYDD: se till att blocket hamnar på samma år i tidslinjen
          // som startISO anger, även om startYear skulle glida.
          if (
            startISO &&
            isValidISO(startISO) &&
            Number.isFinite(start) &&
            Number.isFinite(endBoundary) &&
            Number.isFinite(len)
          ) {
            try {
              const d = isoToDateSafe(startISO);
              const yearFromDate = d.getFullYear();

              // Vilken årsrad borde blocket ligga på utifrån datumet?
              const expectedRowIndex = yearFromDate - startYear;

              // Vilken årsrad ligger det faktiskt på givet nuvarande startSlot?
              const currentRowIndex = Math.floor(start / slotsPerYear());

              const deltaRows = expectedRowIndex - currentRowIndex;
              if (deltaRows !== 0) {
                const deltaSlots = deltaRows * slotsPerYear();
                start += deltaSlots;
                endBoundary += deltaSlots;
                len = Math.max(1, endBoundary - start);

                if (!Number.isFinite(len) || len <= 0) {
                  len = 1;
                }
              }
            } catch {
              // Vid konstiga datum: behåll fallback-beräkningen
            }
          }

          const phaseFromDb = (p as any)?.phase as "BT" | "ST" | undefined;
          const phase: "BT" | "ST" =
            phaseFromDb || inferPhaseByBT(startISO || undefined, endISO || undefined);

          return {
            id: `pl_${p.id}`,
            type: (p.type as ActivityType) || "Klinisk tjänstgöring",
            label: p.clinic || undefined,
            startSlot: start,
            lengthSlots: len,
            hue: nextHue(i),
            linkedPlacementId: p.id,

            // Exakta datum som används i detaljrutan
            exactStartISO: startISO || undefined,
            exactEndISO: endISO || undefined,

            // Övriga fält som ska överleva sidladdning
            attendance:
              typeof p.attendance === "number" ? p.attendance : 100,
            supervisor: p.supervisor || "",
            supervisorSpeciality: p.supervisorSpeciality || "",
            supervisorSite: p.supervisorSite || "",
            note: p.note || "",
            leaveSubtype: p.leaveSubtype || "",
            phase,
            btAssessment: (p as any)?.btAssessment || "",
            btMilestones: ((p as any)?.btMilestones || []) as string[],
            stMilestones: ((p as any)?.stMilestones || []) as string[],
            stGoalIds: ((p as any)?.stGoalIds || []) as string[],
            milestones: (
              (p as any)?.milestones ||
              (p as any)?.stMilestones ||
              (p as any)?.stGoalIds ||
              []
            ) as string[],
            fulfillsStGoals: !!(p as any)?.fulfillsStGoals,
          };
        });



        // 2) Låsta kurser som ska synas
        const dbCourses = (await (db as any).courses?.toArray?.()) ?? [];
        const lockedCrs: TLcourse[] = dbCourses
          .filter((c: any) => !!c.showOnTimeline)
          .map((c: any) => {
            const startISO: string =
              c.startDate || c.certificateDate || c.endDate || "";

            const phaseFromDb = (c as any)?.phase as "BT" | "ST" | undefined;
            const phase: "BT" | "ST" =
              phaseFromDb || phaseForCourseDates(startISO);

            return {
              id: `cr_${c.id}`,
              title: c.title || "",
              certificateDate: c.certificateDate || "",
              kind: c.kind || "Kurs",
              linkedCourseId: c.id,

              // Extra fält som ska bestå
              city: c.city || "",
              courseLeaderName: c.courseLeaderName || "",
              startDate: c.startDate || "",
              endDate: c.endDate || "",
              note: c.note || "",
              phase,
              btAssessment: (c as any)?.btAssessment || "",
              btMilestones: ((c as any)?.btMilestones || []) as string[],
              fulfillsStGoals: !!(c as any)?.fulfillsStGoals,
              milestones: ((c as any)?.milestones || []) as string[],
              showAsInterval:
                typeof (c as any)?.showAsInterval === "boolean"
                  ? !!(c as any).showAsInterval
                  : undefined,
            };
          });

        // 3) Drafts från DB.timeline – fallback till localStorage vid första körningen
        let lsAbove = 0,
          lsBelow = 0;
        let lsDismissed: string[] = [];
        let draftActs: Activity[] = [];
        let draftCrs: TLcourse[] = [];

        try {
          const anyDb2: any = db as any;
          const timeline = await anyDb2.timeline?.get?.("main");
          if (timeline) {
            lsAbove = Number(timeline.yearsAbove) || 0;
            lsBelow = Number(timeline.yearsBelow) || 0;
            lsDismissed = Array.isArray(timeline.dismissedGaps)
              ? timeline.dismissedGaps
              : [];
            if (Array.isArray(timeline.activities)) {
              draftActs = timeline.activities as Activity[];
            }
            if (Array.isArray(timeline.courses)) {
              draftCrs = timeline.courses as TLcourse[];
            }
          } else {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              lsAbove = Number(parsed.yearsAbove) || 0;
              lsBelow = Number(parsed.yearsBelow) || 0;
              lsDismissed = Array.isArray(parsed.dismissedGaps)
                ? parsed.dismissedGaps
                : [];
              if (Array.isArray(parsed.activities)) {
                draftActs = parsed.activities as Activity[];
              }
              if (Array.isArray(parsed.courses)) {
                draftCrs = parsed.courses as TLcourse[];
              }
            }
          }
        } catch {}

        // === 2021: Auto-phase baserat på BT-intervallet (BT start/slut i profil) ===
        const is2021Profile =
          normalizeGoalsVersion((profile as any)?.goalsVersion) === "2021";

        // Placeringar fasas av STARTDATUM (kurser fasas av SLUTDATUM separat)
        function inferPhaseByBT(
          startISO?: string,
          _endISO?: string
        ): "BT" | "ST" {
          const goals = String((profile as any)?.goalsVersion || "").trim();
          if (goals !== "2021") return "ST";

          const bt = (profile as any)?.btStartDate || null;
          const st = stStartISO || (profile as any)?.stStartDate || null;
          if (!(bt && st && startISO)) return "ST";

          const sMs = new Date(startISO + "T00:00:00").getTime();
          const btMs = new Date(bt + "T00:00:00").getTime();
          const stMs = new Date(st + "T00:00:00").getTime();
          if (
            !Number.isFinite(sMs) ||
            !Number.isFinite(btMs) ||
            !Number.isFinite(stMs)
          )
            return "ST";

          return sMs >= btMs && sMs < stMs ? "BT" : "ST";
        }

        const withPhaseActs: Activity[] = lockedActs.map((a: any) => {
          // Räkna ut START-ISO (fas för placeringsobjekt sätts av start)
          const s = slotToYearMonthHalf(startYear, a.startSlot);
          const startD = mondayOnOrAfter(
            s.year,
            s.month0,
            s.half === 0 ? 1 : 15
          );
          const startISO = dateToISO(startD);

          return { ...a, phase: inferPhaseByBT(startISO, undefined) };
        });

        const mergedActs = withPhaseActs.map((a) => {
          const match = draftActs.find((d) =>
            (d as any).linkedPlacementId
              ? (d as any).linkedPlacementId ===
                (a as any).linkedPlacementId
              : d.id === a.id
          );
          if (!match) return a;
          const m: any = match;
          return {
            ...a,
            type: m.type ?? a.type,
            label: m.label ?? a.label,
            startSlot:
              typeof m.startSlot === "number" ? m.startSlot : a.startSlot,
            lengthSlots:
              typeof m.lengthSlots === "number"
                ? m.lengthSlots
                : a.lengthSlots,
            attendance:
              typeof m.attendance === "number"
                ? m.attendance
                : a.attendance,
            hue: typeof m.hue === "number" ? m.hue : a.hue,
            phase: (m.phase as any) || a.phase,
            supervisor: m.supervisor ?? a.supervisor,
            supervisorSpeciality:
              m.supervisorSpeciality ?? a.supervisorSpeciality,
            supervisorSite: m.supervisorSite ?? a.supervisorSite,
            note: m.note ?? a.note,
            leaveSubtype: m.leaveSubtype ?? a.leaveSubtype,
            btAssessment: m.btAssessment ?? a.btAssessment,
            btMilestones: Array.isArray(m.btMilestones)
              ? m.btMilestones
              : a.btMilestones,
            stMilestones: Array.isArray(m.stMilestones)
              ? m.stMilestones
              : a.stMilestones,
            stGoalIds: Array.isArray(m.stGoalIds)
              ? m.stGoalIds
              : a.stGoalIds,
            milestones: Array.isArray(m.milestones)
              ? m.milestones
              : a.milestones,
            fulfillsStGoals:
              typeof m.fulfillsStGoals === "boolean"
                ? m.fulfillsStGoals
                : a.fulfillsStGoals,
          };
        });

        const mergedCourses = lockedCrs.map((c) => {
          const match = draftCrs.find((d) =>
            (d as any).linkedCourseId
              ? (d as any).linkedCourseId === (c as any).linkedCourseId
              : d.id === c.id
          );
          if (!match) return c;
          const m: any = match;
          return {
            ...c,
            title: m.title ?? c.title,
            certificateDate: m.certificateDate ?? c.certificateDate,
            kind: m.kind ?? c.kind,
            startDate: m.startDate ?? c.startDate,
            endDate: m.endDate ?? c.endDate,
            city: m.city ?? c.city,
            courseLeaderName: m.courseLeaderName ?? c.courseLeaderName,
            note: m.note ?? c.note,
            phase: (m.phase as any) || c.phase,
            btAssessment: m.btAssessment ?? c.btAssessment,
            btMilestones: Array.isArray(m.btMilestones)
              ? m.btMilestones
              : c.btMilestones,
            milestones: Array.isArray(m.milestones)
              ? m.milestones
              : c.milestones,
            fulfillsStGoals:
              typeof m.fulfillsStGoals === "boolean"
                ? m.fulfillsStGoals
                : c.fulfillsStGoals,
          };
        });

        const draftOnlyActs = draftActs.filter((d) => {
          const hasLinked = (d as any).linkedPlacementId
            ? mergedActs.some(
                (a) =>
                  a.linkedPlacementId === (d as any).linkedPlacementId
              )
            : mergedActs.some((a) => a.id === d.id);
          return !hasLinked;
        });

        const draftOnlyCourses = draftCrs.filter((d) => {
          const hasLinked = (d as any).linkedCourseId
            ? mergedCourses.some(
                (c) =>
                  c.linkedCourseId === (d as any).linkedCourseId
              )
            : mergedCourses.some((c) => c.id === d.id);
          return !hasLinked;
        });

        const allActivities = [...mergedActs, ...draftOnlyActs];
        const allCourses = [...mergedCourses, ...draftOnlyCourses];

        // Auto-selektion efter scan-intyg (om vi har en väntande selektion)
        const pending = pendingScanSelectionRef.current;
        if (pending && pending.dbId != null) {
          if (pending.kind === "placement") {
            const found = allActivities.find(
              (a: any) => (a as any).linkedPlacementId === pending.dbId
            );
            if (found) {
              setSelectedPlacementId(found.id);
              setSelectedCourseId(null);
              setActiveLane("placement");
              pendingScanSelectionRef.current = null;
            }
          } else if (pending.kind === "course") {
            const found = allCourses.find(
              (c: any) => (c as any).linkedCourseId === pending.dbId
            );
            if (found) {
              setSelectedCourseId(found.id);
              setSelectedPlacementId(null);
              setActiveLane("course");
              pendingScanSelectionRef.current = null;
            }
          }
        }

        setActivities(allActivities);
        setCourses(allCourses);
        setYearsAbove(lsAbove);
        setYearsBelow(lsBelow);
        setDismissedGaps(lsDismissed);

        hydratedRef.current = true;
      } catch {
        /* ignore */
      }
    }

    // initial load
    load();

    // lyssna på signal från Placeringar/Kurser (storage + egen event)
    function onStorage(ev: StorageEvent) {
      if (ev.key === "timeline_sync") {
        load(); // räcker – rött slut räknas lokalt
      }
    }

    function onTimelineSync() {
      load(); // räcker – rött slut räknas lokalt
    }

    function onTimelineSelectFromScan(ev: Event) {
      try {
        const ce = ev as CustomEvent<any>;
        const detail = ce.detail || {};
        if (
          detail &&
          (detail.kind === "placement" || detail.kind === "course") &&
          detail.dbId !== undefined &&
          detail.dbId !== null
        ) {
          pendingScanSelectionRef.current = {
            kind: detail.kind,
            dbId: detail.dbId,
          };
          // ladda om tidslinjen så att objektet finns i state
          load();
        }
      } catch {
        // tyst fel
      }
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("timeline_sync", onTimelineSync as EventListener);
    window.addEventListener(
      "timeline_select_from_scan",
      onTimelineSelectFromScan as EventListener
    );

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "timeline_sync",
        onTimelineSync as EventListener
      );
      window.removeEventListener(
        "timeline_select_from_scan",
        onTimelineSelectFromScan as EventListener
      );
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startYear]);


  useEffect(() => {
    if (!hydratedRef.current) return;

    const anyDb: any = db as any;
    const payload: any = {
      id: "main",
      activities,   // sparar ALLA, både länkade och olänkade
      courses,
      yearsAbove,
      yearsBelow,
      dismissedGaps,
    };

    (async () => {
      try {
        if (anyDb?.timeline?.put) {
          await anyDb.timeline.put(payload);
          return;
        }
      } catch {
        // fallthrough till localStorage
      }

      // Fallback om timeline-tabell saknas eller skrivningen misslyckas
      try {
        const lsPayload = JSON.stringify({
          activities,
          courses,
          yearsAbove,
          yearsBelow,
          dismissedGaps,
        });
        localStorage.setItem(LS_KEY, lsPayload);
      } catch {
        // tyst fel
      }
    })();
  }, [activities, courses, yearsAbove, yearsBelow, dismissedGaps]);


  // ---- overlap-hjälp för placeringar ----
const rangeOverlap = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

// Aktiviteter som räknas som "utbildningsaktiviteter" (ej kurser, ej ledighet)
const isEducationalActivity = (t: ActivityType) =>
  t === "Klinisk tjänstgöring" ||
  t === "Vetenskapligt arbete" ||
  t === "Förbättringsarbete" ||
  t === "Auskultation";

// Beräkna glapp mellan utbildningsaktiviteter (globalt, oavsett år)
function computeEducationalGaps(acts: Activity[]) {
  const indexById = new Map<string, Activity>();
  acts.forEach(a => indexById.set(a.id, a));

  const edus = acts
    .filter(a => isEducationalActivity(a.type))
    .map(a => ({ id: a.id, start: a.startSlot, end: a.startSlot + a.lengthSlots })) // [start, end)
    .sort((A, B) => A.start - B.start);

  function sigOf(aId: string) {
    const a = indexById.get(aId)!;
    return `${a.id}|${a.type}|${a.startSlot}|${a.lengthSlots}`;
  }


  const gaps: { id: string; fromSlot: number; toSlot: number; leftId: string; rightId: string }[] = [];
  for (let i = 0; i < edus.length - 1; i++) {
    const cur = edus[i], nxt = edus[i + 1];
    if (nxt.start > cur.end) {
      // glapp mellan cur.end och nxt.start
      const id = `${sigOf(cur.id)}→${sigOf(nxt.id)}`;
      gaps.push({ id, fromSlot: cur.end, toSlot: nxt.start, leftId: cur.id, rightId: nxt.id });
    }
  }
  return gaps;
}


  const wouldOverlap = (id: string | null, startSlot: number, lengthSlots: number) => {
    const end = startSlot + lengthSlots;
    for (const x of activities) {
      if (id && x.id === id) continue;
      if (rangeOverlap(startSlot, end, x.startSlot, x.startSlot + x.lengthSlots)) return true;
    }
    return false;
  };

  // ---- drafts & val ----
  function addActivityAt(slot: number) {
  const start = slot;
  const len = 1; // halvmånad
  if (wouldOverlap(null, start, len)) return;

  // Räkna ut start/slut-ISO för fasning
  const s = slotToYearMonthHalf(startYear, start);
  const eSlot = start + len - 1;
  const e = slotToYearMonthHalf(startYear, eSlot);
  const startISO = dateToISO(mondayOnOrAfter(s.year, s.month0, s.half === 0 ? 1 : 15));
  const endBoundaryDay = e.half === 0 ? 15 : 1;
  const endBoundaryMonthRaw = e.month0 + (e.half === 1 ? 1 : 0);
  const endBoundaryYear = e.year + (endBoundaryMonthRaw > 11 ? 1 : 0);
  const endBoundaryMonthNorm = (endBoundaryMonthRaw + 12) % 12;
  const endISO = dateToISO(sundayOnOrBefore(endBoundaryYear, endBoundaryMonthNorm, endBoundaryDay));

  // BT-fönster = [btStartISO, stStartISO)
  const is2021Profile = String((profile as any)?.goalsVersion || "").trim() === "2021";
  const btStartISO = (profile as any)?.btStartDate || null;
  const stStart = stStartISO || (profile as any)?.stStartDate || null;

  // Summera redan planerade BT-placeringar i FTE-månader (historik – används ej längre för faslogik)
  const btMonthsSoFar = activities
    .filter(a => a.type === "Klinisk tjänstgöring" && a.phase === "BT")
    .reduce((sum, a) => sum + (a.lengthSlots * 0.5) * ((a.attendance ?? 100) / 100), 0);
  void btMonthsSoFar; // behåll variabeln för att undvika TS-varning, men utan effekt på fas

  let phase: "BT" | "ST" = "ST";
  if (is2021Profile && btStartISO && stStart) {
    const sMs = new Date(startISO + "T00:00:00").getTime();
    const bts = new Date(btStartISO + "T00:00:00").getTime();
    const sts = new Date(stStart + "T00:00:00").getTime();
    const inBtWindow = Number.isFinite(sMs) && sMs >= bts && sMs < sts;

    // Ny logik: fas beror ENBART på datumfönstret (BT-start → ST-start)
    phase = inBtWindow ? "BT" : "ST";
  }



  const newAct: Activity = {
    id: uid(),
    type: "Klinisk tjänstgöring",
    label: "",
    startSlot: start,
    lengthSlots: len,
    hue: nextHue(activities.length),
    phase,
    attendance: 100,
    supervisor: "",
    supervisorSpeciality: "",
    supervisorSite: "",
    note: "",
    leaveSubtype: "",
    exactStartISO: startISO,
    exactEndISO: endISO,
  };

  setActivities(prev => [...prev, newAct]);
  setSelectedPlacementId(newAct.id);
  setSelectedCourseId(null);
}

  function updateSelectedPlacement(upd: Partial<Activity>) {
    if (!selectedPlacement) return;
    setActivities(prev => prev.map(a => (a.id === selectedPlacement.id ? { ...a, ...upd } : a)));
  }
  function onTypeChange(t: ActivityType) { setTypeDraft(t); if (selectedPlacement) updateSelectedPlacement({ type: t }); }
  function onLabelChange(v: string) { setLabelDraft(v); if (selectedPlacement) updateSelectedPlacement({ label: v || undefined }); }
  function onMonthsChange(newMonths: number) {
    const clamped = Math.max(0.5, Math.min(120, newMonths));
    setMonthsDraft(clamped);
    if (selectedPlacement) {
      const len = Math.round(clamped * 2);
      if (!wouldOverlap(selectedPlacement.id, selectedPlacement.startSlot, len)) {
        updateSelectedPlacement({ lengthSlots: len });
      }
    }
  }

  // ---- Kurser draft ----
  function createCourseAt(dateISO: string) {
  // BT-fönster för kurser = [btStartISO, btEndISO)
  const is2021Profile = normalizeGoalsVersion((profile as any)?.goalsVersion) === "2021";
  const btStartISO: string | null = (profile as any)?.btStartDate || null;
  const btEndManual: string | null = (profile as any)?.btEndDate || null;

  let btEndISO: string | null = btEndManual;
  if (btStartISO && !btEndManual) {
    try {
      const btStartD = isoToDateSafe(btStartISO);
      btEndISO = dateToISO(addMonths(btStartD, 24)); // auto: 24 månader BT
    } catch {
      btEndISO = null;
    }
  }

  let phase: "BT" | "ST" = "ST";
  if (
    is2021Profile &&
    btStartISO &&
    btEndISO &&
    isValidISO(dateISO)
  ) {
    const sMs = Date.parse(dateISO + "T00:00:00");
    const btStartMs = Date.parse(btStartISO + "T00:00:00");
    const btEndMs = Date.parse(btEndISO + "T00:00:00");

    if (Number.isFinite(sMs) && Number.isFinite(btStartMs) && Number.isFinite(btEndMs)) {
      if (sMs >= btStartMs && sMs < btEndMs) {
        phase = "BT";
      }
    }
  }

  const c: TLcourse = {
    id: uid(),
    title: "",
    kind: "Kurs",
    city: "",
    courseLeaderName: "",
    startDate: dateISO,
    endDate: dateISO, // punkt på tidslinjen = slutdatum
    note: "",
    showAsInterval: false,
    ...(phase ? { phase } : {}),
  };
  setCourses(prev => [...prev, c]);
  switchActivity(null, c.id);
}





function updateSelectedCourse(upd: Partial<TLcourse>) {
  if (!selectedCourse) return;
  setCourses(prev =>
    prev.map(c => {
      if (c.id !== selectedCourse.id) return c;
      const next: TLcourse = { ...c, ...upd };

      // Om kursen är/blev Psykoterapi eller markerad som tidsintervall
      // → säkerställ giltiga start/slut-datum
      const titleKind = `${next.title || ""} ${next.kind || ""}`.toLowerCase();
      const isPsy = /(^|\s)psykoterapi/.test(titleKind);

      let showAsInterval =
        typeof next.showAsInterval === "boolean" ? next.showAsInterval : undefined;

      // Psykoterapi ska ha intervall-läget på som default om det inte redan är satt
      if (showAsInterval == null && isPsy) {
        showAsInterval = true;
      }
      next.showAsInterval = showAsInterval;

      if (showAsInterval) {
        const fallback =
          (next.certificateDate && isValidISO(next.certificateDate))
            ? next.certificateDate
            : todayISO();

        if (!next.startDate || !isValidISO(next.startDate)) next.startDate = fallback;
        if (!next.endDate   || !isValidISO(next.endDate))   next.endDate   = fallback;
      }

      // Re-fasning vid varje ändring: BT/ST enbart utifrån BT-start + BT-slut i profil
      const is2021Profile = normalizeGoalsVersion((profile as any)?.goalsVersion) === "2021";
      const btStartISO: string | null = (profile as any)?.btStartDate || null;
      const btEndManual: string | null = (profile as any)?.btEndDate || null;

      let btEndISO: string | null = btEndManual;
      if (btStartISO && !btEndManual) {
        try {
          const btStartD = isoToDateSafe(btStartISO);
          btEndISO = dateToISO(addMonths(btStartD, 24));
        } catch {
          btEndISO = null;
        }
      }

      let phase: "BT" | "ST" = (next as any).phase || "ST";
      const startISO =
        next.startDate ||
        next.certificateDate ||
        next.endDate ||
        undefined;

      if (
        is2021Profile &&
        btStartISO &&
        btEndISO &&
        startISO &&
        isValidISO(startISO)
      ) {
        const sMs = Date.parse(startISO + "T00:00:00");
        const btStartMs = Date.parse(btStartISO + "T00:00:00");
        const btEndMs = Date.parse(btEndISO + "T00:00:00");

        if (Number.isFinite(sMs) && Number.isFinite(btStartMs) && Number.isFinite(btEndMs)) {
          phase = (sMs >= btStartMs && sMs < btEndMs) ? "BT" : "ST";
        }
      } else {
        phase = "ST";
      }

      (next as any).phase = phase;

      return next;
    })
  );
}







  async function deleteSelectedCourse() {
  if (!selectedCourse) return;
  const id = selectedCourse.id;
  const linkedId = selectedCourse.linkedCourseId;
  if (linkedId) {
    try { await (db as any).courses?.delete?.(linkedId); } catch {}
    await refreshLists();
  }
  setCourses(prev => prev.filter(c => c.id !== id));
  setSelectedCourseId(null);
}

  async function deleteSelectedPlacement() {
    if (!selectedPlacement) return;
    const a = selectedPlacement;
    if (a.linkedPlacementId) {
      try {
        await db.placements.delete(a.linkedPlacementId);
      } catch {}
    }
    setActivities((prev) => prev.filter((x) => x.id !== a.id));
    setSelectedPlacementId(null);
    await refreshLists();
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
            // Placering (tillåt flytt mellan år + förlängning över årsskifte åt höger, utan flimrande)
      if (dragPlacementRef.current) {
        const d = dragPlacementRef.current;

        // GLOBAL kolumn (halvmånader) över alla synliga år – med X-överspill mellan rader
        // gör att man kan dra förbi dec → jan nästa år och förbi jan ← dec föregående
        const colPerYear = slotsPerYear();              // t.ex. 24
        const localColFloat = (e.clientX - d.rowLeft) / d.colWidth;
        const localCol = Math.floor(localColFloat);     // kan bli <0 eller >= colPerYear

        // räkna ut hur många hela "årsbredd­er" musen spillt över i X-led
        // (negativa värden betyder att man gått förbi vänsterkant)
        const overflowRowsByX =
          localCol < 0
            ? Math.floor(localCol / colPerYear) // t.ex. -1, -2 ...
            : Math.floor(localCol / colPerYear); // 0, 1, 2 ...

        // även Y-led (musens rad i höjdled), rundad till närmaste rad från start-raden
        const relY = e.clientY - (d.rowTop + d.rowHeight / 2);
        const rowsOffsetY = Math.round(relY / d.rowHeight);

        // sammanlagd målrad = start-rad + (Y-förskjutning) + (X-överspill)
        const rawTargetRow = d.startRowIndex + rowsOffsetY + overflowRowsByX;
        const targetRowIndex = clamp(rawTargetRow, 0, Math.max(0, visibleYearCount - 1));

        // kolumn inom målrad (modulo årsbredd), håll den inom [0, colPerYear-1]
        const colWithinRow = ((localCol % colPerYear) + colPerYear) % colPerYear;

        // global kolumn nu och delta mot start
        const startColGlobal = d.startRowIndex * colPerYear + d.startCol;
        const nowColGlobal = targetRowIndex * colPerYear + colWithinRow;
        const deltaColsGlobal = nowColGlobal - startColGlobal;


        // 3) Globala gränser i slots för hela den synliga tidslinjen
        const minSlotGlobal = 0;
        const maxSlotGlobal = visibleYearCount * slotsPerYear();

        // 4) Hjälpare för överlapp
        const overlapsAt = (start: number, len: number) => {
          const end = start + Math.max(1, len);
          for (const a of activities) {
            if (a.id === d.id) continue;
            const a0 = a.startSlot, a1 = a.startSlot + a.lengthSlots;
            if (start < a1 && a0 < end) return true;
          }
          return false;
        };

                        if (d.mode === "move") {
          // Flytta hela blocket i halvmånader + hela år (stabilt, utan automatisk "hoppa till ledig plats")
          let newStart = d.startSlot + deltaColsGlobal;

          // Klampa inom globala gränser (så blocket får plats)
          newStart = clamp(
            newStart,
            minSlotGlobal,
            Math.max(minSlotGlobal, maxSlotGlobal - d.lengthSlots)
          );

          // Tillåt inte överlapp med andra placeringar
          if (overlapsAt(newStart, d.lengthSlots)) {
            return;
          }

          // Uppdatera slots + fas (placeringslogik som tidigare)
          setActivities((prev) =>
            prev.map((a) => {
              if (a.id !== d.id) return a;

              const goals2021 =
                String((profile as any)?.goalsVersion || "").trim() === "2021";
              const btISO = (profile as any)?.btStartDate || null;
              const stISO = stStartISO || (profile as any)?.stStartDate || null;

              let phase: "BT" | "ST" = (a as any).phase || "ST";
              if (goals2021 && btISO && stISO) {
                const s = slotToYearMonthHalf(startYear, newStart);
                const startD = mondayOnOrAfter(
                  s.year,
                  s.month0,
                  s.half === 0 ? 1 : 15
                );
                const startISO = dateToISO(startD);
                const sMs = new Date(startISO + "T00:00:00").getTime();
                const bts = new Date(btISO + "T00:00:00").getTime();
                const sts = new Date(stISO + "T00:00:00").getTime();
                if (Number.isFinite(sMs) && sMs >= bts && sMs < sts) {
                  phase = "BT";
                } else {
                  phase = "ST";
                }
              }

              return {
                ...a,
                startSlot: newStart,
                phase,
              };
            })
          );

          // Synka detaljrutan → exakta datum + BT/ST-fas med 7/22-logiken
          setFormDatesFromSlots(newStart, d.lengthSlots);
          // Dirty-state uppdateras automatiskt via checkDirty

          return;
        }





        if (d.mode === "resize-left") {
          // Flytta vänsterkanten (start) – sätt startslot ABSOLUT mot musen (kan korsa år)
          const startSlotGlobal = targetRowIndex * colPerYear + colWithinRow;

          // Fast högerkant = ursprungligt slut
          const endSlotFixed = d.startSlot + d.lengthSlots - 1;

          // Minst 1 slot kvar mellan ny start och fast högerkant
          let newStart = clamp(startSlotGlobal, minSlotGlobal, endSlotFixed);
          let newLen = Math.max(1, endSlotFixed - newStart + 1);

          // Justera om överlapp (håll fast högerkanten = endSlotFixed)
          if (overlapsAt(newStart, newLen)) {
            // 1) flytta start åt höger upp till fast högerkant
            while (overlapsAt(newStart, newLen) && newStart < endSlotFixed) {
              newStart++;
              newLen = Math.max(1, endSlotFixed - newStart + 1);
            }
            // 2) om det fortfarande överlappar: fortsätt krympa från vänster
            while (newLen > 1 && overlapsAt(newStart, newLen)) {
              newStart++;
              newLen = Math.max(1, endSlotFixed - newStart + 1);
            }
            if (overlapsAt(newStart, newLen)) return;
          }

          // Uppdatera slots + fas
          setActivities(prev => prev.map(a => {
            if (a.id !== d.id) return a;

            return {
              ...a,
              startSlot: newStart,
              lengthSlots: newLen,
              phase: phaseForSlots(newStart, newLen),
            };
          }));

          // Synka detaljrutan (exakta datum och fas) med nya slots
          setFormDatesFromSlots(newStart, newLen);
          // Dirty-state uppdateras automatiskt via checkDirty

          return;
        }



        if (d.mode === "resize-right") {
          // Flytta högerkanten (slut) – sätt slutslot ABSOLUT mot musen (tillåter dec→jan)
          const endSlotGlobal = targetRowIndex * colPerYear + colWithinRow;
          let newLen = Math.max(1, endSlotGlobal - d.startSlot + 1);

          // Klampa mot höger globalgräns (så vi inte ritar utanför synlig tidslinje)
          newLen = Math.min(newLen, Math.max(1, maxSlotGlobal - d.startSlot));

          // Justera om överlapp
          if (overlapsAt(d.startSlot, newLen)) {
            while (newLen > 1 && overlapsAt(d.startSlot, newLen)) newLen--;
            if (overlapsAt(d.startSlot, newLen)) return;
          }

          // Uppdatera slots + fas
          setActivities(prev =>
            prev.map(a => {
              if (a.id !== d.id) return a;

              return {
                ...a,
                lengthSlots: newLen,
                phase: phaseForSlots(a.startSlot, newLen),
              };
            })
          );

          // Synka detaljrutan med nya slots (slutdatum till närmaste söndag enligt 7/22-regeln)
          setFormDatesFromSlots(d.startSlot, newLen);
          // Dirty-state uppdateras automatiskt via checkDirty

          return;
        }


      }





      // Kurs
      if (dragCourseRef.current) {
        const d = dragCourseRef.current;

        // Beräkna kolumn (dag) utifrån faktisk radbredd och antal dagar
        const x = e.clientX - d.rowLeft;
        const col = Math.floor((x / d.rowWidth) * d.daysInYear);
        let dayIndex = Math.max(0, Math.min(d.daysInYear - 1, col));

        // Definiera årsspann för vertikal flytt
        const firstYear = startYear - yearsAbove;
        const lastYear = startYear + totalYearsNeeded - 1 + yearsBelow;

        // Hantera vertikal flytt mellan år (fix: förhindra att den ”rinner” ned till sista året)
        const y = e.clientY - d.rowTop;
        const hysteresis = 8; // px buffert för att undvika studs vid kant
        let rowDelta = 0;
        if (y < -hysteresis) rowDelta = -1;
        else if (y > d.rowHeight + hysteresis) rowDelta = 1;

        // Behåll ett lokalt targetYear som används längre ned när ISO beräknas
        let targetYear = d.year;

        if (rowDelta !== 0) {
          const nextYear = Math.max(firstYear, Math.min(lastYear, d.year + rowDelta));
          const nextDays = daysInYear(nextYear);

          // Justera dayIndex till nya året
          dayIndex = Math.max(0, Math.min(nextDays - 1, dayIndex));

          // Uppdatera drag-state så att fortsatt drag beräknas relativt den nya raden
          dragCourseRef.current.year = nextYear;
          dragCourseRef.current.daysInYear = nextDays;

          // VIKTIGT: flytta referens-toppunkten en rad ned/upp,
          // annars blir y fortsatt långt > rowHeight och vi kliver år för år i varje mousemove.
          dragCourseRef.current.rowTop = d.rowTop + rowDelta * d.rowHeight;

          // Uppdatera lokalt år som används längre ned
          targetYear = nextYear;
        }



        // Omvandla dayIndex + targetYear till ISO
        const yearStartISO = `${targetYear}-01-01`;
        const s = isoToDateSafe(yearStartISO);
        const newDate = new Date(s.getFullYear(), 0, 1);
        newDate.setDate(1 + dayIndex);
        const iso = dateToISO(newDate);

        setCourses(prev => prev.map(c => {
          if (c.id !== d.id) return c;

          const isPsy = /(^|\s)psykoterapi/i.test(`${c.title || ""} ${c.kind || ""}`);
          const showAsInterval = (c as any)?.showAsInterval;
          const isInterval = !!showAsInterval || isPsy;

          // Ingen automatisk phasning av kurs vid drag – behåll c.phase


          if (isInterval) {

            if (d.mode === "end") {
              let newStart = c.startDate || iso;
              let newEnd = iso;

              if (c.startDate && c.endDate && d.mode === "move") {
                const spanDays = Math.max(
                  0,
                  Math.round(
                    (new Date((c.endDate as string) + "T00:00:00").getTime() -
                      new Date((c.startDate as string) + "T00:00:00").getTime()) / 86400000
                  )
                );
                const shiftedStart = new Date(new Date(iso).getTime() - spanDays * 86400000);
                newStart = dateToISO(shiftedStart);
              }

              if (newEnd < newStart) newEnd = newStart;

              // Behåll befintlig fas
              return { ...c, startDate: newStart, endDate: newEnd };

            }

            // move/start: behåll slut om möjligt
            let newStart = iso;
            let newEnd = c.endDate || c.certificateDate || iso;

            if (d.mode === "move" && c.startDate && c.endDate) {
              const spanDays = Math.max(
                0,
                Math.round(
                  (new Date((c.endDate as string) + "T00:00:00").getTime() -
                    new Date((c.startDate as string) + "T00:00:00").getTime()) / 86400000
                )
              );
              const shiftedEnd = new Date(new Date(iso).getTime() + spanDays * 86400000);
              newEnd = dateToISO(shiftedEnd);
            }

            if (newEnd < newStart) newEnd = newStart;

            const phase = phaseForCourseDates(newStart);
            return { ...c, startDate: newStart, endDate: newEnd, phase };

          }

          // STANDARDKURS: startdatum = slutdatum när den flyttas
          const nextStart = iso;
          const nextEnd   = iso;
          const phase = phaseForCourseDates(nextStart);
          return { ...c, startDate: nextStart, endDate: nextEnd, phase };


        }));
      }



    }
    async function onUp() {
      // Kolla om vi faktiskt hade ett drag igång (placement eller kurs)
      const hadPlacementDrag = !!dragPlacementRef.current;
      const hadCourseDrag = !!dragCourseRef.current;

      // Nollställ drag-state
      dragPlacementRef.current = null;
      dragCourseRef.current = null;

      // Om något av dem var aktivt → tidslinjen har potentiellt ändrats
      // Dirty-state uppdateras automatiskt via checkDirty
    }



       window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    // eslint-disable-next-line 
react-hooks/exhaustive-deps
  }, [activities, courses, selectedPlacementId, selectedCourseId]);


  // sync drafts med valt objekt — ÄNDRAT: lyssna även på activities/cour



  // sync drafts med valt objekt — ÄNDRAT: lyssna även på activities/courses för live-uppdatering
  useEffect(() => {
    if (!selectedPlacementId) return;
    const a = activities.find(x => x.id === selectedPlacementId);
    if (!a) return;
    setTypeDraft(a.type);
    setLabelDraft(a.label || "");
    setMonthsDraft(Math.max(0.5, a.lengthSlots / 2)); // följer live
  }, [selectedPlacementId, activities]);

  useEffect(() => {
    if (!selectedCourseId) return;
    const c = courses.find(x => x.id === selectedCourseId);
    if (!c) return;
    setCourseTypeDraft(c.kind);
    setCourseTitleDraft(c.title);
    setCourseDateDraft(c.certificateDate); // följer live
  }, [selectedCourseId, courses]);

  // minus-knappar (yttersta år)
  function yearHasCourse(y: number) {
    return courses.some(c => isValidISO(c.certificateDate) && new Date(c.certificateDate + "T00:00:00").getFullYear() === y);
  }
  function yearHasActivity(y: number) {
    const yStart = (y - startYear) * slotsPerYear();
    const yEnd = yStart + slotsPerYear();
    return activities.some(a => a.startSlot < yEnd && (a.startSlot + a.lengthSlots) > yStart);
  }
  function yearHasData(y: number) { return yearHasCourse(y) || yearHasActivity(y); }
  function removeBottomYear(y: number) {
    const bottomYear = startYear + totalYearsNeeded - 1 + yearsBelow;
    if (y !== bottomYear) return;
    if (yearHasData(y) && !confirm("Det finns aktiviteter/kurser detta år. Vill du verkligen ta bort året?")) return;
    setYearsBelow(n => Math.max(0, n - 1));
  }

  // rubrik
  function MonthHeader() {
    return (
      <div 
        className="grid grid-cols-[80px_1fr] items-end sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-slate-200 cursor-pointer"
        onClick={() => {
          // Om något är valt, stäng detaljrutan med varning om dirty
          if (selectedPlacementId || selectedCourseId) {
            closeDetailPanel();
          }
        }}
      >
        <div className="pr-2" />
        <div className="relative">
          <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] text-xs text-slate-700">
            {MONTH_NAMES.map((m) => (
              <div key={m} className="col-span-2 text-center font-medium pb-1">{m}</div>
            ))}
          </div>
          
        </div>
      </div>
    );
  }

  // årsrad
  function renderYearRow(rowIndex: number) {
    const year = startYear - yearsAbove + rowIndex;
    const rowStartSlot = (year - startYear) * slotsPerYear();
    const rowEndSlot = rowStartSlot + slotsPerYear();

    // plan-gränser
// 1) ST-start (gul): som tidigare
const rawStStartSlot = stStartISO ? dateToSlot(startYear, stStartISO, "start") : 0;
const snappedStartBoundarySlot = rawStStartSlot; // H1 behålls som H1, H2 behålls som H2 (8–22 = halvmånad)

const startBoundaryCol = snappedStartBoundarySlot - rowStartSlot;

// 2) ST-slut (röd): som tidigare
const endBoundarySlot = stEndISO
  ? dateToSlot(startYear, stEndISO, "end")
  : (stStartISO ? dateToSlot(startYear, stStartISO, "start") + baseSlots : totalSlots);
const endBoundaryCol = endBoundarySlot - rowStartSlot;

// 3) 2021: BT-start (grön) och synlig-start för skuggning
const goals = String((profile as any)?.goalsVersion || "").trim();
const is2021Profile = goals === "2021";
const btStartISO = (profile as any)?.btStartDate as (string | undefined);
const rawBtStartSlot = (is2021Profile && btStartISO) ? dateToSlot(startYear, btStartISO, "start") : null;
const snappedBtStartSlot = (rawBtStartSlot != null) ? rawBtStartSlot : null; // behåll exakt halvmånad


// 4) Synlig start för ”inside”/”outside” (2021 → BT, annars ST)
const visibleStartSlot = (is2021Profile && snappedBtStartSlot != null)
  ? snappedBtStartSlot
  : snappedStartBoundarySlot;



    const coursesThisYear = courses.filter((c) => {
  const titleKind = `${c.title || ""} ${c.kind || ""}`.toLowerCase();
  const isPsy = /(^|\s)psykoterapi/.test(titleKind);
  const showAsInterval = (c as any).showAsInterval || isPsy;

  // Årets datumspann
  const yearStartISO = `${year}-01-01`;
  const yearEndISO   = `${year}-12-31`;

  if (showAsInterval) {
    // Intervall-kurser (psykoterapi + andra med "Visa som tidsintervall") visas
    // i alla år som intervallet överlappar.
    const sISO = c.startDate || c.certificateDate;
    const eISO = c.endDate   || c.certificateDate;
    if (!isValidISO(sISO) || !isValidISO(eISO)) return false;
    const s = isoToDateSafe(sISO);
    const e = isoToDateSafe(eISO);
    const y0 = isoToDateSafe(yearStartISO);
    const y1 = isoToDateSafe(yearEndISO);
    return !(+e < +y0 || +s > +y1);
  }

  // STANDARDKURS:
  // Vanligtvis: rendera bara i det år där slutdatumet ligger…
  const endISO = c.endDate || c.certificateDate;
  if (!isValidISO(endISO)) return false;
  const endYear = isoToDateSafe(endISO).getFullYear();
  if (endYear === year) return true;


  // …MEN om detta är kursen vi DRAR just nu i den här årsraden: visa den ändå,
  // så att vi kan "kant-stanna" pillen visuellt.
  const dragging = dragCourseRef.current && dragCourseRef.current.id === c.id;
  const draggingOnThisRow = dragging && dragCourseRef.current!.year === year;
  return !!draggingOnThisRow;
});




    const totalDays = daysInYear(year);
    const bottomYear = startYear + totalYearsNeeded - 1 + yearsBelow;

    return (
      <div key={year} className="grid grid-cols-[80px_1fr] items-stretch">
        {/* vänster år + ev − */}
        <div className="pr-2 py-1 text-right font-semibold select-none flex items-center justify-end gap-1">
          {year === bottomYear && yearsBelow > 0 && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeBottomYear(year); }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 text-sm hover:bg-slate-50"
              title="Ta bort år underst"
            >−</button>
          )}
          <span>{year}</span>
        </div>

        {/* Års-kort */}
       <div
  className="st-row relative isolate bg-white"
  style={{
    height: "2.6rem",
    backgroundImage:
      "linear-gradient(to right, rgba(148,163,184,.35) 1px, transparent 1px)",
    backgroundSize: "calc(100% / 24) 100%",
    backgroundRepeat: "repeat-x",
    backgroundPosition: "0 0",
    borderTopLeftRadius: "2px",
    borderTopRightRadius: "2px",
    borderBottomLeftRadius: year === bottomYear ? "2px" : "0px",
    borderBottomRightRadius: year === bottomYear ? "2px" : "0px",
    // Klipp all målning (inkl. skuggor) vid de rundade hörnen:
    overflow: "visible",

  }}
  onMouseLeave={() => setHover(null)}
>





          {/* Starkare månads-linjer i aktivitetsraden */}
          <div
  className="pointer-events-none absolute inset-0"
  style={{
    zIndex: 10,
    // EN tjockare månads-linje (mörkare), över halvmånaden, genom båda lanes
    backgroundImage:
      "linear-gradient(to right, rgba(100,116,139,.85) 2px, transparent 2px)",
    backgroundSize: "calc(100% / 12) 100%",
    backgroundRepeat: "repeat-x",
backgroundPosition: "0 0",          // ← samma origin som halvmånad

  }}
/>

{/* ÅRSSEPARATOR: vitt band precis under KURS-lanen */}
<div
  className="pointer-events-none absolute inset-x-0 z-[15]"
  style={{
    bottom: "-1px",      // hamnar precis under kurs-lanens botten/border
    height: "3px",       // bandets tjocklek (4–6 px funkar bra)
    background: "white", // maskar alla mörka linjer under
  }}
/>


          <div
            className="grid grid-cols-[repeat(24,minmax(0,1fr))]"
            style={{ gridTemplateRows: "1.75rem 0.75rem" }}
          >
            {/* Rad 1: aktivitetsceller */}
            {Array.from({ length: COLS }, (_, i) => {
              const globalSlot = rowStartSlot + i;
              const outside = globalSlot < visibleStartSlot || globalSlot >= endBoundarySlot;


              const monthIndex = Math.floor(i / 2);
              const insideCls = monthIndex % 2 ? "bg-slate-50" : INSIDE_BG_CELL;

              return (
                <div
                  key={`cell1-${i}`}
                  className={[
  "relative z-0 h-7 cursor-crosshair border-t border-slate-300",
  outside ? OUTSIDE_BG_CELL : insideCls,
  outside ? "" : "hover:bg-slate-100"
].join(" ")}

                  title={`${MONTH_NAMES[monthIndex]} ${year} · ${i%2 ? "H2" : "H1"}`}
                  onMouseEnter={() => setHover({ row: rowIndex, col: i })}
                  onMouseLeave={() => setHover(h => (h?.row === rowIndex && h?.col === i ? null : h))}
                  onClick={() => {
                    // Om något är valt, stäng detaljrutan med varning om dirty
                    if (selectedPlacementId || selectedCourseId) {
                      closeDetailPanel();
                      return;
                    } else {
                      // Annars skapa ny aktivitet
                      setSelectedCourseId(null);
                      addActivityAt(globalSlot);
                    }
                  }}
                  style={{ gridRowStart: 1 }}
                />
              );
            })}

            {/* Rad 2: kurs-lane */}
            {Array.from({ length: COLS }, (_, i) => {
              const globalSlot = rowStartSlot + i;
              const outside = globalSlot < visibleStartSlot || globalSlot >= endBoundarySlot;



              const { year: y2, month0: m2, half: h2 } = slotToYearMonthHalf(startYear, globalSlot);
              const defaultISO = halfMidDateISO(y2, m2, h2);

              const monthIndex = Math.floor(i / 2);
              const insideLaneCls = monthIndex % 2 ? "bg-slate-100" : INSIDE_BG_LANE;

              return (
                <div
  key={`lane-${i}`}
  className={[
  "h-3 w-full transition cursor-pointer",
  // växla mellan två lite mörkare grå
  outside ? OUTSIDE_BG_LANE : (monthIndex % 2 ? "bg-slate-200" : INSIDE_BG_LANE),
  outside ? "" : "hover:bg-slate-300",    // mörkare hover
"border-y border-slate-300",            // ← NYTT: raka kanter
].join(" ")}

  style={{ gridRowStart: 2 }}
  title={`Klicka för datum ${defaultISO}`}
  onMouseEnter={() => setHover({ row: rowIndex, col: i })}
  onMouseLeave={() => setHover(h => (h?.row === rowIndex && h?.col === i ? null : h))}
  onClick={(e) => {
    e.stopPropagation();
    // Om något är valt, stäng detaljrutan med varning om dirty
    if (selectedPlacementId || selectedCourseId) {
      closeDetailPanel();
      return;
    } else {
      // Annars skapa ny kurs
      setSelectedPlacementId(null);
      createCourseAt(defaultISO);
    }
  }}
/>

              );
            })}
          </div>

          {/* Kolumn-hover overlay i hela års-raden — borttagen */}
          {null}


          {/* PLAN-GRÄNSER: BT/BT-slut/ST-slut (2021) respektive ST-start/ST-slut (2015) */}
<div className="pointer-events-none absolute inset-0 z-[250]">
  {/* GRÖN MARKÖR */}
  {(() => {
    const goals = String((profile as any)?.goalsVersion || "").trim();
    const is2021 = goals === "2021";

    if (is2021) {
      // 2021 – BT-start (grön), faller tillbaka till ST-start om BT-start saknas
      const btISO = (profile as any)?.btStartDate || null;
      const btSlotGlobal = btISO ? dateToSlot(startYear, btISO, "start") : null;
      const slot = btSlotGlobal ?? snappedStartBoundarySlot; // fallback
      const pct = ((slot - rowStartSlot) / COLS) * 100;
      if (pct < 0 || pct > 100) return null;
      return (
        <div
          className="absolute"
          style={{
            top: 0,
            height: "1.75rem",
            left: `${pct}%`,
            width: 0,
            borderLeft: `3.5px solid ${START_LINE_COLOR}`,
            transform: "translateX(0.75px)",
          }}
          title={btSlotGlobal != null ? "BT start" : "ST start"}
        />
      );
    }

    // 2015 – ST-start (grön) på samma plats som den gula hade (snappedStartBoundarySlot)
    const slot = snappedStartBoundarySlot;
    const pct = ((slot - rowStartSlot) / COLS) * 100;
    if (pct < 0 || pct > 100) return null;
    return (
      <div
        className="absolute"
        style={{
          top: 0,
          height: "1.75rem",
          left: `${pct}%`,
          width: 0,
          borderLeft: `3.5px solid ${START_LINE_COLOR}`,
          transform: "translateX(0.75px)",
        }}
        title="ST start"
      />
    );
  })()}

  {/* GUL MARKÖR – endast 2021: Sista datum för färdig BT (profilens BT-slut). */}
  {(() => {
    const goals = String((profile as any)?.goalsVersion || "").trim();
    const is2021 = goals === "2021";
    if (!is2021) return null;

    const btISO = (profile as any)?.btStartDate || null;
    const btEndManual = (profile as any)?.btEndDate || null;
    const btSlotGlobal = btISO ? dateToSlot(startYear, btISO, "start") : null;

    let yellowSlot = snappedStartBoundarySlot; // fallback: ST-start
    let yellowTitle = "ST start";

    if (btISO) {
      try {
        // Slutdatum för BT:
        //  - om manuellt satt → använd det
        //  - annars 24 månader efter BT-start
        let btEndISO: string;
        if (btEndManual && isValidISO(btEndManual)) {
          btEndISO = btEndManual;
        } else {
          const btd = isoToDateSafe(btISO);
          btEndISO = dateToISO(addMonths(btd, 24));
        }
        // Placering på hel-/halvmånad styrs av dateToSlot(..., "end")
        yellowSlot = dateToSlot(startYear, btEndISO, "end");
        yellowTitle = "Sista datum för färdig BT";
      } catch {
        // behåll fallback (ST-start) vid ogiltigt datum
      }
    }

    const samePos = btSlotGlobal != null && btSlotGlobal === yellowSlot;
    const pct = ((yellowSlot - rowStartSlot) / COLS) * 100;

    if (pct < 0 || pct > 100 || samePos) return null;

    return (
      <div
        className="absolute"
        style={{
          top: 0,
          height: "1.75rem",
          left: `${pct}%`,
          width: 0,
          borderLeft: `3.5px solid ${MID_LINE_COLOR}`,
          transform: "translateX(0.75px)",
        }}
        title={yellowTitle}
      />
    );
  })()}

  {/* ST-SLUT (röd) */}
  {(() => {
    const pct = ((endBoundarySlot - rowStartSlot) / COLS) * 100;
    if (pct < 0 || pct > 100) return null;
    return (
      <div
        className="absolute"
        style={{
          top: 0,
          height: "1.75rem",
          left: `${pct}%`,
          width: 0,
          borderLeft: `3.5px solid ${END_LINE_COLOR}`,
          transform: "translateX(-0.25px)",
        }}
        title="ST slut"
      />
    );
  })()}

  {/* IDAG (blå linje) */}
  {(() => {
    const today = new Date();
    const yearToday = today.getFullYear();
    if (yearToday !== year) return null;

    const startOfYear = new Date(yearToday, 0, 1);
    const startOfNextYear = new Date(yearToday + 1, 0, 1);
    const msInDay = 24 * 60 * 60 * 1000;

    const dayIndex = Math.floor(
      (today.getTime() - startOfYear.getTime()) / msInDay
    );
    const daysInYear = Math.max(
      1,
      Math.floor(
        (startOfNextYear.getTime() - startOfYear.getTime()) / msInDay
      )
    );

    const frac = Math.min(Math.max(dayIndex / daysInYear, 0), 1);
    const pct = frac * 100;
    if (pct < 0 || pct > 100) return null;

    const todayISO = dateToISO(today);

    return (
      <div
        className="absolute"
        style={{
          top: 0,
          height: "1.75rem",
          left: `${pct}%`,
          width: 0,
          borderLeft: `3.5px solid ${TODAY_LINE_COLOR}`,
          transform: "translateX(0)",
        }}
        title={`Idag (${todayISO})`}
      />
    );
  })()}
</div>











          {/* OVERLAY: aktiviteter + kurser */}
          <div
  className="pointer-events-none absolute inset-0 z-[60] grid grid-cols-[repeat(24,minmax(0,1fr))] rounded-[2px]"
  style={{
    gridTemplateRows: "1.9rem 0.75rem",
    // Säkerställ att även skuggor/ringar inte kan rita utanför:
    overflow: "visible",

  }}
>





            {/* Aktiviteter */}
            <div className="contents z-40">
              {activities.map((a, idx) => {
                const a0 = a.startSlot, a1 = a.startSlot + a.lengthSlots;
                const s0 = Math.max(a0, rowStartSlot);
                const s1 = Math.min(a1, rowEndSlot);
                if (s1 <= s0) return null;

                const startCol = s0 - rowStartSlot;
                const span = s1 - s0;
                const sel = a.id === selectedPlacementId;

                const label =
                  a.type === "Klinisk tjänstgöring" || a.type === "Auskultation"
                    ? (a.label || a.type)
                    : a.type === "Annan ledighet"
                    ? (a.label || a.type)
                    : a.type;

                const style: React.CSSProperties =
  a.type === "Forskning"
    ? (
        sel
          ? {
              backgroundColor: "#ffffff",
              border: "1.5px solid hsl(220 15% 55%)",
            }
          : {
              backgroundColor: "#ffffff",
              border: "1.5px solid hsl(220 14% 80%)",
            }
      )
    : isLeave(a.type)
    ? {
        background:
          "repeating-linear-gradient(135deg, hsl(220 16% 98%), hsl(220 16% 98%) 6px, hsl(220 14% 86%) 6px, hsl(220 14% 86%) 8px)",
        // Tydligare ram för ledigheter (mindre transparent)
        border: "1px solid hsl(220 12% 60%)",
      }
    : (
        sel
          // Markerad utbildningsaktivitet: fylligare + något mörkare (text ska INTE bli vit)
          ? {
              backgroundColor: `hsl(${a.hue} 38% 82%)`,
            }
          // Ej markerad: tydligare ram (mindre transparent)
          : {
              backgroundColor: `hsl(${a.hue} 28% 88%)`,
              border: `1.5px solid hsl(${a.hue} 35% 50%)`,
            }
      );


                return (
  <div
    key={a.id + "@" + idx}
    className={[
      "relative pointer-events-auto h-7 select-none rounded-lg px-2 text-[11px] shadow border transition overflow-hidden",

      "cursor-grab active:cursor-grabbing hover:shadow-lg hover:-translate-y-[1px]",
      // Markerat: bas = lite ljusare än psykoterapi-linjen, hover = exakt psykoterapi-färgen
      (sel && !isLeave(a.type))
// Endast markerad utbildningsaktivitet: tunnare blå ram, mörk text.
? "z-[80] ring-1 ring-sky-600 border border-sky-600 text-slate-900"

// Övrigt (inkl. ledighet och ej markerade): oförändrat utseende
: "z-[65] border-slate-200",



    ].join(" ")}
    style={{
  gridRowStart: 1,
  gridColumnStart: startCol + 1,
  gridColumnEnd: startCol + 1 + span,
  // Justera visuell alignment: skjut blocket 1px åt höger och behåll högerkanten
  transform: "translateX(1.5px)",
  marginRight: "-1px",
  // Använd bara ‘style’ (HSL-nyanser) när ej markerad; markerad styrs helt via klasslistan ovan.
  ...style,
}}

    title={label}
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); switchActivity(a.id, null); }}
    onDoubleClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  const ok = switchActivity(a.id, null);
  if (!ok) return;

  // BT-fasad aktivitet
  if (a.phase === "BT") {
    // Om ST-delmål uppfyllda → öppna popup med BT-intyg / ST-intyg
    if ((a as any)?.fulfillsStGoals) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setCertMenu({
        open: true,
        x: Math.round(e.clientX),
        y: Math.round(rect.top + rect.height / 2),
        kind: "placement",
        placement: a,
        course: null,
      });

      return;
    }
    // Annars (BT utan ST-delmål) → direkt förhandsvisning av Delmål i BT
    openPreviewForBtGoals(a);
    return;
  }

  // ST-fasade aktiviteter: öppna förhandsvisning av intyg
  const v = String(profile?.goalsVersion || "");
  if (a.type === "Vetenskapligt arbete" && v.includes("2021")) {
    const isSta3 = (m: any) => {
      const id = String(m ?? "")
        .trim()
        .split(/\s|–|-|:|\u2013/)[0]
        .toLowerCase();
      return id === "a3" || id === "sta3";
    };

    const placementItems = activities
      .filter(
        (x: any) =>
          x.type === "Klinisk tjänstgöring" &&
          Array.isArray((x as any).milestones) &&
          (x as any).milestones.some(isSta3),
      )
      .map((x: any) => {
        const { startISO, endISO } = computeMondayDates(x);
        const title = x.label || x.type;
        return {
          id: (x as any).linkedPlacementId || x.id,
          title,
          period: `${startISO}${endISO ? ` – ${endISO}` : ""}`,
        };
      });

    const courseItems = courses
      .filter(
        (c: any) =>
          Array.isArray((c as any).milestones) &&
          (c as any).milestones.some(isSta3),
      )
      .map((c: any) => ({
        id: (c as any).linkedCourseId || c.id,
        title: c.title || (c as any).provider || "Kurs",
        period: [
          c.city,
          ((c as any).certificateDate || c.endDate || c.startDate || "") as string,
        ]
          .filter(Boolean)
          .join(" · "),
      }));

    setSta3Placements(placementItems);
    setSta3Courses(courseItems);
    setSta3ResearchTitle(a.label || a.note || "");
    setSta3SupervisorName(a.supervisor || "");
    setSta3SupervisorSpec(a.supervisorSpeciality || "");
    setSta3SupervisorSite(
      a.supervisorSite || (profile as any)?.homeClinic || "",
    );
    setSta3Open(true);
  } else {
    openPreviewForPlacement(a);
  }
}}



    onMouseDown={(e) => {
      e.preventDefault(); e.stopPropagation();
      const isSwitching =
        a.id !== selectedPlacementId || selectedCourseId !== null;
      const ok = switchActivity(a.id, null);
      if (!ok) return;
      setActiveLane("placement");
      // Om vi just bekräftade ett byte med dirty=true, avbryt drag/resize och låt användaren försöka igen efter bytet
      if (dirty && isSwitching) return;

      const rowEl = (e.currentTarget as HTMLElement).closest(".st-row") as HTMLElement | null;
      if (!rowEl) return;
      const rect = rowEl.getBoundingClientRect();
      const colWidth = rect.width / COLS;
      const startColClick = Math.floor((e.clientX - rect.left) / colWidth);
dragPlacementRef.current = {
  id: a.id, mode: "move", startCol: startColClick, rowLeft: rect.left, rowTop: rect.top,
  colWidth, rowHeight: rect.height, startRowIndex: rowIndex, startSlot: a.startSlot, lengthSlots: a.lengthSlots,
};

    }}
  >
    <div
      className="absolute inset-y-0 left-0 w-4 cursor-ew-resize pointer-events-auto"
      onMouseDown={(e) => {
        e.preventDefault(); e.stopPropagation();
        const isSwitching =
          a.id !== selectedPlacementId || selectedCourseId !== null;
        const ok = switchActivity(a.id, null);
        if (!ok) return;
        setActiveLane("placement");
        if (dirty && isSwitching) return;

        const rowEl = (e.currentTarget as HTMLElement).closest(".st-row") as HTMLElement | null;
        if (!rowEl) return;
        const rect = rowEl.getBoundingClientRect();
        const colWidth = rect.width / COLS;
        const startColClick = Math.round((e.clientX - rect.left) / colWidth);
        dragPlacementRef.current = {
          id: a.id, mode: "resize-left", startCol: startColClick, rowLeft: rect.left, rowTop: rect.top,
          colWidth, rowHeight: rect.height, startRowIndex: rowIndex, startSlot: a.startSlot, lengthSlots: a.lengthSlots,
        };
      }}
      title="Dra för att korta/förlänga åt vänster"
    />
    <div
      className="absolute inset-y-0 right-0 w-4 cursor-ew-resize pointer-events-auto"
      onMouseDown={(e) => {
        e.preventDefault(); e.stopPropagation();
        const isSwitching =
          a.id !== selectedPlacementId || selectedCourseId !== null;
        const ok = switchActivity(a.id, null);
        if (!ok) return;
        setActiveLane("placement");
        if (dirty && isSwitching) return;

        const rowEl = (e.currentTarget as HTMLElement).closest(".st-row") as HTMLElement | null;
        if (!rowEl) return;
        const rect = rowEl.getBoundingClientRect();
        const colWidth = rect.width / COLS;
        const startColClick = Math.round((e.clientX - rect.left) / colWidth);
        dragPlacementRef.current = {
          id: a.id, mode: "resize-right", startCol: startColClick, rowLeft: rect.left, rowTop: rect.top,
          colWidth, rowHeight: rect.height, startRowIndex: rowIndex, startSlot: a.startSlot, lengthSlots: a.lengthSlots,
        };
      }}
      title="Dra för att förlänga åt höger"
    />
    <span className="block w-full truncate">{label}</span>
  </div>
);

              })}
            </div>

                        {/* Kurser */}
                        <div
  ref={(el) => {
    laneRefs.current[year] = el;
    if (el) {
      const w = el.clientWidth || el.offsetWidth || 0;
      if (laneWidthByYear[year] !== w) {
        setLaneWidthByYear(prev => ({ ...prev, [year]: w }));
      }
    }
  }}
  className="relative pointer-events-none z-[120]"
  style={{
    gridRowStart: 2,
    gridColumn: "1 / -1",
    height: "0.75rem",
    overflow: "visible", // ← viktigast: låt piggen få sticka ut lite
  }}
>
  {/* Handledningstrianglar i kursspåret */}
  {supervisionSessions
    .filter((s) => {
      if (!showSupervisionOnTimeline) return false;
      if (!s.dateISO || !isValidISO(s.dateISO)) return false;
      const d = isoToDateSafe(s.dateISO);
      return d.getFullYear() === year;
    })
    .map((s) => {

      const d = isoToDateSafe(s.dateISO);
      const startOfYear = new Date(year, 0, 1);
      const startOfNextYear = new Date(year + 1, 0, 1);
      const msInDay = 24 * 60 * 60 * 1000;

      const dayIndex = Math.floor(
        (d.getTime() - startOfYear.getTime()) / msInDay
      );
      const daysInYearLocal = Math.max(
        1,
        Math.floor(
          (startOfNextYear.getTime() - startOfYear.getTime()) / msInDay
        )
      );

      const frac = Math.min(
        Math.max(dayIndex / daysInYearLocal, 0),
        1
      );
      const pct = frac * 100;
      if (pct < 0 || pct > 100) return null;

      const isHovered = hoveredSupervisionId === s.id;
      const baseColor = "#059669"; // sky-400-ish
      const hoverColor = "#34d399"; // sky-300-ish

      return (
        <button
          key={s.id + "@" + year}
          type="button"
          className="pointer-events-auto absolute"
          style={{
            left: `${pct}%`,
            bottom: "2.4rem",
            transform: isHovered
              ? "translate(-50%, -1px)"
              : "translate(-50%, 0)",
          }}
          onMouseEnter={() => setHoveredSupervisionId(s.id)}
          onMouseLeave={() =>
            setHoveredSupervisionId((prev) =>
              prev === s.id ? null : prev
            )
          }
          onClick={(e) => {
            e.stopPropagation();
            setIupInitialTab("handledning");
            setIupInitialMeetingId(s.id);
            setIupOpen(true);
          }}
          title={
            s.title && s.title.trim()
              ? `${s.title} (${s.dateISO})`
              : s.dateISO
          }
        >
          <span
            aria-hidden="true"
            style={{
              position: "relative",
              display: "block",
              width: 0,
              height: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "7px solid transparent",
                borderRight: "7px solid transparent",
                borderBottom: "11px solid #064e3b", // mörkare emerald-900
              }}
            />
            <span
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%) translateY(1px)",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderBottom: isHovered
                  ? "9px solid #34d399" // emerald-400 vid hover
                  : "9px solid #059669", // emerald-600 som standard
              }}
            />
          </span>
                </button>
      );
    })}

  {/* Progressionsbedömningar – stjärnor i kursspåret */}
  {assessmentSessions
    .filter((a) => {
      if (!showAssessmentsOnTimeline) return false;
      if (!a.dateISO || !isValidISO(a.dateISO)) return false;
      const d = isoToDateSafe(a.dateISO);
      return d.getFullYear() === year;
    })
    .map((a) => {

      const d = isoToDateSafe(a.dateISO);
      if (isNaN(d.getTime())) return null;

      const total = Math.max(1, daysInYear(year) - 1);
      const dayIndex = dayOfYear(d);
      const pct = clamp((dayIndex / total) * 100, 0, 100);

      const isHovered = hoveredAssessmentId === a.id;

      const baseColor = "#f59e0b"; // varm gul/orange (amber-500)
      const hoverColor = "#facc15"; // ljusare gul (amber-400)
      const strokeColor = "#d97706"; // lite mörkare orange kant

      return (
        <button
          key={a.id + "@assess@" + year}
          type="button"
          className="pointer-events-auto absolute"
          style={{
            left: `${pct}%`,
            bottom: "1.6rem",
            transform: isHovered
              ? "translate(-50%, -1px) scale(1.05)"
              : "translate(-50%, 0) scale(1)",
          }}
          onMouseEnter={() => setHoveredAssessmentId(a.id)}
          onMouseLeave={() =>
            setHoveredAssessmentId((prev) =>
              prev === a.id ? null : prev
            )
          }
          onClick={(e) => {
            e.stopPropagation();
            setIupInitialTab("handledning");
            setIupInitialAssessmentId(a.id);
            setIupOpen(true);
          }}
          title={
            a.title && a.title.trim()
              ? `${a.title} (${a.dateISO})`
              : a.dateISO
          }
        >
          <svg
            aria-hidden="true"
            width={16}
            height={16}
            viewBox="0 0 24 24"
            style={{ display: "block" }}
          >
            <path
              d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
              fill={isHovered ? hoverColor : baseColor}
              stroke={strokeColor}
              strokeWidth={1.3}
              strokeLinejoin="round"
            />
          </svg>
        </button>
      );
    })}

              {coursesThisYear.map(c => {


                const sel = c.id === selectedCourseId;

                // Hjälpare
                const total = Math.max(1, daysInYear(year) - 1);
                const toPct = (iso?: string) => {
                  if (!iso || !isValidISO(iso)) return null;
                  const d = isoToDateSafe(iso);
                  if (d.getFullYear() !== year) return null;
                  return (dayOfYear(d) / total) * 100;
                };

                // Special: intervall-kurser (psykoterapi + "Visa som tidsintervall")
// visas som intervall med start/slut + blått band.
// Nu stöd för att sträcka bandet över flera år (år-till-år-segment).
if ((c as any).showAsInterval || /(^|\s)psykoterapi/i.test(`${c.title || ""} ${c.kind || ""}`)) {

  const sISO = c.startDate || c.certificateDate;
  const eISO = c.endDate   || c.certificateDate;
  if (!isValidISO(sISO) || !isValidISO(eISO)) return null;

  // Normalisera start/slut
  let sDate = isoToDateSafe(sISO);
  let eDate = isoToDateSafe(eISO);
  if (+eDate < +sDate) [sDate, eDate] = [eDate, sDate];

  // Den här årsradens spann
  const yearStart = isoToDateSafe(`${year}-01-01`);
  const yearEnd   = isoToDateSafe(`${year}-12-31`);

  // Om inget överlapp med det här året, rendera inget
  if (+eDate < +yearStart || +sDate > +yearEnd) return null;

  // Hjälpare för procentplacering inom året
  const total = Math.max(1, daysInYear(year) - 1);
  const pctOfYear = (d: Date) => (dayOfYear(d) / total) * 100;

  // Segment inom detta år: börja vänster kant vid årets början om start ligger tidigare,
  // och höger kant vid årets slut om slut ligger senare.
  const segStart = +sDate <= +yearStart ? yearStart : sDate;
  const segEnd   = +eDate >= +yearEnd   ? yearEnd   : eDate;

  const leftPct  = segStart.getFullYear() === year ? pctOfYear(segStart) : 0;
  const rightPct = segEnd.getFullYear()   === year ? pctOfYear(segEnd)   : 100;

  const bandLeft  = Math.min(leftPct, rightPct);
  const bandRight = Math.max(leftPct, rightPct);
  const bandWidth = Math.max(0, bandRight - bandLeft);

  return (
    <React.Fragment key={c.id}>
      {/* Blått band som kan fortsätta över flera år */}
      {bandWidth > 0 && (
  <div
  className="absolute top-1/2 h-2 rounded-full bg-blue-300/70 z-[60]"

  style={{
    left: `${bandLeft}%`,
    width: `${bandWidth}%`,
    // Höj bandet ett par pixlar i lane:en
    transform: "translateY(calc(-50% - 2px))",
  }}
/>

)}

      {/* Startmarkör – renderas endast i det år där startdatumet faktiskt ligger */}
      { (() => {
  const d = sDate; // Date för start
  const laneW = laneWidthByYear[year] || 0;
  // Visa start-pill/pigg bara i det år där startdatumet faktiskt ligger
  if (d.getFullYear() !== year) {
    return null;
  }


  // Procent inom årets spann (kan vara null om start inte ligger detta år)
  const total = Math.max(1, daysInYear(year) - 1);
  const startPct = (d.getFullYear() === year) ? (dayOfYear(d) / total) * 100 : null;

  // "Sann" center i px (kan hamna utanför lane om datumet ligger utanför året)
  let trueCenterPx: number;
  if (startPct == null) {
    trueCenterPx = (d.getFullYear() < year) ? -1 : laneW + 1;
  } else {
    trueCenterPx = (startPct / 100) * laneW;
  }

  // Mät pillbredd → clamp:a pillens center inne i lane
  const measured = chipWidthsRef.current[c.id + "_psy_start"] || 0;
  const half = Math.max(1, measured / 2);
  const clampedCenterPx = clamp(trueCenterPx, half, Math.max(half, laneW - half));

  // Piggens visning (exakta datumet), clamp:a till 0/100 om utanför året
  const piggPct = (startPct == null)
    ? (d.getFullYear() < year ? 0 : 100)
    : clamp(startPct, 0, 100);

  const sel = c.id === selectedCourseId;
  const hovered = hoveredCourseId === c.id;

  return (
    <React.Fragment key={c.id + "_psy_start"}>

      {/* START-PILL – klämd inne i lane */}
      <div
        ref={(el) => {
          if (el) {
            const w = el.offsetWidth || 0;
            if (w && chipWidthsRef.current[c.id + "_psy_start"] !== w) {
              chipWidthsRef.current[c.id + "_psy_start"] = w;
              forceRerender(n => n + 1);
            }
          }
        }}
        className={`absolute z-[150] top-1/2 -translate-y-1/2 pointer-events-auto select-none rounded-full px-2 h-5 flex items-center text-[10.5px] border cursor-grab active:cursor-grabbing shadow-sm transition-transform transition-colors ${
          sel
            ? "text-white bg-sky-600 border-sky-800 hover:bg-sky-500 hover:border-sky-700 hover:shadow-md"
            : "text-white bg-sky-700 border-sky-900 hover:bg-sky-600 hover:border-sky-800 hover:shadow-md"
        }`}
        style={{
          left: `${clampedCenterPx}px`,
          transform: hovered ? "translate(-50%, -58%)" : "translate(-50%, -50%)",
        }}
        title={`${c.title || "Kurs"} start — ${c.startDate || c.certificateDate}`}

        onClick={(e) => {
          e.stopPropagation();
          switchActivity(null, c.id);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const ok = switchActivity(null, c.id);
          if (!ok) return;


          // BT-kurs i tidslinjen
          if (c.phase === "BT") {
            // BT + ST-delmål → popup BT/ST
            if ((c as any)?.fulfillsStGoals) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setCertMenu({
                open: true,
                x: Math.round(e.clientX),
                y: Math.round(rect.top + rect.height / 2),
                kind: "course",
                placement: null,
                course: c,
              });
              return;
            }

            // Endast BT → direkt BT-intyg
            const dummyActivity: Activity = {
              id: c.id,
              type: "Kurs",
              label: c.title || "Kurs",
              startSlot: 0,
              lengthSlots: 1,
              hue: 0,
              phase: "BT",
              restPercent: 0,
              isLocked: false,
              btAssessment: (c as any).btAssessment || "",
              btMilestones: (c as any).btMilestones || [],
            } as any;

            openPreviewForBtGoals(dummyActivity);
            return;
          }

          // ST-kurs → ST-kursintyg via CoursePrepModal (2015 och 2021)
          if (!profile) {
            alert("Profil saknas – kan inte skapa intyget.");
            return;
          }
          setCourseForModal(c);
          setCourseModalOpen(true);

        }}


        onMouseDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          const isSwitching =
            selectedPlacementId !== null || selectedCourseId !== c.id;
          const ok = switchActivity(null, c.id);
          if (!ok) return;
          setActiveLane("course");
          if (dirty && isSwitching) return;
          const rowEl = (e.currentTarget as HTMLElement).closest(".st-row") as HTMLElement | null;
          if (!rowEl) return;
          const rect = rowEl.getBoundingClientRect();
          dragCourseRef.current = {
            id: c.id,
            year,
            rowLeft: rect.left,
            rowTop: rect.top,
            rowWidth: rect.width,
            rowHeight: rect.height,
            daysInYear: daysInYear(year),
            mode: "start",
          };
        }}
      >
        <span className="max-w-[24ch] truncate">{(c.title || "Kurs") + " start"}</span>

      </div>

      {/* PIGG för start – liten boll som markerar EXAKTA startdatumet */}
      <div
        className="absolute rounded-full"
        style={{
          left: `${piggPct}%`,
          top: "calc(50% - 1px)",      // enligt din justering
          width: "8px",
          height: "8px",
          transform: "translate(-50%, -50%)",
          background: "#e6f1fb",
          border: "1px solid #0c4a6e",
          zIndex: 200,
          pointerEvents: "none",
        }}
        title={c.startDate || c.certificateDate}
      />
    </React.Fragment>
  );
})()}


      {/* Slutmarkör – renderas endast i det år där slutdatumet faktiskt ligger */}
      { (() => {
  const d = eDate; // Date för slut
  const laneW = laneWidthByYear[year] || 0;
  // Visa slut-pill/pigg bara i det år där slutdatumet faktiskt ligger
  if (d.getFullYear() !== year) {
    return null;
  }


  // Procent inom årets spann (kan vara null om slut inte ligger detta år)
  const total = Math.max(1, daysInYear(year) - 1);
  const endPct = (d.getFullYear() === year) ? (dayOfYear(d) / total) * 100 : null;

  // "Sann" center i px
  let trueCenterPx: number;
  if (endPct == null) {
    trueCenterPx = (d.getFullYear() < year) ? -1 : laneW + 1;
  } else {
    trueCenterPx = (endPct / 100) * laneW;
  }

  // Mät pillbredd → clamp:a pillens center inne i lane
  const measured = chipWidthsRef.current[c.id + "_psy_end"] || 0;
  const half = Math.max(1, measured / 2);
  const clampedCenterPx = clamp(trueCenterPx, half, Math.max(half, laneW - half));

  // Piggen för slut – exakta datumet
  const piggPct = (endPct == null)
    ? (d.getFullYear() < year ? 0 : 100)
    : clamp(endPct, 0, 100);

  const sel = c.id === selectedCourseId;
  const hovered = hoveredCourseId === c.id;

  return (
    <React.Fragment key={c.id + "_psy_end"}>

      {/* SLUT-PILL – klämd inne i lane */}
      <div
        ref={(el) => {
          if (el) {
            const w = el.offsetWidth || 0;
            if (w && chipWidthsRef.current[c.id + "_psy_end"] !== w) {
              chipWidthsRef.current[c.id + "_psy_end"] = w;
              forceRerender(n => n + 1);
            }
          }
        }}
        className={`absolute z-[150] top-1/2 -translate-y-1/2 pointer-events-auto select-none rounded-full px-2 h-5 flex items-center text-[10.5px] border cursor-grab active:cursor-grabbing shadow-sm transition-transform transition-colors ${
          sel
            ? "text-white bg-sky-600 border-sky-800 hover:bg-sky-500 hover:border-sky-700 hover:shadow-md"
            : "text-white bg-sky-700 border-sky-900 hover:bg-sky-600 hover:border-sky-800 hover:shadow-md"
        }`}
        style={{
          left: `${clampedCenterPx}px`,
          transform: hovered ? "translate(-50%, -58%)" : "translate(-50%, -50%)",
        }}
        title={`${c.title || "Kurs"} slut — ${c.endDate || c.certificateDate}`}

        onClick={(e) => {
          e.stopPropagation();
          switchActivity(null, c.id);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          switchActivity(null, c.id);


          // BT-kurs i tidslinjen
          if (c.phase === "BT") {
            // BT + ST-delmål → popup BT/ST
            if ((c as any)?.fulfillsStGoals) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setCertMenu({
                open: true,
                x: Math.round(e.clientX),
                y: Math.round(rect.top + rect.height / 2),
                kind: "course",
                placement: null,
                course: c,
              });
              return;
            }

            // Endast BT → direkt BT-intyg
            const dummyActivity: Activity = {
              id: c.id,
              type: "Kurs",
              label: c.title || "Kurs",
              startSlot: 0,
              lengthSlots: 1,
              hue: 0,
              phase: "BT",
              restPercent: 0,
              isLocked: false,
              btAssessment: (c as any).btAssessment || "",
              btMilestones: (c as any).btMilestones || [],
            } as any;

            openPreviewForBtGoals(dummyActivity);
            return;
          }

          // ST-kurs → ST-kursintyg via CoursePrepModal (2015 och 2021)
          if (!profile) {
            alert("Profil saknas – kan inte skapa intyget.");
            return;
          }
          setCourseForModal(c);
          setCourseModalOpen(true);

        }}


        onMouseDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          const isSwitching =
            selectedPlacementId !== null || selectedCourseId !== c.id;
          const ok = switchActivity(null, c.id);
          if (!ok) return;
          setActiveLane("course");
          if (dirty && isSwitching) return;
          const rowEl = (e.currentTarget as HTMLElement).closest(".st-row") as HTMLElement | null;
          if (!rowEl) return;
          const rect = rowEl.getBoundingClientRect();
          dragCourseRef.current = {
            id: c.id,
            year,
            rowLeft: rect.left,
            rowTop: rect.top,
            rowWidth: rect.width,
            rowHeight: rect.height,
            daysInYear: daysInYear(year),
            mode: "end",
          };
        }}
      >
        <span className="max-w-[24ch] truncate">{(c.title || "Kurs") + " slut"}</span>

      </div>

      {/* PIGG för slut – liten boll som markerar EXAKTA slutdatumet */}
      <div
        className="absolute rounded-full"
        style={{
          left: `${piggPct}%`,
          top: "calc(50% - 1px)",   // samma vertikala placering som du önskade
          width: "8px",
          height: "8px",
          transform: "translate(-50%, -50%)",
          background: "#e6f1fb",
          border: "1px solid #0c4a6e",
          zIndex: 200,
          pointerEvents: "none",
        }}
        title={c.endDate || c.certificateDate}
      />
    </React.Fragment>
  );
})()}

    </React.Fragment>
  );
}


                // STANDARDKURS med kant-stopp + pigg
{
  const endISO = c.endDate || c.certificateDate;
  if (!isValidISO(endISO)) return null;
  const endDateObj = isoToDateSafe(endISO);

  // % inom året (kan vara null när vi ”drar förbi” och ändå visar på denna rad)
  const total = Math.max(1, daysInYear(year) - 1);
  const toPct = (iso?: string) => {
    if (!iso || !isValidISO(iso)) return null;
    const d = isoToDateSafe(iso);
    if (d.getFullYear() !== year) return null;
    return (dayOfYear(d) / total) * 100;
  };

  const laneW = laneWidthByYear[year] || 0;

  // "Sann" procent (kan vara null när datumet ligger utanför detta år)
  const truePct = toPct(endISO);

  // "Sann" center i px (kan bli <0 eller >laneW om vi drar förbi och ändå visar i denna rad)
  let trueCenterPx: number;
  if (truePct == null) {
    // Om datumet egentligen ligger utanför året, skjut center strax utanför,
    // så att pillen sedan kan klämmas in exakt i kanten.
    const isBefore = endDateObj.getFullYear() < year;
    trueCenterPx = isBefore ? -1 : laneW + 1;
  } else {
    trueCenterPx = (truePct / 100) * laneW;
  }

  // Mät pillens bredd via ref -> clamp:a center inne i lane
  let measured = chipWidthsRef.current[c.id] || 0;
  const half = Math.max(1, measured / 2);
  const clampedCenterPx = clamp(trueCenterPx, half, Math.max(half, laneW - half));

  // Piggens position i % (visa ”sanna” datumet, men clamp:a vid 0/100%)
  let piggPct: number;
  if (truePct == null) {
    piggPct = endDateObj.getFullYear() < year ? 0 : 100;
  } else {
    piggPct = clamp(truePct, 0, 100);
  }

  // Färg: återanvänd dina blåa kurspiller-klasser
  const sel = c.id === selectedCourseId;
  const hovered = hoveredCourseId === c.id;

  return (
    <React.Fragment key={c.id}>

      {/* PILL – placeras med vänster i PX (klämd), så den aldrig sticker ut ur lanen */}
      <div
        ref={(el) => {
          if (el) {
            const w = el.offsetWidth || 0;
            if (w && chipWidthsRef.current[c.id] !== w) {
              chipWidthsRef.current[c.id] = w;
              forceRerender(n => n + 1);
            }
          }
        }}
        className={`absolute z-[70] top-1/2 -translate-y-1/2 pointer-events-auto select-none rounded-full px-2 h-5 flex items-center text-[10.5px] border cursor-grab active:cursor-grabbing shadow-sm transition-transform transition-colors ${
          sel
            ? "text-white bg-sky-600 border-sky-800 hover:bg-sky-500 hover:border-sky-700 hover:shadow-md"
            : "text-white bg-sky-700 border-sky-900 hover:bg-sky-600 hover:border-sky-800 hover:shadow-md"
        }`}
        style={{
          left: `${clampedCenterPx}px`,
          transform: hovered ? "translate(-50%, -58%)" : "translate(-50%, -50%)",
        }}
        title={c.title || "Kurs"}
        onClick={(e) => {
          e.stopPropagation();
          switchActivity(null, c.id);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          switchActivity(null, c.id);

          // BT-kurs i tidslinjen
          if (c.phase === "BT") {
            // BT + ST-delmål → popup BT/ST
            if ((c as any)?.fulfillsStGoals) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setCertMenu({
                open: true,
                x: Math.round(e.clientX),
                y: Math.round(rect.top + rect.height / 2),
                kind: "course",
                placement: null,
                course: c,
              });
              return;
            }

            // Endast BT → direkt BT-intyg
            const dummyActivity: Activity = {
              id: c.id,
              type: "Kurs",
              label: c.title || "Kurs",
              startSlot: 0,
              lengthSlots: 1,
              hue: 0,
              phase: "BT",
              restPercent: 0,
              isLocked: false,
              btAssessment: (c as any).btAssessment || "",
              btMilestones: (c as any).btMilestones || [],
            } as any;

            openPreviewForBtGoals(dummyActivity);
            return;
          }

          // ST-kurs → ST-intyg via CoursePrepModal (2015 och 2021)
          if (!profile) {
            alert("Profil saknas – kan inte skapa intyget.");
            return;
          }
          setCourseForModal(c);
          setCourseModalOpen(true);
        }}
        onMouseEnter={() => {
          setHoveredCourseId(c.id);
        }}
        onMouseLeave={() => {
          setHoveredCourseId(prev => (prev === c.id ? null : prev));
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const isSwitching =
            selectedPlacementId !== null || selectedCourseId !== c.id;
          const ok = switchActivity(null, c.id);
          if (!ok) return;
          setActiveLane("course");
          if (dirty && isSwitching) return;
          const rowEl = (e.currentTarget as HTMLElement).closest(".st-row") as HTMLElement | null;
          if (!rowEl) return;
          const rect = rowEl.getBoundingClientRect();
          dragCourseRef.current = {
            id: c.id,
            year,
            rowLeft: rect.left,
            rowTop: rect.top,
            rowWidth: rect.width,
            rowHeight: rect.height,
            daysInYear: daysInYear(year),
            mode: "move",
          };
        }}
      >
        <span className="max-w-[24ch] truncate">{c.title || "Kurs"}</span>
      </div>


      {/* PIGG – liten boll i nederkant av pillen, följer EXAKTA datumet */}
      <div
  className="absolute rounded-full"
  style={{
    left: `${piggPct}%`,
    // Centrera piggen något ovanför nederkanten av pillen
    top: "calc(50% - 1px)",
    width: "8px",
    height: "8px",
    // -50% gör att top anger piggens centrum → centrum hamnar vid 50%+8px
    transform: "translate(-50%, -50%)",
    background: "#e6f1fb",          // mycket ljus blå
    border: "1px solid #0c4a6e",    // tunnare mörkblå ram
    zIndex: 200,
    pointerEvents: "none",
  }}
  title={endISO}
/>

    </React.Fragment>
  );
}


              })}
            </div>


          </div>
        </div>
      </div>
    );
  }


// Overlap-info (bara som varning under kort)
const overlaps = useMemo(() => {
  if (!activities || activities.length < 2) return [];
  const res: Array<{ a: Activity; b: Activity }> = [];
  const list = activities;

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      const a0 = A.startSlot, a1 = A.startSlot + A.lengthSlots;
      const b0 = B.startSlot, b1 = B.startSlot + B.lengthSlots;
      if (!(a0 < b1 && b0 < a1)) continue;

      const sameType = A.type === B.type;
      const sameLabel = norm(A.label) === norm(B.label);

      if (sameType && sameLabel && a0 === b0 && a1 === b1) continue;

      const Aiso = computeMondayDates(A);
      const Biso = computeMondayDates(B);
      if (sameType && sameLabel && Aiso.startISO === Biso.startISO && Aiso.endISO === Biso.endISO) continue;

      const overlapLenNow = Math.min(a1, b1) - Math.max(a0, b0);
      const shorterLen = Math.max(1, Math.min(A.lengthSlots, B.lengthSlots));
      const overlapRatio = overlapLenNow / shorterLen;
      if (sameType && sameLabel && overlapRatio >= 0.8) continue;

      res.push({ a: A, b: B });
    }
  }
  return res;
}, [activities, startYear]);

  // Registrera: start = MÅNDAG vid halvgräns, slut = SÖNDAGEN före nästa halvgräns
  function computeMondayDates(a: Activity) {
    const s = slotToYearMonthHalf(startYear, a.startSlot);
    const eSlot = a.startSlot + a.lengthSlots - 1;
    const e = slotToYearMonthHalf(startYear, eSlot);

    const startD = mondayOnOrAfter(s.year, s.month0, s.half === 0 ? 1 : 15);

    const endBoundaryDay = e.half === 0 ? 15 : 1;
    const endBoundaryMonthRaw = e.month0 + (e.half === 1 ? 1 : 0);
    const endBoundaryYear = e.year + (endBoundaryMonthRaw > 11 ? 1 : 0);
    const endBoundaryMonthNorm = (endBoundaryMonthRaw + 12) % 12;

    const endD = sundayOnOrBefore(endBoundaryYear, endBoundaryMonthNorm, endBoundaryDay);
    return { startISO: dateToISO(startD), endISO: dateToISO(endD) };
  }

// Beräkna FTE och projicerat ST-slut — SLOT-BASERAT och helt lokalt
useEffect(() => {
  // Välj rätt startdatum för beräkning: 2021 → BT-start, annars ST-start
  const gv = String((profile as any)?.goalsVersion || "").trim();
  const baseISO = gv === "2021"
    ? ((profile as any)?.btStartDate || stStartISO)
    : stStartISO;
  if (!baseISO) return;

  if (restAttendance <= 0) {
    setStEndISO(null); // vid 0 % kan vi inte nå slut – visa “—”
    return;
  }


  // 1) FTE-månader (ledighet = 0 % FTE)
  const workedFteMonths = activities.reduce((acc, a) => {
    const frac = (a.attendance ?? 100) / 100;
    const fteFrac = isZeroAttendanceType(a.type) ? 0 : frac;

    return acc + (a.lengthSlots * 0.5) * fteFrac;
  }, 0);

  // 2) Total planlängd i månader styrs av totalPlanMonths (ex. 66 för 2021, 60 för 2015)
  const planMonths = Math.max(0, totalPlanMonths);

  // 3) Återstående FTE till planerad total tid
  const remainingFteMonths = Math.max(0, planMonths - workedFteMonths);

  // 4) Om resten går på X %, hur många kalendermånader krävs?
  const restFrac = (restAttendance || 0) / 100; // 0 % hanteras ovan
  const remainingCalendarMonths = remainingFteMonths / restFrac;

  // 5) Antal slots från ST-start (0.5 månad per slot)
  const workedCalendarMonths = activities.reduce((acc, a) => acc + (a.lengthSlots * 0.5), 0);
  const workedSlotsFromStart = Math.round(workedCalendarMonths * 2);
  const remainingSlotsFromStart = Math.max(0, Math.ceil(remainingCalendarMonths * 2));

  const lastSlotIndexFromStart = Math.max(
    0,
    workedSlotsFromStart + remainingSlotsFromStart - 1
  );

  // 6) OFFSET: börja räkna från PROFILENS start-slot (2021 → BT-start, annars ST-start)
  const baseYear = new Date(baseISO + "T00:00:00").getFullYear();
  const startOffsetWithinYear = dateToSlot(baseYear, baseISO, "start"); // 0..23 för jan–dec H1/H2
  const absoluteSlot = startOffsetWithinYear + lastSlotIndexFromStart;


  // 7) Konvertera till datum enligt "end"-ankaret (söndag före nästa halvgräns)
  const e = slotToYearMonthHalf(baseYear, absoluteSlot);
  const endBoundaryDay = e.half === 0 ? 15 : 1;
  const endBoundaryMonthRaw = e.month0 + (e.half === 1 ? 1 : 0);
  const endBoundaryYear = e.year + (endBoundaryMonthRaw > 11 ? 1 : 0);
  const endBoundaryMonthNorm = (endBoundaryMonthRaw + 12) % 12;
  const endD = sundayOnOrBefore(endBoundaryYear, endBoundaryMonthNorm, endBoundaryDay);
  setStEndISO(dateToISO(endD));
}, [activities, restAttendance, totalPlanMonths, stStartISO, profile]);






  // Avrunda ISO till närmaste månads-/halvmånads-linje enligt 7/22-regeln
function roundToAnchors(iso: string, which: "start" | "end") {
  if (!isValidISO(iso)) return "";
  const d = new Date(iso + "T00:00:00");
  let y = d.getFullYear();
  let m0 = d.getMonth();
  const day = d.getDate();

  // Ankarpunkt: 1:a, 15:e eller nästa månads 1:a (23–EOM)
  let anchorDay = 1;
  if (day <= 7) {
    anchorDay = 1; // månadslinje
  } else if (day <= 22) {
    anchorDay = 15; // halvmånadslinje
  } else {
    // nästa månads 1:a
    m0 += 1;
    if (m0 >= 12) { m0 = 0; y += 1; }
    anchorDay = 1;
  }

  if (which === "start") {
    // vänsterkant = måndag NÄRMAST ankarpunkten
    const md = mondayOnOrAfter(y, m0, anchorDay);
    return dateToISO(md);
  } else {
    // högerkant = söndag NÄRMAST ankarpunkten
    const sd = sundayOnOrBefore(y, m0, anchorDay === 15 ? 15 : 1);
    return dateToISO(sd);
  }
}


  // Uppdatera formulärets datum när man drar i block på tidslinjen
  function setFormDatesFromSlots(startSlot: number, lengthSlots: number) {
    if (activeCard === "course" && selectedCourseId) {
      // Kurs: uppdatera kursens start-/slutdatum enligt 7/22-regeln
      setCourses(prev =>
        prev.map((c) => {
          if (c.id !== selectedCourseId) return c;

          const phase = (c as any)?.phase || computePhaseByEndSlot(startSlot, lengthSlots);

          const dummyActivity: Activity = {
            id: c.id,
            type: "Kurs",
            label: c.title || "Kurs",
            startSlot,
            lengthSlots: Math.max(1, lengthSlots),
            phase,
            restPercent: 0,
            isLocked: false,
          };

          const { startISO, endISO } = computeMondayDates(dummyActivity);

          return {
            ...c,
            phase,
            startDate: startISO || c.startDate,
            endDate: endISO || c.endDate,
          };
        })
      );
      setActiveLane("course");
    } else if (selectedPlacementId) {
      // Klinisk placering/arbete/ledighet: uppdatera exakta datum
      setActivities(prev =>
        prev.map((a) => {
          if (a.id !== selectedPlacementId) return a;

          const phase = (a as any)?.phase || computePhaseByEndSlot(startSlot, lengthSlots);

          const act: Activity = {
            ...a,
            startSlot,
            lengthSlots: Math.max(1, lengthSlots),
            phase,
          };

          const { startISO, endISO } = computeMondayDates(act);

          return {
            ...a,
            startSlot,
            lengthSlots: Math.max(1, lengthSlots),
            phase,
            exactStartISO: startISO,
            exactEndISO: endISO,
          };
        })
      );
      setActiveLane("placement");
    }
  }




  function handleRegisterActivity() {
    const a = activities.find(x => x.id === selectedPlacementId);
    if (!a) return;
    handleRegisterActivityById(a.id);
  }

  function handleRegisterActivityById(id: string) {
    const a = activities.find(x => x.id === id);
    if (!a) return;

    const { startISO, endISO } = computeMondayDates(a);
    const q = new URLSearchParams({
      fromTimeline: "1",
      timeline: "1",
      type: a.type,
      clinic: a.label || a.type,
      start: startISO,
      end: endISO,
    });
    router.push(`/placeringar?${q.toString()}`);
  }

  function handleRegisterCourse() {
    const c = courses.find(x => x.id === selectedCourseId);
    if (!c) return;
    handleRegisterCourseById(c.id);
  }

  function handleRegisterCourseById(id: string) {
    const c = courses.find(x => x.id === id);
    if (!c) return;

    const q = new URLSearchParams({
      fromTimeline: "1",
      timeline: "1",
      title: c.title || "Kurs",
      certificateDate: c.certificateDate,
    });
    router.push(`/kurser?${q.toString()}`);
  }

  // Popup-state
  const [courseModalOpen, setCourseModalOpen] = useState(false);
const [courseForModal, setCourseForModal] = useState<any>(null);
const [sta3Open, setSta3Open] = useState(false);

// === Förhandsvisnings-modal (PDF) ===
const [previewOpen, setPreviewOpen] = useState(false);
const [previewUrl, setPreviewUrl] = useState<string | null>(null);

// Endast ID-delen (”a1”) av delmål
const toMilestoneIds = (xs: any) =>
  Array.isArray(xs)
    ? xs.map((m: any) => String(m).trim().split(/\s|–|-|:|\u2013/)[0])
    : [];

// Enkel modal-komponent inuti filen
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
          <h2 className="font-semibold">Förhandsvisning av intyg</h2>
      
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
          

          {/* Höger: Ladda ned */}
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

// Popup för info om JSON-backup + spara/close-knappar
function SaveInfoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  async function handleSave() {
    try {
      const { exportAll, downloadJson } = await import("@/lib/backup");
      const bundle = await exportAll();
      const d = new Date().toISOString().slice(0, 10);
      await downloadJson(bundle, `st-intyg-backup-${d}.json`);
      onClose();
    } catch (e) {
      console.error(e);
      alert("Kunde inte spara filen.");
    }
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
  <h2 className="text-base font-semibold">Spara din data som fil</h2>
  <div className="flex items-center gap-2">
    <button
      onClick={handleSave}
      className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
    >
      Spara fil
    </button>
    <button
      onClick={onClose}
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
    >
      Stäng
    </button>
  </div>
</div>



        <div className="px-5 py-4 space-y-3 text-sm text-slate-700">
          <p>
            När du klickar <span className="font-semibold">Spara fil</span> skapas en{" "}
            <code className="text-[12px] bg-slate-100 px-1 rounded">.json</code>-fil.
            Den innehåller all data du ser här (placeringar, kurser m.m.).
          </p>
          <p>
            För att fortsätta vid ett senare tillfälle kan du ladda upp samma fil i
            systemet igen. Då återställs dina uppgifter.
          </p>
          
        </div>

      </div>
    </div>
  );
}

// Öppna förhandsvisning för en placering/aktivitet (ST-intyg m.m.)

async function openPreviewForPlacement(a: Activity) {
  try {
    if (!profile) {
      alert("Profil saknas – kan inte skapa intyget.");
      return;
    }

    const gv = normalizeGoalsVersion((profile as any).goalsVersion);
    const { startISO, endISO } = computeMondayDates(a);

    const activityType =
      a.type === "Auskultation" ? "AUSKULTATION" :
      a.type === "Förbättringsarbete" ? "KVALITETSARBETE" :
      a.type === "Vetenskapligt arbete" ? "SKRIFTLIGT_ARBETE" :
      "PLACERING";

    const act: any = {
      title: a.label || a.type || "",
      clinic: a.label || "",
      site: (a as any).site || (a as any).clinic || "",
      startDate: startISO,
      endDate: endISO,
      attendance: a.attendance ?? (isZeroAttendanceType(a.type) ? 0 : 100),

      supervisor: (a as any).supervisor || "",
      supervisorSpeciality: (a as any).supervisorSpeciality || "",
      supervisorSite: (a as any).supervisorSite || "",
      notes: (a as any).note || "",
    };

    const blob = (await exportCertificate(
      {
        goalsVersion: gv,
        activityType: activityType as any,
        profile: profile as any,
        activity: act,
        // ST-intyg ska få ST-delmål från aktiviteten
        milestones: toMilestoneIds((a as any).milestones),
      },
      { output: "blob", filename: "preview.pdf" }
    )) as Blob;

    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewOpen(true);
  } catch (e) {
    console.error(e);
    alert("Kunde inte skapa förhandsvisningen.");
  }
}

// Öppna förhandsvisning: Delmål i BT (Bilaga 2)

async function openPreviewForBtGoals(a: Activity) {
  try {
    if (!profile) {
      alert("Profil saknas – kan inte skapa intyget.");
      return;
    }
    // ”Delmål i BT” finns i 2021-spåret som BT_GOALS
    const gv = "2021" as const;

    // Aktivitet för Bilaga 2 (Delmål i BT) – hämtar allt från detaljrutan i PusslaDinST
    const act: any = {
      // Utbildningsmoment: titel på aktiviteten
      title: a.label || a.type || "",
      clinic: a.label || "",
      site: (a as any).site || (a as any).clinic || "",

      // Datumfält (ej kritiska för listan med delmål, men kan användas i intyget)
      startDate: "",
      endDate: "",

      // Handledare – ska komma från den enskilda aktiviteten, inte huvudhandledare i profilen
      supervisor: (a as any).supervisor || "",
      supervisorName: (a as any).supervisor || "",
      supervisorSpeciality: (a as any).supervisorSpeciality || "",
      supervisorSpecialty: (a as any).supervisorSpeciality || "",
      supervisorSpec: (a as any).supervisorSpeciality || "",
      supervisorSite: (a as any).supervisorSite || "",

      // Beskrivning (”Beskrivning”-rutan i detaljpanelen)
      notes: (a as any).note || "",

      // Hur det kontrollerats (”Hur det kontrollerats ...” i BT-läget)
      btAssessment: (a as any).btAssessment || "",
    };



        const btIds = toMilestoneIds((a as any).btMilestones);

    // Tvinga BT-intyget att använda handledare från denna aktivitet
    const profileForBt: any = {
      ...(profile as any),
      // Grund-supervisorfält
      supervisor: act.supervisor || (profile as any)?.supervisor || "",
      supervisorName: act.supervisor || (profile as any)?.supervisorName || "",
      // Tjänsteställe
      supervisorSite: act.supervisorSite || (profile as any)?.supervisorSite || "",
      // Specialitet – sätt på alla alias som används i exporters.ts
      supervisorSpeciality:
        act.supervisorSpeciality ||
        (profile as any)?.supervisorSpeciality ||
        (profile as any)?.supervisorSpecialty ||
        (profile as any)?.supervisorSpec ||
        "",
      supervisorSpecialty:
        act.supervisorSpeciality ||
        (profile as any)?.supervisorSpecialty ||
        (profile as any)?.supervisorSpeciality ||
        (profile as any)?.supervisorSpec ||
        "",
      supervisorSpec:
        act.supervisorSpeciality ||
        (profile as any)?.supervisorSpec ||
        (profile as any)?.supervisorSpeciality ||
        (profile as any)?.supervisorSpecialty ||
        "",
    };

    // Sätt även globala alias som exporters kan använda
    (globalThis as any).supervisorName = profileForBt.supervisorName;
    (globalThis as any).supervisorSite = profileForBt.supervisorSite;
    (globalThis as any).supervisorSpeciality = profileForBt.supervisorSpeciality;
    (globalThis as any).supervisorSpecialty = profileForBt.supervisorSpecialty;
    (globalThis as any).supervisorSpec = profileForBt.supervisorSpec;

    const blob = (await exportCertificate(
      {
        goalsVersion: gv,
        activityType: "BT_GOALS" as any,
        profile: profileForBt,
        activity: act,
        milestones: btIds,
      },
      { output: "blob", filename: "delmal-i-bt-preview.pdf" }
    )) as Blob;

    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewOpen(true);
  } catch (e) {
    console.error(e);
    alert("Kunde inte skapa förhandsvisningen (Delmål i BT).");
  }
}




// Öppna förhandsvisning för en kurs
async function openPreviewForCourse(c: TLcourse) {
  try {
    if (!profile) {
      alert("Profil saknas – kan inte skapa intyget.");
      return;
    }

    const gv = normalizeGoalsVersion((profile as any).goalsVersion);

    const act: any = {
      title: c.title || "Kurs",
      site: (c as any).site || "",
      clinic: (c as any).site || "",
      startDate: c.startDate || c.endDate || c.certificateDate,
      endDate: c.endDate || c.startDate || c.certificateDate,
      courseLeaderName: (c as any).courseLeaderName || "",
      courseLeaderSite: (c as any).courseLeaderSite || "",
      courseLeaderSpeciality: (c as any).courseLeaderSpeciality || "",
      notes: (c as any).note || "",
      signer: undefined, // endast för popupen – här behövs ingen signer-kryssning
    };

    const blob = (await exportCertificate(
      {
        goalsVersion: gv,
        activityType: "KURS",
        profile: profile as any,
        activity: act,
        milestones: toMilestoneIds((c as any).milestones),
      },
      { output: "blob", filename: "preview.pdf" }
    )) as Blob;

    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setPreviewOpen(true);
  } catch (e) {
    console.error(e);
    alert("Kunde inte skapa förhandsvisningen.");
  }
}


// STa3 – listor + fält till modalen
const [sta3Placements, setSta3Placements] = useState<Array<{ id:string; title:string; period?:string }>>([]);
const [sta3Courses, setSta3Courses] = useState<Array<{ id:string; title:string; period?:string }>>([]);
const [sta3Other, setSta3Other] = useState<string>("");
const [sta3HowVerified, setSta3HowVerified] = useState<string>("");

// Radens data → modalen
const [sta3ResearchTitle, setSta3ResearchTitle] = useState<string>("");
const [sta3SupervisorName, setSta3SupervisorName] = useState<string>("");
const [sta3SupervisorSpec, setSta3SupervisorSpec] = useState<string>("");
const [sta3SupervisorSite, setSta3SupervisorSite] = useState<string>("");

// --- ändringsflagga för panelen ---
const [dirty, setDirty] = useState(false);

// Baseline/snapshot för att jämföra ändringar
const baselineRef = useRef<{ placement?: any; course?: any } | null>(null);
const baselinePlacementIdRef = useRef<string | null>(null);
const baselineCourseIdRef = useRef<string | null>(null);

// Skapa snapshot när aktivitet väljs
// Använd activities/courses arrays istället för selectedPlacement/selectedCourse
// för att säkerställa att vi får rätt baseline även efter state-uppdateringar
useEffect(() => {
  // Viktigt: baseline ska INTE uppdateras när man redigerar (då ändras activities/courses),
  // utan endast när man byter vald aktivitet/kurs eller när den valda posten först blir tillgänglig.
  if (selectedPlacementId) {
    // Byte (eller första gången) → resetta baseline för denna selection
    if (baselinePlacementIdRef.current !== selectedPlacementId) {
      baselinePlacementIdRef.current = selectedPlacementId;
      baselineCourseIdRef.current = null;
      baselineRef.current = null;
      setDirty(false);
    }

    // Sätt baseline när objektet finns (t.ex. efter initial laddning)
    if (!baselineRef.current?.placement && selectedPlacement) {
      baselineRef.current = { placement: structuredClone(selectedPlacement) };
      setDirty(false);
    }
    return;
  }

  if (selectedCourseId) {
    if (baselineCourseIdRef.current !== selectedCourseId) {
      baselineCourseIdRef.current = selectedCourseId;
      baselinePlacementIdRef.current = null;
      baselineRef.current = null;
      setDirty(false);
    }

    if (!baselineRef.current?.course && selectedCourse) {
      baselineRef.current = { course: structuredClone(selectedCourse) };
      setDirty(false);
    }
    return;
  }

  // Inget valt
  baselinePlacementIdRef.current = null;
  baselineCourseIdRef.current = null;
  baselineRef.current = null;
  setDirty(false);
}, [selectedPlacementId, selectedCourseId, selectedPlacement, selectedCourse]);

// Funktion för att kontrollera om det finns ändringar
const checkDirty = useCallback(() => {
  const baseline = baselineRef.current;
  if (!baseline) return false;
  
  if (baseline.placement && selectedPlacement) {
    // Jämför alla relevanta fält för placement
    const b = baseline.placement;
    const current = selectedPlacement;
    
    return (
      b.type !== current.type ||
      b.label !== current.label ||
      b.leaveSubtype !== current.leaveSubtype ||
      b.startSlot !== current.startSlot ||
      b.lengthSlots !== current.lengthSlots ||
      b.attendance !== current.attendance ||
      (b as any)?.phase !== (current as any)?.phase ||
      b.supervisor !== current.supervisor ||
      b.supervisorSpeciality !== current.supervisorSpeciality ||
      b.supervisorSite !== current.supervisorSite ||
      (b as any)?.btAssessment !== (current as any)?.btAssessment ||
      b.note !== current.note ||
      JSON.stringify((b as any)?.btMilestones || []) !== JSON.stringify((current as any)?.btMilestones || []) ||
      JSON.stringify((b as any)?.milestones || []) !== JSON.stringify((current as any)?.milestones || []) ||
      (b as any)?.fulfillsStGoals !== (current as any)?.fulfillsStGoals ||
      (b.exactStartISO || "") !== ((current as any)?.exactStartISO || "") ||
      (b.exactEndISO || "") !== ((current as any)?.exactEndISO || "")
    );
  }
  
  if (baseline.course && selectedCourse) {
    // Jämför alla relevanta fält för course
    const b = baseline.course;
    const current = selectedCourse;
    
    return (
      b.title !== current.title ||
      b.kind !== current.kind ||
      b.city !== current.city ||
      b.courseLeaderName !== current.courseLeaderName ||
      b.startDate !== current.startDate ||
      b.endDate !== current.endDate ||
      b.certificateDate !== current.certificateDate ||
      b.note !== current.note ||
      JSON.stringify((b as any)?.milestones || []) !== JSON.stringify((current as any)?.milestones || []) ||
      JSON.stringify((b as any)?.btMilestones || []) !== JSON.stringify((current as any)?.btMilestones || []) ||
      (b as any)?.fulfillsStGoals !== (current as any)?.fulfillsStGoals ||
      (b as any)?.phase !== (current as any)?.phase ||
      (b as any)?.btAssessment !== (current as any)?.btAssessment ||
      (b as any)?.showAsInterval !== (current as any)?.showAsInterval
    );
  }
  
  return false;
}, [selectedPlacement, selectedCourse]);

// Uppdatera dirty-state baserat på jämförelse
useEffect(() => {
  const isDirty = checkDirty();
  setDirty(isDirty);
}, [checkDirty]);

// Funktion för att återställa till baseline
const restoreBaseline = useCallback(() => {
  const baseline = baselineRef.current;
  if (!baseline) return;
  
  if (baseline.placement && selectedPlacement) {
    const b = baseline.placement;
    setActivities(prev => prev.map(a => 
      a.id === selectedPlacement.id ? { ...a, ...b } : a
    ));
    // exactStartISO och exactEndISO är redan inkluderade i ...b spread
  } else if (baseline.course && selectedCourse) {
    const b = baseline.course;
    setCourses(prev => prev.map(c => 
      c.id === selectedCourse.id ? { ...c, ...b } : c
    ));
  }
}, [selectedPlacement, selectedCourse]);

// ===== Spara (återanvänds av både knapp och osparade-ändringar-dialog) =====
const savePlacementToDb = useCallback(
  async (selAct: any): Promise<boolean> => {
    if (!selAct) return false;
    if (wouldOverlap(selAct.id, selAct.startSlot, selAct.lengthSlots)) {
      alert("Datum överlappar annan aktivitet.");
      return false;
    }

    try {
      // Ta i första hand datumet från selAct.exactStartISO/exactEndISO.
      // Dessa uppdateras direkt när användaren ändrar datum i detaljrutan.
      const startISO = (selAct.exactStartISO || "").trim();
      const endISO = (selAct.exactEndISO || "").trim();

      // Spara EXAKT det som står i detaljrutan – ingen slot-baserad omräkning
      if (!startISO || !endISO || !isValidISO(startISO) || !isValidISO(endISO)) {
        alert("Kunde inte tolka datum i detaljrutan. Kontrollera start- och slutdatum.");
        return false;
      }

      // Mappa till DB-post för placements
      const record: any = {
        type: selAct.type,
        clinic: selAct.type === "Annan ledighet" ? undefined : (selAct.label || ""),
        title: selAct.type === "Annan ledighet" ? (selAct.leaveSubtype || "") : (selAct.label || ""),
        leaveSubtype: selAct.type === "Annan ledighet" ? (selAct.leaveSubtype || "") : "",
        startDate: startISO,
        endDate: endISO,
        attendance: selAct.attendance ?? 100,
        // Spara vald fas (BT/ST) – om ej satt, defaulta till "ST"
        phase: (selAct as any)?.phase || "ST",
        supervisor: selAct.supervisor || "",
        supervisorSpeciality: selAct.supervisorSpeciality || "",
        supervisorSite: selAct.supervisorSite || "",
        // Nytt fält till central DB: hur BT-delmål kontrollerats (för Bilaga "Delmål i BT")
        btAssessment: (selAct as any)?.btAssessment || "",
        // Beskrivning
        note: selAct.note || "",
        showOnTimeline: true,
        btMilestones: ((selAct as any)?.btMilestones || []),
        milestones: ((selAct as any)?.milestones || []),
        fulfillsStGoals: !!(selAct as any)?.fulfillsStGoals,
      };

      let newId = selAct.linkedPlacementId;
      if (newId) {
        try {
          await (db as any).placements?.update?.(newId, record);
        } catch {
          await (db as any).placements?.put?.({ id: newId, ...record });
        }
      } else {
        const genId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);

        await (db as any).placements?.put?.({ id: genId, ...record });

        const newIdAny = genId as any;
        setActivities((prev) =>
          prev.map((a) => (a.id === selAct.id ? { ...a, linkedPlacementId: newIdAny } : a))
        );
      }

      await refreshLists();
      baselineRef.current = { placement: structuredClone(selAct) };
      setDirty(false);
      return true;
    } catch (e) {
      console.error(e);
      alert("Kunde inte spara till databasen.");
      return false;
    }
  },
  [wouldOverlap, refreshLists]
);

const saveCourseToDb = useCallback(
  async (selCourse: any): Promise<boolean> => {
    if (!selCourse) return false;
    try {
      const start = selCourse.startDate || selCourse.endDate || selCourse.certificateDate || "";
      const end = selCourse.endDate || selCourse.startDate || selCourse.certificateDate || "";
      const cert = selCourse.certificateDate || selCourse.endDate || selCourse.startDate || "";

      // Mappa till DB-post för courses
      const record: any = {
        title: selCourse.title || "Kurs",
        kind: selCourse.kind || "Kurs",
        city: selCourse.city || "",
        courseLeaderName: selCourse.courseLeaderName || "",
        startDate: start || "",
        endDate: end || "",
        certificateDate: cert || "",
        note: selCourse.note || "",
        showOnTimeline: true,

        // Extra fält som ska sparas centralt
        milestones: ((selCourse as any)?.milestones || []) as string[],
        btMilestones: ((selCourse as any)?.btMilestones || []) as string[],
        fulfillsStGoals: !!(selCourse as any)?.fulfillsStGoals,
        phase: (selCourse as any)?.phase || "ST",
        btAssessment: (selCourse as any)?.btAssessment || "",
        ...(typeof (selCourse as any)?.showAsInterval === "boolean"
          ? { showAsInterval: !!(selCourse as any).showAsInterval }
          : {}),
      };

      let newId = selCourse.linkedCourseId;
      if (newId) {
        try {
          await (db as any).courses?.update?.(newId, record);
        } catch {
          await (db as any).courses?.put?.({ id: newId, ...record });
        }
      } else {
        const genId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
        await (db as any).courses?.put?.({ id: genId, ...record });
        const newIdAny = genId as any;
        setCourses((prev) =>
          prev.map((c) => (c.id === selCourse.id ? { ...c, linkedCourseId: newIdAny } : c))
        );
      }

      await refreshLists();
      baselineRef.current = { course: structuredClone(selCourse) };
      setDirty(false);
      return true;
    } catch (e) {
      console.error(e);
      alert("Kunde inte spara kursen till databasen.");
      return false;
    }
  },
  [refreshLists]
);

// ===== Osparade ändringar: tre val (Spara och stäng / Stäng utan att spara / Avbryt) =====
const [unsavedPrompt, setUnsavedPrompt] = useState<null | {
  mode: "switch" | "close";
  nextPlacementId: string | null;
  nextCourseId: string | null;
}>(null);
const [unsavedSaving, setUnsavedSaving] = useState(false);

const closeDetailPanel = useCallback(() => {
  if (dirty) {
    setUnsavedPrompt({ mode: "close", nextPlacementId: null, nextCourseId: null });
    return;
  }
  setDirty(false);
  setSelectedPlacementId(null);
  setSelectedCourseId(null);
}, [dirty]);

// Funktion för att byta aktivitet med varning.
// Returnerar true om bytet accepteras/är onödigt, annars false (används för att avbryta drag/resize).
const switchActivity = useCallback(
  (newPlacementId: string | null, newCourseId: string | null) => {
    const sameSelection =
      newPlacementId === selectedPlacementId && newCourseId === selectedCourseId;
    if (sameSelection) return true;

    if (dirty) {
      setUnsavedPrompt({ mode: "switch", nextPlacementId: newPlacementId, nextCourseId: newCourseId });
      return false;
    }

    setDirty(false);
    setSelectedPlacementId(newPlacementId);
    setSelectedCourseId(newCourseId);
    return true;
  },
  [dirty, selectedPlacementId, selectedCourseId]
);

// Keyboard handler för Delete-tangenten
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // Ignorera om användaren skriver i ett input-fält
    if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") {
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedPlacement) {
        if (dirty) {
          if (!confirm("Du har osparade ändringar. Ta bort ändå?")) return;
        } else {
          if (!confirm("Vill du ta bort vald aktivitet?")) return;
        }
        deleteSelectedPlacement();
      } else if (selectedCourse) {
        if (dirty) {
          if (!confirm("Du har osparade ändringar. Ta bort ändå?")) return;
        } else {
          if (!confirm("Vill du ta bort vald aktivitet?")) return;
        }
        deleteSelectedCourse();
      }
    }
  }

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [selectedPlacement, selectedCourse, dirty]);


  // === Spara hela tidslinjen till DB så PrepareApplication/Profil/rapport läser samma källa ===
const persistTimelineToDb = async () => {
  const affectedPlacementIds = new Set<string>();
  const affectedCourseIds = new Set<string>();

  // 1) Aktiviteter → placements
  for (const a of activities) {
    // 1a) Försök först använda EXAKTA datum som används i detaljrutan
    const rawStart = (a as any)?.exactStartISO || "";
    const rawEnd   = (a as any)?.exactEndISO   || "";

    let startISO = rawStart && isValidISO(rawStart) ? rawStart : "";
    let endISO   = rawEnd   && isValidISO(rawEnd)   ? rawEnd   : "";

    // 1b) Om något saknas/fel → fall tillbaka till slot-baserad beräkning
    if (!startISO || !endISO) {
      const fallback = computeMondayDates(a);
      if (!startISO) startISO = fallback.startISO;
      if (!endISO)   endISO   = fallback.endISO;
    }

    const isLeaveType = isLeave(a.type);

    const record: any = {
      type: a.type,
      clinic:
        !isLeaveType && a.type !== "Vetenskapligt arbete" && a.type !== "Förbättringsarbete"
          ? (a.label || "")
          : "",
      title:
        a.type === "Annan ledighet"
          ? (a.leaveSubtype || "")
          : (a.label || (isLeaveType ? a.type : "")),
      leaveSubtype: a.type === "Annan ledighet" ? (a.leaveSubtype || "") : "",
      startDate: startISO,
      endDate: endISO,
      attendance: isZeroAttendanceType(a.type) ? 0 : (a.attendance ?? 100),


      supervisor: a.supervisor || "",
      supervisorSpeciality: a.supervisorSpeciality || "",
      supervisorSite: a.supervisorSite || "",
      note: a.note || "",
      showOnTimeline: true,

      // Extra fält som inte ska tappas vid "Spara tidslinje"
      phase: (a as any)?.phase || "ST",
      btAssessment: (a as any)?.btAssessment || "",
      btMilestones: ((a as any)?.btMilestones || []) as string[],
      milestones: ((a as any)?.milestones || []) as string[],
      fulfillsStGoals: !!(a as any)?.fulfillsStGoals,
    };

    let id = a.linkedPlacementId;
    if (id) {
      try {
        await (db as any).placements?.update?.(id, record);
      } catch {
        await (db as any).placements?.put?.({ id, ...record });
      }
    } else {
      const newId =
        (globalThis as any).crypto?.randomUUID?.() ??
        `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      await (db as any).placements?.put?.({ id: newId, ...record });
      id = newId;
      setActivities(prev =>
        prev.map(x => (x.id === a.id ? { ...x, linkedPlacementId: newId } : x))
      );
    }

    if (id) affectedPlacementIds.add(id);
  }

  // 2) Kurser → courses
  for (const c of courses) {
    const start = c.startDate || c.endDate || c.certificateDate || "";
    const end   = c.endDate   || c.startDate || c.certificateDate || "";
    const cert  = c.certificateDate || c.endDate || c.startDate || "";

            const record: any = {
          title: c.title || "",
          certificateDate: c.certificateDate || "",
          kind: c.kind || "Kurs",
          showOnTimeline: true,

          // Extra fält
          city: c.city || "",
          courseLeaderName: c.courseLeaderName || "",
          startDate: c.startDate || "",
          endDate: c.endDate || "",
          note: c.note || "",
          phase: c.phase || "ST",
          btMilestones: ((c as any)?.btMilestones || []) as string[],
          fulfillsStGoals: !!(c as any)?.fulfillsStGoals,
          milestones: ((c as any)?.milestones || []) as string[],
          btAssessment: (c as any)?.btAssessment || "",
          ...(typeof (c as any)?.showAsInterval === "boolean"
            ? { showAsInterval: !!(c as any).showAsInterval }
            : {}),
        };


    let id = c.linkedCourseId;
    if (id) {
      try {
        await (db as any).courses?.update?.(id, record);
      } catch {
        await (db as any).courses?.put?.({ id, ...record });
      }
    } else {
      const newId =
        (globalThis as any).crypto?.randomUUID?.() ??
        `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
      await (db as any).courses?.put?.({ id: newId, ...record });
      id = newId;
      setCourses(prev =>
        prev.map(x => (x.id === c.id ? { ...x, linkedCourseId: newId } : x))
      );
    }

    if (id) affectedCourseIds.add(id);
  }


  // 3) Delmål → achievements (rensar gamla kopplingar för berörda poster och skriver nya)
  const toAdd: Array<{ id: string; placementId?: string; courseId?: string; milestoneId: string; date: string }> = [];

  for (const a of activities) {
    const mids: string[] = ((a as any).milestones || []) as string[];
    if (!mids?.length || !a.linkedPlacementId) continue;
    const { endISO } = computeMondayDates(a);
    for (const mId of mids) {
      toAdd.push({
        id: (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
        placementId: a.linkedPlacementId,
        milestoneId: mId,
        date: endISO || "",
      });
    }
  }

  for (const c of courses) {
    const mids: string[] = ((c as any).milestones || []) as string[];
    if (!mids?.length || !c.linkedCourseId) continue;
    const date = c.certificateDate || c.endDate || c.startDate || "";
    for (const mId of mids) {
      toAdd.push({
        id: (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
        courseId: c.linkedCourseId,
        milestoneId: mId,
        date,
      });
    }
  }

  try {
    await (db as any).transaction?.('rw', (db as any).achievements, async () => {
      for (const pid of affectedPlacementIds) {
        await (db as any).achievements?.filter?.((a: any) => a.placementId === pid)?.delete?.();
      }
      for (const cid of affectedCourseIds) {
        await (db as any).achievements?.filter?.((a: any) => a.courseId === cid)?.delete?.();
      }
      if (toAdd.length) {
        await (db as any).achievements?.bulkAdd?.(toAdd as any);
      }
    });
  } catch {
    // ignore
  }

  try {
    const ach = await (db as any).achievements?.toArray?.();
    setAchievements(Array.isArray(ach) ? ach : []);
  } catch {
    setAchievements([]);
  }
};


  // UI
  return (
      <>
              {/* Rubrik + toppknappar */}
      <div className="flex items-center gap-3 mb-3">
        <h1 className="text-center text-4xl font-extrabold tracking-tight">
  <span className="text-sky-700">ST</span>
  <span className="text-emerald-700">ARK</span></h1>

        {/* VÄNSTERGRUPP */}
        <div className="flex items-center gap-2">
          

          {/* Specialistansökan */}
{/* Intyg bastjänstgöring – endast 2021, placerad mellan Spara och Specialistansökan */}
{is2021 && (
  <button
    onClick={() => setBtModalOpen(true)}
    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
    title="Intyg bastjänstgöring"
  >
    Intyg bastjänstgöring
  </button>
)}


<button
  onClick={() => setPrepareOpen(true)}
  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
  title="Specialistansökan"
>
  Specialistansökan
</button>







         



        </div>

        {/* HÖGERGRUPP */}
       <div className="ml-auto flex items-center gap-2">
{/* IUP */}
<button
  onClick={() => {
    setIupInitialTab("handledning");
    setIupInitialMeetingId(null);
    setIupInitialAssessmentId(null);
    setIupOpen(true);
  }}
  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
  title="IUP – Individuell utbildningsplan"
>
  IUP
</button>



          {/* Scanna intyg */}
          <button
  onClick={() => setScanOpen(true)}
  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
  title="Scanna intyg"
>
  Scanna intyg
</button>





          {/* Intyg bastjänstgöring flyttad till vänstergruppen för målversion 2021 */}

          

          {/* Profil */}
          <button
            onClick={() => setProfileOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            title="Profil"
          >
            Profil
          </button>

{/* Spara (JSON-backup med diskettsymbol) */}
<button
  onClick={() => setSaveInfoOpen(true)}
  className="inline-flex items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 active:translate-y-px"
  title="Spara (JSON-backup)"
>
  <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-2-2Zm0 2v3H7V5h10ZM7 10h10v9H7v-9Z"/>
  </svg>
  Spara
</button>


          {/* Om (länkar till framtida sida) */}
          <button
            onClick={() => router.push("/om")}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 active:translate-y-px"
            title="Om"
          >
            Om
          </button>
        </div>
      </div>




      {/* Månadsrubriker (sticky) */}
      <div className="mb-1"><MonthHeader /></div>

      {/* Årsrader */}
      <div className="space-y-0">
        {Array.from({ length: visibleYearCount }, (_, i) => renderYearRow(i))}
      </div>

      {/* + nederst */}
      <div className="grid grid-cols-[80px_1fr] items-start mb-4">

        <div className="pr-2 text-right select-none">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setYearsBelow(y => y + 1); }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-sm font-semibold hover:bg-slate-50 translate-y-[6px]"

            title="Lägg till senare år"
          >+</button>
        </div>
{/* Förklaring (legend) + förlängning av ST */}
          <div className="mt-2 ml-[10px] flex flex-wrap items-center gap-4 text-xs text-slate-700">

            {(() => {
              const goals = String((profile as any)?.goalsVersion || "").trim();
              const is2021 = goals === "2021";

              if (is2021) {
                // 2021 – BT start, BT slut, ST slut + Idag
                return (
                  <>
                    <div className="flex items-center gap-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: START_LINE_COLOR }}
                      />
                      <span>= BT start</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: MID_LINE_COLOR }}
                      />
                      <span>= BT slut</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: END_LINE_COLOR }}
                      />
                      <span>= ST slut</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: TODAY_LINE_COLOR }}
                      />
                      <span>= Idag</span>
                    </div>
                  </>
                );
              }

              // 2015 – grön, röd och blå i legenden: ST start / ST slut / Idag
              return (
                <>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: START_LINE_COLOR }}
                    />
                    <span>= ST start</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: END_LINE_COLOR }}
                    />
                    <span>= ST slut</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: TODAY_LINE_COLOR }}
                    />
                    <span>= Idag</span>
                  </div>
                </>
              );
            })()}

            {/* Extra utrymme mellan "Idag"/markörer och symbolerna */}
            <div className="w-20" />

            {showSupervisionOnTimeline && (
              <div className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderBottom: "8px solid #059669",
                  }}
                />
                <span>= Möte med huvudhandledare</span>
              </div>
            )}

            {showAssessmentsOnTimeline && (
              <div className="flex items-center gap-1">
                <svg
                  aria-hidden="true"
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  style={{ display: "block" }}
                >
                  <path
                    d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
                    fill="#f59e0b"
                    stroke="#d97706"
                    strokeWidth={1.3}
                    strokeLinejoin="round"
                  />
                </svg>
                <span>= Progressionsbedömning</span>
              </div>
            )}

          </div>








        <div />
      </div>
      {/* ===== Gemensam detaljruta (grå om inget valt; Spara uppdaterar markerad) ===== */}
      {(selectedPlacement || selectedCourse) && (() => {
        const selAct = selectedPlacement;
        const selCourse = selectedCourse;
        const isCourse = !!selCourse && !selAct;
        const isPlacement = !!selAct && !selCourse;

        const headerText = isCourse
          ? "Kurs"
          : (selAct?.type ?? "Klinisk tjänstgöring");

        // Hjälpare: visa EXAKTA datum om de finns; annars härled från slots
        const actStartISO = selAct ? (selAct.exactStartISO || (() => {
          const s = slotToYearMonthHalf(startYear, selAct.startSlot);
          return dateToISO(mondayOnOrAfter(s.year, s.month0, s.half===0?1:15));
        })()) : "";
        const actEndISO = selAct ? (selAct.exactEndISO || (() => {
          const eSlot = selAct.startSlot + selAct.lengthSlots - 1;
          const e = slotToYearMonthHalf(startYear, eSlot);
          const d = sundayOnOrBefore(
            e.year + (e.half===1 && e.month0===11 ? 1 : (e.month0 + (e.half===1?1:0) > 11 ? 1 : 0)),
            (e.month0 + (e.half===1?1:0) + 12)%12,
            e.half===0?15:1
          );
          return dateToISO(d);
        })()) : "";


        // När datum ändras i formuläret → mappa till slots (ankare) och skriv tillbaka på vald rad
const applyPlacementDates = (which: "start" | "end", iso: string) => {
  if (!selAct) return;

  // 1) Uppdatera EXAKTA datumfält (förändras inte av snapping)
  setActivities(prev =>
    prev.map(a => {
      if (a.id !== selAct.id) return a;
      return which === "start"
        ? { ...a, exactStartISO: iso || undefined }
        : { ...a, exactEndISO: iso || undefined };
    })
  );
  // Dirty-state uppdateras automatiskt via checkDirty

  // 2) Beräkna slots baserat på "snappade" datum, endast för visuell layout
  const snappedStartISO = which === "start" ? roundToAnchors(iso, "start") : (selAct.exactStartISO || actStartISO);
  const snappedEndISO   = which === "end"   ? roundToAnchors(iso, "end")   : (selAct.exactEndISO   || actEndISO);
  if (!snappedStartISO || !snappedEndISO) return;

  let s = dateToSlot(startYear, snappedStartISO, "start");
  let e = dateToSlot(startYear, snappedEndISO,   "end");
  if (e <= s) e = s + 1; // minst en halvmånad

  const overlapsNow = () => wouldOverlap(selAct.id, s, Math.max(1, e - s));

  if (overlapsNow()) {
    if (which === "start") {
      let maxRight = -Infinity;
      for (const x of activities) {
        if (x.id === selAct.id) continue;
        const right = x.startSlot + x.lengthSlots;
        if (right <= s) maxRight = Math.max(maxRight, right);
      }
      if (isFinite(maxRight)) s = Math.max(s, maxRight);
      if (e <= s) e = s + 1;
    } else {
      let minLeft = Infinity;
      for (const x of activities) {
        if (x.id === selAct.id) continue;
        const left = x.startSlot;
        if (left >= e) minLeft = Math.min(minLeft, left);
      }
      if (isFinite(minLeft)) e = Math.min(e, minLeft);
      if (e <= s) e = s + 1;
    }
  }

  if (overlapsNow()) {
    alert("Datum överlappar annan aktivitet.");
    return;
  }

  setActivities(prev =>
    prev.map(a => {
      if (a.id !== selAct.id) return a;
      const newLen = Math.max(1, e - s);
      return { ...a, startSlot: s, lengthSlots: newLen, phase: phaseForSlots(s, newLen) };
    })
  );

  // Dirty-state uppdateras automatiskt via checkDirty
}




        return (
          <div
  className="relative rounded-xl border-2 bg-white p-4 border-sky-600 ring-1 ring-sky-600 mb-6"
  // Dirty-state uppdateras automatiskt via checkDirty

  style={{
  boxShadow: (() => {
    const isCoursePanel = !!selCourse && !selAct;
    if (isCoursePanel) return "none"; // ← ingen inre ram för kurser
    const hue = selAct?.hue ?? 210;
    return `inset 0 0 0 4px hsl(${hue} 30% 72%)`; // inre färgram ENDAST för aktiviteter
  })(),
}}

>




            {null}


            {/* === PLACERING / LEDIGHET === */}
            {isPlacement && selAct && (
  <>
        <div
      className={
        [
          "grid gap-3 grid-cols-1",
          (() => {
            // === Bestäm målversion ===
            const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
            const goals2015 = gv === "2015";
            const goals2021 = gv === "2021";

            const selAct = selectedPlacement;
            if (selAct) {
              const t = selAct.type;
              const isCore =
                t === "Klinisk tjänstgöring" ||
                t === "Vetenskapligt arbete" ||
                t === "Förbättringsarbete" ||
                t === "Auskultation";

              // Forskning + vissa ledigheter → 3 kolumner (fyller hela raden)
              if (
                t === "Forskning" ||
                t === "Tjänstledighet" ||
                t === "Föräldraledighet" ||
                t === "Sjukskriven"
              ) {
                return "md:grid-cols-3";
              }

              // Annan ledighet → 4 kolumner
              if (t === "Annan ledighet") {
                return "md:grid-cols-4";
              }

              // Klinisk tjänstgöring, vetenskapligt arbete, förbättringsarbete, auskultation
              // 2015 → 5 kolumner
              // 2021 → 6 kolumner om BT-fasen är aktiv, annars 5 kolumner (Fas-kolumnen försvinner efter BT-slut)
              if (isCore) {
                if (goals2015) return "md:grid-cols-5";
                if (goals2021) {
                  // Kontrollera om BT-fasen är över - använd samma logik som för Fas-väljaren
                  const prof: any = profile || {};
                  const btISO: string | null = prof?.btStartDate || null;
                  if (!btISO || !isValidISO(btISO)) return "md:grid-cols-5"; // Ingen BT-start = 5 kolumner
                  
                  const btEndManual: string | null = prof?.btEndDate || null;
                  let btEndISO: string | null = null;
                  if (btEndManual && isValidISO(btEndManual)) {
                    btEndISO = btEndManual;
                  } else {
                    try {
                      const d = isoToDateSafe(btISO);
                      btEndISO = dateToISO(addMonths(d, 24)); // auto 24 månader
                    } catch {
                      return "md:grid-cols-5"; // fallback
                    }
                  }
                  
                  if (!btEndISO || !isValidISO(btEndISO)) return "md:grid-cols-5";
                  
                  // Använd samma logik som för Fas-väljaren: aktiviteten måste ligga HELT mellan BT-start och BT-slut
                  const btStartGlobal = dateToSlot(startYear, btISO, "start");
                  const btEndSlot = dateToSlot(startYear, btEndISO, "end");
                  const btEndGlobal = Number.isFinite(btEndSlot) ? btEndSlot : null;
                  
                  if (!Number.isFinite(btStartGlobal) || btEndGlobal == null) return "md:grid-cols-5";
                  
                  const s0 = selAct.startSlot;
                  const e0 = selAct.startSlot + selAct.lengthSlots;
                  const inBtWindow = s0 >= btStartGlobal && e0 <= btEndGlobal;
                  
                  // Om aktiviteten INTE ligger helt inom BT-fönstret → 5 kolumner (ST-fas)
                  if (!inBtWindow) return "md:grid-cols-5";
                  
                  // BT-fasen är aktiv → 6 kolumner (inkluderar Fas-kolumnen)
                  return "md:grid-cols-6";
                }
              }
            }



            // === BT-start från profil ===
            const btStartISO: string | null = (profile as any)?.btStartDate || null;

            // === Om 2015 → 5 kolumner för utbildningsaktiviteter (Syss.% borttagen) ===
            if (goals2015) return "md:grid-cols-5";

            // === Om annan målversion än 2015/2021 → 4 kolumner (generellt läge, utan Syss.%) ===
            if (!goals2021) return "md:grid-cols-4";

            // === Om målversion 2021 men ingen BT-start ifylld → 5 kolumner (visar BT/ST-kolumn oavsett, utan Syss.%) ===
            if (!btStartISO) return "md:grid-cols-5";

            // === Om målversion 2021 MED BT-start → avgör kolumner utifrån om placeringens mittpunkt ligger före/efter BT-slut ===
            return (() => {
              const selAct = selectedPlacement;
              if (!selAct) return "md:grid-cols-5";

              const btEndManual: string | null = (profile as any)?.btEndDate || null;

              let btEndISO: string | null = null;
              if (btEndManual && isValidISO(btEndManual)) {
                btEndISO = btEndManual;
              } else {
                try {
                  const d = isoToDateSafe(btStartISO);
                  btEndISO = dateToISO(addMonths(d, 24)); // auto 24 månader
                } catch {
                  return "md:grid-cols-5"; // fallback
                }
              }

              // === Konvertera till slot enligt "end"-ankare (hel/halvmån-logiken) ===
              let btEndSlot: number;
              try {
                btEndSlot = dateToSlot(startYear, btEndISO, "end");
              } catch {
                return "md:grid-cols-5";
              }

              // === Aktivitetens mittpunkt ===
              const actMidSlot =
                selAct.startSlot + Math.floor(selAct.lengthSlots / 2);

              // === Efter BT-slut → 4 kolumner (utan Syss.%) ===
              if (actMidSlot >= btEndSlot) return "md:grid-cols-4";

              // === Före eller inom BT-intervall → 5 kolumner (utan Syss.%) ===
              return "md:grid-cols-5";
            })();
          })(),
          

          selectedPlacement?.type === "Forskning" && "md:grid-cols-3",
        ].join(" ")
      }
      style={
        selectedPlacement
          ? selectedPlacement.type === "Annan ledighet"
            ? { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }
            : selectedPlacement.type === "Forskning" ||
              selectedPlacement.type === "Tjänstledighet" ||
              selectedPlacement.type === "Föräldraledighet" ||
              selectedPlacement.type === "Sjukskriven"
            ? { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }
            : (() => {
                // För core-aktiviteter (Klinisk tjänstgöring, etc.), sätt gridTemplateColumns baserat på antal kolumner
                const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
                const goals2021 = gv === "2021";
                const t = selectedPlacement.type;
                const isCore =
                  t === "Klinisk tjänstgöring" ||
                  t === "Vetenskapligt arbete" ||
                  t === "Förbättringsarbete" ||
                  t === "Auskultation";
                
                if (isCore) {
                  if (gv === "2015") {
                    return { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" };
                  }
                  if (goals2021) {
                    // Kontrollera om BT-fasen är över - använd samma logik som för Fas-väljaren
                    const prof: any = profile || {};
                    const btISO: string | null = prof?.btStartDate || null;
                    if (!btISO || !isValidISO(btISO)) {
                      return { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" };
                    }
                    
                    const btEndManual: string | null = prof?.btEndDate || null;
                    let btEndISO: string | null = null;
                    if (btEndManual && isValidISO(btEndManual)) {
                      btEndISO = btEndManual;
                    } else {
                      try {
                        const d = isoToDateSafe(btISO);
                        btEndISO = dateToISO(addMonths(d, 24));
                      } catch {
                        return { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" };
                      }
                    }
                    
                    if (!btEndISO || !isValidISO(btEndISO)) {
                      return { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" };
                    }
                    
                    // Använd samma logik som för Fas-väljaren: aktiviteten måste ligga HELT mellan BT-start och BT-slut
                    const btStartGlobal = dateToSlot(startYear, btISO, "start");
                    const btEndSlot = dateToSlot(startYear, btEndISO, "end");
                    const btEndGlobal = Number.isFinite(btEndSlot) ? btEndSlot : null;
                    
                    if (!Number.isFinite(btStartGlobal) || btEndGlobal == null) {
                      return { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" };
                    }
                    
                    const s0 = selectedPlacement.startSlot;
                    const e0 = selectedPlacement.startSlot + selectedPlacement.lengthSlots;
                    const inBtWindow = s0 >= btStartGlobal && e0 <= btEndGlobal;
                    
                    // Om aktiviteten INTE ligger helt inom BT-fönstret → 5 kolumner (ST-fas)
                    if (!inBtWindow) {
                      return { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" };
                    }
                    
                    // BT-fasen är aktiv → 6 kolumner
                    return { gridTemplateColumns: "repeat(6, minmax(0, 1fr))" };
                  }
                }
                
                // För andra typer, använd default (grid-cols-klassen hanterar det)
                return undefined;
              })()
          : undefined
      }
    >





      {/* Typ */}
      <div>
        <label className="block text-sm text-slate-700">Typ</label>
        <select
          value={selAct.type}
          onChange={(e) => {
            const t = e.target.value as ActivityType;
            setActivities(prev =>
              prev.map(a =>
                a.id === selAct.id
                  ? {
                      ...a,
                      type: t,
                      attendance: a.attendance ?? 100,
                    }
                  : a
              )
            );
          }}
          className="w-full h-10 rounded-lg border px-3 placeholder:text-slate-400"
        >

          {[
            "Klinisk tjänstgöring",
            "Vetenskapligt arbete",
            "Förbättringsarbete",
            "Auskultation",
            "Forskning",
            "Tjänstledighet",
            "Föräldraledighet",
            "Annan ledighet",
            "Sjukskriven",
          ].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>


      {/* Fas (BT/ST) + Placering/Titel + (för BT-fasad Klinisk tjänstgöring) Beskrivning + Hur det kontrollerats */}
      {(!isLeave(selAct.type) || selAct.type === "Annan ledighet") && (
        <>
          {(() => {
            // Visa fas-väljare endast om:
            //  - målversion 2021
            //  - aktiviteten ligger HELT mellan BT-start och Slutdatum för BT
            const prof: any = profile || {};
            const is2021 = String(prof?.goalsVersion || "").trim() === "2021";
            const btISO: string | null = prof?.btStartDate || null;
            if (!is2021 || !btISO) return null;

            const sel = selectedPlacement;
            if (!sel) return null;
            // Ingen fas-rullista för Forskning eller Annan ledighet
            if (sel.type === "Forskning" || sel.type === "Annan ledighet") return null;



            const btEndManual: string | null = prof?.btEndDate || null;

            // Beräkna effektivt BT-slut (manuellt fält eller 24 mån efter BT-start)
            let btEndISO: string | null = null;
            if (btEndManual && isValidISO(btEndManual)) {
              btEndISO = btEndManual;
            } else if (isValidISO(btISO)) {
              try {
                const btDate = isoToDateSafe(btISO);
                const btEndDate = addMonths(btDate, 24);
                btEndISO = dateToISO(btEndDate);
              } catch {
                btEndISO = null;
              }
            }

            if (!btEndISO) return null;

            const btStartGlobal = dateToSlot(startYear, btISO, "start");
            const btEndSlot = dateToSlot(startYear, btEndISO, "end");
            const btEndGlobal = Number.isFinite(btEndSlot) ? btEndSlot : null;

            if (!Number.isFinite(btStartGlobal) || btEndGlobal == null) return null;

            const s0 = selAct.startSlot;
            const e0 = selAct.startSlot + selAct.lengthSlots;
            const inBtWindow = s0 >= btStartGlobal && e0 <= btEndGlobal;

            if (!inBtWindow) return null;

            return (
              <div>
                <label className="block text-sm text-slate-700">Fas</label>
                <select
                  value={(selAct as any)?.phase || "BT"}
                  onChange={(e) => {
                    const v = e.target.value as "BT" | "ST";
                    setActivities(prev =>
                      prev.map(a => a.id === selAct.id ? { ...a, phase: v } : a)
                    );
                  }}
                  className="w-full h-10 rounded-lg border px-3 placeholder:text-slate-400"
                >
                  <option value="BT">BT</option>
                  <option value="ST">ST</option>
                </select>
              </div>
            );
          })()}


          {selAct.type !== "Forskning" && (
            <div className="md:col-span-1">
              <label className="block text-sm text-slate-700">
                {selAct.type === "Klinisk tjänstgöring" || selAct.type === "Auskultation"
                  ? "Placering"
                  : selAct.type === "Annan ledighet"
                  ? "Beskrivning"
                  : "Titel"}
              </label>
              <input
                value={
                  selAct.type === "Annan ledighet"
                    ? selAct.leaveSubtype || ""
                    : selAct.label || ""
                }
                onChange={(e) => {
                  if (selAct.type === "Annan ledighet") {
                    setActivities((prev) =>
                      prev.map((a) =>
                        a.id === selAct.id ? { ...a, leaveSubtype: e.target.value } : a
                      )
                    );
                  } else {
                    setActivities((prev) =>
                      prev.map((a) =>
                        a.id === selAct.id ? { ...a, label: e.target.value } : a
                      )
                    );
                  }
                }}
                
                className="w-full h-10 rounded-lg border px-3 placeholder:text-slate-400"
              />
            </div>
          )}


          {/* (Borttagen extra rad – flyttas till ordinarie Beskrivning-rad enligt krav) */}

        </>
      )}



      {/* Start */}
      <div>
        <label className="block text-sm text-slate-700">Start</label>
        <CalendarDatePicker
          value={actStartISO}
          onChange={(iso) => applyPlacementDates("start", iso)}
          weekStartsOn={1}
        />
      </div>

      {/* Slut */}
      <div>
        <label className="block text-sm text-slate-700">Slut</label>
        <CalendarDatePicker
          value={actEndISO}
          onChange={(iso) => applyPlacementDates("end", iso)}
          weekStartsOn={1}
        />
      </div>

      {/* Syss.% – visas endast för typer som inte är Forskning eller ledighet */}
      {!(selAct.type === "Forskning" || isLeave(selAct.type)) && (
        <div>
          <label className="block text-sm text-slate-700">Syss.%</label>
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            value={selAct.attendance ?? 100}
            onChange={(e) => {
              const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
              setActivities((prev) =>
                prev.map((a) => (a.id === selAct.id ? { ...a, attendance: v } : a))
              );
            }}
            className="w-full h-10 rounded-lg border px-3"
          />
        </div>
      )}
    </div>

    {/* Handledarfält – visas ENDAST om inte ledighet eller Forskning */}
    {!isLeave(selAct.type) && selAct.type !== "Forskning" && (

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        <div>
          <label className="block text-sm text-slate-700">Handledare</label>
          <input
            value={selAct.supervisor || ""}
            onChange={(e) =>
              setActivities((prev) =>
                prev.map((a) =>
                  a.id === selAct.id ? { ...a, supervisor: e.target.value } : a
                )
              )
            }
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-700">Handledares specialitet</label>
          <input
            value={selAct.supervisorSpeciality || ""}
            onChange={(e) =>
              setActivities((prev) =>
                prev.map((a) =>
                  a.id === selAct.id
                    ? { ...a, supervisorSpeciality: e.target.value }
                    : a
                )
              )
            }
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-700">Handledares tjänsteställe</label>
          <input
            value={selAct.supervisorSite || ""}
            onChange={(e) =>
              setActivities((prev) =>
                prev.map((a) =>
                  a.id === selAct.id ? { ...a, supervisorSite: e.target.value } : a
                )
              )
            }
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
      </div>
    )}

    {/* Notering/Beskrivning + Delmål (delmål visas INTE för ledighet) */}
    <div>
      {(selectedPlacement?.phase === "BT" && selAct.type === "Klinisk tjänstgöring") ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Vänster: Beskrivning */}
          <div>
            <label className="block text-sm text-slate-700">Beskrivning</label>
            <textarea
              value={String((selAct as any)?.note || "")}
              onChange={(e) => {
                const v = e.target.value;
                setActivities((prev) =>
                  prev.map((a) => (a.id === selAct.id ? { ...a, note: v } : a))
                );
              }}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
              
            />
          </div>

          {/* Höger: Hur det kontrollerats … (för Delmål i BT) */}
          <div>
            <label className="block text-sm text-slate-700">
              Hur det kontrollerats att sökanden uppnått delmål (för intyg Delmål i BT)
            </label>
            <textarea
              value={String((selAct as any)?.btAssessment || "")}
              onChange={(e) => {
                const v = e.target.value;
                setActivities((prev) =>
                  prev.map((a) => (a.id === selAct.id ? { ...a, btAssessment: v } : a))
                );
              }}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
            />
          </div>
        </div>
      ) : (
        <>
          <label className="block text-sm text-slate-700">
            {isLeave(selAct.type) && selAct.type !== "Annan ledighet" ? "Notering" : "Beskrivning"}
          </label>
          <textarea
            value={selAct.note || ""}
            onChange={(e) =>
              setActivities((prev) =>
                prev.map((a) => (a.id === selAct.id ? { ...a, note: e.target.value } : a))
              )
            }
            className="min-h-[120px] w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
          />
        </>
      )}


      <div className="mt-2 flex items-center justify-between gap-2">
        {/* Vänster: Delmål – döljs för ALL ledighet (inkl. Annan ledighet & Sjukskriven) samt Forskning */}
{!isLeave(selAct.type) && selAct.type !== "Forskning" ? (

  <>
    {selectedPlacement?.phase === "BT" ? (
      <div className="flex flex-col gap-2">
        {/* 1) Kryssruta överst */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!(selectedPlacement as any)?.fulfillsStGoals}
            onChange={(e) => {
              const checked = (e.target as HTMLInputElement).checked;
              setActivities(prev =>
                prev.map(a =>
                  a.id === (selectedPlacement as any)?.id
                    ? { ...a, fulfillsStGoals: checked }
                    : a
                )
              );
            }}
          />
          Uppfyller ST-delmål
        </label>

                       {/* BT- och ST-delmål: BT-rad överst, ST-rad under (om ikryssad) */}
        <div className="flex flex-col gap-1">
          {/* Rad 1: BT-delmål */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
              onClick={() => setBtMilestonePicker({ open: true, mode: "placement" })}
            >
              BT-delmål
            </button>

            <div className="flex items-center gap-1 flex-wrap">
              {(selectedPlacement as any)?.btMilestones?.length > 0 ? (
                sortMilestoneIds(((selectedPlacement as any).btMilestones || []) as string[]).map((m: string) => (
                  <button
                    key={`bt-${m}`}
                    type="button"
                    onClick={() => setBtMilestoneDetail(m)}
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
                  >
                    {String(m).trim().split(/\s|–|-|:|\u2013/)[0].toLowerCase()}
                  </button>
                ))
              ) : (
                <span className="text-slate-400 text-sm">—</span>
              )}

            </div>

          </div>

          {/* Rad 2: ST-delmål (visas bara om "Uppfyller ST-delmål" är ikryssad) */}
          {(selectedPlacement as any)?.fulfillsStGoals && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
                onClick={() => setMilestonePicker({ open: true, mode: "placement" })}
              >
                ST-delmål
              </button>
              <div className="flex items-center gap-1 flex-wrap">
                {(selectedPlacement as any)?.milestones?.length > 0 ? (
                  (selectedPlacement as any).milestones.map((m: string) => (
                    <button
                      key={`st-${m}`}
                      type="button"
                      onClick={() => setStMilestoneDetail(m)}
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
                    >
                      {String(m).trim().split(/\s|–|-|:|\u2013/)[0].toLowerCase()}
                    </button>
                  ))
                ) : (
                  <span className="text-slate-400 text-sm">—</span>
                )}
              </div>

            </div>
          )}
        </div>


      </div>
    ) : (
      /* ST-phase oförändrad: knapp + chips i samma rad */
      <div className="flex items-center gap-2">
        <button
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
          onClick={() => setMilestonePicker({ open: true, mode: "placement" })}
        >
          Delmål
        </button>
        <div className="flex items-center gap-1 flex-wrap">
          {selectedPlacement?.id && (selectedPlacement as any)?.milestones?.length > 0 ? (
            sortMilestoneIds(((selectedPlacement as any).milestones || []) as string[]).map((m: string) => (
              <button
                key={m}
                type="button"
                onClick={() => setStMilestoneDetail(m)}
                className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
              >
                {String(m).trim().split(/\s|–|-|:|\u2013/)[0].toLowerCase()}
              </button>
            ))
          ) : (
            <span className="text-slate-400 text-sm">—</span>
          )}

        </div>

      </div>
    )}
  </>
) : (
  <div />
)}


        {/* Höger: Spara / Stäng / Ta bort (Ta bort varnar endast om ändrat) */}
        <div className="flex items-center gap-2">
                    <button
                      disabled={!dirty}
                      onClick={async () => {
                        if (!dirty) return;
                        await savePlacementToDb(selAct);
                      }}
                      className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Spara
                    </button>


          <button
  onClick={closeDetailPanel}
  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
  title="Stäng panelen"
>
  Stäng
</button>


          <button
  onClick={async () => {
    const a = selAct;
    if (!a) return;

    if (dirty) {
      if (!confirm("Du har osparade ändringar. Ta bort ändå?")) return;
    } else {
      if (!confirm("Vill du ta bort vald aktivitet?")) return;
    }

    if (a.linkedPlacementId) {
      try {
        await db.placements.delete(a.linkedPlacementId);
      } catch {}
    }
    setActivities((prev) => prev.filter((x) => x.id !== a.id));
    setSelectedPlacementId(null);
    await refreshLists();
  }}
  className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 transition hover:border-red-400 hover:bg-red-200 active:translate-y-px"

  title="Ta bort vald aktivitet"
>
  Ta bort
</button>


        </div>
      </div>
    </div>
  </>
)}

            {/* === KURS === */}

            {isCourse && selCourse && (
  <div className="grid gap-3">
             {/* Rad 1: kurs, ort, kursledare, start, slut, (ev. Fas BT/ST mellan BT-start och Slutdatum för BT) */}
    <div
      className={[
        "grid gap-3 grid-cols-1",
        (() => {
          const prof: any = profile || {};
          const is2021 = String(prof?.goalsVersion || "").trim() === "2021";
          const btISO: string | null = prof?.btStartDate || null;
          if (!is2021 || !btISO || !isValidISO(btISO)) return "md:grid-cols-6";

          // Effektivt BT-slut: manuellt fält eller 24 månader efter BT-start
          const btEndManual: string | null = prof?.btEndDate || null;
          let btEndISO: string | null = null;
          if (btEndManual && isValidISO(btEndManual)) {
            btEndISO = btEndManual;
          } else {
            try {
              const btDate = isoToDateSafe(btISO);
              btEndISO = dateToISO(addMonths(btDate, 24));
            } catch {
              btEndISO = null;
            }
          }
          if (!btEndISO) return "md:grid-cols-6";

          const startISO =
            selCourse.startDate || selCourse.endDate || "";
          if (!startISO || !isValidISO(startISO)) return "md:grid-cols-6";

          // Inom BT-fönstret om startdatum ligger mellan BT-start och Slutdatum för BT
          const inBtWindow =
            startISO >= btISO &&
            startISO <= btEndISO;

          return inBtWindow ? "md:grid-cols-7" : "md:grid-cols-6";
        })(),
      ].join(" ")}
    >
      {/* Kurs */}
      <div>
        <label className="block text-sm text-slate-700">Kurs</label>
        <select
          value={selCourse.title || ""}
          onChange={(e) => {
            const nextTitle = e.target.value;
            const autoMilestones = mapMetisGoalsToMilestoneIds(nextTitle, profile);

            setCourses((prev) =>
              prev.map((c) => {
                if (c.id !== selCourse.id) return c;

                const isPsyTitle = /(^|\s)psykoterapi/.test((nextTitle || "").toLowerCase());
                const existingFlag = (c as any).showAsInterval;
                const nextShowAsInterval =
                  typeof existingFlag === "boolean" ? existingFlag : isPsyTitle;

                return {
                  ...c,
                  title: nextTitle,
                  // Alltid sätt milestones utifrån METIS-mappningen
                  // (tom lista om kursen inte är METIS eller ingen mappning finns)
                  milestones: autoMilestones,
                  showAsInterval: nextShowAsInterval,
                };
              })
            );
            // Dirty-state uppdateras automatiskt via checkDirty
          }}
          className="w-full h-10 rounded-lg border px-3"
        >
          <option value="" disabled hidden data-placeholder="1">
            Välj kurs …
          </option>

          <optgroup label="— METISKURSER —">
            {METIS_COURSES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </optgroup>

          <optgroup label="— ÖVRIGA —">
            <option value="Psykoterapi">Psykoterapi</option>
            <option value="Ledarskap">Ledarskap</option>
            <option value="Handledning">Handledning</option>
            <option value="Palliativ medicin">Palliativ medicin</option>
            <option value="Annan kurs">Annan kurs</option>
          </optgroup>
        </select>
      </div>

      {/* Fas BT/ST – visas endast om kursens startdatum ligger mellan BT-start och Slutdatum för BT */}
      {(() => {
        const prof: any = profile || {};
        const is2021 = String(prof?.goalsVersion || "").trim() === "2021";
        const btISO: string | null = prof?.btStartDate || null;
        if (!is2021 || !btISO || !isValidISO(btISO)) return null;

        // Effektivt BT-slut: manuellt Slutdatum för BT eller 24 månader efter BT-start
        const btEndManual: string | null = prof?.btEndDate || null;
        let btEndISO: string | null = null;
        if (btEndManual && isValidISO(btEndManual)) {
          btEndISO = btEndManual;
        } else {
          try {
            const btDate = isoToDateSafe(btISO);
            btEndISO = dateToISO(addMonths(btDate, 24));
          } catch {
            btEndISO = null;
          }
        }
        if (!btEndISO) return null;

        const startISO =
          selCourse.startDate || selCourse.endDate || "";
        if (!startISO || !isValidISO(startISO)) return null;

        // Rullisten syns endast om kursens startdatum ligger inom [BT-start, Slutdatum för BT]
        const inBtWindow =
          startISO >= btISO &&
          startISO <= btEndISO;
        if (!inBtWindow) return null;

        return (
          <div>
            <label className="block text-sm text-slate-700">
              Fas
            </label>
            <select
              value={(selCourse as any)?.phase || "BT"}
              onChange={(e) => {
                const v = e.target.value as "BT" | "ST";
                setCourses((prev) =>
                  prev.map((c) =>
                    c.id === selCourse.id
                      ? { ...c, phase: v }
                      : c
                  )
                );
              }}
              className="w-full h-10 rounded-lg border px-3 placeholder:text-slate-400"
            >
              <option value="BT">BT</option>
              <option value="ST">ST</option>
            </select>
          </div>
        );
      })()}

      {/* Ort */}
      <div>
        <label className="block text-sm text-slate-700">Ort</label>
        <input
          value={selCourse.city || ""}
          onChange={(e) =>
            setCourses((prev) =>
              prev.map((c) =>
                c.id === selCourse.id
                  ? { ...c, city: e.target.value }
                  : c
              )
            )
          }
          className="w-full h-10 rounded-lg border px-3"
        />
      </div>

      {/* Kursledare */}
      <div>
        <label className="block text-sm text-slate-700">
          Kursledare
        </label>
        <input
          value={selCourse.courseLeaderName || ""}
          onChange={(e) =>
            setCourses((prev) =>
              prev.map((c) =>
                c.id === selCourse.id
                  ? { ...c, courseLeaderName: e.target.value }
                  : c
              )
            )
          }
          className="w-full h-10 rounded-lg border px-3"
        />
      </div>

      {/* Start */}
      <div>
        <label className="block text-sm text-slate-700">Start</label>
        <CalendarDatePicker
          value={
            (selCourse as any)?.showAsInterval
              ? (selCourse.startDate || "")
              : (selCourse.startDate || selCourse.endDate)
          }
          onChange={(iso) => {
            const nextISO = iso || undefined;
            setCourses((prev) =>
              prev.map((c) => {
                if (c.id !== selCourse.id) return c;
                const showAsInterval = (c as any)?.showAsInterval;

                // I intervall-läge: ändra bara start
                if (showAsInterval) {
                  return {
                    ...c,
                    startDate: nextISO,
                  };
                }

                // Punkt-läge (som tidigare): om slut saknas så följer det med
                if (!nextISO) {
                  return { ...c, startDate: undefined };
                }

                return {
                  ...c,
                  startDate: nextISO,
                  endDate: c.endDate || nextISO,
                };
              })
            );
            setDirty(true);
          }}
          isClearable
          weekStartsOn={1}
        />
      </div>


      {/* Slut */}
      <div>
        <label className="block text-sm text-slate-700">Slut</label>
        <CalendarDatePicker
          value={
            (selCourse as any)?.showAsInterval
              ? (selCourse.endDate || "")
              : (selCourse.endDate || selCourse.startDate)
          }
          onChange={(iso) => {
            const nextISO = iso || undefined;
            setCourses((prev) =>
              prev.map((c) => {
                if (c.id !== selCourse.id) return c;
                const showAsInterval = (c as any)?.showAsInterval;

                // I intervall-läge: ändra bara slut
                if (showAsInterval) {
                  return {
                    ...c,
                    endDate: nextISO,
                  };
                }

                // Punkt-läge (som tidigare): om start saknas så följer det med
                const end = nextISO;
                const start = c.startDate || end;
                return {
                  ...c,
                  endDate: end,
                  startDate: start,
                };
              })
            );
            setDirty(true);
          }}
          isClearable
          weekStartsOn={1}
        />
      </div>


            {/* Visningsläge: intervall vs datum */}
      <div>
        <label className="block text-sm text-slate-700">
          Visa i tidslinjen
        </label>
        <select
          className="w-full h-9.5 rounded-lg border px-3"
          value={(() => {
            const raw = (selCourse as any)?.showAsInterval;
            const title = `${selCourse.title || ""}`.toLowerCase();
            const isPsyDefault = /(^|\s)psykoterapi/.test(title);

            const isInterval =
              typeof raw === "boolean" ? raw : isPsyDefault;

            return isInterval ? "interval" : "date";
          })()}
          onChange={(e) => {
            const mode = e.target.value as "interval" | "date";
            const flag = mode === "interval";

            updateSelectedCourse({ showAsInterval: flag });
            // Dirty-state uppdateras automatiskt via checkDirty
          }}
        >
          <option value="interval">Start till slut</option>
          <option value="date">Enbart slutdatum</option>
        </select>
      </div>


    </div>


        {/* Beskrivning + Välj delmål (kvar som tidigare för kurser) */}
    <div>
      {selectedCourse?.phase === "BT" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Vänster: Beskrivning (kurs) */}
          <div>
            <label className="block text-sm text-slate-700">Beskrivning</label>
            <textarea
              value={String((selCourse as any)?.note || "")}
              onChange={(e) => {
                const v = e.target.value;
                setCourses((prev) =>
                  prev.map((c) =>
                    c.id === selCourse.id ? { ...c, note: v } : c
                  )
                );
              }}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
              
            />
          </div>

          {/* Höger: Hur det kontrollerats … (nytt fält, kurs i BT-fas) */}
          <div>
            <label className="block text-sm text-slate-700">
              Hur det kontrollerats att sökanden uppnått delmål (för intyg Delmål i BT)
            </label>
            <textarea
              value={String((selCourse as any)?.btAssessment || "")}
              onChange={(e) => {
                const v = e.target.value;
                setCourses((prev) =>
                  prev.map((c) =>
                    c.id === selCourse.id ? { ...(c as any), btAssessment: v } : c
                  )
                );
              }}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
              
            />
          </div>
        </div>
      ) : (
        <>
          <label className="block text-sm text-slate-700">Beskrivning</label>
          <textarea
            value={String((selCourse as any)?.note || "")}
            onChange={(e) => {
              const v = e.target.value;
              setCourses((prev) =>
                prev.map((c) =>
                  c.id === selCourse.id ? { ...c, note: v } : c
                )
              );
            }}
            rows={3}
            className="w-full rounded-lg border px-3 py-2 placeholder:text-slate-400"
            
          />
        </>
      )}


      <div className="mt-2 flex items-center justify-between gap-2">
        {/* Vänster: BT/ST-delmål + chips */}
<div className="flex flex-col gap-2">
  {selectedCourse?.phase === "BT" ? (
    <>
      {/* 1) Kryssruta överst */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!(selectedCourse as any)?.fulfillsStGoals}
          onChange={(e) => {
            const checked = (e.target as HTMLInputElement).checked;
            setCourses(prev =>
              prev.map(c =>
                c.id === (selectedCourse as any)?.id
                  ? { ...c, fulfillsStGoals: checked }
                  : c
              )
            );
          }}
        />
        Uppfyller ST-delmål
      </label>

      {/* 2) Rad med BT-delmål + BT-chips till höger */}
      <div className="flex items-center gap-2">
        <button
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
          onClick={() => setBtMilestonePicker({ open: true, mode: "course" })}
        >
          BT-delmål
        </button>

        <div className="flex items-center gap-1 flex-wrap">
          {(selectedCourse as any)?.btMilestones?.length > 0 ? (
            sortMilestoneIds(((selectedCourse as any).btMilestones || []) as string[]).map((m: string) => (
              <button
                key={`bt-${m}`}
                type="button"
                onClick={() => setBtMilestoneDetail(m)}
                className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
              >
                {String(m).trim().split(/\s|–|-|:|\u2013/)[0].toLowerCase()}
              </button>
            ))
          ) : (
            <span className="text-slate-400 text-sm">—</span>
          )}

        </div>

      </div>

      {/* 3) Rad med ST-delmål + ST-chips UNDER BT-raden (bara om ikryssad) */}
      {(selectedCourse as any)?.fulfillsStGoals && (
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
            onClick={() => setMilestonePicker({ open: true, mode: "course" })}
          >
            ST-delmål
          </button>

          <div className="flex items-center gap-1 flex-wrap">
            {(selectedCourse as any)?.milestones?.length > 0 ? (
              sortMilestoneIds(((selectedCourse as any).milestones || []) as string[]).map((m: string) => (
                <button
                  key={`st-${m}`}
                  type="button"
                  onClick={() => setStMilestoneDetail(m)}
                  className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
                >
                  {String(m).trim().split(/\s|–|-|:|\u2013/)[0].toLowerCase()}
                </button>
              ))
            ) : (
              <span className="text-slate-400 text-sm">—</span>
            )}

          </div>

        </div>
      )}
    </>
  ) : (
    /* ST-phase oförändrad: knapp + chips i samma rad */
    <div className="flex items-center gap-2">
      <button
        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
        onClick={() => setMilestonePicker({ open: true, mode: "course" })}
      >
        Delmål
      </button>

      <div className="flex items-center gap-1 flex-wrap">
        {(selectedCourse as any)?.milestones?.length > 0 ? (
          sortMilestoneIds(((selectedCourse as any).milestones || []) as string[]).map((m: string) => (
            <span key={`st-${m}`} className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
              {String(m).trim().split(/\s|–|-|:|\u2013/)[0].toLowerCase()}
            </span>
          ))
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        )}

      </div>

    </div>
  )}
</div>



        {/* Höger: Spara / Stäng / Ta bort (Ta bort varnar endast om ändrat) */}
        <div className="flex items-center gap-2">
          <button
            disabled={!dirty}
            onClick={async () => {
              if (!dirty) return;
              await saveCourseToDb(selCourse);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
          >
            Spara
          </button>



          <button
  onClick={closeDetailPanel}
  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
  title="Stäng panelen"
>
  Stäng
</button>

          <button
  onClick={async () => {
    const c = selCourse;
    if (!c) return;

    if (dirty) {
      if (!confirm("Du har osparade ändringar. Ta bort ändå?")) return;
    } else {
      if (!confirm("Vill du ta bort vald aktivitet?")) return;
    }

    await deleteSelectedCourse();
  }}
  className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 transition hover:border-red-400 hover:bg-red-200 active:translate-y-px"

  title="Ta bort vald kurs"
>
  Ta bort
</button>


        </div>
      </div>
    </div>
  </div>
)}

          </div>
        );
      })()}
      {/* ===== Listor (vänster aktiviteter / höger kurser) – bygger på lokalt state ===== */}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Vänster: Utbildningsaktiviteter */}
        <div className="md:col-span-2 rounded-xl border bg-white overflow-hidden">

          <div className="flex items-center justify-between border-b px-3 py-2">
  <div className="font-semibold">Klinisk tjänstgöring, arbeten, ledighet, sjukskrivning</div>
</div>

<GapWarnings
  startYear={startYear}
  activities={activities}
  dismissedGaps={dismissedGaps}
  onDismiss={(id) => setDismissedGaps(prev => [...new Set([...prev, id])])}
/>

<div className="max-h-[40vh] overflow-auto">

            <table className="w-full text-sm select-none">

              <thead className="sticky top-0 bg-slate-50">
  <tr>
    <th className="px-3 py-2 text-left">Moment</th>
    <th className="px-3 py-2 text-center">Start</th>
    <th className="px-3 py-2 text-center">Slut</th>
    <th className="px-12 py-2 text-center w-14">Syss.%</th>
    <th className="px-2 py-2 text-center w-24 whitespace-nowrap">Mån (motsv heltid)</th>
    <th className="px-3 py-2" />
  </tr>
</thead>



              <tbody className="cursor-default">

                {activities
  .slice()
  .sort((a, b) =>
    (a.startSlot - b.startSlot) ||
    ((a.startSlot + a.lengthSlots) - (b.startSlot + b.lengthSlots))
  )
  .map((a) => {

                  const s = slotToYearMonthHalf(startYear, a.startSlot);
                  const startISO = dateToISO(mondayOnOrAfter(s.year, s.month0, s.half===0?1:15));
                  const eSlot = a.startSlot + a.lengthSlots - 1;
                  const e = slotToYearMonthHalf(startYear, eSlot);
                  const endISO = dateToISO(sundayOnOrBefore(
                    e.year + (e.half===1 && e.month0===11 ? 1 : (e.month0 + (e.half===1?1:0) > 11 ? 1 : 0)),
                    (e.month0 + (e.half===1?1:0) + 12)%12,
                    e.half===0?15:1
                  ));
                  const isSelected = selectedPlacementId === a.id;
                  const title = (() => {
  if (a.type === "Klinisk tjänstgöring" || a.type === "Auskultation") {
    // Visa platsnamn om angivet, annars typen
    return a.label || a.type;
  }
  if (a.type === "Annan ledighet") {
    // Visa den lilla "Beskrivning"en (leaveSubtype) om angiven, annars typen
    return a.leaveSubtype || a.type;
  }
  if (a.type === "Vetenskapligt arbete" || a.type === "Förbättringsarbete") {
    // Visa alltid typen, även om Titel/label är ifylld
    return a.type;
  }
  // Övriga typer: visa titel om angiven, annars typen
  return a.label || a.type;
})();


                  const attendance = a.attendance ?? (isZeroAttendanceType(a.type) ? 0 : 100);
                  const fteMonths = (a.lengthSlots * 0.5) * (attendance / 100); // motsv. heltid i månader



                  return (
                    <tr
                      key={a.id}
                      className={`border-t ${isSelected ? "bg-slate-200 hover:bg-slate-300 text-slate-900 ring-1 ring-slate-300" : "hover:bg-slate-50"}`}






                      onClick={() => { switchActivity(a.id, null); }}
                      onDoubleClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  switchActivity(a.id, null);

  // BT-fasad aktivitet
  if (a.phase === "BT") {
    // Om inte uppfyller ST-mål → direkt förhandsvisning av Delmål i BT
    if (!(a as any)?.fulfillsStGoals) {
      openPreviewForBtGoals(a);
      return;
    }
    // Uppfyller ST-mål → öppna popup med BT-intyg / ST-intyg
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCertMenu({
      open: true,
      x: Math.round(e.clientX),
      y: Math.round(rect.top + rect.height / 2),
      placement: a,
    });
    return;
  }

  // ST-fasade aktiviteter: STa3-intyg eller vanligt ST-intyg
  const v = String(profile?.goalsVersion || "");
  if (a.type === "Vetenskapligt arbete" && v.includes("2021")) {
    const isSta3 = (m: any) => {
      const id = String(m ?? "")
        .trim()
        .split(/\s|–|-|:|\u2013/)[0]
        .toLowerCase();
      return id === "a3" || id === "sta3";
    };

    // Kliniska tjänstgöringar med STa3 – från activities
    const placementItems = activities
      .filter(
        (x: any) =>
          x.type === "Klinisk tjänstgöring" &&
          Array.isArray((x as any).milestones) &&
          (x as any).milestones.some(isSta3),
      )
      .map((x: any) => {
        const { startISO, endISO } = computeMondayDates(x);
        return {
          id: x.linkedPlacementId || x.id,
          title: x.label || "Klinisk tjänstgöring",
          period: `${startISO}${endISO ? ` – ${endISO}` : ""}`,
        };
      });

    // Kurser med STa3 – från courses
    const courseItems = courses
      .filter(
        (c: any) =>
          Array.isArray((c as any).milestones) &&
          (c as any).milestones.some(isSta3),
      )
      .map((c: any) => ({
        id: c.linkedCourseId || c.id,
        title: c.title || c.provider || "Kurs",
        period: [
          c.city,
          (c.certificateDate || c.endDate || c.startDate || "") as string,
        ]
          .filter(Boolean)
          .join(" · "),
      }));

    setSta3Placements(placementItems);
    setSta3Courses(courseItems);
    setSta3ResearchTitle(a.label || a.note || "");
    setSta3SupervisorName(a.supervisor || "");
    setSta3SupervisorSpec(a.supervisorSpeciality || "");
    setSta3SupervisorSite(
      a.supervisorSite || (profile as any)?.homeClinic || "",
    );
    setSta3Open(true);
    return;
  }

  // Övriga ST-aktiviteter
  openPreviewForPlacement(a);
}}



                    >
                      <td className="px-3 py-1.5">
  {(() => {
    const baseStyle: React.CSSProperties =
      a.type === "Forskning"
        ? {
            backgroundColor: "#ffffff",
            border: "1px solid hsl(220 14% 82%)",
          }
        : isLeave(a.type)
        ? {
            background:
              "repeating-linear-gradient(135deg, hsl(220 16% 98%),...(220 16% 98%) 6px, hsl(220 14% 86%) 6px, hsl(220 14% 86%) 8px)",
            border: "1px solid hsl(220 12% 75%)",
          }
        : {
            backgroundColor: `hsl(${a.hue} 28% 88%)`,
            border: `1px solid hsl(${a.hue} 30% 72%)`,
          };


    return (
      <span title={title} className="inline-flex items-center">
  <span
    className="inline-block rounded-md px-2 py-0.5 text-[12px] leading-5 text-slate-900"
    style={baseStyle}
  >
    {title}
  </span>
  {a.phase === "BT" && (
    <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-black bg-white text-[10px] leading-4 text-slate-900">
      BT
    </span>
  )}
  {btstWarnActIds.has(a.id) && (
    <span
      className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border text-[10px] leading-4 border-red-300 bg-red-50 text-red-900"
      title="Detta intervall passerar gränsen BT → ST"
    >
      ⚠︎ BT→ST
    </span>
  )}
</span>

    );
  })()}
</td>


                      <td className="px-3 py-1.5 text-center">{startISO}</td>
                      <td className="px-3 py-1.5 text-center">{endISO}</td>
                      <td className="px-3 py-1.5 text-center">{isLeave(a.type) ? "—" : (a.attendance ?? 100)}</td>
                      <td className="px-3 py-1.5 text-center">{isLeave(a.type) ? "—" : fteMonths.toFixed(1)}</td>
                      



                      <td className="px-3 py-1.5 text-right">
  {a.phase === "BT" ? (
    <div className="inline-flex items-center gap-2">
      {/* BT-intyg alltid för BT-fasade KLINISKA tjänstgöringar */}
      {a.type === "Klinisk tjänstgöring" && (
        <button
  className={`inline-flex h-7 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
    isSelected
      ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
      : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
  }`}
  onClick={(e) => {
    e.stopPropagation();
    switchActivity(a.id, null);
    // Förhandsvisa "Delmål i BT" (Bilaga 2) med valda BT-delmål
    openPreviewForBtGoals(a);
  }}
  title="Delmål i bastjänstgöringen"
>
  BT-intyg
</button>

      )}

      {/* Om uppfyller ST-mål i BT → visa ST-intyg bredvid, annars ingen ST-knapp här */}
      {(a as any)?.fulfillsStGoals && (
        <button
          className={`inline-flex h-7 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
            isSelected
              ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
              : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            switchActivity(a.id, null);
            if (!profile) {
              alert("Profil saknas – kan inte skapa intyget.");
              return;
            }
            openPreviewForPlacement(a);
          }}
          title="Intyg för klinisk tjänstgöring i ST"
        >
          ST-intyg
        </button>
      )}
    </div>
  ) : (
    // ST-fas: befintligt Intyg (oförändrat)
    <button
      className={`inline-flex h-7 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
        isSelected
          ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
          : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
      }`}
      onClick={async (e) => {
        e.stopPropagation();
        switchActivity(a.id, null);

        if (!profile) {
          alert("Profil saknas – kan inte skapa intyget.");
          return;
        }

        const v = String(profile?.goalsVersion || "");
        if (a.type === "Vetenskapligt arbete" && v.includes("2021")) {
          const isSta3 = (m: any) => {
            const id = String(m ?? "")
              .trim()
              .split(/\s|–|-|:|\u2013/)[0]
              .toLowerCase();
            return id === "a3" || id === "sta3";
          };

          const placementItems = activities
            .filter(
              (x: any) =>
                x.type === "Klinisk tjänstgöring" &&
                Array.isArray((x as any).milestones) &&
                (x as any).milestones.some(isSta3),
            )
            .map((x: any) => {
              const { startISO, endISO } = computeMondayDates(x);
              const title = x.label || x.type;
              return {
                id: (x as any).linkedPlacementId || x.id,
                title,
                period: `${startISO}${endISO ? ` – ${endISO}` : ""}`,
              };
            });

          const courseItems = courses
            .filter(
              (c: any) =>
                Array.isArray((c as any).milestones) &&
                (c as any).milestones.some(isSta3),
            )
            .map((c: any) => ({
              id: (c as any).linkedCourseId || c.id,
              title: c.title || (c as any).provider || "Kurs",
              period: [
                c.city,
                ((c as any).certificateDate ||
                  c.endDate ||
                  c.startDate ||
                  "") as string,
              ]
                .filter(Boolean)
                .join(" · "),
            }));

          setSta3Placements(placementItems);
          setSta3Courses(courseItems);
          setSta3ResearchTitle(a.label || a.note || "");
          setSta3SupervisorName(a.supervisor || "");
          setSta3SupervisorSpec(a.supervisorSpeciality || "");
          setSta3SupervisorSite(
            a.supervisorSite || (profile as any)?.homeClinic || "",
          );
          setSta3Open(true);
          return;
        }

        openPreviewForPlacement(a);
      }}

    >
      Intyg
    </button>
  )}
</td>


                    </tr>
                  );
                })}
                {activities.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-3 text-slate-500">Inga aktiviteter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Höger: Kurser */}
<div className="rounded-xl border bg-white overflow-hidden">

  <div className="flex items-center justify-between border-b px-3 py-2">
  <div className="font-semibold">Kurser</div>
</div>



<div className="max-h-[40vh] overflow-auto">

    <table className="w-full text-sm select-none">

      <thead className="sticky top-0 bg-slate-50 text-left">
  <tr>
    <th className="px-3 py-2">Kursnamn</th>
    <th className="px-3 py-2 text-left">Intygsdatum</th>
    <th className="px-3 py-2" />
  </tr>
</thead>


      <tbody className="cursor-default">

        {courses
  .slice()
  .sort((a, b) => {
    const da = (a.endDate || a.certificateDate || a.startDate || "");
    const db = (b.endDate || b.certificateDate || b.startDate || "");
    return da.localeCompare(db);
  })
  .map((c) => {

            const isSelected = selectedCourseId === c.id;
            return (
              <tr
                key={c.id}
                className={`border-t ${
  isSelected
    ? "bg-slate-200 hover:bg-slate-300 text-slate-900 shadow-[inset_0_0_0_1px_rgba(100,116,139,1)]"
    : "hover:bg-slate-50"
}`}

                onClick={() => {
                  switchActivity(null, c.id);
                }}
                                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  switchActivity(null, c.id);

                  // BT-kurs
                  if (c.phase === "BT") {
                    // BT + ST-delmål → öppna val-popup (BT / ST)
                    if ((c as any)?.fulfillsStGoals) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setCertMenu({
                        open: true,
                        x: Math.round(e.clientX),
                        y: Math.round(rect.top + rect.height / 2),
                        kind: "course",
                        placement: null,
                        course: c,
                      });
                      return;
                    }

                    // Endast BT-intyg → direkt delmål i BT
                    const dummyActivity: Activity = {
                      id: c.id,
                      type: "Kurs",
                      label: c.title || "Kurs",
                      startSlot: 0,
                      lengthSlots: 1,
                      hue: 0,
                      phase: "BT",
                      restPercent: 0,
                      isLocked: false,
                      btAssessment: (c as any).btAssessment || "",
                      btMilestones: (c as any).btMilestones || [],
                    } as any;

                    openPreviewForBtGoals(dummyActivity);
                    return;
                  }

                  // ST-kurs → ST-kursintyg via CoursePrepModal (2015 och 2021)
                  if (!profile) {
                    alert("Profil saknas – kan inte skapa intyget.");
                    return;
                  }
                  setCourseForModal(c);
                  setCourseModalOpen(true);
                }}





              >
                                <td className="px-3 py-1.5">
  <span className="inline-flex items-center">
    <span>{c.title || "—"}</span>
    {c.phase === "BT" && (
      <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-black bg-white text-[10px] leading-4 text-slate-900">
        BT
      </span>
    )}
    {btstWarnCourseIds.has(c.id) && (
      <span
        className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border text-[10px] leading-4 border-red-300 bg-red-50 text-red-900"
        title="Detta intervall passerar gränsen BT → ST"
      >
        ⚠︎ BT→ST
      </span>
    )}
  </span>
</td>


               
                <td className="px-3 py-1.5">{c.endDate || "—"}</td>

                                          <td className="px-3 py-1.5 text-right">
                  {c.phase === "BT" ? (
                    <div className="inline-flex items-center gap-2">
                      {/* BT-intyg – Delmål i BT, samma som klinisk tjänstgöring */}
                      <button
                        className={`inline-flex h-7 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
                          isSelected
                            ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
                            : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();

                          const dummyActivity: Activity = {
                            id: c.id,
                            type: "Klinisk tjänstgöring",
                            label: c.title || "Kurs",
                            startSlot: 0,
                            lengthSlots: 1,
                            hue: 0,
                            phase: "BT",
                            restPercent: 0,
                            isLocked: false,
                            supervisor: (c as any).supervisor || "",
                            supervisorSpeciality: (c as any).supervisorSpeciality || "",
                            supervisorSite: (c as any).supervisorSite || "",
                            note: c.note || "",
                            ...(c as any)?.btAssessment
                              ? { btAssessment: (c as any).btAssessment as string }
                              : {},
                            ...(c as any)?.btMilestones
                              ? { btMilestones: ((c as any).btMilestones as string[]) }
                              : {},
                          } as any;

                          void openPreviewForBtGoals(dummyActivity);
                        }}
                      >
                        BT-intyg
                      </button>

                      {/* ST-intyg – endast om kursen markerats som Uppfyller ST-delmål */}
                      {(c as any)?.fulfillsStGoals && (
                        <button
                          className={`inline-flex h-7 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
                            isSelected
                              ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
                              : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!profile) {
                              alert("Profil saknas – kan inte skapa intyget.");
                              return;
                            }
                            switchActivity(null, c.id);
                            setCourseForModal(c);
                            setCourseModalOpen(true);
                          }}
                        >
                          ST-intyg
                        </button>
                      )}
                    </div>
                  ) : (
                    // ST-kurs (eller fas ej BT) → ST-kursintyg via CoursePrepModal (2015 och 2021)
                    <button
                      className={`inline-flex h-7 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold text-slate-900 transition active:translate-y-px ${
                        isSelected
                          ? "bg-slate-200 border-slate-300 hover:bg-slate-300 hover:border-slate-400"
                          : "border-slate-300 bg-slate-50 hover:bg-slate-200 hover:border-slate-400"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!profile) {
                          alert("Profil saknas – kan inte skapa intyget.");
                          return;
                        }
                        switchActivity(null, c.id);
                        setCourseForModal(c);
                        setCourseModalOpen(true);
                      }}
                    >
                      Intyg
                    </button>
                  )}

                </td>




              </tr>
            );
          })}
        {courses.length === 0 && (
          <tr>
            <td colSpan={3} className="px-3 py-3 text-slate-500">
              Inga kurser.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>

{/* Summering & beräknat slut (synkat med röd linje) */}
<div className="md:col-span-3 mt-2 rounded-xl border bg-white p-3 flex flex-col gap-2">
  {(() => {
    const workedFteMonths = activities
      .filter((a) => !isLeave(a.type))
      .reduce(
        (acc, a) => acc + a.lengthSlots * 0.5 * ((a.attendance ?? 100) / 100),
        0
      );

    const profAny: any = profile || {};

    // Etikett beror på målversion
    const gv = String(profAny?.goalsVersion || "").trim();
    const totalLabel = gv === "2021" ? "Total tid för BT + ST:" : "Total tid för ST:";

    // BT-start & BT-slut (manuellt/auto)
    const btStartISO: string | null = profAny?.btStartDate || null;
    const btEndManualISO: string | null = profAny?.btEndDate || null;

    let autoBtEndISO: string | null = null;
    if (!btEndManualISO && btStartISO && isValidISO(btStartISO)) {
      try {
        const btDate = isoToDateSafe(btStartISO);
        const btEndDate = addMonths(btDate, 24);
        autoBtEndISO = dateToISO(btEndDate);
      } catch {
        autoBtEndISO = null;
      }
    }

    const effectiveBtEndISO: string | null = btEndManualISO || autoBtEndISO;

    // Beräkna (endast 2021) månader från BT-start till ST-slut som en visningshjälp
    const monthsBtToSt: number | null = (() => {
      if (gv !== "2021") return null;
      const bt = btStartISO;
      const stEnd = stEndISO || profAny?.stEndDate || null;
      if (!bt || !stEnd) return null;
      const a = new Date(bt + "T00:00:00");
      const b = new Date(stEnd + "T00:00:00");
      if (!(isFinite(+a) && isFinite(+b))) return null;
      let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
      if (b.getDate() < a.getDate()) months -= 1;
      return Math.max(0, months);
    })();

    const handleBtEndChange = async (iso: string | null) => {
      const nextISO = iso && isValidISO(iso) ? iso : null;

      setProfile((prev: any) =>
        prev
          ? {
              ...prev,
              btEndDate: nextISO,
            }
          : prev
      );

      try {
        const arr = await (db as any)?.profile?.toArray?.();
        const current = Array.isArray(arr) ? arr[0] : null;
        if (current && current.id != null) {
          await (db as any)?.profile?.update?.(current.id, { btEndDate: nextISO });
        }
      } catch {
        // tyst – UI ska inte krascha om Dexie saknas
      }
    };

    return (
      <div className="text-sm">
        {/* Två kolumner:
            Vänster: Arbetad tid + Total tid BT+ST
            Höger:  Beräknat slutdatum + Slutdatum BT */}
<div className="mt-1 grid gap-2 md:grid-cols-2 max-w-4xl">

          {/* VÄNSTER KOLUMN */}
          <div className="space-y-3">
            {/* Överst: Registrerad tid motsvarande heltid */}
            <div>
              <span className="font-medium">Registrerad tid motsvarande heltid:</span>{" "}
              <span className="font-semibold">
                {workedFteMonths.toFixed(1)} mån
              </span>
            </div>

            {/* Under: Total tid för BT + ST */}
            <div className="flex items-center gap-2">
              <span className="font-medium">{totalLabel}</span>
              <select
                value={String(Math.max(0, Math.floor(totalPlanMonths)))}
                onChange={(e) => {
                  const v = Math.floor(
                    Number((e.target as HTMLSelectElement).value) || 0
                  );
                  setTotalPlanMonths(Math.max(0, v));
                }}
                className="h-8 rounded-lg border px-2 text-sm w-[110px]"
                title="Planerad total tid i månader"
              >
                {Array.from({ length: 240 }, (_, i) => i + 1).map((m) => {
                  const isSix = m % 6 === 0;
                  const label = (() => {
                    if (!isSix) return `${m}`;
                    if (m % 12 === 0) return `${m} (${m / 12} år)`;
                    return `${m} (${Math.floor(m / 12)},5 år)`;
                  })();
                  return (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <span>månader</span>
            </div>
          </div>

          {/* HÖGER KOLUMN */}
          <div className="space-y-3">
            {/* Överst: Beräknat slutdatum vid tjänstgöring på X % */}
            <div className="flex items-center gap-2">
              <span className="font-medium">
                Slutdatum för ST vid tjänstgöring på
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={Math.max(0, Math.min(100, restAttendance))}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setRestAttendance(Math.max(0, Math.min(100, v)));
                }}
                className="w-15 rounded-lg border px-2 py-0.9 text-left"
              />
              <span>%:</span>
              <span className="font-semibold">{stEndISO || "—"}</span>
            </div>

                        {/* Under: Slutdatum för BT (med kalender) */}
            {gv === "2021" && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium whitespace-nowrap">
                    Slutdatum för BT:
                  </span>
                  <div className="w-[140px]">
                    <CalendarDatePicker
                      value={effectiveBtEndISO || ""}
                      onChange={(iso) => {
                        void handleBtEndChange(iso || null);
                      }}
                      weekStartsOn={1}
                      className="h-8 w-full"
                      forceDirection="up"
                    />
                  </div>
                </div>

                {(btStartISO && !btEndManualISO && autoBtEndISO) ||
                (btEndManualISO &&
                  autoBtEndISO &&
                  btEndManualISO !== autoBtEndISO) ? (
                  <div className="text-xs text-slate-500">
                    {btStartISO && !btEndManualISO && autoBtEndISO && (
                      <div></div>
                    )}
                    {btEndManualISO &&
                      autoBtEndISO &&
                      btEndManualISO !== autoBtEndISO && (
                        <div>justerat från standard (2 år)</div>
                      )}
                  </div>
                ) : null}
              </div>
            )}


          </div>
        </div>
      </div>
    );

  })()}
</div>


      
      </div>


      

      {/* MilestoneOverviewModal */}
<MilestoneOverviewModal
  open={milestoneOverviewOpen}
  onClose={() => setMilestoneOverviewOpen(false)}
/>

{/* Scan-intyg modal */}
<ScanIntygModal
  open={scanOpen}
  onClose={() => setScanOpen(false)}
  onSaved={() => {
    refreshLists();
  }}
  goalsVersion={normalizeGoalsVersion((profile as any)?.goalsVersion || "2021")}
/>


{/* Spara-info modal */}
<SaveInfoModal
  open={saveInfoOpen}
  onClose={() => setSaveInfoOpen(false)}
/>


{/* Rapport – förhandsvisning/print */}
<ReportPrintModal
  open={reportOpen}
  onClose={() => {
    setReportOpen(false);
  }}
/>

{/* IUP – handledarsamtal och progressionsbedömningar */}
<IupModal
  open={iupOpen}
  onClose={() => {
    setIupOpen(false);
    setIupInitialTab(null);
    setIupInitialMeetingId(null);
    setIupInitialAssessmentId(null);
  }}
  initialTab={iupInitialTab ?? undefined}
  initialMeetingId={iupInitialMeetingId}
  initialAssessmentId={iupInitialAssessmentId}
  onMeetingsChange={(sessions) => {
    const next: SupervisionSession[] = Array.isArray(sessions)
      ? (sessions as any[])
          .filter(
            (m: any) =>
              m &&
              typeof m.id === "string" &&
              m.id &&
              typeof m.dateISO === "string" &&
              m.dateISO
          )
          .map((m: any) => ({
            id: String(m.id),
            dateISO: String(m.dateISO),
            title:
              typeof m.title === "string"
                ? m.title
                : typeof m.focus === "string"
                ? m.focus
                : "",
          }))
      : [];

    setSupervisionSessions(next);
  }}
  onAssessmentsChange={(sessions) => {
    const next: AssessmentSession[] = Array.isArray(sessions)
      ? (sessions as any[])
          .filter(
            (a: any) =>
              a &&
              typeof a.id === "string" &&
              a.id &&
              typeof a.dateISO === "string" &&
              a.dateISO
          )
          .map((a: any) => ({
            id: String(a.id),
            dateISO: String(a.dateISO),
            title:
              typeof a.title === "string" && a.title.trim()
                ? a.title
                : typeof a.level === "string" && a.level.trim()
                ? a.level
                : typeof a.instrument === "string"
                ? a.instrument
                : "",
          }))
      : [];

    setAssessmentSessions(next);
  }}
  showMeetingsOnTimeline={showSupervisionOnTimeline}
  showAssessmentsOnTimeline={showAssessmentsOnTimeline}
  onTimelineVisibilityChange={(value) => {
    if (typeof value.showMeetingsOnTimeline === "boolean") {
      setShowSupervisionOnTimeline(value.showMeetingsOnTimeline);
    }
    if (typeof value.showAssessmentsOnTimeline === "boolean") {
      setShowAssessmentsOnTimeline(value.showAssessmentsOnTimeline);
    }
  }}
/>








{/* Förhandsvisning (PDF) */}
<CertificatePreview
  open={previewOpen}
  url={previewUrl}
  onClose={() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewOpen(false);
  }}
/>



{/* DesktopMilestonePicker modal (ST-delmål) */}
<DesktopMilestonePicker
  open={milestonePicker.open}
  title={
    milestonePicker.mode === "course"
      ? "Välj ST-delmål för kursen"
      : "Välj ST-delmål för placeringen"
  }
  goals={goals}
  checked={new Set(
    (
      milestonePicker.mode === "course"
        ? ((selectedCourse as any)?.milestones || [])
        : ((selectedPlacement as any)?.milestones || [])
    ) as string[]
  )}
  onToggle={(milestoneId) => {
    if (milestonePicker.mode === "course" && selectedCourse) {
      const cur = new Set<string>(
        (((selectedCourse as any)?.milestones || []) as string[])
      );
      if (cur.has(milestoneId)) {
        cur.delete(milestoneId);
      } else {
        cur.add(milestoneId);
      }

      setCourses((prev) =>
        prev.map((c) =>
          c.id === selectedCourse.id
            ? { ...c, ...(c as any), milestones: Array.from(cur) }
            : c
        )
      );
      // Dirty-state uppdateras automatiskt via checkDirty
    } else if (milestonePicker.mode === "placement" && selectedPlacement) {
      const cur = new Set<string>(
        (((selectedPlacement as any)?.milestones || []) as string[])
      );
      if (cur.has(milestoneId)) {
        cur.delete(milestoneId);
      } else {
        cur.add(milestoneId);
      }

      setActivities((prev) =>
        prev.map((a) =>
          a.id === selectedPlacement.id
            ? { ...a, ...(a as any), milestones: Array.from(cur) }
            : a
        )
      );
      // Dirty-state uppdateras automatiskt via checkDirty
    }
  }}
  onClose={() => setMilestonePicker({ open: false, mode: null })}
/>


{/* DesktopBtMilestonePicker modal (BT-delmål) – separat lista */}
<DesktopBtMilestonePicker
  open={btMilestonePicker.open}
  title={btMilestonePicker.mode === "course" ? "Välj BT-delmål för kursen" : "Välj BT-delmål för placeringen"}
  checked={new Set(
    (
      btMilestonePicker.mode === "course"
        ? ((selectedCourse as any)?.btMilestones || [])
        : ((selectedPlacement as any)?.btMilestones || [])
    ) as string[]
  )}
  onToggle={async (milestoneId: string) => {
    // Kurs: uppdatera lokal state + skriv (om tabell finns) till db.courses
    if (btMilestonePicker.mode === "course" && selectedCourse) {
      const cur = new Set<string>(((selectedCourse as any)?.btMilestones || []) as string[]);
      cur.has(milestoneId) ? cur.delete(milestoneId) : cur.add(milestoneId);
      const next = Array.from(cur);

      setCourses(prev =>
        prev.map(c => c.id === selectedCourse.id
          ? ({ ...c, ...(c as any), btMilestones: next })
          : c
        )
      );

      try {
        // Spara om kurstabellen existerar i denna DB-version
        const anyDb: any = db as any;
        if (anyDb?.courses?.update) {
          await anyDb.courses.update(selectedCourse.id, { btMilestones: next });
        }
      } catch {
        // ignorera tyst om kurstabell saknas
      }

      // Dirty-state uppdateras automatiskt via checkDirty
      return;
    }

    // Placering: uppdatera lokal state + skriv till db.placements
    if (btMilestonePicker.mode === "placement" && selectedPlacement) {
      const cur = new Set<string>(((selectedPlacement as any)?.btMilestones || []) as string[]);
      cur.has(milestoneId) ? cur.delete(milestoneId) : cur.add(milestoneId);
      const next = Array.from(cur);

      setActivities(prev =>
        prev.map(a => a.id === selectedPlacement.id
          ? ({ ...a, ...(a as any), btMilestones: next })
          : a
        )
      );

      try {
        await (db as any).placements.update(selectedPlacement.id, { btMilestones: next });
      } catch {
        // lämna tyst om skrivning skulle misslyckas
      }
      // Dirty-state uppdateras automatiskt via checkDirty
    }
  }}
  onClose={() => setBtMilestonePicker({ open: false, mode: null })}
/>

{/* BT-delmål detaljvy (read-only) från detaljrutan */}
{btMilestoneDetail && (() => {
  const id = String(btMilestoneDetail).toUpperCase();
  const m = btMilestones.find((x) => x.id === id) as BtMilestone | undefined;
  return (
    <div
      className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setBtMilestoneDetail(null);
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 gap-4">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 shrink-0">
              {id.toLowerCase()}
            </span>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
              {m?.title ?? "BT-delmål"}
            </h3>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {m ? (
            <div className="prose prose-slate max-w-none text-[14px] leading-relaxed text-slate-900">
              <ul className="list-disc space-y-2 pl-5 text-slate-900">
                {m.bullets.map((b, i) => (
                  <li key={i} className="text-slate-900">{b}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-slate-900">Information saknas för {id}.</div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={() => setBtMilestoneDetail(null)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
          >
            Stäng
          </button>
        </footer>
      </div>
    </div>
  );
})()}

{/* ST-delmål detaljvy (read-only) från detaljrutan */}
{stMilestoneDetail && goals && (() => {
  // Normalisera milestone ID
  const normalizeCode = (raw: string): string => {
    const base = String(raw ?? "").trim().split(/\s|–|-|:|\u2013/)[0];
    const up = base.toUpperCase().replace(/\s+/g, "");
    const m = up.match(/^ST([ABC])(\d+)$/) || up.match(/^([ABC])(\d+)$/);
    if (m) {
      const letter = m[1].toUpperCase();
      const num = parseInt(m[2], 10) || 0;
      return `${letter}${num}`;
    }
    return up;
  };

  const normalizedId = normalizeCode(stMilestoneDetail);
  const m = goals.milestones.find((x) => {
    const idK = normalizeCode(x.id);
    const codeK = normalizeCode(x.code || "");
    return idK === normalizedId || codeK === normalizedId;
  });

  if (!m) return null;

  const toText = (v: unknown) =>
    typeof v === "string"
      ? v
      : v == null
      ? ""
      : Array.isArray(v)
      ? v.join("\n")
      : String(v);

  const sections = [
    { key: "kompetenskrav", title: "Kompetenskrav", text: toText(m.sections?.kompetenskrav) },
    { key: "utbildningsaktiviteter", title: "Utbildningsaktiviteter", text: toText(m.sections?.utbildningsaktiviteter) },
    { key: "intyg", title: "Intyg", text: toText(m.sections?.intyg) },
    { key: "allmannaRad", title: "Allmänna råd", text: toText(m.sections?.allmannaRad) },
  ] as const;

  const visible = sections.filter(s => s.text.trim().length > 0);
  const titleCode = String(m.code || m.id || "").toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setStMilestoneDetail(null);
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 gap-4">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 shrink-0">
              {titleCode.toLowerCase()}
            </span>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
              {m.title}
            </h3>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {visible.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
              Ingen beskrivning hittades i målfilen.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {visible.map((s) => (
                <article key={s.key} className="border border-slate-200 rounded-xl p-3 bg-white">
                  <div className="font-bold mb-1.5 text-slate-900">{s.title}</div>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-900 leading-relaxed">
                    {s.text}
                  </pre>
                </article>
              ))}
            </div>
          )}

          {m.sourceUrl && (
            <div className="text-xs mt-3 text-slate-600">
              Källa:{" "}
              <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                målbeskrivningen
              </a>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={() => setStMilestoneDetail(null)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
          >
            Stäng
          </button>
        </footer>
      </div>
    </div>
  );
})()}

{/* STa3 – för Vetenskapligt arbete (2021) */}
<Sta3PrepModal
  open={sta3Open}
  onClose={() => setSta3Open(false)}
  placements={sta3Placements}
  courses={sta3Courses}
  otherText={sta3Other}
  onOtherTextChange={setSta3Other}
  howVerifiedText={sta3HowVerified}
  onHowVerifiedTextChange={setSta3HowVerified}
  profile={{
    name: profile?.name,
    firstName: (profile as any)?.firstName,
    lastName: (profile as any)?.lastName,
    personalNumber: (profile as any)?.personalNumber,
    speciality: (profile as any)?.speciality,
    specialty: (profile as any)?.specialty,
    homeClinic: (profile as any)?.homeClinic,
  }}
  researchTitle={sta3ResearchTitle}
  supervisorName={sta3SupervisorName}
  supervisorSpeciality={sta3SupervisorSpec}
  supervisorSite={sta3SupervisorSite}
/>
{/* Profilmodal */}
<ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />

{/* === Specialistansökan (gemensam modal för 2015/2021) === */}
<PrepareApplicationModal
  open={prepareOpen}
  onClose={() => setPrepareOpen(false)}
/>

{/* === Intyg bastjänstgöring (BT) – modal === */}
<PrepareBtModal
  open={btModalOpen}
  onClose={() => setBtModalOpen(false)}
/>

{/* === Kursintyg (Bilaga 10) – signerare/underskrivare via CoursePrepModal === */}
<CoursePrepModal
  open={courseModalOpen && !!courseForModal}
  onClose={() => setCourseModalOpen(false)}
  profile={{
    goalsVersion: normalizeGoalsVersion((profile as any)?.goalsVersion || "2021"),

    // Hemklinik (sökandens)
    homeClinic: (profile as any)?.homeClinic || "",

    // Sökandens namn/personnummer/specialitet
    name: (profile as any)?.name || "",
    firstName: (profile as any)?.firstName || "",
    lastName: (profile as any)?.lastName || "",
    personalNumber: (profile as any)?.personalNumber || "",
    specialty: (profile as any)?.specialty || "",
    speciality: (profile as any)?.speciality || "",

    // Huvudhandledare från Profil
    supervisor: (profile as any)?.supervisor || "",
    supervisorWorkplace: (profile as any)?.supervisorWorkplace || "",

    // Handledarens specialitet = samma som sökandens specialitet
    supervisorSpecialty:
      (profile as any)?.specialty || (profile as any)?.speciality || "",
    supervisorSpeciality:
      (profile as any)?.speciality || (profile as any)?.specialty || "",
  }}
  course={courseForModal}
  milestones={toMilestoneIds((courseForModal as any)?.milestones || [])}
/>


{/* NYTT: Liten popup för BT-intyg / ST-intyg vid dubbelklick på rad */}
{certMenu.open && (certMenu.placement || certMenu.course) && (
  <div
    className="fixed z-[9999]"
    style={{ left: certMenu.x, top: certMenu.y, transform: "translate(-10px, -50%)" }}
    onClick={(e) => e.stopPropagation()}
  >
    <div className="rounded-lg border border-slate-300 bg-white shadow-lg p-2 flex items-center gap-2">
      {/* BT-intyg – placering (BT + klinisk tjänstgöring) */}
      {certMenu.kind === "placement" &&
        certMenu.placement &&
        certMenu.placement.phase === "BT" &&
        certMenu.placement.type === "Klinisk tjänstgöring" && (
          <button
            className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px hover:bg-slate-200 hover:border-slate-400"
            onClick={() => {
              const ok = switchActivity(certMenu.placement!.id, null);
              if (!ok) return;
              openPreviewForBtGoals(certMenu.placement!);
              setCertMenu({
                open: false,
                x: 0,
                y: 0,
                kind: null,
                placement: null,
                course: null,
              });
            }}
            title="Delmål i bastjänstgöringen"
          >
            BT-intyg
          </button>
        )}

      {/* BT-intyg – kurs (BT-fas) */}
      {certMenu.kind === "course" &&
        certMenu.course &&
        certMenu.course.phase === "BT" && (
          <button
            className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px hover:bg-slate-200 hover:border-slate-400"
            onClick={() => {
              const c = certMenu.course!;
              const ok = switchActivity(null, c.id);
              if (!ok) return;

              // Bygg en "BT-aktivitet" från kursen – delmål + bedömningsfält från kursens detaljruta
              const dummyActivity: Activity = {
                id: c.id,
                type: "Kurs",
                label: c.title || "Kurs",
                startSlot: 0,
                lengthSlots: 1,
                hue: 0,
                phase: "BT",
                restPercent: 0,
                isLocked: false,
                // BT-delmål + hur det kontrollerats hämtas från kursen
                btAssessment: (c as any).btAssessment || "",
                btMilestones: (c as any).btMilestones || [],
              } as any;

              openPreviewForBtGoals(dummyActivity);
              setCertMenu({
                open: false,
                x: 0,
                y: 0,
                kind: null,
                placement: null,
                course: null,
              });
            }}
            title="Delmål i bastjänstgöringen (kurs)"
          >
            BT-intyg
          </button>
        )}

      {/* ST-intyg – placering */}
      {certMenu.kind === "placement" &&
        certMenu.placement &&
        (certMenu.placement.phase !== "BT" ||
          !!(certMenu.placement as any)?.fulfillsStGoals) && (
          <button
            className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px hover:bg-slate-200 hover:border-slate-400"
            onClick={() => {
              if (!profile) {
                alert("Profil saknas – kan inte skapa intyget.");
                return;
              }
              const ok = switchActivity(certMenu.placement!.id, null);
              if (!ok) return;
              openPreviewForPlacement(certMenu.placement!);
              setCertMenu({
                open: false,
                x: 0,
                y: 0,
                kind: null,
                placement: null,
                course: null,
              });
            }}
            title="Intyg för klinisk tjänstgöring i ST"
          >
            ST-intyg
          </button>
        )}

      {/* ST-intyg – kurs */}
      {certMenu.kind === "course" &&
        certMenu.course &&
        (certMenu.course.phase !== "BT" ||
          !!(certMenu.course as any)?.fulfillsStGoals) && (
          <button
            className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px hover:bg-slate-200 hover:border-slate-400"
            onClick={() => {
              const c = certMenu.course!;
              if (!profile) {
                alert("Profil saknas – kan inte skapa intyget.");
                return;
              }
              const ok = switchActivity(null, c.id);
              if (!ok) return;
              setCourseForModal(c);
              setCourseModalOpen(true);
              setCertMenu({
                open: false,
                x: 0,
                y: 0,
                kind: null,
                placement: null,
                course: null,
              });
            }}
            title="Intyg för kurs i ST"
          >
            ST-intyg
          </button>
        )}


      {/* Stäng */}
      <button
        className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs text-slate-500 bg-white hover:bg-slate-100 active:translate-y-px"
        onClick={() =>
          setCertMenu({
            open: false,
            x: 0,
            y: 0,
            kind: null,
            placement: null,
            course: null,
          })
        }
        title="Stäng"
      >
        ✕
      </button>
    </div>
  </div>
)}




      {/* ===== Dialog: Osparade ändringar (3 alternativ) ===== */}
      {unsavedPrompt && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (unsavedSaving) return;
            setUnsavedPrompt(null);
          }}
        >
          <div
            className="w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-extrabold text-slate-900">Osparade ändringar</div>
            <p className="mt-2 text-slate-700">Du har osparade ändringar. Vad vill du göra?</p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={unsavedSaving}
                onClick={() => setUnsavedPrompt(null)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              >
                Avbryt
              </button>

              <button
                type="button"
                disabled={unsavedSaving}
                onClick={() => {
                  const p = unsavedPrompt;
                  if (!p) return;
                  setUnsavedPrompt(null);
                  restoreBaseline();
                  setTimeout(() => {
                    setDirty(false);
                    if (p.mode === "close") {
                      setSelectedPlacementId(null);
                      setSelectedCourseId(null);
                    } else {
                      setSelectedPlacementId(p.nextPlacementId);
                      setSelectedCourseId(p.nextCourseId);
                    }
                  }, 0);
                }}
                className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
              >
                Stäng utan att spara
              </button>

              <button
                type="button"
                disabled={unsavedSaving}
                onClick={async () => {
                  const p = unsavedPrompt;
                  if (!p) return;
                  setUnsavedSaving(true);
                  try {
                    const ok = selectedPlacement
                      ? await savePlacementToDb(selectedPlacement)
                      : selectedCourse
                      ? await saveCourseToDb(selectedCourse)
                      : true;
                    if (!ok) return;

                    setUnsavedPrompt(null);
                    if (p.mode === "close") {
                      setSelectedPlacementId(null);
                      setSelectedCourseId(null);
                    } else {
                      setSelectedPlacementId(p.nextPlacementId);
                      setSelectedCourseId(p.nextCourseId);
                    }
                  } finally {
                    setUnsavedSaving(false);
                  }
                }}
                className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 disabled:opacity-50"
              >
                Spara och stäng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Överlapp ej möjligt: varningsblock borttaget enligt specifikation */}
      </>
  );
}

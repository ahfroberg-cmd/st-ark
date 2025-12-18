// components/PrepareBtModal.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import dynamic from "next/dynamic";
import { db } from "@/lib/db";
import type { Profile, Placement, Course } from "@/lib/types";
import CalendarDatePicker from "@/components/CalendarDatePicker";


/** ========= Dependencies (popups) ========= */
const BtMilestonePicker = dynamic(
  () => import("@/components/BtMilestonePicker"),
  { ssr: false }
);

/** ========= Helpers ========= */
const makeId = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

const isoToday = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

function monthDiffExact(startISO?: string, endISO?: string) {
  const s = new Date(startISO || "");
  const e = new Date(endISO || "");
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const ms = e.getTime() - s.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  return Math.max(0, days / 30.4375);
}

function pickPercent(p: any): number {
  const v = Number(
    p?.percent ?? p?.ftePercent ?? p?.scopePercent ?? p?.omfattning ?? 100
  );
  return Number.isFinite(v) && v > 0 ? Math.min(100, Math.max(0, v)) : 100;
}

/** Samla BT-delmål från placement – robust, med djupskanning */
function extractPlacementGoals(pl: any): string[] {
  // Endast riktiga BT-delmål: kräver nummer efter "BT"
  const BT = (s: string) =>
    /^BT[-_\s]*\d+/i.test(s || "");

  const out = new Set<string>();

  function add(s: unknown) {
    if (typeof s !== "string") return;
    const raw = s.trim();
    if (!BT(raw)) return;
    // Normalisera: "bt 1", "BT-1", "bt_01" -> "BT1" / "BT01" (behåll nummer som står)
    const norm = raw
      .replace(/\s+/g, "")
      .replace(/^bt/i, "BT")
      .replace(/[-_]/g, "");
    out.add(norm.toUpperCase());
  }

  function visit(v: any, depth = 0) {
    if (v == null || depth > 4) return;

    if (typeof v === "string") {
      add(v);
      return;
    }

    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }

    if (typeof v === "object") {
      // Vanliga fält
      add((v as any).id as any);
      add((v as any).code as any);
      add((v as any).goalId as any);
      add((v as any).milestoneId as any);
      add((v as any).milestone as any);

      // Djupskanna objekt (begränsad)
      for (const k of Object.keys(v)) {
        add(k);
        visit((v as any)[k], depth + 1);
      }
    }
  }

  // Primära, kända fält först
  visit(pl?.btGoals);
  visit(pl?.btGoalIds);
  visit(pl?.btMilestones);
  visit(pl?.bt_milestones);
  visit(pl?.milestones);
  visit(pl?.goals);
  visit(pl?.goalIds);
  visit(pl?.milestoneIds);
  visit(pl?.meta);

  // Som fallback: skanna hela placementet ytligt
  visit(
    {
      id: (pl as any)?.id,
      phase: (pl as any)?.phase,
      tags: (pl as any)?.tags,
      extra: (pl as any)?.extra,
    },
    0
  );

  return Array.from(out);
}



/** ========= Local inputs matching PrepareApplicationModal UX ========= */
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
  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  const handleChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const v = (e.target as HTMLInputElement).value;
      setLocal(v);
      if ((value ?? "") !== v) onCommit(v);
    },
    [value, onCommit]
  );

  const handleBlur = useCallback(() => {
    if ((value ?? "") !== local) onCommit(local);
  }, [local, value, onCommit]);


  return (
    <div className="min-w-0">
      <label className="mb-1 block text-sm text-slate-700">{label}</label>
      <input
        type="text"
        value={local}
        onInput={handleChange}
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

function ReadonlyInput({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0" title={'Ändras i "Profil"'}>
      <label className="mb-1 block text-sm text-slate-700">{label}</label>
      <div
        className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-[14px] text-slate-700"
        aria-readonly="true"
        role="textbox"
      >
        <span className="whitespace-normal break-words">{value || "—"}</span>
      </div>
    </div>
  );
}


/** ========= Types (local state) ========= */
type Props = { open: boolean; onClose: () => void };

type BtGoalId = string; // t.ex. "BT1"..."BT6"
type Chip = { id: BtGoalId; label: string };

type BtActivity = {
  id: string;
  text: string;
  startISO: string | null;
  endISO: string | null;
  source?: "manual" | "registered";
  refId?: string;
};


type BtPlacementRow = {
  id: string;
  ref: Placement;
  primaryCare: boolean;
  acuteCare: boolean;
  percent: number;
  monthsFte: number;
};

type ForeignOrPrelicenseRow = {
  id: string;
  title: string;
  intyg?: {
    clinic: string;
    startISO: string | null;
    endISO: string | null;
    percent: number;
    supervisor: string;
    supervisorSpec: string;
    supervisorWorkplace: string;
    controlHow: string;
    goals: Chip[];
  };
};

/** ========= Component ========= */
export default function PrepareBtModal({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  /** Dirty flag for enabling Save */
  const [dirty, setDirty] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  useEffect(() => {
    if (open) {
      setDirty(false);
      setShowCloseConfirm(false);
    }
  }, [open]);

  /** Profile + DB content */
  const [profile, setProfile] = useState<Profile | null>(null);
  const is2021 = useMemo(
    () => (profile?.goalsVersion || "").toString().includes("2021"),
    [profile]
  );

  /** Tabs (match visual design of PrepareApplicationModal) */
  const [tab, setTab] = useState<
    "btgoals" | "btfull" | "competence" | "attachments"
  >("btgoals");

  /** Applicant data (hämtar visning från Profil; lokalt behövs bara extra-fält) */
const [applicant, setApplicant] = useState({
  // Visningsfält hämtas från Profile (readonly i UI)
  address: "",
  postalCode: "",
  city: "",
  mobile: "",
  phoneHome: "",
  phoneWork: "",
  medDegreeCountry: "",
  medDegreeDate: isoToday(),

  // Nytt: e-post och arbetsplats-val
  email: "",
  workplaceChoice: "home" as "home" | "other",
  workplaceOther: "",

  // BT-specifikt: tidigare legitimation (max 3 rader: land + datum)
  hasForeignLicense: false,
  foreignLicenses: [{ country: "", date: isoToday() }],
});




  /** BT-goals */
  const [btGoals, setBtGoals] = useState<Chip[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  /** Activities for BT goals */
  const [btActivities, setBtActivities] = useState<BtActivity[]>([]);

  // === Förhandsvisning (PDF) – samma mönster som i PusslaDinST ===
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Endast ID-delen av BT-delmål (”BT1”, ”BT2”, …)
  const toMilestoneIds = (chips: Chip[]) =>
    Array.isArray(chips) ? chips.map((c) => String(c.id).trim().split(/\s|–|-|:|\u2013/)[0]) : [];

  // Hjälpare: normalisera målversion till "2015" | "2021"
  function normalizeGoalsVersion(v: any): "2015" | "2021" {
    const s = String(v ?? "").toLowerCase();
    if (s.includes("2015")) return "2015";
    if (s.includes("2021")) return "2021";
    return "2021";
  }

  // Öppna generisk PDF-blob i förhandsvisningsmodulen
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

  // Enkel förhandsvisnings-modal (PDF) – samma UI som i PusslaDinST
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

  // — Handlers för knapparna längst ned —


  // 1) Intyg delmål i BT
  async function handlePreviewBtGoals() {
    try {
      if (!profile) {
        alert("Profil saknas – kan inte skapa intyget.");
        return;
      }
      const { exportCertificate } = await import("@/lib/exporters");
      const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);
      const activity: any = {
        // Delmål som intyget avser
        goals: toMilestoneIds(btGoals),
        // Lista aktiviteter (fritext + ev. datum)
        activities: btActivities.map((a) => ({
          text: a.text || "",
          startDate: a.startISO || null,
          endDate: a.endISO || null,
          source: a.source || "manual",
          refId: a.refId || null,
        })),
        // Hur kontrollerats
        controlHow:
          String(
            (typeof (window as any) !== "undefined"
              ? (document.querySelector("textarea") as HTMLTextAreaElement)?.value
              : "") || ""
          ).trim() || "",

        // Flagga för exportlogik: true om "någon annan" ska användas
        useOtherSigner: mainSupervisorPrints,

        // Vem signerar (om rutan är ikryssad = annan, annars huvudhandledare från Profil)
        signer: mainSupervisorPrints
          ? {
              // ifyllda fält i modalen
              name: issuingSupervisor?.name || "",
              specialty: issuingSupervisor?.specialty || "",
              workplace: issuingSupervisor?.workplace || "",
              useOther: true,
            }
          : {
              // PROFILFÄLT (enligt dina krav)
              // Huvudhandledare = profile.supervisor
              name: (profile as any)?.supervisor || "",
              // Handledarens specialitet = sökandens specialitet
              specialty: (profile as any)?.specialty || (profile as any)?.speciality || "",
              // Handledarens tjänsteställe:
              // 1) specifikt handledartjänsteställe om ifyllt
              // 2) annars sökandens hemklinik
              workplace:
                (profile as any)?.supervisorWorkplace ||
                (profile as any)?.homeClinic ||
                "",
              useOther: false,
            },

      };

      const blob = (await exportCertificate(
        {
          goalsVersion: gv,
          // BT-specifik typ för exportern – kan mappas i exporters.ts
          activityType: "BT_GOALS",
          profile: profile as any,
          activity,
          // Milestones explicit (en del exporter läser här)
          milestones: toMilestoneIds(btGoals),
        },
        { output: "blob", filename: "bt-delmal-preview.pdf" }
      )) as Blob;

      openPreviewFromBlob(blob);
    } catch (e) {
      console.error(e);
      alert("Kunde inte skapa förhandsvisningen.");
    }
  }

  // 2) Intyg fullgjord BT
  async function handlePreviewBtFull() {
    try {
      if (!profile) {
        alert("Profil saknas – kan inte skapa intyget.");
        return;
      }
      const { exportCertificate } = await import("@/lib/exporters");
      const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);

      const activity: any = {
        // Placeringar markerade som BT i tabellen
        rows: btRows.map((r) => ({
          id: r.id,
          clinic: (r.ref as any)?.clinic || (r.ref as any)?.note || "",
          startDate: (r.ref as any)?.startDate || "",
          endDate: (r.ref as any)?.endDate || (r.ref as any)?.startDate || "",
          percent: r.percent,
          monthsFte: r.monthsFte,
          primaryCare: !!r.primaryCare,
          acuteCare: !!r.acuteCare,
        })),
        // Vem signerar (verksamhetschef eller ”annan”)
        signer: (otherThanManager
          ? { role: "appointed", name: appointedSigner.name || "", workplace: appointedSigner.workplace || "" }
          : { role: "manager", name: (profile as any)?.managerName || "", workplace: (profile as any)?.homeClinic || "" }),
      };

      const blob = (await exportCertificate(
        {
          goalsVersion: gv,
          activityType: "BT_FULLGJORD",
          profile: profile as any,
          activity,
        },
        { output: "blob", filename: "bt-fullgjord-preview.pdf" }
      )) as Blob;

      openPreviewFromBlob(blob);
    } catch (e) {
      console.error(e);
      alert("Kunde inte skapa förhandsvisningen.");
    }
  }

  // 3) Intyg uppnådd baskompetens
  async function handlePreviewBtCompetence() {
    try {
      if (!profile) {
        alert("Profil saknas – kan inte skapa intyget.");
        return;
      }
      const { exportCertificate } = await import("@/lib/exporters");
      const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);

      const activity: any = {
        externAssessor: {
          name: (profile as any)?.btExtAssessorName || "",
          specialty: (profile as any)?.btExtAssessorSpec || "",
          workplace: (profile as any)?.btExtAssessorWorkplace || "",
        },
        mainSupervisor: {
          name: (profile as any)?.mainSupervisorName || "",
          specialty: (profile as any)?.mainSupervisorSpec || "",
          workplace:
            (profile as any)?.mainSupervisorWorkplace ||
            (profile as any)?.homeClinic ||
            "",
        },
      };

      const blob = (await exportCertificate(
        {
          goalsVersion: gv,
          activityType: "BT_KOMPETENS",
          profile: profile as any,
          activity,
        },
        { output: "blob", filename: "bt-uppnadd-baskompetens-preview.pdf" }
      )) as Blob;

      openPreviewFromBlob(blob);
    } catch (e) {
      console.error(e);
      alert("Kunde inte skapa förhandsvisningen.");
    }
  }

  // 4) Ansökan om intyg om godkänd BT
  async function handlePreviewBtApplication() {
  try {
    if (!profile) {
      alert("Profil saknas – kan inte skapa intyget.");
      return;
    }
    const { exportCertificate } = await import("@/lib/exporters");
    const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);

    // Komprimera löpnummer: [1,2,3,8,9,10,12] -> "1-3, 8-10, 12"
    const collapseRanges = (nums: number[]) => {
      const arr = Array.from(new Set(nums.filter((n) => Number.isFinite(n)).map((n) => Math.trunc(n)))).sort((a, b) => a - b);
      if (arr.length === 0) return "";
      const pieces: string[] = [];
      let start = arr[0];
      let prev = arr[0];
      for (let i = 1; i < arr.length; i++) {
        const n = arr[i];
        if (n === prev + 1) {
          prev = n;
          continue;
        }
        pieces.push(start === prev ? String(start) : `${start}-${prev}`);
        start = prev = n;
      }
      pieces.push(start === prev ? String(start) : `${start}-${prev}`);
      return pieces.join(", ");
    };

    // Kategorier för bilagor
    const prefixSavedBt = "Delmål i bastjänstgöringen: Intyg delmål i BT ";
    const isSavedBtCert = (x: string) => x.startsWith(prefixSavedBt);
    const isFullgjord = (x: string) => x === "Fullgjord bastjänstgöring";
    const isBaskomp = (x: string) => x === "Uppnådd baskompetens";
    const isPrelicense = (x: string) =>
      x.startsWith("Tjänstgöring före legitimation:") || /^Intyg tjänstgöring före legitimation\b/.test(x);
    const isForeign = (x: string) => x.startsWith("Utländsk tjänstgöring:");

    // Löpnummer (1-baserat) för varje rad i attachments-listan
    const numbered = (attachments as string[]).map((label, idx) => ({ no: idx + 1, label }));

    const delmalNos = numbered.filter((x) => isSavedBtCert(x.label)).map((x) => x.no);
    const fullgjordNos = numbered.filter((x) => isFullgjord(x.label)).map((x) => x.no);
    const baskompNos = numbered.filter((x) => isBaskomp(x.label)).map((x) => x.no);
    const prelicenseNos = numbered.filter((x) => isPrelicense(x.label)).map((x) => x.no);
    const foreignNos = numbered.filter((x) => isForeign(x.label)).map((x) => x.no);

    const attachmentsSummary = {
      delmalLine: collapseRanges(delmalNos),           // t.ex. "1-5, 8, 9-12"
      fullgjordLine: collapseRanges(fullgjordNos),     // t.ex. "13"
      baskompetensLine: collapseRanges(baskompNos),    // t.ex. "14"
      prelicenseLine: collapseRanges(prelicenseNos),   // t.ex. "15, 16"
      foreignLine: collapseRanges(foreignNos),         // t.ex. "17-18"
    };

    // Bygg legitimationsländer enligt krav:
    //  - Rad 1: Profilens "Land för legitimation" + "Datum för legitimation"
    //  - Rad 2–3: Upp till två rader från "Har legitimation från annat land"
    const primaryLicense = {
      country: String((profile as any)?.licenseCountry ?? ""),
      date: String((profile as any)?.licenseDate ?? ""),
    };
    const extraForeign = Array.isArray((profile as any)?.foreignLicenses)
      ? ((profile as any).foreignLicenses as any[])
          .slice(0, 2) // max två extra
          .map((r) => ({
            country: String(r?.country ?? ""),
            date: String(r?.date ?? ""),
          }))
      : [];
    const foreignLicenses = [primaryLicense, ...extraForeign]
      .filter((r) => (r.country || r.date)) // rensa tomma rader
      .slice(0, 3);

    // Singulärt legitimationsland: alltid profilens "Land för legitimation" om satt,
    // annars fall back till examensland.
    const derivedLicenseCountry =
      String((profile as any)?.licenseCountry || "") ||
      String((profile as any)?.medDegreeCountry || "");

    const activity: any = {
      applicant: {
        // Namn/personuppgifter i första hand från profil
        name: (profile as any)?.name || "",
        personalNumber: (profile as any)?.personalNumber || "",
        address: (profile as any)?.address || "",
        postalCode: (profile as any)?.postalCode || "",
        city: (profile as any)?.city || "",

        // Telefoner
        mobile: (profile as any)?.mobile || "",
        phoneHome: (profile as any)?.phoneHome || "",
        phoneWork: (profile as any)?.phoneWork || "",

        // E-post från Profil
        email: String((profile as any)?.email || ""),

        // Arbetsplats: hemklinik från Profil
        workplace: String((profile as any)?.homeClinic || ""),

        // Examen/leg
        medDegreeCountry: (profile as any)?.medDegreeCountry || "",
        medDegreeDate: (profile as any)?.medDegreeDate || "",

        // Legitimation
        licenseCountry: derivedLicenseCountry,
        licenseDate: String((profile as any)?.licenseDate || ""),
        foreignLicenses,
      },
      attachments: attachments.slice(),
      attachmentsSummary,
    };



    const blob = (await exportCertificate(
      {
        goalsVersion: gv,
        activityType: "BT_ANSOKAN",
        profile: profile as any,
        activity,
      },
      { output: "blob", filename: "bt-ansokan-preview.pdf" }
    )) as Blob;

    openPreviewFromBlob(blob);
  } catch (e) {
    console.error(e);
    alert("Kunde inte skapa förhandsvisningen.");
  }
}



  /** Choose from registered placements (BT-phasade) */
  const [chooserOpen, setChooserOpen] = useState(false);
  const [placements, setPlacements] = useState<Placement[]>([]);

  const [btPlacements, setBtPlacements] = useState<Placement[]>([]);
  const [chooserChecked, setChooserChecked] = useState<Record<string, boolean>>({});
  const [chooserIncludeGoals, setChooserIncludeGoals] = useState<Record<string, boolean>>({});

  // När väljaren öppnas: markera som ikryssade de aktiviteter som redan finns i listan (source === "registered")
  useEffect(() => {
    if (!chooserOpen) return;
    const already = new Set(
      btActivities.filter(a => a.source === "registered" && a.refId).map(a => String(a.refId))
    );
    setChooserChecked(prev => {
      const next: Record<string, boolean> = { ...prev };
      for (const pl of btPlacements) {
        next[pl.id] = already.has(pl.id) ? true : !!prev[pl.id];
      }
      return next;
    });
  }, [chooserOpen, btActivities, btPlacements]);

  /** “Hur kontrollerats…” */
  const [controlHow, setControlHow] = useState("");

  /** Checkbox: Någon annan än huvudhandledare utfärdar intyg (inverterad logik) */
const [mainSupervisorPrints, setMainSupervisorPrints] = useState(false);
const [issuingSupervisor, setIssuingSupervisor] = useState({
  name: "",
  specialty: "",
  workplace: "",
});


  /** Intyg om fullgjord BT – tabellrader */
  const [btRows, setBtRows] = useState<BtPlacementRow[]>([]);
  const [otherThanManager, setOtherThanManager] = useState(false);
  const [appointedSigner, setAppointedSigner] = useState({
    name: "",
    workplace: "",
  });

  /** Attachments tab */
  type AttachKey =
    | "Delmål i bastjänstgöringen"
    | "Fullgjord bastjänstgöring"
    | "Uppnådd baskompetens"
    | "Tjänstgöring före legitimation"
    | "Utländsk tjänstgöring";
  const [attachments, setAttachments] = useState<AttachKey[]>([
    "Fullgjord bastjänstgöring",
    "Uppnådd baskompetens",
  ]);
  const [prelicenseEnabled, setPrelicenseEnabled] = useState(false);
  const [prelicenseCount, setPrelicenseCount] = useState<number>(1);
  const [prelicenseCountDraft, setPrelicenseCountDraft] = useState<number>(1);
  const [foreignEnabled, setForeignEnabled] = useState(false);



  const [prelicenseRows, setPrelicenseRows] = useState<ForeignOrPrelicenseRow[]>([]);
  const [foreignRows, setForeignRows] = useState<ForeignOrPrelicenseRow[]>([]);

  /** Sparade “Intyg delmål i BT x” (mapas mot full titel-nyckel) */
  const [btSavedCerts, setBtSavedCerts] = useState<
    Record<
      string,
      {
        goals: Chip[];
        activities: BtActivity[];
        controlHow: string;
        signer: {
          useOther: boolean;
          name: string;
          specialty: string;
          workplace: string;
        };
      }
    >
  >({});
  /** Håller reda på om vi redigerar ett befintligt sparat intyg (nyckeln), annars null */
  const [editingSavedKey, setEditingSavedKey] = useState<string | null>(null);


  /** Intyg-popup för (4) och (5) */
  const [intygModalOpen, setIntygModalOpen] = useState<{
    mode: "prelicense" | "foreign" | null;
    rowId?: string;
  }>({ mode: null });


  /** Load DB on open */
  useEffect(() => {
    if (!open) return;

    (async () => {
      const [p, pls, cs, ach] = await Promise.all([
        db.profile.get("default"),
        db.placements.toArray(),
        db.courses.toArray(),
        // achievements kan saknas i vissa DB-versioner – fånga fel och returnera tom lista
        (db as any).achievements?.toArray?.().catch?.(() => []) ?? [],
      ]);

      setProfile(p ?? null);
      setPlacements(pls);
      // Ladda in sparade "Intyg delmål i BT" från profile (persistens i IndexedDB)
      setBtSavedCerts(((p as any)?.btSavedCerts ?? {}) as typeof btSavedCerts);


            // Heuristik: BT-phasade placeringar – här ska vi bara ta de som faktiskt är BT-fasade.
      const bt = pls.filter(
        (pl: any) => String((pl as any)?.phase || "").toUpperCase() === "BT"
      );

      // BT-kurser: endast explicit BT-fas
      const courses = Array.isArray(cs) ? (cs as Course[]) : [];
      const btCourses = courses.filter(
        (c: any) => String((c as any)?.phase || "").toUpperCase() === "BT"
      );

      // Bygg en snabb uppslagstabell från achievements -> placementId => BT-delmål
      const btGoalMap: Record<string, Set<string>> = {};
      for (const a of (Array.isArray(ach) ? ach : [])) {
        // Försök hitta vilken placement achievementen hör till
        const pid =
          (a as any)?.placementId ??
          (a as any)?.parentId ??
          (a as any)?.refId ??
          (a as any)?.ownerId ??
          null;

        if (!pid) continue;

        // Försök extrahera ett mål-id
        const candidateList = [
          (a as any)?.goalId,
          (a as any)?.milestoneId,
          (a as any)?.id,
          (a as any)?.code,
          (a as any)?.milestone,
        ].filter(Boolean) as string[];

        for (const cand of candidateList) {
          const gid = String(cand).trim();
          if (!gid) continue;

          // Begränsa till BT-delmål: endast koder med nummer, t.ex. "BT1", "BT-2"
          const looksBt = /^BT[-\s_]*\d+/i.test(gid);
          if (!looksBt) continue;

          if (!btGoalMap[pid]) btGoalMap[pid] = new Set<string>();
          btGoalMap[pid].add(
            gid
              .replace(/\s+/g, "")
              .replace(/^bt/i, "BT")
              .replace(/[-_]/g, "")
              .toUpperCase()
          );
        }

      }

      // Enrich BT-placeringar med delmål från:
      //  1) existerande fält (btMilestones/btGoals/milestones/goalIds/...)
      //  2) achievements-tabellen (btGoalMap)
      const enrichedBt = bt.map((pl: any) => {
        const full = pls.find((x) => x.id === pl.id) as any;

        // Samla ihop befintliga mål direkt på placement (inkl. btMilestones)
        const directCandidates = [
          full?.btMilestones,   // ← viktig: PusslaDinST sparar ofta här
          full?.btGoals,
          full?.milestones,
          full?.goals,
          full?.goalIds,
          full?.milestoneIds,
        ].filter(Boolean);

        const directFlat: string[] = [];
        for (const c of directCandidates) {
          if (Array.isArray(c)) {
            for (const x of c) {
              if (!x) continue;
              if (typeof x === "string") directFlat.push(x);
              else if (typeof x?.id === "string") directFlat.push(x.id);
              else if (typeof x?.code === "string") directFlat.push(x.code);
            }
          } else if (typeof c === "object") {
            for (const k of Object.keys(c)) directFlat.push(k);
          } else if (typeof c === "string") {
            directFlat.push(c);
          }
        }

           const directBt = directFlat
          .map((s) => String(s).trim())
          // Endast riktiga BT-delmål med nummer
          .filter((s) => /^BT[-\s_]*\d+/i.test(s))
          .map((s) =>
            s
              .replace(/\s+/g, "")
              .replace(/^bt/i, "BT")
              .replace(/[-_]/g, "")
              .toUpperCase()
          );


        // Lägg till mål hittade via achievements, också endast BT med nummer
        const viaAch = Array.from(btGoalMap[pl.id] ?? [])
          .map((s) => String(s).replace(/[\s_-]+/g, "").toUpperCase())
          .filter((id) => /^BT\d+$/i.test(id));

        // Unik sammanslagning
        const uniq = Array.from(new Set<string>([...directBt, ...viaAch]));

        // Behåll även originalfält (btMilestones) – men sätt en standardiserad btGoals
        return { ...pl, btGoals: uniq };
      });

      // Gör om BT-kurser till "placement-liknande" objekt för väljare/bilagor
      const btCourseLike = btCourses.map((c: any) => {
        const startDate = (c as any).startDate || null;
        const endDate = (c as any).endDate || startDate || null;
        const clinic =
          (c as any).title ||
          (c as any).name ||
          (c as any).courseName ||
          (c as any).subject ||
          "Kurs";

        return {
          ...(c as any),
          startDate,
          endDate,
          clinic,
        };
      });

      // Kombinera BT-placeringar + BT-kurser för väljare/bilagor
      const allBt: any[] = [...enrichedBt, ...btCourseLike];

      setBtPlacements(allBt as any);

      // Fyll rader till tabell (Primärvård/Akut sjukvård tomma initialt) – endast kliniska BT-placeringar
      const rows: BtPlacementRow[] = enrichedBt.map((pl: any) => {
        const percent = pickPercent(pl);
        const monthsFte = monthDiffExact(pl.startDate, pl.endDate) * (percent / 100);
        return {
          id: pl.id,
          ref: pl,
          primaryCare: false,
          acuteCare: false,
          percent,
          monthsFte: Math.round(monthsFte),
        };
      });
      setBtRows(rows);

      // — Auto-inkludera samtliga registrerade BT-aktiviteter (placeringar + kurser) i bilagelistan (ikryssade som standard)
      setBtAttachChecked(() => {
        const next: Record<string, boolean> = {};
        for (const pl of allBt) next[pl.id] = true;
        return next;
      });
      setAttachments((list) => {
        const prefix = "Delmål i bastjänstgöringen: Klinisk tjänstgöring — ";
        // Ta bort tidigare radetiketter av denna typ
        const base = (list as string[]).filter((x) => !String(x).startsWith(prefix));
        // Lägg till alla registrerade BT-aktiviteter (placeringar + kurser)
        const labels = allBt.map(
          (pl: any) => `${prefix}${String(pl.clinic || pl.note || "Klinisk tjänstgöring")}`
        );
        return normalizeAndSortAttachments([...base, ...labels]);
      });

      /* Defer ready-flaggan – sätts efter baseline i [open]-effekten */




    })();
  }, [open]);



  /** ESC to close */
  useEffect(() => {
  if (!open) return;
  const onKey = (e: KeyboardEvent) => {
    // Om bekräftelsedialogen är öppen, låt den hantera ALLA keyboard events
    if (showCloseConfirm) {
      // UnsavedChangesDialog hanterar keyboard events och stoppar propagation
      return;
    }
    
    // Cmd/Ctrl+Enter för att spara
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty) {
      e.preventDefault();
      handleSave();
      return;
    }
    
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleRequestClose();
    }
  };
  window.addEventListener("keydown", onKey, true);
  return () => window.removeEventListener("keydown", onKey, true);
  // onClose inte längre direkt beroende, handleRequestClose använder closure
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, dirty, showCloseConfirm]);


  /** ====== Dirty-tracking efter hydrering ====== */
useEffect(() => {
  if (!open) return;
  updateDirty();
}, [
  btActivities,
  btGoals,
  btRows,
  attachments,
  prelicenseRows,
  foreignRows,
  applicant,
  mainSupervisorPrints,
  issuingSupervisor,
  otherThanManager,
  appointedSigner,
  controlHow,
]);




// Sync från Profil -> "Uppgifter om sökande" (legitimationsländer + datum)
// Prioritet: 1) profile.licenseCountry/licenseDate (överst)  2) profile.foreignLicenses (max 3)
// Fallback: medDegreeCountry/medDegreeDate om inget licensland finns.
// Körs vid öppning och när profilen ändras (profilmodalen vinner).
useEffect(() => {
  if (!open || !profile) return;
  const prof = profile as any;

  setApplicant((prev) => {
    const list: Array<{ country: string; date: string }> = [];

    // 1) Enkelt licensland från profil (om satt)
    const licCountry = String(prof.licenseCountry ?? "").trim();
    const licDate = String(prof.licenseDate ?? "").trim();
    if (licCountry || licDate) {
      list.push({ country: licCountry, date: licDate });
    }

    // 2) Lista med foreignLicenses (lägg till tills max 3 totalt)
    if (Array.isArray(prof.foreignLicenses)) {
      for (const r of prof.foreignLicenses) {
        if (list.length >= 3) break;
        const country = String(r?.country ?? "").trim();
        const date = String(r?.date ?? "").trim();
        // undvik identiska dubletter
        const dup = list.some((x) => x.country === country && x.date === date);
        if (country || date) {
          if (!dup) list.push({ country, date });
        }
      }
    }

    // 3) Fallback till examensland/datum om listan är tom
    if (list.length === 0) {
      const medCountry = String(prof.medDegreeCountry ?? "").trim();
      const medDate = String(prof.medDegreeDate ?? "").trim();
      if (medCountry || medDate) {
        list.push({ country: medCountry, date: medDate });
      }
    }

    // Se till att minst en rad finns för UI:t
    const rows = list.slice(0, 3);
    if (rows.length === 0) rows.push({ country: "", date: isoToday() });

    return { ...prev, foreignLicenses: rows };
  });
}, [open, profile]);

/** ====== Actions ====== */


  function addEmptyActivityRow() {
    setBtActivities((s) => [
      ...s,
      { id: makeId(), text: "", startISO: null, endISO: null, source: "manual" },
    ]);
    if (readyRef.current) updateDirty();
  }



  function addRegisteredActivities() {
  // Ta endast de som är valda i popupen OCH som inte redan finns i listan
  const chosen = btPlacements.filter(
    (pl) =>
      chooserChecked[pl.id] &&
      !btActivities.some((a) => a.source === "registered" && a.refId === pl.id)
  );

  const newActs: BtActivity[] = chosen.map((pl) => ({
    id: makeId(),
    text: (pl as any).clinic || (pl as any).note || "Klinisk tjänstgöring",
    startISO: (pl.startDate || null) as string | null,
    endISO: ((pl.endDate || pl.startDate) || null) as string | null,
    source: "registered",
    refId: pl.id,
  }));

  // Lägg till aktiviteter
  setBtActivities((s) => [...s, ...newActs]);

  // Inkludera delmål för de valda där "Inkludera delmål i intyg" är ikryssad
  const toInclude = chosen.filter((pl) => chooserIncludeGoals[pl.id]);
  if (toInclude.length > 0) {
    const have = new Set(btGoals.map((g) => g.id));
    const add: Chip[] = [];
    for (const pl of toInclude) {
      const list = extractPlacementGoals(pl);
      for (const gid of list) {
        if (!have.has(gid)) {
          have.add(gid);
          add.push({ id: gid, label: gid });
        }
      }
    }
    if (add.length) setBtGoals((s) => [...s, ...add]);
  }

  // Markera som ändrat och stäng
  if (readyRef.current) updateDirty();
  setChooserOpen(false);
}






  /** ====== Render helpers ====== */
  function ChipView({ chip, onRemove }: { chip: Chip; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs">
      {chip.label}
    </span>
  );
}


  /** ====== Ordna bilagor (drag & drop – samma interaktion/estetik som PrepareApplicationModal) ====== */
  type Swatch = { bg: string; bd: string; pill: string; pillBd: string };

  const GREY_BG = "hsl(220 14% 95%/.96)";
  const GREY_BD = "hsl(220 12% 75%/.96)";
  const GREY_PILL = "hsl(220 16% 98%/.96)";
  const GREY_PILLBD = "hsl(220 10% 86%/.96)";

  // Tydliga, distinkta färger per grupp
  const BT_GROUP_COLORS: Record<AttachKey, Swatch> = {
    // Delmål i BT: cyan
    "Delmål i bastjänstgöringen": {
      bg: "hsl(190 30% 94%/.96)",
      bd: "hsl(190 22% 72%/.96)",
      pill: "hsl(190 35% 98%/.96)",
      pillBd: "hsl(190 20% 84%/.96)",
    },
    // Fullgjord BT: blå
    "Fullgjord bastjänstgöring": {
      bg: "hsl(222 30% 94%/.96)",
      bd: "hsl(222 22% 72%/.96)",
      pill: "hsl(222 35% 98%/.96)",
      pillBd: "hsl(222 20% 84%/.96)",
    },
    // Uppnådd baskompetens: orange
    "Uppnådd baskompetens": {
      bg: "hsl(12 35% 94%/.96)",
      bd: "hsl(12 25% 75%/.96)",
      pill: "hsl(12 40% 98%/.96)",
      pillBd: "hsl(12 23% 85%/.96)",
    },
    // Tjänstgöring före legitimation: gul
    "Tjänstgöring före legitimation": {
      bg: "hsl(48 85% 93%/.96)",
      bd: "hsl(48 70% 75%/.96)",
      pill: "hsl(48 90% 98%/.96)",
      pillBd: "hsl(48 60% 86%/.96)",
    },
    // Utländsk tjänstgöring: grå (som tidigare)
    "Utländsk tjänstgöring": {
      bg: "hsl(220 14% 95%/.96)",
      bd: "hsl(220 12% 75%/.96)",
      pill: "hsl(220 16% 98%/.96)",
      pillBd: "hsl(220 10% 86%/.96)",
    },
  };


  function colorsForBt(key: string | AttachKey) {
    const raw = String(key).trim();

    // 1) Om formatet är "Typ: Titel" – använd "Typ" som gruppnyckel
    let kind: AttachKey | string = raw.includes(":")
      ? raw.split(":")[0].trim()
      : raw;

    // 2) Hantera icke-koloniserade rubriker som vi skapar dynamiskt
    //    t.ex. "Intyg tjänstgöring före legitimation 1"
    if (/^Intyg tjänstgöring före legitimation\b/i.test(raw)) {
      kind = "Tjänstgöring före legitimation";
    } else if (/^Utländsk tjänstgöring\b/i.test(raw)) {
      kind = "Utländsk tjänstgöring";
    }

    // 3) Fallback till definierade grupper; om okänd → färgsätt som Delmål i BT
    const sw = BT_GROUP_COLORS[kind as AttachKey] ?? BT_GROUP_COLORS["Delmål i bastjänstgöringen"];
    return { cardBg: sw.bg, cardBd: sw.bd, pillBg: sw.pill, pillBd: sw.pillBd };
  }


  /** Normalisera och sortera bilagelistan enligt prioritet:
   * 1) Delmål i BT (registrerade kliniska placeringar) – kronologiskt på slutdatum (tidigast först)
   * 2) Delmål i ST (sparade intyg från fliken "Delmål i BT") – lägsta nummer först
   * 3) Fullgjord bastjänstgöring
   * 4) Uppnådd baskompetens
   * 5) Tjänstgöring före legitimation (om ikryssad)
   * 6) Utländsk tjänstgöring (om ikryssad)
   */
  function normalizeAndSortAttachments(list: string[]): AttachKey[] {
    // Filtrera bort råa gruppetiketter utan innehåll som inte ska finnas längre
    const filtered = list.filter((x) => x && x !== "Delmål i bastjänstgöringen");

    const isBTPlacement = (x: string) =>
      x.startsWith("Delmål i bastjänstgöringen: Klinisk tjänstgöring — ");
    const isSavedBtCert = (x: string) =>
      x.startsWith("Delmål i bastjänstgöringen: Intyg delmål i BT ");
    const isFullgjord = (x: string) => x === "Fullgjord bastjänstgöring";
    const isBaskomp = (x: string) => x === "Uppnådd baskompetens";
    const isPrelicense = (x: string) =>
      x.startsWith("Tjänstgöring före legitimation:") ||
      /^Intyg tjänstgöring före legitimation\b/.test(x);

    const isForeign = (x: string) => x.startsWith("Utländsk tjänstgöring:");

    // 1) BT placeringar: sortera på slutdatum (hämta ur btPlacements)
    const btMap = new Map<string, number>(); // label -> time(end or start)
    for (const pl of btPlacements) {
      const label =
        `Delmål i bastjänstgöringen: Klinisk tjänstgöring — ` +
        String((pl as any).clinic || (pl as any).note || "Klinisk tjänstgöring");
      const t = new Date((pl as any).endDate || (pl as any).startDate || 0).getTime();
      btMap.set(label, t);
    }
    const a1 = filtered
      .filter(isBTPlacement)
      .sort((a, b) => (btMap.get(a) ?? 0) - (btMap.get(b) ?? 0));

    // 2) Sparade intyg från fliken "Delmål i BT": numerisk sort på sista talet
    const num = (s: string) => Number(s.match(/\d+/)?.[0] ?? 0);
    const a2 = filtered
      .filter(isSavedBtCert)
      .sort((a, b) => num(a) - num(b));

    // 3) Fullgjord BT
    const a3 = filtered.filter(isFullgjord);

    // 4) Uppnådd baskompetens
    const a4 = filtered.filter(isBaskomp);

    // 5) Tjänstgöring före legitimation (alla titlar i den gruppen, i tillagd ordning)
    const a5 = filtered.filter(isPrelicense);

    // 6) Utländsk tjänstgöring (alla titlar i den gruppen, i tillagd ordning)
    const a6 = filtered.filter(isForeign);

    return [...a1, ...a2, ...a3, ...a4, ...a5, ...a6] as AttachKey[];
  }



  // Drag & drop state (som i PrepareApplicationModal)
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [tempOrder, setTempOrder] = useState<AttachKey[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const startYRef = useRef(0);
  const DRAG_THRESHOLD = 4;
const readyRef = useRef(false);


/** ====== Baseline-snapshot för ”Spara/Stäng” ====== */
type Baseline = {
  btActivities: BtActivity[];
  btGoals: Chip[];
  btRows: BtPlacementRow[];
  attachments: AttachKey[];
  prelicenseRows: ForeignOrPrelicenseRow[];
  foreignRows: ForeignOrPrelicenseRow[];
  applicant: typeof applicant;
  mainSupervisorPrints: boolean;
  issuingSupervisor: typeof issuingSupervisor;
  otherThanManager: boolean;
  appointedSigner: typeof appointedSigner;
  controlHow: string;
};
const baselineRef = useRef<Baseline | null>(null);

function currentSnapshot(): Baseline {
  return {
    btActivities: structuredClone(btActivities),
    btGoals: structuredClone(btGoals),
    btRows: structuredClone(btRows),
    attachments: structuredClone(attachments),
    prelicenseRows: structuredClone(prelicenseRows),
    foreignRows: structuredClone(foreignRows),
    applicant: structuredClone(applicant),
    mainSupervisorPrints,
    issuingSupervisor: structuredClone(issuingSupervisor),
    otherThanManager,
    appointedSigner: structuredClone(appointedSigner),
    controlHow,
  };
}

function takeBaseline() {
  baselineRef.current = currentSnapshot();
}

function updateDirty() {
  // Sätt inte dirty under init/återställning
  if (!readyRef.current) return;

  const b = baselineRef.current;
  if (!b) return;
  try {
    const cur = currentSnapshot();
    // Monoton dirty: när true, förblir true tills explicit reset (öppning/spara)
    setDirty((prev) => prev || JSON.stringify(cur) !== JSON.stringify(b));
  } catch {
    setDirty(true);
  }
}




function restoreBaseline() {
  const b = baselineRef.current;
  if (!b) return;
  setBtActivities(b.btActivities);
  setBtGoals(b.btGoals);
  setBtRows(b.btRows);
  setAttachments(b.attachments);
  setPrelicenseRows(b.prelicenseRows);
  setForeignRows(b.foreignRows);
  setApplicant(b.applicant);
  setMainSupervisorPrints(b.mainSupervisorPrints);
  setIssuingSupervisor(b.issuingSupervisor);
  setOtherThanManager(b.otherThanManager);
  setAppointedSigner(b.appointedSigner);
  setControlHow(b.controlHow);
}

/** Spara = commit:a nuvarande läge som ny baseline */
function handleSave() {
  takeBaseline();
  setDirty(false);
}

/** Stäng med varning och ev. rollback */
function handleRequestClose() {
  if (!dirty) return onClose();
  setShowCloseConfirm(true);
}

function handleConfirmClose() {
  restoreBaseline(); // rulla tillbaka
  setDirty(false);
  setShowCloseConfirm(false);
  onClose();
}

function handleSaveAndClose() {
  handleSave();
  setShowCloseConfirm(false);
  onClose();
}

function handleCancelClose() {
  setShowCloseConfirm(false);
}


/** Effekt A: när modalen öppnas, blockera dirty-spårning under init */
useEffect(() => {
  if (!open) return;
  // Stoppa dirty-spårning direkt vid öppning tills baseline är satt
  readyRef.current = false;
  // Nollställ ev. tidigare dirty-flagga
  setDirty(false);
}, [open]);

/** Effekt B: ta baseline först när både open=true och profile är laddad, efter stabil render */
useEffect(() => {
  if (!open) return;
  if (!profile) return;

  let raf1 = 0;
  let raf2 = 0;
  let timer: any = null;

  const armBaseline = () => {
    timer = setTimeout(() => {
      try {
        takeBaseline();
      } finally {
        // Tillåt dirty-spårning när baseline speglar initierat state
        readyRef.current = true;
      }
    }, 0);
  };

  raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(armBaseline);
  });

  return () => {
    if (raf1) cancelAnimationFrame(raf1);
    if (raf2) cancelAnimationFrame(raf2);
    if (timer) clearTimeout(timer);
  };
}, [open, profile]);






  // Säkerställ att tempOrder speglar attachments i samma ordning
  useEffect(() => {
    setTempOrder(attachments.slice());
  }, [attachments]);

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
    if (readyRef.current) updateDirty();

  }
  setDragIndex(null);
  setDragActive(false);
  document.body.style.userSelect = "";
}



  /** ====== Intyg-popup (för 4/5) ====== */
  function renderIntygModal() {
    const { mode, rowId } = intygModalOpen;
    if (!mode) return null;

    const rows = mode === "prelicense" ? prelicenseRows : foreignRows;
    const setRows = mode === "prelicense" ? setPrelicenseRows : setForeignRows;
    const row = rows.find((r) => r.id === rowId);
    if (!row) return null;

    const canSave =
      (row.intyg?.clinic || "").trim().length > 0 ||
      (row.intyg?.supervisor || "").trim().length > 0 ||
      (row.intyg?.goals?.length || 0) > 0 ||
      !!row.intyg?.startISO ||
      !!row.intyg?.endISO ||
      (row.intyg?.controlHow || "").trim().length > 0 ||
      (row.intyg?.percent ?? 0) > 0;

    return (
      <div className="fixed inset-0 z-[120] grid place-items-center bg-black/40 p-3">
        <div className="w-full max-w-[820px] overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="m-0 text-base font-extrabold">
              {mode === "prelicense"
                ? "Intyg – Tjänstgöring före legitimation"
                : "Intyg – Utländsk tjänstgöring"}
            </h3>
            <div className="flex items-center gap-2">
              <button
                disabled={!canSave}
                onClick={() => {
                  setRows((all) =>
                    all.map((r) =>
                      r.id === row.id ? { ...r } : r
                    )
                  );
                  updateDirty();
                }}
                className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
              >
                Spara
              </button>
              <button
                onClick={() => setIntygModalOpen({ mode: null })}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              >
                Stäng
              </button>
            </div>
          </header>

          <section className="max-h-[70vh] overflow-auto p-4">
            <div className="grid grid-cols-1 gap-3">
              <LabeledInputLocal
                label="Klinisk tjänstgöring"
                value={row.intyg?.clinic || ""}
                onCommit={(v) =>
                  setRows((all) =>
                    all.map((r) =>
                      r.id === row.id
                        ? { ...r, intyg: { ...(r.intyg ?? defaultIntyg()), clinic: v } }
                        : r
                    )
                  )
                }
              />
              <div className="grid grid-cols-[1fr_220px] gap-2">
                <div />
                <div className="grid grid-cols-[1fr_1fr] gap-2">
                  <div className="w-full">
                    <label className="mb-1 block text-sm text-slate-700">
                      Start
                    </label>
                    <CalendarDatePicker
                      value={row.intyg?.startISO || null}
                      onChange={(iso) =>
                        setRows((all) =>
                          all.map((r) =>
                            r.id === row.id
                              ? {
                                  ...r,
                                  intyg: { ...(r.intyg ?? defaultIntyg()), startISO: iso },
                                }
                              : r
                          )
                        )
                      }
                      align="right"
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                    />
                  </div>
                  <div className="w-full">
                    <label className="mb-1 block text-sm text-slate-700">
                      Slut
                    </label>
                    <CalendarDatePicker
                      value={row.intyg?.endISO || null}
                      onChange={(iso) =>
                        setRows((all) =>
                          all.map((r) =>
                            r.id === row.id
                              ? {
                                  ...r,
                                  intyg: { ...(r.intyg ?? defaultIntyg()), endISO: iso },
                                }
                              : r
                          )
                        )
                      }
                      align="right"
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_140px] items-end gap-2">
                <LabeledInputLocal
                  label="Handledare"
                  value={row.intyg?.supervisor || ""}
                  onCommit={(v) =>
                    setRows((all) =>
                      all.map((r) =>
                        r.id === row.id
                          ? {
                              ...r,
                              intyg: { ...(r.intyg ?? defaultIntyg()), supervisor: v },
                            }
                          : r
                      )
                    )
                  }
                />
                <div>
                  <label className="mb-1 block text-sm text-slate-700">
                    Syss.%
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={row.intyg?.percent ?? 100}
                    onChange={(e) =>
                      setRows((all) =>
                        all.map((r) =>
                          r.id === row.id
                            ? {
                                ...r,
                                intyg: {
                                  ...(r.intyg ?? defaultIntyg()),
                                  percent: Math.max(
                                    1,
                                    Math.min(100, Number(e.target.value) || 0)
                                  ),
                                },
                              }
                            : r
                        )
                      )
                    }
                    className="h-[40px] w-[140px] rounded-lg border border-slate-300 bg-white px-3 text-[14px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <LabeledInputLocal
                  label="Handledares specialitet"
                  value={row.intyg?.supervisorSpec || ""}
                  onCommit={(v) =>
                    setRows((all) =>
                      all.map((r) =>
                        r.id === row.id
                          ? {
                              ...r,
                              intyg: { ...(r.intyg ?? defaultIntyg()), supervisorSpec: v },
                            }
                          : r
                      )
                    )
                  }
                />
                <LabeledInputLocal
                  label="Handledares tjänsteställe"
                  value={row.intyg?.supervisorWorkplace || ""}
                  onCommit={(v) =>
                    setRows((all) =>
                      all.map((r) =>
                        r.id === row.id
                          ? {
                              ...r,
                              intyg: {
                                ...(r.intyg ?? defaultIntyg()),
                                supervisorWorkplace: v,
                              },
                            }
                          : r
                      )
                    )
                  }
                />
                <div className="self-end">
                  <button
                    type="button"
                    onClick={() =>
                      setRows((all) =>
                        all.map((r) =>
                          r.id === row.id
                            ? {
                                ...r,
                                intyg: { ...(r.intyg ?? defaultIntyg()), goals: r.intyg?.goals ?? [] },
                              }
                            : r
                        )
                      )
                    }
                    className="h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"
                    onClickCapture={() =>
                      setIntygGoalsPicker({ open: true, mode, rowId: row.id })
                    }
                  >
                    Delmål
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Hur det kontrollerats att delmålen uppnåtts
                </label>
                <textarea
                  value={row.intyg?.controlHow || ""}
                  onChange={(e) =>
                    setRows((all) =>
                      all.map((r) =>
                        r.id === row.id
                          ? {
                              ...r,
                              intyg: {
                                ...(r.intyg ?? defaultIntyg()),
                                controlHow: e.target.value,
                              },
                            }
                          : r
                      )
                    )
                  }
                  rows={5}
                  className="w-full rounded-lg border border-slate-300 p-3 text-[14px]"
                />
              </div>
            </div>
          </section>

          <footer className="flex items-center justify-between border-t px-4 py-3">
            <button
              onClick={() => {
                // Placeholder – här skulle vi öppna “Intyg om delmål …”/tredjeland
                alert("Skriv ut intyg (kommer att generera PDF)");
              }}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            >
              Skriv ut intyg
            </button>
            <div className="flex items-center gap-2">
              <button
                disabled={!canSave}
                onClick={() => {
                  updateDirty();
                  setIntygModalOpen({ mode: null });
                }}
                className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
              >
                Spara
              </button>
              <button
                onClick={() => setIntygModalOpen({ mode: null })}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              >
                Stäng
              </button>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  function defaultIntyg(): NonNullable<ForeignOrPrelicenseRow["intyg"]> {
    return {
      clinic: "",
      startISO: null,
      endISO: null,
      percent: 100,
      supervisor: "",
      supervisorSpec: "",
      supervisorWorkplace: "",
      controlHow: "",
      goals: [],
    };
  }

  /** Delmål-picker för intyg-popup (4/5) */
  const [intygGoalsPicker, setIntygGoalsPicker] = useState<{
    open: boolean;
    mode: "prelicense" | "foreign" | null;
    rowId?: string;
  }>({ open: false, mode: null });

  /** Ordna bilagor – Delmål i BT (högersidan i ”Lägg till bilaga”) */
  const [btAttachChecked, setBtAttachChecked] = useState<Record<string, boolean>>({});
  const [moreBtEnabled, setMoreBtEnabled] = useState<boolean>(false);
  const [moreBtCount, setMoreBtCount] = useState<number>(1);

  /** Hjälp: lägg till/ta bort en enskild BT-placering som bilaga */
  function toggleBtPlacementAttachment(pl: any, on: boolean) {
    const label =
      `Delmål i bastjänstgöringen: Klinisk tjänstgöring — ` +
      (String((pl as any).clinic || (pl as any).note || "Klinisk tjänstgöring"));

    setAttachments((list) => {
      const filtered = list.filter((x) => String(x) !== label);
      return on ? [...filtered, label] : filtered;
    });
  }

  /** Hjälp: synka ”Fler intyg … Antal” mot bilagelistan */
  function syncMoreBt(count: number, enabled: boolean) {
    setAttachments((list) => {
      const prefix = "Delmål i bastjänstgöringen: Intyg nr ";
      const base = list.filter((x) => !String(x).startsWith(prefix));
      if (!enabled) return base as AttachKey[];
      const extras = Array.from({ length: Math.max(1, count) }, (_, i) => `${prefix}${i + 1}`);
      return [...base, ...extras] as AttachKey[];
    });
  }

  /** Hjälp: synka ”Tjänstgöring före legitimation – Antal” mot bilagelistan */
  function syncPrelicenseAttachments(count: number, enabled: boolean) {
    setAttachments((list) => {
      // Ta bort alla varianter som kan ha lagts till tidigare
      const base = list.filter(
        (x) =>
          !/^Intyg tjänstgöring före legitimation\b/.test(String(x)) &&
          !String(x).startsWith("Tjänstgöring före legitimation:")
      );
      if (!enabled) return normalizeAndSortAttachments(base as string[]);
      const extras = Array.from({ length: Math.max(1, count) }, (_, i) => `Intyg tjänstgöring före legitimation ${i + 1}`);
      return normalizeAndSortAttachments([...(base as string[]), ...extras]);
    });
  }



  /** ====== Render main modal ====== */
  if (!open) return null;

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
  <h2 className="m-0 text-lg font-extrabold">Intyg bastjänstgöring</h2>
  <div className="flex items-center gap-2">
    <button
      disabled={!dirty}
      onClick={handleSave}
      id="save-2021"
      className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
      title="Spara ändringar i denna modal"
    >
      Spara
    </button>
    <button
      onClick={handleRequestClose}
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
      title="Stäng – varnar om osparade ändringar"
    >
      Stäng
    </button>
  </div>
</header>


        {/* Tabs (match PrepareApplicationModal) */}
        <nav className="flex gap-1 border-b bg-slate-50 px-2 pt-2">
          {[
            { id: "btgoals", label: "Skapa intyg: Delmål i BT" },
            { id: "btfull", label: "Fullgjord BT" },
            { id: "competence", label: "Uppnådd BT" },
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

            {/* Body */}
        <section
  className="max-h-[75vh] overflow-auto p-4"
>




                    {/* 2) Delmål i BT */}
          {tab === "btgoals" && (
            <div className="grid grid-cols-1 gap-4">
              {/* Utbildningsaktiviteter överst */}
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-extrabold">
                  Utbildningsaktiviteter som genomförts för att uppnå delmål
                </h3>

                {/* Buttons (Välj bland registrerade först) */}
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setChooserOpen(true)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                  >
                    Välj bland registrerade
                  </button>
                  <button
                    type="button"
                    onClick={addEmptyActivityRow}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                  >
                    + Lägg till aktivitet
                  </button>
                </div>

                {/* Activities editor rows */}
                <div className="grid gap-2">
                  {btActivities.map((a) => {
                    const isReg = a.source === "registered";
                    const rowTitle = isReg ? "Ändras på huvudsidan" : undefined;

                    return (
                      <div
                        key={a.id}
                        title={rowTitle}
                        className={`grid grid-cols-[minmax(0,1fr)_160px_160px_40px] items-end gap-2 ${isReg ? "opacity-80" : ""}`}
                      >
                        <input
                          value={a.text}
                          onChange={(e) =>
                            setBtActivities((s) =>
                              s.map((x) => (x.id === a.id ? { ...x, text: e.target.value } : x))
                            )
                          }
                          disabled={isReg}
                          readOnly={isReg}
                          className={`h-[40px] w-full rounded-lg border px-3 text-[14px] ${
                            isReg
                              ? "border-slate-300 bg-slate-100 text-slate-700 cursor-not-allowed"
                              : "border-slate-300 bg-white"
                          }`}
                        />

                        <div className="w-[160px]">
                          <label className="mb-1 block text-xs text-slate-600">Start</label>
                          <div className={isReg ? "pointer-events-none" : ""} aria-disabled={isReg}>
                            <CalendarDatePicker
                              value={a.startISO}
                              onChange={(iso) =>
                                setBtActivities((s) =>
                                  s.map((x) => (x.id === a.id ? { ...x, startISO: iso } : x))
                                )
                              }
                              align="right"
                              className={`h-[40px] w-full rounded-lg border px-3 text-[14px] ${
                                isReg ? "border-slate-300 bg-slate-100 text-slate-700" : "border-slate-300"
                              }`}
                            />
                          </div>
                        </div>

                        <div className="w-[160px]">
                          <label className="mb-1 block text-xs text-slate-600">Slut</label>
                          <div className={isReg ? "pointer-events-none" : ""} aria-disabled={isReg}>
                            <CalendarDatePicker
                              value={a.endISO}
                              onChange={(iso) =>
                                setBtActivities((s) =>
                                  s.map((x) => (x.id === a.id ? { ...x, endISO: iso } : x))
                                )
                              }
                              align="right"
                              className={`h-[40px] w-full rounded-lg border px-3 text-[14px] ${
                                isReg ? "border-slate-300 bg-slate-100 text-slate-700" : "border-slate-300"
                              }`}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setBtActivities((s) => s.filter((x) => x.id !== a.id));
                            if (isReg && a.refId) {
                              setChooserChecked((st) => ({ ...st, [String(a.refId)]: false }));
                              setChooserIncludeGoals((st) => ({ ...st, [String(a.refId)]: false }));
                            }
                          }}
                          className="h-[40px] w-[40px] rounded-lg border border-slate-300 bg-white text-lg font-semibold leading-none hover:bg-slate-100"
                          title="Ta bort"
                        >
                          –
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delmål under aktiviteterna */}
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-extrabold">Delmål</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                  >
                    Delmål som intyget avser
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {[...btGoals]
                      .sort((a, b) => {
                        const na = Number(String(a.id).match(/\d+/)?.[0] ?? 0);
                        const nb = Number(String(b.id).match(/\d+/)?.[0] ?? 0);
                        if (na !== nb) return na - nb;
                        return String(a.id).localeCompare(String(b.id));
                      })
                      .map((g) => (
                        <ChipView
                          key={g.id}
                          chip={g}
                          onRemove={() => setBtGoals((list) => list.filter((x) => x.id !== g.id))}
                        />
                      ))}
                  </div>

                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-extrabold">
                  Hur det kontrollerats att delmålen uppnåtts
                </h3>
                <textarea
                  value={controlHow}
                  onChange={(e) => setControlHow(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 p-3 text-[14px]"
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <label className="inline-flex items-center gap-2 text:[13px] text-[13px]">
                  <input
                    type="checkbox"
                    checked={mainSupervisorPrints}
                    onChange={(e) => setMainSupervisorPrints(e.currentTarget.checked)}
                  />
                  <span>Någon annan än huvudhandledare utfärdar intyg</span>
                </label>

                {mainSupervisorPrints && (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <LabeledInputLocal
                      label="Intygsutfärdande handledare"
                      value={issuingSupervisor.name}
                      onCommit={(v) => setIssuingSupervisor((s) => ({ ...s, name: v }))}
                    />
                    <LabeledInputLocal
                      label="Handledares specialitet"
                      value={issuingSupervisor.specialty}
                      onCommit={(v) => setIssuingSupervisor((s) => ({ ...s, specialty: v }))}
                    />
                    <LabeledInputLocal
                      label="Handledares tjänsteställe"
                      value={issuingSupervisor.workplace}
                      onCommit={(v) => setIssuingSupervisor((s) => ({ ...s, workplace: v }))}
                    />
                  </div>
                )}
              </div>

              {/* Footer med “Spara som bilaga” och “Rensa formulär” */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                                    <button
  type="button"
  onClick={async () => {
    const prefix = "Delmål i bastjänstgöringen: Intyg delmål i BT ";

    // Om vi kom hit via "Ändra": skriv över det befintliga nyckelvärdet.
    const isEditingExisting =
      !!editingSavedKey && Object.prototype.hasOwnProperty.call(btSavedCerts, editingSavedKey as string);

    let key: AttachKey;
    let title: string;

    if (isEditingExisting) {
      // Behåll samma nyckel/titel
      key = editingSavedKey as AttachKey;
      title = String(editingSavedKey);
    } else {
      // Skapa ny numrerad nyckel
      const existingNumbers = Object.keys(btSavedCerts)
        .filter((k) => k.startsWith(prefix))
        .map((k) => Number(k.slice(prefix.length)) || 0);
      const nextNo = (existingNumbers.length ? Math.max(...existingNumbers) : 0) + 1;
      title = `Intyg delmål i BT ${nextNo}`;
      key = `${prefix}${nextNo}` as AttachKey;
    }

    // Bygg nytt värde som ska sparas
    const updatedValue = {
      goals: structuredClone(btGoals),
      activities: structuredClone(btActivities),
      controlHow: String(controlHow || ""),
      signer: {
        useOther: !!mainSupervisorPrints,
        name: String(issuingSupervisor.name || ""),
        specialty: String(issuingSupervisor.specialty || ""),
        workplace: String(issuingSupervisor.workplace || ""),
      },
    };

    // Uppdatera map: skriv över vid redigering, annars lägg till ny
    const newMap = {
      ...btSavedCerts,
      [key]: updatedValue,
    };

    // Uppdatera state och persistera
    setBtSavedCerts(newMap);
    try {
      await db.profile.update("default", { btSavedCerts: newMap });
    } catch (e) {
      console.error("Kunde inte spara btSavedCerts:", e);
    }

    // Säkerställ att bilagan finns i listan och hamnar enligt sorteringsregeln
    setAttachments((prev) =>
      normalizeAndSortAttachments([
        ...prev.filter((x) => String(x) !== String(key)),
        key as AttachKey,
      ])
    );

    alert(isEditingExisting ? `Uppdaterade "${title}"` : `Sparat som "${title}"`);
    updateDirty();

  }}
  className="rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
>
  {editingSavedKey ? "Spara ändringar" : "Spara som bilaga"}
</button>




                  <button
                    type="button"
                    onClick={() => {
                      setBtActivities([]);
                      setBtGoals([]);
                      setControlHow("");
                      setMainSupervisorPrints(false);
                      setIssuingSupervisor({ name: "", specialty: "", workplace: "" });
                      setEditingSavedKey(null); // lämna redigeringsläge
                      if (readyRef.current) updateDirty();

                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                  >
                    Rensa formulär
                  </button>

                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewBtGoals}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                  >
                    Intyg
                  </button>
                </div>
              </div>
            </div>
          )}



          {/* 3) Intyg om fullgjord BT */}
          {tab === "btfull" && (
            <div className="grid grid-cols-1 gap-4">
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-extrabold">
                  Kliniska tjänstgöringar under BT
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border-b px-3 py-2 text-left">Tjänstgöring</th>
                        <th className="border-b px-3 py-2 text-left">Period</th>
                        <th className="border-b px-3 py-2 text-right">Syss.%</th>
                        <th className="border-b px-3 py-2 text-right">Mån (heltid)</th>
                        <th className="border-b px-3 py-2 text-center">Primärvård</th>
                        <th className="border-b px-3 py-2 text-center">Akut sjukvård</th>
                      </tr>
                    </thead>
                    <tbody>
                      {btRows.map((r) => (
                        <tr key={r.id} className="odd:bg-white even:bg-slate-50/40">
                          <td className="border-b px-3 py-2">
                            {(r.ref as any).clinic || (r.ref as any).note || "—"}
                          </td>
                          <td className="border-b px-3 py-2">
                            {(r.ref.startDate || "").slice(0, 10)} –{" "}
                            {(r.ref.endDate || r.ref.startDate || "").slice(0, 10)}
                          </td>
                          <td className="border-b px-3 py-2 text-right">{r.percent}</td>
                          <td className="border-b px-3 py-2 text-right">{r.monthsFte}</td>
                          <td className="border-b px-3 py-2 text-center">
  <input
    type="checkbox"
    checked={r.primaryCare}
    onChange={(e) => {
      const checked = (e.currentTarget as HTMLInputElement).checked;
      setBtRows((rows) =>
        rows.map((x) => (x.id === r.id ? { ...x, primaryCare: checked } : x))
      );
      updateDirty();
    }}
  />
</td>
<td className="border-b px-3 py-2 text-center">
  <input
    type="checkbox"
    checked={r.acuteCare}
    onChange={(e) => {
      const checked = (e.currentTarget as HTMLInputElement).checked;
      setBtRows((rows) =>
        rows.map((x) => (x.id === r.id ? { ...x, acuteCare: checked } : x))
      );
      updateDirty();
    }}
  />
</td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <label className="inline-flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={otherThanManager}
                    onChange={(e) => setOtherThanManager(e.currentTarget.checked)}
                  />
                  <span>Någon annan än verksamhetschef utfärdar intyg</span>
                </label>

                {otherThanManager && (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <LabeledInputLocal
                      label="Intygsutfärdande person motsvarande verksamhetschef"
                      value={appointedSigner.name}
                      onCommit={(v) =>
                        setAppointedSigner((s) => ({ ...s, name: v }))
                      }
                    />
                    <LabeledInputLocal
                      label="Tjänsteställe"
                      value={appointedSigner.workplace}
                      onCommit={(v) =>
                        setAppointedSigner((s) => ({ ...s, workplace: v }))
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          )}

               {/* 4) Uppnådd baskompetens */}
          {tab === "competence" && (
            <div className="grid grid-cols-1 gap-4">
              
              {/* Huvudhandledare (gråmarkerade fält, från Profil) */}
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-extrabold">Huvudhandledare</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <ReadonlyInput
                    label="Namn"
                    value={String((profile as any)?.supervisor ?? "")}
                  />
                  <ReadonlyInput
                    label="Specialitet"
                    value={String((profile as any)?.supervisorSpecialty ?? (profile as any)?.specialty ?? "")}
                  />
                  <ReadonlyInput
                    label="Tjänsteställe"
                    value={String((((profile as any)?.supervisorWorkplace || (profile as any)?.homeClinic)) ?? "")}
                  />
                </div>
              </div>
{/* Extern bedömare */}
              <div className="rounded-lg border border-slate-200 p-3">
                <h3 className="mb-2 text-sm font-extrabold">Extern bedömare</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <LabeledInputLocal
                    label="Namn på extern bedömare"
                    value={(profile as any)?.btExtAssessorName || ""}
                    onCommit={(v) =>
                      db.profile
                        .update("default", { btExtAssessorName: v })
                        .then(() => {
                          setProfile((prev) =>
                            prev ? { ...prev, btExtAssessorName: v } : prev
                          );
                          setDirty(true);
                        })
                    }
                  />
                  <LabeledInputLocal
                    label="Specialitet"
                    value={(profile as any)?.btExtAssessorSpec || ""}
                    onCommit={(v) =>
                      db.profile
                        .update("default", { btExtAssessorSpec: v })
                        .then(() => {
                          setProfile((prev) =>
                            prev ? { ...prev, btExtAssessorSpec: v } : prev
                          );
                          setDirty(true);
                        })
                    }
                  />
                  <LabeledInputLocal
                    label="Tjänsteställe"
                    value={(profile as any)?.btExtAssessorWorkplace || ""}
                    onCommit={(v) =>
                      db.profile
                        .update("default", { btExtAssessorWorkplace: v })
                        .then(() => {
                          setProfile((prev) =>
                            prev
                              ? { ...prev, btExtAssessorWorkplace: v }
                              : prev
                          );
                          setDirty(true);
                        })
                    }
                  />

                </div>
              </div>


            </div>
          )}




                    {/* 5) Ordna bilagor (drag & drop – identisk interaktion som PrepareApplicationModal) */}
{tab === "attachments" && (
  <div className="grid grid-cols-1 gap-4">
    {/* Lista – identisk layout som i PrepareApplicationModal */}
    <div className="rounded-lg border border-slate-200">
      {/* Header med #-kolumn och grå bakgrund */}
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


        {tempOrder.map((key, idx) => {
          const raw = String(key);
          const hasTitle = raw.includes(":");
          const kind = hasTitle ? raw.split(":")[0].trim() as AttachKey : raw as AttachKey;
          const title = hasTitle ? raw.split(":").slice(1).join(":").trim() : "";

          return (
            <div
              key={`${key}-${idx}`}
              ref={(el) => (rowRefs.current[idx] = el)}
              className="mb-1 grid grid-cols-[48px_1fr] gap-2"
            >
              {/* #-kolumn */}
              <div className="flex items-center justify-center">
                <div className="select-none rounded-md bg-slate-100 px-2 py-[1px] text-[11px] font-bold text-slate-700 tabular-nums">
                  {idx + 1}.
                </div>
              </div>

              {/* Själva kortet – drag-handle på hela raden */}
              <div
                role="button"
                onPointerDown={(e) => onPointerDownCard(idx, e)}
                className={`rounded-md border px-3 py-2 ${dragIndex === idx ? "ring-2 ring-sky-300" : ""}`}
                style={{
                  cursor: (dragActive ? "grabbing" : "grab") as any,
                  ...((
                    () => {
                      const { cardBg, cardBd } = colorsForBt(kind);
                      return { backgroundColor: cardBg, borderColor: cardBd };
                    }
                  )()),
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="select-none text-slate-500 leading-none">≡</div>
                  <span
                    className="shrink-0 rounded-md border px-1.5 py-[1px] text-[11px] font-semibold text-slate-700 select-none"
                    style={(() => {
                      const { pillBg, pillBd } = colorsForBt(kind);
                      return { backgroundColor: pillBg, borderColor: pillBd };
                    })()}
                  >
                    {kind}
                  </span>
                  <span className="min-w-0 grow truncate text-[13px] font-medium text-slate-900 select-none">
                    {title || kind}
                  </span>
                  <span className="ml-auto shrink-0 tabular-nums text-[12px] text-slate-700/80 select-none">—</span>
                </div>
              </div>
            </div>
          );
        })}

        {tempOrder.length === 0 && !dragActive && (
          <div className="rounded-xl border border-dashed p-6 text-center text-slate-500">Inga bilagor.</div>
        )}
      </div>
    </div>

    {/* Högersida – Lägg till bilaga */}
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 text-sm font-extrabold">Inkludera bilagor</div>

      {/* === Delmål i BT (NY) === */}
      <div className="mb-4">
        <div className="mb-1 text-[13px] font-semibold text-slate-800">Registrerade utbildningsmoment</div>
        <div className="space-y-1">
          {[...btPlacements]
            .sort(
              (a, b) =>
                new Date((a as any).endDate || (a as any).startDate || 0).getTime() -
                new Date((b as any).endDate || (b as any).startDate || 0).getTime()
            )
            .map((pl) => {
              const label =
                `Delmål i bastjänstgöringen: Klinisk tjänstgöring — ` +
                String((pl as any).clinic || (pl as any).note || "Klinisk tjänstgöring");
              const checked = !!btAttachChecked[pl.id];

              return (
                <div key={pl.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const on = e.currentTarget.checked;
                      setBtAttachChecked((st) => ({ ...st, [pl.id]: on }));
                      setAttachments((list) => {
                        const base = list.filter((x) => String(x) !== label);
                        const next = on ? [...base, label as AttachKey] : (base as AttachKey[]);
                        return normalizeAndSortAttachments(next);
                      });
                    }}
                  />
                  <span className="min-w-0 grow truncate">
                    {(pl as any).clinic || (pl as any).note || "Klinisk tjänstgöring"}
                    {pl.startDate || pl.endDate ? (
                      <span className="text-slate-500">
                        {" "}
                        — {(pl.startDate || "").slice(0, 10)} – {(pl.endDate || pl.startDate || "").slice(0, 10)}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border px-2 py-1 text-[12px] hover:bg-slate-50"
                    title="Öppna förhandsvisning av intyg för detta moment"
                    onClick={async () => {
                      try {
                        if (!profile) {
                          alert("Profil saknas – kan inte skapa intyget.");
                          return;
                        }
                        const { exportCertificate } = await import("@/lib/exporters");
                        const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);

                        const oneActivity = {
                          text: (pl as any).clinic || (pl as any).note || "Klinisk tjänstgöring",
                          startDate: (pl as any).startDate || null,
                          endDate: (pl as any).endDate || (pl as any).startDate || null,
                          source: "registered",
                          refId: (pl as any).id || null,
                        };

                        // Hämta BT-delmål kopplade till just denna placering
                        const goalsForThis = extractPlacementGoals(pl).map((g) => String(g));

                        const activityPayload: any = {
                          goals: goalsForThis, // visar intyg för detta moment
                          activities: [oneActivity],
                          controlHow: "", // tom här; detta är en snabbförhandsvisning
                          useOtherSigner: false,
                          signer: {
                            name: (profile as any)?.supervisor || "",
                            specialty: (profile as any)?.specialty || (profile as any)?.speciality || "",
                            workplace:
                              (profile as any)?.supervisorWorkplace ||
                              (profile as any)?.homeClinic ||
                              "",
                            useOther: false,
                          },

                        };

                        const blob = (await exportCertificate(
                          {
                            goalsVersion: gv,
                            activityType: "BT_GOALS",
                            profile: profile as any,
                            activity: activityPayload,
                            milestones: goalsForThis,
                          },
                          { output: "blob", filename: "bt-delmal-preview.pdf" }
                        )) as Blob;

                        openPreviewFromBlob(blob);
                      } catch (e) {
                        console.error(e);
                        alert("Kunde inte skapa förhandsvisningen.");
                      }
                    }}
                  >
                    Intyg
                  </button>
                </div>
              );
            })}
          {btPlacements.length === 0 && (
            <div className="text-[13px] text-slate-500">Inga BT-tjänstgöringar hittades.</div>
          )}
        </div>
      </div>


      <hr className="my-3" />

      {/* === Sparade “Intyg delmål i BT x” (NY) === */}
      <div className="mb-4">
        <div className="mb-1 text-[13px] font-semibold text-slate-800">Sparade intyg (från fliken "Delmål i ST")</div>
        <div className="space-y-1">
          {Object.keys(btSavedCerts).length === 0 && (
            <div className="text-[13px] text-slate-500">Inga sparade intyg.</div>
          )}

          {Object.keys(btSavedCerts)
            .sort((a, b) => {
              const na = Number(String(a).split(" ").pop());
              const nb = Number(String(b).split(" ").pop());
              if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
              return String(a).localeCompare(String(b));
            })
            .map((key) => {
              const isChecked = attachments.some((x) => String(x) === key);
              return (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
  const on = e.currentTarget.checked;
  setAttachments((list) => {
    const base = list.filter((x) => String(x) !== key);
    const next = on ? [...base, key as AttachKey] : base as AttachKey[];
    return normalizeAndSortAttachments(next);
  });
}}

                    title="Visa detta intyg som bilaga i listan ovan"
                  />
                  <span className="min-w-0 grow truncate text-[13px]">{key}</span>

                  <div className="ml-auto flex items-center gap-1">
                    {/* Ändra */}
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-[12px] hover:bg-slate-50"
                      title="Öppna och fyll i fliken ”Delmål i BT” med intygets sparade uppgifter"
                      onClick={() => {
                        const saved = btSavedCerts[key]!;
                        setBtGoals(structuredClone(saved.goals));
                        setBtActivities(structuredClone(saved.activities));
                        setControlHow(saved.controlHow || "");
                        setMainSupervisorPrints(!!saved.signer?.useOther);
                        setIssuingSupervisor({
                          name: saved.signer?.name || "",
                          specialty: saved.signer?.specialty || "",
                          workplace: saved.signer?.workplace || "",
                        });
                        setEditingSavedKey(key); // markera att vi redigerar detta intyg
                        setTab("btgoals");
                      }}
                    >
                      Ändra
                    </button>


                    {/* Öppna */}
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-[12px] hover:bg-slate-50"
                      title="Öppna förhandsvisning av intyget"
                      onClick={async () => {
                        try {
                          if (!profile) {
                            alert("Profil saknas – kan inte skapa intyget.");
                            return;
                          }
                          const { exportCertificate } = await import("@/lib/exporters");
                          const gv = normalizeGoalsVersion((profile as any)?.goalsVersion);

                          const saved = btSavedCerts[key]!;
                          const activity: any = {
                            goals: toMilestoneIds(saved.goals),
                            activities: saved.activities.map((a) => ({
                              text: a.text || "",
                              startDate: a.startISO || null,
                              endDate: a.endISO || null,
                              source: a.source || "manual",
                              refId: a.refId || null,
                            })),
                            controlHow: String(saved.controlHow || ""),
                            useOtherSigner: !!saved.signer?.useOther,
                            signer: saved.signer?.useOther
                              ? {
                                  name: saved.signer?.name || "",
                                  specialty: saved.signer?.specialty || "",
                                  workplace: saved.signer?.workplace || "",
                                  useOther: true,
                                }
                              : {
                                  name: (profile as any)?.supervisor || "",
                                  specialty: (profile as any)?.specialty || (profile as any)?.speciality || "",
                                  workplace:
                                    (profile as any)?.supervisorWorkplace ||
                                    (profile as any)?.homeClinic ||
                                    "",
                                  useOther: false,
                                },

                          };

                          const blob = (await exportCertificate(
                            {
                              goalsVersion: gv,
                              activityType: "BT_GOALS",
                              profile: profile as any,
                              activity,
                              milestones: toMilestoneIds(saved.goals),
                            },
                            { output: "blob", filename: "bt-delmal-preview.pdf" }
                          )) as Blob;

                          openPreviewFromBlob(blob);
                        } catch (e) {
                          console.error(e);
                          alert("Kunde inte skapa förhandsvisningen.");
                        }
                      }}
                    >
                      Intyg
                    </button>

                    {/* X */}
                    <button
                      type="button"
                      className="rounded-md border px-2 py-1 text-[12px] hover:bg-slate-50"
                      title="Ta bort intyget"
                      onClick={async () => {
                        const go = window.confirm('Vill du verkligen ta bort intyget?');
                        if (!go) return;

                        // ta bort i state
                        const next = { ...btSavedCerts };
                        delete next[key];
                        setBtSavedCerts(next);

                        // persistera i IndexedDB
                        try {
                          await db.profile.update("default", { btSavedCerts: next });
                        } catch (e) {
                          console.error("Kunde inte spara btSavedCerts:", e);
                        }

                        // ta bort ur bilagelistan
                        setAttachments((list) => list.filter((x) => String(x) !== key));
                      }}
                    >
                      X
                    </button>

                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <hr className="my-3" />

                  {/* === Övriga BT-specifika tillägg === */}
      {/* Tjänstgöring före legitimation */}
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={prelicenseEnabled}
              onChange={(e) => {
                const on = e.currentTarget.checked;
                setPrelicenseEnabled(on);
                // Håll draft i synk med nuvarande värde
                setPrelicenseCountDraft((n) => Math.max(1, n || 1));

                if (on) {
                  // Säkerställ rader enligt nuvarande commit: prelicenseCount
                  setPrelicenseRows((rows) => {
                    if (rows.length >= prelicenseCount) return rows;
                    const need = prelicenseCount - rows.length;
                    const add = Array.from({ length: need }, () => ({
                      id: makeId(),
                      title: "",
                      intyg: { clinic: "", startISO: null, endISO: null, percent: 100, supervisor: "", supervisorSpec: "", supervisorWorkplace: "", controlHow: "", goals: [] },
                    }));
                    return [...rows, ...add];
                  });
                } else {
                  setPrelicenseRows([]);
                }

                // Synka bilagelistan utifrån commit-värdet (ej draft)
                syncPrelicenseAttachments(prelicenseCount, on);
              }}
            />
            <span>Tjänstgöring före legitimation</span>
          </label>

          {/* Antal-fältet + OK (på samma rad) */}
          <div className="ml-2 flex items-center gap-2">
            <span className="text-[13px] leading-none">Antal:</span>
            <input
              type="number"
              min={1}
              step={1}
              value={prelicenseCountDraft}
              onChange={(e) => {
                // Endast draft uppdateras – ingen live-uppdatering
                const n = Math.max(1, Number(e.currentTarget.value) || 1);
                setPrelicenseCountDraft(n);
              }}
              className={`h-[28px] w-[56px] rounded-md border px-2 text-[13px] ${
                prelicenseEnabled ? "border-slate-300 bg-white text-slate-900" : "border-slate-200 bg-slate-100 text-slate-400"
              }`}
              disabled={!prelicenseEnabled}
              inputMode="numeric"
              pattern="[0-9]*"
              title={prelicenseEnabled ? "" : "Aktivera rutan till vänster för att ändra antal"}
            />

            {/* OK-knapp som applicerar antalet och uppdaterar bilagor/rader */}
            <button
              type="button"
              disabled={!prelicenseEnabled}
              onClick={() => {
                const n = Math.max(1, prelicenseCountDraft || 1);
                setPrelicenseCount(n);

                // Uppdatera rader för intyg så de matchar n
                setPrelicenseRows((rows) => {
                  if (!prelicenseEnabled) return rows;
                  if (rows.length === n) return rows;
                  if (rows.length < n) {
                    const add = Array.from({ length: n - rows.length }, () => ({
                      id: makeId(),
                      title: "",
                      intyg: { clinic: "", startISO: null, endISO: null, percent: 100, supervisor: "", supervisorSpec: "", supervisorWorkplace: "", controlHow: "", goals: [] },
                    }));
                    return [...rows, ...add];
                  }
                  return rows.slice(0, n);
                });

                // Synka bilagelistan först när användaren bekräftar
                syncPrelicenseAttachments(n, prelicenseEnabled);
              }}
              className={`h-[28px] rounded-md border px-2 text-[12px] ${
                !prelicenseEnabled
                  ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
              }`}
              title="Bekräfta antal"
            >
              OK
            </button>

          </div>
        </div>

        {/* (Eventuella rader/knappar för tjänstgöring före legitimation kan ligga kvar här under) */}
      </div>




      {/* Utländsk tjänstgöring */}
      <div className="mb-2">
        <label className="inline-flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={foreignEnabled}
            onChange={(e) => {
              const on = e.currentTarget.checked;
              setForeignEnabled(on);
              if (on) {
                setForeignRows((rows) =>
                  rows.length ? rows : [{ id: makeId(), title: "", intyg: { clinic: "", startISO: null, endISO: null, percent: 100, supervisor: "", supervisorSpec: "", supervisorWorkplace: "", controlHow: "", goals: [] } }]
                );
                setAttachments((list) => {
  const rest = list.filter((x) => !String(x).startsWith("Utländsk tjänstgöring:"));
  const next = ["Utländsk tjänstgöring: " as AttachKey, ...rest as AttachKey[]];
  return normalizeAndSortAttachments(next);
});

              } else {
                setAttachments((list) =>
  normalizeAndSortAttachments(list.filter((x) => !String(x).startsWith("Utländsk tjänstgöring:")))
);

                setForeignRows([]);
              }
            }}
          />
          <span>Utländsk tjänstgöring</span>
        </label>

       

  {foreignEnabled && (
    <div className="mt-2 rounded-lg border border-slate-200 p-3">
      {foreignRows.map((r, idx) => (
        <div
          key={r.id}
          className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2"
        >
          {/* Titel */}
          <LabeledInputLocal
            label="Titel på utländsk tjänstgöring"
            value={r.title || ""}
            onCommit={(v) => {
              setForeignRows((rows) =>
                rows.map((x) => (x.id === r.id ? { ...x, title: v } : x))
              );
              // Uppdatera bilagelistan (ersätt alla av typen med nya titlar)
              setAttachments((list) => {
  const rest = list.filter((x) => !String(x).startsWith("Utländsk tjänstgöring:"));
  const titles = foreignRows.map((x) => (x.id === r.id ? (v || "") : (x.title || "")));
  const next = [...rest, ...titles.map((t) => `Utländsk tjänstgöring: ${t}` as AttachKey)];
  return normalizeAndSortAttachments(next);
});

            }}
          />

          {/* Minusknapp – endast på rader efter första */}
          {idx > 0 ? (
            <button
              className="h-[40px] w-[40px] rounded-lg border border-slate-300 bg-white text-lg leading-none hover:bg-slate-100"
              onClick={() => {
                setForeignRows((rows) => rows.filter((x) => x.id !== r.id));
                setAttachments((list) => list.filter((x) => x !== `Utländsk tjänstgöring: ${r.title || ""}`));
              }}
              title="Ta bort"
            >
              –
            </button>
          ) : (
            <div />
          )}
        </div>
      ))}

      {/* Lägg till-knapp under fältet */}
      <div className="mt-2">
        <button
  className="mt-1 h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"
  onClick={() => {
  const newRow = { id: makeId(), title: "" };
  setForeignRows((rows) => [...rows, newRow]);
  setAttachments((list) => {
    const rest = list.filter((x) => !String(x).startsWith("Utländsk tjänstgöring:"));
    const next = [...rest, ...[...foreignRows, newRow].map((x) => `Utländsk tjänstgöring: ${x.title || ""}` as AttachKey)];
    return normalizeAndSortAttachments(next);
  });
}}

>
  Lägg till
</button>

      </div>
    </div>
  )}
</div>

    </div>
  </div>
)}



        </section>

        {/* Undermeny för intyg – alltid synlig oavsett flik */}
        <footer className="border-t bg-white">
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
            <button
              type="button"
              onClick={handlePreviewBtFull}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              title="Öppna förhandsvisning – Intyg fullgjord BT"
            >
              Intyg fullgjord BT
            </button>

            <button
              type="button"
              onClick={handlePreviewBtCompetence}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              title="Öppna förhandsvisning – Intyg uppnådd baskompetens"
            >
              Intyg uppnådd BT
            </button>

            <button
              type="button"
              onClick={handlePreviewBtApplication}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              title="Öppna förhandsvisning – Ansökan om intyg om godkänd BT"
            >
              Ansökan om intyg om godkänd BT
            </button>
          </div>
        </footer>

      </div>



      {/* Sub-popups */}
      {pickerOpen && (
  <BtMilestonePicker
  open
  title="Välj BT-delmål"
  checked={new Set(btGoals.map((g) => g.id))}
  onToggle={(id: string) => {
    setBtGoals((prev) => {
      const has = prev.some((g) => g.id === id);
      return has
        ? prev.filter((g) => g.id !== id)
        : [...prev, { id, label: id }];
    });
    if (hydratedRef.current) updateDirty();

  }}
  onClose={() => setPickerOpen(false)}
/>

)}


         {chooserOpen && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/40 p-3">
          <div className="w-full max-w-[780px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="m-0 text-base font-extrabold">
                Välj bland registrerade
              </h3>
              <button
                onClick={() => setChooserOpen(false)}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              >
                Stäng
              </button>
            </header>
            <section className="max-h-[70vh] overflow-auto p-4">
              <div className="grid gap-2">
                {[...btPlacements]
                  .sort(
                    (a, b) =>
                      new Date((a as any).endDate || (a as any).startDate || 0).getTime() -
                      new Date((b as any).endDate || (b as any).startDate || 0).getTime()
                  )
                  .map((pl) => {
                    const goals: string[] =
                      Array.isArray((pl as any).btGoals) && (pl as any).btGoals.length
                        ? (pl as any).btGoals.map((g: any) => String(g))
                        : extractPlacementGoals(pl);

                    const chosen = !!chooserChecked[pl.id];
                    const include = !!chooserIncludeGoals[pl.id];

                    return (
                      <div
                        key={pl.id}
                        className="rounded-lg border border-slate-300 bg-white p-2"
                      >
                        {/* Rad 1: Titel + delmålschips (vänster) och kryssrutor (höger) */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold flex items-center gap-2 flex-wrap">
                              <span className="truncate">
                                {(pl as any).clinic || (pl as any).note || "Klinisk tjänstgöring"}
                              </span>
                              {goals.map((gid) => (
                                <span
                                  key={gid}
                                  className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] leading-4"
                                >
                                  {gid}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-4">
                            <label className="inline-flex items-center gap-2 text-[13px]">
                              <span>Välj aktivitet:</span>
                              <input
                                type="checkbox"
                                checked={chosen}
                                onChange={(e) => {
                                  const on = (e.currentTarget as HTMLInputElement).checked;
                                  setChooserChecked((st) => ({ ...st, [pl.id]: on }));
                                  setChooserIncludeGoals((st) => ({ ...st, [pl.id]: on })); // auto-följ
                                }}
                              />
                            </label>

                            <label className="inline-flex items-center gap-2 text-[13px]">
                              <span>Inkludera delmål i intyg</span>
                              <input
                                type="checkbox"
                                checked={include}
                                onChange={(e) => {
                                  const on = (e.currentTarget as HTMLInputElement).checked;
                                  setChooserIncludeGoals((st) => ({ ...st, [pl.id]: on }));
                                }}
                                disabled={!chosen}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Rad 2: Period under titeln */}
                        <div className="mt-1 text-[12px] text-slate-600">
                          {(pl.startDate || "").slice(0, 10)} – {(pl.endDate || pl.startDate || "").slice(0, 10)}
                        </div>
                      </div>
                    );
                  })}
              </div>

            </section>

            <footer className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                onClick={addRegisteredActivities}
                className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
              >
                Inkludera valda utbildningsaktiviteter
              </button>
            </footer>

          </div>
        </div>
      )}




      {intygModalOpen.mode && renderIntygModal()}

      {intygGoalsPicker.open && intygGoalsPicker.mode && (
  <BtMilestonePicker
    open
    title="Välj BT-delmål"
    checked={new Set(
      (
        (intygGoalsPicker.mode === "prelicense" ? prelicenseRows : foreignRows)
          .find((x) => x.id === intygGoalsPicker.rowId)?.intyg?.goals ?? []
      ).map((g) => g.id)
    )}
    onToggle={(id: string) => {
      const setRows =
        intygGoalsPicker.mode === "prelicense" ? setPrelicenseRows : setForeignRows;

      setRows((rows) =>
        rows.map((x) => {
          if (x.id !== intygGoalsPicker.rowId) return x;

          const existing = (x.intyg?.goals ?? []).map((g) => ({ ...g }));
          const has = existing.some((g) => g.id === id);
          const nextGoals = has
            ? existing.filter((g) => g.id !== id)
            : [...existing, { id, label: id }];

          return {
            ...x,
            intyg: {
              ...(x.intyg ?? defaultIntyg()),
              goals: nextGoals,
            },
          };
        })
      );
    }}
    onClose={() => setIntygGoalsPicker({ open: false, mode: null })}
  />
)}


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

    </div>
    </>
  );
}


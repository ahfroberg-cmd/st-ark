// components/PrepareBtModal.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import type { Profile, Placement, Course } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { fetchClinicContactsForUser } from "@/lib/clinicContacts";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import { BtGoalsTab } from "@/components/prepareBt/BtGoalsTab";
import { AttachmentsTab } from "@/components/prepareBt/AttachmentsTab";
import { BtCompetenceTab } from "@/components/prepareBt/BtCompetenceTab";
import { BtFullTab } from "@/components/prepareBt/BtFullTab";
import { BtPreviewActionFooter } from "@/components/prepareBt/BtPreviewActionFooter";
import { CertificatePreviewModal } from "@/components/prepareBt/CertificatePreviewModal";
import { IntygDetailsModal } from "@/components/prepareBt/IntygDetailsModal";
import { IntygGoalsPickerModal } from "@/components/prepareBt/IntygGoalsPickerModal";
import {
  normalizeAndSortAttachments,
} from "@/components/prepareBt/attachmentsUtils";
import {
  extractPlacementGoals,
  isoToday,
  makeId,
  monthDiffExact,
  pickPercent,
} from "@/components/prepareBt/modalHelpers";
import type {
  BtActivity,
  AttachKey,
  BtPlacementRow,
  Chip,
  ForeignOrPrelicenseRow,
  Props,
} from "@/components/prepareBt/modalTypes";
import {
  buildBtApplicationPreviewBlob,
  buildBtCompetencePreviewBlob,
  buildBtFullPreviewBlob,
  buildBtGoalsPreviewBlob,
  buildPlacementPreviewBlob,
  buildSavedBtPreviewBlob,
} from "@/components/prepareBt/previewBuilders";
import { RegisteredActivitiesChooserModal } from "@/components/prepareBt/RegisteredActivitiesChooserModal";


/** ========= Dependencies (popups) ========= */
const BtMilestonePicker = dynamic(
  () => import("@/components/BtMilestonePicker"),
  { ssr: false }
);



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

  const [resolvedMainSupervisor, setResolvedMainSupervisor] = useState<{
    name: string;
    specialty: string;
    workplace: string;
  }>({ name: "", specialty: "", workplace: "" });
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) return;
        const contacts = await fetchClinicContactsForUser(user.id);
        if (cancelled) return;
        setResolvedMainSupervisor({
          name: contacts.mainSupervisor?.name || "",
          specialty: contacts.mainSupervisor?.specialty || "",
          workplace: contacts.mainSupervisor?.workplace || contacts.clinicName || "",
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
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

  // — Handlers för knapparna längst ned —


  // 1) Intyg delmål i BT
  async function handlePreviewBtGoals() {
    try {
      if (!profile) {
        alert("Profil saknas – kan inte skapa intyget.");
        return;
      }
      const blob = await buildBtGoalsPreviewBlob({
        profile,
        btGoals,
        btActivities,
        btPlacements,
        controlHow,
        mainSupervisorPrints,
        issuingSupervisor,
        extractPlacementGoals,
      });

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
      const blob = await buildBtFullPreviewBlob({
        profile,
        btRows,
        otherThanManager,
        appointedSigner,
      });

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
      const blob = await buildBtCompetencePreviewBlob({
        profile,
        resolvedMainSupervisor,
      });

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
    const blob = await buildBtApplicationPreviewBlob({
      profile,
      attachments: attachments as string[],
    });

    openPreviewFromBlob(blob);
  } catch (e) {
    console.error(e);
    alert("Kunde inte skapa förhandsvisningen.");
  }
}

async function handlePreviewPlacementAttachment(placement: Placement) {
  try {
    if (!profile) {
      alert("Profil saknas – kan inte skapa intyget.");
      return;
    }
    const blob = await buildPlacementPreviewBlob({
      profile,
      placement,
      extractPlacementGoals,
    });
    openPreviewFromBlob(blob);
  } catch (e) {
    console.error(e);
    alert("Kunde inte skapa förhandsvisningen.");
  }
}

function handleEditSavedBtCert(key: string) {
  const saved = btSavedCerts[key];
  if (!saved) return;
  setBtGoals(structuredClone(saved.goals));
  setBtActivities(structuredClone(saved.activities));
  setControlHow(saved.controlHow || "");
  setMainSupervisorPrints(!!saved.signer?.useOther);
  setIssuingSupervisor({
    name: saved.signer?.name || "",
    specialty: saved.signer?.specialty || "",
    workplace: saved.signer?.workplace || "",
  });
  setEditingSavedKey(key);
  setTab("btgoals");
}

async function handlePreviewSavedBtCert(key: string) {
  try {
    if (!profile) {
      alert("Profil saknas – kan inte skapa intyget.");
      return;
    }
    const saved = btSavedCerts[key];
    if (!saved) return;
    const blob = await buildSavedBtPreviewBlob({
      profile,
      saved,
    });
    openPreviewFromBlob(blob);
  } catch (e) {
    console.error(e);
    alert("Kunde inte skapa förhandsvisningen.");
  }
}

async function handleDeleteSavedBtCert(key: string) {
  const go = window.confirm("Vill du verkligen ta bort intyget?");
  if (!go) return;

  const next = { ...btSavedCerts };
  delete next[key];
  setBtSavedCerts(next);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase.from("app_drafts").upsert(
        {
          user_id: user.id,
          draft_key: "bt_saved_certs",
          draft_data: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,draft_key" }
      );
    }
  } catch (e) {
    console.error("Kunde inte spara btSavedCerts:", e);
  }

  setAttachments((list) => list.filter((x) => String(x) !== key));
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
      const [p, pls, cs, ach] = await (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) return [null, [], [], []] as [any, any[], any[], any[]];

        const [profileRes, placementsRes, coursesRes, achievementsRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase.from("placements").select("*").eq("user_id", user.id),
          supabase.from("courses").select("*").eq("user_id", user.id),
          supabase.from("achievements").select("*").eq("user_id", user.id),
        ]);

        const profileRow: any = profileRes.data || null;
        const mappedProfile: any = profileRow
          ? {
              ...profileRow,
              goalsVersion: profileRow.goals_version ?? profileRow.goalsVersion ?? "",
              personalNumber: profileRow.personal_number ?? profileRow.personalNumber ?? "",
              homeClinic: profileRow.home_clinic ?? profileRow.homeClinic ?? "",
              specialty: profileRow.specialty ?? profileRow.speciality ?? "",
            }
          : null;

        const mappedPlacements = ((placementsRes.data || []) as any[]).map((row) => ({
          ...row,
          startDate: row.start_date ?? row.startDate ?? "",
          endDate: row.end_date ?? row.endDate ?? "",
          showOnTimeline: row.show_on_timeline ?? row.showOnTimeline ?? true,
          fulfillsStGoals: row.fulfills_st_goals ?? row.fulfillsStGoals ?? false,
        }));

        const mappedCourses = ((coursesRes.data || []) as any[]).map((row) => ({
          ...row,
          title: row.title ?? row.course_title ?? "",
          startDate: row.start_date ?? row.startDate ?? "",
          endDate: row.end_date ?? row.endDate ?? "",
          certificateDate: row.certificate_date ?? row.certificateDate ?? "",
          showOnTimeline: row.show_on_timeline ?? row.showOnTimeline ?? true,
          fulfillsStGoals: row.fulfills_st_goals ?? row.fulfillsStGoals ?? false,
        }));

        const mappedAchievements = (achievementsRes.data || []) as any[];
        return [mappedProfile, mappedPlacements, mappedCourses, mappedAchievements] as const;
      })();

      setProfile(p ?? null);
      setPlacements(pls);
      // Ladda sparade "Intyg delmål i BT" från Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: draftRow } = await supabase
            .from("app_drafts")
            .select("draft_data")
            .eq("user_id", user.id)
            .eq("draft_key", "bt_saved_certs")
            .maybeSingle();
          if (draftRow?.draft_data) {
            setBtSavedCerts(draftRow.draft_data as typeof btSavedCerts);
          } else {
            setBtSavedCerts(((p as any)?.btSavedCerts ?? {}) as typeof btSavedCerts);
          }
        } else {
          setBtSavedCerts(((p as any)?.btSavedCerts ?? {}) as typeof btSavedCerts);
        }
      } catch {
        setBtSavedCerts(((p as any)?.btSavedCerts ?? {}) as typeof btSavedCerts);
      }


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
        const full = pls.find((x: any) => x.id === pl.id) as any;

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
          btGoals: Array.from(btGoalMap[String((c as any)?.id ?? "")] ?? []),
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
        return normalizeAndSortAttachments([...base, ...labels], btPlacements);
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


  /** ====== Ordna bilagor (drag & drop – samma interaktion/estetik som PrepareApplicationModal) ====== */
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
      return on ? [...filtered, label as AttachKey] : filtered;
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
      if (!enabled) return normalizeAndSortAttachments(base as string[], btPlacements) as AttachKey[];
      const extras = Array.from({ length: Math.max(1, count) }, (_, i) => `Intyg tjänstgöring före legitimation ${i + 1}`);
      return normalizeAndSortAttachments([...(base as string[]), ...extras], btPlacements) as AttachKey[];
    });
  }

  async function handleSaveBtGoalsAsAttachment() {
    const prefix = "Delmål i bastjänstgöringen: Intyg delmål i BT ";

    const isEditingExisting =
      !!editingSavedKey && Object.prototype.hasOwnProperty.call(btSavedCerts, editingSavedKey as string);

    let key: AttachKey;
    let title: string;

    if (isEditingExisting) {
      key = editingSavedKey as AttachKey;
      title = String(editingSavedKey);
    } else {
      const existingNumbers = Object.keys(btSavedCerts)
        .filter((k) => k.startsWith(prefix))
        .map((k) => Number(k.slice(prefix.length)) || 0);
      const nextNo = (existingNumbers.length ? Math.max(...existingNumbers) : 0) + 1;
      title = `Intyg delmål i BT ${nextNo}`;
      key = `${prefix}${nextNo}` as AttachKey;
    }

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

    const newMap = {
      ...btSavedCerts,
      [key]: updatedValue,
    };

    setBtSavedCerts(newMap);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase.from("app_drafts").upsert(
          {
            user_id: user.id,
            draft_key: "bt_saved_certs",
            draft_data: newMap,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,draft_key" }
        );
      }
    } catch (e) {
      console.error("Kunde inte spara btSavedCerts:", e);
    }

    setAttachments((prev) =>
      normalizeAndSortAttachments([
        ...prev.filter((x) => String(x) !== String(key)),
        key as AttachKey,
      ], btPlacements)
    );

    alert(isEditingExisting ? `Uppdaterade "${title}"` : `Sparat som "${title}"`);
    updateDirty();
  }

  function handleClearBtGoalsForm() {
    setBtActivities([]);
    setBtGoals([]);
    setControlHow("");
    setMainSupervisorPrints(false);
    setIssuingSupervisor({ name: "", specialty: "", workplace: "" });
    setEditingSavedKey(null);
    if (readyRef.current) updateDirty();
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
      data-info="Sparar alla ändringar i BT-intyget till databasen. Detta inkluderar alla fält som du har fyllt i på alla flikar (Delmål i BT, Fullgjord BT, Uppnådd BT, Ordna bilagor). Knappen är endast aktiv när det finns osparade ändringar. Efter att du har sparat kan du stänga fönstret utan att förlora dina ändringar."
    >
      Spara
    </button>
    <button
      onClick={handleRequestClose}
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
      title="Stäng – varnar om osparade ändringar"
      data-info="Stänger BT-intygsfönstret. Om du har osparade ändringar kommer du att få en varning och möjlighet att spara innan du stänger. Om du redan har sparat dina ändringar stängs fönstret direkt."
    >
      Stäng
    </button>
  </div>
</header>


        {/* Tabs (match PrepareApplicationModal) */}
        <nav className="flex gap-1 border-b bg-slate-50 px-2 pt-2">
          {[
            { id: "btgoals", label: "Skapa intyg: Delmål i BT", info: "Här kan du skapa intyg för delmål i bastjänstgöringen (BT). Du väljer vilka BT-tjänstgöringar som ska inkluderas och vilka BT-delmål som uppfyllts. Intyget kan sedan användas i ansökan om specialistkompetens." },
            { id: "btfull", label: "Fullgjord BT", info: "Här kan du skapa intyg för fullgjord bastjänstgöring. Detta intyg bekräftar att du har genomfört hela bastjänstgöringen enligt kraven." },
            { id: "competence", label: "Uppnådd BT", info: "Här kan du skapa intyg för uppnådd kompetens i bastjänstgöringen. Detta intyg bekräftar att du har uppnått de kompetenser som krävs för bastjänstgöringen." },
            { id: "attachments", label: "Ordna bilagor", info: "Här kan du se alla bilagor som ska inkluderas i Ansökan om intyg om godkänd BT och ändra deras ordning genom att dra och släppa. Du kan också lägga till eller ta bort bilagor som ska inkluderas." },
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

            {/* Body */}
        <section
  className="max-h-[75vh] overflow-auto p-4"
>




                    {/* 2) Delmål i BT */}
          {tab === "btgoals" && (
            <BtGoalsTab
              btActivities={btActivities}
              setBtActivities={setBtActivities}
              setChooserOpen={setChooserOpen}
              addEmptyActivityRow={addEmptyActivityRow}
              setChooserChecked={setChooserChecked}
              setChooserIncludeGoals={setChooserIncludeGoals}
              setPickerOpen={setPickerOpen}
              btGoals={btGoals}
              setBtGoals={setBtGoals}
              controlHow={controlHow}
              setControlHow={setControlHow}
              mainSupervisorPrints={mainSupervisorPrints}
              setMainSupervisorPrints={setMainSupervisorPrints}
              issuingSupervisor={issuingSupervisor}
              setIssuingSupervisor={setIssuingSupervisor}
              editingSavedKey={editingSavedKey}
              onSaveAsAttachment={handleSaveBtGoalsAsAttachment}
              onClearForm={handleClearBtGoalsForm}
              onPreview={handlePreviewBtGoals}
            />
          )}



          {/* 3) Intyg om fullgjord BT */}
          {tab === "btfull" && (
            <BtFullTab
              btRows={btRows}
              setBtRows={setBtRows}
              updateDirty={updateDirty}
              otherThanManager={otherThanManager}
              setOtherThanManager={setOtherThanManager}
              appointedSigner={appointedSigner}
              setAppointedSigner={setAppointedSigner}
            />
          )}

               {/* 4) Uppnådd baskompetens */}
          {tab === "competence" && (
            <BtCompetenceTab
              profile={profile}
              setProfile={setProfile}
              setDirty={setDirty}
            />
          )}




                    {/* 5) Ordna bilagor */}
                    {tab === "attachments" && (
                      <AttachmentsTab
                        tempOrder={tempOrder}
                        dragActive={dragActive}
                        dragIndex={dragIndex}
                        listRef={listRef}
                        rowRefs={rowRefs}
                        onPointerMoveList={onPointerMoveList}
                        onPointerUpList={onPointerUpList}
                        onPointerDownCard={onPointerDownCard}
                        btPlacements={btPlacements}
                        btAttachChecked={btAttachChecked}
                        setBtAttachChecked={setBtAttachChecked}
                        attachments={attachments}
                        setAttachments={setAttachments}
                        btSavedCerts={btSavedCerts}
                        onEditSavedCert={handleEditSavedBtCert}
                        onPreviewSavedCert={handlePreviewSavedBtCert}
                        onDeleteSavedCert={handleDeleteSavedBtCert}
                        onPreviewPlacement={handlePreviewPlacementAttachment}
                        prelicenseEnabled={prelicenseEnabled}
                        setPrelicenseEnabled={setPrelicenseEnabled}
                        prelicenseCount={prelicenseCount}
                        prelicenseCountDraft={prelicenseCountDraft}
                        setPrelicenseCountDraft={setPrelicenseCountDraft}
                        setPrelicenseCount={setPrelicenseCount}
                        setPrelicenseRows={setPrelicenseRows}
                        syncPrelicenseAttachments={syncPrelicenseAttachments}
                        foreignEnabled={foreignEnabled}
                        setForeignEnabled={setForeignEnabled}
                        foreignRows={foreignRows}
                        setForeignRows={setForeignRows}
                        makeId={makeId}
                      />
                    )}



        </section>

        {/* Undermeny för intyg – alltid synlig oavsett flik */}
        <BtPreviewActionFooter
          onPreviewBtFull={handlePreviewBtFull}
          onPreviewBtCompetence={handlePreviewBtCompetence}
          onPreviewBtApplication={handlePreviewBtApplication}
        />

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
    if (readyRef.current) updateDirty();

  }}
  onClose={() => setPickerOpen(false)}
/>

)}


      <RegisteredActivitiesChooserModal
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onConfirm={addRegisteredActivities}
        btPlacements={btPlacements as any[]}
        chooserChecked={chooserChecked}
        chooserIncludeGoals={chooserIncludeGoals}
        setChooserChecked={setChooserChecked}
        setChooserIncludeGoals={setChooserIncludeGoals}
        extractPlacementGoals={extractPlacementGoals}
      />




      <IntygDetailsModal
        state={intygModalOpen}
        prelicenseRows={prelicenseRows}
        foreignRows={foreignRows}
        setPrelicenseRows={setPrelicenseRows}
        setForeignRows={setForeignRows}
        defaultIntyg={defaultIntyg}
        updateDirty={updateDirty}
        onClose={() => setIntygModalOpen({ mode: null })}
        setIntygGoalsPicker={setIntygGoalsPicker}
      />

      <IntygGoalsPickerModal
        picker={intygGoalsPicker}
        prelicenseRows={prelicenseRows}
        foreignRows={foreignRows}
        setPrelicenseRows={setPrelicenseRows}
        setForeignRows={setForeignRows}
        defaultIntyg={defaultIntyg}
        onClose={() => setIntygGoalsPicker({ open: false, mode: null })}
      />


      {/* Förhandsvisning (PDF) */}
      <CertificatePreviewModal
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


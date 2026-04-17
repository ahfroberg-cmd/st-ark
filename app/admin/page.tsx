// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  deleteClinicMembershipRow,
  deleteClinicRow,
  reassignClinicMembersToOtherClinic,
  fetchProfileRoleById,
  findInvitationIdByEmailAndClinic,
  insertClinicMembershipRow,
  insertClinicRow,
  insertInvitationRow,
  updateClinicRowForAdmin,
  listClinicMembershipsWithProfiles,
  listClinicsForAdmin,
  listHospitalsForAdmin,
  listProfilesForAdminPicker,
  syncStandardHospitalsMissing,
  updateProfileRoleForUser,
  fetchProfileById,
} from "@/lib/repositories/starkRepository";
import ProfileContactDetailModal, {
  type ProfileContactDetailFields,
} from "@/components/ProfileContactDetailModal";
import LogoutConfirmDialog from "@/components/LogoutConfirmDialog";
import ClinicDetailModal, { type DeleteClinicPlan } from "@/components/admin/ClinicDetailModal";
import {
  groupClinicsByRegionAndFacility,
  groupSjukhusClinicsByHospital,
  hospitalsForModalSelectGrouped,
  hospitalsForSelectGrouped,
  type AdminClinicRow,
} from "@/lib/admin/groupClinicsByHospital";
import { clinicsForHospitalSeed } from "@/lib/data/swedishHospitalClinicsSeed";

type Clinic = AdminClinicRow;

type Hospital = { id: string; name: string; region: string; facility_type?: string | null };

function isSjukhusRow(h: Hospital | undefined): boolean {
  return !!h && String(h.facility_type || "") !== "vardcentral";
}

function normalizeClinicFromApi(raw: Record<string, unknown>): Clinic {
  const h = raw.hospitals;
  const hospitals =
    Array.isArray(h) ? ((h[0] as Clinic["hospitals"]) ?? null) : ((h as Clinic["hospitals"]) ?? null);
  return { ...(raw as unknown as Clinic), hospitals };
}

type Membership = {
  id: string;
  clinic_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles?: { id?: string; name?: string; role?: string };
};

type UserProfile = {
  id: string;
  name?: string;
  role: string;
};

/** Unik nyckel för expanderat sjukhus inom en region (admin-lista). */
function sjukhusExpandStorageKey(region: string, hospitalKey: string) {
  return `${region}::${hospitalKey}`;
}

/** Nyckel för ”Ej kopplade till klinik”-rutan under Användare. */
const EJ_KOPPLADE_ANVANDARE_SECTION_KEY = "__ej_kopplade__";

function AnvandareSectionChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200/90 bg-white text-slate-500 transition-transform duration-150 ${
        expanded ? "rotate-90" : ""
      }`}
      aria-hidden
    >
      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

/** Svensk etikett för profilroll (DB kan ha flera alias). */
function adminProfileRoleLabel(role: string): string {
  const r = String(role || "").toLowerCase().trim();
  if (r === "superadmin") return "Superadmin";
  if (r === "studierektor" || r === "study_director") return "Studierektor";
  if (
    r === "huvudhandledare" ||
    r === "supervisor" ||
    r === "handledare" ||
    r === "main_supervisor"
  ) {
    return "Huvudhandledare";
  }
  if (r === "st_lakare" || r === "st_läkare" || r === "st-lakare") return "ST-läkare";
  return role?.trim() || "—";
}

function adminRoleBadgeClass(role: string): string {
  const r = String(role || "").toLowerCase().trim();
  if (r === "superadmin") return "bg-amber-100 text-amber-800";
  if (r === "studierektor" || r === "study_director") return "bg-purple-100 text-purple-700";
  if (
    r === "huvudhandledare" ||
    r === "supervisor" ||
    r === "handledare" ||
    r === "main_supervisor"
  ) {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-sky-100 text-sky-700";
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [detailClinic, setDetailClinic] = useState<Clinic | null>(null);
  const [expandedSjukhusKeys, setExpandedSjukhusKeys] = useState<Set<string>>(new Set());
  const [collapsedAnvandareSections, setCollapsedAnvandareSections] = useState<Set<string>>(
    () => new Set()
  );
  const [anvandareSearch, setAnvandareSearch] = useState("");

  const toggleAnvandareSection = useCallback((sectionKey: string) => {
    setCollapsedAnvandareSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }, []);

  // Form state — registrera klinik (ingen fritext för vårdcentral; klinik väljs ur seed vid sjukhus)
  const [newClinicFacilityType, setNewClinicFacilityType] = useState<"sjukhus" | "vardcentral">("sjukhus");
  const [newClinicHospitalId, setNewClinicHospitalId] = useState("");
  const [newClinicPickName, setNewClinicPickName] = useState("");
  const [newClinicFallbackName, setNewClinicFallbackName] = useState("");
  const [assignClinicId, setAssignClinicId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRole, setAssignRole] = useState<"studierektor" | "huvudhandledare" | "st_lakare">("studierektor");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteClinicId, setInviteClinicId] = useState("");
  const [inviteRole, setInviteRole] = useState<"studierektor" | "huvudhandledare" | "st_lakare">("studierektor");
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [unlinkedContactOpen, setUnlinkedContactOpen] = useState<{
    userId: string;
    fallbackName: string;
  } | null>(null);
  const [unlinkedContactProfile, setUnlinkedContactProfile] = useState<ProfileContactDetailFields>(null);
  const [unlinkedContactLoading, setUnlinkedContactLoading] = useState(false);

  const showFeedback = useCallback((type: "ok" | "err", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  useEffect(() => {
    setNewClinicHospitalId("");
    setNewClinicPickName("");
    setNewClinicFallbackName("");
  }, [newClinicFacilityType]);

  useEffect(() => {
    if (!unlinkedContactOpen?.userId) {
      setUnlinkedContactProfile(null);
      return;
    }
    let cancelled = false;
    setUnlinkedContactLoading(true);
    void (async () => {
      try {
        const { data, error } = await fetchProfileById(unlinkedContactOpen.userId);
        if (error) throw error;
        if (!cancelled) setUnlinkedContactProfile(data || null);
      } catch {
        if (!cancelled) setUnlinkedContactProfile(null);
      } finally {
        if (!cancelled) setUnlinkedContactLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlinkedContactOpen]);

  const loadData = useCallback(async () => {
    const { data: clinicData, error: clinicErr } = await listClinicsForAdmin();
    if (clinicErr) {
      console.error("Admin: clinics load failed", clinicErr);
    }
    setClinics((clinicData || []).map((row) => normalizeClinicFromApi(row as Record<string, unknown>)));

    let { data: hospData, error: hospErr } = await listHospitalsForAdmin();
    if (hospErr) {
      console.error("Admin: hospitals load failed", hospErr);
      showFeedback(
        "err",
        `Kunde inte läsa vårdenheter: ${hospErr.message}. Kontrollera att hospitals_schema.sql är körd och att tabellen har SELECT för authenticated.`
      );
    } else {
      const { inserted, error: syncErr } = await syncStandardHospitalsMissing();
      if (syncErr) {
        console.error("Admin: standardlist sync failed", syncErr);
        showFeedback(
          "err",
          `Kunde inte synka standardlistor (sjukhus/vårdcentraler): ${syncErr.message}. Kontrollera RLS för superadmin och att \`hospitals_add_facility_type.sql\` är körd.`
        );
      } else if (inserted > 0) {
        showFeedback("ok", `La till ${inserted} saknade poster från standardlistorna.`);
      }
      const refresh = await listHospitalsForAdmin();
      if (refresh.error) {
        console.error("Admin: hospitals reload after sync failed", refresh.error);
      } else {
        hospData = refresh.data;
      }
    }
    setHospitals((hospData || []) as Hospital[]);

    const { data: memberData, error: memberErr } = await listClinicMembershipsWithProfiles();
    if (memberErr) {
      console.error("Admin: clinic memberships load failed", memberErr);
    }
    setMemberships(memberData || []);

    const { data: userData } = await listProfilesForAdminPicker();
    setUsers(userData || []);
  }, [showFeedback]);

  useEffect(() => {
    let mounted = true;
    let handled = false;

    const initAdmin = async (userId: string) => {
      const { data: profile, error: profileError } = await fetchProfileRoleById(userId);

      if (!mounted) return;

      if (profileError) {
        console.error("Error loading admin profile:", profileError);
        setAuthStatus(`Kunde inte läsa adminprofil: ${profileError.message}`);
        setLoading(false);
        return;
      }

      if (!profile) {
        setAuthStatus("Ingen profil hittades för den inloggade användaren.");
        setAuthorized(false);
        setLoading(false);
        return;
      }

      if (profile.role !== "superadmin") {
        setAuthStatus(`Användaren är inloggad men har rollen '${profile.role}', inte superadmin.`);
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthStatus(null);
      setAuthorized(true);
      setLoading(false);
      void loadData().catch((e) => {
        console.error("Error loading admin data:", e);
      });
    };

    const handleSession = async (session: any) => {
      if (handled) return;

      try {
        const userId = session?.user?.id;
        if (!userId) {
          try {
            const accessToken = sessionStorage.getItem("temp_access_token");
            const refreshToken = sessionStorage.getItem("temp_refresh_token");

            if (accessToken && refreshToken) {
              const { data: restoredData, error: restoredError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });

              if (!restoredError && restoredData.session?.user?.id) {
                handled = true;
                sessionStorage.removeItem("temp_access_token");
                sessionStorage.removeItem("temp_refresh_token");
                await initAdmin(restoredData.session.user.id);
                return;
              }
            }
          } catch {}

          handled = true;
          if (mounted) {
            setAuthStatus("Ingen aktiv session hittades på admin-sidan.");
            setLoading(false);
          }
          return;
        }

        handled = true;
        await initAdmin(userId);
      } catch (e: any) {
        console.error("Admin session handling failed:", e);
        if (mounted) {
          setAuthorized(false);
          setAuthStatus(e?.message || "Kunde inte initiera adminsession.");
          setLoading(false);
        }
      }
    };

    // INITIAL_SESSION fires once the client has finished reading localStorage.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        // Avoid awaiting Supabase queries inside auth callback lock.
        setTimeout(() => {
          void handleSession(session);
        }, 0);
      } else if (event === "SIGNED_OUT") {
        setAuthorized(false);
        setAuthStatus("Sessionen avslutades. Logga in igen.");
        setLoading(false);
      }
    });

    // Fallback: if INITIAL_SESSION already fired before our subscription,
    // check the session directly after a tick.
    const fallbackTimer = setTimeout(async () => {
      if (!mounted || handled) return;
      const { data } = await supabase.auth.getSession();
      if (!mounted || handled) return;
      await handleSession(data.session);
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [loadData]);

  const createClinic = async () => {
    if (!newClinicHospitalId) {
      showFeedback(
        "err",
        newClinicFacilityType === "vardcentral"
          ? "Välj vårdcentral i listan."
          : "Välj sjukhus i listan."
      );
      return;
    }
    const hRow = hospitals.find((h) => h.id === newClinicHospitalId);
    let clinicName = "";
    if (newClinicFacilityType === "vardcentral") {
      clinicName = String(hRow?.name || "").trim();
    } else {
      const seedList = hRow
        ? clinicsForHospitalSeed(String(hRow.region || ""), String(hRow.name || ""))
        : [];
      if (seedList.length > 0) {
        clinicName = newClinicPickName.trim();
        if (!clinicName) {
          showFeedback("err", "Välj klinik i listan.");
          return;
        }
      } else {
        clinicName = newClinicFallbackName.trim();
        if (!clinicName) {
          showFeedback(
            "err",
            "Ingen fördefinierad kliniklista för detta sjukhus — ange kliniknamn i fältet under."
          );
          return;
        }
      }
    }
    if (!clinicName) {
      showFeedback("err", "Kunde inte bestämma kliniknamn.");
      return;
    }
    const { error } = await insertClinicRow({
      name: clinicName,
      hospital_id: newClinicHospitalId,
    });
    if (error) {
      showFeedback("err", `Kunde inte skapa klinik: ${error.message}`);
    } else {
      showFeedback("ok", `Klinik "${clinicName}" skapad!`);
      setNewClinicHospitalId("");
      setNewClinicPickName("");
      setNewClinicFallbackName("");
      await loadData();
    }
  };

  const handleDeleteClinicPlan = async (plan: DeleteClinicPlan): Promise<boolean> => {
    if (!detailClinic) return false;
    const clinicId = detailClinic.id;
    const clinicName = detailClinic.name;
    const members = memberships.filter((m) => m.clinic_id === clinicId);

    if (plan.mode === "no_members" && members.length > 0) {
      showFeedback("err", "Kliniken har medlemmar — välj flytt eller koppla loss.");
      return false;
    }

    if (plan.mode === "move") {
      if (!plan.targetClinicId) {
        showFeedback("err", "Välj målklinik.");
        return false;
      }
      const { error: moveErr } = await reassignClinicMembersToOtherClinic(plan.targetClinicId, members.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
      })));
      if (moveErr) {
        showFeedback("err", `Kunde inte flytta medlemmar: ${moveErr.message}`);
        return false;
      }
    }

    const { error } = await deleteClinicRow(clinicId);
    if (error) {
      showFeedback("err", `Kunde inte ta bort klinik: ${error.message}`);
      return false;
    }

    showFeedback(
      "ok",
      plan.mode === "move"
        ? `Kliniken "${clinicName}" är borttagen och medlemmarna är flyttade.`
        : plan.mode === "unassign"
          ? `Kliniken "${clinicName}" är borttagen. Medlemmarna är inte längre kopplade till någon klinik.`
          : `Kliniken "${clinicName}" är borttagen.`
    );
    setDetailClinic(null);
    await loadData();
    return true;
  };

  const assignMember = async () => {
    if (!assignClinicId || !assignUserId) return;
    const { error } = await insertClinicMembershipRow({
      clinic_id: assignClinicId,
      user_id: assignUserId,
      role: assignRole,
    });
    if (error) {
      showFeedback("err", error.message.includes("duplicate")
        ? "Användaren är redan kopplad till den kliniken."
        : `Fel: ${error.message}`);
    } else {
      showFeedback("ok", "Medlem tillagd!");
      setAssignUserId("");
      await loadData();
    }
  };

  const removeMember = async (membershipId: string) => {
    const { error } = await deleteClinicMembershipRow(membershipId);
    if (error) {
      showFeedback("err", `Kunde inte ta bort: ${error.message}`);
    } else {
      await loadData();
    }
  };

  const saveClinicFromDetailModal = useCallback(
    async (name: string, hospitalId: string | null) => {
      const id = detailClinic?.id;
      if (!id) return;
      const { data, error } = await updateClinicRowForAdmin(id, {
        name,
        hospital_id: hospitalId,
      });
      if (error) {
        showFeedback("err", `Kunde inte spara klinik: ${error.message}`);
        return;
      }
      if (data) {
        setDetailClinic(normalizeClinicFromApi(data as Record<string, unknown>));
      }
      showFeedback("ok", "Klinik uppdaterad.");
      await loadData();
    },
    [detailClinic?.id, loadData, showFeedback]
  );

  const setUserRole = async (userId: string, role: string) => {
    const { error } = await updateProfileRoleForUser(userId, role);
    if (error) {
      showFeedback("err", `Kunde inte ändra roll: ${error.message}`);
    } else {
      showFeedback("ok", "Roll uppdaterad!");
      await loadData();
    }
  };

  const sendInvitation = async () => {
    if (!inviteEmail.trim() || !inviteClinicId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Generate unique token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invitation
    const { error: inviteError } = await insertInvitationRow({
      clinic_id: inviteClinicId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      token,
      expires_at: expiresAt.toISOString(),
      status: "pending",
      invited_by: user.id,
    });

    if (inviteError) {
      showFeedback("err", `Kunde inte skapa inbjudan: ${inviteError.message}`);
      return;
    }

    // Create invitation link
    const inviteLink = `${window.location.origin}/accept-invite?token=${token}`;

    // Check if user with this email has already been invited
    const { data: existingInvite } = await findInvitationIdByEmailAndClinic(
      inviteEmail.trim().toLowerCase(),
      inviteClinicId
    );
    
    const existingUser = existingInvite ? true : false;

    const clinic = clinics.find(c => c.id === inviteClinicId);
    const roleText = inviteRole === "studierektor" ? "Studierektor" 
      : inviteRole === "huvudhandledare" ? "Huvudhandledare" 
      : "ST-läkare";

    // Send email via internal Next API route
    try {
      const response = await fetch(`/api/send-invitation-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          clinicName: clinic?.name || "kliniken",
          role: inviteRole,
          inviteLink,
          existingUser: !!existingUser,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Email send error:', error);
        showFeedback("err", `Inbjudan skapad men email kunde inte skickas: ${error.error || 'Okänt fel'}`);
        return;
      }

      showFeedback("ok", `Inbjudan skickad via email till ${inviteEmail} som ${roleText} till ${clinic?.name || "kliniken"}!`);
      setInviteEmail("");
      setInviteClinicId("");
    } catch (error) {
      console.error('Error sending email:', error);
      showFeedback("err", `Inbjudan skapad men email kunde inte skickas. Kontrollera att Edge Function är konfigurerad.`);
    }
  };

  const displayName = (p: any) =>
    p?.name || "(inget namn)";

  const clinicsByRegion = useMemo(() => {
    const q = anvandareSearch.trim().toLowerCase();
    const list =
      q.length === 0
        ? clinics
        : clinics.filter((c) => {
            const name = String(c.name || "").toLowerCase();
            const hosp = String(c.hospitals?.name || "").toLowerCase();
            const region = String(c.hospitals?.region || "").toLowerCase();
            return name.includes(q) || hosp.includes(q) || region.includes(q);
          });
    return groupClinicsByRegionAndFacility(list);
  }, [clinics, anvandareSearch]);

  useEffect(() => {
    const q = anvandareSearch.trim();
    if (!q) return;
    setExpandedSjukhusKeys((prev) => {
      const next = new Set(prev);
      for (const block of clinicsByRegion) {
        for (const g of groupSjukhusClinicsByHospital(block.sjukhus)) {
          next.add(sjukhusExpandStorageKey(block.region, g.key));
        }
      }
      return next;
    });
  }, [anvandareSearch, clinicsByRegion]);
  const hospitalSelectGroupsForRegister = useMemo(
    () => hospitalsForSelectGrouped(hospitals, { facilityType: newClinicFacilityType }),
    [hospitals, newClinicFacilityType]
  );
  const hospitalSelectGroupsForModal = useMemo(
    () => hospitalsForModalSelectGrouped(hospitals),
    [hospitals]
  );

  const selectedRegisterHospital = useMemo(
    () => hospitals.find((h) => h.id === newClinicHospitalId),
    [hospitals, newClinicHospitalId]
  );

  const clinicOptionsForSelectedSjukhus = useMemo(() => {
    if (newClinicFacilityType !== "sjukhus" || !selectedRegisterHospital) return [];
    if (!isSjukhusRow(selectedRegisterHospital)) return [];
    return clinicsForHospitalSeed(
      String(selectedRegisterHospital.region || ""),
      String(selectedRegisterHospital.name || "")
    );
  }, [newClinicFacilityType, selectedRegisterHospital]);

  const clinicOptionLabel = (c: Clinic) =>
    c.hospitals?.name ? `${c.name} (${c.hospitals.name})` : c.name;

  const detailMemberships = useMemo(() => {
    if (!detailClinic) return [];
    return memberships.filter((m) => m.clinic_id === detailClinic.id);
  }, [detailClinic, memberships]);

  const clinicsForMoveInModal = useMemo(() => {
    if (!detailClinic) return [];
    return clinics
      .filter((c) => c.id !== detailClinic.id)
      .map((c) => ({
        id: c.id,
        label: c.hospitals?.name ? `${c.name} (${c.hospitals.name})` : c.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "sv", { sensitivity: "base" }));
  }, [clinics, detailClinic?.id]);

  const usersWithoutClinic = useMemo(() => {
    const withClinic = new Set(memberships.map((m) => m.user_id));
    return users.filter((u) => u.role !== "superadmin" && !withClinic.has(u.id));
  }, [users, memberships]);

  const ejKoppladeAnvandareOpen = !collapsedAnvandareSections.has(EJ_KOPPLADE_ANVANDARE_SECTION_KEY);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">Laddar...</div>;
  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Admin kunde inte öppnas</h1>
          <p className="mt-3 text-sm text-slate-600">{authStatus || "Okänd auth-status."}</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => router.push('/auth')}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Gå till login
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Ladda om
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-dvh max-h-dvh flex-col bg-slate-50">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y">
          <div className="p-4 md:p-8">
            <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Superadmin</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLogoutConfirmOpen(true)}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Logga ut
            </button>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === "ok" ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {feedback.msg}
          </div>
        )}

        {/* Skapa klinik */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Registrera ny klinik</h2>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-[min(100%,200px)] shrink-0">
              <label className="mb-1 block text-xs font-medium text-slate-600">Typ *</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={newClinicFacilityType}
                onChange={(e) =>
                  setNewClinicFacilityType(e.target.value === "vardcentral" ? "vardcentral" : "sjukhus")
                }
              >
                <option value="sjukhus">Sjukhus</option>
                <option value="vardcentral">Vårdcentral</option>
              </select>
            </div>
            {newClinicFacilityType === "vardcentral" ? (
              <div className="min-w-[min(100%,280px)] flex-1 lg:max-w-xl">
                <label className="mb-1 block text-xs font-medium text-slate-600">Vårdcentraler *</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={newClinicHospitalId}
                  onChange={(e) => setNewClinicHospitalId(e.target.value)}
                >
                  <option value="">Välj vårdcentral i listan…</option>
                  {hospitalSelectGroupsForRegister.map(({ label, items }) => (
                    <optgroup key={label} label={label}>
                      {items.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Kliniken skapas med samma namn som den valda vårdcentralen.
                </p>
              </div>
            ) : (
              <>
                <div className="min-w-[min(100%,260px)] flex-1 lg:max-w-md">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Sjukhus *</label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={newClinicHospitalId}
                    onChange={(e) => {
                      setNewClinicHospitalId(e.target.value);
                      setNewClinicPickName("");
                      setNewClinicFallbackName("");
                    }}
                  >
                    <option value="">Välj sjukhus…</option>
                    {hospitalSelectGroupsForRegister.map(({ label, items }) => (
                      <optgroup key={label} label={label}>
                        {items.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {newClinicHospitalId && isSjukhusRow(selectedRegisterHospital) ? (
                  clinicOptionsForSelectedSjukhus.length > 0 ? (
                    <div className="min-w-[min(100%,260px)] flex-1 lg:max-w-md">
                      <label className="mb-1 block text-xs font-medium text-slate-600">Klinik *</label>
                      <select
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={newClinicPickName}
                        onChange={(e) => setNewClinicPickName(e.target.value)}
                      >
                        <option value="">Välj klinik…</option>
                        {clinicOptionsForSelectedSjukhus.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="min-w-[min(100%,260px)] flex-1 lg:max-w-md">
                      <label className="mb-1 block text-xs font-medium text-slate-600">Klinik *</label>
                      <input
                        type="text"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="Ingen lista i seed — ange kliniknamn"
                        value={newClinicFallbackName}
                        onChange={(e) => setNewClinicFallbackName(e.target.value)}
                      />
                      <p className="mt-1 text-[11px] text-amber-800">
                        Detta sjukhus saknas i <code className="rounded bg-slate-100 px-1">swedishHospitalClinicsSeed.ts</code>
                        — komplettera seed eller skriv namn här.
                      </p>
                    </div>
                  )
                ) : null}
              </>
            )}
            <button
              type="button"
              onClick={() => void createClinic()}
              disabled={
                !newClinicHospitalId ||
                (newClinicFacilityType === "sjukhus" &&
                  !!newClinicHospitalId &&
                  isSjukhusRow(selectedRegisterHospital) &&
                  (clinicOptionsForSelectedSjukhus.length > 0
                    ? !newClinicPickName.trim()
                    : !newClinicFallbackName.trim()))
              }
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
            >
              Skapa
            </button>
          </div>
          {hospitals.length === 0 ? (
            <p className="mt-2 text-xs text-amber-700">
              Inga vårdenheter kunde läsas in. Kör SQL-migrationerna{" "}
              <code className="rounded bg-slate-100 px-1">hospitals_schema.sql</code> och{" "}
              <code className="rounded bg-slate-100 px-1">hospitals_add_facility_type.sql</code>, kontrollera RLS för
              superadmin och ladda om sidan (standardlistor synkas automatiskt vid laddning).
            </p>
          ) : newClinicFacilityType === "vardcentral" && hospitalSelectGroupsForRegister.length === 0 ? (
            <p className="mt-2 text-xs text-amber-700">
              Inga vårdcentraler i listan. Kör <code className="rounded bg-slate-100 px-1">hospitals_add_facility_type.sql</code>{" "}
              om kolumnen <code className="rounded bg-slate-100 px-1">facility_type</code> saknas och ladda om sidan.
            </p>
          ) : null}
        </section>

        {/* Användare: en tabell per region med Vårdcentral / Sjukhus och kolumnen Klinik */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h2 className="shrink-0 text-base font-semibold text-slate-800">
              Användare ({clinics.length})
            </h2>
            <div className="min-w-0 w-full sm:w-auto sm:max-w-sm sm:flex-1 sm:min-w-[220px]">
              <label htmlFor="admin-anvandare-search" className="sr-only">
                Sök klinik, sjukhus eller region
              </label>
              <input
                id="admin-anvandare-search"
                type="search"
                autoComplete="off"
                placeholder="Sök klinik, sjukhus, region…"
                value={anvandareSearch}
                onChange={(e) => setAnvandareSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
          <div className="space-y-5">
            {clinics.length === 0 ? (
              <p className="text-xs text-slate-500">Inga kliniker skapade än.</p>
            ) : clinicsByRegion.length === 0 ? (
              <p className="text-xs text-slate-500">
                Inga träffar för &quot;{anvandareSearch.trim()}&quot;.
              </p>
            ) : (
              <>
                {clinicsByRegion.map((block) => {
                  const regionOpen = !collapsedAnvandareSections.has(block.region);
                  return (
                  <div
                    key={block.region}
                    className="overflow-x-auto rounded-md border border-slate-200/90"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={regionOpen}
                      className="flex cursor-pointer items-center gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2 transition-colors hover:bg-slate-100/90"
                      onClick={() => toggleAnvandareSection(block.region)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleAnvandareSection(block.region);
                        }
                      }}
                    >
                      <AnvandareSectionChevron expanded={regionOpen} />
                      <h3 className="min-w-0 flex-1 text-sm font-bold text-slate-900">{block.region}</h3>
                    </div>
                    {regionOpen ? (
                    <div className="space-y-4 p-3">
                    {block.vardcentral.length > 0 ? (
                      <div>
                        <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Vårdcentral
                        </h4>
                        <table className="w-full min-w-[260px] border-collapse text-xs leading-tight">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/60 text-left">
                              <th className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                Klinik
                              </th>
                              <th
                                className="w-16 px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                                title="Antal medlemmar"
                              >
                                Medl.
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {block.vardcentral.map((c) => {
                              const members = memberships.filter((m) => m.clinic_id === c.id);
                              return (
                                <tr key={c.id} className="bg-white">
                                  <td className="max-w-0 px-2 py-1.5 align-middle">
                                    <button
                                      type="button"
                                      onClick={() => setDetailClinic(c)}
                                      className="flex w-full min-w-0 items-center justify-between gap-2 rounded px-1 py-0.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
                                    >
                                      <span className="min-w-0 truncate font-medium text-slate-800">
                                        {c.name}
                                      </span>
                                    </button>
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                                    {members.length}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    {block.sjukhus.length > 0 ? (
                      <div>
                        <table className="w-full min-w-[280px] border-collapse text-xs leading-tight">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/60 text-left">
                              <th className="w-8 px-1 py-1 pl-2 align-middle" aria-hidden />
                              <th className="px-2 py-1 align-middle text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Sjukhus
                              </th>
                              <th
                                className="w-14 px-2 py-1 text-right align-middle text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                                title="Antal kliniker på sjukhuset"
                              >
                                Antal
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100/90">
                            {groupSjukhusClinicsByHospital(block.sjukhus).map((g) => {
                              const storageKey = sjukhusExpandStorageKey(block.region, g.key);
                              const open = expandedSjukhusKeys.has(storageKey);
                              const toggle = () => {
                                setExpandedSjukhusKeys((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(storageKey)) next.delete(storageKey);
                                  else next.add(storageKey);
                                  return next;
                                });
                              };
                              return (
                                <Fragment key={g.key}>
                                  <tr
                                    className="cursor-pointer bg-white transition-colors hover:bg-slate-50/80 focus-within:bg-slate-50/80"
                                    tabIndex={0}
                                    aria-expanded={open}
                                    onClick={toggle}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        toggle();
                                      }
                                    }}
                                  >
                                    <td className="w-8 px-1 py-1 pl-2 align-middle text-slate-400">
                                      <span
                                        className={`inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200/90 bg-white text-slate-500 transition-transform duration-150 ${
                                          open ? "rotate-90" : ""
                                        }`}
                                        aria-hidden
                                      >
                                        <svg
                                          className="h-3 w-3"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                          aria-hidden
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      </span>
                                    </td>
                                    <td className="max-w-0 px-2 py-1 align-middle font-medium text-slate-900">
                                      <span className="line-clamp-2">{g.hospitalLabel}</span>
                                    </td>
                                    <td className="w-14 px-2 py-1 align-middle text-right tabular-nums text-slate-500">
                                      {g.clinics.length}
                                    </td>
                                  </tr>
                                  {open
                                    ? g.clinics.map((c) => {
                                        const members = memberships.filter(
                                          (m) => m.clinic_id === c.id
                                        );
                                        return (
                                          <tr key={c.id} className="bg-slate-50/70">
                                            <td className="border-l-[3px] border-sky-400/80 bg-sky-50/40" />
                                            <td className="max-w-0 px-2 py-0.5 align-middle" colSpan={2}>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setDetailClinic(c);
                                                }}
                                                className="flex w-full min-w-0 items-center justify-between gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-white focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
                                              >
                                                <span className="min-w-0 truncate font-medium text-slate-800">
                                                  {c.name}
                                                </span>
                                                <span className="shrink-0 tabular-nums text-[10px] text-slate-500">
                                                  {members.length} medl.
                                                </span>
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })
                                    : null}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    </div>
                    ) : null}
                  </div>
                );
                })}
              </>
            )}

            <div className="overflow-x-auto rounded-md border border-slate-200/90">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={ejKoppladeAnvandareOpen}
                className="flex cursor-pointer items-center gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2 transition-colors hover:bg-slate-100/90"
                onClick={() => toggleAnvandareSection(EJ_KOPPLADE_ANVANDARE_SECTION_KEY)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleAnvandareSection(EJ_KOPPLADE_ANVANDARE_SECTION_KEY);
                  }
                }}
              >
                <AnvandareSectionChevron expanded={ejKoppladeAnvandareOpen} />
                <h3 className="min-w-0 flex-1 text-sm font-bold text-slate-900">
                  Ej kopplade till klinik
                </h3>
              </div>
              {ejKoppladeAnvandareOpen ? (
                <div className="p-3">
                  {usersWithoutClinic.length === 0 ? (
                    <p className="text-xs text-slate-500">Ingen användare saknar klinik</p>
                  ) : (
                    <table className="w-full min-w-[260px] border-collapse text-xs leading-tight">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/60 text-left">
                          <th className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            Namn
                          </th>
                          <th className="w-28 px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            Roll
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {usersWithoutClinic.map((u) => (
                          <tr key={u.id} className="bg-white">
                            <td className="max-w-0 px-2 py-1.5 align-middle">
                              <button
                                type="button"
                                onClick={() =>
                                  setUnlinkedContactOpen({
                                    userId: u.id,
                                    fallbackName: displayName(u),
                                  })
                                }
                                className="flex w-full min-w-0 items-center justify-between gap-2 rounded px-1 py-0.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
                              >
                                <span className="min-w-0 truncate font-medium text-slate-800">
                                  {displayName(u)}
                                </span>
                              </button>
                            </td>
                            <td className="px-2 py-1.5 text-right align-middle text-slate-500">
                              {adminProfileRoleLabel(u.role)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Bjud in via email */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Bjud in via email</h2>
          <p className="text-sm text-slate-600 mb-4">
            Skicka en inbjudan via email. Om användaren redan har ett konto kommer de till inloggningssidan, annars till registreringssidan.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Email *"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <select
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={inviteClinicId}
              onChange={(e) => setInviteClinicId(e.target.value)}
            >
              <option value="">Välj klinik...</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {clinicOptionLabel(c)}
                </option>
              ))}
            </select>
            <select
              className="sm:w-40 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
            >
              <option value="studierektor">Studierektor</option>
              <option value="huvudhandledare">Huvudhandledare</option>
              <option value="st_lakare">ST-läkare</option>
            </select>
            <button
              onClick={sendInvitation}
              disabled={!inviteEmail.trim() || !inviteClinicId}
              className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Bjud in
            </button>
          </div>
        </section>

        {/* Tilldela användare till klinik */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Tilldela befintlig användare till klinik</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={assignClinicId}
              onChange={(e) => setAssignClinicId(e.target.value)}
            >
              <option value="">Välj klinik...</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {clinicOptionLabel(c)}
                </option>
              ))}
            </select>
            <select
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
            >
              <option value="">Välj användare...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{displayName(u)}</option>
              ))}
            </select>
            <select
              className="sm:w-40 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              value={assignRole}
              onChange={(e) => setAssignRole(e.target.value as any)}
            >
              <option value="studierektor">Studierektor</option>
              <option value="huvudhandledare">Huvudhandledare</option>
              <option value="st_lakare">ST-läkare</option>
            </select>
            <button
              onClick={assignMember}
              disabled={!assignClinicId || !assignUserId}
              className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Tilldela
            </button>
          </div>
        </section>

        {/* Hantera roller */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Användare & roller ({users.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2 pr-4">Namn</th>
                  <th className="pb-2 pr-4">Roll</th>
                  <th className="pb-2">Ändra</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-800">{displayName(u)}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${adminRoleBadgeClass(u.role)}`}
                      >
                        {adminProfileRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="py-2">
                      <select
                        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
                        value={u.role}
                        onChange={(e) => setUserRole(u.id, e.target.value)}
                      >
                        <option value="st_lakare">ST-läkare</option>
                        <option value="huvudhandledare">Huvudhandledare</option>
                        <option value="studierektor">Studierektor</option>
                        <option value="superadmin">Superadmin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
            </div>
          </div>
        </div>
      </div>

      <ClinicDetailModal
        open={!!detailClinic}
        clinic={detailClinic}
        memberships={detailMemberships}
        hospitalSelectGroups={hospitalSelectGroupsForModal}
        clinicsForMove={clinicsForMoveInModal}
        onClose={() => setDetailClinic(null)}
        onRemoveMember={(id) => void removeMember(id)}
        onSaveClinic={(name, hospitalId) => saveClinicFromDetailModal(name, hospitalId)}
        onDeleteClinicPlan={handleDeleteClinicPlan}
      />

      <LogoutConfirmDialog
        open={logoutConfirmOpen}
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={async () => {
          setLogoutConfirmOpen(false);
          await supabase.auth.signOut();
          router.push("/auth");
        }}
      />

      {typeof document !== "undefined" &&
        createPortal(
          <ProfileContactDetailModal
            open={!!unlinkedContactOpen}
            onClose={() => setUnlinkedContactOpen(null)}
            loading={unlinkedContactLoading}
            profile={unlinkedContactProfile}
            nameFallback={unlinkedContactOpen?.fallbackName}
            overlayClassName="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 p-4"
          />,
          document.body
        )}
    </>
  );
}

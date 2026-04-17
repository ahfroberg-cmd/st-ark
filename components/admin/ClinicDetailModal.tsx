"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ProfileContactDetailModal, {
  type ProfileContactDetailFields,
} from "@/components/ProfileContactDetailModal";
import { registerModal, unregisterModal } from "@/lib/modalEscHandler";
import type { AdminClinicRow } from "@/lib/admin/groupClinicsByHospital";
import { fetchProfileById } from "@/lib/repositories/starkRepository";

export type ClinicMembershipRow = {
  id: string;
  clinic_id: string;
  user_id: string;
  role: string;
  joined_at?: string;
  profiles?: { id?: string; name?: string; role?: string; email?: string | null };
};

export type HospitalSelectGroup = {
  label: string;
  items: { id: string; name: string }[];
};

export type DeleteClinicPlan =
  | { mode: "no_members" }
  | { mode: "move"; targetClinicId: string }
  | { mode: "unassign" };

export type ClinicForMoveOption = { id: string; label: string };

type Tab = "studierektor" | "huvudhandledare" | "st_lakare";

function normalizeRoleTab(role: string): Tab {
  const r = String(role || "").toLowerCase().trim();
  if (r === "studierektor" || r === "study_director") return "studierektor";
  if (
    r === "huvudhandledare" ||
    r === "supervisor" ||
    r === "handledare" ||
    r === "main_supervisor"
  ) {
    return "huvudhandledare";
  }
  return "st_lakare";
}

function displayName(
  p: { name?: string; email?: string | null } | null | undefined,
  userId?: string
) {
  const n = p?.name?.trim();
  if (n) return n;
  const e = typeof p?.email === "string" ? p.email.trim() : "";
  if (e) return e;
  if (userId) return `Användare ${userId.slice(0, 8)}…`;
  return "(inget namn)";
}

const TAB_LABEL: Record<Tab, string> = {
  studierektor: "Studierektor",
  huvudhandledare: "Huvudhandledare",
  st_lakare: "ST-läkare",
};

export default function ClinicDetailModal({
  open,
  clinic,
  memberships,
  hospitalSelectGroups,
  clinicsForMove,
  onClose,
  onRemoveMember,
  onSaveClinic,
  onDeleteClinicPlan,
}: {
  open: boolean;
  clinic: AdminClinicRow | null;
  memberships: ClinicMembershipRow[];
  hospitalSelectGroups: HospitalSelectGroup[];
  clinicsForMove: ClinicForMoveOption[];
  onClose: () => void;
  onRemoveMember: (membershipId: string) => void;
  onSaveClinic: (name: string, hospitalId: string | null) => Promise<void>;
  onDeleteClinicPlan: (plan: DeleteClinicPlan) => Promise<boolean>;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const settingsOverlayRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("studierektor");
  const [editName, setEditName] = useState("");
  const [editHospitalId, setEditHospitalId] = useState("");
  const [clinicSaving, setClinicSaving] = useState(false);
  const [deletePanelOpen, setDeletePanelOpen] = useState(false);
  const [memberDisposition, setMemberDisposition] = useState<"move" | "unassign">("move");
  const [moveTargetId, setMoveTargetId] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState<{
    userId: string;
    fallbackName: string;
  } | null>(null);
  const [contactProfile, setContactProfile] = useState<ProfileContactDetailFields>(null);
  const [contactLoading, setContactLoading] = useState(false);

  useEffect(() => {
    if (open) setTab("studierektor");
  }, [open, clinic?.id]);

  useEffect(() => {
    if (!clinic) return;
    setEditName(clinic.name || "");
    setEditHospitalId(clinic.hospital_id || "");
  }, [clinic?.id, clinic?.name, clinic?.hospital_id]);

  useEffect(() => {
    if (!open || !clinic) return;
    setDeletePanelOpen(false);
    setMemberDisposition("move");
    setMoveTargetId("");
    setSettingsOpen(false);
    setContactOpen(null);
    setContactProfile(null);
  }, [open, clinic?.id]);

  useEffect(() => {
    if (!open || !overlayRef.current) return;
    const el = overlayRef.current;
    registerModal(el, onClose);
    return () => unregisterModal(el);
  }, [open, onClose]);

  useEffect(() => {
    if (!settingsOpen || !settingsOverlayRef.current) return;
    const el = settingsOverlayRef.current;
    const closeSettings = () => setSettingsOpen(false);
    registerModal(el, closeSettings);
    return () => unregisterModal(el);
  }, [settingsOpen]);

  useEffect(() => {
    if (!open) {
      setContactOpen(null);
      setContactProfile(null);
    }
  }, [open]);

  useEffect(() => {
    if (!contactOpen?.userId) {
      setContactProfile(null);
      return;
    }
    let cancelled = false;
    setContactLoading(true);
    void (async () => {
      try {
        const { data, error } = await fetchProfileById(contactOpen.userId);
        if (error) throw error;
        if (!cancelled) setContactProfile(data || null);
      } catch {
        if (!cancelled) setContactProfile(null);
      } finally {
        if (!cancelled) setContactLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contactOpen]);

  if (!open || !clinic) return null;

  const filtered = memberships.filter((m) => normalizeRoleTab(m.role) === tab);
  const memberCount = memberships.length;

  const handleSaveClinic = async () => {
    const n = editName.trim();
    if (!n) return;
    setClinicSaving(true);
    try {
      await onSaveClinic(n, editHospitalId.trim() || null);
      setSettingsOpen(false);
    } finally {
      setClinicSaving(false);
    }
  };

  const runDelete = async () => {
    if (memberCount === 0) {
      if (
        !confirm(
          `Ta bort kliniken "${clinic.name}"? Detta kan inte ångras.`
        )
      ) {
        return;
      }
      setDeleteBusy(true);
      try {
        await onDeleteClinicPlan({ mode: "no_members" });
      } finally {
        setDeleteBusy(false);
      }
      return;
    }

    if (memberDisposition === "move") {
      if (!moveTargetId) return;
      if (
        !confirm(
          `Alla ${memberCount} medlem(mar) (studierektor, huvudhandledare och ST-läkare) flyttas till vald klinik. Därefter tas "${clinic.name}" bort. Fortsätt?`
        )
      ) {
        return;
      }
      setDeleteBusy(true);
      try {
        await onDeleteClinicPlan({ mode: "move", targetClinicId: moveTargetId });
      } finally {
        setDeleteBusy(false);
      }
      return;
    }

    if (
      !confirm(
        `Kliniken "${clinic.name}" tas bort och alla ${memberCount} medlem(mar) kopplas loss (inga klinikkopplingar). De visas under "Ej kopplade till klinik" tills de tilldelas igen. Fortsätt?`
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    try {
      await onDeleteClinicPlan({ mode: "unassign" });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[305] grid place-items-center bg-black/60 p-4"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="clinic-detail-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="shrink-0 border-b border-slate-200 px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="clinic-detail-title" className="truncate text-lg font-extrabold text-slate-900">
                {clinic.name}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {clinic.hospitals?.name?.trim() ? (
                  <>
                    {clinic.hospitals.name}
                    {clinic.hospitals.region || clinic.hospitals.facility_type ? (
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        {[
                          clinic.hospitals.region,
                          clinic.hospitals.facility_type === "vardcentral"
                            ? "Vårdcentral"
                            : "Sjukhus",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </>
                ) : (
                  "Ej angiven vårdenhet"
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Inställningar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Stäng
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  tab === t
                    ? "bg-sky-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {TAB_LABEL[t]}
                <span className="ml-1 opacity-80">
                  ({memberships.filter((m) => normalizeRoleTab(m.role) === t).length})
                </span>
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">Inga medlemmar i denna roll.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm transition-colors duration-150 hover:bg-slate-100"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-medium text-slate-800"
                    onClick={() =>
                      setContactOpen({
                        userId: m.user_id,
                        fallbackName: displayName(m.profiles, m.user_id),
                      })
                    }
                  >
                    {displayName(m.profiles, m.user_id)}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveMember(m.id)}
                    className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-800"
                  >
                    Ta bort från klinik
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
          {!deletePanelOpen ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setDeletePanelOpen(true);
                  if (memberCount > 0 && clinicsForMove.length === 0) {
                    setMemberDisposition("unassign");
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                Ta bort klinik
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Ta bort klinik</p>
              {memberCount === 0 ? (
                <p className="text-xs text-slate-600">
                  Det finns inga medlemmar kopplade till kliniken. Den tas bort permanent.
                </p>
              ) : (
                <div className="space-y-3 text-xs text-slate-700">
                  <p>
                    Kliniken har <strong>{memberCount}</strong> medlem(mar). Välj vad som ska hända med
                    studierektorer, huvudhandledare och ST-läkare:
                  </p>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white p-2">
                    <input
                      type="radio"
                      name="del-disp"
                      className="mt-0.5"
                      checked={memberDisposition === "move"}
                      onChange={() => setMemberDisposition("move")}
                    />
                    <span>
                      <span className="font-semibold text-slate-900">Flytta alla till annan klinik</span>
                      <span className="mt-0.5 block text-slate-600">
                        Samma roller behålls. Om någon redan finns på målkliniken tas bara kopplingen till den här
                        kliniken bort.
                      </span>
                    </span>
                  </label>
                  {memberDisposition === "move" ? (
                    <div className="pl-6">
                      <label className="mb-1 block font-medium text-slate-700">Målklinik</label>
                      <select
                        className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        value={moveTargetId}
                        onChange={(e) => setMoveTargetId(e.target.value)}
                      >
                        <option value="">Välj klinik…</option>
                        {clinicsForMove.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      {clinicsForMove.length === 0 ? (
                        <p className="mt-1 text-amber-800">Skapa minst en annan klinik först, eller koppla loss medlemmarna.</p>
                      ) : null}
                    </div>
                  ) : null}
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white p-2">
                    <input
                      type="radio"
                      name="del-disp"
                      className="mt-0.5"
                      checked={memberDisposition === "unassign"}
                      onChange={() => setMemberDisposition("unassign")}
                    />
                    <span>
                      <span className="font-semibold text-slate-900">Koppla loss (ej kopplade till klinik)</span>
                      <span className="mt-0.5 block text-slate-600">
                        Alla klinikkopplingar för dessa personer tas bort. Tilldela dem igen under &quot;Tilldela
                        befintlig användare till klinik&quot;.
                      </span>
                    </span>
                  </label>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => setDeletePanelOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  disabled={
                    deleteBusy ||
                    (memberCount > 0 &&
                      memberDisposition === "move" &&
                      (!moveTargetId || clinicsForMove.length === 0))
                  }
                  onClick={() => void runDelete()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteBusy ? "Arbetar…" : "Ta bort klinik"}
                </button>
              </div>
            </div>
          )}
        </footer>
      </div>

      {typeof document !== "undefined" &&
        settingsOpen &&
        createPortal(
          <div
            ref={settingsOverlayRef}
            className="fixed inset-0 z-[315] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clinic-settings-title"
            onClick={() => setSettingsOpen(false)}
          >
            <div
              className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3">
                <h3 id="clinic-settings-title" className="text-base font-bold text-slate-900">
                  Inställningar
                </h3>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Stäng
                </button>
              </div>
              <div className="border-b border-black" />
              <div className="space-y-3 p-5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Kliniknamn</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Vårdenhet</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    value={editHospitalId}
                    onChange={(e) => setEditHospitalId(e.target.value)}
                  >
                    <option value="">Ej kopplad vårdenhet</option>
                    {hospitalSelectGroups.map(({ label, items }) => (
                      <optgroup key={label} label={label}>
                        {items.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {hospitalSelectGroups.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Inga vårdenheter i databasen. Ladda om superadmin-sidan (standardlistor synkas automatiskt) eller
                      kontrollera databas och RLS.
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={clinicSaving || !editName.trim()}
                    onClick={() => void handleSaveClinic()}
                    className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {clinicSaving ? "Sparar…" : "Spara klinik"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {typeof document !== "undefined" &&
        createPortal(
          <ProfileContactDetailModal
            open={!!contactOpen}
            onClose={() => setContactOpen(null)}
            loading={contactLoading}
            profile={contactProfile}
            nameFallback={contactOpen?.fallbackName}
            overlayClassName="fixed inset-0 z-[320] flex items-center justify-center bg-black/60 p-4"
          />,
          document.body
        )}
    </div>
  );
}

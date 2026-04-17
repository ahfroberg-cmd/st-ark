"use client";

import { useEffect, useRef } from "react";
import { registerModal, unregisterModal } from "@/lib/modalEscHandler";

export type ProfileContactDetailFields = {
  name?: string | null;
  personal_number?: string | null;
  specialty?: string | null;
  email?: string | null;
  mobile?: string | null;
  phone_work?: string | null;
  phone_home?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
} | null;

function birthDateFromPersonalNumber(raw: unknown): string {
  const pnr = String(raw || "");
  if (!pnr) return "—";
  return pnr.replace(/[-+]?\d{4}$/, "") || "—";
}

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  profile: ProfileContactDetailFields;
  /** Visas tills profil laddats eller om namn saknas i databasen */
  nameFallback?: string | null;
  /**
   * Overlay med högre z-index än underliggande modal, t.ex. z-[320] över z-[305].
   * Default matchar studierektor-dashboard (z-[800]).
   */
  overlayClassName?: string;
};

const DEFAULT_OVERLAY =
  "fixed inset-0 z-[800] flex items-center justify-center bg-black/60 p-4";

export default function ProfileContactDetailModal({
  open,
  onClose,
  loading,
  profile,
  nameFallback,
  overlayClassName = DEFAULT_OVERLAY,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !overlayRef.current) return;
    const el = overlayRef.current;
    registerModal(el, onClose);
    return () => unregisterModal(el);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={overlayClassName}
      onClick={() => onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-contact-detail-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <h3 id="profile-contact-detail-title" className="text-lg font-bold text-slate-900">
            Kontaktuppgifter
          </h3>
          <button
            type="button"
            onClick={() => onClose()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Stäng
          </button>
        </div>
        <div className="border-b border-black" />
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Laddar profil…</p>
        ) : (
          <div className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Namn
                </label>
                <p className="text-sm text-slate-900">
                  {profile?.name?.trim() || nameFallback?.trim() || "—"}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Födelsedatum
                </label>
                <p className="font-mono text-sm text-slate-900">
                  {birthDateFromPersonalNumber(profile?.personal_number)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Specialitet
                </label>
                <p className="text-sm text-slate-900">{profile?.specialty || "—"}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  E-postadress
                </label>
                <p className="text-sm text-slate-900">{profile?.email || "—"}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mobiltelefon
                </label>
                <p className="text-sm text-slate-900">{profile?.mobile || "—"}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Arbetstelefon
                </label>
                <p className="text-sm text-slate-900">{profile?.phone_work || "—"}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hemtelefon
                </label>
                <p className="text-sm text-slate-900">{profile?.phone_home || "—"}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Adress
                </label>
                <p className="text-sm text-slate-900">{profile?.address || "—"}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Postnummer
                </label>
                <p className="text-sm text-slate-900">{profile?.postal_code || "—"}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Postort
                </label>
                <p className="text-sm text-slate-900">{profile?.city || "—"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getSessionUser } from "@/lib/supabase";
import {
  fetchProfileById,
  findClinicMembershipIdForUserClinic,
  insertClinicMembershipRow,
  listPendingInvitationsForEmails,
  markInvitationAccepted,
  updateInvitationStatus,
  updateProfileNameForUser,
} from "@/lib/repositories/starkRepository";

interface PendingInvitation {
  id: string;
  clinic_id: string;
  email: string;
  role: string;
  clinicName: string;
  invitedName: string;
}

export default function InvitationPopup() {
  const [invitation, setInvitation] = useState<PendingInvitation | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Namnkontroll efter accept
  const [nameConflict, setNameConflict] = useState<{
    profileName: string;
    clinicRegisteredName: string;
  } | null>(null);
  const [nameChoice, setNameChoice] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const user = await getSessionUser();
        if (!user?.id) return;

        // Hämta användarens e-post och namn från profil
        const { data: profile } = await fetchProfileById(user.id);

        // Kolla även auth-mejlen
        const emails = [
          profile?.email,
          user.email,
        ].filter(Boolean).map((e) => (e as string).toLowerCase().trim());

        if (emails.length === 0) return;

        // Hämta pending inbjudningar som matchar användarens e-post
        const { data: invitations, error } = await listPendingInvitationsForEmails(emails);

        if (error || !invitations || invitations.length === 0) return;

        const inv = invitations[0] as any;

        // Kolla att inbjudan inte har utgått
        if (inv.expires_at && new Date(inv.expires_at) < new Date()) return;

        // Kolla att användaren inte redan är medlem i denna klinik med denna roll
        const { data: existing } = await findClinicMembershipIdForUserClinic(user.id, inv.clinic_id);

        if (existing) {
          await markInvitationAccepted(inv.id);
          return;
        }

        setInvitation({
          id: inv.id,
          clinic_id: inv.clinic_id,
          email: inv.email,
          role: inv.role,
          clinicName: inv.clinics?.name || "kliniken",
          invitedName: (inv.name || "").trim(),
        });
      } catch (err) {
        console.error("InvitationPopup: failed to check invitations", err);
      }
    })();
  }, []);

  async function handleAccept() {
    if (!invitation) return;
    setProcessing(true);
    try {
      const user = await getSessionUser();
      if (!user?.id) throw new Error("Ej inloggad");

      // Lägg till i clinic_memberships
      const { error: memberErr } = await insertClinicMembershipRow({
        clinic_id: invitation.clinic_id,
        user_id: user.id,
        role: invitation.role || "st_lakare",
      });

      if (memberErr && !memberErr.message.includes("duplicate")) {
        throw new Error(memberErr.message);
      }

      await markInvitationAccepted(invitation.id);

      // Kontrollera namn – kolla om studierektorn har registrerat ett annat namn
      const invitedName = invitation.invitedName;
      if (invitedName) {
        const { data: myProfile } = await fetchProfileById(user.id);

        const myName = (myProfile?.name || "").trim();

        if (myName && invitedName.toLowerCase() !== myName.toLowerCase()) {
          // Namn skiljer sig – fråga användaren
          setNameConflict({ profileName: myName, clinicRegisteredName: invitedName });
          return;
        }

        // Om användaren saknar namn men studierektorn angav ett – sätt det direkt
        if (!myName && invitedName) {
          await updateProfileNameForUser(user.id, invitedName);
        }
      }

      setResult({ type: "ok", msg: `Du är nu tillagd i ${invitation.clinicName}!` });
      setTimeout(() => {
        setInvitation(null);
        setResult(null);
      }, 2500);
    } catch (err) {
      setResult({
        type: "err",
        msg: "Kunde inte acceptera inbjudan: " + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setProcessing(false);
    }
  }

  async function handleDecline() {
    if (!invitation) return;
    setProcessing(true);
    try {
      await updateInvitationStatus(invitation.id, "expired");

      setInvitation(null);
    } catch {
      setInvitation(null);
    } finally {
      setProcessing(false);
    }
  }

  async function handleNameChoice(chosenName: string) {
    setProcessing(true);
    try {
      const user = await getSessionUser();
      if (!user?.id) return;

      await updateProfileNameForUser(user.id, chosenName);

      setNameConflict(null);
      setResult({ type: "ok", msg: `Namn uppdaterat till "${chosenName}". Du är tillagd i ${invitation?.clinicName}!` });
      setTimeout(() => {
        setInvitation(null);
        setResult(null);
      }, 3000);
    } catch {
      setNameConflict(null);
      setResult({ type: "ok", msg: `Du är nu tillagd i ${invitation?.clinicName}!` });
      setTimeout(() => {
        setInvitation(null);
        setResult(null);
      }, 2500);
    } finally {
      setProcessing(false);
    }
  }

  if (!invitation && !result && !nameConflict) return null;

  const roleText =
    invitation?.role === "huvudhandledare"
      ? "huvudhandledare"
      : "ST-läkare";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        {nameConflict ? (
          <>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Vilket namn stämmer?</h2>
            <p className="text-sm text-slate-700 mb-4">
              Det registrerade namnet i kliniken skiljer sig från ditt profilnamn. Välj vilket som är korrekt:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleNameChoice(nameConflict.profileName)}
                disabled={processing}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <span className="font-semibold text-slate-900">{nameConflict.profileName}</span>
                <span className="ml-2 text-slate-500">(ditt profilnamn)</span>
              </button>
              <button
                onClick={() => handleNameChoice(nameConflict.clinicRegisteredName)}
                disabled={processing}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <span className="font-semibold text-slate-900">{nameConflict.clinicRegisteredName}</span>
                <span className="ml-2 text-slate-500">(registrerat av studierektor)</span>
              </button>
            </div>
            <div className="mt-3">
              <p className="text-xs text-slate-500 mb-2">Eller skriv ditt korrekta namn:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameChoice}
                  onChange={(e) => setNameChoice(e.target.value)}
                  placeholder="Ange korrekt namn"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  onClick={() => nameChoice.trim() && handleNameChoice(nameChoice.trim())}
                  disabled={processing || !nameChoice.trim()}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  Spara
                </button>
              </div>
            </div>
          </>
        ) : result ? (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              result.type === "ok"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {result.msg}
          </div>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-sky-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-slate-900">Inbjudan</h2>
            </div>

            <p className="mt-3 text-sm text-slate-700">
              Du har blivit inbjuden att gå med i{" "}
              <span className="font-semibold text-slate-900">{invitation?.clinicName}</span>{" "}
              som <span className="font-semibold text-slate-900">{roleText}</span>.
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Om du accepterar läggs du till i klinikens grupp och din studierektor kan följa din ST-planering.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleAccept}
                disabled={processing}
                className="flex-1 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 active:translate-y-px disabled:opacity-50"
              >
                {processing ? "Bearbetar..." : "Acceptera"}
              </button>
              <button
                onClick={handleDecline}
                disabled={processing}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:translate-y-px disabled:opacity-50"
              >
                Avböj
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  getInvitationEmailByToken,
  getInvitationWithClinicByToken,
  getProfileIdRoleByUserId,
  insertClinicMembershipRow,
  insertProfileIdRole,
  markInvitationAccepted,
  updateProfileRoleForUser,
} from "@/lib/repositories/starkRepository";

function AcceptInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "needsAuth" | "accepted" | "error">("loading");
  const [clinicName, setClinicName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Ingen inbjudningstoken hittades i länken.");
      return;
    }

    (async () => {
      // 1) Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Look up the invitation to get the email
        const { data: invitation } = await getInvitationEmailByToken(token);

        // Store token in sessionStorage so we can resume after login
        try { sessionStorage.setItem("pending_invite_token", token); } catch {}

        if (invitation?.email) {
          // Always redirect to auth page with email pre-filled
          // The auth page will handle whether user needs to login or signup
          router.push(`/auth?email=${encodeURIComponent(invitation.email)}`);
          return;
        }

        setStatus("needsAuth");
        return;
      }

      // 2) Look up the invitation
      const { data: invitation, error: invErr } = await getInvitationWithClinicByToken(token);

      if (invErr || !invitation) {
        setStatus("error");
        setErrorMsg("Inbjudan hittades inte eller har redan använts.");
        return;
      }

      if (invitation.status !== "pending") {
        setStatus("error");
        setErrorMsg(
          invitation.status === "accepted"
            ? "Denna inbjudan har redan accepterats."
            : "Denna inbjudan har utgått."
        );
        return;
      }

      if (new Date(invitation.expires_at) < new Date()) {
        setStatus("error");
        setErrorMsg("Denna inbjudan har utgått.");
        return;
      }

      const cName = (invitation as any).clinics?.name || "din klinik";
      setClinicName(cName);

      // 3) Create clinic membership
      const { error: memberErr } = await insertClinicMembershipRow({
        clinic_id: invitation.clinic_id,
        user_id: user.id,
        role: invitation.role || "st_lakare",
      });

      if (memberErr && !memberErr.message.includes("duplicate")) {
        setStatus("error");
        setErrorMsg(`Kunde inte gå med i kliniken: ${memberErr.message}`);
        return;
      }

      // 4) Update invitation status
      await markInvitationAccepted(invitation.id);

      // 5) Ensure user has a profile and update role
      const { data: existingProfile } = await getProfileIdRoleByUserId(user.id);
      const inviteRole = invitation.role || "st_lakare";

      if (!existingProfile) {
        await insertProfileIdRole(user.id, inviteRole);
      } else {
        await updateProfileRoleForUser(user.id, inviteRole);
      }

      // Clear stored token
      try { sessionStorage.removeItem("pending_invite_token"); } catch {}

      // Redirect to correct page based on role
      const userRole = invitation.role || "st_lakare";
      switch (userRole) {
        case "studierektor":
          router.push("/studierektor-profile?setup=1");
          return;
        case "huvudhandledare":
          router.push("/handledare");
          return;
        case "st_lakare":
        default:
          router.push("/planera-st");
          return;
      }
    })();
  }, [token, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500">
        Bearbetar inbjudan...
      </div>
    );
  }

  if (status === "needsAuth") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Du har blivit inbjuden!</h1>
          <p className="text-slate-600 text-sm">
            Du behöver logga in eller skapa ett konto för att acceptera inbjudan.
          </p>
          <button
            onClick={() => router.push("/auth")}
            className="w-full bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Logga in / Skapa konto
          </button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-red-800">Något gick fel</h1>
          <p className="text-slate-600 text-sm">{errorMsg}</p>
          <button
            onClick={() => router.push("/")}
            className="text-sm text-blue-600 hover:underline"
          >
            Gå till startsidan
          </button>
        </div>
      </div>
    );
  }

  // accepted
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="bg-white rounded-xl shadow-sm border border-green-200 p-8 max-w-md w-full text-center space-y-4">
        <div className="text-4xl">✓</div>
        <h1 className="text-xl font-bold text-green-800">Välkommen!</h1>
        <p className="text-slate-600 text-sm">
          Du är nu kopplad till <strong>{clinicName}</strong>.
        </p>
        <button
          onClick={() => router.push("/planera-st")}
          className="w-full bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          Gå till Pussla din ST
        </button>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-slate-500">Laddar...</div>}>
      <AcceptInviteInner />
    </Suspense>
  );
}

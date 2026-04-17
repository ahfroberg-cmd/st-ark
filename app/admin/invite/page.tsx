// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  fetchProfileRoleById,
  insertInvitationRow,
  listClinicsBrief,
  listInvitationsAll,
  listInvitationsByInviter,
  listStudierektorClinicRows,
  updateInvitationStatus,
} from "@/lib/repositories/starkRepository";

type Clinic = { id: string; name: string; sjukhus: string | null };

function normalizeClinicBrief(raw: unknown): Clinic | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : "";
  if (!id) return null;
  const h = r.hospitals;
  const embedded = Array.isArray(h) ? h[0] : h;
  const sjukhus =
    embedded && typeof embedded === "object" && (embedded as { name?: string }).name != null
      ? String((embedded as { name?: string }).name).trim() || null
      : null;
  return { id, name: String(r.name || ""), sjukhus };
}
type Invitation = {
  id: string;
  clinic_id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
};

export default function InvitePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [myClinics, setMyClinics] = useState<Clinic[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const showFeedback = (type: "ok" | "err", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadData = useCallback(async (userId: string, role: string) => {
    if (role === "superadmin") {
      const { data } = await listClinicsBrief();
      setMyClinics(
        (data || []).map((row) => normalizeClinicBrief(row)).filter(Boolean) as Clinic[]
      );
    } else {
      const { data: memberships } = await listStudierektorClinicRows(userId);
      const clinics = (memberships || [])
        .map((m: any) => normalizeClinicBrief(m.clinics))
        .filter(Boolean) as Clinic[];
      setMyClinics(clinics);
    }

    // Load invitations for clinics this user manages
    if (role === "superadmin") {
      const { data } = await listInvitationsAll();
      setInvitations(data || []);
    } else {
      const { data } = await listInvitationsByInviter(userId);
      setInvitations(data || []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/auth"); return; }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error loading profile:", profileError);
        router.replace("/auth");
        return;
      }

      const role = profile?.role || "st_lakare";
      if (role !== "studierektor" && role !== "superadmin") {
        router.replace("/planera-st");
        return;
      }

      setUserRole(role);
      setAuthorized(true);
      await loadData(user.id, role);
      setLoading(false);
    })();
  }, [router, loadData]);

  const sendInvitation = async () => {
    if (!selectedClinicId || !inviteEmail.trim()) return;
    const email = inviteEmail.trim().toLowerCase();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFeedback("err", "Ogiltig e-postadress.");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await insertInvitationRow({
        clinic_id: selectedClinicId,
        email,
        invited_by: user.id,
        role: "st_lakare",
      });

      if (error) {
        showFeedback("err", `Kunde inte skicka inbjudan: ${error.message}`);
      } else {
        showFeedback("ok", `Inbjudan skickad till ${email}!`);
        setInviteEmail("");
        await loadData(user.id, userRole);
      }
    } finally {
      setSending(false);
    }
  };

  const revokeInvitation = async (id: string) => {
    const { error } = await updateInvitationStatus(id, "expired");
    if (error) {
      showFeedback("err", `Kunde inte återkalla: ${error.message}`);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await loadData(user.id, userRole);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-slate-500">Laddar...</div>;
  if (!authorized) return null;

  const clinicName = (id: string) => myClinics.find((c) => c.id === id)?.name || "Okänd klinik";

  return (
    <div className="flex h-dvh max-h-dvh flex-col bg-slate-50">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y">
        <div className="p-4 md:p-8">
          <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Bjud in ST-läkare</h1>
          <div className="flex gap-3">
            {userRole === "superadmin" && (
              <button
                onClick={() => router.push("/admin")}
                className="text-sm text-purple-600 hover:underline"
              >
                Admin
              </button>
            )}
            <button
              onClick={() => router.push("/planera-st")}
              className="text-sm text-blue-600 hover:underline"
            >
              ← Tillbaka
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

        {/* Skicka inbjudan */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Ny inbjudan</h2>
          {myClinics.length === 0 ? (
            <p className="text-slate-500 text-sm">
              Du är inte studierektor för någon klinik.
              {userRole === "superadmin" && " Skapa en klinik först i admin-panelen."}
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                className="sm:w-56 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                value={selectedClinicId}
                onChange={(e) => setSelectedClinicId(e.target.value)}
              >
                <option value="">Välj klinik...</option>
                {myClinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.sjukhus ? ` (${c.sjukhus})` : ""}
                  </option>
                ))}
              </select>
              <input
                type="email"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="E-postadress till ST-läkare"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendInvitation()}
              />
              <button
                onClick={sendInvitation}
                disabled={!selectedClinicId || !inviteEmail.trim() || sending}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {sending ? "Skickar..." : "Bjud in"}
              </button>
            </div>
          )}
        </section>

        {/* Befintliga inbjudningar */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            Inbjudningar ({invitations.length})
          </h2>
          {invitations.length === 0 ? (
            <p className="text-slate-500 text-sm">Inga inbjudningar skickade.</p>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv) => {
                const isExpired = inv.status === "expired" || new Date(inv.expires_at) < new Date();
                return (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between border rounded-lg px-4 py-3 text-sm ${
                      inv.status === "accepted"
                        ? "bg-green-50 border-green-200"
                        : isExpired
                        ? "bg-slate-50 border-slate-200 opacity-60"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div>
                      <span className="font-medium text-slate-800">{inv.email}</span>
                      <span className="text-slate-500 mx-2">→</span>
                      <span className="text-slate-600">{clinicName(inv.clinic_id)}</span>
                      <span className={`ml-3 text-xs font-medium px-1.5 py-0.5 rounded ${
                        inv.status === "accepted"
                          ? "bg-green-100 text-green-700"
                          : isExpired
                          ? "bg-slate-100 text-slate-500"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {inv.status === "accepted" ? "Accepterad"
                          : isExpired ? "Utgången"
                          : "Väntande"}
                      </span>
                    </div>
                    {inv.status === "pending" && !isExpired && (
                      <button
                        onClick={() => revokeInvitation(inv.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Återkalla
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
          </div>
        </div>
      </div>
    </div>
  );
}

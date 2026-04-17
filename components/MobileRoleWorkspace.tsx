"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dismissSrMessageById,
  getAuthenticatedUserId,
  getClinicIdForCurrentUserRole,
  listIncomingMessagesForUser,
  listIncomingSuggestionsForUser,
  listProfilesByIds,
  listSupervisorAssignedStudentIds,
  markSrMessageReadById,
  respondSrSuggestionById,
} from "@/lib/repositories/starkRepository";
import { useMobileProfile } from "@/lib/hooks/useMobileData";
import { useStudierektorClinic } from "@/lib/hooks/useStudierektorData";
import StudierektorMobileStDetail from "@/components/StudierektorMobileStDetail";

type HandledareStudent = {
  id: string;
  name: string;
  specialty: string;
  goalsVersion: string;
};

export type StudierektorMobileTab = "st-lakare" | "huvudhandledare" | "klinik";
export type HandledareMobileTab = "st-lakare";

function sortKeyFirstNameFromDisplayName(displayName: string): string {
  const t = String(displayName || "").trim();
  if (!t) return "\uFFFF";
  return (t.split(/\s+/)[0] || t).trim();
}

type MobileRoleWorkspaceProps = {
  forcedStudierektorTab?: StudierektorMobileTab;
  forcedHandledareTab?: HandledareMobileTab;
};

export default function MobileRoleWorkspace({
  forcedStudierektorTab,
  forcedHandledareTab,
}: MobileRoleWorkspaceProps) {
  const { profile } = useMobileProfile();
  const role = String((profile as any)?.role || "st_lakare");

  if (role === "studierektor") {
    return <StudierektorMobilePanel forcedTab={forcedStudierektorTab} />;
  }
  if (role === "huvudhandledare") {
    return <HandledareMobilePanel forcedTab={forcedHandledareTab} />;
  }
  if (role === "st_lakare") return <StLakareMobilePanel />;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-slate-900">Samarbete</h2>
      <p className="mt-2 text-sm text-slate-700">
        Den här vyn används för studierektor och huvudhandledare.
      </p>
    </section>
  );
}

function StLakareMobilePanel() {
  const [meId, setMeId] = useState<string>("");
  const [incomingMessages, setIncomingMessages] = useState<any[]>([]);
  const [incomingSuggestions, setIncomingSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadIncoming = useCallback(async () => {
    if (!meId) return;
    setLoading(true);
    try {
      const [{ data: mRows }, { data: sRows }] = await Promise.all([
        listIncomingMessagesForUser(meId, 40),
        listIncomingSuggestionsForUser(meId, 40),
      ]);
      setIncomingMessages(mRows || []);
      setIncomingSuggestions(sRows || []);
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setMeId(String(user?.id || ""));
    })();
  }, []);

  useEffect(() => {
    loadIncoming();
  }, [loadIncoming]);

  useEffect(() => {
    if (!meId) return;
    const channel = supabase
      .channel(`mobile-st-feed:${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sr_messages" }, () => {
        loadIncoming();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sr_activity_suggestions" },
        () => {
          loadIncoming();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, loadIncoming]);

  const markMessageRead = useCallback(
    async (id: string) => {
      setFeedback(null);
      const { error } = await markSrMessageReadById(id, meId);
      if (error) {
        setFeedback("Kunde inte markera meddelandet som läst.");
        return;
      }
      await loadIncoming();
    },
    [meId, loadIncoming]
  );

  const dismissMessage = useCallback(
    async (id: string) => {
      setFeedback(null);
      const { error } = await dismissSrMessageById(id, meId);
      if (error) {
        setFeedback("Kunde inte avfärda meddelandet.");
        return;
      }
      await loadIncoming();
    },
    [meId, loadIncoming]
  );

  const respondSuggestion = useCallback(
    async (id: string, status: "accepted" | "dismissed") => {
      setFeedback(null);
      const { error } = await respondSrSuggestionById(id, meId, status);
      if (error) {
        setFeedback(status === "accepted" ? "Kunde inte acceptera." : "Kunde inte avfärda.");
        return;
      }
      await loadIncoming();
    },
    [meId, loadIncoming]
  );

  const suggestionLabel = (s: any) => {
    const data = (s?.activity_data || {}) as Record<string, string>;
    return String(data.title || data.courseTitle || s.activity_type || "Förslag");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Meddelanden från SR/handledare</h2>
        {loading ? (
          <p className="mt-2 text-sm text-slate-700">Laddar...</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {incomingMessages.map((m) => (
              <li key={m.id} className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs text-slate-500">
                  {new Date(m.created_at).toLocaleString("sv-SE")}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                  {String(m.message_text || "")}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => markMessageRead(m.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Markera läst
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissMessage(m.id)}
                    className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700"
                  >
                    Avfärda
                  </button>
                </div>
              </li>
            ))}
            {incomingMessages.length === 0 && (
              <li className="text-xs text-slate-600">Inga meddelanden.</li>
            )}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Aktivitetsförslag</h2>
        <ul className="mt-3 space-y-2">
          {incomingSuggestions.map((s) => (
            <li key={s.id} className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs text-slate-500">
                {new Date(s.created_at).toLocaleString("sv-SE")}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-900">{suggestionLabel(s)}</div>
              <div className="mt-1 text-xs text-slate-600">Typ: {String(s.activity_type || "-")}</div>
              <div className="mt-1 text-xs text-slate-600">Status: {String(s.status || "pending")}</div>
              {String(s.status) === "pending" && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => respondSuggestion(s.id, "accepted")}
                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                  >
                    Acceptera
                  </button>
                  <button
                    type="button"
                    onClick={() => respondSuggestion(s.id, "dismissed")}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Avfärda
                  </button>
                </div>
              )}
            </li>
          ))}
          {incomingSuggestions.length === 0 && (
            <li className="text-xs text-slate-600">Inga förslag just nu.</li>
          )}
        </ul>
        {feedback ? <p className="mt-3 text-xs text-slate-700">{feedback}</p> : null}
      </section>
    </div>
  );
}

function StudierektorMobilePanel({ forcedTab }: { forcedTab?: StudierektorMobileTab }) {
  const { clinic, members, invitations, loading, sendInvitation, cancelInvitation } =
    useStudierektorClinic();
  const [srTabInternal, setSrTabInternal] = useState<StudierektorMobileTab>("st-lakare");
  const srTab = forcedTab || srTabInternal;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"st_lakare" | "huvudhandledare">("st_lakare");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedStUserId, setSelectedStUserId] = useState<string | null>(null);
  const [selectedStName, setSelectedStName] = useState<string>("");

  const onInvite = useCallback(async () => {
    const value = email.trim();
    if (!value) return;
    setSaving(true);
    setFeedback(null);
    try {
      await sendInvitation(value, role);
      setEmail("");
      setFeedback("Inbjudan skickad.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Kunde inte skicka inbjudan.");
    } finally {
      setSaving(false);
    }
  }, [email, role, sendInvitation]);

  const stRecipients = useMemo(
    () =>
      (members || [])
        .filter((m) => m.role === "st_lakare")
        .map((m) => {
          const raw = String(m.profile?.name || "").trim();
          return { userId: String(m.user_id), name: raw || "Okänd" };
        })
        .sort((a, b) => {
          const ka = sortKeyFirstNameFromDisplayName(a.name === "Okänd" ? "" : a.name);
          const kb = sortKeyFirstNameFromDisplayName(b.name === "Okänd" ? "" : b.name);
          const byFirst = ka.localeCompare(kb, "sv", { sensitivity: "base" });
          if (byFirst !== 0) return byFirst;
          return a.name.localeCompare(b.name, "sv", { sensitivity: "base" });
        }),
    [members]
  );
  const hhRecipients = useMemo(
    () =>
      (members || [])
        .filter((m) => m.role === "huvudhandledare")
        .map((m) => ({ userId: String(m.user_id), name: String(m.profile?.name || "Okänd") })),
    [members]
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Studierektor</h2>
        <p className="mt-1 text-sm text-slate-700">
          {loading ? "Laddar..." : clinic?.name || "Ingen klinik kopplad"}
        </p>
        {!forcedTab && (
          <div className="mt-3 inline-flex rounded-lg border border-slate-300 p-1">
            {[
              { key: "st-lakare", label: "ST-läkare" },
              { key: "huvudhandledare", label: "Handledare" },
              { key: "klinik", label: "Klinik" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSrTabInternal(tab.key as StudierektorMobileTab)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  srTab === tab.key ? "bg-emerald-600 text-white" : "text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {srTab === "st-lakare" && (
        <>
          {selectedStUserId ? (
            <StudierektorMobileStDetail
              stUserId={selectedStUserId}
              stName={selectedStName}
              clinicId={String(clinic?.id || "")}
              onBack={() => {
                setSelectedStUserId(null);
                setSelectedStName("");
              }}
            />
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">ST-läkare i kliniken</h3>
              <ul className="mt-3 space-y-2">
                {stRecipients.map((r) => (
                  <li key={r.userId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStUserId(r.userId);
                        setSelectedStName(r.name);
                      }}
                      className="w-full rounded-lg border border-slate-200 p-3 text-left text-sm text-slate-900 hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>{r.name}</span>
                        <span className="text-xs font-semibold text-sky-700">Öppna</span>
                      </div>
                    </button>
                  </li>
                ))}
                {stRecipients.length === 0 && (
                  <li className="text-xs text-slate-600">Inga ST-läkare kopplade ännu.</li>
                )}
              </ul>
            </section>
          )}

        </>
      )}

      {srTab === "huvudhandledare" && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Huvudhandledare på kliniken</h3>
            <ul className="mt-3 space-y-2">
              {hhRecipients.map((r) => (
                <li key={r.userId} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-900">
                  {r.name}
                </li>
              ))}
              {hhRecipients.length === 0 && (
                <li className="text-xs text-slate-600">Inga huvudhandledare kopplade ännu.</li>
              )}
            </ul>
          </section>
        </>
      )}

      {srTab === "klinik" && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Bjud in ny medlem</h3>
            <div className="mt-3 space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-post"
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "st_lakare" | "huvudhandledare")}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="st_lakare">ST-läkare</option>
                <option value="huvudhandledare">Huvudhandledare</option>
              </select>
              <button
                type="button"
                onClick={onInvite}
                disabled={saving}
                className="h-11 w-full rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Skickar..." : "Skicka inbjudan"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Klinikmedlemmar</h3>

            <div className="mt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                ST-läkare ({stRecipients.length})
              </h4>
              <ul className="mt-2 space-y-2">
                {stRecipients.map((r) => (
                  <li key={r.userId} className="rounded-lg border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-900">{r.name}</div>
                  </li>
                ))}
                {stRecipients.length === 0 && (
                  <li className="text-xs text-slate-600">Inga ST-läkare ännu.</li>
                )}
              </ul>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Huvudhandledare ({hhRecipients.length})
              </h4>
              <ul className="mt-2 space-y-2">
                {hhRecipients.map((r) => (
                  <li key={r.userId} className="rounded-lg border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-900">{r.name}</div>
                  </li>
                ))}
                {hhRecipients.length === 0 && (
                  <li className="text-xs text-slate-600">Inga huvudhandledare ännu.</li>
                )}
              </ul>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Väntande inbjudningar</h3>
            <ul className="mt-3 space-y-2">
              {(invitations || []).map((inv) => (
                <li key={inv.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="text-sm text-slate-900">{inv.email}</div>
                  <button
                    type="button"
                    onClick={() => cancelInvitation(inv.id)}
                    className="mt-2 text-xs font-semibold text-rose-700"
                  >
                    Avbryt
                  </button>
                </li>
              ))}
              {(!invitations || invitations.length === 0) && (
                <li className="text-xs text-slate-600">Inga väntande inbjudningar.</li>
              )}
            </ul>
          </section>
        </>
      )}

      {feedback ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-700">{feedback}</p>
        </section>
      ) : null}
    </div>
  );
}

function HandledareMobilePanel({ forcedTab }: { forcedTab?: HandledareMobileTab }) {
  const [students, setStudents] = useState<HandledareStudent[]>([]);
  const [clinicId, setClinicId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedStUserId, setSelectedStUserId] = useState<string | null>(null);
  const [selectedStName, setSelectedStName] = useState<string>("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setLoading(true);
        const userId = await getAuthenticatedUserId();
        if (!userId) {
          if (live) setStudents([]);
          return;
        }
        const currentClinicId = await getClinicIdForCurrentUserRole("huvudhandledare");
        if (live) setClinicId(String(currentClinicId || ""));

        const { data: rows } = await listSupervisorAssignedStudentIds(userId);
        const ids = Array.from(
          new Set((rows || []).map((r: any) => String(r.st_lakare_id || "")).filter(Boolean))
        );
        if (ids.length === 0) {
          if (live) setStudents([]);
          return;
        }
        const { data: profs } = await listProfilesByIds(ids, "id,name,specialty,goals_version");
        if (!live) return;
        setStudents(
          (profs || []).map((p: any) => ({
            id: String(p.id),
            name: String(p.name || "Okänd ST-läkare"),
            specialty: String(p.specialty || ""),
            goalsVersion: String(p.goals_version || "2021"),
          }))
        );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Huvudhandledare</h2>
      </section>

      {(forcedTab || "st-lakare") === "st-lakare" && (
        <>
          {selectedStUserId ? (
            <StudierektorMobileStDetail
              stUserId={selectedStUserId}
              stName={selectedStName}
              clinicId={clinicId}
              meetingOptionLabel="Huvudhandledarträff"
              onBack={() => {
                setSelectedStUserId(null);
                setSelectedStName("");
              }}
            />
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Tilldelade ST-läkare</h3>
              {loading ? (
                <p className="mt-2 text-sm text-slate-700">Laddar...</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {students.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStUserId(s.id);
                          setSelectedStName(s.name);
                        }}
                        className="w-full rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-slate-900">{s.name}</span>
                          <span className="text-xs font-semibold text-sky-700">Öppna</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">Mål {s.goalsVersion}</div>
                      </button>
                    </li>
                  ))}
                  {students.length === 0 && (
                    <li className="text-xs text-slate-600">Inga tilldelningar hittades.</li>
                  )}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}


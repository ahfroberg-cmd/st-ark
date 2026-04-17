"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  dismissSrMessageById,
  fetchClinicMembershipForUser,
  insertSrMessages,
  listClinicMembershipsByClinicId,
  listIncomingMessagesForUser,
  listIncomingSuggestionsForUser,
  listProfilesByIds,
  listSentMessagesForUser,
  markSrMessageReadById,
  respondSrSuggestionById,
} from "@/lib/repositories/starkRepository";

type ClinicColleague = {
  userId: string;
  role: "st_lakare" | "studierektor" | "huvudhandledare" | string;
  name: string;
  specialty: string;
  email?: string;
  mobile?: string;
  phoneWork?: string;
};

type Mailbox = "inkorg" | "skickat";
type MainTab = "kommunikation" | "kollegor";

export default function MobileHemklinik() {
  const [meId, setMeId] = useState("");
  const [clinicId, setClinicId] = useState("");
  const [mainTab, setMainTab] = useState<MainTab>("kommunikation");
  const [mailbox, setMailbox] = useState<Mailbox>("inkorg");
  const [colleagues, setColleagues] = useState<ClinicColleague[]>([]);
  const [incomingMessages, setIncomingMessages] = useState<any[]>([]);
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [incomingSuggestions, setIncomingSuggestions] = useState<any[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipients, setComposeRecipients] = useState<string[]>([]);
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const colleagueById = useMemo(
    () => new Map(colleagues.map((c) => [c.userId, c])),
    [colleagues]
  );

  const loadHemklinikData = useCallback(async () => {
    if (!meId) return;
    setLoading(true);
    try {
      const myClinicRes = await fetchClinicMembershipForUser(meId);
      const cid = String((myClinicRes.data as any)?.clinic_id || "");
      setClinicId(cid);

      let nextColleagues: ClinicColleague[] = [];
      if (cid) {
        const memberRes = await listClinicMembershipsByClinicId(cid);
        const userIds = Array.from(
          new Set((memberRes.data || []).map((m: any) => String(m.user_id || "")).filter(Boolean))
        );
        const profileRes =
          userIds.length > 0
            ? await listProfilesByIds(
                userIds,
                "id,name,specialty,speciality,email,mobile,phone_work"
              )
            : { data: [] as any[] };
        const profileById = new Map<string, Record<string, unknown>>(
          (profileRes.data || []).map((p: any) => [String(p.id), p as Record<string, unknown>])
        );
        nextColleagues = (memberRes.data || [])
          .map((m: any) => {
            const p = profileById.get(String(m.user_id || ""));
            return {
              userId: String(m.user_id || ""),
              role: String(m.role || "st_lakare"),
              name: String(p?.name || "Okänd"),
              specialty: String(p?.specialty || p?.speciality || ""),
              email: String(p?.email || ""),
              mobile: String(p?.mobile || ""),
              phoneWork: String(p?.phone_work || ""),
            } as ClinicColleague;
          })
          .sort((a, b) => a.name.localeCompare(b.name, "sv", { sensitivity: "base" }));
      }
      setColleagues(nextColleagues);

      const [inboxRes, sentRes, sugRes] = await Promise.all([
        listIncomingMessagesForUser(meId, 40),
        listSentMessagesForUser(meId, 60),
        listIncomingSuggestionsForUser(meId, 40),
      ]);

      setIncomingMessages(inboxRes.data || []);
      setSentMessages(sentRes.data || []);
      setIncomingSuggestions(sugRes.data || []);
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
    loadHemklinikData();
  }, [loadHemklinikData]);

  useEffect(() => {
    if (!meId) return;
    const channel = supabase
      .channel(`mobile-hemklinik:${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sr_messages" }, () => {
        loadHemklinikData();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sr_activity_suggestions" },
        () => {
          loadHemklinikData();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, loadHemklinikData]);

  const toggleRecipient = (userId: string) => {
    setComposeRecipients((prev) => {
      if (prev.includes(userId)) return prev.filter((v) => v !== userId);
      return [...prev, userId];
    });
  };

  const sendMessage = useCallback(async () => {
    const text = composeText.trim();
    if (!text || !meId || !clinicId || composeRecipients.length === 0) return;
    setSending(true);
    setFeedback(null);
    try {
      const payload = composeRecipients.map((rid) => ({
        sender_id: meId,
        recipient_id: rid,
        clinic_id: clinicId,
        message_text: text,
        channel: "st_ark",
        read: false,
        dismissed: false,
      }));
      const { error } = await insertSrMessages(payload);
      if (error) throw error;
      setComposeText("");
      setComposeRecipients([]);
      setComposeOpen(false);
      setFeedback("Meddelande skickat.");
      await loadHemklinikData();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Kunde inte skicka meddelande.");
    } finally {
      setSending(false);
    }
  }, [composeText, meId, clinicId, composeRecipients, loadHemklinikData]);

  const markRead = useCallback(
    async (id: string) => {
      await markSrMessageReadById(id, meId);
      await loadHemklinikData();
    },
    [meId, loadHemklinikData]
  );

  const dismissMessage = useCallback(
    async (id: string) => {
      await dismissSrMessageById(id, meId);
      await loadHemklinikData();
    },
    [meId, loadHemklinikData]
  );

  const suggestionTitle = (s: any) => {
    const d = (s?.activity_data || {}) as Record<string, string>;
    return String(d.title || d.courseTitle || s.activity_type || "Förslag");
  };

  const respondSuggestion = useCallback(
    async (id: string, status: "accepted" | "dismissed") => {
      await respondSrSuggestionById(id, meId, status);
      await loadHemklinikData();
    },
    [meId, loadHemklinikData]
  );

  const mailboxRows = mailbox === "inkorg" ? incomingMessages : sentMessages;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Hemklinik</h2>
          <div className="inline-flex rounded-lg border border-slate-300 p-1">
            <button
              type="button"
              onClick={() => setMainTab("kommunikation")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                mainTab === "kommunikation" ? "bg-emerald-600 text-white" : "text-slate-700"
              }`}
            >
              Kommunikation
            </button>
            <button
              type="button"
              onClick={() => setMainTab("kollegor")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                mainTab === "kollegor" ? "bg-emerald-600 text-white" : "text-slate-700"
              }`}
            >
              Kollegor
            </button>
          </div>
        </div>
      </section>

      {mainTab === "kommunikation" ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="inline-flex rounded-lg border border-slate-300 p-1">
                <button
                  type="button"
                  onClick={() => setMailbox("inkorg")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    mailbox === "inkorg" ? "bg-sky-600 text-white" : "text-slate-700"
                  }`}
                >
                  Inkorg
                </button>
                <button
                  type="button"
                  onClick={() => setMailbox("skickat")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    mailbox === "skickat" ? "bg-sky-600 text-white" : "text-slate-700"
                  }`}
                >
                  Skickat
                </button>
              </div>
              <button
                type="button"
                onClick={() => setComposeOpen((v) => !v)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Nytt meddelande
              </button>
            </div>

            {composeOpen && (
              <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Mottagare</p>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {colleagues
                    .filter((c) => c.userId !== meId)
                    .map((c) => (
                      <label key={c.userId} className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={composeRecipients.includes(c.userId)}
                          onChange={() => toggleRecipient(c.userId)}
                        />
                        <span>
                          {c.name} · {c.role}
                        </span>
                      </label>
                    ))}
                </div>
                <textarea
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  placeholder="Skriv meddelande..."
                  className="mt-3 min-h-[88px] w-full rounded-lg border border-slate-300 p-3 text-sm"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={sending || composeRecipients.length === 0 || !composeText.trim()}
                    className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {sending ? "Skickar..." : "Skicka"}
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-sm text-slate-700">Laddar...</p>
            ) : (
              <ul className="space-y-2">
                {mailboxRows.map((m: any) => (
                  <li key={m.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">
                      {new Date(m.created_at).toLocaleString("sv-SE")}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                      {String(m.message_text || "")}
                    </div>
                    {mailbox === "inkorg" && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => markRead(m.id)}
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
                    )}
                  </li>
                ))}
                {mailboxRows.length === 0 && (
                  <li className="text-xs text-slate-600">Inga meddelanden.</li>
                )}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Aktivitetsförslag</h3>
            <ul className="mt-3 space-y-2">
              {incomingSuggestions.map((s: any) => (
                <li key={s.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">
                    {new Date(s.created_at).toLocaleString("sv-SE")}
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{suggestionTitle(s)}</div>
                  <div className="text-xs text-slate-600">Status: {String(s.status || "pending")}</div>
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
            {feedback ? <p className="mt-2 text-xs text-slate-700">{feedback}</p> : null}
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Kollegor i hemkliniken</h3>
          <ul className="mt-3 space-y-2">
            {colleagues.map((c) => (
              <li key={`${c.userId}-${c.role}`} className="rounded-lg border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-600">
                  {c.role} · {c.specialty || "Specialitet saknas"}
                </div>
                {(c.email || c.mobile || c.phoneWork) && (
                  <div className="mt-1 text-xs text-slate-600">
                    {c.email ? `E-post: ${c.email}` : ""} {c.mobile ? `Mobil: ${c.mobile}` : ""}{" "}
                    {c.phoneWork ? `Arbete: ${c.phoneWork}` : ""}
                  </div>
                )}
              </li>
            ))}
            {colleagues.length === 0 && (
              <li className="text-xs text-slate-600">Inga kollegor hittades i hemkliniken.</li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}


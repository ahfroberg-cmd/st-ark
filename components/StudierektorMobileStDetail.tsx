"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStudierektorStOverview } from "@/lib/hooks/useStudierektorData";
import {
  insertSrActivitySuggestions,
  insertSrMessages,
  listSrMessagesBetweenUsers,
  listSrSuggestionsBetweenUsers,
} from "@/lib/repositories/starkRepository";

type Props = {
  stUserId: string;
  stName?: string;
  clinicId?: string;
  meetingOptionLabel?: string;
  onBack: () => void;
};

type DetailTab = "overview" | "communication";
type SuggestType = "placement" | "course" | "sr_meeting" | "progression_assessment";

const toIsoOrEmpty = (value: unknown) => {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!v) return "";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
};

const stamp = (value: string) => {
  if (!value) return 0;
  const t = new Date(`${value}T00:00:00`).getTime();
  return isNaN(t) ? 0 : t;
};

const fmtDate = (value: string) => {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("sv-SE");
};

const todayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
};

function DualRow({ title, latestLabel, nextLabel }: { title: string; latestLabel: string; nextLabel: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Senaste</div>
          <div className="mt-1 text-sm text-slate-900">{latestLabel}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nästa</div>
          <div className="mt-1 text-sm text-slate-900">{nextLabel}</div>
        </div>
      </div>
    </section>
  );
}

export default function StudierektorMobileStDetail({
  stUserId,
  stName,
  clinicId,
  meetingOptionLabel = "Studierektorsmöte",
  onBack,
}: Props) {
  const { profile, placements, courses, meetings, directorMeetings, loading, error } =
    useStudierektorStOverview(stUserId);
  const today = todayIso();
  const [tab, setTab] = useState<DetailTab>("overview");

  const [meId, setMeId] = useState("");
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [suggestType, setSuggestType] = useState<SuggestType>("placement");
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestStart, setSuggestStart] = useState("");
  const [suggestEnd, setSuggestEnd] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const [sendingSuggest, setSendingSuggest] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const [historySuggestions, setHistorySuggestions] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (alive) setMeId(String(user?.id || ""));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadHistory = useCallback(async () => {
    if (!meId || !stUserId) return;
    const [{ data: mRows }, { data: sRows }] = await Promise.all([
      listSrMessagesBetweenUsers(meId, stUserId, 20),
      listSrSuggestionsBetweenUsers(meId, stUserId, 20),
    ]);
    setHistoryMessages(mRows || []);
    setHistorySuggestions(sRows || []);
  }, [meId, stUserId]);

  useEffect(() => {
    if (historyOpen) loadHistory();
  }, [historyOpen, loadHistory]);

  const effectiveClinicId = String(clinicId || "");
  const isDateRangeSuggestion = suggestType === "placement" || suggestType === "course";
  const canSendSuggestion = !!suggestTitle.trim() && !!suggestStart.trim();

  const sendMessage = useCallback(async () => {
    if (!meId || !stUserId || !effectiveClinicId || !messageText.trim()) return;
    setSendingMessage(true);
    setFeedback(null);
    try {
      const { error: insertErr } = await insertSrMessages({
        sender_id: meId,
        recipient_id: stUserId,
        clinic_id: effectiveClinicId,
        message_text: messageText.trim(),
        channel: "st_ark",
        read: false,
      });
      if (insertErr) throw insertErr;
      setMessageText("");
      setFeedback("Meddelande skickat.");
      if (historyOpen) await loadHistory();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Kunde inte skicka meddelande.");
    } finally {
      setSendingMessage(false);
    }
  }, [meId, stUserId, effectiveClinicId, messageText, historyOpen, loadHistory]);

  const sendSuggestion = useCallback(async () => {
    if (!meId || !stUserId || !effectiveClinicId || !suggestTitle.trim()) return;
    setSendingSuggest(true);
    setFeedback(null);
    try {
      const activityData: Record<string, string> =
        suggestType === "sr_meeting"
          ? {
              title: suggestTitle.trim(),
              dateISO: suggestStart.trim(),
              focus: suggestTitle.trim(),
              note: suggestNote.trim(),
            }
          : suggestType === "progression_assessment"
          ? {
              title: suggestTitle.trim(),
              dateISO: suggestStart.trim(),
              instrument: suggestTitle.trim(),
              summary: suggestNote.trim(),
              note: suggestNote.trim(),
            }
          : {
              title: suggestTitle.trim(),
              startDate: suggestStart.trim(),
              endDate: suggestEnd.trim(),
              note: suggestNote.trim(),
            };
      const { error: insertErr } = await insertSrActivitySuggestions({
        sender_id: meId,
        recipient_id: stUserId,
        clinic_id: effectiveClinicId,
        activity_type: suggestType,
        activity_data: activityData,
        status: "pending",
      });
      if (insertErr) throw insertErr;
      setSuggestTitle("");
      setSuggestStart("");
      setSuggestEnd("");
      setSuggestNote("");
      setFeedback("Aktivitetsförslag skickat.");
      if (historyOpen) await loadHistory();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Kunde inte skicka aktivitetsförslag.");
    } finally {
      setSendingSuggest(false);
    }
  }, [
    meId,
    stUserId,
    effectiveClinicId,
    suggestType,
    suggestTitle,
    suggestStart,
    suggestEnd,
    suggestNote,
    historyOpen,
    loadHistory,
  ]);

  const progressSummary = useMemo(() => {
    const stStart = toIsoOrEmpty(String(profile?.st_start_date || profile?.startDate || ""));
    const stEnd = toIsoOrEmpty(String(profile?.st_end_date || profile?.endDate || ""));
    let timePct = 0;
    if (stStart && stEnd) {
      const totalMs = Math.max(1, stamp(stEnd) - stamp(stStart));
      const workedUntil = stamp(today) > stamp(stEnd) ? stEnd : today;
      const workedMs = Math.max(0, stamp(workedUntil) - stamp(stStart));
      timePct = Math.max(0, Math.min(100, (workedMs / totalMs) * 100));
    }

    const achievedMilestones = new Set(
      (Array.isArray(placements) ? placements : [])
        .flatMap((p: any) => (Array.isArray(p?.milestones) ? p.milestones : []))
        .concat((Array.isArray(courses) ? courses : []).flatMap((c: any) => (Array.isArray(c?.milestones) ? c.milestones : [])))
        .map((x: any) => String(x || "").trim())
        .filter(Boolean)
    );
    const delmalTotal = String(profile?.goals_version || "2021") === "2021" ? 24 : 50;
    const delmalPct = Math.max(0, Math.min(100, (achievedMilestones.size / delmalTotal) * 100));
    return { timePct, delmalPct };
  }, [profile, placements, courses, today]);

  const summary = useMemo(() => {
    const pList = [...(placements || [])]
      .map((p: any) => ({
        title: String(p?.title || p?.clinic || p?.type || "Placering"),
        start: toIsoOrEmpty(String(p?.start_date || p?.startDate || "")),
        end: toIsoOrEmpty(String(p?.end_date || p?.endDate || "")),
      }))
      .filter((p) => p.start);
    const cList = [...(courses || [])]
      .map((c: any) => ({
        title: String(c?.course_title || c?.courseTitle || c?.title || "Kurs"),
        start: toIsoOrEmpty(
          String(c?.start_date || c?.startDate || c?.certificate_date || c?.certificateDate || "")
        ),
        end: toIsoOrEmpty(String(c?.end_date || c?.endDate || "")),
      }))
      .filter((c) => c.start);
    const hList = [...(meetings || [])]
      .map((m: any) => ({
        title: String(m?.title || "Handledarsamtal"),
        date: toIsoOrEmpty(String(m?.dateISO || "")),
      }))
      .filter((m) => m.date);
    const srList = [...(directorMeetings || [])]
      .map((m: any) => ({
        title: String(m?.title || "Studierektorsmöte"),
        date: toIsoOrEmpty(String(m?.dateISO || "")),
      }))
      .filter((m) => m.date);

    const ongoingPlacement = pList.find((p) => p.start <= today && (!p.end || p.end >= today)) || null;
    const nextPlacement = pList.filter((p) => p.start > today).sort((a, b) => stamp(a.start) - stamp(b.start))[0] || null;
    const latestCourse = cList.filter((c) => c.start <= today).sort((a, b) => stamp(b.start) - stamp(a.start))[0] || null;
    const nextCourse = cList.filter((c) => c.start > today).sort((a, b) => stamp(a.start) - stamp(b.start))[0] || null;
    const latestMeeting = hList.filter((m) => m.date <= today).sort((a, b) => stamp(b.date) - stamp(a.date))[0] || null;
    const nextMeeting = hList.filter((m) => m.date > today).sort((a, b) => stamp(a.date) - stamp(b.date))[0] || null;
    const latestSrMeeting = srList.filter((m) => m.date <= today).sort((a, b) => stamp(b.date) - stamp(a.date))[0] || null;
    const nextSrMeeting = srList.filter((m) => m.date > today).sort((a, b) => stamp(a.date) - stamp(b.date))[0] || null;

    return {
      ongoingPlacement,
      nextPlacement,
      latestCourse,
      nextCourse,
      latestMeeting,
      nextMeeting,
      latestSrMeeting,
      nextSrMeeting,
    };
  }, [placements, courses, meetings, directorMeetings, today]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Översikt</h3>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Tillbaka
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-800">{stName || String(profile?.name || "ST-läkare")}</p>
        <p className="mt-1 text-xs text-slate-600">Mål {String(profile?.goals_version || "2021")}</p>
        <div className="mt-3 inline-flex rounded-lg border border-slate-300 p-1">
          <button
            type="button"
            onClick={() => setTab("overview")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === "overview" ? "bg-sky-600 text-white" : "text-slate-700"
            }`}
          >
            Översikt
          </button>
          <button
            type="button"
            onClick={() => setTab("communication")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === "communication" ? "bg-sky-600 text-white" : "text-slate-700"
            }`}
          >
            Kommunikation
          </button>
        </div>
      </section>

      {loading && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-700">Laddar ST-översikt...</p>
        </section>
      )}

      {error && !loading && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-sm text-rose-700">{error}</p>
        </section>
      )}

      {!loading && tab === "overview" && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-900">Progression</h4>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Progression i tid</span>
                  <span className="text-xs font-semibold text-slate-900">{progressSummary.timePct.toFixed(0)} %</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-sky-100">
                  <div
                    className="h-2 rounded-full bg-sky-500"
                    style={{ width: `${Math.max(0, Math.min(100, progressSummary.timePct))}%` }}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Progression i delmål</span>
                  <span className="text-xs font-semibold text-slate-900">{progressSummary.delmalPct.toFixed(0)} %</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-emerald-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${Math.max(0, Math.min(100, progressSummary.delmalPct))}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-900">Placeringar</h4>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pågående</div>
                <div className="mt-1 text-sm text-slate-900">
                  {summary.ongoingPlacement
                    ? `${summary.ongoingPlacement.title} (${fmtDate(summary.ongoingPlacement.start)} - ${fmtDate(
                        summary.ongoingPlacement.end || ""
                      )})`
                    : "Ingen pågående placering"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nästa</div>
                <div className="mt-1 text-sm text-slate-900">
                  {summary.nextPlacement
                    ? `${summary.nextPlacement.title} (${fmtDate(summary.nextPlacement.start)} - ${fmtDate(
                        summary.nextPlacement.end || ""
                      )})`
                    : "Ingen kommande placering"}
                </div>
              </div>
            </div>
          </section>

          <DualRow
            title="Kurser"
            latestLabel={
              summary.latestCourse
                ? `${summary.latestCourse.title} (${fmtDate(summary.latestCourse.start)})`
                : "Ingen genomförd kurs"
            }
            nextLabel={
              summary.nextCourse ? `${summary.nextCourse.title} (${fmtDate(summary.nextCourse.start)})` : "Ingen kommande kurs"
            }
          />
          <DualRow
            title="Handledarträffar"
            latestLabel={
              summary.latestMeeting
                ? `${summary.latestMeeting.title} (${fmtDate(summary.latestMeeting.date)})`
                : "Ingen tidigare handledarträff"
            }
            nextLabel={
              summary.nextMeeting
                ? `${summary.nextMeeting.title} (${fmtDate(summary.nextMeeting.date)})`
                : "Ingen kommande handledarträff"
            }
          />
          <DualRow
            title="Studierektorsmöten"
            latestLabel={
              summary.latestSrMeeting
                ? `${summary.latestSrMeeting.title} (${fmtDate(summary.latestSrMeeting.date)})`
                : "Inget tidigare studierektorsmöte"
            }
            nextLabel={
              summary.nextSrMeeting
                ? `${summary.nextSrMeeting.title} (${fmtDate(summary.nextSrMeeting.date)})`
                : "Inget kommande studierektorsmöte"
            }
          />
        </>
      )}

      {!loading && tab === "communication" && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-900">Skicka meddelande</h4>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Meddelande till denna ST-läkare"
              className="mt-3 min-h-[96px] w-full rounded-lg border border-slate-300 p-3 text-sm"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={sendingMessage || !messageText.trim()}
              className="mt-3 h-11 w-full rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {sendingMessage ? "Skickar..." : "Skicka meddelande"}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-900">Skicka aktivitetsförslag</h4>
            <div className="mt-3 space-y-2">
              <select
                value={suggestType}
                onChange={(e) => setSuggestType(e.target.value as SuggestType)}
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="placement">Placering</option>
                <option value="course">Kurs</option>
                <option value="sr_meeting">{meetingOptionLabel}</option>
                <option value="progression_assessment">Progressionsbedömning</option>
              </select>
              <input
                type="text"
                value={suggestTitle}
                onChange={(e) => setSuggestTitle(e.target.value)}
                placeholder={
                  suggestType === "course"
                    ? "Kursnamn"
                    : suggestType === "sr_meeting"
                    ? "Fokus / rubrik"
                    : suggestType === "progression_assessment"
                    ? "Instrument / rubrik"
                    : "Placering"
                }
                className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
              {isDateRangeSuggestion ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={suggestStart}
                    onChange={(e) => setSuggestStart(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                  />
                  <input
                    type="date"
                    value={suggestEnd}
                    onChange={(e) => setSuggestEnd(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                  />
                </div>
              ) : (
                <input
                  type="date"
                  value={suggestStart}
                  onChange={(e) => setSuggestStart(e.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm"
                />
              )}
              <textarea
                value={suggestNote}
                onChange={(e) => setSuggestNote(e.target.value)}
                placeholder={
                  suggestType === "progression_assessment"
                    ? "Sammanfattning / notering (valfritt)"
                    : "Notering (valfritt)"
                }
                className="min-h-[72px] w-full rounded-lg border border-slate-300 p-3 text-sm"
              />
              <button
                type="button"
                onClick={sendSuggestion}
                disabled={sendingSuggest || !canSendSuggestion}
                className="h-11 w-full rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sendingSuggest ? "Skickar..." : "Skicka förslag"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-sm font-semibold text-slate-900">Historik</span>
              <span
                className={`inline-block text-slate-500 transition-transform ${
                  historyOpen ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>
            {historyOpen && (
              <div className="mt-3 space-y-3">
                <div>
                  <h5 className="text-xs font-semibold text-slate-700">Meddelanden</h5>
                  <ul className="mt-2 space-y-2">
                    {historyMessages.map((m) => (
                      <li key={m.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] text-slate-500">
                          {new Date(m.created_at).toLocaleString("sv-SE")}
                        </div>
                        <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                          {String(m.message_text || "")}
                        </div>
                      </li>
                    ))}
                    {historyMessages.length === 0 && (
                      <li className="text-xs text-slate-600">Ingen meddelandehistorik.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-slate-700">Förslag</h5>
                  <ul className="mt-2 space-y-2">
                    {historySuggestions.map((s) => (
                      <li key={s.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[11px] text-slate-500">
                          {new Date(s.created_at).toLocaleString("sv-SE")}
                        </div>
                        <div className="mt-1 text-sm text-slate-900">
                          {String((s.activity_data || {}).title || s.activity_type || "Förslag")}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-600">Status: {String(s.status || "pending")}</div>
                      </li>
                    ))}
                    {historySuggestions.length === 0 && (
                      <li className="text-xs text-slate-600">Ingen förslagshistorik.</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </section>

          {feedback ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-xs text-slate-700">{feedback}</p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

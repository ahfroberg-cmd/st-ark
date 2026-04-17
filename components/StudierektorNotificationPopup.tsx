"use client";

import { useEffect, useState, useCallback } from "react";
import { getSessionUser } from "@/lib/supabase";
import {
  dismissSrMessageById,
  fetchIupAssessmentsOnly,
  fetchIupDirectorMeetingsOnly,
  listPendingIncomingMessagesOldestFirst,
  listPendingSuggestionsOldestFirst,
  listProfilesByIds,
  respondSrSuggestionById,
  saveCourseForUser,
  savePlacementForUser,
  upsertIupSettingsOnUserId,
} from "@/lib/repositories/starkRepository";

interface SrMessage {
  id: string;
  sender_id: string;
  message_text: string;
  channel: string;
  created_at: string;
  senderName?: string;
}

interface SrActivitySuggestion {
  id: string;
  sender_id: string;
  activity_type: "placement" | "leave" | "course" | "sr_meeting" | "progression_assessment";
  activity_data: {
    // placement / course
    title?: string;
    courseTitle?: string;
    startDate?: string;
    endDate?: string;
    note?: string;
    // sr_meeting / progression_assessment
    dateISO?: string;
    focus?: string;
    personalDevelopment?: string;
    extraAssignments?: string;
    instrument?: string;
    instrumentOther?: string;
    level?: string;
    summary?: string;
    strengths?: string;
    development?: string;
  };
  created_at: string;
  senderName?: string;
}

const typeLabels: Record<string, string> = {
  placement: "Placering",
  leave: "Ledighet",
  course: "Kurs",
  sr_meeting: "Studierektorsmöte",
  progression_assessment: "Progressionsbedömning",
};

export default function StudierektorNotificationPopup() {
  const [messages, setMessages] = useState<SrMessage[]>([]);
  const [suggestions, setSuggestions] = useState<SrActivitySuggestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await getSessionUser();
        if (!user?.id) return;

        const { data: msgs } = await listPendingIncomingMessagesOldestFirst(user.id);

        const { data: sugs } = await listPendingSuggestionsOldestFirst(user.id);

        const senderIds = new Set<string>();
        (msgs || []).forEach((m) => senderIds.add(m.sender_id));
        (sugs || []).forEach((s) => senderIds.add(s.sender_id));

        let namesMap = new Map<string, string>();
        if (senderIds.size > 0) {
          const { data: profiles } = await listProfilesByIds(Array.from(senderIds), "id,name");

          if (profiles) {
            profiles.forEach((p: { id: string; name?: string }) =>
              namesMap.set(p.id, p.name || "Studierektor")
            );
          }
        }

        setMessages(
          (msgs || []).map((m) => ({
            ...m,
            senderName: namesMap.get(m.sender_id) || "Studierektor",
          }))
        );
        setSuggestions(
          (sugs || []).map((s) => ({
            ...s,
            senderName: namesMap.get(s.sender_id) || "Studierektor",
          }))
        );
      } catch (err) {
        console.error("StudierektorNotificationPopup: failed to load", err);
      }
    })();
  }, []);

  const allItems = [
    ...messages.map((m) => ({ kind: "message" as const, data: m })),
    ...suggestions.map((s) => ({ kind: "suggestion" as const, data: s })),
  ];

  const dismissCurrent = useCallback(() => {
    if (currentIndex < allItems.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setMessages([]);
      setSuggestions([]);
      setCurrentIndex(0);
    }
    setFeedback(null);
  }, [currentIndex, allItems.length]);

  const handleDismissMessage = async (msgId: string) => {
    setProcessing(true);
    try {
      const user = await getSessionUser();
      if (!user?.id) return;
      await dismissSrMessageById(msgId, user.id);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      dismissCurrent();
    } catch {
      setFeedback({ type: "err", msg: "Kunde inte stänga meddelandet" });
    } finally {
      setProcessing(false);
    }
  };

  const handleDismissSuggestion = async (sugId: string) => {
    setProcessing(true);
    try {
      const user = await getSessionUser();
      if (!user?.id) return;
      await respondSrSuggestionById(sugId, user.id, "dismissed");
      setSuggestions((prev) => prev.filter((s) => s.id !== sugId));
      dismissCurrent();
      setFeedback({ type: "ok", msg: "Förslaget avfärdades" });
      setTimeout(() => setFeedback(null), 2000);
    } catch {
      setFeedback({ type: "err", msg: "Kunde inte avfärda förslaget" });
    } finally {
      setProcessing(false);
    }
  };

  const handleAcceptSuggestion = async (sug: SrActivitySuggestion) => {
    setProcessing(true);
    try {
      const user = await getSessionUser();
      if (!user?.id) throw new Error("Ej inloggad");

      const data = sug.activity_data || {};

      if (sug.activity_type === "placement" || sug.activity_type === "leave") {
        const insertData: Record<string, unknown> = {
          user_id: user.id,
          type: sug.activity_type === "leave" ? "Tjänstledighet" : "Klinisk tjänstgöring",
          clinic: data.title || "",
          start_date: data.startDate || null,
          end_date: data.endDate || null,
          note: data.note || null,
        };
        const { error } = await savePlacementForUser(user.id, insertData);
        if (error) throw error;

      } else if (sug.activity_type === "course") {
        // title är "Annan kurs" eller kursnamn; courseTitle är fritext för "Annan kurs"
        const effectiveTitle = data.title === "Annan kurs" && data.courseTitle
          ? data.courseTitle
          : (data.title || "Kurs");
        const insertData: Record<string, unknown> = {
          user_id: user.id,
          title: effectiveTitle,
          course_title: data.courseTitle || null,
          start_date: data.startDate || null,
          end_date: data.endDate || null,
          note: data.note || null,
        };
        const { error } = await saveCourseForUser(user.id, insertData);
        if (error) throw error;

      } else if (sug.activity_type === "sr_meeting") {
        const { data: iupRow } = await fetchIupDirectorMeetingsOnly(user.id);
        const existing = Array.isArray(iupRow?.director_meetings) ? iupRow.director_meetings : [];
        const newMeeting = {
          id: String(Date.now()),
          dateISO: data.dateISO || "",
          focus: data.focus || "",
          personalDevelopment: data.note || "",
          extraAssignments: "",
          note: data.note || "",
          planningForward: {},
        };
        const { error } = await upsertIupSettingsOnUserId({
          user_id: user.id,
          director_meetings: [...existing, newMeeting],
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;

      } else if (sug.activity_type === "progression_assessment") {
        const { data: iupRow } = await fetchIupAssessmentsOnly(user.id);
        const existing = Array.isArray(iupRow?.assessments) ? iupRow.assessments : [];
        const newAssessment = {
          id: String(Date.now()),
          dateISO: data.dateISO || "",
          phase: "ST" as const,
          level: data.level || "",
          instrument: data.instrumentOther || data.instrument || "",
          summary: data.summary || "",
          note: data.note || "",
        };
        const { error } = await upsertIupSettingsOnUserId({
          user_id: user.id,
          assessments: [...existing, newAssessment],
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }

      await respondSrSuggestionById(sug.id, user.id, "accepted");

      setSuggestions((prev) => prev.filter((s) => s.id !== sug.id));
      setFeedback({ type: "ok", msg: `${typeLabels[sug.activity_type]} har lagts till!` });
      setTimeout(() => {
        dismissCurrent();
        setFeedback(null);
      }, 1500);
    } catch (err) {
      setFeedback({
        type: "err",
        msg: "Kunde inte godkänna: " + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setProcessing(false);
    }
  };

  // Recalculate allItems after state changes
  const currentItems = [
    ...messages.map((m) => ({ kind: "message" as const, data: m })),
    ...suggestions.map((s) => ({ kind: "suggestion" as const, data: s })),
  ];

  if (currentItems.length === 0) return null;

  const safeIndex = Math.min(currentIndex, currentItems.length - 1);
  const item = currentItems[safeIndex];

  return (
    <div className="fixed inset-0 z-[350] bg-black/60 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Counter */}
        {currentItems.length > 1 && (
          <p className="text-xs text-slate-500 mb-2">
            {safeIndex + 1} av {currentItems.length} notiser
          </p>
        )}

        {item.kind === "message" ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-sky-100 text-sky-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Meddelande från studierektor</h3>
                <p className="text-xs text-slate-500">
                  {(item.data as SrMessage).senderName} &middot;{" "}
                  {new Date((item.data as SrMessage).created_at).toLocaleDateString("sv-SE")}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">
                {(item.data as SrMessage).message_text}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => handleDismissMessage((item.data as SrMessage).id)}
                disabled={processing}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                OK
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-emerald-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Aktivitetsförslag</h3>
                <p className="text-xs text-slate-500">
                  {(item.data as SrActivitySuggestion).senderName} &middot;{" "}
                  {new Date((item.data as SrActivitySuggestion).created_at).toLocaleDateString("sv-SE")}
                </p>
              </div>
            </div>

            {(() => {
              const sug = item.data as SrActivitySuggestion;
              const d = sug.activity_data || {};
              return (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      {typeLabels[sug.activity_type] || sug.activity_type}
                    </span>
                  </div>
                  {/* Placering / Kurs */}
                  {d.title && sug.activity_type !== "sr_meeting" && sug.activity_type !== "progression_assessment" && (
                    <p className="text-sm font-semibold text-slate-900">
                      {d.title === "Annan kurs" && d.courseTitle ? d.courseTitle : d.title}
                    </p>
                  )}
                  {(d.startDate || d.endDate) && (
                    <p className="text-sm text-slate-600">
                      {d.startDate && new Date(d.startDate).toLocaleDateString("sv-SE")}
                      {d.endDate && ` – ${new Date(d.endDate).toLocaleDateString("sv-SE")}`}
                    </p>
                  )}
                  {d.note && (
                    <p className="text-sm text-slate-600 italic">{d.note}</p>
                  )}
                  {/* Studierektorsmöte */}
                  {sug.activity_type === "sr_meeting" && (
                    <>
                      {d.dateISO && <p className="text-sm text-slate-600">Datum: {new Date(d.dateISO).toLocaleDateString("sv-SE")}</p>}
                      {d.focus && <p className="text-sm font-semibold text-slate-900">{d.focus}</p>}
                      {d.note && <p className="text-sm text-slate-600"><span className="font-medium">Anteckning:</span> {d.note}</p>}
                    </>
                  )}
                  {/* Progressionsbedömning */}
                  {sug.activity_type === "progression_assessment" && (
                    <>
                      {d.dateISO && <p className="text-sm text-slate-600">Datum: {new Date(d.dateISO).toLocaleDateString("sv-SE")}</p>}
                      {(d.instrumentOther || d.instrument) && <p className="text-sm text-slate-600"><span className="font-medium">Instrument:</span> {d.instrumentOther || d.instrument}</p>}
                      {d.level && <p className="text-sm text-slate-600"><span className="font-medium">Tjänstgöring:</span> {d.level}</p>}
                      {d.summary && <p className="text-sm text-slate-600"><span className="font-medium">Bedömning:</span> {d.summary}</p>}
                      {d.note && <p className="text-sm text-slate-600"><span className="font-medium">Anteckning:</span> {d.note}</p>}
                    </>
                  )}
                </div>
              );
            })()}

            {feedback && (
              <div
                className={`mb-3 rounded-lg px-4 py-2 text-sm font-medium ${
                  feedback.type === "ok"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {feedback.msg}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleDismissSuggestion((item.data as SrActivitySuggestion).id)}
                disabled={processing}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Avfärda
              </button>
              <button
                onClick={() => handleAcceptSuggestion(item.data as SrActivitySuggestion)}
                disabled={processing}
                className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {processing ? "Lägger till..." : "Godkänn"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

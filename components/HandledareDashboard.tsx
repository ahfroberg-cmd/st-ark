"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import CalendarDatePicker from "./CalendarDatePicker";
import {
  deleteSrActivitySuggestionById,
  fetchIupMeetingsByUserId,
  fetchIupSettingsIdAndMeetingsByUserId,
  getClinicIdForCurrentUserRole,
  getIupInstrumentsForUser,
  insertIupSettingsRow,
  insertSrActivitySuggestions,
  insertSrMessages,
  listCourseTitlesByUserIdForSuggest,
  listPlacementsForSuggestByUserId,
  listProfilesByIds,
  listSentMessagesByPair,
  listSentSuggestionsByPair,
  listSupervisorAssignedStudentIds,
  updateIupSettingsMeetingsByRowId,
} from "@/lib/repositories/starkRepository";
import { DEFAULT_PROGRESSION_INSTRUMENTS } from "@/lib/dashboard/iupProgressionInstruments";

type DashTab = "handledning" | "suggest";
type SuggestType = "placement" | "course" | "sr_meeting" | "progression_assessment";

const AUTO_PLACEMENT_FALLBACK = "Klinisk tjänstgöring ej planerad aktuellt datum";

type MessageTarget = { userId: string; name: string };
type SentMessage = {
  id: string;
  message_text: string;
  channel: string;
  read: boolean;
  created_at: string;
};
type SentSuggestion = {
  id: string;
  activity_type: string;
  activity_data: Record<string, string>;
  status: string;
  created_at: string;
};

export type HandledareDashboardProps = {
  /** När sann: ingen egen ST-rad eller flikrad — styrs från förälder (t.ex. handledare-sidan). */
  embedded?: boolean;
  selectedStUserId?: string;
  activeTab?: DashTab;
  /** Visningsnamn för vald ST när embedded (t.ex. feedbacktexter). */
  embeddedStName?: string;
};

type Assignment = {
  stUserId: string;
  stName: string;
  goalsVersion: string;
  specialty: string;
};

type Meeting = {
  id: string;
  sourceKey: string;
  dateISO: string;
  focus: string;
  summary: string;
  actions: string;
  nextDateISO?: string;
  supervisorComment?: string;
  supervisorCommentCreatedAt?: string;
  /** Syntetisk rad: datum från fältet nästa planerade samtal på ett genomfört möte */
  isPlannedFollowup?: boolean;
  plannedFromParentSourceKey?: string;
  parentDateISO?: string;
};

export default function HandledareDashboard(props: HandledareDashboardProps = {}) {
  const { embedded = false, selectedStUserId: controlledStId, activeTab: controlledTab, embeddedStName } = props;

  const [loading, setLoading] = useState(!embedded);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedStUserId, setSelectedStUserId] = useState<string>("");
  const [tab, setTab] = useState<DashTab>("handledning");

  const effectiveStId = embedded ? String(controlledStId || "") : selectedStUserId;
  const effectiveTab = embedded ? (controlledTab ?? "handledning") : tab;

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [commentDraftById, setCommentDraftById] = useState<Record<string, string>>({});
  const [openMeetingId, setOpenMeetingId] = useState<string | null>(null);

  const [messageText, setMessageText] = useState("");
  const [messageChannel, setMessageChannel] = useState<"st_ark" | "email">("st_ark");
  const [messageSending, setMessageSending] = useState(false);

  const [suggestType, setSuggestType] = useState<SuggestType>("placement");
  const [suggestSending, setSuggestSending] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestStart, setSuggestStart] = useState("");
  const [suggestEnd, setSuggestEnd] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const [messageTarget, setMessageTarget] = useState<MessageTarget | null>(null);
  const [suggestTarget, setSuggestTarget] = useState<MessageTarget | null>(null);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [sentMessagesLoading, setSentMessagesLoading] = useState(false);
  const [messageHistoryOpen, setMessageHistoryOpen] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [sentSuggestions, setSentSuggestions] = useState<SentSuggestion[]>([]);
  const [sentSuggestionsLoading, setSentSuggestionsLoading] = useState(false);
  const [suggestionHistoryOpen, setSuggestionHistoryOpen] = useState(false);
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<string | null>(null);
  const [recipientCourses, setRecipientCourses] = useState<{ id: string; title: string; courseTitle?: string }[]>([]);
  const [recipientCoursesLoading, setRecipientCoursesLoading] = useState(false);
  const [suggestCourseSelected, setSuggestCourseSelected] = useState("");
  const [suggestCourseCustom, setSuggestCourseCustom] = useState("");
  const [suggestCourseStart, setSuggestCourseStart] = useState("");
  const [suggestCourseEnd, setSuggestCourseEnd] = useState("");
  const [suggestCourseNote, setSuggestCourseNote] = useState("");
  const [suggestMeetingDate, setSuggestMeetingDate] = useState("");
  const [suggestMeetingFocus, setSuggestMeetingFocus] = useState("");
  const [suggestMeetingNote, setSuggestMeetingNote] = useState("");
  const [suggestAssessmentDate, setSuggestAssessmentDate] = useState("");
  const [suggestAssessmentInstrument, setSuggestAssessmentInstrument] = useState("");
  const [suggestAssessmentInstrumentOther, setSuggestAssessmentInstrumentOther] = useState("");
  const [suggestAssessmentLevel, setSuggestAssessmentLevel] = useState("");
  const [suggestAssessmentNote, setSuggestAssessmentNote] = useState("");
  const [recipientInstruments, setRecipientInstruments] = useState<string[]>([...DEFAULT_PROGRESSION_INSTRUMENTS]);
  const [recipientInstrumentsLoading, setRecipientInstrumentsLoading] = useState(false);
  const [suggestSendAsEmail, setSuggestSendAsEmail] = useState(false);

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.stUserId === effectiveStId) || null,
    [assignments, effectiveStId]
  );

  const loadAssignments = useCallback(async () => {
    if (embedded) return;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setAssignments([]);
        return;
      }

      const { data: rows, error } = await listSupervisorAssignedStudentIds(user.id);
      if (error) throw error;

      const stUserIds = Array.from(
        new Set((rows || []).map((r: any) => String(r.st_lakare_id || "").trim()).filter(Boolean))
      );
      if (stUserIds.length === 0) {
        setAssignments([]);
        setSelectedStUserId("");
        return;
      }

      const { data: profs, error: profErr } = await listProfilesByIds(
        stUserIds,
        "id,name,specialty,goals_version"
      );
      if (profErr) throw profErr;

      const mapped = stUserIds
        .map((id) => {
          const p = (profs || []).find((x: any) => String(x.id) === id);
          return {
            stUserId: id,
            stName: String(p?.name || "Okänd ST-läkare"),
            goalsVersion: String(p?.goals_version || "2021"),
            specialty: String(p?.specialty || ""),
          } as Assignment;
        })
        .sort((a, b) => a.stName.localeCompare(b.stName, "sv", { sensitivity: "base" }));

      setAssignments(mapped);
      setSelectedStUserId((prev) => (prev && mapped.some((x) => x.stUserId === prev) ? prev : mapped[0].stUserId));
    } catch (err) {
      setAssignments([]);
      setSelectedStUserId("");
      setFeedback({ type: "err", msg: "Kunde inte ladda tilldelade ST-läkare." });
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [embedded]);

  const loadMeetings = useCallback(async (stUserId: string) => {
    if (!stUserId) {
      setMeetings([]);
      return;
    }
    setMeetingsLoading(true);
    try {
      const { data: row, error } = await fetchIupMeetingsByUserId(stUserId);
      if (error) throw error;

      const list = Array.isArray((row as any)?.meetings) ? ((row as any).meetings as any[]) : [];
      const meetingKey = (m: any, idx: number) => {
        const id = typeof m?.id === "string" ? m.id.trim() : "";
        if (id) return `id:${id}`;
        return `fallback:${String(m?.dateISO || "")}|${String(m?.focus || "")}|${String(m?.summary || "")}|${String(
          m?.actions || ""
        )}|${String(m?.nextDateISO || "")}|${idx}`;
      };
      const mapped = list
        .map((m: any, i: number) => ({
          id: String(m?.id || `meeting-${i}`),
          sourceKey: meetingKey(m, i),
          dateISO: String(m?.dateISO || ""),
          focus: String(m?.focus || ""),
          summary: String(m?.summary || ""),
          actions: String(m?.actions || ""),
          nextDateISO: String(m?.nextDateISO || ""),
          supervisorComment: typeof m?.supervisorComment === "string" ? m.supervisorComment : "",
          supervisorCommentCreatedAt:
            typeof m?.supervisorCommentCreatedAt === "string" ? m.supervisorCommentCreatedAt : "",
        }))
        .filter((m) => m.dateISO)
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

      const today = new Date().toISOString().slice(0, 10);
      const datesWithMeeting = new Set(mapped.map((m) => m.dateISO));
      const addedPlannedDates = new Set<string>();
      const plannedExtras: Meeting[] = [];
      for (const m of mapped) {
        const nd = String(m.nextDateISO || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(nd)) continue;
        if (nd <= today) continue;
        if (datesWithMeeting.has(nd)) continue;
        if (addedPlannedDates.has(nd)) continue;
        addedPlannedDates.add(nd);
        plannedExtras.push({
          id: `planned-next:${m.id}:${nd}`,
          sourceKey: `planned:${m.sourceKey}`,
          dateISO: nd,
          focus: "",
          summary: "",
          actions: "",
          nextDateISO: "",
          supervisorComment: m.supervisorComment,
          supervisorCommentCreatedAt: m.supervisorCommentCreatedAt,
          isPlannedFollowup: true,
          plannedFromParentSourceKey: m.sourceKey,
          parentDateISO: m.dateISO,
        });
      }

      const combined = [...mapped, ...plannedExtras].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
      setMeetings(combined);
      setCommentDraftById(
        Object.fromEntries(
          combined.map((m: Meeting) => {
            const parent =
              m.isPlannedFollowup && m.plannedFromParentSourceKey
                ? mapped.find((p) => p.sourceKey === m.plannedFromParentSourceKey)
                : null;
            const draft = parent ? parent.supervisorComment || "" : m.supervisorComment || "";
            return [m.id, draft];
          })
        )
      );
    } catch (err) {
      setMeetings([]);
      setFeedback({ type: "err", msg: "Kunde inte ladda handledarträffar." });
      console.error(err);
    } finally {
      setMeetingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!embedded) void loadAssignments();
  }, [loadAssignments, embedded]);

  useEffect(() => {
    if (embedded) {
      setLoading(false);
    }
  }, [embedded]);

  useEffect(() => {
    if (!effectiveStId) {
      setMeetings([]);
      return;
    }
    void loadMeetings(effectiveStId);
  }, [effectiveStId, loadMeetings]);

  const resetSuggestForm = useCallback(() => {
    setSuggestTitle("");
    setSuggestStart("");
    setSuggestEnd("");
    setSuggestNote("");
    setSuggestCourseSelected("");
    setSuggestCourseCustom("");
    setSuggestCourseStart("");
    setSuggestCourseEnd("");
    setSuggestCourseNote("");
    setSuggestMeetingDate("");
    setSuggestMeetingFocus("");
    setSuggestMeetingNote("");
    setSuggestAssessmentDate("");
    setSuggestAssessmentInstrument("");
    setSuggestAssessmentInstrumentOther("");
    setSuggestAssessmentLevel("");
    setSuggestAssessmentNote("");
    setSuggestSendAsEmail(false);
  }, []);

  useEffect(() => {
    if (!messageTarget) {
      setSentMessages([]);
      setExpandedMessageId(null);
      setMessageHistoryOpen(false);
      return;
    }
    let cancelled = false;
    setSentMessagesLoading(true);
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id || cancelled) return;
        const { data } = await listSentMessagesByPair(user.id, messageTarget.userId);
        if (!cancelled) setSentMessages(data || []);
      } finally {
        if (!cancelled) setSentMessagesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messageTarget]);

  useEffect(() => {
    if (!suggestTarget || suggestType !== "course") return;
    let cancelled = false;
    setRecipientCoursesLoading(true);
    void (async () => {
      try {
        const { data } = await listCourseTitlesByUserIdForSuggest(suggestTarget.userId);
        if (!cancelled) {
          const mapped = (data || []).map((c: any) => ({
            id: c.id,
            title: c.title || "",
            courseTitle: c.course_title || undefined,
          }));
          setRecipientCourses(mapped);
        }
      } finally {
        if (!cancelled) setRecipientCoursesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suggestTarget, suggestType]);

  useEffect(() => {
    if (!suggestTarget || suggestType !== "progression_assessment") return;
    let cancelled = false;
    setRecipientInstrumentsLoading(true);
    void (async () => {
      try {
        const { data } = await getIupInstrumentsForUser(suggestTarget.userId);
        if (!cancelled) {
          const loaded = data?.instruments;
          setRecipientInstruments(
            Array.isArray(loaded) && loaded.length > 0 ? loaded : [...DEFAULT_PROGRESSION_INSTRUMENTS]
          );
        }
      } finally {
        if (!cancelled) setRecipientInstrumentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suggestTarget, suggestType]);

  useEffect(() => {
    if (!suggestTarget) {
      setSentSuggestions([]);
      setExpandedSuggestionId(null);
      setSuggestionHistoryOpen(false);
      return;
    }
    let cancelled = false;
    setSentSuggestionsLoading(true);
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id || cancelled) return;
        const { data } = await listSentSuggestionsByPair(user.id, suggestTarget.userId);
        if (!cancelled) setSentSuggestions(data || []);
      } finally {
        if (!cancelled) setSentSuggestionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suggestTarget]);

  useEffect(() => {
    if (!suggestTarget || suggestType !== "progression_assessment" || !suggestAssessmentDate) {
      setSuggestAssessmentLevel("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await listPlacementsForSuggestByUserId(suggestTarget.userId);
        if (cancelled || !data) return;
        const date = suggestAssessmentDate;
        const active = data.find((p: any) => {
          const s = p.start_date || "";
          const e = p.end_date || "";
          return s && date >= s && (!e || date <= e);
        });
        if (!cancelled) {
          const label = active ? active.clinic || active.title || AUTO_PLACEMENT_FALLBACK : AUTO_PLACEMENT_FALLBACK;
          setSuggestAssessmentLevel(label);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suggestTarget, suggestType, suggestAssessmentDate]);

  const saveMeetingComment = async (meetingId: string, sourceKey: string, comment: string) => {
    if (!effectiveStId) return;
    setSavingCommentId(meetingId);
    try {
      const effectiveSourceKey = sourceKey.startsWith("planned:") ? sourceKey.slice("planned:".length) : sourceKey;

      const { data: row, error } = await fetchIupSettingsIdAndMeetingsByUserId(effectiveStId);
      if (error) throw error;

      const current = Array.isArray((row as any)?.meetings) ? ((row as any).meetings as any[]) : [];
      const meetingKey = (m: any, idx: number) => {
        const id = typeof m?.id === "string" ? m.id.trim() : "";
        if (id) return `id:${id}`;
        return `fallback:${String(m?.dateISO || "")}|${String(m?.focus || "")}|${String(m?.summary || "")}|${String(
          m?.actions || ""
        )}|${String(m?.nextDateISO || "")}|${idx}`;
      };
      const nextMeetings = current.map((m: any, idx: number) => {
        if (meetingKey(m, idx) !== effectiveSourceKey) return m;
        return {
          ...m,
          supervisorComment: comment,
          supervisorCommentCreatedAt: comment.trim() ? new Date().toISOString() : null,
        };
      });

      if ((row as any)?.id) {
        const { error: updateErr } = await updateIupSettingsMeetingsByRowId(String((row as any).id), nextMeetings);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await insertIupSettingsRow({
          id: "iup",
          user_id: effectiveStId,
          meetings: nextMeetings,
        });
        if (insertErr) throw insertErr;
      }

      const createdAt = comment.trim() ? new Date().toISOString() : "";
      setMeetings((prev) =>
        prev.map((m) => {
          if (m.sourceKey === effectiveSourceKey) {
            return { ...m, supervisorComment: comment, supervisorCommentCreatedAt: createdAt };
          }
          if (m.isPlannedFollowup && m.plannedFromParentSourceKey === effectiveSourceKey) {
            return { ...m, supervisorComment: comment, supervisorCommentCreatedAt: createdAt };
          }
          return m;
        })
      );
      setFeedback({ type: "ok", msg: "Kommentar sparad." });
    } catch (err) {
      setFeedback({ type: "err", msg: "Kunde inte spara kommentar." });
      console.error(err);
    } finally {
      setSavingCommentId(null);
    }
  };

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === openMeetingId) || null,
    [meetings, openMeetingId]
  );

  const handleSendMessage = async () => {
    if (!messageTarget || !messageText.trim()) return;
    setMessageSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Not authenticated");

      const clinicId = await getClinicIdForCurrentUserRole("huvudhandledare");
      if (!clinicId) throw new Error("Ingen klinik hittades");

      const { error } = await insertSrMessages({
        sender_id: user.id,
        recipient_id: messageTarget.userId,
        clinic_id: clinicId,
        message_text: messageText.trim(),
        channel: messageChannel,
        read: false,
      });
      if (error) throw error;

      const recipientName = messageTarget.name;
      const channelLabel = messageChannel === "st_ark" ? "ST-ARK" : "E-post";
      setMessageText("");
      setMessageChannel("st_ark");
      setMessageHistoryOpen(false);
      setMessageTarget(null);
      setFeedback({
        type: "ok",
        msg: `Meddelande skickat till ${recipientName} via ${channelLabel}`,
      });
    } catch (err) {
      setFeedback({ type: "err", msg: "Kunde inte skicka meddelande." });
      console.error(err);
    } finally {
      setMessageSending(false);
    }
  };

  const handleSendSuggestion = async () => {
    if (!suggestTarget) return;
    setSuggestSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Not authenticated");

      const clinicId = await getClinicIdForCurrentUserRole("huvudhandledare");
      if (!clinicId) throw new Error("Ingen klinik hittades");

      let activityData: Record<string, string> = {};

      if (suggestType === "placement") {
        if (suggestTitle.trim()) activityData.title = suggestTitle.trim();
        if (suggestStart) activityData.startDate = suggestStart;
        if (suggestEnd) {
          const end = suggestStart && suggestEnd < suggestStart ? suggestStart : suggestEnd;
          activityData.endDate = end;
        }
        if (suggestNote.trim()) activityData.note = suggestNote.trim();
      } else if (suggestType === "course") {
        const effectiveTitle = suggestCourseSelected === "Annan kurs" ? "Annan kurs" : suggestCourseSelected;
        if (effectiveTitle) activityData.title = effectiveTitle;
        if (suggestCourseSelected === "Annan kurs" && suggestCourseCustom.trim()) {
          activityData.courseTitle = suggestCourseCustom.trim();
        }
        if (suggestCourseStart) activityData.startDate = suggestCourseStart;
        if (suggestCourseEnd) {
          const end =
            suggestCourseStart && suggestCourseEnd < suggestCourseStart
              ? suggestCourseStart
              : suggestCourseEnd;
          activityData.endDate = end;
        }
        if (suggestCourseNote.trim()) activityData.note = suggestCourseNote.trim();
      } else if (suggestType === "sr_meeting") {
        if (suggestMeetingDate) activityData.dateISO = suggestMeetingDate;
        if (suggestMeetingFocus.trim()) activityData.focus = suggestMeetingFocus.trim();
        if (suggestMeetingNote.trim()) activityData.note = suggestMeetingNote.trim();
      } else if (suggestType === "progression_assessment") {
        if (suggestAssessmentDate) activityData.dateISO = suggestAssessmentDate;
        const instrument = suggestAssessmentInstrument === "Annan" ? "Annan" : suggestAssessmentInstrument;
        if (instrument) activityData.instrument = instrument;
        if (suggestAssessmentInstrument === "Annan" && suggestAssessmentInstrumentOther.trim()) {
          activityData.instrumentOther = suggestAssessmentInstrumentOther.trim();
        }
        if (suggestAssessmentLevel.trim()) activityData.level = suggestAssessmentLevel.trim();
        if (suggestAssessmentNote.trim()) activityData.note = suggestAssessmentNote.trim();
      }
      if (suggestSendAsEmail) activityData.sendAsEmail = "true";

      const { error } = await insertSrActivitySuggestions({
        sender_id: user.id,
        recipient_id: suggestTarget.userId,
        clinic_id: clinicId,
        activity_type: suggestType,
        activity_data: activityData,
      });
      if (error) throw error;

      const typeLabels: Record<SuggestType, string> = {
        placement: "Klinisk tjänstgöring",
        course: "Kurs",
        sr_meeting: "Studierektorsmöte",
        progression_assessment: "Progressionsbedömning",
      };
      setFeedback({
        type: "ok",
        msg: `Aktivitetsförslag (${typeLabels[suggestType]}) skickat till ${suggestTarget.name}`,
      });
      setSuggestTarget(null);
      setSuggestType("placement");
      setSuggestionHistoryOpen(false);
      resetSuggestForm();
    } catch (err) {
      setFeedback({ type: "err", msg: "Kunde inte skicka aktivitetsförslag." });
      console.error(err);
    } finally {
      setSuggestSending(false);
    }
  };

  const kommunikationCards = useMemo(() => {
    if (embedded) {
      if (!effectiveStId) return [];
      return [{ stUserId: effectiveStId, stName: embeddedStName || "ST-läkare" }];
    }
    return assignments.map((a) => ({ stUserId: a.stUserId, stName: a.stName }));
  }, [embedded, effectiveStId, embeddedStName, assignments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-600 border-r-transparent" />
      </div>
    );
  }

  const feedbackEl = feedback ? (
    <div
      className={`rounded-lg px-4 py-3 text-sm font-medium ${
        feedback.type === "ok"
          ? "border border-green-200 bg-green-50 text-green-800"
          : "border border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {feedback.msg}
    </div>
  ) : null;

  const mainContent =
    effectiveTab === "handledning" ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-base font-semibold text-slate-900">Handledarträffar</h3>
            {meetingsLoading ? (
              <p className="mt-3 text-sm text-slate-500">Laddar handledarträffar...</p>
            ) : meetings.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Inga registrerade handledarträffar ännu.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                {meetings.map((m) => {
                  const isPlanned = Boolean(m.dateISO && m.dateISO > new Date().toISOString().slice(0, 10));
                  const title = m.isPlannedFollowup
                    ? `Planerat handledarsamtal (${m.dateISO || "-"})`
                    : `Handledarsamtal (${m.dateISO || "-"})`;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setOpenMeetingId(m.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-slate-300 hover:bg-slate-100"
                    >
                      <span className="text-sm font-semibold text-slate-900">{title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          isPlanned ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {isPlanned ? "Planerad" : "Genomförd"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : embedded ? (
          <div className="space-y-4">
            {(() => {
              const c = kommunikationCards[0];
              if (!c) {
                return (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                    Ingen ST-läkare vald.
                  </div>
                );
              }
              return (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-base font-semibold text-slate-900">Meddelanden</h3>
                    <p className="mt-1 text-sm text-slate-600">Skicka meddelande till {c.stName}.</p>
                    {messageTarget?.userId !== c.stUserId ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setMessageTarget({ userId: c.stUserId, name: c.stName });
                            setMessageText("");
                            setMessageChannel("st_ark");
                            setMessageHistoryOpen(false);
                          }}
                          className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-colors"
                        >
                          Öppna meddelanden
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <textarea
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          rows={4}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                        />
                        <div className="flex items-end justify-between gap-4">
                          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={messageChannel === "email"}
                              onChange={(e) => setMessageChannel(e.target.checked ? "email" : "st_ark")}
                              className="h-4 w-4 rounded border-slate-300 text-sky-600"
                            />
                            <span>Skicka även som e-post</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setMessageTarget(null)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Stäng
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSendMessage()}
                              disabled={!messageText.trim() || messageSending}
                              className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                            >
                              {messageSending ? "Skickar..." : "Skicka"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="text-base font-semibold text-slate-900">Föreslå aktivitet</h3>
                    <p className="mt-1 text-sm text-slate-600">Skicka aktivitetsförslag till {c.stName}.</p>
                    {suggestTarget?.userId !== c.stUserId ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSuggestTarget({ userId: c.stUserId, name: c.stName });
                            setSuggestType("placement");
                            resetSuggestForm();
                            setSuggestionHistoryOpen(false);
                          }}
                          className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          Öppna aktivitetsförslag
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              { value: "placement" as const, label: "Klinisk tjänstgöring" },
                              { value: "course" as const, label: "Kurs" },
                              { value: "sr_meeting" as const, label: "Huvudhandledarträff" },
                              { value: "progression_assessment" as const, label: "Progressionsbedömning" },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setSuggestType(opt.value);
                                resetSuggestForm();
                              }}
                              className={`rounded-lg border px-3 py-2 text-xs font-semibold text-left ${
                                suggestType === opt.value
                                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {suggestType === "placement" && (
                          <>
                            <input
                              type="text"
                              value={suggestTitle}
                              onChange={(e) => setSuggestTitle(e.target.value)}
                              placeholder="Placering"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <CalendarDatePicker value={suggestStart} onChange={setSuggestStart} />
                              <CalendarDatePicker value={suggestEnd} onChange={setSuggestEnd} />
                            </div>
                            <textarea
                              value={suggestNote}
                              onChange={(e) => setSuggestNote(e.target.value)}
                              rows={2}
                              placeholder="Anteckning (valfritt)"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none"
                            />
                          </>
                        )}

                        {suggestType === "course" && (
                          <>
                            <select
                              value={suggestCourseSelected}
                              onChange={(e) => {
                                setSuggestCourseSelected(e.target.value);
                                setSuggestCourseCustom("");
                              }}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                              <option value="">Välj kurs…</option>
                              {recipientCourses.map((rc) => (
                                <option
                                  key={rc.id}
                                  value={rc.courseTitle && rc.title === "Annan kurs" ? rc.courseTitle : rc.title}
                                >
                                  {rc.title === "Annan kurs" && rc.courseTitle ? rc.courseTitle : rc.title}
                                </option>
                              ))}
                              <option value="Annan kurs">Annan kurs</option>
                            </select>
                            {suggestCourseSelected === "Annan kurs" && (
                              <input
                                type="text"
                                value={suggestCourseCustom}
                                onChange={(e) => setSuggestCourseCustom(e.target.value)}
                                placeholder="Kursens titel"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <CalendarDatePicker value={suggestCourseStart} onChange={setSuggestCourseStart} />
                              <CalendarDatePicker value={suggestCourseEnd} onChange={setSuggestCourseEnd} />
                            </div>
                            <textarea
                              value={suggestCourseNote}
                              onChange={(e) => setSuggestCourseNote(e.target.value)}
                              rows={2}
                              placeholder="Anteckning (valfritt)"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none"
                            />
                          </>
                        )}

                        {suggestType === "sr_meeting" && (
                          <>
                            <CalendarDatePicker value={suggestMeetingDate} onChange={setSuggestMeetingDate} />
                            <input
                              type="text"
                              value={suggestMeetingFocus}
                              onChange={(e) => setSuggestMeetingFocus(e.target.value)}
                              placeholder="Fokus / rubrik"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <textarea
                              value={suggestMeetingNote}
                              onChange={(e) => setSuggestMeetingNote(e.target.value)}
                              rows={2}
                              placeholder="Anteckning"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none"
                            />
                          </>
                        )}

                        {suggestType === "progression_assessment" && (
                          <>
                            <CalendarDatePicker value={suggestAssessmentDate} onChange={setSuggestAssessmentDate} />
                            <select
                              value={suggestAssessmentInstrument}
                              onChange={(e) => {
                                setSuggestAssessmentInstrument(e.target.value);
                                setSuggestAssessmentInstrumentOther("");
                              }}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                              <option value="">Välj instrument…</option>
                              {recipientInstruments.map((inst) => (
                                <option key={inst} value={inst}>
                                  {inst}
                                </option>
                              ))}
                              <option value="Annan">Annan</option>
                            </select>
                            {suggestAssessmentInstrument === "Annan" && (
                              <input
                                type="text"
                                value={suggestAssessmentInstrumentOther}
                                onChange={(e) => setSuggestAssessmentInstrumentOther(e.target.value)}
                                placeholder="Instrumentets namn"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              />
                            )}
                            <input
                              type="text"
                              value={suggestAssessmentLevel}
                              readOnly
                              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            />
                            <textarea
                              value={suggestAssessmentNote}
                              onChange={(e) => setSuggestAssessmentNote(e.target.value)}
                              rows={2}
                              placeholder="Anteckning"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none"
                            />
                          </>
                        )}

                        <div className="flex items-end justify-between gap-3">
                          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={suggestSendAsEmail}
                              onChange={(e) => setSuggestSendAsEmail(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                            />
                            <span>Skicka även som e-post</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSuggestTarget(null);
                                resetSuggestForm();
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Stäng
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSendSuggestion()}
                              disabled={suggestSending}
                              className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {suggestSending ? "Skickar..." : "Skicka förslag"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              ST-läkare ({kommunikationCards.length})
            </h2>
            {kommunikationCards.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">Inga ST-läkare tilldelade ännu.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {kommunikationCards.map((c) => (
                  <div key={c.stUserId} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-900">{c.stName}</h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMessageTarget({ userId: c.stUserId, name: c.stName });
                          setMessageText("");
                          setMessageChannel("st_ark");
                          setMessageHistoryOpen(false);
                        }}
                        className="flex-1 inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-colors"
                      >
                        Meddelande
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSuggestTarget({ userId: c.stUserId, name: c.stName });
                          setSuggestType("placement");
                          resetSuggestForm();
                          setSuggestionHistoryOpen(false);
                        }}
                        className="flex-1 inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        Föreslå aktivitet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

  const meetingModal =
    selectedMeeting && (
      <div
        className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 p-4"
        onClick={() => setOpenMeetingId(null)}
      >
        <div
          className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black bg-white px-5 py-3">
            <h3 className="text-lg font-bold text-slate-900">Handledarträff</h3>
            <button
              type="button"
              onClick={() => setOpenMeetingId(null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Stäng
            </button>
          </div>
          <div className="space-y-4 p-5">
            {selectedMeeting.isPlannedFollowup && selectedMeeting.parentDateISO && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Detta datum är angivet som nästa planerade handledarträff efter samtal{" "}
                <span className="font-semibold">{selectedMeeting.parentDateISO}</span>.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-600">Datum</div>
                <div className="text-sm text-slate-900">{selectedMeeting.dateISO || "-"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-600">Status</div>
                <div className="text-sm text-slate-900">
                  {selectedMeeting.dateISO > new Date().toISOString().slice(0, 10) ? "Planerad" : "Genomförd"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <div className="text-xs font-semibold text-slate-600">Fokus</div>
                <div className="whitespace-pre-wrap text-sm text-slate-900">{selectedMeeting.focus || "-"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <div className="text-xs font-semibold text-slate-600">Sammanfattning</div>
                <div className="whitespace-pre-wrap text-sm text-slate-900">{selectedMeeting.summary || "-"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                <div className="text-xs font-semibold text-slate-600">Överenskomna åtgärder</div>
                <div className="whitespace-pre-wrap text-sm text-slate-900">{selectedMeeting.actions || "-"}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-600">Nästa planerade träff</div>
                <div className="text-sm text-slate-900">{selectedMeeting.nextDateISO || "-"}</div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Kommentar till ST-läkare</label>
              <textarea
                value={commentDraftById[selectedMeeting.id] ?? ""}
                onChange={(e) =>
                  setCommentDraftById((prev) => ({ ...prev, [selectedMeeting.id]: e.target.value }))
                }
                rows={4}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    void saveMeetingComment(
                      selectedMeeting.id,
                      selectedMeeting.sourceKey,
                      commentDraftById[selectedMeeting.id] ?? ""
                    )
                  }
                  disabled={savingCommentId === selectedMeeting.id}
                  className="rounded-lg border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {savingCommentId === selectedMeeting.id ? "Sparar..." : "Spara kommentar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

  const messageModalPopup =
    messageTarget && (
      <div
        className={
          embedded
            ? "flex items-center justify-center"
            : "fixed inset-0 z-[650] bg-black/60 flex items-center justify-center p-4"
        }
        onClick={embedded ? undefined : () => setMessageTarget(null)}
      >
        <div
          className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4">
            <h3 className="text-lg font-bold text-slate-900">Meddelande</h3>
            <button
              type="button"
              onClick={() => setMessageTarget(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Stäng
            </button>
          </div>
          <div className="border-b border-black" />
          <div className="p-6 space-y-4">
            {!embedded && (
              <p className="text-sm text-slate-700">
                Till: <span className="font-semibold">{messageTarget.name}</span>
              </p>
            )}
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
            <div className="flex items-end justify-between gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={messageChannel === "email"}
                  onChange={(e) => setMessageChannel(e.target.checked ? "email" : "st_ark")}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600"
                />
                <span>Skicka även som e-post</span>
              </label>
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                disabled={!messageText.trim() || messageSending}
                className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {messageSending ? "Skickar..." : "Skicka"}
              </button>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setMessageHistoryOpen((prev) => !prev)}
                className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
              >
                <span>Historik</span>
                <svg
                  className={`h-4 w-4 text-slate-500 transition-transform ${messageHistoryOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                </svg>
              </button>
              {messageHistoryOpen && (
                <div className="mt-3">
                  {sentMessagesLoading ? (
                    <p className="text-xs text-slate-500">Laddar...</p>
                  ) : sentMessages.length === 0 ? (
                    <p className="text-xs text-slate-400">Ingen historik ännu.</p>
                  ) : (
                    <div className="space-y-2">
                      {sentMessages.map((msg) => (
                        <div key={msg.id} className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedMessageId(expandedMessageId === msg.id ? null : msg.id)}
                            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 transition-colors"
                          >
                            <span className="text-xs text-slate-600 flex-1 truncate mr-2">
                              {msg.message_text.slice(0, 60)}
                              {msg.message_text.length > 60 ? "…" : ""}
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                  msg.read ? "bg-slate-200 text-slate-500" : "bg-sky-100 text-sky-700"
                                }`}
                              >
                                {msg.read ? "Läst" : "Oläst"}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(msg.created_at).toLocaleDateString("sv-SE")}
                              </span>
                              <svg
                                className={`h-4 w-4 text-slate-400 transition-transform ${
                                  expandedMessageId === msg.id ? "rotate-180" : ""
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                              </svg>
                            </span>
                          </button>
                          {expandedMessageId === msg.id && (
                            <div className="px-3 pb-3 pt-1 border-t border-slate-200 bg-white">
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message_text}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {msg.channel === "st_ark" ? "ST-ARK" : "E-post"} ·{" "}
                                {new Date(msg.created_at).toLocaleString("sv-SE")}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );

  const suggestModalPopup =
    suggestTarget && (
      <div
        className={
          embedded
            ? "flex items-center justify-center"
            : "fixed inset-0 z-[650] bg-black/60 flex items-center justify-center p-4"
        }
        onClick={
          embedded
            ? undefined
            : () => {
              setSuggestTarget(null);
              resetSuggestForm();
            }
        }
      >
        <div
          className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4">
            <h3 className="text-lg font-bold text-slate-900">Föreslå aktivitet</h3>
            <button
              type="button"
              onClick={() => {
                setSuggestTarget(null);
                resetSuggestForm();
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Stäng
            </button>
          </div>
          <div className="border-b border-black" />
          <div className="p-6 space-y-4">
            {!embedded && (
              <p className="text-sm text-slate-700">
                Till: <span className="font-semibold">{suggestTarget.name}</span>
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "placement" as const, label: "Klinisk tjänstgöring" },
                  { value: "course" as const, label: "Kurs" },
                  { value: "sr_meeting" as const, label: "Studierektorsmöte" },
                  { value: "progression_assessment" as const, label: "Progressionsbedömning" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSuggestType(opt.value);
                    resetSuggestForm();
                  }}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors text-left ${
                    suggestType === opt.value
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {suggestType === "placement" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Placering</label>
                  <input
                    type="text"
                    value={suggestTitle}
                    onChange={(e) => setSuggestTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start</label>
                    <CalendarDatePicker
                      value={suggestStart}
                      onChange={(v) => {
                        setSuggestStart(v);
                        if (v && suggestEnd && v > suggestEnd) setSuggestEnd(v);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Slut</label>
                    <CalendarDatePicker
                      value={suggestEnd}
                      onChange={(v) =>
                        setSuggestEnd(v && suggestStart && v < suggestStart ? suggestStart : v)
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Anteckning (valfritt)</label>
                  <textarea
                    value={suggestNote}
                    onChange={(e) => setSuggestNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </>
            )}

            {suggestType === "course" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kurs</label>
                  {recipientCoursesLoading ? (
                    <p className="text-xs text-slate-500">Laddar kurser...</p>
                  ) : (
                    <select
                      value={suggestCourseSelected}
                      onChange={(e) => {
                        setSuggestCourseSelected(e.target.value);
                        setSuggestCourseCustom("");
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="" disabled>
                        Välj kurs…
                      </option>
                      {recipientCourses.map((c) => (
                        <option
                          key={c.id}
                          value={c.courseTitle && c.title === "Annan kurs" ? c.courseTitle : c.title}
                        >
                          {c.title === "Annan kurs" && c.courseTitle ? c.courseTitle : c.title}
                        </option>
                      ))}
                      <option value="Annan kurs">Annan kurs</option>
                    </select>
                  )}
                </div>
                {suggestCourseSelected === "Annan kurs" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kursens titel</label>
                    <input
                      type="text"
                      value={suggestCourseCustom}
                      onChange={(e) => setSuggestCourseCustom(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start</label>
                    <CalendarDatePicker
                      value={suggestCourseStart}
                      onChange={(v) => {
                        setSuggestCourseStart(v);
                        if (v && suggestCourseEnd && v > suggestCourseEnd) setSuggestCourseEnd(v);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Slut</label>
                    <CalendarDatePicker
                      value={suggestCourseEnd}
                      onChange={(v) =>
                        setSuggestCourseEnd(
                          v && suggestCourseStart && v < suggestCourseStart ? suggestCourseStart : v
                        )
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Anteckning (valfritt)</label>
                  <textarea
                    value={suggestCourseNote}
                    onChange={(e) => setSuggestCourseNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </>
            )}

            {suggestType === "sr_meeting" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Datum</label>
                  <CalendarDatePicker value={suggestMeetingDate} onChange={setSuggestMeetingDate} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fokus / rubrik</label>
                  <input
                    type="text"
                    value={suggestMeetingFocus}
                    onChange={(e) => setSuggestMeetingFocus(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Anteckning</label>
                  <textarea
                    value={suggestMeetingNote}
                    onChange={(e) => setSuggestMeetingNote(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </>
            )}

            {suggestType === "progression_assessment" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Datum</label>
                  <CalendarDatePicker value={suggestAssessmentDate} onChange={setSuggestAssessmentDate} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Instrument</label>
                  {recipientInstrumentsLoading ? (
                    <p className="text-xs text-slate-500">Laddar instrument...</p>
                  ) : (
                    <select
                      value={suggestAssessmentInstrument}
                      onChange={(e) => {
                        setSuggestAssessmentInstrument(e.target.value);
                        setSuggestAssessmentInstrumentOther("");
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="" disabled>
                        Välj instrument…
                      </option>
                      {recipientInstruments.map((inst) => (
                        <option key={inst} value={inst}>
                          {inst}
                        </option>
                      ))}
                      <option value="Annan">Annan</option>
                    </select>
                  )}
                </div>
                {suggestAssessmentInstrument === "Annan" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Instrumentets namn</label>
                    <input
                      type="text"
                      value={suggestAssessmentInstrumentOther}
                      onChange={(e) => setSuggestAssessmentInstrumentOther(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Placering</label>
                  <input
                    type="text"
                    value={suggestAssessmentLevel}
                    readOnly
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Anteckning</label>
                  <textarea
                    value={suggestAssessmentNote}
                    onChange={(e) => setSuggestAssessmentNote(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </>
            )}

            <div className="flex items-end justify-between gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={suggestSendAsEmail}
                  onChange={(e) => setSuggestSendAsEmail(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                <span>Skicka även som e-post</span>
              </label>
              <button
                type="button"
                onClick={() => void handleSendSuggestion()}
                disabled={suggestSending}
                className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {suggestSending ? "Skickar..." : "Skicka förslag"}
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setSuggestionHistoryOpen((prev) => !prev)}
                className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
              >
                <span>Historik</span>
                <svg
                  className={`h-4 w-4 text-slate-500 transition-transform ${suggestionHistoryOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                </svg>
              </button>
              {suggestionHistoryOpen && (
                <div className="mt-3">
                  {sentSuggestionsLoading ? (
                    <p className="text-xs text-slate-500">Laddar...</p>
                  ) : sentSuggestions.length === 0 ? (
                    <p className="text-xs text-slate-400">Ingen historik ännu.</p>
                  ) : (
                    <div className="space-y-2">
                      {sentSuggestions.map((sug) => {
                        const d = sug.activity_data || {};
                        const typeLabel: Record<string, string> = {
                          placement: "Klinisk tjänstgöring",
                          course: "Kurs",
                          sr_meeting: "Studierektorsmöte",
                          progression_assessment: "Progressionsbedömning",
                        };
                        const statusLabel: Record<string, string> = {
                          pending: "Väntar",
                          accepted: "Accepterat",
                          dismissed: "Avfärdat",
                        };
                        const statusCls: Record<string, string> = {
                          pending: "bg-amber-100 text-amber-700",
                          accepted: "bg-emerald-100 text-emerald-700",
                          dismissed: "bg-slate-200 text-slate-500",
                        };
                        const preview =
                          d.title || d.focus || d.summary || typeLabel[sug.activity_type] || sug.activity_type;
                        const isExpanded = expandedSuggestionId === sug.id;
                        return (
                          <div key={sug.id} className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedSuggestionId(isExpanded ? null : sug.id)}
                              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 transition-colors"
                            >
                              <span className="text-xs text-slate-600 flex-1 truncate mr-2">
                                <span className="font-medium">{typeLabel[sug.activity_type] || sug.activity_type}:</span>{" "}
                                {String(preview).slice(0, 50)}
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                    statusCls[sug.status] || "bg-slate-200 text-slate-500"
                                  }`}
                                >
                                  {statusLabel[sug.status] || sug.status}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {new Date(sug.created_at).toLocaleDateString("sv-SE")}
                                </span>
                                <svg
                                  className={`h-4 w-4 text-slate-400 transition-transform ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={2}
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                                </svg>
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="px-3 pb-3 pt-1 border-t border-slate-200 bg-white space-y-2">
                                <div className="space-y-1">
                                  {d.title && (
                                    <p className="text-xs text-slate-600">
                                      <span className="font-medium">Titel:</span> {d.title}
                                    </p>
                                  )}
                                  {d.dateISO && (
                                    <p className="text-xs text-slate-600">
                                      <span className="font-medium">Datum:</span>{" "}
                                      {new Date(d.dateISO).toLocaleDateString("sv-SE")}
                                    </p>
                                  )}
                                  {d.startDate && (
                                    <p className="text-xs text-slate-600">
                                      <span className="font-medium">Start:</span>{" "}
                                      {new Date(d.startDate).toLocaleDateString("sv-SE")}
                                    </p>
                                  )}
                                  {d.endDate && (
                                    <p className="text-xs text-slate-600">
                                      <span className="font-medium">Slut:</span>{" "}
                                      {new Date(d.endDate).toLocaleDateString("sv-SE")}
                                    </p>
                                  )}
                                  {d.focus && (
                                    <p className="text-xs text-slate-600">
                                      <span className="font-medium">Fokus:</span> {d.focus}
                                    </p>
                                  )}
                                  {d.level && (
                                    <p className="text-xs text-slate-600">
                                      <span className="font-medium">Nivå:</span> {d.level}
                                    </p>
                                  )}
                                  {d.instrument && (
                                    <p className="text-xs text-slate-600">
                                      <span className="font-medium">Instrument:</span> {d.instrument}
                                    </p>
                                  )}
                                  {d.note && (
                                    <p className="text-xs text-slate-600">
                                      <span className="font-medium">Anteckning:</span> {d.note}
                                    </p>
                                  )}
                                </div>
                                {(sug.status === "accepted" || sug.status === "dismissed") && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!window.confirm("Är du säker på att du vill ta bort detta aktivitetsförslag?"))
                                        return;
                                      const { error } = await deleteSrActivitySuggestionById(sug.id);
                                      if (error) {
                                        setFeedback({ type: "err", msg: "Kunde inte ta bort förslaget." });
                                      } else {
                                        setSentSuggestions((prev) => prev.filter((s) => s.id !== sug.id));
                                        setFeedback({ type: "ok", msg: "Förslag borttaget." });
                                      }
                                    }}
                                    className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                                  >
                                    Ta bort
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );

  if (embedded) {
    return (
      <div className="space-y-4">
        {feedbackEl}
        {mainContent}
        {meetingModal}
      </div>
    );
  }

  return (
    <div className="-mx-6">
      <div className="border-b border-black">
        <nav className="flex gap-1 px-6 pt-2">
          {([
            { id: "handledning" as DashTab, label: "Handledarträffar" },
            { id: "suggest" as DashTab, label: "Kommunikation" },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:outline-none ${
                tab === t.id
                  ? "border-x border-t border-slate-200 bg-white text-slate-900 -mb-px"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6 space-y-4 px-6">
        {tab === "handledning" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-1 text-base font-semibold text-slate-900">ST-läkare</div>
            {assignments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Inga tilldelade ST-läkare</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {assignments.map((a) => {
                  const selected = selectedStUserId === a.stUserId;
                  return (
                    <button
                      key={a.stUserId}
                      type="button"
                      onClick={() => setSelectedStUserId(a.stUserId)}
                      className={`rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                        selected
                          ? "border-sky-600 bg-sky-50 text-slate-900 shadow-sm ring-2 ring-sky-200"
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {a.stName} ({a.goalsVersion})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {feedbackEl}
        {mainContent}
      </div>
      {meetingModal}
      {messageModalPopup}
      {suggestModalPopup}
    </div>
  );
}


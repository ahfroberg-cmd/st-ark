"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  deleteSrMessageById,
  dismissSrMessageLooseById,
  fetchClinicMembershipForUser,
  insertSrMessagesSelect,
  listClinicMembershipsByClinicId,
  listCoursesColleagueDescriptionsForUserIds,
  listIncomingMessagesForUser,
  listIncomingSuggestionsForUser,
  listPlacementsColleagueDescriptionsForUserIds,
  listProfilesByIds,
  listSentMessagesForUser,
  listSupervisorIdsForStLakare,
  markSrMessageReadById,
  updateSrSuggestionStatusById,
} from "@/lib/repositories/starkRepository";

function normalizeClinicRole(role: unknown): "st_lakare" | "huvudhandledare" | "studierektor" | "" {
  const r = String(role || "").trim().toLowerCase();
  if (r === "st_lakare" || r === "st") return "st_lakare";
  if (r === "huvudhandledare" || r === "supervisor" || r === "handledare") return "huvudhandledare";
  if (r === "studierektor" || r === "study_director" || r === "studierektor_admin") return "studierektor";
  return "";
}

export function useHemklinikWorkspace() {
  const [hemklinikOpen, setHemklinikOpen] = useState(false);
  const [hemklinikTab, setHemklinikTab] = useState<"kommunikation" | "kollegor">("kollegor");
  const [hemklinikMessages, setHemklinikMessages] = useState<any[]>([]);
  const [hemklinikSentMessages, setHemklinikSentMessages] = useState<any[]>([]);
  const [hemklinikMailbox, setHemklinikMailbox] = useState<"inkorg" | "skickat">("inkorg");
  const [hemklinikSelectedMessageId, setHemklinikSelectedMessageId] = useState<string | null>(null);
  const [hemklinikComposeRecipients, setHemklinikComposeRecipients] = useState<string[]>([]);
  const [hemklinikComposeText, setHemklinikComposeText] = useState("");
  const [hemklinikComposeSending, setHemklinikComposeSending] = useState(false);
  const [hemklinikComposeOpen, setHemklinikComposeOpen] = useState(false);
  const [hemklinikRecipientPickerOpen, setHemklinikRecipientPickerOpen] = useState(false);
  const [hemklinikClinicId, setHemklinikClinicId] = useState("");
  const [hemklinikCurrentUserId, setHemklinikCurrentUserId] = useState("");
  const [hemklinikAssignedSupervisorIds, setHemklinikAssignedSupervisorIds] = useState<string[]>([]);
  const [hemklinikSuggestions, setHemklinikSuggestions] = useState<any[]>([]);
  const [hemklinikColleagues, setHemklinikColleagues] = useState<any[]>([]);
  const [colleaguePlacementDescriptions, setColleaguePlacementDescriptions] = useState<any[]>([]);
  const [colleagueCourseDescriptions, setColleagueCourseDescriptions] = useState<any[]>([]);
  const [hemklinikLoading, setHemklinikLoading] = useState(false);
  const [hemklinikSuggestionDetail, setHemklinikSuggestionDetail] = useState<any>(null);
  const [hemklinikContactDetail, setHemklinikContactDetail] = useState<any>(null);

  const hemklinikMailboxRows = useMemo(() => {
    return hemklinikMailbox === "inkorg" ? hemklinikMessages : hemklinikSentMessages;
  }, [hemklinikMailbox, hemklinikMessages, hemklinikSentMessages]);

  const hemklinikSelectedMessage = useMemo(() => {
    return hemklinikMailboxRows.find((m: any) => m.id === hemklinikSelectedMessageId) || hemklinikMailboxRows[0] || null;
  }, [hemklinikMailboxRows, hemklinikSelectedMessageId]);

  const hemklinikPrimaryContacts = useMemo(() => {
    const assignedSet = new Set(hemklinikAssignedSupervisorIds);
    return hemklinikColleagues.filter(
      (c: any) => c.role === "studierektor" || (c.role === "huvudhandledare" && assignedSet.has(c.userId))
    );
  }, [hemklinikColleagues, hemklinikAssignedSupervisorIds]);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) return;

        const myClinicRes = await fetchClinicMembershipForUser(user.id);
        const myClinicId = myClinicRes.data?.clinic_id;
        if (!myClinicId) return;
        const clinicMems = await listClinicMembershipsByClinicId(String(myClinicId));
        if (clinicMems.error) return;
        const colleagueIds = Array.from(
          new Set(
            (clinicMems.data || [])
              .filter((m: any) => ["st_lakare", "huvudhandledare", "studierektor"].includes(String(m.role || "")))
              .map((m: any) => String(m.user_id || "").trim())
              .filter(Boolean)
              .filter((id: string) => id !== user.id)
          )
        );
        if (colleagueIds.length === 0) return;

        const [profileRes, placementRes, courseRes] = await Promise.all([
          listProfilesByIds(colleagueIds, "id,name"),
          listPlacementsColleagueDescriptionsForUserIds(colleagueIds),
          listCoursesColleagueDescriptionsForUserIds(colleagueIds),
        ]);
        if (profileRes.error || placementRes.error || courseRes.error) return;

        const profileById = new Map<string, any>((profileRes.data || []).map((p: any) => [String(p.id), p]));
        const colleagueDescriptions = (placementRes.data || [])
          .map((p: any) => {
            const title = String(p.title || "").trim();
            const clinic = String(p.clinic || "").trim();
            return {
              userId: String(p.user_id || ""),
              colleagueName: String(profileById.get(String(p.user_id || ""))?.name || "Okänd"),
              placementName: title || clinic,
              placementNameAlt: title && clinic && title !== clinic ? clinic : undefined,
              description: String(p.note || "").trim(),
              startDate: String(p.start_date || ""),
              endDate: String(p.end_date || ""),
            };
          })
          .filter((p: any) => !!p.userId && !!p.placementName && !!p.description)
          .sort((a: any, b: any) => {
            const nameCmp = a.colleagueName.localeCompare(b.colleagueName, "sv", { sensitivity: "base" });
            if (nameCmp !== 0) return nameCmp;
            return a.startDate.localeCompare(b.startDate);
          });
        const colleagueCourseRows = (courseRes.data || [])
          .map((c: any) => {
            const ct = String(c.course_title || "").trim();
            const ti = String(c.title || "").trim();
            return {
              userId: String(c.user_id || ""),
              colleagueName: String(profileById.get(String(c.user_id || ""))?.name || "Okänd"),
              courseName: ct || ti,
              courseNameAlt: ct && ti && ct !== ti ? ti : undefined,
              description: String(c.note || "").trim(),
              startDate: String(c.start_date || ""),
              endDate: String(c.end_date || ""),
            };
          })
          .filter((c: any) => !!c.userId && !!c.courseName && !!c.description)
          .sort((a: any, b: any) => {
            const nameCmp = a.colleagueName.localeCompare(b.colleagueName, "sv", { sensitivity: "base" });
            if (nameCmp !== 0) return nameCmp;
            return a.startDate.localeCompare(b.startDate);
          });
        setColleaguePlacementDescriptions(colleagueDescriptions);
        setColleagueCourseDescriptions(colleagueCourseRows);
      } catch (err) {
        console.error("Error loading colleague placement descriptions:", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hemklinikOpen) return;
    setHemklinikLoading(true);
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) return;
        setHemklinikCurrentUserId(user.id);

        const myClinicRes = await fetchClinicMembershipForUser(user.id);
        const myClinicId = myClinicRes.data?.clinic_id;
        setHemklinikClinicId(String(myClinicId || ""));
        const supervisorAssignmentsRes = await listSupervisorIdsForStLakare(user.id);
        const assignedSupervisorIds = supervisorAssignmentsRes.error
          ? []
          : Array.from(
              new Set(
                (supervisorAssignmentsRes.data || [])
                  .map((r: any) => String(r?.supervisor_id || "").trim())
                  .filter(Boolean)
              )
            );
        setHemklinikAssignedSupervisorIds(assignedSupervisorIds);

        const [msgRes, sentMsgRes, sugRes] = await Promise.all([
          listIncomingMessagesForUser(user.id, 30),
          listSentMessagesForUser(user.id, 60),
          listIncomingSuggestionsForUser(user.id, 30),
        ]);

        const colleagues: any[] = [];
        let colleagueDescriptions: any[] = [];
        let colleagueCourseRows: any[] = [];

        if (myClinicId) {
          const clinicMems = await listClinicMembershipsByClinicId(String(myClinicId));
          if (clinicMems.error) {
            console.error("Error fetching clinic members:", clinicMems.error);
          } else {
            const membersInClinic = (clinicMems.data || [])
              .map((m: any) => ({
                userId: String(m.user_id || "").trim(),
                role: normalizeClinicRole(m.role),
              }))
              .filter((m: any) => !!m.role)
              .filter((m: any) => !!m.userId && m.userId !== user.id);
            const colleagueIds = Array.from(new Set(membersInClinic.map((m: any) => m.userId)));

            if (colleagueIds.length > 0) {
              const [profileRes, placementRes, courseRes] = await Promise.all([
                listProfilesByIds(colleagueIds, "id,name,specialty,goals_version,email,mobile,phone_work"),
                listPlacementsColleagueDescriptionsForUserIds(colleagueIds),
                listCoursesColleagueDescriptionsForUserIds(colleagueIds),
              ]);

              if (profileRes.error) {
                console.error("Error fetching colleague profiles:", profileRes.error);
              } else {
                const profileById = new Map<string, any>((profileRes.data || []).map((p: any) => [String(p.id), p]));
                for (const colleagueId of colleagueIds) {
                  const p = profileById.get(colleagueId);
                  const role = membersInClinic.find((m: any) => m.userId === colleagueId)?.role || "st_lakare";
                  colleagues.push({
                    userId: colleagueId,
                    name: p?.name || "Okänd",
                    specialty: p?.specialty || "",
                    goalsVersion: p?.goals_version || "2021",
                    role,
                    email: p?.email || "",
                    mobile: p?.mobile || "",
                    phoneWork: p?.phone_work || "",
                  });
                }
                colleagues.sort((a, b) => a.name.localeCompare(b.name, "sv", { sensitivity: "base" }));

                if (placementRes.error) {
                  console.error("Error fetching colleague placements for suggestions:", placementRes.error);
                } else {
                  colleagueDescriptions = (placementRes.data || [])
                    .map((p: any) => {
                      const title = String(p.title || "").trim();
                      const clinic = String(p.clinic || "").trim();
                      return {
                        userId: String(p.user_id || ""),
                        colleagueName: String(profileById.get(String(p.user_id || ""))?.name || "Okänd"),
                        placementName: title || clinic,
                        placementNameAlt: title && clinic && title !== clinic ? clinic : undefined,
                        description: String(p.note || "").trim(),
                        startDate: String(p.start_date || ""),
                        endDate: String(p.end_date || ""),
                      };
                    })
                    .filter((p: any) => !!p.userId && !!p.placementName && !!p.description)
                    .sort((a: any, b: any) => {
                      const nameCmp = a.colleagueName.localeCompare(b.colleagueName, "sv", { sensitivity: "base" });
                      if (nameCmp !== 0) return nameCmp;
                      return a.startDate.localeCompare(b.startDate);
                    });
                }
                if (courseRes.error) {
                  console.error("Error fetching colleague courses for suggestions:", courseRes.error);
                } else {
                  colleagueCourseRows = (courseRes.data || [])
                    .map((c: any) => {
                      const ct = String(c.course_title || "").trim();
                      const ti = String(c.title || "").trim();
                      return {
                        userId: String(c.user_id || ""),
                        colleagueName: String(profileById.get(String(c.user_id || ""))?.name || "Okänd"),
                        courseName: ct || ti,
                        courseNameAlt: ct && ti && ct !== ti ? ti : undefined,
                        description: String(c.note || "").trim(),
                        startDate: String(c.start_date || ""),
                        endDate: String(c.end_date || ""),
                      };
                    })
                    .filter((c: any) => !!c.userId && !!c.courseName && !!c.description)
                    .sort((a: any, b: any) => {
                      const nameCmp = a.colleagueName.localeCompare(b.colleagueName, "sv", { sensitivity: "base" });
                      if (nameCmp !== 0) return nameCmp;
                      return a.startDate.localeCompare(b.startDate);
                    });
                }
              }
            }
          }
        }

        const senderIds = Array.from(
          new Set(
            [...(msgRes.data || []), ...(sugRes.data || [])]
              .map((r: any) => String(r?.sender_id || "").trim())
              .filter(Boolean)
          )
        );
        const recipientIds = Array.from(
          new Set(
            (sentMsgRes.data || [])
              .map((r: any) => String(r?.recipient_id || "").trim())
              .filter(Boolean)
          )
        );
        const profileIds = Array.from(new Set([...senderIds, ...recipientIds]));

        let senderNameById = new Map<string, string>();
        if (profileIds.length > 0) {
          const profRes = await supabase.from("profiles").select("id,name").in("id", profileIds);
          if (profRes.data) {
            senderNameById = new Map(
              (profRes.data as any[]).map((p: any) => [String(p.id), String(p.name || "Okänd")])
            );
          }
        }

        setHemklinikMessages(
          (msgRes.data || []).map((m: any) => ({
            id: m.id,
            message_text: m.message_text || "",
            channel: m.channel || "st_ark",
            read: !!m.read,
            created_at: m.created_at || "",
            sender_id: m.sender_id || null,
            sender_name: (m.sender_id && senderNameById.get(String(m.sender_id))) || "Okänd avsändare",
          }))
        );
        setHemklinikSentMessages(
          (sentMsgRes.data || []).map((m: any) => ({
            id: m.id,
            message_text: m.message_text || "",
            channel: m.channel || "st_ark",
            read: !!m.read,
            created_at: m.created_at || "",
            recipient_id: m.recipient_id || null,
            recipient_name: (m.recipient_id && senderNameById.get(String(m.recipient_id))) || "Okänd mottagare",
          }))
        );
        setHemklinikSuggestions(
          (sugRes.data || []).map((s: any) => ({
            id: s.id,
            activity_type: s.activity_type || "",
            activity_data: s.activity_data || {},
            created_at: s.created_at || "",
            status: s.status || "pending",
            sender_id: s.sender_id || null,
            sender_name: (s.sender_id && senderNameById.get(String(s.sender_id))) || "Okänd avsändare",
          }))
        );
        setHemklinikColleagues(colleagues);
        const firstInboxId = (msgRes.data || [])[0]?.id || null;
        const firstSentId = (sentMsgRes.data || [])[0]?.id || null;
        setHemklinikSelectedMessageId(firstInboxId || firstSentId);
        setColleaguePlacementDescriptions(colleagueDescriptions);
        setColleagueCourseDescriptions(colleagueCourseRows);
      } catch {
      } finally {
        setHemklinikLoading(false);
      }
    })();
  }, [hemklinikOpen]);

  const sendHemklinikMessage = useCallback(async () => {
    const text = String(hemklinikComposeText || "").trim();
    if (!hemklinikCurrentUserId || !hemklinikClinicId) {
      alert("Kunde inte hitta hemklinik för meddelandet.");
      return;
    }
    if (!text) {
      alert("Skriv ett meddelande först.");
      return;
    }
    if (hemklinikComposeRecipients.length === 0) {
      alert("Välj minst en mottagare.");
      return;
    }
    setHemklinikComposeSending(true);
    try {
      const payload = hemklinikComposeRecipients.map((recipientId) => ({
        sender_id: hemklinikCurrentUserId,
        recipient_id: recipientId,
        clinic_id: hemklinikClinicId,
        message_text: text,
        channel: "st_ark",
        read: false,
        dismissed: false,
      }));
      const { data, error } = await insertSrMessagesSelect(payload, "id,message_text,channel,read,created_at,recipient_id");
      if (error) throw error;
      const recipientById = new Map(hemklinikColleagues.map((c: any) => [c.userId, c.name]));
      const inserted = (data || []).map((m: any) => ({
        id: String(m.id || ""),
        message_text: String(m.message_text || ""),
        channel: String(m.channel || "st_ark"),
        read: !!m.read,
        created_at: String(m.created_at || ""),
        recipient_id: String(m.recipient_id || ""),
        recipient_name: String(recipientById.get(String(m.recipient_id || "")) || "Okänd mottagare"),
      }));
      setHemklinikSentMessages((prev) => [...inserted, ...prev]);
      setHemklinikMailbox("skickat");
      setHemklinikSelectedMessageId(inserted[0]?.id || null);
      setHemklinikComposeText("");
      setHemklinikComposeOpen(false);
      setHemklinikRecipientPickerOpen(false);
    } catch (e: any) {
      alert(`Kunde inte skicka meddelande: ${String(e?.message || e)}`);
    } finally {
      setHemklinikComposeSending(false);
    }
  }, [
    hemklinikComposeText,
    hemklinikCurrentUserId,
    hemklinikClinicId,
    hemklinikComposeRecipients,
    hemklinikColleagues,
  ]);

  const removeHemklinikMessage = useCallback(async (messageId: string, mailbox: "inkorg" | "skickat") => {
    if (!messageId) return;
    const tryDelete = await deleteSrMessageById(messageId);
    if (tryDelete.error) {
      const tryDismiss = await dismissSrMessageLooseById(messageId);
      if (tryDismiss.error) {
        alert("Kunde inte ta bort meddelandet.");
        return;
      }
    }
    if (mailbox === "inkorg") {
      setHemklinikMessages((prev) => prev.filter((m) => m.id !== messageId));
    } else {
      setHemklinikSentMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
    setHemklinikSelectedMessageId((prev) => (prev === messageId ? null : prev));
  }, []);

  const dismissHemklinikSuggestion = useCallback(async (suggestionId: string) => {
    if (!suggestionId) return;
    const { error } = await updateSrSuggestionStatusById(suggestionId, "dismissed");
    if (error) {
      alert("Kunde inte ta bort aktivitetsförslaget.");
      return;
    }
    setHemklinikSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    setHemklinikSuggestionDetail((prev: any) => (prev?.id === suggestionId ? null : prev));
  }, []);

  const switchHemklinikMailbox = useCallback(
    (mailbox: "inkorg" | "skickat") => {
      setHemklinikMailbox(mailbox);
      setHemklinikSelectedMessageId(
        mailbox === "inkorg" ? hemklinikMessages[0]?.id || null : hemklinikSentMessages[0]?.id || null
      );
    },
    [hemklinikMessages, hemklinikSentMessages]
  );

  const handleOpenHemklinikMessage = useCallback(
    async (message: any) => {
      setHemklinikSelectedMessageId(message.id);
      if (hemklinikMailbox === "inkorg" && !message.read) {
        await markSrMessageReadById(message.id, hemklinikCurrentUserId);
        setHemklinikMessages((prev) => prev.map((x) => (x.id === message.id ? { ...x, read: true } : x)));
      }
    },
    [hemklinikMailbox, hemklinikCurrentUserId]
  );

  return {
    hemklinikOpen,
    setHemklinikOpen,
    hemklinikTab,
    setHemklinikTab,
    hemklinikMessages,
    setHemklinikMessages,
    hemklinikSentMessages,
    setHemklinikSentMessages,
    hemklinikMailbox,
    setHemklinikMailbox,
    hemklinikSelectedMessageId,
    setHemklinikSelectedMessageId,
    hemklinikComposeRecipients,
    setHemklinikComposeRecipients,
    hemklinikComposeText,
    setHemklinikComposeText,
    hemklinikComposeSending,
    hemklinikComposeOpen,
    setHemklinikComposeOpen,
    hemklinikRecipientPickerOpen,
    setHemklinikRecipientPickerOpen,
    hemklinikClinicId,
    hemklinikCurrentUserId,
    hemklinikSuggestions,
    hemklinikColleagues,
    hemklinikLoading,
    hemklinikSuggestionDetail,
    setHemklinikSuggestionDetail,
    hemklinikContactDetail,
    setHemklinikContactDetail,
    hemklinikMailboxRows,
    hemklinikSelectedMessage,
    hemklinikPrimaryContacts,
    colleaguePlacementDescriptions,
    colleagueCourseDescriptions,
    sendHemklinikMessage,
    removeHemklinikMessage,
    dismissHemklinikSuggestion,
    switchHemklinikMailbox,
    handleOpenHemklinikMessage,
  };
}

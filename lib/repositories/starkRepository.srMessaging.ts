import { supabase } from "@/lib/supabase";

export async function deleteSrMessageById(messageId: string) {
  return supabase.from("sr_messages").delete().eq("id", messageId);
}

export async function dismissSrMessageLooseById(messageId: string) {
  return supabase.from("sr_messages").update({ dismissed: true }).eq("id", messageId);
}

export async function updateSrSuggestionStatusById(
  suggestionId: string,
  status: string,
  respondedAt = new Date().toISOString()
) {
  return supabase
    .from("sr_activity_suggestions")
    .update({ status, responded_at: respondedAt })
    .eq("id", suggestionId);
}

export async function acknowledgeActivityTemplateChangeNotification(id: string) {
  return supabase.from("activity_template_change_notifications").update({ acknowledged: true }).eq("id", id);
}

export async function listPendingActivityTemplateChangeNotifications(userId: string, limit = 20) {
  return supabase
    .from("activity_template_change_notifications")
    .select("id,change_type,activity_type,old_title,new_title,details,created_at")
    .eq("user_id", userId)
    .eq("acknowledged", false)
    .order("created_at", { ascending: true })
    .limit(limit);
}

export async function listSentMessagesByPair(senderId: string, recipientId: string) {
  return supabase
    .from("sr_messages")
    .select("id, message_text, channel, read, created_at")
    .eq("sender_id", senderId)
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false });
}

export async function listSentSuggestionsByPair(senderId: string, recipientId: string) {
  return supabase
    .from("sr_activity_suggestions")
    .select("id, activity_type, activity_data, status, created_at")
    .eq("sender_id", senderId)
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false });
}

export async function listUnreadSentMessages(senderId: string) {
  return supabase
    .from("sr_messages")
    .select("id, message_text, recipient_id, created_at, read, channel")
    .eq("sender_id", senderId)
    .eq("read", false)
    .order("created_at", { ascending: false });
}

export async function listPendingSentSuggestions(senderId: string) {
  return supabase
    .from("sr_activity_suggestions")
    .select("id, activity_type, activity_data, recipient_id, created_at, status")
    .eq("sender_id", senderId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
}

export async function listReadSentMessages(senderId: string, limit = 100) {
  return supabase
    .from("sr_messages")
    .select("id,recipient_id,message_text,created_at")
    .eq("sender_id", senderId)
    .eq("read", true)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function listHandledSentSuggestions(senderId: string, limit = 100) {
  return supabase
    .from("sr_activity_suggestions")
    .select("id,recipient_id,activity_type,created_at,status")
    .eq("sender_id", senderId)
    .in("status", ["accepted", "rejected"])
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function insertSrMessages(rows: Record<string, unknown>[] | Record<string, unknown>) {
  return supabase.from("sr_messages").insert(rows);
}

export async function insertSrMessagesSelect(
  rows: Record<string, unknown>[],
  selectColumns: string
) {
  return supabase.from("sr_messages").insert(rows).select(selectColumns);
}

export async function listSrMessagesBetweenUsers(
  senderId: string,
  recipientId: string,
  limit = 20
) {
  return supabase
    .from("sr_messages")
    .select("id,message_text,created_at,read")
    .eq("sender_id", senderId)
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function listSrSuggestionsBetweenUsers(
  senderId: string,
  recipientId: string,
  limit = 20
) {
  return supabase
    .from("sr_activity_suggestions")
    .select("id,activity_type,activity_data,status,created_at")
    .eq("sender_id", senderId)
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function insertSrActivitySuggestions(rows: Record<string, unknown>[] | Record<string, unknown>) {
  return supabase.from("sr_activity_suggestions").insert(rows);
}

export async function deleteSrActivitySuggestionById(id: string) {
  return supabase.from("sr_activity_suggestions").delete().eq("id", id);
}

export async function fetchClinicMembershipForUser(userId: string) {
  return supabase
    .from("clinic_memberships")
    .select("clinic_id, role")
    .eq("user_id", userId)
    .maybeSingle();
}

export async function listSentMessagesForUser(senderId: string, limit = 60) {
  return supabase
    .from("sr_messages")
    .select("id,message_text,channel,read,dismissed,created_at,recipient_id")
    .eq("sender_id", senderId)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function listIncomingMessagesForUser(recipientId: string, limit = 40) {
  return supabase
    .from("sr_messages")
    .select("id,message_text,channel,read,dismissed,created_at,sender_id")
    .eq("recipient_id", recipientId)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function listIncomingSuggestionsForUser(recipientId: string, limit = 40) {
  return supabase
    .from("sr_activity_suggestions")
    .select("id,activity_type,activity_data,status,created_at,sender_id,responded_at")
    .eq("recipient_id", recipientId)
    .neq("status", "dismissed")
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function markSrMessageReadById(id: string, recipientId: string) {
  return supabase
    .from("sr_messages")
    .update({ read: true })
    .eq("id", id)
    .eq("recipient_id", recipientId);
}

export async function dismissSrMessageById(id: string, recipientId: string) {
  return supabase
    .from("sr_messages")
    .update({ dismissed: true, read: true })
    .eq("id", id)
    .eq("recipient_id", recipientId);
}

export async function respondSrSuggestionById(
  id: string,
  recipientId: string,
  status: "accepted" | "dismissed"
) {
  return supabase
    .from("sr_activity_suggestions")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", recipientId);
}

/** Inkorg notiser: äldst först (popup). */
export async function listPendingIncomingMessagesOldestFirst(recipientId: string) {
  return supabase
    .from("sr_messages")
    .select("id, sender_id, message_text, channel, created_at")
    .eq("recipient_id", recipientId)
    .eq("dismissed", false)
    .order("created_at", { ascending: true });
}

export async function listPendingSuggestionsOldestFirst(recipientId: string) {
  return supabase
    .from("sr_activity_suggestions")
    .select("id, sender_id, activity_type, activity_data, created_at")
    .eq("recipient_id", recipientId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
}

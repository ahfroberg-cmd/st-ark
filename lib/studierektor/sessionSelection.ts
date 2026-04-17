import { normalizeToISODate } from "@/lib/studierektor/dateUtils";

export function buildSupervisionSelectedActivity(session: any, fallbackId: string | number) {
  return {
    ...session,
    id: String(session?.id || fallbackId),
    __type: "supervision" as const,
    dateISO:
      normalizeToISODate(session?.dateISO || session?.date || session?.iso) ||
      (session?.dateISO || session?.date || session?.iso),
    title: session?.focus || session?.title || "Handledarsamtal",
    note: session?.summary || session?.note || session?.notes || "",
  };
}

export function buildAssessmentSelectedActivity(session: any, fallbackId: string | number) {
  const instrument = session?.instrument || "";
  const level = session?.level || session?.assessment || session?.bedömning || "";
  const composedTitle = [instrument, level].filter(Boolean).join(" • ") || "Progressionsbedömning";

  return {
    ...session,
    id: String(session?.id || fallbackId),
    __type: "assessment" as const,
    dateISO:
      normalizeToISODate(session?.dateISO || session?.date || session?.iso) ||
      (session?.dateISO || session?.date || session?.iso),
    title: composedTitle,
    note: session?.summary || session?.note || session?.notes || "",
  };
}

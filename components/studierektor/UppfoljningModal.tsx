"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupervisorStudent } from "@/lib/mappers/studentData";

type FollowupTab = "updates" | "history";
type FollowupEventKind = "placement" | "course" | "utbildningsmoment" | "assessment" | "supervision";

type FollowupEvent = {
  id: string;
  studentId: string;
  studentName: string;
  dateISO: string;
  dateTs: number;
  text: string;
  kind: FollowupEventKind;
};

type Props = {
  open: boolean;
  onClose: () => void;
  students: SupervisorStudent[];
  studentColorById: Map<string, string>;
  renderTimelinePanel?: (student: SupervisorStudent, onClose: () => void) => ReactNode;
  /** Anropas när ack/historikrens i localStorage ändrats (t.ex. så headern kan läsa om oläst-status). */
  onFollowupStorageChanged?: () => void;
};

function normalizeToISODate(raw: unknown): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function placementLabel(p: any): string {
  return String(p?.clinic || p?.label || p?.title || p?.type || "Placering");
}

function activityTitle(c: any): string {
  const kind = String(c?.kind || "");
  if (kind === "Utbildningsmoment") {
    return String(c?.courseTitle || c?.title || "Utbildningsmoment");
  }
  return String(c?.title || c?.courseTitle || kind || "Kurs");
}

function formatDateSv(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("sv-SE");
}

function buildFollowupEvents(students: SupervisorStudent[]): FollowupEvent[] {
  const out: FollowupEvent[] = [];
  const todayISO = new Date().toISOString().slice(0, 10);

  for (const s of students || []) {
    const studentId = String(s.id || "");
    const studentName = String(s.name || "ST-läkare");
    if (!studentId) continue;

    const placements = Array.isArray(s.placements) ? s.placements : [];
    const starts = placements
      .map((p) => ({ id: String(p?.id || crypto.randomUUID()), p, dateISO: normalizeToISODate(p?.startDate || p?.start_date) }))
      .filter((x) => !!x.dateISO && (x.dateISO as string) <= todayISO)
      .sort((a, b) => (a.dateISO as string).localeCompare(b.dateISO as string));
    const ends = placements
      .map((p) => ({ id: String(p?.id || crypto.randomUUID()), p, dateISO: normalizeToISODate(p?.endDate || p?.end_date) }))
      .filter((x) => !!x.dateISO && (x.dateISO as string) <= todayISO)
      .sort((a, b) => (a.dateISO as string).localeCompare(b.dateISO as string));

    const consumedStarts = new Set<string>();
    for (const e of ends) {
      const sameDayStart = starts.find(
        (st) => !consumedStarts.has(st.id) && st.dateISO === e.dateISO && st.id !== e.id
      );
      if (sameDayStart) {
        consumedStarts.add(sameDayStart.id);
        out.push({
          id: `${studentId}:placement-transition:${e.id}:${sameDayStart.id}:${e.dateISO}`,
          studentId,
          studentName,
          dateISO: String(e.dateISO),
          dateTs: Date.parse(`${e.dateISO}T00:00:00`),
          text: `Avslutat ${placementLabel(e.p)} och börjat ${placementLabel(sameDayStart.p)}`,
          kind: "placement",
        });
      } else {
        out.push({
          id: `${studentId}:placement-end:${e.id}:${e.dateISO}`,
          studentId,
          studentName,
          dateISO: String(e.dateISO),
          dateTs: Date.parse(`${e.dateISO}T00:00:00`),
          text: `Avslutat ${placementLabel(e.p)}`,
          kind: "placement",
        });
      }
    }
    for (const st of starts) {
      if (consumedStarts.has(st.id)) continue;
      out.push({
        id: `${studentId}:placement-start:${st.id}:${st.dateISO}`,
        studentId,
        studentName,
        dateISO: String(st.dateISO),
        dateTs: Date.parse(`${st.dateISO}T00:00:00`),
        text: `Påbörjat ${placementLabel(st.p)}`,
        kind: "placement",
      });
    }

    const courses = Array.isArray(s.courses) ? s.courses : [];
    for (const c of courses) {
      const dateISO = normalizeToISODate(c?.endDate || c?.end_date || c?.certificateDate || c?.certificate_date || c?.startDate || c?.start_date);
      if (!dateISO || dateISO > todayISO) continue;
      const kind = String(c?.kind || "");
      out.push({
        id: `${studentId}:course:${String(c?.id || crypto.randomUUID())}:${dateISO}`,
        studentId,
        studentName,
        dateISO,
        dateTs: Date.parse(`${dateISO}T00:00:00`),
        text:
          kind === "Utbildningsmoment"
            ? `Avslutat utbildningsmoment: ${activityTitle(c)}`
            : `Avslutat kurs: ${activityTitle(c)}`,
        kind: kind === "Utbildningsmoment" ? "utbildningsmoment" : "course",
      });
    }

    const iup = (s as any)?.iupSettings || {};
    const hhMeetings = Array.isArray(iup?.meetings) ? iup.meetings : [];
    const pbAssessments = Array.isArray(iup?.assessments) ? iup.assessments : [];

    for (const m of hhMeetings) {
      const dateISO = normalizeToISODate(m?.dateISO || m?.date || m?.iso);
      if (!dateISO || dateISO > todayISO) continue;
      out.push({
        id: `${studentId}:supervision:${String(m?.id || crypto.randomUUID())}:${dateISO}`,
        studentId,
        studentName,
        dateISO,
        dateTs: Date.parse(`${dateISO}T00:00:00`),
        text: "Genomfört huvudhandledarsamtal",
        kind: "supervision",
      });
    }
    for (const a of pbAssessments) {
      const dateISO = normalizeToISODate(a?.dateISO || a?.date || a?.iso);
      if (!dateISO || dateISO > todayISO) continue;
      out.push({
        id: `${studentId}:assessment:${String(a?.id || crypto.randomUUID())}:${dateISO}`,
        studentId,
        studentName,
        dateISO,
        dateTs: Date.parse(`${dateISO}T00:00:00`),
        text: "Genomfört progressionsbedömning",
        kind: "assessment",
      });
    }

    const profile: any = (s as any)?.profile || {};
    const btEndISO = normalizeToISODate(profile?.btEndDate || profile?.bt_end_date || profile?.bt_end_iso);
    if (btEndISO && btEndISO <= todayISO) {
      out.push({
        id: `${studentId}:phase-bt-end:${btEndISO}`,
        studentId,
        studentName,
        dateISO: btEndISO,
        dateTs: Date.parse(`${btEndISO}T00:00:00`),
        text: "Avslutat BT",
        kind: "placement",
      });
    }

    const stEndISO = normalizeToISODate(profile?.stEndDate || profile?.st_end_date || profile?.stEndISO || profile?.st_end_iso);
    if (stEndISO && stEndISO <= todayISO) {
      out.push({
        id: `${studentId}:phase-st-end:${stEndISO}`,
        studentId,
        studentName,
        dateISO: stEndISO,
        dateTs: Date.parse(`${stEndISO}T00:00:00`),
        text: "Avslutat ST",
        kind: "placement",
      });
    }
  }

  return out.sort((a, b) => b.dateTs - a.dateTs || a.studentName.localeCompare(b.studentName, "sv"));
}

const FOLLOWUP_ACK_STORAGE_KEY = "st_ark_studierektor_uppfollow_ack_v1";
const FOLLOWUP_SUPPRESS_STORAGE_KEY = "st_ark_studierektor_uppfollow_suppress_v1";

function loadAckIdsFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FOLLOWUP_ACK_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

function saveAckIdsToStorage(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FOLLOWUP_ACK_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota */
  }
}

function loadSuppressIdsFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FOLLOWUP_SUPPRESS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

function saveSuppressIdsToStorage(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FOLLOWUP_SUPPRESS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota */
  }
}

function followupCutoffTs(): number {
  const d = new Date();
  d.setDate(d.getDate() - 60);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** True om det finns minst en oläst händelse (senaste 60 dagar, ej bekräftad och ej bortrensat från historik). */
export function studierektorUppdateringarHasUnread(students: SupervisorStudent[]): boolean {
  const ack = loadAckIdsFromStorage();
  const suppress = loadSuppressIdsFromStorage();
  const list = buildFollowupEvents(students);
  const cutoff = followupCutoffTs();
  return list.some(
    (e) => e.dateTs >= cutoff && !ack.has(e.id) && !suppress.has(e.id)
  );
}

export default function UppfoljningModal({
  open,
  onClose,
  students,
  studentColorById,
  renderTimelinePanel,
  onFollowupStorageChanged,
}: Props) {
  const [tab, setTab] = useState<FollowupTab>("updates");
  const [studentFilter, setStudentFilter] = useState<string>("all");
  const [timelineRequested, setTimelineRequested] = useState(false);
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [ackIds, setAckIds] = useState<Set<string>>(() => new Set());
  const [suppressIds, setSuppressIds] = useState<Set<string>>(() => new Set());

  const events = useMemo(() => buildFollowupEvents(students), [students]);
  const selectedStudent = useMemo(
    () => (studentFilter === "all" ? null : students.find((s) => String(s.id) === studentFilter) || null),
    [studentFilter, students]
  );

  const cutoffTs = useMemo(() => followupCutoffTs(), []);

  const filteredEvents = useMemo(() => {
    if (studentFilter === "all") return events;
    return events.filter((e) => e.studentId === studentFilter);
  }, [events, studentFilter]);

  const updateEvents = useMemo(
    () =>
      filteredEvents.filter(
        (e) =>
          e.dateTs >= cutoffTs &&
          !ackIds.has(e.id) &&
          !suppressIds.has(e.id)
      ),
    [filteredEvents, cutoffTs, ackIds, suppressIds]
  );
  const historyEvents = useMemo(
    () =>
      filteredEvents.filter(
        (e) =>
          (e.dateTs < cutoffTs || ackIds.has(e.id)) && !suppressIds.has(e.id)
      ),
    [filteredEvents, cutoffTs, ackIds, suppressIds]
  );
  const activeEvents = tab === "updates" ? updateEvents : historyEvents;

  const hasUnreadUpdates = useMemo(
    () =>
      events.some(
        (e) =>
          e.dateTs >= cutoffTs &&
          !ackIds.has(e.id) &&
          !suppressIds.has(e.id)
      ),
    [events, cutoffTs, ackIds, suppressIds]
  );

  const timelineRows = useMemo(() => {
    if (!selectedStudent) return [];
    return events.filter((e) => e.studentId === selectedStudent.id);
  }, [events, selectedStudent]);

  useEffect(() => {
    if (open) {
      setAckIds(loadAckIdsFromStorage());
      setSuppressIds(loadSuppressIdsFromStorage());
    }
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "updates") return;
    const next = loadAckIdsFromStorage();
    let changed = false;
    for (const e of events) {
      if (e.dateTs < cutoffTs) continue;
      if (suppressIds.has(e.id)) continue;
      if (next.has(e.id)) continue;
      next.add(e.id);
      changed = true;
    }
    if (!changed) return;
    saveAckIdsToStorage(next);
    setAckIds(next);
    onFollowupStorageChanged?.();
  }, [open, tab, events, cutoffTs, suppressIds, onFollowupStorageChanged]);

  useEffect(() => {
    if (!open) {
      setTimelineRequested(false);
      setTimelineVisible(false);
      setStudentFilter("all");
      setTab("updates");
    }
  }, [open]);

  useEffect(() => {
    setTimelineRequested(false);
    setTimelineVisible(false);
  }, [studentFilter, tab]);

  useEffect(() => {
    if (!timelineRequested) {
      setTimelineVisible(false);
      return;
    }
    const t = window.setTimeout(() => setTimelineVisible(true), 170);
    return () => window.clearTimeout(t);
  }, [timelineRequested]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[520] bg-black/60 p-4" onClick={onClose}>
      <div
        className="mx-auto flex h-[94vh] w-full max-w-[1450px] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`grid w-full items-start gap-3 transition-all duration-200 ease-out ${
            timelineRequested ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "xl:grid-cols-1"
          }`}
        >
          <section
            className={`max-h-[92vh] overflow-hidden rounded-xl bg-white shadow-2xl transition-all duration-200 ease-out ${
              timelineRequested ? "xl:mr-0" : "mx-auto w-full max-w-5xl"
            }`}
          >
            <div className="flex items-center justify-between border-b border-black px-6 py-4">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                {hasUnreadUpdates ? (
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                    aria-hidden
                  />
                ) : null}
                Uppdateringar
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Stäng
              </button>
            </div>

            <div className="border-b border-black">
              <div className="flex items-end justify-between gap-3 bg-slate-50 px-6 pt-2">
                <nav className="flex gap-1">
                  {[
                    { id: "updates" as const, label: "Uppdateringar", showDot: hasUnreadUpdates },
                    { id: "history" as const, label: "Historik", showDot: false },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`inline-flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:outline-none ${
                        tab === t.id
                          ? "-mb-px border-x border-t border-slate-200 bg-white text-slate-900"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {t.showDot ? (
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                          aria-hidden
                        />
                      ) : null}
                      {t.label}
                    </button>
                  ))}
                </nav>
                <div className="flex items-center gap-2 pb-2">
                  <select
                    value={studentFilter}
                    onChange={(e) => setStudentFilter(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    <option value="all">Alla ST-läkare</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {tab === "history" ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(loadSuppressIdsFromStorage());
                        for (const e of filteredEvents) {
                          if (e.dateTs < cutoffTs || ackIds.has(e.id)) {
                            next.add(e.id);
                          }
                        }
                        saveSuppressIdsToStorage(next);
                        setSuppressIds(next);
                        onFollowupStorageChanged?.();
                        setTab("updates");
                      }}
                      className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                    >
                      Rensa historik
                    </button>
                  ) : null}
                  {selectedStudent ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (timelineRequested) {
                          setTimelineRequested(false);
                          setTimelineVisible(false);
                        } else {
                          setTimelineRequested(true);
                        }
                      }}
                      className={
                        timelineRequested
                          ? "rounded-lg border border-red-600 bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                          : "rounded-lg border border-sky-600 bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
                      }
                    >
                      {timelineRequested ? "Stäng tidslinje" : "Öppna tidslinje"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="max-h-[calc(92vh-140px)] overflow-y-auto p-4">
              {activeEvents.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  {tab === "updates" ? "Inga nya uppdateringar." : "Ingen historik att visa."}
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">ST-läkare</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Händelse</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeEvents.map((e) => (
                        <tr key={e.id} className="bg-white">
                          <td className="whitespace-nowrap px-3 py-2 align-top">
                            <span className="inline-flex items-center gap-2 text-slate-900">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: studentColorById.get(e.studentId) || "hsl(210 70% 45%)" }}
                              />
                              <span className="font-medium">{e.studentName}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            <span className="font-medium text-slate-900">{formatDateSv(e.dateISO)}</span>
                            <span className="mx-1 text-slate-400">:</span>
                            <span>{e.text}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {timelineRequested && timelineVisible && selectedStudent ? (
            renderTimelinePanel ? (
              <section className="max-h-[92vh] overflow-hidden rounded-xl bg-white shadow-2xl opacity-100 transition-opacity duration-150">
                {renderTimelinePanel(selectedStudent, () => {
                  setTimelineRequested(false);
                  setTimelineVisible(false);
                })}
              </section>
            ) : (
              <section className="max-h-[92vh] overflow-hidden rounded-xl bg-white shadow-2xl opacity-100 transition-opacity duration-150">
                <div className="flex items-center justify-between border-b border-black px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: studentColorById.get(selectedStudent.id) || "hsl(210 70% 45%)" }}
                    />
                    <h3 className="text-base font-bold text-slate-900">{selectedStudent.name} · Tidslinje</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTimelineRequested(false);
                      setTimelineVisible(false);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
                  >
                    Stäng tidslinje
                  </button>
                </div>
                <div className="max-h-[calc(92vh-66px)] overflow-y-auto p-4">
                  {timelineRows.length === 0 ? (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                      Ingen tidslinjedata att visa.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {timelineRows.map((r) => (
                        <li key={`tl:${r.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                          <span className="font-medium text-slate-900">{formatDateSv(r.dateISO)}</span>
                          <span className="mx-1 text-slate-400">:</span>
                          <span className="text-slate-700">{r.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

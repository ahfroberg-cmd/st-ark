"use client";

import { displayMilestoneCode } from "@/lib/milestoneDisplay";
import { sortMilestoneIds } from "@/lib/milestoneSequence";
import { formatDate } from "@/lib/studierektor/dateUtils";

function calculateMonths(startDate: string, endDate: string, attendance: number = 100): number {
  if (!startDate || !endDate) return 0;
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.round(months * (attendance / 100) * 10) / 10;
  } catch {
    return 0;
  }
}

export default function ActivityDetailPopup({
  activity,
  onClose,
  goalsVersion,
  allCourses = [],
  allPlacements = [],
}: {
  activity: any;
  onClose: () => void;
  goalsVersion: string;
  allCourses?: any[];
  allPlacements?: any[];
}) {
  const isSession = activity?.__type === "supervision" || activity?.__type === "assessment";

  if (isSession) {
    const isSupervision = activity?.__type === "supervision";
    const title = activity?.title || activity?.name || (isSupervision ? "Handledarsamtal" : "Progressionsbedömning");
    const dateISO = activity?.dateISO || activity?.date || activity?.iso;

    const fieldValue = (v: any) => {
      if (v == null || v === "") return null;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
      return JSON.stringify(v);
    };

    const knownKeys = new Set([
      "__type",
      "id",
      "_id",
      "dateISO",
      "date",
      "iso",
      "title",
      "name",
      "note",
      "notes",
      "summary",
      "assessment",
      "kind",
      "type",
      "focus",
      "actions",
      "nextDateISO",
      "discussed",
      "phase",
      "level",
      "instrument",
      "strengths",
      "development",
    ]);

    const extraEntries = Object.entries(activity || {}).filter(([k, v]) => {
      if (v == null || v === "") return false;
      return !knownKeys.has(k);
    });

    const meetingFocus = fieldValue(activity?.focus);
    const meetingDiscussed = fieldValue(activity?.discussed);
    const meetingSummary = fieldValue(activity?.summary || activity?.note || activity?.notes);
    const meetingActions = fieldValue(activity?.actions);
    const meetingNextDateISO = fieldValue(activity?.nextDateISO);

    const assessmentPhase = fieldValue(activity?.phase);
    const assessmentInstrument = fieldValue(activity?.instrument);
    const assessmentLevel = fieldValue(activity?.level);
    const assessmentSummary = fieldValue(activity?.summary || activity?.note || activity?.notes);
    const assessmentStrengths = fieldValue(activity?.strengths);
    const assessmentDevelopment = fieldValue(activity?.development);

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="border-b border-black bg-white px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-600">{isSupervision ? "Handledarsamtal" : "Progressionsbedömning"}</p>
              </div>
              <button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50">
                Stäng
              </button>
            </div>
          </div>

          <div className="max-h-[calc(80vh-80px)] overflow-y-auto p-5 space-y-4">
            <div>
              <p className="text-sm text-slate-500">Datum</p>
              <p className="font-medium text-slate-900">{formatDate(dateISO)}</p>
            </div>

            {isSupervision ? (
              <>
                {meetingFocus && (
                  <div>
                    <p className="text-sm text-slate-500">Fokus</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{meetingFocus}</p>
                  </div>
                )}
                {meetingDiscussed && (
                  <div>
                    <p className="text-sm text-slate-500">Diskuterat</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{meetingDiscussed}</p>
                  </div>
                )}
                {meetingSummary && (
                  <div>
                    <p className="text-sm text-slate-500">Sammanfattning</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{meetingSummary}</p>
                  </div>
                )}
                {meetingActions && (
                  <div>
                    <p className="text-sm text-slate-500">Åtgärder</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{meetingActions}</p>
                  </div>
                )}
                {meetingNextDateISO && (
                  <div>
                    <p className="text-sm text-slate-500">Nästa datum</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{formatDate(meetingNextDateISO)}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {(assessmentInstrument || assessmentLevel) && (
                  <div>
                    <p className="text-sm text-slate-500">Instrument</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentInstrument || "—"}</p>
                  </div>
                )}
                {assessmentLevel && (
                  <div>
                    <p className="text-sm text-slate-500">Nivå</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentLevel}</p>
                  </div>
                )}
                {assessmentPhase && (
                  <div>
                    <p className="text-sm text-slate-500">Fas</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentPhase}</p>
                  </div>
                )}
                {assessmentSummary && (
                  <div>
                    <p className="text-sm text-slate-500">Sammanfattning</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentSummary}</p>
                  </div>
                )}
                {assessmentStrengths && (
                  <div>
                    <p className="text-sm text-slate-500">Styrkor</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentStrengths}</p>
                  </div>
                )}
                {assessmentDevelopment && (
                  <div>
                    <p className="text-sm text-slate-500">Utvecklingsområden</p>
                    <p className="text-slate-900 whitespace-pre-wrap">{assessmentDevelopment}</p>
                  </div>
                )}
              </>
            )}

            {extraEntries.length > 0 && (
              <div>
                <p className="text-sm text-slate-500">Övrigt</p>
                <div className="mt-2 space-y-2">
                  {extraEntries.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-2 gap-4">
                      <p className="text-sm text-slate-600 break-words">{k}</p>
                      <p className="text-sm text-slate-900 break-words">
                        {typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const milestones = activity.milestones || activity.stMilestones || [];
  const btMilestones = activity.btMilestones || [];
  const months = activity.startDate && activity.endDate ? calculateMonths(activity.startDate, activity.endDate, activity.attendance ?? 100) : null;

  const isCourse = !!(activity.title || activity.name || activity.kind || activity.certificateDate);
  const isUtbildningsmoment = String(activity?.kind || "") === "Utbildningsmoment";
  const utbTitle = String(activity?.title === "Annan" ? activity?.courseTitle || activity?.title : activity?.title || "").trim();
  const utbDateISO = String(activity?.startDate || activity?.endDate || activity?.certificateDate || "");
  const allUtbOccurrences = isUtbildningsmoment
    ? (allCourses || [])
        .filter((c: any) => String(c?.kind || "") === "Utbildningsmoment")
        .filter((c: any) => {
          const t = String(c?.title === "Annan" ? c?.courseTitle || c?.title : c?.title || "").trim();
          return t === utbTitle;
        })
        .slice()
        .sort((a: any, b: any) => String(a?.startDate || a?.endDate || "").localeCompare(String(b?.startDate || b?.endDate || "")))
    : [];
  const linkedPlacements = isUtbildningsmoment && utbDateISO
    ? (allPlacements || []).filter((p: any) => {
        const start = String(p?.startDate || "");
        const end = String(p?.endDate || "");
        return start && end && utbDateISO >= start && utbDateISO <= end;
      })
    : [];

  const chipLabel = (m: unknown) => displayMilestoneCode(String(m).trim(), goalsVersion);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-black bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{activity.clinic || activity.label || activity.title || activity.name || "Aktivitet"}</h3>
              <p className="text-sm text-slate-600">
                {activity.type || activity.kind || (isCourse ? "Kurs" : "Klinisk tjänstgöring")}
                {activity.phase && <span className="ml-2 font-medium">• {activity.phase}</span>}
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50">
              Stäng
            </button>
          </div>
        </div>

        <div className="max-h-[calc(80vh-80px)] overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Start</p>
              <p className="font-medium text-slate-900">{formatDate(activity.startDate)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{isCourse ? "Intygsdatum" : "Slut"}</p>
              <p className="font-medium text-slate-900">{formatDate(activity.certificateDate || activity.endDate)}</p>
            </div>
          </div>

          {!isCourse && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Sysselsättningsgrad</p>
                <p className="font-medium text-slate-900">{activity.attendance ?? 100}%</p>
              </div>
              {months !== null && (
                <div>
                  <p className="text-sm text-slate-500">Tjänstgöringstid</p>
                  <p className="font-medium text-slate-900">{months.toFixed(1)} mån</p>
                </div>
              )}
            </div>
          )}

          {activity.supervisor && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Handledare</p>
                <p className="font-medium text-slate-900">{activity.supervisor}</p>
              </div>
              {activity.supervisorSpeciality && (
                <div>
                  <p className="text-sm text-slate-500">Specialitet</p>
                  <p className="font-medium text-slate-900">{activity.supervisorSpeciality}</p>
                </div>
              )}
            </div>
          )}

          {activity.operationsManager && (
            <div>
              <p className="text-sm text-slate-500">Verksamhetschef</p>
              <p className="font-medium text-slate-900">{activity.operationsManager}</p>
            </div>
          )}

          {activity.studyDirector && (
            <div>
              <p className="text-sm text-slate-500">Studierektor</p>
              <p className="font-medium text-slate-900">{activity.studyDirector}</p>
            </div>
          )}

          {goalsVersion === "2021" && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">BT-delmål</p>
              <div className="flex items-center gap-1 flex-wrap">
                {btMilestones.length > 0 ? (
                  sortMilestoneIds(btMilestones as string[]).map((m: any) => (
                    <button key={`bt-${String(m)}`} type="button" className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition">
                      {chipLabel(m)}
                    </button>
                  ))
                ) : (
                  <span className="text-slate-400 text-sm">—</span>
                )}
              </div>
            </div>
          )}

          {milestones.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">ST-delmål</p>
              <div className="flex items-center gap-1 flex-wrap">
                {sortMilestoneIds(milestones as string[]).map((m: any) => (
                  <button key={`st-${String(m)}`} type="button" className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition">
                    {chipLabel(m)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activity.organizer && (
            <div>
              <p className="text-sm text-slate-500">Anordnare</p>
              <p className="font-medium text-slate-900">{activity.organizer}</p>
            </div>
          )}

          {activity.courseLeader && (
            <div>
              <p className="text-sm text-slate-500">Kursledare</p>
              <p className="font-medium text-slate-900">{activity.courseLeader}</p>
            </div>
          )}

          {(activity.note || activity.notes) && (
            <div>
              <p className="text-sm text-slate-500">Anteckningar</p>
              <p className="text-slate-900 whitespace-pre-wrap">{activity.note || activity.notes}</p>
            </div>
          )}

          {isUtbildningsmoment && (
            <div>
              <p className="text-sm text-slate-500">Alla tillfällen för samma utbildningsmoment</p>
              {allUtbOccurrences.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-900 space-y-1">
                  {allUtbOccurrences.map((c: any, idx: number) => (
                    <li key={c.id || idx}>
                      {(c.title === "Annan" ? c.courseTitle || c.title : c.title) || "Utbildningsmoment"} - {formatDate(c.startDate || c.endDate)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">Inga registrerade tillfällen.</p>
              )}
            </div>
          )}

          {isUtbildningsmoment && (
            <div>
              <p className="text-sm text-slate-500">Kopplat till klinisk tjänstgöring</p>
              {linkedPlacements.length > 0 ? (
                <div className="mt-1 space-y-1">
                  {linkedPlacements.map((p: any, idx: number) => (
                    <p key={p.id || idx} className="text-sm text-slate-900">
                      {(p.clinic || p.label || p.type || "Klinisk tjänstgöring")} ({formatDate(p.startDate)} - {formatDate(p.endDate)})
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Ingen registrerad klinisk tjänstgöring under perioden.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

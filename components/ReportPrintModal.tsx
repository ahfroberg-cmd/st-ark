// components/ReportPrintModal.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { db } from "@/lib/db";
import type { Profile, Placement, Course } from "@/lib/types";

type Status = "done" | "ongoing" | "planned" | null;

type ActivityRow = {
  id: string;
  kind: "placement" | "course";
  label: string;
  period: string;
  status: Status;
  description: string;
  supervisor?: string;
  courseLeader?: string;
  milestonesText?: string;
};


function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMilestonesList(source: any): string {
  const arr = Array.isArray(source) ? source : [];
  const codes = arr
    .map((v) => String(v ?? "").trim())
    .filter((v) => v.length > 0);

  const normalize = (value: string) => {
    const raw = value.toUpperCase().replace(/\s/g, "");
    const m = raw.match(/^(ST)?([ABC])(\d+)/);
    if (!m) {
      return { group: 99, num: 0, raw };
    }
    const letter = m[2];
    const num = parseInt(m[3], 10) || 0;
    const group =
      letter === "A" ? 1 :
      letter === "B" ? 2 :
      letter === "C" ? 3 :
      99;
    return { group, num, raw };
  };

  codes.sort((a, b) => {
    const na = normalize(a);
    const nb = normalize(b);
    if (na.group !== nb.group) return na.group - nb.group;
    if (na.num !== nb.num) return na.num - nb.num;
    return na.raw.localeCompare(nb.raw);
  });

  return codes
    .map((code) => {
      const s = String(code ?? "").trim();
      // Behåll bara "a3", "b1", "c7", "stb3" osv.
      // Om koden innehåller bindestreck klipper vi vid första.
      return s.includes("-") ? s.split("-")[0] : s;
    })
    .join(", ");

}


function normalizeISO(v: any): string {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/**
 * Klassificerar en aktivitet enligt:
 * - start < idag och (ingen slut eller slut >= idag): "ongoing" (pågående)
 * - start <= slut < idag: "done" (genomförd)
 * - start > idag: "planned" (planerad)
 * Om varken start eller slut finns → null
 */
function classifyActivity(start?: any, end?: any): Status {
  const s = normalizeISO(start);
  const e = normalizeISO(end);
  const today = todayISO();

  if (!s && !e) return null;

  if (s && s > today) return "planned";
  if (e && e < today) return "done";
  if (s && s <= today && (!e || e >= today)) return "ongoing";

  return null;
}

function statusMatchesFilter(
  status: Status,
  showDone: boolean,
  showOngoing: boolean,
  showPlanned: boolean
) {
  if (status === "done") return showDone;
  if (status === "ongoing") return showOngoing;
  if (status === "planned") return showPlanned;
  return true;
}

/* ===========================
   Förhandsvisnings-overlay
   =========================== */

type ReportPreviewProps = {
  open: boolean;
  onClose: () => void;
  onDownloadPdf: () => void;
  contentRef: React.RefObject<HTMLDivElement>;
  profileName: string;
  profileSpecialty: string;
  profileGoalsVersion: string;
  profileMainSupervisor: string;
  printDate: string;
  placements: ActivityRow[];
  courses: ActivityRow[];
  includeDesc: Record<string, boolean>;
  includeMilestones: Record<string, boolean>;
  includeSupervisor: Record<string, boolean>;
};



function ReportPreview(props: ReportPreviewProps) {
  const {
    open,
    onClose,
    onDownloadPdf,
    contentRef,
    profileName,
    profileSpecialty,
    profileGoalsVersion,
    profileMainSupervisor,
    printDate,
    placements,
    courses,
    includeDesc,
    includeMilestones,
    includeSupervisor,
  } = props;

  const showPlacementSupervisor = placements.some(
    (r) => includeSupervisor[r.id]
  );
  const showPlacementMilestones = placements.some(
    (r) => includeMilestones[r.id]
  );
  const showPlacementDesc = placements.some((r) => includeDesc[r.id]);

  const showCourseLeader = courses.some((r) => includeSupervisor[r.id]);
  const showCourseMilestones = courses.some((r) => includeMilestones[r.id]);
  const showCourseDesc = courses.some((r) => includeDesc[r.id]);

  if (!open) return null;


  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Förhandsvisning av rapport
          </h2>
          <div className="flex items-center gap-2">
            <button
  type="button"
  onClick={onDownloadPdf}
  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
  data-info="Skapar och laddar ner rapporten som PDF. Du kan sedan skriva ut eller spara rapporten."
>
  Skriv ut rapport
</button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              data-info="Stänger förhandsvisningen av rapporten och återgår till huvudvyn."
            >
              Stäng
            </button>
          </div>
        </div>

        {/* Själva "sidan" som visas och exporteras till PDF */}
        <div className="flex-1 overflow-auto px-4 py-4">
          <div className="flex justify-center">
            <div
              ref={contentRef}
              id="report-preview-print-root"
              className="w-full max-w-4xl rounded-xl bg-white px-8 py-8 shadow-sm"
            >
              {/* Header med ST-info */}
                          <header className="mb-6 border-b border-slate-200 pb-4">
                <h1 className="text-xl font-bold text-slate-900">
                  IUP - Utbildningsaktiviteter
                </h1>
                <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-800 sm:grid-cols-2">
                  <div>
                    <span className="font-semibold">Namn: </span>
                    {profileName || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Specialitet: </span>
                    {profileSpecialty || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Huvudhandledare: </span>
                    {profileMainSupervisor || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Målversion: </span>
                    {profileGoalsVersion || "—"}
                  </div>
                  
                </div>
              </header>


                            {/* Kliniska tjänstgöringar, arbeten, frånvaro */}
              {placements.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-slate-900">
                    Kliniska tjänstgöringar, arbeten, frånvaro
                  </h2>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                            Utbildningsmoment
                          </th>
                          <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                            Period
                          </th>
                          {showPlacementSupervisor && (
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                              Handledare
                            </th>
                          )}
                          {showPlacementMilestones && (
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                              Delmål
                            </th>
                          )}
                          {showPlacementDesc && (
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                              Beskrivning
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {placements.map((r) => {
                          const descChecked = !!includeDesc[r.id];
                          const hasDesc =
                            descChecked &&
                            r.description &&
                            r.description.trim().length > 0;

                          const milestonesChecked = !!includeMilestones[r.id];
                          const hasMilestones =
                            milestonesChecked &&
                            r.milestonesText &&
                            r.milestonesText.trim().length > 0;

                          const supervisorChecked = !!includeSupervisor[r.id];
                          const hasSupervisor =
                            supervisorChecked &&
                            r.supervisor &&
                            r.supervisor.trim().length > 0;

                          return (
                            <tr
                              key={r.id}
                              className="align-top"
                            >
                              <td className="border border-slate-200 px-3 py-2">
                                <div className="text-[11px] font-semibold text-slate-900">
                                  {r.label || "—"}
                                </div>
                              </td>
                              <td className="border border-slate-200 px-3 py-2 whitespace-nowrap text-[11px] text-slate-700">
                                {r.period || "—"}
                              </td>
                              {showPlacementSupervisor && (
                                <td className="border border-slate-200 px-3 py-2 text-[11px] text-slate-700">
                                  {hasSupervisor ? r.supervisor : "—"}
                                </td>
                              )}
                              {showPlacementMilestones && (
                                <td className="border border-slate-200 px-3 py-2 text-[11px] text-slate-700">
                                  {hasMilestones ? r.milestonesText : "—"}
                                </td>
                              )}
                              {showPlacementDesc && (
                                <td className="border border-slate-200 px-3 py-2 text-[11px] text-slate-700">
                                  {hasDesc ? (
                                    <div className="whitespace-pre-wrap text-[10px] text-slate-700">
                                      {r.description}
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

<h2 className="mb-5 text-sm font-semibold text-slate-900">
                    
                  </h2>

                            {/* Kurser */}
              {courses.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-slate-900">
                    Kurser
                  </h2>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                            Titel
                          </th>
                          <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                            Datum
                          </th>
                          {showCourseLeader && (
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                              Kursledare
                            </th>
                          )}
                          {showCourseMilestones && (
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                              Delmål
                            </th>
                          )}
                          {showCourseDesc && (
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
                              Beskrivning
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {courses.map((r) => {
                          const descChecked = !!includeDesc[r.id];
                          const hasDesc =
                            descChecked &&
                            r.description &&
                            r.description.trim().length > 0;

                          const milestonesChecked = !!includeMilestones[r.id];
                          const hasMilestones =
                            milestonesChecked &&
                            r.milestonesText &&
                            r.milestonesText.trim().length > 0;

                          const supervisorChecked = !!includeSupervisor[r.id];
                          const hasLeader =
                            supervisorChecked &&
                            r.courseLeader &&
                            r.courseLeader.trim().length > 0;

                          return (
                            <tr
                              key={r.id}
                              className="align-top"
                            >
                              <td className="border border-slate-200 px-3 py-2">
                                <div className="text-[11px] font-semibold text-slate-900">
                                  {r.label || "—"}
                                </div>
                              </td>
                              <td className="border border-slate-200 px-3 py-2 whitespace-nowrap text-[11px] text-slate-700">
                                {r.period || "—"}
                              </td>
                              {showCourseLeader && (
                                <td className="border border-slate-200 px-3 py-2 text-[11px] text-slate-700">
                                  {hasLeader ? r.courseLeader : "—"}
                                </td>
                              )}
                              {showCourseMilestones && (
                                <td className="border border-slate-200 px-3 py-2 text-[11px] text-slate-700">
                                  {hasMilestones ? r.milestonesText : "—"}
                                </td>
                              )}
                              {showCourseDesc && (
                                <td className="border border-slate-200 px-3 py-2 text-[11px] text-slate-700">
                                  {hasDesc ? (
                                    <div className="whitespace-pre-wrap text-[10px] text-slate-700">
                                      {r.description}
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Huvudpanel för rapporten
   =========================== */

export function ReportPanel() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<ActivityRow[]>([]);

  const [showDone, setShowDone] = useState(true);
  const [showOngoing, setShowOngoing] = useState(true);
  const [showPlanned, setShowPlanned] = useState(true);

  // Per-rad-val
  const [includeDesc, setIncludeDesc] = useState<Record<string, boolean>>({});
  const [hideInReport, setHideInReport] = useState<Record<string, boolean>>({});
  const [includeMilestones, setIncludeMilestones] = useState<
    Record<string, boolean>
  >({});
  const [includeSupervisor, setIncludeSupervisor] = useState<
    Record<string, boolean>
  >({});

  // Förhandsvisning
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        const p = await db.profile.get("default");
        const placementsRaw = ((await db.placements.toArray()) ?? []) as Placement[];
        const coursesRaw = ((await db.courses.toArray()) ?? []) as Course[];

        if (!live) return;

        setProfile((p as any) ?? null);

        const today = todayISO();

        const placementRows: ActivityRow[] = placementsRaw.map((pl: any) => {
          const id = String(pl.id ?? "");

          const label =
            pl.clinic ||
            pl.name ||
            pl.title ||
            (pl.type && String(pl.type)) ||
            "Klinisk tjänstgöring";

          const start = normalizeISO(pl.startDate);
          const end = normalizeISO(pl.endDate);
          const period =
            start && end
              ? `${start} – ${end}`
              : start
              ? `${start} –`
              : end
              ? `– ${end}`
              : "—";

          const description = String(pl.note ?? "").trim();
          const status = classifyActivity(pl.startDate, pl.endDate);

          const supervisor =
            pl.supervisorName ??
            pl.supervisor ??
            pl.handledare ??
            "";

          const milestonesSource =
            (Array.isArray(pl.milestones) && pl.milestones) ||
            (Array.isArray(pl.goalIds) && pl.goalIds) ||
            [];
          const milestonesText = formatMilestonesList(milestonesSource);


          return {
            id,
            kind: "placement",
            label,
            period,
            status,
            description,
            supervisor,
            milestonesText,
          };

        });

        const courseRows: ActivityRow[] = coursesRaw.map((c: any) => {
          const id = String(c.id ?? "");
          const label = c.title || c.name || "Kurs";

          const start = normalizeISO(c.startDate || c.certificateDate);
          const end = normalizeISO(c.endDate || c.certificateDate);

          let status: Status = null;
          if (c.startDate || c.endDate) {
            status = classifyActivity(c.startDate, c.endDate);
          } else if (c.certificateDate) {
            const cert = normalizeISO(c.certificateDate);
            status = cert && cert < today ? "done" : "planned";
          }

          const baseDate = normalizeISO(
            c.certificateDate || c.endDate || c.startDate
          );
          const period = baseDate || "—";

          const description = String(c.note ?? "").trim();

          const courseLeader =
            c.courseLeaderName ??
            c.leader ??
            c.kursledare ??
            "";

          const milestonesSource =
            (Array.isArray(c.milestones) && c.milestones) ||
            (Array.isArray(c.goalIds) && c.goalIds) ||
            [];
          const milestonesText = formatMilestonesList(milestonesSource);


          return {
            id,
            kind: "course",
            label,
            period,
            status,
            description,
            courseLeader,
            milestonesText,
          };

        });
        const allRows = [...placementRows, ...courseRows];
        allRows.sort((a, b) => a.period.localeCompare(b.period));

        setRows(allRows);

        const inc: Record<string, boolean> = {};
        const hide: Record<string, boolean> = {};
        const incMil: Record<string, boolean> = {};
        const incSup: Record<string, boolean> = {};
        for (const r of allRows) {
          inc[r.id] = true;
          hide[r.id] = false;
          incMil[r.id] = true;
          incSup[r.id] = true;
        }
        setIncludeDesc(inc);
        setHideInReport(hide);
        setIncludeMilestones(incMil);
        setIncludeSupervisor(incSup);
      } catch {
        if (!live) return;
        setProfile(null);
        setRows([]);
        setIncludeDesc({});
        setHideInReport({});
        setIncludeMilestones({});
        setIncludeSupervisor({});
      }

    })();

    return () => {
      live = false;
    };
  }, []);

  const filteredRows = useMemo(
    () =>
      rows.filter((r) =>
        statusMatchesFilter(r.status, showDone, showOngoing, showPlanned)
      ),
    [rows, showDone, showOngoing, showPlanned]
  );

  const placementRows = filteredRows.filter((r) => r.kind === "placement");
  const courseRows = filteredRows.filter((r) => r.kind === "course");

  const allPlacementDescChecked =
    placementRows.length > 0 &&
    placementRows.every((r) => includeDesc[r.id]);
  const allPlacementMilestonesChecked =
    placementRows.length > 0 &&
    placementRows.every((r) => includeMilestones[r.id]);
  const allPlacementSupervisorChecked =
    placementRows.length > 0 &&
    placementRows.every((r) => includeSupervisor[r.id]);

  const allCourseDescChecked =
    courseRows.length > 0 &&
    courseRows.every((r) => includeDesc[r.id]);
  const allCourseMilestonesChecked =
    courseRows.length > 0 &&
    courseRows.every((r) => includeMilestones[r.id]);
  const allCourseSupervisorChecked =
    courseRows.length > 0 &&
    courseRows.every((r) => includeSupervisor[r.id]);

  return (
    <>

            <div 
              className="space-y-4 text-sm text-slate-900"
              data-info="Rapportfliken för utbildningsmoment visar rapporter baserade på dina registrerade utbildningsaktiviteter. Här kan du se alla kliniska tjänstgöringar, kurser och andra aktiviteter som är kopplade till din utbildning. Du kan välja vilka aktiviteter som ska visas baserat på status (genomförda, pågående, planerade) och vilka kolumner som ska inkluderas (handledare, delmål, beskrivning)."
            >
        {/* Skärmvy: konfiguration */}
        <div className="space-y-4">
          {/* Rubrik + Förhandsgranska på samma rad */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Kliniska tjänstgöringar, arbeten, frånvaro
            </h3>
            <button
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              data-info="Öppnar en förhandsvisning av rapporten där du kan se hur den kommer att se ut när den skrivs ut eller exporteras till PDF."
            >
              Förhandsgranska
            </button>
          </div>

          {/* Rad under: Visa: Genomförda / Pågående / Planerade */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {/* Statusfilter: Genomförda / Pågående / Planerade */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-800">
                Visa:
              </span>
              <label className="inline-flex items-center gap-1 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={showDone}
                  onChange={(e) => setShowDone(e.target.checked)}
                  data-info="Kryssa i denna ruta för att visa genomförda utbildningsaktiviteter i rapporten. Genomförda aktiviteter är aktiviteter som har ett slutdatum som ligger i det förflutna."
                />
                <span data-info="Kryssa i denna ruta för att visa genomförda utbildningsaktiviteter i rapporten. Genomförda aktiviteter är aktiviteter som har ett slutdatum som ligger i det förflutna.">Genomförda</span>
              </label>
              <label className="inline-flex items-center gap-1 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={showOngoing}
                  onChange={(e) => setShowOngoing(e.target.checked)}
                  data-info="Kryssa i denna ruta för att visa pågående utbildningsaktiviteter i rapporten. Pågående aktiviteter är aktiviteter som har startat men inte avslutats ännu."
                />
                <span data-info="Kryssa i denna ruta för att visa pågående utbildningsaktiviteter i rapporten. Pågående aktiviteter är aktiviteter som har startat men inte avslutats ännu.">Pågående</span>
              </label>
              <label className="inline-flex items-center gap-1 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-3 w-3"
                  checked={showPlanned}
                  onChange={(e) => setShowPlanned(e.target.checked)}
                  data-info="Kryssa i denna ruta för att visa planerade utbildningsaktiviteter i rapporten. Planerade aktiviteter är aktiviteter med ett startdatum i framtiden."
                />
                <span data-info="Kryssa i denna ruta för att visa planerade utbildningsaktiviteter i rapporten. Planerade aktiviteter är aktiviteter med ett startdatum i framtiden.">Planerade</span>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">

            <table className="w-full border-collapse border border-slate-200 text-[11px]">
              

              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Utbildningsmoment
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Period / datum
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <label className="inline-flex items-center gap-1 text-xs font-semibold">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={allPlacementSupervisorChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIncludeSupervisor((prev) => {
                            const next = { ...prev };
                            placementRows.forEach((r) => {
                              if (!hideInReport[r.id]) {
                                next[r.id] = checked;
                              }
                            });
                            return next;
                          });
                        }}
                        data-info="Kryssa i denna ruta för att inkludera kolumnen 'Handledare' i rapporten för utbildningsmoment. Denna kolumn visar namnet på handledaren för varje klinisk tjänstgöring."
                      />
                      <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Handledare' i rapporten för utbildningsmoment. Denna kolumn visar namnet på handledaren för varje klinisk tjänstgöring.">Handledare</span>
                    </label>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <label className="inline-flex items-center gap-1 text-xs font-semibold">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={allPlacementMilestonesChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIncludeMilestones((prev) => {
                            const next = { ...prev };
                            placementRows.forEach((r) => {
                              if (!hideInReport[r.id]) {
                                next[r.id] = checked;
                              }
                            });
                            return next;
                          });
                        }}
                        data-info="Kryssa i denna ruta för att inkludera kolumnen 'Delmål' i rapporten för utbildningsmoment. Denna kolumn visar vilka delmål som är kopplade till varje aktivitet."
                      />
                      <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Delmål' i rapporten för utbildningsmoment. Denna kolumn visar vilka delmål som är kopplade till varje aktivitet.">Delmål</span>
                    </label>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <label className="inline-flex items-center gap-1 text-xs font-semibold">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={allPlacementDescChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIncludeDesc((prev) => {
                            const next = { ...prev };
                            placementRows.forEach((r) => {
                              if (!hideInReport[r.id]) {
                                next[r.id] = checked;
                              }
                            });
                            return next;
                          });
                        }}
                        data-info="Kryssa i denna ruta för att inkludera kolumnen 'Beskrivning' i rapporten för utbildningsmoment. Denna kolumn visar en beskrivning av aktiviteten om sådan finns angiven."
                      />
                      <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Beskrivning' i rapporten för utbildningsmoment. Denna kolumn visar en beskrivning av aktiviteten om sådan finns angiven.">Beskrivning</span>
                    </label>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Dölj i rapport
                  </th>
                </tr>
              </thead>
              <tbody>
                {placementRows.map((r) => {
                  const hidden = !!hideInReport[r.id];

                  return (
                    <tr
                      key={r.id}
                      className={`border-t hover:bg-slate-50/60 ${
                        hidden ? "text-slate-400" : ""
                      }`}
                    >
                      <td className="px-3 py-2 align-top font-semibold text-xs">
                        {r.label || "—"}
                      </td>
                      <td
                        className={
                          hidden
                            ? "px-3 py-2 align-top text-slate-400 text-xs"
                            : "px-3 py-2 align-top text-slate-700 text-xs"
                        }
                      >
                        {r.period || "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-sm">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={!!includeSupervisor[r.id]}
                          disabled={hidden}
                          onChange={(e) =>
                            setIncludeSupervisor((prev) => ({
                              ...prev,
                              [r.id]: !hidden && e.target.checked,
                            }))
                          }
                          data-info="Kryssa i denna ruta för att inkludera handledaren för denna kliniska tjänstgöring i rapporten. Om tjänstgöringen är dold i rapporten är rutan inaktiverad."
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={!!includeMilestones[r.id]}
                          disabled={hidden}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIncludeMilestones((prev) => ({
                              ...prev,
                              [r.id]: !hidden && checked,
                            }));
                          }}
                          data-info="Kryssa i denna ruta för att inkludera delmålen för denna kliniska tjänstgöring i rapporten. Om tjänstgöringen är dold i rapporten är rutan inaktiverad."
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={!!includeDesc[r.id]}
                          disabled={hidden}
                          onChange={(e) =>
                            setIncludeDesc((prev) => ({
                              ...prev,
                              [r.id]: !hidden && e.target.checked,
                            }))
                          }
                          data-info="Kryssa i denna ruta för att inkludera beskrivningen för denna kliniska tjänstgöring i rapporten. Om tjänstgöringen är dold i rapporten är rutan inaktiverad."
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={hidden}
                          onChange={(e) => {
                            const value = e.target.checked;
                            setHideInReport((prev) => ({
                              ...prev,
                              [r.id]: value,
                            }));
                            if (value) {
                              setIncludeDesc((prev) => ({
                                ...prev,
                                [r.id]: false,
                              }));
                              setIncludeMilestones((prev) => ({
                                ...prev,
                                [r.id]: false,
                              }));
                              setIncludeSupervisor((prev) => ({
                                ...prev,
                                [r.id]: false,
                              }));
                            }
                          }}
                          data-info="Kryssa i denna ruta för att dölja denna kliniska tjänstgöring i rapporten. När en tjänstgöring är dold kommer den inte att visas i rapporten och alla dess kolumner (handledare, delmål, beskrivning) kommer automatiskt att avmarkeras."
                        />
                      </td>
                    </tr>
                  );
                })}
                {placementRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-center text-sm text-slate-500"
                    >
                      Inga kliniska tjänstgöringar matchar filtren.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>


          {/* Kurser */}
          <h3 className="mt-8 mb-2 text-sm font-semibold text-slate-800">
            Kurser
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full border-collapse border border-slate-200 text-[11px]">

              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Titel
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Period / datum
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <label className="inline-flex items-center gap-1 text-xs font-semibold">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={allCourseSupervisorChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIncludeSupervisor((prev) => {
                            const next = { ...prev };
                            courseRows.forEach((r) => {
                              if (!hideInReport[r.id]) {
                                next[r.id] = checked;
                              }
                            });
                            return next;
                          });
                        }}
                        data-info="Kryssa i denna ruta för att inkludera kolumnen 'Kursledare' i rapporten för kurser. Denna kolumn visar namnet på kursledaren för varje kurs."
                      />
                      <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Kursledare' i rapporten för kurser. Denna kolumn visar namnet på kursledaren för varje kurs.">Kursledare</span>
                    </label>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <label className="inline-flex items-center gap-1 text-xs font-semibold">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={allCourseMilestonesChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIncludeMilestones((prev) => {
                            const next = { ...prev };
                            courseRows.forEach((r) => {
                              if (!hideInReport[r.id]) {
                                next[r.id] = checked;
                              }
                            });
                            return next;
                          });
                        }}
                        data-info="Kryssa i denna ruta för att inkludera kolumnen 'Delmål' i rapporten för kurser. Denna kolumn visar vilka delmål som är kopplade till varje kurs."
                      />
                      <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Delmål' i rapporten för kurser. Denna kolumn visar vilka delmål som är kopplade till varje kurs.">Delmål</span>
                    </label>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <label className="inline-flex items-center gap-1 text-xs font-semibold">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={allCourseDescChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIncludeDesc((prev) => {
                            const next = { ...prev };
                            courseRows.forEach((r) => {
                              if (!hideInReport[r.id]) {
                                next[r.id] = checked;
                              }
                            });
                            return next;
                          });
                        }}
                        data-info="Kryssa i denna ruta för att inkludera kolumnen 'Beskrivning' i rapporten för kurser. Denna kolumn visar en beskrivning av kursen om sådan finns angiven."
                      />
                      <span data-info="Kryssa i denna ruta för att inkludera kolumnen 'Beskrivning' i rapporten för kurser. Denna kolumn visar en beskrivning av kursen om sådan finns angiven.">Beskrivning</span>
                    </label>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Dölj i rapport
                  </th>
                </tr>
              </thead>
              <tbody>
                {courseRows.map((r) => {
                  const hidden = !!hideInReport[r.id];

                  return (
                    <tr
                      key={r.id}
                      className={`border-t hover:bg-slate-50/60 ${
                        hidden ? "text-slate-400" : ""
                      }`}
                    >
                      <td className="px-3 py-2 align-top font-semibold text-xs">
                        {r.label || "—"}
                      </td>
                      <td
                        className={
                          hidden
                            ? "px-3 py-2 align-top text-slate-400 text-xs"
                            : "px-3 py-2 align-top text-slate-700 text-xs"
                        }
                      >
                        {r.period || "—"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={!!includeSupervisor[r.id]}
                          disabled={hidden}
                          onChange={(e) =>
                            setIncludeSupervisor((prev) => ({
                              ...prev,
                              [r.id]: !hidden && e.target.checked,
                            }))
                          }
                          data-info="Kryssa i denna ruta för att inkludera kursledaren för denna kurs i rapporten. Om kursen är dold i rapporten är rutan inaktiverad."
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={!!includeMilestones[r.id]}
                          disabled={hidden}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIncludeMilestones((prev) => ({
                              ...prev,
                              [r.id]: !hidden && checked,
                            }));
                          }}
                          data-info="Kryssa i denna ruta för att inkludera delmålen för denna kurs i rapporten. Om kursen är dold i rapporten är rutan inaktiverad."
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={!!includeDesc[r.id]}
                          disabled={hidden}
                          onChange={(e) =>
                            setIncludeDesc((prev) => ({
                              ...prev,
                              [r.id]: !hidden && e.target.checked,
                            }))
                          }
                          data-info="Kryssa i denna ruta för att inkludera beskrivningen för denna kurs i rapporten. Om kursen är dold i rapporten är rutan inaktiverad."
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          className="h-3 w-3"
                          checked={hidden}
                          onChange={(e) => {
                            const value = e.target.checked;
                            setHideInReport((prev) => ({
                              ...prev,
                              [r.id]: value,
                            }));
                            if (value) {
                              setIncludeDesc((prev) => ({
                                ...prev,
                                [r.id]: false,
                              }));
                              setIncludeMilestones((prev) => ({
                                ...prev,
                                [r.id]: false,
                              }));
                              setIncludeSupervisor((prev) => ({
                                ...prev,
                                [r.id]: false,
                              }));
                            }
                          }}
                          data-info="Kryssa i denna ruta för att dölja denna kurs i rapporten. När en kurs är dold kommer den inte att visas i rapporten och alla dess kolumner (kursledare, delmål, beskrivning) kommer automatiskt att avmarkeras."
                        />
                      </td>
                    </tr>
                  );
                })}
                {courseRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-center text-sm text-slate-500"
                    >
                      Inga kurser matchar filtren.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Förhandsvisning + PDF-/skrivexport */}
      <ReportPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onDownloadPdf={async () => {
          if (
            typeof window === "undefined" ||
            typeof document === "undefined"
          ) {
            return;
          }
          const root = previewContentRef.current;
          if (!root) return;

          const body = document.body;

          // Spara ursprunglig placering i DOM
          const originalParent = root.parentElement;
          const originalNextSibling = root.nextSibling;

          // Flytta rapportinnehållet direkt under <body> inför utskrift
          body.appendChild(root);
          body.classList.add("print-report-preview");

          const cleanup = () => {
            // Flytta tillbaka rapporten till ursprunglig plats
            if (originalParent) {
              if (originalNextSibling) {
                originalParent.insertBefore(root, originalNextSibling);
              } else {
                originalParent.appendChild(root);
              }
            }

            body.classList.remove("print-report-preview");
            window.removeEventListener("afterprint", cleanup);
          };

          window.addEventListener("afterprint", cleanup);

          window.print();
        }}
        contentRef={previewContentRef}
        profileName={
          (profile as any)?.name ?? (profile as any)?.fullName ?? ""
        }
        profileSpecialty={
          (profile as any)?.specialty ??
          (profile as any)?.speciality ??
          ""
        }
        profileGoalsVersion={
          (profile as any)?.goalsVersion ?? ""
        }
        profileMainSupervisor={
          (profile as any)?.mainSupervisorName ??
          (profile as any)?.supervisor ??
          (profile as any)?.huvudhandledare ??
          (profile as any)?.supervisorName ??
          ""
        }
        printDate={todayISO()}
        placements={filteredRows
          .filter((r) => !hideInReport[r.id])
          .filter((r) => r.kind === "placement")}
        courses={filteredRows
          .filter((r) => !hideInReport[r.id])
          .filter((r) => r.kind === "course")}
        includeDesc={includeDesc}
        includeMilestones={includeMilestones}
        includeSupervisor={includeSupervisor}
      />



    </>
  );
}

/* ===========================
   Modal-wrapper för rapport
   =========================== */

type ReportPrintModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function ReportPrintModal({
  open,
  onClose,
}: ReportPrintModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40">
      <div
        id="report-print-root"
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-slate-50 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Rapport – utbildningsaktiviteter
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            data-info="Stänger rapport-modalen och återgår till huvudvyn."
          >
            Stäng
          </button>
        </div>
        <div className="max-h-[calc(90vh-3rem)] overflow-auto p-4">
          <ReportPanel />
        </div>
      </div>
    </div>,
    document.body
  );
}

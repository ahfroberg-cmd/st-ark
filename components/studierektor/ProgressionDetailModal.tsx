"use client";

import { formatDate, isValidISODate } from "@/lib/studierektor/dateUtils";
import type { WarningActivityKind, WarningRule } from "@/lib/studierektor/warningRuleTypes";

export default function ProgressionDetailModal({
  progressionDetailStudentId,
  setProgressionDetailStudentId,
  progressionRows,
  warningRules,
  getStudentStartISO,
  getStudentPlannedEndISO,
}: {
  progressionDetailStudentId: string | null;
  setProgressionDetailStudentId: (id: string | null) => void;
  progressionRows: any[];
  warningRules: WarningRule[];
  getStudentStartISO: (student: any) => string | null;
  getStudentPlannedEndISO: (student: any) => string | null;
}) {
  if (!progressionDetailStudentId) return null;
  const row = progressionRows.find((r) => String(r.student.id) === String(progressionDetailStudentId));
  if (!row) return null;

  const startISO = getStudentStartISO(row.student);
  const endISO = row.endISO || getStudentPlannedEndISO(row.student) || "";
  const todayISO = new Date().toISOString().slice(0, 10);
  const monthsLeft =
    endISO && isValidISODate(endISO)
      ? Math.round(
          (new Date(`${endISO}T00:00:00`).getTime() - new Date(`${todayISO}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
        )
      : null;

  const activityKindSv = (kind: WarningActivityKind | undefined) =>
    kind === "kurs" ? "kurser" : kind === "arbete" ? "arbeten" : "kliniska tjänstgöringar";

  const rulesEvaluation = warningRules.map((rule) => {
    const threshold = Number(rule.params.monthsLeftThreshold ?? 6);
    const minProgress = Number(rule.params.minProgressPercent ?? 70);
    const inWindow = monthsLeft != null && monthsLeft <= threshold;

    const headline =
      rule.type === "milestone_overall"
        ? "Delmål totalt (hela ST-tiden)"
        : rule.type === "milestone_activity"
          ? `Delmål för ${activityKindSv(rule.params.activityKind)}`
          : "Obligatoriska kliniska tjänstgöringar";

    if (!rule.enabled) {
      return {
        id: rule.id,
        headline,
        explanation:
          "Studierektorn har stängt av den här regeln. Den visas här så du ser att den finns, men den ger inga varningar just nu.",
        outcome: "Ingen kontroll.",
        ok: true,
      };
    }
    if (!inWindow) {
      return {
        id: rule.id,
        headline,
        explanation: `Regeln är bara aktiv när det är högst ${threshold} månader kvar till planerat slutdatum. Då jämförs studentens läge mot det studierektorn bestämt. Om det är längre tid kvar än så väntar regeln.`,
        outcome:
          monthsLeft == null
            ? "Slutdatum saknas eller är okänt, så vi kan inte avgöra tidsfönstret."
            : `Just nu är det ${monthsLeft} månader kvar — mer än ${threshold}, så regeln är vilande.`,
        ok: true,
      };
    }

    if (rule.type === "milestone_overall") {
      const ok = row.delmalPct >= minProgress;
      return {
        id: rule.id,
        headline,
        explanation: `När det är högst ${threshold} månader kvar ska minst ${minProgress} % av hela ST-tiden vara genomförd enligt tidslinjen (andel av tiden mellan start och planerat slut). Ligger man under det kan det ge varning.`,
        outcome: ok
          ? `Studenten ligger på ${row.delmalPct} %, vilket når kravet på minst ${minProgress} %.`
          : `Studenten ligger på ${row.delmalPct} %, men minst ${minProgress} % krävs inom det här tidsfönstret.`,
        ok,
      };
    }
    if (rule.type === "milestone_activity") {
      const kind = rule.params.activityKind || "placering";
      const current = kind === "kurs" ? row.kursProgressPct : kind === "arbete" ? row.arbeteProgressPct : row.klinProgressPct;
      const ok = current >= minProgress;
      const kindSv = activityKindSv(kind);
      return {
        id: rule.id,
        headline,
        explanation: `När det är högst ${threshold} månader kvar ska minst ${minProgress} % av aktiviteterna inom ${kindSv} ha delmål markerade som uppfyllda (andel av alla sådana aktiviteter i listan).`,
        outcome: ok
          ? `Andelen är ${current} %, vilket når kravet på minst ${minProgress} %.`
          : `Andelen är ${current} %, men minst ${minProgress} % krävs.`,
        ok,
      };
    }
    const ok = row.mandatoryPct >= 100;
    return {
      id: rule.id,
      headline,
      explanation:
        `Kliniken har markerat vissa tjänstgöringar som obligatoriska med minst angiven tid. Om tjänstgöringar är markerade som alternativ räknas de som en gemensam kravgrupp där en av dem räcker. När det är högst ${threshold} månader kvar jämförs planerad tid mot vad som krävs totalt. Om tiden inte räcker till innan ST slutar kan det ge varning.`,
      outcome: ok
        ? `Den planerade tiden i obligatoriska tjänstgöringar motsvar minst vad som krävs (visas som ${row.mandatoryPct} % av kravet).`
        : `Den planerade tiden räcker inte hela vägen ut (${row.mandatoryPct} % av vad som krävs enligt mallarna).`,
      ok,
    };
  });

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <div className="text-base font-bold text-slate-900">{row.student.name}</div>
            <div className="text-xs text-slate-500">Progressionsdetaljer</div>
          </div>
          <button
            type="button"
            onClick={() => setProgressionDetailStudentId(null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
          >
            Stäng
          </button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto p-5">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">Startdatum</div>
              <div className="font-semibold text-slate-900">{startISO ? formatDate(startISO) : "Saknas"}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">Slutdatum</div>
              <div className="font-semibold text-slate-900">{endISO ? formatDate(endISO) : "Saknas"}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">Månader kvar</div>
              <div className="font-semibold text-slate-900">
                {monthsLeft == null ? "Okänt" : monthsLeft >= 0 ? `${monthsLeft} mån` : `${Math.abs(monthsLeft)} mån över`}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-xs text-slate-500">Delmål kliniska tjänstgöringar</div>
              <div className="text-sm font-semibold text-slate-900">{row.klinProgressPct}%</div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-xs text-slate-500">Delmål kurser</div>
              <div className="text-sm font-semibold text-slate-900">{row.kursProgressPct}%</div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-xs text-slate-500">Delmål arbeten</div>
              <div className="text-sm font-semibold text-slate-900">{row.arbeteProgressPct}%</div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-xs text-slate-500">% uppfyllda obligatoriska placeringar</div>
              <div className="text-sm font-semibold text-slate-900">{row.mandatoryPct}%</div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-xs text-slate-500">% uppfyllda obligatoriska kurser</div>
              <div className="text-sm font-semibold text-slate-900">
                {row.mandatoryCoursePct == null ? "Ej definierat" : `${row.mandatoryCoursePct}% (${row.mandatoryCourseDone}/${row.mandatoryCourseTotal})`}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-1 text-sm font-semibold text-slate-900">Studierektorns regler</div>
            <p className="mb-3 text-xs text-slate-600">
              Här förklaras i korta ord vad varje regel betyder och hur denna ST-läkare förhåller sig till den just nu.
            </p>
            <div className="space-y-3">
              {rulesEvaluation.map((rr) => (
                <div key={rr.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-900">{rr.headline}</div>
                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                        rr.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      {rr.ok ? "Uppfyller" : "Avviker"}
                    </span>
                  </div>
                  <p className="mb-1.5 text-xs leading-relaxed text-slate-600">{rr.explanation}</p>
                  <p className="text-xs font-medium text-slate-800">{rr.outcome}</p>
                </div>
              ))}
            </div>
            {row.progressMeta.riskReasons.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <div className="mb-1 font-semibold">Aktuella signaler</div>
                <ul className="list-disc pl-4">
                  {row.progressMeta.riskReasons.map((reason: string, idx: number) => (
                    <li key={`${row.student.id}-risk-${idx}`}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

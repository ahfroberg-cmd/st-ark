"use client";

import { warningRuleHeadline } from "@/lib/studierektor/warningRules";
import type { WarningRule } from "@/lib/studierektor/warningRuleTypes";

export type WholeGroupProgressionStats = {
  n: number;
  timeProgress: { mean: number | null; median: number | null };
  milestoneProgress: { mean: number | null; median: number | null };
  totalCombined: { mean: number | null; median: number | null };
  meetPerYear: { mean: number | null; median: number | null };
  assessPerYear: { mean: number | null; median: number | null };
  meetLastYear: { mean: number | null; median: number | null };
  assessLastYear: { mean: number | null; median: number | null };
  statusCount: { ok: number; risk: number; late: number };
  ruleStats: Array<{ rule: WarningRule; applicable: number; pass: number }>;
};

export default function WholeGroupProgressionModal({
  open,
  onClose,
  clinicName,
  stats,
  clinicRegionContext,
}: {
  open: boolean;
  onClose: () => void;
  clinicName: string;
  stats: WholeGroupProgressionStats;
  clinicRegionContext: { regionLabel: string; peerClinicCount: number | null } | null;
}) {
  if (!open) return null;

  const fmt1 = (v: number | null) => (v == null ? "—" : v.toFixed(1));
  const regionPeer = clinicRegionContext?.peerClinicCount;
  const regionLabel = clinicRegionContext?.regionLabel ?? "—";

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whole-group-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="whole-group-title" className="text-lg font-bold text-slate-900">
              Hela gruppen
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {clinicName ? <span className="font-medium text-slate-800">{clinicName}</span> : "Klinik"} · {stats.n}{" "}
              ST-läkare
              {clinicRegionContext ? (
                <>
                  {" "}
                  · {regionLabel}
                  {typeof regionPeer === "number" ? ` · ${regionPeer} kliniker (region)` : ""}
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Stäng
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Total progression</h3>
            <p className="mb-3 text-[11px] text-slate-500">Tidsläge + ST-delmål; sammanvägd = medel av båda per person.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-white bg-white/90 px-3 py-2 shadow-sm">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Läge i tid</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                  {fmt1(stats.timeProgress.mean)}%
                  <span className="text-sm font-normal text-slate-500"> snitt</span>
                </div>
                <div className="text-xs text-slate-600">Median {fmt1(stats.timeProgress.median)}%</div>
              </div>
              <div className="rounded-md border border-white bg-white/90 px-3 py-2 shadow-sm">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">ST-delmål</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                  {fmt1(stats.milestoneProgress.mean)}%
                  <span className="text-sm font-normal text-slate-500"> snitt</span>
                </div>
                <div className="text-xs text-slate-600">Median {fmt1(stats.milestoneProgress.median)}%</div>
              </div>
              <div className="rounded-md border border-sky-300 bg-white px-3 py-2 shadow-sm">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Sammanvägd</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-sky-900">
                  {fmt1(stats.totalCombined.mean)}%
                  <span className="text-sm font-normal text-slate-500"> snitt</span>
                </div>
                <div className="text-xs text-slate-600">Median {fmt1(stats.totalCombined.median)}%</div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Handledning och progressionsbedömningar</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[420px] text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-800">Mått</th>
                    <th className="px-3 py-2 font-semibold text-slate-800">Snitt</th>
                    <th className="px-3 py-2 font-semibold text-slate-800">Median</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">Region (snitt)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td className="px-3 py-2 text-slate-800">Handledningssamtal per år</td>
                    <td className="px-3 py-2 tabular-nums">{fmt1(stats.meetPerYear.mean)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmt1(stats.meetPerYear.median)}</td>
                    <td className="px-3 py-2 text-slate-400">—</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-800">Progressionsbedömningar per år</td>
                    <td className="px-3 py-2 tabular-nums">{fmt1(stats.assessPerYear.mean)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmt1(stats.assessPerYear.median)}</td>
                    <td className="px-3 py-2 text-slate-400">—</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-800">Handledningssamtal (senaste 12 mån, antal)</td>
                    <td className="px-3 py-2 tabular-nums">{fmt1(stats.meetLastYear.mean)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmt1(stats.meetLastYear.median)}</td>
                    <td className="px-3 py-2 text-slate-400">—</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-800">Progressionsbedömningar (senaste 12 mån, antal)</td>
                    <td className="px-3 py-2 tabular-nums">{fmt1(stats.assessLastYear.mean)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmt1(stats.assessLastYear.median)}</td>
                    <td className="px-3 py-2 text-slate-400">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Region (snitt) kommer senare.</p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Progressionsläge</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
                <div className="text-lg font-bold text-emerald-900">{stats.statusCount.ok}</div>
                <div className="text-[11px] font-medium text-emerald-800">I fas</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center">
                <div className="text-lg font-bold text-amber-900">{stats.statusCount.risk}</div>
                <div className="text-[11px] font-medium text-amber-800">Risk</div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center">
                <div className="text-lg font-bold text-red-900">{stats.statusCount.late}</div>
                <div className="text-[11px] font-medium text-red-800">Förlängning</div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Varningsregler</h3>
            <ul className="space-y-2">
              {stats.ruleStats.map(({ rule, applicable, pass }) => (
                <li key={rule.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{warningRuleHeadline(rule)}</span>
                    {!rule.enabled ? (
                      <span className="text-slate-500">Avstängd</span>
                    ) : applicable === 0 ? (
                      <span className="text-slate-600">Ingen i fönstret just nu</span>
                    ) : (
                      <span>
                        <span className="font-semibold text-emerald-800">{pass}</span>
                        <span className="text-slate-600"> / {applicable} uppfyller kraven</span>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

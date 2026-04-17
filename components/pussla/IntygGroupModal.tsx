"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  type ActivityLike,
  type IntygGroupConfig,
  commonPrefixTitle,
  computeIntygGroupOptions,
  groupedMembersForDraft,
  getIntygGroupNumber,
  mergeGroupMilestoneRows,
  mergeGroupNotes,
  parseIntygGroupConfig,
  pickGroupConfig,
  resolveSupervisorTrioForGroup,
} from "@/lib/pussla/intygGroupHelpers";

type Props = {
  open: boolean;
  onClose: () => void;
  baseActivity: ActivityLike;
  activities: ActivityLike[];
  sortMilestoneIds: (ids: string[]) => string[];
  displayMilestoneCode: (code: string, goalsVersion: unknown) => string;
  goalsVersion: unknown;
  onSave: (draftGroup: number | null, config: IntygGroupConfig | null) => Promise<void>;
  onOpenIntygPreview: (payload: {
    grouped: ActivityLike[];
    config: IntygGroupConfig | null;
    groupNum: number | null;
  }) => void;
};

function cleanConfigForSave(
  title: string,
  sup: string,
  spec: string,
  site: string,
  mergedDesc: string
): IntygGroupConfig {
  const o: IntygGroupConfig = { mergedDescription: mergedDesc };
  const t = title.trim();
  const s = sup.trim();
  const p = spec.trim();
  const i = site.trim();
  if (t) o.title = t;
  if (s) o.certSupervisor = s;
  if (p) o.certSpecialty = p;
  if (i) o.certSite = i;
  return o;
}

function uniqueNonEmpty(xs: string[]): string[] {
  return [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
}

export default function IntygGroupModal({
  open,
  onClose,
  baseActivity,
  activities,
  sortMilestoneIds,
  displayMilestoneCode,
  goalsVersion,
  onSave,
  onOpenIntygPreview,
}: Props) {
  const [draftGroup, setDraftGroup] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [sup, setSup] = useState("");
  const [spec, setSpec] = useState("");
  const [site, setSite] = useState("");
  const [mergedDesc, setMergedDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const groupOptions = useMemo(() => computeIntygGroupOptions(activities), [activities]);

  const members = useMemo(
    () => groupedMembersForDraft(baseActivity, activities, draftGroup),
    [baseActivity, activities, draftGroup]
  );

  const syncFormFromGroup = (g: number | null) => {
    const m = groupedMembersForDraft(baseActivity, activities, g);
    const cfg = pickGroupConfig(m) || parseIntygGroupConfig((baseActivity as any).intygGroupConfig);
    const trio = resolveSupervisorTrioForGroup(m, cfg);
    const defaultTitle =
      (cfg?.title && String(cfg.title).trim()) ||
      commonPrefixTitle(m.map((a) => String(a.label || a.type || "").trim()).filter(Boolean)) ||
      String(baseActivity.label || baseActivity.type || "").trim();
    setTitle(defaultTitle);
    setSup(trio.supervisor);
    setSpec(trio.spec);
    setSite(trio.site);
    const autoMerged = mergeGroupNotes(m);
    if (cfg && "mergedDescription" in cfg) {
      setMergedDesc(String(cfg.mergedDescription ?? ""));
    } else {
      setMergedDesc(autoMerged);
    }
  };

  useEffect(() => {
    if (!open) return;
    const g = getIntygGroupNumber(baseActivity);
    setDraftGroup(g);
    syncFormFromGroup(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- endast vid öppning
  }, [open, baseActivity.id]);

  const supOptions = useMemo(
    () => uniqueNonEmpty(members.map((a) => String(a.supervisor || ""))),
    [members]
  );
  const rowsForSup = useMemo(
    () => members.filter((a) => String(a.supervisor || "").trim() === sup.trim()),
    [members, sup]
  );
  const specOptions = useMemo(
    () => uniqueNonEmpty(rowsForSup.map((a) => String(a.supervisorSpeciality || ""))),
    [rowsForSup]
  );
  const siteOptions = useMemo(
    () => uniqueNonEmpty(rowsForSup.map((a) => String(a.supervisorSite || ""))),
    [rowsForSup]
  );

  const mergedMilestones = useMemo(() => mergeGroupMilestoneRows(members), [members]);
  const sortedMilestones = useMemo(
    () => sortMilestoneIds(mergedMilestones.map((m) => String(m).trim()).filter(Boolean)),
    [mergedMilestones, sortMilestoneIds]
  );

  const showSupSelect = supOptions.length > 1;
  const showSpecSelect = specOptions.length > 1;
  const showSiteSelect = siteOptions.length > 1;

  const applySupervisorPick = (name: string) => {
    setSup(name);
    const row = members.find((a) => String(a.supervisor || "").trim() === name.trim());
    if (row) {
      setSpec(String(row.supervisorSpeciality || ""));
      setSite(String(row.supervisorSite || ""));
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intyg-group-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="intyg-group-title" className="text-lg font-bold text-slate-900">
            Intygsgrupp
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Placering:{" "}
            <span className="font-medium text-slate-800">
              {baseActivity.label || baseActivity.type || "—"}
            </span>
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Intygsgrupp
            </label>
            <select
              value={draftGroup != null ? String(draftGroup) : ""}
              onChange={(e) => {
                const v = e.target.value;
                const next = v ? Number(v) : null;
                setDraftGroup(next);
                if (next != null) syncFormFromGroup(next);
                else {
                  setTitle(String(baseActivity.label || baseActivity.type || "").trim());
                  setSup(String(baseActivity.supervisor || ""));
                  setSpec(String(baseActivity.supervisorSpeciality || ""));
                  setSite(String(baseActivity.supervisorSite || ""));
                  setMergedDesc(String(baseActivity.note || ""));
                }
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Ingen</option>
              {groupOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {draftGroup != null && members.length > 1 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left text-sm text-slate-700 sm:px-3">
              <div className="font-semibold text-slate-800">Placeringar i grupp {draftGroup}</div>
              <ul className="mt-2 list-none space-y-2 pl-0">
                {members.map((a) => (
                  <li key={a.id} className="min-w-0 text-left">
                    <div className="font-medium text-slate-800">{a.label || a.type || "—"}</div>
                    <div className="mt-0.5 overflow-x-auto text-left text-xs tabular-nums text-slate-600 [-webkit-overflow-scrolling:touch]">
                      {a.exactStartISO || "?"} – {a.exactEndISO || "?"}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draftGroup != null && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Titel (intyg)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  placeholder="Föreslås: ord som alla titlar delar i följd från början (ändra fritt)"
                />
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Handledare</div>
                {showSupSelect ? (
                  <select
                    value={sup}
                    onChange={(e) => applySupervisorPick(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {supOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-slate-800">{sup || "—"}</div>
                )}

                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Handledares specialitet
                </div>
                {showSpecSelect ? (
                  <select
                    value={spec}
                    onChange={(e) => setSpec(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {specOptions.map((n) => (
                      <option key={n} value={n}>
                        {n || "—"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-slate-800">{spec || "—"}</div>
                )}

                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Handledares tjänsteställe
                </div>
                {showSiteSelect ? (
                  <select
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {siteOptions.map((n) => (
                      <option key={n} value={n}>
                        {n || "—"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-slate-800">{site || "—"}</div>
                )}
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Delmål</div>
                <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
                  {sortedMilestones.length > 0 ? (
                    sortedMilestones.map((m) => (
                      <span
                        key={m}
                        className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-800"
                      >
                        {displayMilestoneCode(String(m).trim().split(/\s|–|-|:|\u2013/)[0], goalsVersion)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Beskrivning
                </div>
                <textarea
                  value={mergedDesc}
                  onChange={(e) => setMergedDesc(e.target.value)}
                  rows={6}
                  className="min-h-[120px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="Redigera text som ska med på intyget"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {draftGroup != null && (
              <button
                type="button"
                onClick={() =>
                  onOpenIntygPreview({
                    grouped: members,
                    config: cleanConfigForSave(title, sup, spec, site, mergedDesc),
                    groupNum: draftGroup,
                  })
                }
                className="rounded-lg border border-slate-400 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
              >
                Intyg
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  if (draftGroup == null) {
                    await onSave(null, null);
                  } else {
                    await onSave(draftGroup, cleanConfigForSave(title, sup, spec, site, mergedDesc));
                  }
                  onClose();
                } finally {
                  setSaving(false);
                }
              }}
              className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? "Sparar…" : "Spara"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

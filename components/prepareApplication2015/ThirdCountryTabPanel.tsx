"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import CalendarDatePicker from "@/components/CalendarDatePicker";
import type { GoalsCatalog } from "@/lib/goals";
import { loadGoals } from "@/lib/goals";
import { displayMilestoneCode } from "@/lib/milestoneDisplay";
import { sortMilestoneIds as sortMilestoneIdsBySequence } from "@/lib/milestoneSequence";
import type { Profile } from "@/lib/types";

const DesktopMilestonePicker = dynamic(() => import("@/components/DesktopMilestonePicker"), { ssr: false });

type CertLike = {
  managerMode: "self" | "appointed";
  managerSelf: { name: string };
  managerAppointed: { managerName: string };
};

type WorkplaceRow = { id: string; site: string; startDate: string; endDate: string };

type Props = {
  profile: Profile | null;
  thirdCountryDelmalCodes: string;
  setThirdCountryDelmalCodes: (v: string) => void;
  thirdCountryActivities: string;
  setThirdCountryActivities: (v: string) => void;
  thirdCountryVerification: string;
  setThirdCountryVerification: (v: string) => void;
  cert: CertLike;
  setCert: React.Dispatch<React.SetStateAction<any>>;
  thirdCountryWorkplaces: WorkplaceRow[];
  setThirdCountryWorkplaces: (v: WorkplaceRow[]) => void;
  onPreview: (blob: Blob) => void;
};

const makeId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const isoToday = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export function ThirdCountryTabContent2015({
  profile,
  thirdCountryDelmalCodes,
  setThirdCountryDelmalCodes,
  thirdCountryActivities,
  setThirdCountryActivities,
  thirdCountryVerification,
  setThirdCountryVerification,
  cert,
  setCert,
  thirdCountryWorkplaces,
  setThirdCountryWorkplaces,
  onPreview,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [milestonePickerOpen, setMilestonePickerOpen] = useState(false);
  const [goals, setGoals] = useState<GoalsCatalog | null>(null);

  const isValidISO = useCallback((iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")), []);

  const addDaysISO = useCallback(
    (iso: string, days: number) => {
      if (!isValidISO(iso)) return "";
      const d = new Date(iso + "T00:00:00");
      if (Number.isNaN(d.getTime())) return "";
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    },
    [isValidISO]
  );

  useEffect(() => {
    loadGoals("2015")
      .then(setGoals)
      .catch((err) => {
        console.error("Failed to load goals", err);
      });
  }, []);

  const milestoneCheckedSet = useMemo(() => {
    if (!thirdCountryDelmalCodes) return new Set<string>();
    return new Set(
      thirdCountryDelmalCodes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }, [thirdCountryDelmalCodes]);

  const handleToggleMilestone = useCallback(
    (milestoneId: string) => {
      const currentSet = new Set(milestoneCheckedSet);
      if (currentSet.has(milestoneId)) {
        currentSet.delete(milestoneId);
      } else {
        currentSet.add(milestoneId);
      }
      const codes = sortMilestoneIdsBySequence(Array.from(currentSet)).join(", ");
      setThirdCountryDelmalCodes(codes);
    },
    [milestoneCheckedSet, setThirdCountryDelmalCodes]
  );

  const handleGenerate = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const { exportThirdCountryCertificate2015 } = await import("@/lib/exporters");

      const vcName = String((profile as any)?.verksamhetschef || "");
      const certForExport = {
        ...cert,
        managerSelf: {
          ...cert.managerSelf,
          name: vcName,
        },
        managerAppointed: {
          ...cert.managerAppointed,
          managerName: vcName,
        },
      };

      const blob = await exportThirdCountryCertificate2015(
        {
          profile: profile as any,
          delmalCodes: thirdCountryDelmalCodes,
          activitiesText: thirdCountryActivities,
          verificationText: thirdCountryVerification,
          workplaces: thirdCountryWorkplaces,
          cert: certForExport,
        },
        { output: "blob", filename: "intyg-bilaga8a-2015.pdf" }
      );

      if (blob instanceof Blob) {
        onPreview(blob);
      }
    } catch (err) {
      console.error("exportThirdCountryCertificate2015 error", err);
      alert("Det gick inte att skapa intyget. Kontrollera uppgifterna och försök igen.");
    } finally {
      setDownloading(false);
    }
  };

  const handleGenerate8b = async () => {
    if (!profile) return;
    setDownloading(true);
    try {
      const { exportThirdCountryCertificate2015_8b } = await import("@/lib/exporters");

      const vcName = String((profile as any)?.verksamhetschef || "");
      const certForExport = {
        ...cert,
        managerSelf: {
          ...cert.managerSelf,
          name: vcName,
        },
        managerAppointed: {
          ...cert.managerAppointed,
          managerName: vcName,
        },
      };

      const blob = await exportThirdCountryCertificate2015_8b(
        {
          profile: profile as any,
          cert: certForExport,
          workplaces: thirdCountryWorkplaces,
          delmalCodes: thirdCountryDelmalCodes,
          activitiesText: thirdCountryActivities,
          verificationText: thirdCountryVerification,
        },
        { output: "blob", filename: "intyg-bilaga8b-2015.pdf" }
      );

      if (blob instanceof Blob) {
        onPreview(blob);
      }
    } catch (err) {
      console.error("exportThirdCountryCertificate2015_8b error", err);
      alert("Det gick inte att skapa intyget. Kontrollera uppgifterna och försök igen.");
    } finally {
      setDownloading(false);
    }
  };

  const isAppointed = cert.managerMode === "appointed";

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-4 text-base font-extrabold text-slate-900">Uppfyllda kompetenskrav</h3>

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMilestonePickerOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
              data-info="Välj delmål"
            >
              Välj delmål
            </button>
            <div className="flex flex-1 flex-wrap items-center gap-1">
              {thirdCountryDelmalCodes ? (
                sortMilestoneIdsBySequence(
                  thirdCountryDelmalCodes
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                ).map((m: string) => (
                  <span
                    key={m}
                    className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-900"
                  >
                    {displayMilestoneCode(String(m).trim(), "2015")}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">Inga delmål valda</span>
              )}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-slate-900">Tjänstgöringsställe/-n i Sverige</label>
          <div className="space-y-3">
            {thirdCountryWorkplaces.slice(0, 6).map((row, idx) => (
              <div key={row.id} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_220px]">
                <div>
                  {idx === 0 && <label className="mb-1 block text-sm text-slate-700">Tjänstgöringsställe</label>}
                  <input
                    type="text"
                    value={row.site}
                    onChange={(e) => {
                      const next = [...thirdCountryWorkplaces];
                      next[idx] = { ...row, site: e.target.value };
                      setThirdCountryWorkplaces(next);
                    }}
                    className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
                  />
                </div>
                <div className="self-end w-[220px]">
                  {idx === 0 && <label className="mb-1 block text-sm text-slate-700">Start</label>}
                  <CalendarDatePicker
                    value={row.startDate}
                    minDate={idx > 0 ? addDaysISO(thirdCountryWorkplaces[idx - 1]?.endDate || "", 1) : undefined}
                    onChange={(v: string) => {
                      const next = [...thirdCountryWorkplaces];
                      const minStart = idx > 0 ? addDaysISO(thirdCountryWorkplaces[idx - 1]?.endDate || "", 1) : "";
                      const newStartDate = minStart && v && v < minStart ? minStart : v;
                      let newEndDate = row.endDate;

                      if (newStartDate) {
                        if (!newEndDate || newStartDate > newEndDate) {
                          newEndDate = newStartDate;
                        }
                      }

                      if (idx + 1 < next.length && newEndDate) {
                        const n = next[idx + 1];
                        if (n?.startDate && n.startDate <= newEndDate) {
                          const shiftedStart = addDaysISO(newEndDate, 1);
                          const shiftedEnd = n.endDate && n.endDate < shiftedStart ? shiftedStart : n.endDate;
                          next[idx + 1] = { ...n, startDate: shiftedStart, endDate: shiftedEnd };
                        }
                      }

                      next[idx] = { ...row, startDate: newStartDate, endDate: newEndDate };
                      setThirdCountryWorkplaces(next);
                    }}
                    className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                  />
                </div>
                <div className="grid w-[220px] grid-cols-[1fr_40px] items-end gap-2 self-end">
                  <div>
                    {idx === 0 && <label className="mb-1 block text-sm text-slate-700">Slut</label>}
                    <CalendarDatePicker
                      value={row.endDate}
                      minDate={row.startDate || undefined}
                      align="right"
                      onChange={(v: string) => {
                        const next = [...thirdCountryWorkplaces];
                        const newEndDate = v;
                        if (row.startDate && newEndDate && newEndDate < row.startDate) return;

                        if (idx + 1 < next.length && newEndDate) {
                          const n = next[idx + 1];
                          if (n?.startDate && n.startDate <= newEndDate) {
                            const shiftedStart = addDaysISO(newEndDate, 1);
                            const shiftedEnd = n.endDate && n.endDate < shiftedStart ? shiftedStart : n.endDate;
                            next[idx + 1] = { ...n, startDate: shiftedStart, endDate: shiftedEnd };
                          }
                        }

                        next[idx] = { ...row, endDate: newEndDate };
                        setThirdCountryWorkplaces(next);
                      }}
                      className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                    />
                  </div>
                  {idx > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = thirdCountryWorkplaces.filter((_, i) => i !== idx);
                        setThirdCountryWorkplaces(next);
                      }}
                      className="h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"
                      title="Ta bort"
                    >
                      –
                    </button>
                  ) : (
                    <div className="w-[40px]" />
                  )}
                </div>
              </div>
            ))}
          </div>
          {thirdCountryWorkplaces.length < 6 && (
            <button
              type="button"
              onClick={() => {
                const last = thirdCountryWorkplaces[thirdCountryWorkplaces.length - 1];
                const prevEnd = last?.endDate && isValidISO(last.endDate) ? last.endDate : "";
                const start = prevEnd ? addDaysISO(prevEnd, 1) || isoToday() : isoToday();
                setThirdCountryWorkplaces([...thirdCountryWorkplaces, { id: makeId(), site: "", startDate: start, endDate: start }]);
              }}
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              data-info="Lägg till tjänstgöringsställe"
            >
              + Lägg till tjänstgöringsställe
            </button>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-semibold text-slate-900">
            Detaljerad beskrivning av på vilka sätt det kontrollerats att samtliga kompetenskrav i delmålet/-en är
            uppfyllda (specificering, t.ex. metoder för bedömning). Om intyget avser flera delmål, beskriv dem var för
            sig.
          </label>
          <textarea
            value={thirdCountryVerification}
            onChange={(e) => setThirdCountryVerification(e.target.value)}
            className="min-h-[200px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm placeholder-gray-400"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={downloading}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px disabled:pointer-events-none disabled:opacity-60"
            data-info="Intyg uppfyllda kompetenskrav"
          >
            {downloading ? "Skapar förhandsgranskning…" : "Intyg uppfyllda kompetenskrav"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900">Uppnådd specialistkompetens</h3>
          <button
            type="button"
            onClick={handleGenerate8b}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            data-info="Intyg Uppnådd specialistkompetens"
          >
            Intyg Uppnådd specialistkompetens
          </button>
        </div>
      </div>

      {milestonePickerOpen && goals && (
        <DesktopMilestonePicker
          open={milestonePickerOpen}
          title="Välj delmål"
          goals={goals}
          checked={milestoneCheckedSet}
          onToggle={handleToggleMilestone}
          onClose={() => setMilestonePickerOpen(false)}
        />
      )}
    </div>
  );
}

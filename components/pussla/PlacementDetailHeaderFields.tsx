"use client";

import React from "react";
import CalendarDatePicker from "@/components/CalendarDatePicker";

type Props = {
  selAct: any;
  selectedPlacement: any;
  profile: any;
  activities: any[];
  startYear: number;
  actStartISO: string;
  actEndISO: string;
  isLeave: (type: any) => boolean;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  dateToISO: (d: Date) => string;
  addMonths: (d: Date, months: number) => Date;
  getEffectiveBtWindow: (profile: any, helpers: any) => any;
  isPlacementInBtWindow: (selAct: any, btWindow: any, startYear: number, dateToSlot: any) => boolean;
  dateToSlot: any;
  setActivities: React.Dispatch<React.SetStateAction<any[]>>;
  srPlacementTemplates: any[];
  placementGroupsOrder: string[];
  getCourseTemplateGroup: (rows: string[]) => string;
  sanitizeStMilestonesForGoals: (ids: string[], goalsVersion: any) => string[];
  getTemplateSuggestedPeriodMonths: (rows: string[]) => number | null;
  slotToYearMonthHalf: (startYear: number, slot: number) => { year: number; month0: number; half: 0 | 1 };
  mondayNearestTo: (year: number, month0: number, day: number) => Date;
  nearestSundayISO: (iso: string) => string;
  shiftIsoDays: (iso: string, delta: number) => string;
  roundToAnchors: (iso: string, mode: "start" | "end") => string;
  setPlacementPeriodSuggestionDialog: (next: any) => void;
  applyPlacementDates: (which: "start" | "end", iso: string) => void;
};

export default function PlacementDetailHeaderFields({
  selAct,
  selectedPlacement,
  profile,
  activities,
  startYear,
  actStartISO,
  actEndISO,
  isLeave,
  isValidISO,
  isoToDateSafe,
  dateToISO,
  addMonths,
  getEffectiveBtWindow,
  isPlacementInBtWindow,
  dateToSlot,
  setActivities,
  srPlacementTemplates,
  placementGroupsOrder,
  getCourseTemplateGroup,
  sanitizeStMilestonesForGoals,
  getTemplateSuggestedPeriodMonths,
  slotToYearMonthHalf,
  mondayNearestTo,
  nearestSundayISO,
  shiftIsoDays,
  roundToAnchors,
  setPlacementPeriodSuggestionDialog,
  applyPlacementDates,
}: Props) {
  return (
    <>
      <div>
        <label className="block text-sm text-slate-700">Typ</label>
        <select
          value={selAct.type}
          onChange={(e) => {
            const t = e.target.value;
            setActivities((prev) =>
              prev.map((a) =>
                a.id === selAct.id
                  ? {
                      ...a,
                      type: t,
                      attendance: a.attendance ?? 100,
                    }
                  : a
              )
            );
          }}
          className="w-full h-10 rounded-lg border px-3 placeholder:text-slate-400"
        >
          {[
            "Klinisk tjänstgöring",
            "Vetenskapligt arbete",
            "Förbättringsarbete",
            "Auskultation",
            "Forskning",
            "Tjänstledighet",
            "Föräldraledighet",
            "Annan ledighet",
            "Sjukskriven",
          ].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {(!isLeave(selAct.type) || selAct.type === "Annan ledighet") && (
        <>
          {(() => {
            const prof: any = profile || {};
            const btWindow = getEffectiveBtWindow(prof, {
              isValidISO,
              isoToDateSafe,
              dateToISO,
              addMonths,
            });
            if (!btWindow) return null;

            const sel = selectedPlacement;
            if (!sel) return null;
            if (sel.type === "Forskning" || sel.type === "Annan ledighet") return null;
            const inBtWindow = isPlacementInBtWindow(selAct, btWindow, startYear, dateToSlot);
            if (!inBtWindow) return null;

            return (
              <div>
                <label className="block text-sm text-slate-700">Fas</label>
                <select
                  value={(selAct as any)?.phase || "BT"}
                  onChange={(e) => {
                    const v = e.target.value as "BT" | "ST";
                    setActivities((prev) => prev.map((a) => (a.id === selAct.id ? { ...a, phase: v } : a)));
                  }}
                  className="w-full h-10 rounded-lg border px-3 placeholder:text-slate-400"
                >
                  <option value="BT">BT</option>
                  <option value="ST">ST</option>
                </select>
              </div>
            );
          })()}

          {selAct.type !== "Forskning" &&
            (() => {
              const isPlacementType = selAct.type === "Klinisk tjänstgöring" || selAct.type === "Auskultation";
              const hasSrTemplates = isPlacementType && srPlacementTemplates.length > 0;
              const currentLabel = selAct.label || "";
              const isTemplateMatch = hasSrTemplates && srPlacementTemplates.some((t) => t.title === currentLabel);
              const isAnnanMarker = currentLabel === "__annan__";
              const selectValue = hasSrTemplates
                ? isTemplateMatch
                  ? currentLabel
                  : isAnnanMarker || currentLabel
                    ? "__annan__"
                    : ""
                : "";
              const isAnnanSelected = hasSrTemplates && selectValue === "__annan__";
              const groupedPlacementOptions = (() => {
                const opts = srPlacementTemplates.filter((t) => String(t.title || "").trim().length > 0);
                const groupIndex = new Map<string, number>();
                placementGroupsOrder.forEach((g, i) => groupIndex.set(g, i));
                const enriched = opts.map((t) => ({
                  ...t,
                  group: getCourseTemplateGroup(t.suggested_rows || []),
                }));
                enriched.sort((a, b) => {
                  const ai = a.group ? (groupIndex.has(a.group) ? Number(groupIndex.get(a.group)) : 9999) : 10000;
                  const bi = b.group ? (groupIndex.has(b.group) ? Number(groupIndex.get(b.group)) : 9999) : 10000;
                  if (ai !== bi) return ai - bi;
                  if (a.group !== b.group) return String(a.group || "").localeCompare(String(b.group || ""), "sv");
                  return String(a.title || "").localeCompare(String(b.title || ""), "sv");
                });
                return enriched;
              })();
              return (
                <>
                  <div className="md:col-span-1">
                    <label className="block text-sm text-slate-700">
                      {isPlacementType ? "Placering" : selAct.type === "Annan ledighet" ? "Beskrivning" : "Titel"}
                    </label>
                    {hasSrTemplates ? (
                      <select
                        value={selectValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "__annan__") {
                            setActivities((prev) => prev.map((a) => (a.id === selAct.id ? { ...a, label: "__annan__" } : a)));
                          } else if (v === "") {
                            setActivities((prev) => prev.map((a) => (a.id === selAct.id ? { ...a, label: "" } : a)));
                          } else {
                            const tmpl = srPlacementTemplates.find((t) => t.title === v);
                            setActivities((prev) => prev.map((a) => (a.id === selAct.id ? { ...a, label: v } : a)));
                            if (tmpl && tmpl.suggested_milestones.length > 0) {
                              const current: string[] = Array.isArray((selAct as any).milestones) ? (selAct as any).milestones : [];
                              const merged = sanitizeStMilestonesForGoals(
                                [...current, ...tmpl.suggested_milestones],
                                (profile as any)?.goalsVersion
                              );
                              setActivities((prev) => prev.map((a) => (a.id === selAct.id ? { ...a, milestones: merged } : a)));
                            }
                            if (tmpl && selAct.type === "Klinisk tjänstgöring") {
                              const suggestedMonths = getTemplateSuggestedPeriodMonths(tmpl.suggested_rows || []);
                              if (suggestedMonths && suggestedMonths > 0) {
                                const startISO = (() => {
                                  const exact = String((selAct as any)?.exactStartISO || "");
                                  if (isValidISO(exact)) return exact;
                                  const sh = slotToYearMonthHalf(startYear, selAct.startSlot);
                                  return dateToISO(mondayNearestTo(sh.year, sh.month0, sh.half === 0 ? 1 : 15));
                                })();
                                if (isValidISO(startISO)) {
                                  const normalizedMonths = Math.max(1, Math.round(suggestedMonths));
                                  const exactMonthsDate = dateToISO(addMonths(isoToDateSafe(startISO), normalizedMonths));
                                  let proposedEndISO = nearestSundayISO(exactMonthsDate);
                                  let cappedByNextStartISO: string | undefined;

                                  const nextStartISO = activities
                                    .filter((a) => a.id !== selAct.id)
                                    .map((a) => {
                                      const exact = String((a as any)?.exactStartISO || "");
                                      if (isValidISO(exact)) return exact;
                                      if (typeof a?.startSlot === "number") {
                                        const sh = slotToYearMonthHalf(startYear, a.startSlot);
                                        return dateToISO(mondayNearestTo(sh.year, sh.month0, sh.half === 0 ? 1 : 15));
                                      }
                                      return "";
                                    })
                                    .filter((iso) => isValidISO(iso) && iso > startISO)
                                    .sort()[0];

                                  if (nextStartISO && proposedEndISO >= nextStartISO) {
                                    cappedByNextStartISO = nextStartISO;
                                    const capped = roundToAnchors(shiftIsoDays(nextStartISO, -1), "end");
                                    proposedEndISO = capped < startISO ? startISO : capped;
                                  }

                                  setPlacementPeriodSuggestionDialog({
                                    activityId: selAct.id,
                                    templateTitle: tmpl.title,
                                    suggestedMonths: normalizedMonths,
                                    startISO,
                                    proposedEndISO,
                                    cappedByNextStartISO,
                                  });
                                }
                              }
                            }
                          }
                        }}
                        className="w-full h-10 rounded-lg border px-3 bg-white text-sm"
                      >
                        <option value="">Välj placering...</option>
                        {(() => {
                          let prevGroup = "__start__";
                          const out: React.ReactNode[] = [];
                          for (const t of groupedPlacementOptions) {
                            const g = String((t as any).group || "").trim();
                            if (g !== prevGroup && g) {
                              out.push(
                                <option key={`group-${g}`} disabled value={`__group__${g}`}>
                                  {g}
                                </option>
                              );
                            }
                            out.push(
                              <option key={t.id} value={t.title}>
                                {t.title}
                              </option>
                            );
                            prevGroup = g;
                          }
                          return out;
                        })()}
                        <option value="__annan__">Annan...</option>
                      </select>
                    ) : (
                      <input
                        value={selAct.type === "Annan ledighet" ? selAct.leaveSubtype || "" : selAct.label || ""}
                        onChange={(e) => {
                          if (selAct.type === "Annan ledighet") {
                            setActivities((prev) =>
                              prev.map((a) => (a.id === selAct.id ? { ...a, leaveSubtype: e.target.value } : a))
                            );
                          } else {
                            setActivities((prev) => prev.map((a) => (a.id === selAct.id ? { ...a, label: e.target.value } : a)));
                          }
                        }}
                        className="w-full h-10 rounded-lg border px-3 placeholder:text-slate-400"
                      />
                    )}
                  </div>
                  {isAnnanSelected && (
                    <div className="md:col-span-1">
                      <label className="block text-sm text-slate-700">Placeringsnamn</label>
                      <input
                        value={currentLabel === "__annan__" ? "" : currentLabel}
                        onChange={(e) =>
                          setActivities((prev) => prev.map((a) => (a.id === selAct.id ? { ...a, label: e.target.value } : a)))
                        }
                        placeholder="Ange placeringsnamn..."
                        className="w-full h-10 rounded-lg border px-3 placeholder:text-slate-400 text-sm"
                      />
                    </div>
                  )}
                </>
              );
            })()}
        </>
      )}

      <div>
        <label className="block text-sm text-slate-700">Start</label>
        <CalendarDatePicker value={actStartISO} onChange={(iso) => applyPlacementDates("start", iso)} weekStartsOn={1} />
      </div>

      <div>
        <label className="block text-sm text-slate-700">Slut</label>
        <CalendarDatePicker value={actEndISO} onChange={(iso) => applyPlacementDates("end", iso)} weekStartsOn={1} />
      </div>

      {!(selAct.type === "Forskning" || isLeave(selAct.type)) && (
        <div>
          <label className="block text-sm text-slate-700">Syss.%</label>
          <select
            value={selAct.attendance ?? 100}
            onChange={(e) => {
              const v = Number(e.target.value);
              setActivities((prev) => prev.map((a) => (a.id === selAct.id ? { ...a, attendance: v } : a)));
            }}
            className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
          >
            {Array.from({ length: 21 }, (_, i) => i * 5).map((val) => (
              <option key={val} value={val}>
                {val}%
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

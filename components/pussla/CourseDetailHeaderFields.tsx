"use client";

import React from "react";
import CalendarDatePicker from "@/components/CalendarDatePicker";

type Props = {
  selCourse: any;
  profile: any;
  setCourses: React.Dispatch<React.SetStateAction<any[]>>;
  setDirty: (next: boolean) => void;
  updateSelectedCourse: (patch: any) => void;
  usesMetisCourses: (specialty: string) => boolean;
  srUtbildningsmomentTemplates: any[];
  sanitizeStMilestonesForGoals: (ids: string[], goalsVersion: any) => string[];
  srCourseTemplates: any[];
  courseGroupsOrder: string[];
  getCourseTemplateGroup: (rows: string[]) => string;
  mapMetisGoalsToMilestoneIds: (title: string, profile: any) => string[];
  getMetisCoursesForSpecialty: (specialty: string) => string[];
  getEffectiveBtWindow: (profile: any, helpers: any) => any;
  isIsoInBtWindow: (iso: string, btWindow: any, isValidISO: (iso: string) => boolean) => boolean;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  dateToISO: (d: Date) => string;
  addMonths: (d: Date, months: number) => Date;
};

export default function CourseDetailHeaderFields({
  selCourse,
  profile,
  setCourses,
  setDirty,
  updateSelectedCourse,
  usesMetisCourses,
  srUtbildningsmomentTemplates,
  sanitizeStMilestonesForGoals,
  srCourseTemplates,
  courseGroupsOrder,
  getCourseTemplateGroup,
  mapMetisGoalsToMilestoneIds,
  getMetisCoursesForSpecialty,
  getEffectiveBtWindow,
  isIsoInBtWindow,
  isValidISO,
  isoToDateSafe,
  dateToISO,
  addMonths,
}: Props) {
  return (
    <div
      className={[
        "grid gap-3 grid-cols-1",
        (() => {
          const prof: any = profile || {};
          const specialty = prof?.specialty || prof?.speciality;
          const usesMetis = usesMetisCourses(specialty);
          const is2021 = String(prof?.goalsVersion || "").trim() === "2021";

          if (selCourse.kind === "Utbildningsmoment") {
            const isAnnan = selCourse.title === "Annan";
            return isAnnan ? "md:grid-cols-6" : "md:grid-cols-5";
          }

          if (!is2021) {
            const isAnnanKurs = selCourse.title === "Annan kurs";
            if (usesMetis) {
              return isAnnanKurs ? "md:grid-cols-6" : "md:grid-cols-5";
            } else {
              return "md:grid-cols-5";
            }
          }

          const btWindow = getEffectiveBtWindow(prof, {
            isValidISO,
            isoToDateSafe,
            dateToISO,
            addMonths,
          });
          if (!btWindow) {
            if (is2021) {
              return usesMetis ? "md:grid-cols-5" : "md:grid-cols-5";
            } else {
              return usesMetis ? "md:grid-cols-5" : "md:grid-cols-4";
            }
          }

          const startISO = selCourse.startDate || selCourse.endDate || "";
          if (!startISO) {
            if (is2021) {
              return usesMetis ? "md:grid-cols-5" : "md:grid-cols-5";
            } else {
              return usesMetis ? "md:grid-cols-5" : "md:grid-cols-4";
            }
          }

          const inBtWindow = isIsoInBtWindow(startISO, btWindow, isValidISO);

          if (usesMetis) {
            const isAnnanKurs = selCourse.title === "Annan kurs";
            if (isAnnanKurs) {
              return inBtWindow ? "md:grid-cols-7" : "md:grid-cols-6";
            }
            return inBtWindow ? "md:grid-cols-6" : "md:grid-cols-5";
          } else {
            if (is2021) {
              return inBtWindow ? "md:grid-cols-6" : "md:grid-cols-5";
            } else {
              return inBtWindow ? "md:grid-cols-5" : "md:grid-cols-4";
            }
          }
        })(),
      ].join(" ")}
    >
      {selCourse.kind === "Utbildningsmoment" && (
        <>
          <div>
            <label className="block text-sm text-slate-700">Utbildningsmoment</label>
            {srUtbildningsmomentTemplates.length > 0 ? (
              <select
                value={selCourse.title || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setCourses((prev) =>
                    prev.map((c) =>
                      c.id === selCourse.id ? { ...c, title: v, courseTitle: v === "Annan" ? c.courseTitle || "" : undefined } : c
                    )
                  );
                  if (v !== "Annan") {
                    const tmpl = srUtbildningsmomentTemplates.find((t) => t.title === v);
                    if (tmpl && tmpl.suggested_milestones.length > 0) {
                      const current: string[] = Array.isArray(selCourse.milestones) ? selCourse.milestones : [];
                      const merged = sanitizeStMilestonesForGoals(
                        [...current, ...tmpl.suggested_milestones],
                        (profile as any)?.goalsVersion
                      );
                      setCourses((prev) => prev.map((c) => (c.id === selCourse.id ? { ...c, milestones: merged } : c)));
                    }
                  }
                  setDirty(true);
                }}
                className="w-full h-10 rounded-lg border px-3"
              >
                <option value="" disabled hidden>
                  Välj utbildningsmoment …
                </option>
                {srUtbildningsmomentTemplates.map((t) => (
                  <option key={t.id} value={t.title}>
                    {t.title}
                  </option>
                ))}
                <option value="Annan">Annan</option>
              </select>
            ) : (
              <input
                type="text"
                value={selCourse.title || ""}
                onChange={(e) => {
                  setCourses((prev) => prev.map((c) => (c.id === selCourse.id ? { ...c, title: e.target.value } : c)));
                  setDirty(true);
                }}
                className="w-full h-10 rounded-lg border px-3"
              />
            )}
          </div>
          {srUtbildningsmomentTemplates.length > 0 && selCourse.title === "Annan" && (
            <div>
              <label className="block text-sm text-slate-700">Titel</label>
              <input
                type="text"
                value={(selCourse as any).courseTitle || ""}
                onChange={(e) => {
                  setCourses((prev) =>
                    prev.map((c) => (c.id === selCourse.id ? { ...c, courseTitle: e.target.value } : c))
                  );
                  setDirty(true);
                }}
                className="w-full h-10 rounded-lg border px-3"
                placeholder="Ange titel..."
              />
            </div>
          )}
        </>
      )}

      {(() => {
        if (selCourse.kind === "Utbildningsmoment") return null;
        const specialty = (profile as any)?.specialty || (profile as any)?.speciality;
        const usesMetis = usesMetisCourses(specialty);
        const srCourseOptions = srCourseTemplates.filter((t) => String(t.title || "").trim().length > 0);
        const groupedSrCourseOptions = (() => {
          const groupIndex = new Map<string, number>();
          courseGroupsOrder.forEach((g, i) => groupIndex.set(g, i));
          const enriched = srCourseOptions.map((t) => ({
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

        if (srCourseOptions.length > 0) {
          return (
            <div>
              <label className="block text-sm text-slate-700">Kurs</label>
              <select
                value={selCourse.title || ""}
                onChange={(e) => {
                  const nextTitle = e.target.value;
                  const tmpl = srCourseOptions.find((t) => t.title === nextTitle);
                  setCourses((prev) =>
                    prev.map((c) => {
                      if (c.id !== selCourse.id) return c;
                      const isPsyTitle = /(^|\s)psykoterapi/.test((nextTitle || "").toLowerCase());
                      const existingFlag = (c as any).showAsInterval;
                      const nextShowAsInterval = typeof existingFlag === "boolean" ? existingFlag : isPsyTitle;
                      const nextMilestones = tmpl
                        ? sanitizeStMilestonesForGoals([...(tmpl.suggested_milestones || [])], (profile as any)?.goalsVersion)
                        : (c as any).milestones || [];
                      return {
                        ...c,
                        title: nextTitle,
                        milestones: nextMilestones,
                        showAsInterval: nextShowAsInterval,
                      };
                    })
                  );
                }}
                className="w-full h-10 rounded-lg border px-3"
              >
                <option value="" disabled hidden data-placeholder="1">
                  Välj kurs ...
                </option>
                {(() => {
                  let prevGroup = "__start__";
                  const out: React.ReactNode[] = [];
                  for (const t of groupedSrCourseOptions) {
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
                {selCourse.title && !srCourseOptions.some((t) => t.title === selCourse.title) && (
                  <option value={selCourse.title}>{selCourse.title}</option>
                )}
              </select>
            </div>
          );
        }

        if (usesMetis) {
          return (
            <div>
              <label className="block text-sm text-slate-700">Kurs</label>
              <select
                value={selCourse.title || ""}
                onChange={async (e) => {
                  const nextTitle = e.target.value;
                  const autoMilestones = mapMetisGoalsToMilestoneIds(nextTitle, profile);
                  const existingMilestones = selCourse.milestones || [];
                  const availableMetisCourses = getMetisCoursesForSpecialty(specialty);
                  const isMetisCourse =
                    availableMetisCourses.includes(nextTitle) ||
                    ["Psykoterapi", "Ledarskap", "Handledning", "Palliativ medicin"].includes(nextTitle);

                  let shouldKeepMilestones = false;
                  if (existingMilestones.length > 0 && isMetisCourse && nextTitle !== "Annan kurs") {
                    const keepExisting = confirm(
                      "Vill du behålla valda delmål eller ändra till METIS-kursens förinställda?\n\n" +
                        "Klicka OK för att behålla valda delmål.\n" +
                        "Klicka Avbryt för att ändra till METIS-kursens förinställda delmål."
                    );
                    shouldKeepMilestones = keepExisting;
                  } else {
                    shouldKeepMilestones = existingMilestones.length > 0 && nextTitle !== "Annan kurs";
                  }

                  setCourses((prev) =>
                    prev.map((c) => {
                      if (c.id !== selCourse.id) return c;
                      const isPsyTitle = /(^|\s)psykoterapi/.test((nextTitle || "").toLowerCase());
                      const existingFlag = (c as any).showAsInterval;
                      const nextShowAsInterval = typeof existingFlag === "boolean" ? existingFlag : isPsyTitle;
                      return {
                        ...c,
                        title: nextTitle,
                        milestones: shouldKeepMilestones ? existingMilestones : autoMilestones,
                        showAsInterval: nextShowAsInterval,
                      };
                    })
                  );
                }}
                className="w-full h-10 rounded-lg border px-3"
              >
                <option value="" disabled hidden data-placeholder="1">
                  Välj kurs ...
                </option>

                <optgroup label="— METISKURSER —">
                  {getMetisCoursesForSpecialty(specialty).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </optgroup>

                <optgroup label="— ÖVRIGA —">
                  <option value="Psykoterapi">Psykoterapi</option>
                  <option value="Ledarskap">Ledarskap</option>
                  <option value="Handledning">Handledning</option>
                  <option value="Palliativ medicin">Palliativ medicin</option>
                  <option value="Annan kurs">Annan kurs</option>
                </optgroup>
              </select>
            </div>
          );
        }

        return (
          <div>
            <label className="block text-sm text-slate-700">Kurs</label>
            <input
              type="text"
              value={selCourse.title || ""}
              onChange={(e) => {
                const nextTitle = e.target.value;
                setCourses((prev) =>
                  prev.map((c) => {
                    if (c.id !== selCourse.id) return c;
                    const isPsyTitle = /(^|\s)psykoterapi/.test((nextTitle || "").toLowerCase());
                    const existingFlag = (c as any).showAsInterval;
                    const nextShowAsInterval = typeof existingFlag === "boolean" ? existingFlag : isPsyTitle;
                    return {
                      ...c,
                      title: nextTitle,
                      showAsInterval: nextShowAsInterval,
                    };
                  })
                );
              }}
              className="w-full h-10 rounded-lg border px-3"
            />
          </div>
        );
      })()}

      {(() => {
        const specialty = (profile as any)?.specialty || (profile as any)?.speciality;
        const usesMetis = usesMetisCourses(specialty);
        if (usesMetis && selCourse.title === "Annan kurs") {
          return (
            <div>
              <label className="block text-sm text-slate-700">Kursens titel</label>
              <input
                value={(selCourse as any)?.courseTitle || ""}
                onChange={(e) => {
                  setCourses((prev) =>
                    prev.map((c) => (c.id === selCourse.id ? { ...c, courseTitle: e.target.value } : c))
                  );
                }}
                className="w-full h-10 rounded-lg border px-3"
              />
            </div>
          );
        }
        return null;
      })()}

      {(() => {
        const prof: any = profile || {};
        const btWindow = getEffectiveBtWindow(prof, {
          isValidISO,
          isoToDateSafe,
          dateToISO,
          addMonths,
        });
        if (!btWindow) return null;

        const startISO = selCourse.startDate || selCourse.endDate || "";
        const inBtWindow = isIsoInBtWindow(startISO, btWindow, isValidISO);
        if (!inBtWindow) return null;

        return (
          <div>
            <label className="block text-sm text-slate-700">Fas</label>
            <select
              value={(selCourse as any)?.phase || "BT"}
              onChange={(e) => {
                const v = e.target.value as "BT" | "ST";
                setCourses((prev) => prev.map((c) => (c.id === selCourse.id ? { ...c, phase: v } : c)));
              }}
              className="w-full h-10 rounded-lg border px-3 placeholder:text-slate-400"
            >
              <option value="BT">BT</option>
              <option value="ST">ST</option>
            </select>
          </div>
        );
      })()}

      <div>
        <label className="block text-sm text-slate-700">
          {selCourse.kind === "Utbildningsmoment" ? "Handledare" : "Kursledare"}
        </label>
        <input
          value={selCourse.courseLeaderName || ""}
          onChange={(e) =>
            setCourses((prev) =>
              prev.map((c) => (c.id === selCourse.id ? { ...c, courseLeaderName: e.target.value } : c))
            )
          }
          className="w-full h-10 rounded-lg border px-3"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-700">Start</label>
        <CalendarDatePicker
          value={(selCourse as any)?.showAsInterval ? selCourse.startDate || "" : selCourse.startDate || selCourse.endDate || ""}
          onChange={(iso) => {
            const nextISO = iso || undefined;
            setCourses((prev) =>
              prev.map((c) => {
                if (c.id !== selCourse.id) return c;
                const showAsInterval = (c as any)?.showAsInterval;
                if (showAsInterval) {
                  return { ...c, startDate: nextISO };
                }
                if (!nextISO) {
                  return { ...c, startDate: undefined };
                }
                return {
                  ...c,
                  startDate: nextISO,
                  endDate: c.endDate || nextISO,
                };
              })
            );
            setDirty(true);
          }}
          isClearable
          weekStartsOn={1}
        />
      </div>

      <div>
        <label className="block text-sm text-slate-700">Slut</label>
        <CalendarDatePicker
          value={(selCourse as any)?.showAsInterval ? selCourse.endDate || "" : selCourse.endDate || selCourse.startDate || ""}
          onChange={(iso) => {
            const nextISO = iso || undefined;
            setCourses((prev) =>
              prev.map((c) => {
                if (c.id !== selCourse.id) return c;
                const showAsInterval = (c as any)?.showAsInterval;
                if (showAsInterval) {
                  return { ...c, endDate: nextISO };
                }
                const end = nextISO;
                const start = c.startDate || end;
                return {
                  ...c,
                  endDate: end,
                  startDate: start,
                };
              })
            );
            setDirty(true);
          }}
          isClearable
          weekStartsOn={1}
        />
      </div>

      <div>
        <label className="block text-sm text-slate-700">Visa i tidslinjen</label>
        <select
          className="w-full h-9.5 rounded-lg border px-3"
          value={(() => {
            const raw = (selCourse as any)?.showAsInterval;
            const title = `${selCourse.title || ""}`.toLowerCase();
            const isPsyDefault = /(^|\s)psykoterapi/.test(title);
            const isInterval = typeof raw === "boolean" ? raw : isPsyDefault;
            return isInterval ? "interval" : "date";
          })()}
          onChange={(e) => {
            const mode = e.target.value as "interval" | "date";
            const flag = mode === "interval";
            updateSelectedCourse({ showAsInterval: flag });
          }}
        >
          <option value="interval">Start till slut</option>
          <option value="date">Enbart slutdatum</option>
        </select>
      </div>
    </div>
  );
}

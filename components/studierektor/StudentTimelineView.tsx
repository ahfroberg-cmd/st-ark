"use client";

import { useState } from "react";
import {
  dateToSlotSnapped,
  isValidISODate,
  normalizeToISODate,
} from "@/lib/studierektor/dateUtils";
import {
  INSIDE_BG_CELL,
  INSIDE_BG_LANE,
  MONTH_NAMES,
  OUTSIDE_BG_CELL,
  OUTSIDE_BG_LANE,
} from "@/lib/studierektor/timelineConstants";
import {
  buildAssessmentSelectedActivity,
  buildSupervisionSelectedActivity,
} from "@/lib/studierektor/sessionSelection";
import StudentTimelineLegend from "@/components/studierektor/StudentTimelineLegend";
import StudentTimelineMonthHeader from "@/components/studierektor/StudentTimelineMonthHeader";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function StudentTimelineView({
  years,
  timelineYears,
  placements,
  courses,
  goalsVersion,
  startYearForSlots,
  visibleStartSlot,
  endBoundarySlot,
  btStartSlot,
  btEndSlot,
  stStartSlot,
  stEndSlot,
  supervisionSessions,
  assessmentSessions,
  selectedActivity,
  setSelectedActivity,
}: {
  years: number[];
  timelineYears: number[];
  placements: any[];
  courses: any[];
  goalsVersion: string;
  startYearForSlots: number;
  visibleStartSlot: number | null;
  endBoundarySlot: number | null;
  btStartSlot: number | null;
  btEndSlot: number | null;
  stStartSlot: number | null;
  stEndSlot: number | null;
  supervisionSessions: any[];
  assessmentSessions: any[];
  selectedActivity: any;
  setSelectedActivity: (activity: any) => void;
}) {
  const [hoveredSupervisionId, setHoveredSupervisionId] = useState<string | null>(null);
  const [hoveredAssessmentId, setHoveredAssessmentId] = useState<string | null>(null);
  const [laneWidthByYear, setLaneWidthByYear] = useState<Record<number, number>>({});
  const [chipWidthById, setChipWidthById] = useState<Record<string, number>>({});

  return (
    <div className="relative rounded-xl">
      <div className="pointer-events-none absolute inset-0 z-0 rounded-xl border border-slate-200" />
      <div className="relative z-10 space-y-0">
        <StudentTimelineMonthHeader monthNames={MONTH_NAMES} />

        {years.length === 0 ? (
          <p className="text-center text-slate-500 py-8">Inga aktiviteter med datum att visa.</p>
        ) : (
          timelineYears.map((year, yearIdx) => {
            const rowStart = new Date(year, 0, 1);
            const rowEnd = new Date(year, 11, 31, 23, 59, 59);

            const yearPlacements = placements
              .map((p: any, i: number) => ({
                ...p,
                __hue: p.hue ?? (210 + i * 30) % 360,
                __type: "placement",
              }))
              .filter((p: any) => {
                const s = new Date(p.startDate || "");
                const e = new Date(p.endDate || "");
                if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
                return !(e < rowStart || s > rowEnd);
              });

            const yearCourses = courses
              .filter((c: any) => c.kind !== "Utbildningsmoment")
              .map((c: any, i: number) => ({
                ...c,
                __hue: c.hue ?? (120 + i * 25) % 360,
                __type: "course",
              }))
              .filter((c: any) => {
                const endISO = c.endDate || c.certificateDate || "";
                const d = new Date(endISO);
                if (isNaN(d.getTime())) return false;
                return d.getFullYear() === year;
              });

            const yearUtbildningsmoment = courses
              .filter((c: any) => c.kind === "Utbildningsmoment")
              .map((c: any, i: number) => ({
                ...c,
                __hue: c.hue ?? (80 + i * 22) % 360,
                __type: "utbildningsmoment",
              }))
              .filter((c: any) => {
                const dateISO = c.startDate || c.endDate || "";
                const d = new Date(dateISO);
                if (isNaN(d.getTime())) return false;
                return d.getFullYear() === year;
              });

            const isFirst = yearIdx === 0;
            const isLast = yearIdx === years.length - 1;

            return (
              <div key={year} className="grid grid-cols-[72px_1fr] items-stretch">
                <div className="pr-1 py-1 text-right font-semibold select-none flex items-center justify-end">
                  <span>{year}</span>
                </div>

                <div
                  className="st-row relative isolate bg-white"
                  style={{
                    height: "2.6rem",
                    backgroundImage:
                      "linear-gradient(to right, rgba(148,163,184,.35) 1px, transparent 1px)",
                    backgroundSize: "calc(100% / 24) 100%",
                    backgroundRepeat: "repeat-x",
                    backgroundPosition: "0 0",
                    borderTopLeftRadius: isFirst ? "2px" : "0px",
                    borderTopRightRadius: isFirst ? "2px" : "0px",
                    borderBottomLeftRadius: isLast ? "2px" : "0px",
                    borderBottomRightRadius: isLast ? "2px" : "0px",
                    overflow: "visible",
                  }}
                >
                  <div className="pointer-events-none absolute inset-0" style={{ zIndex: 10 }}>
                    {Array.from({ length: 13 }, (_, monthIdx) => {
                      const leftPercent = (monthIdx / 12) * 100;
                      return (
                        <div
                          key={`month-line-${monthIdx}`}
                          style={{
                            position: "absolute",
                            left: `${leftPercent}%`,
                            top: 0,
                            bottom: "3px",
                            width: "2px",
                            backgroundColor: "rgba(100,116,139,.85)",
                          }}
                        />
                      );
                    })}
                  </div>

                  <div
                    className="grid grid-cols-[repeat(24,minmax(0,1fr))]"
                    style={{ gridTemplateRows: "1.75rem 0.75rem" }}
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const globalSlot = (year - startYearForSlots) * 24 + i;
                      const outside =
                        (visibleStartSlot != null && globalSlot < visibleStartSlot) ||
                        (endBoundarySlot != null && globalSlot >= endBoundarySlot);
                      const monthIndex = Math.floor(i / 2);
                      const insideCls = monthIndex % 2 ? "bg-slate-50" : INSIDE_BG_CELL;
                      const isFirstCol = i === 0;
                      const isLastCol = i === 23;
                      const isFirstHalfOfMonth = i % 2 === 0;
                      return (
                        <div
                          key={`cell1-${i}`}
                          className={[
                            "relative z-0 h-7 border-t border-slate-300",
                            isFirstCol ? "border-l border-slate-300" : "",
                            isLastCol ? "border-r border-slate-300" : "",
                            !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
                            outside ? OUTSIDE_BG_CELL : insideCls,
                          ].join(" ")}
                          style={{ gridRowStart: 1 }}
                        />
                      );
                    })}

                    {Array.from({ length: 24 }, (_, i) => {
                      const globalSlot = (year - startYearForSlots) * 24 + i;
                      const outside =
                        (visibleStartSlot != null && globalSlot < visibleStartSlot) ||
                        (endBoundarySlot != null && globalSlot >= endBoundarySlot);
                      const monthIndex = Math.floor(i / 2);
                      const isFirstCol = i === 0;
                      const isLastCol = i === 23;
                      const isFirstHalfOfMonth = i % 2 === 0;
                      return (
                        <div
                          key={`lane-${i}`}
                          className={[
                            "h-3 w-full transition",
                            outside ? OUTSIDE_BG_LANE : (monthIndex % 2 ? "bg-slate-200" : INSIDE_BG_LANE),
                            "border-y border-slate-300",
                            isFirstCol ? "border-l border-slate-300" : "",
                            isLastCol ? "border-r border-slate-300" : "",
                            !isFirstCol && isFirstHalfOfMonth ? "border-l border-slate-300" : "",
                          ].join(" ")}
                          style={{ gridRowStart: 2 }}
                        />
                      );
                    })}
                  </div>

                  <div
                    className="pointer-events-none absolute inset-0 z-[60] grid grid-cols-[repeat(24,minmax(0,1fr))] rounded-[2px]"
                    style={{ gridTemplateRows: "1.9rem 0.75rem", overflow: "visible" }}
                  >
                    <div className="contents z-40">
                      {yearPlacements.map((p: any, idx: number) => {
                        const startISO = String(p.startDate || "");
                        const endISO = String(p.endDate || "");
                        if (!isValidISODate(startISO) || !isValidISODate(endISO)) return null;
                        const startSlot = dateToSlotSnapped(startYearForSlots, startISO, "start");
                        const endSlot = dateToSlotSnapped(startYearForSlots, endISO, "end");
                        if (!Number.isFinite(startSlot) || !Number.isFinite(endSlot)) return null;

                        const rowStartSlot = (year - startYearForSlots) * 24;
                        const rowEndSlot = rowStartSlot + 24;
                        const s0 = Math.max(startSlot, rowStartSlot);
                        const s1 = Math.max(s0 + 1, Math.min(endSlot, rowEndSlot));
                        const startCol = s0 - rowStartSlot;
                        const span = s1 - s0;

                        const label = p.label || p.clinic || p.type || "Placering";

                        return (
                          <div
                            key={(p.id || idx) + "@" + year}
                            className={[
                              "relative pointer-events-auto h-7 select-none rounded-lg px-2 text-[11px] shadow border transition overflow-hidden",
                              "cursor-pointer hover:shadow-lg hover:-translate-y-[1px]",
                              "z-[65] border-slate-200",
                            ].join(" ")}
                            style={{
                              gridRowStart: 1,
                              gridColumnStart: startCol + 1,
                              gridColumnEnd: startCol + 1 + span,
                              transform: "translateX(1.5px)",
                              marginRight: "-1px",
                              backgroundColor: `hsl(${p.__hue} 28% 88%)`,
                              border: `1.5px solid hsl(${p.__hue} 35% 50%)`,
                            }}
                            title={label}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedActivity(p);
                            }}
                          >
                            <span className="block w-full truncate text-slate-900">{label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div
                      ref={(el) => {
                        if (el) {
                          const w = el.clientWidth || el.offsetWidth || 0;
                          if (laneWidthByYear[year] !== w) {
                            setLaneWidthByYear((prev) => ({ ...prev, [year]: w }));
                          }
                        }
                      }}
                      className="relative pointer-events-none z-[120]"
                      style={{
                        gridRowStart: 2,
                        gridColumn: "1 / -1",
                        height: "0.75rem",
                        overflow: "visible",
                      }}
                    >
                      {supervisionSessions
                        .filter((s: any) => {
                          const d = new Date(s.dateISO + "T00:00:00");
                          return !isNaN(d.getTime()) && d.getFullYear() === year;
                        })
                        .map((s: any) => {
                          const markerISO = normalizeToISODate(
                            (s as any).dateISO || (s as any).date || (s as any).iso,
                          );
                          if (!markerISO) return null;
                          const rowStartSlot = (year - startYearForSlots) * 24;
                          const markerSlot = dateToSlotSnapped(startYearForSlots, markerISO, "start");
                          if (!Number.isFinite(markerSlot)) return null;
                          const localSlot = markerSlot - rowStartSlot;
                          if (localSlot < 0 || localSlot >= 24) return null;
                          const pct = clamp(((localSlot + 0.5) / 24) * 100, 0, 100);
                          const isHovered = hoveredSupervisionId === s.id;
                          return (
                            <button
                              key={s.id + "@" + year}
                              type="button"
                              className="pointer-events-auto absolute z-[300]"
                              style={{
                                left: `${pct}%`,
                                top: "-0.55rem",
                                transform: isHovered ? "translate(-50%, -1px)" : "translate(-50%, 0)",
                              }}
                              onMouseEnter={() => setHoveredSupervisionId(s.id)}
                              onMouseLeave={() =>
                                setHoveredSupervisionId((prev) => (prev === s.id ? null : prev))
                              }
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedActivity(buildSupervisionSelectedActivity(s, s.id));
                              }}
                              title={
                                s.title && String(s.title).trim() ? `${s.title} (${s.dateISO})` : s.dateISO
                              }
                            >
                              <span
                                aria-hidden="true"
                                style={{
                                  position: "relative",
                                  display: "block",
                                  width: 0,
                                  height: 0,
                                }}
                              >
                                <span
                                  style={{
                                    position: "absolute",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    width: 0,
                                    height: 0,
                                    borderLeft: "7px solid transparent",
                                    borderRight: "7px solid transparent",
                                    borderBottom: "11px solid #064e3b",
                                  }}
                                />
                                <span
                                  style={{
                                    position: "absolute",
                                    left: "50%",
                                    transform: "translateX(-50%) translateY(1px)",
                                    width: 0,
                                    height: 0,
                                    borderLeft: "6px solid transparent",
                                    borderRight: "6px solid transparent",
                                    borderBottom: isHovered ? "9px solid #34d399" : "9px solid #059669",
                                  }}
                                />
                              </span>
                            </button>
                          );
                        })}

                      {assessmentSessions
                        .filter((a: any) => {
                          const d = new Date(a.dateISO + "T00:00:00");
                          return !isNaN(d.getTime()) && d.getFullYear() === year;
                        })
                        .map((a: any) => {
                          const markerISO = normalizeToISODate(
                            (a as any).dateISO || (a as any).date || (a as any).iso,
                          );
                          if (!markerISO) return null;
                          const rowStartSlot = (year - startYearForSlots) * 24;
                          const markerSlot = dateToSlotSnapped(startYearForSlots, markerISO, "start");
                          if (!Number.isFinite(markerSlot)) return null;
                          const localSlot = markerSlot - rowStartSlot;
                          if (localSlot < 0 || localSlot >= 24) return null;
                          const pct = clamp(((localSlot + 0.5) / 24) * 100, 0, 100);
                          const isHovered = hoveredAssessmentId === a.id;
                          const baseColor = "#f59e0b";
                          const hoverColor = "#facc15";
                          const strokeColor = "#d97706";
                          return (
                            <button
                              key={a.id + "@assess@" + year}
                              type="button"
                              className="pointer-events-auto absolute z-[300]"
                              style={{
                                left: `${pct}%`,
                                top: "-0.7rem",
                                transform: isHovered
                                  ? "translate(-50%, -1px) scale(1.05)"
                                  : "translate(-50%, 0) scale(1)",
                              }}
                              onMouseEnter={() => setHoveredAssessmentId(a.id)}
                              onMouseLeave={() =>
                                setHoveredAssessmentId((prev) => (prev === a.id ? null : prev))
                              }
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedActivity(buildAssessmentSelectedActivity(a, a.id));
                              }}
                              title={
                                a.title && String(a.title).trim() ? `${a.title} (${a.dateISO})` : a.dateISO
                              }
                            >
                              <svg
                                aria-hidden="true"
                                width={16}
                                height={16}
                                viewBox="0 0 24 24"
                                style={{ display: "block" }}
                              >
                                <path
                                  d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
                                  fill={isHovered ? hoverColor : baseColor}
                                  stroke={strokeColor}
                                  strokeWidth={1.3}
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          );
                        })}

                      {yearCourses.map((c: any, idx: number) => {
                        const endISO = c.endDate || c.certificateDate || "";
                        if (!isValidISODate(endISO)) return null;
                        const courseSlot = dateToSlotSnapped(startYearForSlots, endISO, "end");
                        if (!Number.isFinite(courseSlot)) return null;
                        const rowStartSlot = (year - startYearForSlots) * 24;
                        const col = courseSlot - rowStartSlot;
                        if (col < 0 || col >= 24) return null;
                        const title = c.title || c.name || "Kurs";

                        const laneW = laneWidthByYear[year] || 0;
                        const trueCenterPx = ((col + 0.5) / 24) * laneW;
                        const measured = chipWidthById[String(c.id)] || 0;
                        const half = Math.max(1, measured / 2);
                        const clampedCenterPx =
                          laneW > 0 ? clamp(trueCenterPx, half, Math.max(half, laneW - half)) : trueCenterPx;
                        const sel = !!(
                          selectedActivity &&
                          (selectedActivity.id || selectedActivity._id) === (c.id || c._id)
                        );

                        return (
                          <div
                            key={(c.id || idx) + "@" + year}
                            ref={(el) => {
                              if (el) {
                                const w = el.offsetWidth || 0;
                                const idKey = String(c.id);
                                if (w) {
                                  setChipWidthById((prev) =>
                                    prev[idKey] === w ? prev : { ...prev, [idKey]: w },
                                  );
                                }
                              }
                            }}
                            className={`absolute z-[70] top-1/2 -translate-y-1/2 pointer-events-auto select-none rounded-full px-2 h-5 flex items-center text-[10.5px] border cursor-pointer shadow-sm transition-transform transition-colors ${
                              sel
                                ? "text-white bg-sky-600 border-sky-800 hover:bg-sky-500 hover:border-sky-700 hover:shadow-md"
                                : "text-white bg-sky-700 border-sky-900 hover:bg-sky-600 hover:border-sky-800 hover:shadow-md"
                            }`}
                            style={{
                              left: `${clampedCenterPx}px`,
                              transform: "translate(-50%, -50%)",
                            }}
                            title={title}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedActivity(c);
                            }}
                          >
                            <span className="max-w-[24ch] truncate">{title}</span>
                          </div>
                        );
                      })}

                      {yearUtbildningsmoment.map((c: any, idx: number) => {
                        const dateISO = c.startDate || c.endDate || "";
                        if (!isValidISODate(dateISO)) return null;
                        const slot = dateToSlotSnapped(startYearForSlots, dateISO, "start");
                        if (!Number.isFinite(slot)) return null;
                        const rowStartSlot = (year - startYearForSlots) * 24;
                        const col = slot - rowStartSlot;
                        if (col < 0 || col >= 24) return null;
                        const title =
                          c.title === "Annan"
                            ? (c.courseTitle || c.title || "Utb.moment")
                            : (c.title || c.name || "Utb.moment");

                        const laneW = laneWidthByYear[year] || 0;
                        const trueCenterPx = ((col + 0.5) / 24) * laneW;
                        const measured = chipWidthById[String(c.id) + "-u"] || 0;
                        const half = Math.max(1, measured / 2);
                        const clampedCenterPx =
                          laneW > 0 ? clamp(trueCenterPx, half, Math.max(half, laneW - half)) : trueCenterPx;
                        const sel = !!(
                          selectedActivity &&
                          (selectedActivity.id || selectedActivity._id) === (c.id || c._id)
                        );

                        return (
                          <div
                            key={(c.id || idx) + "@u@" + year}
                            ref={(el) => {
                              if (el) {
                                const w = el.offsetWidth || 0;
                                const idKey = String(c.id) + "-u";
                                if (w) {
                                  setChipWidthById((prev) =>
                                    prev[idKey] === w ? prev : { ...prev, [idKey]: w },
                                  );
                                }
                              }
                            }}
                            className={`absolute z-[72] pointer-events-auto select-none rounded-full px-2 h-5 flex items-center text-[10.5px] border cursor-pointer shadow-sm transition-transform transition-colors ${
                              sel
                                ? "text-white bg-emerald-600 border-emerald-800 hover:bg-emerald-500 hover:border-emerald-700 hover:shadow-md"
                                : "text-white bg-emerald-700 border-emerald-900 hover:bg-emerald-600 hover:border-emerald-800 hover:shadow-md"
                            }`}
                            style={{
                              left: `${clampedCenterPx}px`,
                              top: "calc(100% + 2px)",
                              transform: "translateX(-50%)",
                            }}
                            title={title}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedActivity(c);
                            }}
                          >
                            <span className="max-w-[24ch] truncate">{title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-0 z-[250]">
                    {(() => {
                      const rowStartSlot = (year - startYearForSlots) * 24;
                      const rowEndSlot = rowStartSlot + 24;
                      const greenSlot =
                        goalsVersion === "2021" ? (btStartSlot ?? stStartSlot) : stStartSlot;

                      const renderLine = (
                        slot: number | null,
                        color: string,
                        key: string,
                        transform: string,
                        title: string,
                      ) => {
                        if (slot == null || !Number.isFinite(slot)) return null;
                        if (slot < rowStartSlot || slot > rowEndSlot) return null;
                        const pct = ((slot - rowStartSlot) / 24) * 100;
                        if (pct < 0 || pct > 100) return null;
                        return (
                          <div
                            key={key}
                            className="absolute"
                            style={{
                              top: 0,
                              height: "1.75rem",
                              left: `${pct}%`,
                              width: 0,
                              borderLeft: `3.5px solid ${color}`,
                              transform,
                            }}
                            title={title}
                          />
                        );
                      };

                      const todayLine = (() => {
                        const today = new Date();
                        const yearToday = today.getFullYear();
                        if (yearToday !== year) return null;
                        const startOfYear = new Date(yearToday, 0, 1);
                        const startOfNextYear = new Date(yearToday + 1, 0, 1);
                        const msInDay = 24 * 60 * 60 * 1000;
                        const dayIndex = Math.floor((today.getTime() - startOfYear.getTime()) / msInDay);
                        const daysInYear = Math.max(
                          1,
                          Math.floor((startOfNextYear.getTime() - startOfYear.getTime()) / msInDay),
                        );
                        const frac = Math.min(Math.max(dayIndex / daysInYear, 0), 1);
                        const pct = frac * 100;
                        if (pct < 0 || pct > 100) return null;
                        const todayISO = new Date().toISOString().slice(0, 10);
                        return (
                          <div
                            key={`today-${year}`}
                            className="absolute"
                            style={{
                              top: 0,
                              height: "1.75rem",
                              left: `${pct}%`,
                              width: 0,
                              borderLeft: "3.5px solid #2563eb",
                              transform: "translateX(0)",
                            }}
                            title={`Idag (${todayISO})`}
                          />
                        );
                      })();

                      return (
                        <>
                          {renderLine(
                            greenSlot,
                            "#0f766e",
                            `bnd-green-${year}`,
                            "translateX(-0.25px)",
                            goalsVersion === "2021" && btStartSlot != null ? "BT start" : "ST start",
                          )}
                          {goalsVersion === "2021"
                            ? renderLine(
                                btEndSlot,
                                "#ca8a04",
                                `bnd-yellow-${year}`,
                                "translateX(-0.25px)",
                                "Sista datum för färdig BT",
                              )
                            : null}
                          {renderLine(stEndSlot, "#b91c1c", `bnd-red-${year}`, "translateX(-0.75px)", "ST slut")}
                          {todayLine}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <StudentTimelineLegend goalsVersion={goalsVersion} />
      </div>
    </div>
  );
}

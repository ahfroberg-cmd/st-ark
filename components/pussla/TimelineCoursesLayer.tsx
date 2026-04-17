"use client";

import React from "react";

type TimelineCoursesLayerProps = {
  coursesThisYear: any[];
  year: number;
  selectedCourseId: string | null;
  selectedPlacementId: string | null;
  dirty: boolean;
  hoveredCourseId: string | null;
  laneWidthByYear: Record<number, number>;
  dragCourseRef: React.MutableRefObject<any>;
  getChipWidth: (key: string) => number;
  setChipWidth: (key: string, width: number) => void;
  daysInYear: (year: number) => number;
  dayOfYear: (d: Date) => number;
  isValidISO: (iso: string) => boolean;
  isoToDateSafe: (iso: string) => Date;
  clamp: (v: number, min: number, max: number) => number;
  getCourseDisplayTitle: (course: any) => string;
  switchActivity: (placementId: string | null, courseId: string | null) => boolean;
  setHoveredCourseId: React.Dispatch<React.SetStateAction<string | null>>;
  setCertMenu: (menu: any) => void;
  setActiveLane: (lane: "placement" | "course") => void;
  openPreviewForBtGoals: (activity: any) => void;
  profile: any;
  setCourseForModal: (course: any) => void;
  setCourseModalOpen: (open: boolean) => void;
};

export default function TimelineCoursesLayer(props: TimelineCoursesLayerProps) {
  const {
    coursesThisYear,
    year,
    selectedCourseId,
    selectedPlacementId,
    dirty,
    hoveredCourseId,
    laneWidthByYear,
    dragCourseRef,
    getChipWidth,
    setChipWidth,
    daysInYear,
    dayOfYear,
    isValidISO,
    isoToDateSafe,
    clamp,
    getCourseDisplayTitle,
    switchActivity,
    setHoveredCourseId,
    setCertMenu,
    setActiveLane,
    openPreviewForBtGoals,
    profile,
    setCourseForModal,
    setCourseModalOpen,
  } = props;

  return (
    <>
      {coursesThisYear.map((c: any) => {
        const sel = c.id === selectedCourseId;

        const total = Math.max(1, daysInYear(year) - 1);
        const toPct = (iso?: string) => {
          if (!iso || !isValidISO(iso)) return null;
          const d = isoToDateSafe(iso);
          if (d.getFullYear() !== year) return null;
          return (dayOfYear(d) / total) * 100;
        };

        if ((c as any).showAsInterval) {
          const sISO = c.startDate || c.certificateDate || "";
          const eISO = c.endDate || c.certificateDate || "";
          if (!isValidISO(sISO) || !isValidISO(eISO)) return null;

          let sDate = isoToDateSafe(sISO);
          let eDate = isoToDateSafe(eISO);
          if (+eDate < +sDate) [sDate, eDate] = [eDate, sDate];

          const yearStart = isoToDateSafe(`${year}-01-01`);
          const yearEnd = isoToDateSafe(`${year}-12-31`);
          if (+eDate < +yearStart || +sDate > +yearEnd) return null;

          const total2 = Math.max(1, daysInYear(year) - 1);
          const pctOfYear = (d: Date) => (dayOfYear(d) / total2) * 100;

          const segStart = +sDate <= +yearStart ? yearStart : sDate;
          const segEnd = +eDate >= +yearEnd ? yearEnd : eDate;

          const leftPct = segStart.getFullYear() === year ? pctOfYear(segStart) : 0;
          const rightPct = segEnd.getFullYear() === year ? pctOfYear(segEnd) : 100;

          const bandLeft = Math.min(leftPct, rightPct);
          const bandRight = Math.max(leftPct, rightPct);
          const bandWidth = Math.max(0, bandRight - bandLeft);

          return (
            <React.Fragment key={c.id}>
              {bandWidth > 0 && (
                <div
                  className={`absolute top-1/2 h-2 rounded-full z-[60] ${
                    c.kind === "Utbildningsmoment" ? "bg-emerald-300/70" : "bg-blue-300/70"
                  }`}
                  style={{
                    left: `${bandLeft}%`,
                    width: `${bandWidth}%`,
                    transform: "translateY(calc(-50% - 2px))",
                  }}
                />
              )}

              {(() => {
                const d = sDate;
                const laneW = laneWidthByYear[year] || 0;
                if (d.getFullYear() !== year) return null;

                const total3 = Math.max(1, daysInYear(year) - 1);
                const startPct = d.getFullYear() === year ? (dayOfYear(d) / total3) * 100 : null;

                let trueCenterPx: number;
                if (startPct == null) trueCenterPx = d.getFullYear() < year ? -1 : laneW + 1;
                else trueCenterPx = (startPct / 100) * laneW;

                const measured = getChipWidth(c.id + "_psy_start");
                const half = Math.max(1, measured / 2);
                const clampedCenterPx = clamp(trueCenterPx, half, Math.max(half, laneW - half));
                const piggPct = startPct == null ? (d.getFullYear() < year ? 0 : 100) : clamp(startPct, 0, 100);
                const hovered = hoveredCourseId === c.id;

                return (
                  <React.Fragment key={c.id + "_psy_start"}>
                    <div
                      ref={(el) => {
                        if (el) {
                          const w = el.offsetWidth || 0;
                          if (w) setChipWidth(c.id + "_psy_start", w);
                        }
                      }}
                      className={`absolute z-[150] top-1/2 -translate-y-1/2 pointer-events-auto select-none rounded-full px-2 h-5 flex items-center text-[10.5px] border cursor-grab active:cursor-grabbing shadow-sm transition-transform transition-colors ${
                        c.kind === "Utbildningsmoment"
                          ? sel
                            ? "text-white bg-emerald-600 border-emerald-800 hover:bg-emerald-500 hover:border-emerald-700 hover:shadow-md"
                            : "text-white bg-emerald-700 border-emerald-900 hover:bg-emerald-600 hover:border-emerald-800 hover:shadow-md"
                          : sel
                          ? "text-white bg-sky-600 border-sky-800 hover:bg-sky-500 hover:border-sky-700 hover:shadow-md"
                          : "text-white bg-sky-700 border-sky-900 hover:bg-sky-600 hover:border-sky-800 hover:shadow-md"
                      }`}
                      style={{
                        left: `${clampedCenterPx}px`,
                        transform: hovered ? "translate(-50%, -58%)" : "translate(-50%, -50%)",
                      }}
                      title={`${getCourseDisplayTitle(c)} start — ${c.startDate || c.certificateDate}`}
                      data-info={`Startmarkör för kursen: ${getCourseDisplayTitle(c)}. Klicka för att välja kursen och redigera den i detaljpanelen.`}
                      onClick={(e) => {
                        e.stopPropagation();
                        switchActivity(null, c.id);
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        switchActivity(null, c.id);
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setCertMenu({
                          open: true,
                          x: Math.round(e.clientX),
                          y: Math.round(rect.top + rect.height / 2),
                          kind: "course",
                          placement: null,
                          course: c,
                        });
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const isSwitching = selectedPlacementId !== null || selectedCourseId !== c.id;
                        const ok = switchActivity(null, c.id);
                        if (!ok) return;
                        setActiveLane("course");
                        if (dirty && isSwitching) return;
                        const rowEl = (e.currentTarget as HTMLElement).closest(".st-row") as HTMLElement | null;
                        if (!rowEl) return;
                        const rect = rowEl.getBoundingClientRect();
                        dragCourseRef.current = {
                          id: c.id,
                          year,
                          rowLeft: rect.left,
                          rowTop: rect.top,
                          rowWidth: rect.width,
                          rowHeight: rect.height,
                          daysInYear: daysInYear(year),
                          mode: "start",
                        };
                      }}
                    >
                      <span className="max-w-[24ch] truncate">{getCourseDisplayTitle(c) + " start"}</span>
                    </div>
                    <div
                      className="absolute rounded-full"
                      style={{
                        left: `${piggPct}%`,
                        top: "calc(50% - 1px)",
                        width: "8px",
                        height: "8px",
                        transform: "translate(-50%, -50%)",
                        background: "#e6f1fb",
                        border: "1px solid #0c4a6e",
                        zIndex: 200,
                        pointerEvents: "none",
                      }}
                      title={c.startDate || c.certificateDate}
                    />
                  </React.Fragment>
                );
              })()}

              {(() => {
                const d = eDate;
                const laneW = laneWidthByYear[year] || 0;
                if (d.getFullYear() !== year) return null;

                const total4 = Math.max(1, daysInYear(year) - 1);
                const endPct = d.getFullYear() === year ? (dayOfYear(d) / total4) * 100 : null;
                let trueCenterPx: number;
                if (endPct == null) trueCenterPx = d.getFullYear() < year ? -1 : laneW + 1;
                else trueCenterPx = (endPct / 100) * laneW;

                const measured = getChipWidth(c.id + "_psy_end");
                const half = Math.max(1, measured / 2);
                const clampedCenterPx = clamp(trueCenterPx, half, Math.max(half, laneW - half));
                const piggPct = endPct == null ? (d.getFullYear() < year ? 0 : 100) : clamp(endPct, 0, 100);
                const hovered = hoveredCourseId === c.id;

                return (
                  <React.Fragment key={c.id + "_psy_end"}>
                    <div
                      ref={(el) => {
                        if (el) {
                          const w = el.offsetWidth || 0;
                          if (w) setChipWidth(c.id + "_psy_end", w);
                        }
                      }}
                      className={`absolute z-[150] top-1/2 -translate-y-1/2 pointer-events-auto select-none rounded-full px-2 h-5 flex items-center text-[10.5px] border cursor-grab active:cursor-grabbing shadow-sm transition-transform transition-colors ${
                        sel
                          ? "text-white bg-sky-600 border-sky-800 hover:bg-sky-500 hover:border-sky-700 hover:shadow-md"
                          : "text-white bg-sky-700 border-sky-900 hover:bg-sky-600 hover:border-sky-800 hover:shadow-md"
                      }`}
                      style={{
                        left: `${clampedCenterPx}px`,
                        transform: hovered ? "translate(-50%, -58%)" : "translate(-50%, -50%)",
                      }}
                      title={`${getCourseDisplayTitle(c)} slut — ${c.endDate || c.certificateDate}`}
                      data-info={`Slutmarkör för kursen: ${getCourseDisplayTitle(c)}. Klicka för att välja kursen och redigera den i detaljpanelen.`}
                      onClick={(e) => {
                        e.stopPropagation();
                        switchActivity(null, c.id);
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        switchActivity(null, c.id);
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setCertMenu({
                          open: true,
                          x: Math.round(e.clientX),
                          y: Math.round(rect.top + rect.height / 2),
                          kind: "course",
                          placement: null,
                          course: c,
                        });
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const isSwitching = selectedPlacementId !== null || selectedCourseId !== c.id;
                        const ok = switchActivity(null, c.id);
                        if (!ok) return;
                        setActiveLane("course");
                        if (dirty && isSwitching) return;
                        const rowEl = (e.currentTarget as HTMLElement).closest(".st-row") as HTMLElement | null;
                        if (!rowEl) return;
                        const rect = rowEl.getBoundingClientRect();
                        dragCourseRef.current = {
                          id: c.id,
                          year,
                          rowLeft: rect.left,
                          rowTop: rect.top,
                          rowWidth: rect.width,
                          rowHeight: rect.height,
                          daysInYear: daysInYear(year),
                          mode: "end",
                        };
                      }}
                    >
                      <span className="max-w-[24ch] truncate">{getCourseDisplayTitle(c) + " slut"}</span>
                    </div>
                    <div
                      className="absolute rounded-full"
                      style={{
                        left: `${piggPct}%`,
                        top: "calc(50% - 1px)",
                        width: "8px",
                        height: "8px",
                        transform: "translate(-50%, -50%)",
                        background: "#e6f1fb",
                        border: "1px solid #0c4a6e",
                        zIndex: 200,
                        pointerEvents: "none",
                      }}
                      title={c.endDate || c.certificateDate}
                    />
                  </React.Fragment>
                );
              })()}
            </React.Fragment>
          );
        }

        {
          const endISO = c.endDate || c.certificateDate || "";
          if (!isValidISO(endISO)) return null;
          const endDateObj = isoToDateSafe(endISO);

          const total5 = Math.max(1, daysInYear(year) - 1);
          const toPct2 = (iso?: string) => {
            if (!iso || !isValidISO(iso)) return null;
            const d = isoToDateSafe(iso);
            if (d.getFullYear() !== year) return null;
            return (dayOfYear(d) / total5) * 100;
          };

          const laneW = laneWidthByYear[year] || 0;
          const truePct = toPct2(endISO);
          let trueCenterPx: number;
          if (truePct == null) {
            const isBefore = endDateObj.getFullYear() < year;
            trueCenterPx = isBefore ? -1 : laneW + 1;
          } else {
            trueCenterPx = (truePct / 100) * laneW;
          }

          const measured = getChipWidth(c.id);
          const half = Math.max(1, measured / 2);
          const clampedCenterPx = clamp(trueCenterPx, half, Math.max(half, laneW - half));
          let piggPct: number;
          if (truePct == null) piggPct = endDateObj.getFullYear() < year ? 0 : 100;
          else piggPct = clamp(truePct, 0, 100);

          const hovered = hoveredCourseId === c.id;

          return (
            <React.Fragment key={c.id}>
              <div
                ref={(el) => {
                  if (el) {
                    const w = el.offsetWidth || 0;
                    if (w) setChipWidth(c.id, w);
                  }
                }}
                className={`absolute z-[70] top-1/2 -translate-y-1/2 pointer-events-auto select-none rounded-full px-2 h-5 flex items-center text-[10.5px] border cursor-grab active:cursor-grabbing shadow-sm transition-transform transition-colors ${
                  c.kind === "Utbildningsmoment"
                    ? sel
                      ? "text-white bg-emerald-600 border-emerald-800 hover:bg-emerald-500 hover:border-emerald-700 hover:shadow-md"
                      : "text-white bg-emerald-700 border-emerald-900 hover:bg-emerald-600 hover:border-emerald-800 hover:shadow-md"
                    : sel
                    ? "text-white bg-sky-600 border-sky-800 hover:bg-sky-500 hover:border-sky-700 hover:shadow-md"
                    : "text-white bg-sky-700 border-sky-900 hover:bg-sky-600 hover:border-sky-800 hover:shadow-md"
                }`}
                style={{
                  left: `${clampedCenterPx}px`,
                  transform: hovered ? "translate(-50%, -58%)" : "translate(-50%, -50%)",
                }}
                title={getCourseDisplayTitle(c)}
                data-info={`Klicka för att välja denna kurs: ${getCourseDisplayTitle(c)}. När kursen är vald kan du redigera den i detaljpanelen nedan.`}
                onClick={(e) => {
                  e.stopPropagation();
                  switchActivity(null, c.id);
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  switchActivity(null, c.id);

                  if (c.phase === "BT") {
                    if ((c as any)?.fulfillsStGoals) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setCertMenu({
                        open: true,
                        x: Math.round(e.clientX),
                        y: Math.round(rect.top + rect.height / 2),
                        kind: "course",
                        placement: null,
                        course: c,
                      });
                      return;
                    }

                    const dummyActivity: any = {
                      id: c.id,
                      type: "Kurs",
                      label: getCourseDisplayTitle(c),
                      startSlot: 0,
                      lengthSlots: 1,
                      hue: 0,
                      phase: "BT",
                      restPercent: 0,
                      isLocked: false,
                      btAssessment: (c as any).btAssessment || "",
                      btMilestones: (c as any).btMilestones || [],
                    };
                    openPreviewForBtGoals(dummyActivity);
                    return;
                  }

                  if (!profile) {
                    alert("Profil saknas – kan inte skapa intyget.");
                    return;
                  }
                  setCourseForModal(c);
                  setCourseModalOpen(true);
                }}
                onMouseEnter={() => {
                  setHoveredCourseId(c.id);
                }}
                onMouseLeave={() => {
                  setHoveredCourseId((prev) => (prev === c.id ? null : prev));
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const isSwitching = selectedPlacementId !== null || selectedCourseId !== c.id;
                  const ok = switchActivity(null, c.id);
                  if (!ok) return;
                  setActiveLane("course");
                  if (dirty && isSwitching) return;
                  const rowEl = (e.currentTarget as HTMLElement).closest(".st-row") as HTMLElement | null;
                  if (!rowEl) return;
                  const rect = rowEl.getBoundingClientRect();
                  dragCourseRef.current = {
                    id: c.id,
                    year,
                    rowLeft: rect.left,
                    rowTop: rect.top,
                    rowWidth: rect.width,
                    rowHeight: rect.height,
                    daysInYear: daysInYear(year),
                    mode: "move",
                  };
                }}
              >
                <span className="max-w-[24ch] truncate">{getCourseDisplayTitle(c)}</span>
              </div>
              <div
                className="absolute rounded-full"
                style={{
                  left: `${piggPct}%`,
                  top: "calc(50% - 1px)",
                  width: "8px",
                  height: "8px",
                  transform: "translate(-50%, -50%)",
                  background: "#e6f1fb",
                  border: "1px solid #0c4a6e",
                  zIndex: 200,
                  pointerEvents: "none",
                }}
                title={endISO}
              />
            </React.Fragment>
          );
        }
      })}
    </>
  );
}

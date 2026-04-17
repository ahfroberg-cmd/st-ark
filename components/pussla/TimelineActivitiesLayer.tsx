"use client";

import React from "react";
import {
  getTimelineActivityClassName,
  getTimelineActivityLabel,
  getTimelineActivityStyle,
} from "@/lib/pussla/timelineActivityPresentation";

type TimelineActivitiesLayerProps = {
  activitiesForYear: any[];
  rowStartSlot: number;
  rowEndSlot: number;
  rowIndex: number;
  cols: number;
  selectedPlacementId: string | null;
  selectedCourseId: string | null;
  dirty: boolean;
  switchActivity: (placementId: string | null, courseId: string | null) => boolean;
  setActiveLane: (lane: "placement" | "course") => void;
  dragPlacementRef: React.MutableRefObject<any>;
  onActivityDoubleClick: (activity: any, event: React.MouseEvent<HTMLDivElement>) => void;
};

export default function TimelineActivitiesLayer(props: TimelineActivitiesLayerProps) {
  const {
    activitiesForYear,
    rowStartSlot,
    rowEndSlot,
    rowIndex,
    cols,
    selectedPlacementId,
    selectedCourseId,
    dirty,
    switchActivity,
    setActiveLane,
    dragPlacementRef,
    onActivityDoubleClick,
  } = props;

  const startPlacementDrag = (
    e: React.MouseEvent<HTMLDivElement>,
    activity: any,
    mode: "move" | "resize-left" | "resize-right"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const isSwitching = activity.id !== selectedPlacementId || selectedCourseId !== null;
    const ok = switchActivity(activity.id, null);
    if (!ok) return;
    setActiveLane("placement");
    if (dirty && isSwitching) return;

    const rowEl = (e.currentTarget as HTMLElement).closest(".st-row") as HTMLElement | null;
    if (!rowEl) return;
    const rect = rowEl.getBoundingClientRect();
    const colWidth = rect.width / cols;
    const raw = (e.clientX - rect.left) / colWidth;
    const startColClick = mode === "move" ? Math.floor(raw) : Math.round(raw);
    dragPlacementRef.current = {
      id: activity.id,
      mode,
      startCol: startColClick,
      rowLeft: rect.left,
      rowTop: rect.top,
      colWidth,
      rowHeight: rect.height,
      startRowIndex: rowIndex,
      startSlot: activity.startSlot,
      lengthSlots: activity.lengthSlots,
    };
  };

  return (
    <div className="contents z-40">
      {activitiesForYear.map((activity, idx) => {
        const a0 = activity.startSlot;
        const a1 = activity.startSlot + activity.lengthSlots;
        const s0 = Math.max(a0, rowStartSlot);
        const s1 = Math.min(a1, rowEndSlot);
        if (s1 <= s0) return null;

        const startCol = s0 - rowStartSlot;
        const span = s1 - s0;
        const selected = activity.id === selectedPlacementId;
        const label = getTimelineActivityLabel(activity);
        const style = getTimelineActivityStyle(activity, selected);

        return (
          <div
            key={activity.id + "@" + idx}
            className={getTimelineActivityClassName(activity.type, selected)}
            style={{
              gridRowStart: 1,
              gridColumnStart: startCol + 1,
              gridColumnEnd: startCol + 1 + span,
              transform: "translateX(1.5px)",
              marginRight: "-1px",
              ...style,
            }}
            title={label}
            data-info={`Klicka för att välja denna aktivitet: ${label || activity.type}. När aktiviteten är vald kan du redigera den i detaljpanelen nedan.`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              switchActivity(activity.id, null);
            }}
            onDoubleClick={(e) => onActivityDoubleClick(activity, e)}
            onMouseDown={(e) => startPlacementDrag(e, activity, "move")}
          >
            <div
              className="absolute inset-y-0 left-0 w-4 cursor-ew-resize pointer-events-auto"
              onMouseDown={(e) => startPlacementDrag(e, activity, "resize-left")}
              title="Dra för att korta/förlänga åt vänster"
            />
            <div
              className="absolute inset-y-0 right-0 w-4 cursor-ew-resize pointer-events-auto"
              onMouseDown={(e) => startPlacementDrag(e, activity, "resize-right")}
              title="Dra för att förlänga åt höger"
            />
            <span className="block w-full truncate">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

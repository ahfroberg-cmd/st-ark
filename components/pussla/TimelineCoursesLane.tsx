"use client";

import React from "react";

type TimelineCoursesLaneProps = {
  year: number;
  laneWidth: number | undefined;
  onLaneElement: (year: number, el: HTMLDivElement | null) => void;
  children: React.ReactNode;
};

export default function TimelineCoursesLane(props: TimelineCoursesLaneProps) {
  const { year, laneWidth, onLaneElement, children } = props;

  return (
    <div
      ref={(el) => {
        onLaneElement(year, el);
      }}
      className="relative pointer-events-none z-[120]"
      style={{
        gridRowStart: 2,
        gridColumn: "1 / -1",
        height: "0.75rem",
        overflow: "visible",
      }}
      data-lane-width={laneWidth ?? 0}
    >
      {children}
    </div>
  );
}

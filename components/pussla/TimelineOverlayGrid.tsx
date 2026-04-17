"use client";

import React from "react";

type TimelineOverlayGridProps = {
  children: React.ReactNode;
};

export default function TimelineOverlayGrid(props: TimelineOverlayGridProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[60] grid grid-cols-[repeat(24,minmax(0,1fr))] rounded-[2px]"
      style={{
        gridTemplateRows: "1.9rem 0.75rem",
        overflow: "visible",
      }}
    >
      {props.children}
    </div>
  );
}

"use client";

import React from "react";

export default function TimelineMonthHeader({
  monthNames,
  hasSelection,
  onCloseSelection,
}: {
  monthNames: string[];
  hasSelection: boolean;
  onCloseSelection: () => void;
}) {
  return (
    <div
      className="sticky top-0 z-40 grid cursor-pointer grid-cols-[80px_1fr] items-end border-b border-slate-200 bg-white/80 backdrop-blur"
      onClick={() => {
        if (hasSelection) onCloseSelection();
      }}
    >
      <div className="pr-2" />
      <div className="relative">
        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] text-xs text-slate-700">
          {monthNames.map((m) => (
            <div key={m} className="col-span-2 pb-1 text-center font-medium">
              {m}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

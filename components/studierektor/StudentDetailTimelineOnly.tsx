"use client";

import type { ReactNode } from "react";

export default function StudentDetailTimelineOnly({
  studentName,
  timelineView,
}: {
  studentName: string;
  timelineView: ReactNode;
}) {
  return (
    <>
      <div className="flex shrink-0 items-center border-b border-slate-200 px-4 py-3">
        <h2 className="truncate text-base font-bold text-slate-900">{studentName}</h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{timelineView}</div>
      </div>
    </>
  );
}

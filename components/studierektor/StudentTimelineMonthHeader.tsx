"use client";

export default function StudentTimelineMonthHeader({
  monthNames,
}: {
  monthNames: string[];
}) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-end sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-slate-200">
      <div className="pr-1" />
      <div className="relative">
        <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] text-xs text-slate-700">
          {monthNames.map((monthName, idx) => (
            <div
              key={monthName}
              className={`col-span-2 text-center font-medium pb-1 ${idx === 0 ? "border-l border-slate-300" : ""} ${idx === monthNames.length - 1 ? "border-r border-slate-300" : ""}`}
            >
              {monthName}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

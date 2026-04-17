"use client";

export default function StudentTimelineLegend({
  goalsVersion,
}: {
  goalsVersion: string;
}) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-start mb-4">
      <div className="pr-1" />
      <div className="mt-2 ml-[10px] flex flex-wrap items-center gap-4 text-xs text-slate-700">
        {goalsVersion === "2021" ? (
          <>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#0f766e" }} />
              <span>= BT start</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#ca8a04" }} />
              <span>= BT slut</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#b91c1c" }} />
              <span>= ST slut</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#2563eb" }} />
              <span>= Idag</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#0f766e" }} />
              <span>= ST start</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#b91c1c" }} />
              <span>= ST slut</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#2563eb" }} />
              <span>= Idag</span>
            </div>
          </>
        )}

        <div className="w-20" />

        <div className="flex items-center gap-1">
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderBottom: "8px solid #059669",
            }}
          />
          <span>= Möte med huvudhandledare</span>
        </div>

        <div className="flex items-center gap-1">
          <svg aria-hidden="true" width={14} height={14} viewBox="0 0 24 24" style={{ display: "block" }}>
            <path
              d="M12 2.5l2.9 5.9 6.5.9-4.7 4.5 1.1 6.5L12 17.8l-5.8 3.0 1.1-6.5-4.7-4.5 6.5-.9z"
              fill="#f59e0b"
              stroke="#d97706"
              strokeWidth={1.3}
              strokeLinejoin="round"
            />
          </svg>
          <span>= Progressionsbedömning</span>
        </div>
      </div>
    </div>
  );
}

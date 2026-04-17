"use client";

import { formatProgressSharePercent, getProgressTooltipStyle } from "@/lib/pussla/progressTooltip";

type TimeDetails = {
  bt: { worked: number; total: number };
  st: { worked: number; total: number };
};

type TimeActivity = {
  id: string;
  days: number;
  hue: number;
  label: string;
  startDate: string;
  endDate: string;
  attendance: number;
};

type HoveredTimeActivity = TimeActivity & {
  phase: "bt" | "st";
  anchorX: number;
  anchorTop: number;
};

function TimePhaseBar(props: {
  title: string;
  workedLabel: string;
  worked: number;
  total: number;
  activities: TimeActivity[];
  phase: "bt" | "st";
  onHoverEnter: (act: TimeActivity, phase: "bt" | "st") => (e: React.MouseEvent<HTMLElement>) => void;
  onHoverLeave: () => void;
}) {
  const { title, workedLabel, worked, total, activities, phase, onHoverEnter, onHoverLeave } = props;
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <span className="text-sm text-slate-600">{total > 0 ? `${((worked / total) * 100).toFixed(0)}%` : "0%"}</span>
      </div>
      <div className="h-6 w-full rounded-full bg-slate-200 overflow-hidden flex">
        {activities.map((act) => {
          const barWidth = total > 0 ? (act.days / total) * 100 : 0;
          return (
            <div
              key={act.id}
              className="h-6 transition-[width] duration-300 cursor-pointer"
              style={{
                width: `${Math.min(100, barWidth)}%`,
                backgroundColor: `hsl(${act.hue} 45% 65%)`,
              }}
              onMouseEnter={onHoverEnter(act, phase)}
              onMouseLeave={onHoverLeave}
            />
          );
        })}
      </div>
      <div className="text-xs text-slate-600 mt-1">{workedLabel}: {Math.round(worked)} dagar</div>
      <div className="text-xs text-slate-600">Totalt antal dagar från startdatum till slutdatum: {Math.round(total)} dagar</div>
    </div>
  );
}

export default function ProgressTimeDetailSection(props: {
  is2021: boolean;
  timeDetails: TimeDetails;
  timeByActivity: { bt: TimeActivity[]; st: TimeActivity[] };
  hoveredTimeAct: HoveredTimeActivity | null;
  createProgressHoverEnterHandler: (
    act: TimeActivity,
    phase: "bt" | "st"
  ) => (e: React.MouseEvent<HTMLElement>) => void;
  clearProgressHover: () => void;
}) {
  const {
    is2021,
    timeDetails,
    timeByActivity,
    hoveredTimeAct,
    createProgressHoverEnterHandler,
    clearProgressHover,
  } = props;

  return (
    <div className="space-y-4">
      {hoveredTimeAct && (
        <div
          className="fixed px-2 py-1 rounded shadow-lg border text-xs whitespace-nowrap pointer-events-none"
          style={getProgressTooltipStyle(
            hoveredTimeAct,
            typeof window !== "undefined" ? window.innerWidth : undefined
          )}
        >
          <div className="font-semibold text-slate-800">{hoveredTimeAct.label}</div>
          <div className="text-slate-600">{hoveredTimeAct.startDate} – {hoveredTimeAct.endDate}</div>
          <div className="text-slate-600">Sysselsättning: {Math.round(hoveredTimeAct.attendance)}%</div>
          <div className="text-slate-600">Dagar motsv heltid: {Math.round(hoveredTimeAct.days)}</div>
          <div className="text-slate-600">
            Del av {hoveredTimeAct.phase === "bt" ? "BT" : "ST"}:{" "}
            {hoveredTimeAct.phase === "bt"
              ? formatProgressSharePercent(hoveredTimeAct.days, timeDetails.bt.total)
              : formatProgressSharePercent(hoveredTimeAct.days, timeDetails.st.total)}
            %
          </div>
        </div>
      )}

      {is2021 ? (
        <>
          <TimePhaseBar
            title="BT (Bastjänstgöring)"
            workedLabel="Genomförda dagar"
            worked={timeDetails.bt.worked}
            total={timeDetails.bt.total}
            activities={timeByActivity.bt}
            phase="bt"
            onHoverEnter={createProgressHoverEnterHandler}
            onHoverLeave={clearProgressHover}
          />
          <TimePhaseBar
            title="ST (Specialiseringstjänstgöring)"
            workedLabel="Genomförda dagar"
            worked={timeDetails.st.worked}
            total={timeDetails.st.total}
            activities={timeByActivity.st}
            phase="st"
            onHoverEnter={createProgressHoverEnterHandler}
            onHoverLeave={clearProgressHover}
          />
        </>
      ) : (
        <TimePhaseBar
          title="ST (Specialiseringstjänstgöring)"
          workedLabel="Genomförda dagar"
          worked={timeDetails.st.worked}
          total={timeDetails.st.total}
          activities={timeByActivity.st}
          phase="st"
          onHoverEnter={createProgressHoverEnterHandler}
          onHoverLeave={clearProgressHover}
        />
      )}
    </div>
  );
}

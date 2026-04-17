"use client";

export default function StudentProgressDetailModal({
  progressDetailOpen,
  onClose,
  hoveredTimeAct,
  setHoveredTimeAct,
  goalsVersion,
  timeDetails,
  timeByActivity,
  milestoneDetails,
}: {
  progressDetailOpen: "time" | "milestones" | null;
  onClose: () => void;
  hoveredTimeAct: any;
  setHoveredTimeAct: (value: any | null) => void;
  goalsVersion: string;
  timeDetails: any;
  timeByActivity: any;
  milestoneDetails: any;
}) {
  if (!progressDetailOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
      onClick={() => {
        onClose();
        setHoveredTimeAct(null);
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div>
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="m-0 text-lg font-extrabold text-slate-900">{progressDetailOpen === "time" ? "Genomförd tid" : "Delmålsuppfyllelse"}</h2>
            <button
              type="button"
              onClick={() => {
                onClose();
                setHoveredTimeAct(null);
              }}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 hover:border-slate-400 active:translate-y-px"
            >
              Stäng
            </button>
          </header>

          <div className="p-6">
            {progressDetailOpen === "time" ? (
              <div className="space-y-4">
                {hoveredTimeAct && (
                  <div
                    className="fixed px-2 py-1 rounded shadow-lg border text-xs whitespace-nowrap pointer-events-none"
                    style={(() => {
                      const tooltipW = 260;
                      const tooltipH = 78;
                      const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
                      const x = Math.max(8, Math.min(hoveredTimeAct.anchorX - tooltipW / 2, vw - tooltipW - 8));
                      const y = hoveredTimeAct.anchorTop - tooltipH - 10;
                      return {
                        left: x,
                        top: y,
                        width: tooltipW,
                        backgroundColor: `hsl(${hoveredTimeAct.hue} 30% 95%)`,
                        borderColor: `hsl(${hoveredTimeAct.hue} 40% 70%)`,
                        zIndex: 10001,
                      } as any;
                    })()}
                  >
                    <div className="font-semibold text-slate-800">{hoveredTimeAct.label}</div>
                    <div className="text-slate-600">
                      {hoveredTimeAct.startDate} – {hoveredTimeAct.endDate}
                    </div>
                    <div className="text-slate-600">Sysselsättning: {Math.round(hoveredTimeAct.attendance)}%</div>
                    <div className="text-slate-600">Dagar motsv heltid: {Math.round(hoveredTimeAct.days)}</div>
                    <div className="text-slate-600">
                      Del av {hoveredTimeAct.phase === "bt" ? "BT" : "ST"}:{" "}
                      {(
                        hoveredTimeAct.phase === "bt"
                          ? timeDetails.bt.total > 0
                            ? ((hoveredTimeAct.days / timeDetails.bt.total) * 100).toFixed(1).replace(".", ",")
                            : "0"
                          : timeDetails.st.total > 0
                            ? ((hoveredTimeAct.days / timeDetails.st.total) * 100).toFixed(1).replace(".", ",")
                            : "0"
                      )}
                      %
                    </div>
                  </div>
                )}

                {goalsVersion === "2021" ? (
                  <>
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-700">BT (Bastjänstgöring)</span>
                        <span className="text-sm text-slate-600">
                          {timeDetails.bt.total > 0 ? `${((timeDetails.bt.worked / timeDetails.bt.total) * 100).toFixed(0)}%` : "0%"}
                        </span>
                      </div>
                      <div className="h-6 w-full rounded-full bg-slate-200 overflow-hidden flex">
                        {timeByActivity.bt.map((act: any) => {
                          const barWidth = timeDetails.bt.total > 0 ? (act.days / timeDetails.bt.total) * 100 : 0;
                          return (
                            <div
                              key={act.id}
                              className="h-6 transition-[width] duration-300 cursor-pointer"
                              style={{
                                width: `${Math.min(100, barWidth)}%`,
                                backgroundColor: `hsl(${act.hue} 45% 65%)`,
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const anchorX = rect.left + rect.width / 2;
                                const anchorTop = rect.top;
                                setHoveredTimeAct({ ...act, phase: "bt", anchorX, anchorTop });
                              }}
                              onMouseLeave={() => setHoveredTimeAct(null)}
                            />
                          );
                        })}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">Genomförda dagar: {Math.round(timeDetails.bt.worked)} dagar</div>
                      <div className="text-xs text-slate-600">Totalt antal dagar från startdatum till slutdatum: {Math.round(timeDetails.bt.total)} dagar</div>
                    </div>

                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-700">ST (Specialiseringstjänstgöring)</span>
                        <span className="text-sm text-slate-600">
                          {timeDetails.st.total > 0 ? `${((timeDetails.st.worked / timeDetails.st.total) * 100).toFixed(0)}%` : "0%"}
                        </span>
                      </div>
                      <div className="h-6 w-full rounded-full bg-slate-200 overflow-hidden flex">
                        {timeByActivity.st.map((act: any) => {
                          const barWidth = timeDetails.st.total > 0 ? (act.days / timeDetails.st.total) * 100 : 0;
                          return (
                            <div
                              key={act.id}
                              className="h-6 transition-[width] duration-300 cursor-pointer"
                              style={{
                                width: `${Math.min(100, barWidth)}%`,
                                backgroundColor: `hsl(${act.hue} 45% 65%)`,
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const anchorX = rect.left + rect.width / 2;
                                const anchorTop = rect.top;
                                setHoveredTimeAct({ ...act, phase: "st", anchorX, anchorTop });
                              }}
                              onMouseLeave={() => setHoveredTimeAct(null)}
                            />
                          );
                        })}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">Genomförda dagar: {Math.round(timeDetails.st.worked)} dagar</div>
                      <div className="text-xs text-slate-600">Totalt antal dagar från startdatum till slutdatum: {Math.round(timeDetails.st.total)} dagar</div>
                    </div>
                  </>
                ) : (
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-700">ST (Specialiseringstjänstgöring)</span>
                      <span className="text-sm text-slate-600">
                        {timeDetails.st.total > 0 ? `${((timeDetails.st.worked / timeDetails.st.total) * 100).toFixed(0)}%` : "0%"}
                      </span>
                    </div>
                    <div className="h-6 w-full rounded-full bg-slate-200 overflow-hidden flex">
                      {timeByActivity.st.map((act: any) => {
                        const barWidth = timeDetails.st.total > 0 ? (act.days / timeDetails.st.total) * 100 : 0;
                        return (
                          <div
                            key={act.id}
                            className="h-6 transition-[width] duration-300 cursor-pointer"
                            style={{
                              width: `${Math.min(100, barWidth)}%`,
                              backgroundColor: `hsl(${act.hue} 45% 65%)`,
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const anchorX = rect.left + rect.width / 2;
                              const anchorTop = rect.top;
                              setHoveredTimeAct({ ...act, phase: "st", anchorX, anchorTop });
                            }}
                            onMouseLeave={() => setHoveredTimeAct(null)}
                          />
                        );
                      })}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">Genomförda dagar: {Math.round(timeDetails.st.worked)} dagar</div>
                    <div className="text-xs text-slate-600">Totalt antal dagar från startdatum till slutdatum: {Math.round(timeDetails.st.total)} dagar</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {goalsVersion === "2021" ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-700">BT-delmål</span>
                        <span className="text-sm text-slate-600">0%</span>
                      </div>
                      <div className="h-6 w-full rounded-full bg-slate-200">
                        <div className="h-6 rounded-full bg-sky-500 transition-[width] duration-300" style={{ width: "0%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-700">ST-delmål</span>
                        <span className="text-sm text-slate-600">
                          {milestoneDetails.st.total > 0 ? `${((milestoneDetails.st.fulfilled / milestoneDetails.st.total) * 100).toFixed(0)}%` : "0%"}
                        </span>
                      </div>
                      <div className="h-6 w-full rounded-full bg-slate-200">
                        <div
                          className="h-6 rounded-full bg-emerald-500/80 transition-[width] duration-300"
                          style={{
                            width: `${milestoneDetails.st.total > 0 ? Math.min(100, (milestoneDetails.st.fulfilled / milestoneDetails.st.total) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        Utbildningsaktiviteter som uppfyller unika delmål: {String((milestoneDetails as any)?.st?.fulfilledMilestones ?? "").replace(".", ",")} av{" "}
                        {(milestoneDetails as any)?.st?.totalMilestones}
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-700">ST-delmål</span>
                      <span className="text-sm text-slate-600">
                        {milestoneDetails.st.total > 0 ? `${((milestoneDetails.st.fulfilled / milestoneDetails.st.total) * 100).toFixed(0)}%` : "0%"}
                      </span>
                    </div>
                    <div className="h-6 w-full rounded-full bg-slate-200">
                      <div
                        className="h-6 rounded-full bg-emerald-500/80 transition-[width] duration-300"
                        style={{
                          width: `${milestoneDetails.st.total > 0 ? Math.min(100, (milestoneDetails.st.fulfilled / milestoneDetails.st.total) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Utbildningsaktiviteter som uppfyller unika delmål: {String((milestoneDetails as any)?.st?.fulfilledMilestones ?? "").replace(".", ",")} av{" "}
                      {(milestoneDetails as any)?.st?.totalMilestones}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

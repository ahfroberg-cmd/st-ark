"use client";

export default function ColleagueCopyDialogs(props: {
  colleagueMilestoneCopyDialog: any;
  setColleagueMilestoneCopyDialog: (value: any) => void;
  colleagueDescCopyDialog: any;
  setColleagueDescCopyDialog: (value: any) => void;
  colleagueWarningDialog: { show: boolean; message: string };
  setColleagueWarningDialog: (value: { show: boolean; message: string }) => void;
  colleagueActivityDetail: any;
  colleagueFormatDate: (date: string) => string;
  colleagueActivityKind: (item: any) => string;
  colleagueItemTypeLabel: (kind: string) => string;
  colleagueItemDisplayName: (item: any, kind: string) => string;
  colleagueTargetDisplayName: (target: any) => string;
  onApplyMilestones: (target: any, mode: "append" | "replace") => void;
  onApplyDescription: (target: any, mode: "append" | "replace") => void;
}) {
  return (
    <>
      {props.colleagueMilestoneCopyDialog.show && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <header className="border-b px-6 py-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold m-0">Kopiera delmål</h3>
              <button
                onClick={() => props.setColleagueMilestoneCopyDialog({ show: false, type: null })}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              >
                Avbryt
              </button>
            </header>
            <div className="p-6">
              {props.colleagueMilestoneCopyDialog.type === "ask" ? (
                <>
                  <p className="text-slate-700 mb-6">
                    Ingen matchande aktivitet av samma typ hittades med namnet "
                    {props.colleagueActivityDetail?.clinic || props.colleagueActivityDetail?.title}". Vill
                    du kopiera delmål till en annan aktivitet av samma typ?
                  </p>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() =>
                        props.setColleagueMilestoneCopyDialog({
                          show: true,
                          type: "select",
                          placements: props.colleagueMilestoneCopyDialog.placements,
                        })
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
                    >
                      Ja
                    </button>
                  </div>
                </>
              ) : props.colleagueMilestoneCopyDialog.type === "select" ? (
                <>
                  <p className="text-slate-700 mb-4">Välj vilken aktivitet du vill kopiera delmålen till:</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                    {(props.colleagueMilestoneCopyDialog.placements || []).map((item: any) => {
                      const itemKind = props.colleagueActivityKind(item);
                      const typeLabel = props.colleagueItemTypeLabel(itemKind);
                      const displayName = props.colleagueItemDisplayName(item, itemKind);
                      return (
                        <button
                          key={item.id}
                          onClick={() =>
                            props.setColleagueMilestoneCopyDialog({
                              show: true,
                              type: "confirm",
                              selectedPlacement: item,
                            })
                          }
                          className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-50 border border-slate-100"
                        >
                          <p className="font-semibold text-slate-900">{displayName}</p>
                          <p className="text-xs text-slate-500">
                            {typeLabel}
                            {(item.startDate || item.endDate)
                              ? ` · ${props.colleagueFormatDate(item.startDate || item.endDate)}`
                              : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  {(() => {
                    const target = props.colleagueMilestoneCopyDialog.selectedPlacement;
                    const targetName = props.colleagueTargetDisplayName(target);
                    return (
                      <>
                        <p className="text-slate-700 mb-6">
                          Kopierar delmål till <strong>{targetName}</strong>. Hur vill du kopiera delmålen?
                        </p>
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => props.onApplyMilestones(target, "append")}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
                          >
                            Lägg till
                          </button>
                          <button
                            onClick={() => props.onApplyMilestones(target, "replace")}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
                          >
                            Ersätt
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {props.colleagueDescCopyDialog.show && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <header className="border-b px-6 py-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold m-0">Kopiera beskrivning</h3>
              <button
                onClick={() => props.setColleagueDescCopyDialog({ show: false, type: null })}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              >
                Avbryt
              </button>
            </header>
            <div className="p-6">
              {props.colleagueDescCopyDialog.type === "ask" ? (
                <>
                  <p className="text-slate-700 mb-6">
                    Ingen matchande aktivitet av samma typ hittades med namnet "
                    {props.colleagueActivityDetail?.clinic || props.colleagueActivityDetail?.title}". Vill
                    du kopiera beskrivningen till en annan aktivitet av samma typ?
                  </p>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() =>
                        props.setColleagueDescCopyDialog({
                          show: true,
                          type: "select",
                          placements: props.colleagueDescCopyDialog.placements,
                        })
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
                    >
                      Ja
                    </button>
                  </div>
                </>
              ) : props.colleagueDescCopyDialog.type === "select" ? (
                <>
                  <p className="text-slate-700 mb-4">Välj vilken aktivitet du vill kopiera beskrivningen till:</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                    {(props.colleagueDescCopyDialog.placements || []).map((item: any) => {
                      const itemKind = props.colleagueActivityKind(item);
                      const typeLabel = props.colleagueItemTypeLabel(itemKind);
                      const displayName = props.colleagueItemDisplayName(item, itemKind);
                      return (
                        <button
                          key={item.id}
                          onClick={() =>
                            props.setColleagueDescCopyDialog({
                              show: true,
                              type: "confirm",
                              selectedPlacement: item,
                            })
                          }
                          className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-50 border border-slate-100"
                        >
                          <p className="font-semibold text-slate-900">{displayName}</p>
                          <p className="text-xs text-slate-500">
                            {typeLabel}
                            {(item.startDate || item.endDate)
                              ? ` · ${props.colleagueFormatDate(item.startDate || item.endDate)}`
                              : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  {(() => {
                    const target = props.colleagueDescCopyDialog.selectedPlacement;
                    const targetName = props.colleagueTargetDisplayName(target);
                    return (
                      <>
                        <p className="text-slate-700 mb-6">
                          Kopierar beskrivning till <strong>{targetName}</strong>. Hur vill du kopiera?
                        </p>
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => props.onApplyDescription(target, "append")}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
                          >
                            Lägg till
                          </button>
                          <button
                            onClick={() => props.onApplyDescription(target, "replace")}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
                          >
                            Ersätt
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {props.colleagueWarningDialog.show && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <header className="border-b px-6 py-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold m-0">Varning</h3>
              <button
                onClick={() => props.setColleagueWarningDialog({ show: false, message: "" })}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              >
                Stäng
              </button>
            </header>
            <div className="p-6">
              <p className="text-slate-700">{props.colleagueWarningDialog.message}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

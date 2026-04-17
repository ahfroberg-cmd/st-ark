"use client";

import React from "react";

type Props = {
  selAct: any;
  selectedPlacement: any;
  profile: any;
  dirty: boolean;
  isLeave: (type: any) => boolean;
  setActivities: React.Dispatch<React.SetStateAction<any[]>>;
  setBtMilestonePicker: (next: { open: boolean; mode: "placement" | "course" }) => void;
  setMilestonePicker: (next: { open: boolean; mode: "placement" | "course" }) => void;
  sortMilestoneIds: (ids: string[]) => string[];
  displayMilestoneCode: (code: string, goalsVersion: any) => string;
  setBtMilestoneDetail: (id: string | null) => void;
  setStMilestoneDetail: (id: string | null) => void;
  savePlacementToDb: (placement: any) => Promise<boolean>;
  closeDetailPanel: () => void;
  requestDeletePlacement: () => void;
  /** Öppnar modal för intygsgrupp (sammanslaget intyg). */
  onOpenIntygGroup?: () => void;
};

export default function PlacementDetailFooter({
  selAct,
  selectedPlacement,
  profile,
  dirty,
  isLeave,
  setActivities,
  setBtMilestonePicker,
  setMilestonePicker,
  sortMilestoneIds,
  displayMilestoneCode,
  setBtMilestoneDetail,
  setStMilestoneDetail,
  savePlacementToDb,
  closeDetailPanel,
  requestDeletePlacement,
  onOpenIntygGroup,
}: Props) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      {!isLeave(selAct.type) && selAct.type !== "Forskning" ? (
        <>
          {selectedPlacement?.phase === "BT" ? (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(selectedPlacement as any)?.fulfillsStGoals}
                  onChange={(e) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    setActivities((prev) =>
                      prev.map((a) =>
                        a.id === (selectedPlacement as any)?.id ? { ...a, fulfillsStGoals: checked } : a
                      )
                    );
                  }}
                />
                Uppfyller ST-delmål
              </label>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
                    onClick={() => setBtMilestonePicker({ open: true, mode: "placement" })}
                    data-info="Öppnar en lista där du kan välja vilka BT-delmål (bastjänstgöring) som uppfylls av denna aktivitet. BT-delmål är specifika för bastjänstgöringen."
                  >
                    BT-delmål
                  </button>

                  <div className="flex items-center gap-1 flex-wrap">
                    {(selectedPlacement as any)?.btMilestones?.length > 0 ? (
                      sortMilestoneIds(((selectedPlacement as any).btMilestones || []) as string[]).map((m: string) => (
                        <button
                          key={`bt-${m}`}
                          type="button"
                          onClick={() => setBtMilestoneDetail(m)}
                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
                        >
                          {displayMilestoneCode(
                            String(m).trim().split(/\s|–|-|:|\u2013/)[0],
                            (profile as any)?.goalsVersion
                          )}
                        </button>
                      ))
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </div>
                </div>

                {(selectedPlacement as any)?.fulfillsStGoals && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
                      onClick={() => setMilestonePicker({ open: true, mode: "placement" })}
                      data-info="Öppnar en lista där du kan välja vilka ST-delmål (specialiseringstjänstgöring) som uppfylls av denna aktivitet. ST-delmål är de mål som ska uppfyllas under din ST-utbildning."
                    >
                      ST-delmål
                    </button>
                    <div className="flex items-center gap-1 flex-wrap">
                      {(selectedPlacement as any)?.milestones?.length > 0 ? (
                        sortMilestoneIds(((selectedPlacement as any).milestones || []) as string[]).map((m: string) => (
                          <button
                            key={`st-${m}`}
                            type="button"
                            onClick={() => setStMilestoneDetail(m)}
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
                          >
                            {displayMilestoneCode(String(m).trim(), (profile as any)?.goalsVersion)}
                          </button>
                        ))
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
                onClick={() => setMilestonePicker({ open: true, mode: "placement" })}
                data-info="Delmål"
              >
                Delmål
              </button>
              <div className="flex items-center gap-1 flex-wrap">
                {selectedPlacement?.id && (selectedPlacement as any)?.milestones?.length > 0 ? (
                  sortMilestoneIds(((selectedPlacement as any).milestones || []) as string[]).map((m: string) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setStMilestoneDetail(m)}
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-pointer hover:bg-slate-100 transition"
                    >
                      {displayMilestoneCode(String(m).trim(), (profile as any)?.goalsVersion)}
                    </button>
                  ))
                ) : (
                  <span className="text-slate-400 text-sm">—</span>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-2">
        {onOpenIntygGroup ? (
          <button
            type="button"
            onClick={onOpenIntygGroup}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
            title="Redigera intygsgrupp"
            data-info="Intygsgrupp"
          >
            Intygsgrupp
          </button>
        ) : null}

        <button
          disabled={!dirty}
          onClick={async () => {
            if (!dirty) return;
            await savePlacementToDb(selAct);
          }}
          className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
          data-info="Spara"
        >
          Spara
        </button>

        <button
          onClick={closeDetailPanel}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
          title="Stäng panelen"
          data-info="Stäng"
        >
          Stäng
        </button>

        <button
          onClick={() => {
            requestDeletePlacement();
          }}
          className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 transition hover:border-red-400 hover:bg-red-200 active:translate-y-px"
          title="Ta bort vald aktivitet"
          data-info="Ta bort"
        >
          Ta bort
        </button>
      </div>
    </div>
  );
}

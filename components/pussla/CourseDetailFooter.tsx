"use client";

import React from "react";

type Props = {
  selectedCourse: any;
  profile: any;
  dirty: boolean;
  setCourses: React.Dispatch<React.SetStateAction<any[]>>;
  setBtMilestonePicker: (next: { open: boolean; mode: "placement" | "course" }) => void;
  setMilestonePicker: (next: { open: boolean; mode: "placement" | "course" }) => void;
  sortMilestoneIds: (ids: string[]) => string[];
  displayMilestoneCode: (code: string, goalsVersion: any) => string;
  setBtMilestoneDetail: (id: string | null) => void;
  setStMilestoneDetail: (id: string | null) => void;
  saveCourseToDb: (course: any) => Promise<boolean>;
  closeDetailPanel: () => void;
  requestDeleteCourse: () => void;
};

export default function CourseDetailFooter({
  selectedCourse,
  profile,
  dirty,
  setCourses,
  setBtMilestonePicker,
  setMilestonePicker,
  sortMilestoneIds,
  displayMilestoneCode,
  setBtMilestoneDetail,
  setStMilestoneDetail,
  saveCourseToDb,
  closeDetailPanel,
  requestDeleteCourse,
}: Props) {
  if (!selectedCourse) return null;

  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <div className="flex flex-col gap-2">
        {selectedCourse?.phase === "BT" ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!(selectedCourse as any)?.fulfillsStGoals}
                onChange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  setCourses((prev) =>
                    prev.map((c) =>
                      c.id === (selectedCourse as any)?.id ? { ...c, fulfillsStGoals: checked } : c
                    )
                  );
                }}
              />
              Uppfyller ST-delmål
            </label>

            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
                onClick={() => setBtMilestonePicker({ open: true, mode: "course" })}
                data-info="BT-delmål"
              >
                BT-delmål
              </button>

              <div className="flex items-center gap-1 flex-wrap">
                {(selectedCourse as any)?.btMilestones?.length > 0 ? (
                  sortMilestoneIds(((selectedCourse as any).btMilestones || []) as string[]).map((m: string) => (
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

            {(selectedCourse as any)?.fulfillsStGoals && (
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
                  onClick={() => setMilestonePicker({ open: true, mode: "course" })}
                  data-info="ST-delmål"
                >
                  ST-delmål
                </button>

                <div className="flex items-center gap-1 flex-wrap">
                  {(selectedCourse as any)?.milestones?.length > 0 ? (
                    sortMilestoneIds(((selectedCourse as any).milestones || []) as string[]).map((m: string) => (
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
          </>
        ) : (
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 hover:border-slate-400 active:translate-y-px"
              onClick={() => setMilestonePicker({ open: true, mode: "course" })}
              data-info="Delmål"
            >
              Delmål
            </button>

            <div className="flex items-center gap-1 flex-wrap">
              {(selectedCourse as any)?.milestones?.length > 0 ? (
                sortMilestoneIds(((selectedCourse as any).milestones || []) as string[]).map((m: string) => (
                  <span key={`st-${m}`} className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                    {displayMilestoneCode(String(m).trim(), (profile as any)?.goalsVersion)}
                  </span>
                ))
              ) : (
                <span className="text-slate-400 text-sm">—</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={!dirty}
          onClick={async () => {
            if (!dirty) return;
            await saveCourseToDb(selectedCourse);
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
            requestDeleteCourse();
          }}
          className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 transition hover:border-red-400 hover:bg-red-200 active:translate-y-px"
          title="Ta bort vald kurs"
          data-info="Ta bort"
        >
          Ta bort
        </button>
      </div>
    </div>
  );
}

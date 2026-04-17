"use client";

import CalendarDatePicker from "@/components/CalendarDatePicker";
import { LabeledInputLocal } from "@/components/prepareBt/InputFields";
import type { ForeignOrPrelicenseRow } from "@/components/prepareBt/modalTypes";

type IntygModalState = {
  mode: "prelicense" | "foreign" | null;
  rowId?: string;
};

type IntygGoalsPickerState = {
  open: boolean;
  mode: "prelicense" | "foreign" | null;
  rowId?: string;
};

type Props = {
  state: IntygModalState;
  prelicenseRows: ForeignOrPrelicenseRow[];
  foreignRows: ForeignOrPrelicenseRow[];
  setPrelicenseRows: React.Dispatch<React.SetStateAction<ForeignOrPrelicenseRow[]>>;
  setForeignRows: React.Dispatch<React.SetStateAction<ForeignOrPrelicenseRow[]>>;
  defaultIntyg: () => NonNullable<ForeignOrPrelicenseRow["intyg"]>;
  updateDirty: () => void;
  onClose: () => void;
  setIntygGoalsPicker: React.Dispatch<React.SetStateAction<IntygGoalsPickerState>>;
};

export function IntygDetailsModal({
  state,
  prelicenseRows,
  foreignRows,
  setPrelicenseRows,
  setForeignRows,
  defaultIntyg,
  updateDirty,
  onClose,
  setIntygGoalsPicker,
}: Props) {
  const { mode, rowId } = state;
  if (!mode) return null;

  const rows = mode === "prelicense" ? prelicenseRows : foreignRows;
  const setRows = mode === "prelicense" ? setPrelicenseRows : setForeignRows;
  const row = rows.find((r) => r.id === rowId);
  if (!row) return null;

  const canSave =
    (row.intyg?.clinic || "").trim().length > 0 ||
    (row.intyg?.supervisor || "").trim().length > 0 ||
    (row.intyg?.goals?.length || 0) > 0 ||
    !!row.intyg?.startISO ||
    !!row.intyg?.endISO ||
    (row.intyg?.controlHow || "").trim().length > 0 ||
    (row.intyg?.percent ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/40 p-3">
      <div className="w-full max-w-[820px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="m-0 text-base font-extrabold">
            {mode === "prelicense" ? "Intyg – Tjänstgöring före legitimation" : "Intyg – Utländsk tjänstgöring"}
          </h3>
          <div className="flex items-center gap-2">
            <button
              disabled={!canSave}
              onClick={() => {
                setRows((all) => all.map((r) => (r.id === row.id ? { ...r } : r)));
                updateDirty();
              }}
              className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
            >
              Spara
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            >
              Stäng
            </button>
          </div>
        </header>

        <section className="max-h-[70vh] overflow-auto p-4">
          <div className="grid grid-cols-1 gap-3">
            <LabeledInputLocal
              label="Klinisk tjänstgöring"
              value={row.intyg?.clinic || ""}
              onCommit={(v) =>
                setRows((all) =>
                  all.map((r) =>
                    r.id === row.id ? { ...r, intyg: { ...(r.intyg ?? defaultIntyg()), clinic: v } } : r
                  )
                )
              }
            />
            <div className="grid grid-cols-[1fr_220px] gap-2">
              <div />
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <div className="w-full">
                  <label className="mb-1 block text-sm text-slate-700">Start</label>
                  <CalendarDatePicker
                    value={row.intyg?.startISO || ""}
                    onChange={(iso) =>
                      setRows((all) =>
                        all.map((r) =>
                          r.id === row.id ? { ...r, intyg: { ...(r.intyg ?? defaultIntyg()), startISO: iso || null } } : r
                        )
                      )
                    }
                    align="right"
                    className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                  />
                </div>
                <div className="w-full">
                  <label className="mb-1 block text-sm text-slate-700">Slut</label>
                  <CalendarDatePicker
                    value={row.intyg?.endISO || ""}
                    onChange={(iso) =>
                      setRows((all) =>
                        all.map((r) =>
                          r.id === row.id ? { ...r, intyg: { ...(r.intyg ?? defaultIntyg()), endISO: iso || null } } : r
                        )
                      )
                    }
                    align="right"
                    className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_140px] items-end gap-2">
              <LabeledInputLocal
                label="Handledare"
                value={row.intyg?.supervisor || ""}
                onCommit={(v) =>
                  setRows((all) =>
                    all.map((r) =>
                      r.id === row.id ? { ...r, intyg: { ...(r.intyg ?? defaultIntyg()), supervisor: v } } : r
                    )
                  )
                }
              />
              <div>
                <label className="mb-1 block text-sm text-slate-700">Syss.%</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={row.intyg?.percent ?? 100}
                  onChange={(e) =>
                    setRows((all) =>
                      all.map((r) =>
                        r.id === row.id
                          ? {
                              ...r,
                              intyg: {
                                ...(r.intyg ?? defaultIntyg()),
                                percent: Math.max(1, Math.min(100, Number(e.target.value) || 0)),
                              },
                            }
                          : r
                      )
                    )
                  }
                  className="h-[40px] w-[140px] rounded-lg border border-slate-300 bg-white px-3 text-[14px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <LabeledInputLocal
                label="Handledares specialitet"
                value={row.intyg?.supervisorSpec || ""}
                onCommit={(v) =>
                  setRows((all) =>
                    all.map((r) =>
                      r.id === row.id ? { ...r, intyg: { ...(r.intyg ?? defaultIntyg()), supervisorSpec: v } } : r
                    )
                  )
                }
              />
              <LabeledInputLocal
                label="Handledares tjänsteställe"
                value={row.intyg?.supervisorWorkplace || ""}
                onCommit={(v) =>
                  setRows((all) =>
                    all.map((r) =>
                      r.id === row.id
                        ? { ...r, intyg: { ...(r.intyg ?? defaultIntyg()), supervisorWorkplace: v } }
                        : r
                    )
                  )
                }
              />
              <div className="self-end">
                <button
                  type="button"
                  onClick={() =>
                    setRows((all) =>
                      all.map((r) =>
                        r.id === row.id ? { ...r, intyg: { ...(r.intyg ?? defaultIntyg()), goals: r.intyg?.goals ?? [] } } : r
                      )
                    )
                  }
                  className="h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"
                  onClickCapture={() => setIntygGoalsPicker({ open: true, mode, rowId: row.id })}
                >
                  Delmål
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Hur det kontrollerats att delmålen uppnåtts</label>
              <textarea
                value={row.intyg?.controlHow || ""}
                onChange={(e) =>
                  setRows((all) =>
                    all.map((r) =>
                      r.id === row.id
                        ? { ...r, intyg: { ...(r.intyg ?? defaultIntyg()), controlHow: e.target.value } }
                        : r
                    )
                  )
                }
                rows={5}
                className="w-full rounded-lg border border-slate-300 p-3 text-[14px]"
              />
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t px-4 py-3">
          <button
            onClick={() => {
              alert("Skriv ut intyg (kommer att generera PDF)");
            }}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          >
            Skriv ut intyg
          </button>
          <div className="flex items-center gap-2">
            <button
              disabled={!canSave}
              onClick={() => {
                updateDirty();
                onClose();
              }}
              className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none"
            >
              Spara
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            >
              Stäng
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

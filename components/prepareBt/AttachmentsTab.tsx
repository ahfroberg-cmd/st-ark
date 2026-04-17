"use client";

import React from "react";
import { LabeledInputLocal } from "@/components/prepareBt/InputFields";
import { colorsForBt, normalizeAndSortAttachments } from "@/components/prepareBt/attachmentsUtils";
import type { AttachKey, ForeignOrPrelicenseRow } from "@/components/prepareBt/modalTypes";

type SavedCert = {
  goals: any[];
  activities: any[];
  controlHow: string;
  signer: {
    useOther: boolean;
    name: string;
    specialty: string;
    workplace: string;
  };
};

type Props = {
  tempOrder: AttachKey[];
  dragActive: boolean;
  dragIndex: number | null;
  listRef: React.RefObject<HTMLDivElement | null>;
  rowRefs: React.RefObject<(HTMLDivElement | null)[]>;
  onPointerMoveList: (e: React.PointerEvent) => void;
  onPointerUpList: () => void;
  onPointerDownCard: (idx: number, e: React.PointerEvent) => void;
  btPlacements: any[];
  btAttachChecked: Record<string, boolean>;
  setBtAttachChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  attachments: AttachKey[];
  setAttachments: React.Dispatch<React.SetStateAction<AttachKey[]>>;
  btSavedCerts: Record<string, SavedCert>;
  onEditSavedCert: (key: string) => void;
  onPreviewSavedCert: (key: string) => Promise<void>;
  onDeleteSavedCert: (key: string) => Promise<void>;
  onPreviewPlacement: (placement: any) => Promise<void>;
  prelicenseEnabled: boolean;
  setPrelicenseEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  prelicenseCount: number;
  prelicenseCountDraft: number;
  setPrelicenseCountDraft: React.Dispatch<React.SetStateAction<number>>;
  setPrelicenseCount: React.Dispatch<React.SetStateAction<number>>;
  setPrelicenseRows: React.Dispatch<React.SetStateAction<ForeignOrPrelicenseRow[]>>;
  syncPrelicenseAttachments: (count: number, enabled: boolean) => void;
  foreignEnabled: boolean;
  setForeignEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  foreignRows: ForeignOrPrelicenseRow[];
  setForeignRows: React.Dispatch<React.SetStateAction<ForeignOrPrelicenseRow[]>>;
  makeId: () => string;
};

export function AttachmentsTab({
  tempOrder,
  dragActive,
  dragIndex,
  listRef,
  rowRefs,
  onPointerMoveList,
  onPointerUpList,
  onPointerDownCard,
  btPlacements,
  btAttachChecked,
  setBtAttachChecked,
  attachments,
  setAttachments,
  btSavedCerts,
  onEditSavedCert,
  onPreviewSavedCert,
  onDeleteSavedCert,
  onPreviewPlacement,
  prelicenseEnabled,
  setPrelicenseEnabled,
  prelicenseCount,
  prelicenseCountDraft,
  setPrelicenseCountDraft,
  setPrelicenseCount,
  setPrelicenseRows,
  syncPrelicenseAttachments,
  foreignEnabled,
  setForeignEnabled,
  foreignRows,
  setForeignRows,
  makeId,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-lg border border-slate-200">
        <div className="grid grid-cols-[48px_1fr] items-center border-b bg-slate-50 px-3 py-2">
          <div className="pl-1 text-sm font-extrabold text-slate-800">#</div>
          <h3 className="m-0 text-sm font-extrabold">Bilagor – dra för att ändra ordning</h3>
        </div>

        <div ref={listRef} onPointerMove={onPointerMoveList} onPointerUp={onPointerUpList} className="p-2 bg-white">
          {tempOrder.map((key, idx) => {
            const raw = String(key);
            const hasTitle = raw.includes(":");
            const kind = hasTitle ? (raw.split(":")[0].trim() as AttachKey) : (raw as AttachKey);
            const title = hasTitle ? raw.split(":").slice(1).join(":").trim() : "";

            return (
              <div
                key={`${key}-${idx}`}
                ref={(el) => {
                  rowRefs.current[idx] = el;
                }}
                className="mb-1 grid grid-cols-[48px_1fr] gap-2"
              >
                <div className="flex items-center justify-center">
                  <div className="select-none rounded-md bg-slate-100 px-2 py-[1px] text-[11px] font-bold text-slate-700 tabular-nums">
                    {idx + 1}.
                  </div>
                </div>

                <div
                  role="button"
                  onPointerDown={(e) => onPointerDownCard(idx, e)}
                  className={`rounded-md border px-3 py-2 ${dragIndex === idx ? "ring-2 ring-sky-300" : ""}`}
                  data-info={`${kind} - ${title || kind}. Kan flyttas för att ändra ordning.`}
                  style={{
                    cursor: (dragActive ? "grabbing" : "grab") as any,
                    ...(() => {
                      const { cardBg, cardBd } = colorsForBt(kind);
                      return { backgroundColor: cardBg, borderColor: cardBd };
                    })(),
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="select-none text-slate-500 leading-none">≡</div>
                    <span
                      className="shrink-0 rounded-md border px-1.5 py-[1px] text-[11px] font-semibold text-slate-700 select-none"
                      style={(() => {
                        const { pillBg, pillBd } = colorsForBt(kind);
                        return { backgroundColor: pillBg, borderColor: pillBd };
                      })()}
                    >
                      {kind}
                    </span>
                    <span className="min-w-0 grow truncate text-[13px] font-medium text-slate-900 select-none">
                      {title || kind}
                    </span>
                    <span className="ml-auto shrink-0 tabular-nums text-[12px] text-slate-700/80 select-none">—</span>
                  </div>
                </div>
              </div>
            );
          })}

          {tempOrder.length === 0 && !dragActive && (
            <div className="rounded-xl border border-dashed p-6 text-center text-slate-500">Inga bilagor.</div>
          )}
        </div>
      </div>

      <div
        className="rounded-lg border border-slate-200 p-3"
        data-info="Här kan du välja vilka bilagor som ska inkluderas i ansökan om intyg om godkänd BT. Du kan välja bland registrerade utbildningsmoment (kliniska tjänstgöringar) och sparade intyg från fliken 'Skapa intyg: Delmål i BT'. När du kryssar i en bilaga läggs den automatiskt till i listan här ovan där du kan ändra ordningen genom att dra och släppa. Bilagorna kommer att inkluderas i ansökan när du genererar 'Ansökan om intyg om godkänd BT'."
      >
        <div className="mb-2 text-sm font-extrabold">Inkludera bilagor</div>

        <div className="mb-4">
          <div className="mb-1 text-[13px] font-semibold text-slate-800">Registrerade utbildningsmoment</div>
          <div className="space-y-1">
            {[...btPlacements]
              .sort(
                (a, b) =>
                  new Date((a as any).endDate || (a as any).startDate || 0).getTime() -
                  new Date((b as any).endDate || (b as any).startDate || 0).getTime()
              )
              .map((pl) => {
                const label =
                  `Delmål i bastjänstgöringen: Klinisk tjänstgöring — ` +
                  String((pl as any).clinic || (pl as any).note || "Klinisk tjänstgöring");
                const checked = !!btAttachChecked[pl.id];

                return (
                  <div key={pl.id} className="flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const on = e.currentTarget.checked;
                        setBtAttachChecked((st) => ({ ...st, [pl.id]: on }));
                        setAttachments((list) => {
                          const base = list.filter((x) => String(x) !== label);
                          const next = on ? [...base, label as AttachKey] : (base as AttachKey[]);
                          return normalizeAndSortAttachments(next, btPlacements);
                        });
                      }}
                    />
                    <span className="min-w-0 grow truncate">
                      {(pl as any).clinic || (pl as any).note || "Klinisk tjänstgöring"}
                      {pl.startDate || pl.endDate ? (
                        <span className="text-slate-500">
                          {" "}
                          — {(pl.startDate || "").slice(0, 10)} – {(pl.endDate || pl.startDate || "").slice(0, 10)}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border px-2 py-1 text-[12px] hover:bg-slate-50"
                      title="Öppna förhandsvisning av intyg för detta moment"
                      data-info="Genererar och visar en förhandsvisning av intyget för denna registrerade kliniska tjänstgöring. Intyget innehåller aktivitetens information och de BT-delmål som är kopplade till den."
                      onClick={async () => {
                        await onPreviewPlacement(pl);
                      }}
                    >
                      Intyg
                    </button>
                  </div>
                );
              })}
            {btPlacements.length === 0 && (
              <div className="text-[13px] text-slate-500">Inga BT-tjänstgöringar hittades.</div>
            )}
          </div>
        </div>

        <hr className="my-3" />

        <div className="mb-4">
          <div className="mb-1 text-[13px] font-semibold text-slate-800">Sparade intyg (från fliken "Delmål i ST")</div>
          <div className="space-y-1">
            {Object.keys(btSavedCerts).length === 0 && (
              <div className="text-[13px] text-slate-500">Inga sparade intyg.</div>
            )}

            {Object.keys(btSavedCerts)
              .sort((a, b) => {
                const na = Number(String(a).split(" ").pop());
                const nb = Number(String(b).split(" ").pop());
                if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
                return String(a).localeCompare(String(b));
              })
              .map((key) => {
                const isChecked = attachments.some((x) => String(x) === key);
                return (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const on = e.currentTarget.checked;
                        setAttachments((list) => {
                          const base = list.filter((x) => String(x) !== key);
                          const next = on ? [...base, key as AttachKey] : (base as AttachKey[]);
                          return normalizeAndSortAttachments(next, btPlacements);
                        });
                      }}
                      title="Visa detta intyg som bilaga i listan ovan"
                    />
                    <span className="min-w-0 grow truncate text-[13px]">{key}</span>

                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-[12px] hover:bg-slate-50"
                        title="Öppna och fyll i fliken ”Delmål i BT” med intygets sparade uppgifter"
                        data-info="Öppnar fliken 'Skapa intyg: Delmål i BT' och fyller i formuläret med detta sparade intygs uppgifter så att du kan redigera dem. När du sparar kommer ändringarna att uppdatera detta intyg."
                        onClick={() => onEditSavedCert(key)}
                      >
                        Ändra
                      </button>

                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-[12px] hover:bg-slate-50"
                        title="Öppna förhandsvisning av intyget"
                        data-info="Genererar och öppnar en förhandsvisning av detta sparade intyg som PDF. Du kan granska intyget innan det används i ansökan."
                        onClick={async () => {
                          await onPreviewSavedCert(key);
                        }}
                      >
                        Intyg
                      </button>

                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-[12px] hover:bg-slate-50"
                        title="Ta bort intyget"
                        onClick={async () => {
                          await onDeleteSavedCert(key);
                        }}
                      >
                        X
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <hr className="my-3" />

        <div
          className="mb-2"
          data-info="Här kan du inkludera intyg för tjänstgöring som genomförts före legitimation. Kryssa i rutan för att aktivera funktionen. Ange sedan antal bilagor (intyg) som behövs i nummerfältet och klicka på OK för att bekräfta. Detta skapar motsvarande antal bilagor i listan här ovan som du kan redigera genom att klicka på dem. Varje bilaga kan innehålla information om tjänstgöringens plats, period, handledare och hur delmål har kontrollerats. Bilagorna kommer att inkluderas i ansökan om intyg om godkänd BT."
        >
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={prelicenseEnabled}
                onChange={(e) => {
                  const on = e.currentTarget.checked;
                  setPrelicenseEnabled(on);
                  setPrelicenseCountDraft((n) => Math.max(1, n || 1));

                  if (on) {
                    setPrelicenseRows((rows) => {
                      if (rows.length >= prelicenseCount) return rows;
                      const need = prelicenseCount - rows.length;
                      const add = Array.from({ length: need }, () => ({
                        id: makeId(),
                        title: "",
                        intyg: {
                          clinic: "",
                          startISO: null,
                          endISO: null,
                          percent: 100,
                          supervisor: "",
                          supervisorSpec: "",
                          supervisorWorkplace: "",
                          controlHow: "",
                          goals: [],
                        },
                      }));
                      return [...rows, ...add];
                    });
                  } else {
                    setPrelicenseRows([]);
                  }

                  syncPrelicenseAttachments(prelicenseCount, on);
                }}
              />
              <span>Tjänstgöring före legitimation</span>
            </label>

            <div className="ml-2 flex items-center gap-2">
              <span className="text-[13px] leading-none">Antal:</span>
              <input
                type="number"
                min={1}
                step={1}
                value={prelicenseCountDraft}
                onChange={(e) => {
                  const n = Math.max(1, Number(e.currentTarget.value) || 1);
                  setPrelicenseCountDraft(n);
                }}
                className={`h-[28px] w-[56px] rounded-md border px-2 text-[13px] ${
                  prelicenseEnabled
                    ? "border-slate-300 bg-white text-slate-900"
                    : "border-slate-200 bg-slate-100 text-slate-400"
                }`}
                disabled={!prelicenseEnabled}
                inputMode="numeric"
                pattern="[0-9]*"
                title={prelicenseEnabled ? "" : "Aktivera rutan till vänster för att ändra antal"}
              />

              <button
                type="button"
                disabled={!prelicenseEnabled}
                onClick={() => {
                  const n = Math.max(1, prelicenseCountDraft || 1);
                  setPrelicenseCount(n);

                  setPrelicenseRows((rows) => {
                    if (!prelicenseEnabled) return rows;
                    if (rows.length === n) return rows;
                    if (rows.length < n) {
                      const add = Array.from({ length: n - rows.length }, () => ({
                        id: makeId(),
                        title: "",
                        intyg: {
                          clinic: "",
                          startISO: null,
                          endISO: null,
                          percent: 100,
                          supervisor: "",
                          supervisorSpec: "",
                          supervisorWorkplace: "",
                          controlHow: "",
                          goals: [],
                        },
                      }));
                      return [...rows, ...add];
                    }
                    return rows.slice(0, n);
                  });

                  syncPrelicenseAttachments(n, prelicenseEnabled);
                }}
                className={`h-[28px] rounded-md border px-2 text-[12px] ${
                  !prelicenseEnabled
                    ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                }`}
                title="Bekräfta antal"
                data-info="Bekräftar antalet bilagor för tjänstgöring före legitimation. När du klickar på OK skapas motsvarande antal bilagor i listan till vänster som du kan redigera."
              >
                OK
              </button>
            </div>
          </div>
        </div>

        <div className="mb-2">
          <label className="inline-flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={foreignEnabled}
              onChange={(e) => {
                const on = e.currentTarget.checked;
                setForeignEnabled(on);
                if (on) {
                  setForeignRows((rows) =>
                    rows.length
                      ? rows
                      : [
                          {
                            id: makeId(),
                            title: "",
                            intyg: {
                              clinic: "",
                              startISO: null,
                              endISO: null,
                              percent: 100,
                              supervisor: "",
                              supervisorSpec: "",
                              supervisorWorkplace: "",
                              controlHow: "",
                              goals: [],
                            },
                          },
                        ]
                  );
                  setAttachments((list) => {
                    const rest = list.filter((x) => !String(x).startsWith("Utländsk tjänstgöring:"));
                    const next = ["Utländsk tjänstgöring: " as AttachKey, ...(rest as AttachKey[])];
                    return normalizeAndSortAttachments(next, btPlacements);
                  });
                } else {
                  setAttachments((list) =>
                    normalizeAndSortAttachments(
                      list.filter((x) => !String(x).startsWith("Utländsk tjänstgöring:")),
                      btPlacements
                    )
                  );
                  setForeignRows([]);
                }
              }}
            />
            <span>Utländsk tjänstgöring</span>
          </label>

          {foreignEnabled && (
            <div className="mt-2 rounded-lg border border-slate-200 p-3">
              {foreignRows.map((r, idx) => (
                <div key={r.id} className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                  <LabeledInputLocal
                    label="Titel på utländsk tjänstgöring"
                    value={r.title || ""}
                    onCommit={(v) => {
                      setForeignRows((rows) => rows.map((x) => (x.id === r.id ? { ...x, title: v } : x)));
                      setAttachments((list) => {
                        const rest = list.filter((x) => !String(x).startsWith("Utländsk tjänstgöring:"));
                        const titles = foreignRows.map((x) => (x.id === r.id ? v || "" : x.title || ""));
                        const next = [...rest, ...titles.map((t) => `Utländsk tjänstgöring: ${t}` as AttachKey)];
                        return normalizeAndSortAttachments(next, btPlacements);
                      });
                    }}
                  />

                  {idx > 0 ? (
                    <button
                      className="h-[40px] w-[40px] rounded-lg border border-slate-300 bg-white text-lg leading-none hover:bg-slate-100"
                      onClick={() => {
                        setForeignRows((rows) => rows.filter((x) => x.id !== r.id));
                        setAttachments((list) => list.filter((x) => x !== `Utländsk tjänstgöring: ${r.title || ""}`));
                      }}
                      title="Ta bort"
                    >
                      –
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              ))}

              <div className="mt-2">
                <button
                  className="mt-1 h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"
                  onClick={() => {
                    const newRow = { id: makeId(), title: "" };
                    setForeignRows((rows) => [...rows, newRow as ForeignOrPrelicenseRow]);
                    setAttachments((list) => {
                      const rest = list.filter((x) => !String(x).startsWith("Utländsk tjänstgöring:"));
                      const next = [
                        ...rest,
                        ...[...foreignRows, newRow].map((x) => `Utländsk tjänstgöring: ${x.title || ""}` as AttachKey),
                      ];
                      return normalizeAndSortAttachments(next, btPlacements);
                    });
                  }}
                >
                  Lägg till
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

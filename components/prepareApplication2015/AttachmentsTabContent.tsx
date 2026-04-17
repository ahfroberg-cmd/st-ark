"use client";

import { Fragment } from "react";
import CalendarDatePicker from "@/components/CalendarDatePicker";
import type { AttachGroup, AttachmentItem, PresetKey } from "@/components/prepareApplication2015/attachmentsDomain";

type Props = {
  tempOrder: AttachmentItem[];
  listRef: React.RefObject<HTMLDivElement | null>;
  rowRefs: React.RefObject<(HTMLDivElement | null)[]>;
  onPointerMoveList: (e: React.PointerEvent) => void;
  onPointerUpList: () => void;
  onPointerDownCard: (idx: number, e: React.PointerEvent) => void;
  dragIndex: number | null;
  dragActive: boolean;
  getBilagaName: (type: AttachGroup) => string;
  formatAttachmentLabel: (item: AttachmentItem) => string;
  colorsFor: (type: AttachGroup) => { cardBg: string; cardBd: string; pillBg: string; pillBd: string };
  presetChecked: Record<PresetKey, boolean>;
  togglePreset: (key: PresetKey) => void;
  presetDates: Record<PresetKey, string>;
  updatePresetDate: (key: PresetKey, dateISO: string) => void;
  profile: any;
  paidFeeDate: string;
  setPaidFeeDate: React.Dispatch<React.SetStateAction<string>>;
};

export function AttachmentsTabContent({
  tempOrder,
  listRef,
  rowRefs,
  onPointerMoveList,
  onPointerUpList,
  onPointerDownCard,
  dragIndex,
  dragActive,
  getBilagaName,
  formatAttachmentLabel,
  colorsFor,
  presetChecked,
  togglePreset,
  presetDates,
  updatePresetDate,
  profile,
  paidFeeDate,
  setPaidFeeDate,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-lg border border-slate-200">
        <div className="grid grid-cols-[48px_1fr] items-center border-b bg-slate-50 px-3 py-2">
          <div className="pl-1 text-sm font-extrabold text-slate-800">#</div>
          <h3 className="m-0 text-sm font-extrabold">Bilagor – dra för att ändra ordning</h3>
        </div>

        <div ref={listRef} onPointerMove={onPointerMoveList} onPointerUp={onPointerUpList} className="p-2 bg-white">
          {tempOrder.map((a, idx) => (
            <Fragment key={a.id}>
              <div
                ref={(el: HTMLDivElement | null) => {
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
                  onPointerDown={(e) => onPointerDownCard(idx, e)}
                  className={`rounded-xl border p-1.5 shadow-sm transition-all select-none ${
                    dragIndex === idx && dragActive
                      ? "cursor-grabbing bg-white/60 ring-2 ring-sky-400 shadow-md z-20 relative"
                      : "cursor-grab hover:shadow-md"
                  }`}
                  role="button"
                  aria-grabbed={dragIndex === idx && dragActive}
                  title="Dra för att flytta"
                  data-info={`${getBilagaName(a.type) || a.type} - ${formatAttachmentLabel(a)}. Kan flyttas för att ändra ordning.`}
                  style={{
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    touchAction: (dragActive ? "none" : "auto") as any,
                    ...(() => {
                      const c = colorsFor(a.type);
                      return { backgroundColor: c.cardBg, borderColor: c.cardBd };
                    })(),
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="select-none text-slate-500 leading-none">≡</div>
                    <span
                      className="shrink-0 rounded-md border px-1.5 py-[1px] text-[11px] font-semibold text-slate-700 select-none"
                      style={(() => {
                        const c = colorsFor(a.type);
                        return { backgroundColor: c.pillBg, borderColor: c.pillBd };
                      })()}
                    >
                      {getBilagaName(a.type) || a.type}
                    </span>
                    <span className="min-w-0 grow truncate text-[13px] font-medium text-slate-900 select-none">
                      {formatAttachmentLabel(a)}
                    </span>
                    <span className="ml-auto shrink-0 tabular-nums text-[12px] text-slate-700/80 select-none">
                      {a.date || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </Fragment>
          ))}

          {tempOrder.length === 0 && !dragActive && (
            <div className="rounded-xl border border-dashed p-6 text-center text-slate-500">Inga bilagor.</div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-2 text-sm font-extrabold">Lägg till bilaga</div>

        <div className="mb-2 grid grid-cols-[minmax(0,1fr)_220px] items-center gap-2">
          <label
            className="inline-flex items-center gap-2 text-[13px]"
            data-info="Intyg om uppnådd specialistkompetens. Detta är huvudintyget som bekräftar att du har uppnått alla delmål och kompetenser som krävs för specialistkompetens enligt SOSFS 2015:8. Intyget inkluderas som bilaga i ansökan."
          >
            <input type="checkbox" checked={presetChecked.intyg} onChange={() => togglePreset("intyg")} />
            <span>Intyg om uppnådd specialistkompetens</span>
          </label>
          <div className="w-[220px]">
            <CalendarDatePicker
              value={presetDates.intyg}
              onChange={(iso) => updatePresetDate("intyg", iso)}
              align="right"
              className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
            />
          </div>
        </div>

        {profile?.isThirdCountrySpecialist && (
          <div className="mb-2 grid grid-cols-[minmax(0,1fr)_220px] items-center gap-2">
            <label
              className="inline-flex items-center gap-2 text-[13px]"
              data-info="Uppfyllda kompetenskrav för specialistläkare från tredjeland. Detta intyg bekräftar att du har uppfyllt de kompetenskrav som krävs för specialistläkare från tredje land. Intyget skapas i fliken 'Specialistläkare från tredjeland' och kan inkluderas som bilaga i ansökan."
            >
              <input
                type="checkbox"
                checked={presetChecked.thirdCountry}
                onChange={() => togglePreset("thirdCountry")}
              />
              <span>Uppfyllda kompetenskrav för specialistläkare från tredjeland</span>
            </label>
            <div className="w-[220px]">
              <CalendarDatePicker
                value={presetDates.thirdCountry}
                onChange={(iso) => updatePresetDate("thirdCountry", iso)}
                align="right"
                className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
              />
            </div>
          </div>
        )}

        {(["svDoc", "foreignDocEval", "foreignService", "individProg"] as PresetKey[]).map((k) => {
          if (k === "individProg" && !profile?.isThirdCountrySpecialist) {
            return null;
          }

          const labels: Record<PresetKey, string> = {
            intyg: "Intyg om uppnådd specialistkompetens",
            svDoc: "Godkänd svensk doktorsexamen",
            foreignDocEval: "Bedömning av utländsk doktorsexamen",
            foreignService: "Intyg om utländsk tjänstgöring",
            thirdCountry: "Uppfyllda kompetenskrav för specialistläkare från tredjeland",
            individProg: "Individuellt utbildningsprogram för specialistläkare från tredjeland",
          };
          const infoTexts: Record<PresetKey, string> = {
            intyg: "Intyg om uppnådd specialistkompetens. Huvudintyget som bekräftar att alla delmål och kompetenser är uppnådda.",
            svDoc: "Godkänd svensk doktorsexamen. Dokumentation av din svenska doktorsexamen som bilaga i ansökan.",
            foreignDocEval: "Bedömning av utländsk doktorsexamen. Dokumentation av bedömning av din utländska doktorsexamen som bilaga i ansökan.",
            foreignService: "Intyg om utländsk tjänstgöring. Dokumentation av utländsk tjänstgöring som kan räknas in i utbildningen.",
            thirdCountry: "Uppfyllda kompetenskrav för specialistläkare från tredjeland. Bekräftar att kompetenskrav för tredjelandspecialister är uppfyllda.",
            individProg: "Individuellt utbildningsprogram för specialistläkare från tredjeland. Dokumentation av ditt individuella utbildningsprogram.",
          };
          return (
            <div key={k} className="mb-2 grid grid-cols-[minmax(0,1fr)_220px] items-center gap-2">
              <label className="inline-flex items-center gap-2 text-[13px]" data-info={infoTexts[k]}>
                <input type="checkbox" checked={presetChecked[k]} onChange={() => togglePreset(k)} />
                <span>{labels[k]}</span>
              </label>
              <div className="w-[220px]">
                <CalendarDatePicker
                  value={presetDates[k]}
                  onChange={(iso) => updatePresetDate(k, iso)}
                  align="right"
                  className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <div className="grid grid-cols-[1fr_220px] items-center gap-2">
          <span className="whitespace-nowrap text-sm text-slate-700">Datum för betald avgift</span>
          <div className="w-[220px] justify-self-end">
            <CalendarDatePicker
              value={paidFeeDate}
              onChange={setPaidFeeDate}
              align="right"
              className="h-[40px] w-full rounded-lg border border-slate-300 px-3 text-[14px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

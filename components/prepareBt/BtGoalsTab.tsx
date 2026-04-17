"use client";

import React from "react";

import CalendarDatePicker from "@/components/CalendarDatePicker";

type Chip = { id: string; label: string };
type BtActivity = {
  id: string;
  text: string;
  startISO: string | null;
  endISO: string | null;
  source?: "manual" | "registered";
  refId?: string;
};

type IssuingSupervisor = {
  name: string;
  specialty: string;
  workplace: string;
};

type Props = {
  btActivities: BtActivity[];
  setBtActivities: React.Dispatch<React.SetStateAction<BtActivity[]>>;
  setChooserOpen: (open: boolean) => void;
  addEmptyActivityRow: () => void;
  setChooserChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setChooserIncludeGoals: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setPickerOpen: (open: boolean) => void;
  btGoals: Chip[];
  setBtGoals: React.Dispatch<React.SetStateAction<Chip[]>>;
  controlHow: string;
  setControlHow: (value: string) => void;
  mainSupervisorPrints: boolean;
  setMainSupervisorPrints: (value: boolean) => void;
  issuingSupervisor: IssuingSupervisor;
  setIssuingSupervisor: React.Dispatch<React.SetStateAction<IssuingSupervisor>>;
  editingSavedKey: string | null;
  onSaveAsAttachment: () => void | Promise<void>;
  onClearForm: () => void;
  onPreview: () => void;
};

export function BtGoalsTab({
  btActivities,
  setBtActivities,
  setChooserOpen,
  addEmptyActivityRow,
  setChooserChecked,
  setChooserIncludeGoals,
  setPickerOpen,
  btGoals,
  setBtGoals,
  controlHow,
  setControlHow,
  mainSupervisorPrints,
  setMainSupervisorPrints,
  issuingSupervisor,
  setIssuingSupervisor,
  editingSavedKey,
  onSaveAsAttachment,
  onClearForm,
  onPreview,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-lg border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-extrabold">Utbildningsaktiviteter som genomförts för att uppnå delmål</h3>

        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setChooserOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
            data-info="Öppnar en dialog där du kan välja bland redan registrerade utbildningsaktiviteter från tidslinjen. Dessa aktiviteter kan sedan inkluderas i intyget med sina kopplade BT-delmål."
          >
            Välj bland registrerade
          </button>
          <button
            type="button"
            onClick={addEmptyActivityRow}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
            data-info="Lägger till en ny tom rad där du kan manuellt ange en utbildningsaktivitet som inte är registrerad i tidslinjen. Du kan ange aktivitetens namn, startdatum och slutdatum."
          >
            + Lägg till aktivitet
          </button>
        </div>

        <div className="grid gap-2">
          {btActivities.map((a) => {
            const isReg = a.source === "registered";
            const rowTitle = isReg ? "Ändras på huvudsidan" : undefined;

            return (
              <div
                key={a.id}
                title={rowTitle}
                className={`grid grid-cols-[minmax(0,1fr)_160px_160px_40px] items-end gap-2 ${isReg ? "opacity-80" : ""}`}
              >
                <input
                  value={a.text}
                  onChange={(e) =>
                    setBtActivities((s) => s.map((x) => (x.id === a.id ? { ...x, text: e.target.value } : x)))
                  }
                  disabled={isReg}
                  readOnly={isReg}
                  className={`h-[40px] w-full rounded-lg border px-3 text-[14px] ${
                    isReg ? "border-slate-300 bg-slate-100 text-slate-700 cursor-not-allowed" : "border-slate-300 bg-white"
                  }`}
                />

                <div className="w-[160px]">
                  <label className="mb-1 block text-xs text-slate-600">Start</label>
                  <div className={isReg ? "pointer-events-none" : ""} aria-disabled={isReg}>
                    <CalendarDatePicker
                      value={a.startISO || ""}
                      onChange={(iso) =>
                        setBtActivities((s) => s.map((x) => (x.id === a.id ? { ...x, startISO: iso || null } : x)))
                      }
                      align="right"
                      className={`h-[40px] w-full rounded-lg border px-3 text-[14px] ${
                        isReg ? "border-slate-300 bg-slate-100 text-slate-700" : "border-slate-300"
                      }`}
                    />
                  </div>
                </div>

                <div className="w-[160px]">
                  <label className="mb-1 block text-xs text-slate-600">Slut</label>
                  <div className={isReg ? "pointer-events-none" : ""} aria-disabled={isReg}>
                    <CalendarDatePicker
                      value={a.endISO || ""}
                      onChange={(iso) =>
                        setBtActivities((s) => s.map((x) => (x.id === a.id ? { ...x, endISO: iso || null } : x)))
                      }
                      align="right"
                      className={`h-[40px] w-full rounded-lg border px-3 text-[14px] ${
                        isReg ? "border-slate-300 bg-slate-100 text-slate-700" : "border-slate-300"
                      }`}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setBtActivities((s) => s.filter((x) => x.id !== a.id));
                    if (isReg && a.refId) {
                      setChooserChecked((st) => ({ ...st, [String(a.refId)]: false }));
                      setChooserIncludeGoals((st) => ({ ...st, [String(a.refId)]: false }));
                    }
                  }}
                  className="h-[40px] w-[40px] rounded-lg border border-slate-300 bg-white text-lg font-semibold leading-none hover:bg-slate-100"
                  title="Ta bort"
                  data-info="Tar bort denna utbildningsaktivitet från listan. Om aktiviteten är vald från registrerade aktiviteter kommer den också avmarkeras i urvalsdialogen."
                >
                  –
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-extrabold">Delmål</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
            data-info="Öppnar en dialog där du kan välja vilka BT-delmål (bastjänstgöring delmål) som intyget ska avse. Du kan välja flera delmål som ska bekräftas i intyget."
          >
            Delmål som intyget avser
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {[...btGoals]
              .sort((a, b) => {
                const na = Number(String(a.id).match(/\d+/)?.[0] ?? 0);
                const nb = Number(String(b.id).match(/\d+/)?.[0] ?? 0);
                if (na !== nb) return na - nb;
                return String(a.id).localeCompare(String(b.id));
              })
              .map((g) => (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
                >
                  {g.label}
                  <button
                    type="button"
                    onClick={() => setBtGoals((list) => list.filter((x) => x.id !== g.id))}
                    className="rounded-full border border-slate-300 bg-slate-50 px-1 leading-none text-slate-600 hover:bg-slate-100"
                    title="Ta bort delmål"
                  >
                    x
                  </button>
                </span>
              ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <h3
          className="mb-2 text-sm font-extrabold"
          data-info="Beskrivning av hur delmålen har kontrollerats. Denna text kommer att inkluderas i intyget och ska beskriva de metoder och processer som använts för att verifiera att delmålen har uppnåtts, t.ex. genom handledarsamtal, bedömningar, observationer eller andra metoder."
        >
          Hur det kontrollerats att delmålen uppnåtts
        </h3>
        <textarea
          value={controlHow}
          onChange={(e) => setControlHow(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-slate-300 p-3 text-[14px]"
          data-info="Beskrivning av hur delmålen har kontrollerats. Denna text kommer att inkluderas i intyget och ska beskriva de metoder och processer som använts för att verifiera att delmålen har uppnåtts, t.ex. genom handledarsamtal, bedömningar, observationer eller andra metoder."
        />
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <label className="inline-flex items-center gap-2 text:[13px] text-[13px]">
          <input
            type="checkbox"
            checked={mainSupervisorPrints}
            onChange={(e) => setMainSupervisorPrints(e.currentTarget.checked)}
            data-info="Kryssa i denna ruta om någon annan än huvudhandledaren ska utfärda intyget. När rutan är ikryssad visas fält där du kan ange namnet, specialiteten och tjänstestället för den person som ska utfärda intyget. Denna information kommer att inkluderas i intyget."
          />
          <span data-info="Kryssa i denna ruta om någon annan än huvudhandledaren ska utfärda intyget. När rutan är ikryssad visas fält där du kan ange namnet, specialiteten och tjänstestället för den person som ska utfärda intyget. Denna information kommer att inkluderas i intyget.">
            Någon annan än huvudhandledare utfärdar intyg
          </span>
        </label>

        {mainSupervisorPrints && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <LabeledInput
              label="Intygsutfärdande handledare"
              value={issuingSupervisor.name}
              onCommit={(v) => setIssuingSupervisor((s) => ({ ...s, name: v }))}
            />
            <LabeledInput
              label="Handledares specialitet"
              value={issuingSupervisor.specialty}
              onCommit={(v) => setIssuingSupervisor((s) => ({ ...s, specialty: v }))}
            />
            <LabeledInput
              label="Handledares tjänsteställe"
              value={issuingSupervisor.workplace}
              onCommit={(v) => setIssuingSupervisor((s) => ({ ...s, workplace: v }))}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onSaveAsAttachment()}
            className="rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
            data-info={
              editingSavedKey
                ? "Sparar ändringarna i det befintliga intyget och uppdaterar det i listan över sparade intyg. Det uppdaterade intyget återfinns under fliken 'Ordna bilagor'."
                : "Sparar intyget som en bilaga som kan inkluderas i ansökan. Det sparade intyget återfinns under fliken 'Ordna bilagor' där det kan väljas för att inkluderas i ansökan. Intyget sparas med ett nummer och kan senare redigeras eller användas i andra intyg."
            }
          >
            {editingSavedKey ? "Spara ändringar" : "Spara som bilaga"}
          </button>

          <button
            type="button"
            onClick={onClearForm}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
            data-info="Rensar alla fält i formuläret så att du kan börja om från början. Detta påverkar inte redan sparade intyg."
          >
            Rensa formulär
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreview}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
            data-info="Genererar och visar en förhandsvisning av intyget som PDF. Intyget innehåller alla angivna utbildningsaktiviteter, valda delmål och information om hur delmålen har kontrollerats."
          >
            Intyg
          </button>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value?: string;
  onCommit: (v: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-sm text-slate-700">{label}</label>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onCommit(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
      />
    </div>
  );
}

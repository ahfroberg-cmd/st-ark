"use client";

import { LabeledInputLocal } from "@/components/prepareBt/InputFields";
import type { BtPlacementRow } from "@/components/prepareBt/modalTypes";

type Props = {
  btRows: BtPlacementRow[];
  setBtRows: React.Dispatch<React.SetStateAction<BtPlacementRow[]>>;
  updateDirty: () => void;
  otherThanManager: boolean;
  setOtherThanManager: React.Dispatch<React.SetStateAction<boolean>>;
  appointedSigner: { name: string; workplace: string };
  setAppointedSigner: React.Dispatch<React.SetStateAction<{ name: string; workplace: string }>>;
};

export function BtFullTab({
  btRows,
  setBtRows,
  updateDirty,
  otherThanManager,
  setOtherThanManager,
  appointedSigner,
  setAppointedSigner,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="rounded-lg border border-slate-200 p-3">
        <h3
          className="mb-2 text-sm font-extrabold"
          data-info="Visar en tabell över alla kliniska tjänstgöringar som genomförts under bastjänstgöringen (BT). Tabellen innehåller tjänstgöringens namn, period, sysselsättningsprocent, månader i heltid samt om tjänstgöringen är inom primärvård eller akut sjukvård. Denna information kommer att inkluderas i intyget för fullgjord BT."
        >
          Kliniska tjänstgöringar under BT
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-b px-3 py-2 text-left">Tjänstgöring</th>
                <th className="border-b px-3 py-2 text-left">Period</th>
                <th className="border-b px-3 py-2 text-right">Syss.%</th>
                <th className="border-b px-3 py-2 text-right">Mån (heltid)</th>
                <th className="border-b px-3 py-2 text-center">Primärvård</th>
                <th className="border-b px-3 py-2 text-center">Akut sjukvård</th>
              </tr>
            </thead>
            <tbody>
              {btRows.map((r) => (
                <tr key={r.id} className="odd:bg-white even:bg-slate-50/40">
                  <td className="border-b px-3 py-2">{(r.ref as any).clinic || (r.ref as any).note || "—"}</td>
                  <td className="border-b px-3 py-2">
                    {(r.ref.startDate || "").slice(0, 10)} – {(r.ref.endDate || r.ref.startDate || "").slice(0, 10)}
                  </td>
                  <td className="border-b px-3 py-2 text-right">{r.percent}</td>
                  <td className="border-b px-3 py-2 text-right">{r.monthsFte}</td>
                  <td className="border-b px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.primaryCare}
                      onChange={(e) => {
                        const checked = (e.currentTarget as HTMLInputElement).checked;
                        setBtRows((rows) => rows.map((x) => (x.id === r.id ? { ...x, primaryCare: checked } : x)));
                        updateDirty();
                      }}
                    />
                  </td>
                  <td className="border-b px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.acuteCare}
                      onChange={(e) => {
                        const checked = (e.currentTarget as HTMLInputElement).checked;
                        setBtRows((rows) => rows.map((x) => (x.id === r.id ? { ...x, acuteCare: checked } : x)));
                        updateDirty();
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <label className="inline-flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={otherThanManager}
            onChange={(e) => setOtherThanManager(e.currentTarget.checked)}
            data-info="Kryssa i denna ruta om någon annan än verksamhetschefen ska utfärda intyget. När rutan är ikryssad visas fält där du kan ange namnet och tjänstestället för den person som ska utfärda intyget. Denna information kommer att inkluderas i intyget för fullgjord BT."
          />
          <span data-info="Kryssa i denna ruta om någon annan än verksamhetschefen ska utfärda intyget. När rutan är ikryssad visas fält där du kan ange namnet och tjänstestället för den person som ska utfärda intyget. Denna information kommer att inkluderas i intyget för fullgjord BT.">
            Någon annan än verksamhetschef utfärdar intyg
          </span>
        </label>

        {otherThanManager && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <LabeledInputLocal
              label="Intygsutfärdande person motsvarande verksamhetschef"
              value={appointedSigner.name}
              onCommit={(v) => setAppointedSigner((s) => ({ ...s, name: v }))}
            />
            <LabeledInputLocal
              label="Tjänsteställe"
              value={appointedSigner.workplace}
              onCommit={(v) => setAppointedSigner((s) => ({ ...s, workplace: v }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

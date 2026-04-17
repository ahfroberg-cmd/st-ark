"use client";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  btPlacements: any[];
  chooserChecked: Record<string, boolean>;
  chooserIncludeGoals: Record<string, boolean>;
  setChooserChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setChooserIncludeGoals: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  extractPlacementGoals: (pl: any) => string[];
};

export function RegisteredActivitiesChooserModal({
  open,
  onClose,
  onConfirm,
  btPlacements,
  chooserChecked,
  chooserIncludeGoals,
  setChooserChecked,
  setChooserIncludeGoals,
  extractPlacementGoals,
}: Props) {
  if (!open) return null;

  const all = [...btPlacements].sort(
    (a, b) =>
      new Date((a as any).endDate || (a as any).startDate || 0).getTime() -
      new Date((b as any).endDate || (b as any).startDate || 0).getTime()
  );
  const isCourse = (x: any) =>
    Boolean((x as any)?.certificateDate || (x as any)?.courseLeaderName || (x as any)?.city);
  const placements = all.filter((x) => !isCourse(x));
  const courses = all.filter((x) => isCourse(x));

  const renderItem = (pl: any) => {
    const goals: string[] =
      Array.isArray((pl as any).btGoals) && (pl as any).btGoals.length
        ? (pl as any).btGoals.map((g: any) => String(g))
        : extractPlacementGoals(pl);

    const chosen = !!chooserChecked[pl.id];
    const include = !!chooserIncludeGoals[pl.id];

    return (
      <div key={pl.id} className="rounded-lg border border-slate-300 bg-white p-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap text-[13px] font-semibold">
              <span className="truncate">{(pl as any).clinic || (pl as any).note || "Utbildningsaktivitet"}</span>
              {goals.map((gid) => (
                <span
                  key={gid}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[9px] leading-4"
                >
                  {gid}
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-[12px]">
              <span>Välj aktivitet:</span>
              <input
                type="checkbox"
                checked={chosen}
                onChange={(e) => {
                  const on = (e.currentTarget as HTMLInputElement).checked;
                  setChooserChecked((st) => ({ ...st, [pl.id]: on }));
                  setChooserIncludeGoals((st) => ({ ...st, [pl.id]: on }));
                }}
              />
            </label>

            <label className="inline-flex items-center gap-2 text-[12px]">
              <span>Inkludera delmål i intyg</span>
              <input
                type="checkbox"
                checked={include}
                onChange={(e) => {
                  const on = (e.currentTarget as HTMLInputElement).checked;
                  setChooserIncludeGoals((st) => ({ ...st, [pl.id]: on }));
                }}
                disabled={!chosen}
              />
            </label>
          </div>
        </div>

        <div className="mt-1 text-[11px] text-slate-600">
          {(pl.startDate || "").slice(0, 10)} – {(pl.endDate || pl.startDate || "").slice(0, 10)}
        </div>
      </div>
    );
  };

  const renderSection = (title: string, items: any[]) => (
    <div className="grid gap-2">
      <div className="text-[16px] font-extrabold text-slate-900">{title}</div>
      {items.length === 0 ? (
        <div className="text-[13px] text-slate-500">Inga hittades.</div>
      ) : (
        items.map(renderItem)
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/40 p-3">
      <div className="w-full max-w-[780px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="m-0 text-base font-extrabold">Välj bland registrerade</h3>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          >
            Stäng
          </button>
        </header>
        <section className="max-h-[70vh] overflow-auto p-4">
          <div className="grid gap-4">
            {renderSection("Kliniska tjänstgöringar", placements)}
            {renderSection("Kurser", courses)}
          </div>
        </section>

        <footer className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:border-sky-700 hover:bg-sky-700 active:translate-y-px"
          >
            Inkludera valda utbildningsaktiviteter
          </button>
        </footer>
      </div>
    </div>
  );
}

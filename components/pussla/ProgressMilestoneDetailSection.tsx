"use client";

type MilestoneBucket = { fulfilled: number; total: number };

function MilestoneProgressCard(props: {
  title: string;
  bucket: MilestoneBucket;
  barClassName: string;
}) {
  const { title, bucket, barClassName } = props;
  const pct = bucket.total > 0 ? Math.min(100, (bucket.fulfilled / bucket.total) * 100) : 0;
  const pctLabel = bucket.total > 0 ? `${((bucket.fulfilled / bucket.total) * 100).toFixed(0)}%` : "0%";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <span className="text-sm text-slate-600">{pctLabel}</span>
      </div>
      <div className="h-6 w-full rounded-full bg-slate-200">
        <div className={barClassName} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-slate-600 mt-1">
        Utbildningsaktiviteter som uppfyller unika delmål: {bucket.fulfilled} av {bucket.total}
      </div>
    </div>
  );
}

export default function ProgressMilestoneDetailSection(props: {
  is2021: boolean;
  milestoneDetails: { bt: MilestoneBucket; st: MilestoneBucket };
  onOpenMilestonesPage: () => void;
}) {
  const { is2021, milestoneDetails, onOpenMilestonesPage } = props;

  return (
    <div className="space-y-4">
      {is2021 ? (
        <>
          <MilestoneProgressCard
            title="BT-delmål"
            bucket={milestoneDetails.bt}
            barClassName="h-6 rounded-full bg-sky-500 transition-[width] duration-300"
          />
          <MilestoneProgressCard
            title="ST-delmål"
            bucket={milestoneDetails.st}
            barClassName="h-6 rounded-full bg-emerald-500/80 transition-[width] duration-300"
          />
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-700">
            <p className="mb-2">
              <strong>Hur delmålsuppfyllelse räknas:</strong> Varje delmål kan kräva en, två eller tre utbildningsaktiviteter: klinisk tjänstgöring, kurs och/eller skriftligt arbete. Uppfyllelsen räknas som andelen genomförda utbildningsaktiviteter av det totala antalet som krävs. BT-delmål räknas separat.
            </p>
            <button
              type="button"
              onClick={onOpenMilestonesPage}
              className="text-sky-600 hover:text-sky-700 underline font-medium"
            >
              Öppna delmålssidan
            </button>
          </div>
        </>
      ) : (
        <>
          <MilestoneProgressCard
            title="ST-delmål"
            bucket={milestoneDetails.st}
            barClassName="h-6 rounded-full bg-emerald-500/80 transition-[width] duration-300"
          />
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-700">
            <p className="mb-2">
              <strong>Hur delmålsuppfyllelse räknas:</strong> Varje delmål kan kräva en, två eller tre utbildningsaktiviteter: klinisk tjänstgöring, kurs och/eller skriftligt arbete. Uppfyllelsen räknas som andelen genomförda utbildningsaktiviteter av det totala antalet som krävs.
            </p>
            <button
              type="button"
              onClick={onOpenMilestonesPage}
              className="text-sky-600 hover:text-sky-700 underline font-medium"
            >
              Öppna delmålssidan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

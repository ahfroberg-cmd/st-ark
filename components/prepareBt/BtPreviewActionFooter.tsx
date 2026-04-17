"use client";

type Props = {
  onPreviewBtFull: () => void;
  onPreviewBtCompetence: () => void;
  onPreviewBtApplication: () => void;
};

export function BtPreviewActionFooter({
  onPreviewBtFull,
  onPreviewBtCompetence,
  onPreviewBtApplication,
}: Props) {
  return (
    <footer className="border-t bg-white">
      <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onPreviewBtFull}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          title="Öppna förhandsvisning – Intyg fullgjord BT"
          data-info="Genererar och visar en förhandsvisning av intyget för fullgjord bastjänstgöring (BT). Detta intyg bekräftar att hela bastjänstgöringen har genomförts enligt kraven, inklusive alla kliniska tjänstgöringar med deras perioder, sysselsättningsprocent och månader i heltid. Intyget kan användas i ansökan om specialistkompetens."
        >
          Intyg fullgjord BT
        </button>

        <button
          type="button"
          onClick={onPreviewBtCompetence}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          title="Öppna förhandsvisning – Intyg uppnådd baskompetens"
          data-info="Genererar och visar en förhandsvisning av intyget för uppnådd baskompetens i bastjänstgöringen. Detta intyg bekräftar att de kompetenser som krävs för bastjänstgöringen har uppnåtts. Intyget innehåller information om huvudhandledare och extern bedömare om sådan finns angiven."
        >
          Intyg uppnådd BT
        </button>

        <button
          type="button"
          onClick={onPreviewBtApplication}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          title="Öppna förhandsvisning – Ansökan om intyg om godkänd BT"
          data-info="Genererar och visar en förhandsvisning av ansökan om intyg om godkänd bastjänstgöring. Detta är en komplett ansökan som inkluderar alla bilagor som har valts i fliken 'Ordna bilagor', inklusive intyg för delmål, kliniska tjänstgöringar och andra dokument. Ansökan kan användas för att ansöka om intyg om godkänd BT."
        >
          Ansökan om intyg om godkänd BT
        </button>
      </div>
    </footer>
  );
}

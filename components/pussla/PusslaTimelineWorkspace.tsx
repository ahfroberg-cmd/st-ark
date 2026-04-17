"use client";

export default function PusslaTimelineWorkspace(props: {
  setGoHomeWarnOpen: (value: boolean) => void;
  is2021: boolean;
  setBtModalOpen: (value: boolean) => void;
  setPrepareOpen: (value: boolean) => void;
  setIupInitialTab: (value: any) => void;
  setIupInitialMeetingId: (value: string | null) => void;
  setIupInitialAssessmentId: (value: string | null) => void;
  setIupOpen: (value: boolean) => void;
  setHemklinikOpen: (value: boolean) => void;
  openDocumentsFor: (target: { kind: "placement" | "course" | null; id: string | null; label: string }) => void | Promise<void>;
  setSettingsOpen: (value: boolean) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setSearchOpen: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <button
        type="button"
        onClick={() => props.setGoHomeWarnOpen(true)}
        className="select-none caret-transparent text-center text-4xl font-extrabold tracking-tight cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:outline-none focus:ring-0"
        title="Ga till startsidan"
      >
        <span className="text-sky-700">ST</span>
        <span className="text-emerald-700">ARK</span>
      </button>

      <div className="flex items-center gap-2">
        {props.is2021 && (
          <button
            onClick={() => props.setBtModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
            title="Intyg bastjanstgoring"
          >
            Intyg bastjanstgoring
          </button>
        )}

        <button
          onClick={() => props.setPrepareOpen(true)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          title="Specialistansökan"
        >
          Specialistansökan
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <input
          type="text"
          value={props.searchQuery}
          onChange={(e) => {
            props.setSearchQuery(e.target.value);
            props.setSearchOpen(true);
          }}
          onFocus={() => props.setSearchOpen(true)}
          placeholder="Sök..."
          className="h-10 w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          title="Sök"
          aria-label="Sök"
        />
        <button
          onClick={() => {
            props.setIupInitialTab("handledning");
            props.setIupInitialMeetingId(null);
            props.setIupInitialAssessmentId(null);
            props.setIupOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          title="IUP"
        >
          IUP
        </button>

        <button
          onClick={() => props.setHemklinikOpen(true)}
          className="inline-flex items-center gap-2 justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 active:translate-y-px"
          title="Hemklinik"
        >
          Hemklinik
        </button>

        <button
          onClick={() => {
            void props.openDocumentsFor({ kind: null, id: null, label: "Alla dokument" });
          }}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
          title="Dokument"
        >
          Dokument
        </button>

        <button
          onClick={() => props.setSettingsOpen(true)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 active:translate-y-px"
          title="Meny"
        >
          Meny
        </button>
      </div>
    </div>
  );
}

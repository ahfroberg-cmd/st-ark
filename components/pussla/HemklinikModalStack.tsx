"use client";

export default function HemklinikModalStack(props: {
  hemklinikOpen: boolean;
  setHemklinikOpen: (value: boolean) => void;
  hemklinikTab: "kommunikation" | "kollegor";
  setHemklinikTab: (value: "kommunikation" | "kollegor") => void;
  hemklinikLoading: boolean;
  setHemklinikComposeOpen: (value: boolean) => void;
  hemklinikMailbox: "inkorg" | "skickat";
  setHemklinikMailbox: (value: "inkorg" | "skickat") => void;
  hemklinikMessages: any[];
  hemklinikSentMessages: any[];
  hemklinikMailboxRows: any[];
  hemklinikSelectedMessage: any;
  onOpenMailboxMessage: (message: any) => void | Promise<void>;
  onRemoveHemklinikMessage: (messageId: string, mailbox: "inkorg" | "skickat") => void | Promise<void>;
  hemklinikSuggestions: any[];
  setHemklinikSuggestionDetail: (value: any) => void;
  onDismissHemklinikSuggestion: (suggestionId: string) => void | Promise<void>;
  hemklinikColleagues: any[];
  hemklinikPrimaryContacts: any[];
  setHemklinikContactDetail: (value: any) => void;
  setColleagueMainTab: (value: "utbildningsmoment" | "kontaktuppgifter") => void;
  setColleagueActivityDetail: (value: any) => void;
  setSelectedColleague: (value: any) => void;
  hemklinikContactDetail: any;
  hemklinikComposeOpen: boolean;
  setHemklinikRecipientPickerOpen: (value: boolean) => void;
  hemklinikComposeRecipients: string[];
  setHemklinikComposeText: (value: string) => void;
  hemklinikComposeText: string;
  onSendHemklinikMessage: () => void | Promise<void>;
  hemklinikComposeSending: boolean;
  hemklinikRecipientPickerOpen: boolean;
  setHemklinikComposeRecipients: (updater: (prev: string[]) => string[]) => void;
  hemklinikSuggestionDetail: any;
}) {
  if (!props.hemklinikOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
        onClick={() => props.setHemklinikOpen(false)}
      >
        <div
          className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white shadow-xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-black px-6 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Hemklinik</h2>
              <button
                onClick={() => props.setHemklinikOpen(false)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
              >
                Stang
              </button>
            </div>
          </div>
          <div className="border-b border-black">
            <nav className="flex gap-1 bg-slate-50 px-6 pt-2">
              {([
                ["kollegor", "Kollegor"],
                ["kommunikation", "Kommunikation"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => props.setHemklinikTab(value)}
                  className={`rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none ${
                    props.hemklinikTab === value
                      ? "bg-white text-slate-900 border-x border-t border-slate-200 -mb-px"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {props.hemklinikLoading ? (
              <p className="text-sm text-slate-400">Laddar...</p>
            ) : props.hemklinikTab === "kommunikation" ? (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => props.setHemklinikComposeOpen(true)}
                    className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Nytt meddelande
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">Meddelanden</h3>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                      <button
                        type="button"
                        onClick={() => props.setHemklinikMailbox("inkorg")}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                          props.hemklinikMailbox === "inkorg"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Inkorg
                      </button>
                      <button
                        type="button"
                        onClick={() => props.setHemklinikMailbox("skickat")}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                          props.hemklinikMailbox === "skickat"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Skickat
                      </button>
                    </div>
                  </div>
                  <div className="grid min-h-[260px] grid-cols-1 md:grid-cols-[280px_1fr]">
                    <div className="border-r border-slate-200 bg-slate-50">
                      {props.hemklinikMailboxRows.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-slate-400">Inga meddelanden.</p>
                      ) : (
                        <div className="max-h-[360px] overflow-y-auto">
                          {props.hemklinikMailboxRows.map((message: any) => (
                            <button
                              key={message.id}
                              type="button"
                              onClick={() => void props.onOpenMailboxMessage(message)}
                              className={`w-full border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-100 ${
                                props.hemklinikSelectedMessage?.id === message.id ? "bg-white" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                  {props.hemklinikMailbox === "inkorg" ? (
                                    <>
                                      {!message.read && (
                                        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-sky-500" />
                                      )}{" "}
                                      {message.sender_name}
                                    </>
                                  ) : (
                                    message.recipient_name
                                  )}
                                </p>
                                <span className="text-[11px] text-slate-400">
                                  {String(message.created_at || "").slice(0, 10)}
                                </span>
                              </div>
                              <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-600">
                                {message.message_text}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      {props.hemklinikSelectedMessage ? (
                        <>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm text-slate-500">
                              {props.hemklinikMailbox === "inkorg" ? (
                                <>
                                  Fran:{" "}
                                  <span className="font-semibold text-slate-900">
                                    {props.hemklinikSelectedMessage.sender_name}
                                  </span>
                                </>
                              ) : (
                                <>
                                  Till:{" "}
                                  <span className="font-semibold text-slate-900">
                                    {props.hemklinikSelectedMessage.recipient_name}
                                  </span>
                                </>
                              )}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">
                                {String(props.hemklinikSelectedMessage.created_at || "")
                                  .slice(0, 16)
                                  .replace("T", " ")}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  void props.onRemoveHemklinikMessage(
                                    String(props.hemklinikSelectedMessage.id || ""),
                                    props.hemklinikMailbox
                                  )
                                }
                                className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                Ta bort
                              </button>
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                            <p className="whitespace-pre-wrap text-sm text-slate-800">
                              {props.hemklinikSelectedMessage.message_text}
                            </p>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">Valj ett meddelande i listan.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-2">Aktivitetsforslag</h3>
                  {props.hemklinikSuggestions.length === 0 ? (
                    <p className="text-sm text-slate-400">Inga mottagna forslag.</p>
                  ) : (
                    <div className="space-y-2">
                      {props.hemklinikSuggestions.map((suggestion) => {
                        const activityData = suggestion.activity_data || {};
                        const typeLabel: Record<string, string> = {
                          placement: "Placering",
                          course: "Kurs",
                          sr_meeting: "Studierektorsmote",
                          progression_assessment: "Progressionsbedomning",
                          leave: "Ledighet",
                        };
                        return (
                          <button
                            key={suggestion.id}
                            type="button"
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
                            onClick={() => props.setHemklinikSuggestionDetail(suggestion)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                {typeLabel[suggestion.activity_type] || suggestion.activity_type}
                              </p>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs rounded-full px-2 py-0.5 font-semibold ${
                                    suggestion.status === "accepted"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : suggestion.status === "dismissed"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {suggestion.status === "accepted"
                                    ? "Accepterat"
                                    : suggestion.status === "dismissed"
                                    ? "Avbojt"
                                    : "Vantande"}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void props.onDismissHemklinikSuggestion(suggestion.id);
                                  }}
                                  className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                >
                                  Ta bort
                                </button>
                              </div>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">Fran: {suggestion.sender_name}</p>
                            {activityData.title && (
                              <p className="text-xs text-slate-600 mt-1">{activityData.title}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {props.hemklinikColleagues.length === 0 ? (
                  <p className="text-sm text-slate-400">Inga kollegor hittades i hemkliniken.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Studierektor och huvudhandledare
                      </p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {props.hemklinikPrimaryContacts.map((colleague) => (
                          <button
                            key={colleague.userId}
                            type="button"
                            onClick={() =>
                              props.setHemklinikContactDetail({
                                name: colleague.name,
                                role: colleague.role,
                                specialty: colleague.specialty,
                                email: colleague.email,
                                mobile: colleague.mobile,
                                phoneWork: colleague.phoneWork,
                              })
                            }
                            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{colleague.name}</p>
                              <p className="text-xs text-slate-500">
                                {colleague.role === "studierektor" ? "Studierektor" : "Huvudhandledare"}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-slate-200 pt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        ST-kollegor
                      </p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {props.hemklinikColleagues
                          .filter((colleague) => colleague.role === "st_lakare")
                          .map((colleague) => (
                            <button
                              key={colleague.userId}
                              type="button"
                              onClick={() => {
                                props.setColleagueMainTab("utbildningsmoment");
                                props.setColleagueActivityDetail(null);
                                props.setSelectedColleague(colleague);
                              }}
                              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{colleague.name}</p>
                                <p className="text-xs text-slate-500">{`ST-lakare · Malversion ${String(
                                  colleague.goalsVersion || "2021"
                                )}`}</p>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {props.hemklinikContactDetail && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
          onClick={() => props.setHemklinikContactDetail(null)}
        >
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Kontaktuppgifter</h3>
              <button
                type="button"
                onClick={() => props.setHemklinikContactDetail(null)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-200"
              >
                Stang
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Namn
                  </label>
                  <p className="text-sm text-slate-900">{props.hemklinikContactDetail.name || "-"}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Roll
                  </label>
                  <p className="text-sm text-slate-900">
                    {props.hemklinikContactDetail.role === "studierektor"
                      ? "Studierektor"
                      : "Huvudhandledare"}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Specialitet
                  </label>
                  <p className="text-sm text-slate-900">{props.hemklinikContactDetail.specialty || "-"}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    E-postadress
                  </label>
                  {props.hemklinikContactDetail.email ? (
                    <a
                      href={`mailto:${props.hemklinikContactDetail.email}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {props.hemklinikContactDetail.email}
                    </a>
                  ) : (
                    <p className="text-sm text-slate-900">-</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Mobiltelefon
                  </label>
                  <p className="text-sm text-slate-900">{props.hemklinikContactDetail.mobile || "-"}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Arbetstelefon
                  </label>
                  <p className="text-sm text-slate-900">{props.hemklinikContactDetail.phoneWork || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {props.hemklinikComposeOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
          onClick={() => props.setHemklinikComposeOpen(false)}
        >
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Nytt meddelande</h3>
              <button
                type="button"
                onClick={() => props.setHemklinikComposeOpen(false)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-200"
              >
                Stang
              </button>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-600">Mottagare</p>
                  <button
                    type="button"
                    onClick={() => props.setHemklinikRecipientPickerOpen(true)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Valj mottagare
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {props.hemklinikComposeRecipients.length === 0
                    ? "Inga mottagare valda"
                    : props.hemklinikColleagues
                        .filter((colleague) => props.hemklinikComposeRecipients.includes(colleague.userId))
                        .map((colleague) => colleague.name)
                        .join(", ")}
                </p>
              </div>
              <textarea
                value={props.hemklinikComposeText}
                onChange={(e) => props.setHemklinikComposeText(e.target.value)}
                rows={7}
                placeholder="Skriv ditt meddelande..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => props.setHemklinikComposeOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={() => void props.onSendHemklinikMessage()}
                  disabled={props.hemklinikComposeSending}
                  className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {props.hemklinikComposeSending ? "Skickar..." : "Skicka"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {props.hemklinikRecipientPickerOpen && (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-black/40 p-4"
          onClick={() => props.setHemklinikRecipientPickerOpen(false)}
        >
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-900">Valj mottagare</h4>
              <button
                type="button"
                onClick={() => props.setHemklinikRecipientPickerOpen(false)}
                className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-200"
              >
                Stang
              </button>
            </div>
            <div className="max-h-[320px] space-y-1 overflow-y-auto px-4 py-3">
              {props.hemklinikColleagues.map((colleague) => {
                const checked = props.hemklinikComposeRecipients.includes(colleague.userId);
                return (
                  <label
                    key={colleague.userId}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${
                      checked ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        props.setHemklinikComposeRecipients((prev) =>
                          prev.includes(colleague.userId)
                            ? prev.filter((id) => id !== colleague.userId)
                            : [...prev, colleague.userId]
                        )
                      }
                    />
                    <span className="text-slate-800">{colleague.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="border-t border-slate-200 px-4 py-3 flex justify-between">
              <button
                type="button"
                onClick={() => props.setHemklinikComposeRecipients(() => [])}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Rensa
              </button>
              <button
                type="button"
                onClick={() =>
                  props.setHemklinikComposeRecipients(() =>
                    props.hemklinikColleagues.map((colleague) => colleague.userId)
                  )
                }
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Valj alla
              </button>
            </div>
          </div>
        </div>
      )}

      {props.hemklinikSuggestionDetail && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
          onClick={() => props.setHemklinikSuggestionDetail(null)}
        >
          <div
            className="w-full max-w-xl max-h-[85vh] overflow-hidden rounded-xl bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-black px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">Detaljer for aktivitetsforslag</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void props.onDismissHemklinikSuggestion(String(props.hemklinikSuggestionDetail.id || ""))}
                    className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Ta bort
                  </button>
                  <button
                    type="button"
                    onClick={() => props.setHemklinikSuggestionDetail(null)}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                  >
                    Stang
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {(() => {
                const suggestion = props.hemklinikSuggestionDetail;
                const activityData = suggestion.activity_data || {};
                const typeLabel: Record<string, string> = {
                  placement: "Placering",
                  course: "Kurs",
                  sr_meeting: "Studierektorsmote",
                  progression_assessment: "Progressionsbedomning",
                  leave: "Ledighet",
                };
                return (
                  <>
                    <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                      <p>
                        <span className="font-semibold text-slate-900">Typ:</span>{" "}
                        {typeLabel[suggestion.activity_type] || suggestion.activity_type}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">Status:</span>{" "}
                        {suggestion.status === "accepted"
                          ? "Accepterat"
                          : suggestion.status === "dismissed"
                          ? "Avbojt"
                          : "Vantande"}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">Fran:</span> {suggestion.sender_name}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-900">Datum:</span>{" "}
                        {String(suggestion.created_at || "").slice(0, 10)}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {activityData.title && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Titel
                          </p>
                          <p className="mt-1 text-sm text-slate-700">{String(activityData.title)}</p>
                        </div>
                      )}
                      {activityData.courseTitle && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Kursnamn
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {String(activityData.courseTitle)}
                          </p>
                        </div>
                      )}
                      {activityData.dateISO && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Datum
                          </p>
                          <p className="mt-1 text-sm text-slate-700">{String(activityData.dateISO)}</p>
                        </div>
                      )}
                      {activityData.startDate && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Startdatum
                          </p>
                          <p className="mt-1 text-sm text-slate-700">{String(activityData.startDate)}</p>
                        </div>
                      )}
                      {activityData.endDate && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Slutdatum
                          </p>
                          <p className="mt-1 text-sm text-slate-700">{String(activityData.endDate)}</p>
                        </div>
                      )}
                      {activityData.focus && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Fokus
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {String(activityData.focus)}
                          </p>
                        </div>
                      )}
                      {(activityData.instrument || activityData.instrumentOther) && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Instrument
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {String(activityData.instrumentOther || activityData.instrument)}
                          </p>
                        </div>
                      )}
                      {activityData.level && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Niva
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {String(activityData.level)}
                          </p>
                        </div>
                      )}
                      {activityData.summary && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Sammanfattning
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {String(activityData.summary)}
                          </p>
                        </div>
                      )}
                      {activityData.strengths && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Styrkor
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {String(activityData.strengths)}
                          </p>
                        </div>
                      )}
                      {activityData.development && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Utvecklingsomraden
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {String(activityData.development)}
                          </p>
                        </div>
                      )}
                      {activityData.description && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Beskrivning
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {String(activityData.description)}
                          </p>
                        </div>
                      )}
                      {activityData.note && (
                        <div>
                          <p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Anteckning
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {String(activityData.note)}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

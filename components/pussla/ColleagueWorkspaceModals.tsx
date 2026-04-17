"use client";

export default function ColleagueWorkspaceModals(props: {
  selectedColleague: any;
  setSelectedColleague: (value: any) => void;
  colleagueData: any;
  colleagueLoading: boolean;
  colleagueMainTab: "utbildningsmoment" | "kontaktuppgifter";
  setColleagueMainTab: (value: "utbildningsmoment" | "kontaktuppgifter") => void;
  colleagueActivityDetail: any;
  setColleagueActivityDetail: (value: any) => void;
  colleagueFormatDate: (dateISO?: string | null) => string;
  colleagueCalculateMonths: (startDate?: string, endDate?: string, attendance?: number) => number;
  colleagueBirthDate: (personalNumber?: string | null) => string;
  displayMilestoneCode: (id: string, goalsVersion?: string) => string;
  sortMilestoneIds: (ids: string[]) => string[];
  colleagueCopiedToast: boolean;
  onRequestCopyMilestones: (detail: any) => void | Promise<void>;
  onRequestCopyDescription: (detail: any) => void | Promise<void>;
}) {
  const selectedColleague = props.selectedColleague;
  const colleagueData = props.colleagueData;
  const colleagueActivityDetail = props.colleagueActivityDetail;

  return (
    <>
      {selectedColleague && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => props.setSelectedColleague(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-black px-6 pt-5 pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedColleague.name}</h2>
                  <p className="text-sm text-slate-600">
                    Malversion {String(selectedColleague.goalsVersion || colleagueData?.profile?.goalsVersion || "2021")}
                  </p>
                </div>
                <button
                  onClick={() => props.setSelectedColleague(null)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                >
                  Stang
                </button>
              </div>
            </div>

            <div className="border-b border-black">
              <nav className="flex gap-1 bg-slate-50 px-6 pt-2">
                {([
                  { id: "utbildningsmoment", label: "Utbildningsmoment" },
                  { id: "kontaktuppgifter", label: "Kontaktuppgifter" },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => props.setColleagueMainTab(tab.id)}
                    className={`rounded-t-lg px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:outline-none ${
                      props.colleagueMainTab === tab.id
                        ? "bg-white text-slate-900 border-x border-t border-slate-200 -mb-px"
                        : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {props.colleagueLoading || !colleagueData ? (
                <p className="text-sm text-slate-400">Laddar...</p>
              ) : props.colleagueMainTab === "utbildningsmoment" ? (
                !colleagueData.canShareEducation ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    Denna kollega delar inte sina kliniska tjanstgoringar och kurser.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-2 rounded-xl border bg-white overflow-hidden">
                      <div className="flex items-center justify-between border-b px-3 py-2">
                        <div className="font-semibold">Klinisk tjanstgoring, arbeten, ledighet</div>
                      </div>
                      <div className="max-h-[40vh] overflow-auto">
                        <table className="w-full text-sm select-none">
                          <thead className="sticky top-0 bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Moment</th>
                              <th className="px-3 py-2 text-center">Start</th>
                              <th className="px-3 py-2 text-center">Slut</th>
                              <th className="px-3 py-2 text-left">Handledare</th>
                            </tr>
                          </thead>
                          <tbody className="cursor-default">
                            {[...(colleagueData.placements || [])]
                              .sort(
                                (a: any, b: any) =>
                                  new Date(a.startDate || "").getTime() - new Date(b.startDate || "").getTime()
                              )
                              .map((placement: any, i: number) => {
                                const isSelected = colleagueActivityDetail?.id === placement.id;
                                const hue = (placement as any)?.hue ?? ((210 + i * 30) % 360);
                                return (
                                  <tr
                                    key={placement.id || i}
                                    className={`border-t cursor-pointer ${
                                      isSelected
                                        ? "bg-slate-200 hover:bg-slate-300 text-slate-900 ring-1 ring-slate-300"
                                        : "hover:bg-slate-50"
                                    }`}
                                    onClick={() => props.setColleagueActivityDetail(placement)}
                                  >
                                    <td className="px-3 py-1.5">
                                      <span className="inline-flex items-center">
                                        <span
                                          className="inline-flex items-center rounded-md px-2 py-0.5 text-[12px] leading-5"
                                          style={{
                                            backgroundColor: `hsl(${hue} 28% 88%)`,
                                            border: `1px solid hsl(${hue} 30% 72%)`,
                                          }}
                                        >
                                          <span className="text-slate-900">
                                            {placement.clinic || placement.label || placement.type || "Placering"}
                                          </span>
                                        </span>
                                        {placement.phase === "BT" && (
                                          <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-black bg-white text-[10px] leading-4 text-slate-900">
                                            BT
                                          </span>
                                        )}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1.5 text-center">
                                      {props.colleagueFormatDate(placement.startDate)}
                                    </td>
                                    <td className="px-3 py-1.5 text-center">
                                      {props.colleagueFormatDate(placement.endDate)}
                                    </td>
                                    <td className="px-3 py-1.5">{placement.supervisor || "-"}</td>
                                  </tr>
                                );
                              })}
                            {(colleagueData.placements || []).length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-3 py-3 text-slate-500">
                                  Inga aktiviteter.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="rounded-xl border bg-white overflow-hidden">
                        <div className="flex items-center justify-between border-b px-3 py-2">
                          <div className="font-semibold">Kurser</div>
                        </div>
                        <div className="max-h-[22vh] overflow-auto">
                          <table className="w-full text-sm select-none">
                            <thead className="sticky top-0 bg-slate-50 text-left">
                              <tr>
                                <th className="px-3 py-2">Kursnamn</th>
                                <th className="px-3 py-2 text-left">Intygsdatum</th>
                              </tr>
                            </thead>
                            <tbody className="cursor-default">
                              {[...(colleagueData.courses || []).filter((course: any) => course.kind !== "Utbildningsmoment")]
                                .sort((a: any, b: any) =>
                                  String(a.endDate || a.certificateDate || "").localeCompare(
                                    String(b.endDate || b.certificateDate || "")
                                  )
                                )
                                .map((course: any, i: number) => {
                                  const isSelected = colleagueActivityDetail?.id === course.id;
                                  return (
                                    <tr
                                      key={course.id || i}
                                      className={`border-t cursor-pointer ${
                                        isSelected
                                          ? "bg-slate-200 hover:bg-slate-300 text-slate-900 shadow-[inset_0_0_0_1px_rgba(100,116,139,1)]"
                                          : "hover:bg-slate-50"
                                      }`}
                                      onClick={() => props.setColleagueActivityDetail(course)}
                                    >
                                      <td className="px-3 py-1.5">
                                        <span className="inline-flex items-center">
                                          <span>{course.title || course.name || "-"}</span>
                                          {course.phase === "BT" && (
                                            <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 border border-black bg-white text-[10px] leading-4 text-slate-900">
                                              BT
                                            </span>
                                          )}
                                        </span>
                                      </td>
                                      <td className="px-3 py-1.5">{course.endDate || course.certificateDate || "-"}</td>
                                    </tr>
                                  );
                                })}
                              {(colleagueData.courses || []).filter((course: any) => course.kind !== "Utbildningsmoment")
                                .length === 0 && (
                                <tr>
                                  <td colSpan={2} className="px-3 py-3 text-slate-500">
                                    Inga kurser.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border bg-white overflow-hidden">
                        <div className="flex items-center justify-between border-b px-3 py-2">
                          <div className="font-semibold">Utbildningsmoment</div>
                        </div>
                        <div className="max-h-[22vh] overflow-auto">
                          <table className="w-full text-sm select-none">
                            <thead className="sticky top-0 bg-slate-50 text-left">
                              <tr>
                                <th className="px-3 py-2">Titel</th>
                                <th className="px-3 py-2 text-center">Datum</th>
                              </tr>
                            </thead>
                            <tbody className="cursor-default">
                              {[...(colleagueData.courses || []).filter((course: any) => course.kind === "Utbildningsmoment")]
                                .sort((a: any, b: any) =>
                                  String(a.startDate || a.endDate || "").localeCompare(
                                    String(b.startDate || b.endDate || "")
                                  )
                                )
                                .map((course: any, i: number) => {
                                  const isSelected = colleagueActivityDetail?.id === course.id;
                                  const displayTitle =
                                    course.title === "Annan"
                                      ? (course.courseTitle || course.title)
                                      : (course.title || "-");
                                  return (
                                    <tr
                                      key={course.id || i}
                                      className={`border-t cursor-pointer ${
                                        isSelected
                                          ? "bg-emerald-100 hover:bg-emerald-200 text-slate-900 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.5)]"
                                          : "hover:bg-slate-50"
                                      }`}
                                      onClick={() => props.setColleagueActivityDetail(course)}
                                    >
                                      <td className="px-3 py-1.5">{displayTitle}</td>
                                      <td className="px-3 py-1.5 text-center">{course.startDate || course.endDate || "-"}</td>
                                    </tr>
                                  );
                                })}
                              {(colleagueData.courses || []).filter((course: any) => course.kind === "Utbildningsmoment")
                                .length === 0 && (
                                <tr>
                                  <td colSpan={2} className="px-3 py-3 text-slate-500">
                                    Inga utbildningsmoment.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ) : !colleagueData.canShareContact ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Denna kollega delar inte sina kontaktuppgifter.
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900">Kontaktuppgifter</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Namn
                      </label>
                      <p className="text-sm text-slate-900">{selectedColleague.name || "-"}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Fodelsedatum
                      </label>
                      <p className="text-sm text-slate-900 font-mono">
                        {props.colleagueBirthDate(colleagueData.profile?.personalNumber)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        E-postadress
                      </label>
                      {colleagueData.profile?.email ? (
                        <a href={`mailto:${colleagueData.profile.email}`} className="text-sm text-blue-600 hover:underline">
                          {colleagueData.profile.email}
                        </a>
                      ) : (
                        <p className="text-sm text-slate-900">-</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Mobiltelefon
                      </label>
                      <p className="text-sm text-slate-900">{String(colleagueData.profile?.mobile || "-")}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Arbetstelefon
                      </label>
                      <p className="text-sm text-slate-900">{String(colleagueData.profile?.phoneWork || "-")}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Hemtelefon
                      </label>
                      <p className="text-sm text-slate-900">{String(colleagueData.profile?.phoneHome || "-")}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Adress
                      </label>
                      <p className="text-sm text-slate-900">{String(colleagueData.profile?.address || "-")}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Postnummer
                      </label>
                      <p className="text-sm text-slate-900">{String(colleagueData.profile?.postalCode || "-")}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        Postort
                      </label>
                      <p className="text-sm text-slate-900">{String(colleagueData.profile?.city || "-")}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {colleagueActivityDetail && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={() => props.setColleagueActivityDetail(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-black bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">
                  {colleagueActivityDetail.clinic ||
                    colleagueActivityDetail.label ||
                    colleagueActivityDetail.title ||
                    colleagueActivityDetail.name ||
                    "Aktivitet"}
                </h3>
                <button
                  onClick={() => props.setColleagueActivityDetail(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
                >
                  Stang
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                {colleagueActivityDetail.type ||
                  colleagueActivityDetail.kind ||
                  (colleagueActivityDetail.certificateDate ? "Kurs" : "Klinisk tjanstgoring")}
                {colleagueActivityDetail.phase && (
                  <span className="ml-2 font-medium">• {colleagueActivityDetail.phase}</span>
                )}
              </p>
            </div>

            <div className="max-h-[calc(80vh-80px)] overflow-y-auto p-5 space-y-4">
              {(() => {
                const isCourse = !!(
                  colleagueActivityDetail.kind ||
                  colleagueActivityDetail.certificateDate ||
                  colleagueActivityDetail.courseLeader ||
                  colleagueActivityDetail.courseLeaderName ||
                  colleagueActivityDetail.organizer
                );
                const months =
                  colleagueActivityDetail.startDate && colleagueActivityDetail.endDate
                    ? props.colleagueCalculateMonths(
                        colleagueActivityDetail.startDate,
                        colleagueActivityDetail.endDate,
                        colleagueActivityDetail.attendance ?? 100
                      )
                    : null;
                const milestones = colleagueActivityDetail.milestones || [];
                const btMilestones = colleagueActivityDetail.btMilestones || [];
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">Start</p>
                        <p className="font-medium text-slate-900">
                          {props.colleagueFormatDate(colleagueActivityDetail.startDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{isCourse ? "Intygsdatum" : "Slut"}</p>
                        <p className="font-medium text-slate-900">
                          {props.colleagueFormatDate(
                            colleagueActivityDetail.certificateDate || colleagueActivityDetail.endDate
                          )}
                        </p>
                      </div>
                    </div>

                    {!isCourse && months !== null && (
                      <div>
                        <p className="text-sm text-slate-500">Tjanstgoringsmanader</p>
                        <p className="font-medium text-slate-900">{months} man</p>
                      </div>
                    )}

                    {(colleagueActivityDetail.note || colleagueActivityDetail.notes) && (
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-700">Beskrivning</p>
                          <button
                            type="button"
                            onClick={() => void props.onRequestCopyDescription(colleagueActivityDetail)}
                            className="relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            title="Kopiera beskrivning"
                            aria-label="Kopiera beskrivning"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                              <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9v14Z" />
                            </svg>
                            {props.colleagueCopiedToast && (
                              <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-[10px] text-white shadow">
                                kopierat
                              </span>
                            )}
                          </button>
                        </div>
                        <p className="text-slate-900 whitespace-pre-wrap">
                          {colleagueActivityDetail.note || colleagueActivityDetail.notes}
                        </p>
                      </div>
                    )}

                    {String(colleagueData?.profile?.goalsVersion || "2021") === "2021" && (
                      <div>
                        <p className="text-sm font-semibold text-slate-700 mb-2">BT-delmål</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {btMilestones.length > 0 ? (
                            (btMilestones as any[]).map((milestone: any) => (
                              <button
                                key={`bt-${String(milestone)}`}
                                type="button"
                                className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-default"
                              >
                                {props.displayMilestoneCode(
                                  String(milestone).trim().split(/\s|–|-|:|\u2013/)[0],
                                  String(colleagueData?.profile?.goalsVersion || "2021")
                                )}
                              </button>
                            ))
                          ) : (
                            <span className="text-slate-400 text-sm">-</span>
                          )}
                        </div>
                      </div>
                    )}

                    {milestones.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-slate-700">ST-delmål</p>
                          <button
                            type="button"
                            onClick={() => void props.onRequestCopyMilestones(colleagueActivityDetail)}
                            className="relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                            title="Kopiera delmål"
                            aria-label="Kopiera delmål"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                              <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1Zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H10V7h9v14Z" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {props.sortMilestoneIds(milestones as any[]).map((milestone: any) => (
                            <button
                              key={`st-${String(milestone)}`}
                              type="button"
                              className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs cursor-default"
                            >
                              {props.displayMilestoneCode(
                                String(milestone).trim().split(/\s|–|-|:|\u2013/)[0],
                                String(colleagueData?.profile?.goalsVersion || "2021")
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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

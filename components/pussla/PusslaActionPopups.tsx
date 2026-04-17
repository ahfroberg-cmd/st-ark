"use client";

export default function PusslaActionPopups(props: {
  activityTemplateChangeOpen: boolean;
  templateChangeCurrent: any;
  activityTemplateChangeQueueLength: number;
  handleTemplateDeletedRemoveActivity: () => void | Promise<void>;
  handleTemplateDeletedChangeActivity: () => void | Promise<void>;
  acknowledgeTemplateChangeNotice: (id: string) => void | Promise<void>;
  setActivityTemplateChangeOpen: (value: boolean) => void;
  certMenu: any;
  getCourseDisplayTitle: (course: any) => string;
  openDocumentsFor: (target: { kind: "placement" | "course" | null; id: string | null; label: string }) => void | Promise<void>;
  runCertificateForCertMenu: () => void;
  setCertMenu: (value: any) => void;
}) {
  return (
    <>
      {props.activityTemplateChangeOpen && props.templateChangeCurrent && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" onClick={() => {}}>
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-black px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">Aktivitet uppdaterad av studierektor</h3>
            </div>
            <div className="space-y-4 px-6 py-5 text-sm text-slate-700">
              {String(props.templateChangeCurrent.change_type) === "deleted" ? (
                <>
                  <p>
                    Studierektor har tagit bort aktivitet{" "}
                    <span className="font-semibold text-slate-900">
                      ({String(props.templateChangeCurrent.old_title || "aktivitet")})
                    </span>
                    . Du har den registrerad foljande datum:{" "}
                    {Array.isArray((props.templateChangeCurrent.details || {}).dates) &&
                    (props.templateChangeCurrent.details || {}).dates.length > 0
                      ? (props.templateChangeCurrent.details || {}).dates.join(", ")
                      : "okant datum"}
                    .
                  </p>
                  <p>Vill du andra till annan aktivitet eller radera?</p>
                </>
              ) : (
                <p>
                  Studierektor har bytt namn pa aktivitet{" "}
                  <span className="font-semibold text-slate-900">
                    ({String(props.templateChangeCurrent.old_title || "")})
                  </span>{" "}
                  till{" "}
                  <span className="font-semibold text-slate-900">
                    ({String(props.templateChangeCurrent.new_title || "")})
                  </span>
                  .
                </p>
              )}
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-2">
              {String(props.templateChangeCurrent.change_type) === "deleted" ? (
                <>
                  <button
                    type="button"
                    onClick={() => void props.handleTemplateDeletedRemoveActivity()}
                    className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Radera
                  </button>
                  <button
                    type="button"
                    onClick={() => void props.handleTemplateDeletedChangeActivity()}
                    className="rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Andra aktivitet
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await props.acknowledgeTemplateChangeNotice(String(props.templateChangeCurrent.id || ""));
                    if (props.activityTemplateChangeQueueLength <= 1) {
                      props.setActivityTemplateChangeOpen(false);
                    }
                  }}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {props.certMenu.open && (props.certMenu.placement || props.certMenu.course) && (
        <div
          className="fixed z-[9999]"
          style={{ left: props.certMenu.x, top: props.certMenu.y, transform: "translate(-10px, -50%)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-lg border border-slate-300 bg-white shadow-lg p-2 flex items-center gap-2">
            <button
              className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px hover:bg-slate-200 hover:border-slate-400"
              onClick={() => {
                if (props.certMenu.kind === "placement" && props.certMenu.placement) {
                  const linkedId = String(
                    (props.certMenu.placement as any).linkedPlacementId || props.certMenu.placement.id
                  );
                  const label = props.certMenu.placement.label || props.certMenu.placement.type || "Placering";
                  void props.openDocumentsFor({ kind: "placement", id: linkedId, label });
                } else if (props.certMenu.kind === "course" && props.certMenu.course) {
                  const linkedId = String(
                    (props.certMenu.course as any).linkedCourseId || props.certMenu.course.id
                  );
                  const label = props.getCourseDisplayTitle(props.certMenu.course);
                  void props.openDocumentsFor({ kind: "course", id: linkedId, label });
                } else {
                  void props.openDocumentsFor({ kind: null, id: null, label: "Alla dokument" });
                }
                props.setCertMenu({ open: false, x: 0, y: 0, kind: null, placement: null, course: null });
              }}
            >
              Dokument
            </button>
            <button
              className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold text-slate-900 transition active:translate-y-px hover:bg-slate-200 hover:border-slate-400"
              onClick={() => {
                props.runCertificateForCertMenu();
                props.setCertMenu({ open: false, x: 0, y: 0, kind: null, placement: null, course: null });
              }}
            >
              Intyg
            </button>
            <button
              className="inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs text-slate-500 bg-white hover:bg-slate-100 active:translate-y-px"
              onClick={() =>
                props.setCertMenu({
                  open: false,
                  x: 0,
                  y: 0,
                  kind: null,
                  placement: null,
                  course: null,
                })
              }
              title="Stang"
            >
              x
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import React from "react";
import type { IntygKind } from "@/lib/intygDetect";
import CalendarDatePicker from "@/components/CalendarDatePicker";

type Props = {
  kind: IntygKind | null;
  parsed: any;
  setParsed: React.Dispatch<any>;
  titleLabel: string;
  clinicLabel: string;
  descriptionLabel: string;
  isNoDates: boolean;
  isCourseKind: boolean;
  attachUploadedDocument: boolean;
  setAttachUploadedDocument: React.Dispatch<React.SetStateAction<boolean>>;
  attachDocumentLabel: string;
  previewUrl: string | null;
  fileName: string;
  busy: boolean;
  handleSave: () => Promise<void>;
  activityTypeLabelCap: string;
};

export function ScannedCertificateReviewForm({
  kind,
  parsed,
  setParsed,
  titleLabel,
  clinicLabel,
  descriptionLabel,
  isNoDates,
  isCourseKind,
  attachUploadedDocument,
  setAttachUploadedDocument,
  attachDocumentLabel,
  previewUrl,
  fileName,
  busy,
  handleSave,
  activityTypeLabelCap,
}: Props) {
  return (
    <>
      <div className="space-y-4">
        <div className="text-base font-semibold text-slate-900">
          {kind === "2021-B11-UTV"
            ? "Förhandsgranskning - Utvecklingsarbete"
            : kind === "2021-B10-KURS" && parsed?.courseTitle
              ? `Förhandsgranskning – Kurs: ${parsed.courseTitle}`
              : kind === "2015-B5-KURS" && parsed?.subject
                ? `Förhandsgranskning – Kurs: ${parsed.subject}`
                : titleLabel
                  ? `Förhandsgranskning – ${titleLabel}`
                  : "Förhandsgranskning"}
        </div>

        <div className="text-xs text-slate-700">Titta igenom resultatet noggrant, det finns risk för fel.</div>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-900">Namn</label>
              <input
                value={parsed?.fullName ?? ""}
                onChange={(e) =>
                  setParsed((p: any) => ({
                    ...p,
                    fullName: e.target.value,
                  }))
                }
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-900">Personnummer</label>
              <input
                value={parsed?.personnummer ?? ""}
                onChange={(e) =>
                  setParsed((p: any) => ({
                    ...p,
                    personnummer: e.target.value,
                  }))
                }
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              />
            </div>
          </div>

          <div className={`grid grid-cols-1 gap-3 ${clinicLabel ? "md:grid-cols-2" : ""}`}>
            <div className="space-y-2">
              <label
                className="block text-xs font-medium text-slate-900"
                data-info="Specialitet som ansökan avser - den specialitet som intyget gäller för."
              >
                Specialitet som ansökan avser
              </label>
              <input
                value={parsed?.specialtyHeader?.trim() ?? ""}
                onChange={(e) =>
                  setParsed((p: any) => ({
                    ...p,
                    specialtyHeader: e.target.value.trim() || undefined,
                  }))
                }
                className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                data-info="Ange specialitet som ansökan avser. Detta är den specialitet som intyget gäller för."
              />
            </div>
            {clinicLabel && (
              <div className="space-y-2">
                <label
                  className="block text-xs font-medium text-slate-900"
                  data-info={`${clinicLabel} - kliniken eller verksamheten där aktiviteten genomfördes.`}
                >
                  {clinicLabel}
                </label>
                <input
                  value={parsed?.clinic ?? ""}
                  onChange={(e) =>
                    setParsed((p: any) => ({
                      ...p,
                      clinic: e.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                  data-info={`Ange ${clinicLabel.toLowerCase()} - kliniken eller verksamheten där aktiviteten genomfördes.`}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label
              className="block text-xs font-medium text-slate-900"
              data-info="Delmål som intyget avser - ange delmålskoder separerade med kommatecken (t.ex. 'a1, a2, b3')."
            >
              Delmål (komma-separerade)
            </label>
            <input
              value={(parsed?.delmalCodes ?? []).join(", ")}
              onChange={(e) =>
                setParsed((p: any) => ({
                  ...p,
                  delmalCodes: e.target.value
                    .split(",")
                    .map((x: string) => x.trim())
                    .filter(Boolean),
                }))
              }
              className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
              data-info="Ange delmålskoder som intyget avser, separerade med kommatecken. Exempel: 'a1, a2, b3'. Dessa delmål kopplas till aktiviteten i tidslinjen."
            />
          </div>

          {!isNoDates && kind !== "2021-B10-KURS" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <CalendarDatePicker
                  label="Start"
                  value={parsed?.period?.startISO ?? ""}
                  onChange={(iso) =>
                    setParsed((p: any) => {
                      const currentEnd = p?.period?.endISO || "";
                      const newEnd = iso && currentEnd && currentEnd < iso ? iso : currentEnd;
                      return {
                        ...p,
                        period: {
                          ...(p?.period ?? {}),
                          startISO: iso,
                          endISO: newEnd || p?.period?.endISO,
                        },
                      };
                    })
                  }
                  align="left"
                  data-info="Välj startdatum för aktiviteten. Detta är datumet när aktiviteten börjar och används för placering i tidslinjen."
                />
              </div>
              <div>
                <CalendarDatePicker
                  label="Slut"
                  value={parsed?.period?.endISO ?? ""}
                  minDate={parsed?.period?.startISO || undefined}
                  onChange={(iso) =>
                    setParsed((p: any) => ({
                      ...p,
                      period: {
                        ...(p?.period ?? {}),
                        endISO: iso,
                      },
                    }))
                  }
                  align="right"
                  data-info="Välj slutdatum för aktiviteten. Detta är datumet när aktiviteten slutar och måste vara samma eller senare än startdatumet."
                />
              </div>
            </div>
          )}

          {kind === "2021-B10-KURS" && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-900">Ange datum för placering i Tidslinjen</label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <CalendarDatePicker
                    label="Start"
                    value={parsed?.period?.startISO ?? ""}
                    onChange={(iso) =>
                      setParsed((p: any) => {
                        const currentEnd = p?.period?.endISO || "";
                        const newEnd = iso && currentEnd && currentEnd < iso ? iso : currentEnd;
                        return {
                          ...p,
                          period: {
                            ...(p?.period ?? {}),
                            startISO: iso,
                            endISO: newEnd || p?.period?.endISO,
                          },
                          showOnTimeline: true,
                        };
                      })
                    }
                    align="left"
                    data-info="Välj startdatum för kursen. Detta är datumet när kursen börjar och används för placering i tidslinjen."
                  />
                </div>
                <div>
                  <CalendarDatePicker
                    label="Slut"
                    value={parsed?.period?.endISO ?? ""}
                    minDate={parsed?.period?.startISO || undefined}
                    onChange={(iso) =>
                      setParsed((p: any) => ({
                        ...p,
                        period: {
                          ...(p?.period ?? {}),
                          endISO: iso,
                        },
                        showOnTimeline: true,
                      }))
                    }
                    align="right"
                    data-info="Välj slutdatum för kursen. Detta är datumet när kursen slutar och måste vara samma eller senare än startdatumet."
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-medium text-slate-900 mb-1"
                    data-info="Välj hur kursen ska visas i tidslinjen - antingen som en punkt vid slutdatum eller som ett intervall från start till slut."
                  >
                    Visa i tidslinjen
                  </label>
                  <select
                    value={(parsed as any)?.showAsInterval ? "interval" : "date"}
                    onChange={(e) =>
                      setParsed((p: any) => ({
                        ...p,
                        showAsInterval: e.target.value === "interval",
                      }))
                    }
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                    data-info="Välj hur kursen ska visas i tidslinjen: 'Enbart slutdatum' visar kursen som en punkt vid slutdatum, 'Start till slut' visar kursen som ett intervall."
                  >
                    <option value="date">Enbart slutdatum</option>
                    <option value="interval">Start till slut</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {(kind === "2021-B11-UTV" || kind === "2015-B6-UTV" || kind === "2015-B7-SKRIFTLIGT") && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-900">Ange datum för placering i Tidslinjen</label>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <CalendarDatePicker
                    label="Start"
                    value={parsed?.period?.startISO ?? ""}
                    onChange={(iso) =>
                      setParsed((p: any) => {
                        const currentEnd = p?.period?.endISO || "";
                        const newEnd = iso && currentEnd && currentEnd < iso ? iso : currentEnd;
                        return {
                          ...p,
                          period: {
                            ...(p?.period ?? {}),
                            startISO: iso,
                            endISO: newEnd || p?.period?.endISO,
                          },
                          showOnTimeline: true,
                        };
                      })
                    }
                    align="left"
                    data-info="Välj startdatum för utvecklingsarbetet. Detta är datumet när arbetet börjar och används för placering i tidslinjen."
                  />
                </div>
                <div>
                  <CalendarDatePicker
                    label="Slut"
                    value={parsed?.period?.endISO ?? ""}
                    minDate={parsed?.period?.startISO || undefined}
                    onChange={(iso) =>
                      setParsed((p: any) => ({
                        ...p,
                        period: {
                          ...(p?.period ?? {}),
                          endISO: iso,
                        },
                        showOnTimeline: true,
                      }))
                    }
                    align="right"
                    data-info="Välj slutdatum för utvecklingsarbetet. Detta är datumet när arbetet slutar och måste vara samma eller senare än startdatumet."
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-900">{descriptionLabel}</label>
            <textarea
              value={parsed?.description ?? ""}
              onChange={(e) =>
                setParsed((p: any) => ({
                  ...p,
                  description: e.target.value,
                }))
              }
              rows={4}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300 whitespace-pre-wrap"
            />
          </div>

          {isCourseKind ? (
            <div className="grid grid-cols-1 gap-3">
              {kind === "2015-B5-KURS" && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-900">Kursledare</label>
                  <input
                    value={(parsed as any)?.courseLeader ?? ""}
                    onChange={(e) =>
                      setParsed((p: any) => ({
                        ...p,
                        courseLeader: e.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">Intygande</label>
                <div className="mt-1 flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-1 text-sm text-slate-800">
                    <input
                      type="radio"
                      className="h-4 w-4.5"
                      checked={(parsed?.signingRole ?? "handledare") === "kursledare"}
                      onChange={() =>
                        setParsed((p: any) => ({
                          ...p,
                          signingRole: "kursledare",
                        }))
                      }
                    />
                    <span>Kursledare</span>
                  </label>
                  <label className="inline-flex items-center gap-1 text-sm text-slate-800">
                    <input
                      type="radio"
                      className="h-4 w-4.5"
                      checked={(parsed?.signingRole ?? "handledare") === "handledare"}
                      onChange={() =>
                        setParsed((p: any) => ({
                          ...p,
                          signingRole: "handledare",
                        }))
                      }
                    />
                    <span>Handledare</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">Intygandes namn</label>
                <input
                  value={parsed?.supervisorName ?? ""}
                  onChange={(e) =>
                    setParsed((p: any) => ({
                      ...p,
                      supervisorName: e.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
              {(kind !== "2021-B10-KURS" || (parsed?.signingRole ?? "handledare") === "handledare") && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-900">Intygandes specialitet</label>
                  <input
                    value={parsed?.supervisorSpeciality ?? ""}
                    onChange={(e) =>
                      setParsed((p: any) => ({
                        ...p,
                        supervisorSpeciality: e.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">
                  {kind === "2021-B10-KURS" ? "Tjänsteställe" : "Intygandes tjänsteställe"}
                </label>
                <input
                  value={parsed?.supervisorSite ?? ""}
                  onChange={(e) =>
                    setParsed((p: any) => ({
                      ...p,
                      supervisorSite: e.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">Handledare</label>
                <input
                  value={parsed?.supervisorName ?? ""}
                  onChange={(e) =>
                    setParsed((p: any) => ({
                      ...p,
                      supervisorName: e.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">Handledares specialitet</label>
                <input
                  value={parsed?.supervisorSpeciality ?? ""}
                  onChange={(e) =>
                    setParsed((p: any) => ({
                      ...p,
                      supervisorSpeciality: e.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-900">Handledares tjänsteställe</label>
                <input
                  value={parsed?.supervisorSite ?? ""}
                  onChange={(e) =>
                    setParsed((p: any) => ({
                      ...p,
                      supervisorSite: e.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-300"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
        <label className="mr-auto inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={attachUploadedDocument}
            onChange={(e) => setAttachUploadedDocument(e.target.checked)}
          />
          {attachDocumentLabel}
        </label>
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-sky-700 underline hover:text-sky-800"
          >
            {fileName}
          </a>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy || !parsed}
          className="inline-flex items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
          data-info={`Sparar och stänger fönstret. ${activityTypeLabelCap} placeras in i tidslinjen.`}
        >
          {busy ? "Sparar…" : "Spara och stäng"}
        </button>
      </footer>
    </>
  );
}

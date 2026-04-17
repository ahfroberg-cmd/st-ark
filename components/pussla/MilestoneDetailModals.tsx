"use client";

import { COMMON_AB_MILESTONES } from "@/lib/goals-common";
import { normalizeGoalsVersion } from "@/lib/pussla/goalsVersion";

export default function MilestoneDetailModals(props: {
  btMilestoneDetail: string | null;
  setBtMilestoneDetail: (value: string | null) => void;
  btMilestones: Array<{ id: string; title: string; bullets: string[] }>;
  stMilestoneDetail: string | null;
  setStMilestoneDetail: (value: string | null) => void;
  goals: any;
  profileGoalsVersion: string | null | undefined;
  displayMilestoneCode: (code: string, goalsVersion: string | undefined) => string;
}) {
  const goalsVersionRaw = props.profileGoalsVersion || undefined;

  const btModal = props.btMilestoneDetail
    ? (() => {
        const id = String(props.btMilestoneDetail).toUpperCase();
        const milestone = props.btMilestones.find((x) => x.id === id);
        return (
          <div
            className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) props.setBtMilestoneDetail(null);
            }}
          >
            <div
              className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 gap-4">
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 shrink-0">
                    {props.displayMilestoneCode(id, goalsVersionRaw)}
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
                    {milestone?.title ?? "BT-delmål"}
                  </h3>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                {milestone ? (
                  <div className="prose prose-slate max-w-none text-[14px] leading-relaxed text-slate-900">
                    <ul className="list-disc space-y-2 pl-5 text-slate-900">
                      {milestone.bullets.map((bullet, index) => (
                        <li key={index} className="text-slate-900">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-slate-900">Information saknas för {id}.</div>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => props.setBtMilestoneDetail(null)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
                >
                  Stäng
                </button>
              </footer>
            </div>
          </div>
        );
      })()
    : null;

  const stModal =
    props.stMilestoneDetail && props.goals
      ? (() => {
          const normalizeCode = (raw: string): string => {
            const base = String(raw ?? "").trim().split(/\s|–|-|:|\u2013/)[0];
            const up = base.toUpperCase().replace(/\s+/g, "");
            const m = up.match(/^ST([ABC])(\d+)$/) || up.match(/^([ABC])(\d+)$/);
            if (m) {
              const letter = m[1].toUpperCase();
              const num = parseInt(m[2], 10) || 0;
              return `${letter}${num}`;
            }
            return up;
          };

          const normalizedId = normalizeCode(props.stMilestoneDetail);
          const goalsVersion = normalizeGoalsVersion(goalsVersionRaw);
          const fromGoals = props.goals.milestones.find((x: any) => {
            const idK = normalizeCode(x.id);
            const codeK = normalizeCode(x.code || "");
            return idK === normalizedId || codeK === normalizedId;
          });

          const commonMatches = Object.values(COMMON_AB_MILESTONES).filter((cm: any) => {
            const idK = normalizeCode(cm?.id || "");
            const codeK = normalizeCode(cm?.code || "");
            return idK === normalizedId || codeK === normalizedId;
          }) as any[];

          const fromCommon =
            commonMatches.find((cm: any) => {
              const raw = String(cm?.code ?? cm?.id ?? "").toUpperCase().replace(/\s+/g, "");
              if (goalsVersion === "2021") return /^ST[AB]\d+$/i.test(raw);
              return /^[AB]\d+$/i.test(raw);
            }) ?? commonMatches[0] ?? null;

          const isAbMilestone = /^[AB]\d+$/i.test(normalizedId);
          const milestone =
            goalsVersion === "2015" && isAbMilestone
              ? (fromCommon as any) ?? (fromGoals as any)
              : (fromGoals as any) ?? (fromCommon as any);

          if (!milestone) return null;

          const descriptionText =
            typeof milestone.description === "string" ? milestone.description.trim() : "";
          const sectionArray = Array.isArray(milestone.sections)
            ? (milestone.sections as Array<{ title?: string; items?: unknown[]; text?: unknown }>)
            : [];
          const toText = (v: unknown) =>
            typeof v === "string"
              ? v
              : v == null
              ? ""
              : Array.isArray(v)
              ? v.join("\n")
              : String(v);
          const sectionsObj =
            milestone.sections &&
            !Array.isArray(milestone.sections) &&
            typeof milestone.sections === "object"
              ? (milestone.sections as Record<string, unknown>)
              : null;
          const legacySections = [
            { key: "kompetenskrav", title: "Kompetenskrav", text: toText(sectionsObj?.kompetenskrav) },
            {
              key: "utbildningsaktiviteter",
              title: "Utbildningsaktiviteter",
              text: toText(sectionsObj?.utbildningsaktiviteter),
            },
            { key: "intyg", title: "Intyg", text: toText(sectionsObj?.intyg) },
            { key: "allmannaRad", title: "Allmänna råd", text: toText(sectionsObj?.allmannaRad) },
          ] as const;
          const visibleLegacy = legacySections.filter((s) => s.text.trim().length > 0);
          const titleCode = props.displayMilestoneCode(
            String(milestone.code || milestone.id || ""),
            goalsVersionRaw
          );

          return (
            <div
              className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) props.setStMilestoneDetail(null);
              }}
            >
              <div
                className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 gap-4">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 shrink-0">
                      {titleCode}
                    </span>
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
                      {milestone.title}
                    </h3>
                  </div>
                </header>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {descriptionText.length > 0 ? (
                    <p className="text-[14px] leading-relaxed text-slate-900 mb-4">{descriptionText}</p>
                  ) : null}
                  {sectionArray.length > 0 ? (
                    <div className="space-y-4">
                      {sectionArray.map((sec, idx) => {
                        const text = toText(sec?.text).trim();
                        const items = Array.isArray(sec?.items) ? sec.items : [];
                        if (!sec?.title && items.length === 0 && text.length === 0) return null;
                        return (
                          <section key={idx}>
                            {sec?.title ? (
                              <div className="mb-1 text-[13px] font-semibold text-slate-900">{sec.title}</div>
                            ) : null}
                            {items.length > 0 ? (
                              <ul className="list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-slate-900">
                                {items.map((it, i) => (
                                  <li key={i} className="text-slate-900">
                                    {typeof it === "string" ? it : String(it)}
                                  </li>
                                ))}
                              </ul>
                            ) : text.length > 0 ? (
                              <p className="text-[14px] leading-relaxed text-slate-900">{text}</p>
                            ) : null}
                          </section>
                        );
                      })}
                    </div>
                  ) : visibleLegacy.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                      Ingen beskrivning hittades i målfilen.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {visibleLegacy.map((s) => (
                        <article key={s.key} className="border border-slate-200 rounded-xl p-3 bg-white">
                          <div className="font-bold mb-1.5 text-slate-900">{s.title}</div>
                          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-900 leading-relaxed">
                            {s.text}
                          </pre>
                        </article>
                      ))}
                    </div>
                  )}
                  {milestone.sourceUrl && (
                    <div className="text-xs mt-3 text-slate-600">
                      Källa:{" "}
                      <a href={milestone.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                        målbeskrivningen
                      </a>
                    </div>
                  )}
                </div>
                <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
                  <button
                    type="button"
                    onClick={() => props.setStMilestoneDetail(null)}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
                  >
                    Stäng
                  </button>
                </footer>
              </div>
            </div>
          );
        })()
      : null;

  return (
    <>
      {btModal}
      {stModal}
    </>
  );
}

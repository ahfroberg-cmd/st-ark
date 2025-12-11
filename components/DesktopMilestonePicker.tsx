// components/DesktopMilestonePicker.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { GoalsCatalog, GoalsMilestone } from "@/lib/goals";
import { db } from "@/lib/db";
import { mergeWithCommon, COMMON_AB_MILESTONES } from "@/lib/goals-common";

/**
 * Trim av rubriker utan flimmer – samma som i MilestoneOverviewModal.
 */
function TitleTrimmer({ text, className }: { text: string; className?: string }) {
  const maxLength = 80;
  const display = text.length > maxLength ? text.slice(0, maxLength).trimEnd() + "..." : text;
  return (
    <span className={className} title={text}>
      {display}
    </span>
  );
}

type Props = {
  open: boolean;
  title: string;
  goals: GoalsCatalog | null;
  checked: Set<string>;
  onToggle: (milestoneId: string) => void;
  onClose: () => void;
};

export default function DesktopMilestonePicker({ open, title, goals, checked, onToggle, onClose }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [hoveredCheckbox, setHoveredCheckbox] = useState<string | null>(null);
  const [planByMilestone, setPlanByMilestone] = useState<Record<string, string>>({});
  const q = ""; // Sökfunktionalitet borttagen

  // Ladda planer för delmål
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const anyDb = db as any;
        const table =
          anyDb.iupMilestonePlans ??
          anyDb.milestonePlans ??
          (typeof anyDb.table === "function" ? anyDb.table("iupMilestonePlans") : null);
        if (table && typeof table.toArray === "function") {
          const rows = await table.toArray();
          const map: Record<string, string> = {};
          for (const row of rows as any[]) {
            const mid = String((row as any).milestoneId ?? (row as any).id ?? "");
            if (!mid) continue;
            const text = String((row as any).planText ?? (row as any).text ?? "");
            map[mid] = text;
          }
          setPlanByMilestone(map);
        } else {
          setPlanByMilestone({});
        }
      } catch {
        setPlanByMilestone({});
      }
    })();
  }, [open]);

  // Förhindra scroll på body när popup är öppen
  useEffect(() => {
    if (open || detailId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, detailId]);

  // Normalisera koder så att "a1", "A1", "STa1" etc hamnar på samma nyckel ("A1")
  const normalizeCode = (raw: string): string => {
    const base = String(raw ?? "").trim().split(/\s|–|-|:|\u2013/)[0];
    const up = base.toUpperCase().replace(/\s+/g, "");

    const m =
      up.match(/^ST([ABC])(\d+)$/) ||
      up.match(/^([ABC])(\d+)$/);

    if (m) {
      const letter = m[1].toUpperCase();
      const num = parseInt(m[2], 10) || 0;
      return `${letter}${num}`;
    }

    return up;
  };

  // Set med alla normaliserade koder från checked (för METIS-auto mm)
  const normalizedChecked = useMemo(() => {
    const s = new Set<string>();
    checked.forEach((v) => {
      const key = normalizeCode(String(v ?? ""));
      if (key) s.add(key);
    });
    return s;
  }, [checked]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Gruppindelning + filtrering (A/B vänster, C höger) – följer MilestoneOverviewModal
  const groups = useMemo(() => {
    const res: Record<"A" | "B" | "C", GoalsMilestone[]> = { A: [], B: [], C: [] };
    if (!goals) return res;

    const seen: Record<"A" | "B" | "C", Set<string>> = {
      A: new Set<string>(),
      B: new Set<string>(),
      C: new Set<string>(),
    };

    const match = (m: GoalsMilestone) => {
      return true; // Ingen filtrering - visa alla delmål
    };

    const codeNum = (code: string) => {
      const m = code.match(/(\d+)\s*$/i);
      return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
    };
    const cmp = (a: GoalsMilestone, b: GoalsMilestone) => {
      const na = codeNum(a.code);
      const nb = codeNum(b.code);
      if (na !== nb) return na - nb;
      return a.code.localeCompare(b.code, "sv");
    };

    // Bas: alla delmål i specialitetens katalog
    const baseArr: GoalsMilestone[] = Array.isArray((goals as any).milestones)
      ? ((goals as any).milestones as GoalsMilestone[])
      : [];

    // Utökad lista som vi kan komplettera/justera
    let arr: GoalsMilestone[] = [...baseArr];

    // Om katalogen innehåller STc-delmål (2021) kompletterar vi med gemensamma STa/STb från COMMON_AB_MILESTONES
    const hasStc = baseArr.some((m: any) =>
      /^STc\d+$/i.test(String((m as any).code ?? (m as any).id ?? ""))
    );

    if (hasStc) {
      // 2021: behåll specialitetens egna STa/STb/STc och lägg till gemensamma STa/STb där de saknas
      const existingKeys = new Set(
        arr
          .map((m: any) =>
            String((m as any).code ?? (m as any).id ?? "")
              .toUpperCase()
              .replace(/\s+/g, "")
          )
          .filter(Boolean)
      );

      Object.values(COMMON_AB_MILESTONES).forEach((cm: any) => {
        const codeRaw = String(cm.code ?? cm.id ?? "");
        const codeKey = codeRaw.toUpperCase().replace(/\s+/g, "");

        // 2021-varianten av gemensamma A/B: STa1, STb3 osv
        if (!/^ST[AB]\d+$/i.test(codeRaw)) return;
        if (existingKeys.has(codeKey)) return;

        arr.push(cm as GoalsMilestone);
      });
    } else {
      // 2015: ersätt A- och B-delmål i specialitetens katalog med gemensamma A1..A6, B1..B5 från COMMON_AB_MILESTONES
      const withoutAb = baseArr.filter((m: any) => {
        const rawGroup = String((m as any).group ?? "").toUpperCase();
        const codeRaw = String((m as any).code ?? (m as any).id ?? "")
          .toUpperCase()
          .replace(/\s+/g, "");

        // Släng bort allt som tydligt är A- eller B-delmål
        if (rawGroup === "A" || rawGroup === "B") return false;
        if (/^[AB]\d+$/i.test(codeRaw)) return false;

        return true;
      });

      const commonAb = (Object.values(COMMON_AB_MILESTONES) as any[]).filter((cm) => {
        const codeRaw = String(cm.code ?? cm.id ?? "");
        const key = codeRaw.toUpperCase().replace(/\s+/g, "");
        // 2015-varianten: alla A1..A6, B1..B5 där koden börjar med A/B + siffra
        return /^[AB]\d+/i.test(key);
      }) as GoalsMilestone[];

      arr = [...withoutAb, ...commonAb];
    }

    const is2015 = !hasStc;

    const determineGroup = (m: GoalsMilestone): "A" | "B" | "C" | undefined => {
      const code = (m.code || "").toLowerCase();
      const rawGroup = ((m as any).group ?? "").toString().toLowerCase();
      let g: "A" | "B" | "C" | undefined;

      if (rawGroup === "a" || rawGroup === "b" || rawGroup === "c") {
        g = rawGroup.toUpperCase() as "A" | "B" | "C";
      } else if (rawGroup === "sta" || rawGroup === "stb" || rawGroup === "stc") {
        const letter = rawGroup[2];
        g = letter.toUpperCase() as "A" | "B" | "C";
      } else if (rawGroup.startsWith("st") && rawGroup.length >= 3) {
        const letter = rawGroup[2];
        if (letter === "a" || letter === "b" || letter === "c") {
          g = letter.toUpperCase() as "A" | "B" | "C";
        }
      } else if (code.startsWith("sta")) {
        g = "A";
      } else if (code.startsWith("stb")) {
        g = "B";
      } else if (code.startsWith("stc")) {
        g = "C";
      } else if (/^a\d+/.test(code)) {
        g = "A";
      } else if (/^b\d+/.test(code)) {
        g = "B";
      } else if (/^c\d+/.test(code)) {
        g = "C";
      }

      return g;
    };

    const resolveForDisplay = (m: GoalsMilestone): GoalsMilestone => {
      const raw = String((m.code ?? m.id) ?? "");
      const key = raw.toUpperCase().replace(/\s+/g, "");
      const isCommonAB2015 = is2015 && /^[AB]\d+/i.test(key);

      if (!isCommonAB2015) return m;

      const commonByKey =
        (COMMON_AB_MILESTONES as any)[key] ??
        (COMMON_AB_MILESTONES as any)[key.toLowerCase()];

      if (!commonByKey) {
        const commonByCode = Object.values(COMMON_AB_MILESTONES as any).find((cm: any) => {
          const codeRaw = String(cm?.code ?? cm?.id ?? "");
          const codeKey = codeRaw.toUpperCase().replace(/\s+/g, "");
          return codeKey === key;
        }) as GoalsMilestone | undefined;
        if (!commonByCode) return m;

        return {
          ...m,
          title: commonByCode.title ?? m.title,
          sections: (commonByCode as any).sections ?? (m as any).sections,
          group: (commonByCode as any).group ?? (m as any).group,
        } as GoalsMilestone;
      }

      return {
        ...m,
        title: (commonByKey as any).title ?? m.title,
        sections: (commonByKey as any).sections ?? (m as any).sections,
        group: (commonByKey as any).group ?? (m as any).group,
      } as GoalsMilestone;
    };

    for (const m of arr) {
      if (!match(m as GoalsMilestone)) continue;

      const display = resolveForDisplay(m as GoalsMilestone);
      const g = determineGroup(display);
      if (!g) continue;

      const keyNorm = String((display as any).id ?? (display as any).code ?? "")
        .toUpperCase()
        .replace(/\s+/g, "");
      if (!keyNorm) continue;
      if (seen[g].has(keyNorm)) continue;
      seen[g].add(keyNorm);

      res[g].push(display);
    }

    (["A", "B", "C"] as const).forEach((g) => res[g].sort(cmp));
    return res;
  }, [goals, q]);

  // Hitta milestone för detaljvyn
  const detailMilestone = useMemo(() => {
    if (!detailId || !goals) return null;
    const mid = detailId;
    const U = String(mid).toUpperCase().replace(/\s+/g, "");

    // Avgör målversion utifrån om STc-mål finns i katalogen
    const milestonesArr: GoalsMilestone[] = Array.isArray((goals as any)?.milestones)
      ? (((goals as any).milestones as GoalsMilestone[]))
      : [];
    const hasStc = milestonesArr.some((x: any) =>
      /^STc\d+$/i.test(String((x as any).code ?? (x as any).id ?? ""))
    );
    const is2015 = !hasStc;
    const isAb2015 = is2015 && /^[AB]\d+$/i.test(U);

    if (isAb2015) {
      // 2015: A- och B-delmål ska hämtas enbart från COMMON_AB_MILESTONES
      const abKey = U.replace(/^ST([ABC])(\d+)$/, "$1$2");
      const stKey = U.match(/^[ABC]\d+$/) ? `ST${U}` : U;

      return (
        (COMMON_AB_MILESTONES[U] as any) ||
        (COMMON_AB_MILESTONES[abKey] as any) ||
        (COMMON_AB_MILESTONES[stKey] as any) ||
        null
      );
    } else {
      const base =
        goals?.milestones.find(
          (x) => (x as any).id === mid || (x as any).code === mid
        ) ?? null;

      // För 2021/ST-mål – slå ihop med gemensam A/B-text om sådan finns.
      const m = mergeWithCommon(base);

      // Om vi inte hittar i goals (t.ex. pga kod-id mismatch), försök med gemensam källa direkt.
      if (!m) {
        const abKey = U.replace(/^ST([ABC])(\d+)$/, "$1$2");
        const stKey = U.match(/^[ABC]\d+$/) ? `ST${U}` : U;

        return (
          (COMMON_AB_MILESTONES[U] as any) ||
          (COMMON_AB_MILESTONES[abKey] as any) ||
          (COMMON_AB_MILESTONES[stKey] as any) ||
          null
        );
      }

      return m;
    }
  }, [detailId, goals]);

  const isDetailChecked = detailId ? (checked.has(detailId) || normalizedChecked.has(normalizeCode(String(detailId)))) : false;

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[260] grid place-items-center bg-black/40 p-3"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-[980px] overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header – vit header för laptop */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
            >
              Spara och stäng
            </button>
          </header>

          {/* Body – två kolumner: A+B vänster, C höger; grå rutor */}
          <section className="max-h-[75vh] overflow-auto p-5">
            {!goals ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                Laddar mål…
              </div>
            ) : groups.A.length + groups.B.length + groups.C.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                Inga delmål matchar sökningen.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Kolumn 1: Delmål A + B */}
                <section>
                  <h3 className="mb-2 text-[12px] font-semibold text-slate-900">Delmål A</h3>
                  <div className="mb-4 space-y-1.5">
                    {groups.A.map((m) => renderRow(m))}
                    {groups.A.length === 0 && <div className="text-[12px] text-slate-900">—</div>}
                  </div>

                  <h3 className="mb-2 text-[12px] font-semibold text-slate-900">Delmål B</h3>
                  <div className="space-y-1.5">
                    {groups.B.map((m) => renderRow(m))}
                    {groups.B.length === 0 && <div className="text-[12px] text-slate-900">—</div>}
                  </div>
                </section>

                {/* Kolumn 2: Delmål C */}
                <section>
                  <h3 className="mb-2 text-[12px] font-semibold text-slate-900">Delmål C</h3>
                  <div className="space-y-1.5">
                    {groups.C.map((m) => renderRow(m))}
                    {groups.C.length === 0 && <div className="text-[12px] text-slate-900">—</div>}
                  </div>
                </section>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Detalj-popup – matchar IUP->Delmål design men read-only */}
      {detailId && detailMilestone && (() => {
        const m = detailMilestone;
        const mid = detailId;
        const planText = planByMilestone[mid] ?? "";
        const titleCode = String((m as any)?.code ?? mid).toLowerCase();

        const suggestionItems: string[] = [
          "Klinisk tjänstgöring",
          "Auskultation",
          "Självständigt skriftligt arbete",
          "Kvalitets-/förbättringsarbete",
          "Kurs/er",
          "Handledning av studenter/AT/BT/underläkare",
          "Undervisning för studenter/AT/BT/underläkare",
          "Deltagande i reflektionsgrupp",
          "Journal Club",
          "Deltagande i kurs/kongress",
          "Återkoppling till kliniken efter kurs/kongress",
          "Leda och delta i APT",
          "Kontinuerlig uppföljning av huvudhandledare",
          "Mini Clinical Evaluation Exercise (Mini-CEX)",
          "Case-based discussion (CBD)",
          "Medsittning",
          "360-gradersbedömning",
          "ST-kollegium",
        ];

        return (
          <div
            className="fixed inset-0 z-[400] grid place-items-center bg-black/40 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDetailId(null);
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
                    {String((m as any)?.title ?? "Delmål")}
                  </h3>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                {m ? (
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
                    {/* Vänster: beskrivning från målfilen */}
                    <div className="space-y-4">
                      {typeof (m as any).description === "string" &&
                      (m as any).description.trim().length > 0 ? (
                        <p className="text-[14px] leading-relaxed text-slate-900">
                          {(m as any).description}
                        </p>
                      ) : null}

                      {Array.isArray((m as any).sections) && (m as any).sections.length > 0 ? (
                        <div className="space-y-4">
                          {(m as any).sections.map(
                            (sec: { title?: string; items?: any[]; text?: string }, idx: number) => (
                              <section key={idx}>
                                {sec.title ? (
                                  <div className="mb-1 text-[13px] font-semibold text-slate-900">
                                    {sec.title}
                                  </div>
                                ) : null}
                                {Array.isArray(sec.items) ? (
                                  <ul className="list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-slate-900">
                                    {sec.items.map((it, i) => (
                                      <li key={i} className="text-slate-900">{typeof it === "string" ? it : String(it)}</li>
                                    ))}
                                  </ul>
                                ) : sec.text ? (
                                  <p className="text-[14px] leading-relaxed text-slate-900">
                                    {sec.text}
                                  </p>
                                ) : null}
                              </section>
                            )
                          )}
                        </div>
                      ) : !((m as any).description) ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                          Ingen beskrivning hittades i målfilen.
                        </div>
                      ) : null}
                    </div>

                    {/* Höger: plan + förslag (read-only) */}
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 text-[13px] font-semibold text-slate-900">
                          Planerade metoder och bedömningsinstrument
                        </div>
                        <textarea
                          value={planText}
                          readOnly
                          className="w-full rounded-lg border border-slate-300 px-2 py-2 text-[13px] leading-relaxed text-slate-900 bg-slate-50 cursor-not-allowed"
                          style={{ minHeight: 120, resize: "vertical" }}
                        />
                      </div>

                      <div className="flex h-full flex-col">
                        <div className="mb-1 text-[13px] font-semibold text-slate-900">
                          Förslag
                        </div>
                        <div className="max-h-[120px] flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <ul className="space-y-1.5 text-[13px] text-slate-900">
                            {suggestionItems.map((s) => (
                              <li key={s} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  disabled
                                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-300 cursor-not-allowed opacity-50"
                                />
                                <span className="leading-snug text-slate-900">{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-900">
                    Information saknas för det valda delmålet.
                  </div>
                )}
              </div>

              {/* Footer med Markera/Avmarkera och Stäng */}
              <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => {
                    onToggle(mid);
                    setDetailId(null);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold text-white hover:opacity-90 active:translate-y-px"
                  style={{
                    background: isDetailChecked ? "#ef4444" : "#10b981",
                    borderColor: isDetailChecked ? "#ef4444" : "#10b981",
                  }}
                >
                  {isDetailChecked ? "Avmarkera delmål" : "Markera delmål"}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailId(null)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:translate-y-px"
                >
                  Stäng
                </button>
              </footer>
            </div>
          </div>
        );
      })()}
    </>
  );

  /** En rad (grå ruta med chip + titel till vänster, stor vit kryssruta till höger). */
  function renderRow(m: GoalsMilestone) {
    const mid = (m as any).id ?? (m as any).code ?? "";
    const codeRaw = String((m as any).code ?? mid ?? "");
    const norm = normalizeCode(codeRaw);
    const isChecked = mid ? (checked.has(mid) || normalizedChecked.has(norm)) : false;

    return (
      <article
        key={mid}
        onClick={() => setDetailId(mid)}
        className={
          "grid cursor-pointer grid-cols-[1fr_auto] items-center gap-2 rounded-lg border px-3 py-2 transition " +
          (isChecked
            ? "border-emerald-200 bg-emerald-50" + (hoveredCheckbox === mid ? "" : " hover:bg-emerald-100")
            : "border-slate-200 bg-slate-50" + (hoveredCheckbox === mid ? "" : " hover:bg-slate-100"))
        }
      >
        {/* Vänster: chip + titel (öppnar info) */}
        <button
          type="button"
          onClick={() => setDetailId(mid)}
          className="dm-row flex min-w-0 items-center gap-2 text-left text-slate-800"
          title="Visa information om delmålet"
        >
          <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-800">
            {String((m as any).code ?? "").toLowerCase()}
          </span>
          <TitleTrimmer text={String((m as any).title ?? "")} className="truncate text-[12px]" />
        </button>

        {/* Höger: stor kryssruta */}
        <label
          className="grid h-8 w-8 place-items-center rounded-md"
          title={isChecked ? "Avmarkera delmål" : "Markera delmål"}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={() => setHoveredCheckbox(mid)}
          onMouseLeave={() => setHoveredCheckbox((v) => (v === mid ? null : v))}
        >
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggle(mid)}
            className="sr-only"
            aria-label={`Välj ${String((m as any).code ?? "")}`}
          />
          <span
            className={
              "block h-[22px] w-[22px] rounded-[6px] border-2 transition " +
              (isChecked
                ? "border-emerald-500 bg-emerald-500"
                : "border-slate-500 bg-white hover:bg-slate-100")
            }
            aria-hidden="true"
          >
            {isChecked && (
              <svg
                viewBox="0 0 20 20"
                className="mx-auto mt-[1px] h-4 w-4 text-white"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M5 10.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </label>
      </article>
    );
  }
}


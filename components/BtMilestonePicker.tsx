// components/BtMilestonePicker.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { btMilestones, type BtMilestone } from "@/lib/goals-bt";

/**
 * Trim av rubriker utan flimmer – identisk med MilestonePicker.
 */
function TitleTrimmer({ text, className }: { text: string; className?: string }) {
  const t = String(text ?? "");
  const maxLength = 80;
  const display = t.length > maxLength ? t.slice(0, maxLength).trimEnd() + "..." : t;
  return (
    <span className={className} title={t}>
      {display}
    </span>
  );
}

type Props = {
  open: boolean;
  title: string;
  /** Markerade BT-koder, t.ex. "BT1", "BT2" … */
  checked: Set<string>;
  /** Toggle en kod (vi skickar tillbaka "BT1" o.s.v.) */
  onToggle: (btCode: string) => void;
  onClose: () => void;
};

export default function BtMilestonePicker({ open, title, checked, onToggle, onClose }: Props) {
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [hoveredCheckbox, setHoveredCheckbox] = useState<string | null>(null);

  // ESC för att stänga – samma som i MilestonePicker
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Filtrerad BT-lista (BT saknar A/B/C-grupper)
  const list = useMemo<BtMilestone[]>(() => {
    const base = Array.isArray(btMilestones) ? btMilestones : [];
    const qlc = q.trim().toLowerCase();
    if (!qlc) return base;
    return base.filter((m) => {
      const hay = [m.id, m.title, ...(m.bullets ?? [])].join(" ").toLowerCase();
      return hay.includes(qlc);
    });
  }, [q]);

  if (!open) return null;

  return (
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
        {/* Header – identisk struktur/klasser som i MilestonePicker */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-extrabold text-slate-900">{title}</h2>
            <p className="mt-1 text-[12px] leading-snug text-slate-700">
              Klicka på ett delmål för info. Kryssa i rutan till höger för att välja.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Sök i BT-delmål…"
              className="h-[40px] w-52 rounded-lg border border-slate-300 bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            <button
              onClick={onClose}
              className="inline-flex h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
              title="Stäng"
            >
              Stäng
            </button>
          </div>
        </header>

        {/* Body – samma kort/rad-stil som i MilestonePicker (checkbox inuti rutan) */}
        <section className="max-h-[75vh] overflow-auto p-4">
          {list.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
              Inga BT-delmål matchar sökningen.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {list
                .slice()
                .sort((a, b) => {
                  const na = Number(String(a.id).replace(/[^\d]/g, "")) || 0;
                  const nb = Number(String(b.id).replace(/[^\d]/g, "")) || 0;
                  return na - nb;
                })
                .map((m) => renderRow(m))}
            </div>

          )}
        </section>

        {/* Detalj-popup – design lik MilestonePicker, data från btMilestones (som i MilestoneOverviewModal) */}
        {detailId && (() => {
          const id = String(detailId).toUpperCase();
          const m = btMilestones.find((x) => x.id === id);
          const isMarked = checked.has(id);

          return (
            <div
              className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-3"
              onClick={(e) => {
                if (e.target === e.currentTarget) setDetailId(null);
              }}
            >
              <div
                className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="flex items-center justify-between border-b px-4 py-3">
                  <div className="min-w-0">
                    <div className="mb-1 inline-flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-800">
                        {id}
                      </span>
                      <h3 className="m-0 truncate text-[15px] font-extrabold text-slate-900">
                        <TitleTrimmer text={m?.title ?? "BT-delmål"} />
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggle(id)}
                      className={
                        "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-white " +
                        (isMarked
                          ? "bg-rose-500 hover:bg-rose-600 active:translate-y-px"
                          : "bg-emerald-500 hover:bg-emerald-600 active:translate-y-px")
                      }
                    >
                      {isMarked ? "Avmarkera delmål" : "Markera delmål"}
                    </button>
                    <button
                      onClick={() => setDetailId(null)}
                      className="inline-flex h-[36px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-100 active:translate-y-px"
                      title="Stäng"
                    >
                      Stäng
                    </button>
                  </div>
                </header>

                <div className="px-4 py-4">
                  {m ? (
                    <ul className="list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-slate-800">
                      {m.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-[14px] text-slate-700">Information saknas för {id}.</div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );

  /** En rad – identisk design som i MilestonePicker:
   *  - Vänster: chip (kod) + titel; öppnar detalj
   *  - Höger: egen-stylad checkbox inuti rutan (toggle), med hover som inte påverkar radens hover
   */
  function renderRow(m: BtMilestone) {
    const mid = String(m.id ?? "").toUpperCase().replace(/\s|_|-/g, ""); // "BT1"
    const isChecked = checked.has(mid);

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
            {mid}
          </span>
          <TitleTrimmer text={String(m.title ?? "")} className="truncate text-[12px]" />
        </button>

        {/* Höger: stor kryssruta utan yttre vit ram. Hover på kryssrutan ska inte trigga radens hover. */}
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
            aria-label={`Välj ${mid}`}
          />
          {/* Egen-stylad ruta – samma som i MilestonePicker */}
          <span
            className={
              "block h-[22px] w-[22px] rounded-[6px] border-2 transition " +
              (isChecked ? "border-emerald-500 bg-emerald-500" : "border-slate-500 bg-white hover:bg-slate-100")
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
                <path
                  d="M5 10.5l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        </label>
      </article>
    );
  }
}

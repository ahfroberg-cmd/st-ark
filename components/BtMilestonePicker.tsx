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
  const [detailId, setDetailId] = useState<string | null>(null);
  const [hoveredCheckbox, setHoveredCheckbox] = useState<string | null>(null);

  // ESC för att stänga – samma som i MilestonePicker
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // BT-lista (ingen filtrering - sökfältet är borttaget)
  const list = useMemo<BtMilestone[]>(() => {
    return Array.isArray(btMilestones) ? btMilestones : [];
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header – matchar mobilversionens design */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-sky-50 px-5 py-4">
          <h2 className="text-xl font-extrabold text-sky-900">{title}</h2>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px shrink-0"
            title="Stäng"
            data-info="Stänger BT-delmål-dialogen. De markerade delmålen behålls."
          >
            ✕
          </button>
        </header>

        {/* Body – samma kort/rad-stil som i MilestonePicker (checkbox inuti rutan) */}
        <section className="flex-1 overflow-y-auto p-5">
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

        {/* Detalj-popup – design lik mobilversionens modaler */}
        {detailId && (() => {
          const id = String(detailId).toUpperCase();
          const m = btMilestones.find((x) => x.id === id);
          const isMarked = checked.has(id);

          return (
            <div
              className="fixed inset-0 z-[270] flex items-center justify-center bg-black/40 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setDetailId(null);
              }}
            >
              <div
                className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <header className="flex items-center justify-between border-b border-slate-200 bg-sky-50 px-5 py-4">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 shrink-0">
                      {id.toLowerCase()}
                    </span>
                    <h3 className="text-base sm:text-lg font-extrabold text-sky-900 break-words">
                      {m?.title ?? "BT-delmål"}
                    </h3>
                  </div>
                  <button
                    onClick={() => setDetailId(null)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100 active:translate-y-px"
                    title="Stäng"
                  >
                    ✕
                  </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {m ? (
                    <div className="prose prose-slate max-w-none text-[14px] leading-relaxed text-slate-900">
                      <ul className="list-disc space-y-2 pl-5 text-slate-900">
                        {m.bullets.map((b, i) => (
                          <li key={i} className="text-slate-900">{b}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-[14px] text-slate-700">Information saknas för {id}.</div>
                  )}
                </div>

                {/* Footer med knappar */}
                <div className="border-t border-slate-200 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      onToggle(id);
                      setDetailId(null);
                    }}
                    className={
                      "w-full inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition " +
                      (isMarked
                        ? "bg-rose-500 hover:bg-rose-600 active:translate-y-px"
                        : "bg-emerald-500 hover:bg-emerald-600 active:translate-y-px")
                    }
                    data-info={isMarked ? "Avmarkera delmål" : "Markera delmål"}
                  >
                    {isMarked ? "Avmarkera delmål" : "Markera delmål"}
                  </button>
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
        data-info={`Klicka för att öppna detaljvyn för BT-delmål ${mid}. ${isChecked ? "Delmålet är markerat." : "Delmålet är inte markerat."}`}
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
          data-info={isChecked ? "Avmarkera delmål" : "Markera delmål"}
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

// components/DesktopBtMilestonePicker.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { btMilestones, type BtMilestone } from "@/lib/goals-bt";
import { db } from "@/lib/db";

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

export default function DesktopBtMilestonePicker({ open, title, checked, onToggle, onClose }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [hoveredCheckbox, setHoveredCheckbox] = useState<string | null>(null);

  // ESC för att stänga
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // BT-lista
  const list = useMemo<BtMilestone[]>(() => {
    return Array.isArray(btMilestones) ? btMilestones : [];
  }, []);

  // Hitta BT-delmål för detaljvyn
  const detailMilestone = useMemo(() => {
    if (!detailId) return null;
    const id = String(detailId).toUpperCase();
    return btMilestones.find((x) => x.id === id) || null;
  }, [detailId]);

  const isDetailChecked = detailId ? checked.has(String(detailId).toUpperCase()) : false;

  const isDetailChecked = detailId ? checked.has(String(detailId).toUpperCase()) : false;

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[260] flex items-center justify-center bg-black/40 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-[980px] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
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

          {/* Body – samma kort/rad-stil som i MilestonePicker */}
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
        </div>
      </div>

      {/* Detalj-popup – matchar IUP->Delmål design (BT har ingen plan-textarea, bara beskrivning) */}
      {detailId && detailMilestone && (() => {
        const m = detailMilestone;
        const id = String(detailId).toUpperCase();

        return (
          <div
            className="fixed inset-0 z-[270] grid place-items-center bg-black/40 p-4"
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
                    {id.toLowerCase()}
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900 break-words">
                    {m?.title ?? "BT-delmål"}
                  </h3>
                </div>
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
                  <div className="text-slate-900">Information saknas för {id}.</div>
                )}
              </div>

              {/* Footer med Markera/Avmarkera och Stäng */}
              <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => {
                    onToggle(id);
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

  /** En rad – identisk design som i MilestonePicker */
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
            aria-label={`Välj ${mid}`}
          />
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


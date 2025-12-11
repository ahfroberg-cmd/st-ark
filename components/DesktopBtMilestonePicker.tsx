// components/DesktopBtMilestonePicker.tsx
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-semibold text-slate-900 hover:bg-slate-100"
              title="Stäng"
            >
              ✕
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

      {/* Detalj-popup – vit header, samma stil som LegacyMilestoneDetail */}
      {detailId && detailMilestone && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.32)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 270,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailId(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 860,
              overflow: "hidden",
              boxShadow: "0 12px 36px rgba(0,0,0,.28)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {String(detailMilestone.id ?? "").toLowerCase()} – {detailMilestone.title}
              </div>
              {!readOnly ? (
                <button
                  onClick={() => {
                    onToggle(String(detailId).toUpperCase());
                    setDetailId(null);
                  }}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid",
                    borderRadius: 10,
                    background: isDetailChecked ? "#ef4444" : "#10b981",
                    borderColor: isDetailChecked ? "#ef4444" : "#10b981",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Spara och stäng
                </button>
              ) : (
                <button
                  onClick={() => setDetailId(null)}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #d0d7de",
                    borderRadius: 10,
                    background: "#fff",
                    width: 36,
                    height: 36,
                    lineHeight: "20px",
                    textAlign: "center",
                    paddingInline: 0,
                  }}
                  aria-label="Stäng"
                >
                  ×
                </button>
              )}
            </header>

            <div style={{ padding: 14, maxHeight: "70vh", overflow: "auto" }}>
              {detailMilestone.bullets && detailMilestone.bullets.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <article
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 10,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Beskrivning</div>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
                        fontSize: 14,
                        color: "#111827",
                      }}
                    >
                      {detailMilestone.bullets.map((b, i) => `• ${b}`).join("\n")}
                    </pre>
                  </article>
                </div>
              ) : (
                <div
                  style={{
                    padding: 10,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    background: "#fafafa",
                    color: "#374151",
                  }}
                >
                  Ingen beskrivning hittades för detta BT-delmål.
                </div>
              )}
            </div>

            <footer
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <button
                onClick={() => {
                  onToggle(String(detailId).toUpperCase());
                  setDetailId(null);
                }}
                style={{
                  padding: "8px 12px",
                  border: "1px solid",
                  borderRadius: 10,
                  background: isDetailChecked ? "#ef4444" : "#10b981",
                  borderColor: isDetailChecked ? "#ef4444" : "#10b981",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {isDetailChecked ? "Avmarkera delmål" : "Välj delmål"}
              </button>
              <div style={{ marginLeft: "auto" }} />
              <button
                onClick={() => setDetailId(null)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #d0d7de",
                  borderRadius: 10,
                  background: "#fff",
                }}
              >
                Stäng
              </button>
            </footer>
          </div>
        </div>
      )}
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

